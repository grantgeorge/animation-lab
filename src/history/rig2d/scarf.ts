import { ch, DURATION, FPS, poseAt } from "./pose";

/**
 * Simplified secondary motion for Bram's scarf end: a damped chain of point masses (Verlet integration
 * with distance constraints) hanging from an anchor that the AUTHORED body animation moves.
 * The body animation is never changed by the simulation; the simulation only reads it.
 */
export const SCARF = { segments: 5, segLen: 0.07, restTilt: 0.12, gravity: 9.8, damping: 2.6, substepsPerFrame: 10 } as const;

/** Body yaw seen by the scarf (pelvis + torso, degrees → radians). */
export const bodyYaw = (t: number) => {
  const p = poseAt(t).bram;
  return ((ch(p, "pelvis", "ry") + ch(p, "torso", "ry")) * Math.PI) / 180;
};

/** Scarf anchor on the front of the coat in Bram's local front-view metres (x right, y up). */
export function scarfAnchor(yaw: number) {
  return { x: 0.07 * Math.cos(yaw) + 0.16 * Math.sin(yaw), y: 1.36 };
}

/** Rigid scarf: the settled rest shape, carried by the body with no follow-through. */
export const rigidAngles = () => simulatedAngles()[0];

let table: number[][] | null = null;

/** Per-frame segment angles (radians from straight down, + = swings toward screen right). Deterministic. */
export function simulatedAngles(): number[][] {
  if (table) return table;
  const n = SCARF.segments;
  const dt = 1 / (FPS * SCARF.substepsPerFrame);
  const a0 = scarfAnchor(bodyYaw(0));
  const pts = Array.from({ length: n + 1 }, (_, i) => ({ x: a0.x + Math.sin(SCARF.restTilt) * SCARF.segLen * i, y: a0.y - Math.cos(SCARF.restTilt) * SCARF.segLen * i }));
  const prev = pts.map((p) => ({ ...p }));
  const frames = Math.round(DURATION * FPS);
  const out: number[][] = [];
  // Two passes over the loop: the first settles the chain so the published loop starts at rest.
  for (let pass = 0; pass < 2; pass++) {
    for (let f = 0; f < frames; f++) {
      for (let s = 0; s < SCARF.substepsPerFrame; s++) {
        const t = (f + s / SCARF.substepsPerFrame) / FPS;
        const a = scarfAnchor(bodyYaw(t));
        pts[0].x = prev[0].x = a.x;
        pts[0].y = prev[0].y = a.y;
        const k = Math.exp(-SCARF.damping * dt);
        for (let i = 1; i <= n; i++) {
          const p = pts[i];
          const vx = (p.x - prev[i].x) * k;
          const vy = (p.y - prev[i].y) * k;
          prev[i].x = p.x;
          prev[i].y = p.y;
          p.x += vx;
          p.y += vy - SCARF.gravity * dt * dt;
        }
        for (let it = 0; it < 6; it++) {
          for (let i = 1; i <= n; i++) {
            const a1 = pts[i - 1];
            const b = pts[i];
            const dx = b.x - a1.x;
            const dy = b.y - a1.y;
            const len = Math.hypot(dx, dy) || 1e-9;
            const diff = (len - SCARF.segLen) / len;
            if (i === 1) {
              b.x -= dx * diff;
              b.y -= dy * diff;
            } else {
              a1.x += dx * diff * 0.5;
              a1.y += dy * diff * 0.5;
              b.x -= dx * diff * 0.5;
              b.y -= dy * diff * 0.5;
            }
          }
        }
      }
      if (pass === 1) out.push(pts.slice(1).map((p, i) => Math.atan2(p.x - pts[i].x, pts[i].y - p.y)));
    }
  }
  table = out;
  return out;
}

export function scarfAnglesAt(t: number, simulate: boolean) {
  if (!simulate) return rigidAngles();
  const tab = simulatedAngles();
  const f = Math.min(tab.length - 1, Math.max(0, Math.floor((((t % DURATION) + DURATION) % DURATION) * FPS + 1e-6)));
  return tab[f];
}
