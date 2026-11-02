import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { distanceToPrimaryAlongRail, poseFromRig } from "@/engine/rig";
import { labClock } from "@/renderer/runtime/clock";
import { initializeLabSession, labStore } from "./labStore";
import { labEvents } from "./events";

beforeEach(() => {
  initializeLabSession();
  labEvents.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("lab store camera actions", () => {
  it("Fixed mode: focal changes never move or turn the camera", () => {
    const s = labStore.getState();
    const before = poseFromRig(d, s.camera.rig);
    for (const f of [24, 85, 135, 18]) s.setFocal(f, "preset");
    const after = poseFromRig(d, labStore.getState().camera.rig);
    expect(after.position.equals(before.position)).toBe(true);
    expect(after.quaternion.equals(before.quaternion)).toBe(true);
    expect(labStore.getState().camera.rig.focalMm).toBe(18);
  });

  it("Match mode: distance scales with focal length", () => {
    const s = labStore.getState();
    s.setMode("match");
    s.setFocal(24, "preset");
    const z24 = distanceToPrimaryAlongRail(d, labStore.getState().camera.rig.railS);
    expect(z24 / 3).toBeCloseTo(0.48, 3);
    expect(labEvents.recent().some((e) => e.type === "cameraTravelled")).toBe(true);
  });

  it("switching target never moves the camera, in either mode", () => {
    const s = labStore.getState();
    s.setMode("match");
    s.setFocal(35, "preset");
    const rig = { ...labStore.getState().camera.rig };
    s.setTarget("secondary");
    s.setTarget("both");
    expect(labStore.getState().camera.rig).toEqual(rig);
  });

  it("camera actions never touch the clock", () => {
    const spies = (["play", "pause", "seek", "setSpeed"] as const).map((k) => vi.spyOn(labClock, k));
    const s = labStore.getState();
    s.setFocal(85, "slider");
    s.setMode("match");
    s.setFocal(24, "slider");
    s.setDistance(2, "drag");
    s.setTarget("secondary");
    s.resetCamera();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("lab visit lifecycle", () => {
  it("resets transient state while keeping overlay and quality preferences", () => {
    const s = labStore.getState();
    s.setScene("workshop");
    s.setFocal(85, "preset");
    s.setMode("match");
    s.setPrimaryView("stage");
    s.toggleFullscreenShot();
    s.setUiHidden(true);
    s.setHelpOpen(true);
    s.setExportOpen(true);
    s.setQuality("low");
    labStore.setState((state) => ({ viz: { ...state.viz, thirds: true } }));
    s.setInteraction({ dragging: "dolly", selected: "camera" });

    initializeLabSession({ sceneId: "alley", reducedMotion: true, freeze: 2, observerPreset: "profile" });

    const fresh = labStore.getState();
    expect(d.scene.id).toBe("alley");
    expect(fresh.camera.rig).toEqual(d.defaultRig);
    expect(fresh.camera.mode).toBe("fixed");
    expect(fresh.ui).toMatchObject({ sceneId: "alley", primaryView: "shot", quality: "low", observerPresetId: "profile", uiHidden: false, helpOpen: false, exportOpen: false, fullscreenShot: false, toasts: [] });
    expect(fresh.viz.thirds).toBe(true);
    expect(fresh.interaction).toEqual({ dragging: null, hover: null, selected: null });
    expect(fresh.timeline).toMatchObject({ playing: false, seekTime: 2 });
    expect(labClock.isPlaying).toBe(false);
    expect(labClock.peek()).toBe(2);
  });

  it("opens reduced-motion sessions paused and allows explicit playback", () => {
    initializeLabSession({ reducedMotion: true });
    expect(labStore.getState().timeline.playing).toBe(false);
    expect(labClock.isPlaying).toBe(false);
    labStore.getState().play();
    expect(labStore.getState().timeline.playing).toBe(true);
    expect(labClock.isPlaying).toBe(true);
  });
});
