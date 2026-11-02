"use client";

import { useMemo } from "react";
import { FPS } from "../engine/common";
import { E1 } from "../engine/projection";
import { E2 } from "../engine/lens";
import { LAYERS, relativeSpeed } from "../engine/multiplane";
import { E4, cocPx } from "../engine/timing";
import { E5, pathStats } from "../engine/impossible";
import { DEMO_COPY } from "../content";
import { useAC } from "../store";
import { live } from "../runtime/live";
import { LiveBar, LiveText } from "./Chrome";

const f2 = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? "–" : n.toFixed(2));

function Row({ label, a, b, testId }: { label: string; a: () => string; b?: () => string; testId?: string }) {
  return (
    <tr>
      <th>{label}</th>
      <td>
        <LiveText get={a} data-testid={testId ? `${testId}-a` : undefined} />
      </td>
      {b && (
        <td>
          <LiveText get={b} data-testid={testId ? `${testId}-b` : undefined} />
        </td>
      )}
    </tr>
  );
}

function E1Readouts() {
  const p = () => live.e1?.persp;
  const o = () => live.e1?.ortho;
  return (
    <table className="ac-table" data-testid="e1-readouts">
      <thead>
        <tr>
          <th />
          <th className="ac-tone-cyan">Perspective</th>
          <th className="ac-tone-amber">Ortho</th>
        </tr>
      </thead>
      <tbody>
        <Row label="Bram height" a={() => `${f2((p()?.bramFrac ?? 0) * 100)} %`} b={() => `${f2((o()?.bramFrac ?? 0) * 100)} %`} />
        <Row label="Pip ÷ Bram" a={() => f2(p()?.pipToBram)} b={() => f2(o()?.pipToBram)} testId="ratio" />
        <Row label="True ratio" a={() => f2(p()?.trueRatio)} b={() => f2(o()?.trueRatio)} />
        {E1.poles.map((pole, i) => (
          <Row key={pole.id} label={`Pole ${pole.label}`} a={() => `${f2((p()?.poles[i] ?? 0) * 100)} %`} b={() => `${f2((o()?.poles[i] ?? 0) * 100)} %`} />
        ))}
        <Row label="Ruler angle" a={() => `${f2(p()?.convergenceDeg)}°`} b={() => `${f2(o()?.convergenceDeg)}°`} testId="convergence" />
        <Row label="Vanishing pt" a={() => (p()?.vp ? `${f2(p()!.vp![0])}, ${f2(p()!.vp![1])}` : "none")} b={() => "at infinity"} />
      </tbody>
    </table>
  );
}

