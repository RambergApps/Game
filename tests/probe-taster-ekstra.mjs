// Probe: tast holdt gjennom mellomsekvens, fokus-tap (blur) og visibilitychange. Bruk: DISPLAY=:21 node tests/probe-taster-ekstra.mjs [--root game] [--tag game] [--size 1280x720]
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import net from 'node:net'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const A = { root: path.join(REPO, 'game'), tag: 'game', size: '1280x720' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i], v = process.argv[++i]; if (k === '--root') A.root = path.resolve(v); else if (k === '--tag') A.tag = v; else if (k === '--size') A.size = v; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const OUT = path.join(REPO, 'shots/test/overgang-1-2');
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: A.root, stdio: 'ignore' }); await sleep(800);
const [W, H] = A.size.split('x').map(Number);
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: [`--window-size=${W},${H + 90}`] });
const S = () => { const B = window.BREACH, w = B.world, p = w.player, d = w.modules.levels._debug(w); return { phase: d.phase, paused: !!w.paused, down: ['KeyW', 'KeyA', 'KeyS', 'KeyD'].filter((k) => B.input.down(k)), vx: +p.vx.toFixed(0), vy: +p.vy.toFixed(0), y: +p.y.toFixed(0) }; };
const res = [];
async function fresh() { const ctx = await browser.newContext({ viewport: { width: W, height: H } }); const page = await ctx.newPage(); await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => window.BREACH?.world?.modules?.levels); await sleep(600);
  const ver = await page.evaluate(async () => (await (await fetch('/src/core/input.js', { cache: 'no-store' })).text()).includes('visibilitychange') && typeof window.BREACH.input.reset === 'function'); return { ctx, page, ver }; }
// 1 mellomsekvens
{ const { ctx, page, ver } = await fresh(); await page.evaluate(() => window.BREACH.startGame()); await sleep(500);
  const ph0 = (await page.evaluate(S)).phase; await page.keyboard.down('KeyS'); await sleep(1200); await page.keyboard.up('KeyS'); await sleep(300);
  for (let i = 0; i < 10 && (await page.evaluate(S)).phase === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(500); }
  await sleep(1500); const z = await page.evaluate(S); await page.screenshot({ path: path.join(OUT, `${A.tag}-ekstra-mellomsekvens.png`) });
  res.push({ case: 'S holdt og sluppet i mellomsekvens', fersk_kode: ver, fase_ved_trykk: ph0, etter: z, bestatt: z.down.length === 0 && z.vy === 0 }); await ctx.close(); }
// 2 tast holdt gjennom hele mellomsekvensen, sluppet etterpå
{ const { ctx, page, ver } = await fresh(); await page.evaluate(() => window.BREACH.startGame()); await sleep(500); await page.keyboard.down('KeyS'); await sleep(800);
  for (let i = 0; i < 10 && (await page.evaluate(S)).phase === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(500); }
  await sleep(800); await page.keyboard.up('KeyS'); await sleep(1000); const z = await page.evaluate(S);
  res.push({ case: 'S holdt gjennom mellomsekvens, sluppet etter', fersk_kode: ver, etter: z, bestatt: z.down.length === 0 && z.vy === 0 }); await ctx.close(); }
// 3 blur (ekte fokus-tap: ny fane) mens S holdes, slipp i den andre fanen
{ const { ctx, page, ver } = await fresh(); await page.evaluate(() => window.BREACH.startGame()); await sleep(500);
  for (let i = 0; i < 10 && (await page.evaluate(S)).phase === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(500); }
  await sleep(1500); await page.keyboard.down('KeyS'); await sleep(300); const p2 = await ctx.newPage(); await page.evaluate(() => dispatchEvent(new Event('blur'))); await p2.keyboard.up('KeyS'); await sleep(300); await p2.close(); await page.bringToFront(); await sleep(1000);
  const z = await page.evaluate(S); res.push({ case: 'fokus-tap (blur + ny fane) mens S holdes', fersk_kode: ver, etter: z, bestatt: z.down.length === 0 && z.vy === 0 }); await ctx.close(); }
// 4 visibilitychange (hidden) mens S holdes, keyup tapt
{ const { ctx, page, ver } = await fresh(); await page.evaluate(() => window.BREACH.startGame()); await sleep(500);
  for (let i = 0; i < 10 && (await page.evaluate(S)).phase === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(500); }
  await sleep(1500); await page.keyboard.down('KeyS'); await sleep(300);
  await page.evaluate(() => { addEventListener('keyup', (e) => e.stopImmediatePropagation(), { capture: true, once: true }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.keyboard.up('KeyS'); await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(1000);
  const z = await page.evaluate(S); res.push({ case: 'visibilitychange (hidden) med tapt keyup', fersk_kode: ver, etter: z, bestatt: z.down.length === 0 && z.vy === 0 }); await ctx.close(); }
for (const r of res) console.log(r.bestatt ? 'BESTÅTT' : 'IKKE BESTÅTT', '|', r.case, '| fersk kode', r.fersk_kode, '|', JSON.stringify(r.etter));
fs.writeFileSync(path.join(REPO, `tests/results/taster-ekstra-${A.tag}.json`), JSON.stringify(res, null, 1)); await browser.close(); srv.kill();
