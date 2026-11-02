import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { groundY, rng, type Tree } from "../engine/world";

/** Procedural, art-directed geometry for the forest. Albedo (and baked AO) lives in vertex colours. */

const c = new Color();
const lin = (hex: string) => new Color(hex);

/** Give a geometry a colour attribute from a per-vertex function (position, normal) → Color. */
export function paint(g: BufferGeometry, fn: (p: Vector3, n: Vector3, i: number) => Color | string) {
  const pos = g.getAttribute("position");
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const nor = g.getAttribute("normal");
  const col = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const v = fn(p, n, i);
    const cc = typeof v === "string" ? c.set(v) : v;
    col[i * 3] = cc.r;
    col[i * 3 + 1] = cc.g;
    col[i * 3 + 2] = cc.b;
  }
  g.setAttribute("color", new BufferAttribute(col, 3));
  return g;
}

/** Keep only position/normal/color, non-indexed, so geometries merge. */
function clean(g: BufferGeometry) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== "position" && k !== "normal" && k !== "color") out.deleteAttribute(k);
  return out;
}

export function merge(parts: BufferGeometry[]) {
  const g = mergeGeometries(parts.map(clean), false);
  if (!g) throw new Error("merge failed");
  return g;
}

const xf = (g: BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scl: [number, number, number] = [1, 1, 1]) => {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rot[0]);
  q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rot[1]));
  q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rot[2]));
  g.applyMatrix4(new Matrix4().compose(new Vector3(...pos), q, new Vector3(...scl)));
  return g;
};

const noise3 = (x: number, y: number, z: number, s: number) =>
  Math.sin(x * 1.7 + s) * Math.sin(y * 1.3 + s * 0.7) * Math.sin(z * 1.9 + s * 1.3) + 0.5 * Math.sin(x * 3.1 - z * 2.3 + y * 1.1 + s * 2.1);

/**
 * A giant trunk: tapering, with buttressed root flare (five lobes), bark ridges, baked ground AO
 * and moss on the shady side near the base. Local origin at ground level, axis +Y.
 */
