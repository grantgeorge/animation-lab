import { rng } from "./noise";

/**
 * Stroke layout for the tileable brush tile. Every stroke is a tapered dab of gouache:
 * position, length, width, a small angle jitter around the tile's stroke direction, a value,
 * a warm/cool hue id and a "break" id the shading uses to cut the terminator along strokes.
 * Strokes that cross the tile border are repeated on the opposite side so the tile wraps.
 */
export interface Stroke {
  x: number;
  y: number;
  length: number;
  width: number;
  angle: number;
  value: number;
  hue: number;
  mask: number;
  bristles: number;
  seed: number;
}

export interface LayoutOptions {
  size: number;
  count: number;
  seed: number;
  /** Length and width ranges in pixels. */
  length: [number, number];
  width: [number, number];
  /** Angle jitter (radians) around horizontal. */
  jitter: number;
}

export const TILE_LAYOUT: LayoutOptions = { size: 512, count: 760, seed: 7, length: [46, 120], width: [12, 26], jitter: 0.2 };

export function strokeLayout(o: LayoutOptions = TILE_LAYOUT): Stroke[] {
  const r = rng(o.seed);
  const out: Stroke[] = [];
  for (let i = 0; i < o.count; i++) {
    out.push({
      x: r() * o.size,
      y: r() * o.size,
      length: o.length[0] + r() * (o.length[1] - o.length[0]),
      width: o.width[0] + r() * (o.width[1] - o.width[0]),
      angle: (r() * 2 - 1) * o.jitter,
      value: 0.18 + r() * 0.64,
      hue: r(),
      mask: r(),
      bristles: 5 + Math.floor(r() * 6),
      seed: Math.floor(r() * 2 ** 31),
    });
  }
  return out;
}

/** The copies of a stroke needed so the tile wraps seamlessly: offsets (in px) to draw it at. */
export function wrapOffsets(s: Stroke, size: number): [number, number][] {
  const reach = s.length / 2 + s.width;
  const xs = [0];
  const ys = [0];
  if (s.x - reach < 0) xs.push(size);
  if (s.x + reach > size) xs.push(-size);
  if (s.y - reach < 0) ys.push(size);
  if (s.y + reach > size) ys.push(-size);
  const out: [number, number][] = [];
  for (const dx of xs) for (const dy of ys) out.push([dx, dy]);
  return out;
}
