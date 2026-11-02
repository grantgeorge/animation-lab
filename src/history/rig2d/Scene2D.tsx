"use client";

import { createContext, useContext, type ReactNode } from "react";
import { tokens } from "@/lib/tokens";
import { armFK, ch, MARKS, poseAt, project, projectGround, type ScenePose } from "./pose";
import { scarfAnchor, SCARF } from "./scarf";

/**
 * A flat, authored 2D version of the Lens & Framing scene. Poses come from the lab's own keyframes;
 * placement uses the lab camera's pinhole projection, so frames register with the master frame.
 * Characters are drawn front-on in metres (y up) and each part renders fill → shadow → line,
 * so line, color and shadow can be toggled as real layers.
 */

export type Look = "pencil" | "flat" | "digital" | "comic";
export interface Layers {
  line: boolean;
  color: boolean;
  shadow: boolean;
  background: boolean;
}
export const ALL_LAYERS: Layers = { line: true, color: true, shadow: true, background: true };

interface Style {
  look: Look;
  layers: Layers;
  ink: string;
  bgInk: string;
  lw: number; // px at 1920 frame width
  scarf: string;
  tint: string | null;
  filter: string | undefined;
  hatch: string | undefined;
  highlight: { bram: Set<string>; pip: Set<string>; door: Set<string> } | null;
}

const StyleCtx = createContext<Style | null>(null);
const PartCtx = createContext<{ chain: string[]; s: number }>({ chain: [], s: 1 });

const PAL = {
  // The lab's current cast (Meshy GLB designs): deep-red wool coat, cream knit scarf, charcoal cap.
  bramCoat: "#8E2227",
  bramCoatDark: "#6B171B",
  skin: tokens.bramSkin,
  nose: tokens.bramNose,
  trousers: "#2A2C33",
  cap: "#35353B",
  brass: tokens.brass,
  hair: "#3B2F2A",
  pipCoat: "#F4C430",
  pipBand: "#D9A91E",
  toggle: "#3A2A1F",
  pipHair: "#A0482A",
  pipSkin: tokens.pipSkin,
  pipBoots: tokens.pipBoots,
  blush: "#F2A99A",
  white: "#FBFBF6",
  pupil: "#17120F",
};

/* ---------------- primitives ---------------- */

function usePaint(fill: string, opts?: { shadow?: boolean; isBg?: boolean; target?: boolean }) {
  const st = useContext(StyleCtx)!;
  const part = useContext(PartCtx);
  const hl = st.highlight ? (st.highlight as Record<string, Set<string>>)[part.chain[0]] : null;
  const moving = st.highlight ? (hl ? part.chain.slice(1).some((p) => hl.has(p)) : false) : null;
  const fillOn = st.layers.color && st.look !== "pencil" && !st.tint;
  const lineOn = st.layers.line;
  const strokeW = (st.lw * (opts?.isBg ? 0.8 : 1)) / part.s;
  const stroke = st.tint ?? (moving ? "#ffb547" : opts?.isBg ? st.bgInk : st.ink);
  return {
    fill: fillOn ? (opts?.target ? st.scarf : fill) : "none",
    stroke: lineOn ? stroke : "none",
    strokeWidth: moving ? strokeW * 2.2 : strokeW,
    opacity: moving === false ? 0.32 : 1,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };
}

