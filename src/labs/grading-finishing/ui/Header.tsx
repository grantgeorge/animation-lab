"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SHOTS } from "../engine/shots";
import { live } from "../runtime/live";
import { gfStore, useGF, type Mode, type View } from "../store";

const MODES: { id: Mode; label: string; key: string }[] = [
  { id: "watch", label: "Watch", key: "W" },
  { id: "inspect", label: "Inspect", key: "I" },
  { id: "experiment", label: "Experiment", key: "E" },
];

export function Header() {
  return (
    <header className="gf-header">
      <div className="gf-brand">
        <Link href="/" className="gf-home" data-testid="home-link" aria-label="Back to Animation Lab">
          <span aria-hidden>←</span>
          <span>Animation Lab</span>
        </Link>
        <i />
        <h1>Grading &amp; Finishing</h1>
      </div>
      <p>Grade the shot. Finish the show.</p>
      <button type="button" className="gf-help" data-testid="help-button" onClick={() => gfStore.getState().setHelp(true)}>
        Field guide <span>?</span>
      </button>
    </header>
  );
}

export function ModeSwitch() {
  const mode = useGF((s) => s.mode);
  return (
    <div role="radiogroup" aria-label="View mode" data-testid="mode-switch" className="gf-seg">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={m.id === mode} data-testid={`mode-${m.id}`} title={`${m.label} (${m.key})`} onClick={() => gfStore.getState().setMode(m.id)}>
          {m.label}
          <kbd>{m.key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function ViewTabs() {
  const view = useGF((s) => s.view);
  const items: { id: View; label: string }[] = [
    { id: "shot", label: "One shot" },
    { id: "show", label: "Show look · 3 shots" },
  ];
  return (
    <div role="radiogroup" aria-label="Scope" data-testid="view-switch" className="gf-seg gf-seg-quiet">
      {items.map((v) => (
        <button key={v.id} type="button" role="radio" aria-checked={v.id === view} data-testid={`view-${v.id}`} onClick={() => gfStore.getState().setView(v.id)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function ShotPicker() {
  const shot = useGF((s) => s.shot);
  return (
    <div role="radiogroup" aria-label="Shot" data-testid="shot-picker" className="gf-shots">
      {SHOTS.map((s) => (
        <button key={s.id} type="button" role="radio" aria-checked={s.id === shot} data-testid={`shot-${s.id}`} onClick={() => gfStore.getState().setShot(s.id)}>
          {s.label.replace(/^Shot \d · /, "")}
        </button>
      ))}
    </div>
  );
}

function useTimecode() {
  const [tc, setTc] = useState("00:00");
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const f = Math.round(live.t * 24);
      const s = `${String(Math.floor(f / 24)).padStart(2, "0")}:${String(f % 24).padStart(2, "0")}`;
      if (s !== last) setTc((last = s));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return tc;
}

export function Transport() {
  const playing = useGF((s) => s.playing);
  const tc = useTimecode();
  return (
    <div className="gf-transport">
      <button type="button" data-testid="play-toggle" aria-label={playing ? "Pause" : "Play"} onClick={() => gfStore.getState().togglePlay()}>
        {playing ? (
          <svg viewBox="0 0 12 12" aria-hidden><rect x="2" y="1.5" width="2.6" height="9" rx="0.6" /><rect x="7.4" y="1.5" width="2.6" height="9" rx="0.6" /></svg>
        ) : (
          <svg viewBox="0 0 12 12" aria-hidden><path d="M3 1.6v8.8L10.4 6z" /></svg>
        )}
      </button>
      <span className="mono" data-testid="timecode" title="Seconds:frames at 24 fps; the grain seed is the frame number">{tc}</span>
    </div>
  );
}
