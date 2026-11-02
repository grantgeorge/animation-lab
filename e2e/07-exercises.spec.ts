import { expect, test } from "@playwright/test";
import { openLab, settle } from "./helpers/lab";

test("the three exercises track real interaction and persist across reload", async ({ page }) => {
  await openLab(page);
  await page.getByTestId("lesson-toggle").click();
  await page.getByTestId("start-ex1").click();
  for (const key of ["Digit2", "Digit4", "Digit5"]) {
    await page.keyboard.press(key === "Digit4" ? "Digit3" : key); // nudge off 50 first so 50 is a real choice
    if (key === "Digit4") {
      await page.waitForTimeout(200);
      await page.keyboard.press("Digit4");
    }
    await page.waitForTimeout(1200);
  }
  await expect(page.getByTestId("lesson-card")).toHaveAttribute("data-exercise", "ex1:complete");

  await page.getByRole("button", { name: /Next exercise/ }).click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-mode", "match");
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Digit5");
  await page.waitForTimeout(1200);
  await settle(page);
  await expect(page.getByTestId("lesson-card")).toHaveAttribute("data-exercise", "ex2:complete");

  await page.getByRole("button", { name: /Next exercise/ }).click();
  await page.getByTestId("save-reaction").click();
  await page.keyboard.press("Digit2");
  await page.keyboard.press("KeyM");
  await page.getByTestId("save-relationship").click();
  await expect(page.getByTestId("lesson-card")).toHaveAttribute("data-exercise", "ex3:complete");

  await page.reload();
  await page.waitForFunction(() => !!window.__animationLab);
  await expect(page.getByTestId("lesson-toggle")).toContainText("3 / 3");
});
