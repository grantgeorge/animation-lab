'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FACES, FEATURES, INTENTION, LINE, STAGINGS, TAKES, directionNote, face, readCombo, staging, take, type Distance, type FaceId, type Family, type Picks, type StagingId, type TakeId } from './direction';
import { EXERCISES, allOk, type Check, type Exercise } from './exercises';
import { bramClip, pipClip, REACTIONS } from './clips';
import { AUDIO, LIMITS, LISTEN_WINDOW, reactionVerdict, schedule, type Schedule } from './timing';
import { useLine } from './useLine';
import { VoiceStage } from './VoiceStage';
import './voice.css';

const START: Picks = { voice: 'neutral', face: 'neutral', staging: 'square', distance: 'near', pause: 0.3, rate: 1, reaction: 0.35, overlap: false };
const FAMILY: Record<Family, string> = { flat: 'neutral', joy: 'joy', irony: 'irony', fear: 'fear', anger: 'anger', sorrow: 'sadness' };
const KIND = { matched: 'Matched', subtext: 'Subtext', mixed: 'Mixed signals' } as const;
const FIT = { 1: 'backs it up', 0: 'neutral', '-1': 'undercuts it' } as const;
const s2 = (v: number) => `${v.toFixed(2)} s`;

export default function VoiceDirectionLab() {
  const [p, setP] = useState<Picks>(START);
  const [scrub, setScrub] = useState<number | null>(null);
  const [exIndex, setExIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [solved, setSolved] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const sched = useMemo(() => schedule(p.voice, p.pause, p.rate, p.reaction, p.overlap), [p.voice, p.pause, p.rate, p.reaction, p.overlap]);
  const reading = readCombo(p.voice, p.face, p.staging);
  const reaction = reading.kind === 'mixed' ? 'mixed' : reading.family;
  const st = staging(p.staging);
  const bram = useMemo(() => bramClip(p.voice, p.face, p.staging, sched, p.rate), [p.voice, p.face, p.staging, sched, p.rate]);
  const pip = useMemo(() => pipClip(reaction, sched), [reaction, sched]);
  const line = useLine(p.voice, sched, p.rate);
  /** At rest the stage shows the end of the shot, so the reaction is visible without playing. */
  const poster = Math.min(sched.total - 0.05, sched.reactionStart + 0.9);
  const t = line.now ?? scrub ?? poster;
  const phase = line.now === null && scrub === null ? 'rest' : t < sched.lineStart ? 'pause' : t < sched.lineEnd ? 'line' : t < sched.reactionStart ? 'beat' : 'reaction';
  const verdict = reactionVerdict(p.reaction, p.overlap);

  const exercise = EXERCISES[exIndex];
  const checks: Check[] = started ? exercise.checks(p) : [];
  const done = allOk(checks);
  if (done && !solved.includes(exercise.id)) setSolved((s) => [...s, exercise.id]);

  const set = (patch: Partial<Picks>) => { line.stop(); setScrub(null); setCopied(false); setP((q) => ({ ...q, ...patch })); };
  const start = (i: number) => { setExIndex(i); setStarted(true); set({ ...START, ...EXERCISES[i].setup }); };
  const note = directionNote(p);

  return <main className="vd-lab" data-testid="voice-direction-lab">
    <div className="vd-shell">
      <header className="vd-header"><Link href="/" className="vd-back">← Animation Lab</Link><span className="vd-eyebrow">AI ANIMATION · DIRECTING</span></header>
      <div className="vd-heading">
        <h1>Voice &amp; Performance Direction</h1>
        <p>One line, “{LINE}”, and three choices you make separately: the <b>voice</b> take, the <b>face</b>, and the <b>blocking</b>. When they agree the line means one thing; when they disagree you get subtext, or confusion. Timing is the fourth choice.</p>
        <nav className="vd-related" aria-label="Related labs"><Link href="/labs/character-acting">Character Acting →</Link><Link href="/labs/facial-animation">Lip Sync →</Link><Link href="/labs/staging-and-blocking">Blocking →</Link></nav>
      </div>

      <div className="vd-layout">
        <section className="vd-main" aria-label="Stage">
          <div className="vd-stage-wrap">
            <VoiceStage bram={bram} pip={pip} distance={p.distance} step={st.step} bramYaw={st.yaw} t={t} playing={line.playing}
              data={{ voice: p.voice, face: p.face, staging: p.staging, distance: p.distance, phase, read: reading.read, kind: reading.kind, reaction, playing: String(line.playing) }} />
            <div className="vd-transport">
              <button type="button" className="vd-play" onClick={() => (line.playing ? line.stop() : (setScrub(null), line.play()))} data-testid="play">{line.playing ? '■ Stop' : '▶ Play the line'}</button>
              <Timeline s={sched} voice={p.voice} rate={p.rate} t={t} onScrub={(v) => { line.stop(); setScrub(v); }} />
            </div>
            {line.blocked && <p className="vd-blocked">The browser blocked audio. The shot plays silently; click Play again to retry.</p>}
          </div>

          <section className="vd-read" data-testid="reading" data-kind={reading.kind} aria-live="polite">
            <div className="vd-read-head">
              <span className="vd-kind" data-kind={reading.kind}>{KIND[reading.kind]}</span>
              <p className="vd-eyebrow">Reads as</p>
            </div>
            <h2 data-testid="read-as">{reading.read}</h2>
            <p className="vd-why">{reading.why}</p>
            <ul className="vd-channels">
              <li><span className="vd-eyebrow">Voice</span><b>{take(p.voice).label}</b><small>{FAMILY[take(p.voice).family]}</small></li>
              <li><span className="vd-eyebrow">Face</span><b>{face(p.face).label}</b><small>{FAMILY[face(p.face).family]}</small></li>
              <li data-fit={reading.stagingFit}><span className="vd-eyebrow">Body</span><b>{st.label}</b><small>{FIT[reading.stagingFit]}</small></li>
              <li><span className="vd-eyebrow">Pip</span><b>{REACTIONS[reaction].label}</b><small data-testid="pip-verdict" data-verdict={verdict}>{verdict === 'listening' ? 'listening' : verdict === 'early' ? 'too early' : 'too late'}</small></li>
            </ul>
          </section>

          <ExerciseCard exercise={exercise} index={exIndex} started={started} checks={checks} done={done} solved={solved} onStart={start} onNext={() => start((exIndex + 1) % EXERCISES.length)} />
        </section>

        <aside className="vd-controls" aria-label="Direction controls">
          <Group title="Voice" note={take(p.voice).ear}>
            <div className="vd-picks" role="group" aria-label="Voice take">{TAKES.map((x) => <button key={x.id} type="button" aria-pressed={p.voice === x.id} onClick={() => set({ voice: x.id })} data-testid={`voice-${x.id}`}><b>{x.label}</b><small>{AUDIO[x.id].duration.toFixed(1)} s</small></button>)}</div>
          </Group>
          <Group title="Face" note={face(p.face).hint}>
            <div className="vd-picks" role="group" aria-label="Face">{FACES.map((x) => <button key={x.id} type="button" aria-pressed={p.face === x.id} onClick={() => set({ face: x.id as FaceId })} data-testid={`face-${x.id}`}><b>{x.label}</b></button>)}</div>
          </Group>
          <Group title="Body" note={st.hint}>
            <div className="vd-picks" role="group" aria-label="Staging">{STAGINGS.map((x) => <button key={x.id} type="button" aria-pressed={p.staging === x.id} onClick={() => set({ staging: x.id as StagingId })} data-testid={`staging-${x.id}`}><b>{x.label}</b></button>)}</div>
            <div className="vd-seg" role="group" aria-label="Distance">{(['near', 'far'] as Distance[]).map((d) => <button key={d} type="button" aria-pressed={p.distance === d} onClick={() => set({ distance: d })}>{d === 'near' ? 'Near · 1.2 m' : 'Far · 2.3 m'}</button>)}</div>
          </Group>
          <Group title="Timing">
            <Range label="Pause before the line" value={p.pause} min={LIMITS.pause[0]} max={LIMITS.pause[1]} step={0.05} out={s2(p.pause)} onChange={(v) => set({ pause: v })} />
            <Range label="Pace" value={p.rate} min={LIMITS.rate[0]} max={LIMITS.rate[1]} step={0.01} out={`${p.rate.toFixed(2)}×`} onChange={(v) => set({ rate: v })} hint="pitch kept" />
            <Range label="Pip reacts after" value={p.reaction} min={LIMITS.reaction[0]} max={LIMITS.reaction[1]} step={0.01} out={s2(p.reaction)} onChange={(v) => set({ reaction: v })} hint={p.overlap ? '“great” begins' : 'the line ends'} />
            <button type="button" className="vd-toggle" aria-pressed={p.overlap} onClick={() => set({ overlap: !p.overlap })} data-testid="overlap">Overlap: react as “great” lands</button>
            <p className="vd-small">Listening window: {(p.overlap ? LISTEN_WINDOW.overlap : LISTEN_WINDOW.after).map((v) => v.toFixed(2)).join('–')} s after {p.overlap ? '“great” begins' : 'the line ends'}.</p>
          </Group>
          <button type="button" className="vd-reset" onClick={() => { setStarted(false); set(START); }}>Reset</button>
        </aside>
      </div>

      <section className="vd-section">
        <div className="vd-section-head"><h2>Direct with verbs, not results</h2><p>“Be sarcastic” asks for a result. An actor, or an animator, plays an intention.</p></div>
        <div className="vd-verbs">
          <div className="vd-card"><p className="vd-eyebrow">Result direction</p><h3>“Be {INTENTION[reading.family].result.replace('be ', '')}.”</h3><p>Names the emotion you want the audience to feel. It invites indicating: pulling the face of the emotion instead of doing something.</p></div>
          <div className="vd-card vd-card-good"><p className="vd-eyebrow">Actable direction</p><h3>“Say it {INTENTION[reading.family].verb}.”</h3><p>An action aimed at the other character. The face and voice follow from trying to get something from Pip, so they agree without being matched by hand.</p></div>
          <div className="vd-output">
            <pre data-testid="direction">{note}</pre>
            <div><button type="button" onClick={() => { navigator.clipboard?.writeText(note).then(() => setCopied(true), () => setCopied(false)); }}>{copied ? 'Copied ✓' : 'Copy direction ↗'}</button>
              <p>For a voice actor, a TTS take or an animator. TTS voices follow stage directions loosely: generate several takes and pick by ear, as the six here were.</p></div>
          </div>
        </div>
      </section>

      <section className="vd-section">
        <div className="vd-section-head"><h2>The six deliveries, measured</h2><p>Same words, same voice actor model. What changes is pitch, loudness, pace and where the pauses fall.</p></div>
        <div className="vd-table-wrap"><table className="vd-table">
          <thead><tr><th>Take</th><th>Pitch</th><th>Melody</th><th>Loudness</th><th>Pace</th><th>Beat before “great”</th><th>What you hear</th><th /></tr></thead>
          <tbody>{TAKES.map((x) => { const f = FEATURES[x.id]; return <tr key={x.id} data-active={p.voice === x.id}>
            <td>{x.label}</td><td>{f.f0Median} Hz</td><td>{f.f0Range} Hz</td><td>{f.loudnessDb} dB</td><td>{f.wordsPerSecond} w/s</td><td>{s2(f.pauseBeforeGreat)}</td><td className="vd-ear">{x.ear}</td>
            <td><button type="button" onClick={() => set({ voice: x.id as TakeId })}>Use</button></td></tr>; })}</tbody>
        </table></div>
        <p className="vd-note">Pitch is the median fundamental; melody is the spread from the 5th to the 95th percentile; loudness is the 90th-percentile level in dBFS. Measured by script from the published files (scripts/acting-media/analyze-voices.mjs).</p>
      </section>

      <section className="vd-section">
        <div className="vd-section-head"><h2>How the channels combine</h2><p>Rules of thumb from acting and animation practice, the same ones the readout above uses.</p></div>
        <div className="vd-rules">
          {RULES.map(([h, b]) => <div key={h} className="vd-card"><h3>{h}</h3><p>{b}</p></div>)}
        </div>
      </section>

      <footer className="vd-footer"><span>Related: <Link href="/labs/character-acting">Character Acting</Link> · <Link href="/labs/facial-animation">Facial Animation &amp; Lip Sync</Link> · <Link href="/labs/staging-and-blocking">Staging &amp; Blocking</Link></span><span>Voice takes: ElevenLabs v4 via fal, shared with Character Acting · faces from the cast’s procedural face rig</span></footer>
    </div>
  </main>;
}

const RULES: [string, string][] = [
  ['Agreement reads as sincere', 'When voice, face and body point the same way, the words mean what they say. It is the default, and it is easy to read at a glance.'],
  ['A flat voice hands the meaning to the face', 'Deadpan: the voice gives nothing, so the audience reads the face. Dry sarcasm, suppressed anger and quiet worry all live here.'],
  ['A straight face hands it to the voice', 'A poker face makes the delivery do the work. Sarcastic timing under a still face is the classic deadpan joke.'],
  ['When they disagree, people believe the body', 'A bright voice over a crushed face reads as masking: we trust the face. The often quoted “7% words” figure is a misreading of a narrow study; the useful point is only that the channels must agree, or the disagreement becomes the story.'],
  ['Three stories is no story', 'If voice, face and blocking each say something different, the audience stops reading the character. Subtext needs one clear contradiction, not three.'],
  ['Timing is direction', 'A pause before the line reads as thinking or hesitation; a slower pace adds weight; the listener’s reaction delay tells us whether they heard it.'],
];

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <div className="vd-group"><p className="vd-eyebrow vd-group-title">{title}</p>{children}{note && <p className="vd-hint">{note}</p>}</div>;
}

