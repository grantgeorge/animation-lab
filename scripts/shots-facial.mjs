import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "docs/screenshots/facial-animation";
const base = process.env.BASE_URL ?? "http://localhost:3123";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/labs/facial-animation`);
  await page.getByTestId("mouth-stage").waitFor();
  await page.getByRole("slider", { name: "Dialogue playhead", exact: true }).fill("0.65");
  await page.screenshot({ path: `${out}/01-in-sync.png`, fullPage: true });
  await page.getByRole("button", { name: "+300", exact: true }).click();
  await page.getByRole("checkbox", { name: "Compare with synced reference" }).check();
  await page.screenshot({ path: `${out}/02-late-comparison.png`, fullPage: true });
  await page.getByRole("radio", { name: "Inspect", exact: true }).click();
  await page.screenshot({ path: `${out}/03-inspect.png`, fullPage: true });
  await page.getByRole("radio", { name: "Watch", exact: true }).click();
  await page.screenshot({ path: `${out}/04-watch.png`, fullPage: true });
  await page.getByRole("radio", { name: "Experiment", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/05-mobile.png`, fullPage: true });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Saved five captures to ${out}`);
} finally {
  await browser.close();
}
