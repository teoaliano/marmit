// Bundles a small app per framework adapter and checks each one in headless Chrome.
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, 'adapters', 'out');
await mkdir(out, { recursive: true });
await mkdir(path.join(here, 'shots'), { recursive: true });
const sveltePlugin = {
  name: 'svelte',
  setup(b) { b.onLoad({ filter: /\.svelte$/ }, async a => ({ contents: compile(await readFile(a.path, 'utf8'), { filename: a.path, generate: 'client' }).js.code, loader: 'js' })); },
};
const fws = ['react', 'vue', 'solid', 'svelte', 'element'];
for (const f of fws) {
  await build({
    entryPoints: [path.join(here, 'adapters', f + '.ts')], bundle: true, outfile: path.join(out, f + '.js'), format: 'iife', loader: { '.css': 'text' },
    plugins: [sveltePlugin], define: { 'process.env.NODE_ENV': '"production"' }, conditions: ['browser'], logLevel: 'error',
  });
  const body = f === 'element'
    ? `<island-kit id="el" mode="inline"><script type="application/json">{"items":[{"type":"button","label":"From JSON","icon":"heart"},{"type":"separator"},{"type":"segmented","id":"seg","options":["A","B"]}]}</script></island-kit>`
    : '<div id="app"></div>';
  await writeFile(path.join(out, f + '.html'), `<!doctype html><meta charset=utf-8><body style="margin:0;background:#2a2d33;color:#fff;font:13px sans-serif;padding:20px">${body}<script src="./${f}.js"></script>`);
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', defaultViewport: { width: 700, height: 500 },
});
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info && !ok ? '  ' + info : '')); if (!ok) failed++; };

for (const f of fws) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(out, f + '.html'));
  await wait(700);
  const click = async sel => {
    const c = await page.$eval(sel, el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.click(...c); await wait(500);
  };
  const text = sel => page.$eval(sel, el => el.textContent).catch(() => '(missing)');
  const labels = () => page.$$eval('.ik-label', els => els.map(e => e.textContent));

  if (f === 'react') {
    check('react: renders a React node as the icon', !!(await page.$('.ik [aria-label="Star"] svg path')));
    await click('.ik [aria-label="Star"]');
    check('react: toggle updates React state', (await text('#state')).includes('starred true'), await text('#state'));
    await click('.ik [aria-label="Increase"]');
    check('react: stepper drives React state', (await text('#state')).includes('zoom 125'), await text('#state'));
    await click('.ik [aria-label="About"]');
    check('react: panel shows React content, re-rendered', (await text('#react-panel')).includes('125'), await text('#react-panel'));
    check('react: overlay dock pill tracks state', (await page.$$eval('.ik-pill', els => els.map(e => e.textContent))).includes('Zoom 125%'));
  }
  if (f === 'vue') {
    check('vue: component icon', !!(await page.$('.ik [aria-label="Star"] svg path')));
    await click('.ik [aria-label="Increase"]');
    check('vue: stepper drives ref', (await text('#state')).includes('zoom 125'), await text('#state'));
    await click('.ik [aria-label="More"]');
    check('vue: menu rows with VNode icons', (await page.$$('.ik-pc.on .ik-row svg')).length >= 1);
    await click('.ik-pc.on .ik-row');
    check('vue: onAction emits', (await text('#state')).includes('more:One'), await text('#state'));
  }
  if (f === 'solid') {
    check('solid: DOM node icon', !!(await page.$('.ik [aria-label="Star"] svg path')));
    await page.evaluate(() => window.solidBump());
    await wait(300);
    check('solid: reactive items update', (await labels()).includes('count 2'), JSON.stringify(await labels()));
  }
  if (f === 'svelte') {
    check('svelte: mounts a Svelte component as icon', !!(await page.$('#svelte-icon')));
    await page.evaluate(() => window.svelteUpdate());
    await wait(300);
    check('svelte: action update', (await labels()).includes('Updated'), JSON.stringify(await labels()));
  }
  if (f === 'element') {
    check('element: options from JSON child', !!(await page.$('.ik [aria-label="From JSON"]')));
    await page.evaluate(() => document.getElementById('el').addEventListener('change', e => { window.lastChange = e.detail; }));
    await click('.ik-seg button:nth-of-type(2)');
    check('element: change event', (await page.evaluate(() => window.lastChange?.value)) === 'B', JSON.stringify(await page.evaluate(() => window.lastChange)));
  }
  await page.screenshot({ path: path.join(here, 'shots', 'adapter-' + f + '.png') });
  check(f + ': no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
