"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { MediaAsset } from "./types";

export interface PlayerHandle {
  /** Pause, seek to `t`, and resolve true once the frame is decoded and playback can start. */
  prepare: (t?: number) => Promise<boolean>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (t: number) => void;
}

const fmt = (s: number) => `${Math.floor(s)}.${String(Math.floor((s % 1) * 100)).padStart(2, "0")}s`;

/**
 * Poster-first media surface. Videos start paused and muted (published clips are silent),
 * never autoplay, and keep their playback state here instead of in the page tree.
 */
export function MediaPlayer({ asset, label, compact, ref }: { asset: MediaAsset; label: string; compact?: boolean; ref?: Ref<PlayerHandle> }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const dur = asset.durationSeconds ?? 6;

  useImperativeHandle(
    ref,
    () => ({
      prepare: (t = 0) =>
        new Promise<boolean>((resolve) => {
          const v = video.current;
          if (!v || failed) return resolve(false);
          setStarted(true);
          v.pause();
          let done = false;
          const finish = (ok: boolean) => {
            if (done) return;
            done = true;
            v.removeEventListener("seeked", onSeeked);
            v.removeEventListener("error", onErr);
            clearTimeout(timer);
            resolve(ok);
          };
          const ready = () => v.readyState >= 3;
          const onSeeked = () => (ready() ? finish(true) : v.addEventListener("canplay", () => finish(true), { once: true }));
          const onErr = () => finish(false);
          const timer = setTimeout(() => finish(ready()), 8000);
          v.addEventListener("seeked", onSeeked);
          v.addEventListener("error", onErr);
          if (v.readyState === 0) v.load();
          if (Math.abs(v.currentTime - t) < 0.01 && ready()) finish(true);
          else v.currentTime = t;
        }),
      play: async () => {
        await video.current?.play().catch(() => setFailed(true));
      },
      pause: () => video.current?.pause(),
      seek: (t) => {
        if (video.current) video.current.currentTime = t;
      },
    }),
    [failed],
  );

  // Pause on unmount (chapter change) so no hidden clip keeps playing.
  useEffect(() => {
    const v = video.current;
    return () => v?.pause();
  }, []);

  if (asset.kind === "image") {
    return (
      <div className="relative aspect-video w-full bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.alt} width={asset.width} height={asset.height} className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    setStarted(true);
    if (v.paused) v.play().catch(() => setFailed(true));
    else v.pause();
  };

  return (
    <div className="relative" data-testid="media-player" data-asset={asset.id}>
      <div className="relative aspect-video w-full bg-black">
        {failed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {asset.posterUrl && <img src={asset.posterUrl} alt={asset.alt} className="absolute inset-0 h-full w-full object-cover opacity-60" />}
            <div className="absolute inset-0 grid place-items-center">
              <div className="rounded-xl bg-black/70 px-4 py-3 text-center">
                <p className="text-[13px] text-ink-0">This clip couldn&apos;t load.</p>
                <button
                  type="button"
                  className="ctl-btn ctl-btn-primary mt-2"
                  onClick={() => {
                    setFailed(false);
                    video.current?.load();
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </>
        ) : null}
        <video
          ref={video}
          className={`absolute inset-0 h-full w-full object-cover ${failed ? "invisible" : ""}`}
          src={asset.url}
          poster={asset.posterUrl}
          preload={started ? "auto" : "metadata"}
          muted
          playsInline
          loop
          aria-label={`${label}. ${asset.alt}`}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onError={() => setFailed(true)}
          onClick={toggle}
        />
      </div>
      <div className={`flex items-center gap-2 bg-[#0b0f16] px-3 ${compact ? "py-1.5" : "py-2"}`}>
        <button type="button" className="ctl-btn min-w-16" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`} data-testid="media-play" disabled={failed}>
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={dur}
          step={1 / 24}
          value={Math.min(time, dur)}
          onChange={(e) => {
            const v = video.current;
            if (!v) return;
            setStarted(true);
            v.currentTime = Number(e.target.value);
          }}
          aria-label={`Scrub ${label}`}
          aria-valuetext={fmt(time)}
          className="flex-1 accent-[var(--color-distance)]"
          disabled={failed}
        />
        {asset.beatMarkers && !compact ? (
          <div className="hidden gap-1 sm:flex" role="group" aria-label="Jump to beat">
            {asset.beatMarkers.map((b) => (
              <button
                key={b.id}
                type="button"
                className="ctl-btn h-6 px-2 text-[10.5px] capitalize"
                onClick={() => {
                  if (video.current) video.current.currentTime = b.timeSeconds;
                }}
              >
                {b.id}
              </button>
            ))}
          </div>
        ) : null}
        <span className="mono w-14 text-right text-[11px] text-ink-1">{fmt(time)}</span>
      </div>
    </div>
  );
}
