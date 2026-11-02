// Frame-by-frame captures of the performances for animation review.
// Usage: node scripts/review/capture-arms.mjs <outDir> [scene] [shot] [start:end:step]
// Freezes the lab, puts the observer camera close to each character and steps through time.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "assets-src/review/arms";
const only = process.argv[3];
const base = process.env.BASE_URL ?? "http://localhost:3123";
const range = (a, b, s) => Array.from({ length: Math.round((b - a) / s) + 1 }, (_, i) => +(a + i * s).toFixed(3));
const timing = process.argv[5]?.split(":").map(Number);
if (timing && (timing.length !== 3 || timing.some((n) => !Number.isFinite(n)) || timing[2] <= 0 || timing[1] < timing[0])) throw new Error("Use a finite start:end:step range with a positive step.");
// camera: [position, target]
const SHOTS = {
  doorway: [
    { who: "bram", cam: [[-0.1, 1.35, -0.6], [-0.35, 1.15, -3.0]], times: range(2.4, 5.6, 0.2) },
    { who: "bram-front", cam: [[-0.35, 1.5, -1.2], [-0.35, 1.4, -3.0]], times: range(3.1, 5.0, 0.1) },
    { who: "bram-side", cam: [[2.0, 1.5, -3.0], [-0.35, 1.35, -3.0]], times: range(3.1, 5.0, 0.1) },
    { who: "pip", cam: [[0.9, 0.85, -2.6], [0.72, 0.6, -4.7]], times: range(2.6, 4.9, 0.1) },
  ],
  alley: [
    { who: "bram", cam: [[-0.6, 1.35, -0.6], [-1.0, 1.15, -3.0]], times: range(2.8, 5.4, 0.2) },
    { who: "pip-run", cam: [[0.9, 1.0, -1.2], [0.2, 0.6, -6.0]], times: range(1.6, 3.4, 0.1) },
    { who: "pip-wave", cam: [[0.6, 0.9, -2.4], [0.2, 0.6, -4.4]], times: range(3.2, 5.2, 0.2) },
  ],
  workshop: [
    { who: "bram", cam: [[0.2, 1.4, -0.9], [-0.3, 1.15, -3.0]], times: range(0, 6, 0.25) },
    { who: "pip", cam: [[1.2, 1.3, -1.6], [0.35, 1.1, -3.75]], times: range(2.4, 5.4, 0.2) },
  ],
};
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
const onlyWho = process.argv[4];
for (const [scene, shots] of Object.entries(SHOTS)) {
  if (only && only !== scene) continue;
  await page.goto(`${base}/labs/lens-and-framing?e2e=1&quality=high&ui=0&tech=0&scene=${scene}&freeze=0`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__animationLab && !!window.__r3f?.get?.().controls, null, { timeout: 30000 });
  await page.waitForFunction(() => !!window.__r3f.get().scene.getObjectByName("Bram")?.getObjectByName("RightHand"));
  // Pose review uses the observer camera, regardless of which view the lab opens by default.
  await page.evaluate(() => window.__animationLab.getState().setPrimaryView("stage"));
  await page.addStyleTag({ content: `
    .lf-picture { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-height: none !important; border: 0 !important; border-radius: 0 !important; }
    .monitor, .lf-picture-label { display: none !important; }
  ` });
  await page.evaluate(() => {
    const stamp = document.createElement("div");
    stamp.id = "pose-review-time";
    stamp.style.cssText = "position:fixed;left:12px;top:12px;z-index:100;color:white;background:#000a;padding:6px 9px;border-radius:4px;font:16px monospace;pointer-events:none";
    document.body.append(stamp);
  });
  await page.waitForTimeout(1500);
  for (const s of shots) {
    if (onlyWho && s.who !== onlyWho) continue;
    const dir = `${out}/${scene}-${s.who}`;
    mkdirSync(dir, { recursive: true });
    await page.evaluate(([p, t]) => window.__r3f.get().controls.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], false), s.cam);
    await page.waitForTimeout(300);
    for (const t of timing ? range(...timing) : s.times) {
      await page.evaluate((t) => {
        window.__animationLab.getState().seek(t);
        document.getElementById("pose-review-time").textContent = `${t.toFixed(2)} s`;
      }, t);
      await page.evaluate(() => window.__animationLab.settle());
      await page.screenshot({ path: `${dir}/t${t.toFixed(2).padStart(5, "0")}.png` });
    }
  }
}
await browser.close();
console.log("done");