function E({ cx, cy, rx, ry, fill, target, isBg }: { cx: number; cy: number; rx: number; ry: number; fill: string; target?: boolean; isBg?: boolean }) {
  const p = usePaint(fill, { target, isBg });
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...p} data-target={target ? "scarf" : undefined} />;
}
function P({ d, fill, target, isBg, noLine }: { d: string; fill: string; target?: boolean; isBg?: boolean; noLine?: boolean }) {
  const p = usePaint(fill, { target, isBg });
  return <path d={d} {...p} stroke={noLine ? "none" : p.stroke} data-target={target ? "scarf" : undefined} />;
}
function R({ x, y, w, h, r = 0, fill, isBg }: { x: number; y: number; w: number; h: number; r?: number; fill: string; isBg?: boolean }) {
  const p = usePaint(fill, { isBg });
  return <rect x={x} y={y} width={w} height={h} rx={r} {...p} />;
}
/** Capsule along -y from the pivot. */
function Cap({ r, len, fill, y0 = 0 }: { r: number; len: number; fill: string; y0?: number }) {
  return <R x={-r} y={y0 - len - r} w={r * 2} h={len + r * 2} r={r} fill={fill} />;
}
/** Form shadow: a flat darker shape inside a part, its own layer. */
function Shade({ d }: { d: string }) {
  const st = useContext(StyleCtx)!;
  if (!st.layers.shadow || !st.layers.color || st.look === "pencil" || st.tint || st.look === "flat") return null;
  const fill = st.look === "comic" ? st.hatch : "rgb(40 20 60 / 0.22)";
  return <path d={d} fill={fill} stroke="none" style={{ mixBlendMode: "multiply" }} />;
}

