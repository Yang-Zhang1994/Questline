# Questline — Mochi's Quest Diary

Cozy life-sim goal tracker: chat with **Mochi**, confirm a measurable goal, walk a game-style roadmap, and complete small daily quests.

## Docs

- Product: [`docs/PRD.md`](docs/PRD.md)
- Agent instructions: [`AGENTS.md`](AGENTS.md)
- Design / prototype: [`docs/design/`](docs/design/)
- Data model: [`docs/data-model.md`](docs/data-model.md)

## Stack

React + Vite (client), Express (API), **PostgreSQL** (`DATABASE_URL`), **JWT** auth, TailwindCSS, shared zod schemas. Claude chat is server-side only (`ANTHROPIC_*`).

## Setup

Requires **Node.js 22+** and a local **PostgreSQL 16+** database.

```bash
# 1. Create a DB + role (example)
sudo -u postgres psql -c "CREATE USER questline WITH PASSWORD 'questline';"
sudo -u postgres psql -c "CREATE DATABASE questline OWNER questline;"
sudo -u postgres psql -c "CREATE DATABASE questline_test OWNER questline;"

# 2. Configure env
cp .env.example .env
# edit DATABASE_URL / JWT_SECRET if needed

# 3. Install & check
npm install
npm run lint
npm run typecheck
npm test          # uses DATABASE_URL (defaults to questline_test in Vitest setup)

# 4. Run API + client (migrations + demo seed run on API boot)
npm run dev:server   # http://localhost:3001
npm run dev:client   # Vite default port
```

Migrations live in `server/src/db/migrations/` and apply automatically when the server (or tests) open the pool. Demo seed creates `demo@questline.local` / `demo-password-123` with an active Goal → Milestone → today's Quests when the `users` table is empty.

## Auth (JWT — Issue #31)

**Choice:** API returns a JWT in the JSON body; the SPA and curl clients send it as `Authorization: Bearer <token>` (not an httpOnly cookie). The client keeps the token in memory and mirrors it to `sessionStorage` for tab reloads.

**UI demo:** open the Vite client → log in with `demo@questline.local` / `demo-password-123` → Today shows a temporary placeholder (Issues #8 / #9 greeting note + quest check-off were reverted for reimplementation) → dock **💌 Talk** for Mochi Messenger.

```bash
# Register
curl -s http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}'

# Login (demo user after seed)
curl -s http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@questline.local","password":"demo-password-123"}'

# Chat history + send (Issues #2 / #3 — goal interview; needs ANTHROPIC_* for real Claude)
curl -s http://localhost:3001/api/chat/messages \
  -H "Authorization: Bearer <token-from-login>"
curl -s http://localhost:3001/api/chat/messages \
  -H "Authorization: Bearer <token-from-login>" \
  -H 'Content-Type: application/json' \
  -d '{"content":"I want to learn Japanese"}'
# Restart the interview from the beginning
curl -s -X POST http://localhost:3001/api/chat/interview/restart \
  -H "Authorization: Bearer <token-from-login>"
```

Talk runs a **one-question-at-a-time goal interview** (#3): done definition → starting point → time budget → deadline, with follow-ups for vague answers and a **Start over** control. Goal confirm/save is Issue #4.

Missing/invalid tokens receive `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }`. Chat queries are scoped to the authenticated user id. Vitest always mocks Claude — never calls the live API.

## Mockup

https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y
