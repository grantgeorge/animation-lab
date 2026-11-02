/**
 * Secondary motion as damped spring chains. Renderer-free and deterministic.
 *
 * Each appendage is a chain of points. Point 0 is pinned to a bone (the "anchor"); every other point
 * is pulled by a spring toward where it would be if the appendage were rigid: its parent point plus
 * the rest-shape segment, turned with the anchor. Damping acts on the velocity relative to the parent
 * (it resists the segment swinging, not the whole chain moving), drag on the absolute velocity (air).
 * Segments are inextensible, so a soft spring bends the chain rather than stretching it.
 *
 * Integration: fixed 240 Hz steps, spring explicit, damping implicit (stable for any damping), then a
 * length projection with the matching velocity correction. Whole loops are simulated up front, so the
 * playhead can scrub anywhere and always shows the same frame.
 */

export const SIM_HZ = 240;
export const FPS = 24;
export const G = 9.81;

export type V3 = [number, number, number];

export interface Params {
  /** Spring stiffness, N/m per point. */
  stiffness: number;
  /** Damping on the segment's swing, N·s/m. */
  damping: number;
  /** Mass per point, kg. */
  mass: number;
  /** Air drag on absolute velocity, N·s/m. */
  drag: number;
  /** Gravity, in g. */
  gravity: number;
}

/** Bone motion sampled at a fixed rate over one loop: world position and rotation relative to rest. */
export interface AnchorTrack {
  hz: number;
  n: number;
  pos: Float32Array; // n × 3
  quat: Float32Array; // n × 4 (x, y, z, w)
}

/** Rest shape in the anchor's rest frame, metres from the anchor. Point 0 is the attachment. */
export type Rest = readonly V3[];

export interface Sim {
  steps: number;
  count: number;
  /** Simulated points, steps × count × 3. */
  pos: Float32Array;
  /** Where the points would be if the appendage were rigid, steps × count × 3. */
  rigid: Float32Array;
}

export interface ChainState {
  x: Float64Array;
  v: Float64Array;
  /** Last anchored point 0, for its velocity. */
  prev0: Float64Array;
  started: boolean;
}

/* ---------- small vector maths (no allocation in the inner loop) ---------- */

/** out = q · v */
export function rotate(qx: number, qy: number, qz: number, qw: number, vx: number, vy: number, vz: number, out: number[] | Float64Array, o = 0) {
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  out[o] = vx + qw * tx + (qy * tz - qz * ty);
  out[o + 1] = vy + qw * ty + (qz * tx - qx * tz);
  out[o + 2] = vz + qw * tz + (qx * ty - qy * tx);
}

export const zeta = (p: Params) => p.damping / (2 * Math.sqrt(p.stiffness * p.mass));
export const naturalHz = (p: Params) => Math.sqrt(p.stiffness / p.mass) / (2 * Math.PI);
export function dampingWord(z: number) {
  if (z < 0.15) return 'barely damped: it rings';
  if (z < 0.8) return 'underdamped: it overshoots';
  if (z <= 1.25) return 'near critical: fastest settle';
  return 'overdamped: it creeps back';
}

export const segmentLengths = (rest: Rest) => rest.map((r, i) => (i === 0 ? 0 : Math.hypot(r[0] - rest[i - 1][0], r[1] - rest[i - 1][1], r[2] - rest[i - 1][2])));

export function newState(count: number): ChainState {
  return { x: new Float64Array(count * 3), v: new Float64Array(count * 3), prev0: new Float64Array(3), started: false };
}

const tmp = new Float64Array(3);

/** Place a chain exactly on its rigid pose (at rest, no velocity). */
export function resetState(s: ChainState, rest: Rest, ap: ArrayLike<number>, aq: ArrayLike<number>) {
  for (let i = 0; i < rest.length; i++) {
    rotate(aq[0], aq[1], aq[2], aq[3], rest[i][0], rest[i][1], rest[i][2], tmp);
    s.x[i * 3] = ap[0] + tmp[0]; s.x[i * 3 + 1] = ap[1] + tmp[1]; s.x[i * 3 + 2] = ap[2] + tmp[2];
    s.v[i * 3] = s.v[i * 3 + 1] = s.v[i * 3 + 2] = 0;
  }
  s.prev0[0] = s.x[0]; s.prev0[1] = s.x[1]; s.prev0[2] = s.x[2];
  s.started = true;
}

