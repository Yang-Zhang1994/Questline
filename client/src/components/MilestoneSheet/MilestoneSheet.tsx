import type { Milestone } from '@questline/shared';

export type MilestoneSheetProps = {
  milestone: Milestone | null;
  timeBudgetMinutesPerDay?: number | null;
  onClose: () => void;
  onQuestsChanged?: () => void;
};

export function MilestoneSheet(_props: MilestoneSheetProps) {
  return null;
}
