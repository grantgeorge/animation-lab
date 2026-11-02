"use client";

import { useEffect, useState } from "react";
import { useMeasurementText, measurementStore } from "@/renderer/runtime/measurementStore";
import type { Measurements } from "@/engine/measure";
import { conceptFor } from "@/lessons/copy";
import { labStore, useLab } from "@/ui/store/labStore";
import { SceneLede } from "@/ui/controls/ScenePicker";
import { formatMeters } from "@/engine/export/prompt";

export function ReadoutChips() {
  const focal = useMeasurementText((m) => m, (m) => `${Math.round(m.focalMm)} mm · ${m.hfovDeg.toFixed(1)}°`);
  const dist = useMeasurementText((m) => m, (m) => `${formatMeters(m.distanceM)} m`);
  const distLabel = useMeasurementText((m) => m.targetName, (n) => `Distance to ${n}`);
  const subj = useMeasurementText((m) => m, (m) => `${Math.round(m.subjectFraction * 100)}% ht · ${m.shotSize}`);
  const subjLabel = useMeasurementText((m) => m, (m) => m.targetId === "both" ? "Both · fit" : `${m.targetName} · ${m.targetId === "primary" ? "head & shoulders" : "full height"}`);
  return (
    <div className="lf-readouts" data-ui aria-label="Camera measurements">
      <span data-testid="chip-focal"><i />Lens <b ref={focal as React.RefObject<HTMLSpanElement>} /></span>
      <span data-testid="chip-distance"><span ref={distLabel as React.RefObject<HTMLSpanElement>} /><b ref={dist as React.RefObject<HTMLSpanElement>} /></span>
      <span data-testid="chip-subject" title="Framing box height as a percentage of the image. Shot-size abbreviation uses the full body."><span ref={subjLabel as React.RefObject<HTMLSpanElement>} /><b ref={subj as React.RefObject<HTMLSpanElement>} /></span>
    </div>
  );
}

/**
 * Snapshot of the measurements for prose that must not flicker: refreshed when a camera-relevant value
 * changes (never because the animation clock ticked), throttled to `ms`.
 */
export function useMeasurementSnapshot(ms = 200): Measurements {
  const [m, setM] = useState(() => measurementStore.getState().m);
  useEffect(() => {
    let timer: number | null = null;
    const key = (x: Measurements) =>
      [Math.round(x.focalMm), x.targetId, x.distanceM.toFixed(2), x.shotSize, x.lensClass].join("|");
    const unsubscribe = measurementStore.subscribe(
      (s) => key(s.m),
      () => {
        if (timer !== null) return;
        timer = window.setTimeout(() => {
          timer = null;
          setM(measurementStore.getState().m);
        }, ms);
      },
    );
    return () => { unsubscribe(); if (timer !== null) window.clearTimeout(timer); };
  }, [ms]);
  return m;
}

export function ConceptPanel() {
  const mode = useLab((s) => s.camera.mode);
  const m = useMeasurementSnapshot(200);
  const c = conceptFor(mode, m);
  return (
    <section className="lf-study" data-ui data-testid="concept-panel" aria-label="Lens study">
      <div className="lf-study-heading"><span className="lf-eyebrow">{mode === "match" ? "MATCHED FRAMING" : "FIXED CAMERA"}</span><h2 data-testid="concept-title">{c.title}</h2></div>
      <p className="lf-study-body">{c.body}</p>
      <div className="lf-experiment"><span className="lf-eyebrow">TRY THIS</span><SceneLede /><button type="button" onClick={() => labStore.getState().setMode(mode === "fixed" ? "match" : "fixed")} data-testid="try-mode">{mode === "fixed" ? "Try Match framing" : "Compare with Fixed"} <span>→</span></button></div>
    </section>
  );
}
