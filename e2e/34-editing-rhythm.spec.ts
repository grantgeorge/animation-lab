import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

type View = { t: number; index: number; shot: string; local: number; mix: number; runtime: number };
type Clip = { id: string; shot: string; sourceIn: number; duration: number; audioLead?: number };
type Hook = {
  getState: () => { edit: Clip[]; preset: string; mode: string; exp: string; setJl: (v: number) => void; setDuration: (i: number, d: number) => void };
  edit: () => Clip[];
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  explanation: () => { headline: string; points: string[] };
  live: () => { t: number; frameId: number; views: Record<string, View>; rendered: string[] };
  frames: (n?: number) => Promise<number>;
  audible: () => { rec: number; kind: string; label: string; index: number; overPicture: boolean }[];
};
declare global {
  interface Window {
    __editLab?: Hook;
  }
}

async function open(page: Page, params = "") {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/labs/editing-rhythm?e2e=1&quality=low${params ? `&${params}` : ""}`);
  await page.waitForFunction(() => !!window.__editLab, null, { timeout: 45_000 });
  await page.evaluate(async () => {
    window.__editLab!.pause();
    await window.__editLab!.frames(3);
  });
  return { errors };
}

const root = (page: Page) => page.getByTestId("lab-root");
const headline = (page: Page) => page.evaluate(() => window.__editLab!.explanation().headline);

test("renders the playground: program monitor, timeline, stats and the explanation, without errors", async ({ page }) => {
  const { errors } = await open(page);
  await expect(root(page)).toHaveAttribute("data-mode", "experiment");
  await expect(root(page)).toHaveAttribute("data-exp", "timeline");
  await expect(root(page)).toHaveAttribute("data-preset", "suspense");
  await expect(page.getByTestId("monitor-P")).toBeVisible();
  await expect(page.getByTestId("timeline-clip-0")).toHaveAttribute("data-shot", "establish");
  await expect(page.getByTestId("stat-runtime")).toHaveText("19.0s");
  await expect(page.getByTestId("stat-cuts")).toHaveText("5");
  await expect(root(page)).toHaveAttribute("data-info-order", "reaction-first");
  await expect(page.getByTestId("explanation-headline")).toContainText("Suspense cut");
  await expect(page.getByTestId("explanation-points")).toContainText("before its cause");
  // the program renders the clip under the playhead at its source time
  await page.evaluate(async () => {
    window.__editLab!.seek(7.0);
    await window.__editLab!.frames(3);
  });
  const v = (await page.evaluate(() => window.__editLab!.live())).views.P;
  expect(v.shot).toBe("reaction");
  expect(v.local).toBeCloseTo(7.1 + 0.5, 1);
  await expect(root(page)).toHaveAttribute("data-program-shot", "reaction");
  // sound never starts on its own
  await expect(root(page)).toHaveAttribute("data-sound", "locked");
  expect(errors).toEqual([]);
});

test("presets change the shot order and the stats, not just durations", async ({ page }) => {
  const { errors } = await open(page);
  const read = async () => ({ order: await root(page).getAttribute("data-order"), runtime: await root(page).getAttribute("data-runtime"), cuts: await root(page).getAttribute("data-cuts"), asl: await root(page).getAttribute("data-asl") });
  const suspense = await read();
  await page.getByTestId("preset-action").click();
  await expect(root(page)).toHaveAttribute("data-preset", "action");
  const action = await read();
  expect(action.order).not.toBe(suspense.order);
  expect(action.order!.startsWith("establish")).toBe(false);
  expect(Number(action.cuts)).toBeGreaterThan(Number(suspense.cuts));
  expect(Number(action.asl)).toBeLessThan(Number(suspense.asl));
  await page.getByTestId("preset-comedy").click();
  await expect(root(page)).toHaveAttribute("data-info-order", "reaction-after-reveal");
  expect((await read()).order!.split(",").at(-1)).toBe("reaction");
  await page.getByTestId("preset-emotion").click();
  expect(Number((await read()).asl)).toBeGreaterThan(Number(suspense.asl));
  await expect(page.getByTestId("explanation-reads")).toHaveAttribute("data-reads", "emotion");
  expect(errors).toEqual([]);
});

test("the duration slider changes runtime and ASL, and the explanation names the consequence", async ({ page }) => {
  const { errors } = await open(page);
  await page.getByTestId("timeline-clip-2").click();
  await expect(root(page)).toHaveAttribute("data-selected-shot", "reaction");
  await expect(page.getByTestId("selected-duration")).toHaveText("3.5 sec");
  await expect(page.getByTestId("timeline-handles")).toBeVisible();
  await page.getByTestId("duration-slider").fill("4.5");
  await expect(page.getByTestId("stat-runtime")).toHaveText("20.0s");
  await expect(root(page)).toHaveAttribute("data-asl", "3.33");
  await expect(page.getByTestId("explanation-headline")).toHaveText("You held the reaction shot longer before revealing the box. The audience now experiences Bram's fear for 4.5 s before discovering its cause.");
  await expect(page.getByTestId("explanation-points")).toContainText("held 1.0 s longer");
  expect(errors).toEqual([]);
});

test("Move earlier / Move later reorder, and moving the box before the reaction flips what the audience learns first", async ({ page }) => {
  const { errors } = await open(page);
  // select the glowing box (slot 5) and move it earlier, step by step
  await page.getByTestId("timeline-clip-4").click();
  await expect(root(page)).toHaveAttribute("data-selected-shot", "glow");
  const before = await headline(page);
  await page.getByTestId("move-earlier").click();
  await expect(root(page)).toHaveAttribute("data-order", "establish,reach,reaction,glow,hesitate,reveal");
  await expect(root(page)).toHaveAttribute("data-info-order", "reaction-first");
  await page.getByTestId("move-earlier").click();
  await expect(root(page)).toHaveAttribute("data-order", "establish,reach,glow,reaction,hesitate,reveal");
  await expect(root(page)).toHaveAttribute("data-info-order", "danger-first");
  await expect(page.getByTestId("explanation-headline")).toContainText("Now the box is revealed before Bram reacts");
  expect(await headline(page)).not.toBe(before);
  await page.getByTestId("move-later").click();
  await expect(root(page)).toHaveAttribute("data-info-order", "reaction-first");
  await expect(page.getByTestId("explanation-headline")).toContainText("Now Bram reacts before the audience sees the danger");
  expect(errors).toEqual([]);
});

test("drag a block to reorder it, and drag its tail to trim within the handles", async ({ page }) => {
  await open(page);
  const clip = page.getByTestId("timeline-clip-5");
  const target = page.getByTestId("timeline-clip-1");
  const a = (await clip.boundingBox())!;
  const b = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 - 40, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(root(page)).toHaveAttribute("data-order", "establish,reach,reveal,reaction,hesitate,glow");
  // trim the selected clip's tail by dragging its grip
  const runtime0 = Number(await root(page).getAttribute("data-runtime"));
  const grip = (await page.getByTestId("timeline-trim-tail").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x - 60, grip.y + grip.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(Number(await root(page).getAttribute("data-runtime"))).toBeLessThan(runtime0 - 0.5);
});

test("compare mode plays two edits side by side in two viewports", async ({ page }) => {
  const { errors } = await open(page);
  await page.getByTestId("compare-toggle").click();
  await expect(root(page)).toHaveAttribute("data-compare", "action");
  await expect(page.getByTestId("monitor-A")).toBeVisible();
  await expect(page.getByTestId("monitor-B")).toBeVisible();
  await page.evaluate(async () => {
    window.__editLab!.seek(2.0);
    await window.__editLab!.frames(3);
  });
  const l = await page.evaluate(() => window.__editLab!.live());
  expect(l.rendered).toEqual(expect.arrayContaining(["A", "B"]));
  expect(l.views.A.shot).toBe("establish");
  expect(l.views.B.shot).not.toBe("establish");
  await expect(page.getByTestId("timeline-b-clip-0")).toHaveAttribute("data-shot", "reach");
  await page.getByTestId("compare-with").selectOption("emotion");
  await expect(root(page)).toHaveAttribute("data-compare", "emotion");
  expect(page.url()).toContain("compare=emotion");
  expect(errors).toEqual([]);
});

test("J/L cuts slide the sound edit around a fixed picture cut", async ({ page }) => {
  const { errors } = await open(page, "exp=jl");
  await expect(root(page)).toHaveAttribute("data-exp", "jl");
  const cut = 3.2;
  const seg1 = page.getByTestId("timeline-aseg-1");
  await expect(seg1).toHaveAttribute("data-start", cut.toFixed(2));
  const straight = await page.evaluate(() => window.__editLab!.audible());
  expect(straight.some((x) => x.kind === "sting")).toBe(false);
  await page.getByTestId("jl-slider").fill("1");
  await expect(root(page)).toHaveAttribute("data-jl", "1.00");
  await expect(seg1).toHaveAttribute("data-start", (cut - 1).toFixed(2));
  const j = await page.evaluate(() => window.__editLab!.audible());
  const sting = j.find((x) => x.kind === "sting")!;
  expect(sting.rec).toBeLessThan(cut);
  expect(sting.overPicture).toBe(true);
  await expect(page.locator("[data-testid^=timeline-sfx-][data-over='1']").first()).toBeVisible();
  await expect(page.getByTestId("explanation-headline")).toContainText("J-cut");
  await page.getByTestId("jl-slider").fill("-1");
  await expect(page.getByTestId("timeline-aseg-0")).toHaveAttribute("data-end", (cut + 1).toFixed(2));
  const l = await page.evaluate(() => window.__editLab!.audible());
  expect(l.some((x) => x.index === 0 && x.rec > cut)).toBe(true);
  await expect(page.getByTestId("explanation-headline")).toContainText("L-cut");
  // the picture cut never moved
  await expect(page.getByTestId("timeline-clip-1")).toHaveAttribute("data-duration", "3.40");
  expect(errors).toEqual([]);
});

test("Comedy timing presets change the gaps between step, fall and reaction", async ({ page }) => {
  const { errors } = await open(page, "exp=comedy");
  const beats = async () => ({ step: Number(await root(page).getAttribute("data-comedy-step")), fall: Number(await root(page).getAttribute("data-comedy-fall")), reaction: Number(await root(page).getAttribute("data-comedy-reaction")) });
  const instant = await beats();
  await page.getByTestId("comedy-hold").click();
  const hold = await beats();
  expect(hold.fall - hold.step).toBeGreaterThan(instant.fall - instant.step + 2);
  await expect(page.locator("[data-shot=cFace]")).toHaveCount(1);
  await page.getByTestId("comedy-anticipation").click();
  await expect(page.locator("[data-testid^=timeline-clip-][data-shot=cPeel]")).toHaveCount(1);
  expect((await beats()).step).toBeGreaterThan(instant.step + 1.5);
  await page.getByTestId("comedy-aftermath").click();
  const after = await beats();
  expect(after.reaction - after.fall).toBeGreaterThan(instant.reaction - instant.fall + 1.5);
  await page.getByTestId("gap-aftermath").fill("1");
  await expect(page.getByTestId("explanation-headline")).toContainText("Custom timing");
  expect(errors).toEqual([]);
});

test("Kuleshov uses identical face frames; montage compresses 60 s; continuity flags a crossed line", async ({ page }) => {
  const { errors } = await open(page, "exp=kuleshov");
  const e = await page.evaluate(() => window.__editLab!.edit());
  expect(e[0]).toMatchObject({ shot: e[2].shot, sourceIn: e[2].sourceIn, duration: e[2].duration });
  await page.getByTestId("kule-insert-gift").click();
  await page.getByTestId("kule-answer-tenderness").click();
  await expect(page.getByTestId("explanation-headline")).toContainText('You read "tenderness"');
  await page.getByTestId("exp-montage").click();
  await expect(root(page)).toHaveAttribute("data-runtime", "10.00");
  expect(Number(await root(page).getAttribute("data-compression"))).toBeGreaterThan(5.5);
  await page.getByTestId("montage-style-realtime").click();
  await expect(root(page)).toHaveAttribute("data-compression", "1");
  await page.getByTestId("exp-continuity").click();
  await expect(page.getByTestId("panel-continuity")).toHaveAttribute("data-matched", "1");
  await page.getByTestId("flip-camera").click();
  await expect(page.getByTestId("panel-continuity")).toHaveAttribute("data-matched", "0");
  await expect(page.getByTestId("timeline-flag-2")).toBeVisible();
  await expect(page.getByTestId("continuity-axis-cam-reaction")).toHaveAttribute("data-side", "-1");
  expect(errors).toEqual([]);
});

test("exports download a valid cut list JSON and a CMX3600 EDL, and the prompt describes the rhythm", async ({ page }) => {
  const { errors } = await open(page);
  const [dj] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-json").click()]);
  expect(dj.suggestedFilename()).toMatch(/\.cutlist\.json$/);
  const json = JSON.parse(readFileSync((await dj.path())!, "utf8"));
  expect(json.format).toBe("truestudio.cutlist");
  expect(json.clips).toHaveLength(6);
  let t = 0;
  for (const c of json.clips) {
    expect(c.record.in).toBeCloseTo(t, 3);
    t = c.record.out;
  }
  expect(json.runtime).toBeCloseTo(t, 3);
  const [de] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-edl").click()]);
  expect(de.suggestedFilename()).toMatch(/\.edl$/);
  const edl = readFileSync((await de.path())!, "utf8").split("\n");
  expect(edl[0]).toMatch(/^TITLE: /);
  expect(edl[1]).toBe("FCM: NON-DROP FRAME");
  const events = edl.filter((l) => /^\d{3} {2}/.test(l));
  expect(events).toHaveLength(6);
  for (const l of events) expect(l).toMatch(/^\d{3} {2}\S+ +[VAB] +C +(\d\d:\d\d:\d\d:\d\d ){3}\d\d:\d\d:\d\d:\d\d$/);
  expect(events[0]).toContain("01:00:00:00");
  await page.getByText("Seedance multi-shot prompt").click();
  await expect(page.getByTestId("prompt-text")).toContainText("Shot 3 (6.5–10.0 s): hold on close-up of Bram's face 3.5 s before the reveal");
  expect(errors).toEqual([]);
});

test("modes switch, and deep links set mode, preset and experiment", async ({ page }) => {
  const { errors } = await open(page, "mode=inspect&preset=action");
  await expect(root(page)).toHaveAttribute("data-mode", "inspect");
  await expect(root(page)).toHaveAttribute("data-preset", "action");
  await expect(page.getByTestId("asl-graph")).toBeVisible();
  await expect(page.getByTestId("knows-card")).toBeVisible();
  await expect(page.getByTestId("axis-diagram")).toBeVisible();
  await expect(page.getByTestId("timeline-audio")).toBeVisible();
  await page.getByTestId("mode-watch").click();
  await expect(root(page)).toHaveAttribute("data-mode", "watch");
  await expect(page.getByTestId("monitor-W")).toBeVisible();
  await page.evaluate(() => window.__editLab!.frames(3));
  expect((await page.evaluate(() => window.__editLab!.live())).rendered).toContain("W");
  expect(page.url()).toContain("mode=watch");
  await page.keyboard.press("e");
  await expect(root(page)).toHaveAttribute("data-mode", "experiment");
  await page.goto("/labs/editing-rhythm?e2e=1&quality=low&exp=reaction");
  await page.waitForFunction(() => !!window.__editLab);
  await expect(root(page)).toHaveAttribute("data-exp", "reaction");
  await expect(root(page)).toHaveAttribute("data-info-order", "reaction-first");
  await page.getByTestId("reaction-order-after").click();
  await expect(root(page)).toHaveAttribute("data-info-order", "reaction-after-reveal");
  // first interaction unlocks sound; the toggle mutes it
  await page.getByTestId("sound-toggle").click();
  await expect(root(page)).toHaveAttribute("data-sound", "muted");
  await page.getByTestId("sound-toggle").click();
  await expect(root(page)).toHaveAttribute("data-sound", "on");
  expect(errors).toEqual([]);
});
