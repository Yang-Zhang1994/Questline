import { describe, expect, it } from 'vitest';
import { createEchoChatClient } from './client.js';
import { TOPIC_QUESTIONS } from './prompts/mochiInterview.js';

describe('createEchoChatClient time_budget evaluation', () => {
  const answered = {
    done_definition: 'Finish one novel',
    starting_point: 'Know hiragana',
    time_budget: null,
    deadline: null,
  };

  it.each(['10h/week', '1.5h/day', '100', 'skip'])(
    'accepts compact Time answer %s and points at Deadline',
    async (user_answer) => {
      const ai = createEchoChatClient();
      const result = await ai.evaluateInterviewAnswer({
        history: [],
        current_topic: 'time_budget',
        answered,
        user_answer,
        next_topic: 'deadline',
      });

      expect(result.evaluation).toBe('accepted');
      expect(result.extracted_answer).toBeTruthy();
      expect(result.mochi_message).toContain(TOPIC_QUESTIONS.deadline);
    },
  );

  it('still treats non-time gibberish as vague on time_budget', async () => {
    const ai = createEchoChatClient();
    const result = await ai.evaluateInterviewAnswer({
      history: [],
      current_topic: 'time_budget',
      answered,
      user_answer: 'purple',
      next_topic: 'deadline',
    });

    expect(result.evaluation).toBe('vague');
    expect(result.extracted_answer).toBeNull();
  });
});
