import { vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
import { createEchoChatClient } from '../ai/client.js';

/** Full ChatAiClient stub for tests — never hits Claude. */
export function stubAi(overrides: Partial<ChatAiClient> = {}): ChatAiClient {
  const echo = createEchoChatClient();
  return {
    completeChat: overrides.completeChat ?? vi.fn(echo.completeChat),
    evaluateInterviewAnswer:
      overrides.evaluateInterviewAnswer ?? vi.fn(echo.evaluateInterviewAnswer),
    proposeMilestonePlan: overrides.proposeMilestonePlan ?? vi.fn(echo.proposeMilestonePlan),
    reviseMilestonePlan: overrides.reviseMilestonePlan ?? vi.fn(echo.reviseMilestonePlan),
  };
}
