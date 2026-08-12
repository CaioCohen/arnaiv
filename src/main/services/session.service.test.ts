import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';
import { SessionService } from './session.service.js';

const directories: string[] = [];
async function service(): Promise<SessionService> { const directory = await mkdtemp(path.join(os.tmpdir(), 'arnaiv-')); directories.push(directory); return new SessionService(directory); }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });
describe('SessionService', () => {
  it('creates, saves, and retrieves a session', async () => { const store = await service(); const session = await store.createSession(); session.messages.push(store.createMessage('user', 'Hello')); await store.saveSession(session); const loaded = await store.getSession(session.id); expect(loaded?.messages[0]?.content).toBe('Hello'); expect(loaded?.updatedAt).not.toBe(session.updatedAt); });
  it('lists most recently saved sessions first with first-user titles', async () => { const store = await service(); const first = await store.createSession(); first.messages.push(store.createMessage('user', 'First conversation')); await store.saveSession(first); const second = await store.createSession(); second.messages.push(store.createMessage('user', 'Second conversation')); await store.saveSession(second); const list = await store.listSessions(); expect(list.map((item) => item.title)).toEqual(['Second conversation', 'First conversation']); });
  it('returns null for missing sessions and ignores malformed files while listing', async () => { const store = await service(); expect(await store.getSession('00000000-0000-4000-8000-000000000000')).toBeNull(); await writeFile(path.join((store as unknown as { directory: string }).directory, 'bad.json'), '{not json'); expect(await store.listSessions()).toEqual([]); });
  it('persists complete JSON atomically', async () => { const store = await service(); const session = await store.createSession(); const raw = await readFile(path.join((store as unknown as { directory: string }).directory, `${session.id}.json`), 'utf8'); expect(JSON.parse(raw).id).toBe(session.id); });
  it('deletes sessions and rejects path traversal IDs', async () => { const store = await service(); const session = await store.createSession(); await store.deleteSession(session.id); expect(await store.getSession(session.id)).toBeNull(); await expect(store.getSession('../outside')).rejects.toThrow('Conversation ID is invalid.'); await expect(store.deleteSession('../outside')).rejects.toThrow('Conversation ID is invalid.'); });
});
