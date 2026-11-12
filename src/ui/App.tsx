import { Download, Play, Upload } from 'lucide-react';
import { useEffect } from 'react';
import { actions, editor, platform, tools } from '../app/app';
import { exportRender, importSkin, openSkin, saveSkin } from '../app/files';
import { rgbaToHex } from '../core/color';
import { describeFace, getSkinFaces } from '../core/skin-layout';
import { Tooltip } from 'radix-ui';
import { Dock } from './Dock';
import { useEditorRevision, useRegistry } from './hooks';
import { Button } from './primitives';
import { formatShortcut, isTyping, shortcutOf } from './shortcuts';
import { useUi } from './store';
import { TopBar } from './TopBar';

// shortcuts that must keep working while a text field is focused
const GLOBAL_SHORTCUTS = /^(F\d+|Mod\+S|Mod\+O|Mod\+E|Mod\+Shift\+S)$/;

// bottom card with the active tool, color and hovered pixel on the left and file actions on the right
function BottomBar() {
  useEditorRevision();
  const activeToolId = useUi((state) => state.activeToolId);
  const color = useUi((state) => state.color);
  const hover = useUi((state) => state.hover);
  const webglError = useUi((state) => state.webglError);
  const tool = useRegistry(tools).find((item) => item.id === activeToolId);
  const face = hover && getSkinFaces(editor.skin.model)[hover.faceIndex];
  return (
    <footer className="mx-2 mb-2 flex h-12 shrink-0 items-center gap-4 rounded-xl border border-line bg-panel px-3 text-[11px] text-muted">
      <span data-testid="status-tool" className="text-xs font-medium text-fg">
        {tool?.label ?? '—'}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="size-3 rounded-full border border-white/15"
          style={{ backgroundColor: rgbaToHex(color) }}
        />
        <span className="font-mono uppercase">{rgbaToHex(color)}</span>
      </span>
      <span data-testid="status-pixel" className="tabular-nums">
        {hover && face ? `${hover.x}, ${hover.y} · ${describeFace(face)}` : 'No pixel'}
      </span>
      <span className="ml-auto hidden text-faint xl:inline">
        Drag a panel tab to move it · {platform.kind === 'desktop' ? 'Desktop' : 'Web'}
      </span>
      <div className="flex items-center gap-1.5 max-xl:ml-auto">
        <Button variant="outline" className="h-8 px-3" onClick={() => void openSkin()}>
          <Upload className="size-3.5" /> Import
        </Button>
        <Button variant="primary" className="h-8 px-3" onClick={() => void saveSkin(true)}>
          <Download className="size-3.5" /> Export
        </Button>
        <Button
          variant="outline"
          className="h-8 px-3"
          disabled={webglError !== null}
          title={`Export the studio render (${formatShortcut('Mod+E')})`}
          onClick={() => void exportRender()}
        >
          <Play className="size-3.5" /> Render
        </Button>
      </div>
    </footer>
  );
}

// transient confirmation and error messages
function Toast() {
  const notice = useUi((state) => state.notice);
  const set = useUi((state) => state.set);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => set({ notice: null }), notice.kind === 'error' ? 6000 : 2600);
    return () => clearTimeout(timer);
  }, [notice, set]);
  if (!notice) return null;
  return (
    <div
      role="status"
      data-testid="toast"
      className={`pointer-events-none absolute bottom-20 left-1/2 z-[1000] max-w-md -translate-x-1/2 rounded-xl border px-3 py-2 text-xs shadow-xl shadow-black/40 ${notice.kind === 'error' ? 'border-danger/40 bg-[#2a1719] text-[#ffc9cd]' : 'border-line-strong bg-raised text-fg'}`}
    >
      {notice.text}
    </div>
  );
}

// application shell wiring the dock, global shortcuts and drag and drop import
export function App() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = shortcutOf(event);
      if (isTyping(event) && !GLOBAL_SHORTCUTS.test(shortcut)) return;
      const action = actions.list().find((item) => item.shortcut === shortcut);
      if (action) {
        event.preventDefault();
        action.run();
        return;
      }
      const tool = tools.list().find((item) => item.shortcut === shortcut);
      if (tool) useUi.getState().set({ activeToolId: tool.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
      <div
        data-app-ready
        className="relative flex h-full flex-col"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) importSkin(file.name, new Uint8Array(await file.arrayBuffer()));
        }}
      >
        <TopBar />
        <Dock />
        <BottomBar />
        <Toast />
      </div>
    </Tooltip.Provider>
  );
}
