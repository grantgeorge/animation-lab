"use client";

import { useRef } from "react";
import type { Group } from "three";
import { DEG } from "@/engine/math";
import { sampleClip } from "./animation/dsl";
import { doorwayWave } from "./animation/performances/doorwayWave";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { WorldSet } from "./set/Set";

const doorClip = doorwayWave.clips.find((c) => c.character === "door")!;

/** The set, with its door leaf driven by the shared timeline. */
export function AnimatedSet() {
  const door = useRef<Group>(null);
  useFrameUpdater(({ t }) => {
    const ry = sampleClip(doorClip, t).get("leaf")?.ry ?? 0;
    if (door.current) door.current.rotation.y = ry * DEG;
  }, ORDER.POSE);
  return <WorldSet doorRef={door} />;
}
