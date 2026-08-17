import { describe, expect, it } from 'vitest';
import { contextWindowPercentage, estimateActiveContextTokens } from './context.js';
import { CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD } from './constants.js';
import type { ChatMessage } from './types.js';

const message = (role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: crypto.randomUUID(), role, content, createdAt: '2026-01-01T00:00:00.000Z', ...extra,
});

describe('context estimation', () => {
  it('counts only active visible user and assistant content', () => {
    const messages = [
      message('user', '123456'),
      message('assistant', '123456'),
      message('system', '123456'),
      message('user', '123456', { inactive: true }),
      message('assistant', '123456', { hidden: true }),
      message('system', '123456', { hidden: true, isContextSummary: true }),
    ];

    expect(estimateActiveContextTokens(messages)).toBe(6);
  });

  it('caps the meter percentage at 100', () => {
    expect(contextWindowPercentage([message('user', 'x'.repeat(CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD * 6))])).toBe(100);
  });
});
