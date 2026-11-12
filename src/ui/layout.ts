import type { DockviewApi } from 'dockview-react';
import { useUi, VIEW_LABELS, type ViewKind } from './store';

// one fixed settings panel the workspace knows how to create
export interface DockPanel {
  readonly id: string;
  readonly title: string;
}

// every settings panel of the workspace, also the order of the view menu
export const DOCK_PANELS: readonly DockPanel[] = [
  { id: 'tools', title: 'Tools' },
  { id: 'brush', title: 'Tool settings' },
  { id: 'parts', title: 'Body parts' },
  { id: 'color', title: 'Color' },
  { id: 'palette', title: 'Palette' },
  { id: 'plugins', title: 'Plugins' },
  { id: 'render', title: 'Render' },
];

// storage key for the arrangement the user last left the panels in
const LAYOUT_KEY = 'skin-studio.layout.v2';

// id prefix that tells view tabs apart from the fixed settings panels
const VIEW_PREFIX = 'view-';

// the live dock, set once the layout component is ready
let dock: DockviewApi | null = null;

// creation options of a settings panel
function panelOptions(id: string) {
  const panel = DOCK_PANELS.find((item) => item.id === id)!;
  return { id, title: panel.title, component: id };
}

// records the kind of a new view tab and returns its creation options, kept alive while hidden
function viewOptions(id: string, kind: ViewKind) {
  useUi.getState().setView(id, kind);
  return { id, title: VIEW_LABELS[kind], component: 'view', renderer: 'always' as const };
}

// widths of the side columns in a fresh layout, the two views share what is left
const SIDE_WIDTHS = { left: 276, right: 292 };

// arranges the panels like the reference design: tools left, two views in the middle, color right
function buildDefaultLayout(api: DockviewApi): void {
  const place = (id: string, referencePanel: string, direction: 'left' | 'right' | 'below' | 'within') =>
    api.addPanel({ ...panelOptions(id), position: { referencePanel, direction } });
  api.addPanel(viewOptions('view-1', '3d'));
  api.addPanel({
    ...panelOptions('tools'),
    position: { referencePanel: 'view-1', direction: 'left' },
    initialWidth: SIDE_WIDTHS.left,
  });
  place('brush', 'tools', 'below');
  place('parts', 'brush', 'below');
  api.addPanel({
    ...panelOptions('color'),
    position: { referencePanel: 'view-1', direction: 'right' },
    initialWidth: SIDE_WIDTHS.right,
  });
  place('palette', 'color', 'below');
  place('plugins', 'palette', 'below');
  place('render', 'plugins', 'within');
  api.addPanel({
    ...viewOptions('view-2', 'parts'),
    position: { referencePanel: 'view-1', direction: 'right' },
  });
  const pin = (id: string, minimumWidth: number, maximumWidth: number) =>
    api.getPanel(id)?.group.api.setConstraints({ minimumWidth, maximumWidth });
  pin('tools', SIDE_WIDTHS.left, SIDE_WIDTHS.left);
  pin('color', SIDE_WIDTHS.right, SIDE_WIDTHS.right);
  api.getPanel('view-2')?.api.setSize({ width: (api.width - SIDE_WIDTHS.left - SIDE_WIDTHS.right) / 2 });
  pin('tools', 180, Number.MAX_SAFE_INTEGER);
  pin('color', 180, Number.MAX_SAFE_INTEGER);
  api.getPanel('tools')?.api.setSize({ height: 148 });
  api.getPanel('brush')?.api.setSize({ height: 224 });
  api.getPanel('color')?.api.setSize({ height: 232 });
  api.getPanel('palette')?.api.setSize({ height: 176 });
  api.getPanel('plugins')?.api.setActive();
  api.getPanel('view-1')?.api.setActive();
}

// mirrors which panels and view tabs exist into the ui store and keeps the active view valid
function syncOpenPanels(api: DockviewApi): void {
  const openPanels = api.panels.map((panel) => panel.id);
  const viewIds = openPanels.filter((id) => id.startsWith(VIEW_PREFIX));
  const { views, activeView, set } = useUi.getState();
  set({
    openPanels,
    views: Object.fromEntries(viewIds.map((id) => [id, views[id] ?? '3d'])),
    activeView: activeView && viewIds.includes(activeView) ? activeView : (viewIds[0] ?? null),
  });
}

// connects the dock to persistence and the store, restoring the saved layout when there is one
export function attachDock(api: DockviewApi): void {
  dock = api;
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
  api.onDidAddPanel(() => syncOpenPanels(api));
  api.onDidRemovePanel(() => syncOpenPanels(api));
  api.onDidLayoutChange(() => localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON())));
}

// brings a panel or view tab to the front, recreating a settings panel the user closed earlier
export function showPanel(id: string): void {
  if (!dock) return;
  const existing = dock.getPanel(id);
  if (existing) existing.api.setActive();
  else if (!id.startsWith(VIEW_PREFIX)) {
    dock.addPanel({ ...panelOptions(id), floating: { width: 300, height: 380 } });
  }
}

// opens a new view tab of the given kind in a dock group, by default next to the active view
export function addView(kind: ViewKind, groupId?: string): void {
  if (!dock) return;
  const ui = useUi.getState();
  if (ui.webglError && (kind === '3d' || kind === 'render')) {
    ui.notify('error', 'This view needs WebGL, which is unavailable here.');
    return;
  }
  let index = 1;
  while (dock.getPanel(`${VIEW_PREFIX}${index}`)) index++;
  const referenceGroup = groupId ?? (ui.activeView ? dock.getPanel(ui.activeView)?.group.id : undefined);
  dock.addPanel({
    ...viewOptions(`${VIEW_PREFIX}${index}`, kind),
    ...(referenceGroup ? { position: { referenceGroup } } : {}),
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
