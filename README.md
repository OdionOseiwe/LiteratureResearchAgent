# PRAXIS — Multi-Agent AI Research & Report Generator

A production-minded research workspace: enter any topic and a coordinated team of AI agents
searches the live web, reads the sources, verifies every claim, analyzes the evidence, and compiles
a cited, professionally typeset PDF report.

**Stack:** React + Vite + Tailwind (frontend) · Node.js + Express, ES modules (backend) · LangGraph.js
orchestration · OpenAI-compatible LLM layer (defaults to free Gemini) · Tavily Search · MongoDB/Mongoose ·
Puppeteer (PDF) · SSE for live progress.

## Repository layout

```
ResearchAgent/
├── Dockerfile             # all-in-one image (frontend build → Node + system Chromium)
├── render.yaml            # Render Blueprint: Docker web service + env scaffolding
├── backend/
│   ├── src/
│   │   ├── agents/        # researchManager, webDiscoveryAgent, deepResearchAgent, factCheckerAgent, analysisAgent
│   │   ├── graph/         # LangGraph StateGraph + shared state (planner → discover → read → verify → analyze → review → synthesize → finalize)
│   │   ├── tools/         # tavilySearch, webpageFetcher (SSRF-guarded, Jina Reader + direct fetch), PDF text extraction
│   │   ├── services/      # llmService (OpenAI-compatible), jobService (SSE bus + job updates), pdfService, reportTemplate
│   │   ├── models/        # Research (embedded sources/findings/agent executions)
│   │   ├── controllers/ routes/ middleware/ config/ utils/
│   │   ├── app.js server.js
│   ├── tests/             # node:test unit tests (26 tests)
│   ├── scripts/           # smoke.js, pdfSmoke.js, e2eMock.js (dev verification utilities)
│   └── .env.example
├── frontend/              # React SPA: Home, Workspace, Live Progress (SSE), Results (reader + PDF), History
└── frontend/              # React SPA: Home, Workspace, Live Progress (SSE), Results (reader + PDF), History
```

PDF reports are written to `backend/storage/` (git-ignored).

## Prerequisites

