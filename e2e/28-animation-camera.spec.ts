import { expect, test, type Page } from "@playwright/test";
import { cellGrid } from "./helpers/pixels";

type Vec = { x: number; y: number; z: number };
type Live = {
  t: number;
  frameId: number;
  camType: Record<string, string>;
  e1: null | { main: { pipToBram: number; trueRatio: number; convergenceDeg: number; poles: number[] } };
  e2: null | { main: { metric: number; distanceM: number; focalMm: number; noseToEar: number; doorwayRatio: number } };
  e3: null | { u: number; captured: boolean; layers: { id: string; depthNow: number; ndcX: number; offset: number }[] };
  e4: null | { camT: number; charT: number; frame: number; held: boolean };
  e5: null | { frame: { demo: string; pipScale: number; shot: { position: Vec } }; pipFrac: number; pipFracPhysical: number; faceWide: number; faceTele: number };
};
type Hook = {
  getState: () => { exp: number; mode: string };
  live: () => Live;
  frames: (n?: number) => Promise<number>;
  seek: (t: number) => void;
  pause: () => void;
};
declare global {
  interface Window {
    __animCamLab?: Hook;
  }
}

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/labs/animation-camera?e2e=1${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__animCamLab, null, { timeout: 30_000 });
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await page.evaluate(() => window.__animCamLab!.frames(2));
  return { errors };
}

/** Pause, jump to t, let a few frames render, read the live readouts. */
async function at(page: Page, t: number, frames = 3) {
  await page.evaluate(
    async ([t, n]) => {
      const h = window.__animCamLab!;
      h.pause();
      h.seek(t);
      await h.frames(n);
    },
    [t, frames] as const,
  );
  return page.evaluate(() => window.__animCamLab!.live());
}

const settle = (page: Page, n = 3) => page.evaluate((n) => window.__animCamLab!.frames(n), n);

/** Mean luminance spread across a grid of the monitor: a blank or flat slot scores near zero. */
async function picturedness(page: Page, testId = "monitor-main") {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const buf = await page.screenshot({ clip: box });
  const cells = cellGrid(buf, 8, 5).map(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b);
  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  return { mean, spread: Math.sqrt(cells.reduce((a, b) => a + (b - mean) ** 2, 0) / cells.length) };
}

test("five experiments, three modes, keyboard and deep links, no console errors", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "freeze=2");
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-exp", "1");
  await expect(root).toHaveAttribute("data-mode", "experiment");
  for (const n of [2, 3, 4, 5, 1]) {
    await page.keyboard.press(`Digit${n}`);
    await expect(root).toHaveAttribute("data-exp", String(n));
    await settle(page, 2);
  }
  await page.getByTestId("exp-3").click();
  await expect(root).toHaveAttribute("data-exp", "3");
  await expect(page).toHaveURL(/exp=3/);
  await page.keyboard.press("KeyI");
  await expect(root).toHaveAttribute("data-mode", "inspect");
  await expect(page.getByTestId("readouts")).toBeVisible();
  await expect(page.getByTestId("stand-diagram")).toBeVisible();
  await page.getByTestId("mode-watch").click();
  await expect(root).toHaveAttribute("data-mode", "watch");
  await expect(page.getByTestId("stage-window")).toHaveCount(0);
  await expect(page.getByTestId("caption")).toContainText("2D pan vs 2.5D multiplane vs 3D orbit");
  await page.keyboard.press("KeyE");
  await expect(root).toHaveAttribute("data-mode", "experiment");
  await expect(page.getByTestId("controls")).toBeVisible();
  await expect(page).toHaveURL(/mode=experiment/);

  await page.goto("/labs/animation-camera?e2e=1&exp=4&mode=watch&style=anime&step=3&freeze=1");
  await expect(root).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(root).toHaveAttribute("data-exp", "4");
  await expect(root).toHaveAttribute("data-mode", "watch");
  await expect(root).toHaveAttribute("data-style", "anime");
  await expect(root).toHaveAttribute("data-step", "3");
  await expect(page.getByTestId("prompt-phrase")).toContainText(/on threes/);
  expect(errors).toEqual([]);
});

test("projection toggle switches the camera type; ortho keeps Pip's true size and parallel rulers", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "exp=1&freeze=3.4");
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-camera-type", "PerspectiveCamera");
  const p = await at(page, 3.4);
  expect(p.e1!.main.pipToBram).toBeLessThan(p.e1!.main.trueRatio * 0.92);
  expect(p.e1!.main.convergenceDeg).toBeGreaterThan(10);
  // Identical poles shrink with depth in perspective.
  expect(p.e1!.main.poles[0]).toBeGreaterThan(p.e1!.main.poles[2] * 1.4);

  await page.getByTestId("proj-orthographic").click();
  await expect(root).toHaveAttribute("data-projection", "orthographic");
  await expect(root).toHaveAttribute("data-camera-type", "OrthographicCamera");
  const o = await at(page, 3.4);
  expect(o.e1!.main.pipToBram).toBeCloseTo(o.e1!.main.trueRatio, 2);
  expect(o.e1!.main.convergenceDeg).toBeLessThan(0.01);
  expect(Math.max(...o.e1!.main.poles) / Math.min(...o.e1!.main.poles)).toBeCloseTo(1, 3);
  await expect(page.getByTestId("prompt-phrase")).toContainText(/no perspective convergence/);

  await page.getByTestId("view-iso").click();
  await expect(root).toHaveAttribute("data-view", "iso");
  await expect(root).toHaveAttribute("data-camera-type", "OrthographicCamera");
  await expect(page).toHaveURL(/proj=iso/);
  await expect(page.getByTestId("prompt-phrase")).toContainText(/isometric/i);

  await page.getByTestId("view-street").click();
  await page.getByTestId("compare-wipe").click();
  await expect(root).toHaveAttribute("data-camera-type", "PerspectiveCamera|OrthographicCamera");
  expect((await picturedness(page)).spread).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});

