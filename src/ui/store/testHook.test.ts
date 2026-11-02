import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "@/renderer/runtime/session";
import { presentation } from "@/renderer/runtime/presentation";
import { viewports } from "@/renderer/runtime/viewports";
import { installTestHook, type AnimationLabHook } from "./testHook";

let browser: { __animationLab?: AnimationLabHook };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  browser = {};
  vi.stubGlobal("window", browser);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  session.params.e2e = true;
  session.frameId = 0;
  presentation.settled = true;
  viewports.markTransition(0);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("lab settle hook", () => {
  it("keeps requesting frames through the final rendered-frame check", async () => {
    const invalidate = vi.fn(() => { session.frameId++; });
    const cleanup = installTestHook(invalidate);
    const done = browser.__animationLab!.settle({ timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(64);
    await expect(done).resolves.toBeGreaterThan(2);
    expect(invalidate.mock.calls.length).toBeGreaterThan(2);
    cleanup();
    expect(browser.__animationLab).toBeUndefined();
  });

  it("times out if rendering stops after the camera has settled", async () => {
    let calls = 0;
    installTestHook(() => { if (++calls <= 2) session.frameId++; });
    const result = expect(browser.__animationLab!.settle({ timeoutMs: 80 })).rejects.toThrow("settle timeout at frame 2");
    await vi.advanceTimersByTimeAsync(100);
    await result;
  });

  it("only removes the hook installed by its own mount", () => {
    const oldCleanup = installTestHook(() => {});
    const newCleanup = installTestHook(() => {});
    const current = browser.__animationLab;
    oldCleanup();
    expect(browser.__animationLab).toBe(current);
    newCleanup();
    expect(browser.__animationLab).toBeUndefined();
  });
});
