# AGENTS.md — Questline (Mochi's Quest Diary)

Instructions for AI coding agents working in this repo. Read fully before writing code.
When this file and a GitHub Issue disagree, the Issue's acceptance criteria win; flag conflicts in the PR.

**Source of truth with `docs/PRD.md` Decisions (2026-10-29):** Vite + Express + SQLite; vocabulary Goal → Milestone → Quest. Refined after Issue #9 rules A/B. Do not invent persistence, palette, folder layout, or Next/Supabase stacks that contradict this file.

---

## 1. Project Context

### 1.1 What we're building

Questline turns a vague personal goal ("learn Japanese") into a cozy life-sim game. The user chats with
**Mochi**, an AI guide who asks one question at a time to define a measurable goal with a deadline,
proposes milestones, draws a game-style roadmap, and greets the user daily with small quests.
Completing quests earns XP, levels, streaks, and stamps. When the user falls behind, Mochi reschedules
instead of letting guilt pile up.

### 1.2 Tech stack and versions

Pin exact versions in `package.json` and commit the lockfile. Do not upgrade majors without an Issue.

| Layer                | Technology                         | Version (minimum)    |
| -------------------- | ---------------------------------- | -------------------- |
| Runtime              | Node.js (LTS)                      | 22.x                 |
| Language             | TypeScript (strict mode)           | 5.x                  |
| Frontend             | React + Vite                       | React 19.x, Vite 6.x |
| Routing              | React Router                       | 7.x                  |
| Backend              | Express                            | 5.x                  |
| Database             | SQLite via `better-sqlite3`        | 11.x+ (13.x OK on Node 22) |
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
├── client/          # React + Vite (components/, pages/, hooks/, api/, styles/)
├── server/          # Express (routes/, services/, ai/, db/, middleware/)
├── shared/schemas/  # zod schemas shared by client and server
├── e2e/             # Playwright
├── docs/            # PRD, data model, design notes
├── AGENTS.md
└── README.md
```

**Key patterns**

- **Layering:** `routes → services → repositories`. Routes never touch the DB; services never read `req`/`res`.
- **Persistence:** SQLite + SQL migrations under `server/src/db/migrations/` only. **Never** JSON files, `localStorage`, or ad-hoc file stores for goals/milestones/quests/progress.
- **Single AI gateway:** every Claude call goes through `server/src/ai/client.ts` only.
- **Confirm-before-save:** Mochi proposals (goal, milestones, reschedule, week plan) are drafts until the user confirms.
- **Shared schemas:** request/response shapes in `shared/schemas` as zod; types via `z.infer`. Hand-written duplicate interfaces are not a substitute.
- **Server owns the API key:** the browser never calls Claude.
- **Toggles:** prefer one `PATCH` with a boolean body (e.g. quest completion) over paired `/complete` + `/uncomplete` routes.

### 1.4 Data model

See Issue #17 and `docs/data-model.md` when present. Goal → Milestones → Quests; one active goal; calendar dates `YYYY-MM-DD`; timestamps ISO; DB columns `snake_case` (`completed_at`, not a separate boolean + camelCase twin). New migration per schema change — never edit an applied migration.

### 1.5 Naming conventions and coding standards

| Thing               | Convention                                                          | Example                                |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| React components    | PascalCase; folder `components/Name/Name.tsx` + `Name.module.css`   | `QuestItem/QuestItem.tsx`              |
| Pages               | Under `client/src/pages/`                                           | `TodayPage.tsx`                        |
| Hooks               | camelCase, `use` prefix                                             | `useDailyQuests.ts`                    |
| Other TS files      | camelCase                                                           | `scheduleService.ts`                   |
| Variables/functions | camelCase; verbs for functions                                      | `awardXp()`                            |
| Constants           | UPPER_SNAKE_CASE                                                    | `XP_PER_QUEST`                         |
| Types / zod         | PascalCase; schemas end in `Schema`                                 | `Quest`, `QuestSchema`                 |
| DB / API / CSS      | snake_case tables; kebab-case `/api` routes; CSS Modules kebab-case | `quests.due_date`, `/api/quests/today` |
| Tests               | `*.test.ts(x)` next to source                                       | `QuestItem.test.tsx`                   |

**Coding standards:** TypeScript `strict`; no `any` (use `unknown`); functional React only; components under ~200 lines; validate bodies with zod at the route boundary; typed service errors → one Express error middleware `{ error: { code, message } }` (never a bare `{ error: string }`); game config in `server/src/config/game.ts`; no commented-out code; `// TODO(#issue): ...` for follow-ups.

