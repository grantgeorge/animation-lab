"use client";

import "./timing.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COMPARISONS, curvePresetOf } from "./engine";
import { tickPlayback, useTiming } from "./store";
import { installTimingHook } from "./testHook";
import { ACCENT_A, ACCENT_B } from "./ui/colors";
import { Controls } from "./ui/Controls";
import { CurveEditor } from "./ui/CurveEditor";
import { HelpDialog } from "./ui/HelpDialog";
import { LessonStrip, LessonTabs } from "./ui/Lesson";
import { PromptCard } from "./ui/PromptCard";
import { Stage3D } from "./ui/Stage3D";
import { TrajectoryView } from "./ui/TrajectoryView";
import { Transport } from "./ui/Transport";

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(t.tagName));

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useTiming.getState();
      if (e.key === "Escape") {
        if (s.helpOpen) s.setHelpOpen(false);
        return;
      }
      if (isEditable(e.target) || s.helpOpen) return;
      if (e.key === "?") {
        s.setHelpOpen(true);
        e.preventDefault();
        return;
      }
      const digit = /^Digit([1-4])$/.exec(e.code);
      if (digit && !e.shiftKey) {
        const c = COMPARISONS[Number(digit[1]) - 1];
        s.setComparison(s.comparison === c.id ? null : c.id);
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case "Space":
          s.togglePlay();
          e.preventDefault();
          return;
        case "Comma":
          s.step(-1);
          e.preventDefault();
          return;
        case "Period":
          s.step(1);
          e.preventDefault();
          return;
        case "Home":
          s.seek(0);
          e.preventDefault();
          return;
        case "KeyC":
          s.toggleCompare();
          e.preventDefault();
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Drives the shared playhead from the master clock; renders happen only when the frame changes. */
function usePlayback(reduced: boolean) {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tickPlayback();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const s = useTiming.getState();
    if (reduced) {
      s.seek(s.variants[0].timeline.arcs[0].apexFrame);
    } else {
      s.seek(0);
      s.play();
    }
    let resume = false;
    const onVis = () => {
      const st = useTiming.getState();
      if (document.hidden) {
        resume = st.playing;
        if (st.playing) st.pause();
      } else if (resume) {
        st.play();
        resume = false;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      useTiming.getState().pause();
    };
  }, [reduced]);
}

function StageOverlay() {
  const variants = useTiming((s) => s.variants);
  const playing = useTiming((s) => s.playing);
  const started = useTiming((s) => s.started);
  const frame = useTiming((s) => s.frame);
  const two = variants.length === 2;
  const phaseOf = (i: number) => variants[i].frames[Math.min(frame, variants[i].frames.length - 1)].phase;
  return (
    <div className="pointer-events-none absolute inset-0">
      {two ? (
        variants.map((v, i) => (
          <div key={v.id} className="ts-lane-label" style={{ left: i === 0 ? 14 : "calc(50% + 14px)" }} data-testid={`lane-label-${v.id}`}>
            <span className="mono rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold text-[#0B0E14]" style={{ background: i === 0 ? ACCENT_A : ACCENT_B }}>
              {v.id}
            </span>
            <span className="text-[13px] font-semibold text-ink-0">{v.label}</span>
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{phaseOf(i)}</span>
          </div>
        ))
      ) : (
        <div className="ts-stage-label">
          <span className="micro">The bounce · 24 fps</span>
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-focal-text" data-testid="phase-readout">
            {phaseOf(0)}
          </span>
        </div>
      )}
      {two && <div className="absolute inset-y-4 left-1/2 w-px bg-white/[0.07]" aria-hidden />}
      {!playing && !started && (
        <button
          type="button"
          className="ts-stage-play pointer-events-auto"
          onClick={() => useTiming.getState().play()}
          data-testid="stage-play"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor" />
          </svg>
          Play the bounce <span className="mono text-[10.5px] font-normal text-ink-2">Space</span>
        </button>
      )}
    </div>
  );
}

export default function TimingSpacingLab() {
  const root = useRef<HTMLElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const comparison = useTiming((s) => s.comparison);
  useKeyboard();
  usePlayback(reduced);

  useEffect(() => {
    const detach = installTimingHook();
    const mirror = () => {
      const el = root.current;
      if (!el) return;
      const s = useTiming.getState();
      el.dataset.comparison = s.comparison ?? "none";
      el.dataset.frame = String(s.frame);
      el.dataset.playing = String(s.playing);
      el.dataset.totalFrames = String(s.totalFrames);
      el.dataset.curve = curvePresetOf(s.params) ?? "custom";
      el.dataset.weight = s.params.weight ?? "custom";
      el.dataset.onTwos = String(s.params.onTwos);
    };
    mirror();
    const unsub = useTiming.subscribe(mirror);
    return () => {
      unsub();
      detach();
    };
  }, []);

  return (
    <main
      ref={root}
      className="lab-root ts-root"
      data-testid="lab-root"
      data-comparison={comparison ?? "none"}
      data-nomotion={reduced ? "1" : "0"}
    >
      <header className="ts-header">
        <div className="ts-brand">
          <Link href="/" className="ts-home" aria-label="Back to Animation Lab"><span aria-hidden>←</span><span>Animation Lab</span></Link>
          <span className="ts-brand-divider" aria-hidden />
          <h1>Timing &amp; Spacing</h1>
        </div>
        <p>Make every frame feel intentional.</p>
        <button type="button" className="ts-help" onClick={() => useTiming.getState().setHelpOpen(true)} data-testid="help-button" aria-label="Field guide and keyboard shortcuts">
          Field guide <span aria-hidden>?</span>
        </button>
      </header>
      <div className="ts-workspace">
        <div className="ts-workbench">
          <LessonTabs />
          <div className="ts-stage" data-testid="stage">
            <Stage3D />
            <StageOverlay />
          </div>
          <Transport />
          {comparison ? <LessonStrip /> : (
            <section className="ts-study" data-testid="free-study">
              <div><span className="ts-eyebrow">THE STUDY</span><h2>Same bounce. Different feeling.</h2></div>
              <p>Timing is how long an action takes. Spacing is how far it moves each frame. Play the bounce, then follow the dots below.</p>
              <button type="button" onClick={() => useTiming.getState().setComparison("easing")}>Compare linear &amp; eased <span aria-hidden>→</span></button>
            </section>
          )}
          <div className="ts-bottom">
            <div className="ts-analysis-panel"><TrajectoryView /></div>
            <div className="ts-analysis-panel"><CurveEditor /></div>
          </div>
          <PromptCard />
        </div>
        <aside className="ts-inspector" data-testid="motion-inspector">
          <div className="ts-panel-heading">
            <div><span className="ts-eyebrow">THE MOTION</span><h2>Shape the bounce</h2></div>
            <button type="button" className="ts-reset" onClick={() => useTiming.getState().reset()} data-testid="reset">Reset</button>
          </div>
          <Controls />
          <p className="ts-inspector-note">Change one thing at a time. Replay, then compare what your eye notices.</p>
        </aside>
      </div>
      <HelpDialog />
    </main>
  );
}
