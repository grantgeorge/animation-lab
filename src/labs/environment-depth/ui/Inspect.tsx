"use client";

import { useMemo } from "react";
import { planBounds } from "../engine/camera";
import { BANDS, HERO_TREES, PATH, PIP, REF_SPOTS, TREE_HEIGHT_M, fillTrees, pathCenterX } from "../engine/world";
import { HAZE_COLORS, applyHaze, hazeCurve, hazeParams, hexToLinear, linearToHex } from "../engine/haze";
import { edStore, useED } from "../store";
import { live } from "../runtime/live";
import { LiveText } from "./Chrome";
import { LiveSvg } from "./LiveSvg";

const f1 = (v: number) => v.toFixed(1);
const BAND_COL = { fg: "#ff9a5e", mg: "#7ef0b0", bg: "#76a8ff" } as const;

const PLAN_ASPECT = 600 / 230;
const FILL = fillTrees();

function drawMap() {
  const b = planBounds(edStore.getState().cues.focalMm, PLAN_ASPECT);
  const w = b.x1 - b.x0;
  const h = b.z1 - b.z0;
  const k = h / 200;
  const pts = (p: [number, number][]) => p.map(([x, z]) => `${f1(x)},${f1(z)}`).join(" ");
  const { frustum, c0Frustum, path } = live.plan;
  if (!frustum.length) return null;
  const [cx, cz] = frustum[0];
  let body = "";
  body += `<circle cx="${f1(cx)}" cy="${f1(cz)}" r="${BANDS.mgM}" fill="${BAND_COL.mg}" fill-opacity="0.06" stroke="${BAND_COL.mg}" stroke-opacity="0.5" stroke-width="${k}" stroke-dasharray="${k * 4} ${k * 4}"/>`;
  body += `<circle cx="${f1(cx)}" cy="${f1(cz)}" r="${BANDS.fgM}" fill="${BAND_COL.fg}" fill-opacity="0.12" stroke="${BAND_COL.fg}" stroke-opacity="0.7" stroke-width="${k}"/>`;
  body += `<polygon points="${pts(c0Frustum)}" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.35" stroke-width="${k}" stroke-dasharray="${k * 3} ${k * 3}"/>`;
  body += `<polygon points="${pts(frustum)}" fill="#5fe3ff" fill-opacity="0.12" stroke="#5fe3ff" stroke-width="${k * 1.4}"/>`;
  body += `<polyline points="${pts(path)}" fill="none" stroke="#ffb547" stroke-width="${k * 1.6}"/>`;
  body += `<circle cx="${f1(cx)}" cy="${f1(cz)}" r="${k * 3.2}" fill="#5fe3ff"/>`;
  body += `<circle cx="${PIP.root[0]}" cy="${PIP.root[2]}" r="${k * 3.2}" fill="#8ef0c3" stroke="#0b0e10" stroke-width="${k}"/>`;
  body += `<text x="${f1(PIP.root[0] + k * 6)}" y="${f1(PIP.root[2] + k * 3)}" fill="#c9f7e3" font-size="${f1(k * 9)}" font-family="ui-monospace, monospace">Pip</text>`;
  body += `<text x="${f1(b.x0 + k * 6)}" y="${f1(b.z1 - k * 6)}" fill="#c9d1dc" font-size="${f1(k * 8.5)}" font-family="ui-monospace, monospace">PLAN · ${Math.round(w)} × ${Math.round(h)} m</text>`;
  return { viewBox: `${f1(b.x0)} ${f1(b.z0)} ${f1(w)} ${f1(h)}`, body };
}

const LX = (d: number) => 40 + (Math.log10(Math.max(1, d)) / Math.log10(3000)) * 540;

