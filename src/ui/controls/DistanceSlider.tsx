"use client";

import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { distanceToPrimaryAlongRail } from "@/engine/rig";
import { SHOT_SIZE_BOUNDS } from "@/engine/classify";
import { labStore, useLab } from "@/ui/store/labStore";

const DMIN = distanceToPrimaryAlongRail(d, d.rail.sMax);
const DMAX = distanceToPrimaryAlongRail(d, d.rail.sMin);
const toX = (m: number) => (m - DMIN) / (DMAX - DMIN);

/** Dolly: distance to Bram's mark along the rail. Shot-size bands for the current lens slide underneath. */
export function DistanceSlider() {
  const railS = useLab((s) => s.camera.rig.railS);
  const focal = useLab((s) => s.camera.rig.focalMm);
  const mode = useLab((s) => s.camera.mode);
  const dist = distanceToPrimaryAlongRail(d, railS);
  const disabled = mode === "match";
  // Band edges: distance where Bram's full body fills p of the frame height: Z = H·f / (p·gateH)
  const H = d.characters.primary.heightM;
  const bands: { label: string; from: number; to: number }[] = [];
  let prevZ = Infinity;
  for (const [size, upper] of SHOT_SIZE_BOUNDS) {
    const zAtUpper = upper === Infinity ? 0 : (H * focal) / (upper * d.gate.heightMm);
    bands.push({ label: size, from: Math.max(DMIN, zAtUpper), to: Math.min(DMAX, prevZ) });
    prevZ = zAtUpper;
  }
  return (
    <div className="lf-distance-slider" data-disabled={disabled}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="mono text-[18px] font-semibold leading-none text-distance" data-testid="distance-readout">
          {dist.toFixed(2)}
          <span className="ml-1 text-[12px] text-ink-2">m from Bram</span>
        </span>
        {disabled && <span className="lf-auto-distance">Auto</span>}
      </div>
      <div className="relative h-4">
        {bands
          .filter((b) => b.to > b.from)
          .map((b) => (
            <div
              key={b.label}
              className="absolute top-0 flex h-3.5 items-center justify-center overflow-hidden border-r border-white/10 bg-white/[0.04]"
              style={{ left: `${toX(b.from) * 100}%`, width: `${(toX(b.to) - toX(b.from)) * 100}%` }}
              title={`${b.label} on Bram at ${Math.round(focal)} mm`}
            >
              <span className="mono text-[8.5px] text-ink-3">{b.label}</span>
            </div>
          ))}
      </div>
      <input
        type="range"
        min={DMIN}
        max={DMAX}
        step={0.01}
        value={dist}
        disabled={disabled}
        aria-label="Camera distance from Bram along the dolly rail"
        aria-valuetext={`${dist.toFixed(2)} metres from Bram`}
        aria-describedby="dolly-explanation"
        data-testid="distance-slider"
        onChange={(e) => labStore.getState().setDistance(Number(e.target.value), "slider")}
        onPointerDown={() => labStore.getState().setInteraction({ dragging: "dolly" })}
        onPointerUp={() => labStore.getState().setInteraction({ dragging: null })}
        onPointerCancel={() => labStore.getState().setInteraction({ dragging: null })}
        onLostPointerCapture={() => labStore.getState().setInteraction({ dragging: null })}
        className="distance-range mt-1 w-full accent-[var(--color-distance)] disabled:cursor-not-allowed"
      />
    </div>
  );
}
