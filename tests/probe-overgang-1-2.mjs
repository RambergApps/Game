// Probe: overgang bølge 1-2 → kortvalg → 1-3 i headed Chromium. Holder en tast ned når kortene kommer, slipper mens de vises, velger kort, logger input/posisjon/fart 3 s.
// Bruk: DISPLAY=:21 node tests/probe-overgang-1-2.mjs [--headed] [--size 1280x720] [--root game] [--keys KeyS,KeyA,KeyD,KeyW,none] [--pick mouse,key] [--extra resize,blur]
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import net from 'node:net'; import http from 'node:http';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = { root: path.join(REPO, 'game'), headed: false, sizes: ['1280x720'], keys: ['KeyS', 'KeyA', 'KeyD', 'KeyW', 'none'], picks: ['mouse', 'key'], extra: [], tag: 'game', out: path.join(REPO, 'shots/test/overgang-1-2') };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i], v = process.argv[i + 1];
  if (k === '--headed') A.headed = true; else if (k === '--size') { A.sizes = v.split(','); i++; } else if (k === '--root') { A.root = path.resolve(v); i++; } else if (k === '--tag') { A.tag = v; i++; }
  else if (k === '--keys') { A.keys = v.split(','); i++; } else if (k === '--pick') { A.picks = v.split(','); i++; } else if (k === '--extra') { A.extra = v.split(','); i++; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const port = await freePort();
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: A.root, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { if (await new Promise((r) => http.get(`http://127.0.0.1:${port}/`, (x) => { x.resume(); r(true); }).on('error', () => r(false)))) break; await sleep(100); }
const results = [];
const STATE = () => { const B = window.BREACH, w = B.world, p = w.player, d = w.modules.levels._debug(w), I = B.input, c = document.getElementById('game') || document.querySelector('canvas');
  return { t: +w.time.toFixed(2), paused: !!w.paused, phase: d.phase, wave: d.wave?.id || w.level?.waveId, cards: !!d.cards, cardsPicked: d.cards?.picked ?? null,
    x: +p.x.toFixed(1), y: +p.y.toFixed(1), vx: +p.vx.toFixed(1), vy: +p.vy.toFixed(1), state: p.state, bounds: w.bounds,
    down: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'].filter((k) => I.down(k)), cam: { x: +B.camera.x.toFixed(0), y: +B.camera.y.toFixed(0), zoom: B.camera.zoom },
    canvas: [c.width, c.height], win: [innerWidth, innerHeight], focus: document.hasFocus() }; };
async function run(browser, size, key, pick, extra) {
  const [W, H] = size.split('x').map(Number), name = `${A.tag}-${size}-${key}-${pick}${extra ? '-' + extra : ''}`;
  const ctx = await browser.newContext({ viewport: { width: W, height: H } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const ev = [];
  await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => window.BREACH?.world?.modules?.levels); await sleep(800);
  await page.evaluate(() => { const w = window.BREACH.world; window.__ev = []; w.events.on('*', ({ type, payload }) => { if (!/footstep|shot|weaponFire|bulletImpact|coverHit|projectileHit|hit|playerHealth|spawnWarn|spawnRise|telegraph/.test(type)) window.__ev.push([+w.time.toFixed(2), type, payload?.id || payload?.to || '']); }); window.BREACH.startGame(); });
  await sleep(1500); for (let i = 0; i < 10; i++) { if (await page.evaluate(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase !== 'cutscene')) break; await page.keyboard.press('Escape'); await sleep(500); }
  await page.evaluate(() => { if (window.BREACH.world.paused) console.info('probe: paused etter sekvens'); });
  // hopp til bølge 1-2 og drep fiendene raskt (testhjelp; endrer ikke kode)
  await page.evaluate(async () => { const w = window.BREACH.world; w.modules.levels._debugWave(w, 1, 0.5); });
  const C = await import('node:url'); // noop
  let st; const t0 = Date.now();
  // hold tasten ned før bølgen er ferdig
  while (Date.now() - t0 < 40000) {
    st = await page.evaluate(async () => { const w = window.BREACH.world, cb = await import('/src/core/combat.js'); for (const e of w.enemies) if (!e.dead) cb.damage(e, 9999, w.player, w); return window.BREACH.world.modules.levels._debug(w).phase; });
    if (st === 'between') break; await sleep(250);
  }
  if (key !== 'none') await page.keyboard.down(key);
  await page.waitForFunction(() => !!window.BREACH.world.modules.levels._debug(window.BREACH.world).cards, null, { timeout: 8000 }).catch(() => {});
  const before = await page.evaluate(STATE); await page.screenshot({ path: path.join(A.out, `${name}-1-kort-opp.png`) });
  await sleep(700);
  if (key !== 'none') await page.keyboard.up(key);
  if (extra === 'resize') { await page.setViewportSize({ width: Math.round(W * 0.75), height: Math.round(H * 0.8) }); await sleep(400); }
  if (extra === 'blur') { await page.evaluate(() => { dispatchEvent(new Event('blur')); }); const p2 = await ctx.newPage(); await sleep(300); await p2.close(); await page.bringToFront(); await sleep(200); }
  const during = await page.evaluate(STATE); await page.screenshot({ path: path.join(A.out, `${name}-2-under-valg.png`) });
  if (pick === 'key') await page.keyboard.press('Digit1');
  else { const vp = page.viewportSize(); const r = await page.evaluate(() => { const d = window.BREACH.world.modules.levels._debug(window.BREACH.world), c = document.getElementById('game') || document.querySelector('canvas'), b = c.getBoundingClientRect(), q = d.cards?.rects?.[0]; return q ? { x: b.left + (q.x + q.w / 2) * b.width / c.width, y: b.top + (q.y + q.h / 2) * b.height / c.height } : null; }); if (r) await page.mouse.click(r.x, r.y); else await page.mouse.click(vp.width / 2, vp.height / 2); }
  await page.waitForFunction(() => !window.BREACH.world.modules.levels._debug(window.BREACH.world).cards, null, { timeout: 5000 }).catch(() => {});
  const series = []; for (let i = 0; i < 12; i++) { series.push(await page.evaluate(STATE)); if (i === 5) await page.screenshot({ path: path.join(A.out, `${name}-3-etter-valg.png`) }); await sleep(250); }
  // sjekk om W fungerer
  await page.keyboard.down('KeyW'); await sleep(500); const wTest = await page.evaluate(STATE); await page.keyboard.up('KeyW'); await sleep(200);
  const after = await page.evaluate(STATE);
  const a = series[0], z = series[series.length - 1];
  const r = { name, size, key, pick, extra: extra || null, picked: !before.cards ? 'kort kom ikke' : (series[0].cards ? 'ikke valgt' : 'ok'), before: { down: before.down, paused: before.paused, phase: before.phase }, during: { down: during.down, paused: during.paused },
    after3s: { down: z.down, dx: +(z.x - a.x).toFixed(0), dy: +(z.y - a.y).toFixed(0), v: [z.vx, z.vy], pos: [z.x, z.y], paused: z.paused, phase: z.phase, wave: z.wave }, wTest: { down: wTest.down, vy: wTest.vy }, afterW: { down: after.down }, bounds: z.bounds, canvas: z.canvas, win: z.win,
    stuck: z.down.length > 0, events: (await page.evaluate(() => window.__ev.slice(-25))), errs };
  results.push(r); log(name, '| fast tast:', JSON.stringify(z.down), '| Δ3s', r.after3s.dx, r.after3s.dy, '| v', r.after3s.v, '| y', z.y, '/', z.bounds.y + z.bounds.h, '| W-test down', wTest.down, 'vy', wTest.vy, '| paused', z.paused, z.phase, z.wave, errs.length ? 'FEIL ' + errs[0] : '');
  await ctx.close();
}
for (const size of A.sizes) {
  const [W, H] = size.split('x').map(Number);
  const browser = await chromium.launch({ headless: !A.headed, executablePath: '/usr/bin/google-chrome', args: [`--window-size=${W},${H + 90}`, '--autoplay-policy=no-user-gesture-required'] });
  for (const key of A.keys) for (const pick of A.picks) { try { await run(browser, size, key, pick, null); } catch (e) { log('FEIL', size, key, pick, e.message); } }
  for (const ex of A.extra) { try { await run(browser, size, 'KeyS', 'key', ex); } catch (e) { log('FEIL', ex, e.message); } }
  await browser.close();
}
const f = path.join(REPO, `tests/results/overgang-1-2-${A.tag}.json`); fs.writeFileSync(f, JSON.stringify(results, null, 1)); log('FERDIG', f); srv.kill();
