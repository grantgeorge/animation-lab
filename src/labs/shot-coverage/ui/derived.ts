"use client";

import { useMemo } from "react";
import { getScene } from "@/labs/lens-and-framing/config";
import { checkContinuity } from "../engine/continuity";
import { editStats, segments } from "../engine/edit";
import { buildMultiShotPrompt } from "../engine/prompt";
import { camSides } from "../engine/presets";
import { describeShot } from "../engine/shots";
import { durationOf, subjectsFor, useSC } from "../store";

/** Everything derived from cameras + edit, recomputed only when they change. */
export function useAnalysis() {
  const version = useSC((s) => s.version);
  const sceneId = useSC((s) => s.sceneId);
  const cameras = useSC((s) => s.cameras);
  const edit = useSC((s) => s.edit);
  return useMemo(() => {
    const d = getScene(sceneId);
    const subj = subjectsFor(sceneId);
    const T = durationOf(sceneId);
    const segs = segments(edit, T).map((g) => ({ ...g, shot: describeShot(cameras[g.cam], d, subj, (g.t0 + g.t1) / 2) }));
    return {
      T,
      segs,
      flags: checkContinuity(edit, cameras, d, subj),
      stats: editStats(edit, T),
      prompt: buildMultiShotPrompt(edit, cameras, d, subj, T),
      sides: camSides(cameras, d, subj),
      version,
    };
  }, [version, sceneId, cameras, edit]);
}
