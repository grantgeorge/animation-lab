"use client";

import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { useEffect, useRef } from "react";
import { measurementStore, useMeasurementText } from "@/renderer/runtime/measurementStore";
import { labStore, useLab } from "@/ui/store/labStore";

/** Read per call: the active scene decides the loop length. */
const dur = () => d.timeline.durationS;

/** A native range supplies pointer and keyboard scrubbing. Display values follow the clock outside React. */
export function TimelineBar() {
  const playing = useLab((s) => s.timeline.playing);
  const time = useMeasurementText((m) => m.timeS, (t) => `${t.toFixed(2).padStart(5, "0")} s`);
  const input = useRef<HTMLInputElement>(null);
  const playhead = useRef<HTMLSpanElement>(null);
  useEffect(() => measurementStore.subscribe(
    (st) => st.m.timeS,
    (t) => {
      if (input.current) {
        input.current.value = String(t);
        input.current.setAttribute("aria-valuetext", `${t.toFixed(2)} seconds of ${dur()} seconds`);
      }
      if (playhead.current) playhead.current.style.left = `${(t / dur()) * 100}%`;
    },
    { fireImmediately: true },
  ), []);
  const pause = () => {
    const s = labStore.getState();
    if (s.timeline.playing) s.pause();
  };
  return (
    <div data-ui className="lf-timeline" data-testid="timeline">
      <button type="button" onClick={() => labStore.getState().togglePlay()} aria-label={playing ? "Pause (Space)" : "Play (Space)"} data-testid="play-toggle" className="lf-play-button">
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="2" y="1.5" width="3" height="9" fill="currentColor" /><rect x="7" y="1.5" width="3" height="9" fill="currentColor" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor" /></svg>
        )}
      </button>
      <button type="button" onClick={() => labStore.getState().restart()} aria-label="Restart (Home)" className="lf-restart-button">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="1.5" y="1.5" width="1.6" height="9" fill="currentColor" /><path d="M10.5 1.5 L4 6 L10.5 10.5 Z" fill="currentColor" /></svg>
      </button>
      <div className="lf-scrubber relative h-8 flex-1 rounded-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-distance)]">
        <div className="pointer-events-none absolute inset-x-0 top-[15px] h-[2px] bg-white/12" aria-hidden />
        {Array.from({ length: dur() * 2 + 1 }, (_, k) => <div key={k} className="pointer-events-none absolute top-[19px] w-px bg-white/25" style={{ left: `${(k / (dur() * 2)) * 100}%`, height: k % 2 ? 3 : 6 }} aria-hidden />)}
        {d.timeline.markers.map(([t, label]) => <div key={label} className="pointer-events-none absolute top-[10px] -translate-x-1/2 text-[8px] text-subject" style={{ left: `${(t / dur()) * 100}%` }} title={`${label} · ${t.toFixed(2)} s`} aria-hidden>◆</div>)}
        <span ref={playhead} className="lf-playhead pointer-events-none absolute top-[8px] h-[16px] w-[2px] -translate-x-1/2 bg-[var(--color-focal)]" aria-hidden />
        <input
          ref={input}
          type="range"
          min={0}
          max={dur() - 1 / d.timeline.fps}
          step={1 / d.timeline.fps}
          defaultValue={0}
          aria-label="Performance time"
          aria-valuetext={`0 seconds of ${dur()} seconds`}
          data-testid="scrubber"
          className="lf-timeline-input absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
          onPointerDown={pause}
          onChange={(e) => { pause(); labStore.getState().seek(Number(e.target.value)); }}
          onKeyDown={(e) => {
            // Native arrows, Home and End belong to the timeline, not the camera shortcuts.
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) e.stopPropagation();
          }}
        />
      </div>
      <span ref={time as React.RefObject<HTMLSpanElement>} className="lf-time-readout mono" data-testid="time-readout" />
      <span className="lf-duration mono">/ {dur().toFixed(0)} s</span>
    </div>
  );
}
