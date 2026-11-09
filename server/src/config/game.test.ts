import { describe, expect, it } from 'vitest';
import {
  XP_PER_QUEST,
  XP_TO_REACH_LEVEL,
  levelFromTotalXp,
  levelUpMessage,
  progressSnapshotFromXp,
  xpToReachLevel,
} from './game.js';

describe('game XP / level config (Issue #11)', () => {
  it('defines XP_PER_QUEST and cumulative thresholds in one file', () => {
    expect(XP_PER_QUEST).toBe(10);
    expect(XP_TO_REACH_LEVEL[1]).toBe(0);
    expect(XP_TO_REACH_LEVEL[2]).toBe(50);
    expect(XP_TO_REACH_LEVEL.length).toBeGreaterThan(5);
  });

  it('maps total XP to the correct level at thresholds', () => {
    expect(levelFromTotalXp(0)).toBe(1);
    expect(levelFromTotalXp(49)).toBe(1);
    expect(levelFromTotalXp(50)).toBe(2);
    expect(levelFromTotalXp(119)).toBe(2);
    expect(levelFromTotalXp(120)).toBe(3);
  });

  it('continues leveling beyond the defined table', () => {
    const level10Floor = xpToReachLevel(10);
    expect(levelFromTotalXp(level10Floor)).toBe(10);
    expect(levelFromTotalXp(xpToReachLevel(11))).toBe(11);
  });

  it('exposes bar progress within the current level', () => {
    // Level 2 starts at 50; next at 120 → span 70. At 60 XP → 10 into level.
    expect(progressSnapshotFromXp(60)).toEqual({
      xp: 60,
      level: 2,
      xp_into_level: 10,
      xp_for_next_level: 70,
    });
  });

  it('builds a warm level-up message', () => {
    expect(levelUpMessage(3)).toMatch(/Level 3/);
    expect(levelUpMessage(3)).toMatch(/Mochi/i);
  });
});
