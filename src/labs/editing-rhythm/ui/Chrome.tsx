"use client";

import Link from "next/link";
import { EXPERIMENTS, type Mode } from "../engine/types";
import { sound } from "../audio/synth";
import { erStore, useER } from "../store";
import { EXP_INFO } from "./content";

const MODES: { id: Mode; label: string; key: string }[] = [
  { id: "watch", label: "Watch", key: "W" },
  { id: "inspect", label: "Inspect", key: "I" },
  { id: "experiment", label: "Experiment", key: "E" },
];

export function ModeSwitch() {
  const mode = useER((s) => s.mode);
  return (
    <div role="radiogroup" aria-label="View mode" className="er-modes" data-testid="mode-switch">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} data-testid={`mode-${m.id}`} title={`${m.label} (${m.key})`} onClick={() => erStore.getState().setMode(m.id)}>
          {m.label}
          <i className="mono">{m.key}</i>
        </button>
      ))}
    </div>
  );
}

export function ExpTabs() {
  const exp = useER((s) => s.exp);
  return (
    <nav className="er-exps" aria-label="Concept experiments" data-testid="exp-tabs">
      {EXPERIMENTS.map((x, i) => (
        <button key={x} type="button" aria-current={exp === x ? "true" : undefined} data-testid={`exp-${x}`} onClick={() => erStore.getState().setExp(x)}>
          {i > 0 && <i className="mono">{String.fromCharCode(96 + i)}</i>}
          {EXP_INFO[x].tab}
        </button>
      ))}
    </nav>
  );
}

export function SoundToggle() {
  const muted = useER((s) => s.muted);
  const unlocked = useER((s) => s.audioUnlocked);
  const label = !unlocked ? "Sound off · click to enable" : muted ? "Sound muted" : "Sound on";
  return (
    <button
      type="button"
      className="er-sound"
      data-testid="sound-toggle"
      data-state={!unlocked ? "locked" : muted ? "muted" : "on"}
      aria-pressed={unlocked && !muted}
      onClick={() => {
        const s = erStore.getState();
        if (!s.audioUnlocked) {
          s.unlockAudio();
          sound.unlock();
          s.setMuted(false);
          sound.setMuted(false);
          return;
        }
        s.setMuted(!s.muted);
        sound.setMuted(!s.muted);
      }}
    >
      <span aria-hidden className="er-sound-icon">{!unlocked || muted ? "◌" : "◉"}</span>
      {label}
    </button>
  );
}

export function Header() {
  return (
    <header className="er-header">
      <div className="er-brand">
        <Link href="/" className="er-home" data-testid="home-link">
          <span aria-hidden>←</span>
          <span>Animation Lab</span>
        </Link>
        <i />
        <h1>Editing &amp; Rhythm</h1>
      </div>
      <p>Same footage. Different film.</p>
      <Link href="/labs/storyboards-animatics" className="er-boards" data-testid="animatics-link" title="Boards first: lock the story on static panels, then cut live footage here">
        Boards first: Animatics ↗
      </Link>
      <SoundToggle />
    </header>
  );
}

export function Transport({ compareToggle = false }: { compareToggle?: boolean }) {
  const playing = useER((s) => s.playing);
  const compare = useER((s) => s.compare);
  const compareWith = useER((s) => s.compareWith);
  const preset = useER((s) => s.preset);
  return (
    <div className="er-transport" data-testid="transport">
      <button type="button" className="er-play" data-testid="play" aria-label={playing ? "Pause" : "Play"} onClick={() => erStore.getState().togglePlay()}>
        {playing ? "❚❚" : "▶"}
      </button>
      <button type="button" className="er-icon" data-testid="restart" aria-label="Back to the start" onClick={() => erStore.getState().seek(0)}>
        ⏮
      </button>
      {compareToggle && (
        <div className="er-compare-ctl">
          <button type="button" className={`er-toggle${compare ? " er-toggle-on" : ""}`} aria-pressed={compare} data-testid="compare-toggle" onClick={() => erStore.getState().setCompare(!compare)}>
            Compare side by side
          </button>
          {compare && (
            <select aria-label="Compare with" data-testid="compare-with" value={compareWith} onChange={(e) => erStore.getState().setCompare(true, e.target.value as typeof compareWith)}>
              {(["suspense", "comedy", "action", "emotion"] as const)
                .filter((p) => p !== preset)
                .map((p) => (
                  <option key={p} value={p}>
                    vs {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
