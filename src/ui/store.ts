import { create } from 'zustand';
import type { Rgba } from '../core/color';
import type { LayerId, PartId } from '../core/skin-layout';
import type { PaintTargetMode } from '../editor/paint-target';
import type { FileRef } from '../platform/platform';
import { allVisible, type Visibility } from '../renderer/skin-object';

// content a view tab can show, chosen when the tab is opened
export type ViewKind = '3d' | '2d' | 'parts' | 'render' | 'browser' | 'namemc';

// every view kind a saved session may contain
export const VIEW_KINDS: readonly ViewKind[] = ['3d', '2d', 'parts', 'render', 'browser', 'namemc'];

// view kinds offered by the new tab menu, namemc stays implemented but is not offered yet
export const NEW_VIEW_KINDS: readonly ViewKind[] = ['2d', 'parts', '3d', 'render', 'browser'];

// captions for view kinds, shared by the new tab menu and the dock tabs
export const VIEW_LABELS: Record<ViewKind, string> = {
  '3d': '3D Preview',
  '2d': '2D',
  parts: '2D Parts',
  render: '3D Render',
  browser: 'Browser',
  namemc: 'NameMC',
};

// pixel currently under the pointer, shared so both views and the status bar stay in sync
export interface HoverPixel {
  readonly x: number;
  readonly y: number;
  readonly faceIndex: number;
}

// user adjustable studio render options layered on top of the selected lighting preset
export interface StudioSettings {
  readonly presetId: string;
  readonly background: string | null;
  readonly transparent: boolean;
  readonly ambientOcclusion: boolean;
  readonly shadows: boolean;
  readonly fov: number;
  readonly exportScale: number;
}

// transient message shown at the bottom of the workspace
export interface Notice {
  readonly id: number;
  readonly kind: 'info' | 'error';
  readonly text: string;
}

// interface state only, the skin itself lives in the editor core
interface UiState {
  views: Readonly<Record<string, ViewKind>>;
  activeView: string | null;
  openPanels: readonly string[];
  activeToolId: string;
  color: Rgba;
  recentColors: readonly Rgba[];
  brushSize: number;
  paintTarget: PaintTargetMode;
  visibility: Visibility;
  hover: HoverPixel | null;
  studio: StudioSettings;
  webglError: string | null;
  viewportSize: string;
  notice: Notice | null;
  fileRef: FileRef | null;
  set(patch: Partial<UiState>): void;
  setView(id: string, kind: ViewKind): void;
  setStudio(patch: Partial<StudioSettings>): void;
  toggleVisibility(part: PartId, layer: LayerId): void;
  setLayerVisibility(layer: LayerId, visible: boolean): void;
  rememberColor(color: Rgba): void;
  notify(kind: Notice['kind'], text: string): void;
}

// storage key for the kind of every view tab the user last had open
const VIEWS_KEY = 'skin-studio.views.v2';

// counter for notice ids so repeated identical messages still re-trigger the toast
let noticeId = 0;

// restores the kinds of the saved view tabs, dropping anything that is not a known kind
function loadViews(): Record<string, ViewKind> {
  const views: Record<string, ViewKind> = {};
  try {
    const saved = JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '{}') as Record<string, unknown>;
    for (const [id, value] of Object.entries(saved)) {
      const kind = VIEW_KINDS.find((item) => item === value);
      if (kind) views[id] = kind;
    }
  } catch {
    return {};
  }
  return views;
}

// single zustand store for ui state, read by components and by the tool environment
export const useUi = create<UiState>((set) => ({
  views: loadViews(),
  activeView: null,
  openPanels: [],
  activeToolId: 'pencil',
  color: [233, 84, 84, 255],
  recentColors: [],
  brushSize: 1,
  paintTarget: 'auto',
  visibility: allVisible(),
  hover: null,
  studio: {
    presetId: 'soft-studio',
    background: null,
    transparent: false,
    ambientOcclusion: true,
    shadows: true,
    fov: 28,
    exportScale: 2,
  },
  webglError: null,
  viewportSize: '',
  notice: null,
  fileRef: null,
  set: (patch) => set(patch),
  setView: (id, kind) => set((state) => ({ views: { ...state.views, [id]: kind }, hover: null })),
  setStudio: (patch) => set((state) => ({ studio: { ...state.studio, ...patch } })),
  toggleVisibility: (part, layer) =>
    set((state) => ({
      visibility: {
        ...state.visibility,
        [part]: { ...state.visibility[part], [layer]: !state.visibility[part][layer] },
      },
    })),
  setLayerVisibility: (layer, visible) =>
    set((state) => {
      const visibility = { ...state.visibility };
      for (const part of Object.keys(visibility) as PartId[])
        visibility[part] = { ...visibility[part], [layer]: visible };
      return { visibility };
    }),
  rememberColor: (color) =>
    set((state) => ({
      recentColors: [color, ...state.recentColors.filter((c) => c.join() !== color.join())].slice(0, 16),
    })),
  notify: (kind, text) => set({ notice: { id: ++noticeId, kind, text } }),
}));

useUi.subscribe((state, previous) => {
  if (state.views !== previous.views) localStorage.setItem(VIEWS_KEY, JSON.stringify(state.views));
});
