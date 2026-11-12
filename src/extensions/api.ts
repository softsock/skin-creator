import type { Rgba } from '../core/color';
import type { SkinFace, SkinModel } from '../core/skin-layout';
import type { Tool } from '../editor/tool';
import type { LightingPreset } from '../renderer/lighting';

// version of the plugin contract, bumped on breaking changes so old plugins are rejected
export const PLUGIN_API_VERSION = 1;

// capabilities a plugin must declare before the matching api facet is usable
export type Permission = 'skin:read' | 'skin:write' | 'tools' | 'panels' | 'actions' | 'studio';

// static plugin description, plain data so it can later be read without running plugin code
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly apiVersion: number;
  readonly permissions: readonly Permission[];
}

// handle returned by every registration so it can be undone
export type Disposable = () => void;

// declarative slider control rendered by the host inside a plugin panel
export interface SliderField {
  readonly type: 'slider';
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit?: string;
  get(): number;
  set(value: number): void;
}

// declarative button control rendered by the host inside a plugin panel
export interface ButtonField {
  readonly type: 'button';
  readonly id: string;
  readonly label: string;
  run(): void;
}

// controls a plugin panel may contain, kept declarative so panels never ship their own ui code
export type PanelField = SliderField | ButtonField;

// sidebar panel contributed by a plugin
export interface PanelDefinition {
  readonly id: string;
  readonly title: string;
  readonly fields: readonly PanelField[];
}

// named operation with an optional shortcut, shared by the app itself and plugins
export interface ActionDefinition {
  readonly id: string;
  readonly title: string;
  readonly shortcut?: string;
  run(): void;
}

// one pixel write addressed in texture coordinates for plugin authors
export interface PluginPixelWrite {
  readonly x: number;
  readonly y: number;
  readonly color: Rgba;
}

// the complete surface a plugin can reach, every facet is permission checked by the host
export interface PluginApi {
  readonly apiVersion: number;
  readonly skin: {
    model(): SkinModel;
    faces(): readonly SkinFace[];
    getPixel(x: number, y: number): Rgba;
    onChange(listener: () => void): Disposable;
  };
  readonly edit: {
    setPixels(label: string, writes: Iterable<PluginPixelWrite>): void;
  };
  readonly tools: { register(tool: Tool): Disposable };
  readonly panels: { register(panel: PanelDefinition): Disposable };
  readonly actions: { register(action: ActionDefinition): Disposable };
  readonly studio: { registerPreset(preset: LightingPreset): Disposable };
}

// a plugin is a manifest plus an activation function that may return its own cleanup
export interface Plugin {
  readonly manifest: PluginManifest;
  activate(api: PluginApi): Disposable | void;
}
