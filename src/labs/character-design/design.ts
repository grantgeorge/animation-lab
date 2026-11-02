import { designConfig as config } from '@/labs/lens-and-framing/config';

/**
 * A character design as a handful of proportions. Everything is relative, so the figure is always
 * built to one total height (config.heightM) and a model sheet compares like with like.
 */
export type Bary = readonly [circle: number, square: number, triangle: number];
export type PoseId = 'neutral' | 'open' | 'action';
export interface Design {
  /** Head height ÷ total height. 1 / head = "heads tall". */
  head: number;
  /** Eye diameter ÷ head height. */
  eyeSize: number;
  /** Gap between the eyes, in eye widths. */
  eyeGap: number;
  /** Eye height on the head: 0 = chin, 1 = crown. */
  eyeLine: number;
  /** Leg share of the height below the head. */
  limbs: number;
  /** Limb radius multiplier. */
  thickness: number;
  /** Hand and foot size multiplier. */
  extremities: number;
  /** Shape language: weights of circle, square and triangle (sum 1). */
  shape: Bary;
  pose: PoseId;
}

export const RANGES = {
  head: [0.117, 0.455],
  eyeSize: [0.08, 0.3],
  eyeGap: [0.3, 2.2],
  eyeLine: [0.3, 0.62],
  limbs: [0.36, 0.64],
  thickness: [0.55, 1.9],
  extremities: [0.6, 1.9],
} as const satisfies Record<string, readonly [number, number]>;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const headsTall = (d: Pick<Design, 'head'>) => 1 / d.head;

/** Normalise barycentric weights (negative → 0, sum → 1). */
export function normBary(b: readonly number[]): Bary {
  const c = b.map(v => Math.max(0, v));
  const s = c[0] + c[1] + c[2] || 1;
  return [c[0] / s, c[1] / s, c[2] / s];
}

// ── The cast, measured ──────────────────────────────────────────────────────────────────────────
/**
 * Pip and Bram as designs, from the cast's own numbers (designConfig.cast, see decisions.md):
 * head height and eye geometry from the procedural puppets, total height from the measured crown.
 */
export function castDesign(id: 'pip' | 'bram'): Design {
  const c = config.cast[id];
  return {
    head: c.headM / c.crownM,
    eyeSize: c.eyeDiaM / c.headM,
    eyeGap: (c.eyeCentresM - c.eyeDiaM) / c.eyeDiaM,
    eyeLine: c.eyeLineM / c.headM,
    limbs: c.legM / (c.crownM - c.headM),
    thickness: c.thickness,
    extremities: c.extremities,
    shape: c.shape,
    pose: 'neutral',
  };
}

export type PresetId = 'realistic' | 'heroic' | 'cartoon' | 'chibi' | 'pip' | 'bram' | 'villain';
export interface Preset { id: PresetId; label: string; note: string; design: Design }
const base = { thickness: 1, extremities: 1, pose: 'neutral' as PoseId };
export const PRESETS: readonly Preset[] = [
  { id: 'realistic', label: 'Realistic adult', note: 'eyes on the half line', design: { ...base, head: 1 / 7.5, eyeSize: 0.13, eyeGap: 1, eyeLine: 0.5, limbs: 0.56, thickness: 0.85, extremities: 0.9, shape: [0.3, 0.45, 0.25] } },
  { id: 'heroic', label: 'Heroic', note: 'broad shoulders, long legs', design: { ...base, head: 1 / 8.5, eyeSize: 0.12, eyeGap: 1, eyeLine: 0.5, limbs: 0.58, thickness: 1, extremities: 1, shape: [0.05, 0.35, 0.6] } },
  { id: 'cartoon', label: 'Cartoon', note: 'big eyes, chunky limbs', design: { ...base, head: 1 / 4, eyeSize: 0.2, eyeGap: 0.8, eyeLine: 0.44, limbs: 0.48, thickness: 1.2, extremities: 1.35, shape: [0.65, 0.25, 0.1] } },
  { id: 'chibi', label: 'Chibi', note: 'eyes low and huge', design: { ...base, head: 1 / 2.5, eyeSize: 0.26, eyeGap: 0.9, eyeLine: 0.36, limbs: 0.42, thickness: 1.25, extremities: 1.2, shape: [0.85, 0.15, 0] } },
  { id: 'pip', label: 'Like Pip', note: 'measured from the cast', design: castDesign('pip') },
  { id: 'bram', label: 'Like Bram', note: 'measured from the cast', design: castDesign('bram') },
  { id: 'villain', label: 'Villain', note: 'one sharp shape', design: { ...base, head: 1 / 6.5, eyeSize: 0.11, eyeGap: 0.55, eyeLine: 0.54, limbs: 0.6, thickness: 0.8, extremities: 1.2, shape: [0, 0.04, 0.96] } },
];
export const preset = (id: PresetId) => PRESETS.find(p => p.id === id)!;

