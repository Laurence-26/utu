const Database = require('better-sqlite3');
const db = new Database('nyumbani.db');

db.exec(`
CREATE TABLE IF NOT EXISTS landlords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  beds INTEGER NOT NULL CHECK (beds IN (1,2)),
  price INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  tags TEXT DEFAULT '[]',
  photo_url TEXT,
  landlord_name TEXT,
  landlord_phone TEXT,
  hue INTEGER DEFAULT 24,
  master INTEGER DEFAULT 0,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS viewings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- One chat thread per visitor. The browser keeps the session id in localStorage
-- so a visitor returning to the site picks their conversation back up.
CREATE TABLE IF NOT EXISTS chats (
  session_id TEXT PRIMARY KEY,
  visitor_name TEXT,
  visitor_phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES chats(session_id),
  sender TEXT NOT NULL CHECK (sender IN ('user','admin')),
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Extra photos shown on a room's own page: the rooms inside plus the
-- street and surroundings, so a tenant knows the area before travelling.
CREATE TABLE IF NOT EXISTS listing_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  position INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_photos_listing ON listing_photos(listing_id, position);
`);

// Migrations for databases created before these columns existed
const cols = db.prepare(`PRAGMA table_info(listings)`).all().map(c => c.name);
if (!cols.includes('photo_url')) db.exec(`ALTER TABLE listings ADD COLUMN photo_url TEXT`);
if (!cols.includes('master'))    db.exec(`ALTER TABLE listings ADD COLUMN master INTEGER DEFAULT 0`);
if (!cols.includes('description')) db.exec(`ALTER TABLE listings ADD COLUMN description TEXT`);
if (!cols.includes('amenities'))   db.exec(`ALTER TABLE listings ADD COLUMN amenities TEXT DEFAULT '{}'`);

/* ---------------- Demo landlords ---------------- */
const DEMO_LANDLORDS = [
  { name: 'Mzee Juma Mkwawa',    phone: '0754 111 222' },
  { name: 'Mama Neema Kessy',    phone: '0713 222 333' },
  { name: 'Baraka Homes Agency', phone: '0765 333 444' },
  { name: 'Bi. Zainabu Said',    phone: '0784 444 555' },
];

