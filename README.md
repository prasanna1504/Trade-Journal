# TradeJournal — AI-Powered Trading Journal & Analytics Platform

> A full-stack web application that helps traders systematically journal their trades, analyse performance patterns, and improve decision-making through a multi-agent AI analysis pipeline powered by Google Gemini(AI Studio).

---

## The Problem

Most retail traders lose money not because they lack strategy — they lose because they repeat the same mistakes. Revenge trades, FOMO entries, oversized positions after a loss. Without a structured journal, these patterns stay invisible.

Existing solutions are either spreadsheets (no intelligence) or expensive SaaS platforms (Tradervue, Edgewonk at $50+/month). TradeJournal bridges this gap with a free, self-hosted, AI-native alternative.

---

## Features

### 📊 Performance Dashboard
- Real-time equity curve built from cumulative closed P&L
- Win rate, profit factor, average R:R, best/worst trade
- P&L breakdown by symbol (bar chart with win/loss colour coding)
- Filterable trade history table with pagination

### 📓 Smart Journaling
- **Voice-to-text journaling** — Record audio notes directly in the browser; audio is sent to Gemini for transcription (no dependency on browser Speech API or Google Cloud credentials)
- Per-trade emotion tagging (disciplined, FOMO, revenge, patient, greedy, fearful, confident)
- Mistake tagging (early exit, oversized position, moved SL, chased entry, etc.)
- 1–5 star trade rating system
- Screenshot attachment support

### 🤖 AI Auto-Journal
- One-click AI journaling of your entire trade history — Gemini reads every closed trade (symbol, direction, P&L, duration, session) and auto-generates journal notes, emotion tags, mistake tags, and ratings for all trades simultaneously

### 🧠 Multi-Agent AI Analysis (6 Parallel Gemini Agents)
Each agent runs independently and in parallel, producing focused insights:

| Agent | Focus |
|---|---|
| 🔍 Pattern Detective | Identifies hidden losing patterns by symbol, direction, time of day |
| 🧠 Emotion Coach | Correlates emotion tags with P&L outcomes; detects revenge trading cycles |
| ⚠️ Mistake Auditor | Quantifies the exact dollar cost of each recurring mistake |
| 📊 Risk Analyst | Analyses position sizing consistency, R:R ratio, drawdown behaviour |
| 🎯 Strategy Analyst | Win rate per strategy; infers setups from journal notes; recommends what to keep/drop |
| 🏆 Head Coach | Synthesises all findings into 3 prioritised, actionable changes |

### 📥 Multi-Source Trade Import
- **MetaAPI Integration** — Connect your MT5 account (login + investor read-only password + broker server) and fetch the complete trade history automatically via the MetaAPI cloud gateway — no Windows machine, no local MT5 installation required
- **MT5 JSON Import** — Paste JSON scraped from your broker's web platform via a one-liner browser console script (for brokers whose platforms don't expose export)
- **CSV Upload** — Drag-and-drop MT5 export CSV with automatic column normalisation
- **BUY/SELL inference** — Automatically determines trade direction from price delta × P&L when the broker omits the type field
- **Deduplication** — Re-importing never creates duplicate trades (stable MD5 ticket hashing)

### 🔐 Authentication
- JWT-based auth (access + refresh tokens)
- Per-user data isolation — all queries are scoped to the authenticated user
- Token auto-refresh on 401 with seamless UX

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│         Vite · React Router · Recharts · Axios          │
└──────────────────────┬──────────────────────────────────┘
                       │ REST (JWT)
┌──────────────────────▼──────────────────────────────────┐
│                  Django REST Framework                    │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ accounts │ │  trades  │ │ journal  │ │ analysis  │  │
│  └──────────┘ └──────────┘ └──────────┘ └─────┬─────┘  │
└────────────────────────────────────────────────┼────────┘
                                                 │ asyncio.gather (parallel)
                       ┌─────────────────────────▼──────────────────────────┐
                       │              Google Gemini 2.5 Flash Lite            │
                       │   Pattern · Emotion · Mistakes · Risk · Strategy ·  │
                       │   Coach · Auto-Journal · Audio Transcription         │
                       └─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                      PostgreSQL                          │
│         Users · Trades · MTAccounts · JournalEntries    │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6 |
| Charts | Recharts |
| HTTP Client | Axios (with JWT interceptor + auto-refresh) |
| Backend | Django 4.2, Django REST Framework |
| Auth | SimpleJWT (access + refresh token flow) |
| Database | PostgreSQL 16 |
| AI | Google Gemini 2.5 Flash Lite |
| AI SDK | google-genai (official Python SDK) |
| Async | Python asyncio + asyncio.gather for parallel agent execution |
| Audio | MediaRecorder API → Gemini multimodal transcription |
| CORS | django-cors-headers |
| Data | pandas (CSV normalisation) |

---

## Engineering Highlights

**Parallel AI agents via asyncio.gather**
All 6 Gemini agents fire simultaneously using `asyncio.gather`, reducing total analysis time from ~30s (sequential) to ~6s (parallel). Each agent receives the same trade dataset but carries a different system-level prompt with a focused analytical lens.

**Gemini audio transcription pipeline**
Rather than relying on the browser's Web Speech API (which routes audio through Google's servers and fails behind enterprise firewalls/VPNs), voice notes are captured with the `MediaRecorder` API, sent as `audio/webm` to Django, and transcribed via Gemini's multimodal `Part.from_bytes` interface. This makes voice journaling work on any network.

**Trade type inference algorithm**
When broker platforms omit the BUY/SELL field (rendering as SVG icons), the system infers direction using the relationship: `type = BUY if (close_price − open_price) × profit ≥ 0 else SELL`. Verified against 100+ real trades.

