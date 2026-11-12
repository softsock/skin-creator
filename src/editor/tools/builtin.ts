import { packRgba, TRANSPARENT, unpackRgba, type Rgba } from '../../core/color';
import { SKIN_SIZE } from '../../core/skin-layout';
import { brushIndices, floodFill, lineIndices } from '../raster';
import type { StrokeContext, Tool } from '../tool';

// shared stroke behaviour for pencil and eraser, which differ only in the color written
function brushTool(
  base: Omit<Tool, 'onStrokeStart' | 'onStrokeMove'>,
  colorOf: (ctx: StrokeContext) => Rgba,
): Tool {
  const stamp = (indices: number[], ctx: StrokeContext) => {
    const color = packRgba(colorOf(ctx));
    ctx.paint(indices.map((index) => [index, color] as const));
  };
  return {
    ...base,
    usesBrushSize: true,
    onStrokeStart: (target, ctx) =>
      stamp(brushIndices(target.face.rect, target.x, target.y, ctx.brushSize), ctx),
    onStrokeMove: (target, previous, ctx) =>
      stamp(
        target.face === previous.face
          ? lineIndices(target.face.rect, previous, target, ctx.brushSize)
          : brushIndices(target.face.rect, target.x, target.y, ctx.brushSize),
        ctx,
      ),
  };
}

// draws opaque pixels with the selected color
export const pencilTool = brushTool(
  { id: 'pencil', label: 'Pencil', icon: 'pencil', shortcut: 'B', usesColor: true, hint: 'Paint pixels' },
  (ctx) => ctx.color,
);

// clears pixels to full transparency, the only way to remove outer layer content
export const eraserTool = brushTool(
  { id: 'eraser', label: 'Eraser', icon: 'eraser', shortcut: 'E', hint: 'Erase to transparent' },
  () => TRANSPARENT,
);

// samples a color from the skin so existing shades can be reused
export const eyedropperTool: Tool = {
  id: 'eyedropper',
  label: 'Color picker',
  icon: 'pipette',
  shortcut: 'I',
  hint: 'Pick a color from the skin',
  onStrokeStart(target, ctx) {
    const color = unpackRgba(ctx.skin.pixels32[target.y * SKIN_SIZE + target.x]!);
    if (color[3] > 0) ctx.pickColor([color[0], color[1], color[2], 255]);
  },
  onStrokeMove(target, _previous, ctx) {
    this.onStrokeStart(target, ctx);
  },
};

// recolors a contiguous area of one face in a single undo step
export const fillTool: Tool = {
  id: 'fill',
  label: 'Fill',
  icon: 'paint-bucket',
  shortcut: 'G',
  usesColor: true,
  hint: 'Fill a contiguous area of one face',
  onStrokeStart(target, ctx) {
    const color = packRgba(ctx.color);
    ctx.paint(
      floodFill(ctx.skin.pixels32, target.face.rect, target.x, target.y).map(
        (index) => [index, color] as const,
      ),
    );
  },
};

// default tool set registered at startup through the same registry plugins use
export const builtinTools: readonly Tool[] = [pencilTool, eraserTool, eyedropperTool, fillTool];
