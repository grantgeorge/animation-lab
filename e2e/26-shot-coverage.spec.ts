import { expect, test, type Page } from "@playwright/test";

type CamLive = { bramX: number; pipX: number; bramSide: "L" | "R"; pipSide: "L" | "R"; bramLook: string; pipLook: string; axisSide: number; fraction: number };
type Hook = {
  getState: () => {
    mode: string;
    sceneId: string;
    selected: string;
    playing: boolean;
    edit: { t: number; cam: string }[];
    past: unknown[];
    cameras: Record<string, { position: number[]; aim: string; focalMm: number; preset: string }>;
    play: () => void;
    crossLine: (id?: string) => void;
  };
  setCamera: (id: string, partial: Record<string, unknown>) => void;
  setEdit: (cuts: { t: number; cam: string }[]) => void;
  seek: (t: number) => void;
  pause: () => void;
  live: () => { t: number; frameId: number; program: string; shotIndex: number; crossed: boolean; cams: Record<"A" | "B" | "C", CamLive> };
  frames: (n?: number) => Promise<number>;
};
declare global {
  interface Window {
    __coverageLab?: Hook;
  }
}

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/labs/shot-coverage?e2e=1&quality=low${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__coverageLab, null, { timeout: 30_000 });
  await page.evaluate(() => window.__coverageLab!.frames(3));
  return { errors };
}

/** Pause, jump to t, wait for frames, read the live readouts. */
async function at(page: Page, t: number) {
  await page.evaluate(async (t) => {
    const h = window.__coverageLab!;
    h.pause();
    h.seek(t);
    await h.frames(3);
  }, t);
  return page.evaluate(() => window.__coverageLab!.live());
}

test("coverage lab renders three cameras, the program and the edit without errors", async ({ page }) => {
  const { errors } = await open(page);
  const root = page.getByTestId("lab-root");
  await expect(root).toHaveAttribute("data-mode", "experiment");
  await expect(root).toHaveAttribute("data-scene", "doorway");
  await expect(root).toHaveAttribute("data-crossed", "0");
  for (const id of ["A", "B", "C"]) await expect(page.getByTestId(`monitor-${id}`)).toBeVisible();
  await expect(page.getByTestId("monitor-program")).toBeVisible();
  await expect(page.getByTestId("plan-view")).toBeVisible();
  await expect(page.getByTestId("segment-0")).toHaveAttribute("data-cam", "A");
  await expect(page.getByTestId("flags-clean")).toBeVisible();
  await expect(page.getByTestId("prompt-text")).toContainText(/^Multi-shot sequence/);
  await expect(page.getByTestId("prompt-text")).toContainText("Shot 1 (0.0–2.5 s): Wide master");
  await expect(page.getByTestId("prompt-text")).toContainText("keep Bram screen-left and Pip screen-right in every shot");
  // Default coverage: everyone on the front side; Bram left of Pip and looking right in the master.
  const live = await at(page, 3.6);
  for (const id of ["A", "B", "C"] as const) expect(live.cams[id].axisSide).toBe(1);
  expect(live.cams.A.bramX).toBeLessThan(live.cams.A.pipX);
  expect(live.cams.A.bramLook).toBe("right");
  expect(live.cams.C.pipLook).toBe("left");
  expect(live.cams.A.fraction).toBeGreaterThan(0.3);
  expect(errors).toEqual([]);
});

test("the program follows the edit and the data attribute mirrors it", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__coverageLab!.setEdit([{ t: 0, cam: "A" }, { t: 2, cam: "B" }, { t: 4, cam: "C" }]));
  for (const [t, cam] of [[1, "A"], [3, "B"], [5, "C"]] as const) {
    const live = await at(page, t);
    expect(live.program).toBe(cam);
    await expect(page.getByTestId("lab-root")).toHaveAttribute("data-program-camera", cam);
  }
  await expect(page.getByTestId("edit-stats")).toContainText("3 shots");
  await expect(page.getByTestId("edit-stats")).toContainText("ASL 2.0 s");
});

