"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { audibleEvents, audioSegments, humEnvelope, type SfxKind } from "../engine/audio";
import { handles, runtime, starts } from "../engine/edit";
import { analyseKnows } from "../engine/explain";
import { SHOTS } from "../engine/shots";
import type { Edit } from "../engine/types";
import { sound } from "../audio/synth";
import { live, onTick, type SlotId } from "../runtime/live";
import { erStore, useER } from "../store";

const GLYPH: Record<SfxKind, string> = { step: "·", creak: "≈", gasp: "◌", breath: "○", sting: "✦", thud: "▾", whistleUp: "↗", whistleDown: "↘", bonk: "●", shimmer: "✧", ignite: "✺" };

function tickStep(T: number) {
  return T > 40 ? 10 : T > 20 ? 5 : T > 8 ? 2 : 1;
}

interface Drag {
  mode: "move" | "head" | "tail";
  index: number;
  x0: number;
  pxPerS: number;
  inS: number;
  outS: number;
  moved: boolean;
  dx: number;
  drop: number;
  lefts: number[];
}

/**
 * The editing timeline: proportional shot blocks (picture), the sound edit under it, and what the
 * audience knows. Editable: click to select, drag a block to reorder, drag its edges to trim within
 * the handles (shown as a bracket under the selected clip).
 */
