"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Segmented } from "@/ui/primitives";
import { ChapterPanel } from "./ChapterPanel";
import { ComparisonView } from "./ComparisonView";
import { CHAPTER_BY_ID } from "./content/chapters";
import { getAsset } from "./content/assets";
import { EraNavigation } from "./EraNavigation";
import { ExampleStage } from "./ExampleStage";
import { OtherPaths } from "./OtherPaths";
import { ProcessStage } from "./ProcessStage";
import { SiteNav } from "./SiteNav";
import { neighbor } from "./state";
import type { HistoryState } from "./types";

type OnChange = (patch: Partial<HistoryState>, opts?: { replace?: boolean }) => void;
const noop: OnChange = () => {};

function subscribeRM(cb: () => void) {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeRM,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function HistoryView({ state, onChange = noop, fallback = false }: { state: HistoryState; onChange?: OnChange; fallback?: boolean }) {
  const chapter = CHAPTER_BY_ID[state.chapterId];
  const reducedMotion = useReducedMotion();
  const note = state.directorNote === "blue-scarf";

  const hero = getAsset(chapter.heroAssetId);
  const caption =
    state.view === "process"
      ? chapter.processCaption
      : hero
        ? chapter.id === "generative"
          ? "Real generative take from the published experiment"
          : "AI recreation of a historical look · not archival footage"
        : "Example pending";

  return (
    <main className="history-root min-h-screen bg-void" data-nomotion={reducedMotion ? "1" : "0"} data-testid={fallback ? "history-fallback" : "history"}>
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{ background: "radial-gradient(ellipse at 20% 0%, rgb(255 181 71 / 0.07), transparent 55%), radial-gradient(ellipse at 100% 100%, rgb(95 227 255 / 0.05), transparent 50%)" }}
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-4">
          <Link href="/" className="text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-1 hover:text-ink-0">
            Animation Lab
          </Link>
          <SiteNav current="history" />
        </header>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">How Animation Evolved</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-1">Explore the same scene through a century of animation, then see what changes with generative AI.</p>
          </div>
          <button
            type="button"
            className={`ctl-btn ${state.compareChapterId ? "ctl-btn-primary" : ""}`}
            aria-pressed={!!state.compareChapterId}
            onClick={() => onChange({ compareChapterId: state.compareChapterId ? null : state.chapterId === "cg" ? "drawings" : "cg" })}
            data-testid="compare-toggle"
          >
            {state.compareChapterId ? "Close comparison" : "Compare two eras"}
          </button>
        </div>

        <EraNavigation current={state.chapterId} onSelect={(id) => onChange({ chapterId: id })} />

        {state.compareChapterId ? (
          <ComparisonView
            left={state.chapterId}
            right={state.compareChapterId}
            onChange={(l, r) => onChange({ chapterId: l, compareChapterId: r }, { replace: true })}
          />
        ) : null}

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <section aria-label={`${chapter.title}: stage`} className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="w-[260px]">
                <Segmented
                  label="Stage view"
                  value={state.view}
                  onChange={(v) => onChange({ view: v })}
                  options={[
                    { value: "watch", label: "Watch", testId: "view-watch" },
                    { value: "process", label: "See how it works", testId: "view-process" },
                  ]}
                />
              </div>
              <p className="mono text-[10.5px] text-ink-2" data-testid="stage-caption">
                <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-[9.5px] tracking-wider ${state.view === "process" ? "bg-[rgb(142_240_195/0.12)] text-subject" : "bg-[rgb(255_181_71/0.12)] text-distance"}`}>
                  {state.view === "process" ? "INTERACTIVE DEMONSTRATION" : chapter.id === "generative" ? "GENERATED TAKE" : "AI RECREATION"}
                </span>
                {caption}
              </p>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-black" data-testid="stage" data-chapter={chapter.id} data-view={state.view}>
              {state.view === "watch" ? (
                <ExampleStage key={`${chapter.id}:${chapter.heroAssetId}:${note}`} chapter={chapter} note={note} reducedMotion={reducedMotion} />
              ) : (
                <ProcessStage key={chapter.id} chapter={chapter} note={note} reducedMotion={reducedMotion} />
              )}
            </div>
          </section>

          <ChapterPanel
            chapter={chapter}
            view={state.view}
            note={note}
            onView={(v) => onChange({ view: v })}
            onNote={(on) => onChange({ directorNote: on ? "blue-scarf" : "none" }, { replace: true })}
            onPrev={() => onChange({ chapterId: neighbor(state.chapterId, -1) })}
            onNext={() => onChange({ chapterId: neighbor(state.chapterId, 1) })}
          />
        </div>

        <OtherPaths />
      </div>
    </main>
  );
}
