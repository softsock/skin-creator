import { Eye, EyeOff } from 'lucide-react';
import { useReducer } from 'react';
import { editor, extensions, panels, tools } from '../../app/app';
import { SetModelCommand } from '../../core/commands';
import { LAYER_IDS, PART_IDS, PART_LABELS, type LayerId, type SkinModel } from '../../core/skin-layout';
import type { PaintTargetMode } from '../../editor/paint-target';
import type { PanelDefinition } from '../../extensions/api';
import { useEditorRevision, useRegistry } from '../hooks';
import { toolIcon } from '../icons';
import { Button, IconButton, Section, Segmented, SliderRow, SwitchRow } from '../primitives';
import { useUi } from '../store';

// column captions for the two minecraft layers
const LAYER_LABELS: Record<LayerId, string> = { base: 'Base', outer: 'Outer' };

// grid of every registered tool, including those contributed by plugins
export function ToolsPanel() {
  const toolList = useRegistry(tools);
  const activeToolId = useUi((state) => state.activeToolId);
  const set = useUi((state) => state.set);
  return (
    <nav aria-label="Tools" className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5 p-3">
      {toolList.map((tool) => (
        <IconButton
          key={tool.id}
          label={tool.label}
          shortcut={tool.shortcut}
          icon={toolIcon(tool.icon)}
          active={tool.id === activeToolId}
          onClick={() => set({ activeToolId: tool.id })}
          className="h-9 w-full border border-line bg-raised"
        />
      ))}
    </nav>
  );
}

// arm model switch above the visibility matrix, everything about the character's body in one place
export function BodyPartsPanel() {
  return (
    <>
      <ModelPanel />
      <LayersPanel />
    </>
  );
}

// visibility matrix for body parts and their base and outer layers
function LayersPanel() {
  const visibility = useUi((state) => state.visibility);
  const toggle = useUi((state) => state.toggleVisibility);
  const setLayer = useUi((state) => state.setLayerVisibility);
  return (
    <Section title="Visibility">
      <div className="grid grid-cols-[1fr_3rem_3rem] items-center gap-y-0.5 text-xs">
        <span />
        {LAYER_IDS.map((layer) => {
          const allOn = PART_IDS.every((part) => visibility[part][layer]);
          return (
            <button
              key={layer}
              type="button"
              title={`${allOn ? 'Hide' : 'Show'} all ${LAYER_LABELS[layer].toLowerCase()} layers`}
              onClick={() => setLayer(layer, !allOn)}
              className="h-6 rounded text-[11px] text-faint transition-colors hover:bg-hover hover:text-fg"
            >
              {LAYER_LABELS[layer]}
            </button>
          );
        })}
        {PART_IDS.map((part) => (
          <div key={part} className="contents">
            <span className="text-muted">{PART_LABELS[part]}</span>
            {LAYER_IDS.map((layer) => {
              const visible = visibility[part][layer];
              const Icon = visible ? Eye : EyeOff;
              return (
                <button
                  key={layer}
                  type="button"
                  aria-pressed={visible}
                  aria-label={`${PART_LABELS[part]} ${LAYER_LABELS[layer].toLowerCase()} layer visible`}
                  onClick={() => toggle(part, layer)}
                  className={`flex h-6 items-center justify-center rounded transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent ${visible ? 'text-fg' : 'text-faint'}`}
                >
                  <Icon className="size-3.5" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Section>
  );
}

// settings of the active tool plus the layer targeting rule for 3d painting
export function ToolSettingsPanel() {
  const toolList = useRegistry(tools);
  const activeToolId = useUi((state) => state.activeToolId);
  const brushSize = useUi((state) => state.brushSize);
  const paintTarget = useUi((state) => state.paintTarget);
  const set = useUi((state) => state.set);
  const active = toolList.find((item) => item.id === activeToolId);
  return (
    <Section>
      <p className="text-xs text-fg">
        {active?.label}
        {active?.hint && <span className="text-faint"> — {active.hint}</span>}
      </p>
      {active?.usesBrushSize && (
        <SliderRow
          label="Brush size"
          value={brushSize}
          min={1}
          max={4}
          unit="px"
          onChange={(value) => set({ brushSize: value })}
        />
      )}
      <div className="flex items-center gap-3 text-xs">
        <span className="w-20 shrink-0 text-muted">3D target</span>
        <Segmented<PaintTargetMode>
          label="3D paint target"
          className="flex-1"
          value={paintTarget}
          onChange={(value) => set({ paintTarget: value })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'base', label: 'Base' },
            { value: 'outer', label: 'Outer' },
          ]}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-faint">
        {paintTarget === 'auto'
          ? 'Paints the surface you see. Transparent outer pixels let strokes through to the base.'
          : paintTarget === 'base'
            ? 'Always paints the base layer, even under the outer layer.'
            : 'Always paints the outer layer, including its empty pixels.'}
      </p>
    </Section>
  );
}

// arm geometry switch, applied as an undoable command
function ModelPanel() {
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

// lists installed extensions with a switch that fully unloads or reloads each one
export function ExtensionsPanel() {
  const plugins = useRegistry(extensions);
  return (
    <Section title="Extensions">
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
