"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/ui/primitives";
import { getAsset } from "../content/assets";
import { DemoControls, Toggle, type DemoProps } from "./controls";
import { PLANES, planeOffsets, type PlaneId } from "./parallax";

const SRC: Record<PlaneId, string> = {
  background: "/history/layers/multiplane-bg.webp",
  characters: "/history/layers/multiplane-chars.webp",
  foreground: "/history/layers/multiplane-fg.webp",
};
const BLUE_CELS = "/history/layers/multiplane-chars-blue.webp";
const SCALE = 1.2; // overscan so travelling planes never reveal an edge

export default function LayerDemo({ reducedMotion, note }: DemoProps) {
  const [mode, setMode] = useState<"flat" | "layered">("layered");
  const [c, setC] = useState(0);
  const [auto, setAuto] = useState(false);
  const [side, setSide] = useState(false);
  const flat = getAsset(note ? "note-multiplane-blue-scarf" : "still-multiplane");

  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setC(Math.sin(((now - t0) / 1000) * 0.9));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  const off = planeOffsets(c, mode);
  const pct = (px: number) => `${(px / 1920) * 100}%`;
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden bg-[#0d1424]" data-testid="parallax-stage" data-mode={mode}>
        {mode === "flat" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flat?.url ?? SRC.background}
            alt="The painted shot as one flat picture"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: `translateX(${pct(off.characters)}) scale(${SCALE})` }}
            data-plane="flat"
          />
        ) : (
          PLANES.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.id === "characters" && note ? BLUE_CELS : SRC[p.id]}
              alt={p.id === "background" ? "Layered shot: background painting, character cels and foreground lantern on separate planes" : ""}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: `translateX(${pct(off[p.id])}) scale(${SCALE})` }}
              data-plane={p.id}
              data-offset={off[p.id].toFixed(2)}
            />
          ))
        )}
        {side && <SideView c={c} mode={mode} />}
      </div>
      <DemoControls>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <Segmented label="Composition" value={mode} onChange={setMode} options={[{ value: "flat", label: "Flat", testId: "mode-flat" }, { value: "layered", label: "Layered", testId: "mode-layered" }]} />
          </div>
          <label className="flex flex-1 items-center gap-2 text-[12px] text-ink-1">
            Camera travel
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={c}
              onChange={(e) => {
                setAuto(false);
                setC(Number(e.target.value));
              }}
              aria-valuetext={`${Math.round(c * 100)} percent ${c < 0 ? "left" : "right"}`}
              className="flex-1 accent-[var(--color-distance)]"
              data-testid="camera-travel"
            />
          </label>
          {!reducedMotion && (
            <Toggle on={auto} onChange={setAuto}>
              Camera move
            </Toggle>
          )}
          <Toggle on={side} onChange={setSide} testId="toggle-side">
            Side view
          </Toggle>
        </div>
        <p className="text-[11.5px] text-ink-2">
          {mode === "flat"
            ? "One flat picture: everything slides together, so there is no sense of depth."
            : "Three planes cut from the same painting: the lantern moves fastest, the characters less, the far background least. That difference is parallax."}
        </p>
      </DemoControls>
    </div>
  );
}

function SideView({ c, mode }: { c: number; mode: "flat" | "layered" }) {
  // Top-down: camera at left, planes spaced by distance (log scale), camera slides vertically.
  const x = (d: number) => 60 + Math.log2(d + 1) * 70;
  return (
    <svg viewBox="0 0 320 180" className="absolute bottom-3 right-3 w-[38%] max-w-[320px] rounded-lg border border-white/15 bg-[#0b0f16]/90" role="img" aria-label="Side view of the camera and the three painted planes" data-testid="side-view">
      <text x={10} y={16} fontSize={10} fill="#7c8796" fontFamily="var(--font-mono-face)">
        TOP VIEW
      </text>
      <rect x={14} y={82 + c * 40} width={24} height={16} rx={3} fill="#ffb547" />
      <text x={10} y={124 + c * 40} fontSize={9} fill="#ffb547" fontFamily="var(--font-mono-face)">
        camera
      </text>
      {(mode === "flat" ? [{ id: "flat", label: "One picture", distance: 2.4 }] : PLANES).map((p) => (
        <g key={p.id}>
          <line x1={x(p.distance)} y1={36} x2={x(p.distance)} y2={160} stroke={p.id === "characters" || p.id === "flat" ? "#8ef0c3" : p.id === "foreground" ? "#5fe3ff" : "#b9c2cf"} strokeWidth={3} />
          <text x={x(p.distance) + 4} y={170} fontSize={9} fill="#b9c2cf" fontFamily="var(--font-ui)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
