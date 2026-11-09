-- Draft week plan on the active goal until WeekPlanPreview confirm (#15).
-- New quest rows are only INSERTed on explicit confirm (confirm-before-save).

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS week_plan_draft JSONB;
