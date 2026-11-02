import { NEUTRAL_GRADE, ZERO_WHEEL, mergeGrade, type GradeParams } from "./grade";

/** Finishing: everything after the grade that looks at neighbouring pixels or at time. */
export interface FinishParams {
  grain: { amount: number; size: number; chroma: number };
  halation: { amount: number; threshold: number };
  bloom: { amount: number; threshold: number; mist: number };
  lens: { distortion: number; aberration: number; streaks: number };
  vignette: { amount: number; softness: number };
  sharpen: number;
  weave: number;
}

export type StylizeMode = "none" | "comic" | "painterly";

export interface StylizeParams {
  mode: StylizeMode;
  amount: number;
  /** Halftone cell size in output pixels (comic) or brush radius (painterly). */
  scale: number;
  /** Ink-plate misregistration in pixels (comic). */
  misregister: number;
  /** Ink outlines. */
  ink: number;
  /** Paper / canvas texture. */
  paper: number;
  /** Animate on twos: the scene updates at 12 fps. */
  stepped: boolean;
}

export interface Look {
  grade: GradeParams;
  finish: FinishParams;
  stylize: StylizeParams;
}

export const NEUTRAL_FINISH: FinishParams = {
  grain: { amount: 0, size: 1.15, chroma: 0.15 },
  halation: { amount: 0, threshold: 0.86 },
  bloom: { amount: 0, threshold: 0.7, mist: 0.25 },
  lens: { distortion: 0, aberration: 0, streaks: 0 },
  vignette: { amount: 0, softness: 0.55 },
  sharpen: 0,
  weave: 0,
};

export const NEUTRAL_STYLIZE: StylizeParams = { mode: "none", amount: 1, scale: 5, misregister: 0, ink: 0, paper: 0, stepped: false };

export const NEUTRAL_LOOK: Look = { grade: NEUTRAL_GRADE, finish: NEUTRAL_FINISH, stylize: NEUTRAL_STYLIZE };

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

export interface LookPatch {
  grade?: Partial<GradeParams>;
  finish?: DeepPartial<FinishParams>;
  stylize?: Partial<StylizeParams>;
}

export function mergeFinish(base: FinishParams, p: DeepPartial<FinishParams> | undefined): FinishParams {
  if (!p) return base;
  return {
    grain: { ...base.grain, ...p.grain },
    halation: { ...base.halation, ...p.halation },
    bloom: { ...base.bloom, ...p.bloom },
    lens: { ...base.lens, ...p.lens },
    vignette: { ...base.vignette, ...p.vignette },
    sharpen: p.sharpen ?? base.sharpen,
    weave: p.weave ?? base.weave,
  };
}

export function applyPatch(base: Look, p: LookPatch): Look {
  return { grade: mergeGrade(base.grade, p.grade), finish: mergeFinish(base.finish, p.finish), stylize: { ...base.stylize, ...p.stylize } };
}

export type LookId =
  | "clean"
  | "k500t"
  | "eterna"
  | "reversal"
  | "bleach"
  | "teal-orange"
  | "promist"
  | "anamorphic"
  | "matrix"
  | "comic"
  | "painterly";

export interface LookPreset {
  id: LookId;
  label: string;
  group: "Film stocks" | "Looks" | "Famous treatments";
  /** One line on what it actually does to the picture. */
  note: string;
  patch: LookPatch;
}

