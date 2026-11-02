"use client";

import { useEffect, useRef } from "react";
import { getScene } from "@/labs/lens-and-framing/config";
import { SHOT_SIZE_LABEL } from "@/engine/classify";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { frontSide } from "../engine/presets";
import { describeShot, type CharOnScreen, type Look, type ShotDescription } from "../engine/shots";
import { CAM_IDS, type CamId } from "../engine/types";
import type { ContinuityFlag } from "../engine/continuity";
import { BRAM_COLOR, CAM_COLOR, CROSS_COLOR, PIP_COLOR } from "../colors";
import { FLAG_TITLE } from "../content";
import { scStore, subjectsFor, useSC } from "../store";
import { live, slots, type SlotId } from "../runtime/live";
import { useAnalysis } from "./derived";

const ARROW: Record<Look, string> = { left: "←", right: "→", toward: "◉", away: "○" };
export const KIND_SHORT: Record<ShotDescription["kind"], string> = { master: "Master", "two-shot": "Two-shot", ots: "OTS", single: "Single" };

export function shotLabel(s: ShotDescription): string {
  const who = s.subject === "both" ? "" : s.subject === "primary" ? " · Bram" : " · Pip";
  return `${KIND_SHORT[s.kind]}${who} · ${s.size}`;
}

/** Writes text only when it changed (cheap per-frame DOM updates). */
const put = (el: HTMLElement | null, text: string) => {
  if (el && el.textContent !== text) el.textContent = text;
};

/** Text and opacity of one character chip; returns its desired left edge (px) in a frame W wide. */
function chip(el: HTMLElement, c: CharOnScreen, name: string, growLeft: boolean, W: number, compact: boolean) {
  const off = !c.inFront || c.x < -1 || c.x > 1;
  const sep = compact ? " " : " · ";
  put(el, `${off && c.x < 0 ? "‹ " : ""}${c.side}${sep}${name} ${ARROW[c.look]}${off && c.x >= 0 ? " ›" : ""}`);
  el.style.opacity = off ? "0.65" : "1";
  const x = Math.min(1, Math.max(0, (c.x + 1) / 2)) * W;
  return growLeft ? x - el.offsetWidth : x;
}

/**
 * Place both chips: each grows away from the other (so they don't collide in a two-shot), stays
 * inside the frame, and the pair is pushed apart if they would still overlap.
 */
function placeChips(bramEl: HTMLElement | null, pipEl: HTMLElement | null, b: CharOnScreen, p: CharOnScreen, compact: boolean) {
  if (!bramEl || !pipEl) return;
  const W = bramEl.parentElement?.clientWidth ?? 0;
  const bramLeft = b.side === "L";
  const [lEl, rEl] = bramLeft ? [bramEl, pipEl] : [pipEl, bramEl];
  const [lc, rc] = bramLeft ? [b, p] : [p, b];
  let l = chip(lEl, lc, lEl === bramEl ? "Bram" : "Pip", true, W, compact);
  let r = chip(rEl, rc, rEl === bramEl ? "Bram" : "Pip", false, W, compact);
  const lw = lEl.offsetWidth;
  const rw = rEl.offsetWidth;
  l = Math.min(W - rw - lw - 3, Math.max(0, l));
  r = Math.min(W - rw, Math.max(l + lw + 3, r));
  lEl.style.left = `${Math.round(Math.max(0, l))}px`;
  rEl.style.left = `${Math.round(r)}px`;
}

/**
 * One monitor: a transparent window the orchestrator renders into, with live overlays: camera and
 * shot type, which side of the line it is on, and where each character lands (L/R + eyeline arrow).
 * No glass on this or any ancestor: a backdrop filter would veil the live image.
 */
