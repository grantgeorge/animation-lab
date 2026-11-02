"use client";

import { COUNT_RANGE, LIMITS, TREATMENTS, type Phys, type Treatment } from "../engine/beat";
import { STEPS, STEP_WORD } from "../engine/timing";
import { CATEGORY_CONTROL, TREATMENT_INFO } from "../content";
import { capCount, runtime } from "../runtime/Orchestrator";
import { vxStore, useVX, type CatState } from "../store";
import type { CategoryId } from "../engine/prompt";

export function Slider({ label, value, min, max, step, fmt, onChange, testId, affects, note }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; testId: string; affects?: Treatment[]; note?: string }) {
  return (
    <label className="vx-slider" title={note}>
      <span className="vx-slider-head">
        <span>{label}</span>
        {affects && (
          <span className="vx-affects" aria-label={`Affects ${affects.map((a) => TREATMENT_INFO[a].short).join(", ")}`}>
            {affects.map((a) => (
              <i key={a} style={{ background: TREATMENT_INFO[a].color }} />
            ))}
          </span>
        )}
        <b className="mono" data-testid={`${testId}-value`}>{fmt(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} data-testid={testId} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Seg<T extends string | number>({ options, value, onChange, label, testId, render }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string; testId: string; render: (v: T) => string }) {
  return (
    <div className="vx-seg" role="radiogroup" aria-label={label} data-testid={testId} style={{ "--n": options.length } as React.CSSProperties}>
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={o === value} data-testid={`${testId}-${o}`} onClick={() => onChange(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <label className="vx-switch">
      <span>{label}</span>
      <span className="vx-toggle">
        <input type="checkbox" checked={checked} data-testid={testId} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </label>
  );
}

const ALL: Treatment[] = ["real", "cartoon", "drawn"];

export function PhysicsControls() {
  const p = useVX((s) => s.phys);
  const set = (patch: Partial<Phys>) => vxStore.getState().setPhys(patch);
  const cap = COUNT_RANGE[runtime.tier];
  return (
    <section className="vx-section" data-testid="physics-controls">
      <div className="vx-section-head">
        <span className="vx-eyebrow">THE WATER</span>
        <span className="vx-legend">
          {TREATMENTS.map((t) => (
            <span key={t}>
              <i style={{ background: TREATMENT_INFO[t].color }} /> {TREATMENT_INFO[t].short}
            </span>
          ))}
        </span>
      </div>
      <Slider label="Gravity" value={p.gravity} min={LIMITS.gravity[0]} max={LIMITS.gravity[1]} step={0.05} fmt={(v) => `${v.toFixed(2)} g`} onChange={(v) => set({ gravity: v })} testId="gravity" affects={ALL} note="Realistic: the solver's gravity. Stylized: arc durations scale with 1/√g." />
      <Slider label="Viscosity" value={p.viscosity} min={0} max={1} step={0.05} fmt={(v) => (v < 0.15 ? "water" : v < 0.5 ? "thick" : v < 0.8 ? "syrup" : "honey")} onChange={(v) => set({ viscosity: v })} testId="viscosity" affects={ALL} />
      <Slider label="Kick & splash intensity" value={p.intensity} min={LIMITS.intensity[0]} max={LIMITS.intensity[1]} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ intensity: v })} testId="intensity" affects={ALL} note="Pip kicks harder and the splash grows with it: the effect reacts to the character." />
      <Slider label="Particle count" value={Math.min(p.count, cap)} min={COUNT_RANGE.min} max={cap} step={100} fmt={(v) => `${Math.round(capCount(v, runtime.tier)).toLocaleString("en-US")}`} onChange={(v) => set({ count: v })} testId="count" affects={ALL} note="Realistic droplets (capped by quality); the stylized treatments draw more or fewer drops." />
      <Slider label="Turbulence" value={p.turbulence} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ turbulence: v })} testId="turbulence" affects={ALL} note="Realistic: a curl-noise force. Cartoon: wobble. Hand-drawn: line boil." />
      <Slider label="Stylization" value={p.stylization} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ stylization: v })} testId="stylization" affects={ALL} note="Realistic: an art-directed retime around the impact. Cartoon: exaggeration. Hand-drawn: bolder, fewer shapes." />
    </section>
  );
}

