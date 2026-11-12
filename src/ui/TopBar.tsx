import {
  ArrowLeftRight,
  Box,
  Check,
  Columns2,
  Crown,
  Globe,
  Grid2x2,
  LayoutGrid,
  Aperture,
  Redo2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { setActiveView } from '../app/actions';
import { editor, viewportFor } from '../app/app';
import { exportRender, newSkin, openSkin, saveSkin } from '../app/files';
import { toggleRenderMode } from '../app/views';
import { RenameCommand } from '../core/commands';
import { useEditorRevision } from './hooks';
import { DOCK_PANELS, resetLayout, togglePanel } from './layout';
import { Button, IconButton, Segmented } from './primitives';
import { formatShortcut } from './shortcuts';
import { useUi, VIEW_KINDS, VIEW_LABELS, type ViewKind } from './store';

// shared styling for dropdown menu surfaces
const MENU_CLASS =
  'z-[1000] min-w-52 rounded-xl border border-line-strong bg-raised p-1 text-xs text-fg shadow-xl shadow-black/50';

// shared styling for one row of a dropdown menu
const ITEM_CLASS =
  'flex h-7 cursor-default items-center justify-between gap-6 rounded-lg px-2 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover';

// icon shown for each view kind in the view switcher
const VIEW_ICONS: Record<ViewKind, LucideIcon> = {
  '3d': Box,
  '2d': Grid2x2,
  parts: LayoutGrid,
  render: Aperture,
  browser: Globe,
  namemc: Crown,
};

// one row of a dropdown menu with an optional shortcut hint
function MenuItem({
  children,
  shortcut,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item disabled={disabled} onSelect={onSelect} className={ITEM_CLASS}>
      {children}
      {shortcut && <kbd className="font-sans text-[11px] text-faint">{formatShortcut(shortcut)}</kbd>}
    </DropdownMenu.Item>
  );
}

// a titled dropdown in the menu row
function Menu({ title, children }: { title: string; children: ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>{title}</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CLASS}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// thin rule between groups of menu rows
function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}

// inline editable project name that renames through an undoable command
function ProjectName() {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const name = draft?.trim();
    if (name && name !== editor.skin.name) editor.execute(new RenameCommand(name));
    setDraft(null);
  };
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <input
        aria-label="Project name"
        spellCheck={false}
        value={draft ?? editor.skin.name}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        className="field-sizing-content h-7 max-w-56 min-w-16 truncate rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-medium text-fg outline-none transition-colors hover:border-line focus:border-accent focus:bg-app"
      />
      {editor.isDirty && (
        <span
          title="Unsaved changes"
          data-testid="dirty-indicator"
          className="size-1.5 shrink-0 rounded-full bg-accent"
        />
      )}
    </div>
  );
}

// menu listing every dockable panel so closed ones can be brought back
function ViewMenu() {
  const openPanels = useUi((state) => state.openPanels);
  return (
    <Menu title="View">
      {DOCK_PANELS.map((panel) => (
        <DropdownMenu.CheckboxItem
          key={panel.id}
          checked={openPanels.includes(panel.id)}
          onCheckedChange={() => togglePanel(panel.id)}
          className={ITEM_CLASS}
        >
          {panel.title}
          <DropdownMenu.ItemIndicator>
            <Check className="size-3.5 text-accent" />
          </DropdownMenu.ItemIndicator>
        </DropdownMenu.CheckboxItem>
      ))}
      <MenuSeparator />
      <MenuItem shortcut="F9" onSelect={toggleRenderMode}>
        Toggle render mode
      </MenuItem>
      <MenuItem shortcut="0" onSelect={() => viewportFor(['3d', 'render'])?.resetCamera()}>
        Reset camera
      </MenuItem>
      <MenuItem onSelect={resetLayout}>Reset layout</MenuItem>
    </Menu>
  );
}

