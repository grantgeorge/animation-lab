"use client";

import { useMemo, useRef } from "react";
import {
  type Bezier,
  CURVE_PRESETS,
  CURVE_PRESET_IDS,
  LIMITS,
  METERS_PER_UNIT,
  type MotionParams,
  clampBezier,
  curvePresetOf,
  mirrorBezier,
  motionAt,
} from "../engine";
import { isLocked, useTiming, type VariantView } from "../store";
import { ACCENT_MAIN, ANTIC, INK, SQUASH, variantColor } from "./colors";
import { useElementSize } from "./useElementSize";

const M = { l: 40, r: 12, t: 12, b: 22 };
const CH = 34; // squash channel height
const GAP = 14;

type HandleId = "riseP1" | "riseP2" | "fallP1" | "fallP2";
type Drag = { kind: HandleId | "apex" | "scrub" } | null;

interface Geo {
  pw: number;
  ph: number;
  total: number;
  yMax: number;
  fx: (f: number) => number;
  fy: (h: number) => number;
  invF: (px: number) => number;
  invH: (py: number) => number;
  chTop: number;
}

/** Handle positions for arc 0 of a variant, in (frame, height). */
function handlePoints(v: VariantView) {
  const a = v.timeline.arcs[0];
  const r = a.apexFrame - a.takeoff;
  const fl = a.land - a.apexFrame;
  const H = a.height;
  const { rise, fall } = v.params;
  return {
    arc: a,
    r,
    fl,
    H,
    keys: { takeoff: [a.takeoff, 0], apex: [a.apexFrame, H], land: [a.land, 0] } as Record<string, [number, number]>,
    handles: {
      riseP1: [a.takeoff + rise.x1 * r, rise.y1 * H],
      riseP2: [a.takeoff + rise.x2 * r, rise.y2 * H],
      fallP1: [a.apexFrame + fall.x1 * fl, H * (1 - fall.y1)],
      fallP2: [a.apexFrame + fall.x2 * fl, H * (1 - fall.y2)],
    } as Record<HandleId, [number, number]>,
  };
}

const HANDLE_LABEL: Record<HandleId, string> = {
  riseP1: "Rise: takeoff tangent",
  riseP2: "Rise: apex tangent",
  fallP1: "Fall: apex tangent",
  fallP2: "Fall: impact tangent",
};

/** New curves after moving one handle to (frame, height). Linked curves stay time-mirrors of each other. */
export function moveHandle(p: MotionParams, v: VariantView, id: HandleId, f: number, h: number): Partial<MotionParams> {
  const { arc, r, fl, H } = handlePoints(v);
  let rise: Bezier = { ...p.rise };
  let fall: Bezier = { ...p.fall };
  if (id === "riseP1") rise = { ...rise, x1: (f - arc.takeoff) / r, y1: h / H };
  if (id === "riseP2") rise = { ...rise, x2: (f - arc.takeoff) / r, y2: h / H };
  if (id === "fallP1") fall = { ...fall, x1: (f - arc.apexFrame) / fl, y1: 1 - h / H };
  if (id === "fallP2") fall = { ...fall, x2: (f - arc.apexFrame) / fl, y2: 1 - h / H };
  rise = clampBezier(rise);
  fall = clampBezier(fall);
  if (p.linkCurves) {
    if (id.startsWith("rise")) fall = mirrorBezier(rise);
    else rise = mirrorBezier(fall);
  }
  return { rise, fall };
}

