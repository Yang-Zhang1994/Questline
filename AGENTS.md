# AGENTS.md — Questline (Mochi's Quest Diary)

Instructions for AI coding agents (Antigravity, Claude Code, Cursor, Copilot) working in this repo.
Read this file fully before writing code. When this file and a GitHub Issue disagree, the Issue's
acceptance criteria win for that task; flag the conflict in the PR description.

---

## 1. Project Context

### 1.1 What we're building
Questline turns a vague personal goal ("learn Japanese") into a cozy life-sim game. The user chats with
**Mochi**, a cute AI guide, who asks one question at a time to define a concrete, measurable goal with a
deadline, proposes milestones, draws a game-style roadmap, and greets the user daily with small quests.
Completing quests earns XP, levels, streaks, and stamps. When the user falls behind, Mochi reschedules
instead of letting guilt pile up.

### 1.2 Tech stack and versions
Pin exact versions in `package.json` and commit the lockfile. Do not upgrade major versions without an Issue.

| Layer | Technology | Version (minimum) |
|---|---|---|
| Runtime | Node.js (LTS) | 22.x |
| Language | TypeScript (strict mode) | 5.x |
| Frontend | React + Vite | React 19.x, Vite 6.x |
| Routing | React Router | 7.x |
| Backend | Express | 5.x |
| Database | SQLite via `better-sqlite3` | latest stable 11.x+ |
| Validation | `zod` (shared between client and server) | 3.x |
| AI | Claude API via `@anthropic-ai/sdk` | latest stable |
| Unit/component tests | Vitest + React Testing Library | Vitest 3.x |
| API tests | Supertest | latest stable |
| E2E tests | Playwright | latest stable |
| Lint/format | ESLint (flat config) + Prettier | ESLint 9.x |
| CI | GitHub Actions | — |

The Claude model name is read from the `ANTHROPIC_MODEL` environment variable. Never hard-code it.

### 1.3 Architecture overview

```
questline/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/        # Reusable UI (PascalCase folders/files)
│   │   │   ├── chat/          # ChatWindow, MessageBubble, ChatInput
│   │   │   ├── roadmap/       # RoadmapView, MilestoneNode
│   │   │   ├── quests/        # DailyNote, QuestItem
│   │   │   └── rewards/       # XpBar, LevelUpToast, StreakCounter, StampCard
│   │   ├── pages/             # Route-level screens (OnboardingPage, HomePage, RoadmapPage)
│   │   ├── hooks/             # useChat, useQuests, useProgress, ...
│   │   ├── api/               # Typed fetch wrappers for the Express API
│   │   ├── styles/            # Global CSS, design tokens
│   │   └── main.tsx
│   └── tests/                 # Component tests (or co-located *.test.tsx)
├── server/                    # Express backend
│   ├── src/
│   │   ├── routes/            # HTTP layer only: parse, validate, call service, respond
│   │   ├── services/          # Business logic (goals, milestones, quests, progress, scheduling)
│   │   ├── ai/                # Claude client, Mochi prompts, response parsers
│   │   │   ├── client.ts
│   │   │   ├── prompts/       # One file per prompt (interview, goal, milestones, quests, reschedule, weekPlan)
│   │   │   └── parse.ts       # JSON extraction + zod validation
│   │   ├── db/                # Connection, migrations, repositories
│   │   │   ├── migrations/
│   │   │   └── repositories/
│   │   ├── middleware/        # Error handler, request logging, rate limiting
│   │   └── index.ts
│   └── tests/
├── shared/                    # Types and zod schemas used by both client and server
│   └── schemas/
├── e2e/                       # Playwright tests
├── docs/                      # PRD, data model, design notes
├── .github/workflows/ci.yml
├── AGENTS.md
└── README.md
```

**Key patterns**
- **Layering (server):** `routes → services → repositories`. Routes never touch the DB directly; services never read `req`/`res`.
- **Single AI gateway:** every Claude call goes through `server/src/ai/client.ts`. No other file imports the SDK.
- **Confirm-before-save:** anything Mochi *proposes* (goal, milestones, rescheduled dates, week plan) is returned as a draft. It is written to the DB only after an explicit user confirmation request.
- **Shared schemas:** request/response shapes live in `shared/schemas` as zod schemas; TypeScript types are inferred from them (`z.infer`).
- **Server owns the API key:** the browser never calls Claude directly.

