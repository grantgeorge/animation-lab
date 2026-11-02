"use client";

import { IconButton, Segmented } from "@/ui/primitives";
import { studio, type ShotSize } from "../config";
import { live } from "../scene/bus";
import { studioStore, useStudio } from "../store";
import { FrameHint } from "./Overlays";

export function ViewBar() {
  const view = useStudio((s) => s.view);
  const shot = useStudio((s) => s.shotSize);
  const playing = useStudio((s) => s.playing);
  const s = studioStore.getState;
  return (
    <div className="ls-viewbar" data-ui>
    <div className="flex items-center gap-2" data-testid="view-bar">
      <div className="w-[180px]">
        <Segmented
          label="Main view"
          testId="view-toggle"
          value={view}
          onChange={(v) => s().setView(v)}
          options={[
            { value: "shot", label: "Camera", testId: "view-shot", title: "The camera's picture (V)" },
            { value: "inspect", label: "Studio", testId: "view-inspect", title: "Orbit the studio and drag the lamps (V)" },
          ]}
        />
      </div>
      <select
        aria-label="Shot size"
        data-testid="shot-size"
        value={shot}
        onChange={(e) => s().setShotSize(e.target.value as ShotSize)}
        className="mono h-8 rounded-[10px] bg-white/[0.07] px-1.5 text-[11px] text-ink-0 outline-none hover:bg-white/15"
      >
        {(Object.keys(studio.shots) as ShotSize[]).map((k) => (
          <option key={k} value={k} className="bg-[#101526]">
            {studio.shots[k].label}
          </option>
        ))}
      </select>
      <IconButton label={playing ? "Pause Bram (Space)" : "Play Bram (Space)"} onClick={() => s().setPlaying(!playing)} testId="play-toggle">
        {playing ? (
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
            <rect x="0" y="0" width="3.5" height="12" fill="currentColor" />
            <rect x="6.5" y="0" width="3.5" height="12" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
            <path d="M0 0 L10 6 L0 12 Z" fill="currentColor" />
          </svg>
        )}
      </IconButton>
    </div>
    <FrameHint />
    </div>
  );
}

export function Pip() {
  const view = useStudio((s) => s.view);
  return (
    <div
      className="ls-pip"
      ref={(el) => {
        live.pipEl = el;
      }}
      data-testid="pip"
      data-ui
    >
      <span className="ls-pip-label">{view === "shot" ? "Studio view" : "Camera view"}<span>↗</span></span>
      <button type="button" className="ls-pip-button" aria-label={view === "shot" ? "Swap: make the inspect view main (V)" : "Swap: make the shot main (V)"} onClick={() => studioStore.getState().setView(view === "shot" ? "inspect" : "shot")} data-testid="pip-swap" />
    </div>
  );
}
