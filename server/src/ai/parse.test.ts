import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { countQuestions, ensureNoQuestion, ensureOneQuestion, parseModelJson } from './parse.js';

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
