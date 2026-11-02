import { expect, test, type Page } from "@playwright/test";

const LAB = "/labs/lighting-studio";

/** Open the Lighting Studio with its test hook; collects console errors. */
async function openStudio(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${LAB}?e2e=1${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__lightingStudio, null, { timeout: 30_000 });
  await page.evaluate(() => window.__lightingStudio!.settle({ timeoutMs: 30_000 }));
  return { errors };
}

const settle = (page: Page) => page.evaluate(() => window.__lightingStudio!.settle({ timeoutMs: 30_000 }));
const light = (page: Page, id: "key" | "fill" | "rim") => page.evaluate((i) => window.__lightingStudio!.getState().rig.lights[i], id);
const prompt = (page: Page) => page.getByTestId("prompt-text");

test.describe("Lighting Studio", () => {
  test("opens on the three-point rig with readouts, prompt and a way home", async ({ page }) => {
    const { errors } = await openStudio(page);
    const root = page.getByTestId("lab-root");
    await expect(root).toHaveAttribute("data-preset", "three-point");
    await expect(root).toHaveAttribute("data-selected-light", "key");
    await expect(root).toHaveAttribute("data-view", "shot");
    await expect(root).toHaveAttribute("data-shot", "close");
    await expect(page.getByTestId("chip-ratio")).toContainText(":1");
    await expect(prompt(page)).toContainText("three-point");
    await expect(page.getByTestId("home-link")).toHaveAttribute("href", "/");
    await expect(page.getByTestId("light-panel")).toBeVisible();
    await expect(page.getByTestId("pip")).toBeVisible();
    expect(await page.evaluate(() => window.__lightingStudio!.frames())).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });

  test("keys 1–5 apply the five looks with a transition and rewrite the prompt", async ({ page }) => {
    await openStudio(page);
    const root = page.getByTestId("lab-root");
    const expected: [string, string, RegExp][] = [
      ["Digit1", "flat", /high-key children's animation/],
      ["Digit2", "storybook", /soft warm storybook/],
      ["Digit3", "dramatic", /8:1 key-to-fill/],
      ["Digit4", "noir", /venetian blind/],
      ["Digit5", "sunset", /backlight/],
    ];
    for (const [key, id, phrase] of expected) {
      await page.keyboard.press(key);
      await expect(root).toHaveAttribute("data-preset", id);
      await expect(page.getByTestId("toast").first()).toBeVisible();
      await expect(page.getByTestId(`preset-${id}`)).toHaveAttribute("aria-pressed", "true");
      await settle(page);
      await expect(root).toHaveAttribute("data-transitioning", "0");
      await expect(prompt(page)).toContainText(phrase);
    }
    // the sunset key really ended up low and behind him
    const k = await light(page, "key");
    expect(Math.abs(k.azimuthDeg)).toBeGreaterThan(150);
    expect(k.elevationDeg).toBeLessThan(12);
  });

  test("a look glides and settles on warm sunset lighting", async ({ page }) => {
    await openStudio(page);
    await page.evaluate(() => window.__lightingStudio!.applyPreset("dramatic", { instant: true }));
    await settle(page);
    await page.keyboard.press("Digit5");
    await expect(page.getByTestId("lab-root")).toHaveAttribute("data-transitioning", "1");
    await settle(page);
    expect((await light(page, "key")).kelvin).toBeLessThan(2600);
    expect(Math.abs((await light(page, "key")).azimuthDeg)).toBeGreaterThan(150);
  });

  test("take apart steps key → fill → rim → full", async ({ page }) => {
    await openStudio(page, "preset=dramatic");
    const root = page.getByTestId("lab-root");
    await page.getByTestId("take-apart-open").click();
    await expect(root).toHaveAttribute("data-step", "0");
    await expect(page.getByTestId("take-apart-detail")).toHaveAttribute("data-channel", "key");
    await expect(prompt(page)).toContainText("no fill");
    await page.keyboard.press("BracketRight");
    await expect(root).toHaveAttribute("data-step", "1");
    await expect(page.getByTestId("take-apart-detail")).toHaveAttribute("data-channel", "fill");
    await expect(prompt(page)).toContainText("8:1");
    await page.getByTestId("step-2").click();
    await expect(page.getByTestId("take-apart-detail")).toHaveAttribute("data-channel", "rim");
    await page.getByTestId("step-next").click();
    await expect(page.getByTestId("take-apart-detail")).toHaveAttribute("data-channel", "ambient");
    await page.keyboard.press("KeyT");
    await expect(root).toHaveAttribute("data-step", "");
  });

  test("select and solo lights from the keyboard and the panel", async ({ page }) => {
    await openStudio(page);
    const root = page.getByTestId("lab-root");
    await page.keyboard.press("KeyF");
    await expect(root).toHaveAttribute("data-selected-light", "fill");
    await expect(page.getByTestId("light-editor")).toHaveAttribute("data-light", "fill");
    await page.keyboard.press("KeyR");
    await expect(root).toHaveAttribute("data-selected-light", "rim");
    await page.keyboard.press("KeyS");
    await expect(root).toHaveAttribute("data-solo", "rim");
    await expect(page.getByTestId("chip-key")).toContainText("off");
    await page.getByTestId("solo-rim").click();
    await expect(root).toHaveAttribute("data-solo", "");
    await page.keyboard.press("KeyK");
    await expect(root).toHaveAttribute("data-selected-light", "key");
  });

  test("dragging the shot swings the selected light; sliders and the dial edit it", async ({ page }) => {
    await openStudio(page);
    const before = await light(page, "key");
    const canvas = (await page.getByTestId("canvas-wrap").boundingBox())!;
    const start = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 150, start.y - 40, { steps: 6 });
    await page.mouse.up();
    const after = await light(page, "key");
    expect(after.azimuthDeg).toBeGreaterThan(before.azimuthDeg + 30);
    expect(after.elevationDeg).toBeGreaterThan(before.elevationDeg);
    await expect(page.getByTestId("lab-root")).toHaveAttribute("data-modified", "1");

    await page.getByTestId("slider-kelvin").fill("2500");
    expect((await light(page, "key")).kelvin).toBe(2500);
    await expect(prompt(page)).toContainText(/warm amber (frontal |side )?key/);

    // drag the fill dot on the top-view dial to the far left of the dial
    const dot = page.getByTestId("dial-fill").locator("circle").nth(1);
    const dial = await page.getByTestId("dome-dial").boundingBox();
    const box = await dot.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(dial!.x + dial!.width * 0.12, dial!.y + dial!.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByTestId("lab-root")).toHaveAttribute("data-selected-light", "fill");
    expect((await light(page, "fill")).azimuthDeg).toBeLessThan(-60);
  });

  test("inspect view: lamps are labelled and draggable in 3D", async ({ page }) => {
    await openStudio(page, "preset=storybook");
    await page.keyboard.press("KeyV");
    const root = page.getByTestId("lab-root");
    await expect(root).toHaveAttribute("data-view", "inspect");
    await settle(page);
    await expect(page.getByTestId("gizmo-label-key")).toBeVisible();
    await expect(page.getByTestId("gizmo-label-rim")).toBeVisible();
    const before = await light(page, "rim");
    const p = await page.evaluate(() => window.__lightingStudio!.lampScreenPosition("rim"));
    expect(p).not.toBeNull();
    await page.mouse.move(p!.x, p!.y);
    await page.mouse.down();
    await page.mouse.move(p!.x - 90, p!.y + 60, { steps: 8 });
    await page.mouse.up();
    const after = await light(page, "rim");
    await expect(root).toHaveAttribute("data-selected-light", "rim");
    expect(Math.abs(after.azimuthDeg - before.azimuthDeg) + Math.abs(after.elevationDeg - before.elevationDeg)).toBeGreaterThan(5);
    expect(after.distanceM).toBeCloseTo(before.distanceM, 6);
    await page.getByTestId("pip-swap").click();
    await expect(root).toHaveAttribute("data-view", "shot");
  });

  test("copy, play/pause, help", async ({ page }) => {
    await openStudio(page, "preset=noir");
    const root = page.getByTestId("lab-root");
    await page.getByTestId("copy-prompt").click();
    await expect(page.getByTestId("toast").filter({ hasText: "copied" })).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("film noir");
    await expect(prompt(page)).toHaveText(clip);
    await page.getByTestId("copy-prompt").blur();
    await page.keyboard.press("Space");
    await expect(root).toHaveAttribute("data-playing", "false");
    await page.keyboard.press("Space");
    await expect(root).toHaveAttribute("data-playing", "true");
    await page.keyboard.press("Shift+Slash");
    await expect(page.getByTestId("help")).toBeVisible();
    await expect(page.getByTestId("help")).toHaveAccessibleName("Lighting Studio");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("help")).toBeHidden();
  });

  test("reduced motion starts paused and makes looks instant", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStudio(page);
    const root = page.getByTestId("lab-root");
    await expect(root).toHaveAttribute("data-nomotion", "1");
    await expect(root).toHaveAttribute("data-playing", "false");
    await page.keyboard.press("Digit4");
    await expect(root).toHaveAttribute("data-transitioning", "0");
    expect((await light(page, "key")).gobo).toBe(1);
    await page.getByTestId("play-toggle").click();
    await expect(root).toHaveAttribute("data-playing", "true");
  });

  test("advanced controls disclose on demand and Reset restores the current look", async ({ page }) => {
    await openStudio(page, "preset=storybook&nomotion=1");
    const root = page.getByTestId("lab-root");
    const original = await light(page, "key");
    const reset = page.getByTestId("reset-look");
    await expect(reset).toBeDisabled();
    await expect(page.getByTestId("slider-distance")).toBeHidden();
    await page.getByTestId("light-advanced").locator("summary").click();
    await page.getByTestId("slider-distance").fill("4.5");
    expect((await light(page, "key")).distanceM).toBe(4.5);
    await expect(root).toHaveAttribute("data-modified", "1");
    await expect(reset).toBeEnabled();
    await reset.click();
    await settle(page);
    await expect(root).toHaveAttribute("data-preset", "storybook");
    await expect(root).toHaveAttribute("data-modified", "0");
    expect(await light(page, "key")).toEqual(original);
  });

  test("Space activates focused buttons and arrows adjust only the focused slider", async ({ page }) => {
    await openStudio(page);
    const root = page.getByTestId("lab-root");
    await page.getByTestId("preset-storybook").focus();
    await page.keyboard.press("Space");
    await expect(root).toHaveAttribute("data-preset", "storybook");
    await expect(root).toHaveAttribute("data-playing", "true");
    await settle(page);
    const original = await light(page, "key");
    await page.getByTestId("slider-azimuth").focus();
    await page.keyboard.press("ArrowRight");
    expect((await light(page, "key")).azimuthDeg).toBe(original.azimuthDeg + 1);
    await expect(root).toHaveAttribute("data-playing", "true");
    await page.getByTestId("help-button").focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("help")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("help")).toBeHidden();
    await expect(page.getByTestId("help-button")).toBeFocused();
  });

  for (const [w, h] of [
    [1920, 1080],
    [1280, 800],
  ] as const) {
    test(`panels stay clear of each other at ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openStudio(page);
      const r = async (id: string) => (await page.getByTestId(id).boundingBox())!;
      const panel = await r("light-panel");
      const picture = await r("studio-picture");
      const pip = await r("pip");
      const bar = await r("preset-bar");
      const look = await r("look-card");
      expect(picture.x + picture.width).toBeLessThanOrEqual(panel.x + 1);
      expect(look.x + look.width).toBeLessThanOrEqual(panel.x + 1);
      expect(bar.x + bar.width).toBeLessThanOrEqual(panel.x + 1);
      expect(picture.y + picture.height).toBeLessThanOrEqual(look.y + 1);
      expect(look.y + look.height).toBeLessThanOrEqual(bar.y + 1);
      expect(pip.x).toBeGreaterThanOrEqual(picture.x);
      expect(pip.y).toBeGreaterThanOrEqual(picture.y);
      expect(pip.x + pip.width).toBeLessThanOrEqual(picture.x + picture.width + 1);
      expect(pip.y + pip.height).toBeLessThanOrEqual(picture.y + picture.height + 1);
      expect(panel.x + panel.width).toBeLessThanOrEqual(w);
    });
  }

  test("mobile keeps a clean picture and makes controls reachable by scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openStudio(page, "nomotion=1");
    const root = page.getByTestId("lab-root");
    const overflow = await root.evaluate((el) => ({ width: el.clientWidth, content: el.scrollWidth }));
    expect(overflow.content).toBeLessThanOrEqual(overflow.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const picture = (await page.getByTestId("studio-picture").boundingBox())!;
    expect(picture.width).toBeLessThanOrEqual(390);
    expect(picture.height).toBeGreaterThan(180);
    await page.getByTestId("preset-storybook").scrollIntoViewIfNeeded();
    await page.getByTestId("preset-storybook").click();
    await expect(root).toHaveAttribute("data-preset", "storybook");
    await page.getByTestId("slider-kelvin").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("slider-kelvin")).toBeInViewport();
    await page.getByTestId("slider-kelvin").fill("2500");
    expect((await light(page, "key")).kelvin).toBe(2500);
    await page.getByTestId("reset-look").click();
    await expect(root).toHaveAttribute("data-modified", "0");
  });

  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    test(`the camera keeps the same 16:9 composition in the main view and PiP at ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openStudio(page, "freeze=1.6&nomotion=1");
      const canvas = (await page.getByTestId("canvas-wrap").boundingBox())!;
      const main = await page.evaluate(() => window.__lightingStudio!.cameraFrame());
      expect(main.aspect).toBeCloseTo(16 / 9, 8);
      expect(main.viewport.width / main.viewport.height).toBeCloseTo(16 / 9, 8);
      expect(main.viewport.width).toBeLessThanOrEqual(canvas.width + 1);
      expect(main.viewport.height).toBeLessThanOrEqual(canvas.height + 1);
      expect(main.viewport.x + main.viewport.width / 2).toBeCloseTo(canvas.width / 2, 0);
      expect(main.viewport.y + main.viewport.height / 2).toBeCloseTo(canvas.height / 2, 0);

      await page.getByTestId("pip-swap").click();
      await expect(page.getByTestId("lab-root")).toHaveAttribute("data-view", "inspect");
      await settle(page);
      const inset = await page.evaluate(() => window.__lightingStudio!.cameraFrame());
      const pip = (await page.getByTestId("pip").boundingBox())!;
      expect(inset.projection).toEqual(main.projection);
      expect(inset.cameraWorld).toEqual(main.cameraWorld);
      expect(inset.viewport.width / inset.viewport.height).toBeCloseTo(16 / 9, 8);
      expect(inset.viewport.width).toBeLessThanOrEqual(pip.width + 1);
      expect(inset.viewport.height).toBeLessThanOrEqual(pip.height + 1);

      await page.getByTestId("pip-swap").click();
      await settle(page);
      const restored = await page.evaluate(() => window.__lightingStudio!.cameraFrame());
      expect(restored.projection).toEqual(main.projection);
      expect(restored.cameraWorld).toEqual(main.cameraWorld);
      expect(restored.viewport).toEqual(main.viewport);
    });
  }
});
