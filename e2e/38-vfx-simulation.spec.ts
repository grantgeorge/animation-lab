import { expect, test, type Page } from "@playwright/test";

type View = { kind: string; t: number; frame: number; phase: string; particles: number; flash: boolean };
type Measure = { run: number; frames: number; first: number; impact: number; pieces: number } | null;
type Hook = {
  getState: () => { mode: string; exp: string; treatment: string; compare: boolean; offset: number; phys: Record<string, number>; timing: Record<string, { step: number; hold: number; antic: number }>; cats: Record<string, { look: string; motion: string; value: number }>; catCompare: boolean; playing: boolean };
  set: (patch: Record<string, unknown>) => void;
  live: () => { t: number; frame: number; frameId: number; ready: boolean; views: Record<string, View>; rendered: string[]; bake: { done: boolean; n: number; progress: number } };
  frames: (n?: number) => Promise<number>;
  seek: (t: number) => void;
  pause: () => void;
  play: () => void;
  bake: () => number;
  measures: () => Record<"real" | "cartoon" | "drawn", Measure>;
  prompts: () => Record<string, string>;
};
declare global {
  interface Window {
    __vfxLab?: Hook;
  }
}

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/labs/vfx-simulation?e2e=1${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__vfxLab, null, { timeout: 60_000 });
  await page.evaluate(async () => {
    window.__vfxLab!.pause();
    await window.__vfxLab!.frames(2);
  });
  return { errors };
}

const root = (page: Page) => page.getByTestId("lab-root");

async function settle(page: Page, n = 3) {
  await page.evaluate(async (k) => window.__vfxLab!.frames(k), n);
}

test("the bucket: three treatments side by side, a measured scoreboard, no errors", async ({ page }) => {
  const { errors } = await open(page);
  await expect(root(page)).toHaveAttribute("data-exp", "bucket");
  await expect(root(page)).toHaveAttribute("data-compare", "1");
  await expect(root(page)).toHaveAttribute("data-tier", "e2e");
  for (const s of ["A", "B", "C"]) await expect(page.getByTestId(`view-${s}`)).toBeVisible();
  await expect(page.getByTestId("scoreboard")).toBeVisible();
  // finish the realistic bake deterministically, then read the measurements
  await page.evaluate(() => window.__vfxLab!.bake());
  await expect(root(page)).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  const m = await page.evaluate(() => window.__vfxLab!.measures());
  expect(m.real && m.cartoon && m.drawn).toBeTruthy();
  // the lesson, measured: the held cartoon crown reads far longer than the physical sim
  expect(m.cartoon!.run).toBeGreaterThanOrEqual(m.real!.run + 6);
  expect(m.drawn!.run).toBeGreaterThan(m.real!.run);
  await expect(page.getByTestId("score-cartoon")).toHaveAttribute("data-run", String(m.cartoon!.run));
  await expect(root(page)).toHaveAttribute("data-legible-real", String(m.real!.run));
  // all three views render this frame
  const live = await page.evaluate(async () => {
    window.__vfxLab!.seek(1.6);
    await window.__vfxLab!.frames(3);
    return window.__vfxLab!.live();
  });
  expect(live.rendered.sort()).toEqual(["A", "B", "C"]);
  expect(live.views.A.kind).toBe("bucket:real");
  expect(live.views.B.kind).toBe("bucket:cartoon");
  expect(live.views.C.kind).toBe("bucket:drawn");
  expect(live.views.A.particles).toBeGreaterThan(500);
  expect(live.views.B.phase).toBe("hold");
  expect(errors).toEqual([]);
});

test("treatments: solo each, keys 1·2·3, the impact frame and stepping on twos", async ({ page }) => {
  const { errors } = await open(page, "compare=0");
  await expect(root(page)).toHaveAttribute("data-compare", "0");
  await page.getByTestId("treatment-drawn").click();
  await expect(root(page)).toHaveAttribute("data-treatment", "drawn");
  await expect(root(page)).toHaveAttribute("data-step", "2");
  // the hand-drawn impact frame is one frame on ones, even though the drawings are on twos
  const flashes = await page.evaluate(async () => {
    const h = window.__vfxLab!;
    const out: { f: number; flash: boolean; t: number }[] = [];
    for (let f = 26; f < 40; f++) {
      h.seek(f / 24 + 0.001);
      await h.frames(2);
      const v = h.live().views.P;
      out.push({ f, flash: v.flash, t: v.t });
    }
    return out;
  });
  expect(flashes.filter((x) => x.flash).length).toBe(1);
  // on twos: the sampled time only changes every second frame
  const ts = flashes.map((x) => x.t.toFixed(4));
  for (let i = 0; i + 1 < ts.length; i += 2) if (flashes[i].f % 2 === 0) expect(ts[i]).toBe(ts[i + 1]);
  await page.keyboard.press("Digit1");
  await expect(root(page)).toHaveAttribute("data-treatment", "real");
  await page.keyboard.press("Digit2");
  await expect(root(page)).toHaveAttribute("data-treatment", "cartoon");
  await page.keyboard.press("KeyC");
  await expect(root(page)).toHaveAttribute("data-compare", "1");
  await page.getByTestId("compare-toggle").click();
  await expect(root(page)).toHaveAttribute("data-compare", "0");
  await expect(page.getByTestId("view-P")).toBeVisible();
  expect(errors).toEqual([]);
});

