"use client";

import { applyChain } from "./engine/grade";
import { simpleFromLook, type LookId, type LookPatch, type SimpleSliders } from "./engine/look";
import { lookPhrase } from "./engine/prompt";
import { frameStats, type Frame, type FrameStats } from "./engine/scopes";
import type { ShowLookDoc } from "./engine/showlook";
import type { ShowStep } from "./engine/shots";
import type { SceneId } from "@/labs/lens-and-framing/config";
import { mainParams } from "./runtime/Orchestrator";
import { captureQueue, live, sampleQueue } from "./runtime/live";
import { autoBalance, showMetric } from "./runtime/metrics";
import { SHOTS } from "./engine/shots";
import { gfStore, type GFState, type Mode, type NodeId, type View } from "./store";
import { currentCube, currentShowDoc } from "./ui/DeliverPanel";

export interface Sample extends Frame {
  data: number[];
  stats: FrameStats;
}

export interface GradingLabHook {
  getState: () => GFState & { simple: SimpleSliders; mismatch: number | null; mismatchRaw: number | null; phrase: string; frameId: number; grainFrame: number };
  applyLook: (id: LookId) => void;
  patchLook: (p: LookPatch) => void;
  setSimple: (k: keyof SimpleSliders, v: number) => void;
  reset: () => void;
  setNode: (id: NodeId, on: boolean) => void;
  setNodes: (on: Partial<Record<NodeId, boolean>>) => void;
  setMode: (m: Mode) => void;
  setView: (v: View) => void;
  setShot: (id: SceneId) => void;
  setStep: (s: ShowStep) => void;
  autoBalanceAll: () => void;
  suggestOverride: () => void;
  pause: () => void;
  play: () => void;
  seek: (t: number) => void;
  /** Resolves after n more rendered frames. */
  frames: (n?: number) => Promise<number>;
  /** Pixels of a monitor's finished output (never the wipe); `before` returns the untouched source. */
  sample: (o?: { slot?: string; width?: number; height?: number; before?: boolean }) => Promise<Sample>;
  /** The engine's grade (for the main monitor) applied to code values 0–255, to check the GLSL mirror. */
  engineGrade: (rgb: number[]) => number[];
  cube: () => { name: string; text: string };
  showDoc: () => ShowLookDoc;
  /** The clean develop output at w×h as a JPEG data URL (plate capture). */
  capturePlate: (w: number, h: number) => Promise<string>;
}

export function installGradingHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return () => {};
  const S = gfStore.getState;
  const frames = (n = 2) =>
    new Promise<number>((resolve) => {
      const start = live.frameId;
      const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
      poll();
    });
  const hook: GradingLabHook = {
    getState: () => {
      const s = S();
      const m = showMetric(s);
      return { ...s, simple: simpleFromLook(s.look), mismatch: m?.now ?? null, mismatchRaw: m?.raw ?? null, phrase: lookPhrase(s.look), frameId: live.frameId, grainFrame: live.grainFrame };
    },
    applyLook: (id) => S().applyLook(id),
    patchLook: (p) => S().patchLook(p),
    setSimple: (k, v) => S().setSimple(k, v),
    reset: () => S().resetLook(),
    setNode: (id, on) => S().setNode(id, on),
    setNodes: (on) => gfStore.setState({ nodes: { ...S().nodes, ...on } }),
    setMode: (m) => S().setMode(m),
    setView: (v) => S().setView(v),
    setShot: (id) => S().setShot(id),
    setStep: (s) => S().setStep(s),
    autoBalanceAll: () => {
      for (const s of SHOTS) {
        const m = autoBalance(s.id);
        if (m) S().setMatch(s.id, m);
      }
    },
    suggestOverride: () => S().suggestOverride(),
    pause: () => S().pause(),
    play: () => S().play(),
    seek: (t) => S().seek(t),
    frames,
    sample: (o = {}) =>
      new Promise<Sample>((resolve) => {
        sampleQueue.push({
          slot: o.slot ?? "main",
          width: o.width ?? 320,
          height: o.height ?? 180,
          before: o.before ?? false,
          resolve: (f) => resolve({ width: f.width, height: f.height, data: Array.from(f.data), stats: frameStats(f) }),
        });
      }),
    engineGrade: (rgb) => {
      const chain = mainParams(S()).layers;
      const out: number[] = [];
      for (let i = 0; i < rgb.length; i += 3) {
        const v = applyChain([rgb[i] / 255, rgb[i + 1] / 255, rgb[i + 2] / 255], chain);
        out.push(v[0] * 255, v[1] * 255, v[2] * 255);
      }
      return out;
    },
    cube: () => currentCube(),
    showDoc: () => currentShowDoc(),
    capturePlate: (w, h) =>
      new Promise<string>((resolve) => {
        captureQueue.push({
          width: w,
          height: h,
          resolve: (f) => {
            const c = document.createElement("canvas");
            c.width = f.width;
            c.height = f.height;
            const ctx = c.getContext("2d")!;
            const img = ctx.createImageData(f.width, f.height);
            img.data.set(f.data as Uint8Array);
            ctx.putImageData(img, 0, 0);
            resolve(c.toDataURL("image/jpeg", 0.93));
          },
        });
      }),
  };
  const w = window as unknown as { __gradingLab?: GradingLabHook };
  w.__gradingLab = hook;
  return () => {
    delete w.__gradingLab;
  };
}
