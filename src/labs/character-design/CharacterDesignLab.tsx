'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AGE_LABEL, PRESETS, RANGES, SHAPES, SYSTEMS, castDesign, headsTall, preset, readDesign, type Design, type PoseId, type PresetId } from './design';
import { DesignStage } from './DesignStage';
import { EXERCISES, type Exercise } from './exercises';
import { APPEAL, POSES, SHAPE_NOTES, TESTS, briefText } from './content';
import { ShapePad } from './ShapePad';
import type { SilhouetteReading } from './silhouette';
import './design.css';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const CAST = { pip: headsTall(castDesign('pip')), bram: headsTall(castDesign('bram')) };
const SCALE = [2, 9] as const;
const onScale = (h: number) => `${((Math.min(SCALE[1], Math.max(SCALE[0], h)) - SCALE[0]) / (SCALE[1] - SCALE[0])) * 100}%`;

export default function CharacterDesignLab() {
  const [design, setDesign] = useState<Design>(() => ({ ...preset('pip').design }));
  const [presetId, setPresetId] = useState<PresetId | 'custom'>('pip');
  const [turntable, setTurntable] = useState(false);
  const [sil, setSil] = useState<SilhouetteReading | null>(null);
  const [ex, setEx] = useState({ index: 0, started: false, solved: [] as string[] });
  const [copied, setCopied] = useState(false);

  const r = readDesign(design);
  const exercise = EXERCISES[ex.index];
  const checks = exercise.checks(r, sil, design);
  const done = ex.started && checks.every(c => c.ok);
  // Derived during render: record a solve the first time every check passes.
  if (done && !ex.solved.includes(exercise.id)) setEx(e => ({ ...e, solved: [...e.solved, exercise.id] }));

  const apply = (id: PresetId) => { setPresetId(id); setDesign(d => ({ ...preset(id).design, pose: d.pose })); };
  const tweak = (patch: Partial<Design>) => { setPresetId('custom'); setDesign(d => ({ ...d, ...patch })); };
  const start = (i: number) => {
    const s = EXERCISES[i].setup;
    setPresetId(s.preset); setDesign({ ...preset(s.preset).design, ...s.patch }); setEx(e => ({ ...e, index: i, started: true }));
  };
  const brief = briefText(design, r);
  const system = SYSTEMS.find(s => s.id === r.system)!;
  const shapeLabel = r.shape === 'mixed' ? 'Mixed' : SHAPES.find(s => s.id === r.shape)!.label;

  return <main className="cd-lab" data-testid="character-design-lab">
    <div className="cd-shell">
      <header className="cd-header"><Link href="/" className="cd-back">← Animation Lab</Link><span className="cd-eyebrow">CHARACTER ANIMATION</span></header>
      <div className="cd-heading">
        <h1>Character Design &amp; Proportions</h1>
        <p>A design is a set of ratios: head to body, eye to head, limb to torso, plus the shapes that carry them. Change one and the character’s age, personality and readability change with it. Every test here is one animators use on real productions.</p>
      </div>

      <div className="cd-layout">
        <section className="cd-main" aria-label="Model sheet">
          <div className="cd-stage-wrap">
            <DesignStage design={design} turntable={turntable} onSilhouette={setSil} reading={sil} />
          </div>
          <div className="cd-readout" aria-live="polite">
            <Cell id="heads" label="Proportion" value={`${r.heads.toFixed(1)} heads tall`} note={`${system.label}: ${system.eg}`} />
            <Cell id="age" label="Reads as" value={AGE_LABEL[r.age]} note={`Baby-schema cues: head ${pct(r.head)}, eyes ${pct(r.eyes)}, eye line ${pct(r.low)}`} />
            <Cell id="eyes" label="Eyes" value={`${r.eyeGap.toFixed(1)} eye-widths apart`} note={`${pct(r.eyeSize)} of the head, ${pct(r.eyeLine)} up from the chin`} />
            <Cell id="shape" label="Shape language" value={shapeLabel} note={r.shape === 'mixed' ? 'No single shape leads, so no single message' : SHAPES.find(s => s.id === r.shape)!.reads} />
            <Cell id="negative" label="Negative space" ok={!sil || sil.negative >= 0.25} value={sil ? pct(sil.negative) : '…'} note="Background inside the outline’s hull. Higher = limbs read" />
            <Cell id="distinct" label="Unlike Pip" ok={!sil || presetId === 'pip' || sil.distinct >= 0.2} value={sil ? pct(sil.distinct) : '…'} note="How much of the outline differs from Pip’s, same pose" />
          </div>
          <p className="cd-rule">Readings are rules of thumb from the design literature, not measurements of appeal. Silhouette numbers are measured on the front view.</p>
          <ExerciseCard exercise={exercise} index={ex.index} started={ex.started} checks={checks} done={done} solved={ex.solved} onStart={start} />
        </section>

        <aside className="cd-controls" aria-label="Design controls">
          <p className="cd-eyebrow">START FROM</p>
          <div className="cd-presets" role="group" aria-label="Presets">
            {PRESETS.map(p => <button key={p.id} type="button" aria-pressed={presetId === p.id} onClick={() => apply(p.id)} data-testid={`preset-${p.id}`}><b>{p.label}</b><small>{headsTall(p.design).toFixed(1)} heads · {p.note}</small></button>)}
          </div>

          <div className="cd-group">
            <p className="cd-label">Proportions</p>
            <Dial label="Head size" value={design.head} range={RANGES.head} step={0.001} text={`${r.heads.toFixed(1)} heads tall`} onChange={v => tweak({ head: v })} />
            <Dial label="Limb length" value={design.limbs} range={RANGES.limbs} text={`legs ${pct(design.limbs)} of the body`} onChange={v => tweak({ limbs: v })} />
            <Dial label="Limb thickness" value={design.thickness} range={RANGES.thickness} text={`${design.thickness.toFixed(2)}×`} onChange={v => tweak({ thickness: v })} />
            <Dial label="Hands & feet" value={design.extremities} range={RANGES.extremities} text={`${design.extremities.toFixed(2)}×`} onChange={v => tweak({ extremities: v })} />
          </div>
          <div className="cd-group">
            <p className="cd-label">Eyes</p>
            <Dial label="Eye size" value={design.eyeSize} range={RANGES.eyeSize} step={0.005} text={`${pct(design.eyeSize)} of the head`} onChange={v => tweak({ eyeSize: v })} />
            <Dial label="Eye spacing" value={design.eyeGap} range={RANGES.eyeGap} text={`${design.eyeGap.toFixed(1)} eye-widths apart`} onChange={v => tweak({ eyeGap: v })} />
            <Dial label="Eye line" value={design.eyeLine} range={RANGES.eyeLine} step={0.005} text={design.eyeLine < 0.47 ? `low · ${pct(design.eyeLine)} up` : design.eyeLine > 0.53 ? `high · ${pct(design.eyeLine)} up` : 'on the half line'} onChange={v => tweak({ eyeLine: v })} />
          </div>
          <div className="cd-group">
            <p className="cd-label">Shape language <span>drag, or use the arrow keys</span></p>
            <ShapePad value={design.shape} onChange={shape => tweak({ shape })} />
          </div>
          <div className="cd-group">
            <p className="cd-label">Pose <span>{POSES.find(p => p.id === design.pose)!.note}</span></p>
            <div className="cd-seg" role="group" aria-label="Pose">{POSES.map(p => <button key={p.id} type="button" aria-pressed={design.pose === p.id} onClick={() => setDesign(d => ({ ...d, pose: p.id as PoseId }))}>{p.label}</button>)}</div>
            <label className="cd-check"><input type="checkbox" checked={turntable} onChange={e => setTurntable(e.target.checked)} />Turntable <span>spin the shaded view</span></label>
          </div>
        </aside>
      </div>

      <section className="cd-section" aria-labelledby="cd-systems">
        <div className="cd-section-head"><h2 id="cd-systems">Proportion systems, in heads</h2><p>Artists measure a figure in head-heights. The count sets the genre before anything else is drawn.</p></div>
        <div className="cd-scale" data-testid="scale">
          <div className="cd-bands">{SYSTEMS.map(s => <div key={s.id} data-active={s.id === r.system} style={{ left: onScale(s.from), width: `calc(${onScale(s.to)} - ${onScale(s.from)})` }}><b>{s.label}</b><small>{s.from}–{s.to} · {s.eg}</small></div>)}</div>
          <div className="cd-ticks">{Array.from({ length: SCALE[1] - SCALE[0] + 1 }, (_, i) => <span key={i} style={{ left: onScale(SCALE[0] + i) }}>{SCALE[0] + i}</span>)}</div>
          <i className="cd-mark cd-mark-cast" style={{ left: onScale(CAST.pip) }} title="Pip"><span>Pip {CAST.pip.toFixed(1)}</span></i>
          <i className="cd-mark cd-mark-cast" style={{ left: onScale(CAST.bram) }} title="Bram"><span>Bram {CAST.bram.toFixed(1)}</span></i>
          <i className="cd-mark cd-mark-you" style={{ left: onScale(r.heads) }}><span>Yours {r.heads.toFixed(1)}</span></i>
        </div>
      </section>

      <section className="cd-section" aria-labelledby="cd-appeal">
        <div className="cd-section-head"><h2 id="cd-appeal">Appeal isn’t cute</h2><p>A villain needs appeal as much as a hero does: it means we want to keep watching.</p></div>
        <div className="cd-cards">{APPEAL.map(a => <article key={a.title} className="cd-card"><h3>{a.title}</h3><p>{a.body}</p></article>)}</div>
      </section>

      <section className="cd-section" aria-labelledby="cd-shapes">
        <div className="cd-section-head"><h2 id="cd-shapes">Shape language</h2><p>Audiences read simple shapes before faces. Pick the shape first, then design inside it.</p></div>
        <div className="cd-cards cd-cards-3">{SHAPES.map((s, i) => <article key={s.id} className="cd-card">
          <h3><i data-shape={s.id} aria-hidden />{s.label}<span>{s.reads}</span></h3>
          <p>{SHAPE_NOTES[s.id].use}</p>
          <p className="cd-eg">e.g. {SHAPE_NOTES[s.id].eg}</p>
          <button type="button" onClick={() => tweak({ shape: [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0] })} data-testid={`try-${s.id}`}>Try pure {s.label.toLowerCase()} →</button>
        </article>)}</div>
      </section>

      <section className="cd-section" aria-labelledby="cd-tests">
        <div className="cd-section-head"><h2 id="cd-tests">Four readability tests, all on the stage above</h2></div>
        <ol className="cd-tests">{TESTS.map((t, i) => <li key={t.title}><span className="cd-eyebrow">{String(i + 1).padStart(2, '0')}</span><b>{t.title}</b><p>{t.body}</p></li>)}</ol>
      </section>

      <section className="cd-section cd-brief" aria-labelledby="cd-brief">
        <div className="cd-section-head"><h2 id="cd-brief">The design, as a brief</h2><p>Proportions in words, for a model sheet or a prompt.</p></div>
        <div className="cd-output">
          <p data-testid="brief">{brief}</p>
          <div>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(brief); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy brief ↗'}</button>
            <p>Image and video models drift off model between shots. Restate the proportions in every prompt and check each result against the lineup.</p>
          </div>
        </div>
      </section>

      <footer className="cd-footer">
        <p>Related: <Link href="/labs/character-rigging">Character Rigging</Link> · <Link href="/labs/animation-style">Animation Style</Link> · <Link href="/labs/character-acting">Character Acting</Link></p>
        <p>Every design is built to the same height · Pip and Bram measured from the cast</p>
      </footer>
    </div>
  </main>;
}

