"use client";

import Link from "next/link";
import { ptStore, usePT, type Mode, type Section } from "../store";
import { useLiveTick } from "./hooks";
import { live } from "../live";

const MODES: { id: Mode; label: string; key: string }[] = [
  { id: "watch", label: "Watch", key: "W" },
  { id: "inspect", label: "Inspect", key: "I" },
  { id: "experiment", label: "Experiment", key: "E" },
];

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: "look", label: "Build the look", hint: "five techniques" },
  { id: "test", label: "Stick or crawl", hint: "temporal consistency" },
];

export function Header() {
  return (
    <header className="pt-header">
      <div className="pt-brand">
        <Link href="/" className="pt-home" data-testid="home-link" aria-label="Back to Animation Lab">
          <span aria-hidden>←</span>
          <span>Animation Lab</span>
        </Link>
        <i />
        <h1>Painterly Textures</h1>
      </div>
      <p>
        Paint belongs to the <b>surface</b>. Filters belong to the <b>screen</b>.
      </p>
      <button type="button" className="pt-help" data-testid="help-button" onClick={() => ptStore.getState().setHelp(true)}>
        Field guide <span>?</span>
      </button>
    </header>
  );
}

export function Toolbar() {
  const section = usePT((s) => s.section);
  const mode = usePT((s) => s.mode);
  const playing = usePT((s) => s.playing);
  useLiveTick(120);
  return (
    <div className="pt-toolbar">
      <div role="tablist" aria-label="Section" className="pt-sections" data-testid="section-switch">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            data-testid={`section-${s.id}`}
            onClick={() => ptStore.getState().setSection(s.id)}
          >
            <span className="pt-sec-n">{i + 1}</span>
            <span>
              <b>{s.label}</b>
              <small>{s.hint}</small>
            </span>
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="View mode" className="pt-modes" data-testid="mode-switch">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} data-testid={`mode-${m.id}`} title={`${m.label} (${m.key})`} onClick={() => ptStore.getState().setMode(m.id)}>
            {m.label}
            <kbd>{m.key}</kbd>
          </button>
        ))}
      </div>
      <div className="pt-transport">
        <button type="button" data-testid="play-toggle" aria-label={playing ? "Pause" : "Play"} onClick={() => ptStore.getState().togglePlay()}>
          {playing ? (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
              <rect x="1" y="1" width="3" height="10" rx="1" fill="currentColor" />
              <rect x="6" y="1" width="3" height="10" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
              <path d="M1.5 1.2v9.6L9.5 6z" fill="currentColor" />
            </svg>
          )}
        </button>
        <span className="mono" data-testid="time-readout">
          {live.t.toFixed(2)} s · f{String(Math.floor(live.t * 24)).padStart(3, "0")}
        </span>
      </div>
    </div>
  );
}
