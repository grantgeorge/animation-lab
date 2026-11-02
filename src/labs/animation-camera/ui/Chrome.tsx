"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import Link from "next/link";
import { FPS, LOOP_S } from "../engine/common";
import { EXP_COPY, TAGLINE } from "../content";
import { acClock, acStore, EXPS, useAC, type Mode } from "../store";
import { live, onAfterFrame, slots } from "../runtime/live";

/** Text that follows the render loop without re-rendering React. */
export function LiveText({ get, ...rest }: { get: () => string } & HTMLAttributes<HTMLSpanElement>) {
  const ref = useRef<HTMLSpanElement>(null);
  const fn = useRef(get);
  useEffect(() => {
    fn.current = get;
  });
  useEffect(
    () =>
      onAfterFrame(() => {
        const el = ref.current;
        if (!el) return;
        const v = fn.current();
        if (el.textContent !== v) el.textContent = v;
      }),
    [],
  );
  return <span ref={ref} {...rest} />;
}

/** A bar whose width (0..1) follows the render loop. */
export function LiveBar({ get, color, className = "" }: { get: () => number; color: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fn = useRef(get);
  useEffect(() => {
    fn.current = get;
  });
  useEffect(
    () =>
      onAfterFrame(() => {
        const el = ref.current;
        if (!el) return;
        const w = `${(Math.max(0, Math.min(1, fn.current())) * 100).toFixed(1)}%`;
        if (el.style.width !== w) el.style.width = w;
      }),
    [],
  );
  return (
    <span className={`ac-bar ${className}`}>
      <span ref={ref} style={{ background: color } as CSSProperties} />
    </span>
  );
}

/** A DOM window the orchestrator renders a camera into. */
export function Slot({ id, className = "", children, testId }: { id: string; className?: string; children?: React.ReactNode; testId?: string }) {
  return (
    <div
      className={`ac-slot ${className}`}
      data-testid={testId ?? `monitor-${id}`}
      ref={(el) => {
        if (!el) return;
        slots.set(id, el);
        return () => {
          if (slots.get(id) === el) slots.delete(id);
        };
      }}
    >
      {children}
    </div>
  );
}

const MODES: { id: Mode; label: string; key: string; hint: string }[] = [
  { id: "watch", label: "Watch", key: "W", hint: "the result" },
  { id: "inspect", label: "Inspect", key: "I", hint: "how it works" },
  { id: "experiment", label: "Experiment", key: "E", hint: "change it" },
];

export function ModeSwitch() {
  const mode = useAC((s) => s.mode);
  return (
    <div role="radiogroup" aria-label="View mode" data-testid="mode-switch" className="ac-modes">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={m.id === mode} data-testid={`mode-${m.id}`} title={`${m.label}: ${m.hint} (${m.key})`} onClick={() => acStore.getState().setMode(m.id)}>
          <span>{m.label}</span>
          <kbd>{m.key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function ExpPicker() {
  const exp = useAC((s) => s.exp);
  return (
    <nav aria-label="Experiment" className="ac-exps" data-testid="exp-picker">
      {EXPS.map((e) => (
        <button key={e} type="button" aria-pressed={e === exp} data-testid={`exp-${e}`} onClick={() => acStore.getState().setExp(e)} title={`${EXP_COPY[e].title} (${e})`}>
          <b>{e}</b>
          <span>{EXP_COPY[e].short}</span>
        </button>
      ))}
    </nav>
  );
}

export function Header() {
  return (
    <header className="ac-header">
      <div className="ac-brand">
        <Link href="/" className="ac-home" data-testid="home-link" aria-label="Back to Animation Lab">
          <span aria-hidden>←</span>
          <span>Animation Lab</span>
        </Link>
        <i />
        <h1>Animation Camera</h1>
      </div>
      <p>{TAGLINE}</p>
      <button type="button" className="ac-help-btn" data-testid="help-button" onClick={() => acStore.getState().setHelp(true)}>
        Field guide <span>?</span>
      </button>
    </header>
  );
}

export function Transport() {
  const playing = useAC((s) => s.playing);
  const [scrub, setScrub] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () =>
      onAfterFrame(() => {
        if (input.current && scrub === null) input.current.value = String(live.t);
      }),
    [scrub],
  );
  return (
    <div className="ac-transport" data-testid="transport">
      <button type="button" data-testid="play" aria-label={playing ? "Pause" : "Play"} onClick={() => acStore.getState().togglePlay()}>
        {playing ? "❚❚" : "▶"}
      </button>
      <button type="button" aria-label="Previous frame" onClick={() => acStore.getState().step(-1)}>
        ‹
      </button>
      <button type="button" aria-label="Next frame" onClick={() => acStore.getState().step(1)}>
        ›
      </button>
      <input
        ref={input}
        type="range"
        min={0}
        max={LOOP_S - 1 / FPS}
        step={1 / FPS}
        defaultValue={0}
        aria-label="Scrub time"
        data-testid="scrub"
        onPointerDown={() => {
          setScrub(acClock.peek());
          acStore.getState().pause();
        }}
        onPointerUp={() => setScrub(null)}
        onChange={(e) => acStore.getState().seek(Number(e.target.value))}
      />
      <LiveText className="ac-time" data-testid="time" get={() => `${live.t.toFixed(2)} s · f${String(Math.floor(live.t * FPS + 1e-6)).padStart(3, "0")}`} />
    </div>
  );
}

export function Toast() {
  const toast = useAC((s) => s.toast);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const a = setTimeout(() => setShown(toast.id), 0);
    const b = setTimeout(() => setShown(null), 1400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [toast]);
  return (
    <div role="status" aria-live="polite" className="ac-toast" data-show={toast && shown === toast.id ? "1" : "0"}>
      {toast?.text}
    </div>
  );
}

export function Help() {
  const open = useAC((s) => s.help);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (open && !el?.open) el?.showModal();
    else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog ref={dialog} onClose={() => acStore.getState().setHelp(false)} className="ac-guide" data-testid="help" aria-labelledby="ac-guide-title">
      <button type="button" className="ac-guide-close" onClick={() => acStore.getState().setHelp(false)} aria-label="Close field guide">
        ×
      </button>
      <span className="ac-eyebrow">FIELD GUIDE</span>
      <h2 id="ac-guide-title">The animation camera</h2>
      <p>In animation the camera is virtual: a model of perspective, framing, movement, focus and blur. You can copy a cinema camera exactly, or break its rules on purpose. Five experiments, one scene.</p>
      <dl>
        <div className="ac-key"><dt>1 – 5</dt><dd>Choose the experiment</dd></div>
        <div className="ac-key"><dt>W · I · E</dt><dd>Watch · Inspect · Experiment</dd></div>
        <div className="ac-key"><dt>Space</dt><dd>Play or pause</dd></div>
        <div className="ac-key"><dt>, .</dt><dd>Step one frame (1/24 s)</dd></div>
        <div className="ac-key"><dt>P · V · C</dt><dd>Exp 1: projection · isometric · wipe compare</dd></div>
        <div className="ac-key"><dt>[ ]</dt><dd>Exp 2: previous / next lens</dd></div>
        <div className="ac-key"><dt>M · O</dt><dd>Exp 3: next style · orbit / track</dd></div>
        <div className="ac-key"><dt>S</dt><dd>Exp 4: photoreal / anime / split</dd></div>
        <div className="ac-key"><dt>D</dt><dd>Exp 5: next impossible shot</dd></div>
      </dl>
      <p className="ac-guide-note">Deep links: ?exp=1–5&amp;mode=watch|inspect|experiment, plus proj, view, focal, move, style, demo.</p>
    </dialog>
  );
}
