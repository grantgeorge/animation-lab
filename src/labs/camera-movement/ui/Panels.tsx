"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SCENES, sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { SectionLabel, Segmented } from "@/ui/primitives";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { MOVE_INFO, MOVE_ORDER } from "../engine/moves";
import { analyzeMove, movePhrase } from "../engine/analyze";
import { v3 } from "../engine/math";
import type { Ease, MoveKind } from "../engine/types";
import { DOLLY_VS_ZOOM, MOVE_COPY } from "../content";
import { cmClock, cmStore, currentViews, subjectsFor, useCM } from "../store";
import { live, slots } from "../runtime/live";

/** Tiny top-down glyphs of each move: camera (dot), path (line), subject (ring). */
const GLYPH: Record<MoveKind, string> = {
  static: "M12 18v0",
  dollyIn: "M12 21V9",
  dollyOut: "M12 9v12",
  zoomIn: "M8 14l4-5 4 5",
  pan: "M7 13a7 7 0 0 1 10 0",
  tilt: "M12 20c3-3 3-8 0-11",
  truck: "M5 18h14",
  crane: "M8 20l8-8",
  orbit: "M5 13a7 7 0 0 0 14 0",
  tracking: "M5 19l14-8",
  dollyZoom: "M12 21V11M8 9l4 3 4-3",
};

function Glyph({ kind, on }: { kind: MoveKind; on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="5" r="2.2" fill="none" stroke={on ? "#ead3ad" : "#8e9b9c"} strokeWidth="1.4" />
      <path d={GLYPH[kind]} fill="none" stroke={on ? "#ead3ad" : "#a4afbd"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Header({ onHelp }: { onHelp: () => void }) {
  return <header className="cm-header">
    <div className="cm-brand"><Link href="/" className="cm-home" data-testid="home-link" aria-label="Back to Animation Lab"><span aria-hidden>←</span><span>Animation Lab</span></Link><i /><h1>Camera Movement</h1></div>
    <p>Move the camera. Shape the feeling.</p>
    <button type="button" className="cm-help" data-testid="help-button" onClick={onHelp}>Field guide <span>?</span></button>
  </header>;
}

export function ScenePicker() {
  const sceneId = useCM((s) => s.sceneId);
  return <div role="radiogroup" aria-label="Scene" className="cm-scenes" data-testid="scene-picker">
    {SCENES.map((s) => <button key={s.scene.id} type="button" role="radio" aria-checked={s.scene.id === sceneId} data-testid={`scene-${s.scene.id}`} onClick={() => cmStore.getState().setScene(s.scene.id)}>{s.scene.title.replace(/^The /, "")}</button>)}
  </div>;
}

export function FieldGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; if (open && !el?.open) el?.showModal(); else if (!open && el?.open) el.close(); }, [open]);
  return <dialog ref={dialog} onClose={onClose} className="cm-guide" data-testid="help" aria-labelledby="cm-guide-title">
    <button type="button" className="cm-guide-close" onClick={onClose} aria-label="Close field guide">×</button>
    <span className="cm-eyebrow">FIELD GUIDE</span><h2 id="cm-guide-title">Camera movement</h2>
    <p>Choose a move and watch the camera frame. Open Studio to see the path, then drag its amber endpoints to reshape it. Shift-drag changes their height.</p>
    <h3>One thing to notice</h3><p>A dolly changes perspective because the camera moves. A zoom changes the crop from the same position. Compare them side by side and watch the background.</p>
    <dl><dt>1–0</dt><dd>Choose a move</dd><dt>C / Z</dt><dd>Dolly vs zoom / dolly zoom</dd><dt>Space</dt><dd>Play or pause</dd><dt>Home · , .</dt><dd>Restart · step one frame</dd><dt>R</dt><dd>Reset the edited path</dd><dt>?</dt><dd>Open this field guide</dd></dl>
    <p className="cm-guide-note">The scene and performance stay the same so you can concentrate on what the camera changes.</p>
  </dialog>;
}

