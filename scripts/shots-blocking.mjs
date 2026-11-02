import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const out = 'docs/screenshots/staging-and-blocking'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const settle = (page, ms = 700) => page.waitForTimeout(ms);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.BASE_URL ?? 'http://localhost:3123'}/labs/staging-and-blocking?quality=high`, { waitUntil: 'networkidle' });
  await page.locator('.bk-stage canvas').waitFor(); await settle(page, 2500);
  await page.screenshot({ path: `${out}/01-camera.png` });
  await page.getByRole('slider', { name: 'Playhead', exact: true }).fill('3.9'); await settle(page);
  await page.screenshot({ path: `${out}/02-greeting-facing.png` });
  await page.getByRole('button', { name: /^Exercise 1/ }).click(); await settle(page);
  await page.screenshot({ path: `${out}/03-hidden.png`, fullPage: true });
  await page.getByRole('slider', { name: 'Camera angle', exact: true }).fill('-55'); await settle(page);
  await page.screenshot({ path: `${out}/04-revealed.png`, fullPage: true });
  await page.getByRole('button', { name: /^Exercise 3/ }).click();
  await page.getByTestId('mark-pip').focus(); for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp');
  await page.getByTestId('mark-bram').focus(); for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  await settle(page); await page.screenshot({ path: `${out}/05-upstaged.png`, fullPage: true });
  await page.getByRole('button', { name: 'Set', exact: true }).click(); await settle(page, 900);
  await page.screenshot({ path: `${out}/06-set.png` });
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Camera', exact: true }).click(); await settle(page, 900);
  await page.screenshot({ path: `${out}/07-mobile.png`, fullPage: true });
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
