import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { hexToRgba, hsvToRgba, rgbaToHex, rgbaToHsv, sameColor, type Hsv, type Rgba } from '../../core/color';
import { Section } from '../primitives';
import { useUi } from '../store';

// starter swatches chosen to cover skin tones, fabrics and accents commonly used in skins
const PALETTE = [
  '#1a1c2c',
  '#5d275d',
  '#b13e53',
  '#ef7d57',
  '#ffcd75',
  '#a7f070',
  '#38b764',
  '#257179',
  '#29366f',
  '#3b5dc9',
  '#41a6f6',
  '#73eff7',
  '#f4f4f4',
  '#94b0c2',
  '#566c86',
  '#333c57',
  '#e0ac88',
  '#c98f6b',
  '#a8704f',
  '#7a4b33',
  '#4a2f24',
  '#2f1f18',
  '#e8c39e',
  '#ffe0c2',
].map((hex) => hexToRgba(hex)!);

// tracks a pointer drag over an element and reports normalized coordinates
function useDrag(onDrag: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const update = (event: ReactPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    onDrag(
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    );
  };
  return {
    ref,
    onPointerDown: (event: ReactPointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      update(event);
    },
    onPointerMove: (event: ReactPointerEvent) => {
      if (event.buttons & 1) update(event);
    },
  };
}

// small clickable color chip used by the palette and the recent colors row
function Swatch({ color, active, onPick }: { color: Rgba; active: boolean; onPick: (color: Rgba) => void }) {
  const hex = rgbaToHex(color);
  return (
    <button
      type="button"
      aria-label={`Use color ${hex}`}
      title={hex}
      onClick={() => onPick(color)}
      style={{ backgroundColor: hex }}
      className={`aspect-square rounded-sm ring-offset-2 ring-offset-panel transition-shadow hover:ring-1 hover:ring-fg/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${active ? 'ring-1 ring-fg' : ''}`}
    />
  );
}

// hsv color picker with hex input, palette and automatically collected recent colors
export function ColorPanel() {
  const color = useUi((state) => state.color);
  const recent = useUi((state) => state.recentColors);
  const set = useUi((state) => state.set);
  const [hsvState, setHsv] = useState<Hsv>(() => rgbaToHsv(color));
  const [draft, setDraft] = useState<string | null>(null);
  const hsv = sameColor(hsvToRgba(hsvState), color) ? hsvState : rgbaToHsv(color);
  const [h, s, v] = hsv;

  const choose = (next: Hsv) => {
    setHsv(next);
    set({ color: hsvToRgba(next) });
  };
  const square = useDrag((x, y) => choose([h, x, 1 - y]));
  const hue = useDrag((x) => choose([Math.min(359.9, x * 360), s, v]));
  const pick = (next: Rgba) => set({ color: next });

  return (
    <Section title="Color">
      <div
        {...square}
        data-testid="color-square"
        className="relative h-32 cursor-crosshair touch-none rounded-md"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`,
        }}
      >
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>
      <div
        {...hue}
        className="relative h-3 cursor-ew-resize touch-none rounded-full"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
      >
        <span
          className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${(h / 360) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span
          className="size-7 shrink-0 rounded-md border border-line"
          style={{ backgroundColor: rgbaToHex(color) }}
        />
        <input
          aria-label="Hex color"
          spellCheck={false}
          value={draft ?? rgbaToHex(color)}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = hexToRgba(event.target.value);
            if (parsed) set({ color: parsed });
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-back px-2 font-mono text-xs text-fg uppercase outline-none focus:border-accent"
        />
      </div>
      <div className="mt-1 grid grid-cols-8 gap-1.5">
        {PALETTE.map((swatch) => (
          <Swatch key={swatch.join()} color={swatch} active={sameColor(swatch, color)} onPick={pick} />
        ))}
      </div>
      {recent.length > 0 && (
        <>
          <p className="mt-1 text-[11px] text-faint">Recent</p>
          <div className="grid grid-cols-8 gap-1.5" data-testid="recent-colors">
            {recent.map((swatch) => (
              <Swatch key={swatch.join()} color={swatch} active={sameColor(swatch, color)} onPick={pick} />
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
