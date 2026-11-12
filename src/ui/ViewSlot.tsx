import type { DockviewPanelApi } from 'dockview-react';
import { RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { viewports } from '../app/app';
import { BrowserView } from './BrowserView';
import { IconButton } from './primitives';
import { useUi, VIEW_LABELS } from './store';
import { TextureView } from './TextureView';
import { Viewport3D } from './Viewport3D';

// content of one view tab, showing whichever kind of view the tab was opened with
export function ViewSlot({ id, panel }: { id: string; panel: DockviewPanelApi }) {
  const kind = useUi((state) => state.views[id]);
  const active = useUi((state) => state.activeView === id);
  const several = useUi((state) => Object.keys(state.views).length > 1);
  const webglError = useUi((state) => state.webglError);
  const model = kind === '3d' || kind === 'render';

  useEffect(() => {
    if (kind) panel.setTitle(VIEW_LABELS[kind]);
  }, [kind, panel]);
  useEffect(() => {
    const subscription = panel.onDidActiveChange((event) => {
      if (event.isActive) useUi.getState().set({ activeView: id });
    });
    return () => subscription.dispose();
  }, [panel, id]);

  if (!kind) return null;
  return (
    <div
      data-testid={id}
      className="relative h-full w-full overflow-hidden"
      onPointerDownCapture={() => {
        if (!active) useUi.getState().set({ activeView: id });
      }}
    >
      {model ? (
        <Viewport3D id={id} />
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
            onClick={() => viewports.get(id)?.resetCamera()}
            className="border border-line bg-panel/90 backdrop-blur-sm"
          />
        </div>
      )}
      {several && active && <div className="pointer-events-none absolute inset-0 border border-accent/45" />}
    </div>
  );
}
