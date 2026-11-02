'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { blockingConfig as config } from '@/labs/lens-and-framing/config';
import { blockingReadout, clampMark, faceLabel, FACINGS, type Facing, type Reading } from './blockingMath';
import { checksPass, EXERCISES, type Exercise } from './blockingExercises';
import { BlockingStage, type StageView } from './BlockingStage';
import { FloorPlan } from './FloorPlan';
import type { Mark } from './engine';
import { Choices, Prompt, Range, Transport, usePlayback } from './shared';
import './blocking.css';

const START = { bram: config.presets.Conversation.bram, pip: config.presets.Conversation.pip, facing: 'partner' as Facing };

export default function BlockingLab() {
  const [bram, setBram] = useState<Mark>({ ...START.bram });
  const [pip, setPip] = useState<Mark>({ ...START.pip });
  const [facing, setFacing] = useState<Facing>(START.facing);
  const [angle, setAngle] = useState(0);
  const [focal, setFocal] = useState<number>(config.focal);
  const [view, setView] = useState<StageView>('Camera');
  const [silhouette, setSilhouette] = useState(false);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [played, setPlayed] = useState(false);
  const [solved, setSolved] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const playback = usePlayback(6);
  const reading = blockingReadout(bram, pip, angle, focal, facing);
  const exercise = EXERCISES[index];

  const move = (actor: 'Bram' | 'Pip', mark: Mark) => { setPlayed(false); (actor === 'Bram' ? setBram : setPip)(clampMark(mark)); };
  const stage = (layout: { bram: Mark; pip: Mark }, nextFacing: Facing, nextSilhouette = false) => {
    playback.seek(0); setAngle(0); setFocal(config.focal); setView('Camera'); setPlayed(false);
    setBram({ ...layout.bram }); setPip({ ...layout.pip }); setFacing(nextFacing); setSilhouette(nextSilhouette);
  };
  const start = (i: number) => {
    const ex = EXERCISES[i];
    setIndex(i); setStarted(true);
    stage(config.presets[ex.setup.preset], ex.setup.facing, ex.setup.silhouette);
    if (window.matchMedia('(max-width: 760px)').matches) stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reset = () => { stage(START, START.facing); setStarted(false); };

  const checks = started ? exercise.checks(reading, played) : [];
  const done = started && checksPass(checks);
  // The greeting counts as played once the wave lands while every other goal holds.
  const ready = started && checksPass(exercise.checks(reading, true));
  // Derived during render (React's "adjust state on change" pattern), not in effects.
  if (ready && !played && playback.t >= 4.5) setPlayed(true);
  if (done && !solved.includes(exercise.id)) setSolved([...solved, exercise.id]);

  const facingWord = { front: 'both turned to camera', partner: 'facing each other', cheat: 'facing each other, cheated a quarter-turn toward camera' }[facing];
  return <main className="st-lab bk-lab" data-testid="blocking-lab">
    <div className="st-shell">
      <header className="bk-header">
        <Link href="/" className="bk-back">← Animation Lab</Link>
        <span className="st-eyebrow">VISUAL STORYTELLING</span>
      </header>
      <div className="bk-heading">
        <h1>Staging &amp; Blocking</h1>
        <p>Blocking is deciding where actors stand and which way they face, so the camera can read what is happening between them.</p>
      </div>

      <div className="bk-layout">
        <section className="bk-main" aria-label="Camera">
          <div className="bk-stage-wrap" ref={stageRef}>
            <BlockingStage bram={bram} pip={pip} yaw={reading.yaw} facing={facing} angle={angle} focal={focal} t={playback.t} playing={playback.playing} silhouette={silhouette} view={view} />
            <div className="bk-stage-bar">
              <span className="bk-stage-label">{view === 'Camera' ? `CAMERA · ${focal} MM` : 'SET · DRAG TO ORBIT'}</span>
              <div className="bk-view" role="group" aria-label="View">
                {(['Camera', 'Set'] as const).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}
              </div>
            </div>
          </div>
          <Transport duration={6} playback={playback} />
          <Readout r={reading} />
          <ExerciseCard exercise={exercise} index={index} started={started} checks={checks} done={done} solved={solved} onStart={start} onNext={() => start((index + 1) % EXERCISES.length)} />
        </section>

        <aside className="bk-controls" aria-label="Blocking controls">
          <div className="bk-panel-head"><p className="st-eyebrow">FLOOR PLAN · FROM ABOVE</p><button type="button" onClick={reset}>Reset</button></div>
          <FloorPlan bram={bram} pip={pip} yaw={reading.yaw} angle={angle} focal={focal} onMove={move} />
          <p className="bk-hint">Drag <b className="bk-b">B</b> or <b className="bk-p">P</b>. The shaded wedge is what the lens sees.</p>
          <div className="bk-group">
            <p className="bk-label">Facing</p>
            <Choices label="Facing" value={FACINGS.find(f => f.id === facing)!.label} items={FACINGS.map(f => f.label)} onChange={label => { setFacing(FACINGS.find(f => f.label === label)!.id); setPlayed(false); }} />
          </div>
          <div className="bk-group">
            <Range label="Camera angle" value={angle} min={-config.angleLimit} max={config.angleLimit} unit="°" onChange={setAngle} />
            <Range label="Lens" value={focal} min={24} max={65} unit=" mm" onChange={setFocal} />
            <label className="st-check"><input type="checkbox" checked={silhouette} onChange={e => setSilhouette(e.target.checked)} />Silhouette test <span>Shows the actors as solid black shapes</span></label>
          </div>
        </aside>
      </div>

      <Prompt text={`Stage the six-second doorway greeting. Bram on his mark at x ${bram.x.toFixed(1)} m, z ${bram.z.toFixed(1)} m; Pip at x ${pip.x.toFixed(1)} m, z ${pip.z.toFixed(1)} m, ${reading.distance.toFixed(1)} m apart (${reading.zone.toLowerCase()} distance), ${facingWord}. Pip waves and Bram waves back without leaving their marks. ${focal} mm lens on a 36 mm gate, camera ${angle}° around the staging centre. ${reading.overlap ? 'Separate their silhouettes so both performances read.' : 'Keep their silhouettes separate throughout the gesture.'}`} />
      <footer className="bk-footer">
        <p>Further reading: <a href="https://www.nyfa.edu/film-school-blog/the-5-stages-of-blocking-a-scene/" target="_blank" rel="noreferrer">NYFA · The five stages of blocking ↗</a> · <a href="https://en.wikipedia.org/wiki/Proxemics" target="_blank" rel="noreferrer">Hall’s proxemics ↗</a></p>
        <nav><Link href="/labs/lens-and-framing">Lens &amp; Framing →</Link><Link href="/labs/shot-coverage">Shot Coverage →</Link></nav>
      </footer>
    </div>
  </main>;
}

function Readout({ r }: { r: Reading }) {
  const behind = r.overlap ? 'Pip is hidden behind Bram' : 'Clear';
  const side = (name: 'bram' | 'pip') => r.screen[name] < -.15 ? 'left' : r.screen[name] > .15 ? 'right' : 'centre';
  const cells = [
    { id: 'separation', label: 'Silhouettes', value: r.overlap ? 'Overlapping' : 'Separate', ok: !r.overlap, note: r.overlap ? behind : 'Each body reads on its own' },
    { id: 'frame', label: 'Frame', value: r.cropped ? `${r.croppedActors.join(' & ')} cut off` : 'Both in frame', ok: !r.cropped, note: r.cropped ? 'Widen the lens or move the mark in' : `Bram screen ${side('bram')} · Pip screen ${side('pip')}` },
    { id: 'distance', label: 'Distance', value: `${r.distance.toFixed(1)} m · ${r.zone}`, ok: !r.collision, note: r.collision ? 'Too close to gesture' : { Intimate: 'Close enough to whisper', Personal: 'Arm’s length: friends', Social: 'A conversation between acquaintances', Public: 'Across the square' }[r.zone] },
  ];
  return <div className="bk-readout" data-testid="blocking-reading">
    {cells.map(c => <div key={c.id} className="bk-cell" data-ok={c.ok} data-testid={`read-${c.id}`}>
      <span className="bk-cell-label">{c.label}</span>
      <b>{c.value}</b>
      <small>{c.note}</small>
    </div>)}
    <div className="bk-cell" data-ok="true" data-testid="read-faces">
      <span className="bk-cell-label">Faces to camera</span>
      {(['bram', 'pip'] as const).map(n => <div key={n} className="bk-face">
        <span>{n === 'bram' ? 'Bram' : 'Pip'}</span>
        <i><em style={{ width: `${Math.max(0, r.open[n]) * 100}%` }} /></i>
        <small>{faceLabel(r.open[n])}</small>
      </div>)}
    </div>
  </div>;
}

function ExerciseCard({ exercise, index, started, checks, done, solved, onStart, onNext }: { exercise: Exercise; index: number; started: boolean; checks: { label: string; ok: boolean }[]; done: boolean; solved: string[]; onStart: (i: number) => void; onNext: () => void }) {
  return <section className={`bk-exercise ${done ? 'done' : ''}`} aria-labelledby="bk-exercise-title" data-testid="exercise">
    <div className="bk-ex-tabs" role="group" aria-label="Exercises">
      <span className="st-eyebrow">TRY IT</span>
      {EXERCISES.map((ex, i) => <button key={ex.id} type="button" aria-pressed={started && i === index} aria-label={`Exercise ${i + 1}: ${ex.title}${solved.includes(ex.id) ? ' (solved)' : ''}`} className={solved.includes(ex.id) ? 'solved' : ''} onClick={() => onStart(i)}>{solved.includes(ex.id) ? '✓' : i + 1}</button>)}
    </div>
    <h2 id="bk-exercise-title">{exercise.title}</h2>
    <p className="bk-ex-goal">{exercise.goal}</p>
    {started ? <ul className="bk-checks" aria-live="polite">
      {checks.map(c => <li key={c.label} data-ok={c.ok}><span aria-hidden>{c.ok ? '✓' : '○'}</span>{c.label}<span className="sr-only">{c.ok ? ' (done)' : ' (not yet)'}</span></li>)}
    </ul> : <button type="button" className="bk-ex-start" onClick={() => onStart(index)}>Set up exercise {index + 1}</button>}
    {done && <div className="bk-insight" role="status"><p className="st-eyebrow">SOLVED · WHY IT WORKS</p><p>{exercise.insight}</p><button type="button" onClick={onNext}>{index === EXERCISES.length - 1 ? 'Back to exercise 1' : 'Next exercise →'}</button></div>}
  </section>;
}
