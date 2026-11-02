import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/labs/2d-vs-3d?quality=low'); await expect(page.locator('.td-canvas canvas')).toBeVisible(); });

test('one canvas, three panes of the same move, each on its own cadence', async ({ page }) => {
  await expect(page.locator('canvas')).toHaveCount(1);
  for (const id of ['drawn', 'cutout', '3d']) await expect(page.getByTestId(`pane-${id}`)).toBeVisible();
  await expect(page.getByTestId('pane-drawn')).toHaveAttribute('data-cadence', '2');
  await expect(page.getByTestId('pane-cutout')).toHaveAttribute('data-cadence', '1');
  await expect(page.getByTestId('pip-drawn')).toBeVisible();
  await expect(page.getByTestId('pip-cutout')).toBeVisible();
  await expect(page.getByTestId('frame')).toHaveText('F023');
});

test('frame stepping: the drawn pane changes drawing every second frame', async ({ page }) => {
  const frame = page.getByTestId('frame'), drawn = page.getByTestId('pane-drawn');
  await page.getByRole('button', { name: 'Next frame' }).click();
  await expect(frame).toHaveText('F024');
  await expect(drawn).toHaveAttribute('data-drawing', '12');
  await page.getByRole('button', { name: 'Next frame' }).click();
  await expect(frame).toHaveText('F025');
  await expect(drawn).toHaveAttribute('data-drawing', '12');
  await page.getByRole('button', { name: 'Previous frame' }).click();
  await page.getByRole('button', { name: 'Previous frame' }).click();
  await expect(frame).toHaveText('F023');
  await expect(drawn).toHaveAttribute('data-drawing', '11');
});

test('turning the camera: 3D is continuous, the cut-out snaps to its drawn views, drawing costs climb', async ({ page }) => {
  const turn = page.getByRole('slider', { name: 'Turn the camera' });
  await turn.fill('30');
  await expect(page.getByTestId('pane-3d')).toHaveAttribute('data-angle', '30');
  await expect(page.getByTestId('pane-drawn')).toHaveAttribute('data-angle', '30');
  await expect(page.getByTestId('pane-cutout')).toHaveAttribute('data-view', '45');
  await expect(page.getByTestId('snap-note')).toContainText('No 30° drawings');
  await expect(page.getByTestId('cost-drawn')).toContainText('60');
  await turn.fill('45');
  await expect(page.getByTestId('snap-note')).toHaveCount(0);
  await turn.fill('90');
  await expect(page.getByTestId('pane-cutout')).toHaveAttribute('data-view', '90');
  await expect(page.getByTestId('cost-drawn')).toContainText('120');
  await expect(page.getByTestId('cost-cutout')).toContainText('63');
  await expect(page.getByTestId('cost-3d')).toContainText('0');
});

test('cadence toggles change what each pane shows and costs', async ({ page }) => {
  await page.getByRole('group', { name: 'Hand-drawn cadence' }).getByRole('button', { name: 'On 1s' }).click();
  await expect(page.getByTestId('pane-drawn')).toHaveAttribute('data-cadence', '1');
  await expect(page.getByTestId('cost-drawn')).toContainText('60');
  await page.getByRole('group', { name: '3D rig cadence' }).getByRole('button', { name: 'On 2s' }).click();
  await expect(page.getByTestId('pane-3d')).toHaveAttribute('data-cadence', '2');
  await expect(page.getByTestId('pane-3d')).toContainText('on 2s · 12/s');
});

test('onion skin, pivots and rig toggles', async ({ page }) => {
  const ghosts = page.locator('[data-testid=pane-drawn] g[filter^="url(#td-ghost"]');
  await expect(ghosts).toHaveCount(0);
  await page.getByRole('button', { name: 'Onion skin' }).click();
  await expect(ghosts).toHaveCount(2);
  await expect(page.getByTestId('pivots')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show pivots' }).click();
  await expect(page.getByTestId('pivots')).toBeVisible();
  await page.getByRole('button', { name: 'Show rig' }).click();
  await expect(page.getByRole('button', { name: 'Show rig' })).toHaveAttribute('aria-pressed', 'true');
});

test('experiments set up the stage: the arm swing smears only in the drawing', async ({ page }) => {
  await page.getByTestId('exp-smear').click();
  await expect(page.getByTestId('frame')).toHaveText('F018');
  await expect(page.locator('[data-testid=pane-drawn] [data-testid=smear]')).toHaveCount(2);
  await expect(page.locator('[data-testid=pane-cutout] [data-testid=smear]')).toHaveCount(0);
  await expect(page.getByTestId('insight')).toContainText('smear');
  await page.getByTestId('exp-turn').click();
  await expect(page.getByTestId('pane-cutout')).toHaveAttribute('data-view', '45');
  await page.getByTestId('exp-crouch').click();
  await expect(page.getByTestId('frame')).toHaveText('F015');
  await expect(page.getByTestId('pivots')).toBeVisible();
});

test('mobile keeps the three panes in view and the page from overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect.poll(async () => (await page.locator('.td-stage').boundingBox())!.y).toBeLessThan(2);
  const pane = (await page.getByTestId('pane-cutout').boundingBox())!;
  expect(pane.height).toBeGreaterThan(140);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
