-- Track how many quest completions count toward the current last_active_date (#12).
-- Lets undo reverse streak only when the last completion of that local day is cleared.
ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS active_day_completions INTEGER NOT NULL DEFAULT 0;
