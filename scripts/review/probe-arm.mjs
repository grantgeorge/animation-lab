import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto("http://localhost:3123/labs/lens-and-framing?e2e=1&ui=0&freeze=0", { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__animationLab && !!window.__r3f, null, { timeout: 30000 });
await page.waitForTimeout(1500);
for (const t of (process.env.T ?? "0,3.4").split(",").map(Number)) {
  await page.evaluate((t) => window.__animationLab.getState().seek(t), t);
  await page.evaluate(() => window.__animationLab.settle());
  const r = await page.evaluate(() => {
    const scene = window.__r3f.get().scene;
    const out = {};
    for (const who of ["Pip", "Bram"]) {
      const root = scene.getObjectByName(who);
      if (!root) continue;
      const p = (n) => { const o = root.getObjectByName(n); if (!o) return null; const v = o.getWorldPosition(o.position.clone()); return [v.x, v.y, v.z].map((x) => +x.toFixed(3)); };
      out[who] = { hand: p("LeftHand"), headEnd: p("head_end"), front: p("headfront"), sh: p("LeftArm"), el: p("LeftForeArm"), wr: p("LeftHand"), shR: p("RightArm"), elR: p("RightForeArm"), head: p("Head") };
    }
    return out;
  });
  console.log(t, JSON.stringify(r));
}
await browser.close();
