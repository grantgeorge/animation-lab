import { expect, test } from "@playwright/test";
import { camera, openLab } from "./helpers/lab";

test("with reduced motion the camera jumps instead of travelling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLab(page);
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-playing", "false");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-nomotion", "1");
  await page.keyboard.press("KeyM");
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(150);
  const target = (await camera(page)).rig.railS;
  const shown = await page.evaluate(() => window.__animationLab!.presentation().railS);
  expect(shown).toBeCloseTo(target, 6);
});
