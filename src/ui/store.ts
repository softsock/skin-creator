import { create } from 'zustand';
import type { Rgba } from '../core/color';
import type { LayerId, PartId } from '../core/skin-layout';
import type { PaintTargetMode } from '../editor/paint-target';
import type { FileRef } from '../platform/platform';
import { allVisible, type Visibility } from '../renderer/skin-object';

// top level modes of the application shown as tabs in the top bar
export type Workspace = 'edit' | 'studio' | 'browser';

// how the edit workspace splits between the 3d model and the flat texture
export type ViewMode = '3d' | 'split' | '2d';

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
  workspace: Workspace;
  viewMode: ViewMode;
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
  setStudio(patch: Partial<StudioSettings>): void;
  toggleVisibility(part: PartId, layer: LayerId): void;
  setLayerVisibility(layer: LayerId, visible: boolean): void;
  rememberColor(color: Rgba): void;
  notify(kind: Notice['kind'], text: string): void;
}

// counter for notice ids so repeated identical messages still re-trigger the toast
let noticeId = 0;

// single zustand store for ui state, read by components and by the tool environment
export const useUi = create<UiState>((set) => ({
  workspace: 'edit',
  viewMode: '3d',
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
