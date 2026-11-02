import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeLabSession, labStore } from "@/ui/store/labStore";
import { labClock } from "@/renderer/runtime/clock";
import { sceneDescriptor } from "@/labs/lens-and-framing/config";
import { attachLessonEngine, HOLD_MS, restoreShot, saveShot, startExercise } from "./LessonEngine";
import { initialProgress, lessonStore } from "./lessonStore";

let detach: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  initializeLabSession();
  lessonStore.setState({ active: null, progress: initialProgress(), completed: {}, shots: [] });
  detach = attachLessonEngine();
});
afterEach(() => {
  detach();
  vi.useRealTimers();
});

const hold = (f: number) => {
  labStore.getState().setFocal(f, "preset");
  vi.advanceTimersByTime(HOLD_MS + 10);
};

describe("lesson engine", () => {
  it("Ex1 needs 24, 50 and 85 each held ≥ 1 s in Fixed; the starting 50 mm does not count by itself", () => {
    startExercise("ex1");
    vi.advanceTimersByTime(3000);
    expect(lessonStore.getState().progress.ex1.held).toEqual([]);
    labStore.getState().setFocal(24, "preset");
    vi.advanceTimersByTime(999);
    expect(lessonStore.getState().progress.ex1.held).toEqual([]);
    vi.advanceTimersByTime(10);
    expect(lessonStore.getState().progress.ex1.held).toEqual([24]);
    hold(50);
    expect(lessonStore.getState().completed.ex1).toBeUndefined();
    hold(85);
    expect(lessonStore.getState().completed.ex1).toBeDefined();
  });

  it("Ex2 starts matched at 92 % and completes after 24 and 85 with real camera travel", () => {
    startExercise("ex2");
    const cam = labStore.getState().camera;
    expect(cam.mode).toBe("match");
    expect(cam.matchRef!.metric).toBeCloseTo(0.92, 3);
    hold(24);
    hold(85);
    const s = lessonStore.getState();
    expect(s.progress.ex2.travelM).toBeGreaterThan(2);
    expect(s.completed.ex2).toBeDefined();
  });

  it("Ex3 needs two different shots, one per objective", () => {
    startExercise("ex3");
    saveShot("reaction");
    saveShot("relationship");
    expect(lessonStore.getState().completed.ex3).toBeUndefined(); // identical shots don't count
    labStore.getState().setFocal(24, "preset");
    saveShot("relationship");
    expect(lessonStore.getState().completed.ex3).toBeDefined();
  });

  it("exercise setup does not count as a learner choice when entering from Match mode", () => {
    labStore.getState().setMode("match");
    startExercise("ex1");
    vi.advanceTimersByTime(HOLD_MS + 10);
    expect(lessonStore.getState().progress.ex1.held).toEqual([]);
  });

  it("cancels pending lesson progress when the lab unmounts", () => {
    startExercise("ex1");
    labStore.getState().setFocal(24, "preset");
    detach();
    vi.advanceTimersByTime(HOLD_MS + 10);
    expect(lessonStore.getState().progress.ex1.held).toEqual([]);
  });

  it("restores the saved scene before restoring its framing and performance time", () => {
    labStore.getState().setScene("workshop");
    labStore.getState().setFocal(85, "preset");
    labStore.getState().pause();
    labStore.getState().seek(2.5);
    const shot = saveShot(null);
    expect(shot.settings.sceneId).toBe("workshop");
    labStore.getState().setScene("alley");
    labStore.getState().setFocal(18, "preset");
    restoreShot(shot.id);
    expect(labStore.getState().ui.sceneId).toBe("workshop");
    expect(sceneDescriptor.scene.id).toBe("workshop");
    expect(labStore.getState().camera.rig).toEqual(shot.settings.rig);
    expect(labClock.peek()).toBe(2.5);
    expect(labStore.getState().timeline.playing).toBe(false);
  });

  it("restores legacy shots without scene metadata into the doorway set", () => {
    const shot = saveShot(null);
    const legacy = { ...shot, settings: { ...shot.settings } };
    delete legacy.settings.sceneId;
    lessonStore.setState({ shots: [legacy] });
    labStore.getState().setScene("workshop");
    restoreShot(legacy.id);
    expect(labStore.getState().ui.sceneId).toBe("doorway");
    expect(sceneDescriptor.scene.id).toBe("doorway");
  });
});
