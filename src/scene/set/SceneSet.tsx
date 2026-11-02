"use client";

import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { AnimatedSet } from "../Door";
import { AlleySet } from "./AlleySet";
import { WorkshopSet } from "./WorkshopSet";

/** The active scene's set. The lab remounts this subtree on a scene switch. */
export function SceneSet() {
  switch (d.scene.id) {
    case "alley":
      return <AlleySet />;
    case "workshop":
      return <WorkshopSet />;
    default:
      return <AnimatedSet />;
  }
}
