"use client";

import type { Arm, Pose } from "./performance";

/**
 * Bram, drawn for acting: a 2D medium shot with a face rig (brows, lids, gaze, mouth, moustache) and a
 * body rig (lean, slump, shrug, two arms with hand shapes). Matches the lab's current cast design.
 * The 3D lab models have no face rig, so facial acting is taught here in 2D.
 */

const C = {
  skin: "#F0C3A0",
  skinShade: "#E2A986",
  nose: "#E79A80",
  blush: "#EE9C8C",
  hair: "#4A2E22",
  cap: "#35353B",
  capShade: "#26262B",
  coat: "#8E2227",
  coatShade: "#6E181C",
  coatLine: "#4C0F12",
  sweater: "#2A2224",
  scarf: "#EFE4CF",
  scarfShade: "#D8CBB0",
  brass: "#C29A4A",
  mouth: "#3A1418",
  tongue: "#C9555B",
  teeth: "#FBF7EE",
  ink: "#2B1810",
  white: "#FBFBF6",
  pupil: "#1C130F",
};

const W = 3; // ink line width

export interface RigFrame {
  pose: Pose;
  blink: number;
  mouth: { open: number; wide: number; round: number };
  breathe: number; // 0..1 cycle phase
  t: number;
}

export function ActorRig({ frame, idPrefix = "act", closeUp = false }: { frame: RigFrame; idPrefix?: string; closeUp?: boolean }) {
  const { pose: p, blink, mouth, breathe, t } = frame;
  const breath = Math.sin(breathe * Math.PI * 2) * 4;
  const S = -440 + p.slump * 45 - p.shrug * 48 + breath; // shoulder line (waist-relative)
  const headY = S - 190 + p.slump * 25 + p.shrug * 30;
  return (
    <svg viewBox={closeUp ? "330 200 940 650" : "0 0 1920 1080"} preserveAspectRatio={closeUp ? "xMidYMid slice" : undefined} className="absolute inset-0 h-full w-full" role="img" aria-label="Bram performing the line" data-testid="actor-svg">
      <defs>
        <radialGradient id={`${idPrefix}-lamp`} cx="0.66" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#F6D9A6" />
          <stop offset="0.55" stopColor="#C9A57A" />
          <stop offset="1" stopColor="#7A6248" />
        </radialGradient>
        <linearGradient id={`${idPrefix}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101A30" />
          <stop offset="1" stopColor="#22304E" />
        </linearGradient>
        <radialGradient id={`${idPrefix}-vig`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <Background id={idPrefix} />
      <Pip t={t} gazeAtBram={1} />
      <g transform={`translate(800 1225) scale(1.12) rotate(${p.lean * 0.7})`}>
        <Torso S={S} />
        <Scarf S={S} p={p} t={t} />
        <Head y={headY} p={p} blink={blink} mouth={mouth} id={idPrefix} />
        <ArmGroup side={-1} S={S} arm={p.armL} />
        <ArmGroup side={1} S={S} arm={p.armR} />
      </g>
      <rect width="1920" height="1080" fill={`url(#${idPrefix}-vig)`} pointerEvents="none" />
    </svg>
  );
}

function Background({ id }: { id: string }) {
  return (
    <g>
      <rect width="1920" height="1080" fill={`url(#${id}-sky)`} />
      <rect x="0" y="120" width="330" height="960" fill="#5E2A22" />
      {Array.from({ length: 14 }, (_, r) => (
        <line key={r} x1="0" x2="330" y1={160 + r * 66} y2={160 + r * 66} stroke="#4A1F19" strokeWidth="4" />
      ))}
      <rect x="300" y="60" width="1620" height="1020" fill={`url(#${id}-lamp)`} />
      <rect x="300" y="44" width="1620" height="26" fill="#8A7458" />
      {/* doorway behind Pip */}
      <path d="M1420,1080 L1420,420 A150,150 0 0 1 1720,420 L1720,1080 Z" fill="#1A120E" />
      <path d="M1420,1080 L1420,420 A150,150 0 0 1 1470,310 L1470,1080 Z" fill="#2B6F72" opacity="0.9" />
      <path d="M1400,1080 L1400,420 A170,170 0 0 1 1740,420 L1740,1080" fill="none" stroke="#7A6248" strokeWidth="18" />
      {/* wall lamp */}
      <circle cx="1240" cy="190" r="150" fill="#FFE2A8" opacity="0.18" />
      <rect x="1236" y="96" width="8" height="70" fill="#3A2E22" />
      <circle cx="1240" cy="185" r="24" fill="#FFF3D6" />
    </g>
  );
}

function Pip({ t, gazeAtBram }: { t: number; gazeAtBram: number }) {
  const bob = Math.sin(t * 2.2) * 3;
  return (
    <g transform={`translate(1660 ${790 + bob})`} aria-hidden>
      {/* duffle coat */}
      <path d="M-120,320 C-118,180 -96,90 -60,60 L60,60 C96,90 118,180 120,320 Z" fill="#F4C430" stroke={C.ink} strokeWidth={W} />
      {[130, 190, 250].map((y) => (
        <rect key={y} x="-14" y={y} width="28" height="10" rx="5" fill="#3A2A1F" />
      ))}
      <ellipse cx="0" cy="-10" rx="72" ry="76" fill="#F7D9C2" stroke={C.ink} strokeWidth={W} />
      <ellipse cx="-62" cy="0" rx="20" ry="30" fill="#A0482A" />
      <ellipse cx="62" cy="0" rx="20" ry="30" fill="#A0482A" />
      <g transform={`translate(${-10 * gazeAtBram} 0)`}>
        {[-24, 24].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="-8" rx="15" ry="17" fill={C.white} stroke={C.ink} strokeWidth="2" />
            <circle cx={x - 6 * gazeAtBram} cy={-14 * gazeAtBram - 6} r="8" fill={C.pupil} />
          </g>
        ))}
        <path d="M-14,30 Q0,40 14,30" fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* sou'wester */}
      <path d="M-120,-40 C-100,-70 100,-70 120,-40 C100,-20 -100,-20 -120,-40 Z" fill="#F4C430" stroke={C.ink} strokeWidth={W} />
      <path d="M-66,-50 C-66,-110 -34,-130 0,-130 C34,-130 66,-110 66,-50 Z" fill="#F4C430" stroke={C.ink} strokeWidth={W} />
      <rect x="-66" y="-62" width="132" height="10" rx="5" fill="#D9A91E" />
    </g>
  );
}

