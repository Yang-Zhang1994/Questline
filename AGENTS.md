# AGENTS.md — Questline (Mochi's Quest Diary)

Instructions for AI coding agents. Read this file fully; follow linked docs for detail.
When this file and a GitHub Issue disagree, the Issue's acceptance criteria win; flag conflicts in the PR.

**Stack lock (`docs/PRD.md` Decisions, 2026-11-09):** React + Vite + Express + PostgreSQL + TailwindCSS + JWT; vocabulary **Goal → Milestone → Quest**. Keep Mochi AI patterns and confirm-before-save. Do **not** migrate to Next.js, add SQLite for new work, or invent persistence/palette that contradicts this file.

| Detail | Doc |
| ------ | --- |
| Product / user stories | [`docs/PRD.md`](docs/PRD.md) |
| HTTP API (OpenAPI 3) | [`docs/openapi.yaml`](docs/openapi.yaml) |
| Architecture + DB ER diagrams | [`docs/architecture.md`](docs/architecture.md) |
| Schema, naming, Postgres | [`docs/data-model.md`](docs/data-model.md) |
| UI look, components, flows, a11y | [`docs/design/README.md`](docs/design/README.md) |
| TDD, coverage, CI | [`docs/tdd-and-ci.md`](docs/tdd-and-ci.md) |
| Board, branches, commits, PRs | [`docs/scrum-workflow.md`](docs/scrum-workflow.md) |

---

## 1. Project Context

### 1.1 What we're building

Questline turns a vague personal goal into a cozy life-sim with **Mochi**, an AI guide: one question at a time → measurable Goal → Milestones/roadmap → daily Quests with XP, streaks, and stamps. When the user falls behind, Mochi reschedules without guilt.

### 1.2 Tech stack and versions

Pin exact versions in `package.json` and commit the lockfile. Do not upgrade majors without an Issue.

| Layer                | Technology                         | Version (minimum)    |
| -------------------- | ---------------------------------- | -------------------- |
| Runtime              | Node.js (LTS)                      | 22.x                 |
| Language             | TypeScript (strict mode)           | 5.x                  |
| Frontend             | React + Vite                       | React 19.x, Vite 6.x |
| Styling              | TailwindCSS + design tokens        | Tailwind 3.x+        |
| Routing              | React Router                       | 7.x                  |
| Backend              | Express                            | 5.x                  |
| Database             | PostgreSQL (`pg` or equivalent)    | 16.x+                |
| Auth                 | JWT (OAuth optional later)         | —                    |
| Validation           | `zod` (shared client/server)       | 3.x                  |
| AI                   | Claude API via `@anthropic-ai/sdk` | latest stable        |
| Unit/component tests | Vitest + React Testing Library     | Vitest 3.x           |
| API / E2E tests      | Supertest / Playwright             | latest stable        |
| Lint/format          | ESLint (flat config) + Prettier    | ESLint 9.x           |
| CI                   | GitHub Actions                     | —                    |

Claude model name comes from `ANTHROPIC_MODEL`. Never hard-code it.

### 1.3 Architecture overview

```
questline/
├── client/          # React + Vite + Tailwind
├── server/          # Express (routes/, services/, ai/, db/, auth/)
├── shared/schemas/  # zod shared by client and server
├── e2e/             # Playwright
├── docs/            # PRD, data model, design, workflow
├── AGENTS.md
└── README.md
```

**Key patterns:** `routes → services → repositories`; PostgreSQL migrations only (no SQLite/JSON/`localStorage` for domain data); JWT on protected routes; Claude only via `server/src/ai/client.ts`; confirm-before-save for Mochi proposals; shared zod schemas; prefer one `PATCH` toggle over paired complete/uncomplete routes.

### 1.4 Data model

**Summary:** Goal → Milestones → Quests; one active Goal per user; `YYYY-MM-DD` dates; `snake_case` columns; `DATABASE_URL`. Details + naming table → [`docs/data-model.md`](docs/data-model.md).

### 1.5 Naming conventions and coding standards

**Summary:** PascalCase components under `components/Name/`; camelCase hooks/services; UPPER_SNAKE constants; zod `*Schema`; kebab-case `/api` routes; Tailwind utilities + tokens in `client/src/styles/tokens.css`. TypeScript `strict`, no `any`, functional React, zod at route boundary, typed `{ error: { code, message } }` middleware, game numbers in `server/src/config/game.ts`. Full table → [`docs/data-model.md`](docs/data-model.md).

### 1.6 Testing strategy