export function Timeline({ edit, editable = false, slot = "P", showAudio = true, showKnows = true, flags = [], compact = false, testid = "timeline", scale, label = "Picture" }: { edit: Edit; editable?: boolean; slot?: SlotId; showAudio?: boolean; showKnows?: boolean; flags?: number[]; compact?: boolean; testid?: string; /** Seconds the full width represents (compare mode puts both edits on one scale). */ scale?: number; label?: string }) {
  const selected = useER((s) => s.selected);
  const R = Math.max(0.001, runtime(edit));
  const T = Math.max(R, scale ?? 0);
  const st = useMemo(() => starts(edit), [edit]);
  const track = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pct = (t: number) => `${(t / T) * 100}%`;

  useEffect(
    () =>
      onTick(() => {
        const v = live.views[slot];
        if (head.current && v) head.current.style.left = `${Math.min(100, (v.t / T) * 100)}%`;
      }),
    [slot, T],
  );

  const segs = useMemo(() => (showAudio ? audioSegments(edit) : []), [edit, showAudio]);
  const events = useMemo(() => (showAudio ? audibleEvents(edit) : []), [edit, showAudio]);
  const env = useMemo(() => (showAudio ? humEnvelope(edit, 140) : []), [edit, showAudio]);
  const knows = useMemo(() => (showKnows ? analyseKnows(edit) : null), [edit, showKnows]);
  /** The span the lesson is about: fear before its cause (suspense) or the cause before the fear (anticipation). */
  const gap = useMemo(() => {
    if (!knows || knows.reactionAt === null) return null;
    const cause = knows.dangerAt ?? knows.revealAt;
    if (cause === null) return null;
    const [from, to] = knows.reactionBeforeDanger ? [knows.reactionAt, cause] : [cause, knows.reactionAt];
    if (to - from < 0.3) return null;
    const kind = knows.reactionBeforeDanger ? "suspense" : "anticipation";
    return { from, to, kind, label: `${(to - from).toFixed(1)}s ${knows.reactionBeforeDanger ? "fear before cause" : "audience ahead of Bram"}` };
  }, [knows]);

  const seekFromEvent = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    erStore.getState().seek(((clientX - r.left) / r.width) * T);
  };

  const onDown = (e: React.PointerEvent, index: number, mode: Drag["mode"]) => {
    if (!editable) {
      seekFromEvent(e.clientX);
      return;
    }
    e.stopPropagation();
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    const c = edit[index];
    const d: Drag = { mode, index, x0: e.clientX, pxPerS: r.width / T, inS: c.sourceIn, outS: c.sourceIn + c.duration, moved: false, dx: 0, drop: index, lefts: st.map((s, i) => r.left + ((s + edit[i].duration / 2) / T) * r.width) };
    dragRef.current = d;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (mode !== "move") erStore.getState().beginGesture();
    erStore.getState().select(c.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 5) return;
    d.moved = true;
    d.dx = dx;
    const s = erStore.getState();
    if (d.mode === "move") {
      // insertion slot among the OTHER clips: how many of their centres lie left of the pointer
      d.drop = d.lefts.filter((x, i) => i !== d.index && x < e.clientX).length;
      setDrag({ ...d });
    } else if (d.mode === "head") s.trimHead(d.index, d.inS + dx / d.pxPerS, false);
    else s.trimTail(d.index, d.outS + dx / d.pxPerS, false);
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (d.mode === "move" && d.moved && d.drop !== d.index) erStore.getState().reorder(d.index, d.drop);
    if (!d.moved) erStore.getState().seek(st[d.index] + 0.001);
  };

  /** Record time of the gap the dragged clip would drop into (in the current layout). */
  const dropAt = (d: Drag) => {
    const others = edit.map((_, i) => i).filter((i) => i !== d.index);
    if (d.drop <= 0) return st[others[0] ?? 0];
    const k = others[Math.min(d.drop, others.length) - 1];
    return st[k] + edit[k].duration;
  };
  const sel = editable ? edit.findIndex((c) => c.id === selected) : -1;
  const selClip = sel >= 0 ? edit[sel] : null;
  const h = selClip ? handles(selClip) : null;
  const step = tickStep(T);

  return (
    <div className={`er-timeline${compact ? " er-timeline-compact" : ""}`} data-testid={testid} data-runtime={R.toFixed(2)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="er-lane-label">{label}</div>
      <div className="er-lane er-lane-picture" ref={track} onPointerDown={(e) => seekFromEvent(e.clientX)}>
        {edit.map((c, i) => {
          const def = SHOTS[c.shot];
          const isSel = i === sel;
          const moving = drag?.mode === "move" && drag.index === i;
          return (
            <div
              key={c.id}
              role={editable ? "button" : undefined}
              tabIndex={editable ? 0 : -1}
              aria-pressed={editable ? isSel : undefined}
              aria-label={`${def.name}, ${c.duration.toFixed(1)} seconds`}
              className={`er-clip${isSel ? " er-clip-sel" : ""}${moving ? " er-clip-moving" : ""}`}
              data-testid={`${testid}-clip-${i}`}
              data-shot={c.shot}
              data-id={c.id}
              data-duration={c.duration.toFixed(2)}
              data-source-in={c.sourceIn.toFixed(2)}
              style={{ left: pct(st[i]), width: pct(c.duration), ["--clip" as string]: def.color, transform: moving ? `translateX(${drag.dx}px)` : undefined }}
              onPointerDown={(e) => onDown(e, i, "move")}
              onKeyDown={(e) => {
                if (!editable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  erStore.getState().select(c.id);
                }
                if (e.key === "ArrowLeft" && e.altKey) erStore.getState().move(i, -1);
                if (e.key === "ArrowRight" && e.altKey) erStore.getState().move(i, 1);
              }}
            >
              <span className="er-clip-name">{def.number ? <b>{def.number}</b> : null}{def.name}</span>
              {!compact && <span className="er-clip-dur mono">{c.duration.toFixed(1)}s</span>}
              {c.dissolve && i > 0 ? <span className="er-clip-dissolve" style={{ width: `${(c.dissolve / c.duration) * 50}%` }} /> : null}
              {editable && isSel && (
                <>
                  <span className="er-trim er-trim-l" data-testid={`${testid}-trim-head`} onPointerDown={(e) => onDown(e, i, "head")} title="Drag to trim the head" />
                  <span className="er-trim er-trim-r" data-testid={`${testid}-trim-tail`} onPointerDown={(e) => onDown(e, i, "tail")} title="Drag to trim the tail" />
                </>
              )}
            </div>
          );
        })}
        {drag?.mode === "move" && drag.moved && <div className="er-drop" style={{ left: pct(dropAt(drag)) }} />}
        {flags.map((i) => (
          <div key={i} className="er-flag" style={{ left: pct(st[i]) }} data-testid={`${testid}-flag-${i}`} title="Continuity break">
            ⚠
          </div>
        ))}
        <div ref={head} className="er-playhead" />
      </div>
      {selClip && h && (
        <>
          <div />
          <div className="er-handles" data-testid={`${testid}-handles`} data-before={h.before.toFixed(2)} data-after={h.after.toFixed(2)}>
            <div className="er-handle-bar" style={{ left: pct(Math.max(0, st[sel] - h.before)), width: pct(Math.min(T, st[sel] + selClip.duration + h.after) - Math.max(0, st[sel] - h.before)) }} />
            <div className="er-handle-used" style={{ left: pct(st[sel]), width: pct(selClip.duration) }} />
            <span className="er-handle-text mono" style={{ left: pct(st[sel] + selClip.duration / 2) }}>
              ◂ {h.before.toFixed(1)}s handle · src {selClip.sourceIn.toFixed(1)}–{(selClip.sourceIn + selClip.duration).toFixed(1)} · {h.after.toFixed(1)}s ▸
            </span>
          </div>
        </>
      )}
      <div />
      <div className="er-ruler" onPointerDown={(e) => seekFromEvent(e.clientX)}>
        {Array.from({ length: Math.floor(T / step) + 1 }, (_, i) => i * step).filter((s) => s === 0 || Math.abs(s - R) > T * 0.08).map((s) => (
          <span key={s} style={{ left: pct(s) }} className="mono">
            {s === 0 ? "0:00" : `${s}s`}
          </span>
        ))}
        <span className="er-ruler-total mono" style={R < T - 0.05 ? { left: pct(R), right: "auto", transform: "translateX(-100%)" } : undefined}>{R.toFixed(1)}s total</span>
      </div>
      {showKnows && knows && (
        <>
          <div className="er-lane-label">Knows</div>
          <div className="er-lane er-lane-knows" data-testid={`${testid}-knows`} data-danger={knows.dangerAt ?? ""} data-reaction={knows.reactionAt ?? ""} data-reveal={knows.revealAt ?? ""}>
            {knows.danger.map((s, i) => (
              <div key={`d${i}`} className="er-know er-know-danger" style={{ left: pct(s.from), width: pct(s.to - s.from) }} />
            ))}
            {knows.reaction.map((s, i) => (
              <div key={`r${i}`} className="er-know er-know-react" style={{ left: pct(s.from), width: pct(s.to - s.from) }} />
            ))}
            {knows.reveal.map((s, i) => (
              <div key={`v${i}`} className="er-know er-know-reveal" style={{ left: pct(s.from), width: pct(s.to - s.from) }} />
            ))}
            {gap && (
              <span className={`er-gap er-gap-${gap.kind}`} data-testid={`${testid}-gap`} data-kind={gap.kind} style={{ left: pct(gap.from), width: pct(gap.to - gap.from) }}>
                <i className="mono">{gap.label}</i>
              </span>
            )}
            {knows.dangerAt !== null && <span className="er-know-pin er-pin-danger" style={{ left: pct(knows.dangerAt) }}>danger seen</span>}
            {knows.reactionAt !== null && <span className="er-know-pin er-pin-react" style={{ left: pct(knows.reactionAt) }}>Bram reacts</span>}
            {knows.revealAt !== null && <span className="er-know-pin er-pin-reveal" style={{ left: pct(knows.revealAt) }}>reveal</span>}
          </div>
        </>
      )}
      {showAudio && (
        <>
          <div className="er-lane-label">Sound</div>
          <div className="er-lane er-lane-audio" data-testid={`${testid}-audio`} onPointerDown={(e) => seekFromEvent(e.clientX)}>
            {segs.map((g) => (
              <div key={g.index} className="er-aseg" data-testid={`${testid}-aseg-${g.index}`} data-start={g.recStart.toFixed(2)} data-end={g.recEnd.toFixed(2)} style={{ left: pct(g.recStart), width: pct(Math.max(0, g.recEnd - g.recStart)), ["--clip" as string]: SHOTS[g.clip.shot].color }} />
            ))}
            <svg className="er-env" viewBox={`0 0 ${env.length} 10`} preserveAspectRatio="none" aria-hidden>
              <path d={`M0 10 ${env.map((v, i) => `L${i + 0.5} ${10 - Math.min(1, v / 1.3) * 9}`).join(" ")} L${env.length} 10 Z`} />
            </svg>
            {events.map((x, i) => (
              <button
                key={i}
                type="button"
                className={`er-sfx${x.overPicture ? " er-sfx-over" : ""}`}
                data-testid={`${testid}-sfx-${i}`}
                data-rec={x.rec.toFixed(2)}
                data-kind={x.kind}
                data-over={x.overPicture ? "1" : "0"}
                title={`${x.label} · ${x.rec.toFixed(2)} s${x.overPicture ? " · plays over the other shot's picture" : ""}`}
                style={{ left: pct(x.rec) }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  erStore.getState().unlockAudio();
                  sound.unlock();
                  sound.audition(x.kind, x.gain);
                }}
              >
                {GLYPH[x.kind]}
              </button>
            ))}
            {edit.slice(1).map((c, i) => (
              <div key={c.id} className="er-cutline" style={{ left: pct(st[i + 1]) }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
