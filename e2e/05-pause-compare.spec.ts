import { expect, test } from "@playwright/test";
import { lastFrame, openLab, settle } from "./helpers/lab";

test("pausing freezes the performance while the camera changes", async ({ page }) => {
  await openLab(page);
  await page.keyboard.press("Space");
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-playing", "false");
  await settle(page);
  const t = (await lastFrame(page)).t;
  for (const key of ["Digit2", "Digit5", "KeyM", "Digit1", "KeyT"]) {
    await page.keyboard.press(key);
    await settle(page);
  }
  await page.getByTestId("focal-slider").fill("60");
  await settle(page);
  // Readouts are quantized; compare the exact performance time used by the rendered frame.
  expect((await lastFrame(page)).t).toBe(t);
  await page.getByTestId("focal-slider").blur();
  await page.keyboard.press("Home");
  await settle(page);
  await expect(root).toHaveAttribute("data-time-s", "0.000");
});
