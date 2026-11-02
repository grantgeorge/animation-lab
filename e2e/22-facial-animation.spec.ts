import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/labs/facial-animation");
  await expect(page.getByTestId("mouth-stage")).toBeVisible();
});

test("mouth offset changes the face at the same playhead and updates the direction", async ({ page }) => {
  await page.getByRole("slider", { name: "Dialogue playhead", exact: true }).fill("0.65");
  await expect(page.getByTestId("mouth-stage")).toHaveAttribute("data-viseme", "O");
  await page.getByRole("slider", { name: "Mouth timing", exact: true }).fill("300");
  await expect(page.getByTestId("mouth-stage")).toHaveAttribute("data-open", "0.000");
  await expect(page.getByTestId("facial-lab")).toHaveAttribute("data-time", "0.650");
  await expect(page.getByTestId("facial-prompt")).toContainText("300 ms after");
  await page.getByRole("checkbox", { name: "Compare with synced reference" }).check();
  await expect(page.getByTestId("reference-stage")).toBeVisible();
  const reference = await page.getByTestId("reference-stage").locator("svg").innerHTML();
  await page.getByRole("slider", { name: "Mouth timing", exact: true }).fill("-300");
  expect(await page.getByTestId("reference-stage").locator("svg").innerHTML()).toBe(reference);
  await expect(page.getByTestId("facial-prompt")).toContainText("300 ms before");
});

test("plays real dialogue, pauses, steps and resets", async ({ page }) => {
  const response = page.waitForResponse((r) => r.url().endsWith("/voice/neutral.mp3"));
  await page.getByRole("button", { name: "Play dialogue" }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByTestId("facial-lab")).toHaveAttribute("data-playing", "true");
  await expect.poll(async () => Number(await page.getByTestId("facial-lab").getAttribute("data-time"))).toBeGreaterThan(0.6);
  await page.getByRole("button", { name: "Pause", exact: false }).click();
  const time = Number(await page.getByTestId("facial-lab").getAttribute("data-time"));
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  expect(Number(await page.getByTestId("facial-lab").getAttribute("data-time"))).toBeCloseTo(time + 1 / 24, 2);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("facial-lab")).toHaveAttribute("data-time", "0.000");
  await expect(page.getByTestId("facial-lab")).toHaveAttribute("data-playing", "false");
});

test("modes, deliveries and eye controls change the experiment", async ({ page }) => {
  await page.getByRole("radio", { name: "Watch", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Experiment controls" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Inspect", exact: true }).click();
  await expect(page.getByRole("region", { name: "Audio and mouth timeline" })).toContainText("Round");
  await page.getByRole("combobox", { name: "Recorded delivery" }).selectOption("sarcastic");
  await page.getByRole("checkbox", { name: "Eye acting" }).uncheck();
  await expect(page.getByTestId("facial-prompt")).toContainText("sarcastic delivery");
  await expect(page.getByTestId("facial-prompt")).toContainText("still brows");
  await page.getByRole("button", { name: "Copy direction" }).click();
  await expect(page.locator(".fa-prompt [role=status]")).toHaveText("Copied");
});

test("audio failures are visible and scrubbing remains available", async ({ page }) => {
  await page.route("**/voice/neutral.mp3", (route) => route.abort());
  await page.getByRole("button", { name: "Play dialogue" }).click();
  await expect(page.getByTestId("facial-lab").getByRole("alert")).toContainText("could not play");
  await page.getByRole("slider", { name: "Dialogue playhead", exact: true }).fill("0.65");
  await expect(page.getByTestId("mouth-stage")).toHaveAttribute("data-viseme", "O");
});

test("Space opens a focused disclosure without playing dialogue", async ({ page }) => {
  const disclosure = page.locator(".fa-timing-details");
  await disclosure.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.getByRole("region", { name: "Audio and mouth timeline" })).toBeVisible();
  await expect(page.getByTestId("facial-lab")).toHaveAttribute("data-playing", "false");
  await expect(page.getByTestId("facial-lab")).toHaveAttribute("data-time", "0.000");
});

test("mobile and reduced motion keep controls usable without autoplay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId("facial-lab")).toHaveAttribute("data-playing", "false");
  await page.getByRole("slider", { name: "Mouth timing", exact: true }).fill("150");
  await expect(page.getByTestId("facial-prompt")).toContainText("150 ms after");
  await page.getByRole("radio", { name: "Inspect", exact: true }).click();
  await page.getByRole("region", { name: "Audio and mouth timeline" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
