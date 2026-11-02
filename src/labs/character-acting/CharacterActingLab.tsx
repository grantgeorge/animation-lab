"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import "./acting.css";
import { Segmented } from "@/ui/primitives";
import { ActorRig } from "./ActorRig";
import { AiTakes } from "./AiTakes";
import { EMOTION_META, EYE_LABELS, LINE } from "./content";
import { blinkAt, EMOTIONS, envelopeAt, LEAD_IN, mouthAt, PERFORMANCES, samplePose, totalDuration, type Direction, type Emotion, type EyeTarget, type Word } from "./performance";
import data from "./takes.json";

type Take = { url: string; duration: number; words: Word[]; visemes: { t: number; v: string }[]; envelope: { hz: number; values: number[] }; transcript: string; provenance: Record<string, string | number> };
const TAKES = data.takes as unknown as Record<Emotion, Take>;
type Voice = Emotion | "none";

function subscribeRM(cb: () => void) {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useReducedMotion = () => useSyncExternalStore(subscribeRM, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);

interface Shot {
  direction: Direction;
  voice: Voice;
  label?: string;
}

/** Performance clock. While a voice plays, time follows the audio element so lip sync can't drift. */
function usePerformance(shot: Shot, onEnded: () => void) {
  const anchorWords = TAKES[shot.voice === "none" ? shot.direction.emotion : shot.voice].words;
  const total = totalDuration(anchorWords);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const tRef = useRef(0);
  const endRef = useRef(onEnded);
  useEffect(() => {
    endRef.current = onEnded;
  });

  useEffect(() => {
    audio.current?.pause();
    audio.current = shot.voice === "none" ? null : new Audio(TAKES[shot.voice].url);
    audio.current?.load();
    return () => audio.current?.pause();
  }, [shot.voice]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const startWall = performance.now() - tRef.current * 1000;
    let audioStarted = false;
    const tick = (now: number) => {
      const a = audio.current;
      let tt = (now - startWall) / 1000;
      if (a && tt >= LEAD_IN && !audioStarted) {
        audioStarted = true;
        a.currentTime = Math.max(0, tt - LEAD_IN);
        void a.play().catch(() => {});
      }
      if (a && audioStarted && !a.paused && !a.ended) tt = LEAD_IN + a.currentTime;
      tRef.current = Math.min(tt, total);
      setT(tRef.current);
      if (tt >= total) {
        setPlaying(false);
        endRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.current?.pause();
    };
  }, [playing, total]);

  const seek = useCallback((v: number) => {
    tRef.current = v;
    setT(v);
  }, []);
  const play = useCallback(() => {
    if (tRef.current >= total - 0.01) seek(0);
    setPlaying(true);
  }, [total, seek]);
  return { t, total, playing, play, pause: () => setPlaying(false), seek, anchorWords };
}

export default function CharacterActingLab() {
  const reducedMotion = useReducedMotion();
  const [direction, setDirection] = useState<Direction>({ emotion: "neutral", exaggeration: 1, gesture: 1, eyes: "partner" });
  const [voice, setVoice] = useState<Voice>("neutral");
  const [linked, setLinked] = useState(true);
  const [queue, setQueue] = useState<Shot[] | null>(null);
  const [qi, setQi] = useState(0);
  const shot: Shot = useMemo(() => (queue ? queue[qi] : { direction, voice }), [queue, qi, direction, voice]);
  const advance = useRef<() => void>(() => {});
  const perf = usePerformance(shot, () => advance.current());

  useEffect(() => {
    advance.current = () => {
      if (!queue) return;
      if (qi < queue.length - 1) {
        setQi(qi + 1);
        perf.seek(0);
        setTimeout(() => perf.play(), 350);
      } else {
        setQueue(null);
        setQi(0);
      }
    };
  });

  const setEmotion = (e: Emotion) => {
    setQueue(null);
    setDirection((d) => ({ ...d, emotion: e }));
    if (linked) setVoice(e);
    perf.seek(0);
  };
  const runSequence = (shots: Shot[]) => {
    setQueue(shots);
    setQi(0);
    perf.seek(0);
    setTimeout(() => perf.play(), 50);
  };

  const t = perf.t;
  const frame = useMemo(() => {
    const d = shot.direction;
    const pose = samplePose(d, perf.anchorWords, t);
    const speaking = shot.voice !== "none";
    const take = TAKES[shot.voice === "none" ? d.emotion : shot.voice];
    const s = t - LEAD_IN;
    const m = speaking ? mouthAt(take.visemes, s) : { open: 0, wide: 0, round: 0 };
    const env = speaking ? envelopeAt(take.envelope, s) : 0;
    const mouth = { ...m, open: m.open * (0.55 + 0.6 * Math.min(1, env * 1.4)) * Math.min(1.4, 0.6 + d.exaggeration * 0.4) };
    return { pose, blink: blinkAt(d.emotion, perf.anchorWords, t), mouth, breathe: t / 3.2, t };
  }, [shot, t, perf.anchorWords]);

  const spokenIdx = shot.voice === "none" ? -1 : TAKES[shot.voice].words.findIndex((w) => t - LEAD_IN >= w.start && t - LEAD_IN <= w.end + 0.08);
  const meta = EMOTION_META[shot.direction.emotion];
  const mismatch = shot.voice !== "none" && shot.voice !== shot.direction.emotion;

  return (
    <main className="ca-lab" data-testid="lab-root" data-lab="character-acting">
      <div className="ca-shell">
        <header className="ca-header">
          <div className="ca-brand"><Link href="/">← Animation Lab</Link><span aria-hidden="true" /><h1>Character Acting</h1></div>
          <p>One line. Six intentions.</p>
        </header>

        <div className="ca-workspace">
          <section className="ca-main" aria-label="Stage">
            <div className="ca-stage-heading"><span className="ca-eyebrow">The performance</span><span>“{LINE}”</span></div>
            <div className="ca-stage" data-testid="acting-stage" data-emotion={shot.direction.emotion} data-voice={shot.voice}>
              <ActorRig frame={frame} />
              <div className="ca-caption" aria-hidden>
                {(shot.voice === "none" ? TAKES[shot.direction.emotion] : TAKES[shot.voice]).words.map((w, i) => <span key={i} className={i === spokenIdx ? "ca-word-active" : ""}>{w.text}</span>)}
              </div>
              <div className="ca-stage-labels">
                <span>Body · {meta.label}</span>
                <span className={mismatch ? "ca-mismatch" : ""}>Voice · {shot.voice === "none" ? "Silent" : EMOTION_META[shot.voice].label}</span>
                {queue && <span className="ca-queue">{qi + 1}/{queue.length}</span>}
              </div>
            </div>
            <div className="ca-transport">
              <button type="button" className="ca-play" onClick={() => (perf.playing ? perf.pause() : perf.play())} data-testid="perform">{perf.playing ? "Ⅱ Pause" : "▶ Perform"}</button>
              <button type="button" aria-label="Restart performance" onClick={() => { perf.pause(); perf.seek(0); }}>↤</button>
              <input type="range" min={0} max={perf.total} step="any" value={t} onChange={(e) => { perf.pause(); perf.seek(Number(e.target.value)); }} aria-label="Scrub the performance" aria-valuetext={`${t.toFixed(2)} seconds`} data-testid="perf-scrub" />
              <span>{t.toFixed(2)} <small>/ {perf.total.toFixed(2)} s</small></span>
            </div>
            <div className="ca-study" data-testid="acting-note">
              <div><span className="ca-eyebrow">Read the performance</span><h2>{meta.label}</h2></div>
              <p>{PERFORMANCES[shot.direction.emotion].note}{mismatch && <span className="ca-mismatch"> The voice says {EMOTION_META[shot.voice as Emotion].label.toLowerCase()} while the body says {meta.label.toLowerCase()}: notice which one you believe.</span>}</p>
            </div>
            <div className="ca-try"><span className="ca-eyebrow">Try this</span><p>Choose Sarcastic, then give him an Excited voice. Watch the same words change meaning.</p><button onClick={() => { setQueue(null); setDirection((d) => ({ ...d, emotion: "sarcastic" })); setVoice("excited"); setLinked(false); perf.pause(); perf.seek(0); }}>Try the contrast ↗</button></div>
            {reducedMotion && <p className="ca-note">Reduced motion is on. Press Perform or scrub to explore each pose.</p>}
            <section className="ca-comparisons" aria-label="Comparisons">
              <CompareCard title="Same voice, different body" body={`Keep the ${voice === "none" ? "neutral" : EMOTION_META[voice].label.toLowerCase()} voice. Compare all six intentions.`} onRun={() => runSequence(EMOTIONS.map((e) => ({ direction: { ...direction, emotion: e }, voice: voice === "none" ? "neutral" : voice })))} testId="compare-voice" />
              <CompareCard title="Same body, different voices" body={`Keep the ${EMOTION_META[direction.emotion].label.toLowerCase()} body. Hear how each delivery changes it.`} onRun={() => runSequence(EMOTIONS.map((e) => ({ direction, voice: e })))} testId="compare-body" />
            </section>
          </section>

          <aside className="ca-inspector" aria-label="Direct the actor" data-testid="director">
            <div className="ca-panel-heading"><div><span className="ca-eyebrow">Performance</span><h2>Direct the actor</h2></div><button onClick={() => { perf.pause(); perf.seek(0); setQueue(null); setDirection({ emotion: "neutral", exaggeration: 1, gesture: 1, eyes: "partner" }); setVoice("neutral"); setLinked(true); }}>Reset</button></div>
            <fieldset className="ca-control"><legend className="ca-eyebrow">Intention</legend><div className="ca-emotions" role="radiogroup" aria-label="Emotion">
              {EMOTIONS.map((e) => <button key={e} type="button" role="radio" aria-checked={direction.emotion === e} onClick={() => setEmotion(e)} data-testid={`emotion-${e}`}>{EMOTION_META[e].label}</button>)}
            </div></fieldset>
            <div className="ca-control ca-sliders">
              <Slider label="Expression" left="Subtle" right="Broad" min={0.4} max={1.6} value={direction.exaggeration} onChange={(v) => setDirection((d) => ({ ...d, exaggeration: v }))} testId="exaggeration" />
              <Slider label="Gesture" left="Restrained" right="Theatrical" min={0.3} max={1.6} value={direction.gesture} onChange={(v) => setDirection((d) => ({ ...d, gesture: v }))} testId="gesture" />
            </div>
            <div className="ca-control"><p className="ca-eyebrow">Eye direction</p><Segmented label="Eye direction" value={direction.eyes} onChange={(v: EyeTarget) => setDirection((d) => ({ ...d, eyes: v }))} options={(Object.keys(EYE_LABELS) as EyeTarget[]).map((k) => ({ value: k, label: EYE_LABELS[k], testId: `eyes-${k}` }))} /></div>
            <div className="ca-control"><div className="ca-voice-heading"><p className="ca-eyebrow">Voice</p><label><input type="checkbox" checked={linked} onChange={(e) => { setLinked(e.target.checked); if (e.target.checked) setVoice(direction.emotion); }} data-testid="voice-linked" />Match intention</label></div>
              <select value={voice} onChange={(e) => { setLinked(false); setQueue(null); setVoice(e.target.value as Voice); perf.seek(0); }} aria-label="Voice performance" data-testid="voice-select">
                {EMOTIONS.map((e) => <option key={e} value={e}>{EMOTION_META[e].label} read</option>)}<option value="none">Silent · body only</option>
              </select>
              <p className="ca-note">Unlink the voice to explore subtext.</p>
            </div>
            <details className="ca-details ca-source"><summary>About the performance</summary><div><p>An authored 2D performance paired with recorded dialogue. The body retimes to the selected voice.</p>{voice !== "none" && <p>ElevenLabs v4 · “{TAKES[voice].provenance.voice}” · {TAKES[voice].duration.toFixed(2)} s. Selected for {TAKES[voice].provenance.chosenBecause}</p>}</div></details>
          </aside>
        </div>

        <details className="ca-details ca-secondary"><summary><span>Acting principles</span><small>Thought, gaze and subtext</small></summary><section className="ca-principles" aria-label="Acting principles">
          {[["Thought before action", "A breath or glance before the words tells us he is thinking."], ["Eyes lead", "Looking at Pip makes a conversation. Looking at us makes an aside."], ["Subtext is contrast", "The body can disagree with the words. Watch which one you believe."]].map(([h, b]) => <article key={h}><h3>{h}</h3><p>{b}</p></article>)}
        </section></details>
        <details className="ca-details ca-secondary" data-testid="generated-performance"><summary><span>Directing a generated performance</span><small>Compare four kinds of direction</small></summary><AiTakes /></details>
        <footer className="ca-footer"><span>Choose an intention, press Perform, then change one thing.</span><Link href="/labs/facial-animation">Explore Facial Animation →</Link></footer>
      </div>
    </main>
  );
}

function Slider({ label, left, right, min, max, value, onChange, testId }: { label: string; left: string; right: string; min: number; max: number; value: number; onChange: (v: number) => void; testId: string }) {
  return <label className="ca-slider"><span>{label}<output>{value.toFixed(2)}×</output></span><input type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} aria-valuetext={`${Math.round(((value - min) / (max - min)) * 100)}% toward ${right}`} data-testid={testId} /><small><span>{left}</span><span>{right}</span></small></label>;
}

function CompareCard({ title, body, onRun, testId }: { title: string; body: string; onRun: () => void; testId: string }) {
  return <article><h2>{title}</h2><p>{body}</p><button type="button" onClick={onRun} data-testid={testId}>▶ Compare all six</button></article>;
}
