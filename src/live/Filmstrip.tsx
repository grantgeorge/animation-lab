"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { hfovDeg } from "@/engine/optics";
import { feasiblePresets, solveMatchedFraming } from "@/engine/matchFraming";
import { distanceToPrimaryAlongRail } from "@/engine/rig";
import { viewports } from "@/renderer/runtime/viewports";
import { labStore, useLabShallow } from "@/ui/store/labStore";

function TileWindow({ index }: { index: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => (el ? viewports.register(`thumb:${index}`, el) : undefined), [el, index]);
  return <div ref={useCallback((n: HTMLDivElement | null) => setEl(n), [])} className="absolute inset-0" />;
}

/**
 * Lens presets as live film frames: each tile is the actual animated shot that lens would give,
 * from the current camera position (Fixed) or from where Match framing would put the camera.
 */
export function Filmstrip() {
  const { focal, mode, matchRef, target, rig } = useLabShallow((s) => ({
    focal: Math.round(s.camera.rig.focalMm),
    mode: s.camera.mode,
    matchRef: s.camera.matchRef,
    target: s.camera.targetId,
    rig: s.camera.rig,
  }));
  const info = useMemo(() => {
    if (mode !== "match" || !matchRef) return null;
    const feas = feasiblePresets(d, target, matchRef);
    const dist = Object.fromEntries(d.focal.presets.map((p) => [p, distanceToPrimaryAlongRail(d, solveMatchedFraming(d, rig, target, matchRef, p).rig.railS)]));
    return { feas, dist };
  }, [mode, matchRef, target, rig]);
  return (
    <div data-ui className="filmstrip lf-filmstrip" data-testid="filmstrip" aria-label="Live lens comparisons">
      {d.focal.presets.map((p, k) => {
        const on = p === focal;
        const blocked = info ? !info.feas[p] : false;
        return (
          <button
            key={p}
            type="button"
            onClick={() => labStore.getState().setFocal(p, "preset")}
            data-testid={`tile-${p}`}
            aria-pressed={on}
            data-limited={blocked || undefined}
            title={blocked ? "Rail end: Match can't hold this framing at this lens" : `${p} mm (key ${k + 1})`}
            className="lf-lens-tile"
          >
            <span className="lf-tile-frame">
            <TileWindow index={k} />
            <span className="lf-tile-key">{k + 1}</span>
            </span>
            <span className="lf-tile-caption">
              <span>{p}<small> mm</small></span>
              <span>{blocked ? "Rail limit" : info ? `${info.dist[p].toFixed(1)} m` : `${hfovDeg(p).toFixed(0)}°`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
