import { describe, expect, it } from 'vitest';
import {
  STAMPS_PER_CARD,
  XP_PER_QUEST,
  XP_TO_REACH_LEVEL,
  applyActiveDay,
  applyMissedDayReset,
  buildStampCardSnapshot,
  cardCompletedMessage,
  levelFromTotalXp,
  levelUpMessage,
  previousIsoDate,
  progressSnapshotFromXp,
  revertActiveDay,
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
    expect(progressSnapshotFromXp(60)).toEqual({
      xp: 60,
      level: 2,
      xp_into_level: 10,
      xp_for_next_level: 70,
      current_streak: 0,
      best_streak: 0,
      last_active_date: null,
    });
  });

  it('builds a warm level-up message', () => {
    expect(levelUpMessage(3)).toMatch(/Level 3/);
    expect(levelUpMessage(3)).toMatch(/Mochi/i);
  });
});

describe('game streak helpers (Issue #12)', () => {
  it('computes the previous local ISO date across month boundaries', () => {
    expect(previousIsoDate('2026-11-01')).toBe('2026-10-31');
    expect(previousIsoDate('2026-03-01')).toBe('2026-02-28');
  });

  // AC: The streak increases by 1 on each day the user completes at least one quest
  it('increases current streak on consecutive active days and tracks best', () => {
    let state = { current_streak: 0, best_streak: 0, last_active_date: null as string | null };
    state = applyActiveDay(state, '2026-10-28');
    expect(state).toEqual({ current_streak: 1, best_streak: 1, last_active_date: '2026-10-28' });
    state = applyActiveDay(state, '2026-10-29');
    expect(state).toEqual({ current_streak: 2, best_streak: 2, last_active_date: '2026-10-29' });
  });

  // AC: Completing several quests on the same day counts as one streak day
  it('does not double-count the same local day', () => {
    let state = applyActiveDay(
      { current_streak: 0, best_streak: 0, last_active_date: null },
      '2026-10-28',
    );
    state = applyActiveDay(state, '2026-10-28');
    expect(state.current_streak).toBe(1);
    expect(state.best_streak).toBe(1);
  });

  // AC: The streak resets to 0 after a full day with no completed quest
  it('starts a fresh streak after a missed day and resets current on load', () => {
    const afterMiss = applyActiveDay(
      { current_streak: 3, best_streak: 5, last_active_date: '2026-10-26' },
      '2026-10-28',
    );
    expect(afterMiss).toEqual({
      current_streak: 1,
      best_streak: 5,
      last_active_date: '2026-10-28',
    });

    expect(
      applyMissedDayReset(
        { current_streak: 3, best_streak: 5, last_active_date: '2026-10-26' },
        '2026-10-28',
      ),
    ).toEqual({ current_streak: 0, best_streak: 5, last_active_date: '2026-10-26' });
  });

  it('reverts streak side effects when undoing the only completion of the day', () => {
    const after = revertActiveDay(
      { current_streak: 2, best_streak: 2, last_active_date: '2026-10-29' },
      '2026-10-29',
    );
    expect(after).toEqual({
      current_streak: 1,
      best_streak: 1,
      last_active_date: '2026-10-28',
    });
  });
});

describe('game stamp card helpers (Issue #13)', () => {
  it('returns an empty Card #1 with STAMPS_PER_CARD (10) slots when the user has no stamps', () => {
    expect(STAMPS_PER_CARD).toBe(10);
    expect(buildStampCardSnapshot([])).toEqual({
      card_number: 1,
      stamps_per_card: 10,
      stamped_dates: [],
      filled_count: 0,
      past_cards: [],
    });
  });

  it('tracks stamped dates on the current card and rolls over to Card #2 when Card #1 fills 10 slots', () => {
    const nineRows = Array.from({ length: 9 }, (_, i) => ({
      card_number: 1,
      stamp_date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    }));

    const partial = buildStampCardSnapshot(nineRows);
    expect(partial.card_number).toBe(1);
    expect(partial.filled_count).toBe(9);
    expect(partial.past_cards).toEqual([]);

    const tenRows = [...nineRows, { card_number: 1, stamp_date: '2026-11-10' }];
    const rolledOver = buildStampCardSnapshot(tenRows);
    expect(rolledOver).toEqual({
      card_number: 2,
      stamps_per_card: 10,
      stamped_dates: [],
      filled_count: 0,
      past_cards: [
        {
          card_number: 1,
          stamp_dates: tenRows.map((r) => r.stamp_date),
          stamp_count: 10,
        },
      ],
    });
  });

  it('builds a warm Mochi celebration message when a card completes', () => {
    expect(cardCompletedMessage(1)).toMatch(/Stamp Card #1/i);
    expect(cardCompletedMessage(1)).toMatch(/Mochi/i);
  });
});
