"use client";

import { CAMERA, MOVES } from "../engine/camera";
import { HAZE_COLORS, type HazeColorId } from "../engine/haze";
import { SLICE } from "../engine/layers";
import { REFS, REF_IDS, STORIES, type StoryId } from "../engine/scale";
import { riskOf } from "../engine/prompt";
import { CONSTRUCT_COPY, CUE_COPY, MOVE_COPY, STEP_SHORT } from "../content";
import { CUE_IDS, STEP_ORDER, edStore, isCueOn, useED, type CueId, type Overlay } from "../store";
import { live } from "../runtime/live";
import { LiveText } from "./Chrome";

function Seg<T extends string>({ value, options, label, onChange, testPrefix }: { value: T; options: readonly { id: T; label: string }[]; label: string; onChange: (v: T) => void; testPrefix: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="ed-seg" style={{ "--n": options.length } as React.CSSProperties}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} data-testid={`${testPrefix}-${o.id}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, testId, label }: { on: boolean; onChange: (v: boolean) => void; testId: string; label: string }) {
  return (
    <label className="ed-toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} data-testid={testId} aria-label={label} />
      <span />
    </label>
  );
}

function Slider({ value, min, max, step, onChange, testId, label, fmt }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; testId: string; label: string; fmt: (v: number) => string }) {
  return (
    <div className="ed-slider">
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} data-testid={testId} onChange={(e) => onChange(Number(e.target.value))} />
      <b className="mono">{fmt(value)}</b>
    </div>
  );
}

function CueRow({ id, children }: { id: CueId; children: React.ReactNode }) {
  const cues = useED((s) => s.cues);
  const step = useED((s) => s.step);
  const on = isCueOn(cues, id);
  const fresh = step !== null && step > 0 && STEP_ORDER[step - 1] === id;
  return (
    <div className="ed-cue" data-on={on ? "1" : "0"} data-fresh={fresh ? "1" : "0"} data-testid={`cue-row-${id}`}>
      <div className="ed-cue-head">
        <span className="ed-cue-name">{CUE_COPY[id].label}</span>
        {children}
      </div>
      <p>{on ? CUE_COPY[id].line : CUE_COPY[id].off}</p>
    </div>
  );
}

/** Take-apart: flatten the frame, then rebuild it one cue at a time. */
function TakeApart() {
  const step = useED((s) => s.step);
  const cues = useED((s) => s.cues);
  const st = edStore.getState();
  const n = step ?? CUE_IDS.filter((id) => isCueOn(cues, id)).length;
  return (
    <div className="ed-takeapart" data-testid="take-apart">
      <div className="ed-takeapart-btns">
        <button type="button" data-testid="flatten" onClick={() => st.isolate("flat")}>
          Flatten
        </button>
        <button type="button" data-testid="add-cue" disabled={step !== null && step >= STEP_ORDER.length} onClick={() => st.setStep(step === null ? 1 : step + 1)}>
          {step === null ? "Rebuild from flat →" : step >= STEP_ORDER.length ? "All cues on" : `Add ${CUE_COPY[STEP_ORDER[step]].label.toLowerCase()} →`}
        </button>
        <button type="button" data-testid="all-cues" onClick={() => st.isolate("all")}>
          All
        </button>
      </div>
      <ol className="ed-steps" aria-label="Cue build order">
        {STEP_ORDER.map((id, i) => (
          <li key={id} data-on={isCueOn(cues, id) ? "1" : "0"} data-current={step !== null && step === i + 1 ? "1" : "0"}>
            <button type="button" onClick={() => st.setStep(i + 1)} title={`Rebuild up to ${CUE_COPY[id].label}`}>
              {STEP_SHORT[id]}
            </button>
          </li>
        ))}
      </ol>
      <p className="ed-note mono" data-testid="cue-count">
        {n} of 7 cues on{step !== null ? ` · step ${step}` : ""}
      </p>
    </div>
  );
}

export function Construction() {
  const construct = useED((s) => s.construct);
  const move = useED((s) => s.move);
  const moveSize = useED((s) => s.moveSize);
  const layerCount = useED((s) => s.layerCount);
  const clean = useED((s) => s.cleanPlates);
  const st = edStore.getState();
  return (
    <section className="ed-section" data-testid="construction">
      <span className="ed-eyebrow">SCENE CONSTRUCTION · {CONSTRUCT_COPY[construct].label}</span>
      <p className="ed-note">{CONSTRUCT_COPY[construct].line}</p>
      <span className="ed-eyebrow">THE MOVE</span>
      <Seg value={move} label="Camera move" testPrefix="move" options={MOVES.map((m) => ({ id: m, label: MOVE_COPY[m].label }))} onChange={(m) => st.setMove(m)} />
      <p className="ed-note">{MOVE_COPY[move].line}</p>
      <div className="ed-row">
        <span>Move size</span>
        <Slider value={moveSize} min={0.4} max={2} step={0.05} label="Move size" testId="move-size" fmt={(v) => `×${v.toFixed(2)}`} onChange={(v) => st.setMoveSize(v)} />
      </div>
      {construct === "25d" && (
        <div className="ed-group">
          <div className="ed-row">
            <span>Depth layers</span>
            <Slider value={layerCount} min={SLICE.minLayers} max={SLICE.maxLayers} step={1} label="Depth layers" testId="layer-count" fmt={(v) => String(v)} onChange={(v) => st.setLayerCount(v)} />
          </div>
          <div className="ed-row">
            <span>Paint behind layers (clean plates)</span>
            <Toggle on={clean} onChange={(v) => st.setCleanPlates(v)} testId="clean-plates" label="Paint behind layers" />
          </div>
          <p className="ed-note">{clean ? "Each layer re-rendered with what hides behind nearer ones: no holes, but card edges still show." : "Layers cut from one picture, like an AI depth split: nothing exists behind the foreground."} “Never painted” is roughly the revealed-behind-objects share; “off the card” is edge reveal past the 1.5× overscan.</p>
        </div>
      )}
      <LiveText
        className="ed-verdict-line"
        data-testid="reveal-end"
        get={() => {
          const e = live.revealEnd;
          if (!e) return "";
          const r = riskOf(e.total);
          return `End of move: ${Math.round(e.total * 100)}% revealed (${Math.round(e.disoccluded * 100)}% behind objects) · ${r === "safe" ? "safe for AI video" : r === "watch" ? "watch it" : "risky for AI video"}`;
        }}
      />
    </section>
  );
}

export function Cues() {
  const c = useED((s) => s.cues);
  const overlay = useED((s) => s.overlay);
  const st = edStore.getState();
  const set = st.setCues;
  return (
    <section className="ed-section" data-testid="cues">
      <span className="ed-eyebrow">DEPTH CUES</span>
      <TakeApart />
      <CueRow id="parallax">
        <Slider value={c.parallax} min={0} max={1} step={0.01} label="Parallax strength" testId="cue-parallax" fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ parallax: v })} />
      </CueRow>
      <CueRow id="haze">
        <Slider value={c.haze} min={0} max={1} step={0.01} label="Atmospheric depth" testId="cue-haze" fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ haze: v })} />
      </CueRow>
      <div className="ed-swatches" role="radiogroup" aria-label="Haze colour">
        {(Object.keys(HAZE_COLORS) as HazeColorId[]).map((id) => (
          <button key={id} type="button" role="radio" aria-checked={c.hazeColor === id} data-testid={`haze-${id}`} title={HAZE_COLORS[id].label} onClick={() => set({ hazeColor: id })}>
            <i style={{ background: HAZE_COLORS[id].hex }} />
            {HAZE_COLORS[id].short}
          </button>
        ))}
      </div>
      <CueRow id="layers">
        <Toggle on={c.layers} onChange={(v) => set({ layers: v })} testId="cue-layers" label="Foreground layer" />
      </CueRow>
      <CueRow id="scale">
        <Toggle on={c.scale} onChange={(v) => set({ scale: v, refs: v && !Object.values(c.refs).some(Boolean) ? { ...c.refs, pip: true } : c.refs })} testId="cue-scale" label="Scale cues" />
      </CueRow>
      {c.scale && (
        <div className="ed-group ed-scale">
          <div className="ed-refs">
            {REF_IDS.map((id) => (
              <button key={id} type="button" aria-pressed={c.refs[id]} data-testid={`ref-${id}`} onClick={() => set({ refs: { ...c.refs, [id]: !c.refs[id] } })}>
                {REFS[id].label}
              </button>
            ))}
          </div>
          <Seg value={c.story} label="How big are the trees?" testPrefix="story" options={(Object.keys(STORIES) as StoryId[]).map((id) => ({ id, label: STORIES[id].label }))} onChange={(v) => set({ story: v })} />
          <LiveText className="ed-note mono" data-testid="tree-reads" get={() => `Same 62 m tree. References ×${live.scale.k} → it reads as ${Math.round(live.scale.treeReadsM)} m.`} />
        </div>
      )}
      <CueRow id="occlusion">
        <Toggle on={c.occlusion} onChange={(v) => set({ occlusion: v })} testId="cue-occlusion" label="Occlusion" />
      </CueRow>
      <CueRow id="dof">
        <Toggle on={c.dof} onChange={(v) => set({ dof: v })} testId="cue-dof" label="Depth of field" />
      </CueRow>
      {c.dof && (
        <div className="ed-row ed-indent">
          <span>Aperture</span>
          <Slider value={c.fStop} min={1.2} max={11} step={0.1} label="Aperture" testId="fstop" fmt={(v) => `f/${v.toFixed(1)}`} onChange={(v) => set({ fStop: v })} />
        </div>
      )}
      <CueRow id="perspective">
        <Slider value={c.focalMm} min={CAMERA.minFocalMm} max={CAMERA.maxFocalMm} step={1} label="Focal length" testId="cue-perspective" fmt={(v) => `${Math.round(v)} mm`} onChange={(v) => set({ focalMm: v })} />
      </CueRow>
      <div className="ed-row ed-indent">
        <span>Show converging lines</span>
        <Toggle on={c.guides} onChange={(v) => set({ guides: v })} testId="guides" label="Converging lines" />
      </div>
      <span className="ed-eyebrow">OVERLAY</span>
      <Seg<Overlay>
        value={overlay}
        label="Overlay"
        testPrefix="overlay"
        options={[
          { id: "none", label: "None" },
          { id: "reveal", label: "Revealed" },
          { id: "bands", label: "FG / MG / BG" },
        ]}
        onChange={(o) => st.setOverlay(o)}
      />
    </section>
  );
}
