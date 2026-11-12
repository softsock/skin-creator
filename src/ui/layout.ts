import type { DockviewApi } from 'dockview-react';
import { useUi, type SlotId } from './store';

// one dockable panel the workspace knows how to create
export interface DockPanel {
  readonly id: string;
  readonly title: string;
  readonly slot?: SlotId;
}

// every panel of the workspace, also the order of the view menu
export const DOCK_PANELS: readonly DockPanel[] = [
  { id: 'view-a', title: 'View 1', slot: 'a' },
  { id: 'view-b', title: 'View 2', slot: 'b' },
  { id: 'tools', title: 'Tools' },
  { id: 'brush', title: 'Tool settings' },
  { id: 'parts', title: 'Body parts' },
  { id: 'color', title: 'Color' },
  { id: 'palette', title: 'Palette' },
  { id: 'plugins', title: 'Plugins' },
  { id: 'render', title: 'Render' },
];

// storage key for the arrangement the user last left the panels in
const LAYOUT_KEY = 'skin-studio.layout.v1';

// the live dock, set once the layout component is ready
let dock: DockviewApi | null = null;

// creation options shared by every way a panel gets added
function panelOptions(id: string) {
  const panel = DOCK_PANELS.find((item) => item.id === id)!;
  return panel.slot
    ? { id, title: panel.title, component: 'view', params: { slot: panel.slot }, renderer: 'always' as const }
    : { id, title: panel.title, component: id };
}

// widths of the side columns in a fresh layout, the two views share what is left
const SIDE_WIDTHS = { left: 276, right: 292 };

// arranges the panels like the reference design: tools left, two views in the middle, color right
function buildDefaultLayout(api: DockviewApi): void {
  const place = (id: string, referencePanel: string, direction: 'left' | 'right' | 'below' | 'within') =>
    api.addPanel({ ...panelOptions(id), position: { referencePanel, direction } });
  api.addPanel(panelOptions('view-a'));
  api.addPanel({
    ...panelOptions('tools'),
    position: { referencePanel: 'view-a', direction: 'left' },
    initialWidth: SIDE_WIDTHS.left,
  });
  place('brush', 'tools', 'below');
  place('parts', 'brush', 'below');
  api.addPanel({
    ...panelOptions('color'),
    position: { referencePanel: 'view-a', direction: 'right' },
    initialWidth: SIDE_WIDTHS.right,
  });
  place('palette', 'color', 'below');
  place('plugins', 'palette', 'below');
  place('render', 'plugins', 'within');
  place('view-b', 'view-a', 'right');
  const pin = (id: string, minimumWidth: number, maximumWidth: number) =>
    api.getPanel(id)?.group.api.setConstraints({ minimumWidth, maximumWidth });
  pin('tools', SIDE_WIDTHS.left, SIDE_WIDTHS.left);
  pin('color', SIDE_WIDTHS.right, SIDE_WIDTHS.right);
  api.getPanel('view-b')?.api.setSize({ width: (api.width - SIDE_WIDTHS.left - SIDE_WIDTHS.right) / 2 });
  pin('tools', 180, Number.MAX_SAFE_INTEGER);
  pin('color', 180, Number.MAX_SAFE_INTEGER);
  api.getPanel('tools')?.api.setSize({ height: 148 });
  api.getPanel('brush')?.api.setSize({ height: 224 });
  api.getPanel('color')?.api.setSize({ height: 232 });
  api.getPanel('palette')?.api.setSize({ height: 176 });
  api.getPanel('plugins')?.api.setActive();
  api.getPanel('view-a')?.api.setActive();
}

// mirrors which panels exist into the ui store and keeps the active view area valid
function syncOpenPanels(api: DockviewApi): void {
  const openPanels = api.panels.map((panel) => panel.id);
  const { activeSlot, set } = useUi.getState();
  const other: SlotId = activeSlot === 'a' ? 'b' : 'a';
  const fallback = !openPanels.includes(`view-${activeSlot}`) && openPanels.includes(`view-${other}`);
  set({ openPanels, ...(fallback ? { activeSlot: other } : {}) });
}

// connects the dock to persistence and the store, restoring the saved layout when there is one
export function attachDock(api: DockviewApi): void {
  dock = api;
  api.onDidAddPanel(() => syncOpenPanels(api));
  api.onDidRemovePanel(() => syncOpenPanels(api));
  let restored = false;
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved) {
      api.fromJSON(JSON.parse(saved));
      restored = api.panels.length > 0;
    }
  } catch (error) {
    console.warn('Saved layout could not be restored', error);
    api.clear();
  }
  if (!restored) buildDefaultLayout(api);
  syncOpenPanels(api);
  api.onDidLayoutChange(() => localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON())));
}

// brings a panel to the front, recreating it when the user closed it earlier
export function showPanel(id: string): void {
  if (!dock) return;
  const existing = dock.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const options = panelOptions(id);
  if (!('params' in options)) {
    dock.addPanel({ ...options, floating: { width: 300, height: 380 } });
    return;
  }
  const sibling = dock.getPanel(id === 'view-a' ? 'view-b' : 'view-a');
  dock.addPanel({
    ...options,
    position: sibling
      ? { referencePanel: sibling.id, direction: id === 'view-a' ? 'left' : 'right' }
      : { direction: 'left' },
  });
}

// closes an open panel or reopens a closed one, used by the view menu
export function togglePanel(id: string): void {
  const existing = dock?.getPanel(id);
  if (existing) existing.api.close();
  else showPanel(id);
}

// discards the current arrangement and rebuilds the default one
export function resetLayout(): void {
  if (!dock) return;
  dock.clear();
  buildDefaultLayout(dock);
  syncOpenPanels(dock);
}
