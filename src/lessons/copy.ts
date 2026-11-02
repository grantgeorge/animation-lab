import type { LensClass } from "@/engine/classify";
import type { CameraMode } from "@/engine/types";
import type { Measurements } from "@/engine/measure";
import { sceneDescriptor as scene } from "@/labs/lens-and-framing/config";

/** One-line rule repeated under every Match-mode concept. */
export const PERSPECTIVE_RULE = "Perspective is set by where the camera stands. The lens only decides how much of it you see.";

interface Concept {
  title: string;
  body: string;
}

/** Concept panel copy: lens class × mode. `{d}` is the live distance to the subject. */
export const CONCEPTS: Record<CameraMode, Record<LensClass, Concept>> = {
  fixed: {
    "ultra-wide": {
      title: "Ultra-wide: reveal the setting",
      body: "A broad view gives the action more context. The camera stays put, so the relationship between near and far objects stays the same. Watch how much of the set enters the frame.",
    },
    wide: {
      title: "Wide angle: room to stage the action",
      body: "Look for space around the performance and room for a second character. Changing the lens from this position changes the crop, while the perspective stays the same.",
    },
    "moderate-wide": {
      title: "Moderate wide: action and context",
      body: "Balance the character with the setting. Compare the frame edges with 24 mm: this is a tighter view from the same position. Decide which background details help tell the story.",
    },
    normal: {
      title: "Normal: a useful starting point",
      body: "Start here, then compare a wider and a longer lens. Keep an eye on {mid}: its size relative to the character stays the same while the camera remains in place.",
    },
    "portrait-tele": {
      title: "Short telephoto: isolate a detail",
      body: "A longer lens narrows your attention. Look at which gestures and expressions remain in frame. Their perspective is unchanged; you're magnifying a smaller part of the view.",
    },
    tele: {
      title: "Telephoto: magnified detail",
      body: "A narrow view makes small details fill the frame. This can isolate a reaction, but it may crop out an important gesture. Try Match framing to keep the subject's size instead.",
    },
  },
  match: {
    "ultra-wide": {
      title: "Ultra-wide: move into the action",
      body: "The camera moves closer to keep {target} framed. From {d}, nearby features appear larger relative to distant ones. Compare the character with {mid} to see the depth change.",
    },
    wide: {
      title: "Wide: a closer point of view",
      body: "The camera is now {d} away. Moving closer makes differences in depth more pronounced. Watch the space between the character and {mid}, then decide how this viewpoint changes the feeling.",
    },
    "moderate-wide": {
      title: "Moderate wide: stay near the scene",
      body: "From {d}, compare the character's proportions and the visible setting with 50 mm. The framing is held, so the difference you see comes from the camera's new position.",
    },
    normal: {
      title: "Normal: your reference frame",
      body: "Use this view from {d} as a baseline. Compare 24 mm and 85 mm: the camera moves to hold {target} at the same size, changing how the background relates to the subject.",
    },
    "portrait-tele": {
      title: "Short telephoto: bring layers together",
      body: "The camera pulls back to {d}. Differences in distance become smaller relative to that viewpoint, so {mid} appears larger compared with the character. Watch the background, not just the face.",
    },
    tele: {
      title: "Telephoto: compress the space",
      body: "From {d}, the scene's layers appear closer together. The longer lens keeps the subject framed from farther away. It's that change in camera position that changes perspective.",
    },
  },
};

const fmtD = (m: number) => (m < 1 ? `${m.toFixed(2)} m` : `${m.toFixed(1)} m`);

export function conceptFor(mode: CameraMode, m: Measurements): Concept & { focal: string } {
  const c = CONCEPTS[mode][m.lensClass];
  const body = c.body.replaceAll("{d}", fmtD(m.distanceM)).replaceAll("{target}", m.targetName).replaceAll("{mid}", scene.labels.midground);
  return { title: c.title, body, focal: `${Math.round(m.focalMm)} mm` };
}

/** Live caption: one or two sentences, key variables color-coded by the renderer. */
export function captionParts(mode: CameraMode, m: Measurements) {
  const pct = Math.round(m.subjectFraction * 100);
  return {
    focal: `${Math.round(m.focalMm)} mm`,
    distance: fmtD(m.distanceM),
    target: m.targetName,
    pct: `${pct}%`,
    hfov: `${m.hfovDeg.toFixed(1)}°`,
    bgRatio: m.bgRatioVs24 ? `${m.bgRatioVs24.toFixed(1)}×` : null,
    mode,
  };
}
