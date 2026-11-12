import { describe, expect, it } from 'vitest';
import { hexToRgba, hsvToRgba, packRgba, rgbaToHex, rgbaToHsv, unpackRgba } from './color';
import { PixelPatchCommand, ReplaceSkinCommand, SetModelCommand } from './commands';
import { createDefaultSkin } from './default-skin';
import { Editor } from './editor';
import { intersectFaces } from './picking';
import { getFaceMap, getSkinFaces, pixelCorners, SKIN_SIZE, type SkinFace } from './skin-layout';

// finds one face by its coordinates in the layout for readable assertions
function face(model: 'classic' | 'slim', part: string, layer: string, side: string): SkinFace {
  return getSkinFaces(model).find((f) => f.part === part && f.layer === layer && f.face === side)!;
}

describe('color', () => {
  it('round-trips packing, hex and hsv', () => {
    const color = [12, 200, 77, 255] as const;
    expect(unpackRgba(packRgba(color))).toEqual(color);
    expect(rgbaToHex(color)).toBe('#0cc84d');
    expect(hexToRgba('#0CC84D')).toEqual(color);
    expect(hexToRgba('#abc')).toEqual([170, 187, 204, 255]);
    expect(hexToRgba('nope')).toBeNull();
    expect(hsvToRgba(rgbaToHsv(color))).toEqual(color);
  });
});

describe('skin layout', () => {
  it('matches the minecraft 64x64 uv table', () => {
    expect(face('classic', 'head', 'base', 'front').rect).toEqual({ x: 8, y: 8, w: 8, h: 8 });
    expect(face('classic', 'head', 'outer', 'top').rect).toEqual({ x: 40, y: 0, w: 8, h: 8 });
    expect(face('classic', 'body', 'base', 'back').rect).toEqual({ x: 32, y: 20, w: 8, h: 12 });
    expect(face('classic', 'rightArm', 'base', 'front').rect).toEqual({ x: 44, y: 20, w: 4, h: 12 });
    expect(face('classic', 'leftArm', 'outer', 'front').rect).toEqual({ x: 52, y: 52, w: 4, h: 12 });
    expect(face('classic', 'leftLeg', 'base', 'bottom').rect).toEqual({ x: 24, y: 48, w: 4, h: 4 });
    expect(face('classic', 'rightLeg', 'outer', 'right').rect).toEqual({ x: 0, y: 36, w: 4, h: 12 });
  });

  it('narrows slim arms to three pixels without moving other parts', () => {
    expect(face('slim', 'rightArm', 'base', 'front').rect).toEqual({ x: 44, y: 20, w: 3, h: 12 });
    expect(face('slim', 'rightArm', 'base', 'back').rect).toEqual({ x: 51, y: 20, w: 3, h: 12 });
    expect(face('slim', 'leftArm', 'base', 'left').rect).toEqual({ x: 39, y: 52, w: 4, h: 12 });
    expect(face('slim', 'head', 'base', 'front')).toEqual(face('classic', 'head', 'base', 'front'));
  });

  it('never assigns a texture pixel to two faces', () => {
    for (const model of ['classic', 'slim'] as const) {
      const owners = new Uint8Array(SKIN_SIZE * SKIN_SIZE);
      for (const f of getSkinFaces(model)) {
        for (let y = f.rect.y; y < f.rect.y + f.rect.h; y++) {
          for (let x = f.rect.x; x < f.rect.x + f.rect.w; x++) owners[y * SKIN_SIZE + x]!++;
        }
      }
      expect(Math.max(...owners)).toBe(1);
      const used = owners.reduce((sum, n) => sum + n, 0);
      expect(used).toBe(model === 'classic' ? 3264 : 3136);
      expect(getFaceMap(model).filter((index) => index >= 0).length).toBe(used);
    }
  });

  it('keeps axes orthonormal and inflates only the outer layer', () => {
    for (const f of getSkinFaces('classic')) {
      const dot = (a: readonly number[], b: readonly number[]) =>
        a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
      expect(dot(f.uAxis, f.vAxis)).toBe(0);
      expect(dot(f.uAxis, f.normal)).toBe(0);
      expect(dot(f.vAxis, f.normal)).toBe(0);
      const inflate = f.layer === 'base' ? 0 : f.part === 'head' ? 1 : 0.5;
      expect(f.uLength).toBe(f.rect.w + inflate);
      expect(f.vLength).toBe(f.rect.h + inflate);
    }
  });

  it('places the character right arm on negative x and the face on positive z', () => {
    expect(face('classic', 'rightArm', 'base', 'front').origin[0]).toBe(-8);
    expect(face('classic', 'leftArm', 'base', 'front').origin[0]).toBe(4);
    expect(face('classic', 'head', 'base', 'front').origin).toEqual([-4, 32, 4]);
    const corners = pixelCorners(face('classic', 'head', 'base', 'front'), 8, 8);
    expect(corners[0]).toEqual([-4, 32, 4]);
    expect(corners[2]).toEqual([-3, 31, 4]);
  });
});

