import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentId, ChatMessage, ChatSession, SessionSummary } from '../../shared/types.js';
import { isAgentId } from './agent-registry.service.js';

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export class SessionService {
  public constructor(private readonly directory: string) {}

  private file(id: unknown): string {
    return path.join(this.directory, `${this.sessionId(id)}.json`);
  }

  private sessionId(id: unknown): string {
    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new SessionError('Conversation ID is invalid.');
    }

    return id;
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  public async createSession(agentId?: AgentId): Promise<ChatSession> {
    const now = new Date().toISOString();
    return { id: randomUUID(), createdAt: now, updatedAt: now, messages: [], ...(agentId ? { agentId } : {}) };
  }

  public async getSession(id: string): Promise<ChatSession | null> {
    const sessionId = this.sessionId(id);

    try {
      return this.validate(JSON.parse(await readFile(this.file(sessionId), 'utf8')), sessionId);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      throw new SessionError('Unable to load this conversation.');
    }
  }

  public async listSessions(): Promise<SessionSummary[]> {
    await this.ensureDirectory();
    const files = (await readdir(this.directory)).filter((name) => name.endsWith('.json'));
    const sessions = await Promise.all(files.map(async (name) => this.getSession(name.slice(0, -5)).catch(() => null)));
    return sessions
      .filter((item): item is ChatSession => item !== null && item.messages.length > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((session) => ({
        id: session.id,
        updatedAt: session.updatedAt,
        title:
          session.messages.find((message) => message.role === 'user')?.content.replace(/\s+/g, ' ').trim() ||
          'New chat',
        ...(session.agentId ? { agentId: session.agentId } : {}),
      }));
  }

  public async saveSession(session: ChatSession): Promise<void> {
    const sessionId = this.sessionId(session.id);
    await this.ensureDirectory();
    const next = { ...session, id: sessionId, updatedAt: new Date().toISOString() };
    const temporary = `${this.file(sessionId)}.${randomUUID()}.tmp`;

    try {
      await writeFile(temporary, JSON.stringify(next, null, 2), 'utf8');
      await rename(temporary, this.file(sessionId));
    } catch {
      await unlink(temporary).catch(() => undefined);
      throw new SessionError('Unable to save this conversation.');
    }
  }

  public async deleteSession(id: string): Promise<void> {
    await unlink(this.file(id)).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new SessionError('Unable to delete this conversation.');
      }
    });
  }

  public createMessage(role: ChatMessage['role'], content: string): ChatMessage {
    return { id: randomUUID(), role, content, createdAt: new Date().toISOString() };
  }

  private validate(value: unknown, expectedId?: string): ChatSession {
    if (!value || typeof value !== 'object') {
      throw new SessionError('Conversation data is invalid.');
    }

    const session = value as Partial<ChatSession>;

    if (
      typeof session.id !== 'string' ||
      typeof session.createdAt !== 'string' ||
      typeof session.updatedAt !== 'string' ||
      !Array.isArray(session.messages) ||
      (expectedId && session.id !== expectedId)
    ) {
      throw new SessionError('Conversation data is invalid.');
    }

    this.sessionId(session.id);

    if (
      !session.messages.every(
        (message) =>
          message &&
          typeof message.id === 'string' &&
          ['system', 'user', 'assistant'].includes(message.role) &&
          typeof message.content === 'string' &&
          typeof message.createdAt === 'string' &&
          (message.inactive === undefined || typeof message.inactive === 'boolean') &&
          (message.hidden === undefined || typeof message.hidden === 'boolean') &&
          (message.isContextSummary === undefined || message.isContextSummary === true) &&
          (!message.hidden || message.isContextSummary === true) &&
          (message.isContextSummary !== true || (message.hidden === true && message.role === 'system')),
      )
    ) {
      throw new SessionError('Conversation messages are invalid.');
    }

    if (session.agentId !== undefined && !isAgentId(session.agentId)) {
      throw new SessionError('Conversation data is invalid.');
    }

    return session as ChatSession;
  }
}