### 1.4 Data model (see Issue #17)

| Table | Key fields |
|---|---|
| `goals` | id, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status, created_at |
| `milestones` | id, goal_id → goals, position, title, description, target_date, status (`upcoming` / `current` / `completed`) |
| `quests` | id, milestone_id → milestones, title, due_date, estimated_minutes, completed_at (nullable) |
| `user_progress` | id, xp, level, current_streak, best_streak, last_active_date |
| `stamps` | id, card_number, stamp_date |
| `chat_messages` | id, goal_id (nullable), role (`user` / `mochi`), content, created_at |
| `diary_notes` | id, goal_id → goals, note_date, content, updated_at (one per goal per day; #19) |

Relationships: a Goal has many Milestones; a Milestone has many Quests. A user can have several Goals; one is the active Goal (`goals.status = 'active'`, #18). Dates are stored as ISO strings
(`YYYY-MM-DD` for calendar dates, full ISO for timestamps). Schema changes require a new migration file.
Never edit an applied migration.

### 1.5 Naming conventions and coding standards

| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase, one per file | `MilestoneNode.tsx` |
| Hooks | camelCase, `use` prefix | `useDailyQuests.ts` |
| Other TS files | camelCase | `scheduleService.ts` |
| Variables/functions | camelCase, verbs for functions | `awardXp()`, `isOverdue` |
| Constants | UPPER_SNAKE_CASE | `XP_PER_QUEST` |
| Types/interfaces | PascalCase, no `I` prefix | `Quest`, `MilestoneDraft` |
| zod schemas | PascalCase + `Schema` | `QuestSchema` |
| DB tables/columns | snake_case, plural tables | `quests.due_date` |
| API routes | kebab-case, plural nouns, `/api` prefix | `GET /api/quests/today` |
| CSS classes | kebab-case (CSS Modules) | `.quest-item--done` |
| Test files | `*.test.ts(x)` next to source or in `tests/` | `awardXp.test.ts` |

**Coding standards**
- TypeScript `strict: true`. No `any`; use `unknown` and narrow.
- Functional React components with hooks only. No class components.
- Keep components under ~200 lines; extract subcomponents or hooks when larger.
- Validate every request body with zod at the route boundary.
- Errors: services throw typed errors; one Express error middleware maps them to HTTP responses `{ error: { code, message } }`.
- Config (XP thresholds, stamps per card, quest limits) lives in one file: `server/src/config/game.ts`.
- No commented-out code in commits. Use `// TODO(#issue): ...` for follow-ups.

### 1.6 Testing strategy

| Level | Tool | What to test |
|---|---|---|
| Unit | Vitest | Services and pure logic: XP/level math, streak rules, stamp rules, scheduling, AI response parsing |
| Component | Vitest + React Testing Library | User-visible behavior: send message, check off quest, roadmap highlight, rest-day note |
| API | Supertest against an in-memory SQLite DB | Each route: success, validation error, not found |
| E2E | Playwright | The three core flows in §2.4 (onboarding, daily quests, reschedule) |

**Patterns**
- Test behavior, not implementation. Query by role/label/text, not by CSS class.
- **Never call the real Claude API in tests.** Mock `server/src/ai/client.ts` with fixture responses in `server/tests/fixtures/ai/`. Include at least one malformed-JSON fixture per parser.
- Date-dependent logic (streaks, overdue, "today") must accept an injectable clock; tests set fixed dates, including timezone edge cases around midnight.
- Each Issue's acceptance criteria should map to at least one test.

**Coverage goals:** ≥ 80% lines for `server/src/services` and `server/src/ai/parse.ts`; ≥ 70% overall.
CI fails on lint errors, type errors, or failing tests.

---

## 2. PRD & Design References

### 2.1 PRD
- PRD: `docs/PRD.md` (Questline — Mochi's Quest Diary). Copy of the PRD from the planning phase.
- Work items: GitHub Issues #1–#17 in this repo, grouped by milestone **Sprint 1** (due Oct 30, 2026) and **Sprint 2** (due Nov 6, 2026).

| User Story | Issues |
|---|---|
| US1 — Vague dream → concrete goal | #2, #3, #4 |
| US2 — Milestones and roadmap | #5, #6, #10 |
| US3 — Daily quests | #7, #8, #9 |
| US4 — XP, levels, streak, stamps | #11, #12, #13 |
| US5 — Reschedule and week planning | #14, #15 |
| Prototype extras | #18, #19, #20, #21 |
| Foundation / docs | #1, #16, #17 |

### 2.2 Mockup / prototype
- **Prototype:** "Questline with Mochi" — Claude Web artifact: https://claude.ai/artifact/EfxDnxdfnW3kGMqZzHoY6y
  (a working single-page HTML prototype). Save screenshots of each view in `docs/design/`.
- The prototype is the **visual and interaction reference**. Rebuild it as React components; do not copy its
  single-file HTML/JS structure, its browser-side storage, or its direct in-browser Claude calls (§1.3, §4.4).

**Overall look — "cozy sky-and-meadow diary"**
- Light sky-blue page with soft clouds and sparkles (✦ ✧); app title "Questline" with the tagline
  "your little quest diary with Mochi ♡".
- Content sits in rounded **retro "window" cards**: each has a title bar with a ✦ icon and title
  (e.g., "✉ A note from Mochi", "Mochi Messenger").
- Buttons are glossy **"gel" pills** in pink (primary), blue, white (secondary), and green (stage cleared);
  `danger` variant for delete. Small "mini" ✕ buttons for close/remove.
- **Fonts:** display = "Mochiy Pop One"; body = "M PLUS Rounded 1c"; small UI text = Tahoma/Verdana/system-ui.
  Load from Google Fonts with rounded system fallbacks.
- **Color tokens** (reuse these names as CSS variables in `client/src/styles/tokens.css`):
  `--page #E8F4FF`, `--sky-top #38ACF0`, `--pink #FF6FB1`, `--pink-ink #D23A82`, `--pink-pale #FFF0F7`,
  `--blue-ink #1C7FC8`, `--blue-pale #F0F9FF`, `--purple-pale #F7F2FF`, `--ink #3D3570` (main text),
  `--ink-soft #776CA8`, `--panel #FFFFFF`, map colors `--meadow #CBF0B6`, `--road #FFF8E6`,
  `--walked #FFD0E6`, `--tree #8CD96A`.
- **Mochi:** a round white mochi with a two-leaf sprout, pink cheeks, drawn as inline SVG, with moods
  `happy`, `wink`, `think` (loading), and `cheer` (celebrations). It gently bobs on the map.
- Small **toasts** confirm actions ("New quest started! ⭐", "Level up! You're Lv 3 🎉", "Map updated 🗺️").
- Motion (bob, sparkle bursts, map scroll) is disabled under `prefers-reduced-motion`.

**Navigation:** a bottom dock with three tabs — **☀️ Today**, **🗺️ Map**, **💌 Talk**.

**View 1 — Today**
- HUD: current-goal selector, **★ Lv N** badge with an XP progress bar, and **"Days in a row"** streak.
- **"A note from Mochi"** card: time-based greeting ("Good morning!" / "Good evening!"), how many quests are
  due today, the current stage name, and a gentle line for leftover quests ("…left over from before, no stress").
- **Today's quests** list with an `x/y done` counter; each item has a check button (with "Mark not done"
  undo), the stage name, and an overdue tag ("from Oct 27"). Done items stay in the list, styled as done.
- A **"Too much?" reshuffle** button asks Mochi to reschedule (#14); "♡ Plan my next days" when the stage
  has no quests (#15).
- Empty states: nothing due today → head-start offer; all done → "Rest up"; no goal yet → "♡ Plan a quest with Mochi".
- **Stamp card** (#13): each active day earns one stamp; today's slot is outlined. **Follow Issue #13, not
  the prototype's 28-day grid:** the card has a fixed number of slots (`STAMPS_PER_CARD` in `config/game.ts`);
  a full card shows a reward message from Mochi and starts a new card. Past cards are kept.
- **"Diary note for today"** text area (#19).

**View 2 — Map**
- Illustrated SVG meadow: a winding road from a **Start house** through one node per milestone to the
  **goal**; the walked part of the road is pink.
- Node states with a legend: **Cleared**, **You are here** (Mochi stands on it), **Ahead**. Each node shows
  the stage title, target date, and `♡ done/total` quests.
- Header shows the goal sentence, "by <deadline>", and "N/M stages cleared". The map auto-scrolls to the
  current stage.
- Tapping a node opens a **bottom sheet**: stage title, description, target date, its quests (with delete),
  a "New task" + "Due date" form, "♡ Ask Mochi to plan", and **"★ Stage cleared!"** / "Reopen stage" (#10).

**View 3 — Talk ("Mochi Messenger")**
- Chat log with Mochi bubbles labelled "Mochi ♡" plus avatar, and user bubbles; Mochi's reply streams in
  as it is generated.
- First message: "Hi, I'm Mochi! ✨ I turn big dreams into little daily quests…" with the example
  "learn Japanese" → "Read a Japanese novel on my own within one year".
- Composer: "Message to Mochi" field (Enter to send, Shift+Enter for a new line; respects IME composition)
  and a **"Send ♡"** button.
- When Mochi and the user agree on milestones, **"🗺️ Draw my map"** produces a **plan preview** (goal,
  deadline, milestones with dates) with **"★ Start this quest"** to confirm (#4, #5). "Start over" resets.
- Once a goal exists, the chat switches to that goal: "Welcome back! We're on '<goal>'…", with
  **"🗺️ Update my map"**, "Clear chat", and "＋ New quest".
- Manual fallback form: quest name, concrete goal, deadline, milestones one per line.
- Friendly AI error messages, e.g., "Mochi needs a short break. Try again in a minute." and
  "The plan came out smudged. Tap the button to try again."

**Terminology rule — use the PRD terms everywhere (code, API, DB, and UI copy).**
The prototype uses "quest" for the whole goal and "task" for daily items. Do **not** copy that.
- **Goal** = the whole thing the user is working toward (e.g., "Read a Japanese novel on my own within one year").
- **Milestone** (UI may say "stage") = one step on the roadmap.
- **Quest** = a small daily task.
Rename prototype copy when rebuilding it, for example: "＋ New quest" → "＋ New goal", "★ Start this quest" →
"★ Start this goal", "Current quest" → "Current goal", "Delete quest" → "Delete goal", "New task" → "New quest",
"No tasks here yet." → "No quests here yet." 

**Prototype features tracked by Sprint 2 Issues** (build only when their Issue is in progress):
multiple goals with a goal selector (#18), the daily diary note (#19), manual quest add/delete (#20), and the
manual plan form (#21).

When implementing UI, match the prototype first. If it doesn't cover a state (empty, loading, error),
follow the tone in §2.3 and note the gap in the PR.

### 2.3 Key UI components and expected behavior

| Component | Expected behavior | Issue |
|---|---|---|
| `ChatWindow` / `MessageBubble` / `ChatInput` | Send with button or Enter; user and Mochi bubbles visually distinct; Mochi bubbles show name + avatar; auto-scroll to newest; typing/loading indicator while Mochi replies | #2 |
| Goal interview | Mochi asks **exactly one question per message**, covering: done definition, starting point, time available, deadline; follows up on vague answers; restart option | #3 |
| `GoalConfirmCard` | Shows the proposed specific, measurable goal with deadline; Accept / Ask to revise; saves only on Accept | #4 |
| `MilestonePlanEditor` | Shows 3–7 ordered milestones (title, description, target date); user can add, remove, rename, reorder via Mochi; saves only on confirm | #5 |
| `RoadmapView` / `MilestoneNode` | Path from Start → milestones → final goal; current stage highlighted; completed vs upcoming styled differently; each node shows title + target date; responsive | #6, #10 |
| `DailyNote` / `QuestItem` | On app open, Mochi greets with only today's quests; short list; friendly rest-day message if none; check off and undo; done items look checked and faded | #8, #9 |
| `XpBar` / `LevelUpToast` | XP added on completion, removed on undo; level + progress bar visible; short celebration on level-up | #11 |
| `StreakCounter` | Current and best streak; +1 per day with ≥1 completed quest; resets after a full missed day; uses the user's local date | #12 |
| `StampCard` | One stamp per active day; fixed number of slots; stamped vs empty slots; full card → reward message from Mochi and a new card; past cards kept | #13 |
| `ReschedulePreview` | Overdue quests flagged; Mochi proposes new dates within time budget and milestone dates; preview → confirm; encouraging wording | #14 |
| `WeekPlanPreview` | Next 7 days grouped by day; no duplicates of existing quests; accept or request changes | #15 |

**Mochi's voice (all AI-generated text):** warm, encouraging, short. Never guilt-tripping
(avoid "you failed", "you're behind", "you missed"). Prefer "Let's adjust the plan together."

### 2.4 User flows to follow when implementing features

**Flow A — Onboarding (first visit)**
1. User opens app → no goal exists → `OnboardingPage` with `ChatWindow`.
2. Mochi greets and asks the first interview question.
3. One question at a time until all four topics are answered (follow-ups for vague answers).
4. Mochi proposes a measurable goal → `GoalConfirmCard` → user accepts or revises → goal saved.
5. Mochi proposes milestones → `MilestonePlanEditor` → user confirms → milestones saved; first milestone becomes `current`.
6. App generates quests for the current milestone → navigate to `HomePage`.

**Flow B — Daily visit**
1. User opens app → goal exists → `HomePage` shows `DailyNote` with today's quests (or rest-day message).
2. User checks off quests → XP, streak, and stamp update immediately; undo reverses them.
3. If all quests in the current milestone are done → prompt to complete the stage → roadmap advances (#10). Final milestone → goal-complete celebration.

**Flow C — Falling behind**
1. Overdue quests are flagged on `HomePage`.
2. User asks Mochi to reschedule → `ReschedulePreview` → confirm → dates updated.
3. Or user asks to plan next week → `WeekPlanPreview` → accept → quests saved.

---

## 3. Scrum & Workflow Instructions

### 3.1 Board
GitHub Project **Questline Sprint Board** columns: `Backlog → Sprint Todo → In Progress → In Review → Done`.
- Move an Issue to **In Progress** when you create its branch.
- It moves to **In Review** when the PR is opened, and **Done** when the PR is merged and the Issue closes.
- Only work on Issues in the current sprint's milestone unless told otherwise.

### 3.2 Branch naming
```
<type>/<issue-number>-<short-kebab-description>
```
Types: `feature`, `fix`, `chore`, `docs`, `test`, `refactor`.
Examples: `feature/2-chat-interface`, `feature/12-daily-streak`, `chore/17-data-model`, `docs/16-readme`.
Always branch from the latest `main`. One Issue per branch.

### 3.3 Commit message format
Conventional Commits, with the Issue number at the end of the subject:
```
<type>(<scope>): <imperative summary, max 72 chars> (#<issue>)

<optional body: what and why, not how>
```
Scopes: `client`, `server`, `ai`, `db`, `shared`, `ci`, `docs`.
Examples:
```
feat(client): add MessageBubble with Mochi avatar (#2)
feat(server): award and revoke XP on quest toggle (#11)
fix(server): reset streak using user's local date (#12)
test(ai): add malformed JSON fixture for milestone parser (#5)
chore(db): add migration for quests table (#17)
```
Small, focused commits. Never commit secrets, `.env`, or `*.sqlite` files.

### 3.4 PR workflow
1. Open the PR against `main` with a title in commit format: `feat(client): build chat interface (#2)`.
2. PR description must include:
   - `Closes #<issue>` (auto-closes the Issue on merge)
   - Summary of changes
   - The Issue's acceptance criteria checklist, ticked for what is done
   - Screenshots or a short GIF for any UI change
   - How it was tested
3. CI (lint, type-check, tests) must pass.
4. **At least 1 approving review from the teammate** before merge. `main` is protected: no direct pushes.
5. Squash-merge, then delete the branch.

### 3.5 Referencing Issues in code and commits
- Commits: `(#12)` at the end of the subject line.
- PRs: `Closes #12` / `Fixes #12` for the Issue being completed; `Refs #14` for related ones.
- Code: `// TODO(#14): handle quests overdue by more than 7 days` — never a bare `TODO`.
- Tests: name the `describe` block after the feature and reference the Issue in a comment when the test encodes an acceptance criterion.
- Dependencies between Issues: write `Depends on #N` in the Issue or PR body.

---

## 4. Do's and Don'ts

### 4.1 Patterns to follow ✅
- Read the Issue's acceptance criteria before coding; implement all of them or state which are left in the PR.
- Keep Claude prompts in `server/src/ai/prompts/`, one per task, with the Mochi persona defined once and reused.
- Ask Claude for **JSON only**; strip code fences, `JSON.parse` inside try/catch, then validate with zod. On failure, retry once, then return a friendly error.
- Send the full relevant conversation history (and current goal/milestone state) with each AI request — the model has no memory between calls.
- Return AI proposals as drafts; save only on user confirmation.
- Show loading, empty, and error states for every async UI.
- Compute dates with an injectable clock and the user's local date (client sends its timezone or local date).
- Wrap related DB writes (e.g., quest toggle + XP + streak + stamp) in a single transaction.
- Use prepared statements for every SQL query.

### 4.2 Patterns to avoid ❌
- Calling the Claude API from the browser or exposing `ANTHROPIC_API_KEY` to the client.
- Saving AI output directly to the DB without validation and user confirmation.
- Mochi asking more than one question in a single message during the interview.
- Guilt-inducing copy anywhere in the UI or prompts.
- String-concatenated SQL.
- Business logic inside React components or Express route handlers.
- Hard-coded magic numbers for XP, levels, stamps, or quest limits (use `config/game.ts`).
- Using `Date` arithmetic on server time for streaks or "today".
- Adding a new dependency without mentioning it and why in the PR.
- Large PRs that cover multiple Issues.

### 4.3 Dependencies and libraries
**Prefer:** `@anthropic-ai/sdk`, `better-sqlite3`, `zod`, `react-router`, `date-fns` (date math), `helmet`,
`express-rate-limit`, `cors`, `dotenv`, CSS Modules for styling, Vitest, React Testing Library, Supertest, Playwright.

**Avoid unless an Issue approves it:** heavy UI kits (MUI, Ant Design), ORMs (Prisma, TypeORM — use repositories
over `better-sqlite3`), global state libraries (Redux — use React state/context and hooks first), `moment.js`,
`axios` (use `fetch`), and any library that's unmaintained or duplicates an existing one.

### 4.4 Security requirements 🔒
- Secrets only in `.env` (git-ignored); provide `.env.example` with placeholder values (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `PORT`, `DATABASE_PATH`).
- Validate and size-limit every request body (`express.json({ limit: '100kb' })` + zod).
- Rate-limit AI endpoints to control cost and abuse.
- Use `helmet` and a restrictive CORS origin (the Vite dev server and production client only).
- Treat user chat text as untrusted: it is data in the prompt, never instructions that change system behavior; never render AI or user text as raw HTML (no `dangerouslySetInnerHTML`).
- Don't log full chat contents or API keys; log request IDs and error codes.
- Run `npm audit` in CI; fix high/critical findings before merge.

### 4.5 Accessibility requirements ♿
- Target **WCAG 2.1 AA**.
- All interactive elements reachable and usable by keyboard, with a visible focus style.
- Chat message list uses `aria-live="polite"` so screen readers announce Mochi's replies.
- Quest checkboxes are real `<input type="checkbox">` (or have `role="checkbox"` + `aria-checked`) with labels.
- Roadmap conveys state with text or icons, not color alone (e.g., "Current stage", ✓ for completed).
- Color contrast ≥ 4.5:1 for text; ≥ 3:1 for UI components.
- Respect `prefers-reduced-motion` for level-up, stamp, and celebration animations.
- Images and the Mochi avatar have meaningful `alt` text (decorative ones use `alt=""`).
- Layout works at 320px width and at 200% zoom.

---

## 5. Definition of Done
An Issue is Done when:
- [ ] All acceptance criteria are met (or remaining ones are split into a new Issue)
- [ ] Tests cover the acceptance criteria and pass in CI
- [ ] Lint and type-check pass
- [ ] UI changes match the mockup and meet §4.5
- [ ] PR reviewed and approved by the teammate, squash-merged with `Closes #N`
- [ ] README or `docs/` updated if setup, env vars, or the data model changed
