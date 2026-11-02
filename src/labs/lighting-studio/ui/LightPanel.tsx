"use client";

import { SectionLabel, Segmented } from "@/ui/primitives";
import { studio } from "../config";
import { describeKelvin, kelvinToHex } from "../engine/color";
import { CHANNEL_IDS, LIMITS, type ChannelId, type LightId } from "../engine/types";
import { studioStore, useStudio } from "../store";
import { DomeDial } from "./DomeDial";
import { Slider } from "./Slider";
import { CHANNEL_NAMES, formatAzimuth, formatElevation, useEffective } from "./hooks";

const ROLES: Record<ChannelId, string> = {
  key: "Shapes the face",
  fill: "Opens the shadows",
  rim: "Separates the silhouette",
  ambient: "Sets the atmosphere",
};

function Row({ id }: { id: ChannelId }) {
  const selected = useStudio((s) => s.selected === id);
  const solo = useStudio((s) => s.solo);
  const rig = useStudio((s) => s.rig);
  const { analysis } = useEffective();
  const s = studioStore.getState;
  const isLight = id !== "ambient";
  const l = isLight ? rig.lights[id as LightId] : null;
  const muted = (solo !== null && solo !== id) || analysis.e[id] <= 0;
  return (
    <div className="ls-light-row" data-selected={selected} data-muted={muted} data-testid={`light-row-${id}`}>
      <button type="button" className="ls-light-select" aria-pressed={selected} onClick={() => s().select(id)}>
        <span className="ls-channel-dot" style={{ background: studio.ui[id] }} />
        <span><strong>{id === "ambient" ? "Environment" : CHANNEL_NAMES[id]}</strong><small>{ROLES[id]}</small></span>
      </button>
      <button type="button" className="ls-mini" aria-pressed={solo === id} aria-label={`Solo ${CHANNEL_NAMES[id]}`} title="See this light on its own (S)" data-testid={`solo-${id}`} onClick={() => s().toggleSolo(id)}>Solo</button>
      {l && <button type="button" className="ls-power" aria-pressed={l.on} aria-label={`${l.on ? "Turn off" : "Turn on"} ${CHANNEL_NAMES[id]}`} data-testid={`power-${id}`} onClick={() => s().setLight(id as LightId, { on: !l.on })}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2v7m-4-5a7 7 0 1 0 8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>}
    </div>
  );
}

function LightEditor({ id }: { id: LightId }) {
  const l = useStudio((s) => s.rig.lights[id]);
  const { fullAnalysis } = useEffective();
  const set = (p: Parameters<ReturnType<typeof studioStore.getState>["setLight"]>[1]) => studioStore.getState().setLight(id, p);
  const accent = studio.ui[id];
  return (
    <div className="ls-editor" data-testid="light-editor" data-light={id}>
      <div className="mb-1 flex items-baseline justify-between px-0.5">
        <span className="micro" style={{ color: accent }}>
          {CHANNEL_NAMES[id]} light
        </span>
        <span className="mono text-[10.5px] text-ink-2" title="Estimated illuminance from intensity divided by distance squared; beam, direction and surface shading are not measured.">
          {l.on ? `≈ ${fullAnalysis.e[id].toFixed(1)} lx` : "switched off"}
        </span>
      </div>
      <Slider label="Around" value={l.azimuthDeg} min={-180} max={180} step={1} accent={accent} onChange={(v) => set({ azimuthDeg: v })} format={formatAzimuth} testId="slider-azimuth" title="Azimuth: 0° = from the camera, ±90° = side, 180° = behind" />
      <Slider label="Height" value={l.elevationDeg} min={LIMITS.elevationDeg.min} max={LIMITS.elevationDeg.max} step={1} accent={accent} onChange={(v) => set({ elevationDeg: v })} format={formatElevation} testId="slider-elevation" title="Elevation above the lighting target" />
      <Slider label="Intensity" value={l.intensity} min={LIMITS.intensity.min} max={LIMITS.intensity.max} step={0.5} accent={accent} onChange={(v) => set({ intensity: v, on: v > 0 ? true : l.on })} format={(v) => `${Math.round(v)} cd`} testId="slider-intensity" />
      <Slider label="Colour" value={l.kelvin} min={LIMITS.kelvin.min} max={LIMITS.kelvin.max} step={50} accent={kelvinToHex(l.kelvin)} kelvin onChange={(v) => set({ kelvin: v })} format={(v) => `${Math.round(v / 50) * 50} K`} testId="slider-kelvin" title={describeKelvin(l.kelvin)} />
      <Slider label="Softness" value={l.softness} min={0} max={1} step={0.01} accent={accent} onChange={(v) => set({ softness: v })} format={(v) => v < 0.25 ? "Hard" : v < 0.6 ? "Medium" : "Soft"} testId="slider-softness" title="Approximates a larger source with shadow blur and a softer beam edge" />
      <details className="ls-disclosure" data-testid="light-advanced">
        <summary>Light shaping <span>Distance, beam & shadows</span></summary>
        <div className="ls-disclosure-content">
      <Slider label="Distance" value={l.distanceM} min={LIMITS.distanceM.min} max={LIMITS.distanceM.max} step={0.05} accent={accent} onChange={(v) => set({ distanceM: v })} format={(v) => `${v.toFixed(1)} m`} testId="slider-distance" title="Inverse-square: twice as far = a quarter of the light" />
      <Slider label="Beam" value={l.spreadDeg} min={LIMITS.spreadDeg.min} max={LIMITS.spreadDeg.max} step={1} accent={accent} onChange={(v) => set({ spreadDeg: v })} format={(v) => `${Math.round(v)}°`} testId="slider-spread" />
      <Slider label="Blinds" value={l.gobo} min={0} max={1} step={0.01} accent={accent} onChange={(v) => set({ gobo: v })} format={(v) => (v < 0.01 ? "none" : `${Math.round(v * 100)}%`)} testId="slider-gobo" title="A venetian-blind gobo (cookie) in front of the lamp" />
      <div className="mt-1.5 grid grid-cols-[78px_1fr] items-center gap-2">
        <span className="micro text-[9.5px]">Shadows</span>
        <Segmented
          label="Shadows"
          testId="shadows-toggle"
          value={l.shadows ? "on" : "off"}
          onChange={(v) => set({ shadows: v === "on" })}
          options={[
            { value: "on", label: "Cast" },
            { value: "off", label: "None" },
          ]}
        />
      </div>
        </div>
      </details>
    </div>
  );
}

