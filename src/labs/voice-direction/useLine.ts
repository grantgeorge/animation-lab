'use client';
import { useEffect, useRef, useState } from 'react';
import type { TakeId } from './direction';
import { AUDIO, type Schedule } from './timing';

/**
 * Plays the shot once: a clock for the stage plus the take's audio at the scheduled start. Audio is
 * only ever started from a click (Play), so browsers allow it. If they refuse, the shot still plays
 * silently and `blocked` says so. Pace uses playbackRate with pitch preserved.
 */
export function useLine(voice: TakeId, s: Schedule, rate: number) {
  const [now, setNow] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const audios = useRef(new Map<TakeId, HTMLAudioElement>());
  const run = useRef<{ raf: number; timer: number; start: number } | null>(null);

  const audio = (id: TakeId) => {
    let a = audios.current.get(id);
    if (!a) { a = new Audio(AUDIO[id].url); a.preload = 'auto'; audios.current.set(id, a); }
    return a;
  };

  const stop = () => {
    const r = run.current;
    if (r) { cancelAnimationFrame(r.raf); clearTimeout(r.timer); run.current = null; }
    for (const a of audios.current.values()) a.pause();
    setNow(null);
  };

  const play = () => {
    stop();
    const a = audio(voice);
    a.currentTime = 0; a.playbackRate = rate; a.preservesPitch = true;
    const start = performance.now();
    const go = () => { a.muted = false; a.currentTime = 0; a.play().then(() => setBlocked(false), () => setBlocked(true)); };
    let timer = 0;
    if (s.lineStart < 0.02) go();
    else {
      // Unlock the element inside the click, silently, then start it on the beat.
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; }, () => setBlocked(true));
      timer = window.setTimeout(go, s.lineStart * 1000);
    }
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= s.total) { stop(); return; }
      setNow(t);
      run.current!.raf = requestAnimationFrame(tick);
    };
    run.current = { raf: requestAnimationFrame(tick), timer, start };
    setNow(0);
  };

  // Stop on unmount.
  useEffect(() => () => {
    const r = run.current;
    if (r) { cancelAnimationFrame(r.raf); clearTimeout(r.timer); }
    for (const a of audios.current.values()) a.pause();
  }, []);

  return { now, playing: now !== null, play, stop, blocked };
}
