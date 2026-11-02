"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActorRig } from "../character-acting/ActorRig";
import { Segmented } from "@/ui/primitives";
import { buildPrompt, mouthTime, offsetLabel, PAD, sampleFace, TAKES, visemeAt, VISEME_LABELS, type Take, type TakeId } from "./engine";
import { useDialogue } from "./useDialogue";
import "./facial.css";

type Mode = "watch" | "inspect" | "experiment";
const READS: { id: TakeId; label: string }[] = [
  { id: "neutral", label: "Neutral" }, { id: "excited", label: "Excited" }, { id: "sarcastic", label: "Sarcastic" },
  { id: "nervous", label: "Nervous" }, { id: "frustrated", label: "Frustrated" }, { id: "disappointed", label: "Disappointed" },
];
const MODE_COPY: Record<Mode, string> = {
  watch: "Listen to the line. Does the face feel connected to the voice?",
  inspect: "Follow the sound, then the mouth shapes. A viseme is a visible speech shape; several sounds can share one.",
  experiment: "Shift only the mouth. The recording, brows and blinks keep their original timing.",
};

export default function FacialAnimationLab() {
  const [mode, setMode] = useState<Mode>("experiment");
  const [takeId, setTakeId] = useState<TakeId>("neutral");
  const [offset, setOffset] = useState(0);
  const [strength, setStrength] = useState(1);
  const [eyes, setEyes] = useState(true);
  const [compare, setCompare] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const take = TAKES[takeId];
  const audio = useDialogue(take);
  const frame = sampleFace(takeId, audio.t, offset, strength, eyes);
  const reference = sampleFace(takeId, audio.t, 0, strength, eyes);
  const viseme = visemeAt(take, mouthTime(audio.t, offset));
  const prompt = buildPrompt(takeId, offset, strength, eyes);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(e.target.tagName)))) return;
      if (e.code === "Space") { e.preventDefault(); if (audio.playing || audio.loading) audio.pause(); else void audio.play(); }
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") { e.preventDefault(); audio.seek(audio.t + (e.code === "ArrowLeft" ? -1 : 1) / 24); }
      if (e.code === "Home") { e.preventDefault(); audio.seek(0); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [audio]);

  const reset = () => {
    audio.seek(0); setOffset(0); setStrength(1); setEyes(true); setCompare(false); setTakeId("neutral"); audio.setRate(1); setCopyStatus("");
  };

  return (
    <main className="fa-lab" data-testid="facial-lab" data-offset={offset} data-time={audio.t.toFixed(3)} data-playing={audio.playing}>
      <div className="fa-shell">
        <header className="fa-header">
          <div className="fa-brand"><Link href="/">← Animation Lab</Link><span aria-hidden="true" /><h1>Facial Animation</h1></div>
          <p>Find the moment sound and expression connect.</p>
        </header>

        <div className="fa-toolbar">
          <Segmented label="Lab mode" value={mode} onChange={setMode} options={[{ value: "watch", label: "Watch" }, { value: "inspect", label: "Inspect" }, { value: "experiment", label: "Experiment" }]} />
          <label className="fa-compare"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with synced reference</label>
        </div>

        <div className={`fa-workspace ${mode === "watch" ? "fa-watch" : ""}`}>
          <section className="fa-main" aria-label="Dialogue performance">
            <div className={`fa-stages ${compare ? "fa-stages-compare" : ""}`}>
              {compare && <div className="fa-stage" data-testid="reference-stage"><ActorRig frame={reference} closeUp idPrefix="sync-ref" /><div className="fa-stage-label"><span className="fa-dot" />REFERENCE <b>In sync</b></div></div>}
              <div className="fa-stage" data-testid="mouth-stage" data-open={frame.mouth.open.toFixed(3)} data-viseme={viseme}>
                <ActorRig frame={frame} closeUp idPrefix="sync-edit" />
                <div className="fa-stage-label"><span className={`fa-dot ${offset ? "fa-dot-offset" : ""}`} />{compare ? "YOUR TAKE" : "BRAM · CLOSE-UP"}<b>{offsetLabel(offset)}</b></div>
                <div className="fa-caption" aria-label="Dialogue">
                  {take.words.map((word, i) => <span key={i} className={audio.t - PAD >= word.start && audio.t - PAD <= word.end ? "fa-word-active" : ""}>{word.text}</span>)}
                </div>
              </div>
            </div>

            <div className="fa-transport">
              <button className="fa-play" onClick={() => audio.playing || audio.loading ? audio.pause() : void audio.play()}>{audio.loading ? "Cancel" : audio.playing ? "Ⅱ Pause" : "▶ Play dialogue"}</button>
              <button onClick={() => audio.seek(0)} aria-label="Return to start" title="Return to start (Home)">↤</button>
              <button onClick={() => audio.seek(audio.t - 1 / 24)} aria-label="Previous frame">‹</button>
              <button onClick={() => audio.seek(audio.t + 1 / 24)} aria-label="Next frame">›</button>
              <label className="fa-speed"><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={audio.rate} onChange={(e) => audio.setRate(Number(e.target.value))}><option value={1}>1× speed</option><option value={0.5}>½ speed</option></select></label>
              <button className="fa-mute" aria-pressed={audio.muted} onClick={audio.toggleMute}>{audio.muted ? "Unmute" : "Mute"}</button>
              <span className="fa-time">{audio.t.toFixed(2)} <span>/ {audio.duration.toFixed(2)} s</span></span>
            </div>
            <label className="fa-scrub"><span className="sr-only">Dialogue playhead</span><input aria-label="Dialogue playhead" type="range" min={0} max={audio.duration} step={0.001} value={audio.t} onChange={(e) => audio.seek(Number(e.target.value))} aria-valuetext={`${audio.t.toFixed(2)} seconds`} /></label>
            {audio.error && <p className="fa-error" role="alert">{audio.error}</p>}

            <p className="fa-mode-copy">{MODE_COPY[mode]}</p>
            {mode === "inspect" && <Timeline take={take} t={audio.t} offset={offset} duration={audio.duration} onSeek={audio.seek} detailed />}
            {mode === "experiment" && <details className="fa-details fa-timing-details"><summary>Sound &amp; mouth timeline <small>See what shifts</small></summary><Timeline take={take} t={audio.t} offset={offset} duration={audio.duration} onSeek={audio.seek} detailed={false} /></details>}
            <div className="fa-reading" data-testid="sync-reading"><span className="fa-kicker">READ THE PERFORMANCE</span><h2>{offset === 0 ? "The sound and the shape land together." : offset < 0 ? "The face gets ahead of the voice." : "The voice arrives before the face."}</h2><p>{offset === 0 ? "This is the authored timing. Watch how the lips round for “Oh” and widen into “great”." : offset < 0 ? `The mouth leads by ${Math.abs(offset)} ms. Watch a shape arrive while the previous sound is still playing.` : `The mouth trails by ${offset} ms. Listen for a sound before its matching shape appears.`} {eyes ? "Brows and blinks still carry the thought behind the words." : "With the upper face held still, notice how much the mouth has to carry."}</p></div>
          </section>

          {mode !== "watch" && <aside className="fa-controls" aria-label="Experiment controls">
            <div className="fa-panel-heading"><div><p className="fa-kicker">LIP SYNC</p><h2>Shape the performance</h2></div><button onClick={reset}>Reset</button></div>
            <label className="fa-field"><span className="fa-kicker">RECORDED DELIVERY</span><select aria-label="Recorded delivery" value={takeId} onChange={(e) => { audio.seek(0); setTakeId(e.target.value as TakeId); }}>{READS.map((read) => <option key={read.id} value={read.id}>{read.label}</option>)}</select></label>
            <div className="fa-control-block">
              <div className="fa-control-title"><label htmlFor="mouth-offset">Mouth timing</label><output htmlFor="mouth-offset" className={offset ? "fa-amber" : "fa-green"}>{offsetLabel(offset)}</output></div>
              <input id="mouth-offset" aria-label="Mouth timing" type="range" min={-300} max={300} step={10} value={offset} onChange={(e) => setOffset(Number(e.target.value))} aria-valuetext={offsetLabel(offset)} />
              <div className="fa-range-labels"><span>−300 ms · Early</span><span>Late · +300 ms</span></div>
              <div className="fa-presets">{[-300, -150, 0, 150, 300].map((ms) => <button key={ms} aria-pressed={offset === ms} onClick={() => setOffset(ms)}>{ms === 0 ? "In sync" : `${ms > 0 ? "+" : ""}${ms}`}</button>)}</div>
              <p>Positive values delay the lips. Try +300 ms, then return to In sync.</p>
            </div>
            <div className="fa-control-block">
              <div className="fa-control-title"><label htmlFor="articulation">Articulation</label><output htmlFor="articulation">{strength.toFixed(2)}×</output></div>
              <input id="articulation" aria-label="Articulation" type="range" min={0.4} max={1.4} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} />
              <div className="fa-range-labels"><span>Restrained</span><span>Broad</span></div>
              <p>Scale the mouth shapes without moving their timing.</p>
            </div>
            <label className="fa-eyes"><input type="checkbox" checked={eyes} onChange={(e) => setEyes(e.target.checked)} /><span>Eye acting <small>Authored brows, gaze and blinks</small></span></label>
            <details className="fa-details fa-source-details"><summary>Mouth shape &amp; source</summary><div className="fa-current"><span className="fa-kicker">CURRENT MOUTH SHAPE</span><div><b>{viseme === "rest" ? "—" : viseme}</b><span>{VISEME_LABELS[viseme]}<small>{Math.round(frame.mouth.open * 100)}% opening</small></span></div></div><p className="fa-source">Same recorded takes as Character Acting. Mouth cues are authored approximations, blended over 50 ms; this is a timing study.</p></details>
          </aside>}
        </div>

        <details className="fa-details fa-secondary"><summary>Guided experiments <small>Three ways to read the face</small></summary><section className="fa-lessons" aria-label="Try these experiments">
          {[
            { n: "01", title: "Break the sync", body: "Delay the mouth by 300 ms. Play the line, then switch back to hear the connection return.", action: "Try late lips", run: () => { setMode("experiment"); setOffset(300); setCompare(true); } },
            { n: "02", title: "Read between the words", body: "Hold the upper face still on the sarcastic read. Can the mouth alone carry the same meaning?", action: "Isolate the mouth", run: () => { audio.seek(0); setTakeId("sarcastic"); setMode("experiment"); setOffset(0); setEyes(false); } },
            { n: "03", title: "See the shapes", body: "Inspect the round, open and wide shapes. Scrub slowly: speech flows between poses instead of snapping.", action: "Inspect the timing", run: () => { setMode("inspect"); audio.seek(PAD + 0.25); } },
          ].map((lesson) => <article key={lesson.n}><span className="fa-kicker">EXPERIMENT {lesson.n}</span><h3>{lesson.title}</h3><p>{lesson.body}</p><button onClick={lesson.run}>{lesson.action} <span>↗</span></button></article>)}
        </section></details>

        <section className="fa-prompt" aria-label="Direction for AI video"><div><span className="fa-kicker">YOUR DIRECTION</span><p data-testid="facial-prompt">{prompt}</p></div><div><button onClick={async () => { try { await navigator.clipboard.writeText(prompt); setCopyStatus("Copied"); } catch { setCopyStatus("Copy unavailable. Select the direction text to copy it."); } }}>Copy direction ↗</button><p role="status">{copyStatus}</p></div></section>
        <footer className="fa-footer"><span>Space · play / pause &nbsp; ← → · step at 24 fps &nbsp; Home · restart</span><Link href="/labs/character-acting">Explore Character Acting →</Link><span>Playback starts only when you press Play.</span></footer>
      </div>
    </main>
  );
}