// title row with the brand, menus, history, project name and the editor or render mode toggle
function TitleRow() {
  useEditorRevision();
  const rendering = useUi(
    (state) =>
      (state.views.a === 'render' && state.openPanels.includes('view-a')) ||
      (state.views.b === 'render' && state.openPanels.includes('view-b')),
  );
  const webglError = useUi((state) => state.webglError);

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-1 px-3">
      <div className="mr-2 flex items-center gap-2.5">
        <svg viewBox="0 0 16 16" className="size-5" shapeRendering="crispEdges" aria-hidden>
          <rect width="16" height="16" rx="3" className="fill-accent" />
          <rect width="16" height="5" className="fill-black/20" />
          <rect x="3" y="8" width="3" height="3" className="fill-accent-fg" />
          <rect x="10" y="8" width="3" height="3" className="fill-accent-fg" />
        </svg>
        <span className="text-sm font-semibold tracking-tight text-fg">Skin Studio</span>
      </div>

      <Menu title="File">
        <MenuItem onSelect={() => newSkin('starter', 'classic')}>New skin</MenuItem>
        <MenuItem onSelect={() => newSkin('starter', 'slim')}>New slim skin</MenuItem>
        <MenuItem onSelect={() => newSkin('blank')}>New blank skin</MenuItem>
        <MenuItem shortcut="Mod+O" onSelect={() => void openSkin()}>
          Open PNG…
        </MenuItem>
        <MenuSeparator />
        <MenuItem shortcut="Mod+S" onSelect={() => void saveSkin()}>
          Save
        </MenuItem>
        <MenuItem shortcut="Mod+Shift+S" onSelect={() => void saveSkin(true)}>
          Export skin PNG…
        </MenuItem>
        <MenuItem shortcut="Mod+E" disabled={webglError !== null} onSelect={() => void exportRender()}>
          Export render…
        </MenuItem>
      </Menu>
      <Menu title="Edit">
        <MenuItem shortcut="Mod+Z" disabled={!editor.canUndo} onSelect={() => editor.undo()}>
          {editor.undoLabel ? `Undo ${editor.undoLabel.toLowerCase()}` : 'Undo'}
        </MenuItem>
        <MenuItem shortcut="Mod+Shift+Z" disabled={!editor.canRedo} onSelect={() => editor.redo()}>
          {editor.redoLabel ? `Redo ${editor.redoLabel.toLowerCase()}` : 'Redo'}
        </MenuItem>
      </Menu>
      <ViewMenu />

      <span className="mx-1.5 h-4 w-px bg-line-strong" />
      <IconButton
        label={editor.undoLabel ? `Undo ${editor.undoLabel.toLowerCase()}` : 'Undo'}
        shortcut="Mod+Z"
        icon={Undo2}
        disabled={!editor.canUndo}
        onClick={() => editor.undo()}
      />
      <IconButton
        label={editor.redoLabel ? `Redo ${editor.redoLabel.toLowerCase()}` : 'Redo'}
        shortcut="Mod+Shift+Z"
        icon={Redo2}
        disabled={!editor.canRedo}
        onClick={() => editor.redo()}
      />
      <span className="mx-1.5 h-4 w-px bg-line-strong" />
      <ProjectName />

      <div className="absolute left-1/2 -translate-x-1/2">
        <Segmented<'editor' | 'render'>
          label="Mode"
          value={rendering ? 'render' : 'editor'}
          onChange={toggleRenderMode}
          options={[
            { value: 'editor', label: 'Editor' },
            { value: 'render', label: 'Render', disabled: webglError !== null },
          ]}
        />
      </div>
    </div>
  );
}

// second row that picks what the active view area shows and arranges the two areas
function ViewRow() {
  const views = useUi((state) => state.views);
  const activeSlot = useUi((state) => state.activeSlot);
  const openPanels = useUi((state) => state.openPanels);
  const webglError = useUi((state) => state.webglError);
  const set = useUi((state) => state.set);
  const paired = openPanels.includes('view-a') && openPanels.includes('view-b');
  const anyView = openPanels.includes('view-a') || openPanels.includes('view-b');

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 px-3">
      <span className="w-12 text-[11px] font-medium text-faint">
        {paired ? `View ${activeSlot === 'a' ? 1 : 2}` : 'View'}
      </span>
      <Segmented<ViewKind>
        label="View content"
        value={views[activeSlot]}
        onChange={setActiveView}
        options={VIEW_KINDS.map((kind) => ({
          value: kind,
          label: VIEW_LABELS[kind],
          icon: VIEW_ICONS[kind],
          disabled: !anyView || (webglError !== null && (kind === '3d' || kind === 'render')),
        }))}
      />
      <div className="ml-auto flex items-center gap-1.5">
        <IconButton
          label={paired ? 'Show one view' : 'Show two views'}
          icon={Columns2}
          active={paired}
          onClick={() => togglePanel(openPanels.includes('view-a') ? 'view-b' : 'view-a')}
          className="size-8 border border-line bg-panel"
        />
        <IconButton
          label="Swap the two views"
          icon={ArrowLeftRight}
          disabled={!paired}
          onClick={() => set({ views: { a: views.b, b: views.a }, hover: null })}
          className="size-8 border border-line bg-panel"
        />
      </div>
    </div>
  );
}

// application header: menus and mode on top, the view switcher below
export function TopBar() {
  return (
    <header className="shrink-0">
      <TitleRow />
      <ViewRow />
    </header>
  );
}
