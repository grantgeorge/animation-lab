"use client";

import { useCallback, useEffect, useRef } from "react";
import { METRIC_NOTE, VERSIONS, versionOf } from "../content";
import { TEMPORAL_NOTE } from "../engine/prompt";
import type { TestVersion } from "../engine/seeds";
import { live, registerSlot } from "../live";
import { ptStore, usePT } from "../store";
import { Slider } from "./Panels";
import { useLiveTick } from "./hooks";

const SCALE = 5; // % crawl that fills a bar

function Spark({ values, accent }: { values: number[]; accent: string }) {
  const W = 120, H = 22;
  if (values.length < 2) return <svg className="pt-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden />;
  const n = values.length;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (n - 1)) * W).toFixed(1)},${(H - 1 - Math.min(1, v / SCALE) * (H - 2)).toFixed(1)}`).join("");
  return (
    <svg className="pt-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <path d={d} stroke={accent} fill="none" strokeWidth={1.3} />
    </svg>
  );
}

const ACCENT: Record<TestVersion, string> = { surface: "#8ef0c3", screen: "#ffb547", random: "#ff6b6b", boil: "#b9a6ff" };

function Panel({ v }: { v: TestVersion }) {
  const info = versionOf(v);
  const selected = usePT((s) => s.test === v);
  const register = useCallback((el: HTMLDivElement | null) => registerSlot(`panel-${v}`, el), [v]);
  const c = live.crawl[v];
  const pct = Math.min(100, (c.value / SCALE) * 100);
  return (
    <figure className="pt-panel" data-selected={selected ? "1" : "0"} data-testid={`panel-${v}`} data-crawl={c.value.toFixed(3)} style={{ "--accent": ACCENT[v] } as React.CSSProperties}>
      <button type="button" className="pt-panel-head" onClick={() => ptStore.getState().setTest(v)} aria-pressed={selected}>
        <span className="pt-panel-n">{info.n}</span>
        <span>
          <b>{info.title}</b>
          <small>{info.tag}</small>
        </span>
      </button>
      <div ref={register} className="pt-panel-view" />
      <figcaption className="pt-panel-meter">
        <div className="pt-meter-row">
          <span>
            Crawl <em className="pt-peak">peak {c.history.length ? Math.max(...c.history).toFixed(1) : "0.0"}%</em>
          </span>
          <b className="mono" data-testid={`crawl-${v}`}>{c.value.toFixed(1)}%</b>
        </div>
        <div className="pt-meter-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <Spark values={c.history} accent={ACCENT[v]} />
        <span className="pt-verdict">{info.verdict}</span>
      </figcaption>
    </figure>
  );
}

/** Frame-to-frame change maps from the last measurement (Inspect). */
function DiffStrip() {
  useLiveTick(200);
  const refs = useRef<Partial<Record<TestVersion | "coords", HTMLCanvasElement | null>>>({});
  useEffect(() => {
    const { width: w, height: h, maps, coords } = live.diff;
    if (!w) return;
    for (const v of VERSIONS) {
      const el = refs.current[v.id];
      const m = maps[v.id];
      if (!el || !m) continue;
      el.width = w;
      el.height = h;
      const img = el.getContext("2d")!.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const k = m[(h - 1 - y) * w + x];
          const i = (y * w + x) * 4;
          img.data[i] = 20 + 235 * Math.min(1, k * 1.2);
          img.data[i + 1] = 18 + 200 * k * k;
          img.data[i + 2] = 26 + 60 * k;
          img.data[i + 3] = 255;
        }
      el.getContext("2d")!.putImageData(img, 0, 0);
    }
    const el = refs.current.coords;
    if (el && coords) {
      el.width = w;
      el.height = h;
      const img = el.getContext("2d")!.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const j = ((h - 1 - y) * w + x) * 4;
          const i = (y * w + x) * 4;
          const a = coords[j + 3] > 128;
          img.data[i] = a ? ((coords[j] * 37) & 255) : 10;
          img.data[i + 1] = a ? ((coords[j + 1] * 53) & 255) : 11;
          img.data[i + 2] = a ? ((coords[j + 2] * 71) & 255) : 14;
          img.data[i + 3] = 255;
        }
      el.getContext("2d")!.putImageData(img, 0, 0);
    }
  });
  return (
    <div className="pt-diffs" data-testid="diff-strip">
      <figure>
        <canvas ref={(el) => void (refs.current.coords = el)} />
        <figcaption>Surface coordinates</figcaption>
      </figure>
      {VERSIONS.map((v) => (
        <figure key={v.id}>
          <canvas ref={(el) => void (refs.current[v.id] = el)} />
          <figcaption>Δ {v.title}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function TestStage() {
  const mode = usePT((s) => s.mode);
  useLiveTick(200);
  return (
    <div className="pt-test" data-testid="test-stage">
      <div className="pt-panels">
        {VERSIONS.map((v) => (
          <Panel key={v.id} v={v.id} />
        ))}
      </div>
      {mode === "inspect" ? <DiffStrip /> : <CrawlChart />}
    </div>
  );
}

/** Measured crawl over the last measurements: flat (sticks), wandering (swims), noise (boils), a beat (boil). */
function CrawlChart() {
  const W = 600, H = 140, pad = 6;
  const all = VERSIONS.flatMap((v) => live.crawl[v.id].history);
  const top = Math.max(SCALE, ...all) * 1.08;
  const n = Math.max(2, ...VERSIONS.map((v) => live.crawl[v.id].history.length));
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${(pad + (i / (n - 1)) * (W - 2 * pad)).toFixed(1)},${(H - pad - (v / top) * (H - 2 * pad)).toFixed(1)}`).join("");
  return (
    <section className="pt-chart" data-testid="crawl-chart" aria-label="Crawl over time">
      <div className="pt-chart-head">
        <span className="pt-eyebrow">MEASURED CRAWL · FRAME TO FRAME</span>
        <p>One point per 24 fps film frame. Same head turn, same strokes; only where the strokes live changes.</p>
      </div>
      <div className="pt-chart-plot">
      <span className="pt-chart-y mono" aria-hidden>
        <i>{top.toFixed(0)}%</i>
        <i>0%</i>
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Crawl per version over time">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#ffffff10" />
        ))}
        {VERSIONS.map((v) => (
          <path key={v.id} d={path(live.crawl[v.id].history)} stroke={ACCENT[v.id]} strokeWidth={v.id === "surface" ? 2.2 : 1.5} fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ))}
      </svg>
      </div>
      <p className="pt-test-verdict-inline" data-testid="test-verdict">
        {VERSIONS.map((v) => (
          <b key={v.id} style={{ color: ACCENT[v.id] }}>
            {v.title} {live.crawl[v.id].value.toFixed(1)}%
          </b>
        ))}
      </p>
    </section>
  );
}

