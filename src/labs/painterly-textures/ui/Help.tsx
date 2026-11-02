"use client";

import { useEffect } from "react";
import { ptStore, usePT } from "../store";

export function Toast() {
  const toast = usePT((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => ptStore.setState({ toast: null }), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="pt-toast" role="status" data-testid="toast" key={toast.id}>
      {toast.text}
    </div>
  );
}

const KEYS: [string, string][] = [
  ["W · I · E", "Watch, Inspect, Experiment"],
  ["T", "Switch between the look and the consistency test"],
  ["0–5", "Build the look up to a technique (Inspect: pick a breakdown)"],
  ["1–4", "In the test: highlight a version"],
  ["Space", "Play / pause"],
  [", .", "Step one 24 fps frame"],
  ["?", "This guide"],
];

export function Help() {
  const open = usePT((s) => s.help);
  if (!open) return null;
  return (
    <div className="pt-help-backdrop" role="presentation" onClick={() => ptStore.getState().setHelp(false)}>
      <div className="pt-help-dialog" role="dialog" aria-modal="true" aria-label="Field guide" data-testid="help-dialog" onClick={(e) => e.stopPropagation()}>
        <span className="pt-eyebrow">FIELD GUIDE</span>
        <h2>Painterly textures</h2>
        <p>
          A painterly frame is built, not filtered. Strokes and colour patches are painted into the surfaces, light is reduced to a few painted values, backgrounds are matte paintings projected onto
          the set, effects are painted cards, and only the final paper-and-grade pass sits on the screen.
        </p>
        <p>
          The test shows why that matters. Strokes that live on the surface turn with the face. Strokes that live on the screen swim. Strokes re-invented every frame boil, which is what naive AI
          stylisation does.
        </p>
        <dl>
          {KEYS.map(([k, v]) => (
            <div key={k}>
              <dt className="mono">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" onClick={() => ptStore.getState().setHelp(false)} data-testid="help-close">
          Close
        </button>
      </div>
    </div>
  );
}
