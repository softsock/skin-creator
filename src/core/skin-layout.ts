// model space vector in skin pixels with y up and the character facing +z
export type Vec3 = readonly [x: number, y: number, z: number];

// arm geometry variant selected by the player profile in minecraft
export type SkinModel = 'classic' | 'slim';

// body parts that minecraft maps to separate uv islands
export type PartId = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';

// minecraft skin layers, the outer one is the inflated overlay shell
export type LayerId = 'base' | 'outer';

// box sides named from the character's own point of view
export type FaceId = 'top' | 'bottom' | 'right' | 'front' | 'left' | 'back';

// texture rectangle in skin pixels with a top-left origin
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// one textured quad, the single description shared by rendering, picking and the 2d view
export interface SkinFace {
  readonly index: number;
  readonly part: PartId;
  readonly layer: LayerId;
  readonly face: FaceId;
  readonly rect: Rect;
  readonly origin: Vec3;
  readonly uAxis: Vec3;
  readonly vAxis: Vec3;
  readonly uLength: number;
  readonly vLength: number;
  readonly normal: Vec3;
}

// edge length of the only texture size supported by the mvp
export const SKIN_SIZE = 64;

// stable display and iteration order for parts across panels and meshes
export const PART_IDS: readonly PartId[] = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];

// stable iteration order for layers across panels and meshes
export const LAYER_IDS: readonly LayerId[] = ['base', 'outer'];

// human readable part names for panels and the status bar
export const PART_LABELS: Record<PartId, string> = {
  head: 'Head',
  body: 'Body',
  rightArm: 'Right arm',
  leftArm: 'Left arm',
  rightLeg: 'Right leg',
  leftLeg: 'Left leg',
};

// box description from which all six faces of a part layer are derived
interface BoxDef {
  readonly part: PartId;
  readonly size: Vec3;
  readonly center: Vec3;
  readonly uv: Record<LayerId, readonly [number, number]>;
  readonly inflate: number;
}

// minecraft java 64x64 box layout, arms narrow to three pixels for the slim model
function boxDefs(model: SkinModel): BoxDef[] {
  const arm = model === 'slim' ? 3 : 4;
  const armX = 4 + arm / 2;
  return [
    { part: 'head', size: [8, 8, 8], center: [0, 28, 0], uv: { base: [0, 0], outer: [32, 0] }, inflate: 0.5 },
    {
      part: 'body',
      size: [8, 12, 4],
      center: [0, 18, 0],
      uv: { base: [16, 16], outer: [16, 32] },
      inflate: 0.25,
    },
    {
      part: 'rightArm',
      size: [arm, 12, 4],
      center: [-armX, 18, 0],
      uv: { base: [40, 16], outer: [40, 32] },
      inflate: 0.25,
    },
    {
      part: 'leftArm',
      size: [arm, 12, 4],
      center: [armX, 18, 0],
      uv: { base: [32, 48], outer: [48, 48] },
      inflate: 0.25,
    },
    {
      part: 'rightLeg',
      size: [4, 12, 4],
      center: [-2, 6, 0],
      uv: { base: [0, 16], outer: [0, 32] },
      inflate: 0.25,
    },
    {
      part: 'leftLeg',
      size: [4, 12, 4],
      center: [2, 6, 0],
      uv: { base: [16, 48], outer: [0, 48] },
      inflate: 0.25,
    },
  ];
}

