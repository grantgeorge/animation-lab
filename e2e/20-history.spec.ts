import { expect, test, type Page } from "@playwright/test";

/** Wait until the URL-bound view has replaced the prerendered fallback. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("history")).toBeVisible();
  await expect(page.getByTestId("history-fallback")).toHaveCount(0);
}

// Animation History page (/history). Owned by the history feature; independent of the lab specs.

test.describe("Animation History", () => {
  test("opens on Drawings with poster and explanation, no inference calls", async ({ page }) => {
    const falCalls: string[] = [];
    page.on("request", (r) => {
      if (/fal\.(run|ai|media)/.test(r.url())) falCalls.push(r.url());
    });
    await open(page, "/history");
    await expect(page.getByTestId("chapter-title")).toHaveText("Drawings");
    await expect(page.getByTestId("stage")).toHaveAttribute("data-chapter", "drawings");
    await expect(page.locator('[data-testid="media-player"] video')).toHaveAttribute("poster", /posters\/clip-drawings/);
    for (const id of ["multiplane", "television", "digital-2d", "cg", "simulation", "stylization", "generative"]) await page.getByTestId(`era-${id}`).click();
    expect(falCalls).toEqual([]);
  });

  test("never shows a clip under another chapter's title", async ({ page }) => {
    await open(page, "/history");
    for (const id of ["multiplane", "television", "drawings", "generative"]) {
      await page.getByTestId(`era-${id}`).click();
      await expect(page.getByTestId("stage")).toHaveAttribute("data-chapter", id);
      const asset = await page.getByTestId("media-player").getAttribute("data-asset");
      expect(asset).toBe(id === "generative" ? "exp-hero" : `clip-${id}`);
    }
  });

  test("URL state: keyboard nav, back/forward, invalid ids", async ({ page }) => {
    await open(page, "/history");
    await page.getByTestId("era-drawings").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/chapter=multiplane/);
    await expect(page.getByTestId("era-multiplane")).toBeFocused();
    await page.getByTestId("view-process").click();
    await expect(page).toHaveURL(/view=process/);
    await page.goBack();
    await expect(page.getByTestId("stage")).toHaveAttribute("data-view", "watch");
    await page.goBack();
    await expect(page.getByTestId("chapter-title")).toHaveText("Drawings");
    await open(page, "/history?chapter=nope");
    await expect(page.getByTestId("chapter-title")).toHaveText("Drawings");
  });

  test("parallax: flat moves together, layered moves near planes faster", async ({ page }) => {
    await open(page, "/history?chapter=multiplane&view=process");
    await page.getByTestId("camera-travel").fill("1");
    const offsets = await page.locator("[data-plane]").evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute("data-plane"), Number(e.getAttribute("data-offset"))])));
    expect(Math.abs(offsets.foreground)).toBeGreaterThan(Math.abs(offsets.characters));
    expect(Math.abs(offsets.characters)).toBeGreaterThan(Math.abs(offsets.background));
    await page.getByTestId("mode-flat").click();
    await expect(page.getByTestId("parallax-stage")).toHaveAttribute("data-mode", "flat");
    await expect(page.locator('[data-plane="flat"]')).toHaveCount(1);
  });

  test("director's note recolors only the scarf fill in the digital composite", async ({ page }) => {
    await open(page, "/history?chapter=digital-2d&view=process");
    const scarf = page.locator('[data-testid="composite-svg"] [data-target="scarf"]').first();
    await expect(scarf).toHaveAttribute("fill", "#F4E9D8");
    const coatBefore = await page.locator('[data-testid="composite-svg"] [data-part="torso"] > path').first().getAttribute("fill");
    await page.getByTestId("note-toggle").click();
    await expect(page).toHaveURL(/note=blue-scarf/);
    await expect(scarf).toHaveAttribute("fill", "#2F6FD0");
    expect(await page.locator('[data-testid="composite-svg"] [data-part="torso"] > path').first().getAttribute("fill")).toBe(coatBefore);
  });

  test("comparison: play together starts both from a reset", async ({ page }) => {
    await open(page, "/history?compare=cg");
    await expect(page.getByTestId("comparison")).toBeVisible();
    await page.getByTestId("play-together").click();
    await expect
      .poll(async () => page.locator('[data-testid="comparison"] video').evaluateAll((vs) => vs.every((v) => !(v as HTMLVideoElement).paused)), { timeout: 15_000 })
      .toBe(true);
    await page.getByTestId("compare-toggle").click();
    await expect(page.getByTestId("comparison")).toHaveCount(0);
    await expect(page).not.toHaveURL(/compare=/);
  });

  test("generative chapter exposes all eight takes", async ({ page }) => {
    await open(page, "/history?chapter=generative&view=process");
    for (const t of ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]) await expect(page.getByTestId(`take-${t}`)).toBeVisible();
    await page.getByTestId("take-A3").click();
    await page.getByTestId("exp-tab-review").click();
    await expect(page.getByTestId("review-list").locator("li")).toHaveCount(6);
  });
});
