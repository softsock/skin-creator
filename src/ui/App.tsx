import { Box, Columns2, Globe, Grid2x2, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { actions, editor, platform, tools, viewportRef } from '../app/app';
import { importSkin } from '../app/files';
import { rgbaToHex } from '../core/color';
import { describeFace, getSkinFaces } from '../core/skin-layout';
import { Tooltip } from 'radix-ui';
import { useEditorRevision, useRegistry } from './hooks';
import { toolIcon } from './icons';
import { ColorPanel } from './panels/ColorPanel';
import {
  ExtensionsPanel,
  LayersPanel,
  ModelPanel,
  PluginPanels,
  ToolSettingsPanel,
} from './panels/EditPanels';
import { StudioPanel } from './panels/StudioPanel';
import { IconButton, Segmented } from './primitives';
import { formatShortcut, isTyping, shortcutOf } from './shortcuts';
import { useUi, type ViewMode } from './store';
import { TextureView } from './TextureView';
import { TopBar } from './TopBar';
import { Viewport3D } from './Viewport3D';

// shortcuts that must keep working while a text field is focused
const GLOBAL_SHORTCUTS = /^(F\d+|Mod\+S|Mod\+O|Mod\+E|Mod\+Shift\+S)$/;

// vertical tool strip listing every registered tool, including those from plugins
function Toolbar() {
  const toolList = useRegistry(tools);
  const activeToolId = useUi((state) => state.activeToolId);
  const enabled = useUi((state) => state.workspace === 'edit');
  const set = useUi((state) => state.set);
  return (
    <nav
      aria-label="Tools"
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2"
    >
      {toolList.map((tool, index) => (
        <div key={tool.id} className="contents">
          {index > 0 && tool.id.includes('.') && !toolList[index - 1]!.id.includes('.') && (
            <span className="my-1 h-px w-5 bg-line" />
          )}
          <IconButton
            label={tool.label}
            shortcut={tool.shortcut}
            icon={toolIcon(tool.icon)}
            tipSide="right"
            active={enabled && tool.id === activeToolId}
            disabled={!enabled}
            onClick={() => set({ activeToolId: tool.id })}
            className="size-8"
          />
        </div>
      ))}
    </nav>
  );
}

// central area holding the 3d viewport, the 2d texture view or the browser placeholder
function Workspace() {
  const workspace = useUi((state) => state.workspace);
  const viewMode = useUi((state) => state.viewMode);
  const webglError = useUi((state) => state.webglError);
  const set = useUi((state) => state.set);
  const mode: ViewMode = workspace === 'studio' ? '3d' : viewMode;
  const show3d = workspace !== 'browser' && mode !== '2d';
  const show2d = workspace === 'edit' && mode !== '3d';

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-[#16171a]">
      {workspace === 'browser' && <BrowserPlaceholder />}
      <div className={`min-h-0 flex-1 ${workspace === 'browser' ? 'hidden' : 'flex'}`}>
        <div className={`relative min-w-0 flex-1 ${show3d ? '' : 'hidden'}`}>
          <Viewport3D />
        </div>
        <div className={`min-w-0 flex-1 border-l border-line ${show2d ? '' : 'hidden'}`}>
          <TextureView />
        </div>
      </div>
      {workspace === 'edit' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <div className="pointer-events-auto">
            <Segmented<ViewMode>
              label="View mode"
              className="bg-panel/90 backdrop-blur-sm"
              value={viewMode}
              onChange={(next) => set({ viewMode: next })}
              options={[
                { value: '3d', label: '3D', icon: Box, disabled: webglError !== null },
                { value: 'split', label: 'Split', icon: Columns2, disabled: webglError !== null },
                { value: '2d', label: '2D', icon: Grid2x2 },
              ]}
            />
          </div>
        </div>
      )}
      {workspace !== 'browser' && show3d && !webglError && (
        <div className="absolute bottom-2.5 left-2.5">
          <IconButton
            label="Reset camera"
            shortcut="0"
            icon={RotateCcw}
            tipSide="right"
            onClick={() => viewportRef.current?.resetCamera()}
            className="border border-line bg-panel/90 backdrop-blur-sm"
          />
        </div>
      )}
      <Toast />
    </main>
  );
}

