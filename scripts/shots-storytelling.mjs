import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const root='docs/screenshots/storytelling';await mkdir(root,{recursive:true});
const browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});for(const id of ['staging-and-blocking','storyboards-animatics','color-scripting']){await page.goto(`${process.env.BASE_URL??'http://localhost:3123'}/labs/${id}`);await page.locator('h1').waitFor();await page.screenshot({path:`${root}/${id}.png`,fullPage:true});await page.getByRole('button',{name:'Set up experiment',exact:false}).click();await page.getByRole('button',{name:'What should I notice?'}).click();await page.screenshot({path:`${root}/${id}-lesson.png`,fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${root}/${id}-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000})}}finally{await browser.close()}
