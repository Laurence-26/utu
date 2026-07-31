const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// GET /api/listings?beds=1&maxPrice=250000&q=sinza&lat=-6.77&lng=39.20&sort=near
app.get('/api/listings', (req, res) => {
  const { beds, maxPrice, q, lat, lng, sort } = req.query;
  let rows = db.prepare('SELECT * FROM listings ORDER BY created_at DESC').all()
    .map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }));

  if (beds && +beds > 0) rows = rows.filter(r => r.beds === +beds);
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

// POST /api/listings  — landlord posts a house
const FALLBACK_PHOTOS = [
  'photo-1554995207-c18c203602cb','photo-1536376072261-38c75010e6c9','photo-1522708323590-d24dbb6b0267',
  'photo-1560448204-e02f11c3d0e2','photo-1502672260266-1c1ef2d93688','photo-1540518614846-7eded433c457',
].map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=60`);

app.post('/api/listings', (req, res) => {
  const { name, area, beds, price, tags, landlord_name, landlord_phone, photo_url } = req.body || {};
  if (!name || !area || !beds || !price || !landlord_name || !landlord_phone)
    return res.status(400).json({ error: 'name, area, beds, price, landlord_name and landlord_phone are required.' });
  if (![1, 2].includes(+beds))
    return res.status(400).json({ error: 'Only 1 or 2 bedroom houses are accepted.' });
  if (+price < 10000)
    return res.status(400).json({ error: 'Price looks too low — enter monthly rent in TZS.' });

  const key = String(area).trim().toLowerCase();
  const [lat, lng] = AREA_COORDS[key] || [-6.8000, 39.2500]; // Dar centre fallback
  const hue = 10 + Math.floor(Math.random() * 28);
  const tagList = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',').map(t => t.trim()).filter(Boolean);

  let photo = String(photo_url || '').trim();
  if (photo && !/^https?:\/\//i.test(photo))
    return res.status(400).json({ error: 'Photo must be a full link starting with http:// or https://' });
  if (!photo) photo = FALLBACK_PHOTOS[Math.floor(Math.random() * FALLBACK_PHOTOS.length)];

  const llName = String(landlord_name).trim(), llPhone = String(landlord_phone).trim();
  db.prepare('INSERT OR IGNORE INTO landlords (name, phone) VALUES (?,?)').run(llName, llPhone);

  const info = db.prepare(`INSERT INTO listings (name,area,beds,price,lat,lng,tags,hue,landlord_name,landlord_phone,photo_url)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(String(name).trim(), String(area).trim(), +beds, +price, lat, lng,
         JSON.stringify(tagList.slice(0, 5)), hue, llName, llPhone, photo);

  res.status(201).json({ id: info.lastInsertRowid, message: 'Listing published.' });
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

app.listen(PORT, () => console.log(`Utu running → http://localhost:${PORT}`));
