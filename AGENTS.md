# AGENTS.md — Questline

Rules for AI coding agents. Read fully before any task. Priority: this file > your defaults; `package.json` > versions here; PRD > prototype. If something is unclear, ask instead of guessing.

## 0. Golden rules
1. Every task starts from a GitHub Issue: read its user story (US-1…US-5) and acceptance criteria first.
2. AI (LLM) calls run **server-only** in `src/app/api/ai/*`. Never expose keys or call the API from the browser.
3. Business rules live in **pure functions** in `src/lib/domain/` that take `today: IsoDate` (never read the clock) and are unit tested.
4. Every AI JSON response is **Zod-validated and clamped** (§2.4) before it reaches the DB or UI.
5. UI reuses the components in §2.2 and the tokens in `src/styles/tokens.css`. No new visual patterns.
6. Render user/AI text as text. Never use `dangerouslySetInnerHTML`.
7. Before "done": `pnpm lint && pnpm typecheck && pnpm test`, then the self-check in §5.

## 1. Project context
**Questline** is a cozy, game-like project planner. Mochi, an original cute AI guide, chats with the user to turn a vague wish into a concrete goal with a deadline, agrees on 3–7 milestones drawn as a game roadmap (Start → Goal), and greets the user daily with small tasks. Users earn XP, levels and streaks, and can ask Mochi to reschedule or plan more tasks.

