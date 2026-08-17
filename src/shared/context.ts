import { CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD } from './constants.js';
import type { ChatMessage } from './types.js';

export function estimateActiveContextTokens(messages: readonly ChatMessage[]): number {
  const characters = messages.reduce((total, message) => {
    const isGeneratedSummary =
      !message.inactive && message.hidden && message.isContextSummary === true;
    const isActiveConversationTurn =
      !message.inactive &&
      !message.hidden &&
      (message.role === 'user' || message.role === 'assistant');

    if (!isGeneratedSummary && !isActiveConversationTurn) {
      return total;
    }

    return total + message.content.length;
  }, 0);

  return Math.floor(characters / 3);
}

export function contextWindowPercentage(messages: readonly ChatMessage[]): number {
  return Math.min(
    (estimateActiveContextTokens(messages) / CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD) * 100,
    100,
  );
}
