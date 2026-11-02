"use client";

import { useMemo } from "react";
import { DIAGRAM_FORMATS, extraction, FORMATS, type FormatId } from "../engine/formats";
import { curveUniforms, curveValue, LOOKS } from "../engine/looks";
import { blurInCoc, formatFocal, hfovDeg } from "../engine/optics";
import { MARKS, type MarkId } from "../engine/shot";
import { exposureS } from "../engine/shutter";
import { DIAGRAM_MM } from "../runtime/Orchestrator";
import { slotRef } from "../runtime/live";
import { cfStore, useCF } from "../store";
import { useDerived } from "./useDerived";

/** Label corner per outline, so neighbouring gates don't print on top of each other. */
const CORNER: Partial<Record<FormatId, "tl" | "tr" | "bl" | "br">> = { imax: "tl", alexa265: "tr", "65-5perf": "bl", vv: "br", lf: "tr", ff: "tl", alexa35: "bl", "s35-3perf": "br", "one-inch": "tl", action: "br" };
/** Outlines too close to a neighbour to label unless selected. */
const QUIET: FormatId[] = ["lf"];

const SHORT: Partial<Record<FormatId, string>> = {
  imax: "IMAX 15/70",
  alexa265: "65 mm digital",
  "65-5perf": "65 mm 5-perf",
  vv: "VV",
  lf: "LF",
  ff: "FF",
  alexa35: "S35 4.6K",
  "s35-3perf": "S35 3-perf",
  "one-inch": "1″",
  action: "Action",
};

/**
 * Every gate drawn to scale over the image this lens projects (a 76 × 56 mm area, rendered live
 * underneath). The selected camera's gate is bright, its 16:9 extraction dashed.
 */
export function GateDiagram({ compact = false }: { compact?: boolean }) {
  const d = useDerived();
  const sel = d.format.id;
  const ex = extraction(d.format);
  const W = DIAGRAM_MM.w;
  const H = DIAGRAM_MM.h;
  const list = DIAGRAM_FORMATS.includes(sel) ? DIAGRAM_FORMATS : [...DIAGRAM_FORMATS, sel];
  return (
    <figure className="cf-gate" data-testid="gate-diagram" data-format={sel}>
      <div className="cf-gate-frame" style={{ aspectRatio: `${W} / ${H}` }}>
        <div ref={slotRef("gate")} className="cf-gate-slot" />
        <svg viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} className="cf-gate-svg" aria-label="Sensor gates drawn to scale">
          <path
            d={`M${-W / 2},${-H / 2}h${W}v${H}h${-W}Z M${-d.gate.widthMm / 2},${-d.gate.heightMm / 2}v${d.gate.heightMm}h${d.gate.widthMm}v${-d.gate.heightMm}Z`}
            fill="#05070a"
            fillOpacity={0.5}
            fillRule="evenodd"
          />
          {list.map((id) => {
            const f = FORMATS[id];
            const on = id === sel;
            return (
              <g key={id} data-testid={`gate-${id}`}>
                <rect x={-f.widthMm / 2} y={-f.heightMm / 2} width={f.widthMm} height={f.heightMm} fill="none" stroke={on ? "#ffb547" : "#ffffff"} strokeOpacity={on ? 1 : 0.38} strokeWidth={on ? 0.5 : 0.22} vectorEffect="non-scaling-stroke" />
                {(on || (!compact && f.widthMm >= 20 && !QUIET.includes(id))) && (() => {
                  const c = CORNER[id] ?? "tl";
                  const right = c.endsWith("r");
                  const bottom = c.startsWith("b");
                  const small = f.widthMm < 15;
                  return (
                    <text
                      x={small ? 0 : right ? f.widthMm / 2 - 0.7 : -f.widthMm / 2 + 0.7}
                      y={small ? (id === "action" ? f.heightMm / 2 + 2.6 : -f.heightMm / 2 - 0.8) : bottom ? f.heightMm / 2 - 0.9 : -f.heightMm / 2 + 2.6}
                      textAnchor={small ? "middle" : right ? "end" : "start"}
                      fontSize={on ? 2.5 : 2.1}
                      fill={on ? "#ffcf85" : "#e3e8ef"}
                      opacity={on ? 1 : 0.75}
                      className="mono"
                      style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 0.5, strokeOpacity: 0.6 }}
                    >
                      {SHORT[id] ?? f.label}
                    </text>
                  );
                })()}
              </g>
            );
          })}
          <rect x={-ex.widthMm / 2} y={-ex.heightMm / 2} width={ex.widthMm} height={ex.heightMm} fill="none" stroke="#ffb547" strokeDasharray="1.2 0.8" strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <figcaption>
        <span className="mono">{d.format.label}</span> {d.format.widthMm.toFixed(2)} × {d.format.heightMm.toFixed(2)} mm{d.format.nominal ? " (nominal)" : ""} · crop ×{d.crop.toFixed(2)} vs full frame. One lens, one projected image: each sensor crops it. Dashed: the 16:9 frame we deliver.
      </figcaption>
    </figure>
  );
}

