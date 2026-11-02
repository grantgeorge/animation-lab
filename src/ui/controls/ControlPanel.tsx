"use client";

import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { captureMatchRef, feasiblePresets } from "@/engine/matchFraming";
import type { TargetId } from "@/engine/types";
import { labStore, useLab, useLabShallow, type ViewKey } from "@/ui/store/labStore";
import { IconButton, SectionLabel, Segmented } from "@/ui/primitives";
import { FocalSlider, PresetRow } from "./FocalSlider";
import { DistanceSlider } from "./DistanceSlider";

/** In Match mode, Both is offered only when the rail can hold both characters at the current lens. */
function useTargetFeasibility(): Record<TargetId, { ok: boolean; reason?: string }> {
  const { rig, mode } = useLabShallow((s) => ({ rig: s.camera.rig, mode: s.camera.mode }));
  const ok = { ok: true };
  if (mode !== "match") return { primary: ok, secondary: ok, both: ok };
  const f = Math.round(rig.focalMm);
  const check = (t: TargetId) => {
    const ref = captureMatchRef(d, rig, t);
    const feas = feasiblePresets(d, t, { ...ref, metric: Math.min(ref.metric, 0.8) });
    const fMax = Math.max(0, ...d.focal.presets.filter((p) => feas[p]));
    return feas[f] === false || ref.metric > 1.0
      ? { ok: false, reason: `Not feasible on this rail at ${f} mm${fMax ? ` — try ≤ ${fMax} mm` : ""}` }
      : ok;
  };
  return { primary: ok, secondary: ok, both: check("both") };
}

const VIEW_TOGGLES: { key: ViewKey; label: string; hint: string; description: string }[] = [
  { key: "frustum", label: "Camera cone", hint: "F", description: "See the camera’s field of view in the studio" },
  { key: "grid", label: "Floor grid", hint: "G", description: "See spacing on the studio floor" },
  { key: "thirds", label: "Thirds", hint: "O", description: "Divide the camera frame into thirds" },
  { key: "safeAreas", label: "Safe areas", hint: "O", description: "Show action and title-safe margins" },
  { key: "perspectiveGuide", label: "Perspective", hint: "P", description: "Compare the face and background as the camera moves" },
];

export function ControlPanel() {
  const mode = useLab((s) => s.camera.mode);
  const target = useLab((s) => s.camera.targetId);
  const clampHint = useLab((s) => s.camera.clampHint);
  const viz = useLab((s) => s.viz);
  const feas = useTargetFeasibility();
  return (
    <section data-ui aria-label="Camera controls" className="lf-controls" data-testid="camera-controls">
      <div className="lf-panel-heading">
        <div><span className="lf-eyebrow">THE CAMERA</span><h2>Compose the shot</h2></div>
        <button type="button" className="lf-reset" onClick={() => labStore.getState().resetCamera()} data-testid="reset-camera" title="Restore the starting lens, distance and target">Reset</button>
      </div>
      <div className="lf-control-section">
        <SectionLabel hint="1–6 · [ ]">Focal length</SectionLabel>
        <FocalSlider />
        <PresetRow />
        <p className="lf-control-note">A wider lens sees more. A longer lens fills the frame with less of the scene.</p>
      </div>
      <div className="lf-control-section">
        <SectionLabel hint="M">Camera behaviour</SectionLabel>
        <Segmented
          label="Camera behaviour"
          testId="mode-toggle"
          value={mode}
          onChange={(m) => labStore.getState().setMode(m)}
          options={[
            { value: "fixed", label: "Fixed camera", testId: "mode-fixed", title: "Camera stays put; the lens only changes the crop" },
            { value: "match", label: "Match framing", testId: "mode-match", title: "Camera dollies to keep the subject the same size" },
          ]}
        />
        <p className="lf-control-note" data-testid="mode-explanation">
          {mode === "fixed" ? "The camera stays put. Change the lens to change what fits in the frame." : "The camera moves as you change the lens, keeping the target the same size."}
        </p>
        {clampHint && <p className="lf-clamp-hint" data-testid="clamp-hint">{clampHint === "both" ? "Rail end: both characters cannot fit at this lens." : clampHint === "min" ? "Rail end: the camera cannot move closer." : "Rail end: the camera cannot move farther back."}</p>}
      </div>
      <div className="lf-control-section">
        <SectionLabel hint="T">Framing target</SectionLabel>
        <Segmented
          label="Framing target"
          testId="target-picker"
          value={target}
          onChange={(t) => labStore.getState().setTarget(t)}
          options={[
            { value: "primary", label: "Bram", testId: "target-primary" },
            { value: "secondary", label: "Pip", testId: "target-secondary" },
            { value: "both", label: "Both", testId: "target-both", disabled: !feas.both.ok && target !== "both", title: feas.both.reason },
          ]}
        />
      </div>
      <div className="lf-control-section">
        <SectionLabel>Dolly distance</SectionLabel>
        <DistanceSlider />
        <p className="lf-control-note" id="dolly-explanation">{mode === "match" ? "Distance follows the lens in Match framing. Switch to Fixed camera to move it yourself." : "Move closer or farther away. This changes the size relationship between foreground and background."}</p>
      </div>
      <details className="lf-guides" data-testid="composition-guides">
        <summary>Composition guides <span>Framing &amp; studio overlays</span></summary>
        <div className="lf-guide-options">
          {VIEW_TOGGLES.map((t) => <IconButton key={t.key} label={`${t.description} (${t.hint})`} active={viz[t.key]} onClick={() => labStore.getState().toggleViz(t.key)} testId={`toggle-${t.key}`}><span>{t.label}</span></IconButton>)}
        </div>
      </details>
      <p className="lf-controls-footnote">Perspective comes from camera position. The lens determines how much of it you see.</p>
    </section>
  );
}
