// Headless-test av fiende-AI. Kjør fra /workspace/breach:  node game/src/enemies/tools/headless-test.mjs [utmappe]
// Starter python3 http.server i game/, kjører scenarier i Chromium, lagrer skjermbilder og en JSON-rapport.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, '../../..');
const out = path.resolve(process.argv[2] || path.resolve(gameDir, '../reviews/img'));
mkdirSync(out, { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 900) + 50;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: gameDir, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  if (existsSync(base)) for (const d of readdirSync(base).sort().reverse()) {
    const c = path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell');
    if (existsSync(c)) return c;
  }
  return undefined;
}
const browser = await chromium.launch({ headless: true, executablePath: findChrome() });
const report = { scenarios: {}, consoleErrors: [] };
const T = 32;
// Skuddhold-fordeling (ruter skytter → spiller) per type, summert over scenariene A, L, F, H, G
report.shotRange = {};
const addRange = (sr) => { for (const [t, b] of Object.entries(sr || {})) { const R = report.shotRange[t] || (report.shotRange[t] = {}); for (const [k, n] of Object.entries(b)) R[k] = (R[k] || 0) + n; } };

async function openTest(seed = 7, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1560, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.consoleErrors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => report.consoleErrors.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:${PORT}/src/enemies/test.html?manual=1&seed=${seed}${extra}`);
  await page.waitForFunction(() => window.__bt);
  return page;
}
const shot = (page, name) => page.locator('canvas').screenshot({ path: path.join(out, name) });

// Hent beskyttelse for alle grunts i dekning
const coverCheck = (page) => page.evaluate(async () => {
  const { protection } = await import('/src/enemies/cover.js');
  const { world, player } = window.__bt;
  return world.enemies.filter((e) => !e.dead && e.state === 'inCover' && e.spot).map((e) => ({
    id: e.id, type: e.type, spot: e.spot.type, q: +protection(world, e.spot, player.x, player.y).toFixed(2),
    range: Math.round(Math.hypot(e.x - player.x, e.y - player.y)),
  }));
});

// ---------------- Scenario A: lag mot spiller bak low cover
{
  const page = await openTest(7);
  await page.evaluate(() => { const b = window.__bt; b.player.hp = b.player.maxHp = 5000; b.setPlayer(6 * 32 + 4, 12 * 32, 0); b.squad(); });
  const log = [];
  const checks = [];
  let t = 0;
  const shots = { 2: 'A-02s.png', 6: 'A-06s-debug.png', 9: 'A-09s.png', 14: 'A-14s-debug.png', 20: 'A-20s.png' };
  for (let i = 0; i < 24 * 4; i++) {
    t = (i + 1) * 0.25;
    if (t === 10) await page.evaluate(() => window.__bt.setBot(true)); // spilleren begynner å skyte tilbake
    await page.evaluate(() => window.__bt.step(0.25));
    if (Number.isInteger(t)) {
      const snap = await page.evaluate(() => window.__bt.snapshot());
      log.push({ t, states: snap.map((s) => `${s.type[0]}${s.id}:${s.state}${s.dead ? '†' : ''}`).join(' ') });
      if (t % 4 === 0) checks.push({ t, cover: await coverCheck(page) });
    }
    if (shots[t]) {
      await page.evaluate((d) => window.__bt.setDebug(d), shots[t].includes('debug'));
      await shot(page, shots[t]);
    }
  }
  // Fang et telegraf-øyeblikk
  await page.evaluate(() => { window.__bt.setDebug(false); window.__bt.setBot(false); });
  let teleFound = 0;
  for (let i = 0; i < 600 && teleFound < 2; i++) {
    const tele = await page.evaluate(() => { const b = window.__bt; b.step(1 / 30); const e = b.world.enemies.find((e) => !e.dead && e.state === 'telegraph' && e.stateT > e.telegraphDur * 0.65); return e ? { x: e.x, y: e.y } : null; });
    if (tele) {
      if (teleFound === 0) await shot(page, 'A-telegraf.png');
      else {
        // nærbilde mellom fienden og spilleren
        await page.evaluate(({ x, y }) => { const b = window.__bt; b.view((x + b.player.x) / 2, (y + b.player.y) / 2, 2.2); }, tele);
        await shot(page, 'A-telegraf-naer.png');
        await page.evaluate(() => window.__bt.view(0, 0, 1));
      }
      teleFound++;
      await page.evaluate(() => window.__bt.step(1.5));
    }
  }
  report.scenarios.A = { log, checks, stats: await page.evaluate(() => JSON.parse(JSON.stringify({ ...window.__bt.stats, squad: window.__bt.enemies.getSquad(window.__bt.world).stats }))) };
  addRange(report.scenarios.A.stats.shotRange);
  await page.close();
}

// ---------------- Scenario B: spilleren bytter posisjon → grunts må reposisjonere
{
  const page = await openTest(11);
  await page.evaluate(() => { const b = window.__bt; b.setGod(true); b.setPlayer(6 * 32 + 4, 12 * 32, 0); b.spawn('grunt', 37 * 32, 6 * 32); b.spawn('grunt', 37 * 32, 12 * 32); b.spawn('grunt', 37 * 32, 18 * 32); });
  await page.evaluate(() => window.__bt.step(10));
  const before = await coverCheck(page);
  await page.evaluate(() => window.__bt.setPlayer(12 * 32, 3 * 32 + 4, 0.6)); // nord, bak høy vegg-ende
  await page.evaluate(() => window.__bt.step(1));
  const immediately = await coverCheck(page);
  await page.evaluate(() => window.__bt.step(7));
  const after = await coverCheck(page);
  await page.evaluate(() => window.__bt.setDebug(true));
  await shot(page, 'B-reposisjon-debug.png');
  report.scenarios.B = { before, immediately, after, snap: await page.evaluate(() => window.__bt.snapshot()) };
  await page.close();
}

// ---------------- Scenario C: spiller i det åpne, stillestående vs. i bevegelse (treffrate)
{
  const res = {};
  for (const mode of ['still', 'beveger']) {
    const page = await openTest(5);
    await page.evaluate(() => { const b = window.__bt; b.world.cover.length = 0; b.player.hp = 1e6; b.player.maxHp = 1e6; b.setPlayer(14 * 32, 12 * 32, 0); b.spawn('grunt', 26 * 32, 8 * 32); b.spawn('grunt', 26 * 32, 16 * 32); });
    await page.evaluate(() => window.__bt.step(2));
    for (let i = 0; i < 60; i++) {
      await page.evaluate(([m, i]) => { const b = window.__bt; if (m === 'beveger') b.setPlayer(14 * 32, 12 * 32 + Math.sin(i * 0.35) * 70, 0); b.step(0.25); }, [mode, i]);
    }
    const s = await page.evaluate(() => window.__bt.stats);
    res[mode] = { shots: s.shots, hits: s.playerHits, rate: +(s.playerHits / Math.max(1, s.shots)).toFixed(2), shotsNoLos: s.shotsNoLos, shotsNoTelegraph: s.shotsNoTelegraph, maxShooters: s.maxShooters };
    if (mode === 'still') await shot(page, 'C-aapent.png');
    await page.close();
  }
  report.scenarios.C = res;
}

// ---------------- Hjelpere for runde 2
const step = (page, dt) => page.evaluate((d) => window.__bt.step(d), dt);
const stats = (page) => page.evaluate(() => JSON.parse(JSON.stringify({ ...window.__bt.stats, squad: window.__bt.enemies.getSquad(window.__bt.world).stats, playerSupp: window.__bt.player.suppression })));
const share = (c) => { const lo = c?.low || 0, hi = c?.high || 0; return { low: +lo.toFixed(1), high: +hi.toFixed(1), lowShare: +(lo / Math.max(1e-6, lo + hi)).toFixed(2) }; };
// Ta skjermbilde når predikatet (kjøres i siden hvert 1/30 s) slår til
async function shotWhen(page, name, pred, maxSteps = 900, zoom = 0) {
  for (let i = 0; i < maxSteps; i++) {
    const hit = await page.evaluate((src) => { const b = window.__bt; b.step(1 / 30); return (0, eval)(src)(b); }, pred);
    if (hit) {
      if (zoom) await page.evaluate(([h, z]) => { const b = window.__bt; b.view(h.x, h.y, z); }, [hit, zoom]);
      await shot(page, name);
      if (zoom) await page.evaluate(() => window.__bt.view(0, 0, 1));
      return hit;
    }
  }
  return null;
}

// ---------------- Scenario L: grunts velger low cover (andel tid i low vs high), flere frø
{
  const runs = [];
  const tot = { low: 0, high: 0 }, enters = { low: 0, high: 0 };
  for (const seed of [7, 21, 33, 48]) {
    const page = await openTest(seed);
    await page.evaluate(() => { const b = window.__bt; b.player.hp = b.player.maxHp = 1e6; b.setPlayer(6 * 32 + 4, 12 * 32, 0); b.setBot(true);
      for (const y of [5, 9, 15, 19]) b.spawn('grunt', 37 * 32, y * 32); });
    await step(page, 22);
    const st = await stats(page); addRange(st.shotRange);
    const c = st.coverTime.grunt || {};
    tot.low += c.low || 0; tot.high += c.high || 0;
    enters.low += st.coverEnters.grunt?.low || 0; enters.high += st.coverEnters.grunt?.high || 0;
    runs.push({ seed, ...share(c), enters: st.coverEnters.grunt, shotsNoLos: st.shotsNoLos, shots: st.shots });
    if (seed === 7) { await page.evaluate(() => window.__bt.setDebug(true)); await shot(page, 'L-grunts-low-cover-debug.png'); }
    await page.close();
  }
  report.scenarios.L = { runs, total: share(tot), enters, enterLowShare: +(enters.low / Math.max(1, enters.low + enters.high)).toFixed(2) };
}

// ---------------- Scenario F: flanker bakfra – treffrate, telegraf, varsel
{
  const runs = [];
  const agg = { shots: 0, hits: 0, telegraphs: 0, minTelegraph: Infinity };
  for (const seed of [3, 7, 13, 29]) {
    const page = await openTest(seed);
    await page.evaluate(() => { const b = window.__bt; b.player.hp = b.player.maxHp = 1e6; b.setPlayer(6 * 32 + 4, 12 * 32, 0); b.setHold(true); // stillestående spiller = verste fall
      b.spawn('grunt', 37 * 32, 8 * 32); b.spawn('grunt', 37 * 32, 16 * 32); b.spawn('flanker', 36 * 32, 3 * 32);
      b.world.enemies.find((e) => e.type === 'flanker').meleeReadyAt = 1e9; });   // F måler flankeskudd; nærkamp måles i M
    if (seed === 3) {
      await shotWhen(page, 'F-flanke-varsel-naer.png', `(b) => { const e = b.world.enemies.find((e) => !e.dead && e.state === 'telegraph' && e.flankShot && e.stateT > e.telegraphDur * 0.55); return e ? { x: (e.x + b.player.x) / 2, y: (e.y + b.player.y) / 2 } : null; }`, 1800, 1.9);
    }
    await step(page, 45);
    const st = await stats(page); addRange(st.shotRange);
    const f = st.flank;
    agg.shots += f.shots; agg.hits += f.hits; agg.telegraphs += f.telegraphs; agg.minTelegraph = Math.min(agg.minTelegraph, f.minTelegraph ?? Infinity);
    runs.push({ seed, ...f, rate: +(f.hits / Math.max(1, f.shots)).toFixed(2), flankerTotal: st.byType.flanker, maxFlanking: st.maxFlanking });
    await page.close();
  }
  report.scenarios.F = { runs, total: { ...agg, rate: +(agg.hits / Math.max(1, agg.shots)).toFixed(2) } };
}

// ---------------- Scenario H: Heavy – spin-up som varsel, undertrykkende ild mot spiller bak høy dekning
{
  const page = await openTest(9);
  await page.evaluate(() => { const b = window.__bt; b.player.hp = b.player.maxHp = 1e6; b.setPlayer(12 * 32, 15 * 32 + 16, 0); b.setBot(true);
    b.spawn('heavy', 36 * 32, 15 * 32); b.spawn('grunt', 37 * 32, 9 * 32); });
  const spin = await shotWhen(page, 'H-spinup.png', `(b) => { const e = b.world.enemies.find((e) => e.type === 'heavy' && e.state === 'spinup' && e.spin > 0.6); return e ? { x: (e.x + b.player.x) / 2, y: (e.y + b.player.y) / 2 } : null; }`, 900, 1.5);
  const tSpin = await page.evaluate(() => window.__bt.world.time);
  const hSeen = await page.evaluate(() => { const h = window.__bt.world.enemies.find((e) => e.type === 'heavy'); return h ? { heavySeenAt: h.firstSeenAt != null ? +h.firstSeenAt.toFixed(2) : null, heavyFirstSpinupStart: h.firstSpinupAt != null ? +h.firstSpinupAt.toFixed(2) : null, spinupAfterSeen: h.firstSeenAt != null && h.firstSpinupAt != null ? +(h.firstSpinupAt - h.firstSeenAt).toFixed(2) : null, marchFire: h.marchFire || 0 } : {}; });
  // Spilleren søker dekning bak den høye pilaren (13,17) og blindfyrer av og til (røper posisjonen)
  // går (ikke teleporterer) inn bak pilaren på ~0.8 s, slik en spiller ville gjort
  for (let i = 1; i <= 24; i++) await page.evaluate((k) => { const b = window.__bt; b.setPlayer(12 * 32 + 12 * k, (15.5 + 2.5 * k) * 32, 0); b.step(1 / 30); }, i / 24);
  const before = await stats(page);
  const sup = { maxLevel: 0, suppressedSteps: 0, steps: 0 };
  let shotSupp = false;
  for (let i = 0; i < 18 * 4; i++) {
    await step(page, 0.25);
    const p = await page.evaluate(() => ({ s: window.__bt.player.suppression, d: window.__bt.player.suppressed, h: window.__bt.world.enemies.find((e) => e.type === 'heavy') }));
    sup.steps++; if (p.d) sup.suppressedSteps++; sup.maxLevel = Math.max(sup.maxLevel, p.s);
    if (!shotSupp && p.h && p.h.state === 'sustain' && p.h.fireMode === 'suppress') {
      await page.evaluate(() => { const b = window.__bt; const h = b.world.enemies.find((e) => e.type === 'heavy'); b.view((h.x + b.player.x) / 2, (h.y + b.player.y) / 2, 1.4); });
      await shot(page, 'H-undertrykking.png'); await page.evaluate(() => window.__bt.view(0, 0, 1)); shotSupp = true;
    }
  }
  const after = await stats(page); addRange(after.shotRange);
  report.scenarios.H = {
    firstSpinupAt: spin ? +tSpin.toFixed(2) : null, ...hSeen, spinups: after.spinups, heavyShotsNoSpin: after.heavyShotsNoSpin,
    heavy: after.byType.heavy, suppressiveShots: after.suppressive.shots, suppressEvents: after.suppressive.events,
    hiddenPhase: { heavyShots: (after.byType.heavy?.shots || 0) - (before.byType.heavy?.shots || 0), heavyHits: (after.byType.heavy?.hits || 0) - (before.byType.heavy?.hits || 0), suppressedShare: +(sup.suppressedSteps / sup.steps).toFixed(2), maxLevel: +sup.maxLevel.toFixed(2) },
    shotsNoLos: after.shotsNoLos, screenshotSuppress: shotSupp,
  };
  // Dødelighet i det åpne (vanlig hp): hvor fort dreper Heavy en stillestående spiller uten dekning?
  await page.close();
  const p2 = await openTest(9);
  const ttk = await p2.evaluate(() => { const b = window.__bt; b.world.cover.length = 0; b.player.hp = b.player.maxHp = 100; b.setPlayer(14 * 32, 12 * 32, 0);
    b.spawn('heavy', 30 * 32, 12 * 32); let t0 = null, t = 0; b.world.events.on('shot', ({ team, projectile }) => { if (team === 'enemy' && t0 === null) t0 = b.world.time; });
    for (let i = 0; i < 60 * 20 && b.player.hp > 0; i++) b.step(1 / 60); return { firstShot: t0, deadAt: b.player.hp <= 0 ? +b.world.time.toFixed(2) : null, hp: Math.round(b.player.hp) }; });
  report.scenarios.H.openTTK = ttk;
  await p2.close();
}

// ---------------- Scenario G: Grenadier skyller spilleren ut av dekning
{
  const res = {};
  for (const mode of ['stille', 'unnviker', 'vapen']) {
    const page = await openTest(17, mode === 'vapen' ? '&weapons=1' : ''); // vapen: Breach Våpens spawnGrenade (ekte fysikk)
    await page.evaluate((m) => { const b = window.__bt; b.player.hp = b.player.maxHp = 1e6; b.setPlayer(6 * 32 + 4, 12 * 32, 0); b.setHold(true); b.setDodge(m === 'unnviker');
      b.spawn('grenadier', 36 * 32, 8 * 32); b.spawn('grenadier', 36 * 32, 16 * 32); b.spawn('grunt', 37 * 32, 12 * 32); }, mode);
    if (mode === 'stille') {
      await shotWhen(page, 'G-kastvarsel.png', `(b) => { const e = b.world.enemies.find((e) => e.state === 'throw' && e.stateT > 0.45); return e ? { x: (e.x + b.player.x) / 2, y: (e.y + b.player.y) / 2 } : null; }`, 1200, 1.4);
      await shotWhen(page, 'G-granat-landet.png', `(b) => { const g = b.enemies.grenadeState(b.world).grenades.find((g) => g.landed && g.t > 0.5); return g ? { x: g.x, y: g.y } : null; }`, 300, 2.0);
    }
    await step(page, 30);
    const st = await stats(page); addRange(st.shotRange);
    const g = st.grenade;
    const viaWeapons = await page.evaluate(() => !!window.__bt.world.modules?.weapons);
    if (mode === 'vapen') await shotWhen(page, 'G-vapen-granat.png', `(b) => { const m = b.enemies.grenadeState(b.world).markers.find((m) => m.t > 0.6); return m ? { x: m.x, y: m.y } : null; }`, 900, 1.8);
    res[mode] = { viaWeapons, ...g, warnMin: Math.min(...g.warn), warnAvg: +(g.warn.reduce((a, b) => a + b, 0) / Math.max(1, g.warn.length)).toFixed(2), maxThrowers: st.squad.maxThrowers, deniedGrenade: st.squad.deniedGrenade, time: +(await page.evaluate(() => window.__bt.world.time)).toFixed(1) };
    await page.close();
  }
  report.scenarios.G = res;
}

// ---------------- Scenario S: spawn fra world.arena.enemySpawns + fallback
{
  const page = await openTest(4);
  const r = await page.evaluate(() => {
    const b = window.__bt, w = b.world;
    const pts = w.arena.enemySpawns;
    b.setPlayer(6 * 32, 12 * 32, 0);
    const used = [];
    for (const t of ['grunt', 'grunt', 'flanker', 'heavy', 'grenadier', 'grunt']) { const e = b.spawn(t); used.push({ t, x: Math.round(e.x), y: Math.round(e.y), onSpawn: pts.some((p) => Math.hypot(p.x - e.x, p.y - e.y) < 33), d: Math.round(Math.hypot(e.x - w.player.x, e.y - w.player.y)) }); }
    const distinct = new Set(used.map((u) => `${u.x},${u.y}`)).size;
    w.enemies.length = 0;
    const saved = w.arena; w.arena = null;
    const fb = [];
    for (let i = 0; i < 4; i++) { const e = b.spawn('grunt'); fb.push({ x: Math.round(e.x), y: Math.round(e.y), inBounds: e.x > 0 && e.y > 0 && e.x < w.bounds.w && e.y < w.bounds.h, d: Math.round(Math.hypot(e.x - w.player.x, e.y - w.player.y)) }); }
    w.arena = saved;
    return { arena: used, distinct, fallback: fb };
  });
  report.scenarios.S = r;
  await page.close();
}

// ---------------- Scenario D: integrert i hovedspillet (game/index.html) – nivåene spawner selv
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => errs.push(`[requestfailed] ${r.url()}`));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.BREACH && window.BREACH.world.player, null, { timeout: 8000 }).catch(() => {});
  // Forbi «klikk for å starte» og eventuell mellomsekvens (Escape = hopp over), som tests/run.mjs gjør
  await page.evaluate(() => window.BREACH?.startGame?.());
  let cutscene = false;
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({ cs: !!document.querySelector('.breach-cutscene'), paused: window.BREACH.world.paused }));
    if (st.cs) { cutscene = true; await page.keyboard.press('Escape'); }
    else if (!st.paused) break;
    await page.waitForTimeout(150);
  }
  const d = await page.evaluate(async () => {
    const B = window.BREACH; if (!B) return { error: 'window.BREACH mangler' };
    const mod = B.world.modules?.enemies || await import('/src/enemies/index.js');
    const unpaused = !B.world.paused;
    const p = B.world.player; p.invuln = true;
    B.loop.stop();
    let shots = 0, ev = {}; for (const n of ['shot', 'telegraph', 'suppress', 'grenadeWindup', 'grenade', 'explosion', 'spinup']) B.world.events.on(n, ({ team }) => { ev[n] = (ev[n] || 0) + 1; if (n === 'shot' && team === 'enemy') shots++; });
    B.loop.advance(60 * 12);
    const fromLevel = B.world.enemies.map((e) => `${e.type}:${e.state}`);
    const sp = B.world.arena?.enemySpawns || [];
    const onSpawn = B.world.enemies.length ? B.world.enemies.filter((e) => sp.some((s) => Math.hypot(s.x - e.spawnX, s.y - e.spawnY) < 40)).length : 0;
    // Legg til Heavy + Grenadier via arenaens spawnpunkter
    mod.createEnemy(B.world, 'heavy'); mod.createEnemy(B.world, 'grenadier');
    B.loop.advance(60 * 10);
    B.camera.x = p.x + 160; B.camera.y = p.y; B.camera.zoom = 1.0; B.loop.render();
    const lowHigh = { low: 0, high: 0 };
    for (const e of B.world.enemies) if (e.spot && !e.dead) lowHigh[e.spot.type]++;
    return { unpaused, lowHigh, cover: B.world.cover.length, arenaSpawns: sp.length, fromLevel, levelOnSpawn: onSpawn, states: B.world.enemies.map((e) => `${e.type || '?'}:${e.state || '-'}${e.dead ? '†' : ''}`), shots, ev };
  });
  await page.screenshot({ path: path.join(out, 'D-hovedspill.png') });
  await page.evaluate(() => { const B = window.BREACH; const es = B.world.enemies.filter((e) => !e.dead); if (!es.length) return;
    B.camera.x = es.reduce((a, e) => a + e.x, 0) / es.length; B.camera.y = es.reduce((a, e) => a + e.y, 0) / es.length; B.camera.zoom = 1.8; B.loop.render(); });
  await page.screenshot({ path: path.join(out, 'D-hovedspill-naer.png') });
  report.scenarios.D = { ...d, cutsceneSkipped: cutscene, errors: errs };
  await page.close();
}

// ---------------- Scenario M: Flanker-nærkamp – varsel, kun token-holder, ikke skudd+slag i samme vindu, spilleren kan reagere
// Testboten reagerer 0,25 s etter oppladningsstart: null = gjør ingenting, 'roll' = rull unna (KUN bevegelse, ingen iframes),
// 'counter' = nærkamp tilbake via Våpen (stagger avbryter slaget).
{
  const runs = [];
  for (const react of [null, 'roll', 'counter']) for (const seed of [3, 7]) {
    const page = await openTest(seed);
    await page.evaluate((react) => { const b = window.__bt; b.player.hp = b.player.maxHp = 1e6; b.setPlayer(6 * 32 + 4, 12 * 32, 0); b.setHold(true); b.setMeleeReact(react, 0.25);
      b.spawn('grunt', 37 * 32, 8 * 32); b.spawn('grunt', 37 * 32, 16 * 32); b.spawn('flanker', 36 * 32, 3 * 32); }, react);
    if (react === null && seed === 3) await shotWhen(page, 'M-naerkamp-varsel.png', `(b) => { const e = b.world.enemies.find((e) => e.state === 'meleeCharge' && e.stateT > 0.2); return e ? { x: (e.x + b.player.x) / 2, y: (e.y + b.player.y) / 2 } : null; }`, 1800, 2.2);
    await step(page, 24);
    const st = await stats(page);
    const cancelled = await page.evaluate(() => window.__bt.world.enemies.reduce((n, e) => n + (e.meleeCancelled || 0), 0));
    runs.push({ react: react || 'none', seed, ...st.melee, cancelled, playerMeleeHits: st.playerMeleeHits || 0, staggers: st.stagger.events });
    await page.close();
  }
  const sum = (r, k) => runs.filter((x) => x.react === r).reduce((n, x) => n + x[k], 0);
  report.scenarios.M = { runs, byReact: Object.fromEntries(['none', 'roll', 'counter'].map((r) => [r, { charges: sum(r, 'charges'), strikes: sum(r, 'strikes'), hits: sum(r, 'hits'), interrupted: sum(r, 'interrupted') + sum(r, 'cancelled') }])),
    minWarning: Math.min(...runs.map((r) => r.minCharge ?? Infinity)), nonHolder: runs.reduce((n, r) => n + r.nonHolder, 0), shotsNear: runs.reduce((n, r) => n + r.shotsNear, 0) };
}

// ---------------- Scenario K: stagger på Heavy (halv varighet, spin-up avbrytes, ingen skudd) og Grunt (telegraf avbrytes)
{
  const page = await openTest(9);
  await page.evaluate(() => { const b = window.__bt; b.player.hp = b.player.maxHp = 1e6; b.setPlayer(12 * 32, 15 * 32 + 16, 0); b.setHold(true);
    b.spawn('heavy', 30 * 32, 15 * 32); b.spawn('grunt', 30 * 32, 9 * 32); });
  const res = {};
  for (const [type, st] of [['heavy', 'spinup'], ['grunt', 'telegraph']]) {
    res[type] = await page.evaluate(([type, st]) => {
      const b = window.__bt, w = b.world, e = w.enemies.find((x) => x.type === type);
      for (let i = 0; i < 60 * 20 && e.state !== st; i++) b.step(1 / 60);
      if (e.state !== st) return { error: 'nådde ikke ' + st };
      const before = e.state, x0 = e.x, y0 = e.y, shots0 = b.stats.shots;
      e.staggerUntil = w.time + 0.4;                     // som Våpens nærkamp
      b.step(1 / 60);
      const dur = +(e.staggerUntil - w.time + 1 / 60).toFixed(2), during = e.state;
      let moved = 0, shots = 0;
      for (let i = 0; i < 60 && w.time < e.staggerUntil; i++) { b.step(1 / 60); moved = Math.max(moved, Math.hypot(e.x - x0, e.y - y0)); }
      shots = b.stats.shots - shots0;
      return { before, during, staggerDur: dur, moved: +moved.toFixed(1), shotsWhileStaggered: shots, after: e.state, statsShotsDuring: b.stats.stagger.shotsDuring };
    }, [type, st]);
  }
  await page.close();
  report.scenarios.K = res;
}

// ---------------- Scenario V: ekte Levels-bølger i hovedspillet (2-2 Kiln, 2-6 Kiln Alpha, 3-1 Spitter)
// Levels spawner ekte typer via spawnWithWarning (sprekkvarsel), og 2-6 gir første Kiln variant 'alpha' (hp × 2,2 i onSpawn).
// Vi spiller bølgene, venter til fienden av ønsket type (og ev. variant) har kommet opp, og lar den kjempe 14 s.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.BREACH && window.BREACH.world.player, null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.BREACH?.startGame?.());
  const skip = async () => { for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({ cs: !!document.querySelector('.breach-cutscene'), paused: window.BREACH.world.paused }));
    if (st.cs) await page.keyboard.press('Escape'); else if (!st.paused) break;
    await page.waitForTimeout(150); } };
  await skip();
  const res = {};
  for (const [lvl, wave, want, camp, variant] of [[2, 1, 'heavy', false], [2, 5, 'heavy', false, 'alpha'], [3, 0, 'grenadier', false], [3, 0, 'grenadier', true]]) {
    await page.evaluate(async ([lvl]) => { const L = await import('/src/levels/index.js'); L.startLevel(window.BREACH.world, lvl); }, [lvl]);
    await skip();
    res[variant ? 'kilnAlpha' : want + (camp ? 'Camp' : '')] = await page.evaluate(async ([wave, want, camp, variant]) => {
      const B = window.BREACH, w = B.world, L = await import('/src/levels/index.js'), mod = w.modules.enemies;
      w.player.invuln = true; B.loop.stop();
      L._debugWave(w, wave, 0.5);
      let planned = []; const warns = [];
      const offW = w.events.on('spawnWarn', (pl) => { if (pl.type === want) warns.push({ t: +pl.t.toFixed(2), variant: pl.variant ?? null }); });
      const alive = () => { w.player.invuln = true; w.player.hp = Math.max(w.player.hp, 60); };   // Karakter skriver invuln selv (rulle-iframes) → hold spilleren i live hvert steg
      for (let i = 0; i < 60 * 12 && !planned.length; i++) { alive(); B.loop.advance(1); planned = w.enemies.filter((e) => e.type === want && !e.dead && (!variant || e.variant === variant)); }
      offW();
      if (!planned.length) return { error: 'ingen innhopp av ' + want + (variant ? '/' + variant : ''), types: w.enemies.map((e) => e.type + (e.variant ? '/' + e.variant : '')) };
      const src = planned[0];
      // camp: spilleren legger seg bak nærmeste dekning (på siden bort fra grenadieren) og blir liggende – granatens jobb
      let campAt = null;
      if (camp) {
        const p = w.player; let best = null, bd = 1e9;
        for (const c of w.cover) { const cx = c.x + c.w / 2, cy = c.y + c.h / 2, d = Math.hypot(cx - p.x, cy - p.y); if (d < bd) { bd = d; best = c; } }
        if (best) {
          const cx = best.x + best.w / 2, cy = best.y + best.h / 2, a = Math.atan2(cy - src.y, cx - src.x);
          const ux = Math.cos(a), uy = Math.sin(a), half = Math.abs(ux) * best.w / 2 + Math.abs(uy) * best.h / 2;
          const px = cx + ux * (half + (p.r || 15) + 3), py = cy + uy * (half + (p.r || 15) + 3);
          p.x = px; p.y = py; campAt = { x: Math.round(px), y: Math.round(py), cover: best.type };
        }
      }
      const ev = { shot: 0, telegraph: 0, spinup: 0, suppress: 0, grenadeWindup: 0, grenade: 0, explosion: 0, weaponFire: 0, heavyMarchFire: 0, heavyReload: 0, coverFire: 0 };
      let mine = null; const t0 = w.time; const first = {};
      for (const n of Object.keys(ev)) w.events.on(n, (pl) => { if ([pl.entity, pl.owner, pl.projectile?.owner, pl.grenade?.owner, pl.for].includes(mine)) { ev[n]++; if (first[n] == null) first[n] = +(w.time - t0).toFixed(2); } });
      mine = src;
      const states = new Set(); let seenAt = null;
      const ws0 = { ...(w._weapons?.stats || {}) };
      const sq0 = await import('/src/enemies/squad.js');
      for (let i = 0; i < 60 * 14; i++) { alive(); if (campAt) { w.player.x = campAt.x; w.player.y = campAt.y; } B.loop.advance(1); states.add(mine.state); if (seenAt == null && mine.sees) seenAt = +(w.time - t0).toFixed(2); }
      const sqd = sq0.getSquad(w);
      const ws = w._weapons?.stats || {};
      const weaponsUpdate = { steps: 60 * 14, updates: (ws.updates ?? 0) - (ws0.updates ?? 0), skipped: (ws.skipped ?? 0) - (ws0.skipped ?? 0), modsWeapons: !!w.modules?.weapons };
      return { levelsEnemy: { type: mine.type, variant: mine.variant ?? null, displayName: mine.displayName, maxHp: Math.round(mine.maxHp), poseVariant: mod.poseOf(w, mine).variant }, spawnWarns: warns.slice(0, 3), campAt, seenAt, first, campSinceRel: sqd.camp ? +(sqd.camp.since - t0).toFixed(2) : null, campInCover: !!sqd.camp?.inCover, maxThrowers: sqd.stats.maxThrowers,
        levelCalledWith: { type: src.type, x: Math.round(src.spawnX ?? src.x), y: Math.round(src.spawnY ?? src.y) },
        created: { type: mine.type, hp: mine.hp, maxHp: mine.maxHp, loadout: mine.loadout?.slots.map((s) => s.id), dead: mine.dead },
        states: [...states], ev, weaponsUpdate, inBounds: mine.x > w.bounds.x && mine.x < w.bounds.x + w.bounds.w && mine.y > w.bounds.y && mine.y < w.bounds.y + w.bounds.h };
    }, [wave, want, camp, variant]);
    if (want === 'heavy') { await page.evaluate(([v]) => { const B = window.BREACH, e = B.world.enemies.find((x) => x.type === 'heavy' && !x.dead && (!v || x.variant === v)); if (e) { B.camera.x = e.x; B.camera.y = e.y + 60; B.camera.zoom = 1.6; } B.loop.render(); }, [variant]); await page.screenshot({ path: path.join(out, variant ? 'V-levels-kiln-alpha.png' : 'V-levels-heavy.png') }); }
  }
  report.scenarios.V = { ...res, errors: errs };
  await page.close();
}

writeFileSync(path.join(out, 'headless-rapport.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
await browser.close();
server.kill();
