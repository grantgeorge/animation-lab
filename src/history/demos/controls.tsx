"use client";

import type { ReactNode } from "react";
import { FPS } from "../rig2d/pose";

export interface DemoProps {
  reducedMotion: boolean;
  note: boolean;
}

export function StageSvg({ children, label, viewBox = "0 0 1920 1080", testId }: { children: ReactNode; label: string; viewBox?: string; testId?: string }) {
  return (
    <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" role="img" aria-label={label} data-testid={testId} preserveAspectRatio="xMidYMid slice">
      {children}
    </svg>
  );
}

export function Transport({
  frame,
  total,
  playing,
  setPlaying,
  seek,
  step,
  label = "Frame",
  stepSize = 1,
  marks,
}: {
  frame: number;
  total: number;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  seek: (f: number) => void;
  step: (n: number) => void;
  label?: string;
  stepSize?: number;
  marks?: { at: number; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => step(-stepSize)} className="ctl-btn" aria-label={`Previous ${label.toLowerCase()}`}>
        ‹
      </button>
      <button type="button" onClick={() => setPlaying(!playing)} className="ctl-btn min-w-16" aria-label={playing ? "Pause demonstration" : "Play demonstration"} data-testid="demo-play">
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" onClick={() => step(stepSize)} className="ctl-btn" aria-label={`Next ${label.toLowerCase()}`}>
        ›
      </button>
      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={total - 1}
          step={stepSize}
          value={frame - (frame % stepSize)}
          onChange={(e) => {
            setPlaying(false);
            seek(Number(e.target.value));
          }}
          aria-label={`${label} scrubber`}
          aria-valuetext={`${label} ${Math.floor(frame / stepSize) + 1} of ${Math.ceil(total / stepSize)}, ${(frame / FPS).toFixed(2)} seconds`}
          className="w-full accent-[var(--color-distance)]"
          data-testid="demo-scrub"
        />
        {marks && (
          <div className="pointer-events-none absolute inset-x-0 -bottom-3 h-3" aria-hidden>
            {marks.map((m) => (
              <span key={m.label} className="mono absolute -translate-x-1/2 text-[9px] text-ink-3" style={{ left: `${(m.at / total) * 100}%` }}>
                {m.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="mono w-24 text-right text-[11px] text-ink-1" aria-live="off">
        {label === "Drawing" ? `#${Math.floor(frame / stepSize) + 1}` : `f${String(frame).padStart(3, "0")}`} · {(frame / FPS).toFixed(2)}s
      </span>
    </div>
  );
}

export function Toggle({ on, onChange, children, testId }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; testId?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} data-testid={testId} className={`ctl-chip ${on ? "ctl-chip-on" : ""}`}>
      <span aria-hidden className={`mr-1.5 inline-block h-2 w-2 rounded-full ${on ? "bg-[var(--color-subject)]" : "bg-white/20"}`} />
      {children}
    </button>
  );
}

export function DemoControls({ children }: { children: ReactNode }) {
  return <div className="space-y-3 border-t border-white/[0.06] bg-[#0b0f16] px-4 py-3">{children}</div>;
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-ink-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}
