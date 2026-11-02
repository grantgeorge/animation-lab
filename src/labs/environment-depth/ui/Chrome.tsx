"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import Link from "next/link";
import { FPS, LOOP_S } from "../engine/camera";
import { TAGLINE } from "../content";
import { edClock, edStore, useED, type Mode } from "../store";
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

/** A bar whose fill (0..1) follows the render loop. Optional second segment stacked after it. */
export function LiveBar({ get, className = "", testId }: { get: () => [number, number?]; className?: string; testId?: string }) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const fn = useRef(get);
  useEffect(() => {
    fn.current = get;
  });
  useEffect(
    () =>
      onAfterFrame(() => {
        const [x, y = 0] = fn.current();
        const wa = `${(Math.max(0, Math.min(1, x)) * 100).toFixed(1)}%`;
        const wb = `${(Math.max(0, Math.min(1, y)) * 100).toFixed(1)}%`;
        if (a.current && a.current.style.width !== wa) a.current.style.width = wa;
        if (b.current && b.current.style.width !== wb) b.current.style.width = wb;
      }),
    [],
  );
  return (
    <span className={`ed-bar ${className}`} data-testid={testId}>
      <span ref={a} className="ed-bar-a" />
      <span ref={b} className="ed-bar-b" />
    </span>
  );
}

/** A DOM window the orchestrator renders a camera into. */
export function Slot({ id, className = "", children, testId }: { id: string; className?: string; children?: React.ReactNode; testId?: string }) {
  return (
    <div
      className={`ed-slot ${className}`}
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
  const mode = useED((s) => s.mode);
  return (
    <div role="radiogroup" aria-label="View mode" data-testid="mode-switch" className="ed-modes">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={m.id === mode} data-testid={`mode-${m.id}`} title={`${m.label}: ${m.hint} (${m.key})`} onClick={() => edStore.getState().setMode(m.id)}>
          <span>{m.label}</span>
          <kbd>{m.key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function Header() {
  return (
    <header className="ed-header">
      <div className="ed-brand">
        <Link href="/" className="ed-home" data-testid="home-link" aria-label="Back to Animation Lab">
          <span aria-hidden>←</span>
          <span>Animation Lab</span>
        </Link>
        <i />
        <h1>Environment &amp; Depth</h1>
      </div>
      <p>{TAGLINE}</p>
      <Link href="/labs/animation-camera?exp=3" className="ed-xlink" data-testid="animation-camera-link">
        Camera types: 2D · 2.5D · 3D <span aria-hidden>↗</span>
      </Link>
      <button type="button" className="ed-help-btn" data-testid="help-button" onClick={() => edStore.getState().setHelp(true)}>
        Field guide <span>?</span>
      </button>
    </header>
  );
}

export function Transport() {
  const playing = useED((s) => s.playing);
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
    <div className="ed-transport" data-testid="transport">
      <button type="button" data-testid="play" aria-label={playing ? "Pause" : "Play"} onClick={() => edStore.getState().togglePlay()}>
        {playing ? "❚❚" : "▶"}
      </button>
      <button type="button" aria-label="Previous frame" onClick={() => edStore.getState().stepFrames(-1)}>
        ‹
      </button>
      <button type="button" aria-label="Next frame" onClick={() => edStore.getState().stepFrames(1)}>
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
          setScrub(edClock.peek());
          edStore.getState().pause();
        }}
        onPointerUp={() => setScrub(null)}
        onChange={(e) => edStore.getState().seek(Number(e.target.value))}
      />
      <LiveText className="ed-time" data-testid="time" get={() => `${live.t.toFixed(2)} s · move ${Math.round(live.u * 100)}%`} />
    </div>
  );
}

export function Toast() {
  const toast = useED((s) => s.toast);
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
    <div role="status" aria-live="polite" className="ed-toast" data-show={toast && shown === toast.id ? "1" : "0"}>
      {toast?.text}
    </div>
  );
}

export function Help() {
  const open = useED((s) => s.help);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (open && !el?.open) el?.showModal();
    else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog ref={dialog} onClose={() => edStore.getState().setHelp(false)} className="ed-guide" data-testid="help" aria-labelledby="ed-guide-title">
      <button type="button" className="ed-guide-close" onClick={() => edStore.getState().setHelp(false)} aria-label="Close field guide">
        ×
      </button>
      <span className="ed-eyebrow">FIELD GUIDE</span>
      <h2 id="ed-guide-title">Environment &amp; depth</h2>
      <p>
        One forest, seven depth cues, three ways to build it. Flatten the frame and add the cues back one at a time, then run the same camera move through a flat painting, a stack of depth layers and the real geometry, and measure how much of the picture each move reveals.
      </p>
      <dl>
        <div className="ed-key"><dt>W · I · E</dt><dd>Watch · Inspect · Experiment</dd></div>
        <div className="ed-key"><dt>1 · 2 · 3</dt><dd>Construction: 2D · 2.5D · 3D</dd></div>
        <div className="ed-key"><dt>P · T · A</dt><dd>Move: push · track · arc</dd></div>
        <div className="ed-key"><dt>F · N</dt><dd>Flatten · add the next cue</dd></div>
        <div className="ed-key"><dt>R · B</dt><dd>Overlay: revealed pixels · depth bands</dd></div>
        <div className="ed-key"><dt>Space</dt><dd>Play or pause</dd></div>
        <div className="ed-key"><dt>, .</dt><dd>Step one frame (1/24 s)</dd></div>
      </dl>
      <p className="ed-guide-note">Deep links: ?mode=watch|inspect|experiment · ?construct=2d|25d|3d · ?move=push|track|arc · ?cue=flat|all|parallax|haze|layers|scale|occlusion|dof|perspective · ?step=0–7 · ?overlay=reveal|bands · ?u=0–1 (freeze the move).</p>
    </dialog>
  );
}
