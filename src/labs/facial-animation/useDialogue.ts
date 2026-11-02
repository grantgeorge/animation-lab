"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAD, type Take } from "./engine";

/** One audio clock drives both drawings, including silent handles for early / late mouth cues. */
export function useDialogue(take: Take) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const position = useRef(0);
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const gain = useRef<GainNode | null>(null);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const raf = useRef(0);
  const generation = useRef(0);
  const duration = take.duration + PAD * 2;

  const stop = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(raf.current);
    source.current?.stop();
    source.current?.disconnect();
    source.current = null;
  }, []);

  const pause = useCallback(() => {
    stop();
    setPlaying(false);
    setLoading(false);
  }, [stop]);

  const seek = useCallback((value: number) => {
    pause();
    position.current = Math.max(0, Math.min(duration, value));
    setT(position.current);
  }, [duration, pause]);

  const play = useCallback(async () => {
    pause();
    const token = generation.current;
    setError("");
    setLoading(true);
    try {
      const ctx = context.current ?? new AudioContext();
      context.current = ctx;
      await ctx.resume();
      let buffer = buffers.current.get(take.url);
      if (!buffer) {
        const response = await fetch(take.url);
        if (!response.ok) throw new Error("Audio unavailable");
        buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        buffers.current.set(take.url, buffer);
      }
      if (generation.current !== token) return;
      const start = position.current >= duration - 0.01 ? 0 : position.current;
      position.current = start;
      setT(start);
      const startedAt = ctx.currentTime;
      const volume = ctx.createGain();
      volume.gain.value = muted ? 0 : 1;
      gain.current?.disconnect();
      gain.current = volume;
      volume.connect(ctx.destination);
      const clipTime = Math.max(0, start - PAD);
      if (clipTime < buffer.duration) {
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.playbackRate.value = rate;
        node.connect(volume);
        source.current = node;
        node.start(startedAt + Math.max(0, PAD - start) / rate, clipTime);
      }
      setLoading(false);
      setPlaying(true);
      const tick = () => {
        const value = Math.min(duration, start + (ctx.currentTime - startedAt) * rate);
        position.current = value;
        setT(value);
        if (value >= duration) pause();
        else raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch {
      if (generation.current !== token) return;
      pause();
      setError("The dialogue could not play. Check your audio output or try Play again. You can still scrub the face and timeline.");
    }
  }, [duration, muted, pause, rate, take.url]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
      gain.current?.disconnect();
      void context.current?.close();
    };
  }, [pause, stop]);

  return {
    t, duration, playing, loading, error, rate, muted, pause, seek, play,
    setRate: (v: number) => { pause(); setRate(v); },
    toggleMute: () => { if (gain.current) gain.current.gain.value = muted ? 1 : 0; setMuted(!muted); },
  };
}
