// Review the Lens & Framing workspace: node scripts/shots-lens-refined.mjs [outDir]
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const out = process.argv[2] ?? "docs/screenshots/lens-framing-refined";
const base = process.env.BASE_URL ?? "http://localhost:3123";
const freeze = Number(process.env.FREEZE ?? 1.6);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const errors = [];
const warnings = new Set();
const captures = [];

async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.add(message.text());
  });
  await page.goto(`${base}/labs/lens-and-framing?e2e=1&quality=high&freeze=${freeze}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__animationLab), null, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const scene = window.__r3f?.scene;
    return ["Bram", "Pip"].every((name) => scene?.getObjectByName(name)?.getObjectByName("LeftHand"));
  }, null, { timeout: 30_000 });
  // The paused renderer refreshes two of the six cached lenses per frame after a model loads.
  // Keep camera/time untouched so this also verifies content-driven cache invalidation.
  await settle(page);
  await settle(page);
  return page;
}

async function settle(page) {
  await page.evaluate(() => window.__animationLab.settle({ timeoutMs: 30_000 }));
}

async function shot(page, name) {
  await settle(page);
  const geometry = await page.evaluate(() => {
    const bounds = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const hook = window.__animationLab;
    const s = hook.getState();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      scene: s.ui.sceneId,
      mode: s.camera.mode,
      focal: s.camera.rig.focalMm,
      primary: s.ui.primaryView,
      fullscreen: s.ui.fullscreenShot,
      playing: s.timeline.playing,
      picture: bounds('[data-testid="lens-picture"]'),
      shot: bounds('[data-testid="monitor-window"]'),
      controls: bounds('[data-testid="camera-controls"]'),
      study: bounds('[data-testid="concept-panel"]'),
      filmstrip: bounds('[data-testid="filmstrip"]'),
      lesson: bounds('[data-testid="lesson-card"]'),
    };
  });
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  captures.push({ name, ...geometry });
  console.log("wrote", name);
}

async function scene(page, id) {
  await page.getByTestId(`scene-${id}`).click();
  await page.evaluate((time) => {
    const s = window.__animationLab.getState();
    s.pause();
    s.seek(time);
  }, freeze);
  await settle(page);
}

try {
  const desktop = await open(1440, 900);
  await shot(desktop, "01-desktop-default-50mm");
  await desktop.getByTestId("preset-24").click();
  await shot(desktop, "02-desktop-fixed-24mm");
  await desktop.getByTestId("preset-85").click();
  await shot(desktop, "03-desktop-fixed-85mm");
  await desktop.getByTestId("reset-camera").click();
  await desktop.getByTestId("mode-match").click();
  await desktop.getByTestId("preset-24").click();
  await shot(desktop, "04-desktop-match-24mm");
  await desktop.getByTestId("preset-85").click();
  await shot(desktop, "05-desktop-match-85mm");
  await desktop.getByTestId("view-stage").click();
  await shot(desktop, "06-desktop-studio");
  await desktop.getByTestId("view-shot").click();
  await scene(desktop, "workshop");
  await shot(desktop, "07-desktop-workshop");
  await scene(desktop, "alley");
  await shot(desktop, "08-desktop-alley");
  await scene(desktop, "doorway");
  await desktop.getByTestId("expand-shot").click();
  await shot(desktop, "09-desktop-fullscreen");
  await desktop.close();

  const compact = await open(1280, 800);
  await shot(compact, "10-compact-default-50mm");
  await compact.close();

  const mobile = await open(390, 844);
  await shot(mobile, "11-mobile-top");
  await mobile.getByTestId("camera-controls").scrollIntoViewIfNeeded();
  await shot(mobile, "12-mobile-controls");
  await mobile.getByTestId("lesson-toggle").click();
  await mobile.getByTestId("start-ex1").click();
  await mobile.getByTestId("lesson-card").scrollIntoViewIfNeeded();
  await shot(mobile, "13-mobile-exercise");
  await mobile.close();

  const report = { errors, warnings: [...warnings], captures };
  await writeFile(path.join(out, "review.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ errors, warnings: [...warnings], captures: captures.length }, null, 2));
  if (errors.length) throw new Error(`${errors.length} browser errors during screenshot capture`);
} finally {
  await browser.close();
}