/* Free-to-use Unsplash photos of rooms and houses */
const IMG = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=60`;

/* master = 1 means the main bedroom is en-suite (bathroom inside the bedroom) */
const seedListings = [
  // name, area, beds, price, lat, lng, tags, hue, landlordIndex, photo, master
  ['Sinza Palestina Single Room','Sinza',1,68000,-6.7789,39.2262,['Self-contained','Water tank','Luku meter'],24,0,IMG('photo-1536376072261-38c75010e6c9'),0],
  ['Mikocheni B Garden Flat','Mikocheni',2,78000,-6.7616,39.2436,['Tiled floors','Parking','Fenced'],16,2,IMG('photo-1512917774080-9991f1c4c750'),1],
  ['Ubungo Riverside Room','Ubungo',1,62000,-6.7893,39.2075,['Near daladala stand','Shared fence'],30,0,IMG('photo-1505693416388-ac5ce068fe85'),0],
  ['Kijitonyama Twin Rooms','Kijitonyama',2,74000,-6.7686,39.2381,['Self-contained','Kitchen inside','Ceiling fans'],20,1,IMG('photo-1522708323590-d24dbb6b0267'),1],
  ['Mwenge Makumbusho Single','Mwenge',1,70000,-6.7647,39.2249,['Near Mwenge stand','Water 24/7'],34,1,IMG('photo-1540518614846-7eded433c457'),0],
  ['Tabata Segerea Family House','Tabata',2,72000,-6.8320,39.2242,['Big compound','Bore-hole water'],14,3,IMG('photo-1568605114967-8130f3a36994'),1],
  ['Upanga Seaview Single','Upanga',1,73000,-6.8046,39.2846,['Near Muhimbili','Tiled','Secure gate'],26,2,IMG('photo-1502672260266-1c1ef2d93688'),1],
  ['Msasani Bonde la Mpunga 2BR','Msasani',2,80000,-6.7565,39.2669,['Modern finish','Parking','Standby water'],18,2,IMG('photo-1600585154340-be6161a56a0c'),1],
  ['Kinondoni Mkwajuni Room','Kinondoni',1,69000,-6.7854,39.2564,['Close to road','Shared veranda'],28,3,IMG('photo-1560448204-e02f11c3d0e2'),0],
  ['Mbezi Beach Makonde 2BR','Mbezi Beach',2,76000,-6.7211,39.2249,['Sea breeze','Fenced','Parking'],22,2,IMG('photo-1600596542815-ffad4c1539a9'),1],
  ['Ilala Bungoni Single Room','Ilala',1,64000,-6.8262,39.2624,['Near Kariakoo','Luku meter'],32,0,IMG('photo-1554995207-c18c203602cb'),0],
  ['Kigamboni Ferry-side 2BR','Kigamboni',2,71000,-6.8323,39.3060,['Quiet street','Big rooms'],12,3,IMG('photo-1570129477492-45c003edd2be'),0],
  ['Manzese Argentina Single','Manzese',1,60000,-6.7973,39.2320,['Budget friendly','Near daladala'],36,1,IMG('photo-1484154218962-a197022b5858'),0],
  ['Kijitonyama Sayansi Studio','Kijitonyama',1,66000,-6.7735,39.2320,['Self-contained','Near COSTECH'],25,1,IMG('photo-1493809842364-78817add7ffb'),1],
];

/* The things tenants actually compare rooms on. Kept as a fixed list rather
   than free text so two rooms can be put side by side honestly. */
const AMENITIES = [
  { key:'toilet',    label:'Private toilet & shower' },
  { key:'kitchen',   label:'Kitchen inside' },
  { key:'parking',   label:'Parking space' },
  { key:'luku',      label:'Own Luku meter' },
  { key:'water',     label:'Water included in rent' },
  { key:'tank',      label:'Water tank or bore-hole' },
  { key:'fence',     label:'Fenced compound' },
  { key:'furnished', label:'Furnished' },
  { key:'wifi',      label:'Internet ready' },
];

/* Per-room amenity flags, in the same order as seedListings.
   Order of keys: toilet, kitchen, parking, luku, water, tank, fence, furnished, wifi */
const seedAmenities = [
  [1,0,0,1,0,1,0,0,0], // Sinza Palestina Single
  [1,1,1,1,0,0,1,0,1], // Mikocheni B Garden Flat
  [0,0,0,1,0,0,1,0,0], // Ubungo Riverside Room
  [1,1,0,1,0,1,1,0,0], // Kijitonyama Twin Rooms
  [0,0,0,1,1,0,0,0,0], // Mwenge Makumbusho Single
  [1,1,1,1,1,1,1,0,0], // Tabata Segerea Family House
  [1,0,0,1,0,1,1,0,1], // Upanga Seaview Single
  [1,1,1,1,0,1,1,1,1], // Msasani Bonde la Mpunga 2BR
  [0,0,0,1,0,0,0,0,0], // Kinondoni Mkwajuni Room
  [1,1,1,1,0,1,1,0,1], // Mbezi Beach Makonde 2BR
  [0,0,0,1,0,0,0,0,0], // Ilala Bungoni Single Room
  [1,1,1,1,0,1,1,0,0], // Kigamboni Ferry-side 2BR
  [0,0,0,1,0,0,0,0,0], // Manzese Argentina Single
  [1,1,0,1,0,1,1,1,1], // Kijitonyama Sayansi Studio
];

const amenityJSON = i => {
  const row = seedAmenities[i] || [];
  const out = {};
  AMENITIES.forEach((a, n) => { out[a.key] = row[n] ? 1 : 0; });
  return JSON.stringify(out);
};

/* Written for the room's own page — what a tenant wants to know before
   spending fare to come and look. Indexed to match seedListings above. */
const seedDescriptions = [
  'A self-contained single in the Palestina part of Sinza, on a quiet inner street about four minutes from the main road. The room takes a three-quarter bed with space left over for a desk. Water comes from a 1,000-litre tank on the roof, so the twice-weekly cuts are not felt here. Electricity is on a Luku prepaid meter you top up yourself.',
  'A two-bedroom garden flat in Mikocheni B, behind a fenced compound shared with two other tenants. The main bedroom is en-suite. Floors are tiled throughout, and the kitchen has fitted counters. There is off-street parking for one car and the gate is locked at night.',
  'A single room a short walk from the Ubungo daladala stand — useful if you commute daily and want to be on the road quickly. The compound is shared and fenced, with a common washing area at the back. The room is unfurnished and freshly painted.',
  'Two rooms in a Kijitonyama house, with the main bedroom en-suite and its own kitchen inside rather than a shared one. Ceiling fans in both rooms make a real difference in the hot months. The street is residential and quiet after dark.',
  'A single room minutes from the Mwenge stand and the Makumbusho junction, so buses in every direction are close. Water runs 24/7 from the mains here, which is uncommon in this pocket. Good for a student at Ardhi or UDSM who does not want a long commute.',
  'A family house in Tabata Segerea with a large compound — space for children to play, and room to dry washing properly. Water is from a private bore-hole, so supply is steady year-round. The main bedroom is en-suite; the second is a good size.',
  'A single in Upanga within walking distance of Muhimbili, which makes it a favourite with MUHAS students and hospital staff. Tiled, self-contained, behind a secure gate with a guard at night. Quiet street lined with old trees.',
  'A modern two-bedroom in Bonde la Mpunga, Msasani. Finished to a higher standard than most at this rent: fitted kitchen, en-suite main bedroom, standby water tank and parking inside the gate. Close to the Msasani offices and the peninsula shops.',
  'A single room in Mkwajuni, Kinondoni, close to the main road so transport is never a problem. Shared veranda at the front where tenants sit in the evening. Straightforward, well-kept, and among the cheaper rooms this near the centre.',
  'A two-bedroom in Makonde, Mbezi Beach, close enough to the water to catch the sea breeze in the afternoon. Fenced compound with parking. Suits someone working in Masaki or along the peninsula who wants more space than the centre allows.',
  'A single room in Bungoni, Ilala — about ten minutes on foot from Kariakoo market, so shopping and transport are on your doorstep. Luku prepaid meter. Busy during the day, which suits some people and not others.',
  'A two-bedroom on the Kigamboni side, a short walk from the ferry. Both rooms are unusually large. The street is quiet, and the pace on this side of the creek is slower than the city centre while still being twenty minutes from Posta.',
  'The cheapest room on Utu, in Argentina, Manzese. Basic and honest: one room, shared facilities, right by the daladala route into town. If the budget is the deciding factor, this is the one to look at first.',
  'A self-contained studio in the Sayansi area of Kijitonyama, close to COSTECH and an easy hop to UDSM. Bathroom inside the room. Popular with postgraduate students, so it does not stay empty long.',
];

/* Each room gets its own gallery: the room, a bedroom, the building, and the
   street outside — the last one matters most to someone who has not been there. */
const GALLERY_POOLS = {
  room:   ['photo-1522708323590-d24dbb6b0267','photo-1505693416388-ac5ce068fe85','photo-1540518614846-7eded433c457',
           'photo-1493809842364-78817add7ffb','photo-1536376072261-38c75010e6c9','photo-1554995207-c18c203602cb'],
  bed:    ['photo-1560448204-e02f11c3d0e2','photo-1522771739844-6a9f6d5f14af','photo-1505691938895-1758d7feb511',
           'photo-1595526114035-0d45ed16cfbf','photo-1616594039964-ae9021a400a0'],
  house:  ['photo-1568605114967-8130f3a36994','photo-1570129477492-45c003edd2be','photo-1512917774080-9991f1c4c750',
           'photo-1600585154340-be6161a56a0c','photo-1449844908441-8829872d2607'],
  street: ['photo-1449824913935-59a10b8d2000','photo-1502920917128-1aa500764cbd','photo-1519501025264-65ba15a82390',
           'photo-1477959858617-67f85cf4f1df','photo-1444723121867-7a241cacace9'],
};

function galleryFor(index, area){
  const pick = (pool, offset) => GALLERY_POOLS[pool][(index + offset) % GALLERY_POOLS[pool].length];
  return [
    { url: IMG(pick('room', 0)),   caption: 'The room' },
    { url: IMG(pick('bed', 1)),    caption: 'Sleeping area' },
    { url: IMG(pick('house', 2)),  caption: 'The building' },
    { url: IMG(pick('street', 3)), caption: `The street in ${area}` },
  ];
}

const seedViewings = [
  // listing index (0-based), visitor, phone, message
  [0, 'Amos', '0686860396', 'Naomba kuja Jumamosi asubuhi - I am a UDSM student.'],
  [0, 'Kelvin Mushi', '0716 987 654', 'Is the room still available? I work at Mlimani City.'],
  [3, 'Grace Mwakalinga', '0745 222 111', 'Can I view it this Sunday afternoon?'],
  [5, 'Ibrahim Salum', '0688 400 200', 'Interested for my family - is water reliable?'],
  [9, 'Diana Komba', '0762 555 999', 'I work in Masaki, would love to see it this week.'],
];

const count = db.prepare('SELECT COUNT(*) AS n FROM listings').get().n;
if (count === 0) {
  const insLL = db.prepare('INSERT OR IGNORE INTO landlords (name, phone) VALUES (?,?)');
  DEMO_LANDLORDS.forEach(l => insLL.run(l.name, l.phone));

  const ins = db.prepare(`INSERT INTO listings (name,area,beds,price,lat,lng,tags,hue,landlord_name,landlord_phone,photo_url,master,description,amenities)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insP = db.prepare(`INSERT INTO listing_photos (listing_id,url,caption,position) VALUES (?,?,?,?)`);
  const ids = [];
  const tx = db.transaction(rows => rows.forEach((r, i) => {
    const ll = DEMO_LANDLORDS[r[8]];
    const info = ins.run(r[0],r[1],r[2],r[3],r[4],r[5],JSON.stringify(r[6]),r[7],ll.name,ll.phone,r[9],r[10],
                         seedDescriptions[i] || null, amenityJSON(i));
    ids.push(info.lastInsertRowid);
    galleryFor(i, r[1]).forEach((p, n) => insP.run(info.lastInsertRowid, p.url, p.caption, n));
  }));
  tx(seedListings);

  const insV = db.prepare(`INSERT INTO viewings (listing_id,visitor_name,visitor_phone,message) VALUES (?,?,?,?)`);
  seedViewings.forEach(v => insV.run(ids[v[0]], v[1], v[2], v[3]));

  console.log(`Seeded ${seedListings.length} listings with galleries, ${DEMO_LANDLORDS.length} demo landlords, ${seedViewings.length} viewing requests`);
}

