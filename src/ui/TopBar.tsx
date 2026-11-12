import { ChevronDown, Download, Redo2, Save, Undo2 } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { editor } from '../app/app';
import { exportRender, newSkin, openSkin, saveSkin } from '../app/files';
import { RenameCommand } from '../core/commands';
import { useEditorRevision } from './hooks';
import { Button, IconButton, Segmented } from './primitives';
import { formatShortcut } from './shortcuts';
import { useUi, type Workspace } from './store';

// shared styling for dropdown menu surfaces
const MENU_CLASS =
  'z-50 min-w-48 rounded-lg border border-line-strong bg-raised p-1 text-xs text-fg shadow-xl shadow-black/50';

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
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex h-7 cursor-default items-center justify-between gap-6 rounded-md px-2 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover"
    >
      {children}
      {shortcut && <kbd className="font-sans text-[11px] text-faint">{formatShortcut(shortcut)}</kbd>}
    </DropdownMenu.Item>
  );
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
        className="field-sizing-content h-7 max-w-64 min-w-16 truncate rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium text-fg outline-none transition-colors hover:border-line focus:border-accent focus:bg-app"
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

// application header with file operations, history, workspace tabs and export
export function TopBar() {
  useEditorRevision();
  const workspace = useUi((state) => state.workspace);
  const webglError = useUi((state) => state.webglError);
  const set = useUi((state) => state.set);

  return (
    <header className="relative flex h-11 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <div className="mr-1 flex items-center gap-2 pl-1">
        <svg viewBox="0 0 16 16" className="size-[18px]" shapeRendering="crispEdges" aria-hidden>
          <rect width="16" height="16" rx="3" className="fill-accent" />
          <rect width="16" height="5" className="fill-black/20" />
          <rect x="3" y="8" width="3" height="3" className="fill-accent-fg" />
          <rect x="10" y="8" width="3" height="3" className="fill-accent-fg" />
        </svg>
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button>File</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CLASS}>
            <MenuItem onSelect={() => newSkin('starter', 'classic')}>New skin</MenuItem>
            <MenuItem onSelect={() => newSkin('starter', 'slim')}>New slim skin</MenuItem>
            <MenuItem onSelect={() => newSkin('blank')}>New blank skin</MenuItem>
            <MenuItem shortcut="Mod+O" onSelect={() => void openSkin()}>
              Open PNG…
            </MenuItem>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <MenuItem shortcut="Mod+S" onSelect={() => void saveSkin()}>
              Save
            </MenuItem>
            <MenuItem shortcut="Mod+Shift+S" onSelect={() => void saveSkin(true)}>
              Export skin PNG…
            </MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <span className="mx-1 h-4 w-px bg-line" />
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
      <span className="mx-1 h-4 w-px bg-line" />
      <ProjectName />

      <div className="absolute left-1/2 -translate-x-1/2">
        <Segmented<Workspace>
          label="Workspace"
          value={workspace}
          onChange={(next) => set({ workspace: next, hover: null })}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'studio', label: 'Studio', disabled: webglError !== null },
            { value: 'browser', label: 'Browser' },
          ]}
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" onClick={() => void saveSkin()}>
          <Save className="size-3.5" /> Save
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="primary">
              <Download className="size-3.5" /> Export <ChevronDown className="-mr-1 size-3 opacity-70" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className={MENU_CLASS}>
              <MenuItem shortcut="Mod+Shift+S" onSelect={() => void saveSkin(true)}>
                Skin PNG…
              </MenuItem>
              <MenuItem shortcut="Mod+E" disabled={webglError !== null} onSelect={() => void exportRender()}>
                Studio render…
              </MenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
