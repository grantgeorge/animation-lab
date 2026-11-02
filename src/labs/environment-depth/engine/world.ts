/**
 * The forest, in metres. Pure data and math: every placement is deterministic (seeded), so the
 * world, the readouts and the tests all agree. The film camera looks down −Z along a mossy path.
 */
export type Vec3 = readonly [number, number, number];

/** Full-frame 16:9 gate (mm), as in the shared optics. */
export const GATE = { widthMm: 36, heightMm: 20.25 } as const;
export const ASPECT = 16 / 9;
export const NEAR = 0.2;
export const FAR = 6000;

/** Pip: a 1.05 m child standing on the path. The cap adds 7 cm (the rig is normalised to 1.12 m). */
export const PIP = { root: [0.35, 0, -6] as Vec3, heightM: 1.05, capM: 1.12 } as const;

/** The hero tree height every scale readout uses (a coast-redwood scale giant). */
export const TREE_HEIGHT_M = 62;

/** Depth bands measured from the camera: foreground, midground, background. */
export const BANDS = { fgM: 5, mgM: 45 } as const;

export const PATH = { halfWidthM: 1.25, straightToZ: -58, curve: 0.0042 } as const;

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Path centreline: straight along −Z through Pip, then bending left into the clearing. */
export function pathCenterX(z: number) {
  return z > PATH.straightToZ ? 0 : -PATH.curve * (z - PATH.straightToZ) ** 2;
}

/** Ground height (m). Flat on the path, rolling in the forest, then dropping into the valley. */
export function groundY(x: number, z: number) {
  const off = Math.abs(x - pathCenterX(z));
  const roll = 0.9 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.4) + 0.5 * Math.sin(x * 0.23 - z * 0.17);
  let y = roll * smoothstep(2.2, 16, off) * 1.5 + 0.06 * Math.sin(x * 0.9) * Math.sin(z * 0.7);
  y -= smoothstep(-112, -210, z) * 46;
  // Hills rise out of the valley, far beyond the forest.
  const hz = smoothstep(-330, -760, z);
  if (hz > 0) y += hz * (95 + 55 * Math.sin(x * 0.0061 + 0.8) + 30 * Math.sin(x * 0.017 - z * 0.004));
  return y;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Tree {
  x: number;
  z: number;
  /** Trunk radius at breast height (m). */
  r: number;
  /** Total height (m). */
  h: number;
  lean: number;
  seed: number;
  hero?: boolean;
}

/** Hand-placed giants that frame the path. */
export const HERO_TREES: readonly Tree[] = [
  { x: -4.6, z: -12, r: 2.3, h: 64, lean: 0.01, seed: 11, hero: true },
  { x: 5.6, z: -17, r: 2.7, h: 70, lean: -0.01, seed: 12, hero: true },
  { x: 3.4, z: -27, r: 1.7, h: 60, lean: 0.0, seed: 13, hero: true },
  { x: -9.5, z: -27, r: 3.1, h: 72, lean: 0.015, seed: 14, hero: true },
  { x: 9.5, z: -36, r: 2.4, h: 66, lean: -0.01, seed: 15, hero: true },
  { x: -4.2, z: -46, r: 2.0, h: 62, lean: 0.0, seed: 16, hero: true },
  { x: 5.2, z: -57, r: 2.2, h: 64, lean: 0.01, seed: 17, hero: true },
  { x: -12.5, z: -9, r: 2.0, h: 60, lean: 0.0, seed: 18, hero: true },
  { x: 9.2, z: -6.5, r: 1.9, h: 58, lean: -0.01, seed: 19, hero: true },
  { x: -15, z: -40, r: 2.6, h: 68, lean: 0.0, seed: 20, hero: true },
];

/** The camera corridor: no trunks where any lens or move can put the camera. */
export function inCameraCorridor(x: number, z: number) {
  if (z < -7) return false;
  const c = 0.105 * (z + 6);
  return Math.abs(x - c) < 0.62 * (z + 6) + 6;
}

/** The vista: a wedge beyond the forest edge kept open so the hills read through the trunks. */
export function inVista(x: number, z: number) {
  if (z > -66) return false;
  const ang = Math.atan2(x + 1.6, -(z - 4));
  return Math.abs(ang + 0.06) < 0.17;
}

/** Keep scatter clear of the scale references (cabin, deer, fence). */
function nearRef(x: number, z: number, pad = 0) {
  return (x + 12.2) ** 2 + (z + 17) ** 2 < (5.5 + pad) ** 2 || (x - 4.7) ** 2 + (z + 10.2) ** 2 < (1.8 + pad) ** 2;
}

