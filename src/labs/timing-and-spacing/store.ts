import { create } from "zustand";
import { MasterClock } from "@/engine/timeline/clock";
import {
  type ComparisonId,
  DEFAULT_PARAMS,
  FPS,
  type MotionParams,
  type Pose,
  type Variant,
  buildVariants,
  comparison,
  motionPrompt,
  poseContext,
  sampleFrames,
  updateParams,
} from "./engine";

export interface VariantView extends Variant {
  /** One pose per frame (on twos: held drawings repeat). */
  frames: Pose[];
  prompt: string;
}

export type Speed = 0.25 | 0.5 | 1;

export interface TimingState {
  params: MotionParams;
  comparison: ComparisonId | null;
  lastComparison: ComparisonId;
  variants: VariantView[];
  totalFrames: number;
  frame: number;
  playing: boolean;
  /** Has playback ever started (the reduced-motion play button hides after). */
  started: boolean;
  loop: boolean;
  speed: Speed;
  ghosts: boolean;
  helpOpen: boolean;
  copied: number;
  setParams: (patch: Partial<MotionParams>) => void;
  reset: () => void;
  setComparison: (id: ComparisonId | null) => void;
  toggleCompare: () => void;
  seek: (frame: number) => void;
  step: (delta: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setLoop: (on: boolean) => void;
  setSpeed: (s: Speed) => void;
  setGhosts: (on: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  markCopied: () => void;
}

/** The single playback clock for every view. Time is in seconds; views read whole frames. */
export const clock = new MasterClock({ durationS: 1, playing: false });

function derive(params: MotionParams, id: ComparisonId | null) {
  const variants: VariantView[] = buildVariants(params, id).map((v) => ({
    ...v,
    frames: sampleFrames(poseContext(v.timeline)),
    prompt: motionPrompt(v.params),
  }));
  const totalFrames = variants[0].timeline.totalFrames;
  clock.durationS = totalFrames / FPS;
  return { variants, totalFrames };
}

const seekClock = (frame: number) => clock.seek((frame + 0.02) / FPS);

export const useTiming = create<TimingState>()((set, get) => ({
  params: DEFAULT_PARAMS,
  comparison: null,
  lastComparison: "easing",
  ...derive(DEFAULT_PARAMS, null),
  frame: 0,
  playing: false,
  started: false,
  loop: true,
  speed: 1,
  ghosts: false,
  helpOpen: false,
  copied: 0,

  setParams: (patch) => {
    const s = get();
    const params = updateParams(s.params, patch);
    const d = derive(params, s.comparison);
    const frame = Math.min(s.frame, d.totalFrames - 1);
    if (frame !== s.frame || !s.playing) seekClock(frame);
    set({ params, ...d, frame });
  },
  reset: () => {
    const s = get();
    const d = derive(DEFAULT_PARAMS, s.comparison);
    seekClock(0);
    set({ params: DEFAULT_PARAMS, ...d, frame: 0 });
  },
  setComparison: (id) => {
    const s = get();
    const d = derive(s.params, id);
    // Restart so both sides are seen from the first frame.
    seekClock(0);
    // The squash lesson reads best with onion skins on.
    set({ comparison: id, lastComparison: id ?? s.lastComparison, ...d, frame: 0, ghosts: id === "squash" ? true : s.ghosts });
  },
  toggleCompare: () => {
    const s = get();
    s.setComparison(s.comparison ? null : s.lastComparison);
  },
  seek: (frame) => {
    const total = get().totalFrames;
    const f = ((Math.round(frame) % total) + total) % total;
    seekClock(f);
    set({ frame: f });
  },
  step: (delta) => {
    const s = get();
    if (s.playing) s.pause();
    s.seek(s.frame + delta);
  },
  play: () => {
    const s = get();
    if (!s.loop && s.frame >= s.totalFrames - 1) seekClock(0);
    clock.play();
    set({ playing: true, started: true });
  },
  pause: () => {
    clock.pause();
    const f = Math.min(get().totalFrames - 1, Math.floor(clock.peek() * FPS + 1e-6));
    seekClock(f);
    set({ playing: false, frame: f });
  },
  togglePlay: () => (get().playing ? get().pause() : get().play()),
  setLoop: (loop) => set({ loop }),
  setSpeed: (speed) => {
    clock.setSpeed(speed);
    set({ speed });
  },
  setGhosts: (ghosts) => set({ ghosts }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  markCopied: () => set({ copied: Date.now() }),
}));

/** Advance the shared playhead from the clock. Call once per animation frame. */
export function tickPlayback() {
  const s = useTiming.getState();
  if (!s.playing) return;
  const raw = clock.tick() * FPS;
  let f = Math.floor(raw + 1e-6);
  if (f >= s.totalFrames) {
    if (!s.loop) {
      clock.pause();
      seekClock(s.totalFrames - 1);
      useTiming.setState({ playing: false, frame: s.totalFrames - 1 });
      return;
    }
    f %= s.totalFrames;
  }
  // Non-looping: stop on the last frame instead of wrapping.
  if (!s.loop && f < s.frame && s.frame > 0) {
    clock.pause();
    seekClock(s.totalFrames - 1);
    useTiming.setState({ playing: false, frame: s.totalFrames - 1 });
    return;
  }
  if (f !== s.frame) useTiming.setState({ frame: f });
}

export const isLocked = (s: Pick<TimingState, "comparison">, key: keyof MotionParams) => !!comparison(s.comparison)?.locks.includes(key);
