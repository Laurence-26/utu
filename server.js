const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

/* Anyone with this key can read every visitor's name and phone number, so it
   must be set to something private before the admin panel goes online. */
const ADMIN_KEY = process.env.ADMIN_KEY || 'utu-admin';
const DEFAULT_KEY_IN_USE = !process.env.ADMIN_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Calling: enabled only when the site is served locally ----------
   Tapping "Call" opens the device dialer, so it stays switched off on the
   public deployment and works when you run the app on your own machine. */
function callsEnabled(req){
  const host = String(req.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
         /^10\./.test(host) || /^192\.168\./.test(host) ||
         /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

app.get('/api/config', (req, res) => res.json({ callsEnabled: callsEnabled(req) }));

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/room', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'room.html')));

/* ---------- Anchors: universities & workplaces ---------- */
const ANCHORS = {
  uni: [
    { id:'udsm',  name:'University of Dar es Salaam (Mlimani)', lat:-6.7754, lng:39.2054 },
    { id:'ardhi', name:'Ardhi University',                      lat:-6.7657, lng:39.2160 },
    { id:'muhas', name:'MUHAS (Muhimbili)',                     lat:-6.8000, lng:39.2730 },
    { id:'dit',   name:'DIT — Dar Institute of Technology',     lat:-6.8161, lng:39.2803 },
    { id:'ifm',   name:'Institute of Finance Management (IFM)', lat:-6.8145, lng:39.2920 },
    { id:'oust',  name:'Open University of Tanzania (Kinondoni)', lat:-6.7790, lng:39.2560 },
  ],
  work: [
    { id:'posta',    name:'Posta / City Centre (CBD)', lat:-6.8161, lng:39.2894 },
    { id:'kariakoo', name:'Kariakoo Market area',      lat:-6.8209, lng:39.2703 },
    { id:'mlimanic', name:'Mlimani City',              lat:-6.7715, lng:39.2200 },
    { id:'masaki',   name:'Masaki / Msasani offices',  lat:-6.7398, lng:39.2795 },
    { id:'mwenge',   name:'Mwenge business area',      lat:-6.7669, lng:39.2225 },
    { id:'ubungoT',  name:'Ubungo (bus terminal area)', lat:-6.7889, lng:39.2110 },
  ],
};

const haversine = (a, b) => {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* Approximate coordinates for common Dar es Salaam areas (for new listings) */
const AREA_COORDS = {
  'sinza':[-6.7789,39.2262],'mikocheni':[-6.7616,39.2436],'ubungo':[-6.7893,39.2075],
  'kijitonyama':[-6.7686,39.2381],'mwenge':[-6.7647,39.2249],'tabata':[-6.8320,39.2242],
  'upanga':[-6.8046,39.2846],'msasani':[-6.7565,39.2669],'kinondoni':[-6.7854,39.2564],
  'mbezi beach':[-6.7211,39.2249],'mbezi':[-6.7500,39.1700],'ilala':[-6.8262,39.2624],
  'kigamboni':[-6.8323,39.3060],'manzese':[-6.7973,39.2320],'kariakoo':[-6.8209,39.2703],
  'magomeni':[-6.8020,39.2500],'temeke':[-6.8560,39.2620],'mabibo':[-6.8060,39.2200],
  'kimara':[-6.7690,39.1580],'goba':[-6.7200,39.1700],'tegeta':[-6.6570,39.1400],
  'kawe':[-6.7280,39.2230],'masaki':[-6.7398,39.2795],'buguruni':[-6.8290,39.2450],
  'segerea':[-6.8390,39.2130],'city centre':[-6.8161,39.2894],'posta':[-6.8161,39.2894],
};

/* ---------- API ---------- */
app.get('/api/anchors', (_req, res) => res.json(ANCHORS));

// Demo landlord accounts (name + phone) so anyone can try the landlord dashboard
app.get('/api/landlords', (_req, res) => {
  const rows = db.prepare(`
    SELECT ll.name, ll.phone, COUNT(l.id) AS listings
    FROM landlords ll LEFT JOIN listings l ON l.landlord_phone = ll.phone
    GROUP BY ll.id ORDER BY ll.id`).all();
  res.json(rows);
});

app.get('/api/areas', (_req, res) => res.json(Object.keys(AREA_COORDS).sort()));

/* The comparison table and the admin form both build themselves from this,
   so the list of things rooms are compared on lives in exactly one place. */
const AMENITIES = db.AMENITIES;
app.get('/api/amenities', (_req, res) => res.json(AMENITIES));

// Rows come out of SQLite with tags and amenities as JSON text
function hydrate(row){
  let amenities = {};
  try { amenities = JSON.parse(row.amenities || '{}'); } catch {}
  const present = AMENITIES.filter(a => amenities[a.key]).length;
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    master: !!row.master,
    amenities,
    // "quality" stated plainly: how many of the compared features it actually has
    featureCount: present,
    featureTotal: AMENITIES.length
  };
}

// GET /api/listings?beds=1&maxPrice=70000&master=1&q=sinza&lat=-6.77&lng=39.20&sort=near
app.get('/api/listings', (req, res) => {
  const { beds, maxPrice, q, lat, lng, sort, master } = req.query;
  let rows = db.prepare('SELECT * FROM listings ORDER BY created_at DESC').all().map(hydrate);

  if (beds && +beds > 0) rows = rows.filter(r => r.beds === +beds);
  if (master === '1') rows = rows.filter(r => r.master);
  if (maxPrice && +maxPrice > 0) rows = rows.filter(r => r.price <= +maxPrice);
  if (q) {
    const s = String(q).toLowerCase();
    rows = rows.filter(r => r.area.toLowerCase().includes(s) || r.name.toLowerCase().includes(s));
  }
  if (lat && lng) {
    const anchor = { lat: +lat, lng: +lng };
    rows.forEach(r => { r.km = +haversine(anchor, r).toFixed(2); });
    if (sort === 'near' || !sort) rows.sort((a, b) => a.km - b.km);
  }
  if (sort === 'low') rows.sort((a, b) => a.price - b.price);
  if (sort === 'high') rows.sort((a, b) => b.price - a.price);

  res.json(rows);
});

// GET /api/listings/:id — everything the room's own page needs
app.get('/api/listings/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM listings WHERE id=?').get(+req.params.id);
  if (!row) return res.status(404).json({ error: 'Room not found.' });

  const listing = hydrate(row);
  const photos = db.prepare('SELECT url, caption FROM listing_photos WHERE listing_id=? ORDER BY position, id')
    .all(listing.id);

  // Distance to every campus and workplace, nearest first, so a tenant can see
  // at a glance whether this room works for where their day actually happens.
  const distances = [...ANCHORS.uni.map(a => ({ ...a, kind: 'uni' })),
                     ...ANCHORS.work.map(a => ({ ...a, kind: 'work' }))]
    .map(a => ({ id: a.id, name: a.name, kind: a.kind, km: +haversine(a, listing).toFixed(2) }))
    .sort((a, b) => a.km - b.km);

  res.json({ listing, photos, distances });
});

