"use client";

import { useMemo, useRef } from "react";
import { BODY_HALF_W, BODY_HEIGHT, METERS_PER_UNIT, type Pose, REST_CY, TRAVEL, motionAt } from "../engine";
import { type VariantView, useTiming } from "../store";
import { INK, SQUASH, variantColor } from "./colors";
import { useElementSize } from "./useElementSize";

const X0 = -TRAVEL / 2 - 0.75;
const X1 = TRAVEL / 2 + 0.75;
/** Fixed height range so every row and every setting shares one scale. */
const Y_TOP = 3.75;
const PAD = { l: 10, r: 10, t: 20, b: 8 };
const GHOST_SCALE = 0.5;

interface Row {
  v: VariantView;
  top: number;
  h: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  /** Pixels per unit for ghost silhouettes: uniform (shapes stay true) and drawn at half size so frames don't pile up. */
  k: number;
}

/** Ghost silhouette of the deformed body as an SVG ellipse transform. */
function ghostTransform(p: Pose, row: Row) {
  const [a, b, c, e] = p.deform.m;
  const cx = row.sx(p.cx);
  const cy = row.sy(p.cy);
  // SVG y points down: conjugate the matrix by a y flip.
  return `matrix(${a} ${-c} ${-b} ${e} ${cx} ${cy}) rotate(${(p.lean * 180) / Math.PI})`;
}

/** Centre the dots on the rigid body centre so spacing shows the path, not the deformation. */
const dotY = (p: Pose) => p.y + REST_CY;

