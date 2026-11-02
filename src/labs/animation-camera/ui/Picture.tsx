"use client";

import { useMemo } from "react";
import { FPS } from "../engine/common";
import { E1, orthoFor, perspShot, rulerSegments, vanishingPoint, type Segment2 } from "../engine/projection";
import { E2 } from "../engine/lens";
import { E5 } from "../engine/impossible";
import { DEMO_COPY, EXP_COPY } from "../content";
import { acStore, useAC, type ACState } from "../store";
import { live } from "../runtime/live";
import { LiveText, Slot } from "./Chrome";

const X = (n: number) => ((n + 1) / 2) * 1600;
const Y = (n: number) => ((1 - n) / 2) * 900;

/** Extension of the floor rulers past their far end: to the vanishing point, or on forever (parallel). */
function RulerOverlay({ view, side }: { view: "street" | "iso"; side: "perspective" | "orthographic" }) {
  const lines = useMemo(() => {
    const s = perspShot(view);
    const segs = rulerSegments(s, side, orthoFor(view));
    const vp = side === "perspective" ? vanishingPoint(s, [0, 0, -1]) : null;
    const ext = (g: Segment2) => {
      if (vp) return { a: g.a, b: vp };
      const d = [g.b[0] - g.a[0], g.b[1] - g.a[1]];
      return { a: g.a, b: [g.b[0] + d[0] * 3, g.b[1] + d[1] * 3] as [number, number] };
    };
    return { segs: segs.map(ext), vp };
  }, [view, side]);
  const color = side === "perspective" ? "#5fe3ff" : "#ffb547";
  return (
    <g>
      {lines.segs.map((l, i) => (
        <line key={i} x1={X(l.a[0])} y1={Y(l.a[1])} x2={X(l.b[0])} y2={Y(l.b[1])} stroke={color} strokeWidth={1.6} strokeDasharray="6 7" opacity={0.75} />
      ))}
      {lines.vp && (
        <g transform={`translate(${X(lines.vp[0])} ${Y(lines.vp[1])})`}>
          <circle r={9} fill="none" stroke={color} strokeWidth={2} />
          <circle r={2.5} fill={color} />
          <text x={14} y={-10} fill={color} fontSize={22} fontFamily="ui-monospace, monospace">
            vanishing point
          </text>
        </g>
      )}
    </g>
  );
}

function E1Overlay({ s }: { s: ACState }) {
  const { proj, view, compare, wipe, guides } = s.e1;
  if (!guides) return null;
  const w = compare === "wipe" ? wipe : null;
  return (
    <svg className="ac-overlay" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
      <defs>
        <clipPath id="ac-left">
          <rect x={0} y={0} width={1600 * (w ?? 1)} height={900} />
        </clipPath>
        <clipPath id="ac-right">
          <rect x={1600 * (w ?? 0)} y={0} width={1600} height={900} />
        </clipPath>
      </defs>
      {w === null ? (
        <RulerOverlay view={view} side={proj} />
      ) : (
        <>
          <g clipPath="url(#ac-left)">
            <RulerOverlay view={view} side="perspective" />
          </g>
          <g clipPath="url(#ac-right)">
            <RulerOverlay view={view} side="orthographic" />
          </g>
        </>
      )}
    </svg>
  );
}

function Chip({ children, tone = "plain", testId }: { children: React.ReactNode; tone?: "plain" | "cyan" | "amber" | "pink" | "mint"; testId?: string }) {
  return (
    <span className={`ac-chip ac-chip-${tone}`} data-testid={testId}>
      {children}
    </span>
  );
}

