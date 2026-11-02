"use client";

import { useRef } from "react";
import { studio } from "../config";
import { DEG, clamp } from "../engine/spherical";
import { LIGHT_IDS, LIMITS, type LightId } from "../engine/types";
import { studioStore, useStudio } from "../store";

const C = 100;
const R = 78;
/** Polar "sky map" seen from above: centre = overhead, horizon ring, rim = 30° below. */
const radiusFor = (el: number) => ((90 - el) / 120) * R;
const toXY = (az: number, el: number): [number, number] => {
  const r = radiusFor(el);
  return [C + r * Math.sin(az * DEG), C + r * Math.cos(az * DEG)];
};
function fromXY(x: number, y: number) {
  const dx = x - C;
  const dy = y - C;
  const r = Math.hypot(dx, dy);
  return {
    azimuthDeg: Math.atan2(dx, dy) / DEG,
    elevationDeg: clamp(90 - (r / R) * 120, LIMITS.elevationDeg.min, LIMITS.elevationDeg.max),
  };
}

const LETTER: Record<LightId, string> = { key: "K", fill: "F", rim: "R" };

/**
 * Top-down placement dial. Camera at the bottom, subject in the middle. Drag a dot to move that
 * light around him; distance from the centre is height (centre = overhead, dashed ring = eye level).
 */
export function DomeDial() {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<LightId | null>(null);
  const lights = useStudio((s) => s.rig.lights);
  const selected = useStudio((s) => s.selected);
  const solo = useStudio((s) => s.solo);
  const step = useStudio((s) => s.takeApart);

  const local = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 200, ((e.clientY - r.top) / r.height) * 200] as const;
  };
  const move = (id: LightId, e: React.PointerEvent) => {
    const [x, y] = local(e);
    studioStore.getState().setLight(id, fromXY(x, y));
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    dragging.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    studioStore.getState().setDragging(false);
  };

  return (
    <svg
      ref={svg}
      viewBox="0 0 200 200"
      className={`ls-dial mx-auto block w-full max-w-[172px]`}
      role="img"
      aria-label="Light placement, seen from above. Camera at the bottom."
      data-testid="dome-dial"
      onPointerDown={(e) => {
        const target = (e.target as SVGElement).closest("[data-light]") as SVGElement | null;
        const s = studioStore.getState();
        const id = (target?.dataset.light as LightId | undefined) ?? (s.selected === "ambient" ? null : s.selected);
        if (!id) return;
        dragging.current = id;
        svg.current!.setPointerCapture(e.pointerId);
        s.select(id);
        s.setDragging(true);
        move(id, e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) move(dragging.current, e);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <circle cx={C} cy={C} r={R} fill="rgb(255 255 255 / 0.025)" stroke="rgb(255 255 255 / 0.1)" strokeDasharray="2 3" />
      <circle cx={C} cy={C} r={radiusFor(0)} fill="none" stroke="rgb(255 255 255 / 0.28)" strokeDasharray="4 3" />
      <circle cx={C} cy={C} r={radiusFor(30)} fill="none" stroke="rgb(255 255 255 / 0.08)" />
      <circle cx={C} cy={C} r={radiusFor(60)} fill="none" stroke="rgb(255 255 255 / 0.08)" />
      <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="rgb(255 255 255 / 0.07)" />
      <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="rgb(255 255 255 / 0.07)" />
      <text x={C} y={C - radiusFor(0) - 3} textAnchor="middle" className="mono" fontSize="7" fill="rgb(185 194 207 / 0.55)">
        EYE LEVEL
      </text>
      <text x={C} y={11} textAnchor="middle" className="mono" fontSize="8" fill="rgb(185 194 207 / 0.6)">
        BEHIND
      </text>
      <text x={8} y={C + 3} className="mono" fontSize="8" fill="rgb(185 194 207 / 0.6)">
        L
      </text>
      <text x={192} y={C + 3} textAnchor="end" className="mono" fontSize="8" fill="rgb(185 194 207 / 0.6)">
        R
      </text>
      {/* camera at the bottom */}
      <g transform={`translate(${C} ${C + R + 9})`}>
        <rect x={-8} y={-3} width={16} height={9} rx={2} fill="#9AA3AD" />
        <path d="M -5 -3 L 0 -8 L 5 -3 Z" fill="#9AA3AD" />
        <text x={14} y={5} className="mono" fontSize="7.5" fill="rgb(185 194 207 / 0.7)">
          CAMERA
        </text>
      </g>
      {/* subject from above: head, nose toward camera */}
      <circle cx={C} cy={C} r={7} fill="#2B2F36" stroke="#B9C2CF" strokeWidth={1} />
      <path d={`M ${C - 2.5} ${C + 6} L ${C} ${C + 10} L ${C + 2.5} ${C + 6} Z`} fill="#B9C2CF" />
      {LIGHT_IDS.map((id) => {
        const l = lights[id];
        const [x, y] = toXY(l.azimuthDeg, l.elevationDeg);
        const sel = selected === id;
        const visible = solo ? solo === id : step === null || (step >= ["key", "fill", "rim"].indexOf(id));
        const lit = l.on && visible;
        const col = studio.ui[id];
        return (
          <g key={id} data-light={id} data-testid={`dial-${id}`} style={{ cursor: "grab" }}>
            <line x1={C} y1={C} x2={x} y2={y} stroke={col} strokeOpacity={lit ? 0.55 : 0.2} strokeWidth={1} />
            <circle cx={x} cy={y} r={14} fill="transparent" />
            <circle cx={x} cy={y} r={sel ? 9 : 7.5} fill={lit ? col : "#0E121A"} stroke={col} strokeWidth={sel ? 2 : 1.5} />
            <text x={x} y={y + 3} textAnchor="middle" className="mono" fontSize="8.5" fontWeight={700} fill={lit ? "#0B0E14" : col} pointerEvents="none">
              {LETTER[id]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