export function Monitor({ slot, variant, flags = [] }: { slot: SlotId; variant: "iso" | "program" | "watch"; flags?: ContinuityFlag[] }) {
  const win = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const kind = useRef<HTMLSpanElement>(null);
  const side = useRef<HTMLSpanElement>(null);
  const bram = useRef<HTMLSpanElement>(null);
  const pip = useRef<HTMLSpanElement>(null);
  const tally = useRef<HTMLSpanElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const flagsRef = useRef(flags);
  const memo = useRef({ shot: -1, kindAt: -99, cutFlashUntil: 0 });
  const sceneId = useSC((s) => s.sceneId);
  const selected = useSC((s) => s.selected);
  useEffect(() => {
    flagsRef.current = flags;
  }, [flags]);
  useEffect(() => {
    const el = win.current;
    if (!el) return;
    slots.set(slot, el);
    return () => {
      if (slots.get(slot) === el) slots.delete(slot);
    };
  }, [slot]);
  useFrameUpdater(({ t, frameId }) => {
    const id: CamId = slot === "P" || slot === "W" ? live.program : slot;
    const info = live.info[id];
    if (!info) return;
    const d = getScene(sceneId);
    placeChips(bram.current, pip.current, info.primary, info.secondary, variant === "iso");
    const rel = live.axis ? info.axisSide * frontSide(d, live.axis) : info.axisSide;
    if (side.current) {
      put(side.current, variant === "iso" ? (rel > 0 ? "FRONT" : rel < 0 ? "ACROSS" : "ON LINE") : rel > 0 ? "Front side" : rel < 0 ? "Across the line" : "On the line");
      side.current.style.color = rel < 0 ? "#0B0E14" : rel === 0 ? "#FFB547" : "#B9C2CF";
      side.current.style.background = rel < 0 ? CROSS_COLOR : "rgb(0 0 0 / 0.55)";
    }
    const m = memo.current;
    if (frameId - m.kindAt > 8 || m.shot !== live.shotIndex) {
      m.kindAt = frameId;
      const st = scStore.getState();
      const s = describeShot(st.cameras[id], d, subjectsFor(sceneId), t);
      put(kind.current, variant === "iso" ? shotLabel(s) : `${shotLabel(s)} · ${Math.round(s.focalMm)} mm`);
      if (kind.current) kind.current.title = SHOT_SIZE_LABEL[s.size];
    }
    if (variant !== "iso") {
      put(label.current, id);
      if (label.current) {
        label.current.style.background = CAM_COLOR[id];
      }
      if (m.shot !== live.shotIndex) {
        m.shot = live.shotIndex;
        m.cutFlashUntil = performance.now() + 140;
      }
      if (frame.current) frame.current.style.boxShadow = performance.now() < m.cutFlashUntil ? "0 0 0 2px #F2F5F9" : `0 0 0 2px ${CAM_COLOR[id]}`;
      if (banner.current) {
        const st = scStore.getState();
        const cut = st.edit[live.shotIndex];
        const f = flagsRef.current.find((x) => x.cut === live.shotIndex);
        const show = f && cut && t - cut.t < 1.6;
        banner.current.style.display = show ? "block" : "none";
        if (show && f) put(banner.current, `⚠ ${FLAG_TITLE[f.kind]}`);
      }
    } else {
      const onAir = live.program === id;
      if (tally.current) tally.current.style.display = onAir ? "inline-block" : "none";
      if (frame.current) frame.current.style.boxShadow = onAir ? `0 0 0 2px ${CROSS_COLOR}` : "none";
    }
  }, ORDER.MEASURE);

  const big = variant === "watch";
  const iso = variant === "iso";
  const accent = iso ? CAM_COLOR[slot as CamId] : undefined;
  return (
    <div
      ref={frame}
      className={`relative w-full overflow-hidden ${big ? "rounded-[10px]" : "rounded-[10px]"} ring-1 ${iso && selected === slot ? "ring-white/45" : "ring-white/10"}`}
      style={{ aspectRatio: "16 / 9" }}
      data-testid={iso ? `monitor-${slot}` : variant === "program" ? "monitor-program" : "watch-screen"}
      role={iso ? "button" : undefined}
      tabIndex={iso ? 0 : undefined}
      aria-label={iso ? `Select camera ${slot}` : undefined}
      onClick={iso ? () => scStore.getState().select(slot as CamId) : undefined}
      onKeyDown={iso ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scStore.getState().select(slot as CamId); } } : undefined}
    >
      <div ref={win} className="absolute inset-0" data-testid={`monitor-window-${slot}`} />
      <div className={`pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-start gap-[3px] ${big ? "text-[12px]" : "text-[10px]"}`}>
        <div className="flex items-center gap-1">
          {iso ? (
            <span className="mono flex items-center gap-1 rounded px-1.5 py-[1px] font-bold text-[#0B0E14]" style={{ background: accent }}>
              {slot}
              <span ref={tally} className="hidden h-[7px] w-[7px] rounded-full" style={{ background: CROSS_COLOR }} title="On air" data-testid={`tally-${slot}`} />
            </span>
          ) : (
            <>
              <span className="mono rounded bg-black/60 px-1.5 py-[1px] font-semibold tracking-wider text-ink-0">{big ? "THE CUT" : "PROGRAM"}</span>
              <span ref={label} className="mono rounded px-1.5 py-[1px] font-bold text-[#0B0E14]" data-testid={`${variant}-camera`} />
            </>
          )}
          <span ref={side} className="mono rounded px-1.5 py-[1px]" data-testid={`monitor-side-${slot}`} />
        </div>
        <span ref={kind} className="mono rounded bg-black/60 px-1.5 py-[1px] text-ink-0" data-testid={`monitor-kind-${slot}`} />
      </div>
      <div ref={banner} className="mono pointer-events-none absolute left-1/2 top-[18%] hidden -translate-x-1/2 rounded px-2 py-0.5 text-[12px] font-semibold text-[#0B0E14]" style={{ background: CROSS_COLOR }} data-testid={`monitor-flag-${slot}`} />
      <div className={`pointer-events-none absolute inset-x-1 ${big ? "bottom-3" : "bottom-1"}`}>
        <span ref={bram} className={`mono absolute bottom-0 whitespace-nowrap rounded px-1 py-[1px] font-semibold text-[#0B0E14] ${big ? "text-[13px]" : "text-[9.5px]"}`} style={{ background: BRAM_COLOR }} data-testid={`chip-bram-${slot}`} />
        <span ref={pip} className={`mono absolute bottom-0 whitespace-nowrap rounded px-1 py-[1px] font-semibold text-[#0B0E14] ${big ? "text-[13px]" : "text-[9.5px]"}`} style={{ background: PIP_COLOR }} data-testid={`chip-pip-${slot}`} />
      </div>
    </div>
  );
}

/** The three ISO monitors (one per camera), with a tally on the one that is on air. */
export function IsoRow() {
  return (
    <div className="grid grid-cols-3 gap-1.5" data-testid="iso-row">
      {CAM_IDS.map((id) => (
        <Monitor key={id} slot={id} variant="iso" />
      ))}
    </div>
  );
}

export function ProgramMonitor() {
  const { flags } = useAnalysis();
  return <Monitor slot="P" variant="program" flags={flags} />;
}

export function WatchScreen() {
  const { flags } = useAnalysis();
  return <Monitor slot="W" variant="watch" flags={flags} />;
}