const DOF_MAX_M = 11;

/** Near/far limits in metres from the lens, with the set marked and the blur growing away from focus. */
export function DofBand() {
  const d = useDerived();
  const focalMm = useCF((s) => s.focalMm);
  const tStop = useCF((s) => s.tStop);
  const focusM = useCF((s) => s.focusM);
  const W = 300;
  const H = 120;
  const x = (m: number) => 10 + (Math.min(m, DOF_MAX_M) / DOF_MAX_M) * (W - 20);
  const curve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const m = 0.6 + (i / 120) * (DOF_MAX_M - 0.6);
      const b = blurInCoc(focalMm, tStop, focusM, m, d.gate);
      pts.push(`${x(m).toFixed(1)},${(84 - Math.min(Math.log2(1 + b) / Math.log2(33), 1) * 62).toFixed(1)}`);
    }
    return pts.join(" ");
  }, [focalMm, tStop, focusM, d.gate]);
  const nearX = x(d.dof.nearM);
  const farX = Number.isFinite(d.dof.farM) ? x(d.dof.farM) : W - 10;
  const marks: MarkId[] = ["lantern", "bram", "pip", "wall"];
  return (
    <figure className="cf-dof" data-testid="dof-band" data-near={d.dof.nearM.toFixed(3)} data-far={Number.isFinite(d.dof.farM) ? d.dof.farM.toFixed(3) : "inf"}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-label="Depth of field band">
        <rect x={nearX} y={18} width={Math.max(1.5, farX - nearX)} height={68} fill="#5fe3ff" opacity={0.14} />
        <line x1={nearX} x2={nearX} y1={18} y2={86} stroke="#5fe3ff" strokeWidth={1} />
        {Number.isFinite(d.dof.farM) && d.dof.farM < DOF_MAX_M && <line x1={farX} x2={farX} y1={18} y2={86} stroke="#5fe3ff" strokeWidth={1} />}
        <polyline points={curve} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1} />
        <line x1={x(focusM)} x2={x(focusM)} y1={12} y2={92} stroke="#ffb547" strokeWidth={1.4} />
        <text x={x(focusM)} y={9} fontSize={8} textAnchor="middle" fill="#ffcf85" className="mono">focus {focusM.toFixed(2)} m</text>
        <line x1={10} x2={W - 10} y1={92} y2={92} stroke="#ffffff" strokeOpacity={0.25} />
        {[0, 2, 4, 6, 8, 10].map((m) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={92} y2={95} stroke="#ffffff" strokeOpacity={0.35} />
            <text x={x(m)} y={104} fontSize={7} textAnchor="middle" fill="#7c8796" className="mono">{m} m</text>
          </g>
        ))}
        {marks.map((id) => {
          const sharp = d.blur[id] <= 1;
          return (
            <g key={id} data-testid={`dof-mark-${id}`} data-sharp={sharp ? "1" : "0"}>
              <circle cx={x(d.depth[id])} cy={92} r={3} fill={sharp ? "#8ef0c3" : "#3a414d"} stroke="#0d0f13" />
              <text x={x(d.depth[id])} y={115} fontSize={7.5} textAnchor="middle" fill={sharp ? "#8ef0c3" : "#9aa4b2"}>{MARKS[id].label}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mono">
        near {d.dof.nearM.toFixed(2)} m · far {Number.isFinite(d.dof.farM) ? `${d.dof.farM.toFixed(2)} m` : "∞"} · CoC {(d.coc * 1000).toFixed(0)} µm · white line: blur size
      </figcaption>
    </figure>
  );
}

/** Top-down field of view: this gate (solid) vs the same lens on full frame (dashed). */
export function FovWedge() {
  const d = useDerived();
  const focalMm = useCF((s) => s.focalMm);
  const ff = hfovDeg(focalMm, { widthMm: 36, heightMm: 20.25 });
  const W = 300;
  const H = 128;
  const ox = W / 2;
  const oy = H - 10;
  const R = 108;
  const wedge = (deg: number) => {
    const a = ((Math.min(deg, 170) / 2) * Math.PI) / 180;
    return `M${ox},${oy} L${ox - Math.sin(a) * R},${oy - Math.cos(a) * R} A${R},${R} 0 0 1 ${ox + Math.sin(a) * R},${oy - Math.cos(a) * R} Z`;
  };
  return (
    <figure className="cf-fov" data-testid="fov-wedge">
      <svg viewBox={`0 0 ${W} ${H}`} aria-label="Field of view">
        <path d={wedge(ff)} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeDasharray="3 3" />
        <path d={wedge(d.hfov)} fill="#5fe3ff" fillOpacity={0.12} stroke="#5fe3ff" />
        <text x={8} y={16} fontSize={10} fill="#8febff" className="mono">{d.hfov.toFixed(1)}° horizontal</text>
        <text x={8} y={29} fontSize={8} fill="#7c8796" className="mono">dashed: same lens on FF</text>
        <circle cx={ox} cy={oy} r={3} fill="#ffb547" />
      </svg>
      <figcaption className="mono">{formatFocal(focalMm)} mm on {d.format.label}: {d.hfov.toFixed(1)}° · on full frame: {ff.toFixed(1)}° (dashed)</figcaption>
    </figure>
  );
}

/** A rotary shutter for the current angle, and one frame interval with the open time and the sub-frame samples. */
export function ShutterDiagram({ samples, perBand = false }: { samples: number; perBand?: boolean }) {
  const deg = useCF((s) => s.shutterDeg);
  const fps = useCF((s) => s.fps);
  const W = 300;
  const H = 96;
  const cx = 44;
  const cy = 46;
  const r = 34;
  const a = (deg / 360) * Math.PI * 2;
  const open = deg >= 360 ? `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0` : `M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${cx + Math.sin(a) * r},${cy - Math.cos(a) * r} Z`;
  const x0 = 100;
  const x1 = W - 10;
  const frac = deg / 360;
  return (
    <figure className="cf-shutter" data-testid="shutter-diagram" data-samples={samples}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-label="Shutter">
        <circle cx={cx} cy={cy} r={r} fill="#1b1f27" stroke="#ffffff" strokeOpacity={0.25} />
        <path d={open} fill="#ffb547" fillOpacity={0.75} />
        <text x={cx} y={cy + r + 12} fontSize={8} textAnchor="middle" fill="#9aa4b2" className="mono">{deg}° open</text>
        <rect x={x0} y={30} width={x1 - x0} height={22} fill="#1b1f27" stroke="#ffffff" strokeOpacity={0.2} />
        <rect x={x0} y={30} width={(x1 - x0) * frac} height={22} fill="#ffb547" fillOpacity={0.35} />
        {Array.from({ length: samples }, (_, k) => (
          <line key={k} x1={x0 + (x1 - x0) * frac * ((k + 0.5) / samples)} x2={x0 + (x1 - x0) * frac * ((k + 0.5) / samples)} y1={30} y2={52} stroke="#ffcf85" strokeWidth={1} />
        ))}
        <text x={x0} y={22} fontSize={8} fill="#9aa4b2" className="mono">one frame · 1/{fps} s</text>
        <text x={x0} y={68} fontSize={8} fill="#ffcf85" className="mono">open {(exposureS(deg, fps) * 1000).toFixed(1)} ms · {samples} sample{samples === 1 ? "" : "s"}{perBand ? " per row band" : " averaged"}</text>
      </svg>
    </figure>
  );
}

/** Highlights in the doorway, in stops over 18 % grey at exposure 0 (estimated from the emissive materials). */
export const HIGHLIGHTS = [
  { label: "window", stops: 2.5 },
  { label: "lantern", stops: 3.2 },
  { label: "lantern red", stops: 4.1 },
] as const;

/** The characteristic curve of the current look against the neutral reference, with the highlights marked. */
export function CurvePlot() {
  const lookId = useCF((s) => s.lookId);
  const ev = useCF((s) => s.exposureStops);
  const W = 300;
  const H = 150;
  const lo = -7;
  const hi = 11;
  const x = (st: number) => 26 + ((st - lo) / (hi - lo)) * (W - 36);
  const y = (v: number) => H - 22 - v * (H - 34);
  const path = (id: typeof lookId) => {
    const u = curveUniforms(LOOKS[id]);
    const pts: string[] = [];
    for (let i = 0; i <= 180; i++) {
      const st = lo + (i / 180) * (hi - lo);
      pts.push(`${x(st).toFixed(1)},${y(curveValue(u, st)).toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const look = LOOKS[lookId];
  return (
    <figure className="cf-curve" data-testid="curve-plot" data-look={lookId}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-label="Characteristic curve">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => <line key={v} x1={26} x2={W - 10} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity={0.07} />)}
        {[-6, -4, -2, 0, 2, 4, 6, 8, 10].map((st) => (
          <g key={st}>
            <line x1={x(st)} x2={x(st)} y1={y(0)} y2={y(1)} stroke="#ffffff" strokeOpacity={st === 0 ? 0.2 : 0.06} />
            <text x={x(st)} y={H - 8} fontSize={7} textAnchor="middle" fill="#7c8796" className="mono">{st > 0 ? `+${st}` : st}</text>
          </g>
        ))}
        <text x={4} y={y(1) + 3} fontSize={7} fill="#7c8796" className="mono">white</text>
        <polyline points={path("neutral")} fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeDasharray="3 2" />
        <polyline points={path(lookId)} fill="none" stroke="#ffb547" strokeWidth={1.6} />
        <line x1={x(look.clipStops)} x2={x(look.clipStops)} y1={y(0)} y2={y(1)} stroke="#ff6b6b" strokeOpacity={0.6} strokeDasharray="2 2" />
        <text x={Math.min(x(look.clipStops) + 2, W - 40)} y={y(0.06)} fontSize={7} fill="#ff9a9a" className="mono">clip +{look.clipStops}</text>
        {HIGHLIGHTS.map((h, i) => {
          const cx = x(h.stops + ev);
          const cy = y(curveValue(curveUniforms(look), h.stops + ev));
          const ly = y(0.62) + i * 10;
          return (
            <g key={h.label}>
              <line x1={cx} x2={cx} y1={cy + 3} y2={ly - 6} stroke="#8febff" strokeOpacity={0.35} />
              <circle cx={cx} cy={cy} r={2.6} fill="#8febff" />
              <text x={cx + 3} y={ly} fontSize={7} fill="#8febff">{h.label}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mono">stops over 18 % grey → display value · dashed: neutral · blue: highlights at {ev >= 0 ? "+" : ""}{ev.toFixed(1)} EV</figcaption>
    </figure>
  );
}

export const openGuide = () => cfStore.getState().setHelp(true);