export function trunkGeometry(t: Pick<Tree, "r" | "h" | "lean" | "seed">, radial = 32, rings = 28) {
  const R = rng(t.seed);
  const lobe = R() * 6.28;
  const moss = R() * 6.28;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const bark = lin("#5a2e1c");
  const groove = lin("#2a140c");
  const mossC = lin("#3d5a1e");
  const top = t.h * 0.82;
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const y = -0.9 + (top + 0.9) * v ** 1.7;
    const taper = 1 - 0.58 * Math.max(0, y / t.h) ** 0.85;
    const flareAmt = 1.45 * Math.exp(-Math.max(0, y) / (t.r * 0.85));
    for (let i = 0; i <= radial; i++) {
      const th = (i / radial) * Math.PI * 2;
      const lobes = 0.5 + 0.5 * Math.cos(5 * th + lobe) * (0.75 + 0.25 * Math.cos(3 * th + lobe * 2));
      const ridge = 1 + 0.075 * Math.sin(th * 17 + y * 0.25 + t.seed) + 0.03 * Math.sin(th * 39 - y * 0.6);
      const rr = t.r * taper * (1 + flareAmt * lobes) * ridge;
      pos.push(Math.cos(th) * rr + t.lean * y, y, Math.sin(th) * rr);
      const g = Math.min(1, Math.max(0, (Math.sin(th * 17 + y * 0.25 + t.seed) + 1) / 2));
      c.copy(groove).lerp(bark, 0.25 + 0.75 * g);
      const streak = 0.85 + 0.3 * Math.sin(th * 5 + y * 0.07 + t.seed * 3);
      c.multiplyScalar(streak);
      const m = Math.max(0, Math.cos(th - moss)) ** 1.5 * Math.exp(-Math.max(0, y) / 5.5);
      c.lerp(mossC, Math.min(0.85, m * 1.1));
      const ao = 0.38 + 0.62 * Math.min(1, Math.max(0, (y + 0.4) / 3.5));
      c.multiplyScalar(ao);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = radial + 1;
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < radial; i++) {
      const a = j * row + i;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A leaf clump: a lumpy, flattened blob, light on top and dark underneath. Unit radius. */
export function canopyBlob(seed = 3, detail = 2) {
  const g = mergeVertices(new IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv"));
  const pos = g.getAttribute("position");
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const k = 1 + 0.28 * noise3(p.x * 2.2, p.y * 2.2, p.z * 2.2, seed) + 0.1 * noise3(p.x * 6, p.y * 6, p.z * 6, seed * 2);
    p.multiplyScalar(k);
    p.y *= 0.58;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  const topC = lin("#5d7d2c");
  const midC = lin("#2c4a1c");
  const botC = lin("#101d0c");
  return paint(g, (q) => {
    const h = (q.y / 0.58 + 1) / 2;
    return c.copy(botC).lerp(midC, Math.min(1, h * 1.6)).lerp(topC, Math.max(0, h - 0.55) * 1.6);
  });
}

/** A fern: arching fronds with serrated leaflets. Double-sided. Unit ≈ 1 m tall. */
export function fernGeometry(fronds = 12, seed = 5) {
  const R = rng(seed);
  const parts: BufferGeometry[] = [];
  const base = lin("#1c3512");
  const tip = lin("#6f9c35");
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + R() * 0.4;
    const len = 0.8 + R() * 0.45;
    const lift = 0.9 + R() * 0.5;
    const segs = 28;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const s = i / segs;
      const r = s * len;
      const y = Math.sin(s * Math.PI * 0.8) * 0.55 * lift - s * s * 0.25;
      const w = 0.13 * Math.sin(Math.PI * Math.min(1, s * 1.05)) * (1 - 0.3 * s) * (i % 2 ? 1 : 0.3);
      const cx = Math.cos(yaw);
      const cz = Math.sin(yaw);
      const px = -cz;
      const pz = cx;
      pos.push(cx * r - px * w, y, cz * r - pz * w, cx * r + px * w, y + w * 0.25, cz * r + pz * w);
      c.copy(base).lerp(tip, s ** 0.8);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push(g);
  }
  return merge(parts);
}

export function rockGeometry(seed = 9) {
  const g = mergeVertices(new DodecahedronGeometry(1, 1).deleteAttribute("normal").deleteAttribute("uv"));
  const pos = g.getAttribute("position");
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    p.multiplyScalar(1 + 0.22 * noise3(p.x * 2, p.y * 2, p.z * 2, seed));
    p.y = p.y * 0.62 + 0.25;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  const stone = lin("#4d4f47");
  const moss = lin("#3a5a1c");
  return paint(g, (q, n) => c.copy(stone).multiplyScalar(0.8 + 0.3 * Math.sin(q.x * 5 + q.z * 3)).lerp(moss, Math.max(0, n.y - 0.35) * 1.4));
}

export function bushGeometry() {
  const parts = [
    xf(canopyBlob(21, 1), [0, 0.45, 0], [0, 0, 0], [0.9, 0.9, 0.9]),
    xf(canopyBlob(22, 1), [0.55, 0.35, 0.2], [0, 1, 0], [0.6, 0.65, 0.6]),
    xf(canopyBlob(23, 1), [-0.45, 0.3, -0.25], [0, 2, 0], [0.65, 0.6, 0.65]),
  ];
  const g = merge(parts);
  const col = g.getAttribute("color") as BufferAttribute;
  for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * 0.9, col.getY(i) * 1.05, col.getZ(i) * 0.8);
  return g;
}

/** Ground heightfield over a rectangle (x0..x1, z0..z1). Colour r = 1 lets the shader draw the path. */
export function groundGeometry(x0: number, x1: number, z0: number, z1: number, sx: number, sz: number, pathMask = 1, drop = 0) {
  const g = new PlaneGeometry(x1 - x0, z1 - z0, sx, sz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(pos.getX(i), pos.getZ(i)) - drop);
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return paint(g, () => c.setRGB(pathMask, 1, 1));
}

/** A mountain range: a jagged ridge with slopes, kilometres wide. */
export function ridgeGeometry(z: number, height: number, seed: number, base = -60, width = 9000, segs = 220) {
  const R = rng(seed);
  const ph = [R() * 6, R() * 6, R() * 6, R() * 6];
  const prof = (x: number) => {
    const u = x / width;
    const v =
      0.55 * Math.abs(Math.sin(u * 7.1 + ph[0])) +
      0.3 * Math.abs(Math.sin(u * 17.3 + ph[1])) +
      0.15 * Math.abs(Math.sin(u * 41.7 + ph[2])) +
      0.08 * Math.sin(u * 97 + ph[3]);
    return base + height * (0.35 + 0.75 * v);
  };
  const rows = [
    { dz: 260, k: 0 },
    { dz: 120, k: 0.55 },
    { dz: 0, k: 1 },
    { dz: -200, k: 0.6 },
  ];
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rows)
    for (let i = 0; i <= segs; i++) {
      const x = -width / 2 + (i / segs) * width;
      const top = prof(x);
      pos.push(x, base + (top - base) * r.k, z + r.dz);
    }
  const row = segs + 1;
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < segs; i++) {
      const a = j * row + i;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const rock = lin("#3f4652");
  const snow = lin("#d9e2ea");
  const forest = lin("#1b2a1c");
  const hmax = base + height * 1.3;
  return paint(g, (q) => {
    const h = (q.y - base) / (hmax - base);
    return c.copy(forest).lerp(rock, Math.min(1, h * 2.2)).lerp(snow, Math.max(0, (h - 0.72) * 4));
  });
}

