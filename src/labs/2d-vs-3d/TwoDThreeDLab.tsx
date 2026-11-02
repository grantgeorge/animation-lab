'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { COMPARE, EXPERIMENTS, PANES, type PaneId } from './content';
import { FLOOR_Y, PART_DRAWINGS, VIEWS, VIEW_NAMES, cutoutCost, drawnCost, offView, rigCost, snapView } from './figure';
import { DURATION, FPS, drawingIndex, drawingsPerSecond, frameAt, samplePose, shownTime, type Cadence } from './move';
import { DrawingDefs, PipDrawing, VIEWBOX } from './PipDrawing';
import { RigStage } from './RigStage';
import './twod.css';

/** Starts paused on the top of the hop: arms up, mouth open. */
const START_T = 23 / FPS + 1e-4;
const at = (frame: number) => frame / FPS + 1e-4;

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
  return { t, playing, speed, setSpeed, setPlaying, toggle: () => setPlaying(p => !p), seek, step: (n: number) => seek(((frameAt(pos.current) + n + 60) % 60) / FPS + 1e-4) };
}

export default function TwoDThreeDLab() {
  const pb = usePlayback();
  const [turn, setTurn] = useState(0);
  const [cadence, setCadence] = useState<Record<PaneId, Cadence>>({ drawn: 2, cutout: 1, '3d': 1 });
  const [extras, setExtras] = useState<Record<PaneId, boolean>>({ drawn: false, cutout: false, '3d': false });
  /** Every angle the drawn pane has had to be drawn at (5° steps). */
  const [drawnAngles, setDrawnAngles] = useState<number[]>([0]);
  const [exp, setExp] = useState<string | null>(null);

  const frame = frameAt(pb.t);
  const view = snapView(turn);
  const between = offView(turn);
  const turnTo = (v: number) => { setTurn(v); setDrawnAngles(a => (a.includes(v) ? a : [...a, v])); };
  const setCad = (id: PaneId, c: Cadence) => setCadence(s => ({ ...s, [id]: c }));
  const toggleExtra = (id: PaneId) => setExtras(s => ({ ...s, [id]: !s[id] }));

  const run = (id: string) => {
    setExp(id);
    if (id === 'turn') { turnTo(30); pb.seek(START_T); }
    if (id === 'crouch') { turnTo(0); pb.seek(at(15)); setExtras(s => ({ ...s, cutout: true })); }
    if (id === 'smear') { turnTo(0); setCad('drawn', 2); pb.seek(at(18)); setExtras(s => ({ ...s, drawn: false })); }
    if (id === 'twos') { setCad('3d', 2); pb.setSpeed(0.25); pb.setPlaying(true); }
  };

  // Each pane shows the pose of the drawing it is holding.
  const drawnT = shownTime(pb.t, cadence.drawn);
  const cutT = shownTime(pb.t, cadence.cutout);
  const drawnIdx = drawingIndex(pb.t, cadence.drawn);
  const cd = cadence.drawn;
  const prevT = (drawnIdx - 1) * cd / FPS, nextT = (drawnIdx + 1) * cd / FPS;
  const smear = Array.from({ length: 7 }, (_, k) => samplePose(prevT + ((drawnT - prevT) * k) / 7));
  const costs = { drawn: drawnCost(cd, drawnAngles.length), cutout: cutoutCost(VIEWS.length), '3d': rigCost() };
  const expInfo = EXPERIMENTS.find(e => e.id === exp);

  return <main className="td-lab" data-testid="twod-lab">
    <div className="td-shell">
      <header className="td-header"><Link href="/" className="td-back">← Animation Lab</Link><span className="td-eyebrow">CHARACTER ANIMATION</span></header>
      <div className="td-heading">
        <h1>2D vs 3D Animation</h1>
        <p>One hop, defined once, made three ways: drawn frame by frame, pinned together from paper parts, and posed on a 3D rig. Same pose, same frame. What differs is what each technique makes cheap, and what it makes expensive.</p>
        <nav className="td-links" aria-label="Related labs"><Link href="/labs/animation-style">Animation Style →</Link><Link href="/labs/character-rigging">Character Rigging →</Link><Link href="/labs/animation-camera">Animation Camera →</Link></nav>
      </div>

      <section className="td-stage" aria-label="The same move, three techniques">
        <div className="td-panes">
          {PANES.map(p => <article key={p.id} className="td-pane" data-testid={`pane-${p.id}`} data-cadence={cadence[p.id]}
            data-angle={p.id === 'cutout' ? view : turn} data-view={p.id === 'cutout' ? view : undefined} data-drawing={p.id === 'drawn' ? drawnIdx : undefined}>
            <header className="td-pane-head"><b>{p.label}</b><span className="td-mono">on {cadence[p.id]}s · {drawingsPerSecond(cadence[p.id])}/s</span></header>
            <div className={`td-view td-view-${p.id}`}>
              {p.id === '3d'
                ? <RigStage t={pb.t} turn={turn} cadence={cadence['3d']} playing={pb.playing} rig={extras['3d']} />
                : <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${p.label} Pip, frame ${frame}`}>
                  <DrawingDefs />
                  {p.id === 'drawn' ? <DrawnPaper drawing={drawnIdx + 1} /> : <CutoutCard />}
                  {p.id === 'drawn' && extras.drawn && <>
                    <PipDrawing mode="drawn" pose={samplePose(prevT)} turn={turn} seed={drawnIdx - 1 + turn} ghost="#d6453d" />
                    <PipDrawing mode="drawn" pose={samplePose(nextT)} turn={turn} seed={drawnIdx + 1 + turn} ghost="#2f8f6f" />
                  </>}
                  {p.id === 'drawn'
                    ? <PipDrawing mode="drawn" pose={samplePose(drawnT)} turn={turn} seed={drawnIdx + turn} smear={smear} />
                    : <PipDrawing mode="cutout" pose={samplePose(cutT)} turn={view} pivots={extras.cutout} />}
                </svg>}
              {p.id === 'cutout' && between && <p className="td-snap" data-testid="snap-note">No {turn}° drawings · showing {VIEW_NAMES[view].toLowerCase()}</p>}
              {p.id === 'drawn' && turn !== 0 && <p className="td-snap td-snap-ok">Redrawn at {turn}°</p>}
              {p.id === '3d' && turn !== 0 && <p className="td-snap td-snap-ok">Camera at {turn}°</p>}
            </div>
          </article>)}
        </div>

        <div className="td-bar">
          <div className="td-transport">
            <button type="button" className="td-play" onClick={pb.toggle}>{pb.playing ? 'Pause' : '▶ Play'}</button>
            <button type="button" aria-label="Previous frame" onClick={() => pb.step(-1)}>‹</button>
            <button type="button" aria-label="Next frame" onClick={() => pb.step(1)}>›</button>
            <input aria-label="Playhead" type="range" min={0} max={DURATION} step="any" value={pb.t} onChange={e => pb.seek(Number(e.target.value))} />
            <span className="td-mono" data-testid="frame">F{String(frame).padStart(3, '0')}</span>
            <button type="button" aria-pressed={pb.speed < 1} onClick={() => pb.setSpeed(pb.speed < 1 ? 1 : 0.25)} title="Quarter speed">¼×</button>
          </div>
          <label className="td-turn">
            <span className="td-label">Turn the camera <output className="td-mono" data-testid="turn-value">{turn}°</output></span>
            <input type="range" aria-label="Turn the camera" min={0} max={90} step={5} value={turn} onChange={e => turnTo(Number(e.target.value))} />
            <span className="td-ticks" aria-hidden>{VIEWS.map(v => <i key={v} style={{ left: `${(v / 90) * 100}%` }} data-on={v === view}>{v === 0 ? 'Front 0°' : v === 45 ? '¾ view 45°' : 'Side 90°'}</i>)}</span>
          </label>
        </div>
      </section>

      <section className="td-settings" aria-label="Technique settings and cost">
        {PANES.map(p => {
          const c = costs[p.id];
          return <div key={p.id} className="td-set" data-pane={p.id}>
            <p className="td-eyebrow">{p.label} <span>{p.how}</span></p>
            <div className="td-cost" data-testid={`cost-${p.id}`}><b>{c.drawings}</b><span>{c.drawings === 0 ? 'drawings, at any angle' : p.id === 'drawn' ? 'drawings for this loop' : 'drawings, reused every frame'}<small>{c.detail}</small></span></div>
            <div className="td-set-row">
              <div className="td-seg" role="group" aria-label={`${p.label} cadence`}>{([1, 2] as Cadence[]).map(k => <button key={k} type="button" aria-pressed={cadence[p.id] === k} onClick={() => setCad(p.id, k)}>On {k}s</button>)}</div>
              <button type="button" aria-pressed={extras[p.id]} onClick={() => toggleExtra(p.id)}>{p.toggle}</button>
            </div>
            <p className="td-set-note">{p.id === 'drawn' ? (drawnAngles.length > 1 ? `Redrawn at ${drawnAngles.length} angles so far. Each new angle means all ${costs.drawn.drawings / drawnAngles.length} drawings again.` : 'Turn the camera: every drawing has to be made again at the new angle.')
              : p.id === 'cutout' ? (between ? `No ${turn}° set in the library. A true ${turn}° needs ${PART_DRAWINGS} new part drawings.` : `Showing the ${VIEW_NAMES[view].toLowerCase()} set: one of ${VIEWS.length} drawn views.`)
              : 'The camera can go anywhere for free. The cost was paid up front: modelling, rigging and skinning.'}</p>
          </div>;
        })}
      </section>

      <section className="td-section" aria-labelledby="td-try">
        <div className="td-section-head"><h2 id="td-try">Four things to try</h2><p>Each sets up the stage. Watch all three panes.</p></div>
        <div className="td-exps">
          {EXPERIMENTS.map((e, i) => <button key={e.id} type="button" className="td-exp" aria-pressed={exp === e.id} onClick={() => run(e.id)} data-testid={`exp-${e.id}`}>
            <span className="td-eyebrow">{String(i + 1).padStart(2, '0')}</span><b>{e.title}</b>
          </button>)}
        </div>
        <p className="td-insight" data-testid="insight" aria-live="polite">{expInfo ? expInfo.insight : 'Pick an experiment, or scrub the playhead and turn the camera yourself.'}</p>
      </section>

      <section className="td-section" aria-labelledby="td-compare">
        <div className="td-section-head"><h2 id="td-compare">What each technique makes cheap</h2><p>Productions mix them: drawn effects over 3D, 3D stepped on twos, cut-out rigs with drawn replacement parts.</p></div>
        <div className="td-table-wrap"><table className="td-table">
          <thead><tr><th scope="col"><span className="sr-only">Aspect</span></th>{PANES.map(p => <th key={p.id} scope="col">{p.label}</th>)}</tr></thead>
          <tbody>{COMPARE.map(r => <tr key={r.row}><th scope="row">{r.row}</th><td>{r.drawn}</td><td>{r.cutout}</td><td>{r.rig}</td></tr>)}</tbody>
        </table></div>
      </section>

      <footer className="td-footer">
        <p>Related: <Link href="/labs/animation-style">Animation Style</Link> · <Link href="/labs/character-rigging">Character Rigging</Link> · <Link href="/labs/timing-and-spacing">Timing &amp; Spacing</Link></p>
        <p>One move · one playhead · 24 fps · each pane holds its drawing for its own cadence</p>
      </footer>
    </div>
  </main>;
}

/** Animation paper: peg holes, a floor guide and the drawing number in the corner. */
function DrawnPaper({ drawing }: { drawing: number }) {
  return <g aria-hidden>
    <rect width="480" height="480" fill="#F5EEE1" />
    <circle cx="240" cy="19" r="5.5" fill="#ddd3c1" />
    <rect x="164" y="15" width="30" height="8" rx="4" fill="#ddd3c1" /><rect x="286" y="15" width="30" height="8" rx="4" fill="#ddd3c1" />
    <line x1="24" x2="456" y1={FLOOR_Y} y2={FLOOR_Y} stroke="#7aa0c8" strokeWidth="1" strokeDasharray="5 5" opacity="0.6" />
    <text x="456" y="462" textAnchor="end" className="td-pencil">hop · {String(drawing).padStart(2, '0')}</text>
  </g>;
}

/** The cut-out's backing card. */
function CutoutCard() {
  return <g aria-hidden>
    <rect width="480" height="480" fill="#BFCBCB" />
    <rect y={FLOOR_Y} width="480" height={480 - FLOOR_Y} fill="#A9B7B6" />
  </g>;
}