/**
 * One fixed step. `ap`/`aq` are the anchor's world position and rest-relative rotation at the END of
 * the step. `lengths` from segmentLengths(rest); pass null to let segments stretch (pure springs).
 */
export function step(s: ChainState, rest: Rest, lengths: readonly number[] | null, p: Params, ap: ArrayLike<number>, aq: ArrayLike<number>, dt: number) {
  const n = rest.length, x = s.x, v = s.v;
  const [qx, qy, qz, qw] = [aq[0], aq[1], aq[2], aq[3]];
  // Point 0 is pinned to the bone.
  rotate(qx, qy, qz, qw, rest[0][0], rest[0][1], rest[0][2], tmp);
  x[0] = ap[0] + tmp[0]; x[1] = ap[1] + tmp[1]; x[2] = ap[2] + tmp[2];
  v[0] = (x[0] - s.prev0[0]) / dt; v[1] = (x[1] - s.prev0[1]) / dt; v[2] = (x[2] - s.prev0[2]) / dt;
  s.prev0[0] = x[0]; s.prev0[1] = x[1]; s.prev0[2] = x[2];
  const m = Math.max(1e-4, p.mass), k = p.stiffness, c = p.damping, d = p.drag, gy = -G * p.gravity;
  const denom = m + dt * (c + d);
  for (let i = 1; i < n; i++) {
    const a = i * 3, b = a - 3;
    rotate(qx, qy, qz, qw, rest[i][0] - rest[i - 1][0], rest[i][1] - rest[i - 1][1], rest[i][2] - rest[i - 1][2], tmp);
    for (let j = 0; j < 3; j++) {
      const target = x[b + j] + tmp[j];
      const f = k * (target - x[a + j]) + (j === 1 ? m * gy : 0);
      // m·dv = (F − c(v − v_parent) − d·v)·dt, with v on the right taken at the end of the step.
      v[a + j] = (m * v[a + j] + dt * (f + c * v[b + j])) / denom;
    }
    const ox = x[a], oy = x[a + 1], oz = x[a + 2];
    x[a] += v[a] * dt; x[a + 1] += v[a + 1] * dt; x[a + 2] += v[a + 2] * dt;
    if (lengths) {
      const dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2];
      const len = Math.hypot(dx, dy, dz) || 1e-9, f = lengths[i] / len;
      x[a] = x[b] + dx * f; x[a + 1] = x[b + 1] + dy * f; x[a + 2] = x[b + 2] + dz * f;
      v[a] = (x[a] - ox) / dt; v[a + 1] = (x[a + 1] - oy) / dt; v[a + 2] = (x[a + 2] - oz) / dt;
    }
  }
}

/** Anchor sample i (wrapping) into the scratch arrays. */
function anchorAt(track: AnchorTrack, i: number, ap: Float64Array, aq: Float64Array) {
  const k = ((i % track.n) + track.n) % track.n;
  ap[0] = track.pos[k * 3]; ap[1] = track.pos[k * 3 + 1]; ap[2] = track.pos[k * 3 + 2];
  aq[0] = track.quat[k * 4]; aq[1] = track.quat[k * 4 + 1]; aq[2] = track.quat[k * 4 + 2]; aq[3] = track.quat[k * 4 + 3];
}

/**
 * Simulate one full loop of the track. A warm-up loop runs first, so the recorded loop starts from
 * the state the previous loop left behind and the seam is continuous.
 */
export function simulate(track: AnchorTrack, rest: Rest, p: Params, opts: { warmup?: number; inextensible?: boolean } = {}): Sim {
  const count = rest.length, steps = track.n, dt = 1 / track.hz;
  const lengths = opts.inextensible === false ? null : segmentLengths(rest);
  const s = newState(count), ap = new Float64Array(3), aq = new Float64Array(4);
  anchorAt(track, 0, ap, aq);
  resetState(s, rest, ap, aq);
  const warm = (opts.warmup ?? 1) * steps;
  for (let i = 1; i <= warm; i++) { anchorAt(track, i, ap, aq); step(s, rest, lengths, p, ap, aq, dt); }
  const pos = new Float32Array(steps * count * 3), rigid = new Float32Array(steps * count * 3);
  for (let i = 0; i < steps; i++) {
    anchorAt(track, warm + i, ap, aq);
    if (i > 0) step(s, rest, lengths, p, ap, aq, dt);
    for (let j = 0; j < count; j++) {
      const o = (i * count + j) * 3;
      pos[o] = s.x[j * 3]; pos[o + 1] = s.x[j * 3 + 1]; pos[o + 2] = s.x[j * 3 + 2];
      rotate(aq[0], aq[1], aq[2], aq[3], rest[j][0], rest[j][1], rest[j][2], tmp);
      rigid[o] = ap[0] + tmp[0]; rigid[o + 1] = ap[1] + tmp[1]; rigid[o + 2] = ap[2] + tmp[2];
    }
  }
  return { steps, count, pos, rigid };
}

