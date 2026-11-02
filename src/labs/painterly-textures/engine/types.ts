/** The five painterly techniques, in build-up (compositing) order. */
export const LAYER_IDS = ["texture", "shading", "projection", "overlays", "composite"] as const;
export type LayerId = (typeof LAYER_IDS)[number];
export type Layers = Record<LayerId, boolean>;

export const isLayerId = (v: unknown): v is LayerId => typeof v === "string" && (LAYER_IDS as readonly string[]).includes(v);

/** Layers on for build-up step k (0 = clean 3D, 5 = everything). */
export function buildUp(step: number): Layers {
  const out = {} as Layers;
  LAYER_IDS.forEach((id, i) => (out[id] = i < step));
  return out;
}

/** The build-up step a set of layers corresponds to, or null if it isn't a clean prefix. */
export function stepOf(layers: Layers): number | null {
  let k = 0;
  while (k < LAYER_IDS.length && layers[LAYER_IDS[k]]) k++;
  for (let i = k; i < LAYER_IDS.length; i++) if (layers[LAYER_IDS[i]]) return null;
  return k;
}

export interface PaintParams {
  /** Stroke size multiplier (1 = default: ~4 cm on a face, ~10 cm on the set). */
  strokeSize: number;
  /** Stroke direction, degrees from horizontal. */
  strokeAngle: number;
  /** Painted value bands, 2–4. */
  bands: number;
  /** Shadow hue, degrees on the colour wheel (220 = cool blue). */
  shadowHue: number;
  /** Paper / canvas texture amount, 0–1. */
  paper: number;
}

export const DEFAULT_PARAMS: PaintParams = { strokeSize: 1, strokeAngle: 18, bands: 3, shadowHue: 228, paper: 0.55 };
