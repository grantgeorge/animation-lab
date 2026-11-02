import { expect, test } from "@playwright/test";
import { openLab, lastFrame } from "./helpers/lab";

test("the lab renders both passes with no console errors", async ({ page }, info) => {
  const { errors } = await openLab(page);
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : gl ? "webgl2 (renderer masked)" : null;
  });
  await info.attach("renderer", { body: renderer ?? "none", contentType: "text/plain" });
  expect(renderer).not.toBeNull();
  const f = await lastFrame(page);
  expect(f.passes).toEqual(expect.arrayContaining(["stage", "shot"]));
  expect(errors).toEqual([]);
});
