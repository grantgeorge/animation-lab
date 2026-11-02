import type { ExpId } from "./store";

export interface ExpCopy {
  id: ExpId;
  short: string;
  title: string;
  question: string;
  /** What the experiment shows, in two or three sentences. */
  lesson: string;
  notice: string[];
  compare: string[];
}

export const EXP_COPY: Record<ExpId, ExpCopy> = {
  1: {
    id: 1,
    short: "Projection",
    title: "Perspective vs orthographic",
    question: "Does distance make things smaller?",
    lesson:
      "A perspective camera divides by depth: the floor lines meet at a vanishing point and Pip shrinks because he stands farther back. An orthographic camera never divides, so parallel lines stay parallel and every object keeps its true size. That is the graphic, diagrammatic look of isometric games and many anime backgrounds.",
    notice: ["The three amber poles are identical. Watch them shrink in perspective and match in ortho.", "Bram is matched in both, so only depth changes.", "Isometric is ortho at exactly 45° around and 35.264° down."],
    compare: ["Perspective", "Orthographic", "Isometric"],
  },
  2: {
    id: 2,
    short: "Lens",
    title: "24 vs 50 vs 100 mm, matched framing",
    question: "Same framing. Why does it feel different?",
    lesson:
      "Bram stays the same size because the camera dollies: distance grows in step with focal length. Perspective comes from where the camera stands, so close up on a 24 mm his nose is drawn much bigger than his ears and the street falls away. On a 100 mm from far back his face flattens and the doorway and window loom behind him.",
    notice: ["The subject metric stays put while the distance changes about 4×.", "Nose-to-ear exaggeration falls toward 1.0× on long lenses.", "Background readouts are measured by projecting the real set."],
    compare: ["24 mm", "50 mm", "100 mm"],
  },
  3: {
    id: 3,
    short: "2D · 2.5D · 3D",
    title: "2D pan vs 2.5D multiplane vs 3D orbit",
    question: "Which move can you make with flat art?",
    lesson:
      "With one flat painting every camera move collapses into a pan and a zoom: everything slides together. Hang the art on separate planes (Disney's multiplane) and the same move makes the near lantern race past while the tower barely moves, because screen motion falls off as 1 / depth. Only real 3D survives an orbit: cards turn edge-on, volumes don't.",
    notice: ["Every layer is painted from the actual 3D set and cast, so it stays on-model.", "Try Orbit on 2.5D: the cut-outs give themselves away.", "Inspect shows the stand from the side, like a multiplane diagram."],
    compare: ["2D · one painting", "2.5D · multiplane", "3D · real set"],
  },
  4: {
    id: 4,
    short: "Photoreal · Anime",
    title: "Photoreal vs stylized camera",
    question: "Do you want a lens, or a drawing?",
    lesson:
      "A photoreal CG camera imitates optics: a shallow depth of field that racks from Bram to Pip and motion blur integrated across a 180° shutter. A stylized anime camera keeps everything sharp, holds the character's drawings on twos or threes while the camera pans smoothly, and draws speed lines and smears instead of blur.",
    notice: ["The timing strip shows new drawings vs held frames.", "Motion blur is real: the shot is rendered several times inside each frame.", "Split shows both looks of the same instant."],
    compare: ["Photoreal", "Anime"],
  },
  5: {
    id: 5,
    short: "Impossible",
    title: "The impossible camera",
    question: "What if the camera ignores physics?",
    lesson:
      "A virtual camera has no body, no weight and no single lens. Animators exploit that: a flattering telephoto character over a dramatic wide background, a lens that bulges where the director wants, a hero who grows as the camera pulls away, a camera that flies through brick, a whip that would pull tens of g.",
    notice: ["Every demo sits beside its closest physical version.", "Inspect shows the physical path (cyan) against the impossible one (pink).", "The readouts say exactly which physical rule is broken."],
    compare: ["Physical camera", "Impossible camera"],
  },
};

export const DEMO_COPY = {
  cheat: { label: "Perspective cheat", rule: "One lens per shot", how: "One real lens gives you either a dramatic world with a distorted face (14 mm from 0.55 m) or a flattering face in a flat, cropped world (135 mm from 5.3 m). The cheat renders the world through the 14 mm and Bram alone through the 135 mm, laid on top at the same size. Spider-Verse and anime do this by hand." },
  push: { label: "Fisheye push", rule: "Rectilinear optics", how: "The camera pushes from 2.6 m on a 35 mm to 0.55 m on a 14 mm while a drawn fisheye bulge swells the centre of the frame. The amount is art-directed per beat, not set by glass." },
  scale: { label: "Scale cheat", rule: "Objects keep their size", how: "As the camera pulls away, Pip is scaled up about his feet so he keeps his heroic size in frame. The physical camera loses him into the set." },
  wall: { label: "Through the wall", rule: "Solid matter", how: "The camera glides past Bram's shoulder and straight through the brick wall. In CG a wall is only a surface; for a frame the bricks become a natural wipe." },
  whip: { label: "Impossible whip", rule: "Inertia", how: "In a quarter of a second the camera flies 3.8 m and turns 130°, landing perfectly composed on Pip. A real whip pan can turn that fast, but it can't travel." },
} as const;

export const TAGLINE = "A cinematographer's controls. An animator's freedom.";
