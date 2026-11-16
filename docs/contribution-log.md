# Contribution Log — Questline (P2)

> **STATUS: Yang Zhang confirmed (`2026-11-15`). Pending confirmation by Yanni Zhao (`Yifeicarrots`).**  
> Compiled from `git` commit history, PR merge commits, and Issue references in `Yang-Zhang1994/Questline` through `2026-11-15`.

**Repo:** https://github.com/Yang-Zhang1994/Questline (Deploy fork: https://github.com/Yifeicarrots/Questline1)  
**Partners:** Yang Zhang (`Yang-Zhang1994`) · Yanni Zhao (`Yifeicarrots`)

---

## Summary by Partner & Area

| Partner | Primary Areas | Key Issues / PRs |
| --- | --- | --- |
| **Yang Zhang** (`Yang-Zhang1994`) | Project setup & stack lock, PostgreSQL migration, JWT auth, Tailwind tokens, Talk/Goal interview & confirmation, XP/Streak/Stage-advance/Multi-goal, Manual plan fallback, OpenAPI & diagrams, Render static serving, Scrum/process docs | `#1`, `#2`, `#3`, `#4`, `#10`, `#11`, `#12`, `#16`, `#17`, `#18`, `#21`, `#31`, `#32`, `#74`; PRs `#22`–`#27`, `#30`, `#33`–`#38`, `#42`, `#43`, `#47`, `#48`, `#51`–`#53`, `#56`, `#57`, `#61`, `#63`, `#65`, `#75` |
| **Yanni Zhao** (`Yifeicarrots`) | Map/Roadmap UI, Milestone planning, Daily quest generation, Today view & quest check-off/undo, Stamp card, Daily diary, Week plan & Reschedule overdue, Manual quest CRUD, Production hardening, UI/AI bug fixes, PR merges/reviews | `#5`, `#6`, `#7`, `#8`, `#9`, `#13`, `#14`, `#15`, `#19`, `#20`, `#80`, `#81`; PRs `#62`, `#64`, `#66`–`#73`, `#76`–`#79`, `#82`, plus `fix/chat-optimistic-message` |

---

## Breakdown by Issue & Area

### 1. Project Setup, Architecture, Docs & Process

| Issue / PR | Area | Contributor | Summary |
| --- | --- | --- | --- |
| `#1` | Tooling | Yang Zhang | Scaffold ESLint 9 + Prettier monorepo |
| `#16` (PRs `#22`–`#26`, `#52`) | Docs / Product | Yang Zhang | PRD, `AGENTS.md`, mockup screenshots, Scrum/TDD/data-model docs, README setup & usage |
| PR `#27` | Architecture | Yang Zhang | Lock P2 stack (PostgreSQL, TailwindCSS, JWT) and trim `AGENTS.md` |
| PR `#56` | Docs / API | Yang Zhang | Add `docs/openapi.yaml`, `docs/architecture.md`, and `docs/diagrams/*.svg` |
| `#54`, `#55`, `#59`, `#60` (PRs `#57`, `#63`, `#65`) | Process | Yang Zhang | Sprint standup/retro issues; contribution log now lives in `docs/contribution-log.md` (`docs/partner-contribution-log.md` is a pointer) |
| PR `#61` | Process / Git | Yang Zhang | Surgical revert of `#8`/`#9` so Yanni could re-own Today quest UI |

### 2. Core Infrastructure, Auth, Styling & Deployment

| Issue / PR | Area | Contributor | Summary |
| --- | --- | --- | --- |
| `#17` (PR `#30`) | Database | Yang Zhang | Migrate persistence from SQLite to PostgreSQL (`pg` pool + migrations) |
| `#32` (PR `#33`) | Styling / UI | Yang Zhang | Adopt TailwindCSS with design tokens (`client/src/styles/tokens.css`) |
| `#31` (PR `#34`) | Auth / Security | Yang Zhang | JWT register/login (`POST /api/auth/*`) and route protection middleware |
| `#74` (PR `#75`) | Deployment | Yang Zhang | Serve Vite SPA from Express on Render (`render.yaml`, `NODE_ENV=production`) |
| PR `#82` (`#80`, `#81`) | Deployment / Security | Yanni Zhao | Production env hardening (`DATABASE_SSL`, `ALLOW_ECHO_AI`, `SEED_DEMO_DATA`, `CORS_ORIGIN`, `JWT_SECRET` ≥32 chars) and document security advisory Issues `#80`, `#81` |