export function TrajectoryView() {
  const variants = useTiming((s) => s.variants);
  const frame = useTiming((s) => s.frame);
  const ghosts = useTiming((s) => s.ghosts);
  const seek = useTiming((s) => s.seek);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);

  const rows: Row[] = useMemo(() => {
    const n = variants.length;
    const w = Math.max(10, size.w - PAD.l - PAD.r);
    const gap = n > 1 ? 18 : 0;
    const h = Math.max(10, (size.h - PAD.t - PAD.b - gap * (n - 1)) / n);
    return variants.map((v, i) => {
      const top = PAD.t + i * (h + gap);
      const kx = w / (X1 - X0);
      const ky = h / Y_TOP;
      return { v, top, h, sx: (x: number) => PAD.l + (x - X0) * kx, sy: (y: number) => top + h - y * ky, k: Math.min(kx, ky) * GHOST_SCALE };
    });
  }, [variants, size]);

  const statics = useMemo(
    () =>
      rows.map((row, ri) => {
        const { v } = row;
        const col = variantColor(v.id);
        const tl = v.timeline;
        const arc: string[] = [];
        for (let t = 0; t <= tl.totalFrames - 1; t += 0.25) {
          const m = motionAt(tl, t);
          arc.push(`${row.sx(m.x).toFixed(1)},${row.sy(m.y + REST_CY).toFixed(1)}`);
        }
        const drawn = v.frames.filter((p, i) => !(v.params.onTwos && i % 2 === 1 && !p.impact));
        const impacts = new Set(tl.contacts.map((c) => c.frame));
        const apexes = new Set(tl.arcs.map((a) => a.apexFrame));
        return (
          <g key={`${v.id}-${ri}`} data-testid={`trajectory-${v.id}`}>
            <line x1={row.sx(X0)} x2={row.sx(X1)} y1={row.sy(0)} y2={row.sy(0)} stroke={INK[3]} strokeWidth={1} />
            {[1, 2, 3].map((m) => (
              <line key={m} x1={row.sx(X0)} x2={row.sx(X1)} y1={row.sy(m)} y2={row.sy(m)} stroke="white" strokeOpacity={0.04} />
            ))}
            <polyline points={arc.join(" ")} fill="none" stroke={col} strokeOpacity={0.22} strokeWidth={1.2} />
            {ghosts &&
              drawn.map((p) => (
                <ellipse
                  key={`g${p.frame}`}
                  rx={BODY_HALF_W * row.k}
                  ry={(BODY_HEIGHT / 2) * row.k}
                  transform={ghostTransform(p, row)}
                  fill="none"
                  stroke={impacts.has(p.frame) ? SQUASH : col}
                  strokeOpacity={impacts.has(p.frame) ? 0.6 : 0.22}
                  strokeWidth={1}
                />
              ))}
            {drawn.map((p) => {
              const hit = impacts.has(p.frame);
              const top = apexes.has(p.frame);
              return (
                <circle
                  key={`d${p.frame}`}
                  cx={row.sx(p.x)}
                  cy={row.sy(dotY(p))}
                  r={hit ? 3.2 : 2.4}
                  fill={hit ? SQUASH : col}
                  fillOpacity={top ? 1 : 0.85}
                  stroke={hit ? "#0b0e14" : "none"}
                  strokeWidth={hit ? 1 : 0}
                />
              );
            })}
            {v.id !== "main" && (
              <text x={row.sx(X0) + 2} y={row.top + 11} className="mono" fontSize={10.5} fill={col} letterSpacing="0.04em">
                {v.id} · {v.label}
              </text>
            )}
          </g>
        );
      }),
    [rows, ghosts],
  );

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.type === "pointermove" && !(e.buttons & 1)) return;
    if (e.type === "pointerdown") (e.target as Element).setPointerCapture?.(e.pointerId);
    const r = svg.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const row = rows.find((ro) => py >= ro.top - 9 && py <= ro.top + ro.h + 9) ?? rows[0];
    if (!row) return;
    let best = 0;
    let bd = Infinity;
    row.v.frames.forEach((p, i) => {
      const d = Math.hypot(row.sx(p.x) - px, (row.sy(dotY(p)) - py) * 0.6);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    const s = useTiming.getState();
    if (s.playing) s.pause();
    seek(best);
  };

  const cur = rows.map((row) => {
    const p = row.v.frames[Math.min(frame, row.v.frames.length - 1)];
    const prev = row.v.frames[Math.max(0, Math.min(frame, row.v.frames.length - 1) - 1)];
    const col = variantColor(row.v.id);
    return { row, p, prev, col };
  });
  const main = cur[cur.length - 1];
  const delta = main ? Math.hypot(main.p.x - main.prev.x, dotY(main.p) - dotY(main.prev)) * METERS_PER_UNIT * 100 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="ts-analysis-heading">
        <span className="micro">
          Trajectory <span className="text-ink-3">· one dot per frame</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="mono text-[10.5px] text-ink-2" data-testid="spacing-readout" title="Distance the body travelled since the previous frame">
            spacing <span className="text-ink-0">{delta.toFixed(0)} cm</span>/frame
          </span>
          <button
            type="button"
            aria-pressed={ghosts}
            data-testid="ghosts-toggle"
            onClick={() => useTiming.getState().setGhosts(!ghosts)}
            className={`mono h-6 rounded-[7px] px-2 text-[10.5px] transition-colors ${ghosts ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.07] text-ink-1 hover:bg-white/15"}`}
            title="Onion skin: draw the body's silhouette on every frame"
          >
            Ghosts
          </button>
        </span>
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        <svg
          ref={svg}
          width={size.w}
          height={size.h}
          className="absolute inset-0 cursor-pointer touch-none select-none"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          role="img"
          aria-label="Side view of the motion path with one dot per frame. Click a dot to jump to that frame."
          data-testid="trajectory"
        >
          {size.w > 0 && statics}
          {size.w > 0 &&
            cur.map(({ row, p, col }) => (
              <g key={`cur-${row.v.id}`} pointerEvents="none">
                <ellipse rx={BODY_HALF_W * row.k} ry={(BODY_HEIGHT / 2) * row.k} transform={ghostTransform(p, row)} fill={col} fillOpacity={0.16} stroke={col} strokeWidth={1.4} />
                <circle cx={row.sx(p.x)} cy={row.sy(dotY(p))} r={5.5} fill="none" stroke="#ffffff" strokeWidth={1.6} />
                <circle cx={row.sx(p.x)} cy={row.sy(dotY(p))} r={2.6} fill="#ffffff" />
              </g>
            ))}
        </svg>
      </div>
    </div>
  );
}
