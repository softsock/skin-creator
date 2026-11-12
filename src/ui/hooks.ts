import { useSyncExternalStore } from 'react';
import { editor } from '../app/app';

// re-renders a component whenever the document or its history changes
export function useEditorRevision(): number {
  return useSyncExternalStore(editor.subscribe, () => editor.revision);
}

// subscribes a component to an observable list so plugin changes appear immediately
export function useRegistry<T>(source: {
  subscribe(listener: () => void): () => void;
  list(): readonly T[];
}): readonly T[] {
  return useSyncExternalStore(source.subscribe, source.list);
}