/* Databases created before room pages existed still hold the original 14
   listings but no galleries. Give them their photos and descriptions once. */
if (db.prepare('SELECT COUNT(*) AS n FROM listing_photos').get().n === 0) {
  const insP = db.prepare(`INSERT INTO listing_photos (listing_id,url,caption,position) VALUES (?,?,?,?)`);
  const find = db.prepare('SELECT id, area FROM listings WHERE name=?');
  const setDesc = db.prepare(`UPDATE listings SET description=? WHERE id=? AND (description IS NULL OR description='')`);
  let n = 0;
  const tx = db.transaction(() => seedListings.forEach((r, i) => {
    const row = find.get(r[0]);
    if (!row) return;
    setDesc.run(seedDescriptions[i] || null, row.id);
    galleryFor(i, row.area).forEach((p, pos) => insP.run(row.id, p.url, p.caption, pos));
    n++;
  }));
  tx();
  if (n) console.log(`Backfilled galleries and descriptions for ${n} existing listings`);
}

/* Same again for amenities, which arrived after the galleries. */
if (db.prepare(`SELECT COUNT(*) AS n FROM listings WHERE amenities IS NOT NULL AND amenities != '{}' AND amenities != ''`).get().n === 0) {
  const find = db.prepare('SELECT id FROM listings WHERE name=?');
  const set = db.prepare('UPDATE listings SET amenities=? WHERE id=?');
  let n = 0;
  const tx = db.transaction(() => seedListings.forEach((r, i) => {
    const row = find.get(r[0]);
    if (!row) return;
    set.run(amenityJSON(i), row.id);
    n++;
  }));
  tx();
  if (n) console.log(`Backfilled amenities for ${n} existing listings`);
}

module.exports = db;
module.exports.AMENITIES = AMENITIES;
