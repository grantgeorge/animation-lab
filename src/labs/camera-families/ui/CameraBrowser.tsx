"use client";

import { useState } from "react";
import { CAMERAS, getCamera, type CameraGroup, type CameraId, type CameraSpec } from "../engine/cameras";
import { FORMATS } from "../engine/formats";
import { cfStore, useCF } from "../store";

const GROUPS: { id: CameraGroup; label: string }[] = [
  { id: "cinema", label: "Digital cinema" },
  { id: "film", label: "Film" },
  { id: "specialized", label: "Specialized" },
];

const VERIFY: Record<CameraSpec["verification"], string> = {
  manufacturer: "Specs checked against manufacturer pages",
  secondary: "Specs from secondary sources (manufacturer page not reachable)",
  unverified: "Specs could not be verified",
};

function Card({ c, on }: { c: CameraSpec; on: boolean }) {
  const f = FORMATS[c.format];
  return (
    <button type="button" className="cf-card" aria-pressed={on} data-testid={`camera-${c.id}`} data-format={c.format} onClick={() => cfStore.getState().selectCamera(c.id as CameraId)}>
      <span className="cf-card-maker">{c.maker}</span>
      <span className="cf-card-name">{c.name}</span>
      <span className="cf-card-format mono">{f.label}</span>
      <dl className="mono">
        <div><dt>Sensor</dt><dd>{f.widthMm.toFixed(1)} × {f.heightMm.toFixed(1)} mm{f.nominal ? "*" : ""}</dd></div>
        <div><dt>Res</dt><dd>{c.resolution.split(" (")[0]}</dd></div>
        <div><dt>DR</dt><dd>{c.dr ?? "not claimed"}</dd></div>
        <div><dt>Max fps</dt><dd>{c.maxFpsValue ?? "—"}</dd></div>
        <div><dt>Shutter</dt><dd>{c.shutter.split(" (")[0].split(";")[0]}</dd></div>
      </dl>
      <span className="cf-card-use">{c.use.split(";")[0]}</span>
      {c.verification !== "manufacturer" && <span className="cf-card-flag" title={VERIFY[c.verification]}>secondary source</span>}
    </button>
  );
}

/** Horizontal card strip, grouped by family. Picking a card sets the gate for the shot. */
export function CameraBrowser() {
  const cameraId = useCF((s) => s.cameraId);
  const [group, setGroup] = useState<CameraGroup>(() => getCamera(cfStore.getState().cameraId).group);
  return (
    <section className="cf-browser" data-testid="camera-browser" aria-label="Camera families">
      <div className="cf-browser-head">
        <span className="cf-eyebrow">CAMERA FAMILIES</span>
        <div role="tablist" className="cf-browser-tabs">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === group} data-testid={`group-${g.id}`} onClick={() => setGroup(g.id)}>
              {g.label} <span>{CAMERAS.filter((c) => c.group === g.id).length}</span>
            </button>
          ))}
        </div>
        <span className="cf-browser-note">DR = manufacturer-claimed · * nominal sensor size</span>
      </div>
      <div className="cf-cards">
        {CAMERAS.filter((c) => c.group === group).map((c) => <Card key={c.id} c={c} on={c.id === cameraId} />)}
      </div>
    </section>
  );
}

/** Full spec sheet for the selected camera, with sources and verification status. */
export function CameraDetail() {
  const cameraId = useCF((s) => s.cameraId);
  const c = getCamera(cameraId);
  return (
    <section className="cf-detail" data-testid="camera-detail" data-verification={c.verification}>
      <span className="cf-eyebrow">SELECTED · {c.maker.toUpperCase()}</span>
      <h3>{c.name}</h3>
      <dl className="mono">
        <div><dt>Sensor</dt><dd>{c.sensor}</dd></div>
        <div><dt>Resolution</dt><dd>{c.resolution}</dd></div>
        <div><dt>DR</dt><dd>{c.dr ? `${c.dr} (manufacturer-claimed)` : "No manufacturer claim"}</dd></div>
        <div><dt>Max fps</dt><dd>{c.maxFps}</dd></div>
        <div><dt>Shutter</dt><dd>{c.shutter}</dd></div>
        <div><dt>Typical use</dt><dd>{c.use}</dd></div>
      </dl>
      {c.note && <p className="cf-detail-note">{c.note}</p>}
      <p className="cf-detail-verify">{VERIFY[c.verification]} (checked Nov 2026):</p>
      <ul>
        {c.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a></li>)}
      </ul>
    </section>
  );
}
