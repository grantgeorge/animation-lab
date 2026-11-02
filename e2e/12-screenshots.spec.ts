import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { openLab, settle } from "./helpers/lab";

/** Review matrix: 6 states × 3 viewports into docs/screenshots/<viewport>/ (read every one). */
const VIEWPORTS = [
  [1920, 1080],
  [1440, 900],
  [1280, 800],
] as const;

const STATES: { name: string; keys: string[] }[] = [
  { name: "01-default-50mm", keys: [] },
  { name: "02-fixed-24mm", keys: ["Digit2"] },
  { name: "03-fixed-85mm", keys: ["Digit5"] },
  { name: "04-match-24mm", keys: ["KeyM", "Digit2"] },
  { name: "05-match-85mm", keys: ["KeyM", "Digit5"] },
  { name: "06-studio-primary", keys: ["KeyM", "Digit5", "KeyV"] },
];

for (const [w, h] of VIEWPORTS) {
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    for (const s of STATES) {
      test(s.name, async ({ page }) => {
        test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to write the review matrix");
        await openLab(page, "freeze=3.35&quality=high");
        for (const k of s.keys) {
          await page.keyboard.press(k);
          await page.waitForTimeout(150);
        }
        await settle(page);
        await page.waitForTimeout(400);
        const dir = `docs/screenshots/${w}x${h}`;
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/${s.name}.png` });
      });
    }
  });
}
