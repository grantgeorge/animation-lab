// Screenshots of the Timing & Spacing lab. Usage: node scripts/shots-timing.mjs [outDir] [WxH]
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "docs/screenshots/timing-and-spacing";
const [W, H] = (process.argv[3] ?? "1440x900").split("x").map(Number);
const only = process.env.ONLY?.split(",");
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DPR ?? 2) });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${base}/labs/timing-and-spacing?e2e=1`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__timingLab, null, { timeout: 30000 });
await page.waitForTimeout(800);
const hook = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name, setup) => {
  if (only && !only.some((o) => name.includes(o))) return;
  await setup();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${name}.png` });
};
const pauseAt = (f) => hook((f) => { window.__timingLab.pause(); window.__timingLab.seek(f); }, f);
const firstFall = () => hook(() => { const a = window.__timingLab.getState().variants.at(-1).arcs[0]; return a.land - 2; });

await shot("01-default", async () => { await hook(() => window.__timingLab.setComparison(null)); await pauseAt(await firstFall()); });
const cmps = [["02-compare-linear-vs-eased", "easing"], ["03-compare-heavy-vs-light", "weight"], ["04-compare-anticipation", "anticipation"], ["05-compare-squash-stretch", "squash"]];
for (const [name, id] of cmps) {
  await shot(name, async () => {
    await hook((id) => window.__timingLab.setComparison(id), id);
    const st = await hook(() => window.__timingLab.getState());
    const b = st.variants[1];
    const f = id === "anticipation" ? b.takeoffFrame - 2 : id === "squash" ? b.contacts[0] : id === "weight" ? b.arcs[0].land - 3 : b.arcs[0].land - 3;
    await pauseAt(f);
  });
}
await shot("06-curve-editor-mid-edit", async () => {
  await hook(() => { window.__timingLab.setComparison(null); window.__timingLab.setParams({ weight: "rubber" }); });
  await pauseAt(await firstFall());
  if ((await page.getByTestId("ghosts-toggle").getAttribute("aria-pressed")) !== "true") await page.getByTestId("ghosts-toggle").click();
  const h = page.getByTestId("handle-riseP2");
  const box = await h.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 40, { steps: 6 });
  await page.waitForTimeout(200);
});
await page.mouse.up();
const st = await hook(() => window.__timingLab.getState());
console.log(JSON.stringify({ errors: errors.slice(0, 20), frame: st.frame, total: st.totalFrames, cmp: st.comparison, prompt: st.variants.map((v) => v.prompt) }, null, 1));
await browser.close();
