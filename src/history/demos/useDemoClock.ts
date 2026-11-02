"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DURATION, FPS } from "../rig2d/pose";

/**
 * One shared playback clock for authored demonstrations: a looping 24 fps frame counter.
 * State updates only when the frame number changes, and only inside the demo that owns it.
 */
export function useDemoClock({ autoplay, startFrame = 0 }: { autoplay: boolean; startFrame?: number }) {
  const total = Math.round(DURATION * FPS);
  const [frame, setFrame] = useState(startFrame);
  const [playing, setPlaying] = useState(autoplay);
  const origin = useRef<{ wall: number; frame: number } | null>(null);
  const frameRef = useRef(startFrame);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    origin.current = { wall: performance.now(), frame: frameRef.current };
    const tick = (now: number) => {
      const o = origin.current!;
      const f = (o.frame + Math.floor(((now - o.wall) / 1000) * FPS)) % total;
      if (f !== frameRef.current) setFrame(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Pause when the tab is hidden.
    const vis = () => document.hidden && setPlaying(false);
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [playing, total]);

  const seek = useCallback((f: number) => setFrame(((Math.round(f) % total) + total) % total), [total]);
  const step = useCallback(
    (n: number) => {
      setPlaying(false);
      setFrame((f) => (((f + n) % total) + total) % total);
    },
    [total],
  );
  return { frame, t: frame / FPS, playing, setPlaying, seek, step, total };
}
