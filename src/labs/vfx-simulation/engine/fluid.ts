import { BUCKET, IMPACT, bucketFrame, bucketPose, type BeatTimes } from "./beat";
import { FPS, LOOP_S, holdRemap } from "./timing";
import { curl3, mulberry32, smoothstep } from "./rng";

/**
 * The realistic treatment: a lightweight particle fluid ("SPH-lite"). It is the double-density
 * relaxation of Clavet, Beaudoin & Poulin (2005): every particle pushes or pulls its neighbours toward a
 * rest density, a near-density term stops clumping, and pairwise viscosity impulses damp relative
 * motion. Fixed timestep, seeded randomness, a spatial hash for neighbours, and every 1/60 s of sim time
 * recorded so playback, scrubbing and screenshots read the cache, never the solver.
 */
export const SIM_DT = 1 / 120;
export const REC_HZ = 60;
const STEPS_PER_REC = Math.round(1 / SIM_DT / REC_HZ);
const G = 9.81;
/** Floor area the water can cover (m). */
export const BOUNDS = { x0: -2.6, x1: 2.6, z0: -1.3, z1: 1.4 } as const;

export interface FluidParams {
  n: number;
  gravity: number;
  viscosity: number;
  intensity: number;
  turbulence: number;
  seed: number;
}

const TABLE = 1 << 15;
const hashCell = (ix: number, iy: number, iz: number) => (((Math.imul(ix, 92837111) ^ Math.imul(iy, 689287499) ^ Math.imul(iz, 283923481)) >>> 0) & (TABLE - 1));

export class FluidSim {
  readonly n: number;
  readonly p: FluidParams;
  readonly times: BeatTimes;
  /** Particle spacing at rest, kernel radius and render radius (m). */
  readonly s: number;
  readonly h: number;
  readonly radius: number;
  pos: Float32Array;
  prev: Float32Array;
  vel: Float32Array;
  /** Bucket-local rest positions (x along the bucket's right, y up its axis, z). */
  local: Float32Array;
  /** Sim time each particle left the bucket (Infinity = still inside). */
  releasedAt: Float32Array;
  splashed: Uint8Array;
  order: Int32Array;
  released = 0;
  t: number;
  steps = 0;
  firstContact = Infinity;
  private rho0 = 1;
  private k: number;
  private kNear: number;
  private sigma: number;
  private beta: number;
  private friction: number;
  private rnd: () => number;
  private cellStart = new Int32Array(TABLE + 1);
  private cellEntries: Int32Array;
  private cellOf: Int32Array;
  private nb = new Int32Array(27);
  private c3: [number, number, number] = [0, 0, 0];

  constructor(p: FluidParams, times: BeatTimes) {
    this.p = p;
    this.n = Math.max(16, Math.round(p.n));
    this.times = times;
    const n = this.n;
    const fillH = BUCKET.h * BUCKET.fill;
    const rMean = (BUCKET.rBot + (BUCKET.rBot + (BUCKET.rTop - BUCKET.rBot) * BUCKET.fill)) / 2 - 0.012;
    const volume = Math.PI * rMean * rMean * fillH;
    this.s = Math.cbrt(volume / n);
    this.h = 2.1 * this.s;
    this.radius = 0.62 * this.s;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.local = new Float32Array(n * 3);
    this.releasedAt = new Float32Array(n).fill(Infinity);
    this.splashed = new Uint8Array(n);
    this.cellEntries = new Int32Array(n);
    this.cellOf = new Int32Array(n);
    this.rnd = mulberry32(p.seed * 7919 + n);
    this.fill();
    // Stiffness scales with the kernel so the response is resolution-independent.
    this.k = 2.4 / (SIM_DT * SIM_DT) * this.s * 0.01;
    this.kNear = this.k * 2.2;
    const v = p.viscosity;
    this.sigma = (0.4 + 22 * v) / this.h;
    this.beta = (0.25 + 4 * v) / this.h;
    this.friction = 0.03 + 0.25 * v + 0.45 * v * v;
    this.t = times.kick - SIM_DT;
    this.order = this.releaseOrder();
    this.placeInBucket(this.t);
  }

