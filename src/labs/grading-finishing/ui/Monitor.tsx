"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { registerSlot } from "../runtime/live";
import { getLook } from "../engine/look";
import { gfStore, useGF } from "../store";

/** A DOM window the orchestrator renders a pipeline into (the canvas sits behind the UI). */
export function Slot({ id, className = "", children, testId, onClick, selected }: { id: string; className?: string; children?: ReactNode; testId?: string; onClick?: () => void; selected?: boolean }) {
  const ref = useCallback((el: HTMLDivElement | null) => registerSlot(id)(el), [id]);
  return (
    <div ref={ref} className={`gf-slot ${className}`} data-testid={testId ?? `slot-${id}`} data-selected={selected ? "1" : undefined} onClick={onClick}>
      {children}
    </div>
  );
}

/** The live shot, with the before/after wipe. */
export function MainMonitor({ watch = false }: { watch?: boolean }) {
  const wipe = useGF((s) => s.wipe);
  const isolate = useGF((s) => s.isolate);
  const lookId = useGF((s) => s.lookId);
  const mode = useGF((s) => s.mode);
  const dragging = useRef(false);
  const showWipe = !watch && wipe !== null;
  const setFrom = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    gfStore.getState().setWipe((e.clientX - r.left) / r.width);
  };
  return (
    <div className="gf-main-fit">
      <Slot id="main" className="gf-main" testId="monitor-main">
        {showWipe && (
          <div
            className="gf-wipe"
            data-testid="wipe"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              setFrom(e);
            }}
            onPointerMove={(e) => dragging.current && setFrom(e)}
            onPointerUp={() => (dragging.current = false)}
          >
            <div className="gf-wipe-line" style={{ left: `${(wipe ?? 0.5) * 100}%` }}>
              <span className="gf-wipe-grip" role="slider" aria-label="Before/after wipe" aria-valuenow={Math.round((wipe ?? 0.5) * 100)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}
                onKeyDown={(e) => {
                  const d = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0;
                  if (d) { e.preventDefault(); gfStore.getState().setWipe((wipe ?? 0.5) + d); }
                }}
              >
                ⟷
              </span>
            </div>
            <span className="gf-wipe-tag gf-wipe-before">Before · as rendered</span>
            <span className="gf-wipe-tag gf-wipe-after">After · graded &amp; finished</span>
          </div>
        )}
        {isolate && <span className="gf-isolate-tag" data-testid="isolate-tag">{isolate === "halation" ? "Halation layer only" : "Bloom layer only"}</span>}
        {!watch && (
          <span className="gf-chip">
            Live animated shot · Post FX{lookId && lookId !== "clean" ? ` · ${getLook(lookId).label}` : ""}
          </span>
        )}
        {mode === "experiment" && !watch && (
          <button type="button" className="gf-compare" data-testid="wipe-toggle" aria-pressed={wipe !== null} onClick={() => gfStore.getState().setWipe(wipe === null ? 0.5 : null)}>
            {wipe === null ? "Compare before / after" : "Hide compare"}
          </button>
        )}
      </Slot>
    </div>
  );
}
