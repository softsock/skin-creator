import type { Vec3 } from '../core/skin-layout';

// tone curve choices exposed to presets, linear keeps lit skin colors identical to the texture
export type ToneMappingId = 'none' | 'linear' | 'neutral' | 'aces' | 'agx';

// directional light described as data so presets stay serializable
export interface DirectionalSpec {
  readonly color: string;
  readonly intensity: number;
  readonly position: Vec3;
}

// complete description of a look, the unit that edit mode, studio presets and plugins share
export interface LightingPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly background: string;
  readonly ambient: number;
  readonly hemisphere: { readonly sky: string; readonly ground: string; readonly intensity: number };
  readonly key: DirectionalSpec;
  readonly fill: DirectionalSpec;
  readonly rim: DirectionalSpec;
  readonly environment: number;
  readonly exposure: number;
  readonly toneMapping: ToneMappingId;
  readonly shadow: number;
  readonly ao: number;
  readonly vignette: number;
}

// flat, shadowless and untonemapped look so painted colors match the picker while editing
export const EDITOR_LIGHTING: LightingPreset = {
  id: 'editor',
  label: 'Editor',
  description: 'Even lighting for accurate painting.',
  background: '#16171a',
  ambient: 1.9,
  hemisphere: { sky: '#ffffff', ground: '#ffffff', intensity: 0 },
  key: { color: '#ffffff', intensity: 1.25, position: [8, 10, 15] },
  fill: { color: '#ffffff', intensity: 1.25, position: [-8, 10, -15] },
  rim: { color: '#ffffff', intensity: 0, position: [0, 10, -10] },
  environment: 0,
  exposure: 1,
  toneMapping: 'none',
  shadow: 0,
  ao: 0,
  vignette: 0,
};

// built-in studio looks, registered at startup through the same registry plugins can extend
export const STUDIO_PRESETS: readonly LightingPreset[] = [
  {
    id: 'soft-studio',
    label: 'Soft studio',
    description: 'Large soft key with gentle fill on a graphite backdrop.',
    background: '#2b2d33',
    ambient: 0.2,
    hemisphere: { sky: '#ffffff', ground: '#6f7480', intensity: 0.8 },
    key: { color: '#fff4e6', intensity: 2.3, position: [14, 26, 22] },
    fill: { color: '#dfe9ff', intensity: 0.7, position: [-20, 8, 14] },
    rim: { color: '#ffffff', intensity: 1.5, position: [-10, 20, -24] },
    environment: 0.35,
    exposure: 1,
    toneMapping: 'linear',
    shadow: 0.5,
    ao: 1,
    vignette: 1,
  },
  {
    id: 'dramatic',
    label: 'Dramatic',
    description: 'Hard warm key and a cool rim against a dark stage.',
    background: '#0e0f12',
    ambient: 0.05,
    hemisphere: { sky: '#9db4ff', ground: '#20222a', intensity: 0.25 },
    key: { color: '#ffe2bf', intensity: 3.6, position: [20, 22, 10] },
    fill: { color: '#7f9cff', intensity: 0.25, position: [-18, 4, 16] },
    rim: { color: '#9fc0ff', intensity: 3, position: [-14, 16, -22] },
    environment: 0.12,
    exposure: 1.05,
    toneMapping: 'linear',
    shadow: 0.75,
    ao: 1,
    vignette: 1,
  },
  {
    id: 'daylight',
    label: 'Daylight',
    description: 'Bright sky light on a pale backdrop.',
    background: '#cfd6df',
    ambient: 0.35,
    hemisphere: { sky: '#dcebff', ground: '#b5a892', intensity: 1.4 },
    key: { color: '#fff3df', intensity: 2.4, position: [12, 30, 16] },
    fill: { color: '#e6efff', intensity: 0.5, position: [-18, 10, 12] },
    rim: { color: '#ffffff', intensity: 0.8, position: [-8, 18, -22] },
    environment: 0.3,
    exposure: 1,
    toneMapping: 'linear',
    shadow: 0.4,
    ao: 0.9,
    vignette: 0.6,
  },
];
