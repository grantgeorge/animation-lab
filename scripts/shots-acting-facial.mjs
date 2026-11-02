// Real UI review: node scripts/shots-acting-facial.mjs [output directory]
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://localhost:3123";
const out = process.argv[2] ?? "docs/screenshots/acting-facial";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const failures = [];
try {
  for (const width of (process.env.WIDTHS ?? "1440,1280,390").split(",").map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 900 }, reducedMotion: "reduce" });
    page.on("pageerror", (error) => failures.push(`${width}: ${error.message}`));
    const shot = async (name) => {
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, scrollX, elements: [...document.querySelectorAll("body *")].filter((node) => (node instanceof HTMLElement || node.tagName === "svg") && node.getBoundingClientRect().right + scrollX > innerWidth + 1).slice(0, 8).map((node) => ({ tag: node.tagName, className: node.getAttribute("class"), width: node.getBoundingClientRect().width })) }));
      if (overflow.width > width) console.log(JSON.stringify({ name, width, overflow }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await page.goto(`${base}/labs/character-acting`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("acting-stage")).toBeVisible();
    await shot("acting-default");
    await page.getByRole("button", { name: "Try the contrast" }).click();
    await page.getByTestId("perf-scrub").fill("2.6");
    await expect(page.getByTestId("acting-stage")).toHaveAttribute("data-voice", "excited");
    await expect(page.getByTestId("acting-note")).toContainText("notice which one you believe");
    await page.evaluate(() => scrollTo(0, 0));
    await shot("acting-contrast");
    if (width < 500) {
      await page.getByTestId("director").scrollIntoViewIfNeeded();
      await shot("acting-controls");
    }
    await page.getByTestId("generated-performance").locator(":scope > summary").click();
    await page.getByTestId("ai-cond-acting").click();
    await page.getByTestId("ai-take-a").click();
    await expect(page.getByTestId("ai-video")).toHaveAttribute("src", /act-acting-a\.mp4/);
    await page.getByTestId("ai-takes").scrollIntoViewIfNeeded();
    await shot("acting-generated-study");

    await page.goto(`${base}/labs/facial-animation`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("mouth-stage")).toBeVisible();
    await shot("facial-default");
    await page.getByRole("slider", { name: "Dialogue playhead", exact: true }).fill("0.65");
    await page.getByRole("slider", { name: "Mouth timing", exact: true }).fill("300");
    await page.getByRole("checkbox", { name: "Compare with synced reference" }).check();
    await expect(page.getByTestId("mouth-stage")).toHaveAttribute("data-open", "0.000");
    await page.evaluate(() => scrollTo(0, 0));
    await shot("facial-compare");
    await page.getByRole("radio", { name: "Inspect", exact: true }).click();
    await page.getByRole("combobox", { name: "Recorded delivery" }).selectOption("sarcastic");
    await page.getByRole("slider", { name: "Dialogue playhead", exact: true }).fill("1.2");
    await page.getByRole("checkbox", { name: "Eye acting" }).uncheck();
    await page.getByRole("region", { name: "Audio and mouth timeline" }).scrollIntoViewIfNeeded();
    await shot("facial-inspect");
    if (width < 500) {
      await page.getByRole("complementary", { name: "Experiment controls" }).scrollIntoViewIfNeeded();
      await shot("facial-controls");
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ output: out, failures }, null, 2));
if (failures.length) process.exitCode = 1;
