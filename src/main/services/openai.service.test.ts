import { describe, expect, it, vi } from 'vitest';
import { OpenAIService } from './openai.service.js';
import type { ChatMessage } from '../../shared/types.js';
const messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:00.000Z' }];
describe('OpenAIService', () => {
  it('sends system instructions and forwards streamed content', async () => { const create = vi.fn().mockResolvedValue((async function* () { yield { choices: [{ delta: { content: 'Hi' } }] }; yield { choices: [{ delta: { content: ' there' } }] }; })()); const service = new OpenAIService({ chat: { completions: { create } } }); const chunks: string[] = []; await service.stream({ messages, systemPrompt: 'Be kind', model: 'test-model' }, (chunk) => chunks.push(chunk)); expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model', stream: true, messages: [{ role: 'system', content: 'Be kind' }, { role: 'user', content: 'Hello' }] })); expect(chunks).toEqual(['Hi', ' there']); });
  it('propagates API and interrupted-stream errors', async () => { const failure = new Error('network failure'); const service = new OpenAIService({ chat: { completions: { create: vi.fn().mockRejectedValue(failure) } } }); await expect(service.stream({ messages }, () => undefined)).rejects.toThrow('network failure'); });
});