export const LOOKS: readonly LookPreset[] = [
  { id: "clean", group: "Looks", label: "Clean digital", note: "No grade, no finishing: the render exactly as it left the renderer (or the model).", patch: {} },
  {
    id: "k500t",
    group: "Film stocks",
    label: "Kodak 500T-inspired night",
    note: "A tungsten-stock print look: soft toe, creamy highlights, warm practicals over teal shadows, fine grain and a little halation.",
    patch: {
      grade: { stock: "k500t", temperature: 0.12 },
      finish: { grain: { amount: 0.36, size: 1.15, chroma: 0.18 }, halation: { amount: 0.55, threshold: 0.85 }, bloom: { amount: 0.18, threshold: 0.72, mist: 0.2 }, vignette: { amount: 0.28, softness: 0.6 } },
    },
  },
  {
    id: "eterna",
    group: "Film stocks",
    label: "Fujifilm Eterna-inspired",
    note: "Muted, low-contrast cinema stock look with a green-cyan shadow bias and gentle grain.",
    patch: { grade: { stock: "eterna" }, finish: { grain: { amount: 0.28, size: 1.2, chroma: 0.15 }, halation: { amount: 0.25, threshold: 0.86 }, vignette: { amount: 0.18, softness: 0.6 } } },
  },
  {
    id: "reversal",
    group: "Film stocks",
    label: "Vintage reversal-inspired",
    note: "Slide-film punch: dense blacks, saturated separation, a hard shoulder and tight grain.",
    patch: { grade: { stock: "reversal", temperature: 0.08 }, finish: { grain: { amount: 0.3, size: 1.1, chroma: 0.3 }, halation: { amount: 0.22, threshold: 0.87 }, vignette: { amount: 0.34, softness: 0.5 } } },
  },
  {
    id: "bleach",
    group: "Film stocks",
    label: "Bleach bypass-inspired",
    note: "Colour drained, contrast hardened, highlights metallic; heavier grain and a touch of sharpening.",
    patch: { grade: { stock: "bleach" }, finish: { grain: { amount: 0.46, size: 1.5, chroma: 0.1 }, sharpen: 0.35, vignette: { amount: 0.3, softness: 0.5 } } },
  },
  {
    id: "teal-orange",
    group: "Looks",
    label: "Blockbuster teal & orange",
    note: "Split-tone: shadows pushed teal, highlights (and skin) pushed orange, so faces separate from backgrounds.",
    patch: {
      grade: { contrast: 1.14, saturation: 1.06, split: { shadowHue: 195, shadowAmt: 0.5, highlightHue: 32, highlightAmt: 0.42, balance: 0 } },
      finish: { bloom: { amount: 0.15, threshold: 0.72, mist: 0.15 }, vignette: { amount: 0.22, softness: 0.6 }, grain: { amount: 0.15, size: 1.2, chroma: 0.1 } },
    },
  },
  {
    id: "promist",
    group: "Looks",
    label: "Dreamy Pro-Mist",
    note: "Diffusion filter look: highlights bleed wide and soft, blacks lift, contrast relaxes.",
    patch: {
      grade: { contrast: 0.9, lift: { ...ZERO_WHEEL, m: 0.12 }, temperature: 0.1 },
      finish: { bloom: { amount: 0.75, threshold: 0.6, mist: 0.65 }, halation: { amount: 0.25, threshold: 0.85 }, grain: { amount: 0.16, size: 1.3, chroma: 0.15 } },
    },
  },
  {
    id: "anamorphic",
    group: "Looks",
    label: "Anamorphic lens",
    note: "A lens personality, not a grade: barrel distortion, colour fringing at the edges and blue horizontal streak flares.",
    patch: {
      finish: { lens: { distortion: 0.12, aberration: 0.45, streaks: 0.65 }, vignette: { amount: 0.36, softness: 0.5 }, bloom: { amount: 0.2, threshold: 0.72, mist: 0.1 } },
    },
  },
  {
    id: "matrix",
    group: "Famous treatments",
    label: "Green code-world grade (Matrix-inspired)",
    note: "Green pushed into the mids and highlights, colour drained, contrast crisp. All of it is grade, so it fits in a LUT.",
    patch: {
      grade: { temperature: -0.22, tint: -0.75, saturation: 0.6, contrast: 1.22, lift: { x: -0.04, y: 0.07, m: 0 }, gamma: { x: -0.09, y: 0.16, m: 0 }, gain: { x: -0.06, y: 0.1, m: 0 } },
      finish: { grain: { amount: 0.2, size: 1.2, chroma: 0.1 }, vignette: { amount: 0.26, softness: 0.55 }, sharpen: 0.2 },
    },
  },
  {
    id: "comic",
    group: "Famous treatments",
    label: "Comic print (Spider-Verse-inspired)",
    note: "Halftone dots, offset ink plates, inked edges and animation on twos. A stylization, not a grade: none of it fits in a LUT.",
    patch: {
      grade: { contrast: 1.15, saturation: 1.3 },
      stylize: { mode: "comic", amount: 1, scale: 6, misregister: 2.5, ink: 0.85, paper: 0.35, stepped: true },
    },
  },
  {
    id: "painterly",
    group: "Famous treatments",
    label: "Painterly (Arcane-inspired)",
    note: "A Kuwahara filter flattens detail into brush-like patches under a paper texture. Screen-space post: strokes aren't attached to surfaces, so they swim when things move (see /labs/painterly-textures for surface-attached paint).",
    patch: {
      grade: { contrast: 1.1, saturation: 1.12, split: { shadowHue: 200, shadowAmt: 0.25, highlightHue: 30, highlightAmt: 0.2, balance: 0 } },
      finish: { vignette: { amount: 0.22, softness: 0.6 } },
      stylize: { mode: "painterly", amount: 1, scale: 6, ink: 0.35, paper: 0.3, misregister: 0, stepped: false },
    },
  },
];

export const LOOK_IDS = LOOKS.map((l) => l.id);
export const isLookId = (v: unknown): v is LookId => typeof v === "string" && (LOOK_IDS as string[]).includes(v);
export const getLook = (id: LookId) => LOOKS.find((l) => l.id === id) ?? LOOKS[0];
export const lookFromPreset = (id: LookId): Look => applyPatch(NEUTRAL_LOOK, getLook(id).patch);

/** The four simple sliders, as 0–1 positions (the screenshot's percentages). */
export interface SimpleSliders {
  grain: number;
  temperature: number;
  contrast: number;
  bloom: number;
}

export const SIMPLE_DEFAULT: SimpleSliders = { grain: 0, temperature: 0.5, contrast: 0.5, bloom: 0 };

/** Contrast slider: 50 % is neutral, the ends are about ±0.7 stops of slope. */
export const contrastFromSlider = (v: number) => Math.pow(2, (v - 0.5) * 1.4);
export const sliderFromContrast = (c: number) => Math.min(1, Math.max(0, Math.log2(Math.max(1e-3, c)) / 1.4 + 0.5));

export function simpleFromLook(l: Look): SimpleSliders {
  return {
    grain: l.finish.grain.amount,
    temperature: Math.min(1, Math.max(0, l.grade.temperature / 2 + 0.5)),
    contrast: sliderFromContrast(l.grade.contrast),
    bloom: l.finish.bloom.amount,
  };
}

export function applySimple(l: Look, key: keyof SimpleSliders, v: number): Look {
  const x = Math.min(1, Math.max(0, v));
  switch (key) {
    case "grain":
      return applyPatch(l, { finish: { grain: { ...l.finish.grain, amount: x } } });
    case "temperature":
      return applyPatch(l, { grade: { temperature: (x - 0.5) * 2 } });
    case "contrast":
      return applyPatch(l, { grade: { contrast: contrastFromSlider(x) } });
    case "bloom":
      return applyPatch(l, { finish: { bloom: { ...l.finish.bloom, amount: x } } });
  }
}