  /** Pack the bucket: a jittered lattice inside the tapered cylinder, lowest layers first. */
  private fill() {
    const n = this.n;
    let s = this.s;
    let pts: number[][] = [];
    for (let tries = 0; tries < 30 && pts.length < n; tries++) {
      pts = [];
      for (let y = s * 0.6; y < BUCKET.h * 0.97; y += s * 0.92) {
        const r = BUCKET.rBot + ((BUCKET.rTop - BUCKET.rBot) * y) / BUCKET.h - 0.012;
        for (let x = -r; x <= r; x += s) for (let z = -r; z <= r; z += s) if (x * x + z * z <= r * r) pts.push([x, y, z]);
      }
      s *= 0.97;
    }
    pts.sort((a, b) => a[1] - b[1]);
    const L = this.local;
    for (let i = 0; i < n; i++) {
      const q = pts[i];
      L[i * 3] = q[0] + (this.rnd() - 0.5) * s * 0.2;
      L[i * 3 + 1] = q[1];
      L[i * 3 + 2] = q[2] + (this.rnd() - 0.5) * s * 0.2;
    }
    // Rest density from the packed interior, so the fluid holds its volume.
    this.rho0 = 1;
    const sample: number[] = [];
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 200))) {
      let rho = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = L[j * 3] - L[i * 3];
        const dy = L[j * 3 + 1] - L[i * 3 + 1];
        const dz = L[j * 3 + 2] - L[i * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < this.h) rho += (1 - d / this.h) ** 2;
      }
      sample.push(rho);
    }
    sample.sort((a, b) => a - b);
    // the upper-middle of the distribution: interior particles, not the free surface
    this.rho0 = sample[Math.floor(sample.length * 0.7)] * 0.82;
  }

  private releaseOrder() {
    const idx = Array.from({ length: this.n }, (_, i) => i);
    const L = this.local;
    // the water on top and on the side that goes down first leaves first
    idx.sort((a, b) => L[b * 3 + 1] + 0.7 * L[b * 3] - (L[a * 3 + 1] + 0.7 * L[a * 3]) || a - b);
    return Int32Array.from(idx);
  }

  private placeInBucket(t: number) {
    const fr = bucketFrame(bucketPose("real", t, this.times));
    const P = this.pos;
    const L = this.local;
    for (let k = this.released; k < this.n; k++) {
      const i = this.order[k];
      const [x, y] = fr.toWorld(L[i * 3], L[i * 3 + 1]);
      P[i * 3] = x;
      P[i * 3 + 1] = y;
      P[i * 3 + 2] = BUCKET.z + L[i * 3 + 2];
    }
  }

  private emit() {
    const t = this.t;
    const pose = bucketPose("real", t, this.times);
    const spilled = pose.angle < 0 ? smoothstep(16, 95, -pose.angle) ** 0.85 : 0;
    const target = Math.min(this.n, Math.floor(spilled * this.n + 1e-9));
    if (target <= this.released) return;
    const fr = bucketFrame(pose);
    const fr0 = bucketFrame(bucketPose("real", t - SIM_DT, this.times));
    const out = 0.7 + 1.0 * this.p.intensity;
    const spread = (0.15 + 0.4 * this.p.intensity) * (1 - 0.6 * this.p.viscosity);
    const L = this.local;
    for (let k = this.released; k < target; k++) {
      const i = this.order[k];
      const [x, y] = fr.toWorld(L[i * 3], L[i * 3 + 1]);
      const [x0, y0] = fr0.toWorld(L[i * 3], L[i * 3 + 1]);
      const o = out * (0.75 + 0.5 * this.rnd());
      const vx = (x - x0) / SIM_DT + fr.dir[0] * o + (this.rnd() - 0.5) * spread;
      const vy = (y - y0) / SIM_DT + fr.dir[1] * o + (this.rnd() - 0.5) * spread;
      const vz = (this.rnd() - 0.5) * spread * 1.6 + L[i * 3 + 2] * 3;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = BUCKET.z + L[i * 3 + 2];
      this.vel[i * 3] = vx;
      this.vel[i * 3 + 1] = vy;
      this.vel[i * 3 + 2] = vz;
      this.releasedAt[i] = t;
    }
    this.released = target;
  }

  private buildGrid() {
    const { cellStart, cellEntries, cellOf, pos } = this;
    const inv = 1 / this.h;
    cellStart.fill(0);
    for (let k = 0; k < this.released; k++) {
      const i = this.order[k];
      const c = hashCell(Math.floor(pos[i * 3] * inv), Math.floor(pos[i * 3 + 1] * inv), Math.floor(pos[i * 3 + 2] * inv));
      cellOf[i] = c;
      cellStart[c]++;
    }
    let acc = 0;
    for (let c = 0; c < TABLE; c++) {
      acc += cellStart[c];
      cellStart[c] = acc;
    }
    cellStart[TABLE] = acc;
    for (let k = 0; k < this.released; k++) {
      const i = this.order[k];
      cellEntries[--cellStart[cellOf[i]]] = i;
    }
  }

  /** Unique hash buckets of the 27 cells around particle i. Returns the count. */
  private neighbourCells(i: number) {
    const inv = 1 / this.h;
    const ix = Math.floor(this.pos[i * 3] * inv);
    const iy = Math.floor(this.pos[i * 3 + 1] * inv);
    const iz = Math.floor(this.pos[i * 3 + 2] * inv);
    let m = 0;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (let c = -1; c <= 1; c++) {
          const hc = hashCell(ix + a, iy + b, iz + c);
          let dup = false;
          for (let q = 0; q < m; q++)
            if (this.nb[q] === hc) {
              dup = true;
              break;
            }
          if (!dup) this.nb[m++] = hc;
        }
    return m;
  }

  /** One fixed step. */
  step() {
    const dt = SIM_DT;
    this.t += dt;
    this.steps++;
    this.emit();
    this.placeInBucket(this.t);
    const { pos, prev, vel, order, h } = this;
    const R = this.released;
    const g = G * this.p.gravity;
    const turb = this.p.turbulence;
    // external forces
    for (let k = 0; k < R; k++) {
      const i = order[k] * 3;
      vel[i + 1] -= g * dt;
      if (turb > 0 && pos[i + 1] > this.radius * 2) {
        const c = curl3(pos[i] * 7, pos[i + 1] * 7, pos[i + 2] * 7, this.t * 3, this.c3);
        const a = turb * 3.2 * dt;
        vel[i] += c[0] * a;
        vel[i + 1] += c[1] * a * 0.6;
        vel[i + 2] += c[2] * a;
      }
    }
    // viscosity impulses between approaching neighbours
    this.buildGrid();
    const { cellStart, cellEntries } = this;
    for (let k = 0; k < R; k++) {
      const i = order[k];
      const m = this.neighbourCells(i);
      for (let q = 0; q < m; q++) {
        const c = this.nb[q];
        for (let e = cellStart[c]; e < cellStart[c + 1]; e++) {
          const j = cellEntries[e];
          if (j <= i) continue;
          const dx = pos[j * 3] - pos[i * 3];
          const dy = pos[j * 3 + 1] - pos[i * 3 + 1];
          const dz = pos[j * 3 + 2] - pos[i * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= h * h || d2 < 1e-12) continue;
          const d = Math.sqrt(d2);
          const qd = d / h;
          const nx = dx / d;
          const ny = dy / d;
          const nz = dz / d;
          const u = (vel[i * 3] - vel[j * 3]) * nx + (vel[i * 3 + 1] - vel[j * 3 + 1]) * ny + (vel[i * 3 + 2] - vel[j * 3 + 2]) * nz;
          if (u <= 0) continue;
          const I = Math.min(u, dt * (1 - qd) * (this.sigma * u + this.beta * u * u)) * 0.5;
          vel[i * 3] -= I * nx;
          vel[i * 3 + 1] -= I * ny;
          vel[i * 3 + 2] -= I * nz;
          vel[j * 3] += I * nx;
          vel[j * 3 + 1] += I * ny;
          vel[j * 3 + 2] += I * nz;
        }
      }
    }
    // predict
    for (let k = 0; k < R; k++) {
      const i = order[k] * 3;
      prev[i] = pos[i];
      prev[i + 1] = pos[i + 1];
      prev[i + 2] = pos[i + 2];
      pos[i] += vel[i] * dt;
      pos[i + 1] += vel[i + 1] * dt;
      pos[i + 2] += vel[i + 2] * dt;
    }
    // double density relaxation
    this.buildGrid();
    const maxMove = this.s * 0.45;
    const dt2 = dt * dt;
    for (let k = 0; k < R; k++) {
      const i = order[k];
      const m = this.neighbourCells(i);
      let rho = 0;
      let rhoN = 0;
      for (let q = 0; q < m; q++) {
        const c = this.nb[q];
        for (let e = cellStart[c]; e < cellStart[c + 1]; e++) {
          const j = cellEntries[e];
          if (j === i) continue;
          const dx = pos[j * 3] - pos[i * 3];
          const dy = pos[j * 3 + 1] - pos[i * 3 + 1];
          const dz = pos[j * 3 + 2] - pos[i * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= h * h) continue;
          const w = 1 - Math.sqrt(d2) / h;
          rho += w * w;
          rhoN += w * w * w;
        }
      }
      const P = this.k * (rho - this.rho0);
      const PN = this.kNear * rhoN;
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (let q = 0; q < m; q++) {
        const c = this.nb[q];
        for (let e = cellStart[c]; e < cellStart[c + 1]; e++) {
          const j = cellEntries[e];
          if (j === i) continue;
          const dx = pos[j * 3] - pos[i * 3];
          const dy = pos[j * 3 + 1] - pos[i * 3 + 1];
          const dz = pos[j * 3 + 2] - pos[i * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= h * h || d2 < 1e-12) continue;
          const d = Math.sqrt(d2);
          const w = 1 - d / h;
          let D = dt2 * (P * w + PN * w * w) * 0.5;
          if (D > maxMove) D = maxMove;
          else if (D < -maxMove) D = -maxMove;
          const ux = (dx / d) * D;
          const uy = (dy / d) * D;
          const uz = (dz / d) * D;
          pos[j * 3] += ux;
          pos[j * 3 + 1] += uy;
          pos[j * 3 + 2] += uz;
          ax -= ux;
          ay -= uy;
          az -= uz;
        }
      }
      pos[i * 3] += ax;
      pos[i * 3 + 1] += ay;
      pos[i * 3 + 2] += az;
    }
    // collisions: floor (friction + splash breakup) and the set walls
    const r = this.radius;
    // viscous liquids splash less (a higher Ohnesorge number): the breakup weakens with viscosity
    const splashK = (0.45 + 0.5 * this.p.intensity) * (1 - 0.75 * this.p.viscosity);
    for (let k = 0; k < R; k++) {
      const ii = order[k];
      const i = ii * 3;
      if (pos[i + 1] < r) {
        const vn = (prev[i + 1] - pos[i + 1]) / dt;
        pos[i + 1] = r;
        if (vn > 0.25 && this.t < this.firstContact) this.firstContact = this.t;
        // tangential friction
        pos[i] = prev[i] + (pos[i] - prev[i]) * (1 - this.friction);
        pos[i + 2] = prev[i + 2] + (pos[i + 2] - prev[i + 2]) * (1 - this.friction);
        if (vn > 0.9 && !this.splashed[ii]) {
          // a hard hit throws a little spray back up and sideways
          this.splashed[ii] = 1;
          const up = vn * splashK * (0.25 + 0.75 * this.rnd() ** 2);
          const side = vn * splashK * 0.55;
          prev[i + 1] = pos[i + 1] - up * dt;
          prev[i] = pos[i] - ((this.rnd() - 0.5) * side + (pos[i] - prev[i]) / dt * 0.4) * dt;
          prev[i + 2] = pos[i + 2] - (this.rnd() - 0.5) * side * dt;
        } else prev[i + 1] = pos[i + 1];
      }
      if (pos[i] < BOUNDS.x0) pos[i] = BOUNDS.x0;
      else if (pos[i] > BOUNDS.x1) pos[i] = BOUNDS.x1;
      if (pos[i + 2] < BOUNDS.z0) pos[i + 2] = BOUNDS.z0;
      else if (pos[i + 2] > BOUNDS.z1) pos[i + 2] = BOUNDS.z1;
    }
    // velocity from the corrected positions
    const vmax = 9;
    for (let k = 0; k < R; k++) {
      const i = order[k] * 3;
      let vx = (pos[i] - prev[i]) / dt;
      let vy = (pos[i + 1] - prev[i + 1]) / dt;
      let vz = (pos[i + 2] - prev[i + 2]) / dt;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (sp > vmax) {
        vx *= vmax / sp;
        vy *= vmax / sp;
        vz *= vmax / sp;
      }
      vel[i] = vx;
      vel[i + 1] = vy;
      vel[i + 2] = vz;
    }
  }
}