function drawStack() {
  const layers = live.layers;
  if (!layers.length) return null;
  const mid = 100;
  let body = "";
  body += `<rect x="${LX(1)}" y="16" width="${LX(BANDS.fgM) - LX(1)}" height="170" fill="${BAND_COL.fg}" fill-opacity="0.07"/>`;
  body += `<rect x="${LX(BANDS.fgM)}" y="16" width="${LX(BANDS.mgM) - LX(BANDS.fgM)}" height="170" fill="${BAND_COL.mg}" fill-opacity="0.06"/>`;
  body += `<rect x="${LX(BANDS.mgM)}" y="16" width="${LX(3000) - LX(BANDS.mgM)}" height="170" fill="${BAND_COL.bg}" fill-opacity="0.06"/>`;
  for (const [t, d] of [["FG", 2], ["MG", 15], ["BG", 400]] as const) body += `<text x="${LX(d)}" y="30" fill="${BAND_COL[t.toLowerCase() as "fg"]}" font-size="11" text-anchor="middle" font-family="ui-monospace, monospace" opacity="0.8">${t}</text>`;
  for (const d of [1, 10, 100, 1000]) body += `<line x1="${LX(d)}" y1="186" x2="${LX(d)}" y2="193" stroke="#5a6372"/><text x="${LX(d)}" y="207" fill="#7c8796" font-size="11" text-anchor="middle" font-family="ui-monospace, monospace">${d} m</text>`;
  body += `<path d="M 12 ${mid} l 20 -12 v 24 z" fill="#5fe3ff"/>`;
  layers.forEach((l, i) => {
    const x = LX(Math.min(2999, l.depthNow));
    const hgt = 40 + 90 * (1 - i / Math.max(1, layers.length));
    const shift = Math.max(-70, Math.min(70, l.shiftX * 70));
    body += `<line x1="${f1(x)}" y1="${f1(mid - hgt / 2)}" x2="${f1(x)}" y2="${f1(mid + hgt / 2)}" stroke="${BAND_COL[l.band]}" stroke-width="3.5" stroke-linecap="round"/>`;
    body += `<line x1="${f1(x)}" y1="${f1(mid + hgt / 2 + 8)}" x2="${f1(x + shift)}" y2="${f1(mid + hgt / 2 + 8)}" stroke="#ffb547" stroke-width="2.5"/>`;
    body += `<text x="${f1(x + 5)}" y="${f1(mid - hgt / 2 + 4 + (i % 2) * 13)}" fill="#c9d1dc" font-size="11" font-family="ui-monospace, monospace">${l.depthNow < 100 ? l.depthNow.toFixed(1) : Math.round(l.depthNow)} m ×${l.speed.toFixed(l.speed < 10 ? 1 : 0)}</text>`;
  });
  body += `<text x="40" y="226" fill="#ffd08a" font-size="11" font-family="ui-monospace, monospace">— slide since frame 0 (amber)</text>`;
  return { viewBox: "0 0 600 230", body };
}

function HazeCurve() {
  const haze = useED((s) => s.cues.haze);
  const color = useED((s) => s.cues.hazeColor);
  const { pts, strip, marks } = useMemo(() => {
    const p = hazeParams(haze);
    const c = hazeCurve(p, 1.1, 60);
    const hz = hexToLinear(HAZE_COLORS[color].hex);
    const bark: [number, number, number] = [0.035, 0.02, 0.012];
    const moss: [number, number, number] = [0.08, 0.14, 0.04];
    const X = (d: number) => 20 + (Math.log10(d) / Math.log10(3000)) * 560;
    return {
      pts: c.map((s) => `${X(s.d).toFixed(1)},${(22 + (1 - s.contrast) * 128).toFixed(1)}`).join(" "),
      strip: c.map((s) => ({ x: X(s.d), bark: linearToHex(applyHaze(bark, hz, s.f)), moss: linearToHex(applyHaze(moss, hz, s.f)) })),
      marks: (
        [
          ["Pip", 10.4],
          ["trunks", 30],
          ["forest", 120],
          ["hills", 700],
          ["ridge", 2350],
        ] as const
      ).map(([n, d]) => ({ n, x: X(d) })),
    };
  }, [haze, color]);
  return (
    <svg viewBox="0 0 600 230" className="ed-diagram" data-testid="haze-curve" role="img" aria-label="Haze: contrast and colour against distance">
      <polyline points={pts} fill="none" stroke="#5fe3ff" strokeWidth={2} />
      <text x={24} y={16} fill="#9ff0ff" fontSize={11} fontFamily="ui-monospace, monospace">
        contrast left (top = 100%) · haze {Math.round(haze * 100)}%
      </text>
      {strip.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={164} width={10} height={16} fill={s.bark} />
          <rect x={s.x} y={180} width={10} height={16} fill={s.moss} />
        </g>
      ))}
      {marks.map((m) => (
        <g key={m.n}>
          <line x1={m.x} x2={m.x} y1={22} y2={160} stroke="#ffffff22" />
          <text x={m.x + 3} y={156} fill="#9aa5b4" fontSize={11} fontFamily="ui-monospace, monospace">
            {m.n}
          </text>
        </g>
      ))}
      <text x={20} y={218} fill="#7c8796" fontSize={11} fontFamily="ui-monospace, monospace">
        1 m → 3 km · bark &amp; moss as seen through the air
      </text>
    </svg>
  );
}

