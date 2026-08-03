# Utu — rooms near your campus or workplace

A full working rental website for 1- and 2-bedroom houses in Dar es Salaam, with:

- **Location search** — filter rooms by neighbourhood (Sinza, Mikocheni, Tabata…)
- **Student-friendly rents** — every listing is between 60,000 and 80,000 TZS per month
- **Master bedroom filter** — rooms whose main bedroom has its own bathroom carry a "Master bedroom" badge, and one tap narrows the list to just those
- **A page per room** — click any card for a photo gallery (the room, the building, the street outside), a written description, the full details, and the distance and commute time to every campus and workplace on the list
- **Admin panel** at `/admin` — every viewing request from every landlord in one table, with statuses (pending / contacted / closed), a chat inbox, and a **Rooms tab for posting listings straight onto the public site**
- **Live chat** — visitors chat with the office from a widget on the rooms page; the admin replies from the panel and both sides poll every few seconds
- **Call buttons** — tap to dial the landlord, the visitor or the office. Enabled only when the site is served locally, so the public demo never rings anyone's phone
- **Recommendation engine** — pick your university (UDSM, Ardhi, MUHAS, DIT, IFM…) or workplace (Kariakoo, Posta, Mlimani City…) and rooms are ranked nearest first, with distance in km and a daladala commute estimate
- **Real database (SQLite)** — listings and viewing requests are saved permanently
- **Landlord tools** — post a house from the "List your house" form; check who wants to view it under "Landlord requests" using your phone number
- **Tenant viewing requests** — name + phone + message, delivered straight to the landlord's requests page
- **Real photos** - every listing shows an actual room/house photo (free Unsplash images), with an automatic illustrated fallback if a photo fails to load
- **Demo landlord accounts** - pre-loaded landlords with houses and pending viewing requests, so the landlord dashboard works out of the box

## Demo landlord accounts

Open **Landlord requests** in the top menu and tap any demo account, or type a phone number:

| Landlord | Phone | Houses |
|---|---|---|
| Mzee Juma Mkwawa | 0754 111 222 | 3 |
| Mama Neema Kessy | 0713 222 333 | 4 |
| Baraka Homes Agency | 0765 333 444 | 4 |
| Bi. Zainabu Said | 0784 444 555 | 3 |

Each demo account already has pending viewing requests waiting. When you post a house yourself, your phone number automatically becomes a landlord account too.

## Run it on your computer

You need Node.js (v18 or newer) from https://nodejs.org

```bash
cd nyumbani
npm install
node server.js
```

Then open **http://localhost:3000** in your browser. That's it — the database file (`nyumbani.db`) is created and seeded automatically the first time.

## Admin panel

Open **http://localhost:3000/admin**. The development key is `utu-admin`.

**Set your own key before putting this online.** Anyone with the key can read every
visitor's name and phone number:

```bash
ADMIN_KEY=something-only-you-know node server.js
```

On Render, add `ADMIN_KEY` under **Environment**. The panel shows a warning banner
while the default key is still in use.

## Calling

Call buttons dial through the device's own phone app (a `tel:` link). The server only
enables them when the site is being served from `localhost` or a private network
address, so on the public demo the buttons appear greyed out with an explanation. The
check lives in `callsEnabled()` in `server.js`.

## Put it on the internet (free)

The easiest options — no credit card needed:

**Render (recommended):**
1. Push this folder to a GitHub repository
2. Go to https://render.com → New → Web Service → connect the repo
3. Build command: `npm install` · Start command: `node server.js`
4. Deploy — you get a public URL like `https://utu.onrender.com`

**Railway:** https://railway.app → New Project → Deploy from GitHub. It auto-detects Node.

Note: on free hosting tiers the SQLite file may reset when the server restarts. For a permanent public site, add a persistent disk (Render offers one) or switch the database to a free hosted Postgres — happy next step if you need it.

## API (for developers)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/listings?beds=1&maxPrice=70000&master=1&q=sinza&lat=..&lng=..&sort=near` | Search + distance ranking |
| GET | `/api/listings/:id` | One room: details, gallery, distance to every anchor |
| POST | `/api/listings` | Publish a listing (1 or 2 bedrooms only) |
| POST | `/api/viewings` | Send a viewing request |
| GET | `/api/viewings?phone=0754...` | Landlord: see requests for your listings |
| GET | `/api/anchors` | Universities and workplaces |
| GET | `/api/areas` | Known neighbourhoods (for accurate distances) |
| GET | `/api/config` | Whether calling is enabled for this request |
| POST | `/api/chat/start` | Visitor opens a chat, returns a session id |
| GET/POST | `/api/chat/:sid` | Read the thread / send a message |

Admin routes need the key, sent as an `x-admin-key` header:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/admin/login` | Check a key |
| GET | `/api/admin/summary` | Counts for the dashboard tiles |
| GET | `/api/admin/viewings` | Every viewing request, all landlords |
| PATCH | `/api/admin/viewings/:id` | Set status to pending / contacted / closed |
| POST | `/api/admin/listings` | Post a room onto the public site |
| DELETE | `/api/admin/listings/:id` | Remove a room (refused if it has viewing requests) |
| GET | `/api/admin/chats` | Chat threads with their latest message |
| GET/POST | `/api/admin/chats/:sid` | Read a thread / reply to it |

## Files

- `server.js` — Express web server + REST API
- `db.js` — SQLite schema + seed data (14 sample listings)
- `public/index.html` — the tenant-facing site (orange & white design)
- `public/room.html` — a single room's page: gallery, details, commute distances
- `public/admin.html` — the admin panel: viewing requests, chat inbox, post a room
