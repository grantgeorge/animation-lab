"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DemoProps } from "./demos/controls";
import type { Chapter, ProcessDemo } from "./types";

function Loading() {
  return (
    <div className="grid aspect-video place-items-center bg-[#0b0f16]">
      <p className="mono text-[11px] text-ink-2">Loading demonstration…</p>
    </div>
  );
}

/** Each demonstration is its own client-only chunk, loaded only when its chapter's process view opens. */
const DEMOS: Record<ProcessDemo, ComponentType<DemoProps>> = {
  drawings: dynamic(() => import("./demos/DrawingsDemo"), { loading: Loading, ssr: false }),
  parallax: dynamic(() => import("./demos/LayerDemo"), { loading: Loading, ssr: false }),
  reuse: dynamic(() => import("./demos/ReuseDemo"), { loading: Loading, ssr: false }),
  composite: dynamic(() => import("./demos/CompositeDemo"), { loading: Loading, ssr: false }),
  rig: dynamic(() => import("./demos/RigDemo"), { loading: Loading, ssr: false }),
  "secondary-motion": dynamic(() => import("./demos/SecondaryMotionDemo"), { loading: Loading, ssr: false }),
  cadence: dynamic(() => import("./demos/CadenceDemo"), { loading: Loading, ssr: false }),
  conditioning: dynamic(() => import("./demos/ConditioningDemo"), { loading: Loading, ssr: false }),
};

export function ProcessStage({ chapter, note, reducedMotion }: { chapter: Chapter; note: boolean; reducedMotion: boolean }) {
  const Demo = DEMOS[chapter.processDemo];
  return <Demo note={note} reducedMotion={reducedMotion} />;
}
