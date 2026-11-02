import { expect, test, type Page } from '@playwright/test';

const deg = async (page: Page, id: string) => Number((await page.getByTestId(id).textContent())!.replace(/[^\d.-]/g, ''));
const stage = (page: Page) => page.getByTestId('rig-stage');

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}
const centre = async (page: Page, testId: string) => { const b = (await page.getByTestId(testId).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

test.beforeEach(async ({ page }) => {
  await page.goto('/labs/character-rigging?quality=low');
  await expect(page.locator('.rg-stage canvas')).toBeVisible();
  await expect(page.getByTestId('read-elbow')).toContainText('°', { timeout: 30_000 });
});

test('one canvas; display, view and character drive the stage', async ({ page }) => {
  await expect(page.locator('canvas')).toHaveCount(1);
  for (const [label, id] of [['Skeleton', 'skeleton'], ['Weights', 'weights'], ['Mesh', 'mesh'], ['X-ray', 'xray']]) {
    await page.getByRole('group', { name: 'Display' }).getByRole('button', { name: label }).click();
    await expect(stage(page)).toHaveAttribute('data-display', id);
  }
  await page.getByRole('group', { name: 'Camera view' }).getByRole('button', { name: 'Side' }).click();
  await expect(stage(page)).toHaveAttribute('data-view', 'side');
  await page.getByRole('group', { name: 'Character' }).getByRole('button', { name: 'Pip' }).click();
  await expect(stage(page)).toHaveAttribute('data-character', 'pip');
  await expect(page.getByTestId('read-elbow')).toContainText('°', { timeout: 30_000 });
});

test('drag joints on the stage: FK swings the bone, IK legs squat from the hips', async ({ page }) => {
  await page.getByRole('group', { name: 'Camera view' }).getByRole('button', { name: 'Front' }).click();
  await expect(page.getByTestId('drag-hint')).toContainText('Drag any joint');
  await expect(page.getByTestId('joint-elbow')).toHaveAttribute('data-drag', 'swing');
  const before = await deg(page, 'read-elbow');
  const e = await centre(page, 'joint-elbow');
  await drag(page, e, { x: e.x + 60, y: e.y + 120 });
  await expect(page.getByRole('combobox', { name: 'Joint' })).toHaveValue('elbow');
  await expect.poll(() => deg(page, 'read-elbow')).toBeLessThan(before - 20);
  const s0 = await deg(page, 'read-shoulder');
  const sh = await centre(page, 'joint-shoulder');
  await drag(page, sh, { x: sh.x - 40, y: sh.y + 140 });
  await expect.poll(() => deg(page, 'read-shoulder')).toBeLessThan(s0 - 15);
  // IK legs: the hips handle lowers the body and the solver keeps the feet planted.
  await page.getByRole('button', { name: 'Reset pose' }).click();
  await page.getByRole('group', { name: 'Legs' }).getByRole('button', { name: 'IK' }).click();
  await expect(page.getByTestId('joint-hips')).toHaveAttribute('data-drag', 'drop');
  await expect(page.getByTestId('joint-knees')).toHaveAttribute('data-drag', 'none');
  const h = await centre(page, 'joint-hips');
  await drag(page, h, { x: h.x, y: h.y + 80 });
  await expect.poll(async () => Number((await page.getByRole('slider', { name: 'Lower the hips' }).inputValue()))).toBeGreaterThan(0.15);
  await expect(page.getByTestId('read-feet')).toHaveText('Planted');
});

test('FK: pick a joint on the stage and its slider bends it', async ({ page }) => {
  await page.getByTestId('joint-shoulder').click();
  await expect(page.getByRole('combobox', { name: 'Joint' })).toHaveValue('shoulder');
  await page.getByTestId('joint-elbow').click();
  await expect(page.getByTestId('joint-elbow')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: 'Bend' }).fill('10');
  await expect.poll(() => deg(page, 'read-elbow')).toBeLessThan(45);
  const low = await deg(page, 'read-elbow');
  await page.getByRole('slider', { name: 'Bend' }).fill('120');
  await expect.poll(() => deg(page, 'read-elbow')).toBeGreaterThan(low + 80);
});

test('IK: dragging the hand target solves the arm; too far straightens it; FK keeps the pose', async ({ page }) => {
  await page.getByRole('group', { name: 'Left arm' }).getByRole('button', { name: 'IK' }).click();
  await expect(stage(page)).toHaveAttribute('data-arm', 'ik');
  await expect(page.getByTestId('read-reach')).toContainText('%');
  const start = await centre(page, 'ik-target');
  await drag(page, start, { x: start.x + 260, y: start.y + 20 });
  await expect(page.getByTestId('read-reach')).toHaveText('Too far');
  await expect(page.getByTestId('read-reach')).toHaveAttribute('data-out', 'true');
  await expect.poll(() => deg(page, 'read-elbow')).toBeLessThan(2);
  // Back within reach, then hand the pose to FK: the elbow stays where IK put it.
  const far = await centre(page, 'ik-target');
  await drag(page, far, { x: far.x - 230, y: far.y + 40 });
  await expect(page.getByTestId('read-reach')).toContainText('%');
  await page.getByRole('slider', { name: 'Pole vector' }).fill('40');
  await page.waitForTimeout(300);
  const ikElbow = await deg(page, 'read-elbow');
  await page.getByRole('group', { name: 'Left arm' }).getByRole('button', { name: 'FK' }).click();
  await page.getByTestId('joint-elbow').click();
  await expect(page.getByRole('slider', { name: 'Bend' })).toBeVisible();
  await expect.poll(async () => Math.abs((await deg(page, 'read-elbow')) - ikElbow)).toBeLessThan(3);
});

test('exercise 1: reach the mark with IK, then keep it in FK', async ({ page }) => {
  await page.getByRole('button', { name: 'Set up exercise 1' }).click();
  await expect(page.getByTestId('mark')).toBeAttached();
  await page.getByRole('group', { name: 'Left arm' }).getByRole('button', { name: 'IK' }).click();
  await page.waitForTimeout(300);
  const mark = (await page.getByTestId('mark').boundingBox())!;
  await drag(page, await centre(page, 'ik-target'), { x: mark.x + 6, y: mark.y + 6 });
  const ex = page.getByTestId('exercise');
  await expect(ex.locator('li', { hasText: 'Reached with IK' })).toHaveAttribute('data-ok', 'true');
  await page.getByRole('group', { name: 'Left arm' }).getByRole('button', { name: 'FK' }).click();
  await expect(ex.locator('li', { hasText: 'Reached with FK' })).toHaveAttribute('data-ok', 'true');
  await expect(ex).toContainText('SOLVED · WHY IT WORKS');
});

test('exercise 2: FK feet sink in a squat, IK legs keep them planted', async ({ page }) => {
  await page.getByRole('button', { name: /Exercise 2/ }).click();
  await expect(stage(page)).toHaveAttribute('data-view', 'side');
  await page.getByRole('slider', { name: 'Lower the hips' }).fill('0.25');
  await expect(page.getByTestId('read-feet')).toHaveAttribute('data-bad', 'true');
  await expect(page.getByTestId('read-feet')).toContainText('−');
  const ex = page.getByTestId('exercise');
  await expect(ex).not.toContainText('SOLVED');
  await page.getByRole('group', { name: 'Legs' }).getByRole('button', { name: 'IK' }).click();
  await expect(page.getByTestId('read-feet')).toHaveText('Planted');
  await expect(ex).toContainText('SOLVED · WHY IT WORKS');
});

test('exercise 3: the pole vector swings the elbow out with the hand fixed', async ({ page }) => {
  await page.getByRole('button', { name: /Exercise 3/ }).click();
  await expect(stage(page)).toHaveAttribute('data-arm', 'ik');
  const ex = page.getByTestId('exercise');
  await expect(ex.locator('li', { hasText: 'Hand on the mark' })).toHaveAttribute('data-ok', 'true');
  await page.getByRole('slider', { name: 'Pole vector' }).fill('75');
  await expect(ex).toContainText('SOLVED · WHY IT WORKS');
  await expect(ex.locator('li', { hasText: 'Hand on the mark' })).toHaveAttribute('data-ok', 'true');
});

test('skinning: weights paint, rigid binding and the wrist twist', async ({ page }) => {
  await page.getByTestId('tab-skin').click();
  await expect(stage(page)).toHaveAttribute('data-display', 'weights');
  await expect(page.getByRole('tabpanel')).toContainText('vertices');
  await page.getByRole('group', { name: 'Paint joint' }).getByRole('button', { name: 'Left wrist' }).click();
  await expect(page.locator('.rg-legend')).toContainText('Left wrist weight');
  await page.getByRole('button', { name: 'Rigid' }).click();
  await expect(stage(page)).toHaveAttribute('data-weights', 'rigid');
  await page.getByRole('slider', { name: 'Wrist twist' }).fill('170');
  await expect(page.getByRole('tabpanel')).toContainText('170°');
  await page.getByRole('button', { name: 'Show the candy wrapper' }).click();
  await expect(stage(page)).toHaveAttribute('data-view', 'arm');
});

test('bind pose: the wave plays under three corrections, with a ghost of the shipped arms', async ({ page }) => {
  await page.getByTestId('tab-bind').click();
  await expect(stage(page)).toHaveAttribute('data-mode', 'wave');
  await expect(page.getByTestId('correction-none')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.rg-ghost-note')).toBeVisible();
  await page.getByRole('slider', { name: 'Scrub the wave' }).fill('0.5');
  await expect(page.getByRole('button', { name: '▶ Play' })).toBeVisible();
  await page.getByTestId('correction-offset').click();
  await expect(stage(page)).toHaveAttribute('data-correction', 'offset');
  await page.getByTestId('correction-shipped').click();
  await expect(stage(page)).toHaveAttribute('data-correction', 'shipped');
  await expect(page.locator('.rg-ghost-note')).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toContainText('−18°');
});

test('mobile keeps the stage in view and the page from overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect.poll(async () => (await stage(page).boundingBox())!.y).toBeLessThan(2);
  expect((await stage(page).boundingBox())!.height).toBeGreaterThan(220);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
