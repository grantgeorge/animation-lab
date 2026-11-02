import { LUMA, linearToOklab, toLinear, type RGB } from "./color";

/**
 * Video scopes from a small readback of the graded frame (RGBA bytes, top row first).
 * Each returns normalised densities (0–1) ready to draw; the shapes are the standard ones a colorist
 * reads in Resolve: waveform (luma per column), RGB parade, vectorscope (Cb/Cr) and histogram.
 */
export interface Frame {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

const normalise = (a: Float32Array) => {
  let max = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i];
  if (max > 0) for (let i = 0; i < a.length; i++) a[i] = Math.min(1, Math.sqrt(a[i] / max) * 1.15);
  return a;
};

/** Luma waveform: width × bins, bin 0 = black. Code-value (Rec.709) luma, as on a real scope. */
export function waveform(f: Frame, bins = 64): Float32Array {
  const out = new Float32Array(f.width * bins);
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      const l = (f.data[i] * LUMA[0] + f.data[i + 1] * LUMA[1] + f.data[i + 2] * LUMA[2]) / 255;
      out[x * bins + Math.min(bins - 1, Math.floor(l * bins))]++;
    }
  return normalise(out);
}

/** RGB parade: three waveforms (R, G, B), each width × bins. */
export function parade(f: Frame, bins = 64): [Float32Array, Float32Array, Float32Array] {
  const out = [new Float32Array(f.width * bins), new Float32Array(f.width * bins), new Float32Array(f.width * bins)] as [Float32Array, Float32Array, Float32Array];
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      for (let c = 0; c < 3; c++) out[c][x * bins + Math.min(bins - 1, Math.floor((f.data[i + c] / 255) * bins))]++;
    }
  return [normalise(out[0]), normalise(out[1]), normalise(out[2])];
}

/** Rec.709 Cb/Cr of a code-value colour, each in about [−0.5, 0.5]. */
export function cbcr(r: number, g: number, b: number): [number, number] {
  const y = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
  return [(b - y) / 1.8556, (r - y) / 1.5748];
}

/** Vectorscope: size × size density, centre = neutral, red toward the top-left as in Resolve. */
export function vectorscope(f: Frame, size = 72): Float32Array {
  const out = new Float32Array(size * size);
  const n = f.width * f.height;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const [cb, cr] = cbcr(f.data[i] / 255, f.data[i + 1] / 255, f.data[i + 2] / 255);
    const x = Math.round((cb * 1.6 + 0.5) * (size - 1));
    const y = Math.round((0.5 - cr * 1.6) * (size - 1));
    if (x >= 0 && x < size && y >= 0 && y < size) out[y * size + x]++;
  }
  return normalise(out);
}

/** Histogram: R, G, B and luma, each `bins` long. */
export function histogram(f: Frame, bins = 64): { r: Float32Array; g: Float32Array; b: Float32Array; l: Float32Array } {
  const h = { r: new Float32Array(bins), g: new Float32Array(bins), b: new Float32Array(bins), l: new Float32Array(bins) };
  const n = f.width * f.height;
  const bin = (v: number) => Math.min(bins - 1, Math.floor((v / 255) * bins));
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    h.r[bin(f.data[i])]++;
    h.g[bin(f.data[i + 1])]++;
    h.b[bin(f.data[i + 2])]++;
    h.l[bin(f.data[i] * LUMA[0] + f.data[i + 1] * LUMA[1] + f.data[i + 2] * LUMA[2])]++;
  }
  let max = 0;
  for (const a of [h.r, h.g, h.b, h.l]) for (let i = 1; i < bins - 1; i++) max = Math.max(max, a[i]);
  if (max > 0) for (const a of [h.r, h.g, h.b, h.l]) for (let i = 0; i < bins; i++) a[i] = Math.min(1, a[i] / max);
  return h;
}

/** Summary numbers for tests and readouts (code values 0–1). */
export interface FrameStats {
  mean: RGB;
  /** Standard deviation of luma: the frame's contrast spread. */
  lumaStd: number;
  /** Mean squared luma difference between horizontal neighbours: fine texture (grain, sharpening). */
  localVar: number;
  /** Mean OKLab chroma. */
  chroma: number;
}

export function frameStats(f: Frame): FrameStats {
  const n = f.width * f.height;
  let r = 0, g = 0, b = 0, s = 0, s2 = 0, lv = 0, ch = 0, lvN = 0;
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      const R = f.data[i] / 255, G = f.data[i + 1] / 255, B = f.data[i + 2] / 255;
      r += R; g += G; b += B;
      const l = R * LUMA[0] + G * LUMA[1] + B * LUMA[2];
      s += l; s2 += l * l;
      if (x > 0) {
        const j = i - 4;
        const l0 = (f.data[j] * LUMA[0] + f.data[j + 1] * LUMA[1] + f.data[j + 2] * LUMA[2]) / 255;
        lv += (l - l0) * (l - l0);
        lvN++;
      }
      const lab = linearToOklab([toLinear(R), toLinear(G), toLinear(B)]);
      ch += Math.hypot(lab[1], lab[2]);
    }
  const m = s / n;
  return { mean: [r / n, g / n, b / n], lumaStd: Math.sqrt(Math.max(0, s2 / n - m * m)), localVar: lvN ? lv / lvN : 0, chroma: ch / n };
}
