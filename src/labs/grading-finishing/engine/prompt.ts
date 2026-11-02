import { STOCKS } from "./stocks";
import type { Look } from "./look";

/**
 * A deterministic prompt phrase describing the look, for Seedance and other text-to-video models.
 * Built only from the numbers, in a fixed order: stock, temperature, contrast, colour, glow, texture,
 * lens, stylization.
 */
export function lookPhrase(l: Look): string {
  const g = l.grade, f = l.finish, s = l.stylize;
  const parts: string[] = [];
  const warm = g.temperature > 0.15 ? "warm" : g.temperature < -0.15 ? "cool" : "";
  const stock = g.stock !== "none" && g.stockMix > 0.3 ? STOCKS[g.stock] : null;
  if (stock) parts.push(warm && !stock.words.startsWith(warm) ? `${warm} ${stock.words.replace(/^(warm|muted) /, "")}` : stock.words);
  else if (g.tint < -0.35) parts.push(`${warm ? `${warm} ` : ""}green-tinted digital grade`);
  else if (warm) parts.push(`${warm} colour grade`);
  if (g.contrast > 1.12) parts.push("punchy high contrast");
  else if (g.contrast < 0.88) parts.push("soft low contrast");
  const sp = g.split;
  if (sp.shadowAmt > 0.2 && sp.highlightAmt > 0.2) parts.push(`${hueWord(sp.shadowHue)} shadows and ${hueWord(sp.highlightHue)} highlights`);
  if (g.saturation < 0.75) parts.push("desaturated colour");
  else if (g.saturation > 1.2) parts.push("vivid saturated colour");
  if (f.halation.amount > 0.15) parts.push(f.halation.amount > 0.6 ? "strong red halation around highlights" : "soft halation on practicals");
  if (f.bloom.amount > 0.15) parts.push(f.bloom.mist > 0.45 ? "dreamy Pro-Mist diffusion" : "gentle Pro-Mist bloom");
  if (f.grain.amount > 0.08) parts.push(f.grain.amount > 0.55 || f.grain.size > 2.2 ? "heavy 16mm-style grain" : "fine organic film grain");
  if (f.lens.streaks > 0.2) parts.push("anamorphic horizontal lens flares");
  if (f.lens.distortion > 0.06) parts.push("slight barrel distortion");
  if (f.lens.aberration > 0.25) parts.push("chromatic fringing at the frame edges");
  if (f.vignette.amount > 0.2) parts.push("subtle vignette");
  if (f.sharpen > 0.3) parts.push("crisp detail");
  if (f.weave > 0.2) parts.push("gentle gate weave");
  if (s.mode === "comic" && s.amount > 0.2) parts.push(`comic-book print texture with halftone dots${s.misregister > 0.5 ? ", offset colour registration" : ""}${s.ink > 0.3 ? ", inked outlines" : ""}${s.stepped ? ", animated on twos" : ""}`);
  if (s.mode === "painterly" && s.amount > 0.2) parts.push("painterly brushwork with visible paper texture, illustrated look");
  if (!parts.length) return "clean digital look, neutral colour, no grain";
  return parts.join(", ");
}

function hueWord(h: number): string {
  const x = ((h % 360) + 360) % 360;
  if (x < 15 || x >= 340) return "red";
  if (x < 45) return "orange";
  if (x < 70) return "golden";
  if (x < 150) return "green";
  if (x < 210) return "teal";
  if (x < 260) return "blue";
  if (x < 300) return "violet";
  return "magenta";
}

/** What text-to-video models tend to render well, and why post is still the reliable unifier. */
export const AI_FINISHING_NOTE = [
  "Models follow broad looks well: warm or cool grades, a named film-stock feel, soft bloom, vignettes and anamorphic flares usually appear when asked.",
  "They are unreliable at the fine, repeatable layer: grain structure changes from shot to shot (or is smoothed away by the codec), halation comes and goes, and two generations never match colour exactly.",
  "So prompt for the lighting and the broad look, then add grain, halation and the final grade in post with one show preset. The same numbers on every shot is what makes clips from different days and models cut together.",
] as const;
