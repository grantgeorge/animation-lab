"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TREATMENTS, beatTimes, type Treatment } from "../engine/beat";
import { FPS, FRAMES, frameOf } from "../engine/timing";
import { PROMPT_NOTES, categoryPhrase, syncPhrase, treatmentPhrase, type CategoryId } from "../engine/prompt";
import { categoryReading, legibilityReading, syncReading, treatmentReading } from "../engine/reading";
import { AREA_MIN, GRID, SOLID_MIN, STABLE_MIN } from "../engine/legibility";
import { EXP_INFO, LESSON, NOTICE, RELATED, TREATMENT_INFO } from "../content";
import { capCount, runtime } from "../runtime/Orchestrator";
import { live, onAfterFrame, useMeasure } from "../runtime/live";
import { vxStore, useVX, type ExpId } from "../store";
import { LiveText, Slot } from "./Chrome";

/** A 16:9 view: the render window plus its HUD. */
export function ViewFrame({ slot, label, color, tr, selectable = false, selected = false, big = false, sub }: { slot: string; label: string; color: string; tr?: Treatment; selectable?: boolean; selected?: boolean; big?: boolean; sub?: React.ReactNode }) {
  const curve = useMeasure((s) => (tr ? s.curves[tr] : undefined));
  const L = curve?.legibility;
  return (
    <figure className={`vx-view${big ? " vx-view-big" : ""}${selected ? " vx-view-on" : ""}`} data-testid={`frame-${slot}`} style={{ "--c": color } as React.CSSProperties}>
      <Slot id={slot}>
        <div className="vx-hud">
          <div className="vx-hud-top">
            {selectable && tr ? (
              <button type="button" className="vx-chip vx-chip-label" data-testid={`select-${tr}`} onClick={() => vxStore.getState().setTreatment(tr)} aria-pressed={selected}>
                {label}
              </button>
            ) : (
              <span className="vx-chip vx-chip-label">{label}</span>
            )}
            <LiveText className="vx-chip vx-dim" data-testid={`phase-${slot}`} get={() => live.views[slot]?.phase ?? ""} />
          </div>
          <div className="vx-hud-bottom">
            {tr === "real" && <LiveText className="vx-chip vx-chip-bake" data-testid="bake-progress" get={() => (live.bake.done ? "" : `simulating ${Math.round(live.bake.progress * 100)}%`)} />}
            {L && (
              <span className="vx-chip vx-chip-legible" data-testid={`legible-${slot}`} data-run={L.longestRun} data-frames={L.legibleFrames}>
                reads {L.longestRun} f · {(L.longestRun / FPS).toFixed(2)} s
              </span>
            )}
            {sub}
          </div>
        </div>
      </Slot>
    </figure>
  );
}

