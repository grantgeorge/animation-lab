import { expect, test } from "@playwright/test";
import { openLab, settle } from "./helpers/lab";

test("shot settings export carries the camera, lens, filmback, target and time", async ({ page }) => {
  await openLab(page);
  await page.keyboard.press("Digit5");
  await settle(page);
  await page.getByTestId("open-export").click();
  const json = JSON.parse((await page.getByTestId("export-json").textContent()) ?? "{}");
  expect(json.schemaVersion).toBe("animation-lab.shot/1");
  expect(json.lens.focalLengthMm).toBe(85);
  expect(json.sensor).toEqual({ fit: "horizontal", gateWidthMm: 36, gateHeightMm: 20.25 });
  expect(json.frame.aspectLabel).toBe("16:9");
  expect(json.camera.position).toEqual([-0.35, 1.47, 0]);
  expect(json.subject.id).toBe("primary");
  expect(typeof json.animation.timeSeconds).toBe("number");
  expect(json.coordinateSystem.units).toBe("meters");
  expect(json.engines.blender.location).toEqual([-0.35, 0, 1.47]);
  expect(json.prompt.phrase).toMatch(/^Medium close-up of Bram, 85 mm portrait telephoto/);
  await page.bringToFront();
  await page.getByTestId("copy-json").click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(clip)).toEqual(json);
  await page.keyboard.press("Digit2");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-focal-mm", "85");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("export-drawer")).not.toBeVisible();
  await expect(page.getByTestId("open-export")).toBeFocused();
});
