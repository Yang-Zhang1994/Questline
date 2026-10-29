# Data model (Issue #17)

Dates: `YYYY-MM-DD` for calendar dates; full ISO for timestamps. Schema changes need a new migration; never edit an applied migration.

| Table           | Key fields                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| `goals`         | id, title, done_definition, starting_point, time_budget_minutes_per_day, deadline, status, created_at         |
| `milestones`    | id, goal_id → goals, position, title, description, target_date, status (`upcoming` / `current` / `completed`) |
| `quests`        | id, milestone_id → milestones, title, due_date, estimated_minutes, completed_at (nullable)                    |
| `user_progress` | id, xp, level, current_streak, best_streak, last_active_date                                                  |
| `stamps`        | id, card_number, stamp_date                                                                                   |
| `chat_messages` | id, goal_id (nullable), role (`user` / `mochi`), content, created_at                                          |
| `diary_notes`   | id, goal_id → goals, note_date, content, updated_at (one per goal per day; #19)                               |

**Relationships:** Goal → many Milestones → many Quests. Several Goals allowed; one active (`goals.status = 'active'`, #18).
