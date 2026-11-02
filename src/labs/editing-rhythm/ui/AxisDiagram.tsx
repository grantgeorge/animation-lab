"use client";

import { STAGE_AXIS } from "../engine/experiments";
import { MARKS } from "../engine/marks";
import { COVERAGE, SHOTS, type CamSpec } from "../engine/shots";
import type { ShotId } from "../engine/types";

/**
 * Top-down plan of the box scene: the cast, the box, the axis of action (the 180° line) and the six
 * cameras with their view direction. A camera on the far side of the line is drawn in red.
 */
export function AxisDiagram({ overrides = {}, highlight = [], testid = "axis-diagram", bounds = [-2.4, 1.8, -5.2, 2.0] }: { overrides?: Partial<Record<ShotId, CamSpec>>; highlight?: ShotId[]; testid?: string; /** Plan crop [x0, x1, z0, z1] in metres. */ bounds?: [number, number, number, number] }) {
  // plan bounds (x right, z down the screen = toward camera)
  const [X0, X1, Z0, Z1] = bounds;
  const W = 260;
  const H = (W * (Z1 - Z0)) / (X1 - X0);
  const px = (x: number) => ((x - X0) / (X1 - X0)) * W;
  const pz = (z: number) => ((z - Z0) / (Z1 - Z0)) * H;
  const ax = STAGE_AXIS;
  const ext = 6;
  const a = [ax.a[0] - ax.u[0] * ext, ax.a[1] - ax.u[1] * ext];
  const b = [ax.a[0] + ax.u[0] * ext, ax.a[1] + ax.u[1] * ext];
  const side = (p: readonly number[]) => ax.u[0] * (p[2] - ax.a[1]) - ax.u[1] * (p[0] - ax.a[0]);
  return (
    <svg className="er-axis" viewBox={`0 0 ${W} ${H}`} data-testid={testid} role="img" aria-label="Plan view: cameras and the line of action">
      <defs>
        <clipPath id={`${testid}-clip`}>
          <rect width={W} height={H} rx="6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${testid}-clip)`}>
        <rect width={W} height={H} fill="#101216" />
        <polygon points={`${px(a[0])},${pz(a[1])} ${px(b[0])},${pz(b[1])} ${px(b[0] + ax.n[0] * 9)},${pz(b[1] + ax.n[1] * 9)} ${px(a[0] + ax.n[0] * 9)},${pz(a[1] + ax.n[1] * 9)}`} fill="#8ef0c30a" />
        <line x1={px(a[0])} y1={pz(a[1])} x2={px(b[0])} y2={pz(b[1])} stroke="#ffb547" strokeDasharray="5 4" strokeWidth="1.2" />
        {Z0 < -5 && (
          <>
            <rect x={px(-1.6)} y={pz(-5.0) - 2} width={px(2.6) - px(-1.6)} height="4" fill="#3a3f4a" />
            <text x={px(-1.55)} y={pz(-5.0) - 5} className="er-axis-note">doorway wall</text>
          </>
        )}
        {(COVERAGE as ShotId[]).map((id) => {
          const cam = overrides[id] ?? SHOTS[id].cam;
          const s = side(cam.position);
          const bad = s < 0;
          const dx = cam.target[0] - cam.position[0];
          const dz = cam.target[2] - cam.position[2];
          const len = Math.hypot(dx, dz) || 1;
          const half = Math.atan(18 / cam.focalMm);
          const ang = Math.atan2(dz, dx);
          const r = 0.75;
          const p1 = [cam.position[0] + Math.cos(ang - half) * r, cam.position[2] + Math.sin(ang - half) * r];
          const p2 = [cam.position[0] + Math.cos(ang + half) * r, cam.position[2] + Math.sin(ang + half) * r];
          const col = bad ? "#ff6b6b" : SHOTS[id].color;
          const hi = highlight.includes(id);
          return (
            <g key={id} data-testid={`${testid}-cam-${id}`} data-side={bad ? "-1" : "1"} opacity={highlight.length && !hi ? 0.45 : 1}>
              <polygon points={`${px(cam.position[0])},${pz(cam.position[2])} ${px(p1[0])},${pz(p1[1])} ${px(p2[0])},${pz(p2[1])}`} fill={`${col}33`} stroke={col} strokeWidth="0.8" />
              <circle cx={px(cam.position[0])} cy={pz(cam.position[2])} r="7" fill="#0b0d11" stroke={col} strokeWidth={hi ? 2 : 1.2} />
              <text x={px(cam.position[0])} y={pz(cam.position[2]) + 3} textAnchor="middle" className="er-axis-cam" fill={col}>
                {SHOTS[id].number}
              </text>
              <line x1={px(cam.position[0])} y1={pz(cam.position[2])} x2={px(cam.position[0] + (dx / len) * 0.4)} y2={pz(cam.position[2] + (dz / len) * 0.4)} stroke={col} strokeWidth="1" />
            </g>
          );
        })}
        <rect x={px(MARKS.box[0]) - 4} y={pz(MARKS.box[2]) - 3} width="8" height="6" fill="#7FF3E4" rx="1" />
        <circle cx={px(MARKS.bram.at[0])} cy={pz(MARKS.bram.at[2])} r="6" fill="#C8552F" />
        <text x={px(MARKS.bram.at[0]) - 9} y={pz(MARKS.bram.at[2]) + 3} textAnchor="end" className="er-axis-name">Bram</text>
        <circle cx={px(MARKS.pip.stepTo[0])} cy={pz(MARKS.pip.stepTo[2])} r="4.5" fill="#F2C14E" />
        <text x={px(MARKS.pip.stepTo[0]) + 8} y={pz(MARKS.pip.stepTo[2]) + 3} className="er-axis-name">Pip</text>
        <text x="8" y={H - 8} className="er-axis-note">— — the line: keep cameras on one side</text>
      </g>
    </svg>
  );
}
