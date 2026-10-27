// Fragment-jakt: Husk/grunt nord for containeren 37,19 (y 18,55 ruter), passene slås av ett om gangen. → /workspace/vfxr/fr-*.png
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(REPO, 'package.json')); const { chromium } = require('playwright-core');
const port = 8500 + Math.floor(Math.random() * 90), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), TMP = '/workspace/vfxr';
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(900);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); pg.on('pageerror', (e) => console.log('ERR', String(e)));
await pg.addInitScript((r) => { globalThis.__R = r[0]; globalThis.__CR = r[1]; globalThis.__T = r[2]; }, [Number(process.env.R || 0), !!process.env.CR, process.env.T || '']);
if (process.env.NEWD) { const fs = await import('node:fs'); const body = fs.readFileSync(process.env.NEWD, 'utf8'); await pg.route('**/src/shared/depth.js*', (r) => r.fulfill({ contentType: 'text/javascript', body })); }
await pg.goto(`http://127.0.0.1:${port}/index.html?view=34&dpr=1&zoom=2.25`); await pg.waitForFunction(() => window.BREACH?.world?.player);
await pg.evaluate(() => window.BREACH.startGame?.()); await sleep(1500);
for (let i = 0; i < 12; i++) { const ph = await pg.evaluate(() => window.BREACH.world.modules?.levels?._debug?.(window.BREACH.world)?.phase); if (ph !== 'cutscene') break; await pg.keyboard.press('Escape'); await sleep(600); }
const s = await pg.evaluate(() => { const B = window.BREACH, w = B.world; B.loop.stop();
  const c = w.cover.find((c) => c.kind === 'container' && c.x === 1184); window.__c = c;
  let k = 0; while (w.enemies.filter((e) => !e.dead).length < 1 && k++ < 1200) B.loop.advance(1);
  const X0 = c.x + 32, Y0 = 18.55 * 32, e = globalThis.__T ? w.modules.enemies.createEnemy(w, globalThis.__T, X0, Y0) : w.enemies.find((e) => !e.dead), X = c.x + 32, Y = 18.55 * 32; window.__e = e; if (globalThis.__R) e.r = globalThis.__R; if (globalThis.__CR) Object.defineProperty(e, 'crouch', { get: () => true, set: () => {}, configurable: true });
  for (const [q, v] of [['x', X], ['y', Y]]) Object.defineProperty(e, q, { get: () => v, set: () => {}, configurable: true });
  for (const o of w.enemies) if (o !== e) o.hp = 0, o.dead = true;
  window.__step = (n) => { const p = w.player; for (let i = 0; i < n; i++) { p.x = c.x - 60; p.y = c.y + c.h + 30; p.hp = 100; e.hp = Math.max(e.hp, 50); B.camera.zoom = B.PROJ.zoom; B.camera.x = c.x + c.w / 2; B.camera.y = c.y + c.h / 2; B.loop.advance(1); } };
  window.__step(30);
  return { r0: e.r, elev: c.elev, s: B.camera.worldToScreen(X, Y), type: e.type, types: Object.keys(w.modules.enemies.ENEMY_TYPES), keys: Object.keys(w.modules), em: Object.keys(w.modules.enemies) };
});
console.log(JSON.stringify(s));
const shot = async (n) => pg.screenshot({ path: `${TMP}/fr-${n}.png`, clip: { x: Math.round(s.s.x - 80), y: Math.round(s.s.y - 100), width: 160, height: 160 } });
await shot('0-alt');
const tog = { 'decal-hook': `w.arena.onCoverDraw = null; w.cover.forEach((c) => { c.hotDecals = 0; c.pendDecals = 0; })`, 'enemies-draw': `w.modules.enemies.draw = () => {}`, 'vfx-av': `w._vfx.pool.P.forEach((p) => p.on = false); w._vfx.pool.E.forEach((p) => p.on = false); window.__vfxOff = true`, 'fiende-borte': `Object.defineProperty(window.__e, 'x', { get: () => -999, set: () => {}, configurable: true })` };
for (const [n, code] of Object.entries(tog)) { await pg.evaluate((code) => { const w = window.BREACH.world; eval(code); window.__step(1); if (window.__vfxOff) w._vfx.pool.P.forEach((p) => p.on = false); }, code); await pg.evaluate(() => { const w = window.BREACH.world; if (window.__vfxOff) { w._vfx.pool.P.forEach((p) => p.on = false); } window.BREACH.loop.advance(0); }); await shot(n); }
await b.close(); srv.kill(); console.log('ok');