### 1.1 Tech stack
Node 22 LTS · pnpm 9 · Next.js 15 (App Router) · React 19 · TypeScript 5 (`strict`, `noUncheckedIndexedAccess`) · CSS Modules + CSS variable tokens · Supabase (Postgres + Auth, `@supabase/ssr`, RLS) · Zod · `@anthropic-ai/sdk` · Vitest + React Testing Library + MSW · Playwright + `@axe-core/playwright` · ESLint 9 (+ `jsx-a11y`) + Prettier 3 · GitHub Actions CI.
Env (server-only unless `NEXT_PUBLIC_`): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_CHAT` (e.g. `claude-haiku-5-5`), `ANTHROPIC_MODEL_PLAN` (e.g. `claude-sonnet-5-5`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Read model IDs only via `lib/ai/config.ts`.

### 1.2 Architecture
```
docs/PRD.md · docs/design/{mockups/, prototype-link.md, tokens.md} · docs/adr/
src/app/(app)/{today,map,talk}/page.tsx   layout.tsx = Header + Dock
src/app/api/ai/{chat,plan,next-tasks,reshuffle,update-map}/route.ts
src/components/ui/      Window, GelButton, HeartOrb, Chip, Field, Sheet, Toast
src/components/mochi/   Mochi (SVG moods), LetterNote, PostageStamp
src/features/{today,map,talk}/   screen components + feature logic
src/lib/domain/         pure: dates, xp, streak, schedule, milestones
src/lib/ai/             client (server-only), persona, prompts/, schemas, errors
src/lib/db/             Supabase clients + repositories (*Repo.ts)
supabase/migrations/ · e2e/ · .github/{ISSUE_TEMPLATE, PULL_REQUEST_TEMPLATE.md, workflows}
```
Patterns: imports flow `app → features → components → lib`, never upward. Server Components by default; `"use client"` only when needed. All DB access goes through repositories (snake_case rows → camelCase types). Route handlers: auth → Zod input → prompt builder → `LlmClient` (injectable interface) → Zod output → clamp → persist. Task toggles are optimistic with rollback + toast.

Data: `quests`(title≤40, goal≤300, deadline, daily_minutes 5–600) → `milestones`(position, title≤60, description≤240, target_date, cleared_at) → `tasks`(title≤140, due_date, done_at). Plus `chat_messages`(quest_id null = draft, content≤3000, keep last 40) and `diary_entries`(quest_id, entry_date, note≤2000). RLS on all tables.

### 1.3 Naming and coding standards
| Concept | Code | UI copy |
|---|---|---|
| Project | `Quest` | "quest" |
| Step | `Milestone` | "stage" |
| Daily action | `Task` | "Today’s quests" list / "task" in stage sheet |
| AI plan preview | `QuestPlan` | "quest scroll" |

- Components `PascalCase.tsx` with `Name.module.css` beside them; other files `camelCase.ts`; routes `kebab-case`; DB `snake_case` plural tables.
- Functions start with a verb (`computeStreak`); booleans `is/has/can`; hooks `useX`; constants `SCREAMING_SNAKE` (`XP_PER_TASK = 10`).
- Calendar days use the branded `IsoDate` (`YYYY-MM-DD`, user's local time). Never store `Date` objects for days.
- No `any`, no `!` outside tests, exhaustive `switch` with `never`. Functions ≤ 40 lines, components ≤ 150.
- API errors: `{ error: { code, message } }`, snake_case codes (`invalid_plan`, `rate_limited`, `unauthorized`).
- UI copy: sentence case, curly quotes/apostrophes, Mochi's friendly voice, buttons say what happens.
- No `console.log` (use `lib/log.ts`), no commented-out code, no bare TODOs.

### 1.4 Testing strategy
- **Unit (Vitest):** all of `lib/domain`, `lib/ai/schemas`, prompt builders (snapshots). Goal ≥ 95% for `lib/domain`.
- **Component (RTL + user-event + MSW):** every §2.2 component, queried by role and accessible name.
- **API:** each route tests happy path, bad input (400), bad AI JSON (422), no session (401), using a fake `LlmClient`.
- **E2E (Playwright):** flows A–C in §2.3 on every PR, with axe checks (0 serious violations).
- Overall ≥ 80% line coverage, enforced in CI. AAA structure; `describe("US-4 computeStreak")`; `vi.setSystemTime` for clocks; never call the real API; bug fixes start with a failing test.

## 2. PRD and design references
- **PRD:** `docs/PRD.md` (problem, users, US-1…US-5 with acceptance criteria, out of scope).
- **Prototype:** link in `docs/design/prototype-link.md`; screenshots (light + dark) in `docs/design/mockups/`.
- US-1 goal-shaping chat · US-2 milestones + roadmap · US-3 daily tasks from Mochi · US-4 XP/levels/streak/stamps · US-5 AI reschedule and plan-more.

### 2.1 Visual design: Y2K / Web 2.0 cute
Sky-blue gradient header with clouds and sparkles; rainbow bubble-letter logo; Mochi on a wooden flower shelf. Panels are **windows**: 12px radius, 1px colored border, 3px white rim, glossy title bar (pink = Mochi/stamps/goal/chat, blue = tasks/map/sheets, purple = diary). **Gel buttons**: glossy pills (pink primary, blue secondary, green success, white neutral), gloss ≤ 42% of height. Candy-striped progress bars, perforated postage stamps, pastel town footer. Fonts: Mochiy Pop One (display), M PLUS Rounded 1c (body), Tahoma/Verdana 11–13px bold (titles, chips). Every color is a token with light and dark (starry purple night) values. Motion only: Mochi bob, current-stage halo, one-time typewriter, check burst; all off under `prefers-reduced-motion`. All characters and art are original.

### 2.2 Key components
| Component | Expected behavior |
|---|---|
| `Header` / `HudStatus` | Logo, quest picker (`<select>` + "＋ New quest"), "★ Lv N", candy XP bar (`role="progressbar"`, "x/100 XP"), 🔥 streak. Not sticky. |
| `Dock` | Fixed gel tabs: Today (pink), Map (blue), Talk (green); active tab colored and raised; `aria-current="page"`. |
| `Window` / `GelButton` | `color: pink\|blue\|purple`, `title`, `tools`. `variant`, `size`, `loading` (disabled + loading label). |
| `LetterNote` | "A note from Mochi" on pink lined paper, Mochi in a tilted stamp; types out once per day per quest. |
| `TaskRow` + `HeartOrb` | Silver orb → pink gel heart on check, pink strike-through, burst, toast "+10 XP ✨" or "Level up!"; `aria-pressed`; chips: milestone, overdue "from <date>". |
| `StampCard` | Last 28 days, 7×4 stamps; active days stamped with heart/star; today outlined. |
| `DiaryBox` | Purple window textarea, autosave 800ms after typing stops. |
| `QuestMap` / `StageNode` | SVG road Start (houses, bottom) → Goal (flag, rainbow, top). Orbs: pink+star cleared, blue+halo+Mochi current, lilac dashed locked. Nodes are `role="button"`, Enter/Space open the sheet; auto-scroll to current. Layout math in `mapLayout.ts`. |
| `StageSheet` / `GoalSheet` | Bottom dialog: tasks (delete), add task + date, "Ask Mochi to plan more", "Stage cleared!" / "Reopen". Goal: details, two-tap delete. Focus trap, Esc closes. |
| `MochiMessenger` / `Composer` | Streaming chat, Mochi bubbles left with avatar, user bubbles right; `aria-live`. Enter sends, Shift+Enter newline, Stop while streaming. |
| `QuestScroll` / `ManualQuestForm` | Plan preview with "★ Start this quest" / "Keep talking". Manual form when AI is unavailable. |

### 2.3 User flows
- **A. New quest (US-1/2):** "＋ New quest" → chat (one question at a time) → "Draw my map" enabled after 2 user messages → `POST /api/ai/plan` → `QuestScroll` → start saves quest + milestones + starter tasks, sets active, goes to Map, toast "New quest started! ⭐".
- **B. Daily check-in (US-3/4):** Today = LetterNote (greeting by time of day and task state) → "Today’s quests" (due ≤ today, overdue first, then done today, "x/y done") → Coming up (next 3) → StampCard → Diary. A stage with no tasks yet shows "Plan my next days" / "Add tasks myself".
- **C. Map (US-2/5):** goal window → map → legend. Stage tap opens StageSheet; clearing sets `clearedAt = today` and moves Mochi on.
- **D. Recover (US-5):** ≥ 2 due tasks shows "Too much today? Reshuffle" → `/api/ai/reshuffle`; "Plan more" → `/api/ai/next-tasks` appends 6–8 tasks.
- **E. Edit plan (US-2/5):** project chat → "Update my map" → `/api/ai/update-map`; cleared milestones never change, kept IDs keep tasks.

### 2.4 AI contracts and domain rules
- Persona (`lib/ai/persona.ts`): warm, never guilt-tripping, 2–4 plain sentences, one question at a time, user's language, points to "Draw my map" / "Update my map".
- Clamp in code: 3–7 milestones (8 for update), ascending dates ≤ deadline; deadline > today (else +180 days); daily minutes 5–600; task dates ≥ today; ≤ 2 tasks/day per AI call; ≤ 14 tasks per call; truncate to column limits; chat input ≤ 3000 chars, last 30 messages sent.
- XP = 10 × done tasks + 50 × cleared milestones; level = ⌊XP/100⌋ + 1. Streak = consecutive days with ≥ 1 done task, ending today or yesterday. Current milestone = first uncleared by position. Checking a stage's last open task auto-clears it (+50 XP, toast with 5 s Undo); unchecking or adding a task reopens it (PRD AC4.6–AC4.8).

## 3. Scrum and workflow
- **Board:** Backlog → Sprint Ready → In Progress → In Review → Done. Issues use the user-story template with Given/When/Then criteria and mockup/component references. No criteria → ask, don't start.
- **Labels:** `type:*`, `area:{today,map,talk,ai,db,ui}`, `story:US-n`, `priority:P0–P2`, `sprint:n`.
- **Branches:** `<type>/<issue#>-<kebab-desc>` from `main`, one issue each: `feature/12-daily-check-in`, `fix/31-streak-off-by-one`.
- **Commits:** Conventional Commits with issue number: `feat(today): show overdue chip on task rows (#12)`. Types `feat fix test refactor style docs chore perf ci`; scopes `today map talk ai db ui domain auth deps`.
- **PRs:** title in commit format; body has `Closes #n`, summary, light + dark screenshots for UI, test notes; ≤ ~400 changed lines; CI green; **1 approval from the teammate**; squash merge, delete branch.
- **Issue refs in code:** `// TODO(#42): …` only; link rule origins (`// PRD US-4, see #31`); tests name the story.
- **Definition of Done:** criteria met; matches mockup at 390px and 1280px in both themes; tests + coverage pass; §4 a11y checks pass; no warnings; reviewed.

