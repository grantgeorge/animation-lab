'use client';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { SHAPES, normBary, type Bary } from './design';

/** Corners of the pad: circle bottom-left, square bottom-right, triangle on top. */
const V = [[22, 150], [198, 150], [110, 18]] as const;

export function baryToPoint(b: Bary): [number, number] {
  return [b[0] * V[0][0] + b[1] * V[1][0] + b[2] * V[2][0], b[0] * V[0][1] + b[1] * V[1][1] + b[2] * V[2][1]];
}
/** Barycentric weights of a point, clamped into the triangle. */
export function pointToBary(x: number, y: number): Bary {
  const [[x1, y1], [x2, y2], [x3, y3]] = V;
  const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / det;
  const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / det;
  return normBary([a, b, 1 - a - b]);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
export const shapeText = (b: Bary) => SHAPES.map((s, i) => `${s.label} ${pct(b[i])}`).join(', ');

export function ShapePad({ value, onChange }: { value: Bary; onChange: (b: Bary) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [px, py] = baryToPoint(value);
  const from = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    onChange(pointToBary(((e.clientX - r.left) / r.width) * 220, ((e.clientY - r.top) / r.height) * 170));
  };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 22 : 8;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange(pointToBary(px + d[0], py + d[1]));
  };
  return <div className="cd-pad">
    <svg ref={svg} viewBox="0 0 220 170" role="slider" tabIndex={0} aria-label="Shape language" aria-valuetext={shapeText(value)} aria-valuenow={Math.round(value[2] * 100)} aria-valuemin={0} aria-valuemax={100}
      data-testid="shape-pad" onKeyDown={key}
      onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); from(e); }}
      onPointerMove={e => { if (e.buttons) from(e); }}>
      <defs>
        <linearGradient id="cd-pad-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#8fd4a81f" /><stop offset=".5" stopColor="#e2c48f1a" /><stop offset="1" stopColor="#e2807a24" /></linearGradient>
      </defs>
      <polygon points={V.map(p => p.join(',')).join(' ')} fill="url(#cd-pad-fill)" stroke="#ffffff30" strokeWidth="1.2" strokeLinejoin="round" />
      {V.map((p, i) => <line key={i} x1={p[0]} y1={p[1]} x2={(V[(i + 1) % 3][0] + V[(i + 2) % 3][0]) / 2} y2={(V[(i + 1) % 3][1] + V[(i + 2) % 3][1]) / 2} stroke="#ffffff0d" />)}
      <circle cx={V[0][0]} cy={V[0][1]} r="9" fill="none" stroke="#8fd4a8" strokeWidth="2" />
      <rect x={V[1][0] - 8} y={V[1][1] - 8} width="16" height="16" fill="none" stroke="#e2c48f" strokeWidth="2" />
      <path d={`M${V[2][0]},${V[2][1] - 10} l9,16 h-18 z`} fill="none" stroke="#e2807a" strokeWidth="2" strokeLinejoin="round" />
      <line x1={V[0][0]} y1={V[0][1]} x2={px} y2={py} stroke="#8fd4a8" strokeOpacity={0.25 + value[0] * 0.6} />
      <line x1={V[1][0]} y1={V[1][1]} x2={px} y2={py} stroke="#e2c48f" strokeOpacity={0.25 + value[1] * 0.6} />
      <line x1={V[2][0]} y1={V[2][1]} x2={px} y2={py} stroke="#e2807a" strokeOpacity={0.25 + value[2] * 0.6} />
      <circle cx={px} cy={py} r="8" fill="#edf0f3" stroke="#0f1214" strokeWidth="2.5" />
    </svg>
    <div className="cd-pad-snap" role="group" aria-label="Pure shapes">
      {SHAPES.map((s, i) => <button key={s.id} type="button" aria-pressed={value[i] > 0.999} onClick={() => onChange(normBary([i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]))}>
        <b data-shape={s.id}>{s.label}</b><small>{pct(value[i])}</small>
      </button>)}
    </div>
  </div>;
}
