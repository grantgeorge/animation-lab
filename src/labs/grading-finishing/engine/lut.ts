import type { RGB } from "./color";

/**
 * A 3D LUT sampled from a pure colour function: what a grade becomes when it leaves this lab for
 * DaVinci Resolve. Only per-pixel colour maps fit in a LUT; grain, halation, bloom, lens effects and
 * anything else that looks at neighbouring pixels or time cannot.
 */
export function sampleLut(fn: (c: RGB) => RGB, size = 33): Float32Array {
  const out = new Float32Array(size * size * size * 3);
  let i = 0;
  const n = size - 1;
  // .cube order: red changes fastest, then green, then blue.
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const v = fn([r / n, g / n, b / n]);
        out[i++] = v[0];
        out[i++] = v[1];
        out[i++] = v[2];
      }
  return out;
}

/** Serialise to the Resolve / Adobe .cube text format. */
export function toCube(lut: Float32Array, size: number, title: string, comments: string[] = []): string {
  const lines = [
    `TITLE "${title.replace(/"/g, "'")}"`,
    ...comments.map((c) => `# ${c}`),
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];
  for (let i = 0; i < lut.length; i += 3) lines.push(`${fmt(lut[i])} ${fmt(lut[i + 1])} ${fmt(lut[i + 2])}`);
  return `${lines.join("\n")}\n`;
}

const fmt = (v: number) => Math.min(1, Math.max(0, v)).toFixed(6);

/** Minimal .cube reader (used by the tests to prove the format round-trips). */
export function parseCube(text: string): { size: number; title: string; data: Float32Array } {
  let size = 0;
  let title = "";
  const values: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("TITLE")) title = line.slice(5).trim().replace(/^"|"$/g, "");
    else if (line.startsWith("LUT_3D_SIZE")) size = Number(line.split(/\s+/)[1]);
    else if (line.startsWith("DOMAIN_")) continue;
    else {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) throw new Error(`bad .cube line: ${line}`);
      values.push(...parts);
    }
  }
  if (!size || values.length !== size * size * size * 3) throw new Error(`expected ${size}³ entries, got ${values.length / 3}`);
  return { size, title, data: new Float32Array(values) };
}
