import type { LayerId } from "./engine/types";
import type { TestVersion } from "./engine/seeds";

export interface Technique {
  id: LayerId;
  n: number;
  title: string;
  short: string;
  /** One sentence: what the layer is. */
  line: string;
  /** Where it lives: on the surface, in the world, or on the screen. */
  space: "surface" | "world" | "screen";
  inspect: string;
}

export const TECHNIQUES: Technique[] = [
  {
    id: "texture",
    n: 1,
    title: "Hand-painted texture maps",
    short: "Textures",
    line: "Brushstrokes and colour patches are painted into the surface itself, so they ride along when Bram moves.",
    space: "surface",
    inspect: "Painted dabs live in each object's rest space, laid along the form and rotated by the stroke direction. Each dab carries a value, a warm or cool hue and a mask the shading cuts along, with bristles from a brush tile. Fine texture detail is softened so the strokes read.",
  },
  {
    id: "shading",
    n: 2,
    title: "Painterly shading",
    short: "Shading",
    line: "Smooth light becomes a few flat painted values, with cool shadows, warm light, a terminator cut along strokes and a rim painted as one stroke.",
    space: "surface",
    inspect: "The light amount at each point is pushed through a ramp of 2 to 4 flat bands. A brush mask in surface space nudges it before banding, so the shadow edge follows strokes, not a perfect curve.",
  },
  {
    id: "projection",
    n: 3,
    title: "Matte painting / projection",
    short: "Projection",
    line: "A painting of the set, made over a render from the shot camera, is projected back onto the set's geometry: perfect from that camera, stretched from anywhere else.",
    space: "world",
    inspect: "The projector is the shot camera. Swing the camera away and grazing surfaces smear the painting, and surfaces the projector never saw take the paint of whatever was in front of them. Productions split projections by depth (background, midground, foreground) and paint extra coverage for exactly this reason.",
  },
  {
    id: "overlays",
    n: 4,
    title: "2D overlays",
    short: "Overlays",
    line: "Painted light shafts, smoke, highlights and scratches are flat cards composited over the 3D, the way Fortiche layers 2D effects on 3D.",
    space: "world",
    inspect: "Each effect is a flat card with a painted texture, placed in the scene and blended over the render. The exploded view slides them toward you so you can see they're flat.",
  },
  {
    id: "composite",
    n: 5,
    title: "Compositing",
    short: "Composite",
    line: "The final pass pulls it together: a unifying grade, warm halation, painted edges, rough vignetting and paper texture.",
    space: "screen",
    inspect: "Bottom to top: render, painted textures, banded shading, projected matte, cards, then the screen-space finishing. Only this last layer is post, and it's the only one that's meant to stay still on screen.",
  },
];

export const CLEAN_LINE = "The same shot as plain 3D: smooth gradients, controlled materials, consistent surfaces. Every layer you add is a decision a painter would make.";

export const techniqueOf = (id: LayerId) => TECHNIQUES.find((t) => t.id === id)!;

export interface VersionInfo {
  id: TestVersion;
  n: number;
  title: string;
  tag: string;
  line: string;
  verdict: "sticks" | "swims" | "boils" | "boil on purpose";
}

export const VERSIONS: VersionInfo[] = [
  { id: "surface", n: 1, title: "Surface-attached", tag: "PAINTED TEXTURE", line: "The strokes are mapped on Bram's surface: they turn with his face.", verdict: "sticks" },
  { id: "screen", n: 2, title: "Screen-space filter", tag: "PAINTING FILTER", line: "A Kuwahara filter plus strokes fixed to the screen: his face slides under them (the shower-door effect).", verdict: "swims" },
  { id: "random", n: 3, title: "Per-frame random", tag: "NAIVE STYLE TRANSFER", line: "The same filter, but it re-invents its strokes on every frame, like per-frame style transfer or AI flicker: it boils.", verdict: "boils" },
  { id: "boil", n: 4, title: "Intentional boil", tag: "ON TWOS · 3 DRAWINGS", line: "Three slightly different paintings held for two frames each and cycled: a small, steady rhythm the artist chose.", verdict: "boil on purpose" },
];

export const versionOf = (id: TestVersion) => VERSIONS.find((v) => v.id === id)!;

export const KEY_IDEA = {
  title: "Paint belongs to the surface",
  body: "Film grain and painting filters work in screen space: they're laid over the frame. Painterly texture is part of the character and the set, so when Bram turns his head the brushstrokes turn with him. That's what keeps painterly animation from crawling.",
  grading: "The Grading & Finishing lab's painterly preset is the screen-space version: good for finishing, but it doesn't stay attached to anything.",
};

export const METRIC_NOTE = [
  "Two consecutive 24 fps frames are rendered off-screen, each with a surface-coordinate pass: every pixel stores which 1.2 cm cell of Bram's rest-pose surface it shows.",
  "Each frame is also rendered clean. Stylised minus clean is what the paint adds; lighting that moves across his face cancels out. (The surface versions are measured on the texture layer, shading off.)",
  "For every surface cell seen in both frames, we compare the mean of what the paint adds. Crawl is the average change, as a percentage of full brightness: paint that is attached keeps its value.",
];
