import { Box3, BufferGeometry, Float32BufferAttribute } from "three";

/**
 * A procedural face rig for meshes with painted faces and no blend shapes (our Meshy characters).
 * Landmarks (eyes, brows, mouth) are located offline on the raw mesh (scripts/characters/face-rig-data.mjs);
 * here they become morph targets that move the surface around each painted feature, so the painting
 * deforms with it: the eye region squeezes shut, the brows lift or tilt, the mouth corners rise.
 */
type V3 = [number, number, number];
/** JSON-friendly: c = [x, y, z] centre, r = [rx, ry] half-size, metres in raw model space. */
interface Feature {
  c: number[];
  r: number[];
}
export interface FaceData {
  name: string;
  bbox: { min: number[]; max: number[] };
  eyes: Feature[];
  brows: Feature[];
  mouth: Feature | null;
}

export const FACE_TARGETS = ["blink", "wide", "browUp", "browAngry", "browSad", "smile", "mouthOpen"] as const;
export type FaceTarget = (typeof FACE_TARGETS)[number];

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Elliptical falloff around a feature: 1 inside `inner`, 0 at 1, gated to the face's front surface. */
function weight(p: V3, c: number[], rx: number, ry: number, inner = 0.35, depth = 0.035) {
  if (p[2] < c[2] - depth) return 0;
  const d = Math.hypot((p[0] - c[0]) / rx, (p[1] - c[1]) / ry);
  return 1 - smooth(inner, 1, d);
}

/**
 * Adds the face morph targets to `geometry` (call on a per-instance clone) and returns the index of
 * each target in `morphTargetInfluences`. Targets a face can't support (no mouth) are omitted.
 */
export function addFaceMorphs(geometry: BufferGeometry, face: FaceData): Partial<Record<FaceTarget, number>> {
  const pos = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const g = geometry.boundingBox ?? new Box3();
  const rmin = face.bbox.min;
  const rmax = face.bbox.max;
  // Raw ↔ geometry space is a per-axis affine map (quantization), so map through the bounding boxes.
  const toRaw = (i: number, k: number, v: number) => rmin[k] + ((v - g.min.getComponent(k)) / (g.max.getComponent(k) - g.min.getComponent(k))) * (rmax[k] - rmin[k]);
  const scale = [0, 1, 2].map((k) => (g.max.getComponent(k) - g.min.getComponent(k)) / (rmax[k] - rmin[k]));
  const n = pos.count;
  const raw = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    raw[i * 3] = toRaw(i, 0, pos.getX(i));
    raw[i * 3 + 1] = toRaw(i, 1, pos.getY(i));
    raw[i * 3 + 2] = toRaw(i, 2, pos.getZ(i));
  }
  const eyeH = Math.max(...face.eyes.map((e) => e.r[1]));
  const builders: Partial<Record<FaceTarget, (p: V3) => V3>> = {
    blink: (p) => {
      const d: V3 = [0, 0, 0];
      for (const e of face.eyes) {
        const w = weight(p, e.c, e.r[0] * 1.7, e.r[1] * 2.4, 0.42);
        if (!w) continue;
        const lid = e.c[1] - e.r[1] * 0.3;
        d[1] += (lid - p[1]) * 0.94 * w;
        d[2] += 0.002 * w;
      }
      return d;
    },
    wide: (p) => {
      const d: V3 = [0, 0, 0];
      for (const e of face.eyes) {
        const w = weight(p, e.c, e.r[0] * 1.8, e.r[1] * 2.0, 0.5);
        d[0] += (p[0] - e.c[0]) * 0.16 * w;
        d[1] += (p[1] - e.c[1]) * 0.3 * w;
      }
      return d;
    },
    browUp: (p) => {
      const d: V3 = [0, 0, 0];
      for (const b of face.brows) d[1] += eyeH * 0.85 * weight(p, b.c, b.r[0] * 1.5, b.r[1] * 3.2, 0.4);
      return d;
    },
    browAngry: (p) => {
      const d: V3 = [0, 0, 0];
      for (const b of face.brows) {
        const w = weight(p, b.c, b.r[0] * 1.5, b.r[1] * 3.2, 0.4);
        if (!w) continue;
        // u = +1 at the inner end (toward the midline), −1 at the outer end
        const u = Math.max(-1, Math.min(1, ((p[0] - b.c[0]) / b.r[0]) * -Math.sign(b.c[0])));
        d[1] += eyeH * (-0.75 * Math.max(u, 0) + 0.25 * Math.max(-u, 0)) * w;
      }
      return d;
    },
    browSad: (p) => {
      const d: V3 = [0, 0, 0];
      for (const b of face.brows) {
        const w = weight(p, b.c, b.r[0] * 1.5, b.r[1] * 3.2, 0.4);
        if (!w) continue;
        const u = Math.max(-1, Math.min(1, ((p[0] - b.c[0]) / b.r[0]) * -Math.sign(b.c[0])));
        d[1] += eyeH * (0.85 * Math.max(u, 0) - 0.2 * Math.max(-u, 0)) * w;
      }
      return d;
    },
  };
  const m = face.mouth;
  if (m) {
    builders.smile = (p) => {
      // corners up, centre a touch down: deepens the painted smile without bending it into a wave
      const w = weight(p, m.c, m.r[0] * 1.35, m.r[1] * 1.8, 0.55);
      if (!w) return [0, 0, 0];
      const t = Math.min(1, Math.abs(p[0] - m.c[0]) / m.r[0]);
      return [(p[0] - m.c[0]) * 0.05 * w, m.r[1] * (0.5 * t * t - 0.1 * (1 - t * t)) * w, 0];
    };
    builders.mouthOpen = (p) => {
      // the lower lip drops; above the mouth line barely moves, so the nose stays put
      const w = weight(p, m.c, m.r[0] * 1.15, m.r[1] * 1.7, 0.45);
      if (!w) return [0, 0, 0];
      const below = p[1] < m.c[1];
      return [(m.c[0] - p[0]) * 0.1 * w, (p[1] - m.c[1]) * (below ? 1.3 : 0.2) * w, -0.0015 * w];
    };
  }
  const index: Partial<Record<FaceTarget, number>> = {};
  const targets: Float32BufferAttribute[] = [];
  for (const name of FACE_TARGETS) {
    const build = builders[name];
    if (!build) continue;
    const arr = new Float32Array(n * 3);
    const p: V3 = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      p[0] = raw[i * 3];
      p[1] = raw[i * 3 + 1];
      p[2] = raw[i * 3 + 2];
      const d = build(p);
      arr[i * 3] = d[0] * scale[0];
      arr[i * 3 + 1] = d[1] * scale[1];
      arr[i * 3 + 2] = d[2] * scale[2];
    }
    const attr = new Float32BufferAttribute(arr, 3);
    attr.name = name;
    index[name] = targets.length;
    targets.push(attr);
  }
  geometry.morphAttributes.position = targets;
  geometry.morphTargetsRelative = true;
  return index;
}

/** Face channels in the animation DSL → morph target influences. */
export function faceInfluences(eyes: { sy?: number; py?: number } | undefined, brows: { py?: number; rz?: number } | undefined, mouth: { py?: number; sy?: number } | undefined): Record<FaceTarget, number> {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const tilt = brows?.rz ?? 0;
  return {
    blink: clamp(-(eyes?.sy ?? 0)),
    wide: clamp(eyes?.py ?? 0),
    browUp: clamp(brows?.py ?? 0),
    browAngry: clamp(-tilt),
    browSad: clamp(tilt),
    smile: clamp(mouth?.py ?? 0),
    mouthOpen: clamp(mouth?.sy ?? 0),
  };
}
