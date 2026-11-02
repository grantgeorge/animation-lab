import { chromium } from "@playwright/test";
const out = process.argv[2];
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3123/labs/lens-and-framing?e2e=1&quality=high&ui=0", { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__animationLab, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const L = (f, a) => page.evaluate(f, a);
if (process.env.SCENE) { await L((id) => window.__animationLab.getState().setScene(id), process.env.SCENE); await page.waitForTimeout(2500); }
const RIG = process.env.RIG ? JSON.parse(process.env.RIG) : { railS: -1, yawDeg: 10.8, pitchDeg: -9.7, focalMm: 135 };
await L((rig) => { const s = window.__animationLab.getState(); window.__animationLab.setState({ camera: { ...s.camera, rig } }); s.setPrimaryView?.("shot"); }, RIG);
await page.waitForTimeout(800);
for (const t of (process.env.T ?? "2.65,4.5,4.95").split(",").map(Number)) {
  await L((t) => { const s = window.__animationLab.getState(); s.pause(); s.seek(t); }, t);
  await page.waitForTimeout(400);
  await L(() => { const b = window.__r3f?.get().scene.getObjectByName("Bram"); if (b) b.visible = false; });
  await L(() => window.__animationLab.settle());
  console.log(t, await L(() => { const sc = window.__r3f.get().scene; const all = []; sc.traverse((o) => { if (o.name === "Pip") { const hh = o.getObjectByName("Hips"); const w = hh?.getWorldPosition(hh.position.clone()); all.push([o.type, o.visible, w && [w.x, w.z].map((x) => +x.toFixed(2))]); } }); const p = sc.getObjectByName("Pip"); const h = p?.getObjectByName("Hips"); const v = h?.getWorldPosition(h.position.clone()); return { all: JSON.stringify(all), tl: JSON.stringify(window.__animationLab.getState().timeline), t: document.querySelector("[data-testid=lab-root]")?.dataset.timeS, pip: v && [v.x, v.y, v.z].map((x) => +x.toFixed(2)), vis: p?.visible }; }));
  await page.locator('[data-testid="monitor-window"]').screenshot({ path: `${out}-${t}.png` });
}
await browser.close();