### 1.6 Testing strategy

| Level     | Tool                         | What to test                                    |
| --------- | ---------------------------- | ----------------------------------------------- |
| Unit      | Vitest                       | XP/level, streaks, stamps, scheduling, AI parse |
| Component | Vitest + RTL                 | Send message, check quest, roadmap, rest-day    |
| API       | Supertest + in-memory SQLite | Success, validation, not found                  |
| E2E       | Playwright                   | Onboarding, daily quests, reschedule (§2.4)     |

Test behavior (role/label/text/`data-*` state), not CSS class names. **Never call the real Claude API** — mock `server/src/ai/client.ts` with fixtures (include malformed JSON). Date logic uses an injectable clock (`server/src/clock.ts`). Map each Issue AC to ≥1 test. **If the Issue has interactive UI AC, include ≥1 RTL test** — API/store tests alone are not enough. Coverage: ≥80% `server/src/services` + `server/src/ai/parse.ts`; ≥70% overall. CI fails on lint, type errors, or failing tests.

---

## 2. PRD & Design References

### 2.1 PRD

- PRD: `docs/PRD.md`. Issues #1–#21 under **Sprint 1** (due **2026-11-03**) and **Sprint 2** (due **2026-11-10**).

| User Story                         | Issues             |
| ---------------------------------- | ------------------ |
| US1 — Vague dream → concrete goal  | #2, #3, #4         |
| US2 — Milestones and roadmap       | #5, #6, #10        |
| US3 — Daily quests                 | #7, #8, #9         |
| US4 — XP, levels, streak, stamps   | #11, #12, #13      |
| US5 — Reschedule and week planning | #14, #15           |
| Prototype extras                   | #18, #19, #20, #21 |
| Foundation / docs                  | #1, #16, #17       |

### 2.2 Mockup / prototype (read before any UI)

**Look:** cozy sky-and-meadow diary — light sky page, soft clouds/sparkles, rounded window cards (e.g. “✉ A note from Mochi”), glossy gel pills, Mochi avatar, bottom dock Today / Map / Talk. Tokens and walkthrough: `docs/design/README.md`; screenshots `today.png`, `map.png`, `talk.png`.

1. Open the matching screenshot in `docs/design/` (`today.png` / `map.png` / `talk.png`) and `docs/design/README.md` when present.
2. Copy color/font tokens into `client/src/styles/tokens.css` — do **not** invent an alternate “cozy” palette (green/cream paper, purple gradients, etc.).
3. Rebuild as React + CSS Modules; do not copy the prototype’s single-file HTML, browser storage, or in-browser Claude calls.
4. Use PRD terms (**Goal / Milestone / Quest**), not prototype “quest”/“task” wording for goals.

Prototype: https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y

### 2.3 Key UI components and expected behavior

| Component                               | Expected behavior                                                                        | Issue    |
| --------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| `ChatWindow` / bubbles / input          | Enter or button send; distinct bubbles; Mochi name+avatar; auto-scroll; typing indicator | #2       |
| Goal interview                          | Exactly one question per message; four topics; follow-ups; restart                       | #3       |
| `GoalConfirmCard`                       | Proposed goal + deadline; Accept / revise; save only on Accept                           | #4       |
| `MilestonePlanEditor`                   | 3–7 milestones; edit via Mochi; save only on confirm                                     | #5       |
| `RoadmapView` / `MilestoneNode`         | Start → stages → goal; current highlighted; title + date                                 | #6, #10  |
| `DailyNote` / `QuestItem`               | Window card “A note from Mochi”; today’s quests or rest-day; check/undo; done faded      | #8, #9   |
| `XpBar` / `LevelUpToast`                | XP on complete/undo; level bar; short celebration                                        | #11      |
| `StreakCounter`                         | Current/best; +1 per active day; reset after miss; local date                            | #12      |
| `StampCard`                             | One stamp/active day; fixed slots; full card → reward + new card                         | #13      |
| `ReschedulePreview` / `WeekPlanPreview` | Preview → confirm; encouraging copy; no duplicates                                       | #14, #15 |

**Mochi's voice:** warm, short, never guilt-tripping. Prefer "Let's adjust the plan together."

### 2.4 User flows

