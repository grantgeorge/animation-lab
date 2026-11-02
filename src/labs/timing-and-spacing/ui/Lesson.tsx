"use client";

import { COMPARISONS, comparison } from "../engine";
import { useTiming } from "../store";
import { ACCENT_A, ACCENT_B } from "./colors";

/** One-click lesson tabs: free play or one of the four A/B comparisons. */
export function LessonTabs() {
  const cmp = useTiming((s) => s.comparison);
  const set = useTiming((s) => s.setComparison);
  const names = { easing: "Spacing", weight: "Weight", anticipation: "Anticipation", squash: "Squash & stretch" };
  return (
    <nav aria-label="Lessons" className="ts-lessons" data-testid="lesson-tabs">
      <button type="button" aria-pressed={!cmp} data-testid="lesson-free" onClick={() => set(null)}>
        Free play
      </button>
      <span className="ts-lessons-label">COMPARE</span>
      {COMPARISONS.map((c) => {
        const on = cmp === c.id;
        return (
          <button key={c.id} type="button" aria-pressed={on} data-testid={`lesson-${c.id}`} onClick={() => set(on ? null : c.id)} title={`${c.title} (${c.key})`}>
            <span className="ts-lesson-key">{c.key}</span>
            {names[c.id]}
          </button>
        );
      })}
    </nav>
  );
}

/** The lesson text under the tabs while a comparison is on. */
export function LessonStrip() {
  const c = comparison(useTiming((s) => s.comparison));
  if (!c) return null;
  return (
    <section key={c.id} className="ts-study ts-lesson-enter" data-testid="lesson-strip" aria-live="polite">
      <div className="ts-study-heading">
        <span className="ts-eyebrow">COMPARE {c.key} / 4</span>
        <h2>{c.title}</h2>
        <div className="ts-variant-key"><span style={{ color: ACCENT_A }}>A · {c.a}</span><span style={{ color: ACCENT_B }}>B · {c.b}</span></div>
      </div>
      <p>{c.why}</p>
      <div className="ts-study-look">
        <span className="ts-eyebrow">WATCH FOR</span>
        <p>{c.lookAt}</p>
        <details className="ts-film-note"><summary>Apply it to a shot</summary><p data-testid="ai-tip">{c.aiTip}</p></details>
      </div>
    </section>
  );
}
