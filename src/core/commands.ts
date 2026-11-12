import type { SkinModel } from './skin-layout';
import type { SkinDocument } from './skin-document';

// the only way to change a document, which keeps every edit undoable and auditable
export interface Command {
  readonly label: string;
  readonly mergeKey?: string;
  apply(doc: SkinDocument): void;
  revert(doc: SkinDocument): void;
  merge?(next: Command): boolean;
}

// one pixel write expressed as a document pixel index and a packed color
export type PixelChange = readonly [index: number, color: number];

// sparse pixel diff used by all painting tools, mergeable so a drag is one undo step
export class PixelPatchCommand implements Command {
  private constructor(
    readonly label: string,
    readonly mergeKey: string | undefined,
    private before: Map<number, number>,
    private after: Map<number, number>,
  ) {}

  // builds a patch against the current document, dropping writes that change nothing
  static create(
    doc: SkinDocument,
    label: string,
    changes: Iterable<PixelChange>,
    mergeKey?: string,
  ): PixelPatchCommand | null {
    const before = new Map<number, number>();
    const after = new Map<number, number>();
    for (const [index, color] of changes) {
      if (index < 0 || index >= doc.pixels32.length) continue;
      const current = doc.pixels32[index]!;
      if (current === color >>> 0) {
        after.delete(index);
        before.delete(index);
        continue;
      }
      before.set(index, current);
      after.set(index, color >>> 0);
    }
    return after.size > 0 ? new PixelPatchCommand(label, mergeKey, before, after) : null;
  }

  // number of pixels touched, exposed for tests and status messages
  get size(): number {
    return this.after.size;
  }

  // writes the new colors into the document
  apply(doc: SkinDocument): void {
    for (const [index, color] of this.after) doc.pixels32[index] = color;
    doc.notify('pixels');
  }

  // restores the colors that were present before the patch
  revert(doc: SkinDocument): void {
    for (const [index, color] of this.before) doc.pixels32[index] = color;
    doc.notify('pixels');
  }

  // absorbs a later patch of the same stroke while keeping the original before colors
  merge(next: Command): boolean {
    if (!(next instanceof PixelPatchCommand)) return false;
    for (const [index, color] of next.after) {
      if (!this.before.has(index)) this.before.set(index, next.before.get(index)!);
      this.after.set(index, color);
    }
    return true;
  }
}

// switches arm geometry without touching pixels, undoable like any other edit
export class SetModelCommand implements Command {
  readonly label = 'Change model';
  private previous: SkinModel = 'classic';

  constructor(private readonly model: SkinModel) {}

  // applies the requested model and remembers the old one
  apply(doc: SkinDocument): void {
    this.previous = doc.model;
    doc.model = this.model;
    doc.notify('model');
  }

  // returns to the model that was active before
  revert(doc: SkinDocument): void {
    doc.model = this.previous;
    doc.notify('model');
  }
}

// replaces the whole skin for import and new file while staying undoable
export class ReplaceSkinCommand implements Command {
  private previous: { pixels: Uint8Array; model: SkinModel; name: string } | null = null;

  constructor(
    readonly label: string,
    private readonly next: { pixels: Uint8Array; model: SkinModel; name: string },
  ) {}

  // swaps in the new skin after snapshotting the current one
  apply(doc: SkinDocument): void {
    this.previous = { pixels: doc.pixels.slice(), model: doc.model, name: doc.name };
    this.write(doc, this.next);
  }

  // restores the snapshot taken when the command was applied
  revert(doc: SkinDocument): void {
    if (this.previous) this.write(doc, this.previous);
  }

  // shared writer so apply and revert cannot drift apart
  private write(doc: SkinDocument, state: { pixels: Uint8Array; model: SkinModel; name: string }) {
    doc.pixels.set(state.pixels);
    const modelChanged = doc.model !== state.model;
    doc.model = state.model;
    doc.name = state.name;
    if (modelChanged) doc.notify('model');
    doc.notify('pixels');
    doc.notify('name');
  }
}

// renames the project through the command pipeline so plugins and ai cannot bypass history
export class RenameCommand implements Command {
  readonly label = 'Rename';
  private previous = '';

  constructor(private readonly name: string) {}

  // sets the new name and remembers the old one
  apply(doc: SkinDocument): void {
    this.previous = doc.name;
    doc.name = this.name;
    doc.notify('name');
  }

  // restores the previous name
  revert(doc: SkinDocument): void {
    doc.name = this.previous;
    doc.notify('name');
  }
}
