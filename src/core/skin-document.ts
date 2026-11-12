import { SKIN_SIZE, type SkinModel } from './skin-layout';

// what changed, so views can skip work that an edit cannot affect
export type DocumentChange = 'pixels' | 'model' | 'name';

// read-only view of the skin handed to tools, views and plugins
export interface ReadonlySkin {
  readonly pixels: Uint8Array;
  readonly pixels32: Uint32Array;
  readonly model: SkinModel;
  readonly name: string;
}

// single source of truth for the skin, its pixel buffer is the exported minecraft png
export class SkinDocument implements ReadonlySkin {
  readonly pixels = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  readonly pixels32 = new Uint32Array(this.pixels.buffer);
  model: SkinModel = 'classic';
  name = 'Untitled skin';
  private listeners = new Set<(change: DocumentChange) => void>();

  // lets views react to edits without the document knowing about them
  subscribe(listener: (change: DocumentChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // called by commands after mutating so every view refreshes from the same state
  notify(change: DocumentChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
