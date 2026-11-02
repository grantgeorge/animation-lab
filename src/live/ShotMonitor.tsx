"use client";

import { useCallback, useEffect, useState } from "react";
import { viewports } from "@/renderer/runtime/viewports";
import { useMeasurementText } from "@/renderer/runtime/measurementStore";
import { promptPhrase, formatMeters } from "@/engine/export/prompt";
import { labStore, useLab } from "@/ui/store/labStore";
import { PerspectiveGuide } from "./PerspectiveGuide";
import { copyShotPhrase } from "@/ui/export/exportShot";
import { saveShot } from "@/lessons/LessonEngine";

/** Callback ref that registers a DOM slot with the viewport registry. */
export function useSlot(id: "stage" | "shot") {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => (el ? viewports.register(id, el) : undefined), [el, id]);
  return useCallback((node: HTMLElement | null) => setEl(node), []);
}

/** The director's monitor: a transparent window the shot pass renders into, framed by a bezel ring. */
export function ShotMonitor() {
  const slot = useSlot("shot");
  const thirds = useLab((s) => s.viz.thirds);
  const safe = useLab((s) => s.viz.safeAreas);
  const tagL = useMeasurementText((m) => m, (m) => `${Math.round(m.focalMm)} mm · ${m.hfovDeg.toFixed(1)}° h`);
  const tagR = useMeasurementText((m) => m, (m) => `→ ${m.targetName} ${formatMeters(m.distanceM)} m · ${Math.round(m.subjectFraction * 100)}%`);
  return (
    <div className="monitor" data-testid="monitor">
      <div className="monitor-bezel" aria-hidden />
      <div ref={slot} className="monitor-window" data-testid="monitor-window" aria-label="Live shot from the film camera" role="img">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden>
          {thirds && (
            <g stroke="white" strokeOpacity="0.35" strokeWidth="0.25" vectorEffect="non-scaling-stroke">
              <line x1="53.33" y1="0" x2="53.33" y2="90" />
              <line x1="106.67" y1="0" x2="106.67" y2="90" />
              <line x1="0" y1="30" x2="160" y2="30" />
              <line x1="0" y1="60" x2="160" y2="60" />
            </g>
          )}
          {safe && (
            <g fill="none" stroke="white" strokeOpacity="0.45" strokeDasharray="1.5 1.5" strokeWidth="0.25">
              <rect x="8" y="4.5" width="144" height="81" />
              <rect x="16" y="9" width="128" height="72" />
            </g>
          )}
        </svg>
        <PerspectiveGuide />
        <span ref={tagL as React.RefObject<HTMLSpanElement>} className="mono pointer-events-none absolute left-2 top-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10.5px] text-focal-text" />
        <span ref={tagR as React.RefObject<HTMLSpanElement>} className="mono pointer-events-none absolute right-2 top-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10.5px] text-distance" />
      </div>
    </div>
  );
}

export function ShotPromptBar() {
  const phrase = useMeasurementText((m) => m, (m) => promptPhrase(m).phrase);
  return (
    <div className="lf-prompt" data-ui>
      <span className="lf-eyebrow">SHOT NOTES</span>
      <p ref={phrase as React.RefObject<HTMLParagraphElement>} data-testid="prompt-line" title="Shot language for storyboards and video prompts" />
      <button type="button" onClick={() => void copyShotPhrase()} data-testid="copy-prompt" title="Copy shot language (C)">Copy</button>
      <button type="button" onClick={() => saveShot()} data-testid="save-shot" title="Save this shot (S)">Save</button>
      <button type="button" onClick={() => labStore.getState().setExportOpen(true)} data-testid="open-export" title="Export shot settings (X)">Export</button>
    </div>
  );
}