- Node.js ≥ 18 (tested on v20.11.1) and npm
- A MongoDB connection string (free tier at https://www.mongodb.com/atlas — see below)
- An LLM key (free Gemini works — see below)
- A Tavily Search key (free tier at https://tavily.com)

## Getting the keys (all free tiers)

1. **Gemini (LLM)** — go to https://aistudio.google.com/apikey → *Create API key*.
   In `backend/.env` set:
   ```
   OPENAI_API_KEY=<your Gemini key>
   OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   OPENAI_MODEL=gemini-2.5-flash        # or any free-tier model listed in AI Studio
   OPENAI_MODEL_HEAVY=gemini-2.5-flash  # used for synthesis/analysis; may be a stronger model
   ```
   To switch to OpenAI later, just change these three vars (set `OPENAI_BASE_URL=https://api.openai.com/v1/`).
2. **Tavily (search)** — sign up at https://tavily.com → dashboard → API key → `TAVILY_API_KEY=tvly-...`
3. **MongoDB Atlas** — https://www.mongodb.com/atlas → free M0 cluster → *Database Access* create a user →
   *Network Access* allow your IP → *Connect → Drivers* copy the URI, e.g.
   `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/praxis?retryWrites=true&w=majority`

## Install and run

```bash
# Backend
cd backend
cp .env.example .env       # then edit .env with your keys
npm install                # downloads Puppeteer's Chrome (~170MB, first time only)
npm run dev                # http://localhost:5001

# Frontend (second terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173 (proxies /api → :5001)
```

Open **http://localhost:5173**, paste a research question, choose a depth, and watch the agents work.
The finished report appears on the results page with a **Download PDF** button; past runs live under **History**.

## Tests and verification utilities

```bash
cd backend
npm test                                # 26 unit tests (dedupe, SSRF guard, JSON repair, citations/template, sufficiency)
npm install --no-save mongodb-memory-server   # needed only for the smoke/e2e utilities
node scripts/smoke.js                   # boots in-memory Mongo; checks API, SSE, graceful LLM-key-missing failure path
node scripts/pdfSmoke.js                # renders a synthetic report to a real PDF via Puppeteer
node scripts/e2eMock.js                 # full pipeline with mocked LLM+search: report + PDF end-to-end
```

Verified in this workspace: all 26 unit tests pass · API smoke test passes (validation, SSE, graceful failure, history, delete) ·
PDF generation passes (real Puppeteer render) · mocked end-to-end pipeline completes: 5/5 agents `completed`, report stored,
PDF generated. **Not run:** a live pipeline with real Gemini/Tavily keys (none were provided) — first real run may need tuning
of model names/rate limits in `.env`.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/research` | Create + start a job (202) — body: `{ topic, depth, timeframe?, sourcePreferences?, userQuestions?, outputFormat? }` |
| GET | `/api/research/:id` | Job status, agents, counts |
| GET | `/api/research/:id/progress` | **SSE** live progress stream (replay + live; closes on terminal state) |
| GET | `/api/research/:id/report` | Final structured report + meta |
| GET | `/api/research/:id/sources` | Sources with citation numbers, verification status |
| GET | `/api/research/:id/pdf` | Download generated PDF (regenerates if missing; path traversal safe) |
| GET | `/api/research/history?q=&page=&limit=` | Paginated, searchable history |
| DELETE | `/api/research/:id` | Delete job + stored PDF |
| GET | `/api/health` | Config + DB status |

## Configuration (backend/.env)

See `.env.example`. Required: `MONGODB_URI`, `OPENAI_API_KEY` (any OpenAI-compatible provider), `TAVILY_API_KEY`.
Cost/safety knobs: `MAX_SOURCES_PER_RUN` (18), `MAX_PAGE_CHARS` (12000), `MAX_RESEARCH_ROUNDS` (2),
`SEARCH_RESULTS_PER_QUERY` (6). `FRONTEND_URL` controls the CORS allow-list.

## How it works / integrity model

- **LangGraph** coordinates: plan → discover → deep-read → fact-check → analyze → sufficiency review (bounded extra round
  if evidence is thin) → synthesize → finalize (PDF). Progress is persisted on the `Research` document and streamed over SSE.
- **No fabricated research.** The Discovery agent only returns real URLs from Tavily; the Deep Research agent only reads
  fetched pages and its findings are dropped unless they cite a page that was actually provided; the Fact-Checking agent
  grades each claim against real source content with six statuses (Verified/Supported/Partially supported/Conflicting/
  Unverified/Unsupported). Citations `[n]` map 1:1 to stored sources; every reference links its live URL.
- **Untrusted web content** is wrapped in delimiters and explicitly treated as data; all fetches go through an SSRF guard
  (blocks localhost/private/reserved IPs, metadata endpoints, non-http(s) schemes, and DNS names resolving to private ranges).
- The frontend renders LLM markdown escape-first (no raw HTML injection) and restricts links to http(s).
- **Honest limitations:** token usage is tracked per job; free-tier LLM rate limits may slow Deep runs; claims the system
  could not verify are labelled as such in the report instead of being hidden.

## Security notes

API keys live only in `backend/.env` (git-ignored; never sent to the browser). Rate limiting on research creation and reads.
Helmet + strict CORS (frontend origin only). HTML rendered into the PDF and markdown views is escaped first; markdown link protocols are restricted to http(s). The PDF download endpoint never exposes server file paths.

## Deploying to Render (Docker, all-in-one)

The root `Dockerfile` builds the frontend and serves it from the Express API as static files — one service, no separate static host, no CORS friction. MongoDB stays on Atlas.

1. Push this repo to GitHub (or GitLab): `git init && git add -A && git commit -m "initial" && git remote add origin <url> && git push -u origin main`
2. Render Dashboard → **New → Blueprint** → select the repo. Render reads `render.yaml` (Docker web service, health check `/api/health`).
3. When prompted, fill the secret env vars: `MONGODB_URI`, `OPENAI_API_KEY` (your `AIza…` Gemini key), `TAVILY_API_KEY`. Everything else is pre-filled.
4. After deploy, open `https://<your-service>.onrender.com` — the SPA loads, `/api` works same-origin, `/api/health` returns `{ ok: true, db: "up" }`.
5. No URL config needed: the backend automatically uses Render's injected `RENDER_EXTERNAL_URL` for CORS. Set `FRONTEND_URL` manually only if you use a custom domain.
6. Start a real research run and click **Download PDF** — Puppeteer uses the system Chromium installed in the image.

**Cost/durability notes**
- PDFs are regenerated on demand if the file is missing (Render's disk is ephemeral) — downloads keep working across redeploys.
- The `free` plan sleeps after 15 min idle (~30–60s cold start) and has 512MB RAM; Puppeteer + a research run can OOM it. `render.yaml` ships `plan: starter` for reliability; change to `free` if you want $0 and are OK with cold starts/OOM risk.
- SSE keeps the connection alive during research; Render proxies support this (the server emits a heartbeat every 15s).
- Atlas: whitelist `0.0.0.0/0` (or Render's outbound IPs) in Network Access so the hosted app can connect.

## Troubleshooting

- *"MONGODB_URI is required to start"* → create `backend/.env` from `.env.example`.
- *LLM_NOT_CONFIGURED / TAVILY_NOT_CONFIGURED* → keys missing; see "Getting the keys".
- *Research fails immediately* → usually key/quota; check backend console and `/api/health`.
- *PDF 502* → Puppeteer's Chrome failed to launch; reinstall with `npm install` (check first-run Chrome download) or set
  `PUPPETEER_SKIP_DOWNLOAD=false`.
