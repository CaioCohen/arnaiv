import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChatMessage, ChatSession, SessionSummary } from '../../shared/types.js';

export class SessionError extends Error { constructor(message: string) { super(message); this.name = 'SessionError'; } }

export class SessionService {
  public constructor(private readonly directory: string) {}
  private file(id: string): string { return path.join(this.directory, `${id}.json`); }
  private async ensureDirectory(): Promise<void> { await mkdir(this.directory, { recursive: true }); }
  public async createSession(): Promise<ChatSession> {
    const now = new Date().toISOString(); const session = { id: randomUUID(), createdAt: now, updatedAt: now, messages: [] };
    await this.saveSession(session); return session;
  }
  public async getSession(id: string): Promise<ChatSession | null> {
    try { return this.validate(JSON.parse(await readFile(this.file(id), 'utf8'))); }
    catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new SessionError('Unable to load this conversation.'); }
  }
  public async listSessions(): Promise<SessionSummary[]> {
    await this.ensureDirectory();
    const files = (await readdir(this.directory)).filter((name) => name.endsWith('.json'));
    const sessions = await Promise.all(files.map(async (name) => this.getSession(name.slice(0, -5)).catch(() => null)));
    return sessions.filter((item): item is ChatSession => item !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((session) => ({
      id: session.id, updatedAt: session.updatedAt, title: session.messages.find((message) => message.role === 'user')?.content.replace(/\s+/g, ' ').trim() || 'New chat',
    }));
  }
  public async saveSession(session: ChatSession): Promise<void> {
    await this.ensureDirectory(); const next = { ...session, updatedAt: new Date().toISOString() };
    const temporary = `${this.file(session.id)}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(next, null, 2), 'utf8'); await rename(temporary, this.file(session.id)); }
    catch { await unlink(temporary).catch(() => undefined); throw new SessionError('Unable to save this conversation.'); }
  }
  public async deleteSession(id: string): Promise<void> { await unlink(this.file(id)).catch((error: unknown) => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new SessionError('Unable to delete this conversation.'); }); }
  public createMessage(role: ChatMessage['role'], content: string): ChatMessage { return { id: randomUUID(), role, content, createdAt: new Date().toISOString() }; }
  private validate(value: unknown): ChatSession {
    if (!value || typeof value !== 'object') throw new SessionError('Conversation data is invalid.');
    const session = value as Partial<ChatSession>;
    if (typeof session.id !== 'string' || typeof session.createdAt !== 'string' || typeof session.updatedAt !== 'string' || !Array.isArray(session.messages)) throw new SessionError('Conversation data is invalid.');
    if (!session.messages.every((message) => message && typeof message.id === 'string' && ['system', 'user', 'assistant'].includes(message.role) && typeof message.content === 'string' && typeof message.createdAt === 'string')) throw new SessionError('Conversation messages are invalid.');
    return session as ChatSession;
  }
}
