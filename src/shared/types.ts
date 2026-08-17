export type MessageRole = 'system' | 'user' | 'assistant';
export type AgentId = 'medical-consultant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  inactive?: boolean;
  hidden?: boolean;
  isContextSummary?: true;
}

export interface ChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  agentId?: AgentId;
}

export interface SessionSummary {
  id: string;
  updatedAt: string;
  title: string;
  agentId?: AgentId;
}

export interface AgentSummary {
  id: AgentId;
  name: string;
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
    create: (agentId?: AgentId) => Promise<ChatSession>;
    delete: (id: string) => Promise<void>;
  };
  agents: {
    list: () => Promise<AgentSummary[]>;
  };
  chat: {
    send: (request: ChatSendRequest) => Promise<void>;
    onChunk: (callback: (event: StreamEvent) => void) => () => void;
    onComplete: (callback: (event: StreamEvent) => void) => () => void;
    onError: (callback: (event: StreamEvent) => void) => () => void;
  };
}
