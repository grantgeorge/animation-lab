"use client";

import { useState } from "react";
import { getCamera } from "../engine/cameras";
import { FORMATS, cropFactor, type FormatId } from "../engine/formats";
import { LOOK_ORDER, LOOKS } from "../engine/looks";
import { equivalentFocal, equivalentStop, formatFocal, formatStop, FULL_STOPS, T_STOPS } from "../engine/optics";
import { FOCUS_TARGETS, MARKS } from "../engine/shot";
import { FRAME_RATES, SHUTTER_ANGLES, panPeakSpeedDegS, sampleCount } from "../engine/shutter";
import { scoreBlind } from "../engine/blind";
import { APPROX_NOTE, STEP_COPY } from "../content";
import { cfStore, STEPS, useCF, type Step } from "../store";
import { PROMPT_NOTE } from "../engine/prompt";
import { CameraDetail } from "./CameraBrowser";
import { CurvePlot, DofBand, FovWedge, GateDiagram, ShutterDiagram } from "./Diagrams";
import { useDerived } from "./useDerived";

function Seg<T extends string | number>({ label, value, options, onPick, testId, fmt }: { label?: string; value: T; options: readonly T[]; onPick: (v: T) => void; testId: string; fmt?: (v: T) => string }) {
  return (
    <div className="cf-field">
      {label && <span className="cf-label">{label}</span>}
      <div className="cf-seg" role="radiogroup" aria-label={label ?? testId} data-testid={testId}>
        {options.map((o) => (
          <button key={String(o)} type="button" role="radio" aria-checked={o === value} data-testid={`${testId}-${o}`} onClick={() => onPick(o)}>{fmt ? fmt(o) : String(o)}</button>
        ))}
      </div>
    </div>
  );
}

function Readout({ rows }: { rows: [string, string, string?][] }) {
  return (
    <dl className="cf-readout mono">
      {rows.map(([k, v, id]) => <div key={k}><dt>{k}</dt><dd data-testid={id}>{v}</dd></div>)}
    </dl>
  );
}

const EQUIV_FORMATS: FormatId[] = ["alexa35", "ff", "vv", "alexa265"];

