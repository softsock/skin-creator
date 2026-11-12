import { app, BrowserWindow, dialog, ipcMain, session, shell, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// dev server url injected by scripts/desktop-dev.mjs, absent when running a production build
const devUrl = process.env.SKIN_STUDIO_DEV_URL;

// production entry point of the renderer bundle
const indexFile = join(__dirname, '..', 'dist', 'index.html');

// file paths the user picked in a native dialog, the only paths the renderer may write to
const approvedPaths = new Map<string, string>();

// first bytes of every png, used to refuse writing anything else to disk
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// rejects ipc calls that do not originate from the application's own page
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? '';
  const trusted = devUrl ? url.startsWith(devUrl) : url.startsWith(pathToFileURL(indexFile).href);
  if (!trusted) throw new Error('Untrusted IPC sender');
}

// remembers a user-approved path and returns the opaque token the renderer may reuse
function approve(filePath: string): { name: string; token: string } {
  const token = randomUUID();
  approvedPaths.set(token, filePath);
  return { name: basename(filePath), token };
}

// creates the single application window with a locked down renderer
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#181a1f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.SKIN_STUDIO_SMOKE) {
    window.webContents.once('did-finish-load', async () => {
      const ready = await window.webContents.executeJavaScript(
        'new Promise((resolve) => setTimeout(() => resolve(Boolean(document.querySelector("[data-app-ready]")) && Boolean(window.skinStudioDesktop)), 1500))',
      );
      console.log(ready ? 'SMOKE_OK' : 'SMOKE_FAILED');
      app.exit(ready ? 0 : 1);
    });
  }
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(indexFile);
}

ipcMain.handle('skin:open', async (event) => {
  assertTrustedSender(event);
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Minecraft skin', extensions: ['png'] }],
  });
  const filePath = result.filePaths[0];
  if (result.canceled || !filePath) return null;
  return { ...approve(filePath), bytes: new Uint8Array(await readFile(filePath)) };
});

ipcMain.handle('skin:save', async (event, bytes: unknown, suggestedName: unknown, token: unknown) => {
  assertTrustedSender(event);
  if (!(bytes instanceof Uint8Array) || !PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
    throw new Error('Only PNG data can be saved');
  }
  let filePath = typeof token === 'string' ? approvedPaths.get(token) : undefined;
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      defaultPath: typeof suggestedName === 'string' ? basename(suggestedName) : 'skin.png',
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }
  await writeFile(filePath, bytes);
  return approve(filePath);
});

void app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