function Torso({ S }: { S: number }) {
  const sh = 250;
  return (
    <g>
      {/* neck */}
      <rect x="-48" y={S - 70} width="96" height="90" fill={C.skinShade} />
      <path
        d={`M-275,40 L-262,${S + 70} C-258,${S + 20} -230,${S} -160,${S - 6} L-60,${S - 14} L60,${S - 14} L160,${S - 6} C230,${S} 258,${S + 20} 262,${S + 70} L275,40 Z`}
        fill={C.coat}
        stroke={C.coatLine}
        strokeWidth={W}
      />
      {/* sweater V and lapels */}
      <path d={`M-60,${S - 12} L0,${S + 150} L60,${S - 12} Z`} fill={C.sweater} />
      <path d={`M-62,${S - 12} L-120,${S + 40} L-30,${S + 120} L0,${S + 152} Z`} fill={C.coatShade} stroke={C.coatLine} strokeWidth={W} />
      <path d={`M62,${S - 12} L120,${S + 40} L30,${S + 120} L0,${S + 152} Z`} fill={C.coatShade} stroke={C.coatLine} strokeWidth={W} />
      {/* side shading */}
      <path d={`M150,${S} C230,${S} 258,${S + 20} 262,${S + 70} L275,40 L200,40 C210,${S + 200} 190,${S + 80} 150,${S} Z`} fill={C.coatShade} opacity="0.6" />
      {[S + 200, S + 300, S + 400].map((y) => (
        <g key={y}>
          <circle cx="-40" cy={y} r="14" fill={C.brass} stroke={C.ink} strokeWidth="2" />
          <circle cx="-44" cy={y - 4} r="4" fill="#F3DE9E" />
        </g>
      ))}
      <rect x={-sh + 30} y={S + 330} width="140" height="34" rx="8" fill={C.coatShade} stroke={C.coatLine} strokeWidth="2" />
      <rect x={sh - 170} y={S + 330} width="140" height="34" rx="8" fill={C.coatShade} stroke={C.coatLine} strokeWidth="2" />
    </g>
  );
}

