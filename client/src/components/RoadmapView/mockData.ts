export type MilestoneStatus = 'upcoming' | 'current' | 'completed';

export interface Milestone {
  id: number;
  goal_id: number;
  position: number;
  title: string;
  description: string;
  target_date: string; // YYYY-MM-DD
  status: MilestoneStatus;
  done_quests?: number;
  total_quests?: number;
}

export interface RoadmapGoal {
  id: number;
  title: string;
  deadline: string | null; // YYYY-MM-DD or null
  status: 'active' | 'completed' | 'paused';
}

export const MOCK_GOAL: RoadmapGoal = {
  id: 1,
  title: 'Read a Japanese novel on my own',
  deadline: '2027-10-28',
  status: 'active',
};

export const MOCK_MILESTONES: Milestone[] = [
  {
    id: 1,
    goal_id: 1,
    position: 1,
    title: 'Learn Hiragana & Katakana',
    description: 'Master reading and writing both basic syllabaries and recognize common sounds.',
    target_date: '2026-11-15',
    status: 'completed',
    done_quests: 10,
    total_quests: 10,
  },
  {
    id: 2,
    goal_id: 1,
    position: 2,
    title: 'Build a tiny daily reading habit',
    description: 'Read graded readers for 15 minutes each day and jot down new vocabulary.',
    target_date: '2026-12-01',
    status: 'current',
    done_quests: 3,
    total_quests: 8,
  },
  {
    id: 3,
    goal_id: 1,
    position: 3,
    title: 'Finish first graded reader (Level 1)',
    description: 'Complete all short stories in Level 1 with 80%+ comprehension without a dictionary.',
    target_date: '2027-02-15',
    status: 'upcoming',
    done_quests: 0,
    total_quests: 12,
  },
  {
    id: 4,
    goal_id: 1,
    position: 4,
    title: 'Read first short manga chapter',
    description: 'Tackle simple dialogue and sound effects in a slice-of-life manga.',
    target_date: '2027-05-30',
    status: 'upcoming',
    done_quests: 0,
    total_quests: 14,
  },
  {
    id: 5,
    goal_id: 1,
    position: 5,
    title: 'Finish a full Japanese light novel',
    description: 'Read cover-to-cover at your own pace and celebrate reaching your dream!',
    target_date: '2027-10-28',
    status: 'upcoming',
    done_quests: 0,
    total_quests: 20,
  },
];
