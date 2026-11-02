import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";

type Rect4 = [number, number, number, number];
type Live = {
  t: number;
  u: number;
  frameId: number;
  ready: boolean;
  reveal: { total: number; edge: number; disoccluded: number };
  revealEnd: null | { total: number; edge: number; disoccluded: number };
  layers: { index: number; depth: number; depthNow: number; shiftX: number; speed: number }[];
  construction: null | { content: number; hole: number; void: number; samples: [number, number][] };
  probes: { far: Rect4; near: Rect4 };
  scale: { k: number; treeReadsM: number };
  captures: number;
};
type Hook = {
  getState: () => { mode: string; construct: string; move: string; step: number | null; cues: Record<string, unknown> };
  set: (patch: Record<string, unknown>) => void;
  live: () => Live;
  frames: (n?: number) => Promise<number>;
  setU: (u: number) => void;
  pause: () => void;
};
declare global {
  interface Window {
    __envLab?: Hook;
  }
}

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/labs/environment-depth?e2e=1${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__envLab, null, { timeout: 60_000 });
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  await page.evaluate(() => window.__envLab!.frames(2));
  return { errors };
}

/** Apply a state patch, freeze the move at progress u, let a few frames render, read the live state. */
async function at(page: Page, patch: Record<string, unknown>, u: number, frames = 4) {
  await page.evaluate(
    async ([p, u, n]) => {
      const h = window.__envLab!;
      h.pause();
      h.set(p as Record<string, unknown>);
      h.setU(u as number);
      await h.frames(n as number);
    },
    [patch, u, frames] as const,
  );
  return page.evaluate(() => window.__envLab!.live());
}

async function picture(page: Page) {
  const box = (await page.getByTestId("monitor-main").boundingBox())!;
  const png = PNG.sync.read(await page.screenshot({ clip: box }));
  return png;
}

const lum = (png: PNG, x: number, y: number) => {
  const i = (y * png.width + x) * 4;
  return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
};

/** Mean and standard deviation of luminance inside a normalised rect (x0, y0, x1, y1; y down). */
function stats(png: PNG, r: Rect4) {
  const x0 = Math.floor(r[0] * png.width);
  const x1 = Math.ceil(r[2] * png.width);
  const y0 = Math.floor(r[1] * png.height);
  const y1 = Math.ceil(r[3] * png.height);
  let n = 0;
  let s = 0;
  let s2 = 0;
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      const l = lum(png, x, y);
      s += l;
      s2 += l * l;
      n++;
    }
  const mean = s / n;
  return { mean, sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
}

/** Horizontal column-luminance profile of a band (y0..y1 normalised), downsampled. */
function profile(png: PNG, y0: number, y1: number) {
  const out: number[] = [];
  const ya = Math.floor(y0 * png.height);
  const yb = Math.ceil(y1 * png.height);
  for (let x = 0; x < png.width; x++) {
    let s = 0;
    for (let y = ya; y < yb; y += 2) s += lum(png, x, y);
    out.push(s / Math.ceil((yb - ya) / 2));
  }
  return out;
}

