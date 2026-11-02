import { expect, type Page } from "@playwright/test";

export const LAB = "/labs/lens-and-framing";

/** Open the lab with the test hook installed; collects console errors on page.errors. */
export async function openLab(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${LAB}?e2e=1${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__animationLab, null, { timeout: 30_000 });
  await page.waitForFunction(() => (window.__animationLab?.frames().length ?? 0) > 2, null, { timeout: 30_000 });
  return { errors };
}

export const settle = (page: Page) => page.evaluate(() => window.__animationLab!.settle());
export const measurements = (page: Page) => page.evaluate(() => window.__animationLab!.measurements());
export const lastFrame = (page: Page) => page.evaluate(() => window.__animationLab!.frames().at(-1)!);
export const camera = (page: Page) => page.evaluate(() => window.__animationLab!.getState().camera);

export async function expectChip(page: Page, testId: string, text: string | RegExp) {
  await expect(page.getByTestId(testId)).toContainText(text);
}
