// observable id-keyed collection backing every extension point of the application
export class Registry<T extends { readonly id: string }> {
  private items = new Map<string, T>();
  private snapshot: readonly T[] = [];
  private listeners = new Set<() => void>();

  // adds an item and returns a disposer so plugins can be cleanly disabled
  register(item: T): () => void {
    if (this.items.has(item.id)) throw new Error(`"${item.id}" is already registered`);
    this.items.set(item.id, item);
    this.changed();
    return () => {
      if (this.items.get(item.id) !== item) return;
      this.items.delete(item.id);
      this.changed();
    };
  }

  // swaps an existing item in place so its position in the list stays stable
  replace(item: T): void {
    if (!this.items.has(item.id)) throw new Error(`"${item.id}" is not registered`);
    this.items.set(item.id, item);
    this.changed();
  }

  // looks up one item by id
  get(id: string): T | undefined {
    return this.items.get(id);
  }

  // stable array snapshot in registration order, safe for react external stores
  list = (): readonly T[] => this.snapshot;

  // notifies when items are added or removed
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // refreshes the snapshot and wakes subscribers
  private changed(): void {
    this.snapshot = [...this.items.values()];
    for (const listener of this.listeners) listener();
  }
}
