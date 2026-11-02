import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'docs/screenshots/animation-style'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const settle = (page, ms = 700) => page.waitForTimeout(ms);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.BASE_URL ?? 'http://localhost:3123'}/labs/animation-style?quality=high`, { waitUntil: 'networkidle' });
  await page.locator('.as-stage canvas').waitFor(); await settle(page, 3000);
  await page.screenshot({ path: `${out}/01-cartoony.png` });
  await page.screenshot({ path: `${out}/02-full.png`, fullPage: true });
  await page.getByTestId('compare').click(); await page.getByRole('slider', { name: 'Playhead', exact: true }).fill('1.7'); await settle(page);
  await page.screenshot({ path: `${out}/03-compare.png` });
  await page.getByTestId('motion-limited').click(); await page.getByRole('button', { name: 'Flat colour', exact: true }).click(); await settle(page);
  await page.screenshot({ path: `${out}/04-limited-flat.png` });
  await page.setViewportSize({ width: 390, height: 844 }); await settle(page, 900);
  await page.screenshot({ path: `${out}/05-mobile.png`, fullPage: true });
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
