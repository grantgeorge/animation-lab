"use client";

import { MAX_CLIP, MIN_CLIP, reelLength, stats } from "../engine/edit";
import { PRESET_INFO } from "../engine/presets";
import { SHOTS } from "../engine/shots";
import { EDIT_PRESETS, type Edit } from "../engine/types";
import { erStore, isPristine, useER } from "../store";

export function PresetTabs({ testid = "preset-tabs" }: { testid?: string }) {
  const preset = useER((s) => s.preset);
  const pristine = useER((s) => isPristine(s));
  return (
    <div role="tablist" aria-label="Edit treatment" className="er-tabs" data-testid={testid}>
      {EDIT_PRESETS.map((p) => (
        <button key={p} type="button" role="tab" aria-selected={preset === p} data-testid={`preset-${p}`} className="er-tab" onClick={() => erStore.getState().loadPreset(p)}>
          {PRESET_INFO[p].label}
          {preset === p && !pristine ? <i title="edited">•</i> : null}
        </button>
      ))}
    </div>
  );
}

export function StatCards({ edit }: { edit: Edit }) {
  const st = stats(edit);
  return (
    <div className="er-stats" data-testid="stats">
      <div className="er-stat">
        <span>Runtime</span>
        <b className="mono" data-testid="stat-runtime">{st.runtime.toFixed(1)}s</b>
      </div>
      <div className="er-stat">
        <span>Avg. shot length</span>
        <b className="mono" data-testid="stat-asl">{st.asl.toFixed(1)}s</b>
      </div>
      <div className="er-stat">
        <span>Cuts</span>
        <b className="mono" data-testid="stat-cuts">{st.cuts}</b>
      </div>
    </div>
  );
}

/** "Selected: Reaction 3.0 sec", the duration slider and Move earlier / Move later. */
export function SelectedClip() {
  const edit = useER((s) => s.edit);
  const selected = useER((s) => s.selected);
  const i = edit.findIndex((c) => c.id === selected);
  const c = i >= 0 ? edit[i] : null;
  if (!c) return <div className="er-selected er-selected-empty" data-testid="selected-clip">Select a shot on the timeline to change its length or move it.</div>;
  const def = SHOTS[c.shot];
  const max = Math.min(MAX_CLIP, reelLength(c) - c.sourceIn);
  const s = erStore.getState();
  return (
    <div className="er-selected" data-testid="selected-clip" data-index={i}>
      <div className="er-selected-head">
        <span>
          Selected: <b style={{ color: def.color }}>{def.name}</b>
        </span>
        <span className="mono" data-testid="selected-duration">{c.duration.toFixed(1)} sec</span>
      </div>
      <input
        type="range"
        aria-label={`${def.name} duration`}
        data-testid="duration-slider"
        min={MIN_CLIP}
        max={Math.max(MIN_CLIP + 0.1, max)}
        step={0.1}
        value={c.duration}
        onPointerDown={() => s.beginGesture()}
        onChange={(e) => erStore.getState().setDuration(i, Number(e.target.value), false)}
        className="er-range"
      />
      <div className="er-move">
        <button type="button" data-testid="move-earlier" disabled={i === 0} onClick={() => erStore.getState().move(i, -1)}>
          <span aria-hidden>←</span> Move earlier
        </button>
        <button type="button" data-testid="move-later" disabled={i === edit.length - 1} onClick={() => erStore.getState().move(i, 1)}>
          Move later <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
