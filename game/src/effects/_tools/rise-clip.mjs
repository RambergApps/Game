// Klipp: Warden bak sandsekker (id 27) og mur/ledge (id 21): reiser seg, treffes oppreist, dukker, beskytes dukket.
// Kilde: ekte coverRise/coverDuck fra player/state.js (27.10) – testsiden emitter ingenting. Teller hendelser vs. effekt-spawns (dobbeltfyring).
// Bruk: node game/src/effects/_tools/rise-clip.mjs  → reviews/img/warden-reiser-seg.mp4/.png (+ _frames/)
import { createRequire } from 'node:module'; import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(REPO, 'package.json')); const { chromium } = require('playwright-core');
const OUT = path.join(REPO, 'reviews/img'), FR = path.join(OUT, '_rise-frames'); fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const port = 8800 + Math.floor(Math.random() * 100), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(900);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('pageerror', (e) => console.log('ERR', String(e))); pg.on('console', (m) => { if (m.type() === 'error' || /vfx/.test(m.text())) console.log('CON', m.text()); });
await pg.goto(`http://127.0.0.1:${port}/index.html?view=34&dpr=1&zoom=2.25`); await pg.waitForFunction(() => window.BREACH?.world?.player);
await pg.evaluate(() => window.BREACH.startGame?.()); await sleep(1500);
for (let i = 0; i < 12; i++) { const ph = await pg.evaluate(() => window.BREACH.world.modules?.levels?._debug?.(window.BREACH.world)?.phase); if (ph !== 'cutscene') break; await pg.keyboard.press('Escape'); await sleep(600); }
await pg.evaluate(() => document.querySelectorAll('.breach-cutscene').forEach((e) => e.remove()));
const info = await pg.evaluate(async () => {
  const B = window.BREACH, w = B.world; B.loop.stop(); w.paused = false;
  const K = new Set(), P = new Set(); const inp = w.input; inp.down = (c) => K.has(c); inp.pressed = (c) => P.has(c); inp.endFrame = () => P.clear(); inp.sync = () => {};
  window.__K = K; window.__P = P; const p = w.player, m = inp.mouse;
  const C = { ev: 0, duck: 0, exp: 0, cue: 0, expF: 0, hitUp: 0, hitDown: 0, bad: 0 }; window.__C = C;
  const { riseSpawns } = await import('/src/effects/coverpose.js'); window.__rs = riseSpawns;
  w.events.on('coverRise', (q) => { if (q.entity === p) { C.ev++; if (!p.exposed) C.bad++; } });
  w.events.on('coverDuck', (q) => { if (q.entity === p) C.duck++; });
  w.events.on('hit', (h) => { if (h.target === p && h.amount > 0 && !h.blocked) p.exposed ? C.hitUp++ : C.hitDown++; });
  const { spawnProjectile } = await import('/src/core/combat.js');
  window.__go = (id) => { const c = w.cover.find((c) => c.id === id); window.__c = c; P.clear(); K.clear(); m.right = false; if (p.inCover) { P.add('KeyE'); window.__step(10); } p.x = c.x + c.w / 2; p.y = c.y + c.h + 16; p.vx = p.vy = 0; P.add('KeyE'); window.__step(40); return { id, kind: c.kind, inCover: p.inCover, po: p.posture }; };
  window.__shoot = (n) => { const c = window.__c; for (let i = 0; i < n; i++) spawnProjectile(w, { x: p.x + (Math.random() - .5) * 30, y: c.y - 260, angle: Math.PI / 2 + (Math.random() - .5) * 0.04, speed: 900, dmg: 6, team: 'enemy', owner: null, z: 30 }); };
  window.__aim = (on) => { m.right = on; };
  window.__step = (n) => { for (let i = 0; i < n; i++) { for (const e of w.enemies) e.hp = 0, e.dead = true; p.hp = Math.max(p.hp, 60); const c = window.__c; if (c) { m.worldX = p.x; m.worldY = c.y - 200; } B.camera.zoom = B.PROJ.zoom; B.camera.x = p.x; B.camera.y = p.y - 20; B.loop.advance(1); if (p.exposed) C.expF++; } };
  return { a: window.__go(27), zoom: B.camera.zoom };
});
console.log(JSON.stringify(info));
const plan = []; const at = (s, f) => plan.push([Math.round(s * 60), f]);
const seg = (o) => { at(o + 0.3, 'aim1'); at(o + 0.9, 'shoot3'); at(o + 1.3, 'shoot3'); at(o + 2.2, 'aim0'); at(o + 2.9, 'shoot3'); };
seg(0); at(3.6, 'go21'); seg(3.7); at(7.2, 'aim1'); at(8.0, 'aim0');
const N = Math.round(8.6 * 60); let f = 0, log = [], msl = [], keep = {};
for (let s = 0; s < N; s += 2) {
  for (const [t, a] of plan) if (t >= s && t < s + 2) console.log(a, JSON.stringify(await pg.evaluate((a) => { if (a.startsWith('aim')) window.__aim(a === 'aim1'); else if (a.startsWith('go')) return window.__go(+a.slice(2)); else window.__shoot(+a.slice(5)); }, a)));
  const st = await pg.evaluate(() => { window.__step(2); const w = window.BREACH.world, p = w.player; const S = w._vfx?.stats || {}; return { po: p.posture, ex: p.exposed, hp: Math.round(p.hp), n: w._vfx?.pose?.n ?? null, sp: window.__rs(), ms: (S.underMs || 0) + (S.overMs || 0), um: S.updMs, live: w._vfx?.pool?.live }; });
  msl.push([st.ex ? 'up' : 'down', st.ms, st.um, st.live]); if (s % 30 === 0) log.push(`${(s / 60).toFixed(1)} ${st.po} exp${st.ex} hp${st.hp} handled${st.n} spawns${st.sp}`);
  await pg.screenshot({ path: path.join(FR, String(f++).padStart(4, '0') + '.png') });
}
console.log('COUNT', JSON.stringify(await pg.evaluate(() => ({ ...window.__C, handled: window.BREACH.world._vfx.pose.n, spawns: window.__rs() }))));
console.log(log.join('\n')); const avg = (k) => { const a = msl.filter((m) => m[0] === k); return a.length ? [a.reduce((t, m) => t + (m[1] || 0), 0) / a.length, a.reduce((t, m) => t + (m[2] || 0), 0) / a.length, a.reduce((t, m) => t + (m[3] || 0), 0) / a.length].map((v) => v.toFixed(3)) : null; }; console.log('MS draw/upd/live popUp', avg('up'), 'down', avg('down'));
await b.close(); srv.kill();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(FR, '%04d.png'), '-vf', 'crop=880:500:220:110,scale=1408:800:flags=lanczos', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '20', path.join(OUT, 'warden-reiser-seg.mp4')]);
console.log('ok', f);
