"use client";

import { useRef, useState } from "react";
import { getScene } from "@/labs/lens-and-framing/config";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { EDIT_PRESET_LABEL, EDIT_PRESET_ORDER } from "../engine/edit";
import { CAM_IDS } from "../engine/types";
import { CAM_COLOR, CAM_TINT, CROSS_COLOR, AXIS_COLOR } from "../colors";
import { FLAG_TITLE } from "../content";
import { scStore, useSC } from "../store";
import { useAnalysis } from "./derived";
import { shotLabel } from "./Monitors";

const FLAG_COLOR = { axis: CROSS_COLOR, jump: AXIS_COLOR, same: "#B9C2CF" } as const;

function Transport() {
  const playing = useSC((s) => s.playing);
  const st = scStore.getState();
  return (
    <div className="flex items-center gap-1">
      <button type="button" data-testid="play-toggle" aria-label={playing ? "Pause" : "Play"} onClick={() => st.togglePlay()} className="grid h-7 w-8 place-items-center rounded-[9px] bg-white/[0.08] text-[12px] text-ink-0 hover:bg-white/15">
        {playing ? "❚❚" : "▶"}
      </button>
      <button type="button" aria-label="Restart" onClick={() => st.seek(0)} className="grid h-7 w-7 place-items-center rounded-[9px] bg-white/[0.06] text-[11px] text-ink-0 hover:bg-white/15">
        ⏮
      </button>
    </div>
  );
}

/**
 * The miniature NLE: one track, shots coloured by camera, cut points you can drag, a playhead,
 * continuity flags on the cuts. In Experiment it edits (live switching, trim, swap, undo, presets);
 * in Inspect and Watch it only reads and seeks.
 */