/** Step index for a time in the loop. */
export const stepAt = (sim: { steps: number }, t: number, hz = SIM_HZ) => Math.min(sim.steps - 1, Math.max(0, Math.round(t * hz) % sim.steps));

/** Point j of a sim at step i, into out. */
export function pointAt(buf: Float32Array, count: number, i: number, j: number, out: V3 = [0, 0, 0]): V3 {
  const o = (i * count + j) * 3;
  out[0] = buf[o]; out[1] = buf[o + 1]; out[2] = buf[o + 2];
  return out;
}

/* ---------- the animator's version: offset keys ---------- */

export interface KeyedParams {
  /** Frames each joint lags its parent. */
  offsetFrames: number;
  /** Swing per metre/second of travel, radians, split across the joints. */
  swing: number;
  /** The designed overshoot: swing per m/s² of deceleration, radians. */
  overshoot: number;
}
export const KEYED_DEFAULT: KeyedParams = { offsetFrames: 2, swing: 0.32, overshoot: 0.012 };

/** Smoothed velocity and acceleration of a track's x (the direction of travel), per sample. */
export function travelCurves(track: AnchorTrack, smoothS = 0.06) {
  const n = track.n, w = Math.max(1, Math.round(smoothS * track.hz)), dt = 1 / track.hz;
  const x = (i: number) => track.pos[(((i % n) + n) % n) * 3];
  const vel = new Float32Array(n), acc = new Float32Array(n), vs = new Float32Array(n);
  for (let i = 0; i < n; i++) vel[i] = (x(i + 1) - x(i - 1)) / (2 * dt);
  const box = (src: Float32Array, out: Float32Array) => {
    for (let i = 0; i < n; i++) { let s = 0; for (let k = -w; k <= w; k++) s += src[(((i + k) % n) + n) % n]; out[i] = s / (2 * w + 1); }
  };
  box(vel, vs);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = (vs[(i + 1) % n] - vs[(i - 1 + n) % n]) / (2 * dt);
  box(raw, acc);
  return { vel: vs, acc };
}

/**
 * Keyframed overlap, as an animator builds it: each joint's swing is the travel curve copied and
 * slid later by a few frames, plus one designed overshoot when the body decelerates. Lengths never
 * change and the result is identical every take: full control, no surprises.
 */
export function keyedPose(track: AnchorTrack, curves: { vel: Float32Array; acc: Float32Array }, rest: Rest, kp: KeyedParams, i: number, out: Float32Array, o = 0) {
  const n = track.n, count = rest.length, idx = ((i % n) + n) % n;
  const ap = [track.pos[idx * 3], track.pos[idx * 3 + 1], track.pos[idx * 3 + 2]];
  const q = [track.quat[idx * 4], track.quat[idx * 4 + 1], track.quat[idx * 4 + 2], track.quat[idx * 4 + 3]];
  rotate(q[0], q[1], q[2], q[3], rest[0][0], rest[0][1], rest[0][2], tmp);
  out[o] = ap[0] + tmp[0]; out[o + 1] = ap[1] + tmp[1]; out[o + 2] = ap[2] + tmp[2];
  let theta = 0;
  const lim = 1.25;
  for (let j = 1; j < count; j++) {
    const lag = Math.round((j * kp.offsetFrames * track.hz) / FPS);
    const k = (((idx - lag) % n) + n) % n;
    theta += (-kp.swing * curves.vel[k] - kp.overshoot * curves.acc[k]) / (count - 1);
    const th = Math.max(-lim, Math.min(lim, theta));
    rotate(q[0], q[1], q[2], q[3], rest[j][0] - rest[j - 1][0], rest[j][1] - rest[j - 1][1], rest[j][2] - rest[j - 1][2], tmp);
    // Swing in the plane of travel: about world Z.
    const c = Math.cos(th), s = Math.sin(th);
    const sx = c * tmp[0] - s * tmp[1], sy = s * tmp[0] + c * tmp[1];
    const a = o + j * 3, b = a - 3;
    out[a] = out[b] + sx; out[a + 1] = out[b + 1] + sy; out[a + 2] = out[b + 2] + tmp[2];
  }
}

