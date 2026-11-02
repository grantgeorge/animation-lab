"use client";

import { useRef, type ReactNode } from "react";
import type { Wheel as WheelValue } from "../engine/grade";

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  hint,
  neutral,
  track,
}: {
  id: string;
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
  /** Double-click resets to this. */
  neutral?: number;
  /** Optional CSS background for the track (hue sliders). */
  track?: string;
}) {
  const shown = format ? format(value) : value.toFixed(2);
  return (
    <label className="gf-slider" data-testid={`slider-${id}`} title={hint}>
      <span className="gf-slider-head">
        <span>{label}</span>
        <output className="mono">{shown}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={typeof label === "string" ? label : id}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        onDoubleClick={() => neutral !== undefined && onChange(neutral)}
        style={track ? ({ "--gf-track": track } as React.CSSProperties) : undefined}
      />
    </label>
  );
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const signed = (digits = 2, unit = "") => (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}${unit}`;

/** A colour wheel: drag the puck toward a hue; the slider under it is the master level. */
export function ColorWheel({ id, label, value, onChange }: { id: string; label: string; value: WheelValue; onChange: (w: WheelValue) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const R = 40;
  const fromEvent = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 2 - 1;
    let y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    // the disc is drawn at 1/2 scale: a full push is far too strong for a grade
    onChange({ ...value, x: Math.round(x * 0.5 * 1000) / 1000, y: Math.round(y * 0.5 * 1000) / 1000 });
  };
  const px = 50 + (value.x / 0.5) * R;
  const py = 50 - (value.y / 0.5) * R;
  return (
    <div className="gf-wheel" data-testid={`wheel-${id}`}>
      <div className="gf-wheel-pad">
      <span className="gf-wheel-ring" aria-hidden />
      <svg
        ref={ref}
        viewBox="0 0 100 100"
        role="slider"
        aria-label={`${label} colour`}
        aria-valuetext={`x ${value.x.toFixed(2)}, y ${value.y.toFixed(2)}`}
        tabIndex={0}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromEvent(e); }}
        onPointerMove={(e) => e.buttons && fromEvent(e)}
        onDoubleClick={() => onChange({ ...value, x: 0, y: 0 })}
        onKeyDown={(e) => {
          const d = 0.02;
          const k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
          if (k) { e.preventDefault(); onChange({ ...value, x: value.x + k[0], y: value.y + k[1] }); }
        }}
      >
        <defs>
          <radialGradient id={`gf-wfade-${id}`}>
            <stop offset="0" stopColor="#1a1c21" stopOpacity="1" />
            <stop offset="1" stopColor="#1a1c21" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r={R} className="gf-wheel-disc" />
        <circle cx="50" cy="50" r={R} fill={`url(#gf-wfade-${id})`} />
        <line x1="50" y1={50 - R} x2="50" y2={50 + R} className="gf-wheel-cross" />
        <line x1={50 - R} y1="50" x2={50 + R} y2="50" className="gf-wheel-cross" />
        <circle cx={px} cy={py} r="4.2" className="gf-wheel-puck" />
      </svg>
      </div>
      <span className="gf-wheel-label">{label}</span>
      <input
        type="range"
        min={-0.5}
        max={0.5}
        step={0.01}
        value={value.m}
        aria-label={`${label} master`}
        onChange={(e) => onChange({ ...value, m: Number(e.currentTarget.value) })}
        onDoubleClick={() => onChange({ ...value, m: 0 })}
      />
      <span className="gf-wheel-val mono">{value.m >= 0 ? "+" : "−"}{Math.abs(value.m).toFixed(2)}</span>
    </div>
  );
}

export const HUE_TRACK = "linear-gradient(90deg,#e05555,#e0a455,#d8d855,#55d870,#55d8d8,#5577e0,#a055e0,#e055b0,#e05555)";

export function Section({ title, kicker, children, testId }: { title: string; kicker?: string; children: ReactNode; testId?: string }) {
  return (
    <section className="gf-section" data-testid={testId}>
      <header>
        <h3>{title}</h3>
        {kicker && <p>{kicker}</p>}
      </header>
      {children}
    </section>
  );
}
