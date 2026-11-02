import { BoxGeometry, CylinderGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Box = { p: readonly [number, number, number]; s: readonly [number, number, number]; ry?: number };

/** Many static boxes of one material → one geometry (one draw call per pass). */
export function mergedBoxes(boxes: readonly Box[]): BufferGeometry {
  const parts = boxes.map((b) => {
    const g = new BoxGeometry(b.s[0], b.s[1], b.s[2]);
    if (b.ry) g.rotateY(b.ry);
    g.translate(b.p[0], b.p[1], b.p[2]);
    return g;
  });
  const merged = mergeGeometries(parts, false) ?? new BoxGeometry(0, 0, 0);
  for (const g of parts) g.dispose();
  return merged;
}

export type Cyl = { p: readonly [number, number, number]; r: number; h: number; r2?: number; seg?: number; rx?: number; rz?: number };

export function mergedCylinders(cyls: readonly Cyl[]): BufferGeometry {
  const parts = cyls.map((c) => {
    const g = new CylinderGeometry(c.r2 ?? c.r, c.r, c.h, c.seg ?? 14);
    if (c.rx) g.rotateX(c.rx);
    if (c.rz) g.rotateZ(c.rz);
    g.translate(c.p[0], c.p[1], c.p[2]);
    return g;
  });
  const merged = mergeGeometries(parts, false) ?? new CylinderGeometry(0, 0, 0);
  for (const g of parts) g.dispose();
  return merged;
}

/** Deterministic pseudo-random in [0, 1) from an integer seed (stable set dressing across reloads). */
export const hash01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
