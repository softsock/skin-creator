import {
  Box,
  ChevronDown,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Layers,
  Save,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { editor, extensions, panels, tools } from '../../app/app';
import { openSkin, saveSkin } from '../../app/files';
import { SetModelCommand } from '../../core/commands';
import {
  LAYER_IDS,
  PART_IDS,
  PART_LABELS,
  SKIN_SIZE,
  type LayerId,
  type PartId,
  type SkinModel,
} from '../../core/skin-layout';
import type { PaintTargetMode } from '../../editor/paint-target';
import type { PanelDefinition } from '../../extensions/api';
import { useEditorRevision, useRegistry } from '../hooks';
import { Button, IconButton, Section, Segmented, SliderRow, SwitchRow, Tip } from '../primitives';
import { useUi } from '../store';
import { TextureView } from '../TextureView';

// captions for the two minecraft layers
const LAYER_LABELS: Record<LayerId, string> = { base: 'Base', outer: 'Outer' };

// explains each 3d layer targeting rule in the toolbar tooltip
const TARGET_HINTS: Record<PaintTargetMode, string> = {
  auto: 'Paints the surface you see. Transparent outer pixels let strokes through to the base.',
  base: 'Always paints the base layer, even under the outer layer.',
  outer: 'Always paints the outer layer, including its empty pixels.',
};

// docked 2d texture editor shown beside the 3d view, like a uv panel
export function UvPanel() {
  return (
    <Section title="UV" flush>
      <div className="aspect-square">
        <TextureView />
      </div>
    </Section>
  );
}

// live miniature of the skin texture for the textures list
function SkinThumbnail() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    const image = new ImageData(
      new Uint8ClampedArray(editor.skin.pixels.buffer as ArrayBuffer),
      SKIN_SIZE,
      SKIN_SIZE,
    );
    const paint = () => ctx.putImageData(image, 0, 0);
    paint();
    return editor.subscribeDocument(paint);
  }, []);
  return (
    <canvas
      ref={ref}
      width={SKIN_SIZE}
      height={SKIN_SIZE}
      className="checker size-12 shrink-0 border border-line [image-rendering:pixelated]"
    />
  );
}

// lists the document's single texture with its file actions
export function TexturesPanel() {
  useEditorRevision();
  return (
    <Section
      title="Textures"
      flush
      action={
        <>
          <IconButton
            label="Open PNG…"
            shortcut="Mod+O"
            icon={FolderOpen}
            className="size-5"
            onClick={() => void openSkin()}
          />
          <IconButton
            label="Save texture"
            shortcut="Mod+S"
            icon={Save}
            className="size-5"
            onClick={() => void saveSkin()}
          />
        </>
      }
    >
      <div className="flex items-center gap-2.5 bg-selected/50 px-2.5 py-2">
        <SkinThumbnail />
        <div className="min-w-0 text-xs">
          <p className="truncate text-fg">{editor.skin.name}.png</p>
          <p className="text-[11px] text-faint">
            {SKIN_SIZE} × {SKIN_SIZE} · {editor.isDirty ? 'edited' : 'saved'}
          </p>
        </div>
      </div>
    </Section>
  );
}

