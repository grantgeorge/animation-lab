import { expect, test, type Page } from "@playwright/test";

const LAB = "/labs/timing-and-spacing";

async function openTiming(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${LAB}?e2e=1`);
  await page.waitForFunction(() => !!window.__timingLab, null, { timeout: 30_000 });
  return { errors };
}

const state = (page: Page) => page.evaluate(() => window.__timingLab!.getState());
const root = (page: Page) => page.getByTestId("lab-root");

test("loads with three synchronized views and autoplays", async ({ page }) => {
  const { errors } = await openTiming(page);
  await expect(root(page)).toHaveAttribute("data-comparison", "none");
  await expect(page.getByTestId("stage")).toBeVisible();
  await expect(page.getByTestId("trajectory")).toBeVisible();
  await expect(page.getByTestId("curve-editor")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-playing", "true");
  await expect.poll(async () => Number(await root(page).getAttribute("data-frame")), { timeout: 5_000 }).toBeGreaterThan(3);
  await page.evaluate(() => window.__timingLab!.pause());
  await expect(root(page)).toHaveAttribute("data-playing", "false");
  // One shared playhead: seeking moves the DOM mirror and the frame readout.
  await page.evaluate(() => window.__timingLab!.seek(30));
  await expect(root(page)).toHaveAttribute("data-frame", "30");
  await expect(page.getByTestId("frame-readout")).toContainText("030");
  expect(errors).toEqual([]);
});

test("keyboard: space, frame step, lessons, compare toggle, help", async ({ page }) => {
  await openTiming(page);
  await page.evaluate(() => {
    window.__timingLab!.pause();
    window.__timingLab!.seek(10);
  });
  await page.keyboard.press("Period");
  await expect(root(page)).toHaveAttribute("data-frame", "11");
  await page.keyboard.press("Comma");
  await page.keyboard.press("Comma");
  await expect(root(page)).toHaveAttribute("data-frame", "9");
  await page.keyboard.press("Space");
  await expect(root(page)).toHaveAttribute("data-playing", "true");
  await page.keyboard.press("Space");
  await expect(root(page)).toHaveAttribute("data-playing", "false");

  const ids = ["easing", "weight", "anticipation", "squash"];
  for (const [i, id] of ids.entries()) {
    await page.keyboard.press(`Digit${i + 1}`);
    await expect(root(page)).toHaveAttribute("data-comparison", id);
    await expect(page.getByTestId("lesson-strip")).toBeVisible();
    await expect(page.getByTestId("ai-tip")).not.toBeEmpty();
    await expect(page.getByTestId("lane-label-A")).toBeVisible();
    await expect(page.getByTestId("lane-label-B")).toBeVisible();
  }
  await page.keyboard.press("KeyC");
  await expect(root(page)).toHaveAttribute("data-comparison", "none");
  await page.keyboard.press("KeyC");
  await expect(root(page)).toHaveAttribute("data-comparison", "squash");

  await page.keyboard.press("Shift+Slash");
  await expect(page.getByTestId("help")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help")).toBeHidden();
});

test("lesson tabs are one click and each side changes only its variable", async ({ page }) => {
  await openTiming(page);
  await page.getByTestId("lesson-easing").click();
  await expect(root(page)).toHaveAttribute("data-comparison", "easing");
  await expect(page.getByTestId("trajectory-A")).toBeVisible();
  await expect(page.getByTestId("trajectory-B")).toBeVisible();
  const s = await state(page);
  expect(s.variants.map((v) => v.id)).toEqual(["A", "B"]);
  expect(s.variants[0].prompt).toContain("mechanical");
  expect(s.variants[1].prompt).toContain("hang at the top");
  await expect(page.getByTestId("curve-linear")).toBeDisabled();

  await page.getByTestId("lesson-anticipation").click();
  const a = await state(page);
  expect(a.variants[0].takeoffFrame).toBe(a.variants[1].takeoffFrame);
  await expect(page.getByTestId("anticipation")).toBeDisabled();

  await page.getByTestId("lesson-anticipation").click();
  await expect(root(page)).toHaveAttribute("data-comparison", "none");
  await expect(page.getByTestId("lesson-strip")).toHaveCount(0);
});

test("linear spacing is even, gravity spacing bunches at the apex", async ({ page }) => {
  await openTiming(page);
  await page.evaluate(() => window.__timingLab!.pause());
  const spacing = async () =>
    page.evaluate(() => {
      const lab = window.__timingLab!;
      const arc = lab.getState().variants[0].arcs[0];
      const f = lab.frames(0).slice(arc.takeoff, arc.apexFrame + 1);
      return f.slice(1).map((p, i) => Math.abs(p.y - f[i].y));
    });
  await page.getByTestId("curve-linear").click();
  await expect(root(page)).toHaveAttribute("data-curve", "linear");
  const lin = await spacing();
  expect(Math.max(...lin) - Math.min(...lin)).toBeLessThan(1e-3);
  await expect(page.getByTestId("prompt-main")).toContainText("constant-speed");

  await page.getByTestId("curve-gravity").click();
  await expect(root(page)).toHaveAttribute("data-curve", "gravity");
  const grav = await spacing();
  expect(grav[0] / grav[grav.length - 1]).toBeGreaterThan(5);
});

test("dragging a tangent handle edits the curve live", async ({ page }) => {
  await openTiming(page);
  await page.evaluate(() => window.__timingLab!.pause());
  const before = (await state(page)).params.rise;
  const handle = page.getByTestId("handle-riseP2");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await expect(root(page)).toHaveAttribute("data-curve", "custom");
  const after = (await state(page)).params;
  expect(after.rise.y2).toBeLessThan(before.y2);
  // Linked by default: the fall stays the time-mirror of the rise.
  expect(after.fall.y1).toBeCloseTo(1 - after.rise.y2, 6);
});

test("weight presets and squash change the motion; prompt copies", async ({ page }) => {
  await openTiming(page);
  await page.getByTestId("weight-bowling").click();
  await expect(root(page)).toHaveAttribute("data-weight", "bowling");
  await expect(page.getByTestId("prompt-main")).toContainText("heavy bowling-ball bounce");
  await page.evaluate(() => window.__timingLab!.setParams({ squash: 0 }));
  // Editing a weight value detaches the preset: the phrase now describes the numbers.
  await expect(root(page)).toHaveAttribute("data-weight", "custom");
  await expect(page.getByTestId("prompt-main")).toContainText("heavy, dense bounce");
  await expect(page.getByTestId("prompt-main")).toContainText("rigid, no squash or stretch");
  // Rigid: nothing ever stretches (only the anticipation crouch compresses).
  const stretches = await page.evaluate(() => window.__timingLab!.frames(0).map((f) => f.stretch));
  expect(Math.max(...stretches)).toBeCloseTo(1, 9);
  await page.getByTestId("copy-main").click();
  await expect(page.getByTestId("copy-main")).toHaveText("Copied");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("heavy, dense bounce");
});

test("playhead supports keyboard bounds without triggering global shortcuts", async ({ page }) => {
  await openTiming(page);
  await page.evaluate(() => { window.__timingLab!.pause(); window.__timingLab!.seek(12); });
  const scrubber = page.getByTestId("scrubber");
  await scrubber.focus();
  await page.keyboard.press("ArrowRight");
  await expect(root(page)).toHaveAttribute("data-frame", "13");
  await page.keyboard.press("End");
  const total = Number(await root(page).getAttribute("data-total-frames"));
  await expect(root(page)).toHaveAttribute("data-frame", String(total - 1));
  await page.keyboard.press("Home");
  await expect(root(page)).toHaveAttribute("data-frame", "0");
  await expect(root(page)).toHaveAttribute("data-playing", "false");
});

test("phone layout keeps comparisons and detailed controls usable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await openTiming(page);
  await page.evaluate(() => window.__timingLab!.pause());
  const noOverflow = () => page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="lab-root"]')!;
    return el.scrollWidth <= el.clientWidth;
  });
  expect(await noOverflow()).toBe(true);
  await page.getByTestId("lesson-anticipation").click();
  await expect(page.getByTestId("anticipation-details")).toHaveAttribute("open", "");
  await expect(page.getByTestId("anticipation")).toBeDisabled();
  await page.getByTestId("lesson-free").click();
  await page.getByTestId("bounce-details").locator("summary").click();
  await page.getByTestId("timing-constant").click();
  expect((await state(page)).params.physicalTiming).toBe(false);
  await page.getByTestId("follow-through-details").locator("summary").click();
  await page.getByTestId("follow-through").focus();
  await page.keyboard.press("End");
  expect((await state(page)).params.followThrough).toBe(1);
  expect(await noOverflow()).toBe(true);
  expect(errors).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("does not autoplay; shows a paused frame with a play button", async ({ page }) => {
    await openTiming(page);
    await expect(root(page)).toHaveAttribute("data-nomotion", "1");
    await page.waitForTimeout(400);
    await expect(root(page)).toHaveAttribute("data-playing", "false");
    const f = Number(await root(page).getAttribute("data-frame"));
    expect(f).toBeGreaterThan(0);
    await page.getByTestId("stage-play").click();
    await expect(root(page)).toHaveAttribute("data-playing", "true");
    await expect(page.getByTestId("stage-play")).toHaveCount(0);
  });
});
