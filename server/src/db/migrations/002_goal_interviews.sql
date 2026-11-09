-- Goal interview progress (Issue #3). One active interview row per user.
-- Answers stay in drafts here until GoalConfirmCard (#4) saves a Goal.

CREATE TABLE IF NOT EXISTS goal_interviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'complete')),
  current_topic TEXT NOT NULL DEFAULT 'done_definition'
    CHECK (current_topic IN ('done_definition', 'starting_point', 'time_budget', 'deadline')),
  done_definition TEXT,
  starting_point TEXT,
  time_budget TEXT,
  deadline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_interviews_user_id ON goal_interviews(user_id);