// honest empty state for the integrated browser, which only exists in the desktop roadmap
function BrowserPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-panel text-muted">
          <Globe className="size-5" strokeWidth={1.5} />
        </div>
        <h2 className="text-sm font-semibold text-fg">Integrated browser is a desktop feature</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          A future desktop release will embed an isolated Chromium view here so you can browse NameMC and
          import downloaded skins without leaving the studio. It is not available in this build
          {platform.kind === 'web' ? ' and cannot run inside a web preview' : ''}.
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Until then, download a skin PNG in your browser and drop it onto this window, or use File → Open
          PNG.
        </p>
      </div>
    </div>
  );
}

// right sidebar whose panels depend on the active workspace
function Sidebar() {
  const workspace = useUi((state) => state.workspace);
  if (workspace === 'browser') return null;
  return (
    <aside className="scroll-thin w-[17rem] shrink-0 overflow-y-auto border-l border-line bg-panel">
      {workspace === 'studio' ? (
        <StudioPanel />
      ) : (
        <>
          <ColorPanel />
          <ToolSettingsPanel />
          <LayersPanel />
          <ModelPanel />
          <PluginPanels />
          <ExtensionsPanel />
        </>
      )}
    </aside>
  );
}

// bottom strip with the active tool, color, hovered pixel and context hints
function StatusBar() {
  useEditorRevision();
  const workspace = useUi((state) => state.workspace);
  const activeToolId = useUi((state) => state.activeToolId);
  const color = useUi((state) => state.color);
  const hover = useUi((state) => state.hover);
  const tool = useRegistry(tools).find((item) => item.id === activeToolId);
  const face = hover && getSkinFaces(editor.skin.model)[hover.faceIndex];
  const hints =
    workspace === 'edit'
      ? [
          'Drag on model to paint',
          'Drag empty space to orbit',
          'Right-drag to pan',
          'Scroll to zoom',
          'F9 Studio',
        ]
      : workspace === 'studio'
        ? [
            'Drag to orbit',
            'Right-drag to pan',
            'Scroll to zoom',
            `${formatShortcut('Mod+E')} Export`,
            'F9 Edit',
          ]
        : ['F9 Studio'];
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-[11px] text-muted">
      {workspace === 'edit' && (
        <>
          <span data-testid="status-tool" className="text-fg">
            {tool?.label ?? '—'}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[3px] border border-white/15"
              style={{ backgroundColor: rgbaToHex(color) }}
            />
            <span className="font-mono uppercase">{rgbaToHex(color)}</span>
          </span>
          <span data-testid="status-pixel" className="tabular-nums">
            {hover && face ? `${hover.x}, ${hover.y} · ${describeFace(face)}` : 'No pixel'}
          </span>
        </>
      )}
      {workspace === 'studio' && <span className="text-fg">Studio render</span>}
      <span className="ml-auto flex items-center gap-3 text-faint">
        {hints.map((hint) => (
          <span key={hint}>{hint}</span>
        ))}
        <span className="text-muted">{platform.kind === 'desktop' ? 'Desktop' : 'Web'}</span>
      </span>
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
      className={`pointer-events-none absolute bottom-4 left-1/2 max-w-md -translate-x-1/2 rounded-lg border px-3 py-2 text-xs shadow-xl shadow-black/40 ${notice.kind === 'error' ? 'border-danger/40 bg-[#2a1719] text-[#ffc9cd]' : 'border-line-strong bg-raised text-fg'}`}
    >
      {notice.text}
    </div>
  );
}

// application shell wiring layout, global shortcuts and drag and drop import
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
      if (tool && useUi.getState().workspace === 'edit') useUi.getState().set({ activeToolId: tool.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
      <div
        data-app-ready
        className="flex h-full flex-col"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) importSkin(file.name, new Uint8Array(await file.arrayBuffer()));
        }}
      >
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Toolbar />
          <Workspace />
          <Sidebar />
        </div>
        <StatusBar />
      </div>
    </Tooltip.Provider>
  );
}
