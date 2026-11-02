import type { Projection, ViewPreset } from "./projection";
import type { MoveKind, MoveStyle } from "./multiplane";
import type { LookStyle, Stepping } from "./timing";
import type { Demo } from "./impossible";

/** One-line Seedance directions, deterministic for each experiment state. */

export function e1Prompt(proj: Projection, view: ViewPreset): string {
  if (view === "iso")
    return proj === "orthographic"
      ? "Orthographic isometric view, 45° around and 35° down, miniature diorama of the lamplit square, no perspective convergence, parallel edges."
      : "High three-quarter wide shot looking down on the lamplit square, 35 mm perspective, edges converging into the distance.";
  return proj === "orthographic"
    ? "Orthographic camera, flat graphic look, no perspective convergence: floor lines stay parallel and Pip keeps his true size even though he stands farther back than Bram."
    : "Three-quarter wide shot, 30 mm perspective lens slightly above eye level: floor lines converge to a vanishing point and Pip looks small in the depth behind Bram.";
}

const lensWord = (mm: number) => (mm < 28 ? "wide-angle" : mm < 40 ? "moderate wide" : mm < 65 ? "normal" : mm < 110 ? "telephoto" : "long telephoto");

export function e2Prompt(focalMm: number, distanceM: number, sweep: boolean): string {
  if (sweep) return "Dolly zoom (vertigo effect) on Bram: the camera pulls back while zooming in, his face stays the same size while the doorway behind him swells toward him.";
  const mm = Math.round(focalMm);
  const face = mm < 35 ? "exaggerated facial perspective, big nose, ears tucked away" : mm > 70 ? "flattering flat features, ears visible" : "natural facial proportions";
  const bg = mm < 35 ? "the doorway and street look far away and wide" : mm > 70 ? "compressed background, the doorway and window loom close behind him" : "natural depth behind him";
  return `Medium close-up of Bram on a ${mm} mm ${lensWord(mm)} lens from ${distanceM.toFixed(1)} m: ${face}; ${bg}.`;
}

export function e3Prompt(style: MoveStyle, kind: MoveKind): string {
  if (style === "2d")
    return kind === "orbit"
      ? "Traditional 2D animation: a single flat painted background can't be orbited, so the camera only slides and scales across the art, no parallax."
      : "Traditional 2D animation camera: slow pan and zoom across one flat painted background with the characters on the same plane, no parallax.";
  if (style === "2.5d")
    return kind === "orbit"
      ? "2.5D cut-out look: flat painted layers at different depths, the camera arcs and the cardboard layers visibly turn edge-on."
      : "2.5D multiplane parallax: lateral track with a slow push-in through flat painted layers, foreground lantern sweeps past fast, distant clock tower barely moves.";
  return kind === "orbit"
    ? "Full 3D animated shot: the camera orbits 64° around Bram and Pip, the set's real depth turning with the move, consistent volumes."
    : "Full 3D animated shot: lateral tracking shot with a slow push-in, true 3D parallax inside every object.";
}

export function e4Prompt(style: LookStyle, step: Stepping, fStop: number, speedLines: boolean, cel: boolean): string {
  const anime = `anime style, everything in sharp focus, character animated on ${step === 1 ? "ones" : step === 2 ? "twos" : "threes"} (limited animation, held poses), smooth camera pan${speedLines ? " with speed lines on the whip" : ""}${cel ? ", flat cel shading with ink outlines" : ""}`;
  const photo = `photoreal CG animation, 75 mm f/${fStop} shallow depth of field with a rack focus from Bram to Pip, natural motion blur on the whip pan, 24 fps 180° shutter`;
  if (style === "split") return `Same shot two ways — ${photo}; versus ${anime}.`;
  return `${(style === "anime" ? anime : photo).replace(/^./, (c) => c.toUpperCase())}.`;
}

export const E5_PROMPTS: Record<Demo, string> = {
  cheat: "Stylized perspective cheat: heroic low-angle medium shot of Bram with flattering telephoto features over a dramatic deep wide-angle background, Spider-Verse style.",
  push: "Extreme wide-angle push-in on Pip's face as he waves, exaggerated fisheye distortion, his hand swelling toward the lens, anime impact frame.",
  scale: "Camera sweeps low past Pip and pulls back while he stays heroically large in frame, stylized scale cheat, the world falling away behind him.",
  wall: "Continuous camera move gliding past Bram's shoulder and straight through the brick wall into the dark street behind, impossible virtual camera.",
  whip: "Impossible whip move: in a quarter second the camera whips and flies from Bram's close-up to a low side angle on Pip, heavy motion blur, landing perfectly composed.",
};

export interface ModelNote {
  idea: string;
  verdict: "reliable" | "hit-or-miss" | "rarely";
  tip: string;
}

/**
 * Field notes, not measurements: how text-to-video models (Seedance class) tend to treat animation
 * camera language. Describe the result you want when the technique's name is not enough.
 */
export const MODEL_NOTES: readonly ModelNote[] = [
  { idea: "Wide vs telephoto look, shallow depth of field", verdict: "reliable", tip: "Say “wide-angle close-up” or “telephoto, compressed background”; exact mm numbers are read loosely." },
  { idea: "Dolly zoom, orbit, push-in, whip pan, tracking", verdict: "reliable", tip: "Name one move per shot and its direction." },
  { idea: "Anime look, speed lines, cel shading", verdict: "reliable", tip: "Style words carry; say “anime style” first." },
  { idea: "Isometric / orthographic", verdict: "hit-or-miss", tip: "“Isometric diorama” works better than “orthographic camera”; long shots still drift back to perspective." },
  { idea: "Multiplane parallax, 2.5D layers", verdict: "hit-or-miss", tip: "Describe it: “flat painted layers sliding at different speeds”." },
  { idea: "On twos / threes, held poses", verdict: "rarely", tip: "Models interpolate smoothly. Ask for “limited animation, choppy held poses” or step-print the output in the edit." },
  { idea: "Per-layer focal length, scale cheats", verdict: "rarely", tip: "Describe the feeling (“heroic, flattering face over a dramatic deep background”), or composite two generations." },
  { idea: "Passing through walls, impossible flights", verdict: "hit-or-miss", tip: "Short and explicit: “the camera passes through the wall”. Expect cuts or morphs instead." },
];