// ── Readings (rules of thumb) ───────────────────────────────────────────────────────────────────
export type SystemId = 'chibi' | 'cartoon' | 'stylised' | 'realistic' | 'heroic';
export const SYSTEMS: readonly { id: SystemId; label: string; from: number; to: number; eg: string }[] = [
  { id: 'chibi', label: 'Chibi', from: 2, to: 3, eg: 'super-deformed mascots' },
  { id: 'cartoon', label: 'Cartoon', from: 3, to: 4.5, eg: 'kids and comic leads' },
  { id: 'stylised', label: 'Stylised', from: 4.5, to: 6.5, eg: 'feature-animation adults' },
  { id: 'realistic', label: 'Realistic', from: 6.5, to: 8, eg: 'the average adult is about 7.5' },
  { id: 'heroic', label: 'Heroic', from: 8, to: 9, eg: 'comic-book heroes' },
];
export function systemOf(heads: number): SystemId {
  for (const s of SYSTEMS) if (heads < s.to) return s.id;
  return 'heroic';
}

/**
 * Baby-schema cues (Lorenz's Kindchenschema): a big head for the body, big eyes, and eyes set low on
 * the face read as young. Each cue is scored 0–1 and blended; the bands are a rule of thumb, not a measurement.
 */
export function youthCues(d: Pick<Design, 'head' | 'eyeSize' | 'eyeLine'>) {
  const head = clamp((6.5 - headsTall(d)) / 3.5, 0, 1);
  const eyes = clamp((d.eyeSize - 0.13) / 0.12, 0, 1);
  const low = clamp((0.5 - d.eyeLine) / 0.14, 0, 1);
  return { head, eyes, low, youth: 0.45 * head + 0.3 * eyes + 0.25 * low };
}
export type AgeBand = 'baby' | 'child' | 'teen' | 'adult';
export function ageBand(youth: number): AgeBand {
  return youth >= 0.72 ? 'baby' : youth >= 0.45 ? 'child' : youth >= 0.2 ? 'teen' : 'adult';
}
export const AGE_LABEL: Record<AgeBand, string> = { baby: 'Very young', child: 'A child', teen: 'Teen / young adult', adult: 'An adult' };

export type ShapeId = 'circle' | 'square' | 'triangle';
export const SHAPES: readonly { id: ShapeId; label: string; reads: string }[] = [
  { id: 'circle', label: 'Circle', reads: 'soft, friendly, young' },
  { id: 'square', label: 'Square', reads: 'sturdy, dependable, stubborn' },
  { id: 'triangle', label: 'Triangle', reads: 'dynamic, sharp, dangerous' },
];
export function dominantShape(b: Bary): ShapeId | 'mixed' {
  const i = b.indexOf(Math.max(...b));
  return b[i] >= 0.5 ? SHAPES[i].id : 'mixed';
}