function AmbientEditor() {
  const env = useStudio((s) => s.rig.env);
  const { fullAnalysis } = useEffective();
  const set = (p: Parameters<ReturnType<typeof studioStore.getState>["setEnv"]>[0]) => studioStore.getState().setEnv(p);
  const accent = studio.ui.ambient;
  return (
    <div data-testid="light-editor" data-light="ambient">
      <div className="mb-1 flex items-baseline justify-between px-0.5">
        <span className="micro" style={{ color: accent }}>
          Ambient &amp; set
        </span>
        <span className="mono text-[10.5px] text-ink-2">{fullAnalysis.e.ambient.toFixed(2)} lx bounce</span>
      </div>
      <Slider label="Ambient" value={env.ambient} min={0} max={LIMITS.ambient.max} step={0.01} accent={accent} onChange={(v) => set({ ambient: v })} format={(v) => v.toFixed(2)} testId="slider-ambient" title="Sky + floor bounce: lifts every shadow" />
      <Slider label="Backdrop" value={env.glowStrength} min={0} max={LIMITS.glowStrength.max} step={0.01} accent={env.glowColor} onChange={(v) => set({ glowStrength: v })} format={(v) => v.toFixed(2)} testId="slider-glow" title="Glow painted on the back of the sweep" />
      <Slider label="Saturation" value={env.saturation} min={0} max={LIMITS.saturation.max} step={0.01} accent={accent} onChange={(v) => set({ saturation: v })} format={(v) => `${Math.round(v * 100)}%`} testId="slider-saturation" />
      <Slider label="Exposure" value={env.exposure} min={LIMITS.exposure.min} max={LIMITS.exposure.max} step={0.01} accent={accent} onChange={(v) => set({ exposure: v })} format={(v) => `${Math.log2(v) >= 0 ? "+" : ""}${Math.log2(v).toFixed(1)} EV`} testId="slider-exposure" />
      <div className="mt-2 flex items-center gap-2 px-0.5">
        <span className="micro text-[9.5px]">Palette</span>
        {[env.skyColor, env.groundColor, env.cycColor, env.glowColor, env.glowTopColor].map((c, i) => (
          <span key={i} className="h-3.5 w-5 rounded-[3px] border border-white/15" style={{ background: c }} title={["Sky bounce", "Ground bounce", "Sweep", "Backdrop glow (low)", "Backdrop glow (high)"][i]} />
        ))}
      </div>
    </div>
  );
}

export function LightPanel() {
  const selected = useStudio((s) => s.selected);
  const presetId = useStudio((s) => s.presetId);
  const modified = useStudio((s) => s.modified);
  const solo = useStudio((s) => s.solo);
  return (
    <section id="lighting-controls" data-ui aria-label="Lights" className="ls-right" data-testid="light-panel">
      <div className="ls-panel-heading"><div><span className="ls-eyebrow">THE RIG</span><h2>Make it your own</h2></div><button type="button" className="ls-reset" disabled={!modified} onClick={() => studioStore.getState().applyPreset(presetId)} data-testid="reset-look" title="Restore this look’s original lights">Reset</button></div>
      <div role="group" aria-label="Select a light" className="ls-light-list">
        {CHANNEL_IDS.map((id) => <Row key={id} id={id} />)}
      </div>
      {solo && <button type="button" className="ls-solo-notice" onClick={() => studioStore.getState().toggleSolo(solo)}>Solo: {CHANNEL_NAMES[solo]} <span>Show all ×</span></button>}
      <div className="ls-editor-section">
        {selected === "ambient" ? <AmbientEditor /> : <LightEditor id={selected} />}
      </div>
      {selected !== "ambient" && <div className="ls-placement">
        <SectionLabel hint="drag a dot">Light placement</SectionLabel>
        <DomeDial />
        <p>Camera at the bottom. Move inward to raise a light.</p>
      </div>}
      <p className="ls-panel-footnote">A real-time study of light. Softness and bounce are approximations.</p>
    </section>
  );
}