function Scarf({ S, p, t }: { S: number; p: Pose; t: number }) {
  const sway = p.headTurn * 18 + Math.sin(t * 1.7) * 2;
  return (
    <g>
      <path d={`M-150,${S - 30} C-150,${S + 30} 150,${S + 30} 150,${S - 30} C140,${S - 70} -140,${S - 70} -150,${S - 30} Z`} fill={C.scarf} stroke={C.ink} strokeWidth={W} />
      {[-110, -60, -10, 40, 90].map((x) => (
        <path key={x} d={`M${x},${S - 52} q8,30 0,58`} stroke={C.scarfShade} strokeWidth="5" fill="none" />
      ))}
      <path
        d={`M40,${S} C45,${S + 120} ${60 + sway},${S + 200} ${70 + sway},${S + 280} L${150 + sway},${S + 280} C${140 + sway},${S + 200} 120,${S + 100} 120,${S - 10} Z`}
        fill={C.scarf}
        stroke={C.ink}
        strokeWidth={W}
        data-target="scarf"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={78 + sway + i * 13} x2={76 + sway + i * 13} y1={S + 280} y2={S + 318} stroke={C.scarfShade} strokeWidth="6" strokeLinecap="round" />
      ))}
    </g>
  );
}

function ArmGroup({ side, S, arm }: { side: -1 | 1; S: number; arm: Arm }) {
  // Screen-left arm (side −1): outward = clockwise (+); screen-right (side +1): outward = −.
  const a1 = -side * arm.up;
  const a2 = -side * arm.fore;
  return (
    <g transform={`translate(${side * 232} ${S + 40}) rotate(${a1})`}>
      <rect x="-48" y="-20" width="96" height="250" rx="46" fill={C.coat} stroke={C.coatLine} strokeWidth={W} />
      <g transform={`translate(0 215) rotate(${a2})`}>
        <rect x="-43" y="-20" width="86" height="230" rx="40" fill={C.coat} stroke={C.coatLine} strokeWidth={W} />
        <rect x="-45" y="178" width="90" height="34" rx="12" fill={C.coatShade} stroke={C.coatLine} strokeWidth="2" />
        <Hand open={arm.open} fist={arm.fist} side={side} />
      </g>
    </g>
  );
}

function Hand({ open, fist, side }: { open: number; fist: number; side: -1 | 1 }) {
  const y = 250;
  if (fist > 0.5) {
    return (
      <g>
        <ellipse cx="0" cy={y} rx="44" ry="42" fill={C.skin} stroke={C.ink} strokeWidth={W} />
        {[-22, -6, 10, 26].map((x) => (
          <path key={x} d={`M${x - 8},${y + 20} q8,10 16,0`} stroke={C.ink} strokeWidth="2" fill="none" />
        ))}
      </g>
    );
  }
  const spread = open;
  return (
    <g>
      {[-1.5, -0.5, 0.5, 1.5].map((k) => (
        <rect
          key={k}
          x="-10"
          y="0"
          width="20"
          height={52 + spread * 14 - Math.abs(k) * 6}
          rx="10"
          fill={C.skin}
          stroke={C.ink}
          strokeWidth="2.5"
          transform={`translate(${k * 18} ${y + 22}) rotate(${-k * spread * 11})`}
        />
      ))}
      <rect x="-10" y="0" width="20" height="46" rx="10" fill={C.skin} stroke={C.ink} strokeWidth="2.5" transform={`translate(${side * -38} ${y - 8}) rotate(${side * (40 + spread * 35)})`} />
      <ellipse cx="0" cy={y + 8} rx="44" ry="40" fill={C.skin} stroke={C.ink} strokeWidth={W} />
    </g>
  );
}

