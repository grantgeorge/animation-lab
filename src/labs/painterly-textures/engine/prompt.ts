import type { Layers, PaintParams } from "./types";

/**
 * The AI direction this lab writes, split in two because they are two different controls:
 * art style belongs in the generation prompt (it decides how every surface is rendered);
 * finishing is applied afterwards in post (grain, paper, halation, grade).
 */

function hueName(deg: number): string {
  const h = ((deg % 360) + 360) % 360;
  if (h < 20 || h >= 330) return "crimson";
  if (h < 50) return "warm umber";
  if (h < 80) return "ochre";
  if (h < 160) return "green";
  if (h < 200) return "teal";
  if (h < 250) return "cool blue";
  if (h < 290) return "blue-violet";
  return "violet";
}

export function strokePhrase(size: number): string {
  if (size < 0.75) return "fine, tight brushwork";
  if (size > 1.45) return "broad, loose gouache strokes";
  return "visible gouache brushwork";
}

export function bandPhrase(bands: number): string {
  const n = Math.round(bands);
  if (n <= 2) return "two-tone graphic shadow shapes";
  if (n === 3) return "graphic shadow shapes in three painted values";
  return "four-value painted light ramps";
}

export function artStylePrompt(layers: Layers, p: PaintParams, scope: { character: boolean; environment: boolean } = { character: true, environment: true }): string {
  const parts: string[] = [];
  if (layers.texture) {
    if (scope.character) parts.push(`hand-painted character textures with ${strokePhrase(p.strokeSize)}`);
    if (scope.environment) parts.push("textured, illustrated environment painted in colour blocks");
  }
  if (layers.shading) parts.push(bandPhrase(p.bands), `${hueName(p.shadowHue)} shadows against warm light`, "rim light as a single painted stroke");
  if (layers.projection) parts.push("matte-painted background");
  if (layers.overlays) parts.push("hand-painted light shafts, smoke and highlights");
  if (!parts.length) return "clean stylized 3D animation, smooth shading (no painterly style requested)";
  parts.push("painterly 3D animation, brushstrokes stay fixed to surfaces as characters move");
  return parts.join(", ");
}

export function finishingPrompt(layers: Layers, p: PaintParams): string {
  if (!layers.composite) return "none: no finishing pass";
  const paper = p.paper < 0.25 ? "very faint paper texture" : p.paper > 0.75 ? "pronounced watercolour-paper texture" : "subtle paper texture";
  return `${paper}, fine film grain, soft halation on the lamps, slightly darkened painted edges, gentle warm grade`;
}

export const TEMPORAL_NOTE = [
  "What crawls: fine stroke texture, hair and fabric detail, and anything a per-frame style pass re-invents. Big colour shapes rarely do.",
  "Ask for stable, surface-bound textures in the generation prompt (\"brushstrokes stay fixed to surfaces\"), not a painting filter on top.",
  "Avoid frame-by-frame style transfer over a clean render: every frame repaints the strokes and the result boils.",
  "Keep camera moves modest. Big orbits and fast turns are where AI painterly textures slide, like a projection seen off-axis.",
] as const;
