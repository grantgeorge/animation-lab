"use client";

import { useRef } from "react";
import { SectionLabel, Segmented } from "@/ui/primitives";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { CAM_IDS, type Aim, type CamId, type PresetKind, type Who } from "../engine/types";
import { CAM_COLOR, CROSS_COLOR } from "../colors";
import { scStore, useSC } from "../store";
import { useAnalysis } from "./derived";
import { live } from "../runtime/live";

const PRESETS: { kind: PresetKind; who?: Who; label: string; title: string; key: string }[] = [
  { kind: "master", label: "Master", title: "Wide master: both characters, the geography", key: "master" },
  { kind: "ots", who: "bram", label: "OTS Bram", title: "Over-the-shoulder on Bram, past Pip", key: "ots-bram" },
  { kind: "ots", who: "pip", label: "OTS Pip", title: "Over-the-shoulder on Pip, past Bram", key: "ots-pip" },
  { kind: "single", label: "Single", title: "Medium single on the camera's subject", key: "single" },
  { kind: "closeup", label: "CU", title: "Close-up reaction on the camera's subject", key: "closeup" },
];

const lmin = Math.log(18);
const lmax = Math.log(135);

/** Selected camera: presets, aim, lens, and the one-click "cross the line". */
export function CameraPanel() {
  const selected = useSC((s) => s.selected);
  const cam = useSC((s) => s.cameras[s.selected]);
  const { sides } = useAnalysis();
  const st = scStore.getState();
  const side = sides[selected];
  const who: Who = cam.aim === "pip" ? "pip" : "bram";
  return (
    <div className="glass mt-3 p-2.5" data-testid="camera-panel">
      <SectionLabel hint="1 2 3">Camera</SectionLabel>
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Camera">
        {CAM_IDS.map((id) => {
          const on = id === selected;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              data-testid={`select-cam-${id}`}
              onClick={() => st.select(id)}
              className="mono flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] font-bold transition-colors"
              style={{ background: on ? CAM_COLOR[id] : "rgb(255 255 255 / 0.05)", color: on ? "#0B0E14" : CAM_COLOR[id] }}
            >
              <span>Cam {id}</span>
              <span className="text-[9.5px] font-medium opacity-80">{sides[id] < 0 ? "across" : sides[id] === 0 ? "on line" : "front"}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" data-testid="cam-presets">
        {PRESETS.map((p) => {
          const id = p.kind === "ots" ? `ots-${p.who}` : p.kind === "master" ? "master" : `${p.kind}-${who}`;
          const on = cam.preset === id;
          return (
            <button
              key={p.key}
              type="button"
              data-testid={`preset-${p.key}`}
              aria-pressed={on}
              onClick={() => st.applyPreset(selected, p.kind, p.who)}
              title={p.title}
              className={`h-7 whitespace-nowrap rounded-lg px-1 text-center text-[11px] font-medium transition-colors ${on ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.05] text-ink-1 hover:bg-white/[0.1]"}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="micro w-[44px] shrink-0">Aim</span>
        <div className="flex-1">
        <Segmented<Aim>
          label="Aim"
          value={cam.aim}
          onChange={(v) => st.setCamera(selected, { aim: v })}
          options={[
            { value: "bram", label: "Bram", testId: "aim-bram" },
            { value: "pip", label: "Pip", testId: "aim-pip" },
            { value: "both", label: "Both", testId: "aim-both" },
            { value: "free", label: "Free", testId: "aim-free", title: "Lock the aim where it points now" },
          ]}
        />
        </div>
      </div>
      <div className="sc-camera-settings">
        <label className="block">
          <div className="mb-0.5 flex items-baseline justify-between text-[11.5px]">
            <span className="text-ink-1">Lens</span>
            <span className="mono text-focal-text" data-testid="focal-readout">
              {Math.round(cam.focalMm)} mm
            </span>
          </div>
          <input
            type="range"
            className="w-full accent-[#5FE3FF]"
            data-testid="focal-slider"
            aria-label="Focal length"
            min={0}
            max={1000}
            value={Math.round(((Math.log(cam.focalMm) - lmin) / (lmax - lmin)) * 1000)}
            onChange={(e) => st.setCamera(selected, { focalMm: Math.round(Math.exp(lmin + (Number(e.target.value) / 1000) * (lmax - lmin))) })}
          />
        </label>
        <details className="sc-camera-height" data-testid="camera-advanced"><summary>Camera height <span>Raise or lower the viewpoint</span></summary><label className="block">
          <div className="mb-0.5 flex items-baseline justify-between text-[11.5px]">
            <span className="text-ink-1">Height</span>
            <span className="mono text-distance">{cam.position[1].toFixed(2)} m</span>
          </div>
          <input
            type="range"
            className="w-full accent-[#FFB547]"
            data-testid="height-slider"
            aria-label="Camera height"
            min={0.3}
            max={3.5}
            step={0.01}
            value={cam.position[1]}
            onChange={(e) => st.setCamera(selected, { position: [cam.position[0], Number(e.target.value), cam.position[2]] })}
          />
        </label></details>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          data-testid="cross-line"
          onClick={() => st.crossLine()}
          className="flex-1 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-semibold transition-colors"
          style={{ background: side < 0 ? "rgb(255 107 107 / 0.16)" : CROSS_COLOR, color: side < 0 ? CROSS_COLOR : "#0B0E14" }}
        >
          {side < 0 ? `Bring ${selected} back across` : `Cross the line with ${selected}`}
          <span className="mono block text-[9.5px] font-normal opacity-80">X · mirror it across the axis of action</span>
        </button>
        <button type="button" data-testid="reset-cameras" onClick={() => st.resetCameras()} className="mono shrink-0 rounded-md bg-white/[0.08] px-2 py-1 text-[10.5px] text-ink-1 hover:bg-white/15">
          Reset
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-2">Drag cameras on the stage or the plan (Shift-drag on the stage: height).</p>
    </div>
  );
}

const LOOK_WORD = { left: "← left", right: "right →", toward: "◉ lens", away: "○ away" } as const;

/** Inspect: per camera, which side of the line and where each character lands (live). */
export function DirectionTable() {
  const rows = useRef<Partial<Record<CamId, HTMLTableRowElement | null>>>({});
  const { sides } = useAnalysis();
  useFrameUpdater(() => {
    for (const id of CAM_IDS) {
      const tr = rows.current[id];
      const info = live.info[id];
      if (!tr || !info) continue;
      const cells = tr.querySelectorAll("td");
      const fmt = (c: typeof info.primary) => `${c.side} ${c.inFront ? (c.x >= 0 ? "+" : "") + c.x.toFixed(2) : "behind"}`;
      const set = (i: number, s: string) => {
        if (cells[i] && cells[i].textContent !== s) cells[i].textContent = s;
      };
      set(1, fmt(info.primary));
      set(2, LOOK_WORD[info.primary.look]);
      set(3, fmt(info.secondary));
      set(4, LOOK_WORD[info.secondary.look]);
    }
  }, ORDER.MEASURE);
  return (
    <div className="glass mt-3 p-2.5" data-testid="direction-table">
      <SectionLabel hint="live">Screen direction</SectionLabel>
      <table className="mono w-full text-[11px]">
        <thead>
          <tr className="text-left text-[9.5px] uppercase tracking-wider text-ink-2">
            <th className="pb-1 font-normal">Cam</th>
            <th className="pb-1 font-normal">Bram x</th>
            <th className="pb-1 font-normal">looks</th>
            <th className="pb-1 font-normal">Pip x</th>
            <th className="pb-1 font-normal">looks</th>
          </tr>
        </thead>
        <tbody>
          {CAM_IDS.map((id) => (
            <tr key={id} ref={(el) => void (rows.current[id] = el)} data-testid={`direction-row-${id}`} className="border-t border-white/5" onClick={() => scStore.getState().select(id)}>
              <td className="py-1 font-bold" style={{ color: CAM_COLOR[id] }}>
                {id}
                {sides[id] < 0 && <span className="ml-1 rounded px-1 text-[9px] text-[#0B0E14]" style={{ background: CROSS_COLOR }}>×</span>}
              </td>
              <td className="py-1 text-ink-0" />
              <td className="py-1 text-ink-1" />
              <td className="py-1 text-ink-0" />
              <td className="py-1 text-ink-1" />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-2">x is the screen position (−1 left edge, +1 right edge). L/R is who is left of whom: on one side of the line it never changes.</p>
      <button
        type="button"
        data-testid="cross-line-inspect"
        onClick={() => scStore.getState().crossLine()}
        className="mt-2 w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-[#0B0E14]"
        style={{ background: CROSS_COLOR }}
      >
        Cross the line with the selected camera <span className="mono text-[10px] font-normal">X</span>
      </button>
    </div>
  );
}
