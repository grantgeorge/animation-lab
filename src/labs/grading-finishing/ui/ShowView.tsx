"use client";

import { CANT_FIX } from "../content";
import { getLook } from "../engine/look";
import { NEUTRAL_MATCH } from "../engine/match";
import { NEUTRAL_OVERRIDE, SHOTS, SHOW_STEPS, SUGGESTED_OVERRIDE, getShot, isOverrideActive, type ShowStep } from "../engine/shots";
import { autoBalance, showMetric } from "../runtime/metrics";
import { gfStore, useGF } from "../store";
import { Slot } from "./Monitor";
import { LooksList } from "./AdvancedPanel";
import { Section, Slider, pct, signed } from "./controls";

const STEP_LABEL: Record<ShowStep, { n: string; title: string; line: string }> = {
  raw: { n: "0", title: "Raw clips", line: "Three shots generated on different days: none of them agree." },
  match: { n: "a", title: "Balance each shot", line: "Neutralise each clip first: exposure, white balance, contrast, saturation." },
  look: { n: "b", title: "Apply one show look", line: "The same grade and finishing on every shot: your current look is the show look." },
  override: { n: "c", title: "Override one shot", line: "A deliberate, small per-shot change on top of the show default." },
};

export function useMetric() {
  const look = useGF((s) => s.look);
  const shots = useGF((s) => s.shots);
  const step = useGF((s) => s.step);
  const platesReady = useGF((s) => s.platesReady);
  const nodes = useGF((s) => s.nodes);
  return showMetric({ look, shots, step, platesReady, nodes });
}

function MetricBar() {
  const m = useMetric();
  const step = useGF((s) => s.step);
  const share = m && m.raw > 0 ? m.now / m.raw : 1;
  return (
    <div className="gf-metric" data-testid="mismatch">
      <div className="gf-metric-text">
        <span className="gf-eyebrow">Cross-shot drift</span>
        <strong className="mono" data-testid="mismatch-value">{m ? m.now.toFixed(3) : "…"}</strong>
        <span className="gf-metric-share mono">{m ? `${Math.round(share * 100)}% of raw` : ""}</span>
      </div>
      <div className="gf-metric-track" aria-hidden>
        <div className="gf-metric-fill" style={{ width: `${Math.min(100, share * 100)}%` }} data-step={step} />
      </div>
      <p>Unintended differences between the shots: each is compared (OKLab brightness, cast, contrast, saturation) with its own clean render passed through the same show look and override, so only leftover drift counts. 0 = they cut together. Intentional overrides and finishing aren’t counted.</p>
    </div>
  );
}

