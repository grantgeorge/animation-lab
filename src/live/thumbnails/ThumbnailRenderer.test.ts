import { afterEach, expect, test, vi } from "vitest";
import { Scene, type WebGLRenderer } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { viewports, type SlotRect } from "@/renderer/runtime/viewports";
import { ThumbnailRenderer } from "./ThumbnailRenderer";

afterEach(() => vi.restoreAllMocks());

test("refreshes every cached lens when a loaded model replaces the paused fallback", () => {
  vi.spyOn(viewports, "get").mockReturnValue({ gl: { x: 0, y: 0, w: 256, h: 144 } } as SlotRect);
  const render = vi.fn();
  const gl = { setRenderTarget: vi.fn(), setScissorTest: vi.fn(), render } as unknown as WebGLRenderer;
  const scene = new Scene();
  const thumbs = new ThumbnailRenderer();
  const state = { rig: d.defaultRig, mode: "fixed" as const, target: "primary" as const, ref: null, version: 0, playing: false, t: 1.6 };
  const flush = () => {
    for (let frame = 0; frame < 6; frame++) thumbs.render(gl, scene, state);
    expect(thumbs.isDirty).toBe(false);
  };

  try {
    flush();
    expect(render).toHaveBeenCalledTimes(6);
    thumbs.render(gl, scene, state);
    expect(render).toHaveBeenCalledTimes(6);

    // RiggedCharacter increments this after committing the loaded model. No seek or dolly
    // movement is needed to retire a fallback image from any of the six render targets.
    scene.userData.thumbnailContentRevision = 1;
    flush();
    expect(render).toHaveBeenCalledTimes(12);

    scene.userData.thumbnailContentRevision = 2;
    flush();
    expect(render).toHaveBeenCalledTimes(18);
  } finally {
    thumbs.dispose();
  }
});