function Head({ y, p, blink, mouth, id }: { y: number; p: Pose; blink: number; mouth: RigFrame["mouth"]; id: string }) {
  const turn = p.headTurn;
  const sx = 1 - p.stretch * 0.05;
  const sy = 1 + p.stretch * 0.08;
  const fx = turn * 55;
  const fy = p.headNod * 14;
  return (
    <g transform={`translate(${turn * 12} ${y + p.headNod * 8}) rotate(${p.headTilt}) scale(${sx} ${sy})`}>
      {/* ears */}
      <ellipse cx={-138 + fx * 0.3} cy="10" rx="26" ry="40" fill={C.skinShade} stroke={C.ink} strokeWidth={W} />
      <ellipse cx={138 + fx * 0.3} cy="10" rx="26" ry="40" fill={C.skinShade} stroke={C.ink} strokeWidth={W} />
      <path d="M0,-170 C95,-170 145,-95 145,5 C145,105 90,170 0,170 C-90,170 -145,105 -145,5 C-145,-95 -95,-170 0,-170 Z" fill={C.skin} stroke={C.ink} strokeWidth={W} />
      {/* hair at the temples */}
      <path d="M-146,-30 C-150,-90 -120,-120 -90,-118 L-110,-40 Z" fill={C.hair} />
      <path d="M146,-30 C150,-90 120,-120 90,-118 L110,-40 Z" fill={C.hair} />
      <g transform={`translate(${fx} ${fy})`}>
        <Brows p={p} />
        <Eye cx={-55} p={p} blink={blink} id={`${id}-eL`} />
        <Eye cx={55} p={p} blink={blink} id={`${id}-eR`} />
        {/* cheeks rise with a real smile or a squint */}
        {[-1, 1].map((s) => (
          <ellipse key={s} cx={s * 90} cy={55 - Math.max(0, p.smile) * 10 - p.squint * 10} rx="34" ry="22" fill={C.blush} opacity="0.55" />
        ))}
        <Mouth p={p} mouth={mouth} />
        <Moustache p={p} mouth={mouth} />
        <ellipse cx="0" cy="34" rx="50" ry="44" fill={C.nose} stroke={C.ink} strokeWidth={W} />
        <ellipse cx="-14" cy="20" rx="12" ry="8" fill="#F6C3B0" />
      </g>
      {/* flat cap */}
      <g transform={`translate(${fx * 0.25} 0)`}>
        <path d="M-160,-92 C-170,-170 -60,-205 10,-200 C110,-196 175,-160 160,-96 Z" fill={C.cap} stroke={C.ink} strokeWidth={W} />
        <path d={`M${-140 + fx * 0.4},-98 C${-60 + fx * 0.4},-130 ${110 + fx * 0.4},-128 ${175 + fx * 0.4},-88 C${110 + fx * 0.4},-72 ${-60 + fx * 0.4},-74 ${-140 + fx * 0.4},-98 Z`} fill={C.capShade} stroke={C.ink} strokeWidth={W} />
      </g>
    </g>
  );
}

function Brows({ p }: { p: Pose }) {
  const raise = p.browRaise * 18;
  const brow = (side: -1 | 1) => {
    // inner end up for worry (+browInner), down for anger (−)
    const angle = side * p.browInner * 24;
    const y = -62 - raise - (side > 0 ? p.browAsym * 24 : 0) + (p.squint > 0.3 ? 4 : 0);
    return <rect key={side} x="-46" y="-12" width="92" height="24" rx="12" fill={C.hair} transform={`translate(${side * 58} ${y}) rotate(${angle})`} />;
  };
  return (
    <g>
      {brow(-1)}
      {brow(1)}
    </g>
  );
}

