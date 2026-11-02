import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/labs/animation-style?quality=low'); await expect(page.locator('.as-stage canvas')).toBeVisible(); });

test('one canvas; a movement style sets its recipe and cadence', async ({ page }) => {
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByTestId('motion-limited').click();
  await expect(page.getByTestId('style-stage')).toHaveAttribute('data-styles', 'limited');
  await expect(page.getByRole('group', { name: 'Cadence' }).getByRole('button', { name: 'On 3s' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('cadence')).toContainText('8/s');
  await expect(page.getByTestId('watch')).toContainText('Long held poses');
});

test('editing a dial makes a custom recipe that flows into the direction', async ({ page }) => {
  await page.getByTestId('motion-naturalistic').click();
  await page.getByRole('group', { name: 'Cadence' }).getByRole('button', { name: 'On 2s' }).click();
  await expect(page.getByTestId('recipe')).toContainText('Custom');
  await expect(page.getByTestId('direction')).toContainText('stepped on twos (12 poses a second)');
  await page.getByRole('slider', { name: 'Pose holds' }).fill('0.8');
  await expect(page.getByTestId('direction')).toContainText('long pose holds');
});

test('frame stepping moves one 24 fps frame at a time', async ({ page }) => {
  const frame = page.getByTestId('frame');
  const before = Number((await frame.textContent())!.slice(1));
  await page.getByRole('button', { name: 'Next frame' }).click();
  await expect(frame).toHaveText(`F${String(before + 1).padStart(3, '0')}`);
  await page.getByRole('button', { name: 'Previous frame' }).click();
  await page.getByRole('button', { name: 'Previous frame' }).click();
  await expect(frame).toHaveText(`F${String(before - 1).padStart(3, '0')}`);
});

test('compare shows four styles in one canvas, each with its own cadence row', async ({ page }) => {
  await page.getByTestId('compare').click();
  await expect(page.getByTestId('style-stage')).toHaveAttribute('data-styles', 'naturalistic,cartoony,limited,snappy');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.as-cad-row')).toHaveCount(4);
  await page.getByTestId('motion-stopmotion').click();
  await expect(page.getByTestId('style-stage')).toHaveAttribute('data-styles', 'stopmotion');
});

test('look is independent of motion; atlas cards set both', async ({ page }) => {
  await page.getByTestId('motion-snappy').click();
  await page.getByRole('button', { name: 'Toon-shaded', exact: true }).click();
  await expect(page.getByTestId('style-stage')).toHaveAttribute('data-look', 'toon');
  await expect(page.getByTestId('style-stage')).toHaveAttribute('data-styles', 'snappy');
  await page.getByTestId('try-anime').click();
  await expect(page.getByTestId('style-stage')).toHaveAttribute('data-styles', 'limited');
  await expect(page.getByTestId('style-stage')).toHaveAttribute('data-look', 'flat');
});

test('the direction has five parts and builder chips change it', async ({ page }) => {
  await page.getByRole('group', { name: 'Animation medium' }).getByRole('button', { name: '2D hand-drawn' }).click();
  await page.getByRole('group', { name: 'Visual language' }).getByRole('button', { name: 'Watercolour' }).click();
  const text = await page.getByTestId('direction').textContent();
  expect(text).toContain('Medium: 2D hand-drawn.');
  expect(text).toContain('Visual: Watercolour.');
  expect(text!.split('\n')).toHaveLength(5);
});

test('mobile keeps the stage in view and the page from overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('motion-cartoony').click();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(async () => (await page.getByTestId('style-stage').boundingBox())!.y).toBeLessThan(2);
  const stage = (await page.getByTestId('style-stage').boundingBox())!;
  expect(stage.height).toBeGreaterThan(150);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
