import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/labs/character-design?quality=low');
  await expect(page.locator('.cd-stage canvas')).toBeVisible();
  await expect(page.getByTestId('design-stage')).not.toHaveAttribute('data-negative', '');
});

const negative = async (page: Page) => Number(await page.getByTestId('design-stage').getAttribute('data-negative'));
const pose = (page: Page, name: string) => page.getByRole('group', { name: 'Pose' }).getByRole('button', { name }).click();
const solved = (page: Page) => expect(page.getByTestId('exercise')).toContainText('SOLVED · WHY IT WORKS');

test('one canvas; presets set the proportions and what they read as', async ({ page }) => {
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByTestId('read-heads')).toContainText('3.5 heads tall');
  await page.getByTestId('preset-chibi').click();
  await expect(page.getByTestId('read-heads')).toContainText('2.5 heads tall');
  await expect(page.getByTestId('read-age')).toContainText('Very young');
  await page.getByTestId('preset-realistic').click();
  await expect(page.getByTestId('read-heads')).toContainText('7.5 heads tall');
  await expect(page.getByTestId('read-age')).toContainText('An adult');
  await expect(page.getByTestId('brief')).toContainText('7.5 heads tall (realistic proportions)');
});

test('sliders change the readouts and make a custom design', async ({ page }) => {
  await page.getByRole('slider', { name: 'Head size' }).fill('0.25');
  await expect(page.getByTestId('read-heads')).toContainText('4.0 heads tall');
  await page.getByRole('slider', { name: 'Eye spacing' }).fill('1.5');
  await expect(page.getByTestId('read-eyes')).toContainText('1.5 eye-widths apart');
  await expect(page.getByRole('group', { name: 'Presets' }).locator('button[aria-pressed=true]')).toHaveCount(0);
});

test('the shape pad works from the keyboard and the pure-shape buttons', async ({ page }) => {
  const pad = page.getByTestId('shape-pad');
  await pad.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowUp');
  await expect(pad).toHaveAttribute('aria-valuetext', /Triangle (5\d|[6-9]\d|100)%/);
  await expect(page.getByTestId('read-shape')).toContainText('Triangle');
  await page.getByRole('group', { name: 'Pure shapes' }).getByRole('button', { name: /Square/ }).click();
  await expect(page.getByTestId('read-shape')).toContainText('Square');
  await expect(pad).toHaveAttribute('aria-valuetext', 'Circle 0%, Square 100%, Triangle 0%');
});

test('opening the pose adds measured negative space to the silhouette', async ({ page }) => {
  await pose(page, 'Neutral');
  const before = await negative(page);
  await pose(page, 'Open');
  await expect(page.getByTestId('design-stage')).toHaveAttribute('data-pose', 'open');
  await expect.poll(() => negative(page)).toBeGreaterThan(before + 0.15);
});

test('each exercise can be solved with the controls', async ({ page }) => {
  await page.getByRole('button', { name: /Exercise 1/ }).click();
  await expect(page.getByTestId('read-age')).toContainText('An adult');
  await page.getByRole('slider', { name: 'Head size' }).fill('0.25');
  await page.getByRole('slider', { name: 'Eye line' }).fill('0.42');
  await page.getByRole('slider', { name: 'Eye size' }).fill('0.2');
  await solved(page);

  await page.getByRole('button', { name: /Exercise 2/ }).click();
  await page.getByRole('group', { name: 'Pure shapes' }).getByRole('button', { name: /Triangle/ }).click();
  await page.getByRole('slider', { name: 'Eye size' }).fill('0.12');
  await page.getByRole('slider', { name: 'Eye spacing' }).fill('0.6');
  await page.getByRole('slider', { name: 'Head size' }).fill('0.16');
  await solved(page);

  await page.getByRole('button', { name: /Exercise 3/ }).click();
  await expect(page.getByTestId('exercise')).not.toContainText('SOLVED');
  await pose(page, 'Open');
  await solved(page);

  await page.getByRole('button', { name: /Exercise 4/ }).click();
  await expect(page.getByTestId('read-distinct')).toContainText('0%');
  await page.getByRole('group', { name: 'Pure shapes' }).getByRole('button', { name: /Triangle/ }).click();
  await page.getByRole('slider', { name: 'Head size' }).fill('0.14');
  await solved(page);
  await expect(page.getByRole('group', { name: 'Exercises' }).getByRole('button', { name: /solved/ })).toHaveCount(4);
});

test('mobile keeps the stage in view and the page from overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect.poll(async () => (await page.getByTestId('design-stage').boundingBox())!.y).toBeLessThan(2);
  expect((await page.getByTestId('design-stage').boundingBox())!.height).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
