export type MessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface SessionSummary {
  id: string;
  updatedAt: string;
  title: string;
}

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ChatSendRequest {
  sessionId: string;
  content: string;
  reasoningEffort: ReasoningEffort;
}

export interface StreamEvent {
  sessionId: string;
  messageId: string;
  content?: string;
  error?: string;
}

export interface ArnAIvApi {
  sessions: {
    list: () => Promise<SessionSummary[]>;
    get: (id: string) => Promise<ChatSession | null>;
    create: () => Promise<ChatSession>;
    delete: (id: string) => Promise<void>;
  };
  chat: {
    send: (request: ChatSendRequest) => Promise<void>;
    onChunk: (callback: (event: StreamEvent) => void) => () => void;
    onComplete: (callback: (event: StreamEvent) => void) => () => void;
    onError: (callback: (event: StreamEvent) => void) => () => void;
  };
}
