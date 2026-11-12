import { packRgba, unpackRgba, type Rgba } from '../../core/color';
import { SKIN_SIZE } from '../../core/skin-layout';
import { brushIndices, lineIndices } from '../../editor/raster';
import type { StrokeContext, Tool } from '../../editor/tool';
import type { Plugin } from '../api';

// scales a color's brightness while leaving transparent pixels untouched
function shade(color: Rgba, factor: number): Rgba {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value * factor)));
  return [channel(color[0]), channel(color[1]), channel(color[2]), color[3]];
}

// example extension adding lighten and darken brushes, a settings panel and a noise action
export const shadingPlugin: Plugin = {
  manifest: {
    id: 'builtin.shading',
    name: 'Shading tools',
    version: '1.0.0',
    description: 'Lighten and darken brushes plus a subtle noise pass.',
    apiVersion: 1,
    permissions: ['skin:read', 'skin:write', 'tools', 'panels', 'actions'],
  },
  activate(api) {
    let strength = 10;
    const touched = new WeakMap<StrokeContext, Set<number>>();

    const shadeTool = (
      id: string,
      label: string,
      icon: string,
      shortcut: string,
      direction: 1 | -1,
    ): Tool => {
      const stamp = (indices: number[], ctx: StrokeContext) => {
        let seen = touched.get(ctx);
        if (!seen) touched.set(ctx, (seen = new Set()));
        const factor = 1 + (direction * strength) / 100;
        const changes: Array<readonly [number, number]> = [];
        for (const index of indices) {
          if (seen.has(index)) continue;
          seen.add(index);
          const color = unpackRgba(ctx.skin.pixels32[index]!);
          if (color[3] > 0) changes.push([index, packRgba(shade(color, factor))]);
        }
        ctx.paint(changes);
      };
      return {
        id,
        label,
        icon,
        shortcut,
        usesBrushSize: true,
        hint: `${label} existing pixels by the shading strength`,
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
    };

    const addNoise = () => {
      const writes = [];
      for (let y = 0; y < SKIN_SIZE; y++) {
        for (let x = 0; x < SKIN_SIZE; x++) {
          const color = api.skin.getPixel(x, y);
          if (color[3] === 0) continue;
          const amount = ((Math.random() - 0.5) * strength) / 100;
          writes.push({ x, y, color: shade(color, 1 + amount) });
        }
      }
      api.edit.setPixels('Add noise', writes);
    };

    api.tools.register(shadeTool('shading.lighten', 'Lighten', 'sun', 'L', 1));
    api.tools.register(shadeTool('shading.darken', 'Darken', 'moon', 'D', -1));
    api.actions.register({ id: 'shading.noise', title: 'Add noise to skin', run: addNoise });
    api.panels.register({
      id: 'shading.settings',
      title: 'Shading',
      fields: [
        {
          type: 'slider',
          id: 'strength',
          label: 'Strength',
          min: 2,
          max: 30,
          step: 1,
          unit: '%',
          get: () => strength,
          set: (value) => {
            strength = value;
          },
        },
        { type: 'button', id: 'noise', label: 'Add noise to skin', run: addNoise },
      ],
    });
  },
};
