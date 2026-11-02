// Grading & Finishing: capture the lab's key states at 1440×900 into docs/screenshots/grading-finishing.
// Usage (dev server running): node scripts/review/shots-grading.mjs [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3123";
const out = process.argv[2] ?? "docs/screenshots/grading-finishing";
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const errors = [];

async function open(query = "") {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/labs/grading-finishing?quality=high&capture=plate&freeze=3.4${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__gradingLab && document.querySelector("[data-testid=lab-root]")?.dataset.plates === "1", null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  return page;
}
const settle = (page) => page.evaluate(() => window.__gradingLab.frames(8)).then(() => page.waitForTimeout(500));
const H = (page, fn, arg) => page.evaluate(fn, arg);

const shots = {
  "01-experiment-default": async () => open(),
  "02-simple-sliders": async () => {
    const p = await open();
    await H(p, () => { const h = window.__gradingLab; h.setSimple("grain", 0.55); h.setSimple("temperature", 0.72); h.setSimple("contrast", 0.66); h.setSimple("bloom", 0.5); });
    return p;
  },
  "03-advanced-grade-500t": async () => {
    const p = await open("&look=k500t");
    await p.getByTestId("advanced-toggle").click();
    await p.getByTestId("tab-grade").click();
    return p;
  },
  "04-halation-only": async () => {
    const p = await open("&look=k500t");
    await p.getByTestId("advanced-toggle").click();
    await p.getByTestId("tab-finish").click();
    await H(p, () => window.__gradingLab.patchLook({ finish: { halation: { amount: 0.8 } } }));
    await p.getByTestId("isolate-halation").click();
    return p;
  },
  "05-bloom-only": async () => {
    const p = await open("&look=promist");
    await p.getByTestId("advanced-toggle").click();
    await p.getByTestId("tab-finish").click();
    await p.getByTestId("isolate-bloom").click();
    return p;
  },
  "06-inspect-scopes": async () => open("&look=teal-orange&mode=inspect&wipe=0.42"),
  "07-watch": async () => open("&look=k500t&mode=watch"),
  "08-show-raw": async () => open("&view=show&look=k500t"),
  "09-show-balanced": async () => {
    const p = await open("&view=show&look=k500t");
    await p.getByTestId("step-match").click();
    await p.getByTestId("auto-balance").click();
    return p;
  },
  "10-show-look": async () => {
    const p = await open("&view=show&look=k500t");
    await H(p, () => { window.__gradingLab.autoBalanceAll(); window.__gradingLab.setStep("look"); });
    return p;
  },
  "11-show-override": async () => {
    const p = await open("&view=show&look=k500t");
    await H(p, () => { window.__gradingLab.autoBalanceAll(); window.__gradingLab.setStep("override"); window.__gradingLab.suggestOverride(); });
    return p;
  },
  "12-comic": async () => open("&look=comic"),
  "13-painterly": async () => open("&look=painterly"),
  "14-matrix": async () => open("&look=matrix"),
  "15-anamorphic": async () => open("&look=anamorphic&shot=alley&freeze=1.6"),
  "16-deliver": async () => {
    const p = await open("&look=k500t");
    await p.locator("[data-testid=deliver] > summary").click();
    await p.locator(".gf-panel").evaluate((el) => (el.scrollTop = el.scrollHeight));
    return p;
  },
};

for (const [name, make] of Object.entries(shots)) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const page = await make();
  await settle(page);
  await page.screenshot({ path: `${out}/${name}.png` });
  if (name === "02-simple-sliders" || name === "04-halation-only") {
    const box = await page.getByTestId("monitor-main").boundingBox();
    await page.screenshot({ path: `${out}/${name}-crop.png`, clip: { x: box.x + box.width * 0.5, y: box.y + box.height * 0.05, width: 420, height: 300 } });
  }
  console.log("shot", name);
  await page.close();
}
console.log(JSON.stringify({ errors: errors.slice(0, 10) }));
await browser.close();
