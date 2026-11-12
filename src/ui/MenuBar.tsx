import {
  Aperture,
  Box,
  Camera,
  Columns2,
  Download,
  FilePlus,
  FolderOpen,
  Grid2x2,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Shirt,
  Square,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { Menubar } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { toggleStudio } from '../app/actions';
import { editor, tools, viewportRef } from '../app/app';
import { exportRender, newSkin, openSkin, saveSkin } from '../app/files';
import { RenameCommand } from '../core/commands';
import { useEditorRevision, useRegistry } from './hooks';
import { toolIcon } from './icons';
import { IconButton, Segmented } from './primitives';
import { formatShortcut } from './shortcuts';
import { useUi, type Workspace } from './store';

// one dropdown of the application menu bar
function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Menubar.Menu>
      <Menubar.Trigger className="flex h-full cursor-default items-center px-2.5 text-[13px] text-muted outline-none transition-colors hover:bg-hover hover:text-fg data-[highlighted]:bg-hover data-[state=open]:bg-hover data-[state=open]:text-fg">
        {label}
      </Menubar.Trigger>
      <Menubar.Portal>
        <Menubar.Content
          align="start"
          sideOffset={0}
          className="z-50 min-w-56 border border-line bg-panel py-1 text-[13px] text-muted shadow-xl shadow-black/50"
        >
          {children}
        </Menubar.Content>
      </Menubar.Portal>
    </Menubar.Menu>
  );
}

// one row of a menu with a leading icon and an optional shortcut hint
function MenuItem({
  icon: Icon,
  children,
  shortcut,
  disabled,
  onSelect,
}: {
  icon: LucideIcon;
  children: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <Menubar.Item
      disabled={disabled}
      onSelect={onSelect}
      className="group flex h-7 cursor-default items-center gap-2.5 px-3 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg"
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="flex-1">{children}</span>
      {shortcut && (
        <kbd className="pl-6 font-sans text-[11px] text-faint group-data-[highlighted]:text-accent-fg/70">
          {formatShortcut(shortcut)}
        </kbd>
      )}
    </Menubar.Item>
  );
}

// thin divider between groups of menu rows
function MenuSeparator() {
  return <Menubar.Separator className="my-1 h-px bg-line" />;
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
      className="field-sizing-content h-6 max-w-64 min-w-16 truncate rounded-sm border border-transparent bg-transparent px-1 text-[13px] text-fg outline-none transition-colors hover:border-line-strong focus:border-accent focus:bg-back"
    />
  );
}

