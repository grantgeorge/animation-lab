import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

type Stats = { mean: [number, number, number]; lumaStd: number; localVar: number; chroma: number };
type Sample = { width: number; height: number; data: number[]; stats: Stats };
type Hook = {
  getState: () => { mode: string; view: string; lookId: string | null; simple: Record<string, number>; mismatch: number | null; mismatchRaw: number | null; phrase: string; platesReady: boolean; nodes: Record<string, boolean> };
  applyLook: (id: string) => void;
  patchLook: (p: unknown) => void;
  setSimple: (k: string, v: number) => void;
  reset: () => void;
  setNodes: (on: Record<string, boolean>) => void;
  setStep: (s: string) => void;
  autoBalanceAll: () => void;
  suggestOverride: () => void;
  pause: () => void;
  seek: (t: number) => void;
  frames: (n?: number) => Promise<number>;
  sample: (o?: { slot?: string; width?: number; height?: number; before?: boolean }) => Promise<Sample>;
  engineGrade: (rgb: number[]) => number[];
};
declare global {
  interface Window {
    __gradingLab?: Hook;
  }
}

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/labs/grading-finishing?e2e=1&freeze=3.4${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__gradingLab, null, { timeout: 30_000 });
  await page.evaluate(() => window.__gradingLab!.frames(4));
  return { errors };
}

/** Pause on a frame, let it render, and sample the main monitor's finished output. */
async function sample(page: Page, o: { t?: number; slot?: string; before?: boolean; width?: number; height?: number } = {}) {
  return page.evaluate(async (o) => {
    const h = window.__gradingLab!;
    h.pause();
    if (o.t !== undefined) h.seek(o.t);
    await h.frames(3);
    return h.sample({ slot: o.slot, before: o.before, width: o.width, height: o.height });
  }, o);
}

const lumaAt = (s: Sample, i: number) => 0.2126 * s.data[i * 4] + 0.7152 * s.data[i * 4 + 1] + 0.0722 * s.data[i * 4 + 2];

test("the lab opens on the four-slider film look with the honest caption and no errors", async ({ page }) => {
  const { errors } = await open(page);
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-mode", "experiment");
  await expect(root).toHaveAttribute("data-look", "clean");
  await expect(root).toHaveAttribute("data-grain", "0");
  await expect(root).toHaveAttribute("data-temperature", "50");
  await expect(root).toHaveAttribute("data-contrast", "50");
  await expect(root).toHaveAttribute("data-bloom", "0");
  for (const [k, v] of [["grain", "0%"], ["temperature", "50%"], ["contrast", "50%"], ["bloom", "0%"]]) await expect(page.getByTestId(`simple-${k}-value`)).toHaveText(v);
  await expect(page.getByTestId("caption")).toHaveText("Stylized demonstration of grading and finishing, not a physically accurate film-stock simulation.");
  await expect(page.getByTestId("reset-effects")).toBeVisible();
  await expect(page.getByTestId("advanced")).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("pipeline-strip")).toBeVisible();
  await expect(root).toHaveAttribute("data-nodes", "grade,stylize,lens,halation,bloom,vignette,sharpen,grain,weave");
  const s = await sample(page);
  expect(s.stats.lumaStd).toBeGreaterThan(0.05);
  expect(errors).toEqual([]);
});

test("each simple slider moves the pixels the right way, and Reset restores the clean frame", async ({ page }) => {
  const { errors } = await open(page);
  const base = await sample(page);
  const set = async (k: string, v: number) => {
    await page.getByTestId(`simple-${k}`).locator("input").fill(String(v));
    return sample(page);
  };
  // Warmer: more red than blue, relative to the clean frame.
  const warm = await set("temperature", 100);
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-temperature", "100");
  expect(warm.stats.mean[0] - warm.stats.mean[2]).toBeGreaterThan(base.stats.mean[0] - base.stats.mean[2] + 0.04);
  await set("temperature", 50);
  // Contrast widens the luma spread.
  const hard = await set("contrast", 100);
  expect(hard.stats.lumaStd).toBeGreaterThan(base.stats.lumaStd * 1.15);
  await set("contrast", 50);
  // Bloom brightens the ring around the highlights.
  const bloom = await set("bloom", 100);
  const n = base.width * base.height;
  const hot = new Set<number>();
  for (let i = 0; i < n; i++) if (lumaAt(base, i) > 225) hot.add(i);
  expect(hot.size).toBeGreaterThan(20);
  let ring0 = 0, ring1 = 0, rn = 0;
  for (let i = 0; i < n; i++) {
    if (hot.has(i)) continue;
    const x = i % base.width, y = Math.floor(i / base.width);
    let near = false;
    for (let dy = -6; dy <= 6 && !near; dy += 2) for (let dx = -6; dx <= 6 && !near; dx += 2) near = hot.has((y + dy) * base.width + x + dx);
    if (!near) continue;
    ring0 += lumaAt(base, i); ring1 += lumaAt(bloom, i); rn++;
  }
  expect(ring1 / rn).toBeGreaterThan(ring0 / rn + 4);
  await set("bloom", 0);
  // Grain raises fine local variance.
  const grain = await set("grain", 100);
  expect(grain.stats.localVar - base.stats.localVar).toBeGreaterThan(0.001);
  // Reset restores every slider and the clean pixels.
  await page.getByTestId("reset-effects").click();
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-grain", "0");
  await expect(root).toHaveAttribute("data-look", "clean");
  const after = await sample(page);
  const diff = after.data.reduce((s, v, i) => s + Math.abs(v - base.data[i]), 0) / after.data.length;
  expect(diff).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});

