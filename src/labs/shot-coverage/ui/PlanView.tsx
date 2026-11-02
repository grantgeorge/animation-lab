"use client";

import { useMemo, useRef } from "react";
import { getScene } from "@/labs/lens-and-framing/config";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { axisAt } from "../engine/axis";
import { coverageFor, defaultCoverage, frontSide } from "../engine/presets";
import { CAM_IDS, type CamId } from "../engine/types";
import { AXIS_COLOR, BRAM_COLOR, CAM_COLOR, CROSS_COLOR, PIP_COLOR } from "../colors";
import { scStore, subjectsFor, useSC } from "../store";
import { live } from "../runtime/live";

/** Fixed view box per scene: the default cameras, the characters and some room around them. */
function viewFor(sceneId: Parameters<typeof getScene>[0]) {
  const d = getScene(sceneId);
  const subj = subjectsFor(sceneId);
  const cov = coverageFor(d);
  const cams = defaultCoverage(d, subj);
  const pts: [number, number][] = [...Object.values(cams).map((c) => [c.position[0], c.position[2]] as [number, number])];
  for (const id of ["primary", "secondary"] as const) {
    const f = subj(id, cov.tRef).feet;
    pts.push([f[0], f[2]]);
  }
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * 1.5) / 2 + 1.6;
  return { cx, cz, hw: half, hh: half / 1.5, zone: cov.zone };
}

const wedge = (x: number, z: number, yaw: number, half: number, len: number) => {
  const a = yaw - half;
  const b = yaw + half;
  return `M${x},${z} L${x + Math.sin(a) * len},${z + -Math.cos(a) * len} L${x + Math.sin(b) * len},${z + -Math.cos(b) * len} Z`;
};

/**
 * Top-down plan: the set's camera zone, both characters (with eyelines), the axis of action and the
 * front / across half-planes, and each camera with its field-of-view wedge. Cameras drag here too.
 */
