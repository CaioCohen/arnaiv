import { contextBridge, ipcRenderer } from 'electron';
import type { ArnAIvApi, ChatSendRequest, StreamEvent } from '../shared/types.js';

function listen(
  channel: 'chat:chunk' | 'chat:complete' | 'chat:error',
  callback: (event: StreamEvent) => void,
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: StreamEvent): void => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: ArnAIvApi = {
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    get: (id) => ipcRenderer.invoke('sessions:get', id),
    create: () => ipcRenderer.invoke('sessions:create'),
    delete: (id) => ipcRenderer.invoke('sessions:delete', id),
  },
  chat: {
    send: (request: ChatSendRequest) => ipcRenderer.invoke('chat:send', request),
    onChunk: (callback) => listen('chat:chunk', callback),
    onComplete: (callback) => listen('chat:complete', callback),
    onError: (callback) => listen('chat:error', callback),
  },
};
contextBridge.exposeInMainWorld('arnAIv', api);
