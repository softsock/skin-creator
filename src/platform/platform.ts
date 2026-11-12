// opaque reference to a previously opened or saved file, used to overwrite it on save
export interface FileRef {
  readonly name: string;
  readonly token?: string;
}

// a png file chosen by the user together with the handle needed to save back to it
export interface OpenedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly ref?: FileRef;
}

// boundary between the editor and the host environment, keeping electron out of core code
export interface PlatformAdapter {
  readonly kind: 'web' | 'desktop';
  openPng(): Promise<OpenedFile | null>;
  savePng(bytes: Uint8Array, suggestedName: string, ref?: FileRef): Promise<FileRef | null>;
}

// bridge object the electron preload script exposes on window
export interface DesktopBridge {
  openPng(): Promise<{ name: string; bytes: Uint8Array; token: string } | null>;
  savePng(
    bytes: Uint8Array,
    suggestedName: string,
    token?: string,
  ): Promise<{ name: string; token: string } | null>;
}

declare global {
  // typed access to the optional preload bridge
  interface Window {
    skinStudioDesktop?: DesktopBridge;
  }
}

// browser implementation using a file input and downloads, which also works in cloud previews
const webPlatform: PlatformAdapter = {
  kind: 'web',
  openPng: () =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png';
      input.addEventListener('cancel', () => resolve(null));
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        resolve(file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
      });
      input.click();
    }),
  async savePng(bytes, suggestedName) {
    downloadBlob(new Blob([bytes.slice()], { type: 'image/png' }), suggestedName);
    return { name: suggestedName };
  },
};

// desktop implementation delegating to native dialogs through the preload bridge
function desktopPlatform(bridge: DesktopBridge): PlatformAdapter {
  return {
    kind: 'desktop',
    async openPng() {
      const file = await bridge.openPng();
      return file && { name: file.name, bytes: file.bytes, ref: { name: file.name, token: file.token } };
    },
    async savePng(bytes, suggestedName, ref) {
      return bridge.savePng(bytes, suggestedName, ref?.token);
    },
  };
}

// triggers a browser download, shared by skin export and studio render export
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// picks the adapter for the current host at startup
export function detectPlatform(): PlatformAdapter {
  return window.skinStudioDesktop ? desktopPlatform(window.skinStudioDesktop) : webPlatform;
}
