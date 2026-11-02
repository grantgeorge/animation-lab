import { afterEach, expect, it, vi } from "vitest";
import { viewports } from "./viewports";

afterEach(() => {
  viewports.setCanvas(null);
  vi.unstubAllGlobals();
});

it("recomputes GL y positions when the canvas resizes after its DOM slots", () => {
  let callback: () => void = () => {};
  const watched = new Set<Element>();
  vi.stubGlobal("ResizeObserver", class {
    constructor(fn: () => void) { callback = fn; }
    observe(el: Element) { watched.add(el); }
    unobserve(el: Element) { watched.delete(el); }
  });
  let canvasHeight = 900;
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: canvasHeight }) } as HTMLElement;
  const slot = { offsetParent: {}, getBoundingClientRect: () => ({ left: 20, top: 100, width: 600, height: 400 }) } as unknown as HTMLElement;
  viewports.setCanvas(canvas);
  const unregister = viewports.register("shot", slot);
  const changed = vi.fn();
  const unsubscribe = viewports.subscribe(changed);
  expect(watched.has(canvas)).toBe(true);
  expect(viewports.get("shot")!.gl.y).toBe(400);
  canvasHeight = 667;
  callback();
  expect(viewports.get("shot")!.gl.y).toBe(167);
  expect(changed).toHaveBeenCalledOnce();
  const replacement = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }) } as HTMLElement;
  viewports.setCanvas(replacement);
  expect(watched.has(canvas)).toBe(false);
  expect(watched.has(replacement)).toBe(true);
  unregister();
  unsubscribe();
});