export function ShowWorkbench() {
  const shot = useGF((s) => s.shot);
  const step = useGF((s) => s.step);
  const shots = useGF((s) => s.shots);
  const ready = useGF((s) => s.platesReady);
  return (
    <div className="gf-show" data-testid="show-view">
      <div className="gf-show-row">
        {SHOTS.map((s) => (
          <figure key={s.id} className="gf-show-cell">
            <Slot id={`show:${s.id}`} className="gf-show-monitor" testId={`show-monitor-${s.id}`} selected={s.id === shot} onClick={() => gfStore.getState().setShot(s.id)}>
              {!ready && <span className="gf-loading">Loading still…</span>}
            </Slot>
            <figcaption>
              <span>{s.label}</span>
              {step === "raw" && <em className="gf-drift">{s.driftLabel}</em>}
              {step !== "raw" && SHOW_STEPS.indexOf(step) >= 3 && isOverrideActive(shots[s.id].override) && <em className="gf-override">Override</em>}
            </figcaption>
          </figure>
        ))}
      </div>
      <MetricBar />
      <section className="gf-limits" data-testid="cant-fix">
        <div className="gf-limits-text">
          <span className="gf-eyebrow">What grading can’t fix</span>
          <h3>Same grade, same scopes, still wrong</h3>
          <p>The right still was generated with the key light on the other side of the set. The show look lands identically on both: the cast, contrast and grain match, and the shadows still fall the wrong way.</p>
          <ul>{CANT_FIX.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <figure>
          <Slot id="limit:same" className="gf-limit-monitor" testId="limit-same" />
          <figcaption>Key from screen-left</figcaption>
        </figure>
        <figure>
          <Slot id="limit:flipped" className="gf-limit-monitor" testId="limit-flipped" />
          <figcaption>Key from screen-right · fix at generation</figcaption>
        </figure>
      </section>
    </div>
  );
}

export function ShowPanel() {
  const step = useGF((s) => s.step);
  const shot = useGF((s) => s.shot);
  const st = useGF((s) => s.shots[s.shot]);
  const lookId = useGF((s) => s.lookId);
  const ready = useGF((s) => s.platesReady);
  const def = getShot(shot);
  const S = gfStore.getState;
  const goto = (s: ShowStep) => S().setStep(s);
  const balanceAll = () => {
    for (const s of SHOTS) {
      const m = autoBalance(s.id);
      if (m) S().setMatch(s.id, m);
    }
    if (step === "raw") goto("match");
  };
  return (
    <div className="gf-show-panel" data-testid="show-panel">
      <div className="gf-panel-heading">
        <span className="gf-eyebrow">One look, three shots</span>
        <h2>Make AI shots feel like one production</h2>
        <p>Consistent post is what turns clips from different days and models into a show. Click a monitor to pick the shot you’re working on.</p>
      </div>
      <ol className="gf-steps" role="list">
        {SHOW_STEPS.map((s) => (
          <li key={s}>
            <button type="button" data-testid={`step-${s}`} aria-current={step === s ? "step" : undefined} onClick={() => goto(s)}>
              <b>{STEP_LABEL[s].n}</b>
              <span>{STEP_LABEL[s].title}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="gf-step-line">{STEP_LABEL[step].line}</p>
      {step === "raw" && (
        <Section title={def.label} kicker={`${def.driftLabel}: ${def.driftNote}`}>
          <button type="button" className="gf-primary" onClick={() => goto("match")}>Start balancing →</button>
        </Section>
      )}
      {step === "match" && (
        <Section title={`Balance · ${def.label}`} kicker="Auto-balance matches each clip back to a reference (here its clean render, the best case: in production you balance to a grey card, skin tone or hero shot).">
          <button type="button" className="gf-primary" data-testid="auto-balance" disabled={!ready} onClick={balanceAll}>Auto-balance all three</button>
          <Slider id="match-exposure" label="Exposure" value={st.match.exposure} min={-3} max={3} step={0.05} neutral={0} format={signed(2, " st")} onChange={(v) => S().setMatch(shot, { exposure: v })} />
          <Slider id="match-temperature" label="Temperature" value={st.match.temperature} min={-1} max={1} neutral={0} format={signed(2)} onChange={(v) => S().setMatch(shot, { temperature: v })} track="linear-gradient(90deg,#5d8fe0,#3a3d44 50%,#e0a05d)" />
          <Slider id="match-tint" label="Tint" value={st.match.tint} min={-1} max={1} neutral={0} format={signed(2)} onChange={(v) => S().setMatch(shot, { tint: v })} />
          <Slider id="match-contrast" label="Contrast" value={st.match.contrast} min={0.4} max={2.5} neutral={1} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => S().setMatch(shot, { contrast: v })} />
          <Slider id="match-saturation" label="Saturation" value={st.match.saturation} min={0} max={2.5} neutral={1} format={pct} onChange={(v) => S().setMatch(shot, { saturation: v })} />
          <button type="button" className="gf-mini" onClick={() => S().setMatch(shot, NEUTRAL_MATCH)}>Clear this shot’s balance</button>
          <button type="button" className="gf-primary gf-next" onClick={() => goto("look")}>Next: one show look →</button>
        </Section>
      )}
      {step === "look" && (
        <Section title="Show look" kicker={`Applied to all three: ${lookId ? getLook(lookId).label : "your custom look"}. Pick another or build one in One shot → Advanced.`}>
          <LooksList compact />
          <button type="button" className="gf-primary gf-next" onClick={() => goto("override")}>Next: override one shot →</button>
        </Section>
      )}
      {step === "override" && (
        <Section title={`Override · ${def.label}`} kicker="Overrides stay small and intentional: the show’s stock, grain size and contrast are untouched.">
          <button type="button" className="gf-primary" data-testid="suggest-override" onClick={() => S().suggestOverride()}>Suggest: warm up the workshop</button>
          {shot === SUGGESTED_OVERRIDE.shot && isOverrideActive(st.override) && <p className="gf-note">{SUGGESTED_OVERRIDE.why}</p>}
          <Slider id="override-exposure" label="Exposure" value={st.override.grade.exposure} min={-1} max={1} step={0.05} neutral={0} format={signed(2, " st")} onChange={(v) => S().setOverride(shot, { ...st.override, grade: { ...st.override.grade, exposure: v } })} />
          <Slider id="override-temperature" label="Temperature" value={st.override.grade.temperature} min={-0.6} max={0.6} neutral={0} format={signed(2)} onChange={(v) => S().setOverride(shot, { ...st.override, grade: { ...st.override.grade, temperature: v } })} />
          <Slider id="override-saturation" label="Saturation" value={st.override.grade.saturation} min={0.5} max={1.5} neutral={1} format={pct} onChange={(v) => S().setOverride(shot, { ...st.override, grade: { ...st.override.grade, saturation: v } })} />
          <Slider id="override-halation" label="Halation (shot)" value={st.override.finish.halation ?? 0} min={0} max={1} format={(v) => (st.override.finish.halation === null ? "show" : pct(v))} onChange={(v) => S().setOverride(shot, { ...st.override, finish: { ...st.override.finish, halation: v } })} />
          <button type="button" className="gf-mini" onClick={() => S().setOverride(shot, NEUTRAL_OVERRIDE)}>Back to the show default</button>
        </Section>
      )}
      <button type="button" className="gf-mini gf-reset-show" onClick={() => S().resetShow()}>Reset the exercise</button>
    </div>
  );
}
