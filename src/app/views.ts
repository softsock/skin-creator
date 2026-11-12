import { showPanel } from '../ui/layout';
import { useUi, type SlotId } from '../ui/store';

// view areas that currently exist in the dock, the active one first
function openSlots(): SlotId[] {
  const { activeSlot, openPanels } = useUi.getState();
  const order: SlotId[] = activeSlot === 'a' ? ['a', 'b'] : ['b', 'a'];
  return order.filter((slot) => openPanels.includes(`view-${slot}`));
}

// turns one view area into the studio render and reveals its settings, reusing a 3d area if any
export function showRenderView(): boolean {
  const ui = useUi.getState();
  if (ui.webglError) {
    ui.notify('error', 'The 3D render needs WebGL, which is unavailable here.');
    return false;
  }
  const slots = openSlots();
  if (!slots.some((slot) => ui.views[slot] === 'render')) {
    const slot = slots.find((item) => ui.views[item] === '3d') ?? slots[0] ?? 'a';
    if (slots.length === 0) showPanel('view-a');
    ui.setView(slot, 'render');
  }
  showPanel('render');
  return true;
}

// switches between editing and the studio render, bound to f9 and the mode toggle
export function toggleRenderMode(): void {
  const ui = useUi.getState();
  const rendering = openSlots().filter((slot) => ui.views[slot] === 'render');
  if (rendering.length === 0) showRenderView();
  else for (const slot of rendering) ui.setView(slot, '3d');
}
