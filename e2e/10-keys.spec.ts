import { expect, test } from "@playwright/test";
import { openLab } from "./helpers/lab";

test("keyboard map drives the lab and confirms with toasts", async ({ page }) => {
  await openLab(page);
  const root = page.getByTestId("lab-root");
  await page.keyboard.press("KeyM");
  await expect(root).toHaveAttribute("data-mode", "match");
  await expect(page.getByTestId("toast").first()).toBeVisible();
  await page.keyboard.press("KeyT");
  await expect(root).toHaveAttribute("data-target", "secondary");
  await page.keyboard.press("KeyV");
  await expect(root).toHaveAttribute("data-primary", "stage");
  await page.keyboard.press("KeyV");
  await page.keyboard.press("Shift+KeyF");
  await expect(root).toHaveAttribute("data-fullscreen-shot", "1");
  await page.keyboard.press("Escape");
  await expect(root).toHaveAttribute("data-fullscreen-shot", "0");
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-playing", "false");
  await page.keyboard.press("Shift+Slash");
  await expect(page.getByTestId("help")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+KeyU");
  await expect(root).toHaveAttribute("data-ui-hidden", "1");
});
