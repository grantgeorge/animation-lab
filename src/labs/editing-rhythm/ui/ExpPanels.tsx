"use client";

import { stats } from "../engine/edit";
import { COMEDY_PRESETS, COMEDY_RANGE, JL_RANGE, KULE_CHOICES, KULE_INSERTS, KULE_LABEL, MONTAGE_LABEL, comedyBeats, compression, continuityCams, eyelines, montageEdit, type ComedyGaps, type ComedyPreset, type MontageStyle } from "../engine/experiments";
import { SHOTS } from "../engine/shots";
import { erStore, useER } from "../store";
import { AxisDiagram } from "./AxisDiagram";

function Seg<T extends string>({ value, options, onChange, testid, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; testid: string; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="er-seg" data-testid={testid}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} data-testid={`${testid}-${o.id}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step = 0.1, onChange, testid, unit = "s", format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; testid: string; unit?: string; format?: (v: number) => string }) {
  return (
    <label className="er-slider">
      <span>
        {label}
        <b className="mono">{format ? format(value) : `${value.toFixed(1)}${unit}`}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} data-testid={testid} onChange={(e) => onChange(Number(e.target.value))} className="er-range" />
    </label>
  );
}

export function PacingPanel() {
  const tempo = useER((s) => s.tempo);
  const edit = useER((s) => s.edit);
  const st = stats(edit);
  return (
    <div className="er-exp-panel" data-testid="panel-pacing">
      <Slider label="Tempo (every shot)" value={tempo} min={0.5} max={1.6} step={0.05} testid="tempo-slider" format={(v) => `×${v.toFixed(2)}`} onChange={(v) => erStore.getState().setTempo(v)} />
      <p className="er-note">
        Same shots, same order: only the holds change. Average shot {st.asl.toFixed(1)} s, {(st.cuts / Math.max(0.1, st.runtime) * 60).toFixed(0)} cuts a minute.
      </p>
    </div>
  );
}

export function KuleshovPanel() {
  const ins = useER((s) => s.kuleInsert);
  const answers = useER((s) => s.kuleAnswers);
  return (
    <div className="er-exp-panel" data-testid="panel-kuleshov">
      <span className="er-rowlabel">The shot between the two close-ups</span>
      <Seg label="Insert" testid="kule-insert" value={ins} options={KULE_INSERTS.map((id) => ({ id, label: KULE_LABEL[id].replace(/^(the|a) /, "") }))} onChange={(v) => erStore.getState().setKule(v)} />
      <p className="er-prompt">Your reading: what do you see on Bram&rsquo;s face?</p>
      <div className="er-chips" data-testid="kule-answers">
        {KULE_CHOICES.map((a) => (
          <button key={a} type="button" aria-pressed={answers[ins] === a} data-testid={`kule-answer-${a.toLowerCase()}`} onClick={() => erStore.getState().answerKule(ins, a)}>
            {a}
          </button>
        ))}
      </div>
      <p className="er-note" data-testid="kule-same">
        {Object.keys(answers).length >= 2 ? `You answered ${Object.entries(answers).map(([k, v]) => `${v.toLowerCase()} (${KULE_LABEL[k as keyof typeof KULE_LABEL].replace(/^(the|a) /, "")})`).join(", ")}. The face was identical every time.` : "Both close-ups are the identical frames. Try all three inserts."}
      </p>
    </div>
  );
}

export function ReactionPanel() {
  const order = useER((s) => s.reactionOrder);
  return (
    <div className="er-exp-panel" data-testid="panel-reaction">
      <Seg label="Reaction placement" testid="reaction-order" value={order} options={[{ id: "before", label: "Reaction before the event" }, { id: "after", label: "Reaction after the event" }]} onChange={(v) => erStore.getState().setReactionOrder(v)} />
    </div>
  );
}

export function ContinuityPanel() {
  const flipped = useER((s) => s.flipped);
  const r = eyelines(SHOTS.hesitate.cam, continuityCams(flipped).reaction ?? SHOTS.reaction.cam);
  return (
    <div className="er-exp-panel er-exp-continuity" data-testid="panel-continuity" data-matched={r.matched ? "1" : "0"} data-crossed={r.crossed ? "1" : "0"}>
      <div>
        <button type="button" className={`er-toggle${flipped ? " er-toggle-on" : ""}`} aria-pressed={flipped} data-testid="flip-camera" onClick={() => erStore.getState().setFlipped(!flipped)}>
          {flipped ? "Put camera 3 back" : "Flip camera 3 across the line"}
        </button>
        <div className="er-eyelines mono" data-testid="eyelines">
          <span>
            Pip looks <b>{r.pipLooks === "left" ? "←" : "→"}</b>
          </span>
          <span>
            Bram looks <b>{r.bramLooks === "left" ? "←" : "→"}</b>
          </span>
          <span className={r.matched ? "er-ok" : "er-bad"}>{r.matched ? "✓ eyelines meet" : "✗ same direction"}</span>
        </div>
      </div>
      <AxisDiagram overrides={continuityCams(flipped)} highlight={["hesitate", "reaction"]} testid="continuity-axis" bounds={[-1.5, 1.4, -4.7, -1.8]} />
    </div>
  );
}

export function JLPanel() {
  const lead = useER((s) => s.jlLead);
  return (
    <div className="er-exp-panel" data-testid="panel-jl">
      <Slider label={lead > 0.05 ? "J-cut: sound leads picture" : lead < -0.05 ? "L-cut: sound follows picture" : "Straight cut"} value={lead} min={JL_RANGE.min} max={JL_RANGE.max} step={0.1} testid="jl-slider" format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}s`} onChange={(v) => erStore.getState().setJl(v)} />
      <div className="er-scale mono">
        <span>◂ L-cut</span>
        <span>straight</span>
        <span>J-cut ▸</span>
      </div>
    </div>
  );
}

