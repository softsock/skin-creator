import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { ReadonlySkin } from '../core/skin-document';
import {
  getSkinFaces,
  LAYER_IDS,
  PART_IDS,
  SKIN_SIZE,
  type LayerId,
  type PartId,
  type SkinFace,
  type SkinModel,
} from '../core/skin-layout';

// per part and layer visibility flags shared by the layers panel, meshes and picking
export type Visibility = Record<PartId, Record<LayerId, boolean>>;

// default state with every part and layer shown
export function allVisible(): Visibility {
  const entries = PART_IDS.map((part) => [part, { base: true, outer: true }] as const);
  return Object.fromEntries(entries) as Visibility;
}

// builds one indexed geometry from skin faces with uvs taken straight from the layout
function buildGeometry(faces: readonly SkinFace[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const uvRects: number[] = [];
  const indices: number[] = [];
  for (const face of faces) {
    const { origin: o, uAxis: u, vAxis: v, uLength: ul, vLength: vl, normal: n, rect } = face;
    const base = positions.length / 3;
    const corners: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (const [a, b] of corners) {
      positions.push(
        o[0] + u[0] * ul * a + v[0] * vl * b,
        o[1] + u[1] * ul * a + v[1] * vl * b,
        o[2] + u[2] * ul * a + v[2] * vl * b,
      );
      normals.push(...n);
      uvs.push((rect.x + rect.w * a) / SKIN_SIZE, (rect.y + rect.h * b) / SKIN_SIZE);
      uvRects.push(
        (rect.x + 0.5) / SKIN_SIZE,
        (rect.y + 0.5) / SKIN_SIZE,
        (rect.x + rect.w - 0.5) / SKIN_SIZE,
        (rect.y + rect.h - 0.5) / SKIN_SIZE,
      );
    }
    const cross =
      (v[1] * u[2] - v[2] * u[1]) * n[0] +
      (v[2] * u[0] - v[0] * u[2]) * n[1] +
      (v[0] * u[1] - v[1] * u[0]) * n[2];
    if (cross > 0) indices.push(base, base + 3, base + 2, base, base + 2, base + 1);
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setAttribute('uvRect', new BufferAttribute(new Float32Array(uvRects), 4));
  geometry.setIndex(indices);
  return geometry;
}

// patches the standard shader to clamp sampling inside each face and to draw empty base pixels
function patchSkinShader(shader: WebGLProgramParametersWithUniforms, layer: LayerId): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 uvRect;\nvarying vec4 vUvRect;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUvRect = uvRect;');
  const sample =
    layer === 'base'
      ? `
        vec2 skinUv = clamp( vMapUv, vUvRect.xy, vUvRect.zw );
        vec4 sampledDiffuseColor = texture2D( map, skinUv );
        vec2 cell = floor( skinUv * ${SKIN_SIZE}.0 );
        vec3 emptyColor = vec3( mod( cell.x + cell.y, 2.0 ) < 1.0 ? 0.030 : 0.042 );
        diffuseColor.rgb *= mix( emptyColor, sampledDiffuseColor.rgb, sampledDiffuseColor.a );`
      : `
        vec4 sampledDiffuseColor = texture2D( map, clamp( vMapUv, vUvRect.xy, vUvRect.zw ) );
        diffuseColor *= sampledDiffuseColor;`;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec4 vUvRect;')
    .replace('#include <map_fragment>', sample);
}

// three.js representation of the skin, rebuilt from the layout and fed by the document buffer
export class SkinObject {
  readonly group = new Group();
  readonly texture: DataTexture;
  private readonly materials: Record<LayerId, MeshStandardMaterial>;
  private meshes = new Map<string, Mesh>();
  private visibility = allVisible();
  private emptyOuter = new Set<PartId>();

  constructor(private readonly skin: ReadonlySkin) {
    this.texture = new DataTexture(skin.pixels, SKIN_SIZE, SKIN_SIZE, RGBAFormat, UnsignedByteType);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    const material = (layer: LayerId) => {
      const result = new MeshStandardMaterial({
        map: this.texture,
        roughness: 0.9,
        metalness: 0,
        side: layer === 'base' ? FrontSide : DoubleSide,
        transparent: layer === 'outer',
        alphaTest: layer === 'outer' ? 0.01 : 0,
      });
      result.onBeforeCompile = (shader) => patchSkinShader(shader, layer);
      result.customProgramCacheKey = () => `skin-${layer}`;
      return result;
    };
    this.materials = { base: material('base'), outer: material('outer') };
    this.rebuild();
    this.refreshPixels();
  }

  // recreates meshes after the arm model changed
  rebuild(): void {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    this.meshes.clear();
    const faces = getSkinFaces(this.skin.model);
    for (const part of PART_IDS) {
      for (const layer of LAYER_IDS) {
        const mesh = new Mesh(
          buildGeometry(faces.filter((face) => face.part === part && face.layer === layer)),
          this.materials[layer],
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.meshes.set(`${part}:${layer}`, mesh);
        this.group.add(mesh);
      }
    }
    this.applyVisibility();
  }

  // uploads the latest pixels and hides empty outer shells so they cast no shadow or occlusion
  refreshPixels(): void {
    this.texture.needsUpdate = true;
    this.emptyOuter.clear();
    for (const part of PART_IDS) this.emptyOuter.add(part);
    for (const face of getSkinFaces(this.skin.model)) {
      if (face.layer !== 'outer' || !this.emptyOuter.has(face.part)) continue;
      const { x, y, w, h } = face.rect;
      scan: for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          if (this.skin.pixels[(py * SKIN_SIZE + px) * 4 + 3]! > 0) {
            this.emptyOuter.delete(face.part);
            break scan;
          }
        }
      }
    }
    this.applyVisibility();
  }

  // applies user visibility choices from the layers panel
  setVisibility(visibility: Visibility): void {
    this.visibility = visibility;
    this.applyVisibility();
  }

  // faces that can currently be hit by the pointer, matching what is toggled visible
  pickableFaces(model: SkinModel): SkinFace[] {
    return getSkinFaces(model).filter((face) => this.visibility[face.part][face.layer]);
  }

  // combines user visibility with the empty shell optimisation
  private applyVisibility(): void {
    for (const [key, mesh] of this.meshes) {
      const [part, layer] = key.split(':') as [PartId, LayerId];
      mesh.visible = this.visibility[part][layer] && !(layer === 'outer' && this.emptyOuter.has(part));
    }
  }

  // releases gpu resources when the viewport is torn down
  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.geometry.dispose();
    this.materials.base.dispose();
    this.materials.outer.dispose();
    this.texture.dispose();
  }
}