/** The horizontal shift (px) that best aligns profile b with a (normalised cross-correlation). */
function shiftOf(a: number[], b: number[], max = 260) {
  let best = 0;
  let bestScore = -Infinity;
  const n = a.length;
  for (let d = -max; d <= max; d++) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, c = 0;
    for (let x = Math.max(0, -d) + 40; x < Math.min(n, n - d) - 40; x++) {
      const p = a[x];
      const q = b[x + d];
      sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q; c++;
    }
    const cov = sab / c - (sa / c) * (sb / c);
    const score = cov / Math.sqrt(Math.max(1e-9, (saa / c - (sa / c) ** 2) * (sbb / c - (sb / c) ** 2)));
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

test("modes, deep links, keyboard and take-apart, with no console errors", async ({ page }) => {
  test.setTimeout(180_000);
  const { errors } = await open(page, "u=0");
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-mode", "experiment");
  await expect(root).toHaveAttribute("data-construct", "3d");
  await expect(page.getByTestId("controls")).toBeVisible();
  await page.getByTestId("mode-inspect").click();
  await expect(root).toHaveAttribute("data-mode", "inspect");
  await expect(page.getByTestId("plan-view")).toBeVisible();
  await expect(page.getByTestId("layer-stack")).toBeVisible();
  await expect(page.getByTestId("haze-curve")).toBeVisible();
  await expect(page.getByTestId("readouts")).toContainText("Camera height");
  await expect(page.getByTestId("ro-distance")).toHaveText(/\d+\.\d m/);
  await page.keyboard.press("KeyW");
  await expect(root).toHaveAttribute("data-mode", "watch");
  await expect(page.getByTestId("caption")).toContainText("flat screen");
  await page.keyboard.press("KeyE");
  await expect(root).toHaveAttribute("data-mode", "experiment");
  await expect(page).toHaveURL(/mode=experiment/);

  // Construction switch (toolbar, panel, keys) and the URL follow each other.
  await page.getByTestId("construct-25d").click();
  await expect(root).toHaveAttribute("data-construct", "25d");
  await expect(page).toHaveURL(/construct=25d/);
  await page.keyboard.press("Digit1");
  await expect(root).toHaveAttribute("data-construct", "2d");
  await page.getByTestId("construct-3d").click();
  await expect(root).toHaveAttribute("data-construct", "3d");
  await page.getByTestId("move-arc").click();
  await expect(root).toHaveAttribute("data-move", "arc");

  // Take-apart: flatten, then rebuild one cue at a time.
  await page.getByTestId("flatten").click();
  await expect(root).toHaveAttribute("data-cues-on", "");
  await expect(root).toHaveAttribute("data-step", "0");
  await expect(page.getByTestId("prompt-phrase")).toContainText("no haze");
  for (let i = 1; i <= 7; i++) {
    await page.getByTestId("add-cue").click();
    await expect(root).toHaveAttribute("data-step", String(i));
  }
  await expect(root).toHaveAttribute("data-cues-on", "parallax,haze,layers,scale,occlusion,dof,perspective");
  await expect(page.getByTestId("prompt-phrase")).toContainText("atmospheric haze on distant ridges");

  // Deep links.
  await page.goto("/labs/environment-depth?e2e=1&mode=watch&construct=25d&move=push&cue=haze&u=0.5");
  await expect(root).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  await expect(root).toHaveAttribute("data-mode", "watch");
  await expect(root).toHaveAttribute("data-construct", "25d");
  await expect(root).toHaveAttribute("data-move", "push");
  await expect(root).toHaveAttribute("data-cues-on", "haze");
  await expect(root).toHaveAttribute("data-cue-layers", "off");
  await page.goto("/labs/environment-depth?e2e=1&mode=inspect&step=3&overlay=bands");
  await expect(root).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  await expect(root).toHaveAttribute("data-step", "3");
  await expect(root).toHaveAttribute("data-overlay", "bands");
  await expect(root).toHaveAttribute("data-cues-on", "layers,occlusion,perspective");
  expect(errors).toEqual([]);
});

test("atmospheric haze lifts and flattens the far forest; scale cues change how tall the tree reads", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "u=0");
  const live0 = await at(page, { cues: { haze: 0, dof: false } }, 0);
  const clear = stats(await picture(page), live0.probes.far);
  const live1 = await at(page, { cues: { haze: 1, dof: false } }, 0);
  const hazy = stats(await picture(page), live1.probes.far);
  expect(hazy.mean).toBeGreaterThan(clear.mean + 25);
  expect(hazy.sd).toBeLessThan(clear.sd * 0.75);
  // Near region barely changes: haze is a function of distance.
  const nearClear = stats(await picture(page), live1.probes.near);
  await at(page, { cues: { haze: 0, dof: false } }, 0);
  const nearHazy = stats(await picture(page), live1.probes.near);
  expect(Math.abs(nearClear.mean - nearHazy.mean)).toBeLessThan((hazy.mean - clear.mean) * 0.6);

  await page.getByTestId("story-tiny").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-scale-story", "tiny");
  await expect(page.getByTestId("tree-reads")).toContainText("reads as 16 m");
  await expect(page.getByTestId("tree-chip")).toContainText("reads as 16 m");
  expect(errors).toEqual([]);
});

