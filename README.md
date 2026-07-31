# Utu — rooms near your campus or workplace

A full working rental website for 1- and 2-bedroom houses in Dar es Salaam, with:

- **Location search** — filter rooms by neighbourhood (Sinza, Mikocheni, Tabata…)
- **Student-friendly rents** — every listing is between 60,000 and 80,000 TZS per month
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
| GET | `/api/listings?beds=1&maxPrice=70000&q=sinza&lat=..&lng=..&sort=near` | Search + distance ranking |
| POST | `/api/listings` | Publish a listing (1 or 2 bedrooms only) |
| POST | `/api/viewings` | Send a viewing request |
| GET | `/api/viewings?phone=0754...` | Landlord: see requests for your listings |
| GET | `/api/anchors` | Universities and workplaces |
| GET | `/api/areas` | Known neighbourhoods (for accurate distances) |

## Files

- `server.js` — Express web server + REST API
- `db.js` — SQLite schema + seed data (14 sample listings)
- `public/index.html` — the whole frontend (orange & white design)
