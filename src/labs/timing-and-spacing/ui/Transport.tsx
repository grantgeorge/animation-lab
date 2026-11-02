"use client";

import { FPS } from "../engine";
import { type Speed, useTiming } from "../store";
import { ACCENT_MAIN, ANTIC, SQUASH } from "./colors";

function Btn({ label, onClick, children, testId, active }: { label: string; onClick: () => void; children: React.ReactNode; testId?: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-[9px] px-2 text-[11px] transition-colors ${active ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.08] text-ink-1 hover:bg-white/15"}`}
    >
      {children}
    </button>
  );
}

/** Play / step / scrub for all three views. Frames are the unit; the scrubber shows one tick per frame. */
export function Transport() {
  const playing = useTiming((s) => s.playing);
  const frame = useTiming((s) => s.frame);
  const total = useTiming((s) => s.totalFrames);
  const loop = useTiming((s) => s.loop);
  const speed = useTiming((s) => s.speed);
  const onTwos = useTiming((s) => s.params.onTwos);
  const v = useTiming((s) => s.variants[s.variants.length - 1]);
  const s = useTiming.getState();
  const pos = (f: number) => `${(f / (total - 1)) * 100}%`;
  const tl = v.timeline;
  const antStart = tl.takeoffFrame - (v.params.anticipation > 0 ? v.params.anticipationFrames : 0);

  return (
    <div className="ts-transport" data-testid="transport">
      <Btn label={playing ? "Pause (Space)" : "Play (Space)"} onClick={() => s.togglePlay()} testId="play-toggle">
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <rect x="2" y="1.5" width="3" height="9" fill="currentColor" />
            <rect x="7" y="1.5" width="3" height="9" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor" />
          </svg>
        )}
      </Btn>
      <Btn label="Previous frame (,)" onClick={() => s.step(-1)} testId="step-back">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <rect x="1.5" y="2" width="1.6" height="8" fill="currentColor" />
          <path d="M10 2 L4.2 6 L10 10 Z" fill="currentColor" />
        </svg>
      </Btn>
      <Btn label="Next frame (.)" onClick={() => s.step(1)} testId="step-fwd">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <rect x="8.9" y="2" width="1.6" height="8" fill="currentColor" />
          <path d="M2 2 L7.8 6 L2 10 Z" fill="currentColor" />
        </svg>
      </Btn>
      <div className="ts-frame-readout mono">
        <div className="text-ink-0" data-testid="frame-readout">
          F <span className="text-focal-text">{String(frame).padStart(3, "0")}</span>
          <span className="text-ink-3"> / {total - 1}</span>
        </div>
        <div className="text-ink-2">{(frame / FPS).toFixed(2)} s</div>
      </div>
      <div className="ts-scrubber">
        <input type="range" min={0} max={total - 1} step={1} value={frame} data-testid="scrubber" aria-label="Playhead" aria-valuetext={`Frame ${frame} of ${total - 1}`}
          className="ts-scrubber-input" onChange={(e) => { s.pause(); s.seek(Number(e.target.value)); }} />
        <div className="absolute inset-x-0 top-[15px] h-[2px] bg-white/12" />
        {antStart < tl.takeoffFrame && <div className="absolute top-[13px] h-[6px] rounded-sm" style={{ left: pos(antStart), width: `calc(${pos(tl.takeoffFrame)} - ${pos(antStart)})`, background: ANTIC, opacity: 0.45 }} />}
        {Array.from({ length: total }, (_, f) => (
          <div key={f} className="absolute top-[19px] w-px" style={{ left: pos(f), height: f % 6 === 0 ? 6 : 3, background: f % 24 === 0 ? "rgb(255 255 255 / .45)" : "rgb(255 255 255 / .18)" }} />
        ))}
        {tl.contacts.map((c) => (
          <div key={c.frame} className="absolute top-[9px] h-[5px] w-[5px] -translate-x-1/2 rounded-full" style={{ left: pos(c.frame), background: SQUASH }} title={`Contact · frame ${c.frame}`} />
        ))}
        <span className="absolute top-[5px] h-[22px] w-[2px] -translate-x-1/2" style={{ left: pos(frame), background: ACCENT_MAIN }} />
      </div>
      <div className="ts-playback-options">
        <div role="radiogroup" aria-label="Playback speed" className="flex gap-0.5 rounded-[9px] bg-white/5 p-0.5">
          {([0.25, 0.5, 1] as Speed[]).map((sp) => (
            <button
              key={sp}
              type="button"
              role="radio"
              aria-checked={speed === sp}
              data-testid={`speed-${sp}`}
              onClick={() => s.setSpeed(sp)}
              className={`mono h-7 rounded-[7px] px-1.5 text-[10.5px] ${speed === sp ? "bg-[#E9EEF4] text-[#0B0E14]" : "text-ink-1 hover:bg-white/10"}`}
            >
              {sp === 1 ? "1×" : sp === 0.5 ? "½×" : "¼×"}
            </button>
          ))}
        </div>
        <Btn label="Loop" onClick={() => s.setLoop(!loop)} active={loop} testId="loop-toggle">
          Loop
        </Btn>
        <Btn label="Animate on twos: 12 drawings per second" onClick={() => s.setParams({ onTwos: !onTwos })} active={onTwos} testId="twos-toggle">
          On 2s
        </Btn>
      </div>
    </div>
  );
}
