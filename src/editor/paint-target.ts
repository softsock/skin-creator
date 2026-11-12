import type { FaceHit } from '../core/picking';
import type { ReadonlySkin } from '../core/skin-document';
import { SKIN_SIZE, type LayerId } from '../core/skin-layout';
import type { PixelTarget } from './tool';

// which minecraft layer 3d strokes land on, auto paints whatever is visible under the cursor
export type PaintTargetMode = 'auto' | LayerId;

// chooses the pixel a 3d pointer ray edits, letting rays pass through transparent outer pixels
export function resolvePaintTarget(
  hits: readonly FaceHit[],
  skin: ReadonlySkin,
  mode: PaintTargetMode,
): PixelTarget | null {
  for (const hit of hits) {
    const { layer } = hit.face;
    if (mode !== 'auto') {
      if (layer === mode) return hit;
      continue;
    }
    if (layer === 'base' || skin.pixels[(hit.y * SKIN_SIZE + hit.x) * 4 + 3]! > 0) return hit;
  }
  return null;
}
