import type { NodeId } from "./store";

export const CAPTION = "Stylized demonstration of grading and finishing, not a physically accurate film-stock simulation.";

export interface NodeInfo {
  label: string;
  stage: "grade" | "finish";
  /** What the node does, in a line. */
  what: string;
  /** Why it sits where it does in the order. */
  why: string;
  lut: boolean;
}

export const NODES: Record<NodeId, NodeInfo> = {
  grade: {
    label: "Grade",
    stage: "grade",
    what: "Exposure and white balance in linear light, then contrast, lift/gamma/gain, split-toning, saturation and the film-stock curve.",
    why: "Colour comes first, while the picture is still clean: every later effect (glows, grain) should react to the graded image.",
    lut: true,
  },
  stylize: {
    label: "Stylize",
    stage: "grade",
    what: "Screen-space treatments: comic halftone and ink, or a painterly Kuwahara filter with paper texture.",
    why: "After the grade so the shapes it finds follow the final colours; before finishing so grain sits on top of the paint, not under it.",
    lut: false,
  },
  lens: {
    label: "Lens",
    stage: "finish",
    what: "Barrel distortion, chromatic aberration at the edges and anamorphic horizontal streaks.",
    why: "A lens bends light before it reaches the film, so its warp and fringes come before the film's own glow and grain.",
    lut: false,
  },
  halation: {
    label: "Halation",
    stage: "finish",
    what: "A tight red-orange glow hugging bright edges: light passing through the emulsion, bouncing off the film base and exposing the red layer again.",
    why: "It happens inside the film, so it reacts to highlights after the lens and before the grain.",
    lut: false,
  },
  bloom: {
    label: "Bloom",
    stage: "finish",
    what: "A wide, neutral spread of light from bright areas (a Pro-Mist-style diffusion filter), which also lifts the blacks a little.",
    why: "Diffusion softens what the camera saw; it belongs with the optical effects, under the grain.",
    lut: false,
  },
  vignette: {
    label: "Vignette",
    stage: "finish",
    what: "Darkens the frame edges in linear light, like real lens falloff, to hold the eye in the centre.",
    why: "Applied to light, not to the final code values, so it falls off naturally.",
    lut: false,
  },
  sharpen: {
    label: "Sharpen",
    stage: "finish",
    what: "An unsharp mask: adds back the difference between the image and a blurred copy.",
    why: "Before grain, or it would sharpen the grain into crunchy static.",
    lut: false,
  },
  grain: {
    label: "Grain",
    stage: "finish",
    what: "Clumped, mostly monochrome texture, strongest in the mids, new every frame and fixed when paused.",
    why: "Last, so nothing blurs, warps or sharpens it: grain is the texture of the delivered frame.",
    lut: false,
  },
  weave: {
    label: "Gate weave",
    stage: "finish",
    what: "A tiny per-frame jitter of the whole picture, like film moving through a projector gate.",
    why: "Moves the finished picture as a whole; keep it subtle or it reads as camera shake.",
    lut: false,
  },
};

export const STAGES = [
  { id: "generate", label: "Generate", hint: "the render or AI clip" },
  { id: "grade", label: "Grade", hint: "colour, LUT-able" },
  { id: "finish", label: "Finish", hint: "texture & optics" },
  { id: "deliver", label: "Deliver", hint: "Rec.709 out" },
] as const;

export const HALATION_VS_BLOOM =
  "Halation is tight and red-orange and only rings the brightest edges. Bloom is wide and neutral and spreads from everything bright. Use “glow only” on each to see the two layers on their own.";

export const CANT_FIX = [
  "Light direction: no colour operation moves a shadow or a highlight to the other side of a face.",
  "Character design: a different coat, face or proportions survive any grade.",
  "Rendering style: a CG shot and a painted shot stay different even under one stock and one grain.",
  "Lens and camera: perspective, framing height and motion cadence come from the shot, not the grade.",
] as const;
