import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection.js';
import { seedDemoDataIfEmpty } from '../db/seed.js';
import { createRoadmapRepository } from '../repositories/roadmapRepository.js';
import { createRoadmapService } from './roadmapService.js';

describe('roadmapService (Issue #6)', () => {
  it('returns the active goal and milestones in position order', () => {
    const db = openDatabase({ filename: ':memory:' });
    seedDemoDataIfEmpty(db);
    const roadmap = createRoadmapRepository(db);
    const service = createRoadmapService({ roadmap });

    const result = service.getActiveRoadmap();

    expect(result.goal).not.toBeNull();
    expect(result.goal?.title).toBe('Read a Japanese novel on my own');
    expect(result.goal?.deadline).toBe('2027-10-28');
    expect(result.goal?.status).toBe('active');

    expect(result.milestones).toHaveLength(5);
    expect(result.milestones[0].position).toBe(1);
    expect(result.milestones[0].status).toBe('completed');
    expect(result.milestones[0].done_quests).toBe(1);
    expect(result.milestones[0].total_quests).toBe(1);

    expect(result.milestones[1].position).toBe(2);
    expect(result.milestones[1].status).toBe('current');
    expect(result.milestones[1].total_quests).toBe(3);
    expect(result.milestones[1].done_quests).toBe(0);

    expect(result.milestones[4].position).toBe(5);
    expect(result.milestones[4].status).toBe('upcoming');
  });

  it('returns null goal and empty milestones when there is no active goal', () => {
    const db = openDatabase({ filename: ':memory:' });
    // Empty database without seed
    const roadmap = createRoadmapRepository(db);
    const service = createRoadmapService({ roadmap });

    const result = service.getActiveRoadmap();
    expect(result.goal).toBeNull();
    expect(result.milestones).toEqual([]);
  });
});
