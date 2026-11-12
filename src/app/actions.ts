import { useUi, type ViewKind } from '../ui/store';
import { actions, editor, viewportFor } from './app';
import { exportRender, newSkin, openSkin, saveSkin } from './files';
import { toggleRenderMode } from './views';

// shows a view kind in the active view area, refusing 3d kinds when webgl is unavailable
export function setActiveView(kind: ViewKind): void {
  const ui = useUi.getState();
  if (ui.webglError && (kind === '3d' || kind === 'render')) {
    ui.notify('error', 'This view needs WebGL, which is unavailable here.');
    return;
  }
  ui.setView(ui.activeSlot, kind);
}

// registers the application's own operations through the same registry plugins use
export function registerAppActions(): void {
  const list = [
    { id: 'file.new', title: 'New skin', run: () => newSkin('starter') },
    { id: 'file.open', title: 'Open PNG…', shortcut: 'Mod+O', run: () => void openSkin() },
    { id: 'file.save', title: 'Save', shortcut: 'Mod+S', run: () => void saveSkin() },
    { id: 'file.export', title: 'Export skin PNG…', shortcut: 'Mod+Shift+S', run: () => void saveSkin(true) },
    { id: 'edit.undo', title: 'Undo', shortcut: 'Mod+Z', run: () => void editor.undo() },
    { id: 'edit.redo', title: 'Redo', shortcut: 'Mod+Shift+Z', run: () => void editor.redo() },
    { id: 'edit.redo.alt', title: 'Redo', shortcut: 'Mod+Y', run: () => void editor.redo() },
    { id: 'view.render', title: 'Toggle render mode', shortcut: 'F9', run: toggleRenderMode },
    { id: 'view.3d', title: '3D view', shortcut: '1', run: () => setActiveView('3d') },
    { id: 'view.2d', title: '2D texture view', shortcut: '2', run: () => setActiveView('2d') },
    { id: 'view.parts', title: '2D parts view', shortcut: '3', run: () => setActiveView('parts') },
    { id: 'view.render.kind', title: '3D render view', shortcut: '4', run: () => setActiveView('render') },
    {
      id: 'view.reset',
      title: 'Reset camera',
      shortcut: '0',
      run: () => viewportFor(['3d', 'render'])?.resetCamera(),
    },
    {
      id: 'studio.export',
      title: 'Export studio render…',
      shortcut: 'Mod+E',
      run: () => void exportRender(),
    },
  ];
  for (const action of list) actions.register(action);
}
