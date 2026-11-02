'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './storytelling.css';
export function Shell({ title, number, subtitle, children, source }: {
  title: string; number: string; subtitle: string; children: ReactNode;
  source: { url: string; label: string };
}) {
  const guide = useRef<HTMLDialogElement>(null);
  const tips: Record<string, string[]> = {
    '08': ['Choose a blocking arrangement, then move one actor at a time.', 'Check the silhouettes through the camera. A clear floor plan can still hide a performance.', 'Play the gesture and watch the hands. Use the guided experiments below for a starting point.'],
    '09': ['Choose an edit, then play the sequence to see what the audience learns first.', 'Select a panel in the filmstrip. Change its duration or move it earlier or later.', 'Compare the same drawings in a new order. Watch the pause before and after the reveal.'],
    '10': ['Select a story beat in the color strip, then change its palette.', 'Compare against the reference without changing the composition.', 'Check the sequence in grayscale. Light and dark should support the turning point as well as hue.'],
  };
  return <main className="st-lab" data-lab={number}><div className="st-shell">
    <header className="st-header">
      <Link className="st-home" href="/"><span aria-hidden>←</span><span>Animation Lab</span></Link>
      <i aria-hidden /><h1>{title}</h1>
      <button className="st-help" onClick={() => guide.current?.showModal()}>Field guide <span aria-hidden>?</span></button>
    </header>
    <div className="st-intro"><p>{subtitle}</p><span>THE LANTERN · STUDY {number}</span></div>
    {children}
    <footer><p>Further reading: <a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></p><nav aria-label="Related storytelling labs"><Link href="/labs/staging-and-blocking">Blocking</Link><Link href="/labs/storyboards-animatics">Animatics</Link><Link href="/labs/color-scripting">Color scripting</Link></nav><p>Original illustrated study · Bram & Pip</p></footer>
    <dialog ref={guide} className="st-guide" aria-labelledby={`st-guide-${number}`} onClick={event => { if (event.target === event.currentTarget) guide.current?.close(); }}>
      <div className="st-guide-heading"><div><p className="st-eyebrow">FIELD GUIDE</p><h2 id={`st-guide-${number}`}>{title}</h2></div><button aria-label="Close field guide" onClick={() => guide.current?.close()}>×</button></div>
      <p>{subtitle}</p><ol>{tips[number]?.map(tip => <li key={tip}>{tip}</li>)}</ol>
      <p className="st-guide-tip">Use Tab to move between controls and the arrow keys to adjust sliders. Escape closes this guide.</p>
      <a href={source.url} target="_blank" rel="noreferrer">Read more: {source.label} ↗</a>
    </dialog>
  </div></main>;
}
export function Range({label,value,min,max,step=1,onChange,unit=''}:{label:string;value:number;min:number;max:number;step?:number;onChange:(v:number)=>void;unit?:string}){return <label className="st-range"><span>{label}<output>{value.toFixed(step<1?1:0)}{unit}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
export function Choices({label,value,items,onChange}:{label:string;value:string;items:string[];onChange:(s:string)=>void}){return <div className="st-choices" role="group" aria-label={label}>{items.map(s=><button key={s} aria-pressed={s===value} onClick={()=>onChange(s)}>{s}</button>)}</div>}
export function Prompt({text}:{text:string}){const [copied,setCopied]=useState('');const [error,setError]=useState(false);return <section className="st-prompt"><div><p className="st-eyebrow">DIRECT IT IN WORDS</p><p data-testid="direction">{text}</p></div><div><button onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(text);setError(false)}catch{setError(true)}}}>Copy direction ↗</button><small role="status">{error?'Select the text to copy it.':copied===text?'Copied':''}</small></div></section>}
export function Lesson({steps}:{steps:{title:string;text:string;action:()=>void;check:string}[]}){const [active,setActive]=useState(0);const [reveal,setReveal]=useState(false);const step=steps[active];return <section className="st-lesson"><div><p className="st-eyebrow">GUIDED EXPERIMENT / {active+1} OF {steps.length}</p><h2>{step.title}</h2><p>{step.text}</p>{reveal&&<p className="st-observation">{step.check}</p>}</div><div className="st-lesson-actions"><button onClick={()=>{step.action();setReveal(false);document.querySelector('.st-workspace')?.scrollIntoView({block:'start'})}}>Set up experiment ↗</button><button onClick={()=>setReveal(!reveal)}>{reveal?'Hide observation':'What should I notice?'}</button><button onClick={()=>{setActive((active+1)%steps.length);setReveal(false)}}>Next lesson →</button></div></section>}
export function usePlayback(duration:number){const [t,setT]=useState(0);const [playing,setPlaying]=useState(false);const position=useRef(0);useEffect(()=>{if(!playing)return;let raf=0;let last=performance.now();const tick=(now:number)=>{position.current=Math.min(duration,position.current+(now-last)/1000);last=now;setT(position.current);if(position.current>=duration)setPlaying(false);else raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[duration,playing]);useEffect(()=>{const hide=()=>{if(document.hidden)setPlaying(false)};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide)},[]);return {t,playing,seek:(v:number)=>{setPlaying(false);position.current=Math.max(0,Math.min(duration,v));setT(position.current)},toggle:()=>{if(position.current>=duration){position.current=0;setT(0)}setPlaying(!playing)}}}
export function Transport({duration,playback}:{duration:number;playback:ReturnType<typeof usePlayback>}){return <div className="st-transport"><button onClick={playback.toggle}>{playback.playing?'Pause':'▶ Play'}</button><button aria-label="Restart" onClick={()=>playback.seek(0)}>↤</button><input aria-label="Playhead" type="range" min={0} max={duration} step={.01} value={playback.t} onChange={e=>playback.seek(Number(e.target.value))}/><span>{playback.t.toFixed(1)} / {duration.toFixed(1)}s</span></div>}
