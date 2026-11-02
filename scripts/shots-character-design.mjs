import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
// Character Design lab screenshots: node scripts/shots-character-design.mjs [outDir]  (dev server: BASE_URL, default :3123)
const out = process.argv[2] ?? 'docs/screenshots/character-design'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const settle = (page, ms = 700) => page.waitForTimeout(ms);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.BASE_URL ?? 'http://localhost:3123'}/labs/character-design`, { waitUntil: 'networkidle' });
  const stage = page.getByTestId('design-stage');
  await page.locator('.cd-stage canvas').waitFor(); await settle(page, 2000);
  await page.screenshot({ path: `${out}/01-like-pip.png` });
  await page.screenshot({ path: `${out}/02-full.png`, fullPage: true });
  await page.getByTestId('preset-realistic').click(); await page.getByRole('group', { name: 'Pose' }).getByRole('button', { name: 'Open' }).click(); await settle(page);
  await stage.screenshot({ path: `${out}/03-realistic-open.png` });
  await page.getByTestId('preset-villain').click(); await page.getByRole('group', { name: 'Pose' }).getByRole('button', { name: 'Action' }).click(); await settle(page);
  await stage.screenshot({ path: `${out}/04-villain-action.png` });
  await page.getByTestId('preset-chibi').click(); await page.getByRole('group', { name: 'Pose' }).getByRole('button', { name: 'Neutral' }).click(); await settle(page);
  await stage.screenshot({ path: `${out}/05-chibi.png` });
  await page.getByRole('button', { name: /Exercise 3/ }).click(); await settle(page);
  await page.locator('.cd-main').screenshot({ path: `${out}/06-exercise-silhouette.png` });
  await page.setViewportSize({ width: 390, height: 844 }); await settle(page, 900);
  await page.screenshot({ path: `${out}/07-mobile.png`, fullPage: true });
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
