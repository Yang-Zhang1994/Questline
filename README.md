# Questline — Mochi's Quest Diary

Cozy life-sim goal tracker: chat with **Mochi**, confirm a measurable goal, walk a game-style roadmap, and complete small daily quests.

## Docs

- Product: [`docs/PRD.md`](docs/PRD.md)
- Agent instructions: [`AGENTS.md`](AGENTS.md)
- Design / prototype: [`docs/design/`](docs/design/)
- Data model: [`docs/data-model.md`](docs/data-model.md)

## Stack

React + Vite (client), Express (API), **PostgreSQL** (`DATABASE_URL`), shared zod schemas. Tailwind + JWT land in separate Issues.

## Setup

Requires **Node.js 22+** and a local **PostgreSQL 16+** database.

```bash
# 1. Create a DB + role (example)
sudo -u postgres psql -c "CREATE USER questline WITH PASSWORD 'questline';"
sudo -u postgres psql -c "CREATE DATABASE questline OWNER questline;"
sudo -u postgres psql -c "CREATE DATABASE questline_test OWNER questline;"

# 2. Configure env
cp .env.example .env
# edit DATABASE_URL if needed

# 3. Install & check
npm install
npm run lint
npm run typecheck
npm test          # uses DATABASE_URL (defaults to questline_test in Vitest setup)

# 4. Run API + client (migrations + demo seed run on API boot)
npm run dev:server   # http://localhost:3001
npm run dev:client   # Vite default port
```

Migrations live in `server/src/db/migrations/` and apply automatically when the server (or tests) open the pool. Demo seed creates `demo@questline.local` with an active Goal → Milestone → today's Quests when the `users` table is empty.

## Mockup

https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y
