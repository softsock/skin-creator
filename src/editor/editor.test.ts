import { describe, expect, it } from 'vitest';
import { packRgba, unpackRgba, type Rgba } from '../core/color';
import { Editor } from '../core/editor';
import { intersectFaces } from '../core/picking';
import { getSkinFaces, SKIN_SIZE, type SkinFace } from '../core/skin-layout';
import { resolvePaintTarget } from './paint-target';
import { brushIndices, floodFill, lineIndices } from './raster';
import type { Tool } from './tool';
import { ToolController } from './tool-controller';
import { eraserTool, eyedropperTool, fillTool, pencilTool } from './tools/builtin';

// base front face of the head, the island most assertions paint on
const headFront = getSkinFaces('classic').find(
  (f) => f.part === 'head' && f.layer === 'base' && f.face === 'front',
)!;

// builds a controller around a fresh editor with mutable tool and color state
function setup(tool: Tool, color: Rgba = [255, 0, 0, 255]) {
  const editor = new Editor();
  const state = { tool, color, brushSize: 1, used: [] as Rgba[] };
  const controller = new ToolController(editor, {
    activeTool: () => state.tool,
    color: () => state.color,
    brushSize: () => state.brushSize,
    setColor: (next) => (state.color = next),
    colorUsed: (next) => state.used.push(next),
  });
  const pixel = (x: number, y: number) => unpackRgba(editor.skin.pixels32[y * SKIN_SIZE + x]!);
  const at = (x: number, y: number, face: SkinFace = headFront) => ({ x, y, face });
  return { editor, state, controller, pixel, at };
}

describe('raster helpers', () => {
  it('clips brushes to the face rect', () => {
    expect(brushIndices(headFront.rect, 8, 8, 3)).toHaveLength(4);
    expect(brushIndices(headFront.rect, 12, 12, 3)).toHaveLength(9);
    expect(brushIndices(headFront.rect, 12, 12, 1)).toEqual([12 * SKIN_SIZE + 12]);
  });

  it('draws gapless lines', () => {
    const line = lineIndices(headFront.rect, { x: 8, y: 8 }, { x: 15, y: 11 }, 1);
    expect(line).toHaveLength(8);
    expect(line).toContain(8 * SKIN_SIZE + 8);
    expect(line).toContain(11 * SKIN_SIZE + 15);
  });

  it('fills only the contiguous region inside the face', () => {
    const pixels = new Uint32Array(SKIN_SIZE * SKIN_SIZE);
    for (let y = 8; y < 16; y++) pixels[y * SKIN_SIZE + 11] = 7;
    expect(floodFill(pixels, headFront.rect, 8, 8)).toHaveLength(24);
    expect(floodFill(pixels, headFront.rect, 12, 8)).toHaveLength(32);
    expect(floodFill(pixels, headFront.rect, 11, 9)).toHaveLength(8);
  });
});

describe('tools', () => {
  it('pencil paints a connected stroke as a single undo step', () => {
    const { editor, controller, pixel, at, state } = setup(pencilTool);
    controller.begin(at(8, 8));
    controller.move(at(11, 8));
    controller.move(at(11, 10));
    controller.end();
    for (const [x, y] of [
      [8, 8],
      [9, 8],
      [10, 8],
      [11, 8],
      [11, 9],
      [11, 10],
    ] as const) {
      expect(pixel(x, y)).toEqual([255, 0, 0, 255]);
    }
    expect(state.used).toEqual([[255, 0, 0, 255]]);
    editor.undo();
    expect(editor.skin.pixels.every((value) => value === 0)).toBe(true);
    expect(editor.canUndo).toBe(false);
  });

  it('separate strokes are separate undo steps', () => {
    const { editor, controller, pixel, at } = setup(pencilTool);
    controller.begin(at(8, 8));
    controller.end();
    controller.begin(at(9, 9));
    controller.end();
    editor.undo();
    expect(pixel(8, 8)[3]).toBe(255);
    expect(pixel(9, 9)[3]).toBe(0);
  });

  it('does not interpolate across different faces', () => {
    const { controller, pixel, at } = setup(pencilTool);
    const top = getSkinFaces('classic').find(
      (f) => f.part === 'head' && f.layer === 'base' && f.face === 'top',
    )!;
    controller.begin(at(8, 8));
    controller.move(at(15, 0, top));
    controller.end();
    expect(pixel(15, 0)[3]).toBe(255);
    expect(pixel(12, 4)[3]).toBe(0);
  });

  it('eraser writes canonical transparent pixels', () => {
    const { editor, state, controller, pixel, at } = setup(pencilTool);
    controller.begin(at(8, 8));
    controller.end();
    state.tool = eraserTool;
    controller.begin(at(8, 8));
    controller.end();
    expect(pixel(8, 8)).toEqual([0, 0, 0, 0]);
    editor.undo();
    expect(pixel(8, 8)).toEqual([255, 0, 0, 255]);
  });

  it('fill recolors one face region and eyedropper reads it back', () => {
    const { editor, state, controller, pixel, at } = setup(fillTool, [10, 20, 30, 255]);
    controller.begin(at(9, 9));
    controller.end();
    expect(pixel(8, 8)).toEqual([10, 20, 30, 255]);
    expect(pixel(15, 15)).toEqual([10, 20, 30, 255]);
    expect(pixel(16, 8)[3]).toBe(0);
    expect(editor.skin.pixels32.filter((value) => value === packRgba([10, 20, 30, 255]))).toHaveLength(64);
    state.tool = eyedropperTool;
    state.color = [1, 1, 1, 255];
    controller.begin(at(40, 8));
    expect(state.color).toEqual([1, 1, 1, 255]);
    controller.begin(at(10, 10));
    expect(state.color).toEqual([10, 20, 30, 255]);
  });

  it('respects the brush size only for tools that use it', () => {
    const { state, controller, pixel, at } = setup(pencilTool);
    state.brushSize = 2;
    controller.begin(at(10, 10));
    controller.end();
    expect([pixel(10, 10)[3], pixel(11, 11)[3], pixel(12, 12)[3]]).toEqual([255, 255, 0]);
  });
});

describe('3d paint target', () => {
  const faces = getSkinFaces('classic');
  const ray = { origin: [-3.5, 31.5, 50], direction: [0, 0, -1] } as const;

  it('lets rays pass through transparent outer pixels in auto mode', () => {
    const editor = new Editor();
    const hits = intersectFaces(ray, faces);
    expect(resolvePaintTarget(hits, editor.skin, 'auto')).toMatchObject({
      x: 8,
      y: 8,
      face: { layer: 'base' },
    });
    editor.execute(editor.createPixelPatch('Hat', [[8 * SKIN_SIZE + 40, packRgba([1, 2, 3, 255])]]));
    expect(resolvePaintTarget(hits, editor.skin, 'auto')).toMatchObject({
      x: 40,
      y: 8,
      face: { layer: 'outer' },
    });
  });

  it('forces a layer when requested', () => {
    const editor = new Editor();
    const hits = intersectFaces(ray, faces);
    expect(resolvePaintTarget(hits, editor.skin, 'outer')).toMatchObject({ x: 40, y: 8 });
    expect(resolvePaintTarget(hits, editor.skin, 'base')).toMatchObject({ x: 8, y: 8 });
    expect(resolvePaintTarget([], editor.skin, 'auto')).toBeNull();
  });
});
