"use client";

import Link from "next/link";
import { HALATION_VS_BLOOM } from "../content";
import { NEUTRAL_SPLIT, type GradeParams } from "../engine/grade";
import { LOOKS, NEUTRAL_STYLIZE, type DeepPartial, type FinishParams, type LookId, type StylizeMode } from "../engine/look";
import { STOCKS, STOCK_IDS } from "../engine/stocks";
import { gfStore, useGF, type Tab } from "../store";
import { ColorWheel, HUE_TRACK, Section, Slider, pct, signed } from "./controls";

const grade = (p: Partial<GradeParams>) => gfStore.getState().patchLook({ grade: p });
const finish = (p: DeepPartial<FinishParams>) => gfStore.getState().patchLook({ finish: p });

function GradeTab() {
  const g = useGF((s) => s.look.grade);
  return (
    <>
      <Section title="Primaries" kicker="Exposure and white balance act on light (linear); contrast pivots around mid-grey.">
        <Slider id="exposure" label="Exposure" value={g.exposure} min={-3} max={3} step={0.05} neutral={0} format={signed(2, " st")} onChange={(v) => grade({ exposure: v })} hint="Stops of light. Display-referred clips have no headroom: push up and the lamps clip." />
        <Slider id="temperature" label="Temperature" value={g.temperature} min={-1} max={1} neutral={0} format={signed(2)} onChange={(v) => grade({ temperature: v })} track="linear-gradient(90deg,#5d8fe0,#3a3d44 50%,#e0a05d)" />
        <Slider id="tint" label="Tint" value={g.tint} min={-1} max={1} neutral={0} format={signed(2)} onChange={(v) => grade({ tint: v })} track="linear-gradient(90deg,#5dd07a,#3a3d44 50%,#d05dbd)" />
        <Slider id="contrast" label="Contrast" value={g.contrast} min={0.5} max={2} neutral={1} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => grade({ contrast: v })} />
        <Slider id="pivot" label="Pivot" value={g.pivot} min={0.2} max={0.7} neutral={0.46} format={(v) => v.toFixed(2)} onChange={(v) => grade({ pivot: v })} hint="The code value contrast leaves untouched. 0.46 ≈ 18 % grey." />
        <Slider id="saturation" label="Saturation" value={g.saturation} min={0} max={2} neutral={1} format={pct} onChange={(v) => grade({ saturation: v })} />
      </Section>
      <Section title="Lift · Gamma · Gain" kicker="Shadows, mids, highlights. Drag a puck toward a hue; the slider is the level. Double-click resets.">
        <div className="gf-wheels">
          <ColorWheel id="lift" label="Lift" value={g.lift} onChange={(w) => grade({ lift: w })} />
          <ColorWheel id="gamma" label="Gamma" value={g.gamma} onChange={(w) => grade({ gamma: w })} />
          <ColorWheel id="gain" label="Gain" value={g.gain} onChange={(w) => grade({ gain: w })} />
        </div>
      </Section>
      <Section title="Split-toning" kicker="One hue into the shadows, another into the highlights.">
        <Slider id="shadow-hue" label="Shadow hue" value={g.split.shadowHue} min={0} max={360} step={1} format={(v) => `${Math.round(v)}°`} track={HUE_TRACK} onChange={(v) => grade({ split: { ...g.split, shadowHue: v } })} />
        <Slider id="shadow-amt" label="Shadow amount" value={g.split.shadowAmt} min={0} max={1} neutral={0} format={pct} onChange={(v) => grade({ split: { ...g.split, shadowAmt: v } })} />
        <Slider id="highlight-hue" label="Highlight hue" value={g.split.highlightHue} min={0} max={360} step={1} format={(v) => `${Math.round(v)}°`} track={HUE_TRACK} onChange={(v) => grade({ split: { ...g.split, highlightHue: v } })} />
        <Slider id="highlight-amt" label="Highlight amount" value={g.split.highlightAmt} min={0} max={1} neutral={0} format={pct} onChange={(v) => grade({ split: { ...g.split, highlightAmt: v } })} />
        <Slider id="balance" label="Balance" value={g.split.balance} min={-1} max={1} neutral={0} format={signed(2)} onChange={(v) => grade({ split: { ...g.split, balance: v } })} />
        <button type="button" className="gf-mini" data-testid="split-teal-orange" onClick={() => grade({ split: { ...NEUTRAL_SPLIT, shadowHue: 195, shadowAmt: 0.5, highlightHue: 32, highlightAmt: 0.42 } })}>
          Teal shadows / orange highlights
        </button>
      </Section>
      <Section title="Film stock" kicker="“Inspired” approximations: each has its own curve, crosstalk and highlight roll-off.">
        <div className="gf-chips" role="radiogroup" aria-label="Film stock">
          {STOCK_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={g.stock === id} data-testid={`stock-${id}`} onClick={() => grade({ stock: id })}>
              {STOCKS[id].label.replace("-inspired", "").replace(" (clean digital)", "")}
            </button>
          ))}
        </div>
        <p className="gf-note" data-testid="stock-note">{STOCKS[g.stock].note}</p>
        {g.stock !== "none" && <Slider id="stock-mix" label="Stock strength" value={g.stockMix} min={0} max={1} format={pct} onChange={(v) => grade({ stockMix: v })} />}
      </Section>
    </>
  );
}

