/**
 * A tiny typed keyframe DSL. Every channel is a delta from the part's rest transform:
 * p* in meters, r* in degrees, s* as a scale factor (1 = rest).
 * The ease on a key applies to the segment that ENDS at that key.
 */
export type Ease = "linear" | "in" | "out" | "inOut" | "back" | "hold";
export type Channel = "px" | "py" | "pz" | "rx" | "ry" | "rz" | "sy";
export type Key = readonly [t: number, v: number, ease?: Ease];

export interface Track {
  part: string;
  ch: Channel;
  keys: readonly Key[];
}

export interface Clip {
  character: "bram" | "pip" | "door";
  tracks: readonly Track[];
}

export interface Performance {
  id: string;
  durationS: number;
  clips: readonly Clip[];
}

const ease = (e: Ease | undefined, u: number) => {
  switch (e) {
    case "in":
      return u * u * u;
    case "out":
      return 1 - (1 - u) ** 3;
    case "back": {
      const c = 1.3;
      return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
    }
    case "hold":
      return 0;
    case "linear":
      return u;
    case "inOut":
    default:
      return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  }
};

/** Sample a track at time t. Before the first key → first value; after the last → last value. */
export function sampleTrack(keys: readonly Key[], t: number): number {
  if (keys.length === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * ease(e, u);
    }
  }
  return keys[keys.length - 1][1];
}

export type PoseDelta = Map<string, Partial<Record<Channel, number>>>;

/** Evaluate every track of a clip into per-part channel deltas. */
export function sampleClip(clip: Clip, t: number, out: PoseDelta = new Map()): PoseDelta {
  out.clear();
  for (const tr of clip.tracks) {
    let rec = out.get(tr.part);
    if (!rec) {
      rec = {};
      out.set(tr.part, rec);
    }
    rec[tr.ch] = (rec[tr.ch] ?? 0) + sampleTrack(tr.keys, t);
  }
  return out;
}

/** Validation used by tests and in development: sorted keys, finite values, loop closes. */
export function validatePerformance(p: Performance): string[] {
  const problems: string[] = [];
  for (const clip of p.clips) {
    for (const tr of clip.tracks) {
      const label = `${clip.character}.${tr.part}.${tr.ch}`;
      for (let i = 0; i < tr.keys.length; i++) {
        const [t, v] = tr.keys[i];
        if (!Number.isFinite(t) || !Number.isFinite(v)) problems.push(`${label}: non-finite key ${i}`);
        if (i > 0 && t < tr.keys[i - 1][0]) problems.push(`${label}: keys not sorted at ${i}`);
        if (t < 0 || t > p.durationS) problems.push(`${label}: key ${i} outside 0..${p.durationS}`);
      }
      const a = sampleTrack(tr.keys, 0);
      const b = sampleTrack(tr.keys, p.durationS);
      if (Math.abs(a - b) > 1e-6) problems.push(`${label}: loop does not close (${a} vs ${b})`);
    }
  }
  return problems;
}