function Part({ name, x = 0, y = 0, rot = 0, sx = 1, sy = 1, children }: { name?: string; x?: number; y?: number; rot?: number; sx?: number; sy?: number; children: ReactNode }) {
  const parent = useContext(PartCtx);
  const chain = name ? [...parent.chain, name] : parent.chain;
  return (
    <PartCtx.Provider value={{ chain, s: parent.s }}>
      <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${sx} ${sy})`} data-part={name}>
        {children}
      </g>
    </PartCtx.Provider>
  );
}

/* ---------------- Bram ---------------- */

/** Scarf chain segment end points in torso-local metres. */
function scarfChain(anchor: { x: number; y: number }, angles: number[]) {
  const out: { x1: number; y1: number }[] = [];
  let x = anchor.x;
  let y = anchor.y;
  for (const a of angles) {
    x += Math.sin(a) * SCARF.segLen;
    y -= Math.cos(a) * SCARF.segLen;
    out.push({ x1: x, y1: y });
  }
  return out;
}

const DEG = Math.PI / 180;

function Bram({ pose, scarfAngles }: { pose: ScenePose; scarfAngles: number[] }) {
  const b = pose.bram;
  const g = projectGround(MARKS.bram[0], MARKS.bram[2]);
  const yawDeg = ch(b, "pelvis", "ry") + ch(b, "torso", "ry");
  const yaw = yawDeg * DEG;
  const headYaw = yaw + ch(b, "head", "ry") * DEG;
  const fore = Math.max(0.35, Math.abs(Math.cos(yaw)));
  const faceVis = Math.max(0, Math.cos(headYaw));
  const fs = Math.sin(headYaw); // feature shift
  const nod = ch(b, "head", "rx");
  const bs = Math.sin(yaw);
  const anchor = scarfAnchor(yaw);
  const chain = scarfChain(anchor, scarfAngles);
  const tail = (() => {
    const w = 0.04;
    const left = [{ x: anchor.x - w, y: anchor.y }, ...chain.map((c) => ({ x: c.x1 - w * 0.9, y: c.y1 }))];
    const right = [{ x: anchor.x + w, y: anchor.y }, ...chain.map((c) => ({ x: c.x1 + w * 0.9, y: c.y1 }))];
    return `M${left.map((p) => `${p.x},${p.y}`).join(" L")} L${right.reverse().map((p) => `${p.x},${p.y}`).join(" L")} Z`;
  })();

  /** Arms use forward kinematics projected to the front view, so raises toward camera foreshorten. */
  const arm = (side: 1 | -1) => {
    const n = side > 0 ? "L" : "R";
    const fk = armFK(b, n, yawDeg);
    const L1 = 0.235;
    const L2 = 0.215;
    const sx = 0.215 * side * Math.cos(yaw);
    const ex = sx + Math.sin(fk.upper.angle * DEG) * L1 * fk.upper.len;
    const ey = 1.3 - Math.cos(fk.upper.angle * DEG) * L1 * fk.upper.len;
    return (
      <Part name={`upperArm${n}`}>
        <g transform={`translate(${sx} 1.3) rotate(${fk.upper.angle}) scale(1 ${Math.max(0.12, fk.upper.len)})`}>
          <Cap r={0.06} len={0.17} fill={PAL.bramCoat} y0={0.02} />
        </g>
        <Part name={`forearm${n}`} x={ex} y={ey} rot={fk.fore.angle}>
          <g transform={`scale(1 ${Math.max(0.12, fk.fore.len)})`}>
            <Cap r={0.052} len={0.16} fill={PAL.bramCoat} />
            <R x={-0.056} y={-0.215} w={0.112} h={0.03} r={0.012} fill={tokens.bramScarf} />
          </g>
          <Part name={`hand${n}`} y={-L2 * Math.max(0.12, fk.fore.len)}>
            <R x={-0.042} y={-0.1} w={0.084} h={0.1} r={0.025} fill={PAL.skin} />
          </Part>
        </Part>
      </Part>
    );
  };

  return (
    <PartCtx.Provider value={{ chain: ["bram"], s: g.s }}>
      <g transform={`translate(${g.x} ${g.y}) scale(${g.s} ${-g.s})`} data-character="bram">
        <Part name="pelvis">
          {[1, -1].map((s) => (
            <Part key={s} name={s > 0 ? "hipL" : "hipR"} x={0.105 * s} y={0.85}>
              <Cap r={0.078} len={0.68} fill={PAL.trousers} y0={-0.02} />
              <Part name={s > 0 ? "footL" : "footR"} y={-0.76 + ch(b, s > 0 ? "footL" : "footR", "py")}>
                <E cx={0} cy={0.03} rx={0.075} ry={0.045} fill={tokens.bramShoes} />
              </Part>
            </Part>
          ))}
          <E cx={0} cy={0.86} rx={0.19} ry={0.11} fill={PAL.trousers} />
          <Part name="torso">
            {/* long wool coat to the knees */}
            <P d="M-0.28,0.52 L-0.25,0.9 C-0.29,1.02 -0.3,1.16 -0.285,1.24 C-0.27,1.34 -0.2,1.4 -0.1,1.42 L0.1,1.42 C0.2,1.4 0.27,1.34 0.285,1.24 C0.3,1.16 0.29,1.02 0.25,0.9 L0.28,0.52 Z" fill={PAL.bramCoat} />
            <Shade d={`M${0.06 + bs * 0.12},0.53 L0.27,0.53 L0.25,0.9 C0.29,1.02 0.28,1.16 0.28,1.24 C0.27,1.33 0.22,1.38 0.16,1.4 C0.2,1.2 0.18,0.9 ${0.06 + bs * 0.12},0.53 Z`} />
            {[1, -1].map((sd) => (
              <R key={sd} x={sd > 0 ? 0.09 + bs * 0.08 : -0.23 + bs * 0.08} y={0.68} w={0.14} h={0.1} r={0.01} fill={PAL.bramCoatDark} />
            ))}
            {[0.86, 0.98, 1.1, 1.22].map((y) => (
              <E key={y} cx={bs * 0.2} cy={y} rx={0.016 * (0.6 + 0.4 * fore)} ry={0.016} fill={PAL.brass} />
            ))}
            {arm(-1)}
            {/* scarf: collar band + hanging end (the editable target) */}
            <E cx={bs * 0.05} cy={1.39} rx={0.16} ry={0.048} fill={tokens.bramScarf} target />
            <P d={tail} fill={tokens.bramScarf} target />
            {arm(1)}
            <Part name="neck" y={1.37}>
              <Part name="head" y={0.02} rot={0} sy={1 - Math.abs(nod) * 0.002}>
                <E cx={-fs * 0.03} cy={0.27} rx={0.15} ry={0.07} fill={PAL.hair} />
                <E cx={0} cy={0.2} rx={0.155} ry={0.195} fill={PAL.skin} />
                <Shade d="M0.03,0.02 C0.13,0.05 0.16,0.15 0.155,0.22 C0.15,0.3 0.1,0.36 0.05,0.38 C0.12,0.28 0.12,0.12 0.03,0.02 Z" />
                {faceVis < 0.25 && <E cx={-fs * 0.02} cy={0.2} rx={0.035} ry={0.05} fill={PAL.skin} />}
                <g opacity={Math.min(1, faceVis * 3)} transform={`translate(${fs * 0.1} ${-nod * 0.002})`}>
                  <Part name="brows" y={ch(b, "brows", "py") + ch(b, "brow", "py")}>
                    <P d="M-0.105,0.235 Q-0.06,0.27 -0.02,0.24" fill="none" />
                    <P d="M0.02,0.24 Q0.06,0.27 0.105,0.235" fill="none" />
                    <R x={-0.11} y={0.225} w={0.085} h={0.025} r={0.012} fill={PAL.hair} />
                    <R x={0.025} y={0.225} w={0.085} h={0.025} r={0.012} fill={PAL.hair} />
                  </Part>
                  <Part name="eyes" y={0.18} sy={Math.max(0.08, 1 + ch(b, "eyes", "sy"))}>
                    {[1, -1].map((s) => (
                      <g key={s}>
                        <E cx={0.06 * s} cy={0} rx={0.034} ry={0.034} fill={PAL.white} />
                        <E cx={0.06 * s + fs * 0.012} cy={0} rx={0.016} ry={0.016} fill={PAL.pupil} />
                      </g>
                    ))}
                  </Part>
                  <P d="M-0.12,0.08 C-0.08,0.12 -0.02,0.1 0,0.1 C0.02,0.1 0.08,0.12 0.12,0.08 C0.1,0.05 0.04,0.06 0,0.075 C-0.04,0.06 -0.1,0.05 -0.12,0.08 Z" fill={PAL.hair} />
                  <E cx={fs * 0.05} cy={0.135} rx={0.062} ry={0.058} fill={PAL.nose} />
                </g>
                {[1, -1].map((s) => (
                  <E key={s} cx={0.155 * s * Math.max(0.2, Math.abs(Math.cos(headYaw))) - fs * 0.04} cy={0.17} rx={0.025} ry={0.04} fill={PAL.skin} />
                ))}
                <Part name="cap" y={0.34}>
                  <P d="M-0.19,-0.02 C-0.2,0.06 -0.12,0.09 0,0.09 C0.12,0.09 0.21,0.06 0.19,-0.02 Z" fill={PAL.cap} />
                  <R x={-0.16 + fs * 0.05} y={-0.045} w={0.32} h={0.035} r={0.015} fill={PAL.cap} />
                </Part>
              </Part>
            </Part>
          </Part>
        </Part>
      </g>
    </PartCtx.Provider>
  );
}

/* ---------------- Pip ---------------- */

function Pip({ pose }: { pose: ScenePose }) {
  const p = pose.pip;
  const X = MARKS.pip[0] + ch(p, "root", "px");
  const Z = MARKS.pip[2] + ch(p, "root", "pz");
  const g = projectGround(X, Z);
  const yaw = ch(p, "root", "ry") * DEG;
  const headYaw = yaw + ch(p, "head", "ry") * DEG;
  const faceVis = Math.cos(headYaw);
  const fs = Math.sin(headYaw);
  const turn = Math.max(0.3, Math.abs(Math.cos(yaw)));
  const leg = (s: 1 | -1) => {
    const n = s > 0 ? "thighL" : "thighR";
    const k = Math.max(0.55, Math.cos(ch(p, n, "rx") * DEG));
    return (
      <Part key={s} name={n} x={0.062 * s * turn} y={0.43} sy={k}>
        <Cap r={0.044} len={0.3} fill="#1E2027" />
        <E cx={0} cy={-0.39} rx={0.045} ry={0.04} fill={PAL.pipBoots} />
      </Part>
    );
  };
  const arm = (s: 1 | -1) => {
    const n = s > 0 ? "L" : "R";
    const fk = armFK(p, n, ch(p, "root", "ry"));
    const sx = 0.115 * s * turn;
    const ex = sx + Math.sin(fk.upper.angle * DEG) * 0.15 * fk.upper.len;
    const ey = 0.73 - Math.cos(fk.upper.angle * DEG) * 0.15 * fk.upper.len;
    return (
      <Part name={`upperArm${n}`}>
        <g transform={`translate(${sx} 0.73) rotate(${fk.upper.angle}) scale(1 ${Math.max(0.15, fk.upper.len)})`}>
          <Cap r={0.036} len={0.1} fill={PAL.pipCoat} />
        </g>
        <Part name={`forearm${n}`} x={ex} y={ey} rot={fk.fore.angle}>
          <g transform={`scale(1 ${Math.max(0.15, fk.fore.len)})`}>
            <Cap r={0.033} len={0.08} fill={PAL.pipCoat} />
          </g>
          <E cx={0} cy={-0.15 * Math.max(0.15, fk.fore.len)} rx={0.042} ry={0.042} fill={PAL.pipSkin} />
        </Part>
      </Part>
    );
  };
  const back = faceVis < 0;
  return (
    <PartCtx.Provider value={{ chain: ["pip"], s: g.s }}>
      <g transform={`translate(${g.x} ${g.y - ch(p, "root", "py") * g.s}) scale(${g.s} ${-g.s})`} data-character="pip">
        <Part name="root">
          {leg(1)}
          {leg(-1)}
          {back && arm(1)}
          {back && arm(-1)}
          <Part name="torso" sx={0.85 + 0.15 * turn}>
            <P d="M-0.205,0.29 C-0.2,0.4 -0.17,0.6 -0.13,0.71 C-0.11,0.76 -0.08,0.79 0,0.8 C0.08,0.79 0.11,0.76 0.13,0.71 C0.17,0.6 0.2,0.4 0.205,0.29 Z" fill={PAL.pipCoat} />
            <Shade d="M0.04,0.3 C0.12,0.42 0.14,0.6 0.12,0.72 C0.16,0.62 0.19,0.44 0.2,0.3 Z" />
            <R x={-0.205} y={0.28} w={0.41} h={0.024} r={0.012} fill={PAL.pipBand} />
            {/* duffle toggles */}
            {!back && [0.4, 0.5, 0.6].map((y) => <R key={y} x={fs * 0.12 - 0.035} y={y - 0.01} w={0.07} h={0.02} r={0.01} fill={PAL.toggle} />)}
          </Part>
          {!back && arm(1)}
          {!back && arm(-1)}
          <Part name="head" y={0.8} rot={ch(p, "head", "rz")}>
            <E cx={0} cy={0.13} rx={0.142} ry={0.148} fill={PAL.pipSkin} />
            {[1, -1].map((s) => (
              <E key={s} cx={0.12 * s} cy={0.17} rx={0.045} ry={0.06} fill={PAL.pipHair} />
            ))}
            {!back && (
              <g transform={`translate(${fs * 0.07} 0)`} opacity={Math.min(1, faceVis * 3)}>
                <Part name="eyes" y={0.11} sy={Math.max(0.08, 1 + ch(p, "eyes", "sy"))}>
                  {[1, -1].map((s) => (
                    <g key={s}>
                      <E cx={0.05 * s} cy={0} rx={0.034} ry={0.034} fill={PAL.white} />
                      <E cx={0.05 * s + fs * 0.01} cy={-0.002} rx={0.018} ry={0.018} fill={PAL.pupil} />
                    </g>
                  ))}
                </Part>
                <E cx={0} cy={0.08} rx={0.026} ry={0.024} fill={PAL.pipSkin} />
                {[1, -1].map((s) => (
                  <E key={s} cx={0.08 * s} cy={0.065} rx={0.035} ry={0.024} fill={PAL.blush} />
                ))}
                <P d="M-0.03,0.04 Q0,0.01 0.03,0.04" fill="none" />
              </g>
            )}
            <Part name="hat" y={0.2 + ch(p, "hat", "py")}>
              <P d="M-0.25,0 C-0.24,-0.03 0.24,-0.03 0.25,0 C0.24,0.035 -0.24,0.035 -0.25,0 Z" fill={PAL.pipCoat} />
              <P d="M-0.15,0.01 C-0.15,0.09 -0.1,0.12 0,0.12 C0.1,0.12 0.15,0.09 0.15,0.01 Z" fill={PAL.pipCoat} />
              <R x={-0.152} y={0.005} w={0.304} h={0.02} r={0.01} fill={PAL.pipBand} />
            </Part>
          </Part>
        </Part>
      </g>
    </PartCtx.Provider>
  );
}

/* ---------------- Set ---------------- */

const WALL = (() => {
  const l = project(-1.6, 3, MARKS.doorZ);
  const r = project(2.6, 0, MARKS.doorZ);
  const o0 = project(0.03, 0, MARKS.doorZ);
  const o1 = project(0.65, 2.1, MARKS.doorZ);
  const archTop = project(0.34, 2.1, MARKS.doorZ);
  const rad = (o1.x - o0.x) / 2;
  return { l, r, o0, o1, archTop, rad, springY: archTop.y + rad };
})();

function archPath() {
  const { o0, o1, rad, springY } = WALL;
  return `M${o0.x},${o0.y} L${o0.x},${springY} A${rad},${rad} 0 0 1 ${o1.x},${springY} L${o1.x},${o0.y} Z`;
}

export function Street({ pose, slot }: { pose: ScenePose; slot: "back" | "wall" | "front" }) {
  const st = useContext(StyleCtx)!;
  if (!st.layers.background) return null;
  const lamp = project(1.35, 2.5, -4.85);
  const lanternTop = project(0.62, 2.35, -1.6);
  const lanternBase = project(0.62, 1.7, -1.6);
  const { l, r, o0, o1 } = WALL;
  const doorOpen = Math.cos(ch(pose.door, "leaf", "ry") * DEG);
  const doorW = (o1.x - o0.x) * Math.max(0.06, doorOpen);
  const pencil = st.look === "pencil";
  if (slot === "back")
    return (
      <PartCtx.Provider value={{ chain: ["bg"], s: 1 }}>
        <g data-layer="background">
          {!pencil && <rect x={0} y={0} width={1920} height={1080} fill={st.look === "flat" ? "#1D2B4F" : "#151D33"} />}
          <R x={690} y={-20} w={110} h={190} fill="#3A3F4A" isBg />
          <E cx={745} cy={70} rx={46} ry={46} fill="#EDE6D6" isBg />
          <P d="M745,70 L745,40 M745,70 L768,82" fill="none" isBg />
          <R x={40} y={150} w={620} h={620} fill={tokens.brick} isBg />
          {!pencil && <rect x={0} y={760} width={1920} height={320} fill={st.look === "flat" ? "#26262E" : "#14161C"} />}
          {pencil && <P d="M0,770 L640,770 M0,920 L1920,920" fill="none" isBg />}
          {/* doorway interior */}
          <P d={archPath()} fill="#120c0a" isBg />
          <PartCtx.Provider value={{ chain: ["door", "leaf"], s: 1 }}>
            <R x={o0.x} y={o0.y - (o0.y - WALL.springY) - WALL.rad} w={doorW} h={o0.y - WALL.springY + WALL.rad} fill={tokens.teal} isBg />
          </PartCtx.Provider>
        </g>
      </PartCtx.Provider>
    );
  if (slot === "wall")
    return (
      <PartCtx.Provider value={{ chain: ["bg"], s: 1 }}>
        <g data-layer="background">
          <path
            d={`M${l.x},${l.y} L${r.x},${l.y} L${r.x},${r.y} L${l.x},${r.y} Z ${archPath()}`}
            fillRule="evenodd"
            {...paintRaw(st, tokens.plaster, true)}
          />
          <R x={l.x - 20} y={l.y - 18} w={r.x - l.x + 40} h={22} fill={tokens.plasterShade} isBg />
          <R x={o0.x - 14} y={o0.y - 8} w={o1.x - o0.x + 28} h={14} fill={tokens.stone} isBg />
          {!pencil && st.layers.color && <circle cx={lamp.x} cy={lamp.y} r={90} fill="url(#glow)" />}
          <P d={`M${lamp.x},${lamp.y - 60} L${lamp.x},${lamp.y - 18}`} fill="none" isBg />
          <E cx={lamp.x} cy={lamp.y} rx={16} ry={16} fill="#FFF3D6" isBg />
        </g>
      </PartCtx.Provider>
    );
  return (
    <PartCtx.Provider value={{ chain: ["bg"], s: 1 }}>
      <g data-layer="foreground">
        <R x={lanternBase.x - 26} y={lanternBase.y} w={52} h={1080 - lanternBase.y + 20} fill="#1E2228" isBg />
        <R x={lanternTop.x - 92} y={lanternTop.y - 90} w={184} h={lanternBase.y - lanternTop.y + 90} r={6} fill={st.look === "pencil" ? "none" : "#FFF0CF"} isBg />
        <R x={lanternTop.x - 110} y={lanternBase.y - 8} w={220} h={26} fill="#1E2228" isBg />
      </g>
    </PartCtx.Provider>
  );
}

function paintRaw(st: Style, fill: string, isBg: boolean) {
  const fillOn = st.layers.color && st.look !== "pencil" && !st.tint;
  return {
    fill: fillOn ? fill : st.look === "pencil" ? "none" : "none",
    stroke: st.layers.line ? (isBg ? st.bgInk : st.ink) : "none",
    strokeWidth: st.lw * 0.8,
  };
}

/* ---------------- defs + scene ---------------- */

export function SceneDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id="glow">
        <stop offset="0%" stopColor="#FFD99A" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#FFD99A" stopOpacity="0" />
      </radialGradient>
      <pattern id={`${id}-halftone`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="4.5" cy="4.5" r="2.2" fill="rgb(30 10 50 / 0.55)" />
      </pattern>
      {Array.from({ length: 12 }, (_, i) => (
        <filter key={i} id={`${id}-boil-${i}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={i * 7 + 3} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      ))}
    </defs>
  );
}

