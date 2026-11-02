import { expect, test } from "@playwright/test";

// Character Acting & Performance lab (/labs/character-acting). Standalone; no WebGL needed.

test.describe("Character Acting lab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/labs/character-acting");
    await expect(page.getByTestId("acting-stage")).toBeVisible();
  });

  test("opens on the neutral read and makes no inference calls", async ({ page }) => {
    const fal: string[] = [];
    page.on("request", (r) => /fal\.(run|ai|media)/.test(r.url()) && fal.push(r.url()));
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-emotion", "neutral");
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-voice", "neutral");
    for (const e of ["excited", "sarcastic", "nervous", "frustrated", "disappointed"]) await page.getByTestId(`emotion-${e}`).click();
    expect(fal).toEqual([]);
  });

  test("emotion drives body and (when linked) voice; unlinking allows mismatches", async ({ page }) => {
    await page.getByTestId("emotion-sarcastic").click();
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-voice", "sarcastic");
    await page.getByTestId("voice-select").selectOption("excited");
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-emotion", "sarcastic");
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-voice", "excited");
    await expect(page.getByTestId("voice-linked")).not.toBeChecked();
    await expect(page.getByTestId("acting-note")).toContainText("notice which one you believe");
  });

  test("exaggeration and gesture visibly change the drawing at the same moment", async ({ page }) => {
    await page.getByTestId("emotion-excited").click();
    await page.getByTestId("perf-scrub").fill("3");
    const svg = () => page.getByTestId("actor-svg").innerHTML();
    await page.getByTestId("exaggeration").fill("0.4");
    const subtle = await svg();
    await page.getByTestId("exaggeration").fill("1.6");
    const broad = await svg();
    expect(broad).not.toEqual(subtle);
    await page.getByTestId("gesture").fill("0.3");
    const restrained = await svg();
    expect(restrained).not.toEqual(broad);
  });

  test("same voice, different body plays all six in turn", async ({ page }) => {
    await page.getByTestId("compare-voice").click();
    await expect(page.getByTestId("acting-stage")).toContainText("1/6");
    await expect(page.getByTestId("acting-stage")).toContainText("2/6", { timeout: 15_000 });
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-voice", "neutral");
  });

  test("the generative comparison shows four conditions with two takes each", async ({ page }) => {
    await page.getByTestId("generated-performance").locator(":scope > summary").click();
    for (const c of ["prompt", "expression", "voice", "acting"]) {
      await page.getByTestId(`ai-cond-${c}`).click();
      for (const k of ["a", "b"]) {
        await page.getByTestId(`ai-take-${k}`).click();
        await expect(page.getByTestId("ai-video")).toHaveAttribute("src", new RegExp(`act-${c}-${k}\\.mp4`));
        await expect(page.getByTestId("ai-review").locator("li").first()).toBeVisible();
      }
    }
  });

  test("mobile keeps direction and secondary studies usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Try the contrast" }).click();
    await page.getByTestId("perf-scrub").fill("2.6");
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-voice", "excited");
    await page.getByTestId("director").getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByTestId("voice-linked")).toBeChecked();
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-emotion", "neutral");
    await page.getByTestId("generated-performance").locator(":scope > summary").click();
    await page.getByTestId("ai-cond-voice").click();
    await expect(page.getByTestId("ai-video")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