function Timeline({ take, t, offset, duration, onSeek, detailed }: { take: Take; t: number; offset: number; duration: number; onSeek: (t: number) => void; detailed: boolean }) {
  const x = (s: number) => ((s + PAD) / duration) * 1000;
  return <section className="fa-timeline" aria-label="Audio and mouth timeline">
    <div className="fa-timeline-heading"><span className="fa-kicker">{detailed ? "INSPECT · AUDIO → VISEMES" : "SOUND & SHAPE"}</span><span><i className="fa-legend-audio" />Audio <i className="fa-legend-mouth" />Mouth</span></div>
    <svg viewBox="0 0 1000 146" role="img" aria-label="Recorded audio envelope above the mouth cues. Amber cues shift with the mouth timing control." preserveAspectRatio="none">
      <defs><clipPath id="fa-timeline-clip"><rect width="1000" height="146" /></clipPath></defs>
      <g clipPath="url(#fa-timeline-clip)">
        {Array.from({ length: Math.ceil(duration * 2) }, (_, i) => <g key={i}><line x1={i * 500 / duration} x2={i * 500 / duration} y1={0} y2={130} stroke="#29313a" /><text x={i * 500 / duration + 5} y={142} fill="#89939d" fontSize="11">{(i / 2).toFixed(1)}s</text></g>)}
        <line x1={0} x2={1000} y1={42} y2={42} stroke="#38565b" />
        {take.envelope.values.map((v, i) => <line key={i} x1={x(i / take.envelope.hz)} x2={x(i / take.envelope.hz)} y1={42 - v * 31} y2={42 + v * 31} stroke="#88ccc8" strokeWidth="3" />)}
        {take.visemes.map((cue, i) => {
          const start = x(cue.t + offset / 1000);
          const end = x((take.visemes[i + 1]?.t ?? take.duration) + offset / 1000);
          return cue.v !== "rest" && end > start ? <g key={i}><rect x={start} y={88} width={Math.max(1, end - start - 1)} height={30} rx={3} fill="#b88c58" opacity={mouthTime(t, offset) >= cue.t && mouthTime(t, offset) < (take.visemes[i + 1]?.t ?? take.duration) ? 1 : 0.45} />{end - start > 18 && <text x={(start + end) / 2} y={108} textAnchor="middle" fontSize="12" fill="#fff1dc">{cue.v}</text>}</g> : null;
        })}
        <line x1={t / duration * 1000} x2={t / duration * 1000} y1={0} y2={125} stroke="#f4eedf" strokeWidth="2" />
        <path d={`M${t / duration * 1000 - 5},0 h10 l-5,7 Z`} fill="#f4eedf" />
      </g>
    </svg>
    <input className="fa-timeline-input" type="range" min={0} max={duration} step={0.001} value={t} onChange={(e) => onSeek(Number(e.target.value))} aria-label="Inspect timeline playhead" />
    {detailed && <div className="fa-viseme-key">{Object.entries(VISEME_LABELS).filter(([key]) => take.visemes.some((v) => v.v === key)).map(([key, value]) => <span key={key}><b>{key === "rest" ? "—" : key}</b> {value}</span>)}</div>}
  </section>;
}