**A — Onboarding:** no goal → chat interview (one Q at a time) → confirm goal → confirm milestones → generate quests → Home.  
**B — Daily visit:** today's quests → check off (XP/streak/stamp) → stage complete advances roadmap (#10).  
**C — Falling behind:** overdue flagged → reschedule preview (#14) or week plan (#15) → confirm.

---

## 3. Scrum & Workflow Instructions

### 3.1 Board

GitHub Project **[Questline Sprint Board](https://github.com/users/Yang-Zhang1994/projects/1)** columns: `Backlog → Sprint Todo → In Progress → In Review → Done`.
Move to **In Progress** on branch create, **In Review** on PR open, **Done** on merge. Work current-sprint Issues only unless told otherwise.

### 3.2 Branch naming

```
<type>/<issue-number>-<short-kebab-description>
```

Types: `feature`, `fix`, `chore`, `docs`, `test`, `refactor`. Branch from latest `main`. One Issue per branch.

### 3.3 Commit message format

```
<type>(<scope>): <imperative summary, max 72 chars> (#<issue>)
```

Scopes: `client`, `server`, `ai`, `db`, `shared`, `ci`, `docs`. Never commit secrets, `.env`, or `*.sqlite`.

### 3.4 PR workflow

1. PR against `main`; title in commit format.
2. Body: `Closes #<issue>`, summary, AC checklist, UI screenshots/GIF, how tested.
3. CI (lint, type-check, tests) must pass.
4. ≥1 teammate approving review; squash-merge; delete branch. No direct pushes to `main`.

### 3.5 Referencing Issues

Commits end with `(#N)`. PRs: `Closes #N` / `Refs #N`. Code: `// TODO(#N): ...` only. Tests may cite the Issue in a comment when encoding an AC. Note `Depends on #N` when needed.

---

## 4. Do's and Don'ts

### 4.1 Patterns to follow

- Implement all Issue AC (or list leftovers in the PR).
- Before UI: screenshot + `tokens.css` (§2.2); before schema: `docs/data-model.md`.
- Prompts in `server/src/ai/prompts/` (one file per task); ask for JSON only; parse → zod; retry once; then friendly error.
- Send full relevant history + goal/milestone state with each AI call.
- Drafts until user confirms; loading/empty/error for every async UI.
- Injectable clock + user's local date; related DB writes in one transaction; prepared statements only.

### 4.2 Patterns to avoid

- Claude from the browser / exposing `ANTHROPIC_API_KEY`.
- JSON/`localStorage` persistence for domain data; inventing palettes instead of design tokens.
- Saving unvalidated AI output; multi-question interview turns; guilt copy.
- String-concatenated SQL; business logic in React or route handlers.
- Magic game numbers (use `config/game.ts`); server-time `Date` for streaks/"today".
- Flat `client/src/Foo.tsx` without CSS Modules when building UI from mockups.
- New deps without PR mention; multi-Issue mega-PRs.

### 4.3 Dependencies

**Prefer:** `@anthropic-ai/sdk`, `better-sqlite3`, `zod`, `react-router`, `date-fns`, `helmet`, `express-rate-limit`, `cors`, `dotenv`, CSS Modules, Vitest, RTL, Supertest, Playwright.  
**Avoid unless an Issue approves:** MUI/Ant Design, Prisma/TypeORM, Redux, `moment.js`, `axios`, unmaintained duplicates.

### 4.4 Security

Secrets in `.env` only (`.env.example` with placeholders). Size-limit + zod every body. Rate-limit AI routes. `helmet` + restrictive CORS. Treat chat as untrusted data in prompts; never `dangerouslySetInnerHTML`. Don't log chat bodies or API keys. `npm audit` in CI; fix high/critical before merge.

### 4.5 Accessibility

WCAG 2.1 AA. Keyboard-reachable controls with visible focus. Chat `aria-live="polite"`. Real checkboxes (or `role="checkbox"` + `aria-checked`) with labels. Roadmap state via text/icons, not color alone. Contrast ≥4.5:1 text / ≥3:1 UI. Honor `prefers-reduced-motion`. Meaningful `alt` (decorative `alt=""`). Usable at 320px and 200% zoom.

---

## 5. Definition of Done

AC met (or split out); tests pass in CI (including RTL when UI AC exist); lint + types clean; UI matches mockup tokens + §4.5; reviewed, squash-merged with `Closes #N`; README/`docs/` updated when setup, env, or data model changes.

### Sprint 2 watch-outs (additions from #9 A/B)

- Wire check-off to XP / streak / stamps (#11–#13) in one transaction; undo must reverse rewards.
- Reschedule + week plan (#14–#15): preview → confirm only; never auto-write.
- Multi-goal selector (#18): still one **active** goal for Today/Map.
- Prefer Playwright for flows B/C once Map + Talk exist; keep Claude mocked.
