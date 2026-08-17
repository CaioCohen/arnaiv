import type { ChatMessage, ChatSession } from '../../shared/types.js';

export interface SessionWriter {
  saveSession(session: ChatSession): Promise<void>;
}

export interface ContextCompactor {
  compact(session: ChatSession): Promise<ChatSession>;
}

export class ChatCompletionService {
  public constructor(
    private readonly sessions: SessionWriter,
    private readonly summarizer: ContextCompactor,
    private readonly onSummaryFailure: (sessionId: string, error: unknown) => void,
  ) {}

  public async persistAssistantResponse(
    session: ChatSession,
    assistant: ChatMessage,
  ): Promise<ChatSession> {
    session.messages.push(assistant);
    await this.sessions.saveSession(session);

    try {
      const compacted = await this.summarizer.compact(session);
      if (compacted !== session) await this.sessions.saveSession(compacted);
      return compacted;
    } catch (error: unknown) {
      this.onSummaryFailure(session.id, error);
      return session;
    }
  }
}
