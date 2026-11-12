import { createDefaultSkin } from '../core/default-skin';
import { Editor } from '../core/editor';
import { ToolController } from '../editor/tool-controller';
import type { Tool } from '../editor/tool';
import { builtinTools } from '../editor/tools/builtin';
import type { ActionDefinition, PanelDefinition } from '../extensions/api';
import { shadingPlugin } from '../extensions/builtin/shading';
import { ExtensionHost } from '../extensions/host';
import { Registry } from '../extensions/registry';
import { detectPlatform } from '../platform/platform';
import { STUDIO_PRESETS, type LightingPreset } from '../renderer/lighting';
import type { SkinViewport } from '../renderer/viewport';
import { useUi, type ViewKind } from '../ui/store';

// the one editor instance of the running application
export const editor = new Editor({
  pixels: createDefaultSkin('classic'),
  model: 'classic',
  name: 'Untitled skin',
});

// extension point for painting tools
export const tools = new Registry<Tool>();

// extension point for sidebar panels contributed by plugins
export const panels = new Registry<PanelDefinition>();

// extension point for named operations and their keyboard shortcuts
export const actions = new Registry<ActionDefinition>();

// extension point for studio lighting presets
export const presets = new Registry<LightingPreset>();

// plugin lifecycle manager wired to all extension points
export const extensions = new ExtensionHost({ editor, tools, panels, actions, presets });

// host environment adapter chosen once at startup
export const platform = detectPlatform();

// live 3d viewports by view tab id, registered by their components so actions can reach them
export const viewports = new Map<string, SkinViewport>();

// finds the viewport of a view tab showing one of the given kinds, the active tab first
export function viewportFor(kinds: readonly ViewKind[]): SkinViewport | null {
  const { views, activeView } = useUi.getState();
  const ids = Object.keys(views).sort((a, b) => Number(b === activeView) - Number(a === activeView));
  for (const id of ids) {
    const viewport = viewports.get(id);
    const kind = views[id];
    if (viewport && kind && kinds.includes(kind)) return viewport;
  }
  return null;
}

// routes pointer strokes from both views to the active tool using current ui state
export const toolController = new ToolController(editor, {
  activeTool: () => tools.get(useUi.getState().activeToolId),
  color: () => useUi.getState().color,
  brushSize: () => useUi.getState().brushSize,
  setColor: (color) => useUi.getState().set({ color }),
  colorUsed: (color) => useUi.getState().rememberColor(color),
});

for (const tool of builtinTools) tools.register(tool);
for (const preset of STUDIO_PRESETS) presets.register(preset);
extensions.install(shadingPlugin);

tools.subscribe(() => {
  if (!tools.get(useUi.getState().activeToolId)) useUi.getState().set({ activeToolId: 'pencil' });
});
