"use client";

import { useEffect, useRef } from "react";
import { session } from "@/renderer/runtime/session";

/** ?debug=1 — draw calls, triangles and per-phase timings from the orchestrator's frame records. */
export function DevStats() {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const f = session.frames.at(-1);
      if (!f || !ref.current) return;
      const recent = session.frames.slice(-30);
      const fps = recent.length > 1 ? (1000 * (recent.length - 1)) / recent.slice(1).reduce((a, r) => a + r.dtMs, 0) : 0;
      ref.current.textContent = [
        `frame ${f.frameId}  t ${f.t.toFixed(2)}s  ${fps.toFixed(0)} fps`,
        `calls ${f.calls}  tris ${(f.triangles / 1000).toFixed(0)}k`,
        `passes ${f.passes.join(" → ")}`,
        Object.entries(f.phases)
          .map(([k, v]) => `${k} ${v.toFixed(2)}ms`)
          .join("  "),
      ].join("\n");
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  return <pre ref={ref} className="mono pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-md bg-black/70 px-2 py-1 text-[10px] text-ink-1" data-testid="devstats" />;
}
