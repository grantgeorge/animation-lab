"use client";

import { useState } from "react";
import { matchedDistance, sweepFocal } from "../engine/lens";
import { MODEL_NOTES, e1Prompt, e2Prompt, e3Prompt, e4Prompt, E5_PROMPTS } from "../engine/prompt";
import { useAC, type ACState } from "../store";

export function promptFor(s: ACState): string {
  switch (s.exp) {
    case 1:
      return e1Prompt(s.e1.proj, s.e1.view);
    case 2: {
      const sweep = s.e2.sweep || s.mode === "watch";
      const f = sweep ? sweepFocal(0, 6) : s.e2.focal;
      return e2Prompt(f, matchedDistance(f), sweep);
    }
    case 3:
      return e3Prompt(s.e3.style, s.e3.move);
    case 4:
      return e4Prompt(s.e4.style, s.e4.step, s.e4.fStop, s.e4.speedLines, s.e4.cel);
    default:
      return E5_PROMPTS[s.e5.demo];
  }
}

export function PromptBox({ compact = false }: { compact?: boolean }) {
  const s = useAC((x) => x);
  const phrase = promptFor(s);
  const [copied, setCopied] = useState(false);
  return (
    <section className="ac-prompt" data-testid="prompt-box">
      <div className="ac-prompt-head">
        <span className="ac-eyebrow">SEEDANCE PROMPT</span>
        <button
          type="button"
          data-testid="copy-prompt"
          onClick={() => {
            void navigator.clipboard?.writeText(phrase).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mono" data-testid="prompt-phrase">
        {phrase}
      </p>
      {!compact && (
        <details className="ac-notes" data-testid="model-notes">
          <summary>What video models understand</summary>
          <ul>
            {MODEL_NOTES.map((n) => (
              <li key={n.idea}>
                <span className={`ac-verdict ac-verdict-${n.verdict}`}>{n.verdict}</span>
                <b>{n.idea}</b>
                <span>{n.tip}</span>
              </li>
            ))}
          </ul>
          <p className="ac-fine">Field notes from prompting, not a benchmark. When a technique’s name fails, describe the picture it makes.</p>
        </details>
      )}
    </section>
  );
}
