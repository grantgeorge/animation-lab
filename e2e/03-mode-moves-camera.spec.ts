import { expect, test } from "@playwright/test";
import { camera, openLab, settle } from "./helpers/lab";

test("Fixed keeps the camera still; Match moves it with the lens", async ({ page }) => {
  await openLab(page);
  const start = (await camera(page)).rig;
  for (const key of ["Digit2", "Digit4", "Digit5"]) {
    await page.keyboard.press(key);
    const c = (await camera(page)).rig;
    expect(c.railS).toBe(start.railS);
    expect(c.yawDeg).toBe(start.yawDeg);
  }
  await page.keyboard.press("Digit4");
  await page.keyboard.press("KeyM");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-mode", "match");
  const pos = await page.evaluate(() => window.__animationLab!.presentation().railS);
  expect(pos).toBeCloseTo(start.railS, 6); // toggling Match alone does not move the camera
  await page.keyboard.press("Digit2");
  await settle(page);
  const z24 = 3 - (await camera(page)).rig.railS;
  expect(Math.abs(z24 / 3 - 0.48)).toBeLessThan(0.01);
  const shot24 = await page.getByTestId("lab-root").getAttribute("data-shot-size");
  await page.keyboard.press("Digit5");
  await settle(page);
  expect(await page.getByTestId("lab-root").getAttribute("data-shot-size")).toBe(shot24);
  const events = await page.evaluate(() => window.__animationLab!.events().map((e) => e.type));
  expect(events).toContain("cameraTravelled");
});
