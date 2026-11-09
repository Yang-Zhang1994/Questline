-- Draft milestone plan on the active goal until MilestonePlanEditor confirm (#5).
-- milestones rows are only written on explicit confirm (confirm-before-save).

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS milestone_draft JSONB;
