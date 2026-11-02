"use client";

import { PRESETS } from "../engine/presets";
import { studioStore, useStudio } from "../store";

export function PresetBar() {
  const presetId = useStudio((s) => s.presetId);
  const modified = useStudio((s) => s.modified);
  return (
    <nav aria-label="Lighting looks" className="ls-presets" data-testid="preset-bar">
      {PRESETS.map((p) => (
        <button key={p.id} type="button" className="ls-preset" aria-pressed={presetId === p.id} data-testid={`preset-${p.id}`}
          style={{ "--swatch-a": p.swatch[0], "--swatch-b": p.swatch[1] } as React.CSSProperties}
          onClick={() => { studioStore.getState().applyPreset(p.id); studioStore.getState().toast(p.name, p.key); }}
          title={`Apply ${p.name} (${p.key})`}>
          <span className="ls-preset-image" style={{ backgroundImage: `url(/labs/lighting-studio/previews/${p.id}.png)` }} aria-hidden="true"><span className="ls-preset-key">{p.key}</span></span>
          <span className="ls-preset-name">{p.name}<span>{presetId === p.id ? modified ? "•" : "✓" : ""}</span></span>
        </button>
      ))}
    </nav>
  );
}