function Eye({ cx, p, blink, id }: { cx: number; p: Pose; blink: number; id: string }) {
  const rx = 30;
  const ry = 34 + Math.max(0, -p.lid) * 6;
  const cover = Math.min(1, Math.max(-0.05, 0.12 + p.lid * 0.55 + blink));
  const lower = p.squint * 0.42;
  const px = cx + p.gazeX * 13;
  const py = -12 + p.gazeY * 14;
  return (
    <g>
      <clipPath id={id}>
        <ellipse cx={cx} cy="-12" rx={rx} ry={ry} />
      </clipPath>
      <ellipse cx={cx} cy="-12" rx={rx} ry={ry} fill={C.white} />
      <g clipPath={`url(#${id})`}>
        <circle cx={px} cy={py} r="15" fill={C.pupil} />
        <circle cx={px + 5} cy={py - 6} r="5" fill="#fff" />
        <rect x={cx - rx - 2} y={-12 - ry - 2} width={rx * 2 + 4} height={Math.max(0, ry * 2 * cover) + 2} fill={C.skin} />
        <rect x={cx - rx - 2} y={-12 + ry - ry * 2 * lower} width={rx * 2 + 4} height={ry * 2 * lower + 2} fill={C.skin} />
        <line x1={cx - rx} x2={cx + rx} y1={-12 - ry + ry * 2 * Math.max(0, cover)} y2={-12 - ry + ry * 2 * Math.max(0, cover)} stroke={C.ink} strokeWidth="4" />
      </g>
      <ellipse cx={cx} cy="-12" rx={rx} ry={ry} fill="none" stroke={C.ink} strokeWidth={W} />
    </g>
  );
}

function Mouth({ p, mouth }: { p: Pose; mouth: RigFrame["mouth"] }) {
  const open = Math.min(1.2, mouth.open + p.jaw);
  const w = 66 * (1 + mouth.wide * 0.3 + Math.max(0, p.smile) * 0.2 - mouth.round * 0.35);
  const cy = 112;
  const lift = p.smile * 16;
  const yl = cy - lift - p.smirk * 14;
  const yr = cy - lift + p.smirk * 14;
  const top = cy - 6 - open * 8;
  const bot = cy + 4 + open * 52;
  if (open < 0.06) {
    return <path d={`M${-w},${yl} Q0,${cy + lift * 0.8} ${w},${yr}`} fill="none" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />;
  }
  return (
    <g>
      <path d={`M${-w},${yl} Q0,${top} ${w},${yr} Q0,${bot + lift * 0.5} ${-w},${yl} Z`} fill={C.mouth} stroke={C.ink} strokeWidth={W} />
      {open > 0.25 && <path d={`M${-w * 0.7},${(yl + top) / 2 + 4} Q0,${top + 8} ${w * 0.7},${(yr + top) / 2 + 4} L${w * 0.6},${top + 18} Q0,${top + 22} ${-w * 0.6},${top + 18} Z`} fill={C.teeth} />}
      {open > 0.45 && <ellipse cx="0" cy={bot - 14} rx={w * 0.45} ry={10 + open * 6} fill={C.tongue} />}
    </g>
  );
}

function Moustache({ p, mouth }: { p: Pose; mouth: RigFrame["mouth"] }) {
  const lift = p.smile * 14;
  const up = mouth.open * 6;
  const side = (s: -1 | 1) => {
    const tip = 70 - lift - s * p.smirk * 16;
    return `M0,${62 - up} C${s * 30},${48 - up} ${s * 75},${58 - up} ${s * 108},${tip - 6} C${s * 122},${tip - 14} ${s * 120},${tip - 32} ${s * 104},${tip - 30} C${s * 112},${tip - 18} ${s * 100},${tip - 4} ${s * 84},${tip + 4} C${s * 60},${tip + 18} ${s * 24},${88 - up} 0,${80 - up} Z`;
  };
  return (
    <g>
      <path d={side(-1)} fill={C.hair} stroke={C.ink} strokeWidth="2" />
      <path d={side(1)} fill={C.hair} stroke={C.ink} strokeWidth="2" />
    </g>
  );
}
