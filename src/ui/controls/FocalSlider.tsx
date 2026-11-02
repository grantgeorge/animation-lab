"use client";

import { useRef } from "react";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { hfovDeg } from "@/engine/optics";
import { useLab, labStore } from "@/ui/store/labStore";

const LMIN = Math.log(d.focal.min);
const LMAX = Math.log(d.focal.max);
const toX = (f: number) => (Math.log(f) - LMIN) / (LMAX - LMIN);
const fromX = (x: number) => Math.exp(LMIN + Math.min(1, Math.max(0, x)) * (LMAX - LMIN));

/** Log-scaled focal length slider: equal steps feel equal (24→48 like 50→100). */
export function FocalSlider() {
  const focal = useLab((s) => s.camera.rig.focalMm);
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const setFocal = (f: number, source: "slider" | "preset") => labStore.getState().setFocal(f, source);
  const fromPointer = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    let f = fromX((clientX - r.left) / r.width);
    const snap = d.focal.presets.find((p) => Math.abs(Math.log(p / f)) < 0.025);
    if (snap) f = snap;
    setFocal(Math.round(f), "slider");
  };
  const x = toX(focal);
  const h = hfovDeg(focal);
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    labStore.getState().setInteraction({ dragging: null });
  };
  return (
    <div className="lf-focal-slider">
      <div className="mb-1 flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="mono text-[22px] font-semibold leading-none text-focal-text" data-testid="focal-readout">
            {Math.round(focal)}
            <span className="ml-1 text-[13px] text-ink-2">mm</span>
          </span>
        </div>
        <FovWedge deg={h} />
      </div>
      <div
        ref={track}
        className="lf-focal-track relative h-7 cursor-pointer touch-none select-none rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-distance)]"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          input.current?.focus({ preventScroll: true });
          labStore.getState().setInteraction({ dragging: "ring" });
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromPointer(e.clientX);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <div className="absolute inset-x-0 top-[13px] h-[3px] rounded bg-white/12" />
        <div className="absolute left-0 top-[13px] h-[3px] rounded" style={{ width: `${x * 100}%`, background: "linear-gradient(90deg, rgb(95 227 255 / .25), var(--color-focal))", boxShadow: "0 0 10px rgb(95 227 255 / .45)" }} />
        <div
          className="pointer-events-none absolute top-[7px] h-[15px] w-[15px] -translate-x-1/2 rounded-full border-2 border-[var(--color-focal)] bg-[#e9f6ff] shadow-[0_0_0_4px_rgb(95_227_255/0.18),0_3px_8px_#0008]"
          style={{ left: `${x * 100}%` }}
        />
        <input
          ref={input}
          type="range"
          min={d.focal.min}
          max={d.focal.max}
          step={1}
          value={Math.round(focal)}
          aria-label="Focal length"
          aria-valuetext={`${Math.round(focal)} millimetres, ${h.toFixed(1)} degrees horizontal field of view`}
          data-testid="focal-slider"
          onChange={(e) => setFocal(Number(e.target.value), "slider")}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </div>
    </div>
  );
}

/** Tiny wedge glyph whose opening equals the current horizontal field of view. */
function FovWedge({ deg }: { deg: number }) {
  const a = ((deg / 2) * Math.PI) / 180;
  const r = 16;
  const x = Math.sin(a) * r;
  const y = Math.cos(a) * r;
  return (
    <div className="flex items-center gap-1.5">
      <svg width="40" height="20" viewBox="-20 -18 40 20" aria-hidden>
        <path d={`M0 0 L${-x} ${-y} M0 0 L${x} ${-y}`} stroke="var(--color-focal)" strokeWidth="1.3" fill="none" />
        <path d={`M${-x} ${-y} A${r} ${r} 0 0 1 ${x} ${-y}`} stroke="var(--color-focal)" strokeOpacity="0.4" fill="none" />
      </svg>
      <span className="mono text-[12px] text-ink-1" data-testid="hfov-readout">
        {deg.toFixed(1)}°
      </span>
    </div>
  );
}

export function PresetRow() {
  const focal = useLab((s) => Math.round(s.camera.rig.focalMm));
  return (
    <div className="lf-focal-presets mt-2 grid grid-cols-6 gap-1">
      {d.focal.presets.map((p, k) => (
        <button
          key={p}
          type="button"
          data-testid={`preset-${p}`}
          aria-pressed={focal === p}
          title={`${p} mm (key ${k + 1})`}
          onClick={() => labStore.getState().setFocal(p, "preset")}
          className={`mono h-7 rounded-[8px] text-[11.5px] transition-colors ${focal === p ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.06] text-ink-1 hover:bg-white/15"}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