/** Frame-by-frame legibility of each treatment, with the playhead. */
export function LegibilityStrip({ rows = TREATMENTS, compact = false }: { rows?: readonly Treatment[]; compact?: boolean }) {
  const curves = useMeasure((s) => s.curves);
  const head = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      onAfterFrame(() => {
        if (head.current) head.current.style.left = `${((live.frame + 0.5) / FRAMES) * 100}%`;
      }),
    [],
  );
  return (
    <section className={`vx-strip${compact ? " vx-strip-compact" : ""}`} data-testid="legibility-strip">
      <div className="vx-strip-head">
        <span className="vx-eyebrow">LEGIBLE FRAMES · MEASURED</span>
        <span className="vx-note">a frame is legible when the airborne splash is ≥ {AREA_MIN} cells, ≥ {Math.round(SOLID_MIN * 100)}% one shape, and ≥ {Math.round(STABLE_MIN * 100)}% the same as the frame before</span>
      </div>
      <div className="vx-strip-rows">
        <div className="vx-strip-track" aria-hidden>
          <div ref={head} className="vx-strip-head-line" />
        </div>
        {rows.map((tr) => {
          const c = curves[tr];
          const L = c?.legibility;
          return (
            <div key={tr} className="vx-strip-row" data-testid={`strip-${tr}`} data-run={L?.longestRun ?? ""}>
              <span className="vx-strip-label" style={{ color: TREATMENT_INFO[tr].color }}>
                {TREATMENT_INFO[tr].short}
              </span>
              <div className="vx-cells">
                {c && L ? (
                  L.frames.map((m, f) => <i key={f} data-k={m.legible ? "l" : m.area >= AREA_MIN ? "s" : m.area > 0 ? "a" : "0"} data-run={f >= L.runStart && f < L.runStart + L.longestRun ? "1" : undefined} data-impact={f === c.impactFrame ? "1" : undefined} />)
                ) : (
                  <span className="vx-cells-wait">simulating…</span>
                )}
              </div>
              <span className="vx-strip-num mono">{L ? `${(L.longestRun / FPS).toFixed(2)} s` : "…"}</span>
              <span className="vx-strip-num vx-dim mono">{L ? `${L.legibleFrames} f` : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="vx-strip-key">
        <span><i data-k="l" /> legible</span>
        <span><i data-k="s" /> splash on screen, not readable</span>
        <span><i data-k="a" /> a few specks</span>
        <span><i data-impact="1" /> impact</span>
        <span><i data-k="l" data-run="1" /> longest run</span>
      </div>
    </section>
  );
}

/** Keyed vs simulated curves: splash height per frame for each treatment. */
export function CurvesChart() {
  const curves = useMeasure((s) => s.curves);
  const phys = useVX((s) => s.phys);
  const timing = useVX((s) => s.timing);
  const W = 640;
  const H = 180;
  const maxY = 0.95;
  const x = (f: number) => 34 + (f / (FRAMES - 1)) * (W - 44);
  const y = (v: number) => H - 22 - (Math.min(v, maxY) / maxY) * (H - 34);
  const head = useRef<SVGLineElement>(null);
  useEffect(
    () =>
      onAfterFrame(() => {
        if (head.current) {
          const px = String(x(live.frame));
          head.current.setAttribute("x1", px);
          head.current.setAttribute("x2", px);
        }
      }),
    [],
  );
  return (
    <figure className="vx-card vx-curves" data-testid="curves-chart">
      <figcaption>
        <span className="vx-eyebrow">KEYED vs SIMULATED · SPLASH HEIGHT PER FRAME</span>
        <span className="vx-note">The sim&apos;s curve is whatever the solver did; the cartoon&apos;s is an authored ease with a plateau (the hold); the drawn one steps on twos.</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="vx-chart" role="img" aria-label="Splash height over time for each treatment">
        {[0, 0.25, 0.5, 0.75].map((v) => (
          <g key={v}>
            <line x1={34} x2={W - 10} y1={y(v)} y2={y(v)} className="vx-grid" />
            <text x={4} y={y(v) + 3} className="vx-axis">{v.toFixed(2)}m</text>
          </g>
        ))}
        {[0, 24, 48, 72, 95].map((f) => (
          <text key={f} x={x(f)} y={H - 6} className="vx-axis" textAnchor="middle">{(f / FPS).toFixed(0)}s</text>
        ))}
        {TREATMENTS.map((tr) => {
          const c = curves[tr];
          if (!c) return null;
          const b = beatTimes(tr, phys, timing[tr]);
          const hold0 = frameOf(b.peak);
          const hold1 = frameOf(b.holdEnd);
          const d = c.top.map((v, f) => `${f ? "L" : "M"}${x(f).toFixed(1)},${y(v).toFixed(1)}`).join("");
          return (
            <g key={tr} data-testid={`curve-${tr}`}>
              {hold1 > hold0 && <rect x={x(hold0)} width={Math.max(1, x(hold1) - x(hold0))} y={14} height={H - 36} fill={TREATMENT_INFO[tr].color} opacity={0.08} />}
              <path d={d} fill="none" stroke={TREATMENT_INFO[tr].color} strokeWidth={tr === "real" ? 1.4 : 2} strokeLinejoin="round" opacity={0.95} />
              <line x1={x(c.impactFrame)} x2={x(c.impactFrame)} y1={14} y2={H - 22} stroke={TREATMENT_INFO[tr].color} strokeDasharray="2 3" opacity={0.6} />
            </g>
          );
        })}
        <line ref={head} y1={10} y2={H - 22} className="vx-head" />
      </svg>
    </figure>
  );
}

/** The measured numbers per treatment. */
export function MeasureTable() {
  const curves = useMeasure((s) => s.curves);
  return (
    <table className="vx-table" data-testid="measure-table">
      <thead>
        <tr>
          <th />
          {TREATMENTS.map((t) => (
            <th key={t} style={{ color: TREATMENT_INFO[t].color }}>{TREATMENT_INFO[t].short}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[
          ["Longest legible run", (tr: Treatment) => (curves[tr] ? `${curves[tr]!.legibility.longestRun} f` : "…")],
          ["Legible frames", (tr: Treatment) => (curves[tr] ? `${curves[tr]!.legibility.legibleFrames}` : "…")],
          ["First readable after impact", (tr: Treatment) => {
            const c = curves[tr];
            if (!c) return "…";
            return c.legibility.firstAfterImpact < 0 ? "never" : `+${c.legibility.firstAfterImpact - c.impactFrame} f`;
          }],
          ["Pieces at the peak", (tr: Treatment) => (curves[tr] ? `${curves[tr]!.legibility.piecesAtPeak}` : "…")],
          ["Peak height", (tr: Treatment) => (curves[tr] ? `${Math.max(...curves[tr]!.top.slice(curves[tr]!.impactFrame)).toFixed(2)} m` : "…")],
        ].map(([label, f]) => (
          <tr key={label as string}>
            <th>{label as string}</th>
            {TREATMENTS.map((tr) => (
              <td key={tr} className="mono" data-testid={`m-${(label as string).split(" ")[0].toLowerCase()}-${tr}`}>{(f as (t: Treatment) => string)(tr)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Solver readouts (Inspect). */
export function SolverReadouts() {
  return (
    <table className="vx-table" data-testid="solver-readouts">
      <tbody>
        <tr>
          <th>Droplets</th>
          <td className="mono"><LiveText get={() => `${live.bake.n.toLocaleString("en-US")}`} /></td>
        </tr>
        <tr>
          <th>Drawn now (realistic)</th>
          <td className="mono"><LiveText data-testid="particles-now" get={() => `${live.views.A?.kind === "bucket:real" ? live.views.A.particles : live.views.P?.kind === "bucket:real" ? live.views.P.particles : "—"}`} /></td>
        </tr>
        <tr>
          <th>Solver</th>
          <td>double-density relaxation, 120 Hz</td>
        </tr>
        <tr>
          <th>Bake</th>
          <td className="mono"><LiveText get={() => (live.bake.done ? `${live.bake.ms.toFixed(0)} ms, cached` : `${Math.round(live.bake.progress * 100)}%`)} /></td>
        </tr>
        <tr>
          <th>First contact</th>
          <td className="mono"><LiveText get={() => (Number.isFinite(live.bake.firstContact) ? `${live.bake.firstContact.toFixed(3)} s` : "—")} /></td>
        </tr>
        <tr>
          <th>Legibility grid</th>
          <td className="mono">{GRID.cell * 100} cm cells</td>
        </tr>
        <tr>
          <th>Frame rate</th>
          <td className="mono"><LiveText get={() => `${live.fps.toFixed(0)} fps`} /></td>
        </tr>
      </tbody>
    </table>
  );
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (k: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(k);
      setTimeout(() => setCopied(null), 1200);
    });
  };
  return { copied, copy };
}

/** Deterministic Seedance phrases: one per treatment (bucket), the sync take, or the category. */
export function PromptBox({ compact = false }: { compact?: boolean }) {
  const exp = useVX((s) => s.exp);
  const phys = useVX((s) => s.phys);
  const timing = useVX((s) => s.timing);
  const tr = useVX((s) => s.treatment);
  const offset = useVX((s) => s.offset);
  const cats = useVX((s) => s.cats);
  const { copied, copy } = useCopy();
  const p = useMemo(() => ({ ...phys, count: capCount(phys.count, runtime.tier) }), [phys]);
  const items = useMemo((): { k: string; label: string; color: string; text: string }[] => {
    if (exp === "bucket") return TREATMENTS.map((t) => ({ k: t, label: TREATMENT_INFO[t].label, color: TREATMENT_INFO[t].color, text: treatmentPhrase(t, p, timing[t]) }));
    if (exp === "sync") return [{ k: "sync", label: `Cartoon, offset ${offset > 0 ? "+" : ""}${offset} f`, color: TREATMENT_INFO.cartoon.color, text: syncPhrase(p, timing.cartoon, offset) }];
    const c = cats[exp as CategoryId];
    return [{ k: exp, label: `${c.look === "real" ? "Realistic" : "Stylized"} · ${c.motion === "sim" ? "simulated" : "keyframed"}`, color: "#eac18a", text: categoryPhrase(exp as CategoryId, c.look, c.motion) }];
  }, [exp, p, timing, offset, cats]);
  const shown = compact && exp === "bucket" ? items.filter((i) => i.k === tr) : items;
  return (
    <section className="vx-prompt" data-testid="prompt">
      <div className="vx-section-head">
        <span className="vx-eyebrow">SEEDANCE PROMPT</span>
      </div>
      {shown.map((it) => (
        <div key={it.k} className={`vx-prompt-item${exp === "bucket" && it.k === tr ? " vx-prompt-on" : ""}`} style={{ "--c": it.color } as React.CSSProperties} data-testid={`prompt-${it.k}`}>
          <div className="vx-prompt-label">
            <span>{it.label}</span>
            <button type="button" data-testid={`copy-${it.k}`} onClick={() => copy(it.k, it.text)}>
              {copied === it.k ? "Copied" : "Copy"}
            </button>
          </div>
          <p data-testid={`prompt-phrase-${it.k}`}>{it.text}</p>
        </div>
      ))}
      {!compact && (
        <details className="vx-notes">
          <summary>Words that survive generation</summary>
          <ul>
            {PROMPT_NOTES.map((n) => (
              <li key={n.what}>
                <b>{n.what}</b>
                <span className="mono">“{n.words}”</span>
                <span>{n.note}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** The plain-language reading of the current settings. */
export function Reading() {
  const exp = useVX((s) => s.exp);
  const phys = useVX((s) => s.phys);
  const timing = useVX((s) => s.timing);
  const tr = useVX((s) => s.treatment);
  const offset = useVX((s) => s.offset);
  const cats = useVX((s) => s.cats);
  const curves = useMeasure((s) => s.curves);
  const p = { ...phys, count: capCount(phys.count, runtime.tier) };
  let head = "";
  let body = "";
  let measured = "";
  if (exp === "bucket") {
    head = TREATMENT_INFO[tr].label;
    body = treatmentReading(tr, p, timing[tr]);
    const c = curves[tr];
    if (c) measured = legibilityReading(tr, c.legibility.longestRun, c.legibility.legibleFrames, c.legibility.firstAfterImpact, c.impactFrame);
  } else if (exp === "sync") {
    const b = beatTimes("cartoon", p, timing.cartoon, offset);
    const lag = Math.round((b.recoil - b.impact) * FPS);
    const r = syncReading(lag);
    head = r.verdict === "tight" ? "In sync" : r.verdict === "early" ? "Too early" : r.verdict === "late" ? "Late" : "Disconnected";
    body = r.text;
    measured = `Measured: water lands on frame ${frameOf(b.impact)}, Pip flinches on frame ${frameOf(b.recoil)} (${lag >= 0 ? "+" : ""}${lag} f).`;
  } else {
    const c = cats[exp as CategoryId];
    head = `${c.look === "real" ? "Realistic" : "Stylized"} look · ${c.motion === "sim" ? "simulated" : "keyframed"} motion`;
    body = categoryReading(exp as CategoryId, c.look, c.motion, c.value);
  }
  return (
    <section className="vx-reading" data-testid="reading">
      <span className="vx-eyebrow">WHAT YOU ARE LOOKING AT</span>
      <h3 data-testid="reading-head">{head}</h3>
      <p data-testid="reading-body">{body}</p>
      {measured && <p className="vx-measured" data-testid="reading-measured">{measured}</p>}
    </section>
  );
}

export function Lesson({ exp }: { exp: ExpId }) {
  const info = EXP_INFO[exp];
  return (
    <section className="vx-lesson" data-testid="lesson">
      <span className="vx-eyebrow">{exp === "bucket" ? "THE SIGNATURE EXPERIMENT" : exp === "sync" ? "EFFECTS × ACTING" : "CATEGORY"}</span>
      <h3>{info.title}</h3>
      <p>{exp === "bucket" ? LESSON : info.lesson}</p>
      <p className="vx-try">{info.try}</p>
      {exp === "bucket" && (
        <ul>
          {NOTICE.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Related() {
  return (
    <section className="vx-related" data-testid="related">
      <span className="vx-eyebrow">RELATED LABS</span>
      <ul>
        {RELATED.map((r) => (
          <li key={r.href}>
            <Link href={r.href} data-testid={`related-${r.href.split("/").pop()}`}>
              {r.label} <span aria-hidden>↗</span>
            </Link>
            <span>{r.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The sync timeline: where the water lands and where each Pip flinches. */
export function SyncChart() {
  const phys = useVX((s) => s.phys);
  const timing = useVX((s) => s.timing.cartoon);
  const offset = useVX((s) => s.offset);
  const a = beatTimes("cartoon", phys, timing, 0);
  const b = beatTimes("cartoon", phys, timing, offset);
  const W = 640;
  const x = (t: number) => 20 + ((t - 0.6) / 1.6) * (W - 40);
  const head = useRef<SVGLineElement>(null);
  useEffect(
    () =>
      onAfterFrame(() => {
        if (head.current) {
          const px = String(Math.max(0, Math.min(W, x(live.t))));
          head.current.setAttribute("x1", px);
          head.current.setAttribute("x2", px);
        }
      }),
    [],
  );
  const lagB = Math.round((b.recoil - b.impact) * FPS);
  const ticks = [];
  for (let f = Math.ceil(0.6 * FPS); f <= 2.2 * FPS; f++) ticks.push(f);
  return (
    <figure className="vx-card vx-sync-chart" data-testid="sync-chart" data-lag={lagB}>
      <figcaption>
        <span className="vx-eyebrow">THE BEAT, FRAME BY FRAME</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} 96`} className="vx-chart" role="img" aria-label="Splash and flinch timing">
        {ticks.map((f) => (
          <line key={f} x1={x(f / FPS)} x2={x(f / FPS)} y1={f % 6 === 0 ? 74 : 78} y2={82} className="vx-grid" />
        ))}
        <rect x={x(a.impact)} width={x(a.holdEnd) - x(a.impact)} y={10} height={64} className="vx-splash-band" />
        <text x={x(a.impact) + 4} y={22} className="vx-label">splash: lands → crown holds</text>
        <line x1={x(a.impact)} x2={x(a.impact)} y1={6} y2={82} className="vx-impact" />
        <g className="vx-flinch vx-flinch-a">
          <circle cx={x(a.recoil)} cy={40} r={5} />
          <text x={x(a.recoil) + 8} y={44}>in sync +2 f</text>
        </g>
        <g className="vx-flinch vx-flinch-b">
          <circle cx={x(b.recoil)} cy={60} r={5} />
          <text x={x(b.recoil) + 8} y={64}>yours {lagB >= 0 ? "+" : ""}{lagB} f</text>
        </g>
        <text x={x(0.75)} y={93} className="vx-axis">kick</text>
        <line x1={x(a.kick)} x2={x(a.kick)} y1={70} y2={82} className="vx-impact" opacity={0.4} />
        <line ref={head} y1={4} y2={84} className="vx-head" />
      </svg>
    </figure>
  );
}

/** The fourth cell of the compare grid: how long each splash reads, measured. */
export function Scoreboard() {
  const curves = useMeasure((s) => s.curves);
  const max = Math.max(12, ...TREATMENTS.map((t) => curves[t]?.legibility.longestRun ?? 0));
  return (
    <figure className="vx-view vx-score" data-testid="scoreboard">
      <span className="vx-eyebrow">HOW LONG THE SPLASH READS AS A SHAPE</span>
      <ul>
        {TREATMENTS.map((t) => {
          const L = curves[t]?.legibility;
          return (
            <li key={t} style={{ "--c": TREATMENT_INFO[t].color } as React.CSSProperties} data-testid={`score-${t}`} data-run={L?.longestRun ?? ""}>
              <span className="vx-score-label">{TREATMENT_INFO[t].label}</span>
              <span className="vx-score-bar">
                <i style={{ width: `${((L?.longestRun ?? 0) / max) * 100}%` }} />
              </span>
              <b className="mono">{L ? `${(L.longestRun / FPS).toFixed(2)} s` : "…"}</b>
              <span className="vx-score-sub mono">{L ? `${L.longestRun} f in a row · ${L.legibleFrames} legible` : "simulating…"}</span>
            </li>
          );
        })}
      </ul>
      <p>Same kick, same water. The sim is correct and still reads for the shortest time, because its silhouette changes on every frame.</p>
    </figure>
  );
}
