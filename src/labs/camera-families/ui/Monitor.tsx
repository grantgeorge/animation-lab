"use client";

import { LOOKS } from "../engine/looks";
import { formatFocal, formatStop } from "../engine/optics";
import { slotRef } from "../runtime/live";
import { cfStore, useCF } from "../store";
import { useDerived } from "./useDerived";

/** The graded shot, at the gate's aspect (16:9 extraction or open gate), with readout chips. */
export function ShotMonitor({ chips = true }: { chips?: boolean }) {
  const d = useDerived();
  const s = useCF((st) => st);
  const ar = d.gate.widthMm / d.gate.heightMm;
  return (
    <div className="cf-monitor" data-testid="shot-monitor" style={{ ["--ar" as string]: ar }} data-aspect={ar.toFixed(3)}>
      <div ref={slotRef("main")} className="cf-slot" data-testid="shot-slot" />
      {chips && (
        <>
          <div className="cf-chip cf-chip-tl mono" data-testid="chip-camera"><b>{d.camera.name}</b> · {d.format.label}{s.openGate ? " · open gate" : ""}</div>
          <div className="cf-chip cf-chip-tr mono" data-testid="chip-lens">{formatFocal(s.focalMm)} mm · T{formatStop(s.tStop)} · {s.shutterDeg}° · {s.fps} fps</div>
          {s.rollingTest && <div className="cf-plumb" data-testid="plumb-line" aria-hidden><span className="mono">true vertical</span></div>}
          <div className="cf-chip cf-chip-bl mono" data-testid="chip-look">{LOOKS[s.lookId].label}{s.lookId !== d.camera.look ? " (your pick)" : ""}{s.exposureStops ? ` · ${s.exposureStops > 0 ? "+" : ""}${s.exposureStops.toFixed(1)} EV` : ""}</div>
          <div className="cf-chip cf-chip-br mono" data-testid="chip-fov">HFOV {d.hfov.toFixed(1)}° · focus {s.focusM.toFixed(2)} m</div>
        </>
      )}
      {!chips && <div className="cf-chip cf-chip-tl mono">CAMERA VIEW · graded</div>}
    </div>
  );
}

/** Three monitors, the same frame through three hidden looks. */
export function BlindMonitors() {
  const blind = useCF((s) => s.blind);
  return (
    <div className="cf-blind" data-testid="blind-monitors">
    <div className="cf-blind-row">
      {[0, 1, 2].map((i) => {
        const revealed = blind.revealed;
        const right = blind.guesses[i] === blind.looks[i];
        return (
          <div key={i} className="cf-blind-cell">
            <div className="cf-monitor cf-monitor-blind" style={{ ["--ar" as string]: 16 / 9 }} data-testid={`blind-monitor-${i}`}>
              <div ref={slotRef(`b${i}` as "b0")} className="cf-slot" />
              <div className="cf-chip cf-chip-tl mono"><b>{"ABC"[i]}</b></div>
              {revealed && <div className={`cf-chip cf-chip-bl mono ${right ? "cf-right" : "cf-wrong"}`} data-testid={`blind-answer-${i}`}>{right ? "✓ " : "✗ "}{LOOKS[blind.looks[i]].short}</div>}
            </div>
            <div className="cf-guess" role="radiogroup" aria-label={`Guess for picture ${"ABC"[i]}`}>
              {[...blind.looks].sort().map((l) => (
                <button key={l} type="button" role="radio" aria-checked={blind.guesses[i] === l} disabled={revealed} className={revealed && blind.looks[i] === l ? "cf-correct" : ""} data-testid={`guess-${i}-${l}`} onClick={() => cfStore.getState().guess(i as 0 | 1 | 2, l)}>
                  {LOOKS[l].short}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    <ul className="cf-blind-hints">
      <li><b>Highlights</b>Does the lantern roll off into a soft glow, or clip to a flat patch?</li>
      <li><b>Blacks</b>Is the doorway shadow inky, or lifted and milky?</li>
      <li><b>Colour</b>How red is Bram&rsquo;s coat? How yellow is Pip&rsquo;s raincoat? Warm or cool walls?</li>
      <li><b>Texture</b>Grain, noise or extra sharpening in the plaster?</li>
    </ul>
    </div>
  );
}
