"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STEP_COPY, THESIS } from "../content";
import { cfClock, cfStore, STEPS, useCF, type Mode } from "../store";
import { live } from "../runtime/live";

const MODES: { id: Mode; label: string; key: string }[] = [
  { id: "watch", label: "Watch", key: "W" },
  { id: "inspect", label: "Inspect", key: "I" },
  { id: "experiment", label: "Experiment", key: "E" },
];

export function Header() {
  return (
    <header className="cf-header">
      <div className="cf-brand">
        <Link href="/" className="cf-home" data-testid="home-link" aria-label="Back to Animation Lab"><span aria-hidden>←</span><span>Animation Lab</span></Link>
        <i />
        <h1>Cinema Camera Families</h1>
      </div>
      <p className="cf-thesis">{THESIS}</p>
      <button type="button" className="cf-help" data-testid="help-button" onClick={() => cfStore.getState().setHelp(true)}>Field guide <span>?</span></button>
    </header>
  );
}

export function ModeSwitch() {
  const mode = useCF((s) => s.mode);
  return (
    <div role="radiogroup" aria-label="View mode" data-testid="mode-switch" className="cf-modes">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={m.id === mode} data-testid={`mode-${m.id}`} title={`${m.label} (${m.key})`} onClick={() => cfStore.getState().setMode(m.id)}>
          <span>{m.label}</span><kbd>{m.key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function StepTabs() {
  const step = useCF((s) => s.step);
  return (
    <nav className="cf-steps" aria-label="Lesson steps" data-testid="step-tabs">
      {STEPS.map((id) => {
        const c = STEP_COPY[id];
        return (
          <button key={id} type="button" aria-pressed={id === step} data-testid={`step-${id}`} className={id === "blind" ? "cf-step-blind" : ""} onClick={() => cfStore.getState().setStep(id)}>
            <b>{c.n}</b>{c.tab}
          </button>
        );
      })}
    </nav>
  );
}

/** Play/pause and the scene clock (time written per frame without re-rendering). */
export function Transport() {
  const playing = useCF((s) => s.playing);
  const fps = useCF((s) => s.fps);
  const slow = useCF((s) => s.slowMotion);
  const time = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = time.current;
      if (el) {
        const txt = `${live.frameT.toFixed(2)} s`;
        if (el.textContent !== txt) el.textContent = txt;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="cf-transport">
      <button type="button" data-testid="play-toggle" aria-label={playing ? "Pause" : "Play"} onClick={() => cfStore.getState().togglePlay()}>{playing ? "❚❚" : "▶"}</button>
      <span ref={time} className="mono" data-testid="clock">0.00 s</span>
      {slow && fps > 24 && <span className="cf-slowmo mono">{(fps / 24).toFixed(0)}× slow</span>}
    </div>
  );
}

export function Toast() {
  const toast = useCF((s) => s.toast);
  const [shown, setShown] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const show = setTimeout(() => setShown(toast), 0);
    const hide = setTimeout(() => setShown((cur) => (cur?.id === toast.id ? null : cur)), 1600);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [toast]);
  return <div role="status" aria-live="polite" className="cf-toast" data-show={shown ? "1" : "0"}>{shown?.text}</div>;
}

/** Step a frame at the capture rate (paused). */
export function stepFrame(dir: 1 | -1) {
  const s = cfStore.getState();
  if (s.playing) s.pause();
  s.seek(cfClock.peek() + dir / s.fps);
}