function MainChips({ s }: { s: ACState }) {
  switch (s.exp) {
    case 1: {
      const { proj, view, compare } = s.e1;
      if (compare === "wipe")
        return (
          <>
            <div className="ac-chips">
              <Chip tone="cyan">PERSPECTIVE · {view === "iso" ? 35 : E1.street.focalMm} mm</Chip>
            </div>
            <div className="ac-chips ac-chips-right">
              <Chip tone="amber">ORTHOGRAPHIC{view === "iso" ? " · ISOMETRIC" : ""}</Chip>
            </div>
          </>
        );
      return (
        <div className="ac-chips">
          <Chip tone={proj === "perspective" ? "cyan" : "amber"} testId="main-projection">
            {proj === "perspective" ? `PERSPECTIVE · ${view === "iso" ? 35 : E1.street.focalMm} mm` : view === "iso" ? "ORTHOGRAPHIC · ISOMETRIC 45° / 35.264°" : "ORTHOGRAPHIC"}
          </Chip>
          <LiveText className="ac-chip" get={() => (live.e1 ? `Pip ÷ Bram ${live.e1.main.pipToBram.toFixed(2)} (true ${live.e1.main.trueRatio.toFixed(2)})` : "")} />
        </div>
      );
    }
    case 2:
      return (
        <div className="ac-chips">
          <LiveText className="ac-chip ac-chip-cyan" data-testid="main-lens" get={() => (live.e2 ? `${live.e2.main.focalMm.toFixed(0)} mm · ${live.e2.main.distanceM.toFixed(2)} m from Bram` : "")} />
          <LiveText className="ac-chip" get={() => (live.e2 ? `Bram fills ${(live.e2.main.metric * 100).toFixed(0)} %` : "")} />
          {(s.e2.sweep || s.mode === "watch") && <Chip tone="amber">DOLLY ZOOM</Chip>}
        </div>
      );
    case 3:
      return (
        <div className="ac-chips">
          <Chip tone="cyan">{EXP_COPY[3].compare[["2d", "2.5d", "3d"].indexOf(s.e3.style)].toUpperCase()}</Chip>
          <Chip>{s.e3.move === "orbit" ? "ORBIT 64°" : "TRACK + PUSH"}</Chip>
        </div>
      );
    case 4:
      return (
        <>
          <div className="ac-chips">
            {s.e4.style !== "anime" && <Chip tone="cyan">PHOTOREAL · 75 mm f/{s.e4.fStop}{s.e4.motionBlur ? " · 180° SHUTTER" : ""}</Chip>}
            {s.e4.style === "anime" && <Chip tone="pink">ANIME · ON {["ONES", "TWOS", "THREES"][s.e4.step - 1]}</Chip>}
          </div>
          {s.e4.style === "split" && (
            <div className="ac-chips ac-chips-right">
              <Chip tone="pink">ANIME · ON {["ONES", "TWOS", "THREES"][s.e4.step - 1]}</Chip>
            </div>
          )}
          <div className="ac-chips ac-chips-bottom">
            <LiveText className="ac-chip" data-testid="timing-chip" get={() => (live.e4 ? `frame ${live.e4.frame} · drawing ${live.e4.drawing}${live.e4.held ? " (held)" : " (new)"}` : "")} />
          </div>
        </>
      );
    default:
      return (
        <div className="ac-chips">
          <Chip tone="pink">{DEMO_COPY[s.e5.demo].label.toUpperCase()}</Chip>
          <Chip>breaks: {DEMO_COPY[s.e5.demo].rule}</Chip>
          {s.e5.demo === "cheat" && <LiveText className="ac-chip" data-testid="cheat-readout" get={() => (live.e5 ? `face ${E5.cheat.teleMm} mm: nose ÷ ear ${live.e5.faceTele.toFixed(2)}× · world ${E5.cheat.wideMm} mm (a ${E5.cheat.wideMm} mm face would be ${live.e5.faceWide.toFixed(2)}×)` : "")} />}
        </div>
      );
  }
}

/** The camera picture: one 16:9 slot with chips and overlays. */
export function MainPicture() {
  const s = useAC((x) => x);
  const wipe = s.exp === 1 && s.e1.compare === "wipe" && s.mode !== "watch";
  const split = s.exp === 4 && s.e4.style === "split";
  return (
    <div className="ac-main-frame">
      <Slot id="main" testId="monitor-main">
        {s.exp === 1 && <E1Overlay s={s} />}
        <MainChips s={s} />
        {wipe && <div className="ac-divider" style={{ left: `${s.e1.wipe * 100}%` }} />}
        {split && <div className="ac-divider ac-divider-fixed" style={{ left: "50%" }} />}
        {wipe && (
          <input
            className="ac-wipe-input"
            type="range"
            min={0.05}
            max={0.95}
            step={0.005}
            value={s.e1.wipe}
            aria-label="Wipe between perspective and orthographic"
            data-testid="wipe-slider"
            onChange={(e) => acStore.getState().setE1({ wipe: Number(e.target.value) })}
          />
        )}
      </Slot>
    </div>
  );
}

