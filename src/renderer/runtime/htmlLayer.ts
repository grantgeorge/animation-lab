import { viewports } from "./viewports";

/**
 * The DOM layer that holds in-scene labels (drei <Html portal>). It sits over the canvas, under the UI,
 * clipped to the studio slot. When the studio is the main view, its camera inset is excluded.
 */
export const htmlLayer: { current: HTMLDivElement | null } = { current: null };

type Rect = { left: number; top: number; width: number; height: number };

export function labelClipPath(stage: Rect | null, shot: Rect | null) {
  if (!stage || stage.width < 2 || stage.height < 2) return "inset(100%)";
  const { left: l, top: t, width: w, height: h } = stage;
  const r = l + w;
  const b = t + h;
  const outer = `${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px ${t}px`;
  // The smaller stage is drawn on top of the main shot, so it must retain its labels.
  if (!shot || shot.width * shot.height >= w * h) return `polygon(${outer})`;
  const x0 = Math.max(l, shot.left);
  const y0 = Math.max(t, shot.top);
  const x1 = Math.min(r, shot.left + shot.width);
  const y1 = Math.min(b, shot.top + shot.height);
  if (x1 <= x0 || y1 <= y0) return `polygon(${outer})`;
  return `polygon(evenodd, ${outer}, ${x0}px ${y0}px, ${x0}px ${y1}px, ${x1}px ${y1}px, ${x1}px ${y0}px, ${x0}px ${y0}px)`;
}

export function updateHtmlLayerClip() {
  const el = htmlLayer.current;
  if (!el) return;
  const shot = viewports.get("shot");
  const stage = viewports.get("stage");
  el.style.clipPath = labelClipPath(stage?.css ?? null, shot?.css ?? null);
  el.dataset.stageW = String(stage?.css.width ?? 0);
}