export function PlanView({ className = "" }: { className?: string }) {
  const sceneId = useSC((s) => s.sceneId);
  const cameras = useSC((s) => s.cameras);
  const selected = useSC((s) => s.selected);
  const v = useMemo(() => viewFor(sceneId), [sceneId]);
  const svg = useRef<SVGSVGElement>(null);
  const axis = useRef<SVGLineElement>(null);
  const front = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);
  const bram = useRef<SVGGElement>(null);
  const pip = useRef<SVGGElement>(null);
  const bramLook = useRef<SVGLineElement>(null);
  const pipLook = useRef<SVGLineElement>(null);
  const wedges = useRef<Partial<Record<CamId, SVGPathElement | null>>>({});
  const drag = useRef<CamId | null>(null);

  useFrameUpdater(({ t }) => {
    const d = getScene(sceneId);
    const subj = subjectsFor(sceneId);
    const ax = live.axis ?? axisAt(subj, t);
    const [ax0, az0] = ax.a;
    const E = 40;
    axis.current?.setAttribute("x1", `${ax0 - ax.u[0] * E}`);
    axis.current?.setAttribute("y1", `${az0 - ax.u[1] * E}`);
    axis.current?.setAttribute("x2", `${ax0 + ax.u[0] * E}`);
    axis.current?.setAttribute("y2", `${az0 + ax.u[1] * E}`);
    const f = frontSide(d, ax);
    const half = (s: number) => {
      const nx = ax.n[0] * s * E;
      const nz = ax.n[1] * s * E;
      const p1 = [ax0 - ax.u[0] * E, az0 - ax.u[1] * E];
      const p2 = [ax0 + ax.u[0] * E, az0 + ax.u[1] * E];
      return `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]} L${p2[0] + nx},${p2[1] + nz} L${p1[0] + nx},${p1[1] + nz} Z`;
    };
    front.current?.setAttribute("d", half(f));
    back.current?.setAttribute("d", half(-f));
    const b = subj("primary", t).feet;
    const p = subj("secondary", t).feet;
    bram.current?.setAttribute("transform", `translate(${b[0]},${b[2]})`);
    pip.current?.setAttribute("transform", `translate(${p[0]},${p[2]})`);
    const look = (el: SVGLineElement | null, dir: number) => {
      el?.setAttribute("x2", `${ax.u[0] * 0.55 * dir}`);
      el?.setAttribute("y2", `${ax.u[1] * 0.55 * dir}`);
    };
    look(bramLook.current, 1);
    look(pipLook.current, -1);
    for (const id of CAM_IDS) {
      const pose = live.poses[id];
      const el = wedges.current[id];
      if (!pose || !el) continue;
      const dx = pose.target[0] - pose.position.x;
      const dz = pose.target[2] - pose.position.z;
      const yaw = Math.atan2(dx, -dz);
      const halfFov = Math.atan(d.gate.widthMm / 2 / pose.focalMm);
      const len = Math.min(7, Math.max(1.2, Math.hypot(dx, dz) * 1.15));
      el.setAttribute("d", wedge(pose.position.x, pose.position.z, yaw, halfFov, len));
    }
  }, ORDER.MEASURE);

  const toWorld = (e: React.PointerEvent) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y] as const;
  };
  const r = v.hw / 34;
  return (
    <svg
      ref={svg}
      data-testid="plan-view"
      className={`block h-full w-full touch-none select-none ${className}`}
      viewBox={`${v.cx - v.hw} ${v.cz - v.hh} ${v.hw * 2} ${v.hh * 2}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={(e) => {
        const id = drag.current;
        if (!id) return;
        const w = toWorld(e);
        if (!w) return;
        const c = scStore.getState().cameras[id];
        scStore.getState().setCamera(id, { position: [w[0], c.position[1], w[1]] });
      }}
      onPointerUp={() => {
        if (drag.current) scStore.getState().setDragging(null);
        drag.current = null;
      }}
    >
      <defs>
        <pattern id="sc-grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth={r * 0.12} />
        </pattern>
      </defs>
      <rect x={v.cx - v.hw} y={v.cz - v.hh} width={v.hw * 2} height={v.hh * 2} fill="url(#sc-grid)" />
      <path ref={front} fill="rgb(95 227 255 / 0.06)" />
      <path ref={back} fill="rgb(255 107 107 / 0.15)" />
      <rect x={v.zone.x[0]} y={v.zone.z[0]} width={v.zone.x[1] - v.zone.x[0]} height={v.zone.z[1] - v.zone.z[0]} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth={r * 0.18} strokeDasharray={`${r} ${r * 0.7}`} />
      <line ref={axis} stroke={AXIS_COLOR} strokeWidth={r * 0.32} strokeDasharray={`${r * 1.6} ${r * 0.7}`} />
      {CAM_IDS.map((id) => (
        <path key={`w-${id}`} ref={(el) => void (wedges.current[id] = el)} fill={CAM_COLOR[id]} fillOpacity={selected === id ? 0.26 : 0.13} stroke={CAM_COLOR[id]} strokeOpacity={0.7} strokeWidth={r * 0.14} />
      ))}
      <g ref={bram}>
        <line ref={bramLook} x1={0} y1={0} stroke={BRAM_COLOR} strokeWidth={r * 0.3} />
        <circle r={r * 1.5} fill={BRAM_COLOR} />
        <text y={r * 0.55} textAnchor="middle" fontSize={r * 1.6} fontWeight={700} fill="#0B0E14" className="mono">
          B
        </text>
      </g>
      <g ref={pip}>
        <line ref={pipLook} x1={0} y1={0} stroke={PIP_COLOR} strokeWidth={r * 0.3} />
        <circle r={r * 1.25} fill={PIP_COLOR} />
        <text y={r * 0.5} textAnchor="middle" fontSize={r * 1.4} fontWeight={700} fill="#0B0E14" className="mono">
          P
        </text>
      </g>
      {CAM_IDS.map((id) => {
        const c = cameras[id];
        const on = selected === id;
        return (
          <g
            key={id}
            transform={`translate(${c.position[0]},${c.position[2]})`}
            className="cursor-grab"
            data-testid={`plan-cam-${id}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId);
              drag.current = id;
              scStore.getState().select(id);
              scStore.getState().setDragging(id);
            }}
          >
            <circle r={r * 1.9} fill="#0B0E14" stroke={CAM_COLOR[id]} strokeWidth={r * (on ? 0.5 : 0.28)} />
            <text y={r * 0.6} textAnchor="middle" fontSize={r * 1.8} fontWeight={800} fill={CAM_COLOR[id]} className="mono">
              {id}
            </text>
          </g>
        );
      })}
      <text x={v.cx - v.hw + r} y={v.cz - v.hh + r * 2} fontSize={r * 1.2} fill="#7C8796" className="mono">
        PLAN · axis of action
      </text>
      <text x={v.cx - v.hw + r} y={v.cz - v.hh + r * 3.6} fontSize={r * 1.05} fill={CROSS_COLOR} fillOpacity={0.85} className="mono">
        red side = across the line
      </text>
    </svg>
  );
}
