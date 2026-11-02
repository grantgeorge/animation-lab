'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { BRAM_BONES, PIP_BONES } from '@/scene/characters/Characters';
import { ANATOMY, CORRECTIONS, FK_IK, VOCABULARY } from './content';
import { EXERCISES, TOL, allOk, type Check, type Exercise, type Measure } from './exercises';
import { JOINTS, emptyPose, joint, slidersFromDelta, type Axis, type FkPose, type JointId } from './joints';
import { RigStage, makeShared, type CharacterId, type DisplayId, type HandleMap, type Vec3, type ViewId } from './RigStage';
import type { Correction } from './rigMath';
import './rigging.css';

type Tab = 'pose' | 'skin' | 'bind';
type Mode = 'fk' | 'ik';

const START: FkPose = { ...emptyPose(), shoulder: { rz: 65, rx: 15, ry: 60 }, elbow: { rx: 75 } };
const DISPLAYS: { id: DisplayId; label: string }[] = [{ id: 'mesh', label: 'Mesh' }, { id: 'xray', label: 'X-ray' }, { id: 'weights', label: 'Weights' }, { id: 'skeleton', label: 'Skeleton' }];
const VIEWS: { id: ViewId; label: string }[] = [{ id: 'front', label: 'Front' }, { id: 'threeQuarter', label: '¾' }, { id: 'side', label: 'Side' }, { id: 'arm', label: 'Arm' }];
const TABS: { id: Tab; label: string }[] = [{ id: 'pose', label: 'FK & IK' }, { id: 'skin', label: 'Skinning' }, { id: 'bind', label: 'Bind pose' }];
const NAME: Record<CharacterId, string> = { bram: 'Bram', pip: 'Pip' };
const cm = (m: number) => `${Math.round(m * 100)} cm`;
const deg = (v: number) => `${Math.round(v)}°`;
const signed = (v = 0) => `${v < 0 ? '−' : '+'}${Math.abs(v)}°`;

