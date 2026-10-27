// Probe: står Warden stille uten sikt – presser fiendene på, eller blir bølgen stående? (Breach Test, 2026-10-23)
// Bruk: node tests/probe-passivitet.mjs [--sec 75]
import { createRequire } from 'module'; import { spawn } from 'child_process'; import http from 'http'; import net from 'net'; import fs from 'fs'; import os from 'os'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'game');
const SEC = +(process.argv[process.argv.indexOf('--sec') + 1] || 75) || 75;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
function findChrome() { const base = path.join(os.homedir(), '.cache/ms-playwright'); for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium-')).sort().reverse()) { const p = path.join(base, d, 'chrome-linux64/chrome'); if (fs.existsSync(p)) return p; } }
const port = await freePort(); const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { const ok = await new Promise((r) => http.get(`http://127.0.0.1:${port}/`, (res) => { res.resume(); r(true); }).on('error', () => r(false))); if (ok) break; await sleep(100); }
const browser = await chromium.launch({ headless: true, executablePath: findChrome(), args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => window.BREACH?.world); await sleep(1000);
await page.evaluate(() => { const w = window.BREACH.world; window.__ev = {}; w.events.on('*', ({ type }) => { window.__ev[type] = (window.__ev[type] || 0) + 1; }); });
await page.mouse.click(640, 360);
const L = () => page.evaluate(() => { const w = window.BREACH.world, d = w.modules.levels._debug?.(w); return { phase: d?.phase, t: w.time }; });
for (let i = 0; i < 80; i++) { const s = await L(); if (s.phase === 'cutscene') await page.keyboard.press('Escape'); if (s.phase === 'wave') break; await sleep(250); }
const out = []; const t0 = Date.now();
while (Date.now() - t0 < SEC * 1000) {
  out.push(await page.evaluate(() => { const w = window.BREACH.world, p = w.player; const en = (w.enemies || []).filter((e) => !e.dead);
    return { t: +(w.time ?? 0).toFixed(1), hp: Math.round(p.hp), n: en.length, dMin: en.length ? Math.round(Math.min(...en.map((e) => Math.hypot(e.x - p.x, e.y - p.y)))) : null, dAvg: en.length ? Math.round(en.reduce((s, e) => s + Math.hypot(e.x - p.x, e.y - p.y), 0) / en.length) : null,
      st: en.map((e) => e.state || e.ai?.state || e.mode || '?').join(','), shots: window.__ev.shot || 0, flank: window.__ev.flank || 0, gren: window.__ev.grenade || window.__ev.grenadeThrow || 0, dead: p.dead }; }));
  await sleep(5000);
}
const r = { tool: 'probe-passivitet', root, sec: SEC, samples: out, events: await page.evaluate(() => window.__ev), errors: errs };
fs.mkdirSync(path.join(root, '..', 'tests/results/full'), { recursive: true });
fs.writeFileSync(path.join(root, '..', 'tests/results/full/probe-passivitet.json'), JSON.stringify(r, null, 1));
await page.screenshot({ path: path.join(root, '..', 'shots/test/full-2026-10-23/probe-passivitet-slutt.png') });
for (const s of out) console.log(JSON.stringify(s));
await browser.close(); srv.kill();
