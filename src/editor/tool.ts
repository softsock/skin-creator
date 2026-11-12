import type { Rgba } from '../core/color';
import type { PixelChange } from '../core/commands';
import type { ReadonlySkin } from '../core/skin-document';
import type { SkinFace } from '../core/skin-layout';

// a resolved texture pixel under the pointer, identical for the 2d and 3d views
export interface PixelTarget {
  readonly x: number;
  readonly y: number;
  readonly face: SkinFace;
}

// everything a tool may touch during a stroke, deliberately narrower than the editor
export interface StrokeContext {
  readonly skin: ReadonlySkin;
  readonly color: Rgba;
  readonly brushSize: number;
  paint(changes: Iterable<PixelChange>): void;
  pickColor(color: Rgba): void;
}

// contract implemented by built-in tools and plugins alike, described with plain data
export interface Tool {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly shortcut?: string;
  readonly hint?: string;
  readonly usesColor?: boolean;
  readonly usesBrushSize?: boolean;
  onStrokeStart(target: PixelTarget, ctx: StrokeContext): void;
  onStrokeMove?(target: PixelTarget, previous: PixelTarget, ctx: StrokeContext): void;
}
