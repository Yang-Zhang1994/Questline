/** Shared types for Questline quests and API contracts. */

export const APP_NAME = 'Questline' as const;

export type Quest = {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD) this quest belongs to */
  date: string;
  completed: boolean;
  /** ISO timestamp when marked done; null if not completed */
  completedAt: string | null;
};

export type TodayQuestsResponse = {
  date: string;
  quests: Quest[];
};

export type QuestUpdateResponse = {
  quest: Quest;
};

/** Local calendar date as YYYY-MM-DD. */
export function todayDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