export interface Scene2DProps {
  t: number;
  look: Look;
  id: string;
  layers?: Layers;
  scarfColor?: string;
  scarfAngles: number[];
  highlight?: { bram: Set<string>; pip: Set<string>; door: Set<string> } | null;
  /** Per-character time overrides (e.g. hold Bram while Pip's cycle repeats). */
  tBram?: number;
  tPip?: number;
  /** Pencil boil: which drawing this is (changes the line wobble per drawing). */
  drawing?: number;
  show?: "all" | "characters" | "background";
  /** Onion skin: draw lines only, in this color. */
  tint?: string | null;
}

export function Scene2D({ t, look, id, layers = ALL_LAYERS, scarfColor = tokens.bramScarf, scarfAngles, highlight = null, tBram, tPip, drawing = 0, show = "all", tint = null }: Scene2DProps) {
  const base = poseAt(t);
  const pose = { ...base, bram: tBram === undefined ? base.bram : poseAt(tBram).bram, pip: tPip === undefined ? base.pip : poseAt(tPip).pip };
  const style: Style = {
    look,
    layers,
    ink: look === "pencil" ? "#3b3833" : look === "flat" ? "#111" : look === "comic" ? "#0d0b12" : "#3a2418",
    bgInk: look === "pencil" ? "#8e8a82" : look === "flat" ? "#111" : look === "comic" ? "#0d0b12" : "#5a4030",
    lw: look === "flat" ? 5 : look === "comic" ? 3.4 : look === "pencil" ? 3.4 : 2,
    scarf: scarfColor,
    tint,
    filter: look === "pencil" ? `url(#${id}-boil-${drawing % 12})` : undefined,
    hatch: `url(#${id}-halftone)`,
    highlight,
  };
  const pipBehind = MARKS.pip[2] + ch(pose.pip, "root", "pz") < MARKS.doorZ + 0.25;
  const chars = show !== "background";
  const bg = show !== "characters";
  return (
    <StyleCtx.Provider value={style}>
      <g data-look={look} filter={style.filter}>
        {bg && <Street pose={pose} slot="back" />}
        {chars && pipBehind && <Pip pose={pose} />}
        {bg && <Street pose={pose} slot="wall" />}
        {chars && !pipBehind && <Pip pose={pose} />}
        {chars && <Bram pose={pose} scarfAngles={scarfAngles} />}
        {bg && <Street pose={pose} slot="front" />}
      </g>
    </StyleCtx.Provider>
  );
}
