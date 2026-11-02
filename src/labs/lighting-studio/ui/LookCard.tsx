"use client";

import { studio } from "../config";
import { TAKE_APART_STEPS, getPreset, type PresetId } from "../engine/presets";
import type { ChannelId } from "../engine/types";
import { studioStore, useStudio } from "../store";
import { CHANNEL_NAMES, placementText } from "./hooks";

const STUDIES: Record<PresetId, { note: string; task: string; light: ChannelId; label: string }> = {
  "three-point": { note: "The key shapes the face. The fill opens the shadows. The rim draws an edge against the dark.", task: "Lower the fill intensity. Watch the shadow side of the face deepen.", light: "fill", label: "Adjust fill" },
  flat: { note: "Light close to the camera and generous fill keep the face readable. Colour carries the mood.", task: "Move the key to the side. Notice when the face starts to feel more dimensional.", light: "key", label: "Move key" },
  storybook: { note: "A warm key and gentle fill create a welcoming face. A cool edge keeps it distinct from the background.", task: "Cool the key from 3000 K toward 6500 K. Does the scene still feel cosy?", light: "key", label: "Adjust colour" },
  dramatic: { note: "A side key leaves the face in shadow. A bright, cool rim gives the silhouette definition.", task: "Raise the fill intensity. Watch the tension soften as the other cheek emerges.", light: "fill", label: "Adjust fill" },
  noir: { note: "A hard key through blinds breaks the face into light and dark. Almost no fill keeps the mystery.", task: "Open Light shaping and lower Blinds. See how the pattern changes the story.", light: "key", label: "Shape key" },
  sunset: { note: "A low, warm backlight outlines the figure. Cool light from the front suggests the evening sky.", task: "Move the key from behind to the side. Watch the glowing outline become a lit face.", light: "key", label: "Move key" },
};

const ROLES: Record<ChannelId, string> = {
  key: "The main light establishes the direction and the shape of the shadows.",
  fill: "The fill lifts the shadows without changing the key’s direction. Compare the darker cheek.",
  rim: "The rim adds an edge from behind. Look at the hat and shoulders against the background.",
  ambient: "The environment adds broad illumination, backdrop colour and the final grade.",
};

export function LookCard() {
  const presetId = useStudio((s) => s.presetId);
  const modified = useStudio((s) => s.modified);
  const step = useStudio((s) => s.takeApart);
  const rig = useStudio((s) => s.rig);
  const p = getPreset(presetId)!;
  const study = STUDIES[presetId];
  const s = studioStore.getState;
  const channel = step === null ? null : TAKE_APART_STEPS[step].adds;
  return (
    <section className="ls-look" aria-label="Current look" data-testid="look-card">
      <div className="ls-look-heading">
        <span className="ls-eyebrow">{step === null ? "LIGHT STUDY" : `BUILD THE LOOK · ${(step ?? 0) + 1} / 4`}</span>
        <h2 data-testid="look-title">{p.name}{modified && <span className="ls-edited">Edited</span>}</h2>
        {step === null ? (
          <button type="button" className="ls-breakdown" onClick={() => s().setTakeApart(0)} data-testid="take-apart-open">Break down the lights <span>↗</span></button>
        ) : (
          <button type="button" className="ls-breakdown" onClick={() => s().setTakeApart(null)} data-testid="take-apart-close">Back to full look <span>×</span></button>
        )}
      </div>
      {step === null ? <>
        <p className="ls-look-note" data-testid="look-note">{modified ? "You’re shaping a variation. Notice how direction, shadow depth and colour change the feeling of the same performance." : study.note}</p>
        <div className="ls-exercise"><span className="ls-eyebrow">TRY THIS</span><p>{study.task}</p><button type="button" aria-controls="lighting-controls" onClick={() => {
          s().select(study.light);
          if (window.matchMedia("(max-width: 900px)").matches) {
            requestAnimationFrame(() => document.getElementById("lighting-controls")?.scrollIntoView({ block: "start", behavior: s().reducedMotion ? "instant" : "smooth" }));
          }
        }}>{study.label} <span>→</span></button></div>
      </> : channel && (
        <div className="ls-breakdown-content" data-testid="take-apart">
          <div className="ls-stepper" role="group" aria-label="Take-apart steps">
            {TAKE_APART_STEPS.map((st, i) => <button key={st.label} type="button" aria-pressed={i === step} data-testid={`step-${i}`} onClick={() => s().setTakeApart(i)}><span>{i + 1}</span>{st.label}</button>)}
          </div>
          <div className="ls-step-detail" data-testid="take-apart-detail" data-channel={channel}>
            <span className="ls-channel-dot" style={{ background: studio.ui[channel] }} />
            <p>{modified ? ROLES[channel] : p.roles[channel]}</p>
            <div className="ls-step-arrows">
              <button type="button" className="ls-mini" disabled={step === 0} onClick={() => s().setTakeApart(step - 1)} data-testid="step-prev" aria-label="Previous step">←</button>
              <button type="button" className="ls-mini" disabled={step === 3} onClick={() => s().setTakeApart(step + 1)} data-testid="step-next" aria-label="Next step">→</button>
            </div>
          </div>
          <p className="ls-step-position">{channel === "ambient" ? "Full rig + environment" : `${CHANNEL_NAMES[channel]}: ${rig.lights[channel].on ? placementText(rig.lights[channel].azimuthDeg, rig.lights[channel].elevationDeg, rig.lights[channel].distanceM) : "off in this look"}`}</p>
        </div>
      )}
    </section>
  );
}
