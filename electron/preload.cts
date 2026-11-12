import { contextBridge, ipcRenderer } from 'electron';

// narrow bridge exposed to the renderer, the only desktop capability the web code can reach
contextBridge.exposeInMainWorld('skinStudioDesktop', {
  openPng: () => ipcRenderer.invoke('skin:open'),
  savePng: (bytes: Uint8Array, suggestedName: string, token?: string) =>
    ipcRenderer.invoke('skin:save', bytes, suggestedName, token),
});
