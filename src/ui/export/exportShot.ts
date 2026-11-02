import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { buildShotExport } from "@/engine/export/build";
import { measure } from "@/engine/measure";
import { promptPhrase } from "@/engine/export/prompt";
import { labClock } from "@/renderer/runtime/clock";
import { labStore } from "@/ui/store/labStore";
import { labEvents } from "@/ui/store/events";
import { performanceFor } from "@/scene/animation/performances";

/** Export the canonical (settled) camera — not the eased in-between pose. */
export function currentShotExport() {
  const { camera } = labStore.getState();
  const t = labClock.peek();
  const m = measure(d, camera.rig, camera.targetId, { timeS: t, matchRef: camera.matchRef, mode: camera.mode });
  return buildShotExport(d, camera.rig, camera.mode, camera.targetId, m, { timeS: t, clipId: performanceFor(d.scene.id).id });
}

export function currentPhrase() {
  const { camera } = labStore.getState();
  return promptPhrase(measure(d, camera.rig, camera.targetId, { matchRef: camera.matchRef, mode: camera.mode })).phrase;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyShotJson() {
  const json = JSON.stringify(currentShotExport(), null, 2);
  const ok = await copy(json);
  labStore.getState().toast(ok ? `Copied shot settings JSON (${(json.length / 1024).toFixed(1)} KB)` : "Open the export drawer (X) and copy from there", "⇧C");
  if (ok) labEvents.emit({ type: "exportCopied", kind: "json" });
}

export async function copyShotPhrase() {
  const ok = await copy(currentPhrase());
  labStore.getState().toast(ok ? "Copied shot language" : "Select the line under the monitor and press ⌘C", "C");
  if (ok) labEvents.emit({ type: "exportCopied", kind: "phrase" });
}