function Cell({ id, label, value, note, ok = true }: { id: string; label: string; value: string; note: string; ok?: boolean }) {
  return <div className="cd-cell" data-ok={ok} data-testid={`read-${id}`}><span className="cd-cell-label">{label}</span><b>{value}</b><small>{note}</small></div>;
}

function Dial({ label, value, range, step = 0.01, text, onChange }: { label: string; value: number; range: readonly [number, number]; step?: number; text: string; onChange: (v: number) => void }) {
  return <label className="cd-dial">
    <span className="cd-dial-label">{label}<output className="cd-mono">{text}</output></span>
    <input type="range" aria-label={label} aria-valuetext={text} min={range[0]} max={range[1]} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
  </label>;
}

function ExerciseCard({ exercise, index, started, checks, done, solved, onStart }: { exercise: Exercise; index: number; started: boolean; checks: { label: string; ok: boolean }[]; done: boolean; solved: string[]; onStart: (i: number) => void }) {
  return <section className={`cd-exercise ${done ? 'done' : ''}`} aria-labelledby="cd-exercise-title" data-testid="exercise">
    <div className="cd-ex-tabs" role="group" aria-label="Exercises">
      <span className="cd-eyebrow">TRY IT</span>
      {EXERCISES.map((e, i) => <button key={e.id} type="button" aria-pressed={started && i === index} aria-label={`Exercise ${i + 1}: ${e.title}${solved.includes(e.id) ? ' (solved)' : ''}`} className={solved.includes(e.id) ? 'solved' : ''} onClick={() => onStart(i)}>{solved.includes(e.id) ? '✓' : i + 1}</button>)}
    </div>
    <h2 id="cd-exercise-title">{exercise.title}</h2>
    <p className="cd-ex-goal">{exercise.goal}</p>
    {started ? <ul className="cd-checks" aria-live="polite">
      {checks.map(c => <li key={c.label} data-ok={c.ok}><span aria-hidden>{c.ok ? '✓' : '○'}</span>{c.label}<span className="sr-only">{c.ok ? ' (done)' : ' (not yet)'}</span></li>)}
    </ul> : <button type="button" className="cd-ex-start" onClick={() => onStart(index)}>Set up exercise {index + 1}</button>}
    {done && <div className="cd-insight" role="status"><p className="cd-eyebrow">SOLVED · WHY IT WORKS</p><p>{exercise.insight}</p><button type="button" onClick={() => onStart((index + 1) % EXERCISES.length)}>{index === EXERCISES.length - 1 ? 'Back to exercise 1' : 'Next exercise →'}</button></div>}
  </section>;
}
