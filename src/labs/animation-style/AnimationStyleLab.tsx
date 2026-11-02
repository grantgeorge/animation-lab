'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ATLAS, DIMENSIONS, PRINCIPLES, SPECS, VOCABULARY, directionText, type Picks } from './content';
import { DURATION } from './performance';
import { StyleStage, type StageStyle } from './StyleStage';
import { FPS, GRID, LOOKS, MOTIONS, cadenceName, frameAt, motion, posesPerSecond, type Cadence, type LookId, type MotionId, type Recipe } from './styles';
import './animation-style.css';

const START_T = 1.45;

function usePlayback() {
  const [t, setT] = useState(START_T);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const pos = useRef(START_T);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => { pos.current = (pos.current + ((now - last) / 1000) * speed) % DURATION; last = now; setT(pos.current); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);
  useEffect(() => { const hide = () => { if (document.hidden) setPlaying(false); }; document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide); }, []);
  const seek = (v: number) => { setPlaying(false); pos.current = Math.max(0, Math.min(DURATION - 1e-3, v)); setT(pos.current); };
  return { t, playing, speed, setSpeed, toggle: () => setPlaying(p => !p), seek, step: (n: number) => seek((frameAt(pos.current) + n) / FPS + 1e-4) };
}

export default function AnimationStyleLab() {
  const [motionId, setMotionId] = useState<MotionId | 'custom'>('cartoony');
  const [recipe, setRecipe] = useState<Recipe>({ ...motion('cartoony').recipe });
  const [compare, setCompare] = useState(false);
  const [look, setLook] = useState<LookId>('modelled');
  const [picks, setPicks] = useState<Picks>({ construction: 'Full 3D', appearance: 'Painterly', camera: ['35 mm, restrained dolly', 'Warm bloom, fine grain'] });
  const [copied, setCopied] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const pb = usePlayback();

  const choose = (id: MotionId) => { setMotionId(id); setRecipe({ ...motion(id).recipe }); setCompare(false); };
  const tweak = (patch: Partial<Recipe>) => { setMotionId('custom'); setRecipe(r => ({ ...r, ...patch })); setCompare(false); };
  const current = motionId === 'custom' ? null : motion(motionId);
  const styles: StageStyle[] = compare ? GRID.map(id => ({ id, recipe: motion(id).recipe })) : [{ id: motionId, recipe }];
  const frame = frameAt(pb.t);
  const label = current?.label ?? 'Custom';
  const prompt = current?.prompt ?? 'custom movement recipe';
  const direction = directionText(picks, label, prompt, recipe);

  return <main className="as-lab" data-testid="animation-style-lab">
    <div className="as-shell">
      <header className="as-header"><Link href="/" className="as-back">← Animation Lab</Link><span className="as-eyebrow">CHARACTER ANIMATION</span></header>
      <div className="as-heading">
        <h1>Animation Style</h1>
        <p>A style is four separate decisions. Paused, these versions of Pip look identical. In motion, each has a different personality. This lab isolates how a character moves.</p>
      </div>

      <ol className="as-dims" aria-label="The four dimensions of an animation style">
        {DIMENSIONS.map((d, i) => <li key={d.id} data-active={d.id === 'movement'}>
          <span className="as-eyebrow">{String(i + 1).padStart(2, '0')} · {d.label}</span>
          <b title={d.eg}>{d.q}</b>
          {d.href ? <Link href={d.href}>{d.link} →</Link> : <em>{d.link}</em>}
        </li>)}
      </ol>

      <div className="as-layout">
        <section className="as-main" aria-label="Stage">
          <div className="as-stage-wrap" ref={stageRef}>
            <StyleStage styles={styles} look={look} t={pb.t} playing={pb.playing} />
            {compare
              ? <div className="as-grid-labels" aria-hidden>{GRID.map(id => <span key={id}>{motion(id).label}<small>{cadenceName(motion(id).recipe.cadence)}</small></span>)}</div>
              : <div className="as-single-label"><span>{label}</span><small>on {cadenceName(recipe.cadence)} · {posesPerSecond(recipe.cadence)} poses/s</small></div>}
          </div>
          <div className="as-transport">
            <button type="button" className="as-play" onClick={pb.toggle}>{pb.playing ? 'Pause' : '▶ Play'}</button>
            <button type="button" aria-label="Previous frame" onClick={() => pb.step(-1)}>‹</button>
            <button type="button" aria-label="Next frame" onClick={() => pb.step(1)}>›</button>
            <input aria-label="Playhead" type="range" min={0} max={DURATION} step="any" value={pb.t} onChange={e => pb.seek(Number(e.target.value))} />
            <span className="as-mono" data-testid="frame">F{String(frame).padStart(3, '0')}</span>
            <button type="button" aria-pressed={pb.speed < 1} onClick={() => pb.setSpeed(pb.speed < 1 ? 1 : 0.25)} title="Quarter speed">¼×</button>
          </div>
          <CadenceStrip rows={styles.map(s => ({ id: s.id, label: s.id === 'custom' ? 'Custom' : motion(s.id as MotionId).label, cadence: s.recipe.cadence }))} frame={frame} />
            <section className="as-recipe" aria-label="The recipe" data-testid="recipe">
              <div className="as-recipe-head"><span className="as-eyebrow">THE RECIPE · six principles</span><span>{motionId === 'custom' ? 'Custom: every dial is independent' : `${label} preset. Move any dial to make your own`}</span></div>
              <div className="as-dials">
              <div className="as-dial">
                <p className="as-label">Cadence <span className="as-mono">{posesPerSecond(recipe.cadence)} poses/s</span></p>
                <div className="as-seg" role="group" aria-label="Cadence">{([1, 2, 3, 4] as Cadence[]).map(c => <button key={c} type="button" aria-pressed={recipe.cadence === c} onClick={() => tweak({ cadence: c })}>On {c}s</button>)}</div>
                <small>{PRINCIPLES.cadence}</small>
              </div>
              <Dial label="Exaggeration" k="exaggeration" min={0.5} max={1.8} r={recipe} onChange={tweak} />
              <Dial label="Anticipation" k="anticipation" min={0} max={2} r={recipe} onChange={tweak} />
              <Dial label="Follow-through" k="followThrough" min={0} max={2} r={recipe} onChange={tweak} />
              <Dial label="Squash & stretch" k="squash" min={0} max={1.5} r={recipe} onChange={tweak} />
              <Dial label="Pose holds" k="holds" min={0} max={1} r={recipe} onChange={tweak} />
              </div>
            </section>
        </section>

        <aside className="as-controls" aria-label="Movement controls">
          <div className="as-panel-head"><p className="as-eyebrow">MOVEMENT STYLE</p>
            <button type="button" aria-pressed={compare} onClick={() => setCompare(c => !c)} data-testid="compare">{compare ? 'Single view' : 'Compare four'}</button>
          </div>
          <div className="as-motions" role="group" aria-label="Movement style">
            {MOTIONS.map(m => <button key={m.id} type="button" aria-pressed={!compare && motionId === m.id} onClick={() => choose(m.id)} data-testid={`motion-${m.id}`}><b>{m.label}</b><small>{m.short}</small></button>)}
          </div>
          <p className="as-watch" data-testid="watch">{compare ? 'Same character, same beat, same camera. Play it, or step frame by frame, and compare how each one reaches the fright pose and leaves it.' : current ? <><b>Watch for:</b> {current.watch}</> : 'A custom recipe. Every dial below is a separate principle, and you can mix them freely.'}</p>

          <div className="as-group">
            <p className="as-label">Look <span>a separate decision</span></p>
            <div className="as-seg" role="group" aria-label="Look">{LOOKS.map(l => <button key={l.id} type="button" aria-pressed={look === l.id} onClick={() => setLook(l.id)}>{l.label}</button>)}</div>
          </div>

        </aside>
      </div>

      <section className="as-section" aria-labelledby="as-atlas">
        <div className="as-section-head"><h2 id="as-atlas">Eight visual styles, and the movement they usually carry</h2><p>Categories blur: productions increasingly mix techniques. Try each one’s typical motion on the stage.</p></div>
        <div className="as-atlas">
          {ATLAS.map(a => <article key={a.id} className="as-card">
            <h3>{a.name}</h3>
            <p className="as-eg">{a.examples}</p>
            <p><b>Look</b> {a.look}</p>
            <p><b>Motion</b> {a.movement}</p>
            <button type="button" onClick={() => { choose(a.motion); setLook(a.lookId); pb.seek(START_T); stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} data-testid={`try-${a.id}`}>Try {motion(a.motion).label.toLowerCase()} motion →</button>
          </article>)}
        </div>
      </section>

      <section className="as-section as-builder" aria-labelledby="as-direction">
        <div className="as-section-head"><h2 id="as-direction">Write the direction in five parts</h2><p>Don’t ask for a “style”. Specify each decision separately. Performance and timing come from the stage above.</p></div>
        <div className="as-specs">
          {SPECS.map(s => <div key={s.id} className="as-spec">
            <span className="as-eyebrow">{s.n} / {s.label.toUpperCase()}</span>
            <b>{s.title}</b>
            {s.id === 'construction' || s.id === 'appearance'
              ? <div className="as-chips" role="group" aria-label={s.title}>{s.options.map(o => <button key={o} type="button" aria-pressed={picks[s.id] === o} onClick={() => setPicks(p => ({ ...p, [s.id]: o }))}>{o}</button>)}</div>
              : s.id === 'camera'
                ? <div className="as-chips" role="group" aria-label={s.title}>{s.options.map(o => <button key={o} type="button" aria-pressed={picks.camera.includes(o)} onClick={() => setPicks(p => ({ ...p, camera: p.camera.includes(o) ? p.camera.filter(x => x !== o) : [...p.camera, o] }))}>{o}</button>)}</div>
                : <p className="as-from-stage">{s.id === 'performance' ? `${label}: set with the movement style above` : `On ${cadenceName(recipe.cadence)}, holds ${Math.round(recipe.holds * 100)}%: set with the recipe above`}</p>}
          </div>)}
        </div>
        <div className="as-output">
          <pre data-testid="direction">{direction}</pre>
          <div>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(direction); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy direction ↗'}</button>
            <p>Video models such as Seedance interpret words like these, but prompting alone can’t reliably enforce pose cadence, spacing or motion consistency. Treat the timing line as intent, and check the result frame by frame.</p>
          </div>
        </div>
      </section>

      <details className="as-section as-vocab">
        <summary><h2>Motion vocabulary: nine movement styles</h2></summary>
        <table><thead><tr><th>Style</th><th>Behaviour</th><th>Common associations</th></tr></thead>
          <tbody>{VOCABULARY.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody></table>
        <p className="as-note">Smoother isn’t better: great animation is intentional timing, not maximum frames. Smear frames (stretched drawings that sell speed) need drawn or deformed frames, so this rig can’t show them.</p>
      </details>

      <footer className="as-footer">
        <p>Related: <Link href="/labs/timing-and-spacing">Timing &amp; Spacing</Link> · <Link href="/labs/character-acting">Character Acting</Link> · <Link href="/labs/grading-finishing">Grading &amp; Finishing</Link></p>
        <p>Same cast, set and camera in every version · Playback starts on demand</p>
      </footer>
    </div>
  </main>;
}

function Dial({ label, k, min, max, r, onChange }: { label: string; k: 'exaggeration' | 'anticipation' | 'followThrough' | 'squash' | 'holds'; min: number; max: number; r: Recipe; onChange: (p: Partial<Recipe>) => void }) {
  return <label className="as-dial">
    <span className="as-label">{label}<output className="as-mono">{k === 'holds' ? `${Math.round(r[k] * 100)}%` : `${r[k].toFixed(2)}×`}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={0.05} value={r[k]} onChange={e => onChange({ [k]: Number(e.target.value) })} />
    <small>{PRINCIPLES[k]}</small>
  </label>;
}

/** One second of a 24 fps timeline per style: filled cells draw a new pose, bars hold it. */
function CadenceStrip({ rows, frame }: { rows: { id: string; label: string; cadence: Cadence }[]; frame: number }) {
  const inSecond = frame % FPS;
  return <div className="as-cadence" data-testid="cadence" aria-label={`Frame ${inSecond + 1} of this second`}>
    {rows.map(r => <div key={r.id} className="as-cad-row">
      <span className="as-cad-label">{r.label}<small>{posesPerSecond(r.cadence)}/s</small></span>
      <div className="as-cad-cells">{Array.from({ length: FPS }, (_, f) => {
        const start = f % r.cadence === 0;
        return <i key={f} data-new={start} data-now={f === inSecond} data-held-now={Math.floor(f / r.cadence) === Math.floor(inSecond / r.cadence)}>{start ? f + 1 : ''}</i>;
      })}</div>
    </div>)}
  </div>;
}
