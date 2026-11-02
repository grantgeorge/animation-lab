"use client";

import { useMemo, useState } from "react";
import { PROMPT_NOTES, guidance, promptPhrase, type PromptInput } from "../engine/prompt";
import { useED, type EDState } from "../store";
import { live } from "../runtime/live";
import { LiveText } from "./Chrome";

export const promptInput = (s: Pick<EDState, "construct" | "move" | "moveSize" | "cues">, revealed: number | null = null): PromptInput => ({
  construct: s.construct,
  move: s.move,
  moveSize: s.moveSize,
  parallax: s.cues.parallax,
  haze: s.cues.haze,
  hazeColor: s.cues.hazeColor,
  layers: s.cues.layers,
  scale: s.cues.scale,
  refs: s.cues.refs,
  story: s.cues.story,
  occlusion: s.cues.occlusion,
  dof: s.cues.dof,
  fStop: s.cues.fStop,
  focalMm: s.cues.focalMm,
  revealed,
});

export function PromptBox({ compact = false }: { compact?: boolean }) {
  const construct = useED((s) => s.construct);
  const move = useED((s) => s.move);
  const moveSize = useED((s) => s.moveSize);
  const cues = useED((s) => s.cues);
  const input = useMemo(() => promptInput({ construct, move, moveSize, cues }), [construct, move, moveSize, cues]);
  const phrase = useMemo(() => promptPhrase(input), [input]);
  const [copied, setCopied] = useState(false);
  return (
    <section className="ed-prompt" data-testid="prompt">
      <div className="ed-prompt-head">
        <span className="ed-eyebrow">SEEDANCE PROMPT</span>
        <button
          type="button"
          data-testid="copy-prompt"
          onClick={() => {
            void navigator.clipboard?.writeText(phrase).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p data-testid="prompt-phrase">{phrase}</p>
      <LiveText
        className="ed-guidance"
        data-testid="prompt-guidance"
        get={() => {
          const g = guidance({ ...input, revealed: live.revealEnd?.total ?? null });
          return g ? g.line : "";
        }}
      />
      {!compact && (
        <details className="ed-notes">
          <summary>Which cues to name, which moves stay coherent</summary>
          <ul>
            {PROMPT_NOTES.map((n) => (
              <li key={n.cue}>
                <b>{n.cue}</b>
                <span className="mono">“{n.words}”</span>
                <span>{n.note}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