export function coniferGeometry() {
  const g = new ConeGeometry(0.32, 1, 7, 1);
  g.translate(0, 0.5, 0);
  return paint(g, (p) => c.set("#2b4426").lerp(lin("#56783c"), p.y));
}

export function skyGeometry() {
  return new SphereGeometry(5200, 48, 24);
}

/** Cabin: 6 × 4.6 m log walls, gable roof to 4.6 m, stone chimney, warm window. Origin at ground centre. */
export function cabinGeometry() {
  const parts: BufferGeometry[] = [];
  const logA = lin("#6b4428");
  const logB = lin("#4c2f1b");
  for (let i = 0; i < 10; i++) {
    const y = 0.15 + i * 0.27;
    const col = i % 2 ? logA : logB;
    for (const [w, d, x, z] of [
      [6.3, 0.3, 0, 2.15],
      [6.3, 0.3, 0, -2.15],
      [0.3, 4.6, 3.0, 0],
      [0.3, 4.6, -3.0, 0],
    ] as const) {
      const g = new CylinderGeometry(0.15, 0.15, w > d ? w : d, 8);
      g.rotateZ(Math.PI / 2);
      if (d > w) g.rotateY(Math.PI / 2);
      parts.push(paint(xf(g, [x, y, z]), () => col));
    }
  }
  parts.push(paint(xf(new BoxGeometry(5.8, 2.7, 4.1), [0, 1.4, 0]), () => "#3b2616"));
  // Gable roof
  const roofC = lin("#2a2420");
  for (const s of [1, -1]) parts.push(paint(xf(new BoxGeometry(7.2, 0.18, 3.2), [0, 3.6, s * 1.25], [s * 0.72, 0, 0]), () => roofC));
  const gable = new BufferGeometry();
  gable.setAttribute("position", new Float32BufferAttribute([-3, 2.85, 2.1, 3, 2.85, 2.1, 0, 4.5, 2.1, 3, 2.85, -2.1, -3, 2.85, -2.1, 0, 4.5, -2.1], 3));
  gable.computeVertexNormals();
  parts.push(paint(gable, () => logB));
  parts.push(paint(xf(new BoxGeometry(0.8, 1.6, 0.8), [2.2, 4.4, -0.6]), () => "#5d5a52"));
  parts.push(paint(xf(new BoxGeometry(1.0, 1.9, 0.1), [-1.2, 0.95, 2.32]), () => "#24170d"));
  parts.push(paint(xf(new BoxGeometry(1.0, 0.8, 0.1), [1.4, 1.6, 2.32]), () => "#ffcf6a"));
  return merge(parts);
}