// expands one box layer into six faces following the minecraft box uv unwrap
function boxFaces(def: BoxDef, layer: LayerId, startIndex: number): SkinFace[] {
  const [w, h, d] = def.size;
  const [cx, cy, cz] = def.center;
  const [u, v] = def.uv[layer];
  const e = layer === 'outer' ? def.inflate : 0;
  const hx = w / 2 + e;
  const hy = h / 2 + e;
  const hz = d / 2 + e;
  const X = 2 * hx;
  const Y = 2 * hy;
  const Z = 2 * hz;
  const specs: Array<[FaceId, Rect, Vec3, Vec3, Vec3, number, number, Vec3]> = [
    ['top', { x: u + d, y: v, w, h: d }, [cx - hx, cy + hy, cz - hz], [1, 0, 0], [0, 0, 1], X, Z, [0, 1, 0]],
    [
      'bottom',
      { x: u + d + w, y: v, w, h: d },
      [cx - hx, cy - hy, cz - hz],
      [1, 0, 0],
      [0, 0, 1],
      X,
      Z,
      [0, -1, 0],
    ],
    [
      'right',
      { x: u, y: v + d, w: d, h },
      [cx - hx, cy + hy, cz - hz],
      [0, 0, 1],
      [0, -1, 0],
      Z,
      Y,
      [-1, 0, 0],
    ],
    [
      'front',
      { x: u + d, y: v + d, w, h },
      [cx - hx, cy + hy, cz + hz],
      [1, 0, 0],
      [0, -1, 0],
      X,
      Y,
      [0, 0, 1],
    ],
    [
      'left',
      { x: u + d + w, y: v + d, w: d, h },
      [cx + hx, cy + hy, cz + hz],
      [0, 0, -1],
      [0, -1, 0],
      Z,
      Y,
      [1, 0, 0],
    ],
    [
      'back',
      { x: u + 2 * d + w, y: v + d, w, h },
      [cx + hx, cy + hy, cz - hz],
      [-1, 0, 0],
      [0, -1, 0],
      X,
      Y,
      [0, 0, -1],
    ],
  ];
  return specs.map(([face, rect, origin, uAxis, vAxis, uLength, vLength, normal], i) => ({
    index: startIndex + i,
    part: def.part,
    layer,
    face,
    rect,
    origin,
    uAxis,
    vAxis,
    uLength,
    vLength,
    normal,
  }));
}

// cache so every consumer shares identical face objects per model
const faceCache = new Map<SkinModel, readonly SkinFace[]>();

// returns all 72 faces of a model, ordered by part then layer then side
export function getSkinFaces(model: SkinModel): readonly SkinFace[] {
  let faces = faceCache.get(model);
  if (!faces) {
    const list: SkinFace[] = [];
    for (const def of boxDefs(model)) {
      for (const layer of LAYER_IDS) list.push(...boxFaces(def, layer, list.length));
    }
    faces = list;
    faceCache.set(model, faces);
  }
  return faces;
}

// cache for the pixel ownership lookup, which is rebuilt only per model
const faceMapCache = new Map<SkinModel, Int16Array>();

// maps every texture pixel to the face that owns it, or -1 for unused texture space
export function getFaceMap(model: SkinModel): Int16Array {
  let map = faceMapCache.get(model);
  if (!map) {
    map = new Int16Array(SKIN_SIZE * SKIN_SIZE).fill(-1);
    for (const face of getSkinFaces(model)) {
      const { x, y, w, h } = face.rect;
      for (let py = y; py < y + h; py++) map.fill(face.index, py * SKIN_SIZE + x, py * SKIN_SIZE + x + w);
    }
    faceMapCache.set(model, map);
  }
  return map;
}

// model space corners of one texture pixel, used to draw the 3d hover cursor
export function pixelCorners(face: SkinFace, px: number, py: number): [Vec3, Vec3, Vec3, Vec3] {
  const su = face.uLength / face.rect.w;
  const sv = face.vLength / face.rect.h;
  const at = (i: number, j: number): Vec3 => [
    face.origin[0] + face.uAxis[0] * su * i + face.vAxis[0] * sv * j,
    face.origin[1] + face.uAxis[1] * su * i + face.vAxis[1] * sv * j,
    face.origin[2] + face.uAxis[2] * su * i + face.vAxis[2] * sv * j,
  ];
  const i = px - face.rect.x;
  const j = py - face.rect.y;
  return [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
}

// short description of a face for the status bar
export function describeFace(face: SkinFace): string {
  return `${PART_LABELS[face.part]} · ${face.layer === 'base' ? 'Base' : 'Outer'} · ${face.face}`;
}
