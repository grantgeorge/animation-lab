import { expect, test } from '@playwright/test';

const reading = (page: import('@playwright/test').Page, id: string) => page.getByTestId(`read-${id}`);

test.beforeEach(async ({ page }) => { await page.goto('/labs/staging-and-blocking?quality=low'); await expect(page.locator('.bk-stage canvas')).toBeVisible(); });

test('one canvas serves both views without changing the shot angle', async ({ page }) => {
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('slider', { name: 'Camera angle', exact: true }).fill('25');
  await page.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(page.getByTestId('blocking-stage')).toHaveAttribute('data-view', 'Set');
  await page.getByRole('button', { name: 'Camera', exact: true }).click();
  await expect(page.getByTestId('blocking-stage')).toHaveAttribute('data-view', 'Camera');
  await expect(page.getByRole('slider', { name: 'Camera angle', exact: true })).toHaveValue('25');
});

test('exercise 1: the hidden actor has a camera-only solution', async ({ page }) => {
  await page.getByRole('button', { name: /^Exercise 1/ }).click();
  await expect(page.getByRole('checkbox', { name: /Silhouette test/ })).toBeChecked();
  await expect(reading(page, 'separation')).toContainText('Overlapping');
  await expect(page.getByTestId('exercise').locator('.bk-insight')).toHaveCount(0);
  await page.getByRole('slider', { name: 'Camera angle', exact: true }).fill('55');
  await expect(reading(page, 'separation')).toContainText('Separate');
  await expect(page.getByTestId('exercise')).toContainText('SOLVED');
  await expect(page.getByRole('button', { name: /^Exercise 1.*\(solved\)/ })).toBeVisible();
});

test('exercise 3: moving Pip upstage with the keyboard gives him the scene', async ({ page }) => {
  await page.getByRole('button', { name: /^Exercise 3/ }).click();
  await expect(reading(page, 'faces')).toContainText('Profile');
  await page.getByTestId('mark-pip').focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp');
  await page.getByTestId('mark-bram').focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('exercise')).toContainText('SOLVED');
  await expect(page.getByTestId('direction')).toContainText('facing each other');
});

test('exercise 4: cheating open solves it; turning to camera does not', async ({ page }) => {
  await page.getByRole('button', { name: /^Exercise 4/ }).click();
  await page.getByRole('button', { name: 'To camera', exact: true }).click();
  await expect(page.getByTestId('exercise').locator('li[data-ok=false]')).toContainText('Still playing to each other');
  await page.getByRole('button', { name: 'Cheat open', exact: true }).click();
  await expect(page.getByTestId('blocking-stage')).toHaveAttribute('data-facing', 'cheat');
  await expect(page.getByTestId('exercise')).toContainText('SOLVED');
});

test('dragging a floor mark moves the actor and updates the direction', async ({ page }) => {
  const before = await page.getByTestId('direction').textContent();
  const mark = page.getByTestId('mark-pip').locator('circle'); const box = (await mark.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x - 30, box.y + 10, { steps: 5 }); await page.mouse.up();
  await expect(page.getByTestId('direction')).not.toHaveText(before!);
  await expect(page.getByTestId('direction')).toContainText('Pip at x');
});

test('reset restores marks, lens, view and paused transport', async ({ page }) => {
  await page.getByRole('button', { name: /^Exercise 2/ }).click();
  await page.getByRole('slider', { name: 'Lens', exact: true }).fill('65');
  await expect(reading(page, 'frame')).toContainText('cut off');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Lens', exact: true })).toHaveValue('40');
  await expect(page.getByTestId('blocking-stage')).toHaveAttribute('data-view', 'Camera');
  await expect(page.getByTestId('blocking-stage')).toHaveAttribute('data-facing', 'partner');
  await expect(page.getByRole('slider', { name: 'Playhead', exact: true })).toHaveValue('0');
});
