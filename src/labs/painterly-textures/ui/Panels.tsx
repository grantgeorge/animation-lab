"use client";

import { useCallback } from "react";
import { KEY_IDEA, TECHNIQUES, techniqueOf } from "../content";
import { painterly } from "../config";
import { artStylePrompt, finishingPrompt, TEMPORAL_NOTE } from "../engine/prompt";
import { DEFAULT_RAMP, rampCurve, bandEdges } from "../engine/ramp";
import { DEFAULT_PARAMS, LAYER_IDS, type LayerId } from "../engine/types";
import { live, registerSlot } from "../live";
import { CARDS } from "../stage/Overlays";
import { ptStore, usePT } from "../store";
import { useCopy, useLiveTick } from "./hooks";

export function Slider({ id, label, value, min, max, step, format, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="pt-slider" data-testid={`slider-${id}`}>
      <span className="pt-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ "--pct": `${pct}%` } as React.CSSProperties} aria-label={label} />
      <span className="pt-slider-value mono">{format(value)}</span>
    </label>
  );
}

/** Two outputs, because they are two controls: generation-time style vs post finishing. */
export function PromptPanel() {
  const layers = usePT((s) => s.layers);
  const params = usePT((s) => s.params);
  const paintChar = usePT((s) => s.paintChar);
  const paintEnv = usePT((s) => s.paintEnv);
  const art = artStylePrompt(layers, params, { character: paintChar, environment: paintEnv });
  const fin = finishingPrompt(layers, params);
  const { copied, copy } = useCopy();
  return (
    <section className="pt-prompts" data-testid="prompt-panel" aria-label="AI direction">
      <div className="pt-prompt">
        <div className="pt-prompt-head">
          <span className="pt-eyebrow">ART STYLE · GENERATION</span>
          <button type="button" onClick={() => copy("art", art)} data-testid="copy-art">
            {copied === "art" ? "Copied" : "Copy"}
          </button>
        </div>
        <p data-testid="prompt-art">{art}</p>
      </div>
      <div className="pt-prompt pt-prompt-post">
        <div className="pt-prompt-head">
          <span className="pt-eyebrow">FINISHING · POST</span>
          <button type="button" onClick={() => copy("fin", fin)} data-testid="copy-finishing">
            {copied === "fin" ? "Copied" : "Copy"}
          </button>
        </div>
        <p data-testid="prompt-finishing">{fin}</p>
      </div>
      <details className="pt-temporal" data-testid="temporal-note">
        <summary>Temporal consistency for AI video</summary>
        <ul>
          {TEMPORAL_NOTE.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** Watch: the key idea and where each technique lives. */
export function WatchPanel() {
  const layers = usePT((s) => s.layers);
  return (
    <div className="pt-side-scroll">
      <section className="pt-card">
        <span className="pt-eyebrow">THE KEY DISTINCTION</span>
        <h2>{KEY_IDEA.title}</h2>
        <p>{KEY_IDEA.body}</p>
        <button type="button" className="pt-link" data-testid="go-test" onClick={() => ptStore.getState().setSection("test")}>
          See it crawl: the consistency test →
        </button>
      </section>
      <section className="pt-card">
        <span className="pt-eyebrow">FIVE TECHNIQUES · WHERE THEY LIVE</span>
        <ol className="pt-techlist">
          {TECHNIQUES.map((t) => (
            <li key={t.id} data-on={layers[t.id] ? "1" : "0"}>
              <span className="pt-techlist-n">{t.n}</span>
              <span className="pt-techlist-name">{t.title}</span>
              <span className={`pt-space pt-space-${t.space}`}>{t.space}</span>
            </li>
          ))}
        </ol>
        <p className="pt-note">{KEY_IDEA.grading}</p>
      </section>
      <PromptPanel />
    </div>
  );
}

const fmtDeg = (v: number) => `${Math.round(v)}°`;

/** Experiment: who gets painted, the paint parameters, and the projection swing. */
export function ExperimentPanel() {
  const params = usePT((s) => s.params);
  const paintChar = usePT((s) => s.paintChar);
  const paintEnv = usePT((s) => s.paintEnv);
  const projYaw = usePT((s) => s.projYaw);
  const st = ptStore.getState();
  useLiveTick(250);
  return (
    <div className="pt-side-scroll">
      <section className="pt-card">
        <span className="pt-eyebrow">PAINT</span>
        <div className="pt-scope" role="group" aria-label="What is painted">
          <button type="button" role="switch" aria-checked={paintChar} data-testid="paint-char" onClick={() => st.setPaint("char", !paintChar)}>
            <i />Character
          </button>
          <button type="button" role="switch" aria-checked={paintEnv} data-testid="paint-env" onClick={() => st.setPaint("env", !paintEnv)}>
            <i />Environment
          </button>
        </div>
        <Slider id="stroke-size" label="Stroke size" value={params.strokeSize} min={0.5} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => st.setParams({ strokeSize: v })} />
        <Slider id="stroke-angle" label="Stroke direction" value={params.strokeAngle} min={-90} max={90} step={1} format={fmtDeg} onChange={(v) => st.setParams({ strokeAngle: v })} />
        <Slider id="bands" label="Value bands" value={params.bands} min={2} max={4} step={1} format={(v) => `${v}`} onChange={(v) => st.setParams({ bands: v })} />
        <Slider id="shadow-hue" label="Shadow hue" value={params.shadowHue} min={0} max={359} step={1} format={fmtDeg} onChange={(v) => st.setParams({ shadowHue: v })} />
        <Slider id="paper" label="Paper" value={params.paper} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => st.setParams({ paper: v })} />
        <button type="button" className="pt-link" onClick={() => st.setParams({ ...DEFAULT_PARAMS })}>
          Reset paint
        </button>
      </section>
      <section className="pt-card">
        <span className="pt-eyebrow">PROJECTION · MOVE THE CAMERA</span>
        <Slider id="proj-yaw" label="Off projector" value={projYaw} min={-painterly.projYawMaxDeg} max={painterly.projYawMaxDeg} step={1} format={fmtDeg} onChange={(v) => st.setProjYaw(v)} />
        <StretchMeter />
      </section>
      <PromptPanel />
    </div>
  );
}

function StretchMeter() {
  useLiveTick(250);
  const s = live.stretch;
  const pct = Math.min(100, ((s - 1) / 1.5) * 100);
  return (
    <div className="pt-meter" data-testid="stretch-meter" data-stretch={s.toFixed(3)}>
      <div className="pt-meter-row">
        <span>Texel stretch</span>
        <b className="mono">{s.toFixed(2)}×</b>
      </div>
      <div className="pt-meter-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="pt-note">1.00× is the projector&apos;s own view. Projection holds for small moves (a few degrees); past about 1.3× the painting visibly smears on the floor and side walls.</p>
    </div>
  );
}

/* ---------------- Inspect breakdowns ---------------- */

/** The painted texture, flattened: rendered live by the same shader as the shot (see Orchestrator). */
function Swatch() {
  const register = useCallback((el: HTMLDivElement | null) => registerSlot("swatch", el), []);
  return (
    <div className="pt-swatch" data-testid="texture-swatch">
      <div ref={register} className="pt-swatch-view" />
      <div className="pt-swatch-labels">
        <span>Bram&apos;s coat · 30 cm</span>
        <span>Plaster wall · 1.2 m</span>
      </div>
    </div>
  );
}

function RampPlot() {
  const bands = usePT((s) => s.params.bands);
  const hue = usePT((s) => s.params.shadowHue);
  const p = { ...DEFAULT_RAMP, bands };
  const pts = rampCurve(p, 161);
  const W = 280, H = 150, pad = 18;
  const X = (x: number) => pad + x * (W - pad * 2);
  const Y = (y: number) => H - pad - y * (H - pad * 2);
  const smooth = pts.map((q, i) => `${i ? "L" : "M"}${X(q.x).toFixed(1)},${Y(q.smooth).toFixed(1)}`).join("");
  const banded = pts.map((q, i) => `${i ? "L" : "M"}${X(q.x).toFixed(1)},${Y(q.banded).toFixed(1)}`).join("");
  const edges = bandEdges(p);
  const breakW = painterly.paint.char.break * 0.8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pt-ramp" data-testid="ramp-plot" data-bands={bands} role="img" aria-label={`Light ramp with ${bands} painted bands`}>
      <defs>
        <linearGradient id="pt-ramp-grad" x1="0" x2="1">
          <stop offset="0" stopColor={`hsl(${hue} 45% 32%)`} />
          <stop offset="1" stopColor="#ffd9ae" />
        </linearGradient>
      </defs>
      <rect x={pad} y={H - pad + 4} width={W - pad * 2} height={5} rx={2} fill="url(#pt-ramp-grad)" />
      {edges.map((e) => (
        <rect key={e} x={X(e - breakW)} y={pad} width={X(e + breakW) - X(e - breakW)} height={H - pad * 2} fill="#f3c98b" opacity={0.1} />
      ))}
      <path d={smooth} stroke="#7c8796" strokeDasharray="3 3" fill="none" strokeWidth={1.2} />
      <text x={X(0.72)} y={Y(0.16 + 0.7 * 0.72) + 13} textAnchor="start" className="pt-svg-label">smooth CG</text>
      <path d={banded} stroke="#f3c98b" fill="none" strokeWidth={2} />
      <text x={pad} y={12} className="pt-svg-label">value out</text>
      <text x={X(edges[0])} y={pad + 9} textAnchor="middle" className="pt-svg-label">stroke-cut edge</text>
      <text x={W - pad} y={H - 1} textAnchor="end" className="pt-svg-label">light in →</text>
    </svg>
  );
}