/** Sim time where the bake stops (beat seconds). */
export const SIM_END = LOOP_S + 0.05;

/**
 * Bake cache: steps the solver on demand (a time budget per call, so the UI never freezes) and keeps a
 * copy of every particle position each 1/60 s of sim time. Sampling interpolates between records.
 */
export class FluidBake {
  readonly sim: FluidSim;
  readonly key: string;
  readonly t0: number;
  records: Float32Array[] = [];
  done = false;
  bakeMs = 0;

  constructor(p: FluidParams, times: BeatTimes, key = "") {
    this.sim = new FluidSim(p, times);
    this.key = key;
    this.t0 = this.sim.t;
    this.records.push(this.sim.pos.slice());
  }

  get progress() {
    return this.done ? 1 : Math.min(1, (this.sim.t - this.t0) / (SIM_END - this.t0));
  }

  /** Last sim time that is recorded. */
  get bakedUntil() {
    return this.t0 + (this.records.length - 1) / REC_HZ;
  }

  /** Step until `budgetMs` has passed (or done). Returns true when finished. */
  advance(budgetMs: number, now: () => number = () => performance.now()): boolean {
    if (this.done) return true;
    const start = now();
    while (!this.done) {
      for (let k = 0; k < STEPS_PER_REC; k++) this.sim.step();
      this.records.push(this.sim.pos.slice());
      if (this.sim.t >= SIM_END) this.done = true;
      if (now() - start >= budgetMs) break;
    }
    this.bakeMs += now() - start;
    return this.done;
  }

