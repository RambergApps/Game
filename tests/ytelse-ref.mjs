// Ytelsesreferanse: DISPLAY=:21 node tests/ytelse-ref.mjs [--cfg dpr1,dpr2,v34] [--sek 18] – bølge 1–5 brett 1, rAF-tider, toppvindu (3 s) med flest fiender i live.
import { chromium } from '../node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process'; import net from 'node:net'; import fs from 'node:fs'; import path from 'node:path';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const A = { cfg: 'dpr1,dpr2,v34', sek: 18, waves: '0,1,2,3,4' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k in A) A[k] = process.argv[++i]; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const W = 1280, H = 720;
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(800);
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: [`--window-size=${W},${H + 90}`, '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });
const CFG = { dpr1: { dpr: 1, q: '' }, dpr2: { dpr: 2, q: '' }, v34: { dpr: 1, q: '?view=34' } }; const OUT = {};
for (const c of A.cfg.split(',')) { const { dpr, q } = CFG[c];
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html${q}`); await page.waitForFunction(() => window.BREACH?.world?.player && window.BREACH?.world?.modules?.levels);
  await page.mouse.click(W / 2, H - 30); await sleep(1500);
  for (let i = 0; i < 20 && (await page.evaluate(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase)) === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(600); }
  await page.mouse.move(W / 2 + 200, H / 2 - 40); await sleep(300);
  const info = await page.evaluate(() => { const B = window.BREACH; setInterval(() => { const p = B.world.player; if (p) p.hp = p.maxHp; }, 100);
    window.__f = []; const loop = (t) => { const w = B.world; window.__f.push([t, (w.enemies || []).filter((e) => e.hp > 0 && !e.dead).length, performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null]); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    return { zoom: B.camera.zoom, tilt: B.PROJ?.tiltDeg, g: B.camera.g, dpr: devicePixelRatio, canvas: [document.querySelector('canvas')?.width, document.querySelector('canvas')?.height] }; });
  OUT[c] = { info, waves: {} };
  for (const wv of A.waves.split(',').map(Number)) {
    await page.evaluate((wv) => { const w = window.BREACH.world; w.modules.levels._debugWave(w, wv, 0.5); window.__f.length = 0; }, wv);
    await sleep(A.sek * 1000);
    const f = await page.evaluate(() => window.__f.splice(0));
    // 3 s-vindu med flest fiender i live (snitt), start etter 1 s
    let best = null; for (let i = 0; i < f.length; i += 10) { const t0 = f[i][0]; if (t0 - f[0][0] < 1000) continue; const win = f.filter((x) => x[0] >= t0 && x[0] < t0 + 3000); if (win.length < 60 || win.at(-1)[0] - t0 < 2800) continue; const m = win.reduce((a, x) => a + x[1], 0) / win.length; if (!best || m > best.m) best = { m, win }; }
    if (!best) { OUT[c].waves[wv] = { feil: 'for få bilder' }; continue; }
    const dt = []; for (let i = 1; i < best.win.length; i++) dt.push(best.win[i][0] - best.win[i - 1][0]); const s = [...dt].sort((a, b) => a - b); const mean = dt.reduce((a, b) => a + b, 0) / dt.length;
    OUT[c].waves[wv] = { mean: +mean.toFixed(2), p99: +s[Math.floor(s.length * 0.99)].toFixed(1), fps: +(1000 / mean).toFixed(1), max: +s.at(-1).toFixed(1), heapTopp: +Math.max(...f.map((x) => x[2] || 0)).toFixed(1), fiender: Math.max(...best.win.map((x) => x[1])), fienderSnitt: +best.m.toFixed(1), bilder: dt.length };
    console.log(c, wv, JSON.stringify(OUT[c].waves[wv]));
  }
  OUT[c].errs = errs.slice(0, 5); await ctx.close(); }
fs.mkdirSync(path.join(REPO, 'shots/test/ytelse'), { recursive: true }); fs.writeFileSync(path.join(REPO, `shots/test/ytelse/referanse-2026-10-27-${A.waves.replace(/,/g, '')}.json`), JSON.stringify(OUT, null, 1));
console.log('INFO', JSON.stringify(Object.fromEntries(Object.entries(OUT).map(([k, v]) => [k, v.info]))));
await browser.close(); srv.kill();
