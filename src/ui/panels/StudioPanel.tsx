import { Download, RotateCcw } from 'lucide-react';
import { presets, viewportFor } from '../../app/app';
import { exportRender } from '../../app/files';
import { useRegistry } from '../hooks';
import { Button, Section, Segmented, SliderRow, SwitchRow } from '../primitives';
import { formatShortcut } from '../shortcuts';
import { useUi } from '../store';

// backdrop choices offered on top of each preset's own background
const BACKDROPS: ReadonlyArray<{ label: string; color: string | null }> = [
  { label: 'Preset default', color: null },
  { label: 'Graphite', color: '#2b2d33' },
  { label: 'Black', color: '#0b0c0e' },
  { label: 'Mist', color: '#cfd6df' },
  { label: 'Paper', color: '#f1efe9' },
  { label: 'Deep blue', color: '#1f2c44' },
  { label: 'Moss', color: '#27362c' },
];

// sidebar for studio mode: lighting, backdrop, camera, effects and render export
export function StudioPanel() {
  const studio = useUi((state) => state.studio);
  const setStudio = useUi((state) => state.setStudio);
  const presetList = useRegistry(presets);
  useUi((state) => state.viewportSize);
  useUi((state) => state.views);
  const size = (viewportFor(['render']) ?? viewportFor(['3d']))?.exportSize(studio.exportScale);

  return (
    <>
      <Section title="Lighting">
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Lighting preset">
          {presetList.map((preset) => {
            const active = preset.id === studio.presetId;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStudio({ presetId: preset.id })}
                className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent ${active ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-line-strong hover:bg-hover'}`}
              >
                <span
                  className="size-6 shrink-0 rounded-full border border-white/10"
                  style={{
                    background: `radial-gradient(circle at 32% 30%, ${preset.key.color}, ${preset.background} 78%)`,
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-fg">{preset.label}</span>
                  <span className="block truncate text-[11px] text-faint">{preset.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Backdrop">
        <div className="flex flex-wrap gap-1.5">
          {BACKDROPS.map(({ label, color }) => {
            const active = !studio.transparent && studio.background === color;
            const preset = presets.get(studio.presetId);
            return (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={`${label} backdrop`}
                aria-pressed={active}
                disabled={studio.transparent}
                onClick={() => setStudio({ background: color })}
                style={{ backgroundColor: color ?? preset?.background }}
                className={`relative size-6 rounded-md border border-white/10 ring-offset-2 ring-offset-panel transition-shadow hover:ring-1 hover:ring-fg/60 disabled:opacity-35 ${active ? 'ring-1 ring-fg' : ''}`}
              >
                {color === null && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white/80 mix-blend-difference">
                    A
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <SwitchRow
          label="Transparent background"
          checked={studio.transparent}
          onChange={(transparent) => setStudio({ transparent })}
        />
      </Section>

      <Section
        title="Camera"
        action={
          <Button onClick={() => viewportFor(['render', '3d'])?.resetCamera()} className="-mr-1.5 h-6 px-1.5">
            <RotateCcw className="size-3" /> Reset
          </Button>
        }
      >
        <SliderRow
          label="Field of view"
          value={studio.fov}
          min={12}
          max={60}
          unit="°"
          onChange={(fov) => setStudio({ fov })}
        />
        <p className="text-[11px] leading-relaxed text-faint">
          Drag to orbit, right-drag to pan, scroll to zoom.
        </p>
      </Section>

      <Section title="Effects">
        <SwitchRow
          label="Ambient occlusion"
          checked={studio.ambientOcclusion}
          onChange={(ambientOcclusion) => setStudio({ ambientOcclusion })}
        />
        <SwitchRow
          label="Soft shadows"
          checked={studio.shadows}
          onChange={(shadows) => setStudio({ shadows })}
        />
      </Section>

      <Section title="Export render">
        <div className="flex items-center gap-3 text-xs">
          <span className="w-20 shrink-0 text-muted">Resolution</span>
          <Segmented<string>
            label="Export resolution"
            className="flex-1"
            value={String(studio.exportScale)}
            onChange={(value) => setStudio({ exportScale: Number(value) })}
            options={[
              { value: '1', label: '1×' },
              { value: '2', label: '2×' },
              { value: '4', label: '4×' },
            ]}
          />
        </div>
        {size && (
          <p className="text-[11px] text-faint tabular-nums" data-testid="export-size">
            {size.width} × {size.height} px PNG{studio.transparent ? ' with alpha' : ''}
          </p>
        )}
        <Button variant="primary" className="mt-1 h-8" onClick={() => void exportRender()}>
          <Download className="size-3.5" /> Export render
          <kbd className="ml-1 font-sans text-[10px] opacity-60">{formatShortcut('Mod+E')}</kbd>
        </Button>
      </Section>
    </>
  );
}
