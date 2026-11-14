# Questline — Mochi's Quest Diary

Cozy life-sim goal tracker: chat with **Mochi**, confirm a measurable **Goal**, walk a game-style roadmap of **Milestones**, and complete small daily **Quests** with XP, streaks, and stamps.

## The Ambition-Action Gap

Many people start personal projects with big dreams but fall into the **Ambition-Action Gap**: a goal like “learn Japanese” feels exciting but is too vague to act on. Nobody tells them what to do *today*, so they over-plan once and never follow through — or never plan at all. Tracking alone feels lonely; missing days creates guilt; the project dies within weeks.

To-do apps assume you already know the steps. Habit trackers count streaks but don’t design the path. Generic AI chat leaves a plan stuck in a transcript with no daily follow-through.

**Questline** closes that gap with **Mochi**, a warm AI guide:

1. **Shape the goal** — one question at a time → one concrete, measurable Goal with a deadline.
2. **Draw the map** — agree on 3–7 Milestones; the app draws a Start → Goal roadmap.
3. **Play today** — a short daily note plus today’s Quests; completing them earns XP, levels, streaks, and stamps.
4. **Recover kindly** — when you fall behind, Mochi reschedules or plans the next week — no guilt pile-up.

## Screenshots

### Today — daily note + rewards

Mochi’s daily note, today’s Quests, XP bar, streak, and stamp card.

![Today view with XP, streak, stamp card, and daily quests](docs/screenshots/today-rewards.png)

Level-up celebration after checking off Quests:

![Level-up toast after earning XP](docs/screenshots/rewards-levelup.png)

### Map — roadmap

Start → stages → Goal, with cleared / current / ahead milestones.

![Map roadmap with milestones](docs/screenshots/map-roadmap.png)

### Talk — Mochi Messenger

One-question-at-a-time goal interview in chat.

![Talk chat with Mochi Messenger](docs/screenshots/talk-chat.png)

Prototype mockups (design reference): [`docs/design/`](docs/design/) · live artifact: https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Runtime | Node.js 22+ |
| Language | TypeScript (strict) |
| Frontend | React 19 + Vite 6 + React Router 7 |
| Styling | TailwindCSS + design tokens |
| Backend | Express 5 |
| Database | PostgreSQL 16+ (`DATABASE_URL`) |
| Auth | JWT (`Authorization: Bearer`) |
| Validation | zod (shared client/server) |
| AI | Claude via `@anthropic-ai/sdk` (server-only) |
| Tests | Vitest + React Testing Library + Supertest |

## Project structure

```
questline/
├── client/                 # React + Vite + Tailwind SPA
│   └── src/
│       ├── api/            # fetch helpers (Bearer JWT)
│       ├── components/     # UI (Today / Map / Talk pieces)
│       ├── hooks/
│       ├── pages/
│       └── styles/         # tokens.css + Tailwind entry
├── server/                 # Express API
│   └── src/
│       ├── ai/             # Claude client + prompts
│       ├── auth/           # JWT + password hashing
│       ├── db/             # pool, migrations, demo seed
│       ├── routes/         # /api/* handlers
│       ├── services/       # business logic
│       └── repositories/   # SQL access
├── shared/                 # zod schemas + shared types
│   └── src/schemas/
├── docs/                   # PRD, data model, design, screenshots
├── AGENTS.md               # agent / contributor instructions
├── render.yaml             # Render Blueprint (web + Postgres)
├── .env.example
└── package.json            # npm workspaces root
```

Domain vocabulary: **Goal → Milestone (UI: “stage”) → Quest**. Persistence is **PostgreSQL only** (no SQLite/`localStorage` for domain data). Claude never runs in the browser.

## Prerequisites

- **Node.js 22+** (`engines.node` in `package.json`)
- **PostgreSQL 16+** running locally (or reachable via `DATABASE_URL`)
- Optional for live Mochi chat: an Anthropic API key (`ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`)