export default function CharacterRiggingLab() {
  const [character, setCharacter] = useState<CharacterId>('bram');
  const [display, setDisplay] = useState<DisplayId>('xray');
  const [view, setView] = useState<ViewId>('threeQuarter');
  const [tab, setTab] = useState<Tab>('pose');
  const [arm, setArm] = useState<Mode>('fk');
  const [legs, setLegs] = useState<Mode>('fk');
  const [fk, setFk] = useState<FkPose>(START);
  const [hipDrop, setHipDrop] = useState(0);
  const [target, setTarget] = useState<Vec3 | null>(null);
  const [pole, setPole] = useState(0);
  const [selected, setSelected] = useState<JointId>('elbow');
  const [weights, setWeights] = useState<'smooth' | 'rigid'>('smooth');
  const [correction, setCorrection] = useState<Correction>('none');
  const [playing, setPlaying] = useState(true);
  const [m, setM] = useState<Measure | null>(null);
  const [shared] = useState(makeShared);
  const [handles] = useState<HandleMap>(() => new Map());
  const [waveU, setWaveU] = useState(0.4);
  const [exIndex, setExIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [solved, setSolved] = useState<string[]>([]);
  const [reachedWith, setReachedWith] = useState({ fk: false, ik: false });
  const stageRef = useRef<HTMLDivElement>(null);

  const mode = tab === 'bind' ? 'wave' : 'pose';
  const exercise = EXERCISES[exIndex];
  const showMark = started && exercise.setup.mark && tab !== 'bind';

  // Derived during render: latch "reached with FK/IK", then mark the exercise solved.
  if (started && exercise.id === 'reach' && m && m.arm === arm && m.markDist <= TOL.mark && !reachedWith[arm]) setReachedWith((r) => ({ ...r, [arm]: true }));
  const checks: Check[] = started && m ? exercise.checks({ m, arm, legs, reachedWith }) : [];
  const done = allOk(checks);
  if (done && !solved.includes(exercise.id)) setSolved((s) => [...s, exercise.id]);

  const switchArm = (to: Mode) => {
    if (to === arm) return;
    if (to === 'ik') {
      if (!m) return;
      setTarget(m.wrist);
      setPole(Math.round(Math.max(-60, Math.min(150, m.poleDeg))));
    } else {
      // Match FK to IK: the sliders take the rotations the solver wrote, so the pose doesn't jump.
      const get = (part: string) => shared.ik.get(part);
      setFk((f) => ({ ...f, shoulder: get('upperArmL') ? slidersFromDelta('shoulder', get('upperArmL')!) : f.shoulder, elbow: get('forearmL') ? slidersFromDelta('elbow', get('forearmL')!) : f.elbow, wrist: get('handL') ? slidersFromDelta('wrist', get('handL')!) : f.wrist }));
    }
    setArm(to);
  };
  const switchLegs = (to: Mode) => {
    if (to === legs) return;
    if (to === 'fk') {
      const thigh = shared.ik.get('thighL'), shin = shared.ik.get('shinL');
      if (thigh && shin) setFk((f) => ({ ...f, hips: slidersFromDelta('hips', thigh), knees: slidersFromDelta('knees', shin) }));
    }
    setLegs(to);
  };
  const resetPose = (pose: FkPose = START) => { setFk(pose); setHipDrop(0); setArm('fk'); setLegs('fk'); setTarget(null); setPole(0); };
  const start = (i: number) => {
    const ex = EXERCISES[i];
    setExIndex(i); setStarted(true); setTab('pose'); setReachedWith({ fk: false, ik: false });
    setFk(emptyPose()); setHipDrop(0); setLegs(ex.setup.legs);
    if (ex.setup.arm === 'ik' && m) { setArm('ik'); setTarget(ex.setup.targetOnMark ? m.mark : m.wrist); setPole(0); } else { setArm('fk'); setTarget(null); setPole(0); }
    setSelected(ex.id === 'squat' ? 'knees' : 'shoulder'); setView(ex.setup.view);
    if (display === 'skeleton' || display === 'weights') setDisplay('xray');
  };
  const chooseCharacter = (c: CharacterId) => { if (c === character) return; setCharacter(c); setM(null); resetPose(); setStarted(false); };
  const chooseTab = (t: Tab) => {
    setTab(t);
    if (t === 'skin' && display !== 'weights') { setDisplay('weights'); if (selected === 'hips' || selected === 'knees') setSelected('elbow'); }
    if (t === 'pose' && display === 'weights') setDisplay('xray');
    if (t === 'bind') { setPlaying(true); if (display === 'weights') setDisplay('xray'); }
  };
  const toStage = () => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const setAxis = (id: JointId, k: Axis, v: number) => setFk((f) => ({ ...f, [id]: { ...f[id], [k]: v } }));

  const sel = joint(selected);
  const ikDriven = (sel.limb === 'arm' && arm === 'ik') || (sel.limb === 'legs' && legs === 'ik');
  const legMax = Math.round((m?.legLength ?? 0.68) * 0.45 * 100) / 100;
  const offsets = (character === 'bram' ? BRAM_BONES : PIP_BONES);
  const offL = offsets.upperArmL.offsetDeg?.[2] ?? 0, offR = offsets.upperArmR.offsetDeg?.[2] ?? 0;
  const stageLabel = mode === 'wave' ? `Wave clip · ${CORRECTIONS.find((c) => c.id === correction)!.label}` : `Arm ${arm.toUpperCase()} · Legs ${legs.toUpperCase()}`;

  return <main className="rg-lab" data-testid="character-rigging-lab">
    <div className="rg-shell">
      <header className="rg-header"><Link href="/" className="rg-back">← Animation Lab</Link><span className="rg-eyebrow">CHARACTER ANIMATION</span></header>
      <div className="rg-heading">
        <h1>Character Rigging</h1>
        <p>A rig is what turns a sculpted model into a puppet. Pose Bram’s skeleton by rotating joints (FK) or by placing his hand (IK), watch the skin follow its weights, and see why our arm fixes mattered.</p>
      </div>

      <ol className="rg-anatomy" aria-label="What a rig is made of">
        {ANATOMY.map((a) => {
          const active = a.id === 'skeleton' ? display === 'skeleton' : a.id === 'skin' ? tab === 'skin' : tab === 'pose' && display !== 'skeleton';
          return <li key={a.id}><button type="button" aria-pressed={active} onClick={() => { if (a.id === 'skeleton') { setDisplay('skeleton'); if (tab === 'skin') setTab('pose'); } else if (a.id === 'skin') chooseTab('skin'); else { chooseTab('pose'); setDisplay('xray'); } }}>
            <span className="rg-eyebrow">{a.n} · {a.label}</span><b>{a.text}</b>
          </button></li>;
        })}
      </ol>

      <div className="rg-layout">
        <section className="rg-main" aria-label="Stage">
          <div className="rg-stage-wrap" ref={stageRef}>
            <RigStage character={character} display={display} view={view} mode={mode} correction={correction} weights={weights} fk={fk} hipDrop={hipDrop} arm={arm} legs={legs}
              target={target} pole={pole} selected={selected} showMark={showMark} playing={playing} waveU={waveU} handles={handles} onMeasure={setM} onSelect={(id) => { setSelected(id); if (tab === 'bind') setTab('pose'); }}
              onTarget={setTarget} shared={shared} markMagnet={showMark && m ? m.mark : null} sinkCm={m ? Math.round(m.footSink * 100) : 0}
              onFk={(id, v) => setFk((f) => ({ ...f, [id]: { ...f[id], ...v } }))} onHipDrop={setHipDrop} maxDrop={legMax} />
            {mode === 'pose' && <p className="rg-drag-hint" data-testid="drag-hint">{arm === 'ik' ? 'Drag the gold ring to place the hand · drag other joints to rotate them' : 'Drag any joint to rotate it'}{legs === 'ik' ? ' · drag the hips down to squat' : ''}</p>}
            <div className="rg-stage-label"><span>{NAME[character]}</span><small>{stageLabel}</small></div>
            <div className="rg-views" role="group" aria-label="Camera view">{VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>)}</div>
            {display === 'weights' && <div className="rg-legend" aria-hidden><span>0</span><i /><span>1</span><small>{sel.label} weight</small></div>}
            {mode === 'wave' && correction !== 'shipped' && <div className="rg-ghost-note" aria-hidden><i />Shipped result</div>}
          </div>
          <div className="rg-toolbar">
            <div className="rg-seg" role="group" aria-label="Display">{DISPLAYS.map((d) => <button key={d.id} type="button" aria-pressed={display === d.id} onClick={() => setDisplay(d.id)}>{d.label}</button>)}</div>
            <div className="rg-seg" role="group" aria-label="Character">{(['bram', 'pip'] as const).map((c) => <button key={c} type="button" aria-pressed={character === c} onClick={() => chooseCharacter(c)}>{NAME[c]}</button>)}</div>
            <button type="button" className="rg-reset" onClick={() => { resetPose(); setStarted(false); }}>Reset pose</button>
          </div>
          <ExerciseCard exercise={exercise} index={exIndex} started={started} checks={checks} done={done} solved={solved} onStart={start} onNext={() => start((exIndex + 1) % EXERCISES.length)} />
        </section>

        <aside className="rg-controls" aria-label="Rig controls">
          <div className="rg-tabs" role="tablist" aria-label="Rig topics">{TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => chooseTab(t.id)} data-testid={`tab-${t.id}`}>{t.label}</button>)}</div>

          {tab === 'pose' && <div className="rg-panel" role="tabpanel" aria-label="FK and IK">
            <div className="rg-limbs">
              <Switch label="Left arm" value={arm} onChange={switchArm} disabled={!m} />
              <Switch label="Legs" value={legs} onChange={switchLegs} disabled={!m} />
            </div>
            <label className="rg-range">
              <span className="rg-label">Lower the hips<output className="rg-mono">{cm(hipDrop)}</output></span>
              <input type="range" aria-label="Lower the hips" min={0} max={legMax} step={0.005} value={hipDrop} onChange={(e) => setHipDrop(Number(e.target.value))} />
            </label>

            <div className="rg-joint-card" data-testid="joint-card">
              <div className="rg-joint-head"><p className="rg-eyebrow">JOINT</p>
                <select aria-label="Joint" value={selected} onChange={(e) => setSelected(e.target.value as JointId)}>{JOINTS.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}</select>
              </div>
              {ikDriven
                ? <p className="rg-driven">Driven by IK. The solver is writing this joint’s rotation{selected === 'hips' ? ': drag the hips down on the stage and it bends the knees to keep the feet planted' : ''}. Switch the {sel.limb === 'arm' ? 'arm' : 'legs'} to FK to rotate it by hand. The pose carries over.</p>
                : sel.axes.map((a) => <label key={a.k} className="rg-range">
                  <span className="rg-label">{a.name} <small>{a.hint}</small><output className="rg-mono">{deg(fk[selected][a.k] ?? 0)}</output></span>
                  <input type="range" aria-label={a.name} min={a.min} max={a.max} step={1} value={fk[selected][a.k] ?? 0} onChange={(e) => setAxis(selected, a.k, Number(e.target.value))} />
                </label>)}
              <p className="rg-hint">Drag a joint on the stage to rotate it, or click it to pick it here.</p>
            </div>

            {arm === 'ik' && <label className="rg-range rg-pole">
              <span className="rg-label">Pole vector <small>elbow down → out</small><output className="rg-mono">{deg(pole)}</output></span>
              <input type="range" aria-label="Pole vector" min={-60} max={150} step={1} value={pole} onChange={(e) => setPole(Number(e.target.value))} />
            </label>}

            <dl className="rg-readout" data-testid="readout">
              <div><dt>Shoulder</dt><dd data-testid="read-shoulder">{m ? deg(m.shoulderDeg) : '–'}</dd></div>
              <div><dt>Elbow</dt><dd data-testid="read-elbow">{m ? deg(m.elbowDeg) : '–'}</dd></div>
              <div><dt>IK reach</dt><dd data-testid="read-reach" data-out={arm === 'ik' && m ? !m.reached : undefined}>{arm === 'ik' && m ? (m.reached ? `${Math.round(m.reach * 100)}%` : 'Too far') : 'FK'}</dd></div>
              <div><dt>Feet</dt><dd data-testid="read-feet" data-bad={m ? m.footSink > TOL.sink : undefined}>{m ? (m.footSink > TOL.sink ? `−${cm(m.footSink)}` : 'Planted') : '–'}</dd></div>
            </dl>
            <p className="rg-note">{arm === 'ik' ? (m && !m.reached ? 'The target is beyond the arm’s length, so the arm extends as far as it goes and points at it.' : 'Drag the gold hand target on the stage. IK just writes FK rotations for you: the shoulder and elbow above are the solver’s answer.') : 'FK: every joint is a rotation from its parent. To move the hand, drag the shoulder, then the elbow: the hand goes wherever the chain puts it.'}</p>
          </div>}

          {tab === 'skin' && <div className="rg-panel" role="tabpanel" aria-label="Skinning">
            <p className="rg-copy">Each vertex follows up to {shared.stats?.influences ?? 4} joints, blended by <b>weights</b> that add up to 1. Pick a joint to paint its influence: red moves fully with it, blue ignores it.</p>
            {shared.stats && <p className="rg-stats rg-mono">{shared.stats.vertices.toLocaleString('en-US')} vertices · {shared.stats.joints} joints · {shared.stats.influences} weights each</p>}
            <div className="rg-chips" role="group" aria-label="Paint joint">{JOINTS.map((j) => <button key={j.id} type="button" aria-pressed={selected === j.id} onClick={() => setSelected(j.id)}>{j.label.replace(' · both legs', '')}</button>)}</div>
            <div className="rg-group">
              <p className="rg-label">Binding</p>
              <div className="rg-seg" role="group" aria-label="Binding">
                <button type="button" aria-pressed={weights === 'smooth'} onClick={() => setWeights('smooth')}>Smooth (shipped)</button>
                <button type="button" aria-pressed={weights === 'rigid'} onClick={() => setWeights('rigid')}>Rigid</button>
              </div>
              <small className="rg-small">{weights === 'rigid' ? 'Rigid: every vertex follows only its strongest joint. Bend the elbow or knees and the skin creases and tears at the seams.' : 'Smooth: weights fade across each joint so the skin stretches instead of tearing.'}</small>
            </div>
            <label className="rg-range">
              <span className="rg-label">Wrist twist <small>past ±90° the skin collapses</small><output className="rg-mono">{deg(fk.wrist.ry ?? 0)}</output></span>
              <input type="range" aria-label="Wrist twist" min={-180} max={180} step={1} value={fk.wrist.ry ?? 0} disabled={arm === 'ik'} onChange={(e) => setAxis('wrist', 'ry', Number(e.target.value))} />
            </label>
            <label className="rg-range">
              <span className="rg-label">Elbow bend <small>deep bends lose volume</small><output className="rg-mono">{deg(fk.elbow.rx ?? 0)}</output></span>
              <input type="range" aria-label="Elbow bend" min={0} max={150} step={1} value={fk.elbow.rx ?? 0} disabled={arm === 'ik'} onChange={(e) => setAxis('elbow', 'rx', Number(e.target.value))} />
            </label>
            <div className="rg-row">
              <button type="button" onClick={() => { switchArm('fk'); setFk((f) => ({ ...f, shoulder: { rz: 70, rx: 10 }, elbow: { rx: 30 }, wrist: { ry: 170 } })); setSelected('wrist'); setView('arm'); }}>Show the candy wrapper</button>
              <button type="button" onClick={() => { switchArm('fk'); setFk((f) => ({ ...f, shoulder: { rz: 75, rx: 20 }, elbow: { rx: 145 }, wrist: {} })); setSelected('elbow'); setView('arm'); }}>Fold the elbow</button>
            </div>
            <p className="rg-note">This is <b>linear blend skinning</b>: a vertex moves by the weighted average of its joints’ transforms. Averaging two rotations shrinks the vertex toward the bone, so a twisted wrist pinches like a sweet wrapper and a folded elbow thins. Production rigs add twist joints along the forearm, use dual-quaternion skinning, or sculpt corrective shapes that switch on at deep bends.</p>
          </div>}

          {tab === 'bind' && <div className="rg-panel" role="tabpanel" aria-label="Bind pose">
            <p className="rg-copy">Our models were rigged in an <b>A-pose</b>, arms out. Every clip in these labs is written as rotations from <b>arms down</b>. Here is {NAME[character]}’s wave played three ways.</p>
            <div className="rg-corrections" role="group" aria-label="Correction">
              {CORRECTIONS.map((c, i) => <button key={c.id} type="button" aria-pressed={correction === c.id} onClick={() => setCorrection(c.id)} data-testid={`correction-${c.id}`}>
                <span className="rg-eyebrow">{i + 1}</span><b>{c.label}</b><small>{c.text}</small>
              </button>)}
            </div>
            <div className="rg-row"><button type="button" onClick={() => { if (playing) setWaveU(shared.waveU); setPlaying((p) => !p); }}>{playing ? 'Pause' : '▶ Play'}</button>
              <input ref={(el) => { if (el) handles.set('scrub', el); else handles.delete('scrub'); }} className="rg-scrub" type="range" aria-label="Scrub the wave" min={0} max={1} step={0.001} defaultValue={waveU} onInput={(e) => { setPlaying(false); setWaveU(Number(e.currentTarget.value)); }} /></div>
            <div className="rg-row"><span className="rg-mono">rest offset L {signed(offL)} · R {signed(offR)}</span></div>
            <p className="rg-note">{correction === 'shipped' ? 'The green ghost is gone: this is the shipped result.' : 'The green ghost shows the shipped arms for comparison.'}</p>
          </div>}
        </aside>
      </div>

      <section className="rg-section" aria-labelledby="rg-fkik">
        <div className="rg-section-head"><h2 id="rg-fkik">FK or IK? Animators use both</h2><p>Same joints, two ways to drive them. Production rigs carry both on every limb.</p></div>
        <div className="rg-cards">{FK_IK.map((c) => <article key={c.title} className="rg-card" data-tone={c.tone}><h3>{c.title}</h3><ul>{c.items.map((i) => <li key={i}>{i}</li>)}</ul></article>)}</div>
      </section>

      <section className="rg-section" aria-labelledby="rg-fixes">
        <div className="rg-section-head"><h2 id="rg-fixes">Why our arm fixes mattered</h2><p>Two small numbers in the bone map separate a natural wave from a broken one.</p></div>
        <ol className="rg-steps">
          <li><span className="rg-eyebrow">01 · THE BIND POSE</span><b>The rigs came in an A-pose.</b><p>The models were bound with arms out: Bram’s about 27° and 30° from vertical, Pip’s about 35°. Clips assume arms hanging down, so played raw, every arm rotation starts from the wrong place.</p></li>
          <li><span className="rg-eyebrow">02 · THE REST OFFSET</span><b>Bring the arms down, but not all the way.</b><p>A fixed rotation is applied before any clip: Bram {signed(BRAM_BONES.upperArmL.offsetDeg?.[2])} / {signed(BRAM_BONES.upperArmR.offsetDeg?.[2])}, Pip {signed(PIP_BONES.upperArmL.offsetDeg?.[2])} / {signed(PIP_BONES.upperArmR.offsetDeg?.[2])}. Fully vertical arms sank into Pip’s flared raincoat, so his rest about 12° out. An earlier −38° / +41° on Bram folded his hands into his lap.</p></li>
          <li><span className="rg-eyebrow">03 · THE HINGE FRAME</span><b>Keep the elbow a hinge.</b><p>An offset on the shoulder tilts every joint below it. The forearm and hand rotations are re-expressed through the same offset, so “bend the elbow” bends it in the arm’s own plane instead of swinging it sideways.</p></li>
        </ol>
        <button type="button" className="rg-cta" onClick={() => { chooseTab('bind'); setCorrection('none'); toStage(); }}>Compare all three on the stage →</button>
      </section>

      <details className="rg-section rg-vocab">
        <summary><h2>Rigging vocabulary</h2></summary>
        <table><tbody>{VOCABULARY.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
      </details>

      <footer className="rg-footer">
        <p>Related: <Link href="/labs/character-acting">Character Acting</Link> · <Link href="/labs/animation-style">Animation Style</Link> · <Link href="/labs/timing-and-spacing">Timing &amp; Spacing</Link></p>
        <p>The same 24-joint skeleton drives Bram and Pip in every lab</p>
      </footer>
    </div>
  </main>;
}