describe('picking', () => {
  const faces = getSkinFaces('classic');

  it('maps a ray through the face to the right texture pixel', () => {
    const hits = intersectFaces({ origin: [-3.5, 31.5, 50], direction: [0, 0, -1] }, faces);
    expect(hits[0]!.face.layer).toBe('outer');
    expect(hits.find((hit) => hit.face.layer === 'base')).toMatchObject({
      x: 8,
      y: 8,
      face: { part: 'head', face: 'front' },
    });
  });

  it('mirrors horizontally when looking at the back', () => {
    const hits = intersectFaces({ origin: [-3.5, 31.5, -50], direction: [0, 0, 1] }, faces);
    expect(hits.find((hit) => hit.face.layer === 'base')).toMatchObject({
      x: 31,
      y: 8,
      face: { face: 'back' },
    });
  });

  it('culls base back faces, keeps outer shells double sided and sorts by distance', () => {
    const hits = intersectFaces({ origin: [0, 28, 50], direction: [0, 0, -1] }, faces);
    expect(hits.map((hit) => `${hit.face.layer}:${hit.face.face}`)).toEqual([
      'outer:front',
      'base:front',
      'outer:back',
    ]);
    expect(hits[0]!.distance).toBeLessThan(hits[1]!.distance);
  });

  it('clamps hits on the far edge into the face', () => {
    const hits = intersectFaces({ origin: [4, 24, 50], direction: [0, 0, -1] }, faces);
    const base = hits.find((hit) => hit.face.layer === 'base' && hit.face.part === 'head')!;
    expect(base).toMatchObject({ x: 15, y: 15 });
  });

  it('misses when the ray passes beside the model', () => {
    expect(intersectFaces({ origin: [30, 16, 50], direction: [0, 0, -1] }, faces)).toEqual([]);
  });
});

describe('editor commands', () => {
  it('applies, undoes and redoes pixel patches', () => {
    const editor = new Editor();
    const red = packRgba([255, 0, 0, 255]);
    expect(editor.execute(editor.createPixelPatch('Paint', [[5, red]]))).toBe(true);
    expect(editor.skin.pixels32[5]).toBe(red);
    expect(editor.isDirty).toBe(true);
    editor.undo();
    expect(editor.skin.pixels32[5]).toBe(0);
    expect(editor.isDirty).toBe(false);
    editor.redo();
    expect(editor.skin.pixels32[5]).toBe(red);
    expect(editor.canRedo).toBe(false);
  });

  it('ignores patches that change nothing', () => {
    const editor = new Editor();
    expect(editor.execute(editor.createPixelPatch('Noop', [[5, 0]]))).toBe(false);
    expect(editor.canUndo).toBe(false);
  });

  it('merges a stroke into one undo step that restores the original pixels', () => {
    const editor = new Editor();
    const a = packRgba([1, 2, 3, 255]);
    const b = packRgba([9, 9, 9, 255]);
    editor.execute(editor.createPixelPatch('Base', [[7, a]]));
    editor.execute(editor.createPixelPatch('Stroke', [[7, b]], 's1'));
    editor.execute(
      editor.createPixelPatch(
        'Stroke',
        [
          [8, b],
          [7, a],
        ],
        's1',
      ),
    );
    editor.execute(editor.createPixelPatch('Stroke', [[9, b]], 's2'));
    editor.undo();
    expect(editor.skin.pixels32[9]).toBe(0);
    expect(editor.skin.pixels32[8]).toBe(b);
    editor.undo();
    expect([editor.skin.pixels32[7], editor.skin.pixels32[8]]).toEqual([a, 0]);
    editor.undo();
    expect(editor.skin.pixels32[7]).toBe(0);
    expect(editor.canUndo).toBe(false);
  });

  it('clears redo history on a new edit and tracks the saved state', () => {
    const editor = new Editor();
    editor.execute(editor.createPixelPatch('A', [[1, 5]]));
    editor.markSaved();
    expect(editor.isDirty).toBe(false);
    editor.undo();
    expect(editor.isDirty).toBe(true);
    editor.execute(editor.createPixelPatch('B', [[2, 5]]));
    expect(editor.canRedo).toBe(false);
  });

  it('switches model and replaces the whole skin undoably', () => {
    const editor = new Editor({ pixels: createDefaultSkin('classic'), model: 'classic', name: 'A' });
    const before = editor.skin.pixels.slice();
    const changes: string[] = [];
    editor.subscribeDocument((change) => changes.push(change));
    editor.execute(new SetModelCommand('slim'));
    expect(editor.skin.model).toBe('slim');
    editor.execute(
      new ReplaceSkinCommand('Import', {
        pixels: new Uint8Array(before.length),
        model: 'classic',
        name: 'B',
      }),
    );
    expect(editor.skin.name).toBe('B');
    expect(editor.skin.pixels.every((value) => value === 0)).toBe(true);
    editor.undo();
    expect(editor.skin.pixels).toEqual(before);
    expect([editor.skin.model, editor.skin.name]).toEqual(['slim', 'A']);
    editor.undo();
    expect(editor.skin.model).toBe('classic');
    expect(changes).toContain('model');
    expect(changes).toContain('pixels');
  });

  it('does not let a patch write outside the texture', () => {
    const editor = new Editor();
    expect(
      PixelPatchCommand.create(editor.skin as never, 'Out', [
        [-1, 5],
        [SKIN_SIZE * SKIN_SIZE, 5],
      ]),
    ).toBeNull();
  });
});

describe('default skin', () => {
  it('only paints mapped pixels and covers the whole base layer', () => {
    for (const model of ['classic', 'slim'] as const) {
      const pixels = createDefaultSkin(model);
      const map = getFaceMap(model);
      const faces = getSkinFaces(model);
      for (let i = 0; i < map.length; i++) {
        const alpha = pixels[i * 4 + 3]!;
        if (map[i]! < 0) expect(alpha).toBe(0);
        else if (faces[map[i]!]!.layer === 'base') expect(alpha).toBe(255);
      }
    }
  });
});
