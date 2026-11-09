-- Draft reschedule plan on the active goal until ReschedulePreview confirm (#14).
-- Quest due_dates are only rewritten on explicit confirm (confirm-before-save).

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS reschedule_draft JSONB;
