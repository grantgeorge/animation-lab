import { expect, test } from "@playwright/test";
import { camera, openLab, settle } from "./helpers/lab";

/** Screen position (client px) of a world point seen by the observer camera. */
async function toScreen(page: import("@playwright/test").Page, p: [number, number, number]) {
  return page.evaluate((pt) => {
    const r3f = (window as unknown as { __r3f: { camera: { projectionMatrix: unknown }; gl: { domElement: HTMLCanvasElement } } }).__r3f;
    const cam = r3f.camera as unknown as { matrixWorldInverse: { elements: number[] }; projectionMatrix: { elements: number[] } };
    const v = [pt[0], pt[1], pt[2], 1];
    const mul = (m: number[], a: number[]) => [0, 1, 2, 3].map((r) => m[r] * a[0] + m[4 + r] * a[1] + m[8 + r] * a[2] + m[12 + r] * a[3]);
    const c = mul(cam.projectionMatrix.elements, mul(cam.matrixWorldInverse.elements, v));
    const rect = document.querySelector('[data-testid="stage-slot"]')!.getBoundingClientRect();
    return { x: rect.left + ((c[0] / c[3] + 1) / 2) * rect.width, y: rect.top + ((1 - c[1] / c[3]) / 2) * rect.height };
  }, p);
}

test("dragging the camera along the rail dollies it; a click selects it", async ({ page }) => {
  await openLab(page, "observer=profile");
  await page.getByTestId("view-stage").click();
  await settle(page);
  const start = (await camera(page)).rig.railS;
  const from = await toScreen(page, [-0.35, 0.9, 0.1]);
  const to = await toScreen(page, [-0.35, 0.9, -1.0]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) await page.mouse.move(from.x + ((to.x - from.x) * k) / 10, from.y + ((to.y - from.y) * k) / 10);
  await page.mouse.up();
  await settle(page);
  const c = await camera(page);
  expect(c.rig.railS).toBeGreaterThan(start + 0.6);
  expect(c.mode).toBe("fixed");
  expect(c.rig.focalMm).toBe(50);
  const st = await page.evaluate(() => window.__animationLab!.getState().interaction);
  expect(st.dragging).toBeNull();
  expect(st.selected).toBe("camera");
  await expect(page.getByTestId("distance-readout")).not.toContainText("3.00");
});
