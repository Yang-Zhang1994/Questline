-- Draft goal proposal on the interview row until GoalConfirmCard Accept (#4).
-- goals table is only written on explicit confirm.

ALTER TABLE goal_interviews
  ADD COLUMN IF NOT EXISTS goal_draft JSONB;