// top strip with the application menus on the left and the mode selector on the right
export function MenuBar() {
  useEditorRevision();
  const toolList = useRegistry(tools);
  const workspace = useUi((state) => state.workspace);
  const webglError = useUi((state) => state.webglError);
  const set = useUi((state) => state.set);
  const editing = workspace === 'edit';
  const no3d = webglError !== null;

  return (
    <header className="flex h-[30px] shrink-0 items-stretch bg-back">
      <div className="flex items-center px-2.5">
        <svg viewBox="0 0 16 16" className="size-[18px]" shapeRendering="crispEdges" aria-hidden>
          <rect width="16" height="16" rx="2" className="fill-accent" />
          <rect width="16" height="5" className="fill-black/25" />
          <rect x="3" y="8" width="3" height="3" className="fill-accent-fg" />
          <rect x="10" y="8" width="3" height="3" className="fill-accent-fg" />
        </svg>
      </div>

      <Menubar.Root aria-label="Application menu" className="flex items-stretch">
        <Menu label="File">
          <MenuItem icon={FilePlus} onSelect={() => newSkin('starter', 'classic')}>
            New skin
          </MenuItem>
          <MenuItem icon={FilePlus} onSelect={() => newSkin('starter', 'slim')}>
            New slim skin
          </MenuItem>
          <MenuItem icon={Square} onSelect={() => newSkin('blank')}>
            New blank skin
          </MenuItem>
          <MenuItem icon={FolderOpen} shortcut="Mod+O" onSelect={() => void openSkin()}>
            Open PNG…
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={Save} shortcut="Mod+S" onSelect={() => void saveSkin()}>
            Save
          </MenuItem>
          <MenuItem icon={Download} shortcut="Mod+Shift+S" onSelect={() => void saveSkin(true)}>
            Export skin PNG…
          </MenuItem>
          <MenuItem icon={Camera} shortcut="Mod+E" disabled={no3d} onSelect={() => void exportRender()}>
            Export studio render…
          </MenuItem>
        </Menu>

        <Menu label="Edit">
          <MenuItem icon={Undo2} shortcut="Mod+Z" disabled={!editor.canUndo} onSelect={() => editor.undo()}>
            {editor.undoLabel ? `Undo ${editor.undoLabel.toLowerCase()}` : 'Undo'}
          </MenuItem>
          <MenuItem
            icon={Redo2}
            shortcut="Mod+Shift+Z"
            disabled={!editor.canRedo}
            onSelect={() => editor.redo()}
          >
            {editor.redoLabel ? `Redo ${editor.redoLabel.toLowerCase()}` : 'Redo'}
          </MenuItem>
        </Menu>

        <Menu label="Tools">
          {toolList.map((tool) => (
            <MenuItem
              key={tool.id}
              icon={toolIcon(tool.icon)}
              shortcut={tool.shortcut}
              disabled={!editing}
              onSelect={() => set({ activeToolId: tool.id })}
            >
              {tool.label}
            </MenuItem>
          ))}
        </Menu>

        <Menu label="View">
          <MenuItem
            icon={Box}
            shortcut="1"
            disabled={!editing || no3d}
            onSelect={() => set({ viewMode: '3d' })}
          >
            3D view
          </MenuItem>
          <MenuItem
            icon={Columns2}
            shortcut="2"
            disabled={!editing || no3d}
            onSelect={() => set({ viewMode: 'split' })}
          >
            Split view
          </MenuItem>
          <MenuItem icon={Grid2x2} shortcut="3" disabled={!editing} onSelect={() => set({ viewMode: '2d' })}>
            2D texture editor
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={RotateCcw}
            shortcut="0"
            disabled={no3d}
            onSelect={() => viewportRef.current?.resetCamera()}
          >
            Reset camera
          </MenuItem>
          <MenuItem icon={Aperture} shortcut="F9" disabled={no3d} onSelect={toggleStudio}>
            {workspace === 'studio' ? 'Leave studio mode' : 'Studio mode'}
          </MenuItem>
        </Menu>
      </Menubar.Root>

      <div className="ml-auto flex items-stretch">
        <Segmented<Workspace>
          label="Workspace"
          variant="tabs"
          value={workspace}
          onChange={(next) => set({ workspace: next, hover: null })}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'studio', label: 'Studio', disabled: no3d },
            { value: 'browser', label: 'Browser' },
          ]}
        />
      </div>
    </header>
  );
}

// strip below the menu bar holding the document tab and the history and save shortcuts
export function TabBar() {
  useEditorRevision();
  return (
    <div className="flex h-[30px] shrink-0 items-stretch border-b border-line bg-app">
      <div className="flex items-center gap-1.5 border-t-2 border-accent bg-panel pr-2.5 pl-2.5">
        <Shirt className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
        <ProjectName />
        <span
          title={editor.isDirty ? 'Unsaved changes' : undefined}
          data-testid={editor.isDirty ? 'dirty-indicator' : undefined}
          className={`size-1.5 shrink-0 rounded-full ${editor.isDirty ? 'bg-accent' : 'bg-transparent'}`}
        />
      </div>
      <div className="flex items-center px-1">
        <IconButton label="New skin" icon={Plus} className="size-6" onClick={() => newSkin('starter')} />
      </div>
      <div className="ml-auto flex items-center gap-0.5 pr-1.5">
        <IconButton
          label={editor.undoLabel ? `Undo ${editor.undoLabel.toLowerCase()}` : 'Undo'}
          shortcut="Mod+Z"
          icon={Undo2}
          className="size-6"
          disabled={!editor.canUndo}
          onClick={() => editor.undo()}
        />
        <IconButton
          label={editor.redoLabel ? `Redo ${editor.redoLabel.toLowerCase()}` : 'Redo'}
          shortcut="Mod+Shift+Z"
          icon={Redo2}
          className="size-6"
          disabled={!editor.canRedo}
          onClick={() => editor.redo()}
        />
        <span className="mx-1 h-4 w-px bg-line-strong" />
        <IconButton
          label="Save"
          shortcut="Mod+S"
          icon={Save}
          className="size-6"
          onClick={() => void saveSkin()}
        />
      </div>
    </div>
  );
}
