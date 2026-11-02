import { expect, test } from "@playwright/test";

test("home lists the available labs and concept labs that are not links", async ({ page }) => {
  await page.goto("/");
  for (const id of ["lens-and-framing", "camera-movement", "lighting-studio", "timing-and-spacing", "character-acting", "animation-style", "shot-coverage", "facial-animation", "staging-and-blocking", "storyboards-animatics", "color-scripting", "camera-families", "animation-camera", "grading-finishing", "painterly-textures", "environment-depth", "editing-rhythm", "vfx-simulation", "character-rigging", "character-design", "2d-vs-3d"]) {
    await expect(page.getByTestId(`lab-card-${id}`)).toHaveAttribute("href", `/labs/${id}`);
  }
  for (const id of ["shot-types-and-composition", "focus-and-dof", "ai-shot-continuity"]) {
    const card = page.getByTestId(`lab-card-${id}`);
    await expect(card).toHaveAttribute("aria-disabled", "true");
    await expect(card).not.toHaveAttribute("href", /.*/);
    await expect(card).toContainText("CONCEPT · NOT YET BUILT");
  }
});

for (const path of ["/labs/focus-and-dof", "/labs/nope"]) {
  test(`${path} is a real 404`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
  });
}
