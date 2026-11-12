import { Box, Columns2, Globe, Grid2x2, RotateCcw } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { actions, editor, platform, tools, viewportRef } from '../app/app';
import { importSkin } from '../app/files';
import { rgbaToHex } from '../core/color';
import { describeFace, getSkinFaces } from '../core/skin-layout';
import { Tooltip } from 'radix-ui';
import { useEditorRevision, useRegistry } from './hooks';
import { toolIcon } from './icons';
import { MenuBar, TabBar } from './MenuBar';
import { ColorPanel } from './panels/ColorPanel';
import {
  ExtensionsPanel,
  ModelPanel,
  OutlinerPanel,
  PluginPanels,
  TexturesPanel,
  ToolOptions,
  UvPanel,
} from './panels/EditPanels';
import { StudioOutputPanels, StudioScenePanels } from './panels/StudioPanel';
import { IconButton, Segmented } from './primitives';
import { formatShortcut, isTyping, shortcutOf } from './shortcuts';
import { useUi, type ViewMode } from './store';
import { TextureView } from './TextureView';
import { Viewport3D } from './Viewport3D';

// shortcuts that must keep working while a text field is focused
const GLOBAL_SHORTCUTS = /^(F\d+|Mod\+S|Mod\+O|Mod\+E|Mod\+Shift\+S)$/;

// strip above the viewport with every registered tool, its options and the view layout switch
function Toolbar() {
  const toolList = useRegistry(tools);
  const activeToolId = useUi((state) => state.activeToolId);
  const editing = useUi((state) => state.workspace === 'edit');
  const viewMode = useUi((state) => state.viewMode);
  const webglError = useUi((state) => state.webglError);
  const set = useUi((state) => state.set);
  return (
    <div
      role="toolbar"
      aria-label="Tools"
      className="flex min-h-9 shrink-0 flex-wrap items-center gap-0.5 border-b border-line bg-panel px-1.5 py-1"
    >
      {editing ? (
        toolList.map((tool, index) => (
          <div key={tool.id} className="contents">
            {index > 0 && tool.id.includes('.') && !toolList[index - 1]!.id.includes('.') && (
              <span className="mx-1 h-5 w-px bg-line-strong" />
            )}
            <IconButton
              label={tool.label}
              shortcut={tool.shortcut}
              icon={toolIcon(tool.icon)}
              active={tool.id === activeToolId}
              onClick={() => set({ activeToolId: tool.id })}
            />
          </div>
        ))
      ) : (
        <p className="px-1.5 text-xs text-muted">
          Studio render <span className="text-faint">· F9 returns to painting</span>
        </p>
      )}
      {editing && <ToolOptions />}
      <div className="ml-auto flex items-center gap-1.5 pl-2">
        {editing && (
          <Segmented<ViewMode>
            label="View mode"
            iconOnly
            value={viewMode}
            onChange={(next) => set({ viewMode: next })}
            options={[
              { value: '3d', label: '3D view', icon: Box, disabled: webglError !== null },
              { value: 'split', label: 'Split view', icon: Columns2, disabled: webglError !== null },
              { value: '2d', label: '2D texture editor', icon: Grid2x2 },
            ]}
          />
        )}
        <IconButton
          label="Reset camera"
          shortcut="0"
          icon={RotateCcw}
          disabled={webglError !== null || (editing && viewMode === '2d')}
          onClick={() => viewportRef.current?.resetCamera()}
        />
      </div>
    </div>
  );
}

// central column holding the toolbar, the 3d viewport, the 2d editor or the browser placeholder
function Workspace() {
  const workspace = useUi((state) => state.workspace);
  const viewMode = useUi((state) => state.viewMode);
  const mode: ViewMode = workspace === 'studio' ? '3d' : viewMode;
  const show3d = workspace !== 'browser' && mode !== '2d';
  const show2d = workspace === 'edit' && mode !== '3d';

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-app">
      {workspace === 'browser' ? <BrowserPlaceholder /> : <Toolbar />}
      <div className={`min-h-0 flex-1 ${workspace === 'browser' ? 'hidden' : 'flex'}`}>
        <div className={`relative min-w-0 flex-1 ${show3d ? '' : 'hidden'}`}>
          <Viewport3D />
        </div>
        {show2d && (
          <div className="min-w-0 flex-1 border-l border-line">
            <TextureView />
          </div>
        )}
      </div>
      <Toast />
    </main>
  );
}

// honest empty state for the integrated browser, which only exists in the desktop roadmap
function BrowserPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-line-strong bg-panel text-muted">
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

// docked column of panels on one side of the viewport
function Sidebar({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  return (
    <aside
      aria-label={`${side === 'left' ? 'Left' : 'Right'} sidebar`}
      className={`scroll-thin w-[17.5rem] shrink-0 overflow-y-auto bg-panel ${side === 'left' ? 'border-r' : 'border-l'} border-line`}
    >
      {children}
    </aside>
  );
}

// panels shown left of the viewport: texture and project in edit mode, the scene in studio mode
function LeftSidebar() {
  const workspace = useUi((state) => state.workspace);
  const docked = useUi((state) => state.viewMode === '3d');
  if (workspace === 'browser') return null;
  return (
    <Sidebar side="left">
      {workspace === 'studio' ? (
        <StudioScenePanels />
      ) : (
        <>
          {docked && <UvPanel />}
          <TexturesPanel />
          <ModelPanel />
          <ExtensionsPanel />
        </>
      )}
    </Sidebar>
  );
}

// panels shown right of the viewport: color and outliner in edit mode, the output in studio mode
function RightSidebar() {
  const workspace = useUi((state) => state.workspace);
  if (workspace === 'browser') return null;
  return (
    <Sidebar side="right">
      {workspace === 'studio' ? (
        <StudioOutputPanels />
      ) : (
        <>
          <ColorPanel />
          <OutlinerPanel />
          <PluginPanels />
        </>
      )}
    </Sidebar>
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
      ? ['Drag on model to paint', 'Drag empty space to orbit', 'Right-drag to pan', 'F9 Studio']
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
    <footer className="flex h-[26px] shrink-0 items-center gap-4 border-t border-line bg-back px-2.5 text-[11px] text-muted">
      {workspace === 'edit' && (
        <>
          <span className="flex min-w-0 items-center gap-1.5">
            <span data-testid="status-tool" className="text-fg">
              {tool?.label ?? '—'}
            </span>
            {tool?.hint && <span className="truncate text-faint">{tool.hint}</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm border border-white/15"
              style={{ backgroundColor: rgbaToHex(color) }}
            />
            <span className="font-mono uppercase">{rgbaToHex(color)}</span>
          </span>
          <span data-testid="status-pixel" className="shrink-0 tabular-nums">
            {hover && face ? `${hover.x}, ${hover.y} · ${describeFace(face)}` : 'No pixel'}
          </span>
        </>
      )}
      {workspace === 'studio' && <span className="text-fg">Studio render</span>}
      <span className="ml-auto flex shrink-0 items-center gap-3 text-faint">
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
        <MenuBar />
        <TabBar />
        <div className="flex min-h-0 flex-1">
          <LeftSidebar />
          <Workspace />
          <RightSidebar />
        </div>
        <StatusBar />
      </div>
    </Tooltip.Provider>
  );
}
