"use client";

import { PRESET_INFO } from "../engine/presets";
import { useER } from "../store";
import { explanationFor } from "./explainExp";

/** The explanation layer: the storytelling consequence of the current edit, in plain words. */
export function ExplainPanel({ compact = false }: { compact?: boolean }) {
  const ex = explanationFor(useER((s) => s));
  return (
    <section className="er-explain" data-testid="explanation" aria-live="polite">
      <div className="er-eyebrow">What this edit does</div>
      <p className="er-headline" data-testid="explanation-headline">
        {ex.headline}
      </p>
      {ex.reads && (
        <p className="er-reads" data-testid="explanation-reads" data-reads={ex.reads}>
          Reads as <b>{PRESET_INFO[ex.reads].label}</b> · the audience feels {PRESET_INFO[ex.reads].feel}
        </p>
      )}
      {!compact && (
        <ul className="er-points" data-testid="explanation-points">
          {ex.points.map((p, i) => (
            <li key={`${p.id}-${i}`} data-rule={p.id}>
              {p.text}
            </li>
          ))}
        </ul>
      )}
      {!compact && <p className="er-rulebased">Rule-based: computed from the edit&rsquo;s structure (order, holds, tempo, cuts on movement, who knows what when). No AI model.</p>}
    </section>
  );
}