export function CurveEditor() {
  const variants = useTiming((s) => s.variants);
  const frame = useTiming((s) => s.frame);
  const params = useTiming((s) => s.params);
  const cmp = useTiming((s) => s.comparison);
  const setParams = useTiming((s) => s.setParams);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag>(null);

  const curvesLocked = isLocked({ comparison: cmp }, "rise");
  const apexLocked = isLocked({ comparison: cmp }, "height");
  const preset = curvePresetOf(params);
  const editV = variants[variants.length - 1];

  const geo: Geo = useMemo(() => {
    const total = variants[0].timeline.totalFrames;
    const hp = editV ? handlePoints(editV) : null;
    const handleTop = hp ? Math.max(...Object.values(hp.handles).map((q) => q[1])) : 0;
    const yMax = Math.max(1.6, ...variants.map((v) => v.timeline.maxHeight * 1.12), handleTop * 1.04, LIMITS.height[0]);
    const pw = Math.max(10, size.w - M.l - M.r);
    const ph = Math.max(10, size.h - M.t - M.b - CH - GAP);
    return {
      pw,
      ph,
      total,
      yMax,
      fx: (f) => M.l + (f / total) * pw,
      fy: (h) => M.t + ph - (h / yMax) * ph,
      invF: (px) => ((px - M.l) / pw) * total,
      invH: (py) => ((M.t + ph - py) / ph) * yMax,
      chTop: M.t + ph + GAP,
    };
  }, [variants, editV, size]);

  const statics = useMemo(() => {
    if (size.w <= 0) return null;
    const { fx, fy, total, pw, ph, yMax, chTop } = geo;
    const els: React.ReactNode[] = [];
    // Horizontal grid in metres.
    const stepU = yMax > 3 ? 1 : 0.5;
    for (let u = 0; u <= yMax + 1e-6; u += stepU) {
      els.push(<line key={`gy${u}`} x1={M.l} x2={M.l + pw} y1={fy(u)} y2={fy(u)} stroke="white" strokeOpacity={u === 0 ? 0.22 : 0.05} />);
      els.push(
        <text key={`ty${u}`} x={M.l - 6} y={fy(u) + 3} textAnchor="end" className="mono" fontSize={9.5} fill={INK[2]}>
          {(u * METERS_PER_UNIT).toFixed(stepU < 1 ? 2 : 1)}
        </text>,
      );
    }
    // Frame ticks: every frame, taller every 6, labels every 12 (or 24 when crowded).
    const px = pw / total;
    const labelEvery = px * 12 < 26 ? 24 : 12;
    for (let f = 0; f <= total; f++) {
      const big = f % 6 === 0;
      els.push(<line key={`fx${f}`} x1={fx(f)} x2={fx(f)} y1={chTop + CH + 2} y2={chTop + CH + (big ? 7 : 4)} stroke="white" strokeOpacity={big ? 0.35 : 0.16} />);
      if (big && f % 6 === 0 && px * 6 > 7) els.push(<line key={`vg${f}`} x1={fx(f)} x2={fx(f)} y1={M.t} y2={M.t + ph} stroke="white" strokeOpacity={f % labelEvery === 0 ? 0.05 : 0.025} />);
      if (f % labelEvery === 0)
        els.push(
          <text key={`lf${f}`} x={fx(f)} y={chTop + CH + 17} textAnchor="middle" className="mono" fontSize={9.5} fill={INK[2]}>
            {f}
          </text>,
        );
    }
    els.push(
      <text key="unit" x={M.l - 6} y={chTop + CH + 17} textAnchor="end" className="mono" fontSize={9.5} fill={INK[3]}>
        f
      </text>,
      <text key="unitY" x={M.l - 6} y={M.t - 2} textAnchor="end" className="mono" fontSize={9} fill={INK[3]}>
        m
      </text>,
    );
    // Squash channel frame.
    els.push(<rect key="ch" x={M.l} y={chTop} width={pw} height={CH} rx={4} fill="white" fillOpacity={0.025} />);
    els.push(<line key="ch0" x1={M.l} x2={M.l + pw} y1={chTop + CH / 2} y2={chTop + CH / 2} stroke="white" strokeOpacity={0.12} strokeDasharray="2 3" />);
    els.push(
      <text key="chl" x={M.l - 6} y={chTop + CH / 2 + 3} textAnchor="end" className="mono" fontSize={9} fill={SQUASH} fillOpacity={0.8}>
        S&amp;S
      </text>,
    );

    variants.forEach((v, vi) => {
      const tl = v.timeline;
      const col = variantColor(v.id);
      // Anticipation band.
      if (tl.takeoffFrame > 0 && v.params.anticipation > 0 && v.params.anticipationFrames > 0) {
        const a0 = tl.takeoffFrame - v.params.anticipationFrames;
        els.push(<rect key={`ant${vi}`} x={fx(a0)} y={M.t} width={fx(tl.takeoffFrame) - fx(a0)} height={ph} fill={ANTIC} fillOpacity={variants.length > 1 ? 0.05 : 0.07} />);
        if (vi === variants.length - 1)
          els.push(
            <text key={`antl${vi}`} x={fx(a0) + 3} y={M.t + 10} className="mono" fontSize={9} fill={ANTIC} fillOpacity={0.85}>
              windup
            </text>,
          );
      }
      // Height curve.
      const pts: string[] = [];
      for (let t = 0; t <= total; t += 0.2) pts.push(`${fx(t).toFixed(1)},${fy(motionAt(tl, Math.min(t, total - 1e-3)).y).toFixed(1)}`);
      els.push(<polyline key={`c${vi}`} points={pts.join(" ")} fill="none" stroke={col} strokeWidth={1.8} strokeOpacity={variants.length > 1 && vi === 0 ? 0.85 : 1} strokeDasharray={variants.length > 1 && vi === 0 ? "5 3" : undefined} />);
      // Frame samples on the curve.
      v.frames.forEach((p, f) => {
        if (v.params.onTwos && f % 2 === 1 && !p.impact) return;
        els.push(<circle key={`s${vi}-${f}`} cx={fx(f)} cy={fy(p.y)} r={1.7} fill={col} fillOpacity={0.75} />);
      });
      // Keys.
      for (const a of tl.arcs) {
        for (const [f, h] of [
          [a.apexFrame, a.height],
          [a.land, 0],
        ] as const) {
          els.push(<rect key={`k${vi}-${f}`} x={fx(f) - 3.2} y={fy(h) - 3.2} width={6.4} height={6.4} transform={`rotate(45 ${fx(f)} ${fy(h)})`} fill="#0b0e14" stroke={col} strokeWidth={1.2} />);
        }
      }
      // Squash & stretch channel: stepped, one value per frame.
      const sPts: string[] = [];
      v.frames.forEach((p, f) => {
        const y = chTop + CH / 2 - Math.max(-1, Math.min(1, (p.deform.stretch - 1) / 0.6)) * (CH / 2 - 3);
        sPts.push(`${fx(f).toFixed(1)},${y.toFixed(1)}`, `${fx(f + 1).toFixed(1)},${y.toFixed(1)}`);
      });
      els.push(<polyline key={`sq${vi}`} points={sPts.join(" ")} fill="none" stroke={variants.length > 1 ? col : SQUASH} strokeWidth={1.3} strokeOpacity={0.9} strokeDasharray={variants.length > 1 && vi === 0 ? "4 2" : undefined} />);
      // Contacts on the time axis.
      for (const c of tl.contacts) els.push(<line key={`ct${vi}-${c.frame}`} x1={fx(c.frame)} x2={fx(c.frame)} y1={chTop} y2={chTop + CH} stroke={SQUASH} strokeOpacity={0.18} />);
    });
    return els;
  }, [geo, variants, size.w]);

  const hp = editV ? handlePoints(editV) : null;

  const toLocal = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };

  const applyDrag = (kind: NonNullable<Drag>["kind"], px: number, py: number) => {
    const s = useTiming.getState();
    const v = s.variants[s.variants.length - 1];
    const f = geo.invF(px);
    const h = Math.max(0, geo.invH(py));
    if (kind === "scrub") {
      if (s.playing) s.pause();
      s.seek(Math.max(0, Math.min(s.totalFrames - 1, Math.round(f))));
      return;
    }
    if (kind === "apex") {
      const a = v.timeline.arcs[0];
      const air = Math.round(2 * (f - a.takeoff));
      setParams({ height: h, airFrames: Math.max(LIMITS.airFrames[0], Math.min(LIMITS.airFrames[1], air)) });
      return;
    }
    setParams(moveHandle(s.params, v, kind, f, h));
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = (e.target as Element).closest("[data-drag]");
    const kind = (target?.getAttribute("data-drag") ?? "scrub") as NonNullable<Drag>["kind"];
    drag.current = { kind };
    svg.current?.setPointerCapture(e.pointerId);
    const { px, py } = toLocal(e);
    if (kind === "scrub") applyDrag("scrub", px, py);
    e.preventDefault();
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const { px, py } = toLocal(e);
    applyDrag(drag.current.kind, px, py);
  };
  const onUp = () => {
    drag.current = null;
  };

  const nudge = (id: HandleId, e: React.KeyboardEvent) => {
    if (!hp) return;
    const [f, h] = hp.handles[id];
    const df = e.key === "ArrowLeft" ? -0.5 : e.key === "ArrowRight" ? 0.5 : 0;
    const dh = e.key === "ArrowUp" ? 0.05 : e.key === "ArrowDown" ? -0.05 : 0;
    if (!df && !dh) return;
    e.preventDefault();
    e.stopPropagation();
    const s = useTiming.getState();
    setParams(moveHandle(s.params, s.variants[s.variants.length - 1], id, f + df, h + dh));
  };

  const { fx, fy, ph, chTop } = geo;
  const editCol = editV ? variantColor(editV.id) : ACCENT_MAIN;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="ts-analysis-heading">
        <span className="micro">
          Timing curve <span className="text-ink-3">· height over time</span>
        </span>
        <div className="ts-curve-presets" role="radiogroup" aria-label="Curve preset">
          {CURVE_PRESET_IDS.map((id) => {
            const on = preset === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={curvesLocked}
                data-testid={`curve-${id}`}
                title={CURVE_PRESETS[id].hint}
                onClick={() => useTiming.getState().setParams({ ...presetPair(id) })}
                className={`h-6 rounded-[7px] px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  on ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.06] text-ink-1 hover:bg-white/15"
                }`}
              >
                {CURVE_PRESETS[id].label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={params.linkCurves}
            disabled={curvesLocked}
            data-testid="link-curves"
            onClick={() => setParams({ linkCurves: !params.linkCurves })}
            title="Link: the fall mirrors the rise while you drag"
            className={`ml-1 h-6 rounded-[7px] px-2 text-[11px] transition-colors disabled:opacity-35 ${params.linkCurves ? "bg-white/[0.14] text-ink-0" : "bg-white/[0.04] text-ink-2 hover:bg-white/10"}`}
          >
            {params.linkCurves ? "⟷ Linked" : "Unlinked"}
          </button>
        </div>
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        <svg
          ref={svg}
          width={size.w}
          height={size.h}
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          data-testid="curve-editor"
          data-preset={preset ?? "custom"}
          aria-label="Graph editor: height over time. Drag the tangent handles to reshape the curve, the apex key to change height and airtime, or the background to scrub."
        >
          <rect x={M.l} y={M.t} width={geo.pw} height={ph + GAP + CH} fill="transparent" style={{ cursor: "ew-resize" }} />
          {statics}
          {/* Playhead */}
          {size.w > 0 && (
            <g pointerEvents="none">
              <line x1={fx(frame)} x2={fx(frame)} y1={M.t - 4} y2={chTop + CH} stroke={ACCENT_MAIN} strokeWidth={1.4} />
              {variants.map((v) => {
                const p = v.frames[Math.min(frame, v.frames.length - 1)];
                return <circle key={v.id} cx={fx(frame)} cy={fy(p.y)} r={4} fill="#ffffff" stroke={variantColor(v.id)} strokeWidth={1.5} />;
              })}
            </g>
          )}
          {/* Tangent handles and the first apex key. */}
          {size.w > 0 && hp && !curvesLocked && (
            <g data-testid="curve-handles">
              {(["riseP1", "riseP2", "fallP1", "fallP2"] as HandleId[]).map((id) => {
                const [hf, hh] = hp.handles[id];
                const key = id === "riseP1" ? hp.keys.takeoff : id === "fallP2" ? hp.keys.land : hp.keys.apex;
                return (
                  <g key={id}>
                    <line x1={fx(key[0])} y1={fy(key[1])} x2={fx(hf)} y2={fy(hh)} stroke={editCol} strokeOpacity={0.55} strokeWidth={1} pointerEvents="none" />
                    <g
                      className="ts-handle"
                      data-drag={id}
                      data-testid={`handle-${id}`}
                      tabIndex={0}
                      role="slider"
                      aria-label={`${HANDLE_LABEL[id]} (arrow keys nudge)`}
                      aria-valuenow={Math.round(hh * 100) / 100}
                      onKeyDown={(e) => nudge(id, e)}
                    >
                      <circle cx={fx(hf)} cy={fy(hh)} r={11} fill="transparent" />
                      <circle cx={fx(hf)} cy={fy(hh)} r={4.6} fill="#0b0e14" stroke={editCol} strokeWidth={1.6} />
                    </g>
                  </g>
                );
              })}
            </g>
          )}
          {size.w > 0 && hp && !apexLocked && (
            <g className="ts-handle" data-drag="apex" data-testid="apex-key" aria-label="First apex key: drag up/down for height, left/right for airtime">
              <circle cx={fx(hp.keys.apex[0])} cy={fy(hp.keys.apex[1])} r={12} fill="transparent" />
              <rect
                x={fx(hp.keys.apex[0]) - 5}
                y={fy(hp.keys.apex[1]) - 5}
                width={10}
                height={10}
                transform={`rotate(45 ${fx(hp.keys.apex[0])} ${fy(hp.keys.apex[1])})`}
                fill={editCol}
                stroke="#0b0e14"
                strokeWidth={1.2}
              />
            </g>
          )}
          {size.w > 0 && variants.length > 1 && (
            <g className="mono" fontSize={9.5} textAnchor="end" pointerEvents="none">
              {variants.map((v, i) => (
                <text key={v.id} x={M.l + geo.pw - 4} y={M.t + 10 + i * 13} fill={variantColor(v.id)}>
                  {v.id} · {v.label} {i === 0 ? "- - -" : "———"}
                </text>
              ))}
            </g>
          )}
          {size.w > 0 && curvesLocked && (
            <text x={M.l + geo.pw - 4} y={M.t + 10 + variants.length * 13} textAnchor="end" className="mono" fontSize={9.5} fill={INK[2]} pointerEvents="none">
              curves set by this lesson
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

function presetPair(id: (typeof CURVE_PRESET_IDS)[number]) {
  const rise = { ...CURVE_PRESETS[id].rise };
  return { rise, fall: mirrorBezier(rise) };
}
