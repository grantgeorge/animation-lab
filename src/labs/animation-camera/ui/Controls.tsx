"use client";

import type { ReactNode } from "react";
import { E2 } from "../engine/lens";
import { DEMOS } from "../engine/impossible";
import { DEMO_COPY } from "../content";
import { acStore, useAC } from "../store";
import { live } from "../runtime/live";
import { LiveText } from "./Chrome";

export function Seg<T extends string | number>({ label, value, options, onChange, testPrefix }: { label: string; value: T; options: { id: T; label: ReactNode; hint?: string }[]; onChange: (v: T) => void; testPrefix: string }) {
  return (
    <div className="ac-field">
      <span className="ac-eyebrow">{label}</span>
      <div role="radiogroup" aria-label={label} className="ac-seg" data-count={options.length}>
        {options.map((o) => (
          <button key={String(o.id)} type="button" role="radio" aria-checked={o.id === value} data-testid={`${testPrefix}-${String(o.id).replace(".", "")}`} title={o.hint} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange, testId, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; testId: string; hint?: string }) {
  return (
    <label className="ac-toggle" title={hint}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span aria-hidden />
      {label}
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, testId, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; testId: string; format: (v: number) => string }) {
  return (
    <label className="ac-slider">
      <span>
        {label}
        <b className="mono">{format(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={testId} />
    </label>
  );
}

function E1Controls() {
  const st = useAC((s) => s.e1);
  const set = acStore.getState().setE1;
  return (
    <>
      <Seg label="PROJECTION" value={st.proj} testPrefix="proj" onChange={(proj) => set({ proj })} options={[{ id: "perspective", label: "Perspective" }, { id: "orthographic", label: "Orthographic" }]} />
      <Seg label="CAMERA" value={st.view} testPrefix="view" onChange={(view) => set({ view, ...(view === "iso" ? { proj: "orthographic" as const } : {}) })} options={[{ id: "street", label: "Street ¾" }, { id: "iso", label: "Isometric preset", hint: "45° around, 35.264° down" }]} />
      <Seg label="COMPARE" value={st.compare} testPrefix="compare" onChange={(compare) => set({ compare })} options={[{ id: "off", label: "Single" }, { id: "wipe", label: "Wipe" }]} />
      {st.compare === "wipe" && <Slider label="Wipe position" value={st.wipe} min={0.05} max={0.95} step={0.01} testId="wipe-control" onChange={(wipe) => set({ wipe })} format={(v) => `${Math.round(v * 100)} %`} />}
      <Toggle label="Rulers & height poles" on={st.guides} testId="guides-toggle" onChange={(guides) => set({ guides })} />
    </>
  );
}

function E2Controls() {
  const st = useAC((s) => s.e2);
  const set = acStore.getState().setE2;
  return (
    <>
      <Seg label="LENS" value={E2.focals.includes(Math.round(st.focal) as 24) ? Math.round(st.focal) : 0} testPrefix="focal" onChange={(focal) => set({ focal, sweep: false })} options={E2.focals.map((f) => ({ id: f, label: `${f} mm` }))} />
      <Slider label="Focal length (matched)" value={st.focal} min={E2.min} max={E2.max} step={1} testId="focal-slider" onChange={(focal) => set({ focal, sweep: false })} format={(v) => `${Math.round(v)} mm`} />
      <Toggle label="Dolly-zoom sweep (vertigo)" on={st.sweep} testId="sweep-toggle" onChange={(sweep) => set({ sweep })} hint="Sweep 24 → 100 → 24 mm with matched framing" />
      <p className="ac-note">
        <LiveText get={() => (live.e2 ? `Camera ${live.e2.main.distanceM.toFixed(2)} m away holds Bram at ${(live.e2.main.metric * 100).toFixed(0)} % of frame height.` : "")} />
      </p>
    </>
  );
}

function E3Controls() {
  const st = useAC((s) => s.e3);
  const set = acStore.getState().setE3;
  return (
    <>
      <Seg
        label="STYLE"
        value={st.style}
        testPrefix="move"
        onChange={(style) => set({ style, move: style === "3d" ? "orbit" : "track" })}
        options={[
          { id: "2d", label: "2D" },
          { id: "2.5d", label: "2.5D" },
          { id: "3d", label: "3D" },
        ]}
      />
      <Seg label="MOVE" value={st.move} testPrefix="kind" onChange={(move) => set({ move })} options={[{ id: "track", label: "Track + push" }, { id: "orbit", label: "Orbit" }]} />
      <p className="ac-note">{st.style === "2d" ? "One painting, characters on the same plane: the camera can only slide and scale it." : st.style === "2.5d" ? "Seven cards hung at real depths. Near cards slide faster; nothing inside a card has depth." : "The real set and cast. Parallax happens inside every object, and an orbit reveals new sides."}</p>
    </>
  );
}

function E4Controls() {
  const st = useAC((s) => s.e4);
  const set = acStore.getState().setE4;
  return (
    <>
      <Seg label="LOOK" value={st.style} testPrefix="look" onChange={(style) => set({ style })} options={[{ id: "photoreal", label: "Photoreal" }, { id: "anime", label: "Anime" }, { id: "split", label: "Split" }]} />
      <div className="ac-group">
        <span className="ac-eyebrow ac-tone-cyan">PHOTOREAL CAMERA</span>
        <Toggle label="Depth of field" on={st.dof} testId="dof-toggle" onChange={(dof) => set({ dof })} />
        <Slider label="Aperture" value={st.fStop} min={1.4} max={16} step={0.1} testId="fstop-slider" onChange={(fStop) => set({ fStop: Math.round(fStop * 10) / 10 })} format={(v) => `f/${v}`} />
        <Toggle label="Motion blur (180° shutter)" on={st.motionBlur} testId="mb-toggle" onChange={(motionBlur) => set({ motionBlur })} />
      </div>
      <div className="ac-group">
        <span className="ac-eyebrow ac-tone-pink">ANIME CAMERA</span>
        <Seg label="CHARACTER TIMING" value={st.step} testPrefix="step" onChange={(step) => set({ step })} options={[{ id: 1, label: "Ones" }, { id: 2, label: "Twos" }, { id: 3, label: "Threes" }]} />
        <Toggle label="Camera on twos too" on={st.cameraOnTwos} testId="camtwos-toggle" onChange={(cameraOnTwos) => set({ cameraOnTwos })} />
        <Toggle label="Speed lines on fast moves" on={st.speedLines} testId="speed-toggle" onChange={(speedLines) => set({ speedLines })} />
        <Toggle label="Cel shading & ink" on={st.cel} testId="cel-toggle" onChange={(cel) => set({ cel })} />
      </div>
    </>
  );
}

function E5Controls() {
  const st = useAC((s) => s.e5);
  const set = acStore.getState().setE5;
  return (
    <>
      <div className="ac-field">
        <span className="ac-eyebrow">IMPOSSIBLE SHOT</span>
        <div className="ac-demos" role="radiogroup" aria-label="Impossible shot">
          {DEMOS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={d === st.demo} data-testid={`demo-${d}`} onClick={() => set({ demo: d })}>
              <b>{DEMO_COPY[d].label}</b>
              <span>breaks {DEMO_COPY[d].rule.toLowerCase()}</span>
            </button>
          ))}
        </div>
      </div>
      {st.demo === "push" && <Slider label="Fisheye bulge" value={st.fisheye} min={0} max={0.7} step={0.01} testId="fisheye-slider" onChange={(fisheye) => set({ fisheye })} format={(v) => v.toFixed(2)} />}
      <Toggle label="Show the physical version beside it" on={st.compare} testId="e5-compare" onChange={(compare) => set({ compare })} />
      <p className="ac-note">{DEMO_COPY[st.demo].how}</p>
    </>
  );
}

export function Controls() {
  const exp = useAC((s) => s.exp);
  return (
    <div className="ac-controls" data-testid="controls">
      {exp === 1 && <E1Controls />}
      {exp === 2 && <E2Controls />}
      {exp === 3 && <E3Controls />}
      {exp === 4 && <E4Controls />}
      {exp === 5 && <E5Controls />}
    </div>
  );
}
