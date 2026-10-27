// Test: spawnWarn + spawnRise dypt bak containeren 37,19 (hendelser emittes KUN i testsiden). Teller VFX-partikler i takflaten per lag.
// → reviews/img/sprekk-bak-container.png (varsel, oppbrudd, 0,5 s etter)
import { createRequire } from 'node:module'; import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(REPO, 'package.json')); const { chromium } = require('playwright-core');
const port = 8600 + Math.floor(Math.random() * 90), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), TMP = '/workspace/vfxr';
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(900);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); pg.on('pageerror', (e) => console.log('ERR', String(e)));
await pg.goto(`http://127.0.0.1:${port}/index.html?view=34&dpr=1&zoom=2.25`); await pg.waitForFunction(() => window.BREACH?.world?.player);
await pg.evaluate(() => window.BREACH.startGame?.()); await sleep(1500);
for (let i = 0; i < 12; i++) { const ph = await pg.evaluate(() => window.BREACH.world.modules?.levels?._debug?.(window.BREACH.world)?.phase); if (ph !== 'cutscene') break; await pg.keyboard.press('Escape'); await sleep(600); }
const shots = [];
for (const [lbl, n] of [['warn', 40], ['rise', 8], ['rise2', 30]]) {
  const r = await pg.evaluate(([lbl, n]) => { const B = window.BREACH, w = B.world; B.loop.stop();
    const c = w.cover.find((c) => c.kind === 'container' && c.x === 1184), X = c.x + 32, Y = c.y + 60, p = w.player;
    const step = (k) => { for (let i = 0; i < k; i++) { for (const e of w.enemies) e.hp = 0, e.dead = true; p.x = c.x - 60; p.y = c.y + c.h + 30; p.hp = 100; B.camera.zoom = B.PROJ.zoom; B.camera.x = c.x + c.w / 2; B.camera.y = c.y + c.h / 2; B.loop.advance(1); } };
    if (lbl === 'warn') { step(20); w.events.emit('spawnWarn', { x: X, y: Y, t: 0.9, id: 991, type: 'grunt' }); }
    if (lbl === 'rise') w.events.emit('spawnRise', { x: X, y: Y, id: 991, type: 'grunt' });
    step(n);
    const P = w._vfx.pool.P.filter((q) => q.on), inRoof = (q) => q.x >= c.x && q.x <= c.x + c.w && q.y >= c.y - 40 && q.y <= c.y + c.h;
    return { lbl, over: P.filter((q) => inRoof(q) && q.layer !== 'under' && q.layer !== 0 && q.layer !== P.find(() => false)).length, layers: [...new Set(P.filter(inRoof).map((q) => q.layer))], n: P.filter(inRoof).length, hidden: w._vfx.stats.hidden || 0, s: B.camera.worldToScreen(c.x + c.w / 2, c.y + c.h / 2) };
  }, [lbl, n]);
  console.log(JSON.stringify(r));
  const pth = `${TMP}/sp-${lbl}.png`; await pg.screenshot({ path: pth, clip: { x: Math.round(r.s.x - 220), y: Math.round(r.s.y - 330), width: 440, height: 420 } }); shots.push(pth);
}
await b.close(); srv.kill();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...shots.flatMap((s) => ['-i', s]), '-filter_complex', 'hstack=3', path.join(REPO, 'reviews/img/sprekk-bak-container.png')]);
console.log('ok');
