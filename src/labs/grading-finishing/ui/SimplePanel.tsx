"use client";

import { CAPTION } from "../content";
import { simpleFromLook, type SimpleSliders } from "../engine/look";
import { gfStore, useGF } from "../store";

const ROWS: { key: keyof SimpleSliders; label: string }[] = [
  { key: "grain", label: "Film grain" },
  { key: "temperature", label: "Color temperature" },
  { key: "contrast", label: "Contrast" },
  { key: "bloom", label: "Bloom" },
];

/** The screenshot's four sliders: the default way in. */
export function SimplePanel() {
  const look = useGF((s) => s.look);
  const v = simpleFromLook(look);
  return (
    <section className="gf-simple" data-testid="simple-panel">
      <p className="gf-caption" data-testid="caption">{CAPTION}</p>
      {ROWS.map((r) => {
        const value = Math.round(v[r.key] * 100);
        return (
          <label key={r.key} className="gf-big-slider" data-testid={`simple-${r.key}`}>
            <span className="gf-big-head">
              <span>{r.label}</span>
              <output className="mono" data-testid={`simple-${r.key}-value`}>{value}%</output>
            </span>
            <input type="range" min={0} max={100} step={1} value={value} aria-label={r.label} onChange={(e) => gfStore.getState().setSimple(r.key, Number(e.currentTarget.value) / 100)} />
          </label>
        );
      })}
      <button type="button" className="gf-reset" data-testid="reset-effects" onClick={() => gfStore.getState().resetLook()}>
        Reset effects
      </button>
    </section>
  );
}