export function MovePicker() {
  const kind = useCM((s) => s.kind);
  const experiment = useCM((s) => s.experiment);
  return (
    <div className="cm-moves" data-testid="move-picker">
      <SectionLabel hint="C · Z">Experiments</SectionLabel>
      <div className="mb-2.5 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          data-testid="exp-dolly-vs-zoom"
          aria-pressed={experiment === "dollyVsZoom"}
          onClick={() => cmStore.getState().setExperiment("dollyVsZoom")}
          className={`rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${experiment === "dollyVsZoom" ? "bg-[#FFB547] text-[#0B0E14]" : "bg-[rgb(255_181_71/0.12)] text-distance hover:bg-[rgb(255_181_71/0.2)]"}`}
        >
          Dolly vs zoom
          <span className="mono block text-[9.5px] font-normal opacity-80">same framing, two ways</span>
        </button>
        <button
          type="button"
          data-testid="exp-dolly-zoom"
          aria-pressed={experiment === "move" && kind === "dollyZoom"}
          onClick={() => cmStore.getState().setKind("dollyZoom")}
          className={`rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${experiment === "move" && kind === "dollyZoom" ? "bg-[#FFB547] text-[#0B0E14]" : "bg-[rgb(255_181_71/0.12)] text-distance hover:bg-[rgb(255_181_71/0.2)]"}`}
        >
          Dolly zoom
          <span className="mono block text-[9.5px] font-normal opacity-80">the vertigo effect</span>
        </button>
      </div>
      <SectionLabel hint="1–0">Moves</SectionLabel>
      <div className="grid grid-cols-5 gap-1">
        {MOVE_ORDER.filter((k) => k !== "dollyZoom").map((k, i) => {
          const on = experiment === "move" && k === kind;
          return (
            <button
              key={k}
              type="button"
              data-testid={`move-${k}`}
              aria-pressed={on}
              title={`${MOVE_INFO[k].label} (${(i + 1) % 10})`}
              onClick={() => cmStore.getState().setKind(k)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10.5px] font-medium leading-tight transition-colors ${on ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.05] text-ink-1 hover:bg-white/[0.1]"}`}
            >
              <Glyph kind={k} on={on} />
              {MOVE_INFO[k].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What the move is, how it reads, and the operator's decomposition of the path you made. */
export function ConceptCard() {
  const version = useCM((s) => s.version);
  const experiment = useCM((s) => s.experiment);
  const kind = useCM((s) => s.kind);
  const sceneId = useCM((s) => s.sceneId);
  const { an, phrase } = useMemo(() => {
    const v = currentViews()[0];
    const subj = subjectsFor(sceneId);
    const an = analyzeMove(v.move, d, subj);
    return { an, phrase: movePhrase(v.move, d, an) };
  }, [version, sceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = experiment === "dollyVsZoom" ? null : MOVE_COPY[kind];
  return (
    <section className="cm-study" data-testid="concept-card">
      <div className="cm-study-copy"><span className="cm-eyebrow">WHAT CHANGES</span><h2>{experiment === "dollyVsZoom" ? DOLLY_VS_ZOOM.title : MOVE_INFO[kind].label}</h2>
        <p>{experiment === "dollyVsZoom" ? DOLLY_VS_ZOOM.body.replaceAll("the doorway", d.labels.midground) : copy?.what}</p>
        {copy && <p className="cm-feeling">{copy.feel}</p>}
      </div>
      <div className="cm-experiment"><span className="cm-eyebrow">TRY THIS</span><p>{copy?.prompt ?? DOLLY_VS_ZOOM.prompt}</p>
        <div className="cm-components" data-testid="move-components">{an.components.map((c) => <span key={c}>{c}</span>)}<span>{an.startSize === an.endSize ? an.startSize : `${an.startSize} → ${an.endSize}`}</span></div>
      </div>
      <PromptLine phrase={phrase} />
    </section>
  );
}

function PromptLine({ phrase }: { phrase: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="cm-prompt">
      <div className="mb-1 flex items-center justify-between">
        <span className="micro text-[9px]">SHOT NOTES</span>
        <button
          type="button"
          data-testid="copy-prompt"
          className="mono rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-ink-1 hover:bg-white/15"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(phrase);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {
              /* clipboard unavailable: the text stays selectable */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mono select-all text-[11px] leading-snug text-ink-0" data-testid="prompt-phrase">
        {phrase}
      </p>
    </div>
  );
}

const fmt = (v: number, unit: string) => (unit === "×" ? `${v.toFixed(1)}×` : unit === "°" ? `${v > 0 ? "+" : ""}${Math.round(v)}°` : `${v.toFixed(1)} m`);

export function ParamsPanel() {
  const kind = useCM((s) => s.kind);
  const experiment = useCM((s) => s.experiment);
  const p = useCM((s) => s.params);
  const overrides = useCM((s) => s.overrides);
  const T = d.timeline.durationS;
  const info = MOVE_INFO[kind];
  const amount = experiment === "dollyVsZoom" ? { label: "Push in", unit: "m", min: 0.8, max: 3.2, step: 0.1 } : info.amount;
  const set = cmStore.getState().setParams;
  const lmin = Math.log(18);
  const lmax = Math.log(135);
  return (
    <section data-ui aria-label="Move controls" className="cm-params" data-testid="move-controls">
      <SectionLabel>{experiment === "dollyVsZoom" ? "Dolly vs zoom" : info.label}</SectionLabel>
      <label className="block">
        <div className="mb-0.5 flex items-baseline justify-between text-[11.5px]">
          <span className="text-ink-1">{amount.label}</span>
          <span className="mono text-distance" data-testid="amount-readout">
            {fmt(p.amount, amount.unit)}
          </span>
        </div>
        <input
          type="range"
          className="w-full accent-[#FFB547]"
          data-testid="amount-slider"
          min={amount.min}
          max={amount.max}
          step={amount.step}
          value={Math.min(amount.max, Math.max(amount.min, p.amount))}
          onChange={(e) => set({ amount: Number(e.target.value) })}
        />
      </label>
      <label className="mt-2 block">
        <div className="mb-0.5 flex items-baseline justify-between text-[11.5px]">
          <span className="text-ink-1">{kind === "dollyZoom" && experiment === "move" ? "Starting lens" : "Lens"}</span>
          <span className="mono text-focal-text" data-testid="focal-readout">
            {Math.round(p.focalMm)} mm
          </span>
        </div>
        <input
          type="range"
          className="w-full accent-[#5FE3FF]"
          data-testid="focal-slider"
          min={0}
          max={1000}
          value={Math.round(((Math.log(p.focalMm) - lmin) / (lmax - lmin)) * 1000)}
          onChange={(e) => set({ focalMm: Math.round(Math.exp(lmin + (Number(e.target.value) / 1000) * (lmax - lmin))) })}
        />
      </label>
      <div className="mt-3">
        <SectionLabel>Subject</SectionLabel>
        <Segmented
          label="Subject"
          value={p.subject}
          onChange={(v) => set({ subject: v })}
          options={[
            { value: "primary", label: d.characters.primary.name, testId: "subject-primary" },
            { value: "secondary", label: d.characters.secondary.name, testId: "subject-secondary" },
          ]}
        />
      </div>
      <details className="cm-advanced" data-testid="move-advanced"><summary>Timing &amp; easing <span>Shape when the move happens</span></summary>
      <div className="mt-3">
        <SectionLabel>Speed curve</SectionLabel>
        <Segmented<Ease>
          label="Easing"
          value={p.ease}
          onChange={(v) => set({ ease: v })}
          options={[
            { value: "linear", label: "Linear", testId: "ease-linear" },
            { value: "inOut", label: "Ease", testId: "ease-inOut" },
            { value: "in", label: "In", testId: "ease-in" },
            { value: "out", label: "Out", testId: "ease-out" },
          ]}
        />
      </div>
      <div className="mt-3">
        <SectionLabel>
          Move window · {p.t0.toFixed(1)}–{p.t1.toFixed(1)} s
        </SectionLabel>
        <div className="flex gap-2">
          <input type="range" aria-label="Move start" data-testid="t0-slider" className="w-1/2 accent-[#8EF0C3]" min={0} max={T} step={0.1} value={p.t0} onChange={(e) => set({ t0: Math.min(Number(e.target.value), p.t1 - 0.3) })} />
          <input type="range" aria-label="Move end" data-testid="t1-slider" className="w-1/2 accent-[#8EF0C3]" min={0} max={T} step={0.1} value={p.t1} onChange={(e) => set({ t1: Math.max(Number(e.target.value), p.t0 + 0.3) })} />
        </div>
      </div>
      </details>
      {experiment === "move" && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11px] leading-snug text-ink-2">Drag the amber rings on the stage. Shift-drag to raise or lower.</p>
          <button
            type="button"
            data-testid="reset-path"
            disabled={!overrides.start && !overrides.end}
            onClick={() => cmStore.getState().resetPath()}
            className="mono shrink-0 rounded-md bg-white/[0.08] px-2 py-1 text-[10.5px] text-ink-1 hover:bg-white/15 disabled:opacity-35"
          >
            Reset path
          </button>
        </div>
      )}
    </section>
  );
}

/** One monitor: a transparent window the orchestrator renders into, with live readouts. */
function Monitor({ id, label, accent, index, compact }: { id: "A" | "B"; label: string; accent: string; index: number; compact: boolean }) {
  const win = useRef<HTMLDivElement>(null);
  const read = useRef<HTMLSpanElement>(null);
  const bg = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = win.current;
    if (!el) return;
    slots.set(id, el);
    return () => {
      if (slots.get(id) === el) slots.delete(id);
    };
  }, [id]);
  useFrameUpdater(() => {
    const p = live.poses[index];
    if (!p || !read.current) return;
    const dist = v3(p.target).distanceTo(p.position);
    read.current.textContent = `${Math.round(p.focalMm)} mm · ${dist.toFixed(1)} m · ${Math.round((live.fractions[index] ?? 0) * 100)}% ht`;
    if (bg.current) {
      // Background magnification vs the start frame: f/depth of the midground reference.
      const views = currentViews();
      const m = views[index]?.move;
      if (m) {
        const mid = d.set.doorway;
        const ref = v3([(mid.openingX[0] + mid.openingX[1]) / 2, 1, mid.z]);
        const scaleOf = (pos: { x: number; y: number; z: number }, f: number) => f / Math.max(0.1, ref.distanceTo(v3([pos.x, pos.y, pos.z])));
        const s0 = scaleOf(v3(m.start.position), m.start.focalMm);
        bg.current.textContent = `${d.labels.midground.replace(/^the /, "")} ${(scaleOf(p.position, p.focalMm) / s0).toFixed(2)}×`;
      }
    }
  }, ORDER.MEASURE);
  return (
    <div className="flex min-w-0 flex-1 flex-col" data-testid={`monitor-${id}`}>
      <div className="cm-monitor-frame" style={{ aspectRatio: "16 / 9" }}>
        <div ref={win} className="absolute inset-0" data-testid={`monitor-window-${id}`} />
        <span className="mono pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: accent }}>
          {label.toUpperCase()}
        </span>
        <span ref={read} className="mono pointer-events-none absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10.5px] text-ink-0" data-testid={`monitor-readout-${id}`} />
        <span ref={bg} className={`mono pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10.5px] text-distance ${compact ? "" : ""}`} data-testid={`monitor-bg-${id}`} />
      </div>
    </div>
  );
}

export function Monitors() {
  const version = useCM((s) => s.version);
  const views = useMemo(() => currentViews(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const two = views.length > 1;
  return (
    <div
      data-ui
      className="cm-monitors"
      data-count={two ? "2" : "1"}
    >
      {views.map((v, i) => (
        <Monitor key={v.id} id={v.id} label={v.label} index={i} accent={i ? "#C9A7FF" : "#5FE3FF"} compact={two} />
      ))}
    </div>
  );
}

export function Timeline() {
  const playing = useCM((s) => s.playing);
  const p = useCM((s) => s.params);
  const T = d.timeline.durationS;
  const head = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useFrameUpdater(({ t }) => {
    if (head.current) head.current.style.left = `${(t / T) * 100}%`;
    if (time.current) time.current.textContent = `${t.toFixed(2)} s`;
    if (input.current) input.current.value = String(t);
  }, ORDER.MEASURE);
  const scrub = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    cmStore.getState().seek(Math.min(T - 1e-3, Math.max(0, ((clientX - r.left) / r.width) * T)));
  };
  return (
    <div data-ui className="cm-timeline" data-testid="timeline">
      <button type="button" data-testid="play-toggle" aria-label={playing ? "Pause" : "Play"} onClick={() => cmStore.getState().togglePlay()} className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/[0.07] text-ink-0 hover:bg-white/15">
        {playing ? "❚❚" : "▶"}
      </button>
      <button type="button" aria-label="Restart" onClick={() => cmStore.getState().seek(0)} className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/[0.07] text-ink-0 hover:bg-white/15">
        ⏮
      </button>
      <div
        ref={track}
        className="relative h-8 flex-1 cursor-pointer"
        data-testid="timeline-track"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          scrub(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && scrub(e.clientX)}
      >
        <div className="absolute inset-x-0 top-[15px] h-[2px] rounded bg-white/15" />
        <div className="absolute top-[11px] h-[10px] rounded bg-[rgb(142_240_195/0.25)]" style={{ left: `${(p.t0 / T) * 100}%`, width: `${((p.t1 - p.t0) / T) * 100}%` }} title="Move window" />
        <div ref={head} className="absolute top-[6px] h-5 w-[2px] -translate-x-1/2 rounded bg-[#5FE3FF]" />
        <input ref={input} className="cm-time-input" type="range" min={0} max={T - 1 / 24} step={1 / 24} defaultValue={0} aria-label="Performance time" data-testid="scrubber" onPointerDown={(e) => e.stopPropagation()} onChange={(e) => { cmStore.getState().pause(); cmStore.getState().seek(Number(e.target.value)); }} />
      </div>
      <span ref={time} className="mono w-[58px] text-right text-[12px] text-ink-1" data-testid="time-readout" />
    </div>
  );
}

export function Toast() {
  const toast = useCM((s) => s.toast);
  const [hiddenId, setHiddenId] = useState(0);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setHiddenId(toast.id), 1400);
    return () => clearTimeout(h);
  }, [toast]);
  const shown = toast && toast.id !== hiddenId ? toast : null;
  if (!shown) return null;
  return (
    <div role="status" className="cm-toast">
      {shown.text}
    </div>
  );
}

/** Seconds of the current clock (for the test hook). */
export const nowS = () => cmClock.peek();
