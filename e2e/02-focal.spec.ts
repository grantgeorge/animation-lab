import { expect, test } from "@playwright/test";
import { camera, expectChip, openLab, settle } from "./helpers/lab";

test("focal length updates the projection readouts", async ({ page }) => {
  await openLab(page);
  await expectChip(page, "chip-focal", "50 mm · 39.6°");
  await page.getByTestId("focal-slider").fill("24");
  await settle(page);
  await expectChip(page, "chip-focal", "24 mm · 73.7°");
  await page.getByTestId("preset-85").click();
  await settle(page);
  await expectChip(page, "chip-focal", "85 mm · 23.9°");
  await page.keyboard.press("BracketRight");
  expect((await camera(page)).rig.focalMm).toBe(86);
  await page.keyboard.press("Digit1");
  await settle(page);
  await expectChip(page, "chip-focal", "18 mm · 90.0°");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-focal-mm", "18");
  await expect(page.getByTestId("concept-title")).toContainText("Ultra-wide");
});