test("crossing the line flips screen direction and eyelines, and the checker flags the cut", async ({ page }) => {
  await open(page);
  const before = await at(page, 3.6);
  await page.getByTestId("select-cam-C").click();
  await page.getByTestId("cross-line").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-crossed", "1");
  const after = await at(page, 3.6);
  expect(after.cams.C.axisSide).toBe(-before.cams.C.axisSide);
  expect(before.cams.C.bramSide).toBe("L");
  expect(after.cams.C.bramSide).toBe("R");
  expect(before.cams.C.pipLook).toBe("left");
  expect(after.cams.C.pipLook).toBe("right");
  // The other cameras are untouched.
  expect(after.cams.A.bramX).toBeCloseTo(before.cams.A.bramX, 3);
  await expect(page.getByTestId("monitor-side-C")).toHaveText("ACROSS");
  await expect(page.getByTestId("chip-pip-C")).toContainText("L Pip →");
  await expect(page.getByTestId("chip-pip-B")).toContainText("R Pip ←");
  await expect(page.getByTestId("flag-axis").first()).toContainText("crosses the line");
  await expect(page.getByTestId("flag-marker-axis").first()).toBeVisible();
  await expect(page.getByTestId("prompt-text")).toContainText("deliberately crosses the line");
  // X brings it back.
  await page.keyboard.press("KeyX");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-crossed", "0");
  await expect(page.getByTestId("flags-clean")).toBeVisible();
});

test("edit presets: crossing the line, rhythm stats, undo", async ({ page }) => {
  await open(page);
  await page.getByTestId("edit-crossing").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-crossed", "1");
  await expect(page.getByTestId("edit-concept")).toContainText("Crossing the line");
  await expect(page.getByTestId("flag-axis")).toHaveCount(2);
  await page.getByTestId("edit-fast").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-crossed", "0");
  await expect(page.getByTestId("edit-stats")).toContainText("ASL 0.6 s");
  await page.getByTestId("edit-slow").click();
  await expect(page.getByTestId("edit-stats")).toContainText("2 shots");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("edit-stats")).toContainText("ASL 0.6 s");
});

test("live switching with 1/2/3 while playing; digits select when paused", async ({ page }) => {
  await open(page);
  await page.getByTestId("clear-edit").click();
  await expect(page.getByTestId("edit-stats")).toContainText("1 shots");
  await page.evaluate(() => {
    const h = window.__coverageLab!;
    h.seek(1.0);
    h.getState().play();
  });
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(400);
  await page.keyboard.press("Digit3");
  await page.evaluate(() => window.__coverageLab!.pause());
  const edit = await page.evaluate(() => window.__coverageLab!.getState().edit);
  expect(edit.map((c) => c.cam)).toEqual(["A", "B", "C"]);
  expect(edit[1].t).toBeGreaterThanOrEqual(1);
  // Paused: digits select instead of cutting.
  await page.keyboard.press("Digit1");
  expect(await page.evaluate(() => window.__coverageLab!.getState().selected)).toBe("A");
  expect((await page.evaluate(() => window.__coverageLab!.getState().edit)).length).toBe(3);
});

test("trimming a cut point and swapping a shot's camera, with undo", async ({ page }) => {
  await open(page, "freeze=0.5");
  // Trim: drag the first cut point to the right.
  await page.evaluate(() => window.__coverageLab!.setEdit([{ t: 0, cam: "A" }, { t: 2, cam: "B" }, { t: 4, cam: "C" }]));
  const handle = page.getByTestId("cut-handle-1");
  const box = (await handle.boundingBox())!;
  const track = (await page.getByTestId("timeline-track").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + (track.width * 3) / 6, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const trimmed = await page.evaluate(() => window.__coverageLab!.getState().edit);
  expect(trimmed[1].t).toBeGreaterThan(2.7);
  expect(trimmed[1].t).toBeLessThan(3.3);
  // Swap the camera of shot 3 from the segment popover; Z undoes it.
  await page.getByTestId("segment-2").click();
  await page.getByTestId("set-shot-A").click();
  await expect(page.getByTestId("segment-2")).toHaveAttribute("data-cam", "A");
  await page.keyboard.press("KeyZ");
  await expect(page.getByTestId("segment-2")).toHaveAttribute("data-cam", "C");
});

test("jump cuts and same-camera cuts are flagged", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const h = window.__coverageLab!;
    const b = h.getState().cameras.B;
    h.setCamera("C", { position: [b.position[0] + 0.2, b.position[1], b.position[2] + 0.15], aim: b.aim, focalMm: b.focalMm + 3 });
    h.setEdit([{ t: 0, cam: "B" }, { t: 3.4, cam: "C" }, { t: 4.6, cam: "C" }]);
  });
  await expect(page.getByTestId("flag-jump")).toContainText("jump cut");
  await expect(page.getByTestId("flag-same")).toContainText("same camera");
});

