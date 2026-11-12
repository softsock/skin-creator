// straight (non-premultiplied) 8-bit color exactly as it is stored in a minecraft skin png
export type Rgba = readonly [r: number, g: number, b: number, a: number];

// hue saturation value triple used by the picker so hue survives at zero saturation
export type Hsv = readonly [h: number, s: number, v: number];

// shared fully transparent color so erasing always writes the same canonical value
export const TRANSPARENT: Rgba = [0, 0, 0, 0];

// packs a color into the little-endian uint32 layout used by the document pixel view
export function packRgba([r, g, b, a]: Rgba): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// unpacks a document uint32 pixel back into channels for tools and ui readouts
export function unpackRgba(value: number): Rgba {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, value >>> 24];
}

// formats a color for hex inputs and swatch labels, ignoring alpha
export function rgbaToHex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// parses user typed hex colors so the picker can accept pasted values
export function hexToRgba(input: string): Rgba | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  const hex = match[1]!;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const value = parseInt(full, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff, 255];
}

// converts picker coordinates into a paintable opaque color
export function hsvToRgba([h, s, v]: Hsv): Rgba {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1), 255];
}

// derives picker coordinates from a color chosen via eyedropper, palette or hex input
export function rgbaToHsv([r, g, b]: Rgba): Hsv {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max === 0 ? 0 : delta / max, max / 255];
}

// compares colors by value because tuples are recreated on every edit
export function sameColor(a: Rgba, b: Rgba): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}
