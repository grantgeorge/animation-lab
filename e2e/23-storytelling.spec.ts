import {expect,test} from '@playwright/test';
test('blocking reveals overlap and lets a sideways step separate the actors',async({page})=>{await page.goto('/labs/staging-and-blocking');await page.getByRole('button',{name:/^Exercise 1/}).click();await expect(page.getByTestId('read-separation')).toContainText('Overlapping');const pip=page.getByTestId('mark-pip');await pip.focus();for(let i=0;i<3;i++)await page.keyboard.press('Shift+ArrowRight');await expect(page.getByTestId('read-separation')).toContainText('Separate');await expect(page.getByTestId('exercise')).toContainText('SOLVED')});
test('animatic reorders, retimes and plays the selected edit',async({page})=>{await page.goto('/labs/storyboards-animatics');await page.getByRole('button',{name:'Mystery',exact:true}).click();await expect(page.getByTestId('direction')).toContainText('1. The reveal');await page.getByRole('slider',{name:'Panel duration'}).fill('5');await expect(page.getByTestId('direction')).toContainText('17.0-second');await page.getByRole('button',{name:'Later →',exact:true}).click();await expect(page.getByTestId('direction')).toContainText('2. The reveal');await page.getByRole('button',{name:'Play',exact:false}).click();await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Playhead',exact:true}).inputValue())).toBeGreaterThan(.1)});
test('color script edits one beat and supports grayscale comparison',async({page})=>{await page.goto('/labs/color-scripting');await page.getByRole('button',{name:'Paint The reveal',exact:true}).click();await page.getByRole('slider',{name:'Palette hue'}).fill('150');await expect(page.getByTestId('direction')).toContainText('The reveal: hue 150°');await expect(page.getByTestId('direction')).toContainText('The visitor: hue 220°');await page.getByRole('checkbox',{name:'Check values in grayscale'}).check();await expect(page.locator('.st-color-view')).toHaveCSS('filter','grayscale(1)')});
for(const id of ['staging-and-blocking','storyboards-animatics','color-scripting'])test(`${id} mobile`,async({page})=>{await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`/labs/${id}`);await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)});

const storytellingWorkspaces = [
  { id: 'storyboards-animatics', slider: 'Panel duration', value: '4', panel: 'Select panel 5' },
  { id: 'color-scripting', slider: 'Palette hue', value: '150', panel: 'Paint The return' },
];
for (const lab of storytellingWorkspaces) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`${lab.id} focused workspace ${viewport.width} by ${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto(`/labs/${lab.id}`);
      const screen = page.locator('.st-screen').first();
      await expect(screen).toBeVisible();
      const frame = (await screen.boundingBox())!;
      expect(frame.y).toBeLessThan(230);
      expect(frame.width / frame.height).toBeCloseTo(16 / 9, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (viewport.width > 760) {
        const controls = (await page.locator('aside').boundingBox())!;
        expect(frame.x + frame.width).toBeLessThanOrEqual(controls.x);
      }
      await page.screenshot({ path: testInfo.outputPath('workspace.png') });
      const guideButton = page.getByRole('button', { name: 'Field guide' });
      await guideButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(guideButton).toBeFocused();
      if (lab.panel) {
        // A phone can scroll the strip to every panel without widening the page.
        await page.getByRole('button', { name: lab.panel, exact: true }).click();
        await expect(page.getByRole('button', { name: lab.panel, exact: true })).toHaveAttribute('aria-pressed', 'true');
      }
      await page.getByRole('slider', { name: lab.slider, exact: true }).fill(lab.value);
      if (viewport.width === 390) {
        await page.getByRole('slider', { name: lab.slider, exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('phone-controls.png') });
      }
      if (lab.id === 'color-scripting' && viewport.width !== 1280) {
        await page.getByRole('checkbox', { name: 'Compare with reference' }).check();
        const screens = await page.locator('.st-screen').all();
        expect(screens).toHaveLength(2);
        for (const item of screens) {
          const rect = (await item.boundingBox())!;
          expect(rect.width / rect.height).toBeCloseTo(16 / 9, 1);
        }
        await page.locator('.st-color-view').scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('comparison.png') });
      }
    });
  }
}
