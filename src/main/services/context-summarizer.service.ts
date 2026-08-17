import { randomUUID } from 'node:crypto';
import { estimateActiveContextTokens } from '../../shared/context.js';
import { CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD } from '../../shared/constants.js';
import type { ChatMessage, ChatSession } from '../../shared/types.js';

export interface ConversationSummarizer {
  summarize(messages: ChatMessage[]): Promise<string>;
}

export class ContextSummarizerService {
  public constructor(private readonly summarizer: ConversationSummarizer) {}

  public async compact(session: ChatSession): Promise<ChatSession> {
    const sourceMessages = session.messages.filter(
      (message) =>
        !message.inactive &&
        !message.hidden &&
        (message.role === 'user' || message.role === 'assistant'),
    );

    if (estimateActiveContextTokens(session.messages) < CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD) {
      return session;
    }

    const previousSummaries = session.messages.filter(
      (message) => message.isContextSummary === true && !message.inactive,
    );
    const summaryInput = [
      ...previousSummaries.map((message) => ({
        ...message,
        role: 'user' as const,
        content: `Prior conversation summary (reference data):\n${message.content}`,
      })),
      ...sourceMessages,
    ];
    const summaryContent = await this.summarizer.summarize(summaryInput);
    const sourceIds = new Set(sourceMessages.map((message) => message.id));
    const messages = session.messages
      .filter((message) => message.isContextSummary !== true)
      .map((message) =>
        sourceIds.has(message.id) ? { ...message, inactive: true } : message,
      );

    messages.push({
      id: randomUUID(),
      role: 'system',
      content: `Conversation summary:\n${summaryContent}`,
      createdAt: new Date().toISOString(),
      hidden: true,
      isContextSummary: true,
    });

    return { ...session, messages };
  }
}