/** The forest floor from above: path, trunks (with root flare), references. */
function PlanBase() {
  const focal = useED((s) => s.cues.focalMm);
  const refs = useED((s) => (s.cues.scale ? s.cues.refs : null));
  const b = planBounds(focal, PLAN_ASPECT);
  const inside = (x: number, z: number, r: number) => x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1;
  const edge = (side: number) => {
    const pts: string[] = [];
    for (let z = b.z1; z >= b.z0; z -= 2) pts.push(`${(pathCenterX(z) + side * PATH.halfWidthM).toFixed(2)},${z.toFixed(2)}`);
    return pts;
  };
  const path = [...edge(-1), ...edge(1).reverse()].join(" ");
  return (
    <svg className="ed-overlay" viewBox={`${b.x0} ${b.z0} ${b.x1 - b.x0} ${b.z1 - b.z0}`} preserveAspectRatio="none" aria-hidden>
      <rect x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} fill="#18211a" />
      <polygon points={path} fill="#6d5236" opacity={0.85} />
      {[...HERO_TREES, ...FILL].filter((t) => inside(t.x, t.z, t.r * 2)).map((t, i) => (
        <g key={i}>
          <circle cx={t.x} cy={t.z} r={t.r * 1.9} fill="#2a3a26" />
          <circle cx={t.x} cy={t.z} r={t.r} fill={t.hero ? "#8a4a2c" : "#5e3a26"} stroke="#c88a5c" strokeWidth={0.12} />
        </g>
      ))}
      {refs?.cabin && <rect x={REF_SPOTS.cabin.x - 3} y={REF_SPOTS.cabin.z - 2.3} width={6} height={4.6} fill="#d8b27a" transform={`rotate(${(-REF_SPOTS.cabin.rot * 180) / Math.PI} ${REF_SPOTS.cabin.x} ${REF_SPOTS.cabin.z})`} />}
      {refs?.deer && <ellipse cx={REF_SPOTS.deer.x} cy={REF_SPOTS.deer.z} rx={0.8} ry={0.35} fill="#d8b27a" />}
      {refs?.fence && <line x1={REF_SPOTS.fence.x} y1={REF_SPOTS.fence.z} x2={REF_SPOTS.fence.x} y2={REF_SPOTS.fence.z - 6.9} stroke="#d8b27a" strokeWidth={0.25} />}
    </svg>
  );
}

export function InspectRow() {
  return (
    <div className="ed-inspect-row" data-testid="inspect-row">
      <figure className="ed-card ed-card-map">
        <div className="ed-slot ed-plan" data-testid="plan-view">
          <PlanBase />
          <LiveSvg className="ed-overlay" draw={drawMap} testId="plan-overlay" />
        </div>
        <figcaption>Plan: camera frustum, the move, FG / MG bands</figcaption>
      </figure>
      <figure className="ed-card">
        <LiveSvg className="ed-diagram" draw={drawStack} testId="layer-stack" label="Layer stack: card depths and parallax slide" />
        <figcaption>Layer stack: depth (log), speed ∝ 1/depth, slide since frame 0</figcaption>
      </figure>
      <figure className="ed-card">
        <HazeCurve />
        <figcaption>Atmosphere: contrast and colour vs distance</figcaption>
      </figure>
    </div>
  );
}

const Row = ({ k, get, testId }: { k: string; get: () => string; testId?: string }) => (
  <tr>
    <th>{k}</th>
    <td>
      <LiveText get={get} data-testid={testId} />
    </td>
  </tr>
);

const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

export function Readouts() {
  return (
    <section className="ed-section" data-testid="readouts">
      <span className="ed-eyebrow">LIVE READOUTS</span>
      <table className="ed-table">
        <tbody>
          <Row k="Camera height" get={() => `${live.cam.heightM.toFixed(2)} m`} testId="ro-height" />
          <Row k="Distance to Pip" get={() => `${live.cam.distToPipM.toFixed(1)} m`} testId="ro-distance" />
          <Row k="Lens · field of view" get={() => `${Math.round(live.cam.focalMm)} mm · ${live.cam.hfovDeg.toFixed(0)}°`} />
          <Row k="Tilt" get={() => `${live.cam.pitchDeg.toFixed(1)}° up`} />
          <Row k="Frame width at Pip" get={() => `${live.cam.frameW.toFixed(1)} m`} />
          <Row k="Tree height" get={() => `${TREE_HEIGHT_M} m (${Math.round(TREE_HEIGHT_M / PIP.heightM)} Pips)`} testId="ro-tree" />
          <Row k="Tree reads as" get={() => `${Math.round(live.scale.treeReadsM)} m`} />
          <Row k="Pip fills" get={() => `${(live.scale.pipFrac * 100).toFixed(0)}% of frame height`} />
          <Row k="Revealed now" get={() => `${pc(live.reveal.total)} (behind ${pc(live.reveal.disoccluded)})`} testId="ro-revealed" />
          <Row k="Revealed at end" get={() => (live.revealEnd ? pc(live.revealEnd.total) : "…")} />
          <Row k="Haze at Pip · 30 m" get={() => `${pc(live.haze.pip)} · ${pc(live.haze.mg)}`} />
          <Row k="Haze at 120 m · ridge" get={() => `${pc(live.haze.bg)} · ${pc(live.haze.ridge)}`} />
          <Row k="Parallax squash" get={() => `k ${live.squash.k.toFixed(2)} · plane ${live.squash.D.toFixed(1)} m`} />
        </tbody>
      </table>
    </section>
  );
}
