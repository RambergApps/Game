// Breach testrigg – spillbot v5 (skråvinkel view=34 som standard): automatisert gjennomspilling av brett 1 (+ bevisst død/omstart på brett 2, + Kiln/Spitter-innslag).
// v5: sikter på brysthøyde i 34 (spillet legger selv +20,25 worldY på musa via PROJ.aimGround → boten peker musa på skjermpunktet
//     worldToScreen(x, y − 20,25), dvs. fiendens bryst; ingen dobbeltkompensering), nye navn (displayName), passivitetsjakt (6 s),
//     per-bølge-logg (tid, dødsfall, ammo ved respawn, passivitet, skaderetning fra 'hit'-events). v4 ligger i spill-brett1-v4.mjs.
// Bruk: node tests/spill-brett1.mjs [--view 34|top] [--until 1-3] [--max-min 16] [--passive-sec 6] [--out DIR] [--results DIR] [--no-extra] [--root game]
// Styrer spillet med ekte tastatur/mus (Playwright) ut fra tilstand lest fra window.BREACH. Endrer ikke spillkode.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net'; import http from 'node:http';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..');
const A = { root: path.join(REPO, 'game'), out: path.join(REPO, 'shots/test/spillbot-v5'), results: path.join(REPO, 'tests/results/spillbot-v5'), maxMin: 16, extra: true, view: '34', until: null, passiveSec: 6, headed: false, size: '1280x720', menu: false, perf: false, die: [], stopAtLevelEnd: false };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i], v = process.argv[i + 1];
  if (k === '--root') { A.root = path.resolve(v); i++; } else if (k === '--out') { A.out = path.resolve(v); i++; } else if (k === '--results') { A.results = path.resolve(v); i++; }
  else if (k === '--max-min') { A.maxMin = +v; i++; } else if (k === '--no-extra') A.extra = false;
  else if (k === '--view') { A.view = v; i++; } else if (k === '--until') { A.until = v; i++; } else if (k === '--passive-sec') { A.passiveSec = +v; i++; }
  else if (k === '--headed') A.headed = true; else if (k === '--size') { A.size = v; i++; } else if (k === '--menu') A.menu = true; else if (k === '--perf') A.perf = true;
  else if (k === '--die') { A.die = v.split(','); i++; } else if (k === '--level1') A.stopAtLevelEnd = true; else if (k === '--jump') { A.jump = +v; i++; } }
