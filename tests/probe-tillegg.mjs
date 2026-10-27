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
await sleep(300); await shot('t-spawn');
R.spawn = await ev(() => { const w = window.BREACH.world, A = w.arena, ps = A.playerSpawn, p = w.player;
  const c = document.querySelector('canvas'), s = window.BREACH.camera.worldToScreen(ps.x, ps.y), g = c.getContext('2d'); let col = null;
  try { const d = g.getImageData(Math.round(s.x) - 24, Math.round(s.y) + 4, 48, 12).data; let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } col = [r / n | 0, gg / n | 0, b / n | 0]; } catch (e) { col = String(e); }
  return { playerSpawn: ps, playerNow: { x: p.x, y: p.y }, crates: (A.ammoCrates || []).map((k) => ({ id: k.id, x: k.x, y: k.y, tiles: +(Math.hypot(k.x - ps.x, k.y - ps.y) / 32).toFixed(2) })), pixelUnderSpawn: col }; });
// sikte/munning: stopp fiender, skyt mot øst
await ev(() => { const w = window.BREACH.world; w.player.invuln = true; for (const e of w.enemies || []) e.hp = 0; });
await page.mouse.move(W / 2 + 250, H / 2); await page.mouse.down(); await sleep(180); await shot('t-munning-kuler'); await sleep(120); await shot('t-munning-kuler-b'); await page.mouse.up();
R.aim = await ev(() => { const w = window.BREACH.world, p = w.player; return { player: { x: p.x, y: p.y }, aim: p.aimX != null ? { x: p.aimX, y: p.aimY } : null, projs: (w.projectiles || []).slice(0, 4).map((q) => ({ x: q.x | 0, y: q.y | 0, z: q.z })) }; });
// dekning: høy og lav, spiller rett nord for objektet (bak det i 3/4)
const cov = await ev(async () => { const w = window.BREACH.world, A = await import('/src/arena/index.js'), p = w.player; const L = A.coverObjects(w).filter((o) => !o.ammo);
  const d = (o) => Math.hypot(o.x + o.w / 2 - p.x, o.y - p.y); const hi = L.filter((o) => o.type === 'high' && o.w < 200).sort((a, b) => d(a) - d(b))[0], lo = L.filter((o) => o.type === 'low').sort((a, b) => d(a) - d(b))[0];
  return { hi: hi && { x: hi.x, y: hi.y, w: hi.w, h: hi.h, elev: hi.elev, kind: hi.kind || hi.id }, lo: lo && { x: lo.x, y: lo.y, w: lo.w, h: lo.h, elev: lo.elev, kind: lo.kind || lo.id } }; });
R.cover = cov;
for (const [k, o] of [['hoy', cov.hi], ['lav', cov.lo]]) { if (!o) continue;
  await ev((o) => { const p = window.BREACH.world.player; p.x = o.x + o.w / 2; p.y = o.y - 6; p.vx = p.vy = 0; }, o); await sleep(700); await shot(`t-dekning-${k}`); }
// damage direction av
await ev(async () => { const w = window.BREACH.world, p = w.player; p.x = w.arena.playerSpawn.x; p.y = w.arena.playerSpawn.y; });
const hit = () => ev(async () => { const w = window.BREACH.world, p = w.player, cb = await import('/src/core/combat.js'); p.invuln = false; p.hp = p.maxHp; cb.damage(p, 5, { x: p.x + 200, y: p.y, team: 'enemy', owner: { x: p.x + 200, y: p.y, team: 'enemy' } }, w); p.invuln = true; });
await ev(() => { window.__dd = 0; window.BREACH.world.events.on('damageDirection', () => window.__dd++); });
await sleep(400); await hit(); await sleep(120); await shot('t-skaderetning-pa');
await sleep(1500); await ev(async () => (await import('/src/ui/settings.js')).setSetting('damageIndicator', false, { save: false }));
await hit(); await sleep(120); await shot('t-skaderetning-av'); R.ddEvents = await ev(() => window.__dd);
await ev(async () => (await import('/src/ui/settings.js')).setSetting('damageIndicator', true, { save: false }));
// Kiln-skyting i 1-5
await ev(() => { const w = window.BREACH.world; w.modules.levels._debugWave(w, 4, 1); window.__ks = null;
  w.events.on('shot', (q) => { if (q.entity?.type === 'heavy' && !window.__ks) window.__ks = performance.now(); }); });
let got = false;
for (let t = 0; t < 90 && !got; t++) { await sleep(500);
  const k = await ev(() => { const w = window.BREACH.world, p = w.player, e = (w.enemies || []).find((e) => e.type === 'heavy' && !e.dead); if (!e) return null; p.invuln = true; p.hp = p.maxHp;
    if (Math.hypot(e.x - p.x, e.y - p.y) > 260) { p.x = e.x - 200; p.y = e.y; } return { x: e.x | 0, y: e.y | 0, state: e.state, shot: window.__ks ? performance.now() - window.__ks : null }; });
  if (k?.shot != null && k.shot < 600) { await shot('t-kiln-skyter'); await sleep(150); await shot('t-kiln-skyter-b'); got = true; R.kiln = k; } }
R.kilnSeen = got; R.errors = errs;
} catch (e) { R.fatal = String(e); }
fs.writeFileSync(path.join(REPO, 'tests/results/full-2026-10-26/tillegg/probe-tillegg.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1)); await browser.close(); srv.kill();
