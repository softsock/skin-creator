import { packRgba, unpackRgba } from '../core/color';
import type { Editor } from '../core/editor';
import { getSkinFaces, SKIN_SIZE } from '../core/skin-layout';
import type { Tool } from '../editor/tool';
import type { LightingPreset } from '../renderer/lighting';
import {
  PLUGIN_API_VERSION,
  type ActionDefinition,
  type Disposable,
  type PanelDefinition,
  type Permission,
  type Plugin,
  type PluginApi,
  type PluginManifest,
} from './api';
import { Registry } from './registry';

// application services plugins are allowed to extend
export interface ExtensionPoints {
  readonly editor: Editor;
  readonly tools: Registry<Tool>;
  readonly panels: Registry<PanelDefinition>;
  readonly actions: Registry<ActionDefinition>;
  readonly presets: Registry<LightingPreset>;
}

// installed plugin with its enabled flag, listed in the extensions panel
export interface PluginState {
  readonly id: string;
  readonly manifest: PluginManifest;
  readonly enabled: boolean;
}

// installs plugins, hands each a permission-gated api and tears everything down on disable
export class ExtensionHost {
  private plugins = new Map<string, { plugin: Plugin; disposers: Disposable[] | null }>();
  private states = new Registry<PluginState>();

  constructor(private readonly points: ExtensionPoints) {}

  // observable list of plugins for the ui
  list = this.states.list;

  // change notifications for the plugin list
  subscribe = this.states.subscribe;

  // registers a plugin and activates it, rejecting incompatible api versions
  install(plugin: Plugin): void {
    const { id, apiVersion } = plugin.manifest;
    if (apiVersion !== PLUGIN_API_VERSION) {
      throw new Error(`Plugin "${id}" targets API v${apiVersion}, host provides v${PLUGIN_API_VERSION}`);
    }
    if (this.plugins.has(id)) throw new Error(`Plugin "${id}" is already installed`);
    this.plugins.set(id, { plugin, disposers: null });
    this.enable(id);
  }

  // activates an installed plugin
  enable(id: string): void {
    const entry = this.plugins.get(id);
    if (!entry || entry.disposers) return;
    const disposers: Disposable[] = [];
    entry.disposers = disposers;
    try {
      const cleanup = entry.plugin.activate(this.createApi(entry.plugin.manifest, disposers));
      if (cleanup) disposers.push(cleanup);
    } catch (error) {
      this.disable(id);
      throw error;
    }
    this.publish(id, true);
  }

  // removes everything the plugin registered, leaving the editor as if it never ran
  disable(id: string): void {
    const entry = this.plugins.get(id);
    if (!entry?.disposers) return;
    for (const dispose of entry.disposers.reverse()) dispose();
    entry.disposers = null;
    this.publish(id, false);
  }

  // replaces the public state record so subscribers see a fresh snapshot
  private publish(id: string, enabled: boolean): void {
    const manifest = this.plugins.get(id)!.plugin.manifest;
    const previous = this.states.get(id);
    if (previous) {
      this.states.replace({ id, manifest, enabled });
    } else {
      this.states.register({ id, manifest, enabled });
    }
  }

  // builds the api object for one plugin, checking declared permissions on every call
  private createApi(manifest: PluginManifest, disposers: Disposable[]): PluginApi {
    const { editor, tools, panels, actions, presets } = this.points;
    const need = (permission: Permission) => {
      if (!manifest.permissions.includes(permission)) {
        throw new Error(`Plugin "${manifest.id}" lacks the "${permission}" permission`);
      }
    };
    const track = (dispose: Disposable): Disposable => {
      disposers.push(dispose);
      return dispose;
    };
    return {
      apiVersion: PLUGIN_API_VERSION,
      skin: {
        model: () => (need('skin:read'), editor.skin.model),
        faces: () => (need('skin:read'), getSkinFaces(editor.skin.model)),
        getPixel: (x, y) => (need('skin:read'), unpackRgba(editor.skin.pixels32[y * SKIN_SIZE + x] ?? 0)),
        onChange: (listener) => (need('skin:read'), track(editor.subscribe(listener))),
      },
      edit: {
        setPixels: (label, writes) => {
          need('skin:write');
          const changes: Array<readonly [number, number]> = [];
          for (const { x, y, color } of writes) {
            if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) continue;
            changes.push([y * SKIN_SIZE + x, packRgba(color)]);
          }
          editor.execute(editor.createPixelPatch(label, changes));
        },
      },
      tools: { register: (tool) => (need('tools'), track(tools.register(tool))) },
      panels: { register: (panel) => (need('panels'), track(panels.register(panel))) },
      actions: { register: (action) => (need('actions'), track(actions.register(action))) },
      studio: { registerPreset: (preset) => (need('studio'), track(presets.register(preset))) },
    };
  }
}