function Switch({ label, value, onChange, disabled }: { label: string; value: Mode; onChange: (m: Mode) => void; disabled?: boolean }) {
  return <div className="rg-switch">
    <span className="rg-label">{label}</span>
    <div className="rg-seg" role="group" aria-label={label}>
      {(['fk', 'ik'] as const).map((m) => <button key={m} type="button" aria-pressed={value === m} disabled={disabled} onClick={() => onChange(m)}>{m.toUpperCase()}</button>)}
    </div>
  </div>;
}

function ExerciseCard({ exercise, index, started, checks, done, solved, onStart, onNext }: { exercise: Exercise; index: number; started: boolean; checks: Check[]; done: boolean; solved: string[]; onStart: (i: number) => void; onNext: () => void }) {
  return <section className={`rg-exercise ${done ? 'done' : ''}`} aria-labelledby="rg-exercise-title" data-testid="exercise">
    <div className="rg-ex-tabs" role="group" aria-label="Exercises">
      <span className="rg-eyebrow">TRY IT</span>
      {EXERCISES.map((ex, i) => <button key={ex.id} type="button" aria-pressed={started && i === index} aria-label={`Exercise ${i + 1}: ${ex.title}${solved.includes(ex.id) ? ' (solved)' : ''}`} className={solved.includes(ex.id) ? 'solved' : ''} onClick={() => onStart(i)}>{solved.includes(ex.id) ? '✓' : i + 1}</button>)}
    </div>
    <h2 id="rg-exercise-title">{exercise.title}</h2>
    <p className="rg-ex-goal">{exercise.goal}</p>
    {started ? <ul className="rg-checks" aria-live="polite">
      {checks.map((c) => <li key={c.label.replace(/[\d.]+/g, '#')} data-ok={c.ok}><span aria-hidden>{c.ok ? '✓' : '○'}</span>{c.label}<span className="sr-only">{c.ok ? ' (done)' : ' (not yet)'}</span></li>)}
    </ul> : <button type="button" className="rg-ex-start" onClick={() => onStart(index)}>Set up exercise {index + 1}</button>}
    {done && <div className="rg-insight" role="status"><p className="rg-eyebrow">SOLVED · WHY IT WORKS</p><p>{exercise.insight}</p><button type="button" onClick={onNext}>{index === EXERCISES.length - 1 ? 'Back to exercise 1' : 'Next exercise →'}</button></div>}
  </section>;
}