test("grain is deterministic on a paused frame and different on the next frame", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__gradingLab!.setSimple("grain", 0.8));
  const a = await sample(page, { t: 2 });
  const b = await sample(page, { t: 2 });
  const c = await sample(page, { t: 2 + 1 / 24 });
  const d = (x: Sample, y: Sample) => x.data.reduce((s, v, i) => s + Math.abs(v - y.data[i]), 0) / x.data.length;
  expect(d(a, b)).toBe(0);
  // The scene itself barely moves in one frame at 3.4 s; the grain is what changes.
  expect(d(a, c)).toBeGreaterThan(2);
});

test("the GPU grade mirrors the pure engine", async ({ page }) => {
  await open(page, "look=k500t");
  await page.evaluate(() => window.__gradingLab!.setNodes({ stylize: false, lens: false, halation: false, bloom: false, vignette: false, sharpen: false, grain: false, weave: false }));
  const before = await sample(page, { before: true, width: 160, height: 90 });
  const after = await sample(page, { width: 160, height: 90 });
  const rgb: number[] = [];
  for (let i = 0; i < before.data.length; i += 4) rgb.push(before.data[i], before.data[i + 1], before.data[i + 2]);
  const want = await page.evaluate((rgb) => window.__gradingLab!.engineGrade(rgb), rgb);
  let err = 0;
  for (let p = 0, q = 0; p < after.data.length; p += 4, q += 3) err += Math.abs(after.data[p] - want[q]) + Math.abs(after.data[p + 1] - want[q + 1]) + Math.abs(after.data[p + 2] - want[q + 2]);
  expect(err / (want.length)).toBeLessThan(3);
});

test("presets apply from the list and from ?look=, and change the picture as described", async ({ page }) => {
  const { errors } = await open(page, "look=matrix");
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-look", "matrix");
  const m = await sample(page);
  await page.evaluate(() => window.__gradingLab!.reset());
  const clean = await sample(page);
  // Green pushed relative to red, colour drained.
  expect(m.stats.mean[1] - m.stats.mean[0]).toBeGreaterThan(clean.stats.mean[1] - clean.stats.mean[0] + 0.03);
  expect(m.stats.chroma).toBeLessThan(clean.stats.chroma);
  await page.getByTestId("advanced-toggle").click();
  await page.getByTestId("tab-looks").click();
  await page.getByTestId("look-comic").click();
  await expect(root).toHaveAttribute("data-look", "comic");
  await expect(root).toHaveAttribute("data-stylize", "comic");
  await expect(root).toHaveAttribute("data-stepped", "1");
  await expect(page).toHaveURL(/look=comic/);
  await page.getByTestId("look-painterly").click();
  await expect(root).toHaveAttribute("data-stylize", "painterly");
  await expect(page.getByTestId("look-painterly")).toContainText("Arcane-inspired");
  await page.getByTestId("look-k500t").click();
  const phrase = await page.evaluate(() => window.__gradingLab!.getState().phrase);
  expect(phrase).toContain("Kodak 500T-inspired");
  // Bypassing a node is reflected on the root and in the picture.
  const on = await sample(page);
  await page.getByTestId("node-grade").click();
  await expect(root).toHaveAttribute("data-nodes", /^stylize,/);
  const off = await sample(page);
  expect(Math.abs(off.stats.mean[0] - on.stats.mean[0]) + Math.abs(off.stats.mean[2] - on.stats.mean[2])).toBeGreaterThan(0.01);
  expect(errors).toEqual([]);
});