### 3. Talk, Goal Interview & Goal Management

| Issue / PR | Area | Contributor | Summary |
| --- | --- | --- | --- |
| `#2` (PR `#36`) | Talk / Chat | Yang Zhang | Mochi chat shell wired to JWT + Postgres |
| `#3` (PR `#37`, PR `#53`) | Talk / AI | Yang Zhang | One-question goal interview (`goal_interviews`) + fix Time topic loop on compact budget answers |
| `#4` (PR `#38`) | Talk / Goals | Yang Zhang | `GoalConfirmCard` accept / revise / save (`goal_draft` migration `003`) |
| `#21` (PR `#51`) | Talk / Fallback | Yang Zhang | Manual plan form fallback in Talk when AI is unavailable |
| `#18` (PR `#48`) | Goals | Yang Zhang | Multi-goal selector with one active goal (`GET/PATCH/DELETE /api/goals`) |
| `fix/chat-optimistic-message` | Talk / UI | Yanni Zhao | Show user's message immediately in chat while Mochi replies |

### 4. Map, Milestones & Roadmap

| Issue / PR | Area | Contributor | Summary |
| --- | --- | --- | --- |
| `#6` (PR `#62`, PR `#66`) | Map / UI | Yanni Zhao | Render game-style roadmap from start to final goal; separate final goal node and dedupe "You are here" |
| `#5` (PR `#64`, PR `#68`) | Milestones / AI | Yanni Zhao | Mochi milestone plan propose & confirm; handle free-text goal deadlines |
| `#10` (PR `#47`) | Milestones | Yang Zhang | Advance to next milestone/stage when complete |
| `#20` (PR `#77`) | Map / Quests | Yanni Zhao | Add and delete quests manually inside a milestone |

### 5. Today, Quests, Rewards, Diary & Recovery

| Issue / PR | Area | Contributor | Summary |
| --- | --- | --- | --- |
| `#7` (PR `#67`) | Quests / AI | Yanni Zhao | Generate and save daily quests for the current stage |
| `#8` (PR `#69`) | Today / UI | Yanni Zhao | Show Mochi today greeting note and due quests |
| `#9` (PR `#70`) | Today / Quests | Yanni Zhao | Check off and undo daily quests (`PATCH /api/quests/:questId/completion`) |
| `#11` (PR `#42`) | Rewards / XP | Yang Zhang | Award XP on quest complete with `XpBar` and `LevelUpToast` |
| `#12` (PR `#43`) | Rewards / Streak | Yang Zhang | Track daily streak with `StreakCounter` HUD (`active_day_completions` migration `004`) |
| `#13` (PR `#72`) | Rewards / Stamps | Yanni Zhao | Stamp card for completed days (`completed_local_date` migration `005`) |
| `#19` (PR `#71`) | Today / Diary | Yanni Zhao | Daily diary note with autosave on Today (`diary_notes`) |
| `#15` (PR `#73`) | Recovery / AI | Yanni Zhao | Plan the next week of quests with Mochi (preview → confirm) |
| `#14` (PR `#76`, PR `#79`) | Recovery / AI | Yanni Zhao | Reschedule overdue quests with Mochi (preview → confirm) + forward `proposeReschedule` in lazy AI client |
| PR `#78` | UI Polish | Yanni Zhao | Keep bottom dock from covering page content |

---

## Partner Confirmation

- [x] **Yang Zhang (`Yang-Zhang1994`)** — reviewed and confirmed (`2026-11-15`)
- [ ] **Yanni Zhao (`Yifeicarrots`)** — reviewed and confirmed
