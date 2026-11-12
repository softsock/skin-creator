import { useUi } from '../ui/store';
import { actions, editor, viewportRef } from './app';
import { exportRender, newSkin, openSkin, saveSkin } from './files';

// switches between the edit and studio workspaces, bound to f9
export function toggleStudio(): void {
  const { workspace, webglError, set, notify } = useUi.getState();
  if (workspace !== 'studio' && webglError) {
    notify('error', 'Studio mode needs WebGL, which is unavailable here.');
    return;
  }
  set({ workspace: workspace === 'studio' ? 'edit' : 'studio', hover: null });
}

// registers the application's own operations through the same registry plugins use
export function registerAppActions(): void {
  const ui = () => useUi.getState();
  const list = [
    { id: 'file.new', title: 'New skin', run: () => newSkin('starter') },
    { id: 'file.open', title: 'Open PNG…', shortcut: 'Mod+O', run: () => void openSkin() },
    { id: 'file.save', title: 'Save', shortcut: 'Mod+S', run: () => void saveSkin() },
    { id: 'file.export', title: 'Export skin PNG…', shortcut: 'Mod+Shift+S', run: () => void saveSkin(true) },
    { id: 'edit.undo', title: 'Undo', shortcut: 'Mod+Z', run: () => void editor.undo() },
    { id: 'edit.redo', title: 'Redo', shortcut: 'Mod+Shift+Z', run: () => void editor.redo() },
    { id: 'edit.redo.alt', title: 'Redo', shortcut: 'Mod+Y', run: () => void editor.redo() },
    { id: 'view.studio', title: 'Toggle studio mode', shortcut: 'F9', run: toggleStudio },
    { id: 'view.3d', title: '3D view', shortcut: '1', run: () => ui().set({ viewMode: '3d' }) },
    { id: 'view.split', title: 'Split view', shortcut: '2', run: () => ui().set({ viewMode: 'split' }) },
    { id: 'view.2d', title: '2D texture view', shortcut: '3', run: () => ui().set({ viewMode: '2d' }) },
    { id: 'view.reset', title: 'Reset camera', shortcut: '0', run: () => viewportRef.current?.resetCamera() },
    {
      id: 'studio.export',
      title: 'Export studio render…',
      shortcut: 'Mod+E',
      run: () => void exportRender(),
    },
  ];
  for (const action of list) actions.register(action);
}
