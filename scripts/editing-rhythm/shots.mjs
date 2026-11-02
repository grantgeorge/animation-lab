// Key states of the Editing & Rhythm lab at 1440×900 (GPU Chromium, UHD cast).
// Usage: node scripts/editing-rhythm/shots.mjs <outDir>   (BASE_URL defaults to the dev server on :3123)
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "docs/screenshots/editing-rhythm";
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

async function shot(name, query, seek, setup) {
  await page.goto(`${base}/labs/editing-rhythm?e2e=1&quality=high${query ? `&${query}` : ""}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__editLab, null, { timeout: 60000 });
  await page.waitForTimeout(2200);
  if (setup) await setup();
  await page.evaluate(async (t) => { const h = window.__editLab; h.pause(); h.seek(t); await h.frames(5); }, seek);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${name}.png` });
}

await shot("01-playground-suspense", "", 8.0, async () => { await page.getByTestId("timeline-clip-2").click(); });
await shot("02-held-reaction", "", 8.5, async () => { await page.getByTestId("timeline-clip-2").click(); await page.getByTestId("duration-slider").fill("4.6"); });
await shot("03-insert-before-reaction", "", 6.8, async () => { await page.getByTestId("timeline-clip-4").click(); await page.getByTestId("move-earlier").click(); await page.getByTestId("move-earlier").click(); });
await shot("04-compare-suspense-vs-action", "compare=action", 4.4);
await shot("05-inspect-comedy", "mode=inspect&preset=comedy", 8.6);
await shot("06-watch-emotion-reveal", "mode=watch&preset=emotion", 15.2);
await shot("07-kuleshov-gift", "exp=kuleshov", 3.6, async () => { await page.getByTestId("kule-insert-gift").click(); await page.getByTestId("kule-answer-tenderness").click(); });
await shot("08-reaction-after", "exp=reaction", 4.2, async () => { await page.getByTestId("reaction-order-after").click(); });
await shot("09-continuity-crossed", "exp=continuity", 4.6, async () => { await page.getByTestId("flip-camera").click(); });
await shot("10-jl-cut", "exp=jl", 2.7, async () => { await page.getByTestId("jl-slider").fill("1"); });
await shot("11-montage-dissolves", "exp=montage", 5.0, async () => { await page.getByTestId("montage-style-dissolve").click(); });
await shot("12-comedy-reaction-hold", "exp=comedy", 3.4, async () => { await page.getByTestId("comedy-hold").click(); });
await shot("13-pacing", "exp=pacing", 2.0, async () => { await page.getByTestId("tempo-slider").fill("0.6"); });
console.log(JSON.stringify({ errors }));
await browser.close();