// ── Construction ────────────────────────────────────────────────────────────────────────────────
type Profile = readonly (readonly [r: number, y: number])[];
/** Head profiles, y from chin (0) to crown (1), r as a share of the head's full width. Same y samples in each. */
const HEAD: Record<ShapeId, Profile> = {
  circle: [[0, 0], [0.196, 0.04], [0.325, 0.12], [0.433, 0.25], [0.494, 0.42], [0.49, 0.6], [0.427, 0.76], [0.3, 0.9], [0, 1]],
  square: [[0, 0], [0.36, 0.04], [0.47, 0.12], [0.5, 0.25], [0.5, 0.42], [0.5, 0.6], [0.49, 0.76], [0.44, 0.9], [0, 1]],
  triangle: [[0, 0], [0.025, 0.04], [0.09, 0.12], [0.2, 0.25], [0.33, 0.42], [0.45, 0.6], [0.5, 0.76], [0.44, 0.9], [0, 1]],
};
/** Torso profiles, y from crotch (0) to the neck (1), r as a share of the chest half width. */
const TORSO: Record<ShapeId, Profile> = {
  circle: [[0, -0.06], [0.82, 0], [1.12, 0.18], [1.24, 0.4], [1.12, 0.62], [0.86, 0.82], [0.55, 0.93], [0.3, 1], [0, 1]],
  square: [[0, -0.06], [0.92, 0], [0.95, 0.18], [0.9, 0.4], [0.97, 0.62], [1, 0.82], [0.82, 0.93], [0.3, 1], [0, 1]],
  triangle: [[0, -0.06], [0.42, 0], [0.44, 0.18], [0.55, 0.4], [0.9, 0.62], [1.34, 0.84], [1.02, 0.94], [0.3, 1], [0, 1]],
};
/** The trouser line on the torso, as a share of the torso height. */
export const WAIST = 0.24;
export function blendProfile(set: Record<ShapeId, Profile>, b: Bary): [number, number][] {
  return set.circle.map((_, i) => [
    b[0] * set.circle[i][0] + b[1] * set.square[i][0] + b[2] * set.triangle[i][0],
    b[0] * set.circle[i][1] + b[1] * set.square[i][1] + b[2] * set.triangle[i][1],
  ]);
}
/** Radius of a profile at height y (linear between profile points). */
export function radiusAt(p: readonly (readonly [number, number])[], y: number) {
  if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][1]) { const [r0, y0] = p[i - 1], [r1, y1] = p[i]; return lerp(r0, r1, (y - y0) / (y1 - y0 || 1)); }
  }
  return p[p.length - 1][0];
}

/** A two-segment limb hanging from (±x, y). r: radius at the root, the middle joint and the end. */
export interface Limb { x: number; y: number; upper: number; lower: number; r: readonly [number, number, number]; swing: number; spread: number; bend: number }
export interface Figure {
  H: number;
  head: { y: number; h: number; w: number; profile: [number, number][]; tilt: number; nod: number };
  neck: { y: number; h: number; r: number };
  torso: { y: number; h: number; w: number; profile: [number, number][]; lean: number; hunch: number };
  eyes: { y: number; x: number; z: number; r: number };
  arms: [Limb, Limb];
  legs: [Limb, Limb];
  hand: number;
  foot: [length: number, height: number, width: number];
  /** Root drop that keeps the lowest foot on the floor once the legs bend. */
  drop: number;
}

/** Joint angles (degrees) for each teaching pose; side 0 = character's left (screen right in front view). */
const POSES: Record<PoseId, { arms: [number, number, number][]; legs: [number, number, number][]; lean: number; tilt: number }> = {
  // [spread out from the body, swing forward, elbow/knee bend]
  neutral: { arms: [[4, 0, 6], [4, 0, 6]], legs: [[1.5, 0, 0], [1.5, 0, 0]], lean: 0, tilt: 0 },
  open: { arms: [[40, 8, 16], [40, 8, 16]], legs: [[9, 0, 2], [9, 0, 2]], lean: 0, tilt: 0 },
  action: { arms: [[150, 10, 28], [36, -34, 24]], legs: [[14, 20, 26], [6, -22, 8]], lean: 6, tilt: -8 },
};

