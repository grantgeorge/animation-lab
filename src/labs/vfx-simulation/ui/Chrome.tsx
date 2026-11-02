"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { FPS, LOOP_S } from "../engine/timing";
import { EXP_INFO, RELATED, TAGLINE } from "../content";
import { CATEGORIES, vxClock, vxStore, useVX, type Mode } from "../store";
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

/** A DOM window the orchestrator renders into. */
export function Slot({ id, children, className = "" }: { id: string; children?: ReactNode; className?: string }) {
  return (
    <div
      className={`vx-slot ${className}`}
      data-testid={`view-${id}`}
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
  const mode = useVX((s) => s.mode);
  return (
    <div role="radiogroup" aria-label="View mode" data-testid="mode-switch" className="vx-modes">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={m.id === mode} data-testid={`mode-${m.id}`} title={`${m.label}: ${m.hint} (${m.key})`} onClick={() => vxStore.getState().setMode(m.id)}>
          <span>{m.label}</span>
          <kbd>{m.key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function ExpTabs() {
  const exp = useVX((s) => s.exp);
  const tab = (id: typeof exp, n?: number) => (
    <button key={id} type="button" aria-current={exp === id ? "true" : undefined} data-testid={`exp-${id}`} onClick={() => vxStore.getState().setExp(id)}>
      {n !== undefined && <i className="mono">{n}</i>}
      {EXP_INFO[id].tab}
    </button>
  );
  return (
    <nav className="vx-exps" aria-label="Experiments" data-testid="exp-tabs">
      <div className="vx-exps-main">{(["bucket", "sync"] as const).map((id) => tab(id))}</div>
      <span className="vx-exps-sep" aria-hidden />
      <div className="vx-exps-cats">{CATEGORIES.map((id, i) => tab(id, i + 1))}</div>
    </nav>
  );
}

export function Header() {
  return (
    <header className="vx-header">
      <div className="vx-brand">
        <Link href="/" className="vx-home" data-testid="home-link" aria-label="Back to Animation Lab">
          <span aria-hidden>←</span>
          <span>Animation Lab</span>
        </Link>
        <i />
        <h1>VFX &amp; Simulation</h1>
      </div>
      <p>{TAGLINE}</p>
      <nav className="vx-related-top" aria-label="Related labs">
        {RELATED.slice(0, 2).map((r) => (
          <Link key={r.href} href={r.href} className="vx-xlink" title={r.why}>
            {r.label} <span aria-hidden>↗</span>
          </Link>
        ))}
      </nav>
      <button type="button" className="vx-help-btn" data-testid="help-button" onClick={() => vxStore.getState().setHelp(true)}>
        Field guide <span>?</span>
      </button>
    </header>
  );
}

export function Transport({ compact = false }: { compact?: boolean }) {
  const playing = useVX((s) => s.playing);
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
    <div className={`vx-transport${compact ? " vx-transport-compact" : ""}`} data-testid="transport">
      <button type="button" className="vx-play" data-testid="play" aria-label={playing ? "Pause" : "Play"} onClick={() => vxStore.getState().togglePlay()}>
        {playing ? "❚❚" : "▶"}
      </button>
      <button type="button" aria-label="Previous frame" data-testid="prev-frame" onClick={() => vxStore.getState().stepFrames(-1)}>
        ‹
      </button>
      <button type="button" aria-label="Next frame" data-testid="next-frame" onClick={() => vxStore.getState().stepFrames(1)}>
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
          setScrub(vxClock.peek());
          vxStore.getState().pause();
        }}
        onPointerUp={() => setScrub(null)}
        onChange={(e) => vxStore.getState().seek(Number(e.target.value))}
      />
      <LiveText className="vx-time mono" data-testid="time" get={() => `f${String(live.frame).padStart(2, "0")} · ${live.t.toFixed(2)} s`} />
    </div>
  );
}

export function Toast() {
  const toast = useVX((s) => s.toast);
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
    <div role="status" aria-live="polite" className="vx-toast" data-show={toast && shown === toast.id ? "1" : "0"}>
      {toast?.text}
    </div>
  );
}

export function Help() {
  const open = useVX((s) => s.help);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (open && !el?.open) el?.showModal();
    else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog ref={dialog} onClose={() => vxStore.getState().setHelp(false)} className="vx-guide" data-testid="help" aria-labelledby="vx-guide-title">
      <button type="button" className="vx-guide-close" onClick={() => vxStore.getState().setHelp(false)} aria-label="Close field guide">
        ×
      </button>
      <span className="vx-eyebrow">FIELD GUIDE</span>
      <h2 id="vx-guide-title">VFX &amp; simulation</h2>
      <p>
        Simulation is one way to make effects: a solver moves every droplet so no one has to. It is not the same as animating them. This lab plays one beat, Pip kicking over a bucket, as a real particle fluid, an authored cartoon splash and hand-drawn effects poses, and measures how long each splash reads as a shape. Then it couples the splash to Pip&apos;s flinch, and runs the same simulated-versus-keyed comparison across six kinds of effect.
      </p>
      <dl>
        <div className="vx-key"><dt>W · I · E</dt><dd>Watch · Inspect · Experiment</dd></div>
        <div className="vx-key"><dt>1 · 2 · 3</dt><dd>Realistic · Cartoon · Hand-drawn</dd></div>
        <div className="vx-key"><dt>C</dt><dd>Compare the three side by side</dd></div>
        <div className="vx-key"><dt>Space</dt><dd>Play or pause</dd></div>
        <div className="vx-key"><dt>, .</dt><dd>Step one frame (1/24 s)</dd></div>
      </dl>
      <p className="vx-guide-note">Deep links: ?exp=bucket|sync|fire|water|rigid|cloth|magic|drawn · ?tr=real|cartoon|drawn · ?compare=1 · ?g ?visc ?int ?count ?turb ?styl · ?step=1|2|3 ?hold ?antic · ?offset · ?look=real|stylized ?motion=sim|keyed ?v · ?t (freeze at seconds).</p>
    </dialog>
  );
}
