import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

/** Character Rigging screenshots: `node scripts/shots-character-rigging.mjs [outDir]` against a running dev server. */
const out = process.argv[2] ?? 'docs/screenshots/character-rigging';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const settle = (page, ms = 900) => page.waitForTimeout(ms);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.env.BASE_URL ?? 'http://localhost:3123'}/labs/character-rigging?quality=high`, { waitUntil: 'networkidle' });
  await page.locator('.rg-stage canvas').waitFor();
  await page.getByTestId('read-elbow').filter({ hasText: '°' }).waitFor();
  await settle(page, 2500);
  await page.screenshot({ path: `${out}/01-fk-xray.png` });

  // IK: drag the hand target up and out, pole out.
  await page.getByRole('group', { name: 'Left arm' }).getByRole('button', { name: 'IK' }).click();
  await settle(page, 400);
  const t = (await page.getByTestId('ik-target').boundingBox());
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x - 40, t.y + 70, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('slider', { name: 'Pole vector' }).fill('70');
  await settle(page);
  await page.screenshot({ path: `${out}/02-ik-pole.png` });

  // Squat exercise solved with IK legs.
  await page.getByRole('button', { name: /Exercise 2/ }).click();
  await page.getByRole('slider', { name: 'Lower the hips' }).fill('0.22');
  await settle(page, 500);
  await settle(page);
  await page.screenshot({ path: `${out}/03-squat-fk-sinking.png` });
  await page.getByRole('group', { name: 'Legs' }).getByRole('button', { name: 'IK' }).click();
  await settle(page);
  await page.screenshot({ path: `${out}/04-squat-ik.png` });

  // Skinning: weights, then the candy wrapper in rigid vs smooth.
  await page.getByTestId('tab-skin').click();
  await page.getByRole('button', { name: 'Show the candy wrapper' }).click();
  await settle(page, 1200);
  await page.screenshot({ path: `${out}/05-weights-wrist.png` });
  await page.getByRole('group', { name: 'Display' }).getByRole('button', { name: 'Mesh' }).click();
  await settle(page, 600);
  await page.screenshot({ path: `${out}/05b-candy-wrapper.png` });
  await page.getByRole('button', { name: 'Fold the elbow' }).click();
  await page.getByRole('button', { name: 'Rigid' }).click();
  await settle(page, 1200);
  await page.screenshot({ path: `${out}/06-rigid-elbow.png` });

  // Bind pose: no correction vs shipped, with the ghost.
  await page.getByRole('button', { name: 'Smooth (shipped)' }).click();
  await page.getByTestId('tab-bind').click();
  await page.getByRole('group', { name: 'Display' }).getByRole('button', { name: 'X-ray' }).click();
  await page.getByRole('button', { name: '¾' }).click();
  await settle(page, 1800);
  await page.getByRole('slider', { name: 'Scrub the wave' }).fill('0.5');
  await settle(page, 600);
  await page.screenshot({ path: `${out}/07-bind-none.png` });
  await page.getByTestId('correction-offset').click();
  await settle(page, 600);
  await page.screenshot({ path: `${out}/08-bind-offset.png` });
  await page.getByTestId('correction-shipped').click();
  await settle(page, 600);
  await page.screenshot({ path: `${out}/08b-bind-shipped.png` });

  await page.screenshot({ path: `${out}/09-full.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('tab-pose').click();
  await settle(page, 1200);
  await page.screenshot({ path: `${out}/10-mobile.png`, fullPage: true });
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
