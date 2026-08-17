import { describe, expect, it, vi } from 'vitest';
import { CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD } from '../../shared/constants.js';
import type { ChatSession } from '../../shared/types.js';
import { ContextSummarizerService } from './context-summarizer.service.js';

function session(content: string): ChatSession {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [
      { id: 'u1', role: 'user', content, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 's1', role: 'system', content: 'old summary', createdAt: '2026-01-01T00:00:00.000Z', hidden: true, isContextSummary: true },
    ],
  };
}

describe('ContextSummarizerService', () => {
  it('does nothing below the configured threshold', async () => {
    const summarize = vi.fn();
    const input = session('short');

    await expect(new ContextSummarizerService({ summarize }).compact(input)).resolves.toBe(input);
    expect(summarize).not.toHaveBeenCalled();
  });

  it('inactivates source turns and replaces the old hidden summary', async () => {
    const summarize = vi.fn().mockResolvedValue('Important context');
    const input = session('x'.repeat(CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD * 3));

    const compacted = await new ContextSummarizerService({ summarize }).compact(input);

    expect(summarize).toHaveBeenCalledWith([
      expect.objectContaining({ role: 'user', content: expect.stringContaining('old summary') }),
      input.messages[0],
    ]);
    expect(compacted.messages.find((message) => message.id === 'u1')?.inactive).toBe(true);
    const summaries = compacted.messages.filter((message) => message.hidden);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.isContextSummary).toBe(true);
    expect(summaries[0]?.content).toContain('Important context');
  });

  it('preserves a prior summary when compacting later active turns', async () => {
    const summarize = vi.fn().mockResolvedValue('Combined context');
    const input = session('x'.repeat(CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD * 3));
    input.messages.push({ id: 'old', role: 'assistant', content: 'older visible message', createdAt: '2026-01-01T00:00:00.000Z', inactive: true });

    await new ContextSummarizerService({ summarize }).compact(input);

    expect(summarize.mock.calls[0]?.[0]?.[0]?.content).toContain('old summary');
  });

  it('does not mutate the session when summary generation fails', async () => {
    const input = session('x'.repeat(CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD * 3));
    const service = new ContextSummarizerService({ summarize: vi.fn().mockRejectedValue(new Error('failed')) });

    await expect(service.compact(input)).rejects.toThrow('failed');
    expect(input.messages[0]?.inactive).toBeUndefined();
    expect(input.messages.filter((message) => message.hidden)).toHaveLength(1);
  });

  it('includes a hidden prior summary in the compaction threshold', async () => {
    const summarize = vi.fn().mockResolvedValue('Combined context');
    const input = session('x'.repeat(CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD * 3 - 'old summary'.length));

    await new ContextSummarizerService({ summarize }).compact(input);

    expect(summarize).toHaveBeenCalled();
  });
});
