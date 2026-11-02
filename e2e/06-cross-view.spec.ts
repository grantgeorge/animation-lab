import { expect, test } from "@playwright/test";
import { lastFrame, openLab, settle } from "./helpers/lab";
import { cellDiff, cellGrid } from "./helpers/pixels";

test.use({ viewport: { width: 1920, height: 1080 } });

test("through the lens, the stage and the monitor show the same world at the same time", async ({ page }) => {
  await openLab(page, "freeze=3.35&nomotion=1&dpr=1&tech=0&ui=0&observer=throughLens");
  await page.keyboard.press("KeyV"); // Studio is the main view; Camera is now the default.
  await expect(page.getByTestId("toast")).toHaveCount(0);
  await settle(page);
  await page.waitForTimeout(300);
  await settle(page);
  const f = await lastFrame(page);
  expect(f.passes).toEqual(expect.arrayContaining(["stage", "shot"]));
  const rects = await page.evaluate(() => window.__animationLab!.rects() as { stage: { x: number; y: number; w: number; h: number }; shot: { x: number; y: number; w: number; h: number } });
  const vh = 1080;
  const shotCss = { x: rects.shot.x, y: vh - rects.shot.y - rects.shot.h, w: rects.shot.w, h: rects.shot.h };
  const stageCss = { x: rects.stage.x, y: vh - rects.stage.y - rects.stage.h, w: rects.stage.w, h: rects.stage.h };
  // The studio slot may be any aspect. Through-lens mode contains the complete 16:9 film gate.
  const gateW = Math.min(stageCss.w, stageCss.h * 16 / 9);
  const gateH = gateW * 9 / 16;
  const gate = { x: stageCss.x + (stageCss.w - gateW) / 2, y: stageCss.y + (stageCss.h - gateH) / 2, width: gateW, height: gateH };
  const stagePng = await page.screenshot({ clip: gate });
  const shotPng = await page.screenshot({ clip: { x: shotCss.x, y: shotCss.y, width: shotCss.w, height: shotCss.h } });
  await test.info().attach("studio-film-gate", { body: stagePng, contentType: "image/png" });
  await test.info().attach("camera-monitor", { body: shotPng, contentType: "image/png" });
  const cols = 32, rows = 18;
  const a = cellGrid(stagePng, cols, rows);
  const b = cellGrid(shotPng, cols, rows);
  let compared = 0, ok = 0;
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      // Skip borders and stage cells covered by the monitor and its bezel.
      if (cx === 0 || cy === 0 || cx === cols - 1 || cy === rows - 1) continue;
      const x0 = gate.x + (cx / cols) * gate.width, y0 = gate.y + (cy / rows) * gate.height;
      const x1 = x0 + gate.width / cols, y1 = y0 + gate.height / rows;
      if (x1 > shotCss.x - 14 && x0 < shotCss.x + shotCss.w + 14 && y1 > shotCss.y - 14 && y0 < shotCss.y + shotCss.h + 14) continue;
      compared++;
      if (cellDiff(a[cy * cols + cx], b[cy * cols + cx]) <= 12) ok++;
    }
  expect(compared).toBeGreaterThan(300);
  expect(ok / compared).toBeGreaterThan(0.95);
});