export function EditTimeline({ editable, compact = false }: { editable: boolean; compact?: boolean }) {
  const sceneId = useSC((s) => s.sceneId);
  const edit = useSC((s) => s.edit);
  const preset = useSC((s) => s.editPreset);
  const canUndo = useSC((s) => s.past.length > 0);
  const { T, segs, flags, stats } = useAnalysis();
  const d = getScene(sceneId);
  const track = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const [pop, setPop] = useState<number | null>(null);
  const trim = useRef<number | null>(null);
  const st = scStore.getState();
  useFrameUpdater(({ t }) => {
    if (head.current) head.current.style.left = `${(t / T) * 100}%`;
    if (time.current) {
      const s = `${t.toFixed(2)} s`;
      if (time.current.textContent !== s) time.current.textContent = s;
    }
  }, ORDER.MEASURE);
  const tAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.min(T - 1e-3, Math.max(0, ((clientX - r.left) / r.width) * T));
  };
  const pct = (t: number) => `${(t / T) * 100}%`;

  return (
    <div className="flex h-full flex-col gap-1.5" data-testid="edit-timeline">
      <div className="flex min-w-0 items-center gap-2">
        <Transport />
        <span ref={time} className="mono w-[54px] text-[11.5px] text-ink-1" data-testid="time-readout" />
        {editable && (
          <>
            <div className="flex items-center gap-1" data-testid="live-switch">
              <span className="micro mr-0.5 hidden text-[9px] min-[1360px]:inline">Cut to</span>
              {CAM_IDS.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`cut-${id}`}
                  title={`Cut to ${id} at the playhead (${i + 1})`}
                  onClick={() => st.cutTo(id)}
                  className="mono h-7 rounded-[8px] px-2 text-[11.5px] font-bold"
                  style={{ background: CAM_TINT[id], color: CAM_COLOR[id] }}
                >
                  {i + 1}·{id}
                </button>
              ))}
            </div>
            <button type="button" data-testid="undo" disabled={!canUndo} onClick={() => st.undo()} className="mono h-7 rounded-[8px] bg-white/[0.07] px-2 text-[11px] text-ink-1 hover:bg-white/15 disabled:opacity-35" title="Undo (Z)">
              Undo
            </button>
            <button type="button" data-testid="clear-edit" onClick={() => st.clearEdit()} className="mono h-7 rounded-[8px] bg-white/[0.07] px-2 text-[11px] text-ink-1 hover:bg-white/15" title="One shot, then cut live">
              Clear
            </button>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="radiogroup" aria-label="Edit presets" data-testid="edit-presets">
              {EDIT_PRESET_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={preset === id}
                  data-testid={`edit-${id}`}
                  onClick={() => st.applyEditPreset(id)}
                  className={`h-7 shrink-0 whitespace-nowrap rounded-[8px] px-2 text-[11.5px] font-medium transition-colors ${
                    preset === id ? (id === "crossing" ? "bg-[#FF6B6B] text-[#0B0E14]" : "bg-[#E9EEF4] text-[#0B0E14]") : id === "crossing" ? "bg-[rgb(255_107_107/0.12)] text-[#FF8A8A] hover:bg-[rgb(255_107_107/0.2)]" : "bg-white/[0.05] text-ink-1 hover:bg-white/[0.1]"
                  }`}
                >
                  {EDIT_PRESET_LABEL[id]}
                </button>
              ))}
            </div>
          </>
        )}
        {!editable && <div className="flex-1" />}
        <div className="mono flex shrink-0 items-baseline gap-2.5 text-[11px] text-ink-2" data-testid="edit-stats">
          <span>
            <span className="text-ink-0">{stats.shots}</span> shots
          </span>
          <span title="Average shot length">
            ASL <span className="text-distance">{stats.aslS.toFixed(1)} s</span>
          </span>
          <span title="Cuts per minute">
            <span className="text-focal-text">{Math.round(stats.cutsPerMin)}</span> cuts/min
          </span>
        </div>
      </div>

      <div className="relative">
        {/* ruler: scene markers and seconds; drag to scrub */}
        <div
          className="relative h-[16px] cursor-ew-resize"
          data-testid="timeline-ruler"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            st.seek(tAt(e.clientX));
          }}
          onPointerMove={(e) => e.buttons && st.seek(tAt(e.clientX))}
        >
          {Array.from({ length: Math.floor(T) + 1 }, (_, s) => (
            <span key={s} className="mono absolute top-0 -translate-x-1/2 text-[9px] text-ink-3" style={{ left: pct(s) }}>
              {s}
            </span>
          ))}
          {d.timeline.markers.map(([t, name]) => (
            <span key={name} className="absolute top-[11px] h-[5px] w-px bg-white/30" style={{ left: pct(t) }} title={name} />
          ))}
          {flags.map((f, i) => (
            <button
              key={`${f.cut}-${f.kind}-${i}`}
              type="button"
              data-testid={`flag-marker-${f.kind}`}
              title={f.text}
              onClick={() => st.seek(f.t + 0.01)}
              className="absolute top-0 z-10 h-[14px] w-[14px] -translate-x-1/2 rotate-45 rounded-[3px] border border-black/40"
              style={{ left: pct(f.t), background: FLAG_COLOR[f.kind], marginLeft: f.kind === "jump" && flags.some((g) => g.cut === f.cut && g.kind === "axis") ? 12 : 0 }}
            />
          ))}
        </div>
        <div
          ref={track}
          className={`relative ${compact ? "h-[30px]" : "h-[40px]"} overflow-visible rounded-[8px] bg-black/40`}
          data-testid="timeline-track"
          onPointerDown={(e) => {
            if (editable) return;
            (e.target as Element).setPointerCapture(e.pointerId);
            st.seek(tAt(e.clientX));
          }}
          onPointerMove={(e) => !editable && e.buttons && st.seek(tAt(e.clientX))}
        >
          {segs.map((g) => {
            const flagged = flags.some((f) => f.cut === g.index && f.kind === "axis");
            return (
              <button
                key={`${g.index}-${g.t0}`}
                type="button"
                data-testid={`segment-${g.index}`}
                data-cam={g.cam}
                className="absolute inset-y-0 overflow-hidden border-r border-black/50 px-1.5 text-left first:rounded-l-[8px] last:rounded-r-[8px]"
                style={{ left: pct(g.t0), width: pct(g.t1 - g.t0), background: CAM_TINT[g.cam], boxShadow: `inset 0 3px 0 ${CAM_COLOR[g.cam]}${flagged ? `, inset 0 -2px 0 ${CROSS_COLOR}` : ""}` }}
                title={`${g.cam}: ${shotLabel(g.shot)} (${g.t0.toFixed(2)}–${g.t1.toFixed(2)} s)`}
                onClick={(e) => {
                  if (!editable) return;
                  st.seek(tAt(e.clientX));
                  setPop(pop === g.index ? null : g.index);
                }}
              >
                <span className="mono block truncate pt-[5px] text-[11px] font-bold leading-none" style={{ color: CAM_COLOR[g.cam] }}>
                  {g.cam}
                </span>
                {!compact && <span className="mono block truncate pt-[3px] text-[9.5px] leading-none text-ink-1">{shotLabel(g.shot)}</span>}
              </button>
            );
          })}
          {editable &&
            edit.slice(1).map((c, k) => {
              const i = k + 1;
              return (
                <div
                  key={`cut-${i}`}
                  data-testid={`cut-handle-${i}`}
                  className="group absolute inset-y-[-3px] z-10 w-[12px] -translate-x-1/2 cursor-col-resize"
                  style={{ left: pct(c.t) }}
                  title="Drag to trim"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as Element).setPointerCapture(e.pointerId);
                    trim.current = i;
                    st.beginTrim();
                    setPop(null);
                  }}
                  onPointerMove={(e) => {
                    if (trim.current !== i) return;
                    st.moveCut(i, tAt(e.clientX));
                  }}
                  onPointerUp={() => {
                    trim.current = null;
                  }}
                >
                  <div className="mx-auto h-full w-[3px] rounded bg-white/70 group-hover:bg-white" />
                </div>
              );
            })}
          <div ref={head} className="pointer-events-none absolute -top-[18px] bottom-[-3px] z-20 w-[2px] -translate-x-1/2 bg-[#F2F5F9]" data-testid="playhead">
            <div className="absolute -top-[1px] left-1/2 h-[7px] w-[9px] -translate-x-1/2 rounded-[2px] bg-[#F2F5F9]" />
          </div>
          {editable && pop !== null && segs[pop] && (
            <div className="glass absolute bottom-[46px] z-30 flex -translate-x-1/2 items-center gap-1 p-1" style={{ left: pct((segs[pop].t0 + segs[pop].t1) / 2) }} data-testid="segment-popover">
              {CAM_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`set-shot-${id}`}
                  onClick={() => {
                    st.setShotCamera(pop, id);
                    setPop(null);
                  }}
                  className="mono h-7 w-8 rounded-[7px] text-[12px] font-bold"
                  style={{ background: segs[pop].cam === id ? CAM_COLOR[id] : CAM_TINT[id], color: segs[pop].cam === id ? "#0B0E14" : CAM_COLOR[id] }}
                >
                  {id}
                </button>
              ))}
              {pop > 0 && (
                <button
                  type="button"
                  data-testid="remove-cut"
                  onClick={() => {
                    st.removeCut(pop);
                    setPop(null);
                  }}
                  className="mono h-7 rounded-[7px] bg-white/[0.08] px-2 text-[10.5px] text-ink-1 hover:bg-white/15"
                >
                  Remove cut
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {!compact && (
        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="flag-list">
          {flags.length === 0 ? (
            <p className="text-[11.5px] text-subject" data-testid="flags-clean">
              ✓ Continuity clean: every cut keeps screen direction, no jump cuts.
            </p>
          ) : (
            <ul className={flags.length > 2 ? "grid grid-cols-2 gap-x-4 gap-y-0.5" : "space-y-0.5"}>
              {flags.map((f, i) => (
                <li key={`${f.cut}-${f.kind}-${i}`} className="flex min-w-0 items-baseline gap-1.5 text-[11.5px] leading-snug" data-testid={`flag-${f.kind}`}>
                  <span className="mono shrink-0 rounded px-1 text-[9.5px] font-semibold text-[#0B0E14]" style={{ background: FLAG_COLOR[f.kind] }}>
                    {FLAG_TITLE[f.kind]} · {f.t.toFixed(1)} s
                  </span>
                  <button type="button" className="truncate text-left text-ink-1 hover:text-ink-0" onClick={() => st.seek(f.t + 0.01)} title={f.text}>
                    {f.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
