import { expect, test, type Locator } from "@playwright/test";
import type { RootState } from "@react-three/fiber";
import { camera, lastFrame, openLab, settle } from "./helpers/lab";

async function bounds(el: Locator) {
  const box = await el.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("the camera-first workspace separates the picture, controls and comparisons", async ({ page }) => {
  await openLab(page, "freeze=2.5&nomotion=1");
  await settle(page);
  await expect(page.getByTestId("view-shot")).toHaveAttribute("aria-pressed", "true");
  const picture = await bounds(page.getByTestId("lens-picture"));
  const controls = await bounds(page.getByTestId("camera-controls"));
  const strip = await bounds(page.getByTestId("filmstrip"));
  expect(picture.x + picture.width).toBeLessThanOrEqual(controls.x);
  expect(picture.y + picture.height).toBeLessThanOrEqual(strip.y);
  for (const id of ["stage-slot", "monitor-window"]) {
    const box = await bounds(page.getByTestId(id));
    expect(box.x).toBeGreaterThanOrEqual(picture.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(picture.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(picture.x + picture.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(picture.y + picture.height + 1);
  }
  const shot = await bounds(page.getByTestId("monitor-window"));
  expect(shot.width / shot.height).toBeCloseTo(16 / 9, 2);
});

test("reset restores camera settings while keeping the paused performance frame", async ({ page }) => {
  await openLab(page, "freeze=2.5&nomotion=1");
  await page.getByTestId("preset-85").click();
  await page.getByTestId("target-secondary").click();
  await page.getByTestId("mode-match").click();
  await page.getByTestId("reset-camera").click();
  await settle(page);
  const c = await camera(page);
  expect(c.rig.focalMm).toBe(50);
  expect(c.rig.railS).toBe(0);
  expect(c.mode).toBe("fixed");
  expect(c.targetId).toBe("primary");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-time-s", "2.500");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-playing", "false");
});

test("native button and range keys work, and the field guide restores focus", async ({ page }) => {
  await openLab(page, "freeze=2.5&nomotion=1");
  await page.getByTestId("preset-85").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-focal-mm", "85");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-playing", "false");
  await page.getByTestId("focal-slider").focus();
  await page.keyboard.press("ArrowRight");
  expect((await camera(page)).rig.focalMm).toBe(86);
  expect((await camera(page)).rig.railS).toBe(0);
  await page.getByTestId("help-button").click();
  await expect(page.getByRole("dialog", { name: "Lens & Framing" })).toBeVisible();
  await page.keyboard.press("Digit2");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-focal-mm", "86");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help")).not.toBeVisible();
  await expect(page.getByTestId("help-button")).toBeFocused();
});

test("saved shots restore their scene, lens and paused performance time", async ({ page }) => {
  await openLab(page, "freeze=2.5&nomotion=1&scene=workshop");
  await page.getByTestId("lesson-toggle").click();
  await page.getByTestId("start-ex3").click();
  await page.getByTestId("preset-85").click();
  await page.getByTestId("scrubber").fill("2.5");
  await settle(page);
  await page.getByTestId("save-reaction").click();
  const saved = await camera(page);
  await page.getByTestId("scene-alley").click();
  await page.getByTestId("preset-24").click();
  await page.getByTestId("lesson-card").getByRole("button", { name: /85 mm/ }).click();
  await settle(page);
  expect((await camera(page)).rig).toEqual(saved.rig);
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-scene", "workshop");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-playing", "false");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-time-s", "2.500");
  await expect(page).toHaveURL(/scene=workshop/);
});

test("returning from the lab directory starts a fresh camera session", async ({ page }) => {
  await openLab(page, "freeze=2.5&nomotion=1");
  await page.getByTestId("preset-85").click();
  await page.getByTestId("view-stage").click();
  await page.getByTestId("home-link").click();
  await page.getByTestId("lab-card-lens-and-framing").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-focal-mm", "50");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-primary", "shot");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-playing", "true");
});

test("phone controls stay reachable and paused viewports redraw after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page, "freeze=2.5&nomotion=1");
  await settle(page);
  expect(await page.getByTestId("lab-root").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const before = await lastFrame(page);
  await page.getByTestId("distance-slider").scrollIntoViewIfNeeded();
  await page.getByTestId("distance-slider").fill("4");
  await expect(page.getByTestId("distance-slider")).toHaveValue("4");
  await page.getByTestId("composition-guides").getByText("Composition guides", { exact: false }).click();
  await expect(page.getByTestId("toggle-thirds")).toBeVisible();
  await page.getByTestId("lens-picture").scrollIntoViewIfNeeded();
  await settle(page);
  const after = await lastFrame(page);
  expect(after.frameId).toBeGreaterThan(before.frameId);
  const shot = await bounds(page.getByTestId("monitor-window"));
  const rect = after.shotRect!;
  expect(rect.x).toBeCloseTo(shot.x, 0);
  expect(844 - rect.y - rect.h).toBeCloseTo(shot.y, 0);
  expect(rect.w / rect.h).toBeCloseTo(16 / 9, 2);
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-time-s", "2.500");
  await page.getByTestId("open-export").scrollIntoViewIfNeeded();
  await page.getByTestId("open-export").click();
  const drawer = await bounds(page.getByTestId("export-drawer"));
  expect(drawer.x).toBeGreaterThanOrEqual(0);
  expect(drawer.x + drawer.width).toBeLessThanOrEqual(390);
});

test("resizing after full screen keeps the WebGL passes aligned with their DOM windows", async ({ page }) => {
  await openLab(page, "freeze=2.5&nomotion=1&scene=workshop");
  await page.getByTestId("expand-shot").click();
  await settle(page);
  await page.getByTestId("expand-shot").click();
  await settle(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await settle(page);
  // R3F's resize observer can update the canvas after the slot observer fires.
  await expect.poll(async () => {
    const rects = await page.evaluate(() => window.__animationLab!.rects() as { stage: { x: number; y: number; w: number; h: number }; shot: { x: number; y: number; w: number; h: number } });
    const canvas = await bounds(page.getByTestId("canvas-wrap").locator("canvas"));
    const shot = await bounds(page.getByTestId("monitor-window"));
    const stage = await bounds(page.getByTestId("stage-slot"));
    return Math.max(
      Math.abs(canvas.y + canvas.height - rects.shot.y - rects.shot.h - shot.y),
      Math.abs(canvas.y + canvas.height - rects.stage.y - rects.stage.h - stage.y),
    );
  }).toBeLessThan(1);
  expect((await lastFrame(page)).passes).toEqual(expect.arrayContaining(["stage", "shot", "thumbs"]));
});

for (const mode of ["full screen", "hidden interface"] as const) {
  test(`pausing in ${mode} stops rendering while preview tiles are hidden`, async ({ page }) => {
    await openLab(page);
    await page.waitForFunction(() => {
      const scene = (window as unknown as { __r3f?: RootState }).__r3f?.scene;
      return ["Bram", "Pip"].every((name) => scene?.getObjectByName(name)?.getObjectByName("LeftHand"));
    });
    await page.keyboard.press(mode === "full screen" ? "Shift+KeyF" : "Shift+KeyU");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("lab-root")).toHaveAttribute("data-playing", "false");
    await settle(page);
    // The view-switch toast can legitimately request one final redraw when it disappears.
    await expect(page.getByTestId("toast")).toHaveCount(0);
    await settle(page);
    await page.waitForTimeout(100);
    const stopped = await lastFrame(page);
    await page.waitForTimeout(350);
    expect((await lastFrame(page)).frameId).toBe(stopped.frameId);
    expect(stopped.passes).not.toContain("thumbs");
  });
}
