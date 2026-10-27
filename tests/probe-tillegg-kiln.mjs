// Tillegg 26.10: v3-punkter, spawn/ammokasse i ruter, Kiln-skyting, damage direction av. Bruk: DISPLAY=:21 node tests/probe-tillegg.mjs
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import net from 'node:net'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = path.join(REPO, 'shots/test/full-2026-10-26/tillegg'); fs.mkdirSync(OUT, { recursive: true });
const W = 1280, H = 720, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), R = {};
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(800);
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: [`--window-size=${W},${H + 90}`, '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const ev = (f, a) => page.evaluate(f, a);
try {
await page.goto(`http://127.0.0.1:${port}/index.html?menu=1`); await page.waitForFunction(() => window.BREACH?.world?.modules?.levels); await sleep(1500);
await page.mouse.click(W / 2, H - 20); await sleep(800); await (await page.$('.bm-btn[data-id="play"]'))?.click(); await sleep(2500);
const st = () => ev(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase);
for (let i = 0; i < 15 && (await st()) === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(600); }
// Kiln-skyting i 1-5
await ev(() => { const w = window.BREACH.world; w.modules.levels._debugWave(w, 4, 1); window.__ks = null; setTimeout(async () => { const E = await import('/src/enemies/index.js'); const p = w.player; p.x = w.arena.playerSpawn.x + 40; p.y = w.arena.playerSpawn.y; window.__kiln = E.createEnemy(w, 'heavy', p.x + 230, p.y + 10); }, 2500);
  w.events.on('shot', (q) => { if (q.entity?.type === 'heavy' && !window.__ks) window.__ks = performance.now(); }); });
let got = false;
for (let t = 0; t < 50 && !got; t++) { await sleep(500);
  const k = await ev(() => { const w = window.BREACH.world, p = w.player, e = (w.enemies || []).find((e) => e.type === 'heavy' && !e.dead); if (!e) return null; p.invuln = true; p.hp = p.maxHp;
     return { x: e.x | 0, y: e.y | 0, state: e.state, shot: window.__ks ? performance.now() - window.__ks : null }; });
  if (k?.shot != null && k.shot < 400) { await shot('t-kiln-skyter'); await sleep(150); await shot('t-kiln-skyter-b'); got = true; R.kiln = k; } }
R.kilnSeen = got; await shot('t-kiln-alert-slutt'); R.kilnLast = await ev(() => { const w = window.BREACH.world; return { types: (w.enemies||[]).map(e=>e.type+':'+e.state), shotAge: window.__ks }; }); R.errors = errs;
} catch (e) { R.fatal = String(e); }
fs.writeFileSync(path.join(REPO, 'tests/results/full-2026-10-26/tillegg/probe-tillegg-kiln.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1)); await browser.close(); srv.kill();
