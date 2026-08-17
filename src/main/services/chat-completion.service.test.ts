import { describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '../../shared/types.js';
import { ChatCompletionService } from './chat-completion.service.js';

const session = (): ChatSession => ({ id: '00000000-0000-4000-8000-000000000000', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', messages: [] });
const assistant = { id: 'a1', role: 'assistant' as const, content: 'Done', createdAt: '2026-01-01T00:00:00.000Z' };

describe('ChatCompletionService', () => {
  it('persists the reply before and after successful compaction', async () => {
    const input = session();
    const compacted = { ...input, messages: [{ ...assistant, inactive: true }] };
    const saveSession = vi.fn().mockResolvedValue(undefined);
    const compact = vi.fn().mockResolvedValue(compacted);
    const service = new ChatCompletionService({ saveSession }, { compact }, vi.fn());

    await expect(service.persistAssistantResponse(input, assistant)).resolves.toBe(compacted);
    expect(saveSession).toHaveBeenNthCalledWith(1, expect.objectContaining({ messages: [assistant] }));
    expect(saveSession).toHaveBeenNthCalledWith(2, compacted);
  });

  it('retains the saved reply and reports a summarization failure', async () => {
    const input = session();
    const saveSession = vi.fn().mockResolvedValue(undefined);
    const onSummaryFailure = vi.fn();
    const service = new ChatCompletionService({ saveSession }, { compact: vi.fn().mockRejectedValue(new Error('failed')) }, onSummaryFailure);

    await expect(service.persistAssistantResponse(input, assistant)).resolves.toBe(input);
    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(onSummaryFailure).toHaveBeenCalledWith(input.id, expect.any(Error));
  });
});
