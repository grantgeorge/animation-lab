import { beforeEach, describe, expect, it } from "vitest";
import { getPreset } from "./engine/presets";
import { initializeStudio, studioStore } from "./store";

beforeEach(() => initializeStudio({ reducedMotion: false, freeze: null }));

describe("Lighting Studio session", () => {
  it("starts a fresh visit without leaking an edited rig or inspection state", () => {
    const s = studioStore.getState();
    s.applyPreset("sunset", { instant: true });
    s.setLight("key", { intensity: 12, kelvin: 3900 });
    s.setTakeApart(2);
    s.toggleSolo("rim");
    s.setView("inspect");
    s.setShotSize("wide");
    s.setPlaying(false);
    s.setHelpOpen(true);
    s.setDragging(true);
    studioStore.setState({ toasts: [{ id: 1, text: "Previous visit" }] });
    s.applyPreset("noir");

    initializeStudio({ reducedMotion: false, freeze: null });

    const fresh = studioStore.getState();
    expect(fresh.rig).toEqual(getPreset("three-point")!.rig);
    expect(fresh.rig).not.toBe(getPreset("three-point")!.rig);
    expect(fresh).toMatchObject({
      presetId: "three-point", modified: false, selected: "key", view: "shot",
      shotSize: "close", playing: true, solo: null, takeApart: null,
      helpOpen: false, dragging: false, transition: null, toasts: [],
    });
  });

  it("honors a linked look and framing with an independent rig", () => {
    initializeStudio({ reducedMotion: false, freeze: 1.6, presetId: "storybook", view: "inspect", shotSize: "close" });
    expect(studioStore.getState()).toMatchObject({ presetId: "storybook", view: "inspect", shotSize: "close", playing: false });
    expect(studioStore.getState().rig).toEqual(getPreset("storybook")!.rig);
    expect(studioStore.getState().rig.lights.key).not.toBe(getPreset("storybook")!.rig.lights.key);
    studioStore.getState().setLight("key", { kelvin: 10000 });
    expect(getPreset("storybook")!.rig.lights.key.kelvin).not.toBe(10000);
  });

  it("starts reduced-motion visits paused and permits explicit playback", () => {
    initializeStudio({ reducedMotion: true, freeze: null });
    expect(studioStore.getState().playing).toBe(false);
    studioStore.getState().applyPreset("noir");
    expect(studioStore.getState().transition).toBeNull();
    studioStore.getState().setPlaying(true);
    expect(studioStore.getState().playing).toBe(true);
  });
});