function clearOfPath(x: number, z: number, r: number) {
  return Math.abs(x - pathCenterX(z)) > PATH.halfWidthM + 2.2 + r;
}

/** Fill forest: Poisson-ish rejection sampling around the heroes. */
export function fillTrees(count = 240, seed = 7): Tree[] {
  const rand = rng(seed);
  const out: Tree[] = [];
  const all = (): readonly Tree[] => [...HERO_TREES, ...out];
  let guard = 0;
  while (out.length < count && guard++ < 40000) {
    const x = -140 + rand() * 280;
    const z = -150 + rand() * 185;
    const far = smoothstep(-20, -120, z);
    const r = 0.9 + rand() * 1.6 + far * 0.4;
    if (!clearOfPath(x, z, r) || inCameraCorridor(x, z) || inVista(x, z) || nearRef(x, z, r * 2)) continue;
    if (groundY(x, z) < -6) continue;
    const gap = 4.2 + r * 1.6;
    if (all().some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (gap + t.r) ** 2)) continue;
    out.push({ x, z, r, h: 44 + rand() * 24 + r * 3, lean: (rand() - 0.5) * 0.03, seed: Math.floor(rand() * 1e6) });
  }
  return out;
}

export interface Prop {
  x: number;
  y: number;
  z: number;
  s: number;
  rot: number;
  tint: number;
}

const place = (x: number, z: number, s: number, rot: number, tint: number): Prop => ({ x, y: groundY(x, z), z, s, rot, tint });

/** Ferns hug the path edges and tree bases. */
export function ferns(trees: readonly Tree[], count = 340, seed = 21): Prop[] {
  const rand = rng(seed);
  const out: Prop[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 20000) {
    let x: number, z: number;
    if (rand() < 0.55) {
      z = -70 + rand() * 72;
      const side = rand() < 0.5 ? -1 : 1;
      x = pathCenterX(z) + side * (PATH.halfWidthM + 0.4 + rand() * rand() * 7);
    } else {
      const t = trees[Math.floor(rand() * trees.length)];
      const a = rand() * Math.PI * 2;
      const d = t.r * 1.6 + rand() * 4;
      x = t.x + Math.cos(a) * d;
      z = t.z + Math.sin(a) * d;
    }
    if (Math.abs(x - pathCenterX(z)) < PATH.halfWidthM + 0.25) continue;
    if (z > 2 || z < -120 || nearRef(x, z)) continue;
    out.push(place(x, z, 0.7 + rand() * 0.9, rand() * Math.PI * 2, rand()));
  }
  return out;
}

export function rocks(count = 46, seed = 31): Prop[] {
  const rand = rng(seed);
  const out: Prop[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 5000) {
    const z = -95 + rand() * 98;
    const x = pathCenterX(z) + (rand() < 0.5 ? -1 : 1) * (PATH.halfWidthM + 0.6 + rand() * 14);
    if ((inCameraCorridor(x, z) && rand() < 0.7) || nearRef(x, z, 1)) continue;
    out.push(place(x, z, 0.35 + rand() * rand() * 1.8, rand() * 6.28, rand()));
  }
  return out;
}

export function bushes(trees: readonly Tree[], count = 150, seed = 41): Prop[] {
  const rand = rng(seed);
  const out: Prop[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 8000) {
    const x = -90 + rand() * 180;
    const z = -125 + rand() * 128;
    if (!clearOfPath(x, z, -1.2) || inCameraCorridor(x, z) || nearRef(x, z)) continue;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r * 1.4) ** 2)) continue;
    out.push(place(x, z, 0.8 + rand() * 1.8, rand() * 6.28, rand()));
  }
  return out;
}

/** Distant conifers on the hills, kilometres away (tiny, hazed silhouettes). */
export function distantTrees(count = 1100, seed = 51): Prop[] {
  const rand = rng(seed);
  const out: Prop[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 20000) {
    const x = -1600 + rand() * 3200;
    const z = -230 - rand() * 900;
    const y = groundY(x, z);
    if (z > -300 && Math.abs(x) < 200) continue;
    out.push({ x, y, z, s: 14 + rand() * 18, rot: rand() * 6.28, tint: rand() });
  }
  return out;
}

/** Scale references: where each familiar object stands (ground point), metres. */
export const REF_SPOTS = {
  cabin: { x: -12.2, z: -17, rot: 0.75 },
  deer: { x: 4.7, z: -10.2, rot: -2.36 },
  fence: { x: -1.95, z: -0.6, rot: 0 },
} as const;