  bakeAll() {
    while (!this.advance(1e9));
  }

  /**
   * Positions at sim time t into out (n × 3). Particles still in the bucket get NaN in x so the renderer
   * can hide them. Returns the time actually shown (clamped to what is baked).
   */
  sample(t: number, out: Float32Array): number {
    const tt = Math.min(Math.max(t, this.t0), this.bakedUntil);
    const x = (tt - this.t0) * REC_HZ;
    const a = Math.min(this.records.length - 1, Math.floor(x));
    const b = Math.min(this.records.length - 1, a + 1);
    const u = x - a;
    const A = this.records[a];
    const B = this.records[b];
    const rel = this.sim.releasedAt;
    for (let i = 0; i < this.sim.n; i++) {
      const j = i * 3;
      if (!(rel[i] <= tt)) {
        out[j] = NaN;
        out[j + 1] = NaN;
        out[j + 2] = NaN;
        continue;
      }
      out[j] = A[j] + (B[j] - A[j]) * u;
      out[j + 1] = A[j + 1] + (B[j + 1] - A[j + 1]) * u;
      out[j + 2] = A[j + 2] + (B[j + 2] - A[j + 2]) * u;
    }
    return tt;
  }
}

/**
 * Realistic playback time: output time → sim time. Stylization slows the sim around the impact (an
 * art-directed retime, raised-cosine window), then a freeze-frame hold is inserted at the peak.
 */