**Summary:** Vitest / RTL / Supertest+Postgres / Playwright; TDD red→green→refactor; mock Claude; injectable clock; AC→≥1 test (UI AC→RTL); coverage ≥80% services+parse / ≥70% overall. Details → [`docs/tdd-and-ci.md`](docs/tdd-and-ci.md).

---

## 2. PRD & Design References

### 2.1 PRD

Product, user stories, sprint scope → [`docs/PRD.md`](docs/PRD.md). Issues live on the GitHub Project / milestones.

### 2.2 Mockup / prototype (read before any UI)

**Look:** cozy sky-and-meadow diary (window cards, gel pills, Mochi, Today/Map/Talk dock). Screenshots + tokens + rebuild rules → [`docs/design/README.md`](docs/design/README.md). Prototype: https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y

### 2.3 Key UI components and expected behavior

Component table (ChatWindow, GoalConfirmCard, RoadmapView, QuestItem, XpBar, StreakCounter, StampCard, Reschedule/WeekPlan previews, …) → [`docs/design/README.md`](docs/design/README.md). **Mochi voice:** warm, short, never guilt-tripping.

### 2.4 User flows

**A** onboarding → confirm Goal/Milestones → Home. **B** daily check-off → rewards/roadmap. **C** overdue → reschedule/week-plan confirm. Full text → [`docs/design/README.md`](docs/design/README.md).

---

## 3. Scrum & Workflow Instructions

**Summary:** board columns Backlog→…→Done; branch `<type>/<issue>-<kebab>`; commits `<type>(<scope>): … (#N)`; PR + partner review + squash-merge; no direct `main`. Full rules → [`docs/scrum-workflow.md`](docs/scrum-workflow.md).

### 3.1–3.5 Board, branches, commits, PRs, Issue refs

All subsections live in [`docs/scrum-workflow.md`](docs/scrum-workflow.md). Keep Issue numbers in commits/PRs/`// TODO(#N)`.

---

## 4. Do's and Don'ts

### 4.1 Patterns to follow

- Implement all Issue AC (or list leftovers in the PR).
- Before UI: [`docs/design/README.md`](docs/design/README.md) + tokens; before schema: [`docs/data-model.md`](docs/data-model.md).
- Prompts in `server/src/ai/prompts/`; JSON only → zod; retry once; friendly error.
- Drafts until user confirms; loading/empty/error for async UI; JWT middleware on user-owned routes.
- Injectable clock + local date; transactional DB writes; parameterized SQL.

### 4.2 Patterns to avoid

- Browser Claude / leaking `ANTHROPIC_API_KEY` or `JWT_SECRET`.
- SQLite/`better-sqlite3` for new work; JSON/`localStorage` domain persistence; Next.js rewrite.
- Unvalidated AI output; multi-question interview turns; guilt copy; string-concat SQL; business logic in routes/React.
- Invented palettes; magic game numbers; multi-Issue mega-PRs.

### 4.3 Dependencies

**Prefer:** `@anthropic-ai/sdk`, `pg`, `zod`, `react-router`, `tailwindcss`, `jsonwebtoken`/`jose`, `date-fns`, `helmet`, `express-rate-limit`, `cors`, `dotenv`, Vitest, RTL, Supertest, Playwright.  
**Avoid unless Issue-approved:** `better-sqlite3`, MUI/Ant, Prisma/TypeORM, Redux, `moment.js`, `axios`, Next.js App Router rewrite.

### 4.4 Security

Secrets in `.env` only (`.env.example`: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_*`). Size-limit + zod bodies; rate-limit AI/auth; `helmet` + CORS; hash passwords; short-lived JWTs; no `dangerouslySetInnerHTML`; never log chat/tokens/keys; security scan in CI.

### 4.5 Accessibility

WCAG 2.1 AA summary + checklist → [`docs/design/README.md`](docs/design/README.md) (Accessibility section).

---

## 5. Definition of Done

AC met (or split out); CI green (RTL when UI AC exist) per [`docs/tdd-and-ci.md`](docs/tdd-and-ci.md); lint/types clean; UI matches design tokens + Tailwind + a11y; reviewed + squash-merged with `Closes #N`; README/`docs/` updated when setup, env, schema, or deploy changes.

### Migration / P2 watch-outs

- Existing SQLite is legacy until migrated; new work targets PostgreSQL only.
- Check-off ↔ XP/streak/stamps in one transaction; undo reverses rewards.
- Reschedule + week plan: preview → confirm only.
- Multi-goal selector: still one **active** Goal for Today/Map.
- Prefer Playwright for flows B/C once Map + Talk exist; keep Claude mocked.
