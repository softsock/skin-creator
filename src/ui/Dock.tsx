import {
  DockviewReact,
  themeAbyssSpaced,
  type DockviewTheme,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelProps,
} from 'dockview-react';
import { PictureInPicture2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { attachDock } from './layout';
import { ColorPanel, PalettePanel } from './panels/ColorPanel';
import {
  BodyPartsPanel,
  ExtensionsPanel,
  PluginPanels,
  ToolSettingsPanel,
  ToolsPanel,
} from './panels/EditPanels';
import { StudioPanel } from './panels/StudioPanel';
import type { SlotId } from './store';
import { ViewSlot } from './ViewSlot';

// spaced card look for the dock, colored through css variables in index.css
const THEME: DockviewTheme = { ...themeAbyssSpaced, gap: 8 };

// scroll container shared by every settings panel so long content never resizes the dock
function PanelBody({ children }: { children: ReactNode }) {
  return <div className="scroll-thin h-full overflow-x-hidden overflow-y-auto">{children}</div>;
}

// maps the component names stored in a layout to the panel contents
const COMPONENTS = {
  view: ({ params, api }: IDockviewPanelProps<{ slot: SlotId }>) => (
    <ViewSlot slot={params.slot} panel={api} />
  ),
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
      className="mr-1.5 flex size-6 items-center justify-center self-center rounded-md text-faint transition-colors hover:bg-hover hover:text-fg"
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
      rightHeaderActionsComponent={GroupActions}
      floatingGroupBounds="boundedWithinViewport"
      onReady={(event) => attachDock(event.api)}
    />
  );
}
