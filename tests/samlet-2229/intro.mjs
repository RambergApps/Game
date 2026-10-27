// Røyk: lasteskjerm → meny → intro (spilles ferdig) → overgang til spill; logg luminans for sekvens-canvas per frame. node intro.mjs URL OUT
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [URL0, O] = process.argv.slice(2); fs.mkdirSync(O, { recursive: true }); const sl = (ms) => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: O + '/video', size: { width: 1280, height: 720 } } });
await ctx.addInitScript(() => { const L = window.__L = []; const sc = document.createElement('canvas'); sc.width = sc.height = 8; const sx = sc.getContext('2d', { willReadFrequently: true });
  let pk = ''; const f = (t) => { const cs = document.querySelector('canvas.breach-cutscene'), ld = document.querySelector('[data-ui=loading]'); let lum = -1;
    if (cs && cs.width) { sx.drawImage(cs, 0, 0, 8, 8); const d = sx.getImageData(0, 0, 8, 8).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; lum = Math.round(s / 192); }
    L.push([+t.toFixed(0), ld ? 1 : 0, cs ? +(+getComputedStyle(cs).opacity).toFixed(2) : -1, lum]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); }); page.on('requestfailed', q => errs.push('FAIL ' + q.url()));
const ev = (f, a) => page.evaluate(f, a); const now = () => ev(() => performance.now());
const M = {}; await page.goto(URL0);
for (let i = 0; i < 300; i++) { if (await ev(() => !!document.querySelector('[data-ui=loading]'))) { M.lasteskjermSett = await now(); break; } await sl(50); }
await page.screenshot({ path: O + '/01-lasteskjerm.png' });
for (let i = 0; i < 600; i++) { if (await ev(() => !document.querySelector('[data-ui=loading]'))) { M.lasteskjermBorte = await now(); break; } await sl(50); }
await sl(1500); await page.screenshot({ path: O + '/02-meny.png' }); M.klikk = await now(); await page.mouse.click(640, 400); await sl(1500);
let k = 0; for (let i = 0; i < 25; i++) { if (await ev(() => !!document.querySelector('canvas.breach-cutscene'))) break; await page.mouse.click(640, 400); await sl(800); if (i % 3 === 0) await page.screenshot({ path: `${O}/03-start-${k++}.png` }); }
M.introSett = await now(); let n = 0;
for (let i = 0; i < 240; i++) { if (!(await ev(() => !!document.querySelector('canvas.breach-cutscene')))) break; if (i % 2 === 0) await page.screenshot({ path: `${O}/04-intro-${String(n++).padStart(3, '0')}.png` }); await sl(500); }
M.introBorte = await now(); for (let i = 0; i < 10; i++) { await page.screenshot({ path: `${O}/05-overgang-${i}.png` }); await sl(150); }
M.skip = await ev(() => !!document.querySelector('canvas.breach-cutscene'));
const L = await ev(() => window.__L); fs.writeFileSync(O + '/intro.json', JSON.stringify({ M, errs, L })); await ctx.close(); await b.close(); console.log('FERDIG', JSON.stringify(M), 'errs', errs.length);