test("the show-look exercise cuts the cross-shot drift, and an intentional override doesn't count as drift", async ({ page }) => {
  const { errors } = await open(page, "view=show&look=k500t");
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-view", "show");
  await expect(root).toHaveAttribute("data-plates", "1", { timeout: 20_000 });
  for (const id of ["doorway", "alley", "workshop"]) await expect(page.getByTestId(`show-monitor-${id}`)).toBeVisible();
  await expect(page.getByTestId("cant-fix")).toContainText("can’t fix");
  const raw = await page.evaluate(() => window.__gradingLab!.getState());
  expect(raw.mismatch).not.toBeNull();
  expect(raw.mismatch).toBeCloseTo(raw.mismatchRaw!, 6);
  await page.getByTestId("step-match").click();
  await page.getByTestId("auto-balance").click();
  const matched = await page.evaluate(() => window.__gradingLab!.getState().mismatch!);
  expect(matched).toBeLessThan(raw.mismatch! * 0.5);
  await page.getByTestId("step-look").click();
  const looked = await page.evaluate(() => window.__gradingLab!.getState().mismatch!);
  expect(looked).toBeLessThan(raw.mismatch! * 0.5);
  await page.getByTestId("step-override").click();
  await page.getByTestId("suggest-override").click();
  await expect(root).toHaveAttribute("data-shot", "workshop");
  await expect(page.getByTestId("show-monitor-workshop").locator("xpath=..")).toContainText("Override");
  const over = await page.evaluate(() => window.__gradingLab!.getState().mismatch!);
  expect(over).toBeLessThan(raw.mismatch! * 0.5);
  // The override is visible in the workshop's pixels: warmer than at the look step.
  const warmShop = await sample(page, { slot: "show:workshop", width: 160, height: 90 });
  await page.getByTestId("step-look").click();
  const shop = await sample(page, { slot: "show:workshop", width: 160, height: 90 });
  expect(warmShop.stats.mean[0] - warmShop.stats.mean[2]).toBeGreaterThan(shop.stats.mean[0] - shop.stats.mean[2] + 0.01);
  await page.getByTestId("step-override").click();
  await expect(page.getByTestId("mismatch-value")).toHaveText(over.toFixed(3));
  // The show monitors really render: the warm drift on the raw doorway is visible in its pixels.
  await page.getByTestId("step-raw").click();
  const door = await sample(page, { slot: "show:doorway", width: 160, height: 90 });
  await page.getByTestId("step-match").click();
  const doorMatched = await sample(page, { slot: "show:doorway", width: 160, height: 90 });
  expect(door.stats.mean[0] - door.stats.mean[2]).toBeGreaterThan(doorMatched.stats.mean[0] - doorMatched.stats.mean[2] + 0.03);
  expect(errors).toEqual([]);
});

test("the .cube LUT and the show-look JSON download", async ({ page }) => {
  await open(page, "look=teal-orange");
  await page.locator("[data-testid=deliver] > summary").click();
  await expect(page.getByTestId("look-phrase")).toContainText("teal shadows and orange highlights");
  const [cube] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-cube").click()]);
  expect(cube.suggestedFilename()).toMatch(/\.cube$/);
  const text = readFileSync(await cube.path(), "utf8");
  expect(text).toContain("LUT_3D_SIZE 33");
  const rows = text.split("\n").filter((l) => /^\d\.\d{6} \d\.\d{6} \d\.\d{6}$/.test(l));
  expect(rows.length).toBe(33 ** 3);
  const [json] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-json").click()]);
  const doc = JSON.parse(readFileSync(await json.path(), "utf8"));
  expect(doc.format).toBe("animation-lab.show-look");
  expect(Object.keys(doc.shots)).toEqual(["doorway", "alley", "workshop"]);
  expect(doc.show.lookId).toBe("teal-orange");
});

test("modes switch by button, key and URL; Inspect shows the wipe, thumbnails and live scopes", async ({ page }) => {
  const { errors } = await open(page, "mode=inspect");
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-mode", "inspect");
  await expect(page.getByTestId("wipe")).toBeVisible();
  await expect(root).toHaveAttribute("data-wipe", "0.50");
  await expect(page.getByTestId("thumb-grain")).toBeVisible();
  await expect(page.getByTestId("scopes")).toBeVisible();
  // The scope canvases receive traces from the readback.
  await expect
    .poll(async () => page.getByTestId("scope-waveform").locator("canvas").evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 60) lit++;
      return lit;
    }), { timeout: 10_000 })
    .toBeGreaterThan(200);
  // Dragging the wipe moves it.
  const box = (await page.getByTestId("wipe").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.up();
  await expect(root).toHaveAttribute("data-wipe", /^0\.2/);
  await page.keyboard.press("w");
  await expect(root).toHaveAttribute("data-mode", "watch");
  await expect(page.getByTestId("simple-panel")).toHaveCount(0);
  await expect(page.getByTestId("watch-caption")).toBeVisible();
  await page.getByTestId("mode-experiment").click();
  await expect(root).toHaveAttribute("data-mode", "experiment");
  await expect(page).toHaveURL(/mode=experiment/);
  await page.getByTestId("shot-alley").click();
  await expect(root).toHaveAttribute("data-shot", "alley");
  await expect(page).toHaveURL(/shot=alley/);
  const s = await sample(page);
  expect(s.stats.lumaStd).toBeGreaterThan(0.03);
  expect(errors).toEqual([]);
});