function SensorPanel() {
  const framing = useCF((s) => s.framing);
  const matchDof = useCF((s) => s.matchDof);
  const openGate = useCF((s) => s.openGate);
  const focal = useCF((s) => s.focalMm);
  const t = useCF((s) => s.tStop);
  const d = useDerived();
  return (
    <>
      <Seg label="When the sensor changes" value={framing} options={["lens", "framing"] as const} onPick={(v) => cfStore.getState().setFraming(v)} testId="framing" fmt={(v) => (v === "lens" ? "Same lens" : "Same framing")} />
      <p className="cf-hint">{framing === "lens" ? "The focal length stays; the field of view follows the sensor width." : "The focal length scales with the sensor width: same field of view, same perspective, same subject size."}</p>
      {framing === "framing" && (
        <label className="cf-check"><input type="checkbox" checked={matchDof} data-testid="match-dof" onChange={(e) => cfStore.getState().setMatchDof(e.target.checked)} /> Also keep the depth of field (scale the T-stop)</label>
      )}
      <label className="cf-check"><input type="checkbox" checked={openGate} data-testid="open-gate" onChange={(e) => cfStore.getState().setOpenGate(e.target.checked)} /> Show the full open gate (native aspect)</label>
      <Readout rows={[
        [openGate ? "Open gate" : "16:9 frame", `${d.gate.widthMm.toFixed(2)} × ${d.gate.heightMm.toFixed(2)} mm`],
        ["Crop factor", `×${d.crop.toFixed(2)}${d.crop < 0.97 ? " (larger than FF)" : d.crop > 1.03 ? " (smaller than FF)" : ""}`],
        ["Lens", `${formatFocal(focal)} mm T${formatStop(t)}`, "readout-lens"],
        ["FF equivalent", `${formatFocal(d.ffFocal)} mm T${formatStop(d.ffStop)}`, "readout-ff-equivalent"],
        ["Horizontal FOV", `${d.hfov.toFixed(1)}°`, "readout-hfov"],
      ]} />
      <GateDiagram />
      <div className="cf-equiv" data-testid="equivalence-table">
        <span className="cf-label">This exact shot on other formats</span>
        <table className="mono">
          <thead><tr><th>Format</th><th>Lens</th><th>Same DoF</th></tr></thead>
          <tbody>
            {EQUIV_FORMATS.map((id) => {
              const f = FORMATS[id];
              return (
                <tr key={id} className={id === d.format.id ? "on" : ""}>
                  <td>{f.label}</td>
                  <td>{formatFocal(equivalentFocal(focal, d.format, f))} mm</td>
                  <td>T{formatStop(equivalentStop(t, d.format, f))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CameraDetail />
    </>
  );
}

const EQ_MIN = 12;
const EQ_MAX = 300;
const FF_PRESETS = [18, 24, 35, 50, 85, 135];

function FocalPanel() {
  const focal = useCF((s) => s.focalMm);
  const d = useDerived();
  const k = cropFactor(d.format);
  const eq = focal * k;
  const u = Math.round((Math.log(eq / EQ_MIN) / Math.log(EQ_MAX / EQ_MIN)) * 1000);
  return (
    <>
      <div className="cf-field">
        <span className="cf-label">Focal length <b className="mono" data-testid="focal-value">{formatFocal(focal)} mm</b></span>
        <input type="range" min={0} max={1000} value={Math.max(0, Math.min(1000, u))} data-testid="focal-slider" aria-label="Focal length" onChange={(e) => cfStore.getState().setFocal((EQ_MIN * Math.pow(EQ_MAX / EQ_MIN, Number(e.target.value) / 1000)) / k)} />
      </div>
      <div className="cf-presets" data-testid="focal-presets">
        {FF_PRESETS.map((p) => {
          const actual = Math.round((p / k) * (p / k < 10 ? 10 : 1)) / (p / k < 10 ? 10 : 1);
          return <button key={p} type="button" aria-pressed={Math.abs(actual - focal) < 0.05} data-testid={`focal-${p}`} onClick={() => cfStore.getState().setFocal(actual)}>{formatFocal(actual)}<small>{p} FF</small></button>;
        })}
      </div>
      <p className="cf-hint">Presets are this format&rsquo;s lenses for the classic full-frame fields of view.</p>
      <Readout rows={[
        ["Horizontal FOV", `${d.hfov.toFixed(1)}°`, "readout-hfov-2"],
        ["Vertical FOV", `${d.vfov.toFixed(1)}°`],
        ["FF equivalent", `${formatFocal(d.ffFocal)} mm`],
        ["Bram\u2019s height", `${Math.min(999, d.subjectFraction * 1.78 * (d.gate.widthMm / d.gate.heightMm) * 100).toFixed(0)} % of frame height`],
      ]} />
      <FovWedge />
    </>
  );
}

function AperturePanel() {
  const t = useCF((s) => s.tStop);
  const focusTarget = useCF((s) => s.focusTarget);
  const focusM = useCF((s) => s.focusM);
  const showBand = useCF((s) => s.showBand);
  const d = useDerived();
  const idx = T_STOPS.reduce((best, v, i) => (Math.abs(Math.log(v / t)) < Math.abs(Math.log(T_STOPS[best] / t)) ? i : best), 0);
  const fu = Math.round((Math.log(focusM / 0.5) / Math.log(40)) * 1000);
  return (
    <>
      <div className="cf-field">
        <span className="cf-label">T-stop <b className="mono" data-testid="tstop-value">T{formatStop(t)}</b></span>
        <input type="range" min={0} max={T_STOPS.length - 1} value={idx} data-testid="tstop-slider" aria-label="T-stop" onChange={(e) => cfStore.getState().setStop(T_STOPS[Number(e.target.value)])} />
      </div>
      <div className="cf-presets cf-presets-tight" data-testid="tstop-presets">
        {FULL_STOPS.map((p) => <button key={p} type="button" aria-pressed={Math.abs(p - t) < 0.05} data-testid={`tstop-${p}`} onClick={() => cfStore.getState().setStop(p)}>T{p}</button>)}
      </div>
      <Seg label="Focus on" value={focusTarget} options={[...FOCUS_TARGETS, "manual"] as const} onPick={(v) => cfStore.getState().setFocus(v)} testId="focus" fmt={(v) => (v === "manual" ? "Manual" : MARKS[v].label)} />
      <div className="cf-field">
        <span className="cf-label">Focus distance <b className="mono">{focusM.toFixed(2)} m</b></span>
        <input type="range" min={0} max={1000} value={Math.max(0, Math.min(1000, fu))} data-testid="focus-slider" aria-label="Focus distance" onChange={(e) => cfStore.getState().setFocus("manual", 0.5 * Math.pow(40, Number(e.target.value) / 1000))} />
      </div>
      <label className="cf-check"><input type="checkbox" checked={showBand} data-testid="show-band" onChange={(e) => cfStore.getState().setShowBand(e.target.checked)} /> Tint what&rsquo;s inside the depth of field (same formula as the blur)</label>
      <DofBand />
      <Readout rows={[
        ["Near / far", `${d.dof.nearM.toFixed(2)} – ${Number.isFinite(d.dof.farM) ? d.dof.farM.toFixed(2) : "∞"} m`, "readout-dof"],
        ["Hyperfocal", `${d.dof.hyperfocalM.toFixed(1)} m`],
        ["Circle of confusion", `${(d.coc * 1000).toFixed(1)} µm (width ÷ 1200)`],
        ["Back wall blur", `${d.blur.wall.toFixed(1)} × CoC`],
        ["FF equivalent", `T${formatStop(d.ffStop)} for the same DoF`],
      ]} />
      <p className="cf-hint">Brightness is held constant: we assume ND or ISO compensate for every stop. T-stops stand in for f-numbers in the DoF math.</p>
    </>
  );
}

function ShutterPanel() {
  const deg = useCF((s) => s.shutterDeg);
  const fps = useCF((s) => s.fps);
  const slow = useCF((s) => s.slowMotion);
  const move = useCF((s) => s.move);
  const rolling = useCF((s) => s.rollingTest);
  const d = useDerived();
  const cam = d.camera;
  const over = cam.maxFpsValue !== null && fps > cam.maxFpsValue;
  const rollingLive = rolling && !d.globalShutter;
  const samples = rollingLive ? (deg <= 90 ? 1 : 2) : sampleCount(16, move === "pan", deg);
  return (
    <>
      <Seg label="Shutter angle" value={deg} options={SHUTTER_ANGLES} onPick={(v) => cfStore.getState().setShutter(v)} testId="shutter" fmt={(v) => `${v}°`} />
      <Seg label="Frame rate" value={fps} options={FRAME_RATES} onPick={(v) => cfStore.getState().setFps(v)} testId="fps" fmt={(v) => (v === 240 ? "240 HS" : `${v}`)} />
      {fps > 24 && (
        <label className="cf-check"><input type="checkbox" checked={slow} data-testid="slow-motion" onChange={(e) => cfStore.getState().setFps(fps, e.target.checked)} /> Play back at 24 fps ({(fps / 24).toFixed(0)}× slow motion)</label>
      )}
      {over && <p className="cf-warn" data-testid="fps-warning">{cam.name}: {cam.maxFps}.</p>}
      <Seg label="Camera move" value={move} options={["locked", "pan"] as const} onPick={(v) => cfStore.getState().setMove(v)} testId="move" fmt={(v) => (v === "locked" ? "Locked off" : "Fast pan")} />
      <label className="cf-check"><input type="checkbox" checked={rolling} data-testid="rolling-test" onChange={(e) => cfStore.getState().setRollingTest(e.target.checked)} /> Rolling-shutter test (fast pan, rows read top to bottom)</label>
      {rolling && (
        <div className="cf-rolling" data-testid="rolling-note">
          <p>{d.globalShutter ? `${cam.name}: ${cam.shutter.toLowerCase()} shutter, so every row is exposed at once and verticals stay straight.` : `${cam.name}: modelled as rolling. A ~20 ms readout (illustrative, not a manufacturer figure) leans verticals by about ${d.skewDeg.toFixed(1)}° of pan at peak speed.`}</p>
          <div className="cf-presets">
            <button type="button" data-testid="compare-rolling" aria-pressed={cam.id === "alexa35"} onClick={() => cfStore.getState().selectCamera("alexa35")}>ALEXA 35<small>rolling</small></button>
            <button type="button" data-testid="compare-global" aria-pressed={cam.id === "vraptorx"} onClick={() => cfStore.getState().selectCamera("vraptorx")}>V-RAPTOR [X]<small>global</small></button>
          </div>
        </div>
      )}
      <ShutterDiagram samples={samples} perBand={rollingLive} />
      <Readout rows={[
        ["Shutter speed", `${d.shutterSpeed} s`, "readout-shutter-speed"],
        ["Pan blur at peak", move === "pan" ? `${(d.panBlur * 100).toFixed(1)} % of frame width` : `— (pan peaks at ${panPeakSpeedDegS().toFixed(0)}°/s)`],
      ]} />
      <p className="cf-hint">Motion blur is real: each frame averages renders at the sample times above, across the open shutter.</p>
    </>
  );
}

function ResponsePanel() {
  const lookId = useCF((s) => s.lookId);
  const ev = useCF((s) => s.exposureStops);
  const d = useDerived();
  return (
    <>
      <div className="cf-looks" role="radiogroup" aria-label="Look" data-testid="looks">
        {LOOK_ORDER.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={id === lookId} data-testid={`look-${id}`} onClick={() => cfStore.getState().setLook(id)}>
            <span>{LOOKS[id].label}</span>
          </button>
        ))}
      </div>
      <p className="cf-look-blurb">{d.look.blurb}</p>
      <div className="cf-field">
        <span className="cf-label">Exposure <b className="mono" data-testid="exposure-value">{ev >= 0 ? "+" : ""}{ev.toFixed(1)} EV</b></span>
        <input type="range" min={-3} max={4} step={0.5} value={ev} data-testid="exposure-slider" aria-label="Exposure" onChange={(e) => cfStore.getState().setExposure(Number(e.target.value))} />
      </div>
      <div className="cf-presets">
        <button type="button" data-testid="highlight-test" aria-pressed={ev === 2.5} onClick={() => cfStore.getState().setExposure(ev === 2.5 ? 0 : 2.5)}>Highlight test<small>+2.5 EV</small></button>
        <button type="button" data-testid="exposure-reset" onClick={() => cfStore.getState().setExposure(0)}>Reset<small>0 EV</small></button>
      </div>
      <CurvePlot />
      <Readout rows={[
        ["Clips at", `+${d.look.clipStops} stops over grey`],
        ["98 % white at", `+${d.headroom.toFixed(1)} stops`],
        ["Grain", d.look.grain ? `${d.look.chromaNoise ? "sensor noise" : "film grain"} ${(d.look.grain * 100).toFixed(0)}` : "none"],
        ["Halation", d.look.halation ? d.look.halation.toFixed(2) : "none"],
      ]} />
      <p className="cf-approx" data-testid="approx-note">{APPROX_NOTE}</p>
    </>
  );
}

function BlindPanel() {
  const blind = useCF((s) => s.blind);
  const score = scoreBlind(blind, blind.guesses);
  return (
    <>
      <p className="cf-hint">Assign each name to one picture, then reveal. Round {blind.round + 1} · {blind.round % 2 === 0 ? "three digital-cinema looks" : "drawn from every family"}.</p>
      <div className="cf-presets">
        <button type="button" data-testid="blind-reveal" disabled={!score.complete || blind.revealed} onClick={() => cfStore.getState().reveal()}>Reveal</button>
        <button type="button" data-testid="blind-next" onClick={() => cfStore.getState().nextRound()}>Next round</button>
      </div>
      {blind.revealed && (
        <div className="cf-blind-result" data-testid="blind-result" data-correct={score.correct}>
          <b>{score.correct} / 3 correct.</b>
          <p>{score.correct === 3 ? "Sharp eyes. Now notice how small those differences were next to a lens or light change." : "Hard, isn't it? Next to a change of lens, aperture or light, family looks differ only a little."} Swap 32 mm T2.8 for 85 mm T1.4, or move the key light, and every one of these pictures changes far more than it does between presets.</p>
        </div>
      )}
      <p className="cf-approx">{APPROX_NOTE}</p>
    </>
  );
}

const PANELS: Record<Step, () => React.JSX.Element> = { sensor: SensorPanel, focal: FocalPanel, aperture: AperturePanel, shutter: ShutterPanel, response: ResponsePanel, blind: BlindPanel };

export function StepPanel() {
  const step = useCF((s) => s.step);
  const c = STEP_COPY[step];
  const Panel = PANELS[step];
  const i = STEPS.indexOf(step);
  return (
    <div className="cf-step-panel" data-testid={`panel-${step}`}>
      <div className="cf-panel-heading">
        <span className="cf-eyebrow">{step === "blind" ? "EXERCISE" : `STEP ${c.n} OF 5`}</span>
        <h2>{c.title}</h2>
        <p>{c.lesson}</p>
      </div>
      <div className="cf-panel-body"><Panel /></div>
      <p className="cf-tip">{c.tip}</p>
      {i < STEPS.length - 1 && (
        <button type="button" className="cf-next" data-testid="next-step" onClick={() => cfStore.getState().setStep(STEPS[i + 1])}>Next: {STEP_COPY[STEPS[i + 1]].title} →</button>
      )}
    </div>
  );
}

/** One copyable Seedance line built from the controls. */
export function PromptBar() {
  const d = useDerived();
  const [copied, setCopied] = useState(false);
  return (
    <section className="cf-prompt" data-testid="prompt-bar">
      <span className="cf-eyebrow">PROMPT</span>
      <p className="mono" data-testid="prompt-text">{d.prompt}</p>
      <button type="button" data-testid="copy-prompt" onClick={async () => {
        try {
          await navigator.clipboard.writeText(d.prompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable: the text stays selectable */
        }
      }}>{copied ? "Copied" : "Copy"}</button>
      <span className="cf-prompt-note" title={PROMPT_NOTE}>{PROMPT_NOTE}</span>
    </section>
  );
}

/** Every number behind the shot (Inspect). */
export function Readouts() {
  const d = useDerived();
  const s = useCF((st) => st);
  const cam = getCamera(s.cameraId);
  return (
    <div className="cf-inspect-readouts" data-testid="inspect-readouts">
      <Readout rows={[
        ["Camera", cam.name],
        ["Format", d.format.label],
        [s.openGate ? "Open gate" : "16:9 frame", `${d.gate.widthMm.toFixed(2)} × ${d.gate.heightMm.toFixed(2)} mm`],
        ["Crop factor", `×${d.crop.toFixed(2)}`],
        ["Lens", `${formatFocal(s.focalMm)} mm (FF ${formatFocal(d.ffFocal)} mm)`],
        ["FOV h × v", `${d.hfov.toFixed(1)}° × ${d.vfov.toFixed(1)}°`, "inspect-fov"],
        ["Aperture", `T${formatStop(s.tStop)} (FF T${formatStop(d.ffStop)})`],
        ["Focus", `${s.focusM.toFixed(2)} m`],
        ["DoF", `${d.dof.nearM.toFixed(2)} – ${Number.isFinite(d.dof.farM) ? `${d.dof.farM.toFixed(2)} m` : "∞"}`],
        ["CoC", `${(d.coc * 1000).toFixed(1)} µm`],
        ["Shutter", `${s.shutterDeg}° at ${s.fps} fps = ${d.shutterSpeed} s`],
        ["Look", d.look.short],
        ["Clip / 98 % white", `+${d.look.clipStops} / +${d.headroom.toFixed(1)} stops`],
      ]} />
    </div>
  );
}
