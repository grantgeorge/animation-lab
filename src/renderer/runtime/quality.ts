export type QualityLevel = 0 | 1 | 2 | 3;

export interface QualitySpec {
  dpr: number;
  post: boolean;
  msaa: number;
  ao: boolean;
  shadowMap: number;
  thumbs: "live" | "idle" | "off";
}

export const QUALITY: Record<QualityLevel, QualitySpec> = {
  3: { dpr: 1.5, post: true, msaa: 4, ao: false, shadowMap: 2048, thumbs: "live" },
  2: { dpr: 1.25, post: true, msaa: 2, ao: false, shadowMap: 2048, thumbs: "live" },
  1: { dpr: 1, post: false, msaa: 0, ao: false, shadowMap: 1024, thumbs: "idle" },
  0: { dpr: 0.75, post: false, msaa: 0, ao: false, shadowMap: 512, thumbs: "off" },
};

/** Pixel-budget DPR: cap total pixels around 2.5 MP, between 1 and 1.5. */
export function budgetDpr(w: number, h: number, deviceDpr: number) {
  return Math.min(1.5, Math.max(1, Math.min(deviceDpr, 1.5, Math.sqrt(2.5e6 / Math.max(1, w * h)))));
}

export interface UrlParams {
  e2e: boolean;
  freeze: number | null;
  nomotion: boolean;
  dpr: number | null;
  quality: "high" | "low" | "auto" | null;
  ui: boolean;
  tech: boolean;
  post: boolean;
  observer: string | null;
  debug: boolean;
}

export function readUrlParams(search: string): UrlParams {
  const p = new URLSearchParams(search);
  const num = (k: string) => (p.has(k) && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : null);
  const q = p.get("quality");
  return {
    e2e: p.get("e2e") === "1",
    freeze: num("freeze"),
    nomotion: p.get("nomotion") === "1",
    dpr: num("dpr"),
    quality: q === "high" || q === "low" || q === "auto" ? q : null,
    ui: p.get("ui") !== "0",
    tech: p.get("tech") !== "0",
    post: p.get("post") !== "0",
    observer: p.get("observer"),
    debug: p.get("debug") === "1",
  };
}

export function resolveQuality(pref: "auto" | "high" | "low", params: UrlParams): { level: QualityLevel; spec: QualitySpec; dpr: number } {
  let level: QualityLevel = pref === "low" ? 1 : 3;
  if (params.quality === "high") level = 3;
  else if (params.quality === "low") level = 1;
  else if (params.e2e) level = 1;
  const spec = QUALITY[level];
  let dpr = spec.dpr;
  if (typeof window !== "undefined" && level === 3 && pref === "auto") dpr = budgetDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  if (params.dpr) dpr = params.dpr;
  return { level, spec, dpr };
}
