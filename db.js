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
`);

// Migration for older databases created before photo_url existed
const cols = db.prepare(`PRAGMA table_info(listings)`).all().map(c => c.name);
if (!cols.includes('photo_url')) db.exec(`ALTER TABLE listings ADD COLUMN photo_url TEXT`);

/* ---------------- Demo landlords ---------------- */
const DEMO_LANDLORDS = [
  { name: 'Mzee Juma Mkwawa',    phone: '0754 111 222' },
  { name: 'Mama Neema Kessy',    phone: '0713 222 333' },
  { name: 'Baraka Homes Agency', phone: '0765 333 444' },
  { name: 'Bi. Zainabu Said',    phone: '0784 444 555' },
];

/* Free-to-use Unsplash photos of rooms and houses */
const IMG = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=60`;

const seedListings = [
  // name, area, beds, price, lat, lng, tags, hue, landlordIndex, photo
  ['Sinza Palestina Single Room','Sinza',1,68000,-6.7789,39.2262,['Self-contained','Water tank','Luku meter'],24,0,IMG('photo-1536376072261-38c75010e6c9')],
  ['Mikocheni B Garden Flat','Mikocheni',2,78000,-6.7616,39.2436,['Tiled floors','Parking','Fenced'],16,2,IMG('photo-1512917774080-9991f1c4c750')],
  ['Ubungo Riverside Room','Ubungo',1,62000,-6.7893,39.2075,['Near daladala stand','Shared fence'],30,0,IMG('photo-1505693416388-ac5ce068fe85')],
  ['Kijitonyama Twin Rooms','Kijitonyama',2,74000,-6.7686,39.2381,['Self-contained','Kitchen inside','Ceiling fans'],20,1,IMG('photo-1522708323590-d24dbb6b0267')],
  ['Mwenge Makumbusho Single','Mwenge',1,70000,-6.7647,39.2249,['Near Mwenge stand','Water 24/7'],34,1,IMG('photo-1540518614846-7eded433c457')],
  ['Tabata Segerea Family House','Tabata',2,72000,-6.8320,39.2242,['Big compound','Bore-hole water'],14,3,IMG('photo-1568605114967-8130f3a36994')],
  ['Upanga Seaview Single','Upanga',1,73000,-6.8046,39.2846,['Near Muhimbili','Tiled','Secure gate'],26,2,IMG('photo-1502672260266-1c1ef2d93688')],
  ['Msasani Bonde la Mpunga 2BR','Msasani',2,80000,-6.7565,39.2669,['Modern finish','Parking','Standby water'],18,2,IMG('photo-1600585154340-be6161a56a0c')],
  ['Kinondoni Mkwajuni Room','Kinondoni',1,69000,-6.7854,39.2564,['Close to road','Shared veranda'],28,3,IMG('photo-1560448204-e02f11c3d0e2')],
  ['Mbezi Beach Makonde 2BR','Mbezi Beach',2,76000,-6.7211,39.2249,['Sea breeze','Fenced','Parking'],22,2,IMG('photo-1600596542815-ffad4c1539a9')],
  ['Ilala Bungoni Single Room','Ilala',1,64000,-6.8262,39.2624,['Near Kariakoo','Luku meter'],32,0,IMG('photo-1554995207-c18c203602cb')],
  ['Kigamboni Ferry-side 2BR','Kigamboni',2,71000,-6.8323,39.3060,['Quiet street','Big rooms'],12,3,IMG('photo-1570129477492-45c003edd2be')],
  ['Manzese Argentina Single','Manzese',1,60000,-6.7973,39.2320,['Budget friendly','Near daladala'],36,1,IMG('photo-1484154218962-a197022b5858')],
  ['Kijitonyama Sayansi Studio','Kijitonyama',1,66000,-6.7735,39.2320,['Self-contained','Near COSTECH'],25,1,IMG('photo-1493809842364-78817add7ffb')],
];

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

  const ins = db.prepare(`INSERT INTO listings (name,area,beds,price,lat,lng,tags,hue,landlord_name,landlord_phone,photo_url)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const ids = [];
  const tx = db.transaction(rows => rows.forEach(r => {
    const ll = DEMO_LANDLORDS[r[8]];
    const info = ins.run(r[0],r[1],r[2],r[3],r[4],r[5],JSON.stringify(r[6]),r[7],ll.name,ll.phone,r[9]);
    ids.push(info.lastInsertRowid);
  }));
  tx(seedListings);

  const insV = db.prepare(`INSERT INTO viewings (listing_id,visitor_name,visitor_phone,message) VALUES (?,?,?,?)`);
  seedViewings.forEach(v => insV.run(ids[v[0]], v[1], v[2], v[3]));

  console.log(`Seeded ${seedListings.length} listings, ${DEMO_LANDLORDS.length} demo landlords, ${seedViewings.length} viewing requests`);
}

module.exports = db;
