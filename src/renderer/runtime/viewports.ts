/**
 * DOM slot registry. The stage and the director's monitor are DOM elements laid out by CSS;
 * the orchestrator renders each pass into the slot's rectangle on the one shared canvas.
 */
export type SlotId = "stage" | "shot" | `thumb:${number}`;

export interface SlotRect {
  el: HTMLElement;
  /** CSS px relative to the canvas top-left. */
  css: { left: number; top: number; width: number; height: number };
  /** CSS px, y flipped for WebGL (origin bottom-left). */
  gl: { x: number; y: number; w: number; h: number };
}

const slots = new Map<SlotId, HTMLElement>();
const rects = new Map<SlotId, SlotRect>();
const listeners = new Set<() => void>();
let canvasEl: HTMLElement | null = null;
let observer: ResizeObserver | null = null;
let transitionUntil = 0;

function measure(id: SlotId) {
  const el = slots.get(id);
  if (!el || !canvasEl) return;
  const c = canvasEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const visible = el.offsetParent !== null || getComputedStyle(el).position === "fixed";
  const left = Math.round(r.left - c.left);
  const top = Math.round(r.top - c.top);
  const width = visible ? Math.round(r.width) : 0;
  const height = visible ? Math.round(r.height) : 0;
  rects.set(id, { el, css: { left, top, width, height }, gl: { x: left, y: Math.round(c.height) - top - height, w: width, h: height } });
}

function notify() {
  for (const l of listeners) l();
}

function observe(el: HTMLElement) {
  if (typeof ResizeObserver === "undefined") return;
  observer ??= new ResizeObserver(() => {
    viewports.measureAll();
    notify();
  });
  observer.observe(el);
}

export const viewports = {
  setCanvas(el: HTMLElement | null) {
    if (canvasEl !== el && canvasEl) observer?.unobserve(canvasEl);
    canvasEl = el;
    if (el) {
      // R3F updates the canvas size after the window/slot resize. Its height flips every GL y.
      observe(el);
      viewports.measureAll();
      notify();
    }
  },
  register(id: SlotId, el: HTMLElement) {
    slots.set(id, el);
    observe(el);
    measure(id);
    notify();
    return () => {
      observer?.unobserve(el);
      if (slots.get(id) === el) {
        slots.delete(id);
        rects.delete(id);
      }
      notify();
    };
  },
  get(id: SlotId): SlotRect | null {
    return rects.get(id) ?? null;
  },
  measureAll() {
    for (const id of slots.keys()) measure(id);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  /** Layout is animating (view swap): re-measure every frame until this passes. */
  markTransition(ms = 320) {
    transitionUntil = performance.now() + ms;
  },
  get layoutTransitioning() {
    return typeof performance !== "undefined" && performance.now() < transitionUntil;
  },
};

if (typeof window !== "undefined") {
  const remeasure = () => {
    if (!canvasEl) return;
    viewports.measureAll();
    notify();
  };
  window.addEventListener("resize", remeasure);
  // Scroll does not bubble, but capture observes the mobile workbench's overflow container.
  window.addEventListener("scroll", remeasure, { capture: true, passive: true });
}
