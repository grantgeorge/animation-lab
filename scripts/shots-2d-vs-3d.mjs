import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'docs/screenshots/2d-vs-3d'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const settle = (page, ms = 700) => page.waitForTimeout(ms);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.BASE_URL ?? 'http://localhost:3123'}/labs/2d-vs-3d?quality=high`, { waitUntil: 'networkidle' });
  await page.locator('.td-canvas canvas').waitFor(); await settle(page, 3500);
  await page.screenshot({ path: `${out}/01-apex.png` });
  await page.screenshot({ path: `${out}/02-full.png`, fullPage: true });
  await page.getByTestId('exp-crouch').click(); await settle(page);
  await page.locator('.td-stage').screenshot({ path: `${out}/03-crouch-pivots.png` });
  await page.getByTestId('exp-smear').click(); await settle(page);
  await page.locator('.td-stage').screenshot({ path: `${out}/04-smear.png` });
  await page.getByRole('button', { name: 'Onion skin' }).click(); await page.getByRole('button', { name: 'Show rig' }).click(); await page.getByRole('slider', { name: 'Playhead' }).fill('0.6');  await settle(page, 900);
  await page.locator('.td-stage').screenshot({ path: `${out}/05-onion-rig.png` });
  await page.getByRole('button', { name: 'Onion skin' }).click(); await page.getByRole('button', { name: 'Show rig' }).click();
  await page.getByTestId('exp-turn').click(); await settle(page);
  await page.screenshot({ path: `${out}/06-turn-30.png` });
  await page.getByRole('slider', { name: 'Turn the camera' }).fill('90'); await settle(page);
  await page.locator('.td-stage').screenshot({ path: `${out}/07-side.png` });
  await page.getByRole('slider', { name: 'Turn the camera' }).fill('0');
  await page.setViewportSize({ width: 390, height: 844 }); await settle(page, 900);
  await page.screenshot({ path: `${out}/08-mobile.png`, fullPage: true });
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