export function buildFigure(d: Design): Figure {
  const H = config.heightM;
  const b = d.shape;
  const headH = d.head * H;
  const headW = headH * (b[0] * 1 + b[1] * 0.92 + b[2] * 0.7);
  const neckH = headH * 0.1;
  const bodyH = H - headH - neckH * 0.55;
  const legH = d.limbs * bodyH;
  const torsoH = bodyH - legH;
  // Squares add bulk; triangles broaden the shoulder line (the profile then tapers it to a narrow waist).
  const torsoW = H * 0.1 * (1 + 0.12 * b[1] + 0.2 * b[2]);
  const torsoProfile = blendProfile(TORSO, b);
  const headProfile = blendProfile(HEAD, b);
  const pose = POSES[d.pose];
  const t = H * d.thickness;
  // Limbs follow the shape too: sturdy on squares, spindly and tapering on triangles.
  const armK = 1 + 0.1 * b[1] - 0.18 * b[2], legK = 1 + 0.18 * b[1] - 0.32 * b[2];
  const armR = [0.028 * t * armK, 0.022 * t * armK, 0.018 * t * armK * (1 - 0.15 * b[2])] as const;
  const legR = [0.04 * t * legK, 0.03 * t * legK, 0.024 * t * legK * (1 - 0.2 * b[2])] as const;
  const hand = H * 0.03 * d.extremities;
  const foot: [number, number, number] = [H * 0.095 * d.extremities, H * 0.04, H * 0.055 * Math.sqrt(d.extremities) * Math.max(1, d.thickness * 0.9)];
  const shoulderY = legH + torsoH * 0.86;
  const shoulderX = torsoW * radiusAt(torsoProfile, 0.86) + armR[0] * 0.2;
  const armLen = torsoH * 0.82 + legH * 0.14;
  const legX = Math.max(legR[0] * 1.05, torsoW * radiusAt(torsoProfile, 0) * 0.55);
  const legLen = legH - foot[1] * 0.5;
  // Triangles bend at sharper angles: elbows read as points in the outline.
  const arms = pose.arms.map(([spread, swing, bend]) => ({ x: shoulderX, y: shoulderY, upper: armLen * 0.5, lower: armLen * 0.5, r: armR, spread, swing, bend: bend + b[2] * (d.pose === 'neutral' ? 8 : 26) })) as [Limb, Limb];
  const legs = pose.legs.map(([spread, swing, bend]) => ({ x: legX, y: legH, upper: legLen * 0.5, lower: legLen * 0.5, r: legR, spread, swing, bend })) as [Limb, Limb];
  // Foot height after hip and knee rotations (leg hangs along −Y; swing about X, spread about Z, knee bends back).
  const footY = (l: Limb) => {
    const r = Math.PI / 180;
    const thigh = Math.cos(l.swing * r) * Math.cos(l.spread * r);
    const shin = Math.cos((l.swing - l.bend) * r) * Math.cos(l.spread * r);
    return l.y - l.upper * thigh - l.lower * shin;
  };
  const drop = Math.max(0, ...legs.map(l => footY(l) - foot[1] * 0.5));
  const headY = H - headH;
  const eyeR = (d.eyeSize * headH) / 2;
  const eyeX = eyeR * (1 + d.eyeGap);
  const eyeYrel = d.eyeLine;
  const surface = headW * radiusAt(headProfile, eyeYrel);
  const eyeZ = Math.sqrt(Math.max(0, surface ** 2 - eyeX ** 2)) - eyeR * 0.3;
  return {
    H,
    head: { y: headY, h: headH, w: headW, profile: headProfile, tilt: pose.tilt, nod: b[2] * 5 },
    neck: { y: headY - neckH, h: neckH * 1.6, r: Math.min(headW * 0.22, torsoW * 0.32) },
    // Triangles loom: a slight forward hunch, chin down.
    torso: { y: legH, h: torsoH, w: torsoW, profile: torsoProfile, lean: pose.lean, hunch: b[2] * 7 },
    eyes: { y: headY + eyeYrel * headH, x: Math.min(eyeX, surface * 0.82), z: Math.max(eyeZ, 0), r: eyeR },
    arms,
    legs,
    hand,
    foot,
    drop,
  };
}

/** Readings shown under the stage (all derived; silhouette metrics come from the stage). */
export function readDesign(d: Design) {
  const heads = headsTall(d);
  const cues = youthCues(d);
  return { heads, system: systemOf(heads), eyeGap: d.eyeGap, eyeSize: d.eyeSize, eyeLine: d.eyeLine, ...cues, age: ageBand(cues.youth), shape: dominantShape(d.shape) };
}
export type DesignReading = ReturnType<typeof readDesign>;

export const designKey = (d: Design) => [d.head, d.eyeSize, d.eyeGap, d.eyeLine, d.limbs, d.thickness, d.extremities, ...d.shape].map(v => v.toFixed(3)).join(':') + ':' + d.pose;
