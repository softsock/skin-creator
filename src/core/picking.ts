import type { SkinFace, Vec3 } from './skin-layout';

// world space ray, kept free of three.js so picking is testable without a gpu
export interface Ray {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

// a ray hit resolved to the exact texture pixel under the cursor
export interface FaceHit {
  readonly face: SkinFace;
  readonly x: number;
  readonly y: number;
  readonly distance: number;
}

// dot product helper for the tuple based vectors used by the layout
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// intersects a ray with skin faces analytically so hits can never land outside a uv island
export function intersectFaces(ray: Ray, faces: readonly SkinFace[]): FaceHit[] {
  const hits: FaceHit[] = [];
  for (const face of faces) {
    const denom = dot(ray.direction, face.normal);
    if (Math.abs(denom) < 1e-9) continue;
    if (face.layer === 'base' && denom > 0) continue;
    const toOrigin: Vec3 = [
      face.origin[0] - ray.origin[0],
      face.origin[1] - ray.origin[1],
      face.origin[2] - ray.origin[2],
    ];
    const distance = dot(toOrigin, face.normal) / denom;
    if (distance <= 0) continue;
    const local: Vec3 = [
      ray.direction[0] * distance - toOrigin[0],
      ray.direction[1] * distance - toOrigin[1],
      ray.direction[2] * distance - toOrigin[2],
    ];
    const s = dot(local, face.uAxis);
    const t = dot(local, face.vAxis);
    if (s < 0 || t < 0 || s > face.uLength || t > face.vLength) continue;
    const { x, y, w, h } = face.rect;
    hits.push({
      face,
      x: x + Math.min(w - 1, Math.floor((s / face.uLength) * w)),
      y: y + Math.min(h - 1, Math.floor((t / face.vLength) * h)),
      distance,
    });
  }
  return hits.sort((a, b) => a.distance - b.distance);
}
