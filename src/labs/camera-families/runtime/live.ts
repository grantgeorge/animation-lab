/** Per-frame values written by the orchestrator (outside React), read by overlays and the test hook. */
export const live = {
  t: 0,
  /** Capture instant of the displayed frame (scene seconds). */
  frameT: 0,
  frameId: 0,
  /** Sub-frame renders averaged this frame (samples × rolling-shutter bands). */
  renders: 0,
  samples: 0,
  bands: 1,
  /** Sample times of the first band, scene seconds. */
  sampleTimes: [] as number[],
  /** Spread of the sample times (≈ exposure). */
  sampleSpan: 0,
  hfov: 0,
  vfov: 0,
  focalMm: 0,
  /** Bram's size as a fraction of frame width, measured on the real render camera. */
  subjectFraction: 0,
  renderW: 0,
  renderH: 0,
  maxBlurPx: 0,
  yawDeg: 0,
  rolling: false,
  lookIds: [] as string[],
};

/** DOM windows the passes render into: "main" (the shot), "b0".."b2" (blind test), "gate" (gate diagram), "stage". */
export type SlotId = "main" | "b0" | "b1" | "b2" | "gate" | "stage";
export const slots = new Map<SlotId, HTMLElement>();

/** Ref callback factory that registers a DOM slot. */
export const slotRef = (id: SlotId) => (el: HTMLElement | null) => {
  if (el) slots.set(id, el);
  else slots.delete(id);
};
