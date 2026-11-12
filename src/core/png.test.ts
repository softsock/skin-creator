import { decode, encode } from 'fast-png';
import { describe, expect, it } from 'vitest';
import { createDefaultSkin } from './default-skin';
import { decodeSkinPng, encodeSkinPng, inferSkinModel, SkinFormatError } from './png';
import { SKIN_SIZE } from './skin-layout';

// builds a test skin with opaque, fully transparent and semi-transparent pixels everywhere
function noisySkin(seed: number): Uint8Array {
  const pixels = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  let state = seed;
  for (let i = 0; i < pixels.length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    pixels[i] = state >>> 24;
  }
  for (let i = 0; i < 400; i++) pixels[i * 4 + 3] = i % 3 === 0 ? 0 : 255;
  return pixels;
}

describe('skin png codec', () => {
  it('round-trips every pixel exactly, including semi-transparent ones and unused areas', () => {
    for (const source of [noisySkin(1), createDefaultSkin('classic'), createDefaultSkin('slim')]) {
      const decoded = decodeSkinPng(encodeSkinPng(source));
      expect(decoded).toEqual(source);
      expect(decodeSkinPng(encodeSkinPng(decoded))).toEqual(source);
    }
  });

  it('writes the 8-bit rgba format minecraft expects', () => {
    const png = decode(encodeSkinPng(noisySkin(2)));
    expect([png.width, png.height, png.channels, png.depth]).toEqual([64, 64, 4, 8]);
    expect(png.palette).toBeUndefined();
  });

  it('decodes rgb, grayscale, 16-bit and indexed pngs to rgba', () => {
    const count = SKIN_SIZE * SKIN_SIZE;
    const rgb = new Uint8Array(count * 3).fill(0);
    rgb.set([10, 20, 30], 0);
    const fromRgb = decodeSkinPng(encode({ width: 64, height: 64, data: rgb, channels: 3, depth: 8 }));
    expect([...fromRgb.slice(0, 8)]).toEqual([10, 20, 30, 255, 0, 0, 0, 255]);

    const grayAlpha = new Uint8Array(count * 2);
    grayAlpha.set([200, 128], 0);
    const fromGray = decodeSkinPng(encode({ width: 64, height: 64, data: grayAlpha, channels: 2, depth: 8 }));
    expect([...fromGray.slice(0, 8)]).toEqual([200, 200, 200, 128, 0, 0, 0, 0]);

    const deep = new Uint16Array(count * 4);
    deep.set([0xffff, 0x8000, 0x0000, 0xffff], 0);
    const fromDeep = decodeSkinPng(encode({ width: 64, height: 64, data: deep, channels: 4, depth: 16 }));
    expect([...fromDeep.slice(0, 4)]).toEqual([255, 128, 0, 255]);

    const indices = new Uint8Array(count);
    indices[0] = 2;
    indices[1] = 1;
    const palette = [
      [0, 0, 0, 0],
      [0, 0, 255, 100],
      [255, 0, 0, 255],
    ];
    const fromIndexed = decodeSkinPng(
      encode({ width: 64, height: 64, data: indices, channels: 1, depth: 8, palette }),
    );
    expect([...fromIndexed.slice(0, 12)]).toEqual([255, 0, 0, 255, 0, 0, 255, 100, 0, 0, 0, 0]);
  });

  it('rejects other sizes, legacy skins and broken files with readable errors', () => {
    const png = (width: number, height: number) =>
      encode({ width, height, data: new Uint8Array(width * height * 4), channels: 4, depth: 8 });
    expect(() => decodeSkinPng(png(128, 128))).toThrow(SkinFormatError);
    expect(() => decodeSkinPng(png(64, 32))).toThrow(/Legacy 64×32/);
    expect(() => decodeSkinPng(new Uint8Array([1, 2, 3]))).toThrow(/not a valid PNG/);
  });

  it('infers the arm model from the pixels only classic arms use', () => {
    expect(inferSkinModel(createDefaultSkin('classic'))).toBe('classic');
    expect(inferSkinModel(createDefaultSkin('slim'))).toBe('slim');
  });
});