function Range({ label, value, min, max, step, out, hint, onChange }: { label: string; value: number; min: number; max: number; step: number; out: string; hint?: string; onChange: (v: number) => void }) {
  return <label className="vd-range"><span className="vd-label">{label}{hint && <small>{hint}</small>}<output className="vd-mono">{out}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

/** The shot on one strip: pause, the take's loudness, the words, the moment the line lands and Pip's reaction. */
function Timeline({ s, voice, rate, t, onScrub }: { s: Schedule; voice: TakeId; rate: number; t: number; onScrub: (t: number) => void }) {
  const X = (v: number) => (v / s.total) * 1000;
  const env = AUDIO[voice].envelope;
  const bars = useMemo(() => {
    const out: [number, number][] = [];
    const n = Math.max(1, Math.round((s.audioEnd - s.lineStart) * 40));
    for (let i = 0; i < n; i++) {
      const at = s.lineStart + (i / n) * (s.audioEnd - s.lineStart);
      const k = Math.min(env.values.length - 1, Math.floor((at - s.lineStart) * rate * env.hz));
      out.push([at, env.values[k] ?? 0]);
    }
    return out;
  }, [s, env, rate]);
  return <div className="vd-timeline" data-testid="timeline">
    <svg viewBox="0 0 1000 64" preserveAspectRatio="none" aria-hidden>
      <rect x="0" y="22" width={X(s.lineStart)} height="26" className="vd-tl-pause" />
      {bars.map(([at, v], i) => <rect key={i} x={X(at)} y={35 - v * 12} width="3" height={Math.max(1, v * 24)} className="vd-tl-env" />)}
      {s.words.map((w) => <rect key={w.text + w.start} x={X(w.start)} y="50" width={Math.max(2, X(w.end) - X(w.start))} height="3" className={w.text.toLowerCase().startsWith('great') ? 'vd-tl-key' : 'vd-tl-word'} />)}
      <line x1={X(s.anchor)} x2={X(s.anchor)} y1="14" y2="58" className="vd-tl-anchor" />
      <rect x={X(s.reactionStart)} y="16" width={Math.max(3, X(s.reactionStart + 0.24) - X(s.reactionStart))} height="38" className="vd-tl-react" />
      <line x1={X(t)} x2={X(t)} y1="0" y2="64" className="vd-tl-head" />
    </svg>
    <div className="vd-tl-labels" aria-hidden>
      {s.lineStart > 0.25 && <span style={{ left: `${X(s.lineStart / 2) / 10}%` }}>pause</span>}
      {s.words.map((w) => <span key={w.text + w.start} className="vd-tl-w" style={{ left: `${X(w.start) / 10}%` }}>{w.text.replace(/[,.]/g, '')}</span>)}
      <span className="vd-tl-pip" style={{ left: `${X(s.reactionStart) / 10}%` }}>Pip</span>
    </div>
    <input type="range" aria-label="Playhead" min={0} max={s.total} step={0.01} value={Math.min(t, s.total)} onChange={(e) => onScrub(Number(e.target.value))} />
    <output className="vd-mono vd-tl-time" data-testid="time">{t.toFixed(2)} s</output>
  </div>;
}

function ExerciseCard({ exercise, index, started, checks, done, solved, onStart, onNext }: { exercise: Exercise; index: number; started: boolean; checks: Check[]; done: boolean; solved: string[]; onStart: (i: number) => void; onNext: () => void }) {
  return <section className={`vd-exercise ${done ? 'done' : ''}`} aria-labelledby="vd-exercise-title" data-testid="exercise" data-solved={done}>
    <div className="vd-ex-head">
      <p className="vd-eyebrow">Try it</p>
      <div className="vd-ex-steps" role="group" aria-label="Exercises">{EXERCISES.map((e, i) => <button key={e.id} type="button" aria-pressed={i === index} aria-label={`Exercise ${i + 1}: ${e.title}`} data-solved={solved.includes(e.id)} onClick={() => onStart(i)}>{solved.includes(e.id) ? '✓' : i + 1}</button>)}</div>
    </div>
    <h3 id="vd-exercise-title">{exercise.title}</h3>
    <p className="vd-ex-task">{exercise.task}</p>
    {!started ? <button type="button" className="vd-ex-start" onClick={() => onStart(index)}>Set up exercise {index + 1}</button> : <>
      <ul className="vd-checks">{checks.map((c) => <li key={c.label} data-ok={c.ok}>{c.ok ? '✓' : '○'} {c.label}</li>)}</ul>
      {done && <div className="vd-insight"><p className="vd-eyebrow">Solved · why it works</p><p>{exercise.insight}</p><button type="button" onClick={onNext}>Next exercise →</button></div>}
    </>}
  </section>;
}
