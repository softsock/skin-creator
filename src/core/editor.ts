import { PixelPatchCommand, type Command, type PixelChange } from './commands';
import { SkinDocument, type DocumentChange, type ReadonlySkin } from './skin-document';
import type { SkinModel } from './skin-layout';

// upper bound on undo steps so long sessions cannot grow memory without limit
const HISTORY_LIMIT = 300;

// owns the document and its history, the single entry point for every mutation
export class Editor {
  private readonly doc = new SkinDocument();
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private savedAt: Command | null = null;
  private listeners = new Set<() => void>();
  private rev = 0;

  constructor(initial?: { pixels: Uint8Array; model: SkinModel; name: string }) {
    if (!initial) return;
    this.doc.pixels.set(initial.pixels);
    this.doc.model = initial.model;
    this.doc.name = initial.name;
  }

  // read-only access for views, tools and plugins
  get skin(): ReadonlySkin {
    return this.doc;
  }

  // monotonically increasing counter that react uses as an external store snapshot
  get revision(): number {
    return this.rev;
  }

  // whether there is an edit to step back to
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // whether an undone edit can be reapplied
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // whether the skin differs from what was last saved or opened
  get isDirty(): boolean {
    return (this.undoStack.at(-1) ?? null) !== this.savedAt;
  }

  // label of the next undo step for menus and tooltips
  get undoLabel(): string | undefined {
    return this.undoStack.at(-1)?.label;
  }

  // label of the next redo step for menus and tooltips
  get redoLabel(): string | undefined {
    return this.redoStack.at(-1)?.label;
  }

  // applies a command and records it, merging consecutive commands of the same stroke
  execute(command: Command | null): boolean {
    if (!command) return false;
    command.apply(this.doc);
    const top = this.undoStack.at(-1);
    const merged =
      command.mergeKey !== undefined &&
      top?.mergeKey === command.mergeKey &&
      top !== this.savedAt &&
      top.merge?.(command) === true;
    if (!merged) {
      this.undoStack.push(command);
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    }
    this.redoStack = [];
    this.changed();
    return true;
  }

  // builds a pixel patch against the live document for tools, plugins and future ai edits
  createPixelPatch(label: string, changes: Iterable<PixelChange>, mergeKey?: string): Command | null {
    return PixelPatchCommand.create(this.doc, label, changes, mergeKey);
  }

  // reverts the most recent command
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.revert(this.doc);
    this.redoStack.push(command);
    this.changed();
    return true;
  }

  // reapplies the most recently undone command
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    command.apply(this.doc);
    this.undoStack.push(command);
    this.changed();
    return true;
  }

  // marks the current state as persisted so the unsaved indicator clears
  markSaved(): void {
    this.savedAt = this.undoStack.at(-1) ?? null;
    this.changed();
  }

  // notifies about any document or history change, an arrow so it can be passed to react directly
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // forwards raw document change kinds to renderers that need to know what changed
  subscribeDocument(listener: (change: DocumentChange) => void): () => void {
    return this.doc.subscribe(listener);
  }

  // bumps the revision and wakes subscribers after any state transition
  private changed(): void {
    this.rev++;
    for (const listener of this.listeners) listener();
  }
}