export function MontagePanel() {
  const m = useER((s) => s.montage);
  const c = compression(montageEdit(m));
  return (
    <div className="er-exp-panel" data-testid="panel-montage" data-ratio={c.ratio}>
      <Seg label="Montage style" testid="montage-style" value={m} options={(Object.keys(MONTAGE_LABEL) as MontageStyle[]).map((id) => ({ id, label: MONTAGE_LABEL[id] }))} onChange={(v) => erStore.getState().setMontage(v)} />
      <div className="er-compress mono" data-testid="compression">
        <span>
          story <b>{c.story.toFixed(0)}s</b>
        </span>
        <span>→</span>
        <span>
          screen <b>{c.screen.toFixed(0)}s</b>
        </span>
        <span className="er-ratio">{c.ratio.toFixed(1)}×</span>
      </div>
    </div>
  );
}

const GAP_LABEL: Record<keyof ComedyGaps, string> = { setup: "Setup (strut)", anticipation: "Anticipation (peel first)", hold: "Hold (stare at us)", aftermath: "Aftermath pause" };

export function ComedyPanel() {
  const g = useER((s) => s.comedy);
  const p = useER((s) => s.comedyPreset);
  const b = comedyBeats(g);
  return (
    <div className="er-exp-panel er-exp-comedy" data-testid="panel-comedy" data-step={b.step} data-fall={b.fall} data-reaction={b.reaction}>
      <div className="er-chips er-chips-wide" role="radiogroup" aria-label="Comedy variant" data-testid="comedy-presets">
        {(Object.keys(COMEDY_PRESETS) as ComedyPreset[]).map((id) => (
          <button key={id} type="button" role="radio" aria-checked={p === id} data-testid={`comedy-${id}`} onClick={() => erStore.getState().setComedyPreset(id)}>
            {COMEDY_PRESETS[id].label}
          </button>
        ))}
      </div>
      <div className="er-gaps">
        {(Object.keys(GAP_LABEL) as (keyof ComedyGaps)[]).map((k) => (
          <Slider key={k} label={GAP_LABEL[k]} value={g[k]} min={COMEDY_RANGE[k][0]} max={COMEDY_RANGE[k][1]} testid={`gap-${k}`} onChange={(v) => erStore.getState().setComedy({ [k]: v })} />
        ))}
      </div>
      <div className="er-beats mono" data-testid="comedy-beats">
        <span>step {b.step.toFixed(1)}s</span>
        <span>→ fall {b.fall.toFixed(1)}s</span>
        <span>→ reaction {b.reaction.toFixed(1)}s</span>
      </div>
    </div>
  );
}
