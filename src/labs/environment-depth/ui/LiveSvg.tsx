"use client";

import { useEffect, useRef } from "react";
import { onAfterFrame } from "../runtime/live";

/**
 * An SVG whose contents follow the render loop without re-rendering React. `draw` returns the
 * viewBox and the inner markup (built only from our own numbers and labels).
 */
export function LiveSvg({ draw, className, testId, label }: { draw: () => { viewBox: string; body: string } | null; className?: string; testId?: string; label?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const fn = useRef(draw);
  const last = useRef("");
  useEffect(() => {
    fn.current = draw;
    last.current = "";
  });
  useEffect(
    () =>
      onAfterFrame(() => {
        const el = ref.current;
        if (!el) return;
        const d = fn.current();
        if (!d) {
          if (last.current) {
            el.innerHTML = "";
            last.current = "";
          }
          return;
        }
        const key = d.viewBox + d.body;
        if (key === last.current) return;
        last.current = key;
        el.setAttribute("viewBox", d.viewBox);
        el.innerHTML = d.body;
      }),
    [],
  );
  return <svg ref={ref} className={className} data-testid={testId} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="none" />;
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
