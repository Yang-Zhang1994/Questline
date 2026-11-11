# Architecture

Companion to `AGENTS.md` §1.3. Stack: **React + Vite** SPA ↔ **Express 5** API ↔ **PostgreSQL** ↔ **Claude** (server-only).

## System context

```mermaid
flowchart LR
  User([Player]) --> SPA[React + Vite SPA<br/>Today / Map / Talk]
  SPA -->|Bearer JWT /api| API[Express API<br/>routes → services → repos]
  API --> PG[(PostgreSQL)]
  API -->|@anthropic-ai/sdk| Claude[Claude API<br/>ANTHROPIC_*]
  Shared[shared/schemas<br/>zod] -.-> SPA
  Shared -.-> API
```

## Request path

```mermaid
flowchart TB
  subgraph Client
    Pages[pages + hooks]
    ApiHelpers[client/src/api]
    Pages --> ApiHelpers
  end

  subgraph Server
    Routes[routes/]
    MW[helmet · cors · JWT · rate-limit · zod]
    Services[services/]
    Repos[repositories/]
    AI[ai/client.ts + prompts/]
    Routes --> MW --> Services
    Services --> Repos
    Services --> AI
  end

  ApiHelpers -->|HTTP JSON| Routes
  Repos --> DB[(PostgreSQL migrations)]
  AI --> Claude[(Anthropic)]
```

## Layering rules

| Layer | Owns | Does not |
| ----- | ---- | -------- |
| `client/` | UI, React Router, Bearer fetch | Claude keys, SQL, business rules |
| `server/routes/` | HTTP verbs, zod parse, status codes | SQL, XP math, prompt text |
| `server/services/` | Domain logic, confirm-before-save, transactions | Express `req`/`res` |
| `server/repositories/` | Parameterized SQL | Auth / AI decisions |
| `server/ai/` | Claude gateway + prompts | Direct DB writes of drafts as final rows |
| `shared/schemas/` | Request/response zod contracts | Runtime side effects |

**Confirm-before-save:** Mochi proposals land in JSONB drafts (`goals.milestone_draft`, `milestones.quest_draft`, `goals.reschedule_draft`, `goals.week_plan_draft`). Only `*/confirm` (or manual-plan submit) writes Goal / Milestone / Quest rows.

## API surface (summary)

| Mount | Purpose |
| ----- | ------- |
| `GET /api/health` | Liveness |
| `/api/auth` | Register / login → JWT |
| `/api/goals` | List, activate, delete, new-goal interview, manual plan |
| `/api/milestones` | Draft → revise → confirm; stage complete |
| `/api/quests` | Today (+ progress HUD), CRUD, quest draft, reschedule, week plan |
| `/api/chat` | Messages + interview restart |
| `/api/diary-notes` | Daily note get / upsert |

Full contract: [`openapi.yaml`](./openapi.yaml).

## Database schema (ER)

Derived from `server/src/db/migrations/` (`001`–`008`). Calendar dates are `TEXT` as `YYYY-MM-DD`; timestamps are `TIMESTAMPTZ`.

```mermaid
erDiagram
  users ||--o{ goals : owns
  users ||--o| user_progress : has
  users ||--o{ stamps : collects
  users ||--o{ chat_messages : writes
  users ||--o| goal_interviews : interviews
  goals ||--o{ milestones : contains
  goals ||--o{ diary_notes : journals
  goals ||--o{ chat_messages : "optional goal_id"
  milestones ||--o{ quests : schedules

  users {
    int id PK
    text email UK
    text password_hash
    timestamptz created_at
  }

  goals {
    int id PK
    int user_id FK
    text title
    text done_definition
    text starting_point
    int time_budget_minutes_per_day
    text deadline
    text status
    jsonb milestone_draft
    jsonb reschedule_draft
    jsonb week_plan_draft
    timestamptz created_at
  }

  milestones {
    int id PK
    int goal_id FK
    int position
    text title
    text description
    text target_date
    text status
    jsonb quest_draft
  }

  quests {
    int id PK
    int milestone_id FK
    text title
    text due_date
    int estimated_minutes
    timestamptz completed_at
  }

  user_progress {
    int id PK
    int user_id FK
    int xp
    int level
    int current_streak
    int best_streak
    text last_active_date
    int active_day_completions
  }

  stamps {
    int id PK
    int user_id FK
    int card_number
    text stamp_date
  }

  chat_messages {
    int id PK
    int user_id FK
    int goal_id FK
    text role
    text content
    timestamptz created_at
  }

  goal_interviews {
    int id PK
    int user_id FK
    text status
    text current_topic
    text done_definition
    text starting_point
    text time_budget
    text deadline
    timestamptz created_at
    timestamptz updated_at
  }

  diary_notes {
    int id PK
    int goal_id FK
    text note_date
    text content
    timestamptz updated_at
  }
```

**Constraints worth knowing**

- One **active** goal per user (`UNIQUE` partial index on `goals(user_id) WHERE status = 'active'`).
- `milestones (goal_id, position)` unique; statuses `upcoming` / `current` / `completed`.
- `stamps (user_id, stamp_date)` unique; `diary_notes (goal_id, note_date)` unique; one `goal_interviews` row per user.
- Cascade deletes: user → goals → milestones → quests; diary notes cascade with goals.

Narrative field notes: [`data-model.md`](./data-model.md).

## Optional rendered images

GitHub / most Markdown viewers render the Mermaid blocks above. Optional SVG exports (if present):

- [`diagrams/architecture.svg`](./diagrams/architecture.svg)
- [`diagrams/schema-er.svg`](./diagrams/schema-er.svg)