## Environment variables

Copy `.env.example` → `.env` and adjust as needed:

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | Signs auth tokens (use a long random string outside local demos) |
| `PORT` | no | API port (default `3001`) |
| `ANTHROPIC_API_KEY` | for live chat | Server-side Claude key — never expose to the client |
| `ANTHROPIC_MODEL` | for live chat | Model id from env (never hard-coded) |

Example (matches `.env.example`):

```bash
DATABASE_URL=postgres://questline:questline@localhost:5432/questline
PORT=3001
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
JWT_SECRET=change-me-in-local-dev
```

## Setup and run

```bash
# 1. Create DB + role (example — skip if you already have DATABASE_URL)
sudo -u postgres psql -c "CREATE USER questline WITH PASSWORD 'questline';"
sudo -u postgres psql -c "CREATE DATABASE questline OWNER questline;"
sudo -u postgres psql -c "CREATE DATABASE questline_test OWNER questline;"

# 2. Configure env
cp .env.example .env
# edit DATABASE_URL / JWT_SECRET / ANTHROPIC_* if needed

# 3. Install
npm install

# 4. Run API + client (migrations + demo seed run on API boot)
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173 (proxies /api → :3001)
```

Or both from the root: `npm run dev`.

### Checks

```bash
npm run lint
npm run typecheck
npm test             # uses DATABASE_URL (Vitest targets questline_test in CI)
```

Migrations live in `server/src/db/migrations/` and apply automatically when the server (or tests) open the pool.

### Production build (local smoke)

```bash
npm run build        # Vite → client/dist
NODE_ENV=production DATABASE_URL=... JWT_SECRET=... npm start
# API + SPA on http://localhost:3001 (or $PORT)
```

In production the Express server serves `client/dist` and falls back to `index.html` for non-`/api` routes. The SPA already calls relative `/api/...` URLs (Vite proxies `/api` only in dev), so one origin works.

## Deployment (Render)

Single **Web Service** + **Render Postgres**. Blueprint file: [`render.yaml`](render.yaml).

**Production URL (fill after live):** `_https://YOUR-SERVICE.onrender.com_`

### One-click Blueprint

