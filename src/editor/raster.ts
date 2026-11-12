import { SKIN_SIZE, type Rect } from '../core/skin-layout';

// square brush footprint clipped to a face so strokes never bleed into another uv island
export function brushIndices(rect: Rect, x: number, y: number, size: number): number[] {
  const out: number[] = [];
  const start = Math.floor((size - 1) / 2);
  for (let py = y - start; py < y - start + size; py++) {
    for (let px = x - start; px < x - start + size; px++) {
      if (px < rect.x || py < rect.y || px >= rect.x + rect.w || py >= rect.y + rect.h) continue;
      out.push(py * SKIN_SIZE + px);
    }
  }
  return out;
}

// bresenham line of brush stamps so fast pointer moves leave no gaps inside a face
export function lineIndices(
  rect: Rect,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
): number[] {
  const out = new Set<number>();
  let { x, y } = from;
  const dx = Math.abs(to.x - x);
  const dy = -Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    for (const index of brushIndices(rect, x, y, size)) out.add(index);
    if (x === to.x && y === to.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return [...out];
}

// four-connected flood fill bounded by the face rect, matching what users see as one surface
export function floodFill(pixels32: Uint32Array, rect: Rect, x: number, y: number): number[] {
  const target = pixels32[y * SKIN_SIZE + x]!;
  const seen = new Set<number>();
  const stack = [y * SKIN_SIZE + x];
  while (stack.length > 0) {
    const index = stack.pop()!;
    if (seen.has(index) || pixels32[index] !== target) continue;
    seen.add(index);
    const px = index % SKIN_SIZE;
    const py = (index - px) / SKIN_SIZE;
    if (px > rect.x) stack.push(index - 1);
    if (px < rect.x + rect.w - 1) stack.push(index + 1);
    if (py > rect.y) stack.push(index - SKIN_SIZE);
    if (py < rect.y + rect.h - 1) stack.push(index + SKIN_SIZE);
  }
  return [...seen];
}
