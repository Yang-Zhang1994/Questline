-- Track the local calendar date (YYYY-MM-DD) when a quest was checked off (#13).
-- Lets undo remove the stamp for the day the quest was completed only when no other
-- quest completed on that same local date remains for the user.
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS completed_local_date TEXT;

CREATE INDEX IF NOT EXISTS idx_quests_completed_local_date
  ON quests (completed_local_date);
