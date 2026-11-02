"use client";

import { useRef } from "react";
import { CHAPTERS } from "./content/chapters";
import type { ChapterId } from "./types";

/** Eight chapter stops. Desktop: one row, arrow keys move between stops. Mobile: prev/next + a dropdown. */
export function EraNavigation({ current, onSelect }: { current: ChapterId; onSelect: (id: ChapterId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = CHAPTERS.findIndex((c) => c.id === current);
  const go = (i: number, focus = false) => {
    const n = (i + CHAPTERS.length) % CHAPTERS.length;
    onSelect(CHAPTERS[n].id);
    if (focus) refs.current[n]?.focus();
  };
  return (
    <nav aria-label="Chapters" className="mt-6">
      <ol className="hidden grid-cols-8 gap-1 rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.025] p-1 md:grid" data-testid="era-nav">
        {CHAPTERS.map((c, i) => (
          <li key={c.id} className="min-w-0">
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              aria-current={c.id === current ? "step" : undefined}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  go(i + 1, true);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  go(i - 1, true);
                }
              }}
              className="era-stop flex w-full flex-col items-start rounded-[10px] px-2.5 py-2 text-left text-ink-1 transition-colors hover:bg-white/[0.07]"
              data-testid={`era-${c.id}`}
            >
              <span className="era-num mono text-[10px] text-ink-3">
                {String(c.number).padStart(2, "0")} · {c.periodLabel.match(/\d{4}s?/)?.[0] ?? ""}
              </span>
              <span className="mt-0.5 truncate text-[13px] font-semibold">{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 md:hidden">
        <button type="button" className="ctl-btn" onClick={() => go(idx - 1)} aria-label="Previous chapter">
          ‹
        </button>
        <label className="sr-only" htmlFor="chapter-select">
          Chapter
        </label>
        <select
          id="chapter-select"
          value={current}
          onChange={(e) => onSelect(e.target.value as ChapterId)}
          className="h-9 flex-1 rounded-[10px] border border-white/10 bg-[#121722] px-3 text-[14px] font-semibold text-ink-0"
          data-testid="era-select"
        >
          {CHAPTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.number}. {c.title}
            </option>
          ))}
        </select>
        <button type="button" className="ctl-btn" onClick={() => go(idx + 1)} aria-label="Next chapter">
          ›
        </button>
      </div>
    </nav>
  );
}
