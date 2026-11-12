import { packRgba, type Rgba } from './color';
import {
  getSkinFaces,
  SKIN_SIZE,
  type FaceId,
  type LayerId,
  type PartId,
  type SkinModel,
} from './skin-layout';

// painter callback receiving face-local pixel coordinates and the face size
type FacePainter = (i: number, j: number, w: number, h: number) => Rgba | null;

// original palette for the starter character so no mojang artwork is shipped
const C = {
  skin: [224, 172, 136, 255],
  skinShade: [201, 148, 114, 255],
  hair: [58, 40, 32, 255],
  hairLight: [78, 55, 42, 255],
  eyeWhite: [244, 244, 246, 255],
  iris: [52, 94, 150, 255],
  mouth: [178, 112, 98, 255],
  hoodie: [46, 160, 120, 255],
  hoodieTrim: [33, 120, 92, 255],
  cord: [222, 236, 229, 255],
  pants: [52, 58, 76, 255],
  shoe: [234, 234, 240, 255],
  sole: [148, 150, 162, 255],
} satisfies Record<string, Rgba>;

// cheap deterministic noise so the starter skin has texture without randomness in tests
function jitter(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// procedurally paints the starter character, doubling as a live check of the uv layout
export function createDefaultSkin(model: SkinModel): Uint8Array {
  const pixels = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  const pixels32 = new Uint32Array(pixels.buffer);
  const faces = getSkinFaces(model);
  const paint = (part: PartId, layer: LayerId, sides: FaceId[], painter: FacePainter) => {
    for (const face of faces) {
      if (face.part !== part || face.layer !== layer || !sides.includes(face.face)) continue;
      const { x, y, w, h } = face.rect;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const color = painter(i, j, w, h);
          if (!color) continue;
          const vertical = face.face === 'top' || face.face === 'bottom' ? 0 : (j / h) * 0.1;
          const k = 1 - vertical + (jitter(x + i, y + j) - 0.5) * 0.07;
          pixels32[(y + j) * SKIN_SIZE + x + i] = packRgba([
            Math.min(255, Math.round(color[0] * k)),
            Math.min(255, Math.round(color[1] * k)),
            Math.min(255, Math.round(color[2] * k)),
            color[3],
          ]);
        }
      }
    }
  };
  const all: FaceId[] = ['top', 'bottom', 'right', 'front', 'left', 'back'];
  const around: FaceId[] = ['right', 'front', 'left', 'back'];

  paint('head', 'base', all, () => C.skin);
  paint('head', 'base', ['bottom'], () => C.skinShade);
  paint('head', 'base', ['top'], () => C.hair);
  paint('head', 'base', ['back'], (_, j) => (j < 6 ? C.hair : null));
  paint('head', 'base', ['right'], (i, j) => (j < 3 || (j < 6 && i < 4) ? C.hair : null));
  paint('head', 'base', ['left'], (i, j) => (j < 3 || (j < 6 && i >= 4) ? C.hair : null));
  paint('head', 'base', ['front'], (i, j) => {
    if (j < 2 || (j === 2 && (i === 0 || i === 7))) return C.hair;
    if (j === 4 && (i === 1 || i === 6)) return C.eyeWhite;
    if (j === 4 && (i === 2 || i === 5)) return C.iris;
    if (j === 6 && (i === 3 || i === 4)) return C.mouth;
    return null;
  });
  paint('head', 'outer', ['top'], () => C.hairLight);
  paint('head', 'outer', ['back'], (_, j) => (j < 7 ? C.hairLight : null));
  paint('head', 'outer', ['right'], (i, j) => (j < 2 || (j < 5 && i < 3) ? C.hairLight : null));
  paint('head', 'outer', ['left'], (i, j) => (j < 2 || (j < 5 && i >= 5) ? C.hairLight : null));
  paint('head', 'outer', ['front'], (i, j) =>
    j === 0 || (j === 1 && i !== 3) || (j === 2 && i > 5) ? C.hairLight : null,
  );

  paint('body', 'base', all, () => C.hoodie);
  paint('body', 'base', ['bottom'], () => C.pants);
  paint('body', 'base', around, (_, j, __, h) => (j === h - 1 ? C.hoodieTrim : null));
  paint('body', 'base', ['front'], (i, j) => {
    if (j === 0 && (i === 3 || i === 4)) return C.skin;
    if (j >= 1 && j <= 3 && (i === 2 || i === 5)) return C.cord;
    if (j >= 7 && j <= 9 && i >= 2 && i <= 5) return C.hoodieTrim;
    return null;
  });
  paint('body', 'outer', ['back'], (i, j) => (j < 4 && i >= 1 && i <= 6 ? C.hoodieTrim : null));
  paint('body', 'outer', ['front'], (i, j) => (j === 0 && i !== 3 && i !== 4 ? C.hoodieTrim : null));
  paint('body', 'outer', ['right', 'left'], (_, j) => (j === 0 ? C.hoodieTrim : null));

  for (const arm of ['rightArm', 'leftArm'] as const) {
    paint(arm, 'base', all, () => C.hoodie);
    paint(arm, 'base', ['bottom'], () => C.skinShade);
    paint(arm, 'base', around, (_, j) => (j >= 9 ? C.skin : null));
    paint(arm, 'outer', around, (_, j) => (j === 7 || j === 8 ? C.hoodieTrim : null));
  }

  for (const leg of ['rightLeg', 'leftLeg'] as const) {
    paint(leg, 'base', all, () => C.pants);
    paint(leg, 'base', ['bottom'], () => C.sole);
    paint(leg, 'base', around, (_, j) => (j === 11 ? C.sole : j >= 9 ? C.shoe : null));
  }
  return pixels;
}
