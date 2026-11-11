import { describe, expect, it } from 'vitest';
import { createRoadmapService } from './roadmapService.js';
import type { RoadmapRepository } from '../repositories/roadmapRepository.js';

describe('roadmapService (Issue #6)', () => {
  it('forwards active roadmap for a user', async () => {
    const mockRepo: RoadmapRepository = {
      getActiveGoalRoadmapForUser: async (_userId: number) => ({
        goal: {
          id: 1,
          title: 'Read a Japanese novel on my own',
          deadline: '2027-10-28',
          status: 'active',
        },
        milestones: [
          {
            id: 1,
            goal_id: 1,
            position: 1,
            title: 'Build a tiny daily reading habit',
            description: 'Read a few pages each day',
            target_date: '2026-12-01',
            status: 'current',
            total_quests: 3,
            done_quests: 0,
          },
        ],
      }),
    };

    const service = createRoadmapService({ roadmap: mockRepo });
    const result = await service.getActiveRoadmap(42);

    expect(result.goal?.title).toBe('Read a Japanese novel on my own');
    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0].status).toBe('current');
  });

  it('handles null goal and empty milestones', async () => {
    const mockRepo: RoadmapRepository = {
      getActiveGoalRoadmapForUser: async () => ({
        goal: null,
        milestones: [],
      }),
    };

    const service = createRoadmapService({ roadmap: mockRepo });
    const result = await service.getActiveRoadmap(42);

    expect(result.goal).toBeNull();
    expect(result.milestones).toEqual([]);
  });
});
