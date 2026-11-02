import { NoColorSpace, Texture } from "three";
import type { Pixels } from "../engine/match";

/**
 * Gallery stills for the show-look exercise: one clean frame per shot (and a doorway re-shot with the
 * key light on the other side), captured from the live scenes by scripts/review/capture-gf-plates.mjs.
 * Loaded as raw code values (no colour-space conversion) so they enter the grade exactly like the
 * live develop output.
 */
export const PLATE_IDS = ["doorway", "alley", "workshop", "doorway-flipped"] as const;
export type PlateId = (typeof PLATE_IDS)[number];

export const plateUrl = (id: PlateId) => `/labs/grading-finishing/plates/${id}.jpg`;

/** CPU copy size for the match metric. */
export const PLATE_CPU = { width: 96, height: 54 };

const textures = new Map<PlateId, Texture>();
const pixels = new Map<PlateId, Pixels>();
let loading: Promise<void> | null = null;

export const plateTexture = (id: PlateId) => textures.get(id) ?? null;
export const platePixels = (id: PlateId) => pixels.get(id) ?? null;
export const platesLoaded = () => pixels.size === PLATE_IDS.length && textures.size === PLATE_IDS.length;

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`plate failed to load: ${url}`));
    img.src = url;
  });
}

export function loadPlates(): Promise<void> {
  if (loading) return loading;
  loading = Promise.all(
    PLATE_IDS.map(async (id) => {
      const img = await loadImage(plateUrl(id));
      const tex = new Texture(img);
      tex.colorSpace = NoColorSpace;
      tex.needsUpdate = true;
      textures.set(id, tex);
      const c = document.createElement("canvas");
      c.width = PLATE_CPU.width;
      c.height = PLATE_CPU.height;
      const ctx = c.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const px = new Float32Array(c.width * c.height * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        px[j] = data[i] / 255;
        px[j + 1] = data[i + 1] / 255;
        px[j + 2] = data[i + 2] / 255;
      }
      pixels.set(id, px);
    }),
  ).then(() => undefined);
  return loading;
}