function MatteImage() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={painterly.matte.url} alt="The matte painting, painted over a render from the shot camera" className="pt-matte" data-testid="matte-image" />
  );
}

function Stack() {
  const layers = usePT((s) => s.layers);
  const rows: { id: LayerId | "render"; label: string; space: string }[] = [
    { id: "composite", label: "Paper, edges, halation, grade", space: "screen" },
    { id: "overlays", label: "2D cards: shaft, smoke, glints, scratches", space: "world" },
    { id: "projection", label: "Projected matte painting (set)", space: "world" },
    { id: "shading", label: "Banded painterly shading", space: "surface" },
    { id: "texture", label: "Hand-painted textures", space: "surface" },
    { id: "render", label: "3D render: geometry, lights, animation", space: "world" },
  ];
  return (
    <ol className="pt-stack" data-testid="stack-diagram" aria-label="Compositing order, top to bottom">
      {rows.map((r, i) => {
        const on = r.id === "render" || layers[r.id as LayerId];
        return (
          <li key={r.id} data-on={on ? "1" : "0"} style={{ "--i": i } as React.CSSProperties}>
            <span className="pt-stack-n">{r.id === "render" ? "·" : LAYER_IDS.indexOf(r.id as LayerId) + 1}</span>
            <span className="pt-stack-label">{r.label}</span>
            <span className={`pt-space pt-space-${r.space}`}>{r.space}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function InspectPanel() {
  const focus = usePT((s) => s.focus);
  const projYaw = usePT((s) => s.projYaw);
  const t = techniqueOf(focus);
  const st = ptStore.getState();
  return (
    <div className="pt-side-scroll">
      <div role="tablist" aria-label="Breakdown" className="pt-tabs" data-testid="inspect-tabs">
        {TECHNIQUES.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={focus === x.id} data-testid={`inspect-${x.id}`} onClick={() => st.setFocus(x.id)}>
            <span>{x.n}</span>
            {x.short}
          </button>
        ))}
      </div>
      {focus === "texture" && <Swatch />}
      <section className="pt-card" data-testid="inspect-card" data-layer={focus}>
        <span className="pt-eyebrow">
          {t.n} · {t.space === "screen" ? "SCREEN SPACE" : t.space === "surface" ? "SURFACE SPACE" : "WORLD SPACE"}
        </span>
        <h2>{t.title}</h2>
        {focus === "shading" && <RampPlot />}
        {focus === "projection" && (
          <>
            <MatteImage />
            <Slider id="proj-yaw" label="Off projector" value={projYaw} min={-painterly.projYawMaxDeg} max={painterly.projYawMaxDeg} step={1} format={fmtDeg} onChange={(v) => st.setProjYaw(v)} />
            <StretchMeter />
          </>
        )}
        {focus === "overlays" && (
          <ul className="pt-cards" data-testid="overlay-list">
            {CARDS.map((c) => (
              <li key={c.id}>
                <i className={`pt-card-swatch pt-card-${c.kind}`} />
                {c.label}
                <span className="mono">{c.additive ? "add" : "over"}</span>
              </li>
            ))}
          </ul>
        )}
        {focus === "composite" && <Stack />}
        <p>{t.inspect}</p>
      </section>
    </div>
  );
}
