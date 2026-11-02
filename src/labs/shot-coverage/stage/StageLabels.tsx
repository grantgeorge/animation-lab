"use client";

import { useRef } from "react";
import { Vector3 } from "three";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { CAM_IDS, type CamId } from "../engine/types";
import { CAM_COLOR } from "../colors";
import { useSC } from "../store";
import { live, slots, stageWindow } from "../runtime/live";

const tmp = new Vector3();

/**
 * Camera ID tags over the stage, projected through the observer camera each frame (plain DOM, under
 * the UI panels). Cheaper than in-scene HTML and never drawn into the shot monitors.
 */
export function StageLabels() {
  const selected = useSC((s) => s.selected);
  const els = useRef<Partial<Record<CamId, HTMLDivElement | null>>>({});
  useFrameUpdater(() => {
    const cam = live.observer;
    if (!cam || !stageWindow.current) return;
    const r = stageWindow.current.getBoundingClientRect();
    // Monitor windows are transparent (the canvas shows through), so labels must not sit under them.
    const holes = [...slots.values(), ...document.querySelectorAll<HTMLElement>("[data-occlude]")].map((el) => el.getBoundingClientRect());
    for (const id of CAM_IDS) {
      const el = els.current[id];
      const p = live.poses[id];
      if (!el || !p) continue;
      tmp.copy(p.position);
      tmp.y += 0.32;
      tmp.project(cam);
      const x = r.left + ((tmp.x + 1) / 2) * r.width;
      const y = r.top + ((1 - tmp.y) / 2) * r.height;
      const pad = 12;
      const covered = holes.some((h) => x > h.left - pad && x < h.right + pad && y > h.top - pad && y < h.bottom + pad);
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && !covered;
      el.style.display = visible ? "block" : "none";
      if (visible) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }, ORDER.MEASURE);
  return (
    <div className="pointer-events-none fixed inset-0 z-[5]" aria-hidden>
      {CAM_IDS.map((id) => (
        <div
          key={id}
          ref={(el) => void (els.current[id] = el)}
          data-testid={`stage-label-${id}`}
          className="mono absolute left-0 top-0 rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold"
          style={{ background: selected === id ? CAM_COLOR[id] : "rgb(10 13 19 / 0.82)", color: selected === id ? "#0B0E14" : CAM_COLOR[id], border: `1px solid ${CAM_COLOR[id]}` }}
        >
          {id}
        </div>
      ))}
    </div>
  );
}
