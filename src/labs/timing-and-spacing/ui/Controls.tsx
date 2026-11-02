"use client";

import type { ReactNode } from "react";
import { SectionLabel, Segmented } from "@/ui/primitives";
import { FPS, LIMITS, METERS_PER_UNIT, type MotionParams, WEIGHT_IDS, WEIGHT_PRESETS, impliedGravity } from "../engine";
import { isLocked, useTiming } from "../store";
import { ACCENT_A, ACCENT_B, ACCENT_MAIN, ANTIC, SQUASH } from "./colors";

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  accent = ACCENT_MAIN,
  disabled,
  testId,
  valueText,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display: ReactNode;
  accent?: string;
  disabled?: boolean;
  testId?: string;
  valueText?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className={`block ${disabled ? "opacity-60" : ""}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-ink-1">{label}</span>
        <span className="mono text-[11.5px] text-ink-0" data-testid={testId ? `${testId}-value` : undefined}>
          {display}
        </span>
      </span>
      <input
        type="range"
        className="ts-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-testid={testId}
        aria-valuetext={valueText}
        style={{ "--accent": accent, "--fill": `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Locked({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-distance">set by lesson</span>;
}

function gravityWords(g: number) {
  if (g >= 1.4) return { text: "snappier than real", tone: "text-distance" };
  if (g >= 0.75) return { text: "real-world", tone: "text-subject" };
  if (g >= 0.4) return { text: "floaty", tone: "text-focal-text" };
  return { text: "moon-like", tone: "text-focal-text" };
}

export function Controls() {
  const p = useTiming((s) => s.params);
  const cmp = useTiming((s) => s.comparison);
  const set = useTiming((s) => s.setParams);
  const lock = (k: keyof MotionParams) => isLocked({ comparison: cmp }, k);
  const g = impliedGravity(p.height, p.airFrames);
  const gw = gravityWords(g);
  const weightLocked = lock("weight");
  const variants = useTiming((s) => s.variants);
  /** Locked by a lesson: show both sides' values instead of the (unused) free-play value. */
  const show = (k: keyof MotionParams, fmt: (q: MotionParams) => ReactNode): ReactNode =>
    lock(k) && variants.length === 2 ? (
      <span data-locked="1">
        <span style={{ color: ACCENT_A }}>{fmt(variants[0].params)}</span>
        <span className="text-ink-3"> · </span>
        <span style={{ color: ACCENT_B }}>{fmt(variants[1].params)}</span>
      </span>
    ) : (
      fmt(p)
    );
  const gq = (q: MotionParams) => `${impliedGravity(q.height, q.airFrames).toFixed(2)} g`;

  return (
    <section aria-label="Motion controls" className="ts-controls">
      <div className="ts-control-section">
        <SectionLabel hint={<Locked on={weightLocked} />}>Weight</SectionLabel>
        <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Weight preset">
          {WEIGHT_IDS.map((id) => {
            const on = !weightLocked && p.weight === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={weightLocked}
                data-testid={`weight-${id}`}
                title={WEIGHT_PRESETS[id].blurb}
                onClick={() => set({ weight: id })}
                className={`h-7 rounded-[8px] text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.06] text-ink-1 hover:bg-white/15"
                }`}
              >
                {WEIGHT_PRESETS[id].label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-2" data-testid="weight-blurb">
          {weightLocked ? "The lesson plays a bowling ball against a beach ball." : p.weight ? WEIGHT_PRESETS[p.weight].blurb : "Custom: your own mix of timing, bounce and squash."}
        </p>
      </div>

      <div className="ts-control-section flex flex-col gap-2">
        <SectionLabel hint={<Locked on={lock("airFrames")} />}>Timing</SectionLabel>
        <Slider
          label="Time in the air"
          testId="air-frames"
          value={p.airFrames}
          {...range("airFrames")}
          disabled={lock("airFrames")}
          onChange={(v) => set({ airFrames: v })}
          display={
            lock("airFrames") ? (
              show("airFrames", (q) => `${q.airFrames} f`)
            ) : (
              <>
                {p.airFrames} f <span className="text-ink-2">· {(p.airFrames / FPS).toFixed(2)} s</span>
              </>
            )
          }
        />
        <Slider
          label="Jump height"
          testId="height"
          value={p.height}
          {...range("height")}
          step={0.05}
          disabled={lock("height")}
          onChange={(v) => set({ height: v })}
          display={show("height", (q) => `${(q.height * METERS_PER_UNIT).toFixed(2)} m`)}
        />
        <div className="flex items-center justify-between rounded-[8px] bg-white/[0.04] px-2 py-1.5" data-testid="gravity-readout" title="Gravity implied by this height and airtime, for a character 0.5 m tall. Real objects all fall at 1 g; animators cheat it for weight.">
          <span className="micro">Implied gravity</span>
          <span className="mono text-[11.5px]">
            {lock("airFrames") ? (
              show("airFrames", gq)
            ) : (
              <>
                <span className="text-ink-0">{g.toFixed(2)} g</span> <span className={gw.tone}>{gw.text}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="ts-control-section flex flex-col gap-2">
        <SectionLabel hint={<Locked on={lock("squash")} />}>Squash &amp; stretch</SectionLabel>
        <Slider
          label="Amount"
          testId="squash"
          accent={SQUASH}
          value={p.squash}
          {...range("squash")}
          step={0.01}
          disabled={lock("squash")}
          onChange={(v) => set({ squash: v })}
          display={show("squash", (q) => (q.squash < 0.03 ? "rigid" : q.squash > 0.85 ? `${Math.round(q.squash * 100)} % · cartoon` : `${Math.round(q.squash * 100)} %`))}
        />
        <p className="ts-control-note">Keep the volume; change the shape. More squash makes the landing feel softer.</p>
      </div>

      <details className="ts-control-details" open={cmp === "anticipation"} data-testid="anticipation-details">
        <summary>Anticipation <span>Prepare the jump</span></summary>
        <div className="ts-details-body">
        <p className="ts-control-note">{lock("anticipation") ? "This comparison fixes the two windups. Return to Free play to edit them." : "A small crouch helps the audience read what comes next."}</p>
        <Slider
          label="Crouch depth"
          testId="anticipation"
          accent={ANTIC}
          value={p.anticipation}
          {...range("anticipation")}
          step={0.01}
          disabled={lock("anticipation")}
          onChange={(v) => set({ anticipation: v })}
          display={show("anticipation", (q) => (q.anticipation <= 0 ? "none" : `${Math.round(q.anticipation * 100)} %`))}
        />
        <Slider
          label="Windup"
          testId="anticipation-frames"
          accent={ANTIC}
          value={p.anticipationFrames}
          {...range("anticipationFrames")}
          disabled={lock("anticipationFrames") || p.anticipation <= 0}
          onChange={(v) => set({ anticipationFrames: v })}
          display={show("anticipationFrames", (q) => (q.anticipation <= 0 ? "—" : `${q.anticipationFrames} f`))}
        />
        </div>
      </details>

      <details className="ts-control-details" data-testid="bounce-details">
        <summary>Bounce &amp; settle <span>Rebounds and contact</span></summary>
        <div className="ts-details-body">
        {lock("restitution") && <p className="ts-control-note">Weight comparison sets the rebound and contact values for A and B.</p>}
        <Slider
          label="Bounciness"
          testId="restitution"
          value={p.restitution}
          {...range("restitution")}
          step={0.01}
          disabled={lock("restitution")}
          onChange={(v) => set({ restitution: v })}
          display={show("restitution", (q) => `${Math.round(q.restitution * 100)} %`)}
          valueText={`Each rebound keeps ${Math.round(p.restitution * p.restitution * 100)} percent of the height`}
        />
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[12px] text-ink-1">Rebound timing</span>
          </div>
          <Segmented
            label="Rebound timing"
            testId="rebound-timing"
            value={p.physicalTiming ? "physical" : "constant"}
            onChange={(v) => set({ physicalTiming: v === "physical" })}
            options={[
              { value: "physical", label: "Shorter each bounce", testId: "timing-physical", title: "Airtime shrinks with √height, like a real bounce" },
              { value: "constant", label: "Same duration", testId: "timing-constant", title: "Every rebound takes as long as the first: compare the change in weight" },
            ]}
          />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[12px] text-ink-1">Frames on the floor</span>
            <Locked on={lock("contactFrames")} />
          </div>
          <Segmented
            label="Contact frames"
            testId="contact-frames"
            disabled={lock("contactFrames")}
            value={String(p.contactFrames) as "1" | "2" | "3" | "4"}
            onChange={(v) => set({ contactFrames: Number(v) })}
            options={(["1", "2", "3", "4"] as const).map((v) => ({ value: v, label: v, testId: `contact-${v}` }))}
          />
        </div>
        <p className="ts-control-note">A lower rebound usually takes less time. Compare equal timing to see how weight changes.</p>
        </div>
      </details>

      <details className="ts-control-details" data-testid="follow-through-details">
        <summary>Follow-through <span>Let the antenna settle</span></summary>
        <div className="ts-details-body">
        <Slider
          label="Antenna overlap"
          testId="follow-through"
          value={p.followThrough}
          {...range("followThrough")}
          step={0.01}
          onChange={(v) => set({ followThrough: v })}
          display={p.followThrough <= 0.01 ? "rigid" : `${Math.round(p.followThrough * 100)} %`}
        />
        <p className="ts-control-note">The antenna trails the body, then catches up after the landing.</p>
        </div>
      </details>
    </section>
  );
}

function range(k: keyof typeof LIMITS) {
  const [min, max] = LIMITS[k];
  return { min, max };
}
