import { colorName, kelvinWord, luminance } from "./color";
import { analyze, formatRatio } from "./ratio";
import { describeAzimuth, describeElevation } from "./spherical";
import type { LightParams, Rig } from "./types";

const HEIGHT_PHRASE: Record<ReturnType<typeof describeElevation>, string> = {
  underlight: "from below",
  "eye level": "at eye level",
  raised: "slightly above eye level",
  high: "from high above",
  overhead: "from overhead",
};

const hardness = (l: LightParams) => (l.softness < 0.25 ? "hard" : l.softness >= 0.6 ? "soft" : "");
const colourWord = (l: LightParams) => {
  const w = kelvinWord(l.kelvin);
  return w === "white" ? "" : w;
};
const words = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/** "from camera left at 45°", "from behind, camera right", "from near the camera". */
function direction(l: LightParams): string {
  const { side, screen, abs } = describeAzimuth(l.azimuthDeg);
  if (side === "front") return screen === "centre" ? "from the camera position" : `from near the camera, slightly camera ${screen}`;
  if (side === "back") return screen === "centre" ? "from directly behind" : `from behind, camera ${screen}`;
  if (side === "three-quarter back") return `from behind camera ${screen} at ${abs}°`;
  return `from camera ${screen} at ${abs}°`;
}

function keyPhrase(l: LightParams): string {
  if (!l.on || l.intensity <= 0) return "no key light";
  const { side } = describeAzimuth(l.azimuthDeg);
  const back = side === "back" || side === "three-quarter back";
  const height = describeElevation(l.elevationDeg);
  if (back && l.elevationDeg < 15) return `${words(hardness(l), colourWord(l), "backlight", direction(l))}, low on the horizon`;
  const noun = side === "front" ? "frontal key" : back ? "key backlight" : side === "side" ? "side key" : "key";
  return `${words(hardness(l), colourWord(l), noun, direction(l))}, ${HEIGHT_PHRASE[height]}`;
}

function fillPhrase(l: LightParams, eKey: number, eFill: number): string {
  if (!l.on || eFill <= 0.02 * Math.max(eKey, 1e-6)) return "no fill";
  const { side, screen } = describeAzimuth(l.azimuthDeg);
  const from = side === "front" || screen === "centre" ? "from the camera" : `from camera ${screen}`;
  return words(hardness(l) === "hard" ? "hard" : "soft", colourWord(l), "fill", from);
}

function rimPhrase(l: LightParams, eKey: number, eRim: number): string | null {
  if (!l.on || eRim <= 0) return null;
  const rel = eRim / Math.max(eKey, 1e-6);
  const strength = rel >= 1.1 ? "strong" : rel < 0.45 ? "subtle" : "";
  return words(strength, colourWord(l), "rim light separating the silhouette");
}

function shadowPhrase(rig: Rig, ratio: number): string | null {
  const k = rig.lights.key;
  if (!k.on || k.intensity <= 0) return null;
  const { side } = describeAzimuth(k.azimuthDeg);
  const back = side === "back" || side === "three-quarter back";
  if (k.shadows && k.elevationDeg < 15 && back) return "long shadows stretching toward camera";
  if (ratio <= 2.2) return "minimal shadows";
  if (!k.shadows) return null;
  if (k.softness < 0.25) return "crisp hard-edged shadows";
  if (k.softness >= 0.6) return "soft diffused shadows";
  return null;
}

function backgroundPhrase(rig: Rig): string {
  const env = rig.env;
  const glow = env.glowStrength * luminance(env.glowColor);
  if (glow > 0.25) {
    const top = colorName(env.glowTopColor);
    const base = colorName(env.glowColor);
    return top !== base ? `${base} glow on the backdrop fading to ${top}` : `${base} glow on the backdrop`;
  }
  const bg = luminance(env.cycColor) * (0.4 + env.ambient);
  if (bg > 0.12) return `bright ${colorName(env.cycColor)} backdrop`;
  if (env.ambient < 0.08 && glow < 0.05) return "background falling off to black";
  const name = colorName(env.cycColor);
  return /^(dark|deep|near-black|charcoal)/.test(name) ? `${name} backdrop` : `dark ${name} backdrop`;
}

function gradePhrase(rig: Rig, eAmbient: number, fillOff: boolean): string | null {
  const parts: string[] = [];
  if (fillOff && eAmbient < 0.02) parts.push("deep blacks");
  const s = rig.env.saturation;
  if (s < 0.3) parts.push("desaturated near-monochrome");
  else if (s < 0.8) parts.push("muted colours");
  else if (s > 1.1) parts.push("bright saturated colours");
  return parts.length ? parts.join(", ") : null;
}

/**
 * A short lighting phrase for an AI video prompt, built deterministically from the rig.
 * Pass the effective rig (after solo / take-apart) so the words match the picture.
 */
export function buildPrompt(rig: Rig, opts: { lead?: string } = {}): string {
  const a = analyze(rig);
  const { key, fill, rim } = rig.lights;
  const lead = opts.lead ?? (a.keyStyle === "high-key" ? "high-key lighting" : a.keyStyle === "low-key" ? "low-key lighting" : "moderate-contrast lighting");
  const fillText = fillPhrase(fill, a.e.key, a.e.fill);
  const ratioText = a.e.key <= 0 ? null : Number.isFinite(a.ratio) && a.ratio < 64 ? `${formatRatio(a.ratio)} key-to-fill ratio` : "extreme contrast";
  const goboText = key.on && key.gobo >= 0.4 ? "venetian blind shadow stripes across the face and wall" : null;
  const parts = [
    lead,
    keyPhrase(key),
    fillText,
    rimPhrase(rim, a.e.key, a.e.rim),
    ratioText,
    goboText,
    shadowPhrase(rig, a.ratio),
    backgroundPhrase(rig),
    gradePhrase(rig, a.e.ambient, fillText === "no fill"),
  ];
  return parts.filter((p): p is string => !!p).join(", ");
}