export function realSimTime(t: number, b: BeatTimes, holdFrames: number, stylization: number): number {
  const a = b.impact - 0.1;
  const w = 0.75;
  const k = 0.68 * stylization;
  const warp = (x: number) => {
    if (x <= a) return x;
    const y = Math.min(x, a + w) - a;
    const integral = 0.5 * y - (w / (4 * Math.PI)) * Math.sin((2 * Math.PI * y) / w);
    return x - k * integral;
  };
  // output time at which the warped sim reaches its peak (warp is monotonic: bisection)
  let lo = 0;
  let hi = LOOP_S + 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (warp(mid) < b.peak) lo = mid;
    else hi = mid;
  }
  return warp(holdRemap(t, lo, holdFrames / FPS));
}

/** Summary numbers of a baked frame (for tests, Inspect and the legibility metric). */
export function frameStats(pos: Float32Array, n: number, radius: number) {
  let airborne = 0;
  let grounded = 0;
  let maxY = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1];
    if (Number.isNaN(y)) continue;
    if (y > radius * 2.2) {
      airborne++;
      if (y > maxY) maxY = y;
    } else {
      grounded++;
      cx += pos[i * 3];
      cz += pos[i * 3 + 2];
    }
  }
  cx = grounded ? cx / grounded : IMPACT.x;
  cz = grounded ? cz / grounded : IMPACT.z;
  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1];
    if (Number.isNaN(y) || y > radius * 2.2) continue;
    d.push(Math.hypot(pos[i * 3] - cx, pos[i * 3 + 2] - cz));
  }
  d.sort((a, b) => a - b);
  const spread = d.length ? d[Math.floor(d.length * 0.9)] : 0;
  // how far the water front travelled from the bucket (95th percentile of x on the floor)
  const xs: number[] = [];
  for (let i = 0; i < n; i++) if (!Number.isNaN(pos[i * 3 + 1]) && pos[i * 3 + 1] <= radius * 2.2) xs.push(pos[i * 3]);
  xs.sort((a, b) => a - b);
  const reach = xs.length ? xs[Math.floor(xs.length * 0.95)] - BUCKET.x : 0;
  return { airborne, grounded, maxY, spread, reach, cx, cz };
}
