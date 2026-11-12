import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// a download captured in the integrated browser, without bytes when it was refused
interface BrowserDownload {
  name: string;
  bytes: Uint8Array | null;
}

// narrow bridge exposed to the renderer, the only desktop capability the web code can reach
contextBridge.exposeInMainWorld('skinStudioDesktop', {
  openPng: () => ipcRenderer.invoke('skin:open'),
  savePng: (bytes: Uint8Array, suggestedName: string, token?: string) =>
    ipcRenderer.invoke('skin:save', bytes, suggestedName, token),
  onBrowserDownload: (listener: (download: BrowserDownload) => void) => {
    const handler = (_event: IpcRendererEvent, download: BrowserDownload) => listener(download);
    ipcRenderer.on('browser:download', handler);
    return () => {
      ipcRenderer.removeListener('browser:download', handler);
    };
  },
});
