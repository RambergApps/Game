// Headless-test av Hunker (27.10). Kjør fra /workspace/breach:  node game/src/enemies/tools/hunker-test.mjs [utmappe]
// Sjekker: går til lavt cover, dukker og skjoldet halverer skade forfra, peek-telegraf ≥ 0,4 s, bytter cover ved flanking,
// 0 konsollfeil. Lagrer rammer (f###.png) til klipp + ett skjermbilde i utmappa.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, '../../..');
const out = path.resolve(process.argv[2] || '/tmp/hunker-test'); mkdirSync(out, { recursive: true });
const PORT = 8950 + Math.floor(Math.random() * 40);
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: gameDir, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const base = path.join(os.homedir(), '.cache/ms-playwright');
const exe = process.env.CHROME_PATH || readdirSync(base).sort().reverse().map((d) => path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell')).find(existsSync);
const browser = await chromium.launch({ headless: true, executablePath: exe });
const errors = [];
const R = {};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto(`http://localhost:${PORT}/src/enemies/test.html?manual=1&seed=7`);
  await page.waitForFunction(() => window.__bt, null, { timeout: 8000 }).catch((e) => { console.log(errors); throw e; });
  await page.evaluate(async () => {
    const bt = window.__bt; bt.setGod(true); bt.setHold?.(true); bt.setBot?.(false);
    bt.setPlayer(5 * 32, 12 * 32, 0);
    window.__h = bt.spawn('hunker', 34 * 32, 12.3 * 32);
    window.__log = []; window.__shifts = [];
    bt.world.events.on('hunkerShift', (ev) => window.__shifts.push({ t: bt.world.time, reason: ev.reason }));
    window.__combat = await import('/src/core/combat.js');
  });
  let frame = 0;
  const snap = async (zoomOn = true) => {
    await page.evaluate(() => { const h = window.__h; window.__bt.view((h.x + window.__bt.player.x) / 2, h.y, 1.1); });
    await page.locator('canvas').screenshot({ path: path.join(out, `f${String(frame++).padStart(3, '0')}.png`) });
  };
  const run = (sec) => page.evaluate((sec) => {
    const bt = window.__bt, h = window.__h, P = bt.enemies.poseOf;
    for (let i = 0; i < Math.round(sec / 0.05); i++) {
      bt.step(0.05); const p = P ? P(bt.world, h) : {};
      window.__log.push({ t: +bt.world.time.toFixed(2), st: h.state, spot: h.spot?.type ?? null, dSpot: h.spot ? Math.hypot(h.x - h.spot.x, h.y - h.spot.y) : null, crouch: h.crouch, edge: h.spot?.cover ? (h.spot.nx ? (h.spot.nx > 0 ? h.spot.x - (h.spot.cover.x + h.spot.cover.w) : h.spot.cover.x - h.spot.x) : (h.spot.ny > 0 ? h.spot.y - (h.spot.cover.y + h.spot.cover.h) : h.spot.cover.y - h.spot.y)) : null, peek: p.peek, cover: p.cover, anim: p.anim, ap: p.attackPhase });
    }
  }, sec);
  // 1) til cover
  for (let i = 0; i < 40; i++) { await run(0.25); if (i % 2 === 0) await snap(); }
  R.toCover = await page.evaluate(() => { const L = window.__log; const i = L.findIndex((r) => r.st === 'inCover' && r.spot === 'low'); return { ok: i >= 0, at: i >= 0 ? L[i].t : null, sawCrouchSprint: L.some((r) => r.anim === 'walk' && r.cover >= 0.3 && r.cover <= 0.6), seekCrouchMin: Math.min(...L.filter((r) => r.st === 'seekCover' && r.t > L[0].t + 0.3).map((r) => +r.crouch.toFixed(2))), edgePx: [...new Set(L.filter((r) => r.st === 'inCover' && r.dSpot < 1).map((r) => r.edge))] }; });
  // 2) skjold: vent til dukket, slå forfra og bakfra
  await page.evaluate(() => { const bt = window.__bt, h = window.__h; for (let i = 0; i < 1000 && !(h.state === 'inCover' && h.crouch > 0.95); i++) bt.step(0.02); });
  R.shield = await page.evaluate(() => {
    const bt = window.__bt, h = window.__h, w = bt.world, s = h.spot; if (h.state !== 'inCover' || !s) return { ok: false, state: h.state };
    const hp0 = h.hp; let hit = null; const off = w.events.on?.('hit', (ev) => { if (ev.target === h) hit = ev; });
    const front = window.__combat.damage(h, 10, { x: h.x - s.nx * 200, y: h.y - s.ny * 200 }, w);
    const pose = bt.enemies.poseOf(w, h); w.time += 0.001;
    const back = window.__combat.damage(h, 10, { x: h.x + s.nx * 200, y: h.y + s.ny * 200 }, w);
    const pose2 = bt.enemies.poseOf(w, h);
    h.hp = hp0;
    return { ok: Math.abs(front - 5) < 1e-6 && Math.abs(back - 10) < 1e-6 && pose.shieldHit === true && pose2.shieldHit === false, front, back, shieldHitFront: pose.shieldHit, shieldHitBack: pose2.shieldHit, cover: pose.cover, anim: pose.anim };
  });
  // 3) peek-telegraf: la den skyte noen salver
  for (let i = 0; i < 24; i++) { await run(0.25); if (i % 2 === 0) await snap(); }
  R.peek = await page.evaluate(() => {
    const L = window.__log, runs = []; let st = null;
    for (const r of L) { if (r.st === 'telegraph' && st == null) st = r.t; if (r.st !== 'telegraph' && st != null) { runs.push(+(r.t - st).toFixed(2)); st = null; } }
    const flashBeforePeek = L.some((r) => r.ap > 0 && r.peek < 1); const openAttack = L.filter((r) => (r.st === 'telegraph' || r.st === 'fire') && !(r.dSpot != null && r.dSpot < 10)).length;
    return { ok: runs.length > 0 && Math.min(...runs) >= 0.4 && !flashBeforePeek && openAttack === 0, openAttack, telegraphs: runs, flashBeforePeek, fires: L.filter((r) => r.anim === 'fire').length };
  });
  globalThis.__tr = await page.evaluate(() => (globalThis.__hkT || []).filter((x) => x[2] !== 'seekCover').slice(-30));
  globalThis.__dbg = await page.evaluate(() => window.__log.filter((r) => r.st === 'inCover').slice(0, 3).concat(window.__log.filter((r)=>r.st!=='seekCover').slice(-4)));
  // Munning: side fra HUNKER_MUZZLE skal ligge til HØYRE for skuddretningen (y ned: høyre = (−sin, cos))
  R.muzzle = await page.evaluate(async () => {
    const bt = window.__bt, h = window.__h, w = bt.world, { HUNKER_MUZZLE } = await import('/src/enemies/look/hunker.js');
    const seen = new Set((w.projectiles || []).map((p) => p)); let got = null;
    for (let i = 0; i < 600 && !got; i++) { bt.step(1 / 60); for (const p of w.projectiles || []) if (!seen.has(p) && (p.owner === h || p.source === h || p.entity === h)) { got = p; break; } }
    if (!got) return { ok: false, why: 'no shot' };
    const f = h.spot ? Math.atan2(-h.spot.ny, -h.spot.nx) : h.facing, a = h.aim;
    // kulestart kan ha flyttet ett steg: bruk poseOf.muzzle (samme muzzleXY) og kulas første posisjon
    const m = bt.enemies.poseOf(w, h).muzzle, ox = m.x - h.x, oy = m.y - h.y;
    const FW = HUNKER_MUZZLE.fwd, right = (ox - Math.cos(a) * FW) * -Math.sin(f) + (oy - Math.sin(a) * FW) * Math.cos(f), fwd = ox * Math.cos(a) + oy * Math.sin(a);
    const bx = (got.x0 ?? got.sx ?? got.x) - h.x, by = (got.y0 ?? got.sy ?? got.y) - h.y, bRight = bx * -Math.sin(a) + by * Math.cos(a);
    window.__bt.view(h.x, h.y, 3); window.__mz = { x: m.x, y: m.y };
    return { ok: right > 0 && Math.abs(right - (HUNKER_MUZZLE.side ?? 0)) < 0.6 && bRight > 0, side: HUNKER_MUZZLE.side, fwdExp: HUNKER_MUZZLE.fwd, right: +right.toFixed(2), fwd: +fwd.toFixed(2), bulletRight: +bRight.toFixed(2), aimDeg: Math.round(a * 57.3), facingDeg: Math.round(f * 57.3) };
  });
  await page.locator('canvas').screenshot({ path: path.join(out, 'muzzle-shot.png') });
  await page.locator('canvas').screenshot({ path: path.join(out, 'shot.png') });
  // 4) flanking: flytt spilleren ut på siden/bak coveret
  const flank = await page.evaluate(() => { const bt = window.__bt, h = window.__h; for (let i = 0; i < 1000 && !(h.state === 'inCover' && h.crouch > 0.95); i++) bt.step(0.02); const s = h.spot; window.__shifts.length = 0;
    if (!s) return { ok: false, why: 'nospot', st: h.state };
    const tx = -s.ny, ty = s.nx; bt.setPlayer(h.x + tx * 260 - s.nx * 40, h.y + ty * 260 - s.ny * 40); const id = s.id, side0 = id.split(':').slice(0, 2).join(':'); window.__flankFrom = id;
    let to = null; for (let i = 0; i < 100 && !to; i++) { bt.step(0.05); if (window.__shifts.some((x) => x.reason === 'flanked') && h.spot) to = h.spot.id; }
    return { from: id, to, newSide: !!to && to.split(':').slice(0, 2).join(':') !== side0, state: h.state, shifts: window.__shifts.slice() }; });
  for (let i = 0; i < 6; i++) { await run(0.25); await snap(); }
  R.flank = { ...flank, ok: !!flank.shifts?.some((x) => x.reason === 'flanked') && flank.newSide };   // streng: egen >70°-regel må utløse, og nytt cover/ny side
} finally { await browser.close(); server.kill(); }
R.consoleErrors = errors; R.pass = R.muzzle?.ok && R.toCover?.ok && R.shield?.ok && R.peek?.ok && R.flank?.ok && errors.length === 0;
writeFileSync(path.join(out, 'hunker-report.json'), JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
