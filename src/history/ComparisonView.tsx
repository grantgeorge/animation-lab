"use client";

import { useRef, useState } from "react";
import { CHAPTERS, CHAPTER_BY_ID } from "./content/chapters";
import { getAsset } from "./content/assets";
import { MediaPlayer, type PlayerHandle } from "./MediaPlayer";
import type { ChapterId } from "./types";

type Phase = "idle" | "preparing" | "playing" | "partial";

/**
 * Two finished examples side by side. "Play together" resets both, waits for both seeks and readiness,
 * then starts them on the same tick. Independent performances are NOT retimed to fake frame alignment.
 */
export function ComparisonView({ left, right, onChange }: { left: ChapterId; right: ChapterId; onChange: (l: ChapterId, r: ChapterId) => void }) {
  const a = useRef<PlayerHandle>(null);
  const b = useRef<PlayerHandle>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const token = useRef(0);

  const playTogether = async () => {
    const my = ++token.current;
    setPhase("preparing");
    const [okA, okB] = await Promise.all([a.current?.prepare(0) ?? false, b.current?.prepare(0) ?? false]);
    if (my !== token.current) return; // a newer request or a chapter change superseded this one
    if (okA) void a.current?.play();
    if (okB) void b.current?.play();
    setPhase(okA && okB ? "playing" : okA || okB ? "partial" : "idle");
  };

  const side = (id: ChapterId, which: "l" | "r") => {
    const c = CHAPTER_BY_ID[id];
    const asset = getAsset(c.heroAssetId);
    return (
      <div className="min-w-0 flex-1 overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-black" data-testid={`compare-${which}`} data-chapter={id}>
        <div className="flex items-center justify-between gap-2 bg-[#0b0f16] px-3 py-2">
          <label className="sr-only" htmlFor={`cmp-${which}`}>
            {which === "l" ? "Left" : "Right"} chapter
          </label>
          <select
            id={`cmp-${which}`}
            value={id}
            onChange={(e) => {
              token.current++;
              setPhase("idle");
              const v = e.target.value as ChapterId;
              if (which === "l") onChange(v, right);
              else onChange(left, v);
            }}
            className="h-7 rounded-md border border-white/10 bg-[#121722] px-2 text-[12.5px] font-semibold"
          >
            {CHAPTERS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.number}. {ch.title}
              </option>
            ))}
          </select>
          <span className="mono text-[10px] text-ink-2">{c.id === "generative" ? "GENERATED TAKE" : "AI RECREATION"}</span>
        </div>
        {asset ? (
          <MediaPlayer key={asset.id} ref={which === "l" ? a : b} asset={asset} label={`${c.title} (comparison ${which === "l" ? "left" : "right"})`} compact />
        ) : (
          <div className="grid aspect-video place-items-center text-[12px] text-ink-2">Example pending</div>
        )}
      </div>
    );
  };

  return (
    <section aria-label="Compare two eras" className="mt-4 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-3" data-testid="comparison">
      <div className="flex flex-col gap-3 md:flex-row">
        {side(left, "l")}
        {side(right, "r")}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="ctl-btn ctl-btn-primary" onClick={playTogether} disabled={phase === "preparing"} data-testid="play-together">
          {phase === "preparing" ? "Preparing both…" : "Play together"}
        </button>
        <p className="text-[11.5px] text-ink-2" aria-live="polite" data-testid="compare-status">
          {phase === "partial"
            ? "One clip couldn't get ready, so only the working side is playing."
            : "Both clips start together from 0 s. They are separate performances, so their beats won't line up frame for frame; scrub each one independently."}
        </p>
      </div>
    </section>
  );
}
