// Test av støvtaket: 6 samtidige coverRise (kontrakthendelser emittes KUN i testsiden) langs lav dekning nær start. → reviews/img/reise-stov-tak.png
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(REPO, 'package.json')); const { chromium } = require('playwright-core');
const port = 8990 + Math.floor(Math.random() * 9), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(900);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('pageerror', (e) => console.log('ERR', String(e)));
await pg.goto(`http://127.0.0.1:${port}/index.html?view=34&dpr=1&zoom=2.25`); await pg.waitForFunction(() => window.BREACH?.world?.player);
await pg.evaluate(() => window.BREACH.startGame?.()); await sleep(1500);
for (let i = 0; i < 12; i++) { const ph = await pg.evaluate(() => window.BREACH.world.modules?.levels?._debug?.(window.BREACH.world)?.phase); if (ph !== 'cutscene') break; await pg.keyboard.press('Escape'); await sleep(600); }
const r = await pg.evaluate(async () => {
  const B = window.BREACH, w = B.world; B.loop.stop(); const { dustStats } = await import('/src/effects/coverpose.js');
  const c0 = w.cover.find((c) => c.type === 'low' && c.x === 224 && c.y === 584) || w.cover.find((c) => c.type === 'low' && c.w > c.h);
  const p = w.player; p.x = c0.x - 80; p.y = c0.y + 60;
  const step = (n) => { for (let i = 0; i < n; i++) { for (const e of w.enemies) e.hp = 0, e.dead = true; B.camera.zoom = 2.25; B.camera.x = c0.x + c0.w / 2; B.camera.y = c0.y + 10; B.loop.advance(1); } };
  step(10); const out = [];
  // 6 reisinger samtidig: 3 langs c0, 3 på naboer (to på samme dekning innen nedkjølingen → skal avvises)
  const near = w.cover.filter((c) => c.type === 'low' && c !== c0 && Math.hypot(c.x - c0.x, c.y - c0.y) < 220).slice(0, 3);
  const list = [[c0, 0.25], [c0, 0.75], ...near.map((c) => [c, 0.5]), [c0, 0.5]];
  const P0 = w._vfx.pool.P.filter((q) => q.on).length;
  for (const [c, u] of list) { w.events.emit('coverRise', { entity: p, x: c.x + c.w * u, y: c.y + c.h + 14, type: 'low', nx: 0, ny: -1, cover: c }); out.push({ id: c.id, ...dustStats() }); }
  step(1); const P1 = w._vfx.pool.P.filter((q) => q.on).length;
  step(5); return { out, added: P1 - P0, near: near.length };
});
console.log(JSON.stringify(r));
await pg.screenshot({ path: path.join(REPO, 'reviews/img/reise-stov-tak.png'), clip: { x: 340, y: 180, width: 600, height: 380 } });
await b.close(); srv.kill(); console.log('ok');
