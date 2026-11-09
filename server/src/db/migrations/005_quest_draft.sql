-- Draft quest plan on the current milestone until QuestPlanEditor confirm (#7).
-- quests rows are only written on explicit confirm (confirm-before-save).

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS quest_draft JSONB;
