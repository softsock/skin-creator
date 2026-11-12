import type { DockviewPanelApi } from 'dockview-react';
import { RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { viewports } from '../app/app';
import { BrowserView } from './BrowserView';
import { IconButton } from './primitives';
import { useUi, VIEW_LABELS, type SlotId } from './store';
import { TextureView } from './TextureView';
import { Viewport3D } from './Viewport3D';

// one of the two view areas, showing whichever kind of view the user picked for it
export function ViewSlot({ slot, panel }: { slot: SlotId; panel: DockviewPanelApi }) {
  const kind = useUi((state) => state.views[slot]);
  const active = useUi((state) => state.activeSlot === slot);
  const paired = useUi((state) => state.openPanels.includes('view-a') && state.openPanels.includes('view-b'));
  const webglError = useUi((state) => state.webglError);
  const model = kind === '3d' || kind === 'render';

  useEffect(() => panel.setTitle(VIEW_LABELS[kind]), [kind, panel]);
  useEffect(() => {
    const subscription = panel.onDidActiveChange((event) => {
      if (event.isActive) useUi.getState().set({ activeSlot: slot });
    });
    return () => subscription.dispose();
  }, [panel, slot]);

  return (
    <div
      data-testid={`view-${slot}`}
      className="relative h-full w-full overflow-hidden"
      onPointerDownCapture={() => {
        if (!active) useUi.getState().set({ activeSlot: slot });
      }}
    >
      {model ? (
        <Viewport3D slot={slot} />
      ) : kind === 'browser' || kind === 'namemc' ? (
        <BrowserView key={kind} kind={kind} />
      ) : (
        <TextureView layout={kind === 'parts' ? 'parts' : 'atlas'} />
      )}
      {model && !webglError && (
        <div className="absolute bottom-2.5 left-2.5">
          <IconButton
            label="Reset camera"
            shortcut="0"
            icon={RotateCcw}
            tipSide="right"
            onClick={() => viewports.get(slot)?.resetCamera()}
            className="border border-line bg-panel/90 backdrop-blur-sm"
          />
        </div>
      )}
      {paired && active && <div className="pointer-events-none absolute inset-0 border border-accent/45" />}
    </div>
  );
}