function E2Readouts() {
  const cols = [...E2.focals];
  const r = (i: number) => live.e2?.trio[i];
  const rows: [string, (i: number) => string][] = [
    ["Distance", (i) => `${f2(r(i)?.distanceM)} m`],
    ["Bram size", (i) => `${((r(i)?.metric ?? 0) * 100).toFixed(1)} %`],
    ["Nose ÷ ear", (i) => `${f2(r(i)?.noseToEar)}×`],
    ["Doorway ÷ Bram", (i) => `${f2(r(i)?.doorwayRatio)}×`],
    ["Window ÷ Bram", (i) => `${f2(r(i)?.windowRatio)}×`],
    ["Wall in frame", (i) => `${(r(i)?.wallWidthM ?? 0).toFixed(1)} m`],
    ["Horizontal FOV", (i) => `${(r(i)?.hfovDeg ?? 0).toFixed(0)}°`],
  ];
  return (
    <table className="ac-table ac-table-3" data-testid="e2-readouts">
      <thead>
        <tr>
          <th />
          {cols.map((f, i) => (
            <th key={f} className={["ac-tone-cyan", "ac-tone-amber", "ac-tone-pink"][i]}>
              {f} mm
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, fn]) => (
          <tr key={label}>
            <th>{label}</th>
            {cols.map((f, i) => (
              <td key={f}>
                <LiveText get={() => fn(i)} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Side view of the multiplane stand: the camera at the left, the cards at their depths, live slide bars. */
function StandDiagram() {
  const style = useAC((s) => s.e3.style);
  const W = 280;
  const x = (d: number) => 26 + (d / 14.5) * (W - 40);
  return (
    <div className="ac-stand" data-testid="stand-diagram">
      <svg viewBox={`0 0 ${W} 120`} aria-label="Multiplane stand seen from the side">
        <rect x={6} y={50} width={16} height={20} rx={3} fill="#5fe3ff" />
        <path d={`M22 60 L${W - 8} 8 M22 60 L${W - 8} 112`} stroke="#5fe3ff55" strokeDasharray="3 4" />
        {(style === "2d" ? [{ id: "flat", depth: 4.6, label: "one painting" }] : LAYERS.map((l) => ({ id: l.id, depth: l.depth, label: l.label }))).map((l, i) => (
          <g key={l.id}>
            <line x1={x(l.depth)} x2={x(l.depth)} y1={14 + (i % 2) * 4} y2={106 - (i % 2) * 4} stroke={l.id === "bram" || l.id === "pip" ? "#ffb547" : "#e9eef4aa"} strokeWidth={2} />
          </g>
        ))}
        <text x={26} y={116} fontSize={8} fill="#7c8796" fontFamily="ui-monospace, monospace">
          lens
        </text>
        <text x={W - 34} y={116} fontSize={8} fill="#7c8796" fontFamily="ui-monospace, monospace">
          14 m
        </text>
      </svg>
      <table className="ac-table ac-layers">
        <thead>
          <tr>
            <th>Layer</th>
            <th>Depth</th>
            <th>Speed</th>
            <th>Slide now</th>
          </tr>
        </thead>
        <tbody>
          {LAYERS.map((l, i) => (
            <tr key={l.id} data-testid={`layer-${l.id}`}>
              <th>{l.label}</th>
              <td>{style === "2d" ? "4.6" : l.depth.toFixed(1)} m</td>
              <td>{style === "2d" ? "1.0" : relativeSpeed(l.depth).toFixed(1)}×</td>
              <td>
                <LiveBar color={l.who ? "#ffb547" : "#5fe3ff"} get={() => Math.abs(live.e3?.layers[i]?.offset ?? 0) / 0.45} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DopeSheet() {
  const step = useAC((s) => s.e4.step);
  const cells = Array.from({ length: FPS }, (_, i) => i);
  return (
    <div className="ac-dope" data-testid="dope-sheet">
      <div className="ac-dope-row">
        <span>camera</span>
        {cells.map((i) => (
          <i key={i} className="on" />
        ))}
      </div>
      <div className="ac-dope-row">
        <span>Pip, Bram</span>
        {cells.map((i) => (
          <i key={i} className={i % step === 0 ? "on pink" : "hold"} />
        ))}
      </div>
      <LiveText className="ac-dope-now" get={() => (live.e4 ? `frame ${String(live.e4.frame % FPS).padStart(2, "0")} of 24 · ${live.e4.held ? "holding the drawing" : "new drawing"}` : "")} />
    </div>
  );
}

function E4Readouts() {
  const fStop = useAC((s) => s.e4.fStop);
  const bgBlur = useMemo(() => cocPx(6.6, 4.3, E4.focalMm, fStop, 20.25, 1080), [fStop]);
  return (
    <>
      <DopeSheet />
      <table className="ac-table" data-testid="e4-readouts">
        <tbody>
          <Row label="Pan speed" a={() => `${(live.e4?.degPerS ?? 0).toFixed(0)}°/s`} />
          <Row label="Focus" a={() => `${f2(live.e4?.focusM)} m`} />
          <Row label="Doorway blur (focus Bram, 1080p)" a={() => `${bgBlur.toFixed(1)} px`} />
          <Row label="Photoreal renders / frame" a={() => `${live.e4?.samples ?? 1}`} />
          <Row label="Character clock" a={() => `${f2(live.e4?.charT)} s`} testId="chart" />
        </tbody>
      </table>
    </>
  );
}

function E5Readouts() {
  const demo = useAC((s) => s.e5.demo);
  const stats = useMemo(() => ({ imp: pathStats(demo, false), phy: pathStats(demo, true) }), [demo]);
  const rows: Record<typeof demo, [string, () => string, () => string][]> = {
    cheat: [
      ["Lens", () => `${E5.cheat.wideMm} or ${E5.cheat.teleMm} mm`, () => `${E5.cheat.wideMm} world + ${E5.cheat.teleMm} face`],
      ["Nose ÷ ear on Bram", () => `${f2(live.e5?.faceWide)}× / ${f2(live.e5?.faceTele)}×`, () => `${f2(live.e5?.faceTele)}×`],
    ],
    push: [
      ["Lens", () => `${(live.e5?.frame.shot.focalMm ?? 0).toFixed(0)} mm`, () => `${(live.e5?.frame.shot.focalMm ?? 0).toFixed(0)} mm`],
      ["Fisheye bulge", () => "0", () => f2(live.e5?.frame.fisheye)],
    ],
    scale: [
      ["Pip scale", () => "1.00×", () => `${f2(live.e5?.frame.pipScale)}×`],
      ["Pip in frame", () => `${((live.e5?.pipFracPhysical ?? 0) * 100).toFixed(0)} %`, () => `${((live.e5?.pipFrac ?? 0) * 100).toFixed(0)} %`],
    ],
    wall: [
      ["Camera z", () => `${f2(live.e5?.frame.physical.position.z)} m`, () => `${f2(live.e5?.frame.shot.position.z)} m`],
      ["Inside the wall", () => "never", () => (live.e5?.frame.insideWall ? "NOW" : "no")],
    ],
    whip: [
      ["Peak rotation", () => `${stats.phy.peakDegPerS.toFixed(0)}°/s`, () => `${stats.imp.peakDegPerS.toFixed(0)}°/s`],
      ["Travel", () => `${stats.phy.travelM.toFixed(1)} m`, () => `${stats.imp.travelM.toFixed(1)} m`],
    ],
  };
  return (
    <>
      <p className="ac-rule">
        <span className="ac-eyebrow">BREAKS</span> {DEMO_COPY[demo].rule}
      </p>
      <table className="ac-table" data-testid="e5-readouts">
        <thead>
          <tr>
            <th />
            <th className="ac-tone-cyan">Physical</th>
            <th className="ac-tone-pink">Impossible</th>
          </tr>
        </thead>
        <tbody>
          {rows[demo].map(([label, a, b]) => (
            <Row key={label} label={label} a={a} b={b} />
          ))}
          <tr>
            <th>Peak acceleration</th>
            <td data-testid="peak-g-physical">{stats.phy.peakG.toFixed(1)} g</td>
            <td data-testid="peak-g">{stats.imp.peakG.toFixed(1)} g</td>
          </tr>
        </tbody>
      </table>
      <p className="ac-note">{DEMO_COPY[demo].how}</p>
    </>
  );
}

export function Readouts() {
  const exp = useAC((s) => s.exp);
  return (
    <div className="ac-readouts" data-testid="readouts">
      {exp === 1 && <E1Readouts />}
      {exp === 2 && <E2Readouts />}
      {exp === 3 && <StandDiagram />}
      {exp === 4 && <E4Readouts />}
      {exp === 5 && <E5Readouts />}
    </div>
  );
}
