/**
 * Shutter angle, frame rate and the time samples the renderer averages for motion blur. Pure.
 * All times are scene seconds.
 */
export const SHUTTER_ANGLES = [45, 90, 180, 270, 360] as const;
export const FRAME_RATES = [24, 48, 120, 240] as const;
export type FrameRate = (typeof FRAME_RATES)[number];

/** Exposure time of one frame: (angle / 360) / fps. 180° at 24 fps → 1/48 s. */
export const exposureS = (shutterDeg: number, fps: number) => shutterDeg / 360 / fps;

/** "1/48" style shutter speed label. */
export const shutterSpeedLabel = (shutterDeg: number, fps: number) => `1/${Math.round(1 / exposureS(shutterDeg, fps))}`;

/**
 * How fast scene time runs against wall time. Conformed (slow-motion) playback shows every
 * captured frame at 24 fps, so scene time runs at 24 / fps.
 */
export const playbackSpeed = (fps: number, slowMotion: boolean) => (slowMotion && fps > 24 ? 24 / fps : 1);

/** Slow-motion factor when a capture rate is played back at 24 fps. */
export const slowMotionFactor = (fps: number) => fps / 24;

/** The capture instant of the frame containing scene time t (frames are held between captures). */
export const frameTime = (t: number, fps: number) => Math.floor(t * fps + 1e-6) / fps;

/**
 * N sub-frame sample times spread evenly across the open shutter, starting when it opens at the
 * frame time (centred in each slice). Averaging renders at these times is the motion blur.
 */
export function sampleTimes(frameT: number, shutterDeg: number, fps: number, n: number): number[] {
  const e = exposureS(shutterDeg, fps);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(frameT + ((k + 0.5) / n) * e);
  return out;
}

/** Number of motion-blur samples: more for a fast pan, capped by the quality budget. */
export function sampleCount(budget: number, fastMotion: boolean, shutterDeg: number) {
  const want = fastMotion ? 16 : shutterDeg <= 45 ? 6 : 10;
  return Math.max(2, Math.min(budget, want));
}

/**
 * Rolling shutter: rows are read out top to bottom over `readoutS`, so row band b of B starts its
 * exposure (b + 0.5) / B · readout later than the first. A global shutter exposes every row at once.
 */
export const rowOffsetS = (band: number, bands: number, readoutS: number) => ((band + 0.5) / bands) * readoutS;

/**
 * Illustrative readout time for a rolling-shutter CMOS (manufacturers rarely publish it; large
 * high-resolution sensors are typically in the 10–25 ms range). Used only for the skew demo.
 */
export const ILLUSTRATIVE_READOUT_S = 0.02;

/** Fast-pan move: yaw(t) = A·sin(2πt / P). Returns degrees. */
export const PAN = { amplitudeDeg: 14, periodS: 1 } as const;
export const panYawDeg = (t: number) => PAN.amplitudeDeg * Math.sin((2 * Math.PI * t) / PAN.periodS);
/** Peak angular speed of the pan, degrees per second. */
export const panPeakSpeedDegS = () => (PAN.amplitudeDeg * 2 * Math.PI) / PAN.periodS;

/** Skew of a vertical line in a pan: the image moves (speed · readout) degrees between top and bottom rows. */
export const skewDeg = (panSpeedDegS: number, readoutS: number) => panSpeedDegS * readoutS;

/** Motion blur length as a fraction of frame width for a pan at `speedDegS` seen through `hfov`. */
export const panBlurFraction = (speedDegS: number, shutterDeg: number, fps: number, hfov: number) => (speedDegS * exposureS(shutterDeg, fps)) / hfov;

export function describeShutter(shutterDeg: number): string {
  if (shutterDeg <= 45) return "narrow 45° shutter, crisp staccato motion with almost no blur";
  if (shutterDeg <= 90) return "90° shutter, crisp slightly stuttering motion";
  if (shutterDeg <= 180) return "180° shutter, natural motion blur";
  if (shutterDeg <= 270) return "270° shutter, soft extended motion blur";
  return "360° shutter, smeared dreamy motion blur";
}