/** A whole loop of keyed poses, same layout as Sim.pos. */
export function keyedLoop(track: AnchorTrack, rest: Rest, kp: KeyedParams): Float32Array {
  const curves = travelCurves(track), count = rest.length, out = new Float32Array(track.n * count * 3);
  for (let i = 0; i < track.n; i++) keyedPose(track, curves, rest, kp, i, out, i * count * 3);
  return out;
}

/* ---------- measurements ---------- */

export interface Window { start: number; stop: number; end: number }
export interface Reading {
  /** Frames between the rigid tip's fastest moment and the simulated tip's. */
  lagFrames: number;
  /** Frames after the stop until the tip stays within tolerance of where it comes to rest. */
  settleFrames: number;
  /** Times the tip swings past its resting place after the stop. */
  overshoots: number;
  /** Largest swing away from the rigid pose after the stop, metres. */
  peak: number;
}

export const SETTLE_TOL = 0.012;

/** Measure the tip (last point) of a loop over one move: start → stop → end, in seconds. */
export function measure(pos: Float32Array, rigid: Float32Array, count: number, hz: number, w: Window, tol = SETTLE_TOL): Reading {
  const tip = count - 1;
  const at = (buf: Float32Array, i: number, c: number) => buf[(i * count + tip) * 3 + c];
  const i0 = Math.round(w.start * hz), iS = Math.round(w.stop * hz), i1 = Math.round(w.end * hz);
  // Lag: the fastest sideways moment of the rigid tip vs the simulated tip.
  const speed = (buf: Float32Array, i: number) => Math.abs(at(buf, i + 1, 0) - at(buf, i - 1, 0));
  let iR = i0, best = -1;
  for (let i = i0 + 1; i < iS; i++) { const s = speed(rigid, i); if (s > best) { best = s; iR = i; } }
  let iT = iR, bestT = -1;
  const lagEnd = Math.min(i1 - 1, iR + Math.round(0.4 * hz));
  for (let i = iR; i < lagEnd; i++) { const s = speed(pos, i); if (s > bestT) { bestT = s; iT = i; } }
  const lagFrames = ((iT - iR) / hz) * FPS;
  // Deviation from where the tip settles (gravity sag included), after the stop.
  const tail = Math.max(1, Math.round(0.12 * hz));
  const rest = [0, 1, 2].map((c) => { let s = 0; for (let i = i1 - tail; i < i1; i++) s += at(pos, i, c) - at(rigid, i, c); return s / tail; });
  const dev = (i: number, c: number) => at(pos, i, c) - at(rigid, i, c) - rest[c];
  let last = iS, peak = 0;
  for (let i = iS; i < i1; i++) {
    const m = Math.hypot(dev(i, 0), dev(i, 1), dev(i, 2));
    if (m > peak) peak = m;
    if (m > tol) last = i;
  }
  const settleFrames = Math.ceil(((last - iS) / hz) * FPS);
  // Overshoots: split the sideways deviation into same-sign swings (ignoring a small dead band),
  // keep the swings bigger than the tolerance, and count every one after the first.
  const runs: { sign: number; peak: number }[] = [];
  for (let i = iS; i < i1; i++) {
    const d = dev(i, 0);
    if (Math.abs(d) < tol * 0.25) continue;
    const sg = Math.sign(d), r = runs[runs.length - 1];
    if (r && r.sign === sg) r.peak = Math.max(r.peak, Math.abs(d)); else runs.push({ sign: sg, peak: Math.abs(d) });
  }
  const big: number[] = [];
  for (const r of runs) if (r.peak > tol && big[big.length - 1] !== r.sign) big.push(r.sign);
  const overshoots = Math.max(0, big.length - 1);
  return { lagFrames, settleFrames, overshoots, peak };
}