// one line of the outliner tree with a visibility toggle on the right
function OutlinerRow({
  icon: Icon,
  label,
  toggleLabel,
  expanded,
  onExpand,
  visible,
  onToggle,
}: {
  icon: LucideIcon;
  label: string;
  toggleLabel: string;
  expanded?: boolean;
  onExpand?: () => void;
  visible: boolean;
  onToggle: () => void;
}) {
  const EyeIcon = visible ? Eye : EyeOff;
  return (
    <div
      className={`flex h-[22px] items-center gap-1.5 pr-1.5 text-xs transition-colors hover:bg-hover ${onExpand ? 'pl-1' : 'pl-9'} ${visible ? 'text-muted' : 'text-faint'}`}
    >
      {onExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Fold' : 'Unfold'} ${label} group`}
          onClick={onExpand}
          className="flex size-4 shrink-0 items-center justify-center text-faint hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronDown className={`size-3 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
      )}
      <Icon className={`size-3.5 shrink-0 ${onExpand ? 'text-accent' : 'text-faint'}`} strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate" onDoubleClick={onExpand}>
        {label}
      </span>
      <button
        type="button"
        aria-pressed={visible}
        aria-label={toggleLabel}
        onClick={onToggle}
        className="flex size-5 items-center justify-center rounded-sm hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <EyeIcon className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

// tree of body parts and their base and outer layers with visibility toggles
export function OutlinerPanel() {
  const visibility = useUi((state) => state.visibility);
  const toggle = useUi((state) => state.toggleVisibility);
  const setLayer = useUi((state) => state.setLayerVisibility);
  const set = useUi((state) => state.set);
  const [expanded, setExpanded] = useState<readonly PartId[]>([]);
  return (
    <Section
      title="Outliner"
      flush
      action={LAYER_IDS.map((layer) => {
        const allOn = PART_IDS.every((part) => visibility[part][layer]);
        return (
          <button
            key={layer}
            type="button"
            title={`${allOn ? 'Hide' : 'Show'} all ${LAYER_LABELS[layer].toLowerCase()} layers`}
            onClick={() => setLayer(layer, !allOn)}
            className={`h-5 rounded-sm px-1.5 text-[11px] transition-colors hover:bg-hover hover:text-fg ${allOn ? 'text-muted' : 'text-faint line-through'}`}
          >
            {LAYER_LABELS[layer]}
          </button>
        );
      })}
    >
      <div className="py-1">
        {PART_IDS.map((part) => {
          const anyOn = LAYER_IDS.some((layer) => visibility[part][layer]);
          const open = expanded.includes(part);
          return (
            <div key={part}>
              <OutlinerRow
                icon={Folder}
                label={PART_LABELS[part]}
                toggleLabel={`${PART_LABELS[part]} visible`}
                expanded={open}
                onExpand={() =>
                  setExpanded(open ? expanded.filter((id) => id !== part) : [...expanded, part])
                }
                visible={anyOn}
                onToggle={() =>
                  set({ visibility: { ...visibility, [part]: { base: !anyOn, outer: !anyOn } } })
                }
              />
              {open &&
                LAYER_IDS.map((layer) => (
                  <OutlinerRow
                    key={layer}
                    icon={Box}
                    label={`${LAYER_LABELS[layer]} layer`}
                    toggleLabel={`${PART_LABELS[part]} ${LAYER_LABELS[layer].toLowerCase()} layer visible`}
                    visible={visibility[part][layer]}
                    onToggle={() => toggle(part, layer)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// options of the active tool, placed in the toolbar next to the tools
export function ToolOptions() {
  const toolList = useRegistry(tools);
  const activeToolId = useUi((state) => state.activeToolId);
  const brushSize = useUi((state) => state.brushSize);
  const paintTarget = useUi((state) => state.paintTarget);
  const set = useUi((state) => state.set);
  const active = toolList.find((item) => item.id === activeToolId);
  return (
    <>
      {active?.usesBrushSize && (
        <div className="ml-1.5 flex items-center border-l border-line-strong pl-2.5">
          <SliderRow
            compact
            label="Size"
            value={brushSize}
            min={1}
            max={4}
            unit="px"
            onChange={(value) => set({ brushSize: value })}
          />
        </div>
      )}
      <div className="ml-1.5 flex items-center gap-2 border-l border-line-strong pl-2.5">
        <Tip label={TARGET_HINTS[paintTarget]}>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Layers className="size-3.5" strokeWidth={1.75} />
            Layer
          </span>
        </Tip>
        <Segmented<PaintTargetMode>
          label="3D paint target"
          value={paintTarget}
          onChange={(value) => set({ paintTarget: value })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'base', label: 'Base' },
            { value: 'outer', label: 'Outer' },
          ]}
        />
      </div>
    </>
  );
}

// arm geometry switch, applied as an undoable command
export function ModelPanel() {
  useEditorRevision();
  return (
    <Section title="Model">
      <Segmented<SkinModel>
        label="Character model"
        value={editor.skin.model}
        onChange={(model) => editor.execute(new SetModelCommand(model))}
        options={[
          { value: 'classic', label: 'Classic' },
          { value: 'slim', label: 'Slim' },
        ]}
      />
      <p className="text-[11px] text-faint">
        {editor.skin.model === 'classic' ? 'Steve-style arms, 4 px wide.' : 'Alex-style arms, 3 px wide.'}
      </p>
    </Section>
  );
}

// renders one declarative plugin panel with host-owned controls
function PluginPanel({ panel }: { panel: PanelDefinition }) {
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  return (
    <Section title={panel.title}>
      {panel.fields.map((field) =>
        field.type === 'slider' ? (
          <SliderRow
            key={field.id}
            label={field.label}
            value={field.get()}
            min={field.min}
            max={field.max}
            step={field.step}
            unit={field.unit}
            onChange={(value) => {
              field.set(value);
              refresh();
            }}
          />
        ) : (
          <Button key={field.id} variant="outline" onClick={field.run}>
            {field.label}
          </Button>
        ),
      )}
    </Section>
  );
}

// all panels contributed by enabled plugins
export function PluginPanels() {
  const list = useRegistry(panels);
  return list.map((panel) => <PluginPanel key={panel.id} panel={panel} />);
}

// lists installed plugins with a switch that fully unloads or reloads each one
export function ExtensionsPanel() {
  const plugins = useRegistry(extensions);
  return (
    <Section title="Plugins">
      {plugins.map(({ id, manifest, enabled }) => (
        <div key={id}>
          <SwitchRow
            label={manifest.name}
            checked={enabled}
            onChange={(next) => (next ? extensions.enable(id) : extensions.disable(id))}
          />
          <p className="text-[11px] leading-relaxed text-faint">{manifest.description}</p>
        </div>
      ))}
    </Section>
  );
}
