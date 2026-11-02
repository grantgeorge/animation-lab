// Visual review: node scripts/shots-timing-refined.mjs [outDir]
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const out = process.argv[2] ?? "docs/screenshots/timing-refined";
const base = process.env.BASE_URL ?? "http://localhost:3123";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const errors = [];
const captures = [];
const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}/labs/timing-and-spacing?e2e=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__timingLab));
  await page.evaluate(() => {
    const lab = window.__timingLab;
    lab.pause();
    lab.seek(lab.getState().variants[0].arcs[0].apexFrame);
  });
  await settle(page);
  return page;
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="lab-root"]');
    return { viewport: [innerWidth, innerHeight], scrollWidth: root.scrollWidth, width: root.clientWidth, state: window.__timingLab.getState().comparison };
  });
  captures.push({ name, ...geometry });
  console.log("wrote", name);
}

async function compare(page, id) {
  await page.getByTestId(`lesson-${id}`).click();
  await page.evaluate((id) => {
    const lab = window.__timingLab;
    const v = lab.getState().variants[1];
    lab.seek(id === "anticipation" ? v.takeoffFrame - 2 : id === "squash" ? v.contacts[0] : v.arcs[0].land - 3);
  }, id);
  await settle(page);
}

try {
  const desktop = await open(1440, 900);
  await shot(desktop, "01-desktop-default");
  for (const [i, id] of ["easing", "weight", "anticipation", "squash"].entries()) {
    await compare(desktop, id);
    await shot(desktop, `0${i + 2}-desktop-${id}`);
  }
  await desktop.close();

  const compact = await open(1280, 800);
  await shot(compact, "06-compact-default");
  await compare(compact, "easing");
  await shot(compact, "07-compact-comparison");
  await compact.close();

  const phone = await open(390, 844);
  await shot(phone, "08-phone-top");
  await phone.getByTestId("curve-editor").scrollIntoViewIfNeeded();
  await shot(phone, "09-phone-curves");
  await phone.getByTestId("motion-inspector").scrollIntoViewIfNeeded();
  await shot(phone, "10-phone-controls");
  await phone.getByTestId("bounce-details").locator("summary").click();
  await phone.getByTestId("bounce-details").scrollIntoViewIfNeeded();
  await shot(phone, "11-phone-bounce-details");
  await phone.getByTestId("lesson-anticipation").scrollIntoViewIfNeeded();
  await compare(phone, "anticipation");
  await shot(phone, "12-phone-comparison");
  await phone.getByTestId("lesson-strip").scrollIntoViewIfNeeded();
  await shot(phone, "13-phone-lesson");
  await phone.getByTestId("anticipation-details").scrollIntoViewIfNeeded();
  await shot(phone, "14-phone-comparison-controls");
  await phone.close();

  await writeFile(path.join(out, "review.json"), JSON.stringify({ errors, captures }, null, 2) + "\n");
  console.log(JSON.stringify({ errors, captures: captures.length }));
  if (errors.length) throw new Error("Browser errors during capture");
} finally {
  await browser.close();
}