## 4. Do's and don'ts
**Do:** logic in `lib/domain` with tests first · reuse §2.2 components and tokens · design empty/loading/error states in Mochi's voice (map codes in `lib/ai/errors.ts`) · stream chat with Stop · debounce autosaves · keep prompts as typed functions in `lib/ai/prompts/`.
**Don't:** use secrets or the AI client in client code · call `new Date()` in domain code · query Supabase outside repositories · trust AI IDs, dates or counts · add Redux/Zustand, Tailwind, CSS-in-JS, UI kits, moment, lodash or axios · store quest data in `localStorage` · use copyrighted characters or logos (Sanrio, Nintendo, etc.) · edit `AGENTS.md`, CI or merged migrations unless the issue says so.
**Dependencies:** prefer `next`, `react`, `@supabase/ssr`, `@anthropic-ai/sdk`, `zod`, `clsx` and the test stack. Any new runtime dependency needs an ADR in `docs/adr/`.
**Security:** phone + SMS code sign-in via Supabase Auth (test phone numbers in dev, tests and e2e; never send real SMS in CI); server-only secrets; RLS + an RLS test per table; every route checks session (401), validates with Zod (400) and AI routes are rate-limited per user (429 `rate_limited`); user text is delimited data in prompts; no PII in logs; CSP in `next.config.ts`; `pnpm audit` in CI.
**Accessibility (WCAG 2.2 AA):** contrast ≥ 4.5:1 (white gel labels keep their text shadow); full keyboard use with visible pink focus ring; touch targets ≥ 44px; `aria-label` on icon buttons; `aria-pressed`, `role="progressbar"`, `aria-current`, `aria-live`, `role="status"` as in §2.2; dialogs trap focus and return it; decorative SVG `aria-hidden`; reduced motion respected.

## 5. Agent workflow and self-check
Before coding: read the issue → find its flow (§2.3) and components (§2.2) → open the mockup → post a short plan (files, functions, tests, questions). Keep diffs scoped to the issue; no drive-by refactors.
Done when all are true:
- [ ] Branch and commits follow §3 with the issue number.
- [ ] Files in the right folders and named per §1.3; no logic in components; domain functions take `today`.
- [ ] AI calls server-only, Zod-validated and clamped.
- [ ] Uses §2.2 components and tokens; checked in light and dark.
- [ ] Tests cover happy path, edge cases and errors; lint, typecheck and tests pass.
- [ ] §4 accessibility checked. Final message lists summary, files changed, tests added, manual verification steps and follow-ups.

## 6. Changelog
| Version | Change | Reason |
|---|---|---|
| 1.0 | Initial rules (Sprint 1). | Baseline before the with/without-rules test. |
| 1.1 | _Fill in after the test._ | _Which difference caused it._ |
