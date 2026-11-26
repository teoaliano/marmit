// Drives demo/index.html in headless Chrome: screenshots each state and fails on page errors.
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.resolve(here, '../demo/index.html');
const out = n => path.join(here, 'shots', n + '.png');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--hide-scrollbars'], defaultViewport: { width: 1000, height: 1400, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
await page.goto(url);
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = async (n, clip) => { await wait(900); await page.screenshot({ path: out(n), clip }); console.log('shot', n); };
const center = async sel => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });

await shot('01-initial');
// search melts open
const s = await center('#r6 .ik-search'); await page.mouse.click(...s); await page.keyboard.type('hello');
await shot('02-search-open', { x: 200, y: 0, width: 600, height: 1400 });
// dock panels
const dockBtn = async label => center(`.ik[aria-label="Canvas tools"] .ik-items > [aria-label="${label}"]`);
await page.mouse.click(...await dockBtn('Insert')); await shot('03-dock-insert');
await page.mouse.click(...await dockBtn('Fill')); await shot('04-dock-fill');
await page.mouse.click(...await dockBtn('Search')); await page.keyboard.type('foo'); await shot('05-dock-command');
await page.keyboard.press('Escape'); await wait(400);
await page.mouse.click(...await dockBtn('View')); await shot('06-dock-view-menu');
await page.keyboard.press('Escape');
// mid-flight: pull an inline bar
const r1 = await center('#r1 .ik [aria-label="Redo"]');
await page.mouse.move(r1[0] + 40, r1[1] - 2); await page.mouse.down(); await page.mouse.move(r1[0] + 60, r1[1] + 60, { steps: 8 });
await wait(250); await page.screenshot({ path: out('07-pull') , clip: { x: 150, y: 40, width: 700, height: 200 } }); console.log('shot 07-pull');
await page.mouse.up();
// contained: drag the left-docked bar and throw it at the bottom
await page.evaluate(() => document.getElementById('stage').scrollIntoView());
await wait(300);
const st = await page.$eval('#stage', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const grab = await center('#stage .ik [aria-label="Redo"]');
await page.mouse.move(...grab); await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(grab[0] + i * 25, grab[1] + i * 18); await wait(16); }
await page.screenshot({ path: out('08-dragging'), clip: { x: st.x, y: st.y, width: st.w, height: st.h } }); console.log('shot 08-dragging');
await page.mouse.up();
await wait(120); await page.screenshot({ path: out('09-flight'), clip: { x: st.x, y: st.y, width: st.w, height: st.h } }); console.log('shot 09-flight');
await wait(1200); await page.screenshot({ path: out('10-landed'), clip: { x: st.x, y: st.y, width: st.w, height: st.h } }); console.log('shot 10-landed');
console.log('stage side:', await page.evaluate(() => islands.stage.side));
// collapse the dock
await page.evaluate(() => { window.scrollTo(0, 0); islands.dock.collapse(true); });
await shot('11-collapsed', { x: 0, y: 1100, width: 1000, height: 300 });
await page.evaluate(() => { islands.dock.collapse(false); islands.dock.setSide('right'); });
await wait(1400); await page.screenshot({ path: out('12-dock-right') }); console.log('shot 12-dock-right');
await page.evaluate(() => islands.dock.open('insert')); await shot('13-dock-right-insert');
// keyboard: open a panel with Enter, move with arrows, Esc returns focus to the trigger
await page.evaluate(() => islands.dock.setSide('bottom')); await wait(1200);
await page.evaluate(() => document.querySelector('.ik[aria-label="Canvas tools"] [data-ik-key="insert"]').focus());
await page.keyboard.press('Enter'); await wait(500);
const k1 = await page.evaluate(() => document.activeElement.textContent);
await page.keyboard.press('ArrowRight'); const k2 = await page.evaluate(() => document.activeElement.textContent);
await page.keyboard.press('Escape'); await wait(300);
const k3 = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
console.log('keyboard:', k1, '->', k2, '-> esc focus', k3);
if (k1 !== 'Text' || k2 !== 'Image' || k3 !== 'Insert') errors.push('keyboard navigation failed');
// tooltip on hover
const ub = await center('#r1 .ik [aria-label="Undo"]'); await page.mouse.move(...ub); await wait(700);
const tipTxt = await page.$eval('#r1 .ik-tip', el => el.classList.contains('on') ? el.textContent : '');
console.log('tooltip:', tipTxt); if (tipTxt !== 'Undo') errors.push('tooltip did not show');
await page.screenshot({ path: out('14-tooltip'), clip: { x: 250, y: 60, width: 500, height: 120 } });
// light theme
await page.mouse.move(5, 5); await wait(200);
await page.mouse.click(...await dockBtn('Light theme')); await wait(300);
await page.mouse.click(...await dockBtn('Fill'));
await shot('15-light', { x: 0, y: 0, width: 1000, height: 1400 });
console.log('values', JSON.stringify(await page.evaluate(() => ({ r2: islands.r2.values(), r3: islands.r3.values() }))));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