export function TimingControls() {
  const tr = useVX((s) => s.treatment);
  const tm = useVX((s) => s.timing[tr]);
  const charSteps = useVX((s) => s.charSteps);
  const set = vxStore.getState().setTiming;
  return (
    <section className="vx-section" data-testid="timing-controls">
      <div className="vx-section-head">
        <span className="vx-eyebrow">TIMING · {TREATMENT_INFO[tr].label.toUpperCase()}</span>
        <i className="vx-dot" style={{ background: TREATMENT_INFO[tr].color }} />
      </div>
      <Seg options={STEPS} value={tm.step} onChange={(v) => set({ step: v })} label="Frames per drawing" testId="step" render={(v) => STEP_WORD[v]} />
      <Slider label="Hold on the peak" value={tm.hold} min={LIMITS.hold[0]} max={LIMITS.hold[1]} step={1} fmt={(v) => `${v} f · ${(v / 24).toFixed(2)} s`} onChange={(v) => set({ hold: v })} testId="hold" note={tr === "real" ? "On a sim this is a freeze frame." : "A moving hold: the shape keeps drifting a few percent."} />
      <Slider label="Anticipation" value={tm.antic} min={LIMITS.antic[0]} max={LIMITS.antic[1]} step={1} fmt={(v) => `${v} f`} onChange={(v) => set({ antic: v })} testId="antic" note={tr === "real" ? "The bucket teeters before it goes over." : "The bucket rears back while the water bulges over the lip."} />
      {tr === "drawn" && <Toggle label="Pip steps with the drawings" checked={charSteps} onChange={(v) => vxStore.getState().set({ charSteps: v })} testId="char-steps" />}
      <p className="vx-note">Timing applies to the selected treatment. Click a view or press 1 · 2 · 3 to choose it.</p>
    </section>
  );
}

export function SyncControls() {
  const offset = useVX((s) => s.offset);
  const set = vxStore.getState().setOffset;
  return (
    <section className="vx-section" data-testid="sync-controls">
      <span className="vx-eyebrow">PIP&apos;S FLINCH AGAINST THE SPLASH</span>
      <Slider label="Flinch after the water lands" value={offset} min={LIMITS.offset[0]} max={LIMITS.offset[1]} step={1} fmt={(v) => `${v > 0 ? "+" : ""}${v} f`} onChange={set} testId="offset" />
      <div className="vx-chips">
        {[
          [-4, "Early −4"],
          [2, "In sync +2"],
          [6, "Late +6"],
          [12, "Disconnected +12"],
        ].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={offset === v} data-testid={`offset-${v}`} onClick={() => set(v as number)}>
            {l}
          </button>
        ))}
      </div>
      <p className="vx-note">Frames between the water hitting the deck and Pip&apos;s flinch. The take on the left flinches +2 f. Negative means he flinches before the water lands.</p>
    </section>
  );
}

export function CategoryControls({ id }: { id: CategoryId }) {
  const st = useVX((s) => s.cats[id]);
  const split = useVX((s) => s.catCompare);
  const set = (p: Partial<CatState>) => vxStore.getState().setCat(id, p);
  return (
    <div className="vx-cat-controls" data-testid="category-controls">
      <div className="vx-cat-col">
        <span className="vx-eyebrow">LOOK</span>
        <Seg options={["real", "stylized"] as const} value={st.look} onChange={(v) => set({ look: v })} label="Look" testId="look" render={(v) => (v === "real" ? "Realistic" : "Stylized")} />
      </div>
      <div className="vx-cat-col">
        <span className="vx-eyebrow">MOTION</span>
        <Seg options={["sim", "keyed"] as const} value={st.motion} onChange={(v) => set({ motion: v })} label="Motion" testId="motion" render={(v) => (v === "sim" ? "Simulated" : "Keyframed")} />
      </div>
      <div className="vx-cat-col vx-cat-slider">
        <Slider label={CATEGORY_CONTROL[id]} value={st.value} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ value: v })} testId="cat-value" />
      </div>
      <button type="button" className={`vx-pill${split ? " vx-pill-on" : ""}`} aria-pressed={split} data-testid="split-toggle" onClick={() => vxStore.getState().set({ catCompare: !split })}>
        Side by side
      </button>
    </div>
  );
}

export function TreatmentBar() {
  const tr = useVX((s) => s.treatment);
  const compare = useVX((s) => s.compare);
  return (
    <div className="vx-treatments" data-testid="treatment-bar">
      <div className="vx-seg vx-seg-tr" role="radiogroup" aria-label="Treatment" style={{ "--n": 3 } as React.CSSProperties}>
        {TREATMENTS.map((t, i) => (
          <button key={t} type="button" role="radio" aria-checked={t === tr} data-testid={`treatment-${t}`} onClick={() => vxStore.getState().setTreatment(t)} style={{ "--c": TREATMENT_INFO[t].color } as React.CSSProperties}>
            <i className="mono">{i + 1}</i>
            {TREATMENT_INFO[t].label}
          </button>
        ))}
      </div>
      <button type="button" className={`vx-pill${compare ? " vx-pill-on" : ""}`} aria-pressed={compare} data-testid="compare-toggle" onClick={() => vxStore.getState().setCompare(!compare)}>
        Compare side by side
      </button>
    </div>
  );
}
