import { RoadmapResponseSchema } from '@questline/shared';
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

  it('extracts a YYYY-MM-DD deadline from free text or returns null when no date is present', async () => {
    const repoWithEmbeddedDate: RoadmapRepository = {
      getActiveGoalRoadmapForUser: async () => ({
        goal: {
          id: 1,
          title: 'Read a Japanese novel on my own',
          deadline: 'by 2027-11-12, about one year from now',
          status: 'active',
        },
        milestones: [],
      }),
    };
    const resEmbedded = await createRoadmapService({
      roadmap: repoWithEmbeddedDate,
    }).getActiveRoadmap(1);
    expect(resEmbedded.goal?.deadline).toBe('2027-11-12');
    expect(RoadmapResponseSchema.safeParse(resEmbedded).success).toBe(true);

    const repoWithoutDate: RoadmapRepository = {
      getActiveGoalRoadmapForUser: async () => ({
        goal: {
          id: 1,
          title: 'Read a Japanese novel on my own',
          deadline: 'this progress should take one year',
          status: 'active',
        },
        milestones: [],
      }),
    };
    const resNull = await createRoadmapService({
      roadmap: repoWithoutDate,
    }).getActiveRoadmap(1);
    expect(resNull.goal?.deadline).toBeNull();
    expect(RoadmapResponseSchema.safeParse(resNull).success).toBe(true);
  });
});