test("controls: timing changes the measured legibility and the prompt; physics re-bakes the sim", async ({ page }) => {
  const { errors } = await open(page, "compare=0&tr=cartoon");
  const run = async () => (await page.evaluate(() => window.__vfxLab!.measures())).cartoon!.run;
  await settle(page);
  const before = await run();
  await page.getByTestId("hold").fill("14");
  await expect(root(page)).toHaveAttribute("data-hold", "14");
  await settle(page);
  expect(await run()).toBeGreaterThan(before);
  await expect(page.getByTestId("prompt-phrase-cartoon")).toContainText("holds for 14-frame");
  await page.getByTestId("hold").fill("0");
  await settle(page);
  expect(await run()).toBeLessThan(before);
  await expect(page.getByTestId("prompt-phrase-cartoon")).toContainText("falls straight away");
  await page.getByTestId("antic").fill("0");
  await expect(root(page)).toHaveAttribute("data-antic", "0");
  await expect(page.getByTestId("reading-body")).toContainText("No anticipation");
  await page.getByTestId("step-3").click();
  await expect(root(page)).toHaveAttribute("data-step", "3");
  await expect(page.getByTestId("prompt-phrase-cartoon")).toContainText("on threes");
  // physics: gravity and viscosity reach every treatment; the realistic sim bakes again
  await page.evaluate(() => window.__vfxLab!.bake());
  await settle(page);
  await expect(root(page)).toHaveAttribute("data-baked", "1");
  await page.getByTestId("gravity").fill("0.5");
  await expect(root(page)).toHaveAttribute("data-gravity", "0.50");
  await page.getByTestId("treatment-real").click();
  await settle(page);
  const st = await page.evaluate(() => window.__vfxLab!.getState().phys);
  expect(st.gravity).toBeCloseTo(0.5, 5);
  await page.getByTestId("viscosity").fill("0.9");
  await expect(root(page)).toHaveAttribute("data-viscosity", "0.90");
  await expect(page.getByTestId("prompt-phrase-real")).toContainText("syrupy");
  await expect(page.getByTestId("prompt-phrase-real")).toContainText("low gravity");
  for (const id of ["intensity", "turbulence", "stylization"]) await page.getByTestId(id).fill("0.8");
  await page.getByTestId("count").fill("400");
  await expect(root(page)).toHaveAttribute("data-count", "400");
  await page.evaluate(() => window.__vfxLab!.bake());
  await settle(page);
  expect((await page.evaluate(() => window.__vfxLab!.live())).bake.n).toBe(400);
  expect(errors).toEqual([]);
});

test("in sync: Pip's flinch against the splash, measured and explained", async ({ page }) => {
  const { errors } = await open(page, "exp=sync");
  await expect(root(page)).toHaveAttribute("data-exp", "sync");
  await expect(page.getByTestId("view-A")).toBeVisible();
  await expect(page.getByTestId("view-B")).toBeVisible();
  await page.getByTestId("offset-2").click();
  await expect(root(page)).toHaveAttribute("data-offset", "2");
  await expect(page.getByTestId("reading-head")).toHaveText("In sync");
  await expect(page.getByTestId("sync-chart")).toHaveAttribute("data-lag", "2");
  await page.getByTestId("offset--4").click();
  await expect(page.getByTestId("reading-head")).toHaveText("Too early");
  await expect(page.getByTestId("prompt-phrase-sync")).toContainText("flinches 4 frames before the water lands");
  await page.getByTestId("offset-12").click();
  await expect(page.getByTestId("reading-head")).toHaveText("Disconnected");
  const live = await page.evaluate(async () => {
    window.__vfxLab!.seek(1.3);
    await window.__vfxLab!.frames(3);
    return window.__vfxLab!.live();
  });
  expect(live.views.A.kind).toBe("bucket:cartoon:2");
  expect(live.views.B.kind).toBe("bucket:cartoon:12");
  expect(errors).toEqual([]);
});