// POST /api/listings  — landlord posts a house
const FALLBACK_PHOTOS = [
  'photo-1554995207-c18c203602cb','photo-1536376072261-38c75010e6c9','photo-1522708323590-d24dbb6b0267',
  'photo-1560448204-e02f11c3d0e2','photo-1502672260266-1c1ef2d93688','photo-1540518614846-7eded433c457',
].map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=60`);

/* Shared by the public "List your house" form and the admin panel.
   Returns { error } for a bad submission, or { id } once it is live. */
function createListing(body){
  const { name, area, beds, price, tags, landlord_name, landlord_phone, photo_url, master,
          description, photos, amenities } = body || {};
  if (!name || !area || !beds || !price || !landlord_name || !landlord_phone)
    return { error: 'name, area, beds, price, landlord_name and landlord_phone are required.' };
  if (![1, 2].includes(+beds))
    return { error: 'Only 1 or 2 bedroom houses are accepted.' };
  if (+price < 10000)
    return { error: 'Price looks too low — enter monthly rent in TZS.' };

  let photo = String(photo_url || '').trim();
  if (photo && !/^https?:\/\//i.test(photo))
    return { error: 'Photo must be a full link starting with http:// or https://' };
  if (!photo) photo = FALLBACK_PHOTOS[Math.floor(Math.random() * FALLBACK_PHOTOS.length)];

  const key = String(area).trim().toLowerCase();
  const [lat, lng] = AREA_COORDS[key] || [-6.8000, 39.2500]; // Dar centre fallback
  const hue = 10 + Math.floor(Math.random() * 28);
  const tagList = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',').map(t => t.trim()).filter(Boolean);

  const llName = String(landlord_name).trim(), llPhone = String(landlord_phone).trim();
  db.prepare('INSERT OR IGNORE INTO landlords (name, phone) VALUES (?,?)').run(llName, llPhone);

  // Only keys we actually compare on, so the table never grows a stray column
  const amenityMap = {};
  AMENITIES.forEach(a => { amenityMap[a.key] = (amenities && amenities[a.key]) ? 1 : 0; });

  const info = db.prepare(`INSERT INTO listings (name,area,beds,price,lat,lng,tags,hue,landlord_name,landlord_phone,photo_url,master,description,amenities)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(String(name).trim(), String(area).trim(), +beds, +price, lat, lng,
         JSON.stringify(tagList.slice(0, 5)), hue, llName, llPhone, photo, master ? 1 : 0,
         String(description || '').trim() || null, JSON.stringify(amenityMap));

  // Extra gallery photos, one link per line or comma-separated
  const extra = (Array.isArray(photos) ? photos : String(photos || '').split(/[\n,]/))
    .map(p => String(p).trim()).filter(p => /^https?:\/\//i.test(p)).slice(0, 8);
  if (extra.length){
    const insP = db.prepare('INSERT INTO listing_photos (listing_id,url,caption,position) VALUES (?,?,?,?)');
    extra.forEach((url, i) => insP.run(info.lastInsertRowid, url, null, i));
  }

  return { id: info.lastInsertRowid };
}

