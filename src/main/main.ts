import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain } from 'electron';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { DEFAULT_SYSTEM_PROMPT } from '../shared/constants.js';
import type { ChatSendRequest } from '../shared/types.js';
import { OpenAIService } from './services/openai.service.js';
import { SessionService } from './services/session.service.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let sessions: SessionService;
let isGenerating = false;

function messageFor(error: unknown): string { return error instanceof Error && error.message.includes('OPENAI_API_KEY') ? 'OpenAI is not configured. Add OPENAI_API_KEY to your .env file.' : 'ArnAIv could not complete that response. Please try again.'; }
function createWindow(): void {
  const window = new BrowserWindow({ width: 1180, height: 760, minWidth: 860, minHeight: 560, webPreferences: { preload: path.join(__dirname, '../preload/preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  if (app.isPackaged) void window.loadFile(path.join(__dirname, '../../dist-renderer/index.html')); else void window.loadURL('http://127.0.0.1:5173');
}
function registerIpc(): void {
  ipcMain.handle('sessions:list', () => sessions.listSessions());
  ipcMain.handle('sessions:get', (_event, id: string) => sessions.getSession(id));
  ipcMain.handle('sessions:create', () => sessions.createSession());
  ipcMain.handle('sessions:delete', (_event, id: string) => sessions.deleteSession(id));
  ipcMain.handle('chat:send', (event, request: ChatSendRequest) => {
    if (isGenerating) throw new Error('A response is already being generated.');
    const content = request.content.trim(); if (!content) throw new Error('Please enter a message.');
    isGenerating = true;
    void (async () => {
      let assistantId = '';
      try {
        const session = await sessions.getSession(request.sessionId); if (!session) throw new Error('Conversation not found.');
        session.messages.push(sessions.createMessage('user', content)); await sessions.saveSession(session);
        const assistant = sessions.createMessage('assistant', ''); assistantId = assistant.id;
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); const service = new OpenAIService(client);
        await service.stream({ messages: session.messages, systemPrompt: DEFAULT_SYSTEM_PROMPT }, (chunk) => { assistant.content += chunk; event.sender.send('chat:chunk', { sessionId: session.id, messageId: assistant.id, content: chunk }); });
        session.messages.push(assistant); await sessions.saveSession(session); event.sender.send('chat:complete', { sessionId: session.id, messageId: assistant.id });
      } catch (error: unknown) { event.sender.send('chat:error', { sessionId: request.sessionId, messageId: assistantId, error: messageFor(error) }); }
      finally { isGenerating = false; }
    })();
  });
}
app.whenReady().then(() => { sessions = new SessionService(path.join(app.getPath('userData'), 'sessions')); registerIpc(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
