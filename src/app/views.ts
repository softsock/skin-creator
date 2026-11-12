import { addView, showPanel } from '../ui/layout';
import { useUi } from '../ui/store';

// view tabs that currently exist in the dock, the active one first
function viewIds(): string[] {
  const { views, activeView } = useUi.getState();
  return Object.keys(views).sort((a, b) => Number(b === activeView) - Number(a === activeView));
}

// brings a studio render tab and its settings forward, turning a 3d tab into one or opening a new tab
export function showRenderView(): boolean {
  const ui = useUi.getState();
  if (ui.webglError) {
    ui.notify('error', 'The 3D render needs WebGL, which is unavailable here.');
    return false;
  }
  const ids = viewIds();
  const rendering = ids.find((id) => ui.views[id] === 'render');
  const preview = ids.find((id) => ui.views[id] === '3d');
  if (rendering) showPanel(rendering);
  else if (preview) {
    ui.setView(preview, 'render');
    showPanel(preview);
  } else addView('render');
  showPanel('render');
  return true;
}

// switches between editing and the studio render, bound to f9 and the mode toggle
export function toggleRenderMode(): void {
  const ui = useUi.getState();
  const rendering = viewIds().filter((id) => ui.views[id] === 'render');
  if (rendering.length === 0) showRenderView();
  else for (const id of rendering) ui.setView(id, '3d');
}
