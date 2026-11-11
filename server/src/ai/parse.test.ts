import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DEFAULT_TIME_BUDGET_MINUTES } from '../config/game.js';
import {
  countQuestions,
  ensureNoQuestion,
  ensureOneQuestion,
  parseModelJson,
  parseTimeBudgetAnswer,
  parseTimeBudgetMinutes,
} from './parse.js';

describe('parseModelJson', () => {
  const schema = z.object({ evaluation: z.enum(['accepted', 'vague']), mochi_message: z.string() });

  it('parses plain JSON', () => {
    expect(
      parseModelJson('{"evaluation":"vague","mochi_message":"More detail?"}', schema),
    ).toEqual({ evaluation: 'vague', mochi_message: 'More detail?' });
  });

  it('strips markdown fences', () => {
    const raw = '```json\n{"evaluation":"accepted","mochi_message":"Next?"}\n```';
    expect(parseModelJson(raw, schema)?.evaluation).toBe('accepted');
  });

  it('returns null on invalid JSON or schema mismatch', () => {
    expect(parseModelJson('not-json', schema)).toBeNull();
    expect(parseModelJson('{"evaluation":"nope"}', schema)).toBeNull();
  });
});

describe('question helpers', () => {
  it('counts question marks', () => {
    expect(countQuestions('One?')).toBe(1);
    expect(countQuestions('One? Two?')).toBe(2);
    expect(countQuestions('None.')).toBe(0);
  });

  it('ensures exactly one question', () => {
    expect(ensureOneQuestion('Nice. Next?', 'Fallback?')).toBe('Nice. Next?');
    expect(ensureOneQuestion('Nice.', 'Fallback?')).toBe('Nice Fallback?');
    expect(ensureOneQuestion('A? B?', 'Fallback?')).toBe('A. B Fallback?');
  });

  it('strips questions for complete turns', () => {
    expect(ensureNoQuestion('All done?')).toBe('All done.');
  });
});

describe('parseTimeBudgetAnswer (Time topic regression)', () => {
  it.each([
    ['10h/week', '10 hours a week', Math.round((10 * 60) / 7)],
    ['1.5h/day', '1.5 hours a day', 90],
    ['1.5/day', '1.5 hours a day', 90],
    ['100', '100 minutes a day', 100],
    ['20 minutes a day', '20 minutes a day', 20],
    ['20m/day', '20 minutes a day', 20],
  ])('accepts %s', (raw, display, minutes) => {
    const parsed = parseTimeBudgetAnswer(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.skipped).toBe(false);
    expect(parsed?.display).toBe(display);
    expect(parsed?.minutesPerDay).toBe(minutes);
  });

  it('accepts skip with the soft daily default', () => {
    const parsed = parseTimeBudgetAnswer('skip');
    expect(parsed).toEqual({
      display: `about ${DEFAULT_TIME_BUDGET_MINUTES} minutes a day (soft default)`,
      minutesPerDay: DEFAULT_TIME_BUDGET_MINUTES,
      skipped: true,
    });
  });

  it('rejects empty / non-time answers', () => {
    expect(parseTimeBudgetAnswer('')).toBeNull();
    expect(parseTimeBudgetAnswer('idk')).toBeNull();
    expect(parseTimeBudgetAnswer('purple unicorn')).toBeNull();
  });

  it('parseTimeBudgetMinutes falls back to the soft default', () => {
    expect(parseTimeBudgetMinutes(null)).toBe(DEFAULT_TIME_BUDGET_MINUTES);
    expect(parseTimeBudgetMinutes('nope')).toBe(DEFAULT_TIME_BUDGET_MINUTES);
    expect(parseTimeBudgetMinutes('100')).toBe(100);
  });
});