export function TestPanel() {
  const mode = usePT((s) => s.mode);
  const test = usePT((s) => s.test);
  const motion = usePT((s) => s.testMotion);
  const hold = usePT((s) => s.boilHold);
  const size = usePT((s) => s.params.strokeSize);
  const st = ptStore.getState();
  const v = versionOf(test);
  return (
    <div className="pt-side-scroll">
      <section className="pt-card" data-testid="test-card" data-test={test}>
        <span className="pt-eyebrow">
          {v.n} · {v.tag}
        </span>
        <h2>{v.title}</h2>
        <p>{v.line}</p>
        {test === "boil" && <p className="pt-note">Accidental crawl is shapeless and never repeats. Intentional boil is small, cyclic and on a beat: the sparkline pulses every {hold === 1 ? "frame" : `${hold} frames`} and repeats every {3 * hold}.</p>}
      </section>
      {mode === "experiment" && (
        <section className="pt-card">
          <span className="pt-eyebrow">THE TEST</span>
          <div className="pt-scope" role="radiogroup" aria-label="Motion">
            <button type="button" role="radio" aria-checked={motion === "head"} data-testid="motion-head" onClick={() => st.setTestMotion("head")}>
              <i />Head turn
            </button>
            <button type="button" role="radio" aria-checked={motion === "orbit"} data-testid="motion-orbit" onClick={() => st.setTestMotion("orbit")}>
              <i />Camera orbit
            </button>
          </div>
          <Slider id="boil-hold" label="Boil timing" value={hold} min={1} max={3} step={1} format={(n) => (n === 1 ? "ones" : n === 2 ? "twos" : "threes")} onChange={(n) => st.setBoilHold(n)} />
          <Slider id="test-stroke-size" label="Stroke size" value={size} min={0.5} max={2} step={0.05} format={(n) => `${n.toFixed(2)}×`} onChange={(n) => st.setParams({ strokeSize: n })} />
          <div className="pt-stepper">
            <button type="button" onClick={() => st.step(-1)} data-testid="frame-back">◂ frame</button>
            <button type="button" onClick={() => st.togglePlay()}>play / pause</button>
            <button type="button" onClick={() => st.step(1)} data-testid="frame-forward">frame ▸</button>
          </div>
        </section>
      )}
      {mode === "inspect" ? (
        <section className="pt-card">
          <span className="pt-eyebrow">HOW CRAWL IS MEASURED</span>
          <ol className="pt-steps-text">
            {METRIC_NOTE.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ol>
          <p className="pt-note">Below the panels: the coordinate pass, and each version&apos;s frame-to-frame change. Surface paint changes only at the silhouette; screen paint changes wherever the face moves; random paint changes everywhere.</p>
        </section>
      ) : (
        <section className="pt-card">
          <span className="pt-eyebrow">FOR AI VIDEO</span>
          <ul className="pt-steps-text">
            {TEMPORAL_NOTE.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
