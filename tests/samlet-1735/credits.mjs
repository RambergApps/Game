// Oppfølging: ending-sekvens + credits via story/index.js. node credits.mjs ROOT OUT PORT
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [ROOT, O, PORT] = process.argv.slice(2); const sl = (ms) => new Promise(r => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await sl(800);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html?yard=v2`); await page.waitForFunction(() => window.BREACH?.world?.player); await page.mouse.click(640, 690); await sl(1000);
await page.evaluate(() => { import('./src/story/index.js').then(m => { window.__st = m; window.__end = m.showCutscene('ending', { world: window.BREACH.world }).then(() => { window.__endDone = 1; }); }); });
let got = false; for (let i = 0; i < 120 && !got; i++) { await sl(1000); const t = await page.evaluate(() => document.body.innerText); if (/Coming home/.test(t)) { await sl(1500); await page.screenshot({ path: `${O}/ending-coming-home.png` }); got = true; } else if (i % 4 === 3) await page.mouse.click(640, 400); }
await page.evaluate(() => { window.__cr = window.__st.showCredits({ world: window.BREACH.world }); });
for (let i = 0; i < 16; i++) { await sl(2000); await page.screenshot({ path: `${O}/credits-${String(i).padStart(2, '0')}.png` }); }
console.log(JSON.stringify({ comingHome: got, errs })); await b.close(); srv.kill();
