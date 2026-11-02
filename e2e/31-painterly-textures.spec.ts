import { expect, test, type Page } from "@playwright/test";
import { cellDiff, cellGrid } from "./helpers/pixels";

const LAB = "/labs/painterly-textures";

/** Open the lab with its test hook (lite cast, low quality); collects console errors. */
async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${LAB}?e2e=1&freeze=2${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__painterlyLab, null, { timeout: 30_000 });
  // the cast streams in and is painted on a later frame: give it a moment, then render on
  await frames(page, 4);
  await page.waitForTimeout(1500);
  await frames(page, 3);
  return { errors };
}

const frames = (page: Page, n = 2) => page.evaluate((k) => window.__painterlyLab!.frames(k), n);
const set = async (page: Page, patch: Parameters<NonNullable<Window["__painterlyLab"]>["set"]>[0]) => {
  await page.evaluate((p) => window.__painterlyLab!.set(p), patch);
  await frames(page, 3);
};
const grid = async (page: Page, testId: string) => cellGrid(await page.getByTestId(testId).screenshot(), 16, 9);
const meanDiff = (a: number[][], b: number[][]) => a.reduce((s, c, i) => s + cellDiff(c, b[i]), 0) / a.length;
const maxDiff = (a: number[][], b: number[][]) => Math.max(...a.map((c, i) => cellDiff(c, b[i])));

