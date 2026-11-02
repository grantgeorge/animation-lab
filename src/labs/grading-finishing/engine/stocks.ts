/**
 * Film-stock emulations, all labelled "inspired": each is a hand-tuned approximation of the
 * character people associate with a stock (its contrast, colour crossover, saturation and how its
 * highlights roll off), not a measured characteristic curve. See docs/labs/grading-finishing.md.
 */

export type StockId = "none" | "k500t" | "eterna" | "reversal" | "bleach";

export interface StockDef {
  id: StockId;
  label: string;
  /** One line on what the emulation does to the picture. */
  note: string;
  /** Prompt words for an AI video model. */
  words: string;
  /** Channel crosstalk in linear light, row-major; each row sums to ~1. */
  cross: readonly number[];
  /** Highlight shoulder knee in linear light; 1 means no roll-off (hard clip). */
  knee: number;
  /** Multiplies the user contrast. */
  contrast: number;
  /** Black-level offset in code values: + fades the blacks, − crushes them. */
  toe: number;
  /** Per-channel gamma on the encoded signal: the colour crossover between shadows and highlights. */
  chanGamma: readonly [number, number, number];
  /** Shadow and highlight tints: [hue°, amount]. */
  shadowTint: readonly [number, number];
  highlightTint: readonly [number, number];
  /** Multiplies the user saturation. */
  saturation: number;
}

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;

export const STOCKS: Record<StockId, StockDef> = {
  none: { id: "none", label: "No stock (clean digital)", note: "Hard clip at white, straight colour: the clean digital render.", words: "", cross: I, knee: 1, contrast: 1, toe: 0, chanGamma: [1, 1, 1], shadowTint: [0, 0], highlightTint: [0, 0], saturation: 1 },
  k500t: {
    id: "k500t",
    label: "Kodak Vision3 500T-inspired",
    note: "Tungsten night stock look: soft toe, creamy highlight roll-off, warm highlights over slightly teal shadows.",
    words: "warm Kodak 500T-inspired film look",
    cross: [0.93, 0.05, 0.02, 0.03, 0.94, 0.03, 0.01, 0.06, 0.93],
    knee: 0.6,
    contrast: 1.06,
    toe: 0.022,
    chanGamma: [0.96, 1, 1.05],
    shadowTint: [195, 0.18],
    highlightTint: [35, 0.2],
    saturation: 0.94,
  },
  eterna: {
    id: "eterna",
    label: "Fujifilm Eterna-inspired",
    note: "Low-contrast cinema stock look: muted colour, gentle shoulder, a cool green-cyan cast in the shadows.",
    words: "muted Fujifilm Eterna-inspired low-contrast film look",
    cross: [0.9, 0.07, 0.03, 0.04, 0.92, 0.04, 0.03, 0.07, 0.9],
    knee: 0.7,
    contrast: 0.86,
    toe: 0.03,
    chanGamma: [1.02, 0.97, 1],
    shadowTint: [160, 0.16],
    highlightTint: [55, 0.06],
    saturation: 0.76,
  },
  reversal: {
    id: "reversal",
    label: "Vintage reversal-inspired",
    note: "Slide-film look: dense blacks, punchy contrast, saturated colour separation and a hard shoulder.",
    words: "vintage reversal-film look with dense blacks and saturated colour",
    cross: [1.08, -0.05, -0.03, -0.04, 1.07, -0.03, -0.02, -0.06, 1.08],
    knee: 0.78,
    contrast: 1.28,
    toe: -0.012,
    chanGamma: [0.98, 1, 1.03],
    shadowTint: [220, 0.12],
    highlightTint: [20, 0.14],
    saturation: 1.16,
  },
  bleach: {
    id: "bleach",
    label: "Bleach bypass-inspired",
    note: "Skipped-bleach look: silver left in the print, so colour drops out, contrast hardens and highlights turn metallic.",
    words: "bleach-bypass look, desaturated and high contrast",
    cross: [0.82, 0.15, 0.03, 0.08, 0.88, 0.04, 0.06, 0.14, 0.8],
    knee: 0.8,
    contrast: 1.36,
    toe: -0.016,
    chanGamma: [1, 1, 1],
    shadowTint: [205, 0.06],
    highlightTint: [0, 0],
    saturation: 0.5,
  },
};

export const STOCK_IDS = Object.keys(STOCKS) as StockId[];
export const isStockId = (v: unknown): v is StockId => typeof v === "string" && v in STOCKS;