/** Split-rail fence along −Z: posts every 2.2 m, 1.1 m tall. Origin at the first post's foot. */
export function fenceGeometry(posts = 4, spacing = 2.3) {
  const parts: BufferGeometry[] = [];
  const wood = lin("#a8987f");
  const dark = lin("#8a7a64");
  for (let i = 0; i < posts; i++) {
    parts.push(paint(xf(new BoxGeometry(0.14, 1.1, 0.14), [0, 0.55, -i * spacing], [0, i * 0.3, 0.03 * Math.sin(i * 2.1)]), () => dark));
    if (i < posts - 1)
      for (const y of [0.45, 0.88]) parts.push(paint(xf(new BoxGeometry(0.07, 0.1, spacing + 0.25), [0.02, y, -(i + 0.5) * spacing], [0.02 * Math.sin(i + y * 9), 0, 0]), () => wood));
  }
  return merge(parts);
}

/** A stylised deer, 1.6 m to the top of the head (antlers add a little). Faces +X. */
export function deerGeometry() {
  const parts: BufferGeometry[] = [];
  const coat = lin("#8a5a34");
  const belly = lin("#c9a27a");
  const dark = lin("#3a2414");
  const body = paint(xf(new SphereGeometry(1, 16, 10), [0, 1.0, 0], [0, 0, 0], [0.72, 0.36, 0.3]), (p) => (p.y < 0.92 ? belly : coat));
  parts.push(body);
  parts.push(paint(xf(new CylinderGeometry(0.11, 0.16, 0.65, 8), [0.62, 1.32, 0], [0, 0, -0.75]), () => coat));
  parts.push(paint(xf(new SphereGeometry(1, 12, 8), [0.88, 1.54, 0], [0, 0, -0.3], [0.22, 0.12, 0.11]), () => coat));
  parts.push(paint(xf(new SphereGeometry(1, 8, 6), [1.06, 1.5, 0], [0, 0, 0], [0.05, 0.05, 0.05]), () => dark));
  for (const s of [1, -1]) {
    parts.push(paint(xf(new ConeGeometry(0.05, 0.16, 6), [0.8, 1.66, s * 0.09], [s * 0.6, 0, 0]), () => coat));
    parts.push(paint(xf(new CylinderGeometry(0.015, 0.02, 0.32, 5), [0.86, 1.78, s * 0.08], [s * 0.35, 0, -0.2]), () => "#cdb592"));
    parts.push(paint(xf(new CylinderGeometry(0.012, 0.015, 0.14, 5), [0.93, 1.86, s * 0.13], [s * 0.9, 0, -0.6]), () => "#cdb592"));
  }
  for (const [x, z] of [
    [0.45, 0.13],
    [0.45, -0.13],
    [-0.48, 0.13],
    [-0.48, -0.13],
  ] as const)
    parts.push(paint(xf(new CylinderGeometry(0.035, 0.045, 0.9, 6), [x, 0.45, z]), (p) => (p.y < 0.08 ? dark : coat)));
  parts.push(paint(xf(new ConeGeometry(0.06, 0.18, 6), [-0.74, 1.06, 0], [0, 0, 1.9]), () => belly));
  return merge(parts);
}
