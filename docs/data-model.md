# Data model

Companion to `AGENTS.md` §1.4–1.5. Vocabulary: **Goal → Milestone → Quest**. Persistence: **PostgreSQL** via `DATABASE_URL` (SQLite/`better-sqlite3` is legacy — no new work).

## Conventions

- Calendar dates `YYYY-MM-DD`; timestamps ISO; columns `snake_case` (`completed_at`, not a separate boolean + camelCase twin).
- New migration per schema change under `server/src/db/migrations/` — never edit an applied migration.
- Parameterized queries only; related writes in one transaction.
- Users own rows; JWT-authenticated routes must scope by authenticated user id (never trust client-supplied user id alone).
- Shared request/response shapes live in `shared/schemas` (zod); types via `z.infer`.

## Naming (code)

| Thing               | Convention                                                      | Example                   |
| ------------------- | --------------------------------------------------------------- | ------------------------- |
| React components    | PascalCase; `components/Name/Name.tsx`                          | `QuestItem/QuestItem.tsx` |
| Pages / hooks       | `client/src/pages/`; hooks `use*`                               | `useDailyQuests.ts`       |
| TS files / funcs    | camelCase; verbs for functions                                  | `awardXp()`               |
| Constants           | UPPER_SNAKE_CASE                                                | `XP_PER_QUEST`            |
| Types / zod         | PascalCase; schemas end in `Schema`                             | `QuestSchema`             |
| DB / API / style    | snake_case tables; kebab-case `/api`; Tailwind utilities        | `/api/quests/today`       |
| Tests               | `*.test.ts(x)` next to source                                   | `QuestItem.test.tsx`      |

## Tables (baseline — evolve via migrations)

| Table           | Key fields                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| `users`         | id, email (unique), password_hash, created_at (JWT auth; OAuth optional later)                                |
| `goals`         | id, user_id → users, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status, created_at, reschedule_draft (JSONB, #14 confirm-before-save), week_plan_draft (JSONB, #15 confirm-before-save) |
| `milestones`    | id, goal_id → goals, position, title, description, target_date, status (`upcoming` / `current` / `completed`), quest_draft (JSONB, #7 confirm-before-save) |
| `quests`        | id, milestone_id → milestones, title, due_date, estimated_minutes, completed_at (nullable)                    |
| `user_progress` | id, user_id → users, xp, level, current_streak, best_streak, last_active_date, active_day_completions (#12)   |
| `stamps`        | id, user_id → users, card_number, stamp_date                                                                  |
| `chat_messages` | id, user_id → users, goal_id (nullable), role (`user` / `mochi`), content, created_at                         |
| `goal_interviews` | id, user_id → users (unique), status (`in_progress` / `complete`), current_topic, done_definition, starting_point, time_budget, deadline, created_at, updated_at (#3) |
| `diary_notes`   | id, goal_id → goals, note_date, content, updated_at (one per goal per day; #19)                               |

**Relationships:** User → Goals → Milestones → Quests. Several Goals allowed; one **active** per user (`goals.status = 'active'`, #18) for Today/Map.