test("matched framing holds Bram's size while the camera distance changes about 4×", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "exp=2&freeze=1");
  await page.getByTestId("focal-24").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-focal", "24");
  const w = (await at(page, 1)).e2!.main;
  await expect(page.getByTestId("prompt-phrase")).toContainText("24 mm wide-angle");
  await page.getByTestId("focal-100").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-focal", "100");
  const t = (await at(page, 1)).e2!.main;
  expect(t.focalMm).toBe(100);
  expect(Math.abs(t.metric / w.metric - 1)).toBeLessThan(0.01);
  expect(t.distanceM / w.distanceM).toBeGreaterThan(3.8);
  expect(w.noseToEar).toBeGreaterThan(t.noseToEar * 1.15);
  expect(t.doorwayRatio).toBeGreaterThan(w.doorwayRatio * 1.6);
  await expect(page.getByTestId("prompt-phrase")).toContainText("compressed background");
  // The dolly-zoom sweep keeps the metric too.
  await page.getByTestId("sweep-toggle").check();
  const a = (await at(page, 0.7)).e2!.main;
  const b = (await at(page, 2.4)).e2!.main;
  expect(Math.abs(a.metric / b.metric - 1)).toBeLessThan(0.01);
  expect(b.focalMm).toBeGreaterThan(a.focalMm * 1.5);
  expect(errors).toEqual([]);
});

test("multiplane layers parallax as 1/depth; the 2D painting slides as one", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "exp=3&move=2.5d&freeze=0.9");
  const s = await at(page, 0.9, 4);
  expect(s.e3!.captured).toBe(true);
  const k = s.e3!.layers.map((l) => l.offset * l.depthNow);
  for (const v of k) expect(Math.abs(v / k[0] - 1)).toBeLessThan(0.02);
  const off = (id: string) => Math.abs(s.e3!.layers.find((l) => l.id === id)!.offset);
  expect(off("fg")).toBeGreaterThan(off("sky") * 3);
  expect(off("bram")).toBeGreaterThan(off("town") * 1.8);
  expect((await picturedness(page)).spread).toBeGreaterThan(6);

  await page.getByTestId("move-2d").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-move", "2d");
  const f = await at(page, 0.9);
  const offs = f.e3!.layers.map((l) => l.offset);
  for (const v of offs) expect(v).toBeCloseTo(offs[0], 6);
  expect(Math.abs(offs[0])).toBeGreaterThan(0.05);

  await page.getByTestId("move-3d").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-move-kind", "orbit");
  await expect(page.getByTestId("prompt-phrase")).toContainText(/orbits/);
  expect(errors).toEqual([]);
});

test("anime timing holds each drawing on twos and threes while the camera stays smooth", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "exp=4&style=anime&step=2&freeze=1");
  const frame = (n: number) => n / 24 + 0.004;
  const f30 = await at(page, frame(30));
  const f31 = await at(page, frame(31));
  const f32 = await at(page, frame(32));
  expect(f31.e4!.charT).toBe(f30.e4!.charT);
  expect(f31.e4!.held).toBe(true);
  expect(f32.e4!.charT).toBeGreaterThan(f31.e4!.charT);
  expect(f31.e4!.camT).toBeGreaterThan(f30.e4!.camT);
  await page.getByTestId("step-3").click();
  const g: number[] = [];
  for (const n of [30, 31, 32, 33]) g.push((await at(page, frame(n))).e4!.charT);
  expect(g[1]).toBe(g[0]);
  expect(g[2]).toBe(g[0]);
  expect(g[3]).toBeGreaterThan(g[0]);
  await expect(page.getByTestId("timing-chip")).toContainText("drawing");
  await page.getByTestId("look-split").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-style", "split");
  await settle(page, 3);
  expect((await picturedness(page)).spread).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test("every impossible-camera shot renders and breaks its rule", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "exp=5&freeze=1.2");
  const root = page.getByTestId("lab-root");
  for (const demo of ["cheat", "push", "scale", "wall", "whip"]) {
    await page.getByTestId(`demo-${demo}`).click();
    await expect(root).toHaveAttribute("data-demo", demo);
    const s = await at(page, demo === "scale" ? 4.4 : demo === "wall" ? 5.5 : demo === "push" ? 4.2 : 1.2);
    expect(s.e5!.frame.demo).toBe(demo);
    expect((await picturedness(page)).spread, `${demo} picture`).toBeGreaterThan(4);
    if (demo === "cheat") expect(s.e5!.faceWide).toBeGreaterThan(s.e5!.faceTele * 1.1);
    if (demo === "scale") {
      expect(s.e5!.frame.pipScale).toBeGreaterThan(1.5);
      expect(s.e5!.pipFrac).toBeGreaterThan(s.e5!.pipFracPhysical * 1.5);
    }
    if (demo === "wall") expect(s.e5!.frame.shot.position.z).toBeLessThan(-6);
  }
  await page.keyboard.press("KeyI");
  await expect(page.getByTestId("e5-readouts")).toBeVisible();
  const g = Number((await page.getByTestId("peak-g").textContent())?.replace(/[^\d.]/g, ""));
  const gPhys = Number((await page.getByTestId("peak-g-physical").textContent())?.replace(/[^\d.]/g, ""));
  expect(g).toBeGreaterThan(20);
  expect(gPhys).toBeLessThan(1);
  expect(errors).toEqual([]);
});