test("2.5D layers slide at different speeds; the 2D plate slides as one", async ({ page }) => {
  test.setTimeout(150_000);
  const { errors } = await open(page, "u=0&move=track");
  // Analytic slides of the card anchors: ∝ 1 / depth in 2.5D, one value in 2D.
  const l25 = await at(page, { construct: "25d", cues: { dof: false } }, 0.3);
  const shifts = l25.layers.map((l) => Math.abs(l.shiftX));
  for (let i = 1; i < shifts.length; i++) expect(shifts[i]).toBeLessThan(shifts[i - 1]);
  expect(shifts[0] / shifts[shifts.length - 1]).toBeGreaterThan(10);
  const l2 = await at(page, { construct: "2d" }, 0.3);
  expect(l2.layers).toHaveLength(1);

  // Pixels: compare a high band (trunks receding into haze) with a low band (path-side ferns) between u = 0 and u = 0.2.
  const measure = async (construct: string) => {
    await at(page, { construct, cues: { dof: false } }, 0);
    const a = await picture(page);
    await at(page, { construct }, 0.2);
    const b = await picture(page);
    return { top: shiftOf(profile(a, 0.06, 0.3), profile(b, 0.06, 0.3)), low: shiftOf(profile(a, 0.84, 0.97), profile(b, 0.84, 0.97)) };
  };
  const flat = await measure("2d");
  const layered = await measure("25d");
  // 2D: both bands slide together. 2.5D: the near band slides clearly faster than the far one.
  expect(Math.abs(flat.low - flat.top)).toBeLessThan(10);
  expect(Math.abs(flat.low) / Math.abs(flat.top)).toBeGreaterThan(0.8);
  expect(Math.abs(flat.low) / Math.abs(flat.top)).toBeLessThan(1.25);
  expect(Math.abs(layered.low - layered.top)).toBeGreaterThan(15);
  expect(Math.abs(layered.low) / Math.abs(layered.top)).toBeGreaterThan(1.4);
  expect(errors).toEqual([]);
});

test("revealed area: ≈0 on frame 0, larger for the arc than the track; 3D fills what 2.5D never painted", async ({ page }) => {
  test.setTimeout(180_000);
  const { errors } = await open(page, "u=0&construct=3d&move=track");
  const t0 = await at(page, {}, 0);
  expect(t0.reveal.total).toBeLessThan(0.01);
  const tEnd = await at(page, {}, 1);
  expect(tEnd.reveal.total).toBeGreaterThan(0.1);
  const a0 = await at(page, { move: "arc" }, 0);
  expect(a0.reveal.total).toBeLessThan(0.01);
  const aEnd = await at(page, { move: "arc" }, 1);
  expect(aEnd.reveal.total).toBeGreaterThan(tEnd.reveal.total);
  expect(aEnd.reveal.disoccluded).toBeGreaterThan(tEnd.reveal.disoccluded);
  expect(aEnd.revealEnd!.total).toBeCloseTo(aEnd.reveal.total, 2);
  const p = await at(page, { move: "push" }, 1);
  expect(p.reveal.total).toBeLessThan(tEnd.reveal.total);
  await expect(page.getByTestId("monitor-main").getByTestId("reveal-value")).toHaveText(/\d+(\.\d)?%/);

  // 2.5D at the end of the arc: holes where hidden background was never painted.
  const h = await at(page, { construct: "25d", move: "arc", cleanPlates: false, cues: { dof: false } }, 1);
  expect(h.construction!.hole).toBeGreaterThan(0.04);
  await expect(page.getByTestId("holes-chip")).toContainText("never painted");
  const samples = h.construction!.samples;
  expect(samples.length).toBeGreaterThan(5);
  const holes = await picture(page);
  // The same pixels in 3D show real forest instead of the hole pattern.
  await at(page, { construct: "3d" }, 1);
  const real = await picture(page);
  const px = (png: PNG, [x, y]: [number, number]) => {
    const i = (Math.min(png.height - 1, Math.floor(y * png.height)) * png.width + Math.min(png.width - 1, Math.floor(x * png.width))) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  let purple = 0;
  let differs = 0;
  for (const s of samples) {
    const a = px(holes, s);
    const b = px(real, s);
    if (a[2] > a[1] + 4 && a[0] > a[1]) purple++;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 60) differs++;
  }
  expect(purple / samples.length).toBeGreaterThan(0.6);
  expect(differs / samples.length).toBeGreaterThan(0.7);

  // Clean plates paint behind the layers: holes go away (card edges may remain).
  const c = await at(page, { construct: "25d", cleanPlates: true }, 1, 6);
  expect(c.construction!.hole).toBeLessThan(h.construction!.hole * 0.25);
  expect(errors).toEqual([]);
});
