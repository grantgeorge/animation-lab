import { GATE, PIP, TREE_HEIGHT_M } from "./world";

/**
 * Scale cues. The eye sizes a scene from the things whose size it already knows. The trees never
 * change; the references are scaled, and the viewer still assumes their familiar size, so the
 * same tree "reads" as tree height ÷ k.
 */
export type RefId = "pip" | "cabin" | "fence" | "deer";
export const REF_IDS: readonly RefId[] = ["pip", "cabin", "fence", "deer"];

export const REFS: Record<RefId, { label: string; knownM: number; noun: string }> = {
  pip: { label: "Pip", knownM: PIP.heightM, noun: "a small child" },
  cabin: { label: "Cabin", knownM: 4.6, noun: "a log cabin" },
  fence: { label: "Fence", knownM: 1.1, noun: "a split-rail fence" },
  deer: { label: "Deer", knownM: 1.6, noun: "a deer" },
};

export type StoryId = "giant" | "ordinary" | "tiny";
export const STORIES: Record<StoryId, { label: string; k: number; reads: string }> = {
  giant: { label: "Giant forest", k: 1, reads: "towering ancient forest" },
  ordinary: { label: "Ordinary wood", k: 2.2, reads: "ordinary woodland" },
  tiny: { label: "Small wood", k: 4, reads: "a small young wood" },
};

/** Height the viewer infers for the tree when references are scaled by k but assumed true size. */
export const impliedHeight = (trueM: number, k: number) => trueM / k;

/** Height inferred from the picture: tree pixels ÷ reference pixels × the reference's familiar size. */
export const impliedFromPixels = (treePx: number, refPx: number, refKnownM: number) => (treePx / Math.max(1e-9, refPx)) * refKnownM;

/** Fraction of the frame height an object of height H at depth Z fills: f·H / (Z·h). */
export const frameFraction = (heightM: number, depthM: number, focalMm: number) => (focalMm * heightM) / (depthM * GATE.heightMm);

/** How many Pips tall the hero tree is (the "how tall is that tree?" ratio). */
export const pipsTall = (k: number) => TREE_HEIGHT_M / (PIP.heightM * k);