test("camera presets, aim and lens change the shot", async ({ page }) => {
  await open(page);
  await page.getByTestId("select-cam-B").click();
  await page.getByTestId("preset-closeup").click();
  await expect(page.getByTestId("monitor-kind-B")).toContainText(/CU/);
  const cu = await at(page, 3.6);
  await page.getByTestId("preset-master").click();
  const master = await at(page, 3.6);
  expect(cu.cams.B.fraction).toBeGreaterThan(master.cams.B.fraction * 4);
  await page.getByTestId("aim-pip").click();
  expect(await page.evaluate(() => window.__coverageLab!.getState().cameras.B.aim)).toBe("pip");
  await page.getByTestId("reset-cameras").click();
  expect(await page.evaluate(() => window.__coverageLab!.getState().cameras.B.preset)).not.toBe("custom");
});

test("modes: watch shows the cut full frame, inspect shows the analysis; keys switch", async ({ page }) => {
  const { errors } = await open(page);
  await page.keyboard.press("KeyW");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-mode", "watch");
  await expect(page.getByTestId("watch-screen")).toBeVisible();
  await expect(page.getByTestId("monitor-A")).toHaveCount(0);
  await expect(page.getByTestId("shot-caption")).toContainText(/Shot \d/);
  const w = (await page.getByTestId("watch-screen").boundingBox())!;
  expect(w.width).toBeGreaterThan(1000);
  await page.keyboard.press("KeyI");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-mode", "inspect");
  await expect(page.getByTestId("direction-table")).toBeVisible();
  await expect(page.getByTestId("direction-row-A")).toContainText(/L [-+]?\d/);
  await expect(page.getByTestId("concept-card")).toContainText("180°");
  await page.getByTestId("mode-experiment").click();
  await expect(page.getByTestId("camera-panel")).toBeVisible();
  await page.keyboard.press("Shift+Slash");
  await expect(page.getByTestId("help")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help")).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("scene switch rebuilds coverage on the new axis; frame step moves the playhead", async ({ page }) => {
  await open(page, "scene=workshop");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-scene", "workshop");
  await page.getByTestId("scene-alley").click();
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-scene", "alley");
  await expect(page.getByTestId("lab-root")).toHaveAttribute("data-duration", "8");
  const l = await at(page, 4.2);
  for (const id of ["A", "B", "C"] as const) expect(l.cams[id].axisSide).toBe(1);
  await page.keyboard.press("Period");
  await page.keyboard.press("Period");
  await page.evaluate(() => window.__coverageLab!.frames(2));
  const t = await page.evaluate(() => window.__coverageLab!.live().t);
  expect(t).toBeCloseTo(4.2 + 2 / 24, 2);
});


for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`program-first workspace fits ${viewport.width} by ${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const { errors } = await open(page, "freeze=2.5");
    await page.waitForTimeout(1200);
    const root = page.getByTestId("lab-root");
    expect(await root.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const picture = (await page.getByTestId("coverage-picture").boundingBox())!;
    const frame = (await page.getByTestId("monitor-window-P").boundingBox())!;
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 2);
    expect(frame.x).toBeGreaterThanOrEqual(picture.x - 1);
    expect(frame.y).toBeGreaterThanOrEqual(picture.y - 1);
    expect(frame.x + frame.width).toBeLessThanOrEqual(picture.x + picture.width + 1);
    expect(frame.y + frame.height).toBeLessThanOrEqual(picture.y + picture.height + 1);
    if (viewport.width > 900) {
      const controls = (await page.getByTestId("camera-panel").boundingBox())!;
      expect(picture.x + picture.width).toBeLessThanOrEqual(controls.x);
    }
    await page.screenshot({ path: testInfo.outputPath("workspace.png") });
    await page.getByTestId("camera-advanced").scrollIntoViewIfNeeded();
    await page.getByTestId("camera-advanced").locator("summary").click();
    await page.getByTestId("height-slider").fill("2");
    await expect(page.getByTestId("height-slider")).toHaveValue("2");
    await page.getByTestId("help-button").click();
    await expect(page.getByRole("dialog", { name: "Coverage & editing" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("help-button")).toBeFocused();
    if (viewport.width === 1440) {
      await page.getByTestId("mode-inspect").click();
      await expect(page.getByTestId("toast")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("inspect.png") });
      await page.getByTestId("mode-watch").click();
      await expect(page.getByTestId("toast")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("watch.png") });
    }
    if (viewport.width === 390) {
      await page.getByTestId("camera-panel").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("phone-controls.png") });
    }
    expect(errors).toEqual([]);
  });
}

test("native camera buttons retain Space activation and reduced motion starts paused", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  expect(await page.evaluate(() => window.__coverageLab!.getState().playing)).toBe(false);
  await page.getByTestId("select-cam-A").focus();
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => window.__coverageLab!.getState().selected)).toBe("A");
  expect(await page.evaluate(() => window.__coverageLab!.getState().playing)).toBe(false);
});
