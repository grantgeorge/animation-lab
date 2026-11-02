"use client";

import { stats } from "../engine/edit";
import { presetEdit, PRESET_INFO } from "../engine/presets";
import { SHOTS } from "../engine/shots";
import { EDIT_PRESETS, type Edit } from "../engine/types";
import { useER } from "../store";

/** Shot-length graph: every clip as a bar, the ASL as a line, with the four treatments for scale. */
export function AslGraph({ edit }: { edit: Edit }) {
  const preset = useER((s) => s.preset);
  const max = 6;
  const st = stats(edit);
  return (
    <section className="er-card er-aslgraph" data-testid="asl-graph">
      <div className="er-card-head">
        <span className="er-eyebrow">Shot lengths</span>
        <span className="mono">ASL {st.asl.toFixed(2)}s · {st.cuts} cuts · {(st.cuts / Math.max(0.1, st.runtime) * 60).toFixed(0)} cuts/min</span>
      </div>
      <div className="er-bars">
        {edit.map((c) => (
          <div key={c.id} className="er-bar" style={{ height: `${(Math.min(max, c.duration) / max) * 100}%`, background: SHOTS[c.shot].color }} title={`${SHOTS[c.shot].name} · ${c.duration.toFixed(1)} s`}>
            <span className="mono">{c.duration.toFixed(1)}</span>
          </div>
        ))}
        <i className="er-asl-line" style={{ bottom: `${(st.asl / max) * 100}%` }} />
      </div>
      <div className="er-asl-compare">
        {EDIT_PRESETS.map((p) => {
          const a = stats(presetEdit(p)).asl;
          return (
            <div key={p} className={p === preset ? "er-on" : undefined}>
              <span>{PRESET_INFO[p].label}</span>
              <i style={{ width: `${(a / 4.5) * 100}%` }} />
              <b className="mono">{a.toFixed(1)}s</b>
            </div>
          );
        })}
      </div>
    </section>
  );
}
