import { expect, test, type Page } from "@playwright/test";

type Hook = {
  getState: () => { kind: string; experiment: string; sceneId: string; playing: boolean; params: { t0: number; t1: number }; seek: (t: number) => void; pause: () => void; setOverride: (w: string, p: number[]) => void };
  live: () => { t: number; frameId: number; focal: number[]; fractions: number[] };
  frames: (n?: number) => Promise<number>;
};
declare global {
  interface Window {
    __cameraLab?: Hook;
  }
}

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/labs/camera-movement?e2e=1&quality=low${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__cameraLab, null, { timeout: 30_000 });
  await page.evaluate(() => window.__cameraLab!.frames(3));
  return { errors };
}

/** Pause, jump to t, wait for frames, read the live readouts. */
async function at(page: Page, t: number) {
  await page.evaluate(async (t) => {
    const h = window.__cameraLab!;
    h.getState().pause();
    h.getState().seek(t);
    await h.frames(3);
  }, t);
  return page.evaluate(() => window.__cameraLab!.live());
}

test("camera movement lab renders the stage and a live shot without errors", async ({ page }) => {
  const { errors } = await open(page);
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-kind", "dollyIn");
  await expect(page.getByTestId("monitor-A")).toBeVisible();
  await expect(page.getByTestId("prompt-phrase")).toContainText(/dolly in/i);
  const live = await page.evaluate(() => window.__cameraLab!.live());
  expect(live.fractions[0]).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("picking a move updates the path analysis and the prompt", async ({ page }) => {
  await open(page);
  await page.getByTestId("move-truck").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-kind", "truck");
  await expect(page.getByTestId("move-components")).toContainText("truck right");
  await page.getByTestId("move-orbit").click();
  await expect(page.getByTestId("move-components")).toContainText(/arc (left|right)/);
  await page.keyboard.press("Digit5");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-kind", "pan");
});

test("dolly vs zoom: same subject size at both ends, different lenses, two monitors", async ({ page }) => {
  await open(page);
  await page.getByTestId("exp-dolly-vs-zoom").click();
  await expect(page.getByTestId("monitor-B")).toBeVisible();
  const { t0, t1 } = await page.evaluate(() => window.__cameraLab!.getState().params);
  const s = await at(page, t0);
  expect(s.fractions[0]).toBeCloseTo(s.fractions[1], 2);
  const e = await at(page, t1 + 0.2);
  expect(Math.abs(e.fractions[0] / e.fractions[1] - 1)).toBeLessThan(0.03);
  expect(e.focal[1]).toBeGreaterThan(e.focal[0] * 2);
  // The background tells them apart.
  const bgA = await page.getByTestId("monitor-bg-A").textContent();
  const bgB = await page.getByTestId("monitor-bg-B").textContent();
  const num = (s: string | null) => Number(/([\d.]+)×/.exec(s ?? "")?.[1]);
  expect(num(bgB)).toBeGreaterThan(num(bgA) * 1.2);
});

test("dolly zoom holds the subject size while the focal length more than doubles", async ({ page }) => {
  await open(page);
  await page.getByTestId("exp-dolly-zoom").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-kind", "dollyZoom");
  const { t0, t1 } = await page.evaluate(() => window.__cameraLab!.getState().params);
  const a = await at(page, t0);
  const b = await at(page, (t0 + t1) / 2);
  const c = await at(page, t1 + 0.2);
  for (const x of [b, c]) expect(Math.abs(x.fractions[0] / a.fractions[0] - 1)).toBeLessThan(0.03);
  expect(c.focal[0] / a.focal[0]).toBeGreaterThan(2);
});

test("scene switch and path edits", async ({ page }) => {
  await open(page);
  await page.getByTestId("scene-alley").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-scene", "alley");
  await page.getByTestId("move-tracking").click();
  await expect(page.getByTestId("prompt-phrase")).toContainText(/tracking shot moving with Pip/);
  await page.getByTestId("move-truck").click();
  await expect(page.getByTestId("reset-path")).toBeDisabled();
  await page.evaluate(() => window.__cameraLab!.getState().setOverride("end", [2, 2.2, 1]));
  await expect(page.getByTestId("reset-path")).toBeEnabled();
  await page.getByTestId("reset-path").click();
  await expect(page.getByTestId("reset-path")).toBeDisabled();
});


for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`focused workspace fits ${viewport.width} by ${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const { errors } = await open(page, "freeze=2.5");
    await page.waitForTimeout(1200);
    const root = page.getByTestId("lab-root");
    expect(await root.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const picture = (await page.getByTestId("movement-picture").boundingBox())!;
    const frame = (await page.getByTestId("monitor-window-A").boundingBox())!;
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 2);
    expect(frame.x).toBeGreaterThanOrEqual(picture.x - 1);
    expect(frame.y).toBeGreaterThanOrEqual(picture.y - 1);
    expect(frame.x + frame.width).toBeLessThanOrEqual(picture.x + picture.width + 1);
    expect(frame.y + frame.height).toBeLessThanOrEqual(picture.y + picture.height + 1);
    if (viewport.width > 900) {
      const controls = (await page.getByTestId("move-controls").boundingBox())!;
      expect(picture.x + picture.width).toBeLessThanOrEqual(controls.x);
    }
    await page.screenshot({ path: testInfo.outputPath("workspace.png") });
    await page.getByTestId("amount-slider").scrollIntoViewIfNeeded();
    await page.getByTestId("amount-slider").fill("2.5");
    await expect(page.getByTestId("amount-readout")).toContainText("2.5");
    await page.getByTestId("move-advanced").locator("summary").click();
    await expect(page.getByTestId("t0-slider")).toBeVisible();
    await page.getByTestId("view-studio").click();
    await expect(root).toHaveAttribute("data-primary", "studio");
    if (viewport.width === 1440) {
      await page.waitForTimeout(200);
      await page.screenshot({ path: testInfo.outputPath("studio.png") });
      await page.getByTestId("view-camera").click();
      await page.getByTestId("exp-dolly-vs-zoom").click();
      await page.waitForTimeout(1700);
      await page.screenshot({ path: testInfo.outputPath("comparison.png") });
    }
    if (viewport.width === 390) {
      await page.getByTestId("move-controls").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("phone-controls.png") });
    }
    await page.getByTestId("help-button").click();
    await expect(page.getByRole("dialog", { name: "Camera movement" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("help-button")).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test("native buttons retain Space activation and reduced motion starts paused", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  expect(await page.evaluate(() => window.__cameraLab!.getState().playing)).toBe(false);
  await page.getByTestId("move-truck").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-kind", "truck");
  expect(await page.evaluate(() => window.__cameraLab!.getState().playing)).toBe(false);
});

test("studio path handles still drag correctly inside the bounded viewport", async ({ page }) => {
  await open(page, "freeze=2.5");
  await page.getByTestId("move-truck").click();
  await page.getByTestId("view-studio").click();
  await page.evaluate(() => window.__cameraLab!.frames(3));
  const from = await page.evaluate(() => {
    const state = (window as unknown as { __cameraR3f: import("@react-three/fiber").RootState }).__cameraR3f;
    const view = (window.__cameraLab as unknown as { views: () => { move: { start: { position: number[] } } }[] }).views()[0];
    const v = [...view.move.start.position, 1];
    const mul = (m: number[], a: number[]) => [0, 1, 2, 3].map((r) => m[r] * a[0] + m[4 + r] * a[1] + m[8 + r] * a[2] + m[12 + r] * a[3]);
    const clip = mul(state.camera.projectionMatrix.elements, mul(state.camera.matrixWorldInverse.elements, v));
    const rect = document.querySelector('[data-testid="stage-window"]')!.getBoundingClientRect();
    return { x: rect.left + (clip[0] / clip[3] + 1) / 2 * rect.width, y: rect.top + (1 - clip[1] / clip[3]) / 2 * rect.height };
  });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 15, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("reset-path")).toBeEnabled();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-dragging", "");
});
