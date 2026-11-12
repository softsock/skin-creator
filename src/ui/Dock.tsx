import {
  DockviewReact,
  themeAbyssSpaced,
  type DockviewTheme,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelProps,
} from 'dockview-react';
import { Aperture, Box, Crown, Globe, Grid2x2, LayoutGrid, PictureInPicture2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { addView, attachDock } from './layout';
import { ColorPanel, PalettePanel } from './panels/ColorPanel';
import {
  BodyPartsPanel,
  ExtensionsPanel,
  PluginPanels,
  ToolSettingsPanel,
  ToolsPanel,
} from './panels/EditPanels';
import { StudioPanel } from './panels/StudioPanel';
import { ITEM_CLASS, MENU_CLASS } from './primitives';
import { NEW_VIEW_KINDS, useUi, VIEW_LABELS, type ViewKind } from './store';
import { ViewSlot } from './ViewSlot';

// spaced card look for the dock, colored through css variables in index.css
const THEME: DockviewTheme = { ...themeAbyssSpaced, gap: 8 };

// icon shown for each view kind in the new tab menu
const VIEW_ICONS: Record<ViewKind, LucideIcon> = {
  '3d': Box,
  '2d': Grid2x2,
  parts: LayoutGrid,
  render: Aperture,
  browser: Globe,
  namemc: Crown,
};

// shared look of the small buttons that sit in a group header
const HEADER_BUTTON_CLASS =
  'flex size-6 items-center justify-center self-center rounded-md text-faint transition-colors hover:bg-hover hover:text-fg data-[state=open]:bg-hover data-[state=open]:text-fg';

// scroll container shared by every settings panel so long content never resizes the dock
function PanelBody({ children }: { children: ReactNode }) {
  return <div className="scroll-thin h-full overflow-x-hidden overflow-y-auto">{children}</div>;
}

// maps the component names stored in a layout to the panel contents
const COMPONENTS = {
  view: ({ api }: IDockviewPanelProps) => <ViewSlot id={api.id} panel={api} />,
  tools: () => (
    <PanelBody>
      <ToolsPanel />
    </PanelBody>
  ),
  brush: () => (
    <PanelBody>
      <ToolSettingsPanel />
    </PanelBody>
  ),
  parts: () => (
    <PanelBody>
      <BodyPartsPanel />
    </PanelBody>
  ),
  color: () => (
    <PanelBody>
      <ColorPanel />
    </PanelBody>
  ),
  palette: () => (
    <PanelBody>
      <PalettePanel />
    </PanelBody>
  ),
  plugins: () => (
    <PanelBody>
      <PluginPanels />
      <ExtensionsPanel />
    </PanelBody>
  ),
  render: () => (
    <PanelBody>
      <StudioPanel />
    </PanelBody>
  ),
};

// plus button after the tabs of a group that opens a new view tab there, like a browser tab strip
function NewTabButton({ group }: IDockviewHeaderActionsProps) {
  const webglError = useUi((state) => state.webglError);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" title="New tab" aria-label="New tab" className={`ml-0.5 ${HEADER_BUTTON_CLASS}`}>
          <Plus className="size-3.5" strokeWidth={2} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={`${MENU_CLASS} min-w-40`}>
          {NEW_VIEW_KINDS.map((kind) => {
            const Icon = VIEW_ICONS[kind];
            return (
              <DropdownMenu.Item
                key={kind}
                disabled={webglError !== null && (kind === '3d' || kind === 'render')}
                onSelect={() => addView(kind, group.id)}
                className={`${ITEM_CLASS} justify-start gap-2.5`}
              >
                <Icon className="size-3.5 text-muted" strokeWidth={1.75} />
                {VIEW_LABELS[kind]}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// header button that pops a docked group out into a floating window
function GroupActions({ api, containerApi, group }: IDockviewHeaderActionsProps) {
  const [docked, setDocked] = useState(api.location.type === 'grid');
  useEffect(() => {
    const subscription = api.onDidLocationChange((event) => setDocked(event.location.type === 'grid'));
    return () => subscription.dispose();
  }, [api]);
  if (!docked) return null;
  return (
    <button
      type="button"
      title="Float this panel"
      aria-label="Float this panel"
      onClick={() => containerApi.addFloatingGroup(group, { width: 320, height: 400 })}
      className={`mr-1.5 ${HEADER_BUTTON_CLASS}`}
    >
      <PictureInPicture2 className="size-3.5" strokeWidth={1.75} />
    </button>
  );
}

// the dockable workspace: every panel can be dragged, tabbed, resized, floated or closed
export function Dock() {
  return (
    <DockviewReact
      className="min-h-0 flex-1"
      theme={THEME}
      components={COMPONENTS}
      leftHeaderActionsComponent={NewTabButton}
      rightHeaderActionsComponent={GroupActions}
      floatingGroupBounds="boundedWithinViewport"
      onReady={(event) => attachDock(event.api)}
    />
  );
}
