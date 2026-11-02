"use client";

import { useEffect, useRef } from "react";
import { REELS } from "../engine/source";
import { SHOTS } from "../engine/shots";
import { live, onTick, slots, type SlotId } from "../runtime/live";

const put = (el: HTMLElement | null, text: string) => {
  if (el && el.textContent !== text) el.textContent = text;
};
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/**
 * A program monitor: a transparent window the orchestrator renders into, with live overlays (shot,
 * size, record and source time, a flash on every cut). No glass on it or any ancestor.
 */
export function Monitor({ slot, label, accent, big = false }: { slot: SlotId; label: string; accent?: string; big?: boolean }) {
  const win = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const shot = useRef<HTMLSpanElement>(null);
  const rec = useRef<HTMLSpanElement>(null);
  const src = useRef<HTMLSpanElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const memo = useRef({ index: -1, flashUntil: 0 });
  useEffect(() => {
    const el = win.current;
    if (!el) return;
    slots.set(slot, el);
    return () => {
      if (slots.get(slot) === el) slots.delete(slot);
    };
  }, [slot]);
  useEffect(
    () =>
      onTick(() => {
        const v = live.views[slot];
        if (!v || !live.rendered.includes(slot)) return;
        const def = SHOTS[v.shot];
        put(shot.current, `${def.number ? `${def.number} · ` : ""}${def.name} · ${def.size}`);
        if (shot.current) shot.current.style.background = def.color;
        put(rec.current, `${fmt(v.t)} / ${fmt(v.runtime)}`);
        put(src.current, `${REELS[def.reel].tape} ${v.local.toFixed(2)}s`);
        const m = memo.current;
        if (m.index !== v.index) {
          m.index = v.index;
          m.flashUntil = performance.now() + 120;
        }
        if (frame.current) frame.current.dataset.flash = performance.now() < m.flashUntil ? "1" : "0";
        if (end.current) end.current.style.opacity = v.t >= v.runtime - 0.01 && live.t > v.runtime ? "1" : "0";
        if (frame.current) frame.current.dataset.shot = v.shot;
      }),
    [slot],
  );
  return (
    <div ref={frame} className={`er-monitor${big ? " er-monitor-big" : ""}`} data-testid={`monitor-${slot}`} style={accent ? ({ "--er-accent": accent } as React.CSSProperties) : undefined}>
      <div ref={win} className="er-monitor-window" data-testid={`monitor-window-${slot}`} />
      <div className="er-monitor-hud">
        <div className="er-monitor-top">
          <span className="er-chip er-chip-label">{label}</span>
          <span ref={shot} className="er-chip er-chip-shot" data-testid={`monitor-shot-${slot}`} />
        </div>
        <div className="er-monitor-bottom">
          <span ref={rec} className="er-chip mono" data-testid={`monitor-time-${slot}`} />
          <span ref={src} className="er-chip mono er-dim" />
        </div>
      </div>
      <div ref={end} className="er-monitor-end">END</div>
    </div>
  );
}
