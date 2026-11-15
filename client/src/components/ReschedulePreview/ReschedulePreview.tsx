import type { Milestone, Quest, RescheduleMove, RoadmapGoal } from '@questline/shared';

export type ReschedulePreviewProps = {
  goal: RoadmapGoal | null;
  milestone: Milestone | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  timeBudgetMinutesPerDay?: number;
  overdueQuests?: Quest[];
  existingQuests?: Quest[];
  draftMoves: RescheduleMove[] | null;
  mochiMessage?: string | null;
  proposing?: boolean;
  confirming?: boolean;
  confirmed?: boolean;
  error?: string | null;
  onPropose: () => void | Promise<void>;
  onAdjust: (feedback: string) => void | Promise<void>;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

/** Stub for Phase 2 TDD — Issue #14. */
export function ReschedulePreview(_props: ReschedulePreviewProps) {
  return null;
}