**Stable deduplication without broker ticket IDs**
Since DOM-scraped trade data lacks unique IDs, a stable MD5 hash of `symbol + open_time + open_price` serves as the idempotent ticket, ensuring re-imports are safe.

**Computed dashboard metrics**
Win rate, profit factor, average win/loss, and equity curve are computed server-side in Django using PostgreSQL aggregation (`Sum`, `Avg`) rather than in the frontend, keeping the client stateless and the API cacheable.

---

## The MT5 Integration Story

Getting live trade data out of MetaTrader 5 into a web application is a genuinely hard problem — and solving it was one of the more interesting engineering decisions in this project.

**The obvious path doesn't work on Mac/Linux.**
The official `MetaTrader5` Python library connects directly to a locally-installed MT5 terminal. The problem: the library is Windows-only. It ships as a compiled Windows DLL, and no amount of Wine or emulation makes it production-reliable. For a web application where the server needs to run on Linux, this is a dead end.

**We evaluated alternatives:**

*mt5-rest-api (GitHub)* — A C++ DLL that turns a local MT5 terminal into a REST server. Impressive engineering, but requires MT5 to be running on a Windows machine at all times and the REST API is only accessible on localhost. Not viable for a cloud-hosted backend.

*Tonpo SDK* — A newer Python library wrapping a cloud MT5 gateway. Well-designed async API, but the SDK is focused on live trading (placing orders, managing positions) rather than fetching historical trade data. Lacked the `get_account_trades` endpoint we needed.

*MetaAPI* — A mature cloud platform that runs MT5 terminals on their own Windows infrastructure. You send credentials once; their servers connect to the broker. Exposes historical trade data via the MetaStats API (`get_account_trades(account_id, start, end)`). Works from any platform, any language.

**Why MetaAPI won:**
- Provides `get_account_trades()` — exactly what a trade journal needs
- MetaStats module returns pre-computed analytics (win rate, drawdown, profit factor) as a bonus
- Investor password (read-only) is sufficient — we never touch trading permissions
- REST + WebSocket API, meaning it's platform-agnostic by design

**The honest trade-off:**
MetaAPI is a paid service beyond its free tier. For this project the integration is fully built and functional — account provisioning, credential linking, historical deal fetching, and the open/close pairing algorithm are all implemented. The infrastructure decision of which MetaAPI plan to subscribe to is a business choice, not an engineering one.

**The future possibility — building our own gateway:**
Now that the architecture is understood, it would be feasible to build a lightweight self-hosted equivalent: a Windows VM running MT5 with a thin Python service using the official `MetaTrader5` library, exposing a private REST API. This eliminates the third-party dependency entirely. The MetaAPI SDK was invaluable for understanding exactly which MT5 data structures matter (deal entries, position pairing, entryType IN/OUT logic) — effectively serving as a reference implementation for what a custom SDK would need to replicate.

---

## Data Models

```
User (AbstractUser)
  └── Trade
        ├── symbol, trade_type, volume
        ├── open_price, close_price, open_time, close_time
        ├── profit, commission, swap
        ├── strategy_tag
        └── JournalEntry (OneToOne)
              ├── notes (text)
              ├── emotion (choice field)
              ├── mistake (choice field)
              ├── rating (1–5)
              └── screenshot (ImageField)
  └── MTAccount (linked broker accounts)
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register/` | Register new user |
| POST | `/api/auth/login/` | Obtain JWT tokens |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/trades/` | List trades (filterable) |
| GET | `/api/trades/stats/` | Dashboard aggregates |
| POST | `/api/trades/import/json/` | Import from broker JSON |
| POST | `/api/trades/import/csv/` | Import from MT5 CSV |
| GET/POST | `/api/journal/` | Journal entries |
| PATCH | `/api/journal/<id>/` | Update journal entry |
| POST | `/api/analysis/run/` | Run all 6 AI agents |
| POST | `/api/analysis/auto-journal/` | AI auto-journal all trades |
| POST | `/api/analysis/transcribe/` | Transcribe voice note |

---

## Local Setup

**Prerequisites:** Python 3.10+, Node 18+, PostgreSQL 16

```bash
# Clone
git clone https://github.com/prasanna1504/Trade-Journal.git
cd Trade-Journal

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create .env (see .env.example)
cp .env.example .env   # fill in DB credentials and GEMINI_API_KEY

python manage.py migrate
python manage.py runserver

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Environment Variables

Create `backend/.env`:

```
SECRET_KEY=your-django-secret-key
DEBUG=True
DB_NAME=trade_journal
DB_USER=your_pg_user
DB_PASSWORD=your_pg_password
DB_HOST=localhost
DB_PORT=5432
GEMINI_API_KEY=your-gemini-api-key
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com)

---

## Importing Trades from Any Broker Platform

If your broker's web platform doesn't offer CSV export, you can extract trades directly from the DOM using a one-liner in the browser console:

```javascript
// Run in browser DevTools console on your broker's history page
window._trades = [];
const rows = document.querySelectorAll('tbody tr');
const data = Array.from(rows).map(row => {
  const cells = row.querySelectorAll('td');
  return {
    symbol: cells[0]?.innerText.trim(),
    open_time: cells[1]?.innerText.trim(),
    open_price: cells[2]?.innerText.trim(),
    close_time: cells[3]?.innerText.trim(),
    close_price: cells[4]?.innerText.trim(),
    volume: cells[6]?.innerText.trim(),
    profit: cells[7]?.innerText.trim().replace('$',''),
  };
});
copy(JSON.stringify(data));
```

Paste the copied JSON into the **Import → Paste JSON** tab.

---

## License

MIT
