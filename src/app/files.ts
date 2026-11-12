import { ReplaceSkinCommand } from '../core/commands';
import { createDefaultSkin } from '../core/default-skin';
import { decodeSkinPng, encodeSkinPng, inferSkinModel, SkinFormatError } from '../core/png';
import { SKIN_SIZE, type SkinModel } from '../core/skin-layout';
import type { FileRef } from '../platform/platform';
import { useUi } from '../ui/store';
import { editor, platform, viewportRef } from './app';

// turns the project name into a safe file name for downloads and save dialogs
function fileName(suffix = ''): string {
  const base = editor.skin.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'skin';
  return `${base}${suffix}.png`;
}

// reports failures to the user instead of leaving a silently broken state
function report(error: unknown): void {
  const text = error instanceof SkinFormatError ? error.message : `Something went wrong: ${String(error)}`;
  if (!(error instanceof SkinFormatError)) console.error(error);
  useUi.getState().notify('error', text);
}

// starts a new skin from the starter character or from an empty texture
export function newSkin(template: 'starter' | 'blank', model: SkinModel = 'classic'): void {
  const pixels =
    template === 'starter' ? createDefaultSkin(model) : new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  editor.execute(new ReplaceSkinCommand('New skin', { pixels, model, name: 'Untitled skin' }));
  editor.markSaved();
  useUi.getState().set({ fileRef: null });
}

// loads png bytes into the document as one undoable step, used by open and drag and drop
export function importSkin(name: string, bytes: Uint8Array, ref?: FileRef): void {
  try {
    const pixels = decodeSkinPng(bytes);
    editor.execute(
      new ReplaceSkinCommand('Import skin', {
        pixels,
        model: inferSkinModel(pixels),
        name: name.replace(/\.png$/i, '') || 'Imported skin',
      }),
    );
    editor.markSaved();
    useUi.getState().set({ fileRef: ref ?? null });
    useUi.getState().notify('info', `Imported ${name}`);
  } catch (error) {
    report(error);
  }
}

// asks the platform for a png and imports it
export async function openSkin(): Promise<void> {
  try {
    const file = await platform.openPng();
    if (file) importSkin(file.name, file.bytes, file.ref);
  } catch (error) {
    report(error);
  }
}

// writes the skin png, overwriting the opened file on desktop or downloading on the web
export async function saveSkin(saveAs = false): Promise<void> {
  try {
    const ref = await platform.savePng(
      encodeSkinPng(editor.skin.pixels),
      fileName(),
      saveAs ? undefined : (useUi.getState().fileRef ?? undefined),
    );
    if (!ref) return;
    editor.markSaved();
    useUi.getState().set({ fileRef: ref });
    useUi.getState().notify('info', `Saved ${ref.name}`);
  } catch (error) {
    report(error);
  }
}

// renders the studio view to a png at the chosen export scale
export async function exportRender(): Promise<void> {
  const viewport = viewportRef.current;
  if (!viewport) {
    useUi.getState().notify('error', 'Studio render needs WebGL, which is unavailable here.');
    return;
  }
  try {
    const blob = await viewport.exportPng(useUi.getState().studio.exportScale);
    const ref = await platform.savePng(new Uint8Array(await blob.arrayBuffer()), fileName(' render'));
    if (ref) useUi.getState().notify('info', `Exported ${ref.name}`);
  } catch (error) {
    report(error);
  }
}
