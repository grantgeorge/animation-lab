"use client";

import { useCallback, useState } from "react";

/** Callback ref + content-box size, tracked with a ResizeObserver. */
export function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