1. Open [New Blueprint → Yang-Zhang1994/Questline](https://dashboard.render.com/blueprints/new?repo=https://github.com/Yang-Zhang1994/Questline).
2. Sign in to Render (owner account) and connect the GitHub repo if prompted.
3. Apply the Blueprint (`questline` web service + `questline-db` Postgres).
4. When prompted for sync env vars, set:
   - `ANTHROPIC_API_KEY` — your Claude API key (optional until you want live Mochi chat)
   - `ANTHROPIC_MODEL` — model id from Anthropic (e.g. the same value you use locally)
5. Wait for the first deploy. Migrations run automatically on boot via `openDatabase` (no separate migrate step).

Blueprint already sets `NODE_ENV=production`, wires `DATABASE_URL` from `questline-db`, and generates `JWT_SECRET`. Build: `npm ci --include=dev && npm run build`. Start: `npm start` (Node 22).

Frontend and API share the **same URL** (Express serves the Vite build).

### Smoke checklist

After deploy:

- [ ] `GET /api/health` → `{ "ok": true }`
- [ ] Open `/` — SPA loads (login / demo)
- [ ] Log in with demo credentials (seeded when `users` is empty) or register
- [ ] **Today** / **Map** / **Talk** navigate without a separate frontend host
- [ ] With `ANTHROPIC_*` set, send a Talk message; without keys, use the manual plan fallback

## Demo login

On first boot with an empty `users` table, the API seeds:

| Field | Value |
| ----- | ----- |
| Email | `demo@questline.local` |
| Password | `demo-password-123` |

Demo data includes an active Goal (“Read a Japanese novel on my own”), a current Milestone, today’s Quests, a paused second Goal (for the selector), and zeroed XP/streak/stamps so you can earn rewards by checking quests off.

Open http://localhost:5173 → log in with the demo credentials → **Today** loads Mochi’s note + quests.

## High-level usage

Bottom dock: **☀️ Today** · **🗺️ Map** · **💌 Talk**.

| View | What you do |
| ---- | ----------- |
| **Today** | Read Mochi’s daily note, check/undo Quests, watch XP / streak / stamp card update, optional diary note, reschedule or week-plan when behind. |
| **Map** | See the Start → Milestone → Goal roadmap; open a stage sheet to add/delete Quests or ask Mochi to plan. |
| **Talk** | Chat with Mochi (one question at a time). Confirm Goal → milestones → start the goal. Manual plan form is available if AI is unavailable. |

Typical first session:

1. Log in (demo or register).
2. Open **Talk** and answer Mochi’s interview (or use **Write the plan myself**).
3. Confirm Goal + milestones → **★ Start this goal**.
4. Return to **Today** and check off Quests; peek at **Map** for the roadmap.

JWT notes: the API returns a token in the JSON body; the SPA sends `Authorization: Bearer <token>` (mirrored to `sessionStorage` for reloads). Protected routes scope Goal/Quest/chat data to the authenticated user.

## Known limitations

- **Today quest UI (#8 / #9) was reverted** from `main` so Yanni can re-own those issues. Until they land again, Today shows a placeholder; screenshots above still show the intended daily-note / check-off experience.
- **One active Goal** drives Today/Map at a time (multi-goal selector can switch; only one is active).
- Live Mochi chat needs `ANTHROPIC_*`; without keys, use the manual plan form / seeded demo Goal.
- Streak miss = break (no “rest day” forgiveness yet).
- SQLite / Next.js paths are **not** supported for new work — stack is Postgres + Vite.
- No native apps, push/email, calendar sync, payments, or social sharing.
- Playwright E2E suite is planned; CI today covers lint, typecheck, and Vitest (mocked Claude).
- Some Map / XP / stamp / diary flows documented here land in other open PRs; this docs PR may sit above GoalConfirm while those restack.

## Future ideas

- Optional OAuth alongside JWT.
- Rest-day streak forgiveness after classmate trials.
- Richer inline Quest editing (titles/due dates beyond add/delete).
- Custom domain / paid Render plans once the free Blueprint is proven.
- Deeper Map animations and more Mochi moods.
- Optional multi-device sync beyond the current JWT SPA session.

## Docs

| Doc | Contents |
| --- | -------- |
| [`docs/PRD.md`](docs/PRD.md) | Product, user stories, sprint scope |
| [`AGENTS.md`](AGENTS.md) | Agent / contributor instructions |
| [`docs/openapi.yaml`](docs/openapi.yaml) | OpenAPI 3 — auth, goals, milestones, quests, chat, diary, progress/XP |
| [`docs/architecture.md`](docs/architecture.md) | Architecture + DB ER Mermaid diagrams |
| [`docs/data-model.md`](docs/data-model.md) | Schema, naming, Postgres |
| [`docs/design/`](docs/design/) | UI look, components, a11y, mockup screenshots |
| [`docs/tdd-and-ci.md`](docs/tdd-and-ci.md) | Testing & CI |
| [`docs/scrum-workflow.md`](docs/scrum-workflow.md) | Branches, commits, PRs |

### API & diagrams

- **OpenAPI / Swagger:** source of truth is [`docs/openapi.yaml`](docs/openapi.yaml). Paste it into [Swagger Editor](https://editor.swagger.io/) (File → Import file) or [Redocly](https://redocly.github.io/redoc/) to browse interactively. There is no in-app Swagger UI route yet.
- **Architecture + schema:** Mermaid diagrams live in [`docs/architecture.md`](docs/architecture.md) (renders on GitHub). Optional SVG exports under [`docs/diagrams/`](docs/diagrams/) when present.

## License

Course project (P2) — see repository owners for reuse.
