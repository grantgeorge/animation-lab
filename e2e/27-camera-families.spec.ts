import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { cellDiff, cellGrid } from "./helpers/pixels";

type Live = { frameId: number; renders: number; samples: number; bands: number; sampleSpan: number; hfov: number; focalMm: number; subjectFraction: number; maxBlurPx: number; rolling: boolean; lookIds: string[] };
type State = {
  mode: string;
  step: string;
  cameraId: string;
  focalMm: number;
  tStop: number;
  blind: { round: number; looks: string[]; guesses: (string | null)[]; revealed: boolean };
  pause: () => void;
  seek: (t: number) => void;
};
type Hook = { getState: () => State; live: () => Live; frames: (n?: number) => Promise<number>; derived: () => { hfov: number; dof: { nearM: number; farM: number } } };
declare global {
  interface Window {
    __cameraFamilies?: Hook;
  }
}

/** Dev-server compile errors from other labs (built in parallel sessions) are broadcast to every page; ignore those only. */
test.describe.configure({ timeout: 120_000 });

const foreign = (msg: string) => /src\/labs\/(?!camera-families)/.test(msg);

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !foreign(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => !foreign(e.message) && errors.push(e.message));
  await page.goto(`/labs/camera-families?e2e=1&quality=low&freeze=3.4${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__cameraFamilies, null, { timeout: 60_000 });
  await settle(page);
  return { errors };
}

/** Freeze the clock and wait until frames have rendered with the current settings. */
async function settle(page: Page, n = 3) {
  await page.evaluate(async (n) => {
    const h = window.__cameraFamilies!;
    h.getState().pause();
    h.getState().seek(1.0);
    await h.frames(n);
  }, n);
  return page.evaluate(() => window.__cameraFamilies!.live());
}

const root = (page: Page) => page.getByTestId("lab-root");
const shot = async (page: Page, testId = "shot-slot") => cellGrid(await page.getByTestId(testId).screenshot(), 16, 9);
/** Mean over rows of the steepest horizontal luminance step in a column band: falls as an edge blurs. */
const edgePeak = (buf: Buffer, x0: number, x1: number) => {
  const png = PNG.sync.read(buf);
  const l = (k: number) => png.data[k] * 0.3 + png.data[k + 1] * 0.59 + png.data[k + 2] * 0.11;
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(png.height * 0.2); y < png.height * 0.8; y += 2) {
    let peak = 0;
    for (let x = Math.max(1, Math.floor(png.width * x0)); x < png.width * x1; x++) {
      const i = (y * png.width + x) * 4;
      peak = Math.max(peak, Math.abs(l(i) - l(i - 4)));
    }
    sum += peak;
    n++;
  }
  return sum / n;
};
const meanDiff = (a: number[][], b: number[][]) => a.reduce((s, c, i) => s + cellDiff(c, b[i]), 0) / a.length;

test("renders the shot, cards and prompt without errors", async ({ page }) => {
  const { errors } = await open(page);
  await expect(root(page)).toHaveAttribute("data-mode", "experiment");
  await expect(root(page)).toHaveAttribute("data-step", "sensor");
  await expect(root(page)).toHaveAttribute("data-camera", "alexa35");
  await expect(root(page)).toHaveAttribute("data-format", "alexa35");
  await expect(page.getByTestId("shot-monitor")).toBeVisible();
  await expect(page.getByTestId("gate-diagram")).toBeVisible();
  await expect(page.locator(".cf-card")).toHaveCount(6);
  await expect(page.getByTestId("prompt-text")).toContainText(/^shot on Super 35 digital cinema camera, 32 mm lens/);
  await expect(page.getByTestId("prompt-text")).not.toContainText(/ALEXA|ARRI/);
  await expect(page.getByTestId("camera-detail")).toContainText("manufacturer-claimed");
  const live = await page.evaluate(() => window.__cameraFamilies!.live());
  expect(live.renders).toBeGreaterThan(1);
  expect(live.hfov).toBeCloseTo(47.24, 1);
  // The picture is not blank.
  const cells = await shot(page);
  expect(Math.max(...cells.map((c) => c[0] + c[1] + c[2]))).toBeGreaterThan(150);
  expect(errors).toEqual([]);
});

test("same lens: a bigger sensor widens the field of view and shrinks Bram", async ({ page }) => {
  const { errors } = await open(page);
  const before = await settle(page);
  await page.getByTestId("camera-alexa265").click();
  await expect(root(page)).toHaveAttribute("data-format", "alexa265");
  const after = await settle(page);
  expect(after.focalMm).toBeCloseTo(before.focalMm, 6);
  expect(after.hfov).toBeGreaterThan(before.hfov * 1.5);
  expect(after.subjectFraction).toBeLessThan(before.subjectFraction * 0.6);
  expect(Number(await root(page).getAttribute("data-hfov"))).toBeCloseTo(after.hfov, 1);
  expect(errors).toEqual([]);
});

test("same framing: the focal length scales, Bram's size and the FOV do not", async ({ page }) => {
  const { errors } = await open(page);
  await page.getByTestId("framing-framing").click();
  await expect(root(page)).toHaveAttribute("data-framing", "framing");
  const before = await settle(page);
  for (const [id, width] of [["alexa265", 54.12], ["vraptorx", 40.96], ["gopro", 6.7]] as const) {
    await page.getByTestId(`group-${id === "gopro" ? "specialized" : "cinema"}`).click();
    await page.getByTestId(`camera-${id}`).click();
    const after = await settle(page);
    expect(after.focalMm).toBeCloseTo((32 * width) / 27.99, 3);
    expect(after.hfov).toBeCloseTo(before.hfov, 6);
    expect(Math.abs(after.subjectFraction - before.subjectFraction)).toBeLessThan(1e-4);
  }
  expect(errors).toEqual([]);
});

test("the T-stop changes the depth-of-field band and the rendered blur", async ({ page }) => {
  const { errors } = await open(page, "step=aperture");
  // 50 mm, no grain: the lantern pole (right of frame, ~3 m) sits in front of the focus on Bram.
  await page.evaluate(() => {
    const s = window.__cameraFamilies!.getState() as unknown as { setFocal: (mm: number) => void; setLook: (id: string) => void };
    s.setFocal(50);
    s.setLook("neutral");
  });
  const band = page.getByTestId("dof-band");
  await page.getByTestId("tstop-8").click();
  const deep = { near: Number(await band.getAttribute("data-near")), far: await band.getAttribute("data-far"), live: await settle(page) };
  const deepPic = edgePeak(await page.getByTestId("shot-slot").screenshot(), 0.8, 0.97);
  await page.getByTestId("tstop-1.4").click();
  await expect(root(page)).toHaveAttribute("data-tstop", "1.40");
  const shallow = { near: Number(await band.getAttribute("data-near")), far: Number(await band.getAttribute("data-far")), live: await settle(page) };
  const shallowPic = edgePeak(await page.getByTestId("shot-slot").screenshot(), 0.8, 0.97);
  expect(shallow.near).toBeGreaterThan(deep.near);
  expect(shallow.far).toBeLessThan(deep.far === "inf" ? Infinity : Number(deep.far));
  expect(shallow.live.maxBlurPx).toBeGreaterThan(deep.live.maxBlurPx * 3);
  expect(shallowPic).toBeLessThan(deepPic * 0.7);
  // Bram is focused, the back wall is not.
  await expect(page.getByTestId("dof-mark-bram")).toHaveAttribute("data-sharp", "1");
  await expect(page.getByTestId("dof-mark-wall")).toHaveAttribute("data-sharp", "0");
  // The band agrees with the derived numbers the shader uses.
  const d = await page.evaluate(() => window.__cameraFamilies!.derived());
  expect(d.dof.nearM).toBeCloseTo(shallow.near, 2);
  expect(errors).toEqual([]);
});

test("the shutter angle changes the motion-blur samples and the picture", async ({ page }) => {
  const { errors } = await open(page, "step=shutter");
  await page.getByTestId("move-pan").click();
  await page.getByTestId("shutter-45").click();
  const narrow = await settle(page);
  const narrowPic = await shot(page);
  await page.getByTestId("shutter-360").click();
  await expect(root(page)).toHaveAttribute("data-shutter", "360");
  const wide = await settle(page);
  const widePic = await shot(page);
  expect(narrow.samples).toBeGreaterThan(1);
  expect(wide.sampleSpan).toBeCloseTo(narrow.sampleSpan * 8, 6);
  expect(meanDiff(narrowPic, widePic)).toBeGreaterThan(1);
  await expect(page.getByTestId("readout-shutter-speed")).toHaveText("1/24 s");
  // Rolling-shutter test: rows are offset for a rolling camera, not for the global-shutter V-RAPTOR [X].
  await page.getByTestId("rolling-test").check();
  const rolling = await settle(page);
  expect(rolling.rolling).toBe(true);
  expect(rolling.bands).toBeGreaterThan(1);
  await page.getByTestId("compare-global").click();
  await expect(root(page)).toHaveAttribute("data-camera", "vraptorx");
  const global = await settle(page);
  expect(global.rolling).toBe(false);
  expect(global.bands).toBe(1);
  expect(errors).toEqual([]);
});

test("looks change the graded output and the curve", async ({ page }) => {
  const { errors } = await open(page, "step=response");
  await page.getByTestId("look-neutral").click();
  await settle(page);
  const neutral = await shot(page);
  await page.getByTestId("look-film35").click();
  await expect(root(page)).toHaveAttribute("data-look", "film35");
  await expect(page.getByTestId("curve-plot")).toHaveAttribute("data-look", "film35");
  const live = await settle(page);
  expect(live.lookIds).toEqual(["film35"]);
  const film = await shot(page);
  expect(meanDiff(neutral, film)).toBeGreaterThan(2);
  await page.getByTestId("look-doc").click();
  await page.getByTestId("highlight-test").click();
  await expect(page.getByTestId("exposure-value")).toHaveText("+2.5 EV");
  await settle(page);
  const docHot = await shot(page);
  expect(meanDiff(film, docHot)).toBeGreaterThan(2);
  await expect(page.getByTestId("approx-note")).toContainText("not any manufacturer");
  expect(errors).toEqual([]);
});

test("blind test: hidden looks, guesses, reveal, next round", async ({ page }) => {
  const { errors } = await open(page, "step=blind");
  for (const i of [0, 1, 2]) await expect(page.getByTestId(`blind-monitor-${i}`)).toBeVisible();
  const live = await settle(page);
  const s = await page.evaluate(() => window.__cameraFamilies!.getState().blind);
  expect(live.lookIds).toEqual(s.looks);
  expect(new Set(s.looks).size).toBe(3);
  await expect(page.getByTestId("blind-answer-0")).toHaveCount(0);
  const reveal = page.getByTestId("blind-reveal");
  await expect(reveal).toBeDisabled();
  for (const i of [0, 1, 2]) await page.getByTestId(`guess-${i}-${s.looks[i]}`).click();
  await expect(reveal).toBeEnabled();
  await reveal.click();
  await expect(root(page)).toHaveAttribute("data-blind-revealed", "1");
  await expect(page.getByTestId("blind-result")).toHaveAttribute("data-correct", "3");
  await expect(page.getByTestId("blind-answer-0")).toBeVisible();
  // The three windows show different pictures.
  const a = await shot(page, "blind-monitor-0");
  const b = await shot(page, "blind-monitor-1");
  expect(meanDiff(a, b)).toBeGreaterThan(0.5);
  await page.getByTestId("blind-next").click();
  await expect(root(page)).toHaveAttribute("data-blind-revealed", "0");
  expect(await page.evaluate(() => window.__cameraFamilies!.getState().blind.round)).toBe(1);
  expect(errors).toEqual([]);
});

test("modes switch, deep links apply and the URL follows", async ({ page }) => {
  const { errors } = await open(page, "mode=inspect&camera=vraptorx&step=shutter");
  await expect(root(page)).toHaveAttribute("data-mode", "inspect");
  await expect(root(page)).toHaveAttribute("data-camera", "vraptorx");
  await expect(root(page)).toHaveAttribute("data-step", "shutter");
  // A deep-linked camera opens on the default framing.
  expect(Number(await root(page).getAttribute("data-hfov"))).toBeCloseTo(47.24, 1);
  for (const id of ["stage-window", "gate-diagram", "dof-band", "curve-plot", "inspect-readouts", "shot-monitor"]) await expect(page.getByTestId(id)).toBeVisible();
  await page.getByTestId("mode-watch").click();
  await expect(root(page)).toHaveAttribute("data-mode", "watch");
  await expect(page.getByTestId("camera-browser")).toHaveCount(0);
  await expect(page.getByTestId("shot-monitor")).toBeVisible();
  await expect(page).toHaveURL(/mode=watch/);
  await page.keyboard.press("e");
  await expect(root(page)).toHaveAttribute("data-mode", "experiment");
  await page.keyboard.press("3");
  await expect(root(page)).toHaveAttribute("data-step", "aperture");
  await expect(page.getByTestId("panel-aperture")).toBeVisible();
  await expect(page).toHaveURL(/step=aperture/);
  const live = await settle(page);
  expect(live.renders).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
