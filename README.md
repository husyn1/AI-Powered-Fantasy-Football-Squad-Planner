# FPL Season Brain

A full-stack MVP that pulls your FPL season history, stores each gameweek as a persistent **Backboard memory**, runs lightweight **scikit-learn** analysis (KMeans clustering + NearestNeighbors), and visualises results in a **Next.js** dashboard.

```
FPL-Backboard/
├── backend/
│   ├── main.py          ← FastAPI app (3 endpoints)
│   ├── fpl.py           ← FPL public API fetch + normalise
│   ├── backboard.py     ← Backboard memory CRUD
│   ├── analysis.py      ← KMeans + NearestNeighbors + stats
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx     ← Single-page app (input + dashboard)
│   ├── components/
│   │   ├── PointsChart.tsx   ← Line chart (cluster-coloured dots, chip annotations)
│   │   ├── HitsChart.tsx     ← Bar chart (transfer hit cost)
│   │   └── BrainPanel.tsx    ← Cluster label, similar GWs, insight text
│   ├── lib/
│   │   ├── api.ts
│   │   └── types.ts
│   └── .env.local.example
└── README.md
```

---

## Quick Start

### 1 — Backend

```bash
cd backend
cp .env.example .env
# edit .env and add your BACKBOARD_API_KEY

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

Swagger UI → http://localhost:8000/docs

### 2 — Frontend

```bash
cd frontend
cp .env.local.example .env.local
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  (already set)

npm install
npm run dev
```

App → http://localhost:3000

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/history/{entry_id}` | Raw FPL rows (no Backboard) |
| POST | `/api/sync/{entry_id}` | Fetch FPL → upsert to Backboard |
| GET | `/api/analyze/{entry_id}` | Read Backboard → KMeans + NearestNeighbors |

### `GET /api/analyze/{entry_id}` response shape

```json
{
  "rows": [ { "gw": 1, "points": 72, "transfers": 1, "hit": 0, ... } ],
  "clusters": { "1": 0, "2": 2, "3": 1 },
  "cluster_labels": { "0": "Conservative", "1": "Volatile", "2": "Aggressive" },
  "similar_weeks": [ { "gw": 14, "distance": 0.04 }, ... ],
  "summary": {
    "avg_points": 63.2,
    "total_hits": 12,
    "hit_weeks_count": 3,
    "best_gw": 7,
    "worst_gw": 22
  }
}
```

---

## Environment Variables

**backend/.env**
```
BACKBOARD_API_KEY=your_backboard_api_key_here
```

**frontend/.env.local**
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

---

## Backboard Integration Notes

- One **Backboard assistant** is created per FPL entry_id (stored in `backend/assistant_map.json`).
- Each GW is stored as a memory with:
  - `content`: `"GW 5: 72 pts, transfers 1, hit 0, chip none"`
  - `metadata`: full row JSON + `entry_id` + `tags` array
- Sync is **idempotent**: existing GWs are skipped, only new ones are written.

## FPL API Field Notes

| FPL field | Our field | Notes |
|-----------|-----------|-------|
| `event` | `gw` | Gameweek number |
| `event_transfers` | `transfers` | NOT `transfers` |
| `event_transfers_cost` | `hit` | Point deduction |
| `value` | `team_value` | Scaled ×10 (1000 = £100.0) |
| `bank` | `bank` | Scaled ×10 |
| `data["chips"][].event` | chip lookup key | Map GW → chip name |
