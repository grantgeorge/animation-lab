import type { MoveId } from "./engine/camera";
import type { Construct, CueId } from "./store";

export const TAGLINE = "How a flat screen becomes an enormous world";

export const QUESTION = "How do you make a flat screen feel like a believable, expansive world?";

export const CUE_COPY: Record<CueId, { label: string; line: string; off: string }> = {
  parallax: { label: "Parallax", line: "Near things slide across the screen faster than far things when the camera moves.", off: "Everything slides together, like a painting on one plane." },
  haze: { label: "Atmospheric depth", line: "Air lightens distant things, lowers their contrast and shifts them toward blue.", off: "A ridge 2 km away is as dark and crisp as a trunk 20 m away." },
  layers: { label: "FG / MG / BG layering", line: "A dark foreground frame, a lit midground subject and a pale background stack the distances.", off: "No foreground: the frame starts at the subject." },
  scale: { label: "Scale cues", line: "Familiar objects (a child, a cabin, a deer) tell you how big everything else is.", off: "No reference: the trees could be 6 m or 60 m." },
  occlusion: { label: "Occlusion", line: "Whatever blocks something else must be nearer: the overlap edge says which is in front.", off: "Flat silhouettes of one value: overlapping trunks merge into one shape, so nothing says which is in front." },
  dof: { label: "Depth of field", line: "Focus on the subject; nearer and farther things soften, like a real lens. At 24 mm focus is deep; at 50–85 mm the foreground melts.", off: "Pinhole sharpness from the ferns to the mountains." },
  perspective: { label: "Perspective", line: "Converging lines and shrinking sizes. A wide lens up close exaggerates both; a long lens from far away flattens them.", off: "An 85 mm lens from 37 m: the same Pip, a compressed, flatter forest." },
};

/** Short labels for the take-apart steps. */
export const STEP_SHORT: Record<CueId, string> = { occlusion: "Occlusion", perspective: "Perspective", layers: "Layering", scale: "Scale", haze: "Atmosphere", parallax: "Parallax", dof: "Depth of field" };

export const CONSTRUCT_COPY: Record<Construct, { label: string; short: string; line: string }> = {
  "2d": { label: "2D", short: "One painted plate", line: "One flat plate rendered from the forest at frame 0, panned and zoomed. Nothing can be revealed: the painting only has one side." },
  "25d": { label: "2.5D", short: "Depth layers", line: "The frame-0 picture cut into depth layers on flat cards. Parallax works, but anything hidden in frame 0 was never painted: push or arc too far and holes and card edges show." },
  "3d": { label: "3D", short: "Real geometry", line: "The real forest. Any viewpoint works and the geometry behind each trunk is revealed correctly." },
};

export const MOVE_COPY: Record<MoveId, { label: string; line: string }> = {
  push: { label: "Push in", line: "Straight down the path. Nothing enters at the edges; only what the foreground ferns covered is uncovered as the camera passes them." },
  track: { label: "Track + push", line: "Sideways between the trees with a little push. New picture enters at one edge and slides out from behind the ferns." },
  arc: { label: "Arc", line: "An orbit around Pip and the trunks behind him. The far side of every trunk has to exist." },
};

export const LESSON =
  "A world doesn't need detailed modelling to feel enormous. Seven cues do the work: parallax, haze, layering, scale, occlusion, focus and perspective. Turn them off and the same forest reads as a flat backdrop. The camera move is where 2D, 2.5D and 3D part ways: the more a move reveals that frame 0 never showed, the more an AI video model has to invent and keep consistent.";

export const NOTICE: readonly string[] = [
  "Flatten, then add the cues back one at a time. Haze and scale do the most for size; parallax only shows while the camera moves.",
  "The same trees read as 62 m with Pip at true size and about 15 m when the references are scaled ×4.",
  "Revealed area is measured on the real forest: it's how much new picture the move demands. 3D renders it, 2.5D shows holes, 2D can't show it at all.",
  "For AI video, prefer slow push-ins and lateral tracks behind foreground. Wide orbits reveal the most.",
];