/** Two or three small monitors with the experiment's alternatives, side by side. Click to choose. */
export function CompareRow() {
  const s = useAC((x) => x);
  const cheat = s.exp === 5 && s.e5.demo === "cheat";
  const labels = cheat ? [`Physical · ${E5.cheat.wideMm} mm`, `Physical · ${E5.cheat.teleMm} mm`, "Cheat · both"] : EXP_COPY[s.exp].compare;
  const selected = (i: number) => {
    switch (s.exp) {
      case 1:
        return i === 2 ? s.e1.view === "iso" && s.e1.proj === "orthographic" : s.e1.view === "street" && s.e1.proj === (i === 0 ? "perspective" : "orthographic");
      case 2:
        return Math.round(s.e2.focal) === E2.focals[i] && !s.e2.sweep;
      case 3:
        return ["2d", "2.5d", "3d"][i] === s.e3.style;
      case 4:
        return ["photoreal", "anime"][i] === s.e4.style;
      default:
        return i === labels.length - 1;
    }
  };
  const choose = (i: number) => {
    const st = acStore.getState();
    if (s.exp === 1) st.setE1(i === 2 ? { view: "iso", proj: "orthographic", compare: "off" } : { view: "street", proj: i === 0 ? "perspective" : "orthographic" });
    else if (s.exp === 2) st.setE2({ focal: E2.focals[i], sweep: false });
    else if (s.exp === 3) {
      const style = (["2d", "2.5d", "3d"] as const)[i];
      st.setE3({ style, move: style === "3d" ? "orbit" : "track" });
    } else if (s.exp === 4) st.setE4({ style: (["photoreal", "anime"] as const)[i] });
  };
  const sub = (i: number) => {
    if (s.exp === 2) return <LiveText get={() => (live.e2 ? `${live.e2.trio[i].distanceM.toFixed(1)} m · nose ${live.e2.trio[i].noseToEar.toFixed(2)}×` : "")} />;
    if (s.exp === 1) return <span>{["lines converge", "lines stay parallel", "45° / 35.264°"][i]}</span>;
    if (s.exp === 3) return <span>{["no parallax", "parallax ∝ 1/depth", "true volume"][i]}</span>;
    if (s.exp === 4) return <span>{i === 0 ? "DoF · motion blur" : `on ${["ones", "twos", "threes"][s.e4.step - 1]} · sharp`}</span>;
    if (cheat)
      return <LiveText get={() => (live.e5 ? [`nose ÷ ear ${live.e5.faceWide.toFixed(2)}× · wide world`, `nose ÷ ear ${live.e5.faceTele.toFixed(2)}× · flat world`, `nose ÷ ear ${live.e5.faceTele.toFixed(2)}× · wide world`][i] : "")} />;
    return <span>{i === 0 ? "obeys physics" : DEMO_COPY[s.e5.demo].rule + " broken"}</span>;
  };
  return (
    <div className="ac-compare" data-count={labels.length} data-testid="compare-row">
      {labels.map((label, i) => (
        <button key={label} type="button" className="ac-cmp" aria-pressed={selected(i)} data-testid={`cmp-${i}`} onClick={() => choose(i)} disabled={s.exp === 5}>
          <Slot id={`cmp-${i}`} testId={`monitor-cmp-${i}`}>
            <span className="ac-cmp-label">
              <b>{label}</b>
              {sub(i)}
            </span>
          </Slot>
        </button>
      ))}
    </div>
  );
}

export const frameOf = (t: number) => Math.floor(t * FPS + 1e-6);