test("the six categories: each renders, toggles realistic/stylized and simulated/keyframed, and splits", async ({ page }) => {
  const { errors } = await open(page, "exp=fire");
  for (const id of ["fire", "water", "rigid", "cloth", "magic", "drawn"]) {
    await page.getByTestId(`exp-${id}`).click();
    await expect(root(page)).toHaveAttribute("data-exp", id);
    await page.getByTestId("look-real").click();
    await page.getByTestId("motion-sim").click();
    await settle(page, 3);
    let v = (await page.evaluate(() => window.__vfxLab!.live())).views.P;
    expect(v.kind).toBe(`${id}:real:sim`);
    await page.getByTestId("look-stylized").click();
    await page.getByTestId("motion-keyed").click();
    await expect(root(page)).toHaveAttribute("data-look", "stylized");
    await expect(root(page)).toHaveAttribute("data-motion", "keyed");
    await settle(page, 3);
    v = (await page.evaluate(() => window.__vfxLab!.live())).views.P;
    expect(v.kind).toBe(`${id}:stylized:keyed`);
    await page.getByTestId("cat-value").fill("0.9");
    await expect(page.getByTestId("cat-value-value")).toHaveText("90%");
    await expect(page.getByTestId("prompt")).toBeVisible();
  }
  await page.getByTestId("split-toggle").click();
  await expect(root(page)).toHaveAttribute("data-split", "1");
  await settle(page, 3);
  const live = await page.evaluate(() => window.__vfxLab!.live());
  expect(live.rendered.sort()).toEqual(["A", "B"]);
  expect(live.views.A.kind).toBe("drawn:real:sim");
  expect(live.views.B.kind).toBe("drawn:stylized:keyed");
  // the keyed throw has a single impact flash frame
  const flashes = await page.evaluate(async () => {
    const h = window.__vfxLab!;
    let n = 0;
    for (let f = 14; f < 26; f++) {
      h.seek(f / 24 + 0.001);
      await h.frames(2);
      if (h.live().views.B.flash) n++;
    }
    return n;
  });
  expect(flashes).toBe(1);
  expect(errors).toEqual([]);
});

test("inspect and watch: curves, measurements, overlays; deterministic scrubbing and the test hook", async ({ page }) => {
  const { errors } = await open(page, "mode=inspect");
  await expect(root(page)).toHaveAttribute("data-mode", "inspect");
  await page.evaluate(() => window.__vfxLab!.bake());
  await settle(page);
  await expect(page.getByTestId("curves-chart")).toBeVisible();
  await expect(page.getByTestId("measure-table")).toBeVisible();
  await expect(page.getByTestId("curve-real")).toBeAttached();
  await page.getByTestId("toggle-raster").check();
  await page.getByTestId("toggle-vectors").check();
  const a = await page.evaluate(async () => {
    window.__vfxLab!.seek(1.45);
    await window.__vfxLab!.frames(3);
    return window.__vfxLab!.live().views;
  });
  const b = await page.evaluate(async () => {
    window.__vfxLab!.seek(2.5);
    await window.__vfxLab!.frames(2);
    window.__vfxLab!.seek(1.45);
    await window.__vfxLab!.frames(3);
    return window.__vfxLab!.live().views;
  });
  for (const s of ["A", "B", "C"]) {
    expect(b[s].phase).toBe(a[s].phase);
    expect(b[s].particles).toBe(a[s].particles);
  }
  const prompts = await page.evaluate(() => window.__vfxLab!.prompts());
  for (const k of ["real", "cartoon", "drawn", "sync", "fire", "water", "rigid", "cloth", "magic", "drawn"]) expect(prompts[k].length).toBeGreaterThan(40);
  expect(new Set([prompts.real, prompts.cartoon, prompts.drawn]).size).toBe(3);
  // shortcuts ignore keys typed into inputs: move focus off the overlay toggle first
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("KeyW");
  await expect(root(page)).toHaveAttribute("data-mode", "watch");
  await expect(page.getByTestId("caption")).toBeVisible();
  await expect(page.getByTestId("legibility-strip")).toBeVisible();
  await page.getByTestId("mode-experiment").click();
  await expect(page.getByTestId("controls")).toBeVisible();
  for (const r of ["timing-and-spacing", "animation-style", "environment-depth", "painterly-textures"]) await expect(page.getByTestId(`related-${r}`)).toHaveAttribute("href", `/labs/${r}`);
  expect(errors).toEqual([]);
});