app.post('/api/listings', (req, res) => {
  const out = createListing(req.body);
  if (out.error) return res.status(400).json({ error: out.error });
  res.status(201).json({ id: out.id, message: 'Listing published.' });
});

// POST /api/viewings — tenant requests a viewing
app.post('/api/viewings', (req, res) => {
  const { listing_id, visitor_name, visitor_phone, message } = req.body || {};
  if (!listing_id || !visitor_name || !visitor_phone)
    return res.status(400).json({ error: 'listing_id, visitor_name and visitor_phone are required.' });
  const listing = db.prepare('SELECT id, name FROM listings WHERE id=?').get(+listing_id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  const info = db.prepare(`INSERT INTO viewings (listing_id,visitor_name,visitor_phone,message)
                           VALUES (?,?,?,?)`)
    .run(+listing_id, String(visitor_name).trim(), String(visitor_phone).trim(), String(message || '').trim());

  res.status(201).json({ id: info.lastInsertRowid, message: `Viewing request sent for "${listing.name}".` });
});

// GET /api/viewings?phone=... — landlord checks requests for their listings
app.get('/api/viewings', (req, res) => {
  const phone = String(req.query.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Provide your landlord phone: /api/viewings?phone=...' });
  const rows = db.prepare(`
    SELECT v.id, v.visitor_name, v.visitor_phone, v.message, v.status, v.created_at,
           l.name AS listing_name, l.area
    FROM viewings v JOIN listings l ON l.id = v.listing_id
    WHERE l.landlord_phone = ?
    ORDER BY v.created_at DESC`).all(phone);
  res.json(rows);
});

/* ---------- Chat: visitor side ---------- */
// A visitor opens the chat widget. Returns the session id their browser stores.
app.post('/api/chat/start', (req, res) => {
  const { name, phone } = req.body || {};
  const sid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  db.prepare('INSERT INTO chats (session_id, visitor_name, visitor_phone) VALUES (?,?,?)')
    .run(sid, String(name || '').trim() || 'Visitor', String(phone || '').trim());
  db.prepare(`INSERT INTO messages (session_id, sender, body) VALUES (?, 'admin', ?)`)
    .run(sid, 'Karibu Utu! Ask us anything about a room and we will reply here.');
  res.status(201).json({ session_id: sid });
});

app.get('/api/chat/:sid', (req, res) => {
  const chat = db.prepare('SELECT * FROM chats WHERE session_id=?').get(req.params.sid);
  if (!chat) return res.status(404).json({ error: 'Chat not found. Start a new one.' });
  const messages = db.prepare('SELECT id, sender, body, created_at FROM messages WHERE session_id=? ORDER BY id').all(req.params.sid);
  res.json({ chat, messages, callsEnabled: callsEnabled(req) });
});

app.post('/api/chat/:sid', (req, res) => {
  const chat = db.prepare('SELECT session_id FROM chats WHERE session_id=?').get(req.params.sid);
  if (!chat) return res.status(404).json({ error: 'Chat not found. Start a new one.' });
  const body = String((req.body || {}).body || '').trim();
  if (!body) return res.status(400).json({ error: 'Type a message first.' });
  const info = db.prepare(`INSERT INTO messages (session_id, sender, body) VALUES (?, 'user', ?)`)
    .run(req.params.sid, body.slice(0, 1000));
  res.status(201).json({ id: info.lastInsertRowid });
});

/* ---------- Admin panel ---------- */
function requireAdmin(req, res, next){
  const key = req.get('x-admin-key') || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Wrong admin key.' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (String((req.body || {}).key) !== ADMIN_KEY) return res.status(401).json({ error: 'Wrong admin key.' });
  res.json({ ok: true, callsEnabled: callsEnabled(req), usingDefaultKey: DEFAULT_KEY_IN_USE });
});

// Every viewing request across every landlord
app.get('/api/admin/viewings', requireAdmin, (_req, res) => {
  res.json(db.prepare(`
    SELECT v.id, v.visitor_name, v.visitor_phone, v.message, v.status, v.created_at,
           l.name AS listing_name, l.area, l.price, l.beds, l.master,
           l.landlord_name, l.landlord_phone
    FROM viewings v JOIN listings l ON l.id = v.listing_id
    ORDER BY v.created_at DESC, v.id DESC`).all());
});

app.patch('/api/admin/viewings/:id', requireAdmin, (req, res) => {
  const status = String((req.body || {}).status || '');
  if (!['pending', 'contacted', 'closed'].includes(status))
    return res.status(400).json({ error: 'Status must be pending, contacted or closed.' });
  const info = db.prepare('UPDATE viewings SET status=? WHERE id=?').run(status, +req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Request not found.' });
  res.json({ ok: true, status });
});

app.get('/api/admin/summary', requireAdmin, (req, res) => {
  const one = sql => db.prepare(sql).get().n;
  res.json({
    listings: one('SELECT COUNT(*) n FROM listings'),
    master: one('SELECT COUNT(*) n FROM listings WHERE master=1'),
    viewings: one('SELECT COUNT(*) n FROM viewings'),
    pending: one(`SELECT COUNT(*) n FROM viewings WHERE status='pending'`),
    chats: one('SELECT COUNT(*) n FROM chats'),
    unread: one(`SELECT COUNT(DISTINCT session_id) n FROM messages WHERE sender='user'`),
    callsEnabled: callsEnabled(req),
    usingDefaultKey: DEFAULT_KEY_IN_USE
  });
});

// Admin posts a room straight onto the public site
app.post('/api/admin/listings', requireAdmin, (req, res) => {
  const out = createListing(req.body);
  if (out.error) return res.status(400).json({ error: out.error });
  res.status(201).json({ id: out.id, message: 'Room posted — it is live on the site now.' });
});

app.delete('/api/admin/listings/:id', requireAdmin, (req, res) => {
  const id = +req.params.id;
  const pending = db.prepare('SELECT COUNT(*) n FROM viewings WHERE listing_id=?').get(id).n;
  if (pending) return res.status(409).json({
    error: `That room has ${pending} viewing request${pending === 1 ? '' : 's'} attached. Close those first.` });
  db.prepare('DELETE FROM listing_photos WHERE listing_id=?').run(id);
  const info = db.prepare('DELETE FROM listings WHERE id=?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Room not found.' });
  res.json({ ok: true });
});

app.get('/api/admin/chats', requireAdmin, (_req, res) => {
  res.json(db.prepare(`
    SELECT c.session_id, c.visitor_name, c.visitor_phone, c.created_at,
           (SELECT body FROM messages m WHERE m.session_id=c.session_id ORDER BY m.id DESC LIMIT 1) AS last_body,
           (SELECT sender FROM messages m WHERE m.session_id=c.session_id ORDER BY m.id DESC LIMIT 1) AS last_sender,
           (SELECT COUNT(*) FROM messages m WHERE m.session_id=c.session_id) AS total
    FROM chats c ORDER BY c.created_at DESC`).all());
});

app.get('/api/admin/chats/:sid', requireAdmin, (req, res) => {
  const chat = db.prepare('SELECT * FROM chats WHERE session_id=?').get(req.params.sid);
  if (!chat) return res.status(404).json({ error: 'Chat not found.' });
  res.json({
    chat,
    messages: db.prepare('SELECT id, sender, body, created_at FROM messages WHERE session_id=? ORDER BY id').all(req.params.sid)
  });
});

app.post('/api/admin/chats/:sid', requireAdmin, (req, res) => {
  const chat = db.prepare('SELECT session_id FROM chats WHERE session_id=?').get(req.params.sid);
  if (!chat) return res.status(404).json({ error: 'Chat not found.' });
  const body = String((req.body || {}).body || '').trim();
  if (!body) return res.status(400).json({ error: 'Type a reply first.' });
  const info = db.prepare(`INSERT INTO messages (session_id, sender, body) VALUES (?, 'admin', ?)`)
    .run(req.params.sid, body.slice(0, 1000));
  res.status(201).json({ id: info.lastInsertRowid });
});

app.listen(PORT, () => {
  console.log(`Utu running → http://localhost:${PORT}`);
  console.log(`Admin panel → http://localhost:${PORT}/admin`);
  if (DEFAULT_KEY_IN_USE)
    console.log(`Admin key   → "${ADMIN_KEY}" (development default — set ADMIN_KEY before deploying)`);
});