const [VW, VH] = A.size.split('x').map(Number);
fs.mkdirSync(A.out, { recursive: true }); fs.mkdirSync(A.results, { recursive: true });
const T0 = Date.now(); const clock = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6);
const log = (...a) => console.log(`[${clock()}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
function findChrome() { const base = path.join(os.homedir(), '.cache/ms-playwright'); for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium-')).sort().reverse()) { const p = path.join(base, d, 'chrome-linux64/chrome'); if (fs.existsSync(p)) return p; } for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium']) if (fs.existsSync(p)) return p; return undefined; }

// ---------------------------------------------------------------- side-hjelper (kjøres i siden)
async function installBot() {
  const geom = await import('/src/core/geom.js');
  let UPG = []; try { UPG = (await import('/src/levels/upgrades.js')).UPGRADES || []; } catch {}
  const B = window.BREACH, w = B.world, cam = B.camera;
  const L = () => w.modules.levels, W = () => w.modules.weapons;
  const R = window.__run = { counts: {}, timeline: [], ttk: [], firstHit: new Map(), spawnT: new Map(), shakes: 0, shakeMax: 0, shakeSum: 0,
    playerDmg: [], waves: [], offers: [], frames: [], maxAlive: 0, aliveHist: {}, enemyShots: 0, playerShots: 0, playerHitsOnEnemy: 0, coverHits: 0 };
  const keep = new Set(['cutsceneStart', 'cutsceneEnd', 'menuStart', 'menuClose', 'menuOpen', 'tutorialHint', 'tutorialStep', 'checkpoint', 'damageDir', 'hurtDir', 'playerRespawn', 'restart', 'bossStart', 'bossEnd', 'waveStart', 'waveEnd', 'levelStart', 'levelEnd', 'death', 'upgrade', 'refill', 'melee', 'roll', 'coverEnter', 'coverExit', 'grenade', 'explosion', 'flank', 'telegraph', 'reload', 'activeReload', 'enemyStagger', 'dryFire', 'weaponSwitch', 'gameComplete', 'playerState', 'suppress', 'spinup', 'grenadeWindup']);
  w.events.on('*', ({ type, payload: p }) => {
    R.counts[type] = (R.counts[type] || 0) + 1;
    const team = p?.team ?? p?.entity?.team ?? p?.target?.team;
    if (type === 'shot') { if (p.team === 'player') R.playerShots++; else R.enemyShots++; }
    if (type === 'hit' && p.target) {
      if (p.target.team === 'enemy') { R.playerHitsOnEnemy++; if (!R.firstHit.has(p.target.id)) R.firstHit.set(p.target.id, w.time); }
      if (p.target === w.player) { const src = p.source?.owner || p.source?.shooter || p.source; const sx0 = src?.x ?? p.source?.x0, sy0 = src?.y ?? p.source?.y0;
        const ang = Number.isFinite(sx0) ? Math.round(Math.atan2(sy0 - w.player.y, sx0 - w.player.x) * 180 / Math.PI) : null;
        R.playerDmg.push([+w.time.toFixed(2), +(p.amount || 0).toFixed(1), p.source?.weapon || p.source?.kind || p.source?.type || null, !!p.blocked, ang, src?.displayName || src?.type || null]); }
    }
    if (type === 'coverHit') R.coverHits++;
    if (type === 'damageDirection') (R.dmgDir = R.dmgDir || []).push([+w.time.toFixed(2), Math.round(p.angle * 180 / Math.PI), +(p.amount || 0).toFixed(1), Math.round(p.sourceX), Math.round(p.sourceY), p.source?.owner?.displayName || p.source?.kind || p.source?.type || null]);
    if (type === 'waveStart') R.curWave = p.id;
    if (/grenade|lob|throw/i.test(type) && p?.team !== 'player') R.lastGren = performance.now();
    if (type === 'shot' && p?.entity?.type === 'heavy') R.lastKiln = performance.now();
    if (type === 'shot' && p?.entity?.type === 'heavy') { const D = window.__demo; if (D && !D.kShot[p.entity.id]) D.kShot[p.entity.id] = w.time; }
    if (type === 'death' && p.target?.team === 'enemy') {
      const e = p.target, f = R.firstHit.get(e.id);
      R.ttk.push({ id: e.id, type: e.type, planned: e.plannedType || null, ttk: f != null ? +(w.time - f).toFixed(2) : null, life: R.spawnT.has(e.id) ? +(w.time - R.spawnT.get(e.id)).toFixed(2) : null, by: p.source?.weapon || p.source?.kind || null });
    }
    if (type === 'death' && p.target === w.player) R.timeline.push([+w.time.toFixed(2), 'playerDeath', { wave: w.level?.wave, level: w.level?.n }]);
    if (type === 'waveStart') R.waves.push({ level: p.level, wave: p.wave, id: p.id, name: p.name, t0: w.time, wall0: performance.now() / 1000 });
    if (type === 'waveEnd') { const x = [...R.waves].reverse().find((v) => v.id === p.id && v.t1 == null); if (x) { x.t1 = w.time; x.dur = +(w.time - x.t0).toFixed(1); } }
    if (keep.has(type)) {
      const s = {}; for (const k of ['level', 'wave', 'id', 'name', 'phase', 'result', 'weapon', 'team', 'crateId']) if (p && p[k] != null && typeof p[k] !== 'object') s[k] = p[k];
      if (type === 'melee' && p.targets) s.targets = p.targets.length;
      if (type === 'death') s.target = p.target?.team === 'enemy' ? p.target.type : 'player';
      if (type === 'playerState' && p) s.state = p.state || p.to || p.name;
      if (type === 'coverEnter' || type === 'coverExit') s.who = p.entity === w.player ? 'player' : 'enemy', s.cover = p.cover?.type;
      R.timeline.push([+w.time.toFixed(2), type, s]);
    }
  });
  const shake0 = cam.shake.bind(cam);
  cam.shake = (a, d) => { R.shakes++; R.shakeMax = Math.max(R.shakeMax, a); R.shakeSum += a; return shake0(a, d); };
  // rammetider for hele gjennomspillingen
  let last = performance.now();
  const hist = R.frameHist = { n: 0, sum: 0, over20: 0, over33: 0, over50: 0, max: 0 };
  R.fw = {}; R.heap = {}; const tick = (t) => { const d = t - last; last = t; if (d < 1000) { const wk = R.curWave || 'pre'; (R.fw[wk] = R.fw[wk] || []).push(+d.toFixed(2)); if (performance.memory && hist.n % 120 === 0) { const h = R.heap[wk] = R.heap[wk] || { min: 1e12, max: 0 }; const u = performance.memory.usedJSHeapSize; h.min = Math.min(h.min, u); h.max = Math.max(h.max, u); } hist.n++; hist.sum += d; if (d > 20) hist.over20++; if (d > 33.4) hist.over33++; if (d > 50) hist.over50++; hist.max = Math.max(hist.max, d); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const free = (x0, y0, x1, y1, pad = 15) => {
    const b = w.bounds; if (x1 < b.x + pad || y1 < b.y + pad || x1 > b.x + b.w - pad || y1 > b.y + b.h - pad) return false;
    return !geom.raycastCover(w, x0, y0, x1, y1, { types: ['high', 'low'], pad });
  };
  window.__bot = {
    snap() {
      const p = w.player, d = L()._debug ? L()._debug(w) : null, P = w.modules.player._debug ? w.modules.player._debug() : null;
      const cur = p && W().current ? W().current(p) : null;
      const alive = w.enemies.filter((e) => !e.dead);
      for (const e of alive) if (!R.spawnT.has(e.id)) R.spawnT.set(e.id, w.time);
      R.maxAlive = Math.max(R.maxAlive, alive.length); R.aliveHist[alive.length] = (R.aliveHist[alive.length] || 0) + 1;
      const is34 = w.view === '34', AY = is34 ? 27 * (window.BREACH?.PROJ?.zScale ?? 0.75) : 0;   // 27·PROJ.zScale (reserve 0.75) – spillet legger selv +AY på musa i 34
      const aimS = (x, y) => cam.worldToScreen(x, y - AY);       // skjermpunkt for brysthøyde → spillet tolker det som bakkepunkt (x,y)
      const ps = p ? cam.worldToScreen(p.x, p.y) : null;
      const cs = document.querySelector('.breach-cutscene');
      return {
        view: w.view || 'top', t: +w.time.toFixed(2), paused: !!w.paused, start: !!document.getElementById('start-screen'), cutscene: !!(cs && cs.isConnected && getComputedStyle(cs).display !== 'none'),
        phase: d?.phase, n: d?.n, wave: w.level?.wave, waveId: w.level?.waveId, banner: d?.banner ? `${d.banner.kicker} ${d.banner.title}` : null, remaining: d?.remaining,
        hold: d?.hold ? { t: d.hold.t, need: d.hold.need, inZone: d.hold.inZone } : null, zone: d?.zone || null,
        cards: d?.cards ? d.cards.offer.map((o) => { const u = typeof o === 'string' ? (UPG.find((x) => x.id === o) || { id: o }) : o; return { id: u.id, name: u.name, role: u.role, rarity: u.rarity, text: u.text || u.desc }; }) : null,
        p: p ? { x: p.x, y: p.y, hp: +p.hp.toFixed(1), maxHp: p.maxHp, dead: !!p.dead, r: p.r, state: P?.st?.name || p.state, sub: P?.cov?.sub || null, coverType: P?.cov?.line?.type || null, invuln: !!p.invuln, sx: ps.x, sy: ps.y } : null,
        wpn: cur ? { id: cur.id, mag: cur.mag, magSize: cur.magSize, reserve: cur.reserve, reloading: cur.reloading, recoil: cur.recoil, slots: cur.slots, grenades: cur.grenades } : null,
        enemies: alive.map((e) => { const s = aimS(e.x, e.y); return { id: e.id, type: e.type, name: e.displayName || e.type, planned: e.plannedType || null, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, r: e.r, state: e.state, d: p ? Math.hypot(e.x - p.x, e.y - p.y) : 0, los: p ? geom.lineOfSight(w, p.x, p.y, e.x, e.y) : false, sx: s.x, sy: s.y, aimGround: { x: e.x, y: e.y } }; }),
        crates: (w.arena?.ammoCrates || []).map((c) => ({ x: c.x, y: c.y, ready: c.ready !== false })),
        fps: B.loop.stats.fps, gren: R.lastGren ? performance.now() - R.lastGren : 1e9, kiln: R.lastKiln ? performance.now() - R.lastKiln : 1e9, zoom: cam.zoom, shakeX: cam.shakeX || 0, projectiles: w.projectiles.length, effects: w.effects.length, arena: w.arena?.id,
      };
    },
    toScreen(x, y) { return cam.worldToScreen(x, y); },
    aimCheck() { const m = B.input?.mouse || w.input?.mouse, p = w.player; return m && p ? { mouseWorld: { x: m.worldX, y: m.worldY }, aimPoint: p.aimPoint || null, view: w.view } : null; },
    // retning mot (tx,ty) som ikke går rett inn i dekning (prøver vifte av vinkler)
    steer(tx, ty) {
      const p = w.player; if (!p) return null; const a0 = Math.atan2(ty - p.y, tx - p.x);
      for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.2, -2.2, 2.7, -2.7, Math.PI]) {
        const a = a0 + off; if (free(p.x, p.y, p.x + Math.cos(a) * 46, p.y + Math.sin(a) * 46)) return { a, off };
      }
      return null;
    },
    // dekningsplass: lav (eller høy) dekning mellom spilleren og trusselen (tx,ty)
    coverSpot(tx, ty, maxD = 520) {
      const p = w.player; let best = null;
      for (const c of w.cover) {
        const cx = c.x + c.w / 2, cy = c.y + c.h / 2; const dP = Math.hypot(cx - p.x, cy - p.y); if (dP > maxD) continue;
        const dT = Math.hypot(cx - tx, cy - ty); if (dT < 140) continue;
        // stå på motsatt side av trusselen: punkt like utenfor rektangelet langs retningen trussel→senter
        const ax = cx - tx, ay = cy - ty, al = Math.hypot(ax, ay) || 1, ux = ax / al, uy = ay / al;
        const ext = Math.abs(ux) * c.w / 2 + Math.abs(uy) * c.h / 2;
        const sx = cx + ux * (ext + 22), sy = cy + uy * (ext + 22);
        if (!free(sx, sy, sx + 1, sy + 1, 14)) continue;
        const score = dP + (c.type === 'low' ? 0 : 90) + Math.max(0, 260 - dT) * 0.8;
        if (!best || score < best.score) best = { x: sx, y: sy, cx, cy, type: c.type, score, id: c.id };
      }
      return best;
    },
    spawnExtra(types) { const p = w.player, out = []; let i = 0; for (const t of types) { try { const e = w.modules.enemies.createEnemy(w, t, p.x + (i++ % 2 ? 260 : -260), p.y - 420); out.push(e && e.type); } catch (err) { out.push('feil: ' + err.message); } } return out; },
    pauseAt() { return w.paused; },
    keysDown() { return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'].filter((k) => B.input.down(k)); },
    async extras() { let cache = null, aud = null; try { cache = (await import('/src/shared/rig/faceted/bake.js')).cacheReport(); } catch (e) { cache = String(e); } try { const a = await import('/src/audio/index.js'); aud = a.getState(); } catch (e) { aud = String(e); }
      return { cache, aud, perf: w.perf?.snapshot?.() || null, heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null }; },
  };
  return true;
}

// ---------------------------------------------------------------- Node-side
const shots = []; let shotN = 0; const shotOnce = new Set();
async function shot(page, name, note = '') {
  shotN++; const file = path.join(A.out, `${String(shotN).padStart(2, '0')}-${name}.png`);
  try { await page.screenshot({ path: file }); shots.push({ file: path.relative(REPO, file), name, note, wall: clock().trim() }); log('   bilde', path.basename(file), note); } catch (e) { log('   bilde feilet', name, e.message); }
}
async function shotFirst(page, key, note) { if (shotOnce.has(key)) return false; shotOnce.add(key); await shot(page, key, note); return true; }

async function main() {
  const port = await freePort();
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: A.root, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { const ok = await new Promise((r) => http.get(`http://127.0.0.1:${port}/`, (res) => { res.resume(); r(true); }).on('error', () => r(false))); if (ok) break; await sleep(100); }
  const browser = await chromium.launch({ headless: !A.headed, executablePath: findChrome(), handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    args: [`--window-size=${VW},${VH + 90}`, '--enable-precise-memory-info', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page = await ctx.newPage();
  const errors = { console: [], pageErrors: [], http: [], warnings: [] };
  page.on('console', (m) => { const t = m.text(); if (/favicon/.test(t)) return; if (m.type() === 'error') errors.console.push(t); else if (m.type() === 'warning') errors.warnings.push(t); });
  page.on('pageerror', (e) => errors.pageErrors.push(String(e.stack || e)));
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.http.push(`${r.status()} ${r.url()}`); });
  let stop = null; const onSig = (s) => { stop = s; log('signal', s, '– avslutter pent'); };
  process.on('SIGTERM', () => onSig('SIGTERM')); process.on('SIGINT', () => onSig('SIGINT')); process.on('SIGHUP', () => onSig('SIGHUP'));

  await page.addInitScript(() => { const D = window.__demo = { kSeen: {}, kShot: {}, meter: [], warden: [], ph: '' };
  const iv = setInterval(async () => { const B = window.BREACH; if (!B?.world?.modules?.levels) return; const w = B.world;
    try { if (!D.au) D.au = await import('/src/audio/index.js'); const m = D.au._meter(true); let ph = 'meny'; try { const d = w.modules.levels._debug(w); ph = d.phase + ':' + (d.level ?? '') + '-' + (d.wave ?? ''); } catch {} if (D.meter.length < 60000) D.meter.push([+(performance.now() / 1000).toFixed(2), ph, m.rms, m.peak, m.state]); } catch (e) { D.merr = String(e); }
    for (const e of w.enemies || []) if (e.type === 'heavy' && !e.dead && D.kSeen[e.id] == null) D.kSeen[e.id] = w.time; }, 43);
  setInterval(() => { const B = window.BREACH, p = B?.world?.player; if (!p || !B.camera) return; const c = document.querySelector('canvas'); try { const s = B.camera.worldToScreen(p.x, p.y - 22), g = c.getContext('2d'), d = g.getImageData(Math.round(s.x) - 9, Math.round(s.y) - 14, 18, 22).data; const px = []; for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (r + gg + b > 90) px.push([r, gg, b]); } if (px.length < 40) return; const med = (k) => px.map((q) => q[k]).sort((a, b) => a - b)[px.length >> 1]; D.warden.push([med(0), med(1), med(2), px.length]); } catch {} }, 2000);
});
await page.goto(`http://127.0.0.1:${port}/index.html?${[A.view === 'top' ? 'view=top' : '', A.menu ? 'menu=1' : '', A.perf ? 'perf=1' : ''].filter(Boolean).join('&')}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BREACH && window.BREACH.world, null, { timeout: 10000 });
  await sleep(1200);
  await page.evaluate(installBot);
  await shot(page, 'startskjerm', `før start, view=${A.view}`);
  log('view i spillet:', await page.evaluate(() => window.BREACH.world.view || 'top'));
  if (A.menu) {
    await sleep(2500); await shot(page, 'hovedmeny', 'menu=1');
    const b = await page.$('.bm-btn[data-id="play"]') || await page.$('text=PLAY');
    if (b) { await b.click(); log('PLAY klikket (ekte klikk)'); } else { log('fant ikke PLAY-knapp – startGame()'); await page.evaluate(() => window.BREACH.startGame()); }
    await sleep(1200);
  } else { await page.evaluate(() => window.BREACH.startGame()); await sleep(600); }

  // input-tilstand
  const held = new Set(); let lmb = false, rmb = false;
  const setKeys = async (want) => { for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); } for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } };
  const setMouse = async (l, r) => {
    if (r !== rmb) { if (r) await page.mouse.down({ button: 'right' }); else await page.mouse.up({ button: 'right' }); rmb = r; }
    if (l !== lmb) { if (l) await page.mouse.down({ button: 'left' }); else await page.mouse.up({ button: 'left' }); lmb = l; }
  };
  const releaseAll = async () => { await setKeys(new Set()); await setMouse(false, false); };
  const dirKeys = (a) => { const s = new Set(), cx = Math.cos(a), cy = Math.sin(a); if (cx > 0.38) s.add('KeyD'); if (cx < -0.38) s.add('KeyA'); if (cy > 0.38) s.add('KeyS'); if (cy < -0.38) s.add('KeyW'); return s; };
  const aimAt = async (sx, sy) => { await page.mouse.move(Math.max(4, Math.min(VW - 4, sx)), Math.max(4, Math.min(VH - 4, sy)), { steps: 1 }); };

  const S = { mode: 'fight', hpSeries: [], ammoSeries: [], fpsSeries: [], lastHp: 100, hpDropT: [], meleeCd: 0, rollCd: 0, reloadCd: 0, eCd: 0, noTargetT: 0, stuckT: 0, lastPos: null, unstickUntil: 0, unstickA: 0,
    level2: false, deathDone: false, deathStartT: null, deathAtT: null, restartWall: null, deathWall: null, afterRestartUntil: null, extraDone: false, extraUntil: null, coverTries: 0, cutscenes: [], cardsSeen: 0, lastPhase: null, phaseLog: [], banners: new Set(), firedT: 0, upgrades: [], deaths: [], lastPeriodic: 0, dieSpot: null, crateUsed: false, waveLog: [], curWave: null, lastProgress: Date.now(), progSig: '', passive: [] };
  const tEnd = Date.now() + A.maxMin * 60000;
  let snap = null, prevSnap = null, ticks = 0, firstContactShot = false;
  while (!stop && Date.now() < tEnd) {
    ticks++;
    prevSnap = snap;
    try { snap = await page.evaluate(() => window.__bot.snap()); } catch (e) { log('snap feilet', e.message); await sleep(300); continue; }
    const s = snap, wall = (Date.now() - T0) / 1000;
    if (s.phase !== S.lastPhase) { S.phaseLog.push([+wall.toFixed(1), s.t, s.phase, s.n, s.wave]); log(`fase ${S.lastPhase} → ${s.phase} (brett ${s.n}, bølge ${s.wave})`); S.prevPhase = S.lastPhase; S.lastPhase = s.phase; }
    if (s.banner && !S.banners.has(s.banner)) { S.banners.add(s.banner); log('banner:', s.banner); const b = s.banner.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40); if (/wave|board/.test(s.banner.toLowerCase())) await shot(page, 'banner-' + b, s.banner); }
    // per-bølge-logg
    if (s.waveId && (!S.curWave || S.curWave.id !== s.waveId)) {
      if (S.curWave) { S.curWave.wallEnd = +wall.toFixed(1); S.curWave.sec = +(S.curWave.wallEnd - S.curWave.wall0).toFixed(1); log(`BØLGE ${S.curWave.id} ferdig: ${S.curWave.sec} s, dødsfall ${S.curWave.deaths}, passivitet ${S.curWave.passive.length} (treff/skaderetning: se waveLog i JSON)`); }
      S.curWave = { id: s.waveId, n: s.n, wave: s.wave, wall0: +wall.toFixed(1), t0: s.t, deaths: 0, respawnAmmo: [], passive: [], hits: 0, hitDirs: {} }; S.waveLog.push(S.curWave);
      if (A.until && s.waveId === A.until) { log(`--until ${A.until} nådd`); await shot(page, `until-${s.waveId}`, 'stopppunkt'); break; }
    }
    if (s.phase === 'wave' && s.paused) { S.lastProgress = Date.now(); }
    else if (s.phase === 'wave') {
      const sig = s.enemies.length + ':' + s.enemies.reduce((n, e) => n + e.hp, 0).toFixed(0);
      if (sig !== S.progSig || !s.enemies.length) { S.progSig = sig; S.lastProgress = Date.now(); if (S.passiveOn) { S.passiveOn.sec = +((Date.now() - S.passiveOn.since) / 1000).toFixed(1); S.passiveOn = null; } }
      else if (!S.passiveOn && Date.now() - S.lastProgress > A.passiveSec * 1000 && s.enemies.length) {
        S.passiveOn = { wall: +wall.toFixed(1), wave: s.waveId, since: S.lastProgress, enemies: s.enemies.map((e) => ({ name: e.name, state: e.state, d: Math.round(e.d), los: e.los })) };
        S.passive.push(S.passiveOn); S.curWave?.passive.push(S.passiveOn);
        log(`PASSIVITET: ingen fremdrift på ${A.passiveSec} s i ${s.waveId}:`, S.passiveOn.enemies.map((e) => `${e.name}/${e.state}@${e.d}${e.los ? '' : '(skjult)'}`).join(', '));
        await shotFirst(page, `passiv-${s.waveId}`, `${s.enemies.length} fiender uten fremdrift`);
      }
    } else { S.lastProgress = Date.now(); }
    if (A.jump && !S.jumped && s.phase === 'break' && !s.cutscene) { S.jumped = true; await page.evaluate((i) => { const w = window.BREACH.world; w.modules.levels._debugWave(w, i, 1); }, A.jump - 1); log('TESTHOPP til bølge', A.jump, '(_debugWave)'); }
    if (s.p) { S.hpSeries.push([s.t, s.p.hp]); if (s.wpn) S.ammoSeries.push([s.t, s.wpn.id, s.wpn.mag, s.wpn.reserve]); }
    S.fpsSeries.push(s.fps);
    if (wall - S.lastPeriodic > 45 && s.phase === 'wave') { S.lastPeriodic = wall; await shot(page, `kamp-b${s.n}-${s.waveId}`, `periodisk, ${s.enemies.length} fiender, hp ${s.p?.hp}`); }

    // mellomsekvens: bilde, så hopp over
    if (s.cutscene) {
      await releaseAll();
      const key = `mellomsekvens-b${s.n}-${s.phase}-${s.wave}`;
      if (!shotOnce.has(key)) { await sleep(2600); await shotFirst(page, key, `brett ${s.n}, fase ${s.phase}`); S.cutscenes.push({ wall: +wall.toFixed(1), n: s.n, wave: s.wave, phase: s.phase }); }
      if (s.wave >= 5 && s.phase !== 'wave' && S.prevPhase !== 'dead' && !s.enemies.length) { S.yardDone = true; if (!shotOnce.has('yard-clear-b')) { await sleep(2500); await shotFirst(page, 'yard-clear-b', 'sluttsekvens'); await sleep(2500); await shotFirst(page, 'yard-clear-c', 'sluttsekvens'); } }
      const still = await page.evaluate(() => { const w = window.BREACH.world, d = w.modules.levels._debug(w); return d.phase === 'cutscene' || !!d.cutscene; }).catch(() => false);
      if (still) { await page.keyboard.press('Escape'); S.escN = (S.escN || 0) + 1; } else log('Escape droppet: ingen mellomsekvens åpen');
      await sleep(500);
      const pz = await page.evaluate(() => !!window.BREACH.world.paused).catch(() => null); if (pz && !still) log('ADVARSEL: pauset etter mellomsekvens');
      continue;
    }
    if (s.paused && !s.cutscene && !s.cards && (s.phase === 'wave' || s.phase === 'break')) { await releaseAll(); S.pauseMenus = (S.pauseMenus || 0) + 1; if (S.pauseMenus < 4) { log('pausemeny åpen (Escape traff spillet etter sekvens) – lukker'); await shot(page, `pausemeny-${S.pauseMenus}`); } await page.keyboard.press('Escape'); await sleep(500); continue; }
    if (s.start) { await page.evaluate(() => window.BREACH.startGame()).catch(() => {}); await sleep(400); continue; }
    // oppgraderingsvalg
    if (s.cards) {
      await releaseAll();
      if (S.cardsSeen === 0 || !shotOnce.has(`oppgradering-${S.upgrades.length + 1}`)) { await sleep(900); await shotFirst(page, `oppgradering-${S.upgrades.length + 1}`, s.cards.map((c) => c.name).join(' / ')); }
      S.cardsSeen++;
      const lowHp = s.p && s.p.hp < s.p.maxHp * 0.6;
      let i = s.cards.findIndex((c) => (lowHp ? c.role === 'forsvar' : c.role === 'angrep'));
      if (i < 0) i = 0;
      S.upgrades.push({ wall: +wall.toFixed(1), level: s.n, wave: s.wave, offer: s.cards, picked: s.cards[i].id });
      log('oppgradering:', s.cards.map((c) => `${c.name} [${c.role}]`).join(' | '), '→', s.cards[i].name);
      await sleep(700); await page.keyboard.press('Digit' + (i + 1)); await sleep(1100); const kd = await page.evaluate(() => window.__bot.keysDown()); S.upgrades[S.upgrades.length - 1].keysAfter = kd; log('taster nede etter kortvalg:', JSON.stringify(kd)); await shot(page, `etter-kort-${S.upgrades.length}`, 'taster ' + JSON.stringify(kd)); continue;
    }
    if (!s.p) { await sleep(200); continue; }

    if (A.stopAtLevelEnd && (s.n === 2 || (S.yardDone && !s.cutscene))) { log('brett 1 ferdig – stopper'); break; }
    // brett 2 nådd
    if (s.n === 2 && !S.level2) { S.level2 = true; log('BRETT 2 startet'); await sleep(400); await shot(page, 'brett2-start', `arena ${s.arena}`); }

    // død
    if (s.p.dead) {
      await releaseAll();
      if (!S.deaths.length || S.deaths[S.deaths.length - 1].done) { S.deaths.push({ wall: +wall.toFixed(1), t: s.t, n: s.n, wave: s.wave, deliberate: S.mode === 'die', done: false }); log('SPILLEREN DØDE', S.mode === 'die' ? '(bevisst)' : '(utilsiktet)'); S.deathWall = Date.now(); if (S.curWave) S.curWave.deaths++; await shot(page, S.mode === 'die' ? 'dod-bevisst' : `dod-utilsiktet-${S.deaths.length}`, `brett ${s.n} bølge ${s.wave}`); await sleep(700); await shot(page, 'dod-etter-0.7s'); }
      await sleep(150); continue;
    }
    if (S.deaths.length && !S.deaths[S.deaths.length - 1].done && !s.p.dead) {
      const unint = S.deaths.filter((d) => !d.deliberate).length;
      if (unint >= 2 && !S.assist && S.mode !== 'die' && !S.deathDone) { S.assist = true; await page.evaluate(() => { window.__assist = true; if (!window.__assistIv) window.__assistIv = setInterval(() => { const w = window.BREACH.world, p = w.player; if (window.__assist && p && !p.dead && p.hp < p.maxHp * 0.5) { p.hp = p.maxHp * 0.5; window.__run.assistTicks = (window.__run.assistTicks || 0) + 1; } }, 50); }); log('ASSIST PÅ: HP holdes ≥ 50 % (boten er svakere enn en menneskespiller) – for å nå oppgraderinger/brett 2'); }
      const D = S.deaths[S.deaths.length - 1]; D.done = true; D.backWall = +wall.toFixed(1); D.respawnSec = +((Date.now() - S.deathWall) / 1000).toFixed(1);
      D.ammo = (s.wpn?.slots || []).map((x) => `${x.id} ${x.mag}/${x.reserve}`).join(', ') || (s.wpn ? `${s.wpn.id} ${s.wpn.mag}/${s.wpn.reserve}` : '?'); S.curWave?.respawnAmmo.push(D.ammo); log(`ammo ved respawn: ${D.ammo}`);
      log(`gjenoppstått etter ${D.respawnSec} s (veggklokke, inkl. mellomsekvens som ble hoppet over)`);
      await sleep(300); await shot(page, `restart-${S.deaths.length}`, s.banner || ''); if (S.mode === 'die') { S.mode = 'fight'; S.deathDone = true; S.afterRestartUntil = A.die.length ? null : Date.now() + 70000; }
    }

    // bevisst død: etter at bølge 2-1 har startet og fiender er synlige
    if (A.die.length && s.phase === 'wave' && A.die.includes(s.waveId) && !(S.diedIn || (S.diedIn = new Set())).has(s.waveId) && s.enemies.length >= 2 && S.mode === 'fight') { S.diedIn.add(s.waveId); S.mode = 'die'; S.deathDone = false; await page.evaluate(() => { window.__assist = false; }); log('BEVISST DØD i', s.waveId); }
    if (S.level2 && !S.deathDone && !A.die.length && s.phase === 'wave' && s.enemies.length >= 2 && S.mode === 'fight') { S.mode = 'die'; S.deathStartT = s.t; await page.evaluate(() => { window.__assist = false; }); log('BEVISST DØD: står i åpent lende uten å skyte'); }
    if (S.mode === 'die') {
      await setMouse(false, false);
      if (s.p.state === 'cover') { await setKeys(new Set()); await page.keyboard.press('KeyE'); await sleep(200); continue; }
      const e = s.enemies.sort((a, b) => a.d - b.d)[0];
      if (e) await aimAt(e.sx, e.sy);
      if (e && !e.los) { const st = await page.evaluate(([x, y]) => window.__bot.steer(x, y), [e.x, e.y]); await setKeys(st ? dirKeys(st.a) : new Set()); }
      else await setKeys(new Set());
      if (!shotOnce.has('aapent-lende')) await shotFirst(page, 'aapent-lende', 'bevisst stående i åpent lende');
      await sleep(120); continue;
    }
    // etter omstart: litt mer kamp, så Heavy/Grenadier-innslag, så slutt
    if (S.deathDone && S.afterRestartUntil && Date.now() > S.afterRestartUntil && !S.extraDone) {
      if (A.extra && s.phase === 'wave') {
        const got = await page.evaluate(() => window.__bot.spawnExtra(['heavy', 'grenadier']));
        log('TESTINNSLAG: createEnemy heavy (Kiln) + grenadier (Spitter) →', got); S.extraDone = true; S.extraUntil = Date.now() + 40000; S.extraTypes = got;
      } else if (!A.extra) break;
    }
    if (S.extraDone && Date.now() > S.extraUntil) break;
    if (S.extraDone) { for (const e of s.enemies) if ((e.type === 'heavy' || e.type === 'grenadier') && e.d < 650) await shotFirst(page, `fiende-${e.name}`, `${e.name} på ${e.d.toFixed(0)} px, tilstand ${e.state}`); }

    for (const e of s.enemies) if ((e.type === 'heavy' || e.type === 'grenadier') && e.d < 650) await shotFirst(page, `fiende-${e.name}`, `${e.name} på ${e.d.toFixed(0)} px, tilstand ${e.state}`);
    if (s.gren < 500) { S.grenShots = (S.grenShots || 0) + 1; if (S.grenShots <= 4) { await shot(page, `spitter-granat-${S.grenShots}`, 'granat/varsel'); await sleep(250); await shot(page, `spitter-granat-${S.grenShots}b`, 'granat +250 ms'); } }
    if (s.kiln < 300) { S.kilnShots = (S.kilnShots || 0) + 1; if (S.kilnShots <= 2) await shot(page, `kiln-skyting-${S.kilnShots}`, 'Kiln skyter'); }
    // ------------------------------------------------ kamp-AI
    const p = s.p, en = s.enemies.slice().sort((a, b) => a.d - b.d);
    const visible = en.filter((e) => e.los && e.d < 760);
    const tgt = visible[0] || null, near = en[0] || null;
    S.maxAlive = Math.max(S.maxAlive || 0, en.length);
    if (en.length && !firstContactShot && visible.length) { firstContactShot = true; await aimAt(tgt.sx, tgt.sy); await sleep(120); const ac = await page.evaluate(() => window.__bot.aimCheck()); log('siktesjekk:', JSON.stringify(ac), 'mål', tgt.name, JSON.stringify(tgt.aimGround)); S.aimCheck = { ...ac, target: tgt.aimGround, name: tgt.name };
      await shot(page, 'forste-kontakt', `${en.length} fiender, nærmeste ${near.name} ${near.d.toFixed(0)} px`); }
    // HP-fall siste sekund
    S.hpDropT.push([s.t, p.hp]); while (S.hpDropT.length && S.hpDropT[0][0] < s.t - 1) S.hpDropT.shift();
    const drop = S.hpDropT.length ? S.hpDropT[0][1] - p.hp : 0;
    const wp = s.wpn || {}; const total = (wp.slots || []).reduce((n, x) => n + x.mag + (Number.isFinite(x.reserve) ? x.reserve : 999), 0);
    const now = Date.now();
    // våpenbytte når tomt
    if (wp.mag === 0 && wp.reserve === 0) { const alt = (wp.slots || []).findIndex((x) => x.mag + x.reserve > 0); if (alt >= 0) { await page.keyboard.press('Digit' + (alt + 1)); log('bytter våpen →', wp.slots[alt].id); await sleep(150); continue; } }
    else if (wp.id !== 'rifle' && wp.slots && (wp.slots[0].mag + wp.slots[0].reserve > 0) && (!near || near.d > 200) && now > (S.swCd || 0)) { await page.keyboard.press('Digit1'); S.swCd = now + 1500; }
    else if (wp.id === 'rifle' && near && near.d < 150 && wp.slots && wp.slots[1].mag > 0 && now > (S.swCd || 0)) { await page.keyboard.press('Digit2'); S.swCd = now + 2500; log('hagle på kloss hold'); }
    // skjul og la helsen komme tilbake
    if (p.hp < p.maxHp * 0.55) S.hiding = true; else if (p.hp >= p.maxHp * 0.9) S.hiding = false;
    const burst = (Date.now() % 560) < 380;

    // nærkamp
    if (near && near.d < 64 && now > S.meleeCd && p.state !== 'roll') {
      await aimAt(near.sx, near.sy); await setMouse(false, false); await page.keyboard.press('KeyF'); S.meleeCd = now + 900;
      await sleep(140); await shotFirst(page, 'naerkamp', `${near.type} på ${near.d.toFixed(0)} px`); continue;
    }
    // ammokasse (pause eller lite ammo)
    const rifleTot = wp.slots ? wp.slots[0].mag + wp.slots[0].reserve : 999;
    const crate = s.crates.filter((c) => c.ready).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const wantAmmo = crate && (rifleTot < 72 || ((s.phase === 'break' || s.phase === 'between') && rifleTot < 150));
    if (S.crateRun && !wantAmmo) { S.crateRun = false; log(`ammo hentet/avbrutt (rifle ${rifleTot})`); }
    if (wantAmmo && !(S.crateBan > now) && (!tgt || tgt.d > 280 || rifleTot === 0)) {
      if (!S.crateRun) { S.crateRun = true; S.crateT0 = now; log(`henter ammo (rifle ${rifleTot})`); }
      if (now - S.crateT0 > 9000) { S.crateBan = now + 20000; S.crateRun = false; log('gir opp kassen (sitter fast) – jakter i stedet'); }
      if (p.state === 'cover') { await page.keyboard.press('KeyE'); await sleep(150); continue; }
      const dC = Math.hypot(crate.x - p.x, crate.y - p.y);
      if (dC < 70 && !shotOnce.has('ammokasse')) { const sc = await page.evaluate(([x, y]) => window.__bot.toScreen(x, y), [crate.x, crate.y]); await aimAt(sc.x, sc.y - 60); await shotFirst(page, 'ammokasse', `kasse på ${dC.toFixed(0)} px, ammo totalt ${total}`); }
      const st = await page.evaluate(([x, y]) => window.__bot.steer(x, y), [crate.x, crate.y]);
      await setMouse(false, false); await setKeys(st ? dirKeys(st.a) : new Set());
      if (tgt) await aimAt(tgt.sx, tgt.sy);
      await sleep(90); continue;
    }
    // omlading
    if (wp.mag === 0 && wp.reserve > 0 && !wp.reloading && now > S.reloadCd) { await setMouse(false, rmb); await page.keyboard.press('KeyR'); S.reloadCd = now + 800; await sleep(120); await shotFirst(page, 'omlading', `${wp.id} ${wp.mag}/${wp.reserve}`); continue; }
    if (!tgt && wp.mag < (wp.magSize || 24) * 0.5 && wp.reserve > 0 && !wp.reloading && now > S.reloadCd) { await page.keyboard.press('KeyR'); S.reloadCd = now + 1500; }

    // rull når vi tar mye skade i åpent lende (eller tilfeldig første gang for bilde)
    if (p.state !== 'cover' && now > S.rollCd && ((drop > 18 && en.length) || (!shotOnce.has('rulling') && tgt && tgt.d > 250))) {
      const a = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) + Math.PI / 2 : 0; const st = await page.evaluate(([x, y]) => window.__bot.steer(x, y), [p.x + Math.cos(a) * 140, p.y + Math.sin(a) * 140]);
      await setMouse(false, false); await setKeys(st ? dirKeys(st.a) : dirKeys(a)); await page.keyboard.press('Space'); S.rollCd = now + 2500;
      await sleep(170); await shotFirst(page, 'rulling', `hp ${p.hp}, tap siste s ${drop.toFixed(0)}`); await sleep(250); continue;
    }

    // jakt: ingen fiende i sikt på lenge → gå etter nærmeste (ignorer dekning)
    if (tgt || !en.length) S.lastLos = now; else if (!S.lastLos) S.lastLos = now;
    const passiveHunt = en.length && now - S.lastProgress > A.passiveSec * 1000 && (!tgt || tgt.d > 420);
    if (!S.hiding && en.length && ((!tgt && now - S.lastLos > 9000) || passiveHunt) && S.mode !== 'die') {
      if (!S.hunting) { S.hunting = true; log(`JAKT${passiveHunt ? ' (passivitet)' : ''}: ${((now - Math.min(S.lastLos, S.lastProgress)) / 1000).toFixed(0)} s uten fremdrift/sikt, ${en.length} fiende(r) igjen – går etter nærmeste (${near.name} ${near.d.toFixed(0)} px)`); }
      if (p.state === 'cover') { await page.keyboard.press('KeyE'); await sleep(150); continue; }
      const st = await page.evaluate(([x, y]) => window.__bot.steer(x, y), [near.x, near.y]);
      await setMouse(false, false); await aimAt(near.sx, near.sy); await setKeys(st ? dirKeys(st.a) : new Set()); await sleep(90); continue;
    }
    if (S.hunting && tgt && tgt.d < 420) { S.hunting = false; S.advanceUntil = now + 1500; log('JAKT: fikk sikt'); }
    // dekning
    const threat = tgt || near;
    const advancing = (S.advanceUntil || 0) > now;
    if (threat && !advancing && p.state !== 'cover' && p.state !== 'slide' && p.state !== 'roll') {
      const spot = await page.evaluate(([x, y]) => window.__bot.coverSpot(x, y), [threat.x, threat.y]);
      if (spot) {
        const dS = Math.hypot(spot.x - p.x, spot.y - p.y);
        if (dS < 95 && now > S.eCd) {
          const a = Math.atan2(spot.cy - p.y, spot.cx - p.x); await setKeys(dirKeys(a)); await page.keyboard.press('KeyE'); S.eCd = now + 700; S.coverTries++;
          if (tgt) await aimAt(tgt.sx, tgt.sy); await sleep(120); continue;
        }
        if (dS >= 95) {
          let st = await page.evaluate(([x, y]) => window.__bot.steer(x, y), [spot.x, spot.y]);
          if (S.unstickUntil > now) st = { a: S.unstickA };
          await setKeys(st ? dirKeys(st.a) : new Set());
          // skyt mens vi forflytter oss
          if (tgt && !S.hiding) { await aimAt(tgt.sx, tgt.sy); await setMouse(wp.mag > 0 && burst, true); } else if (tgt) { await aimAt(tgt.sx, tgt.sy); await setMouse(false, false); } else { await setMouse(false, false); if (near) await aimAt(near.sx, near.sy); }
          if (S.lastPos && Math.hypot(p.x - S.lastPos.x, p.y - S.lastPos.y) < 1.5) { S.stuckT += 1; if (S.stuckT > 10) { S.unstickA = Math.random() * Math.PI * 2; S.unstickUntil = now + 700; S.stuckT = 0; } } else S.stuckT = 0;
          S.lastPos = { x: p.x, y: p.y }; await sleep(80); continue;
        }
      }
    }
    if (p.state === 'cover') {
      await shotFirst(page, 'i-dekning', `${p.coverType} dekning, positur ${p.sub}`);
      await setKeys(new Set());
      if (tgt) {
        S.noTargetT = 0; await aimAt(tgt.sx, tgt.sy);
        if (S.hiding) { await setMouse(false, false); }       // dukk til regen
        else {
          await setMouse(wp.mag > 0 && burst, true);
          if (wp.mag > 0 && !shotOnce.has('dekning-popup-skyting')) { await sleep(260); await shotFirst(page, 'dekning-popup-skyting', `${p.coverType}, positur ${p.sub}, mål ${tgt.type} ${tgt.d.toFixed(0)} px`); }
        }
      } else {
        await setMouse(false, false); S.noTargetT++;
        if (near) await aimAt(near.sx, near.sy);
        if (S.noTargetT > 45 && en.length && !S.hiding) { await page.keyboard.press('KeyE'); S.noTargetT = 0; S.advanceUntil = now + 2600; log('forlater dekning – ingen sikt, avanserer'); }
      }
      await sleep(90); continue;
    }
    // åpent lende uten dekning: skyt eller avanser
    if (tgt) {
      await aimAt(tgt.sx, tgt.sy); await setMouse(wp.mag > 0 && burst, true); await setKeys(new Set());
      if (wp.mag > 0 && !shotOnce.has('skyting-munning')) { await sleep(130); await shotFirst(page, 'skyting-munning', `${wp.id} mot ${tgt.type} ${tgt.d.toFixed(0)} px`); await sleep(60); await shot(page, 'skyting-munning-b'); }
    } else if (near) {
      await setMouse(false, false); await aimAt(near.sx, near.sy);
      let st = await page.evaluate(([x, y]) => window.__bot.steer(x, y), [near.x, near.y]); if (S.unstickUntil > now) st = { a: S.unstickA };
      await setKeys(st ? dirKeys(st.a) : new Set());
      if (S.lastPos && Math.hypot(p.x - S.lastPos.x, p.y - S.lastPos.y) < 1.5) { S.stuckT++; if (S.stuckT > 10) { S.unstickA = Math.random() * Math.PI * 2; S.unstickUntil = now + 700; S.stuckT = 0; } } else S.stuckT = 0;
      S.lastPos = { x: p.x, y: p.y };
    } else {
      await setMouse(false, false); await setKeys(new Set());
      if (s.hold && s.zone && !s.hold.inZone) { const st = await page.evaluate(([x, y]) => window.__bot.steer(x, y), [s.zone.x, s.zone.y]); await setKeys(st ? dirKeys(st.a) : new Set()); }
    }
    // treffbilde: rett etter at en fiende har mistet hp
    if (prevSnap && !shotOnce.has('treff')) { const hurt = s.enemies.find((e) => { const o = prevSnap.enemies.find((x) => x.id === e.id); return o && o.hp > e.hp && e.d < 600; }); if (hurt) await shotFirst(page, 'treff', `${hurt.type} ${hurt.hp.toFixed(0)}/${hurt.maxHp}`); }
    await sleep(80);
  }
  await releaseAll().catch(() => {});
  if (!stop) { await page.keyboard.press('F1'); await sleep(400); await shot(page, 'debug-F1-slutt'); await page.keyboard.press('F1'); }
  const run = await page.evaluate(() => { const R = window.__run; return { ...R, firstHit: undefined, spawnT: undefined }; }).catch((e) => ({ error: String(e) }));
  const fin = await page.evaluate(() => window.__bot.snap()).catch(() => null);
  const down = (arr, step) => { const o = []; let last = -1e9; for (const x of arr) if (x[0] - last >= step) { o.push(x); last = x[0]; } return o; };
  const ttks = (run.ttk || []).filter((x) => x.ttk != null).map((x) => x.ttk).sort((a, b) => a - b);
  const fpsS = S.fpsSeries.filter((x) => x > 0).sort((a, b) => a - b);
  const out = {
    extras: await page.evaluate(() => window.__bot.extras()).catch((e) => String(e)), frameByWave: Object.fromEntries(Object.entries(run.fw || {}).map(([k, a]) => { const b = a.slice().sort((x, y) => x - y); return [k, { n: b.length, median: b[b.length >> 1], p95: b[Math.floor(b.length * 0.95)], p99: b[Math.floor(b.length * 0.99)], max: b[b.length - 1], over33: b.filter((x) => x > 33.4).length }]; })), heapByWave: run.heap, dmgDir: run.dmgDir || [],
    tool: 'breach-spillbot-v5', view: A.view, until: A.until, aimCheck: S.aimCheck || null, passive: S.passive.map(({ since, ...x }) => x),
    waveLog: S.waveLog.map((x, i, a) => { const t1 = a[i + 1]?.t0 ?? 1e9, h = (run.playerDmg || []).filter((d) => d[0] >= x.t0 && d[0] < t1); const dirs = {}; for (const d of h) if (d[4] != null) { const k = ['Ø', 'SØ', 'S', 'SV', 'V', 'NV', 'N', 'NØ'][((Math.round(d[4] / 45) % 8) + 8) % 8]; dirs[k] = (dirs[k] || 0) + 1; } return { ...x, passive: x.passive.length, hits: h.length, dmg: +h.reduce((n, d) => n + d[1], 0).toFixed(0), hitDirs: dirs, hitsNoDir: h.filter((d) => d[4] == null).length }; }), started: new Date(T0).toISOString(), wallSec: +((Date.now() - T0) / 1000).toFixed(1), stoppedBy: stop || (Date.now() >= tEnd ? 'tidsgrense' : 'ferdig'),
    reached: { level: fin?.n, wave: fin?.wave, phase: fin?.phase }, level2Reached: S.level2, assist: S.assist || false, assistTicks: await page.evaluate(() => window.__run.assistTicks || 0).catch(() => null), deaths: S.deaths, cutscenes: S.cutscenes, upgrades: S.upgrades, phaseLog: S.phaseLog, banners: [...S.banners],
    errors, waves: (run.waves || []).map((x) => ({ level: x.level, wave: x.wave, id: x.id, name: x.name, sec: x.dur ?? null })),
    ttk: { n: ttks.length, median: ttks[Math.floor(ttks.length / 2)] ?? null, p90: ttks[Math.floor(ttks.length * 0.9)] ?? null, min: ttks[0] ?? null, max: ttks[ttks.length - 1] ?? null, list: run.ttk },
    enemiesAtOnce: { max: run.maxAlive, histogramTicks: run.aliveHist }, counts: run.counts, shots: { player: run.playerShots, enemy: run.enemyShots, playerHitsOnEnemy: run.playerHitsOnEnemy, coverHits: run.coverHits },
    shake: { calls: run.shakes, max: run.shakeMax, avg: run.shakes ? +(run.shakeSum / run.shakes).toFixed(2) : 0 },
    playerDamage: { events: (run.playerDmg || []).length, total: +(run.playerDmg || []).reduce((n, x) => n + x[1], 0).toFixed(0), bySource: (run.playerDmg || []).reduce((o, x) => (o[x[2]] = (o[x[2]] || 0) + x[1], o), {}) },
    frames: run.frameHist ? { ...run.frameHist, avgMs: +(run.frameHist.sum / run.frameHist.n).toFixed(2), fpsAvg: +(1000 / (run.frameHist.sum / run.frameHist.n)).toFixed(1) } : null,
    loopFps: fpsS.length ? { p5: fpsS[Math.floor(fpsS.length * 0.05)], median: fpsS[Math.floor(fpsS.length / 2)] } : null,
    hitsOnPlayer: run.playerDmg, hpCurve: down(S.hpSeries, 0.5), ammo: down(S.ammoSeries.map((x) => [x[0], x[1], x[2], x[3]]), 1), extra: S.extraTypes || null, timeline: run.timeline, screenshots: shots, ticks,
  };
  const file = path.join(A.results, `gjennomspilling-${new Date(T0).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
  try { out.demo = await page.evaluate(() => { const D = window.__demo; return D && { kSeen: D.kSeen, kShot: D.kShot, meter: D.meter, warden: D.warden, merr: D.merr || null }; }); } catch (e) { out.demoErr = String(e); }
  fs.writeFileSync(file, JSON.stringify(out, null, 1)); fs.writeFileSync(path.join(A.results, 'siste-gjennomspilling.json'), JSON.stringify(out, null, 1));
  log(`FERDIG: nådde brett ${out.reached.level} bølge ${out.reached.wave} (${out.reached.phase}) | dødsfall ${S.deaths.length} | bølger ${out.waves.map((x) => `${x.id}:${x.sec ?? '?'}s`).join(' ')} | TTK median ${out.ttk.median}s | maks fiender samtidig ${out.enemiesAtOnce.max} | feil: konsoll ${errors.console.length}, unntak ${errors.pageErrors.length}, http ${errors.http.length} | ${shots.length} bilder | ${file}`);
  await browser.close().catch(() => {}); srv.kill();
}
main().catch((e) => { console.error('KRASJ', e); process.exit(1); });
