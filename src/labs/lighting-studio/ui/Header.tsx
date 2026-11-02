"use client";

import Link from "next/link";
import { formatRatio, formatStops } from "../engine/ratio";
import { studioStore } from "../store";
import { formatAzimuth, formatElevation, useEffective } from "./hooks";

export function Header() {
  return (
    <header className="ls-header" data-ui>
      <div className="ls-brand">
        <Link href="/" data-testid="home-link" className="ls-home" aria-label="Back to Animation Lab">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Animation Lab</span>
        </Link>
        <span className="ls-brand-divider" aria-hidden="true" />
        <h1>Lighting Studio</h1>
      </div>
      <p>Shape the light. Change the story.</p>
      <button type="button" className="ls-help" data-testid="help-button" onClick={() => studioStore.getState().setHelpOpen(true)}>Field guide <span>?</span></button>
    </header>
  );
}

export function Readouts() {
  const { rig, analysis } = useEffective();
  const k = rig.lights.key;
  return (
    <div className="ls-readouts" aria-label="Lighting estimates">
      <span data-testid="chip-key"><i className="ls-dot" />Key <b>{k.on && analysis.e.key > 0 ? `${formatAzimuth(k.azimuthDeg)} · ${formatElevation(k.elevationDeg)}` : "off"}</b></span>
      <span data-testid="chip-ratio" title="Estimated (key + fill + ambient) / (fill + ambient). Direction, beam and surface shading are not measured.">Rig ratio <b>{analysis.e.key > 0 ? formatRatio(analysis.ratio) : "–"}</b></span>
      <span data-testid="chip-contrast" title="Estimated lighting difference, not measured image contrast."><b>{analysis.e.key > 0 ? formatStops(analysis.stops) : "–"}</b><span className="ls-estimate">estimated</span></span>
    </div>
  );
}