function FinishTab() {
  const f = useGF((s) => s.look.finish);
  const st = useGF((s) => s.look.stylize);
  const isolate = useGF((s) => s.isolate);
  const glowOnly = (k: "halation" | "bloom") => (
    <button type="button" className="gf-mini" data-testid={`isolate-${k}`} aria-pressed={isolate === k} onClick={() => gfStore.getState().setIsolate(isolate === k ? null : k)}>
      {isolate === k ? "Show full picture" : "Glow only"}
    </button>
  );
  const sty = (p: Partial<typeof st>) => gfStore.getState().patchLook({ stylize: p });
  return (
    <>
      <Section title="Film grain" kicker="New every frame, fixed when paused; strongest in the mids.">
        <Slider id="grain-amount" label="Amount" value={f.grain.amount} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ grain: { amount: v } })} />
        <Slider id="grain-size" label="Size" value={f.grain.size} min={0.6} max={3.5} step={0.05} format={(v) => `${v.toFixed(2)} px`} onChange={(v) => finish({ grain: { size: v } })} hint="Fine 35 mm ≈ 1.2; coarse 16 mm ≈ 2.5+" />
        <Slider id="grain-chroma" label="Colour (per-channel)" value={f.grain.chroma} min={0} max={1} format={pct} onChange={(v) => finish({ grain: { chroma: v } })} hint="0 = monochrome clumps; film grain is mostly luminance." />
      </Section>
      <Section title="Halation" kicker="Red-orange glow hugging the brightest edges.">
        <Slider id="halation-amount" label="Amount" value={f.halation.amount} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ halation: { amount: v } })} />
        <Slider id="halation-threshold" label="Threshold" value={f.halation.threshold} min={0.6} max={0.98} format={(v) => v.toFixed(2)} onChange={(v) => finish({ halation: { threshold: v } })} />
        {glowOnly("halation")}
      </Section>
      <Section title="Bloom · diffusion" kicker="Pro-Mist style: wide neutral glow, lifted blacks.">
        <Slider id="bloom-amount" label="Amount" value={f.bloom.amount} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ bloom: { amount: v } })} />
        <Slider id="bloom-threshold" label="Threshold" value={f.bloom.threshold} min={0.4} max={0.95} format={(v) => v.toFixed(2)} onChange={(v) => finish({ bloom: { threshold: v } })} />
        <Slider id="bloom-mist" label="Mist" value={f.bloom.mist} min={0} max={1} format={pct} onChange={(v) => finish({ bloom: { mist: v } })} hint="How much of the whole image diffuses, not just the highlights." />
        {glowOnly("bloom")}
        <p className="gf-note">{HALATION_VS_BLOOM}</p>
      </Section>
      <Section title="Lens" kicker="A lens personality, not a camera look.">
        <Slider id="distortion" label="Barrel distortion" value={f.lens.distortion} min={-0.15} max={0.3} format={signed(2)} neutral={0} onChange={(v) => finish({ lens: { distortion: v } })} />
        <Slider id="aberration" label="Chromatic aberration" value={f.lens.aberration} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ lens: { aberration: v } })} />
        <Slider id="streaks" label="Anamorphic streaks" value={f.lens.streaks} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ lens: { streaks: v } })} />
      </Section>
      <Section title="Vignette · sharpen · weave">
        <Slider id="vignette" label="Vignette" value={f.vignette.amount} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ vignette: { amount: v } })} />
        <Slider id="vignette-soft" label="Vignette softness" value={f.vignette.softness} min={0} max={1} format={pct} onChange={(v) => finish({ vignette: { softness: v } })} />
        <Slider id="sharpen" label="Sharpen" value={f.sharpen} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ sharpen: v })} />
        <Slider id="weave" label="Gate weave" value={f.weave} min={0} max={1} format={pct} neutral={0} onChange={(v) => finish({ weave: v })} />
      </Section>
      <Section title="Stylize" kicker="Screen-space treatments that go beyond grading.">
        <div className="gf-chips" role="radiogroup" aria-label="Stylize">
          {(["none", "comic", "painterly"] as StylizeMode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={st.mode === m} data-testid={`stylize-${m}`} onClick={() => sty(m === "none" ? NEUTRAL_STYLIZE : { mode: m, scale: m === "comic" ? 6 : 6, ink: m === "comic" ? 0.85 : 0.35, paper: m === "comic" ? 0.35 : 0.3, misregister: m === "comic" ? 2.5 : 0 })}>
              {m === "none" ? "Off" : m === "comic" ? "Comic print" : "Painterly"}
            </button>
          ))}
        </div>
        {st.mode !== "none" && (
          <>
            <Slider id="stylize-amount" label="Amount" value={st.amount} min={0} max={1} format={pct} onChange={(v) => sty({ amount: v })} />
            <Slider id="stylize-scale" label={st.mode === "comic" ? "Dot size" : "Brush size"} value={st.scale} min={2} max={10} step={0.5} format={(v) => `${v.toFixed(1)} px`} onChange={(v) => sty({ scale: v })} />
            {st.mode === "comic" && <Slider id="stylize-mis" label="Misregistration" value={st.misregister} min={0} max={6} step={0.25} format={(v) => `${v.toFixed(1)} px`} onChange={(v) => sty({ misregister: v })} />}
            <Slider id="stylize-ink" label="Ink lines" value={st.ink} min={0} max={1} format={pct} onChange={(v) => sty({ ink: v })} />
            <Slider id="stylize-paper" label="Paper texture" value={st.paper} min={0} max={1} format={pct} onChange={(v) => sty({ paper: v })} />
            {st.mode === "comic" && (
              <label className="gf-check">
                <input type="checkbox" data-testid="stylize-stepped" checked={st.stepped} onChange={(e) => sty({ stepped: e.currentTarget.checked })} />
                Animate on twos (12 fps motion, 24 fps grain)
              </label>
            )}
            {st.mode === "painterly" && <p className="gf-note">Screen-space post: it repaints the whole frame each time, so strokes aren’t attached to surfaces and swim when things move. For paint that sticks to surfaces, see <Link href="/labs/painterly-textures">Painterly Textures</Link>.</p>}
          </>
        )}
      </Section>
    </>
  );
}

