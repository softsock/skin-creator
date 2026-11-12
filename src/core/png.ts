import { convertIndexedToRgb, decode, encode, type DecodedPng } from 'fast-png';
import { getSkinFaces, SKIN_SIZE, type SkinModel } from './skin-layout';

// user facing import failure, separated from programming errors so the ui can show it
export class SkinFormatError extends Error {}

// normalizes every png color type to straight rgba8 without canvas premultiplication loss
function toRgba8(png: DecodedPng): Uint8Array {
  const count = png.width * png.height;
  const out = new Uint8Array(count * 4);
  if (png.palette) {
    const stride = png.palette[0]!.length;
    const data = convertIndexedToRgb(png);
    for (let i = 0; i < count; i++) {
      out[i * 4] = data[i * stride]!;
      out[i * 4 + 1] = data[i * stride + 1]!;
      out[i * 4 + 2] = data[i * stride + 2]!;
      out[i * 4 + 3] = stride === 4 ? data[i * stride + 3]! : 255;
    }
    return out;
  }
  if (png.depth !== 8 && png.depth !== 16) {
    throw new SkinFormatError(`Unsupported PNG bit depth (${png.depth}-bit grayscale).`);
  }
  const { channels, data, transparency } = png;
  const shift = png.depth === 16 ? 8 : 0;
  const hasAlpha = channels === 2 || channels === 4;
  const colorChannels = hasAlpha ? channels - 1 : channels;
  for (let i = 0; i < count; i++) {
    const at = i * channels;
    const gray = colorChannels === 1;
    out[i * 4] = data[at]! >> shift;
    out[i * 4 + 1] = data[gray ? at : at + 1]! >> shift;
    out[i * 4 + 2] = data[gray ? at : at + 2]! >> shift;
    let alpha = hasAlpha ? data[at + colorChannels]! >> shift : 255;
    if (transparency?.length === colorChannels) {
      let keyed = true;
      for (let c = 0; c < colorChannels; c++) keyed &&= data[at + c] === transparency[c];
      if (keyed) alpha = 0;
    }
    out[i * 4 + 3] = alpha;
  }
  return out;
}

// decodes and validates an imported skin, returning exact straight-alpha pixels
export function decodeSkinPng(bytes: Uint8Array): Uint8Array {
  let png: DecodedPng;
  try {
    png = decode(bytes);
  } catch {
    throw new SkinFormatError('This file is not a valid PNG image.');
  }
  if (png.width === 64 && png.height === 32) {
    throw new SkinFormatError('Legacy 64×32 skins are not supported yet. Convert the skin to 64×64 first.');
  }
  if (png.width !== SKIN_SIZE || png.height !== SKIN_SIZE) {
    throw new SkinFormatError(`Expected a 64×64 Minecraft skin, got ${png.width}×${png.height}.`);
  }
  return toRgba8(png);
}

// encodes the document as the 8-bit rgba non-interlaced png that minecraft expects
export function encodeSkinPng(pixels: Uint8Array): Uint8Array {
  return encode({ width: SKIN_SIZE, height: SKIN_SIZE, data: pixels, channels: 4, depth: 8 });
}

// guesses the arm model of an imported skin from the columns only classic arms use
export function inferSkinModel(pixels: Uint8Array): SkinModel {
  const slimOwned = new Set<number>();
  for (const face of getSkinFaces('slim')) {
    if (face.layer !== 'base' || !face.part.endsWith('Arm')) continue;
    for (let y = face.rect.y; y < face.rect.y + face.rect.h; y++) {
      for (let x = face.rect.x; x < face.rect.x + face.rect.w; x++) slimOwned.add(y * SKIN_SIZE + x);
    }
  }
  for (const face of getSkinFaces('classic')) {
    if (face.layer !== 'base' || !face.part.endsWith('Arm')) continue;
    for (let y = face.rect.y; y < face.rect.y + face.rect.h; y++) {
      for (let x = face.rect.x; x < face.rect.x + face.rect.w; x++) {
        const index = y * SKIN_SIZE + x;
        if (!slimOwned.has(index) && pixels[index * 4 + 3]! > 0) return 'classic';
      }
    }
  }
  return 'slim';
}
