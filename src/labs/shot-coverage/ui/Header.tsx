"use client";

import Link from "next/link";
import { SCENES } from "@/labs/lens-and-framing/config";
import { scStore, useSC, type Mode } from "../store";

const MODES: { id: Mode; label: string; key: string; hint: string }[] = [
  { id: "watch", label: "Watch", key: "W", hint: "finished cut" },
  { id: "inspect", label: "Inspect", key: "I", hint: "cameras & line" },
  { id: "experiment", label: "Experiment", key: "E", hint: "shoot & cut" },
];

export function ModeSwitch({ compact = false }: { compact?: boolean }) {
  const mode = useSC((s) => s.mode);
  return (
    <div role="radiogroup" aria-label="View mode" data-testid="mode-switch" className="flex gap-0.5 rounded-[12px] border border-white/10 bg-black/40 p-0.5">
      {MODES.map((m) => {
        const on = m.id === mode;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`mode-${m.id}`}
            title={`${m.label}: ${m.hint} (${m.key})`}
            onClick={() => scStore.getState().setMode(m.id)}
            className={`flex-1 rounded-[10px] px-2.5 text-left transition-colors ${compact ? "py-1" : "py-1.5"} ${on ? "bg-[#E9EEF4] text-[#0B0E14]" : "text-ink-1 hover:bg-white/10"}`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-semibold leading-tight">{m.label}</span>
              <span className={`mono text-[9.5px] ${on ? "text-[#3a4250]" : "text-ink-3"}`}>{m.key}</span>
            </span>
            {!compact && <span className={`mono block text-[9.5px] leading-tight ${on ? "text-[#3a4250]" : "text-ink-2"}`}>{m.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ScenePicker({ compact = false }: { compact?: boolean }) {
  const sceneId = useSC((s) => s.sceneId);
  return (
    <div role="radiogroup" aria-label="Scene" className="flex gap-1.5" data-testid="scene-picker">
      {SCENES.map((s) => {
        const on = s.scene.id === sceneId;
        return (
          <button
            key={s.scene.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`scene-${s.scene.id}`}
            onClick={() => scStore.getState().setScene(s.scene.id)}
            className={`rounded-lg border px-2.5 text-left transition-colors ${compact ? "py-1" : "py-1"} ${on ? "border-transparent bg-[#E9EEF4] text-[#0B0E14]" : "border-white/10 bg-white/[0.04] text-ink-1 hover:bg-white/[0.08]"}`}
          >
            <span className="block text-[12px] font-semibold leading-tight">{s.scene.title.replace(/^The /, "")}</span>
            {!compact && <span className={`mono block text-[9px] uppercase tracking-wider ${on ? "text-[#3a4250]" : "text-ink-2"}`}>{s.scene.genre}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Header() {
  return <header className="sc-header">
    <div className="sc-brand"><Link href="/" className="sc-home" data-testid="home-link" aria-label="Back to Animation Lab"><span aria-hidden>←</span><span>Animation Lab</span></Link><i /><h1>Shot Coverage &amp; Editing</h1></div>
    <p>Choose the angle. Find the cut.</p>
    <button type="button" className="sc-help" data-testid="help-button" onClick={() => scStore.getState().setHelp(true)}>Field guide <span>?</span></button>
  </header>;
}
