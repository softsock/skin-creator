import { describe, expect, it } from 'vitest';
import { Editor } from '../core/editor';
import type { Tool } from '../editor/tool';
import type { LightingPreset } from '../renderer/lighting';
import type { ActionDefinition, PanelDefinition, Plugin } from './api';
import { shadingPlugin } from './builtin/shading';
import { ExtensionHost } from './host';
import { Registry } from './registry';

// creates a host with empty registries, mirroring the wiring in the application
function setup() {
  const points = {
    editor: new Editor(),
    tools: new Registry<Tool>(),
    panels: new Registry<PanelDefinition>(),
    actions: new Registry<ActionDefinition>(),
    presets: new Registry<LightingPreset>(),
  };
  return { ...points, host: new ExtensionHost(points) };
}

// minimal plugin used to probe permissions and lifecycle
function plugin(overrides: Partial<Plugin['manifest']>, activate: Plugin['activate']): Plugin {
  return {
    manifest: {
      id: 'test',
      name: 'Test',
      version: '1',
      description: '',
      apiVersion: 1,
      permissions: [],
      ...overrides,
    },
    activate,
  };
}

describe('registry', () => {
  it('notifies, keeps a stable snapshot and rejects duplicate ids', () => {
    const registry = new Registry<{ id: string }>();
    let calls = 0;
    registry.subscribe(() => calls++);
    const dispose = registry.register({ id: 'a' });
    const snapshot = registry.list();
    expect(registry.list()).toBe(snapshot);
    expect(() => registry.register({ id: 'a' })).toThrow();
    dispose();
    expect(registry.list()).toEqual([]);
    expect(calls).toBe(2);
  });
});

describe('extension host', () => {
  it('activates the shading plugin and removes everything when it is disabled', () => {
    const { host, tools, panels, actions } = setup();
    host.install(shadingPlugin);
    expect(tools.list().map((tool) => tool.id)).toEqual(['shading.lighten', 'shading.darken']);
    expect(panels.list()).toHaveLength(1);
    expect(actions.get('shading.noise')).toBeDefined();
    expect(host.list()[0]).toMatchObject({ id: 'builtin.shading', enabled: true });
    host.disable('builtin.shading');
    expect([tools.list().length, panels.list().length, actions.list().length]).toEqual([0, 0, 0]);
    expect(host.list()[0]!.enabled).toBe(false);
    host.enable('builtin.shading');
    expect(tools.list()).toHaveLength(2);
  });

  it('rejects plugins built for another api version', () => {
    const { host } = setup();
    expect(() => host.install(plugin({ apiVersion: 2 }, () => {}))).toThrow(/API v2/);
  });

  it('enforces declared permissions and rolls back a failed activation', () => {
    const { host, tools, editor } = setup();
    const tool: Tool = { id: 't', label: 'T', icon: 'box', onStrokeStart: () => {} };
    expect(() =>
      host.install(
        plugin({ id: 'greedy', permissions: ['tools'] }, (api) => {
          api.tools.register(tool);
          api.edit.setPixels('Hack', [{ x: 0, y: 0, color: [1, 1, 1, 255] }]);
        }),
      ),
    ).toThrow(/skin:write/);
    expect(tools.list()).toEqual([]);
    expect(editor.canUndo).toBe(false);
  });

  it('routes plugin edits through undoable commands', () => {
    const { host, editor } = setup();
    host.install(
      plugin({ permissions: ['skin:read', 'skin:write'] }, (api) => {
        api.edit.setPixels('Dot', [
          { x: 3, y: 2, color: [9, 8, 7, 255] },
          { x: 999, y: 0, color: [1, 1, 1, 255] },
        ]);
        expect(api.skin.getPixel(3, 2)).toEqual([9, 8, 7, 255]);
      }),
    );
    expect(editor.undoLabel).toBe('Dot');
    editor.undo();
    expect(editor.skin.pixels.every((value) => value === 0)).toBe(true);
  });
});
