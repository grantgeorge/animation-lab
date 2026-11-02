/** Multiplane parallax: each plane moves in inverse proportion to its distance from the camera. */
export const PLANES = [
  { id: "background", label: "Background painting", distance: 8 },
  { id: "characters", label: "Character cels", distance: 2.4 },
  { id: "foreground", label: "Foreground lantern", distance: 1 },
] as const;
export type PlaneId = (typeof PLANES)[number]["id"];

/** Max horizontal travel of the nearest plane, in px of a 1920-wide frame. */
export const TRAVEL_PX = 170;

/**
 * Horizontal offset in px for each plane given camera travel c ∈ [-1, 1].
 * Flat: the whole image moves as one picture (every plane gets the character-plane rate).
 * Layered: rate ∝ 1 / distance, normalised so the nearest plane moves TRAVEL_PX.
 */
export function planeOffsets(c: number, mode: "flat" | "layered"): Record<PlaneId, number> {
  const near = Math.min(...PLANES.map((p) => p.distance));
  const mid = PLANES.find((p) => p.id === "characters")!.distance;
  const out = {} as Record<PlaneId, number>;
  for (const p of PLANES) out[p.id] = -c * TRAVEL_PX * (near / (mode === "flat" ? mid : p.distance));
  return out;
}
