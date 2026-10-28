// Fiende-AI 28.10: defensiv bot, Kessa Yard 1-4 + 1-5. Bruk: SEED=n OUT=dir node rig.mjs
import { createRequire } from 'module'; import { spawn } from 'child_process'; import http from 'http'; import net from 'net'; import fs from 'fs'; import os from 'os'; import path from 'path';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const root = process.env.ROOT || '/workspace/breach/game'; const SEED = +(process.env.SEED || 1); const OUT = process.env.OUT || '/tmp/fa28/out'; const MAXS = +(process.env.MAXS || 300);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
function findChrome() { const base = path.join(os.homedir(), '.cache/ms-playwright'); for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium-')).sort().reverse()) { const p = path.join(base, d, 'chrome-linux64/chrome'); if (fs.existsSync(p)) return p; } }
const port = await freePort(); const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { const ok = await new Promise((r) => http.get(`http://127.0.0.1:${port}/`, (res) => { res.resume(); r(true); }).on('error', () => r(false))); if (ok) break; await sleep(100); }
const browser = await chromium.launch({ headless: true, executablePath: findChrome(), args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript((seed) => { let a = seed * 2654435761 >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, SEED);
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html?wi=${process.env.WI || 3}`); await page.waitForFunction(() => window.BREACH?.world); await sleep(800);
await page.evaluate(() => window.BREACH.startGame()); await sleep(500); await page.mouse.click(640, 360);
const L = () => page.evaluate(() => { const w = window.BREACH.world, d = w.modules.levels._debug?.(w); return { phase: d?.phase, t: w.time, wave: d?.waveId }; });
for (let i = 0; i < 120; i++) { const s = await L(); if (s.phase === "cutscene" || s.phase === "idle" || s.phase === "menu") await page.keyboard.press("Escape"); if (s.phase === 'wave' || s.phase === 'break') break; await sleep(250); }
await page.evaluate(async (seed) => { const w = window.BREACH.world; const m = await import('/src/core/world.js'); if (m.createRng) w.rng = m.createRng(seed); w.modules.levels._debugWave(w, +(new URLSearchParams(location.search).get("wi") || 3), 1); }, SEED);
// bot + måling i siden
await page.evaluate(() => {
  const B = window.BREACH, w = B.world, inp = B.input, cam = B.camera;
  const M = window.__M = { samples: [], stuck: [], stuckIds: new Set(), dmg: 0, dmgByWave: {}, waves: [], states: {}, maxCluster: 0, clusterShot: null, deaths: 0 };
  let cur = null;
  w.events.on('waveStart', (p) => { cur = { id: p.id, t0: w.time }; M.waves.push(cur); });
  w.events.on('waveEnd', (p) => { const x = M.waves.find((v) => v.id === p.id && v.t1 == null); if (x) { x.t1 = w.time; x.dur = +(w.time - x.t0).toFixed(1); } });
  w.events.on('hit', (e) => { if (e.target === w.player && e.amount > 0) { M.dmg += e.amount; if (cur) M.dmgByWave[cur.id] = (M.dmgByWave[cur.id] || 0) + e.amount; } });
  w.events.on('death', (e) => { if (e.target === w.player) M.deaths++; });
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  const hist = new Map(); const MOVE = new Set(['hunt', 'seekCover', 'returnCover', 'flank', 'advance', 'reposition', 'charge', 'approach', 'chase']);
  let home = null, lastE = 0;
  setInterval(() => {
    const p = w.player; if (!p) return; const d = w.modules.levels._debug?.(w); if (d?.phase !== 'wave') { inp.mouse.left = false; return; }
    if (p.hp < 35) p.hp = 35;            // assist: overlev (skade telles fortsatt)
    if (!home) home = { x: p.x, y: p.y };
    const en = (w.enemies || []).filter((e) => !e.dead && !e.rising);
    // defensiv: bli i dekning, skyt fra posisjon
    if (!p.inCover && w.time - lastE > 1.5) { key('KeyE', true); setTimeout(() => key('KeyE', false), 60); lastE = w.time; }
    const vis = en.map((e) => ({ e, d: Math.hypot(e.x - p.x, e.y - p.y) })).filter((o) => o.d < 620).sort((a, b) => a.d - b.d)[0];
    if (vis) { const s = cam.worldToScreen(vis.e.x, vis.e.y); const cv = document.querySelector('canvas'); const r = cv.getBoundingClientRect(); inp.mouse.x = s.x; inp.mouse.y = s.y; inp.mouse.left = true; }
    else inp.mouse.left = false;
  }, 50);
  let lastT = -1;
  setInterval(() => {
    if (w.time - lastT < 0.25) return; lastT = w.time; const p = w.player; const d = w.modules.levels._debug?.(w); if (d?.phase !== 'wave') return;
    const en = (w.enemies || []).filter((e) => !e.dead && !e.rising && (e.state !== 'spawnRise'));
    for (const e of en) {
      const st = e.state || '?'; M.states[st] = (M.states[st] || 0) + 1;
      let h = hist.get(e); if (!h) hist.set(e, h = []); h.push([w.time, e.x, e.y, st]); while (h.length && h[0][0] < w.time - 4) h.shift();
      if (h.length && w.time - h[0][0] >= 3.9) { let mx = 0; for (const q of h) mx = Math.max(mx, Math.hypot(q[1] - e.x, q[2] - e.y));
        const wants = h.every((q) => MOVE.has(q[3])) && !h.some((q) => q[3] === 'inCover');
        if (mx < 8 && wants) { const id = e.id ?? e; if (!M.stuckIds.has(id)) { M.stuckIds.add(id); M.stuck.push({ t: +w.time.toFixed(1), wave: cur?.id, type: e.type, state: st, x: Math.round(e.x), y: Math.round(e.y), tx: Math.round(e.navTarget?.x ?? e.target?.x ?? e.goal?.x ?? -1), ty: Math.round(e.navTarget?.y ?? e.target?.y ?? e.goal?.y ?? -1), spot: e.spot ? { x: Math.round(e.spot.x), y: Math.round(e.spot.y) } : null }); } }
      }
    }
    if (en.length >= 2) {
      let nn = 0, mc = 1;
      for (const a of en) { let b = 1e9, c = 0; for (const o of en) { if (o === a) continue; const dd = Math.hypot(o.x - a.x, o.y - a.y); b = Math.min(b, dd); if (dd < 64) c++; } nn += b; mc = Math.max(mc, c + 1); }
      let sx = 0, sy = 0; const sec = new Set(); for (const e of en) { const an = Math.atan2(e.y - p.y, e.x - p.x); sx += Math.cos(an); sy += Math.sin(an); sec.add(Math.floor(((an + Math.PI) / (2 * Math.PI)) * 8) % 8); }
      const R = Math.hypot(sx, sy) / en.length;
      M.samples.push({ t: +w.time.toFixed(2), wave: cur?.id, n: en.length, nn: nn / en.length, mc, R, sec: sec.size });
      if (mc > M.maxCluster) { M.maxCluster = mc; M.clusterAt = w.time; }
    }
  }, 30);
});
if (process.env.DBG) { for (let i = 0; i < 12; i++) { await sleep(1000); console.log(JSON.stringify(await page.evaluate(() => { const w = window.BREACH.world, d = w.modules.levels._debug?.(w); return { ph: d?.phase, wave: d?.waveId, n: (w.enemies||[]).length, t: w.time, ws: window.__M.waves, pin: !!w.player?.inCover, hp: w.player?.hp }; }))); } }
const t0 = Date.now(); let shotTaken = false, endReason = 'timeout';
while (Date.now() - t0 < MAXS * 1000) {
  await sleep(1000);
  const s = await page.evaluate(() => { const w = window.BREACH.world, d = w.modules.levels._debug?.(w), M = window.__M; return { phase: d?.phase, wave: d?.waveId, waves: M.waves, mc: M.maxCluster, last: M.samples[M.samples.length - 1] }; });
  if (s.phase === 'cutscene' || s.phase === 'cards') await page.keyboard.press('Escape');
  if (s.phase === 'cards') await page.keyboard.press('Digit1');
  if (!shotTaken && s.last && s.last.mc >= 3) { await page.screenshot({ path: `${OUT}/shot-s${SEED}.png` }); shotTaken = true; }
  const w5 = s.waves.find((v) => v.id === '1-5'); if (w5 && w5.t1 != null) { endReason = 'done'; break; }
}
const M = await page.evaluate(() => { const M = window.__M, w = window.BREACH.world; M.final = (w.enemies||[]).filter(e=>!e.dead).map(e=>({type:e.type,state:e.state,x:Math.round(e.x),y:Math.round(e.y),spot:e.spot?{x:Math.round(e.spot.x),y:Math.round(e.spot.y)}:null,d:Math.round(Math.hypot(e.x-w.player.x,e.y-w.player.y))})); M.player={x:Math.round(w.player.x),y:Math.round(w.player.y)}; return { ...M, stuckIds: undefined }; });
await page.screenshot({ path: `${OUT}/end-s${SEED}.png` });
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const S = M.samples; const sum = { seed: SEED, endReason, waves: M.waves.map((v) => ({ id: v.id, dur: v.dur })), dmg: Math.round(M.dmg), dmgByWave: M.dmgByWave, deaths: M.deaths,
  stuck: M.stuck.length, stuckList: M.stuck, nn: +avg(S.map((s) => s.nn)).toFixed(1), mcMax: Math.max(...S.map((s) => s.mc)), mcAvg: +avg(S.map((s) => s.mc)).toFixed(2), within64share: +(S.filter((s) => s.mc >= 3).length / S.length).toFixed(3), R: +avg(S.map((s) => s.R)).toFixed(3), sectors: +avg(S.map((s) => s.sec)).toFixed(2), final: M.final, player: M.player, states: M.states, errors: errs.slice(0, 10) };
fs.writeFileSync(`${OUT}/res-s${SEED}.json`, JSON.stringify(sum, null, 1));
console.log(JSON.stringify({ ...sum, stuckList: sum.stuckList.slice(0, 6), states: undefined }));
await browser.close(); srv.kill();