export function LooksList({ compact = false }: { compact?: boolean }) {
  const lookId = useGF((s) => s.lookId);
  const groups = ["Film stocks", "Looks", "Famous treatments"] as const;
  return (
    <div className="gf-looks" data-testid="looks-list">
      {groups.map((g) => (
        <div key={g} className="gf-look-group">
          <span className="gf-eyebrow">{g}</span>
          {LOOKS.filter((l) => l.group === g).map((l) => (
            <button key={l.id} type="button" className="gf-look" data-testid={`look-${l.id}`} aria-pressed={lookId === l.id} onClick={() => gfStore.getState().applyLook(l.id as LookId)}>
              <span>{l.label}</span>
              {!compact && <small>{l.note}</small>}
            </button>
          ))}
        </div>
      ))}
      {!compact && <p className="gf-note">“Inspired” presets are hand-tuned approximations of a look, not the films’ actual grades, and use no imagery from them.</p>}
    </div>
  );
}

export function AdvancedPanel() {
  const open = useGF((s) => s.advanced);
  const tab = useGF((s) => s.tab);
  const tabs: { id: Tab; label: string }[] = [
    { id: "looks", label: "Looks" },
    { id: "grade", label: "Grade" },
    { id: "finish", label: "Finish" },
  ];
  return (
    <details className="gf-advanced" data-testid="advanced" open={open} onToggle={(e) => gfStore.getState().setAdvanced((e.currentTarget as HTMLDetailsElement).open)}>
      <summary data-testid="advanced-toggle">
        Advanced <span>the full grade and finishing stack</span>
      </summary>
      <div role="tablist" className="gf-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-testid={`tab-${t.id}`} onClick={() => gfStore.getState().setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="gf-tab-body">{tab === "grade" ? <GradeTab /> : tab === "finish" ? <FinishTab /> : <LooksList />}</div>
    </details>
  );
}