test.describe("Painterly Textures", () => {
  test("opens on the painted shot in Watch, with both prompts and no console errors", async ({ page }) => {
    const { errors } = await open(page);
    const root = page.getByTestId("lab-root");
    await expect(root).toHaveAttribute("data-lab", "painterly-textures");
    await expect(root).toHaveAttribute("data-mode", "watch");
    await expect(root).toHaveAttribute("data-section", "look");
    await expect(root).toHaveAttribute("data-layers", "texture shading projection overlays composite");
    await expect(page.getByTestId("look-frame")).toBeVisible();
    await expect(page.getByTestId("prompt-art")).toContainText("hand-painted character textures");
    await expect(page.getByTestId("prompt-art")).not.toContainText("grain");
    await expect(page.getByTestId("prompt-finishing")).toContainText("paper texture");
    await expect(page.getByTestId("home-link")).toHaveAttribute("href", "/");
    // the frame is a real picture, not a flat fill
    const cells = await grid(page, "look-frame");
    const lum = cells.map((c) => (c[0] + c[1] + c[2]) / 3);
    expect(Math.max(...lum) - Math.min(...lum)).toBeGreaterThan(40);
    expect(errors).toEqual([]);
  });

  test("each technique in the build-up changes the picture", async ({ page }) => {
    const { errors } = await open(page, "mode=experiment");
    await set(page, { wipe: 0 });
    const root = page.getByTestId("lab-root");
    await page.getByTestId("step-0").click();
    await frames(page, 3);
    await expect(root).toHaveAttribute("data-layers", "");
    let prev = await grid(page, "look-frame");
    const order = ["texture", "shading", "projection", "overlays", "composite"];
    for (let k = 1; k <= 5; k++) {
      await page.getByTestId(`step-${k}`).click();
      await expect(root).toHaveAttribute("data-layers", order.slice(0, k).join(" "));
      await expect(page.getByTestId("technique-detail")).toHaveAttribute("data-layer", order[k - 1]);
      await frames(page, 3);
      const cur = await grid(page, "look-frame");
      expect(meanDiff(prev, cur), `layer ${order[k - 1]} should change the frame`).toBeGreaterThan(1.2);
      prev = cur;
    }
    // a single layer switched off on its own also changes it, and the prompt follows
    await page.getByTestId("layer-shading").click();
    await expect(root).toHaveAttribute("data-layers", "texture projection overlays composite");
    await expect(page.getByTestId("prompt-art")).not.toContainText("graphic shadow shapes");
    await frames(page, 3);
    expect(meanDiff(prev, await grid(page, "look-frame"))).toBeGreaterThan(0.5);
    expect(errors).toEqual([]);
  });

  test("character and environment are painted independently, and the wipe shows clean 3D", async ({ page }) => {
    await open(page, "mode=experiment&layer=shading");
    await set(page, { wipe: 0 });
    const root = page.getByTestId("lab-root");
    const both = await grid(page, "look-frame");
    await page.getByTestId("paint-env").click();
    await expect(root).toHaveAttribute("data-paint-env", "0");
    await frames(page, 3);
    const charOnly = await grid(page, "look-frame");
    await page.getByTestId("paint-env").click();
    await page.getByTestId("paint-char").click();
    await expect(root).toHaveAttribute("data-paint-char", "0");
    await frames(page, 3);
    const envOnly = await grid(page, "look-frame");
    expect(meanDiff(both, charOnly)).toBeGreaterThan(1.5);
    // painting only the character changes far fewer cells than painting the whole set
    expect(meanDiff(both, envOnly)).toBeLessThan(meanDiff(both, charOnly));
    expect(maxDiff(both, envOnly)).toBeGreaterThan(3);
    await page.getByTestId("paint-char").click();
    // drag the wipe all the way right: the whole frame becomes the clean render
    const frame = page.getByTestId("look-frame");
    const box = (await frame.boundingBox())!;
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    expect(Number(await frame.getAttribute("data-wipe"))).toBeGreaterThan(0.97);
    await frames(page, 3);
    const wipedClean = await grid(page, "look-frame");
    await page.getByTestId("step-0").click();
    await set(page, { wipe: 0 });
    expect(meanDiff(wipedClean, await grid(page, "look-frame"))).toBeLessThan(1.5);
  });

  test("the crawl metric ranks surface-attached < screen-space < per-frame random", async ({ page }) => {
    test.setTimeout(120_000);
    const { errors } = await open(page, "test=surface&freeze=1.5");
    const root = page.getByTestId("lab-root");
    await expect(root).toHaveAttribute("data-section", "test");
    for (const v of ["surface", "screen", "random", "boil"]) await expect(page.getByTestId(`panel-${v}`)).toBeVisible();
    for (const t of [1.5, 4.5]) {
      await page.evaluate((x) => window.__painterlyLab!.seek(x), t);
      const r = await page.evaluate(() => window.__painterlyLab!.crawl());
      expect(r.surface, `t=${t} surface sticks`).toBeLessThan(r.screen);
      expect(r.screen, `t=${t} screen swims less than random boils`).toBeLessThan(r.random);
      expect(r.surface).toBeLessThan(1);
      expect(r.screen / Math.max(r.surface, 0.05)).toBeGreaterThan(2);
    }
    // held still: screen-space strokes stop swimming, per-frame strokes keep boiling
    await page.evaluate(() => window.__painterlyLab!.seek(3.0));
    const still = await page.evaluate(() => window.__painterlyLab!.crawl());
    expect(still.screen).toBeLessThan(0.3);
    expect(still.random).toBeGreaterThan(1);
    // the readouts show the measurement
    await expect(page.getByTestId("crawl-random")).not.toHaveText("0.0%");
    expect(errors).toEqual([]);
  });

  test("projection stretch grows as the camera swings off the projector", async ({ page }) => {
    await open(page, "mode=experiment");
    await set(page, { wipe: 0 });
    const stretch = () => page.evaluate(() => window.__painterlyLab!.stretch());
    expect(await stretch()).toBeCloseTo(1, 3);
    const at0 = await grid(page, "look-frame");
    const values: number[] = [];
    for (const yaw of [10, 22, 36]) {
      await set(page, { projYaw: yaw });
      values.push(await stretch());
    }
    expect(values[0]).toBeGreaterThan(1.02);
    expect(values[1]).toBeGreaterThan(values[0]);
    expect(values[2]).toBeGreaterThan(values[1]);
    await expect(page.getByTestId("stretch-meter")).toHaveAttribute("data-stretch", values[2].toFixed(3));
    expect(meanDiff(at0, await grid(page, "look-frame"))).toBeGreaterThan(3);
    // Watch always shoots from the projector
    await page.keyboard.press("KeyW");
    await frames(page, 3);
    expect(await stretch()).toBeCloseTo(1, 3);
  });

  test("modes, sections and deep links switch views", async ({ page }) => {
    const { errors } = await open(page, "mode=inspect&layer=projection");
    const root = page.getByTestId("lab-root");
    await expect(root).toHaveAttribute("data-mode", "inspect");
    await expect(root).toHaveAttribute("data-focus", "projection");
    await expect(root).toHaveAttribute("data-layers", "texture shading projection");
    await expect(page.getByTestId("observer-window")).toBeVisible();
    await expect(page.getByTestId("pip")).toBeVisible();
    await expect(page.getByTestId("matte-image")).toBeVisible();
    await page.getByTestId("inspect-shading").click();
    await expect(page.getByTestId("ramp-plot")).toHaveAttribute("data-bands", "3");
    await page.getByTestId("inspect-composite").click();
    await expect(page.getByTestId("stack-diagram")).toBeVisible();
    await page.getByTestId("inspect-texture").click();
    await expect(page.getByTestId("texture-swatch")).toBeVisible();
    await page.keyboard.press("KeyE");
    await expect(root).toHaveAttribute("data-mode", "experiment");
    await page.getByTestId("slider-bands").locator("input").fill("4");
    await expect(page.getByTestId("prompt-art")).toContainText("four-value");
    await page.getByTestId("slider-bands").locator("input").blur();
    await page.keyboard.press("KeyW");
    await expect(root).toHaveAttribute("data-mode", "watch");
    await page.keyboard.press("KeyT");
    await expect(root).toHaveAttribute("data-section", "test");
    await expect(page.getByTestId("crawl-chart")).toBeVisible();
    await page.getByTestId("mode-inspect").click();
    await expect(page.getByTestId("diff-strip")).toBeVisible();
    await page.keyboard.press("Digit4");
    await expect(root).toHaveAttribute("data-test", "boil");
    await expect(page).toHaveURL(/test=boil/);
    await expect(page).toHaveURL(/mode=inspect/);
    await page.getByTestId("help-button").click();
    await expect(page.getByTestId("help-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("help-dialog")).toBeHidden();
    expect(errors).toEqual([]);
  });
});
