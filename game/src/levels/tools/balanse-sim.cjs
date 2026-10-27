// Balansesimulering av et nivå (Story og brett). Enkel spillerbot med ekte våpen + «helbredelse ved < 30 hp» (teller som nær-død).
// Bruk: node game/src/levels/tools/balanse-sim.cjs [nivå=1] [kjøringer=3] [port=8793] [tag]
// Ut: JSON med per bølge: tid, fiender, maks samtidig, spawn-gap, dødtid uten fiender, skade tatt, nær-død. Skjermbilder /tmp/shots/bal-<tag>-<bølge>.png
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const EXE = '/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const [LV = 1, RUNS = 3, PORT = 8793, TAG = 'run'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true });
  const all = [], errsAll = [];
  for (let run = 0; run < +RUNS; run++) {
    const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errsAll.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errsAll.push(String(e)));
    await page.goto(`http://localhost:${PORT}/index.html`); await page.waitForFunction(() => window.BREACH);
    await page.evaluate(async ({ LV, run }) => {
      const B = window.BREACH, W = B.world, L = W.modules.levels, cam = B.camera, inp = B.input;
      const geom = await import('/src/core/geom.js'), wpn = await import('/src/weapons/index.js');
      document.getElementById('start-screen')?.remove(); W.paused = false; B.loop.stop();
      if (run) { let s = 1234 + run * 7919; W.rng = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); }
      const S = window.__sim = { waves: {}, cur: null, done: false, log: [] };
      const Wv = (id) => (S.waves[id] ||= { id, t0: null, t1: null, spawns: [], dmg: 0, nearDeath: 0, maxAlive: 0, idle: 0, idleMax: 0, idleRun: 0, kills: 0, firstSpawn: null, gapBefore: null, prevEnd: null });
      let lastEnd = null;
      W.events.on('waveStart', (e) => { S.cur = Wv(e.id); S.cur.t0 = W.time; S.cur.prevEnd = lastEnd; });
      W.events.on('waveEnd', (e) => { const w = Wv(e.id); w.t1 = W.time; lastEnd = W.time; S.cur = null; });
      W.events.on('spawnRise', () => { const w = S.cur; if (!w) return; w.spawns.push(W.time); if (w.firstSpawn == null) { w.firstSpawn = W.time; w.gapBefore = w.prevEnd != null ? W.time - w.prevEnd : null; } });
      W.events.on('hit', (e) => { if (e.target === W.player && S.cur) S.cur.dmg += e.amount || 0; });
      W.events.on('death', (e) => { if (e.target?.team === 'enemy' && S.cur) S.cur.kills++; });
      W.events.on('levelEnd', () => { S.done = true; });
      L.startLevel(W, LV, { skipCutscenes: true });
      const STEP = 1 / 60; let noLos = 0;
      for (let i = 0; i < 60 * 60 * 9 && !S.done; i++) {
        const p = W.player, d = L._debug(W);
        if (d.cards && performance.now() - d.cards.t0 * 1000 > 700) { dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' })); }
        if (W.paused || d.phase === 'upgrade') { await new Promise((r) => setTimeout(r, 30)); continue; }
        const alive = W.enemies.filter((e) => !e.dead);
        if (S.cur) {
          S.cur.maxAlive = Math.max(S.cur.maxAlive, alive.length);
          const pend = (d.pend || []).filter((h) => !h.enemy && !h.cancelled).length;
          if (!alive.length && !pend) { S.cur.idle += STEP; S.cur.idleRun += STEP; S.cur.idleMax = Math.max(S.cur.idleMax, S.cur.idleRun); } else S.cur.idleRun = 0;
        }
        // bot: sikt på nærmeste synlige fiende, skyt; ellers gå mot nærmeste fiende
        let tgt = null, best = 1e9;
        for (const e of alive) { const dd = Math.hypot(e.x - p.x, e.y - p.y); if (dd < best && dd < 900 && geom.lineOfSight(W, p.x, p.y, e.x, e.y)) { best = dd; tgt = e; } }
        inp.mouse.left = inp.mouse.right = false;
        if (tgt) {
          noLos = 0; const s = cam.worldToScreen(tgt.x, tgt.y); inp.mouse.x = s.x; inp.mouse.y = s.y; inp.mouse.right = true; inp.mouse.left = (i % 2) === 0;
          const c = wpn.current(p); if (c && c.mag === 0 && !c.reloading) wpn.startReload(W, p);
          if (c && c.mag === 0 && c.reserve === 0) wpn.refill(W, p, {});
        } else if (alive.length) {
          noLos += STEP;
          if (noLos > 3) { // gå mot nærmeste fiende (enkelt, uten stifinning)
            let n = alive[0], nd = 1e9; for (const e of alive) { const dd = Math.hypot(e.x - p.x, e.y - p.y); if (dd < nd) { nd = dd; n = e; } }
            const a = Math.atan2(n.y - p.y, n.x - p.x);
            for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) { const nx = p.x + Math.cos(a + off) * 3, ny = p.y + Math.sin(a + off) * 3; if (!geom.raycastCover(W, p.x, p.y, nx + Math.cos(a + off) * 18, ny + Math.sin(a + off) * 18, { types: ['high', 'low'] })) { p.x = nx; p.y = ny; break; } }
          }
        }
        if (p.hp < 30 && !p.dead && S.cur) { S.cur.nearDeath++; p.hp = p.maxHp; }
        B.loop.advance(1);
        if (i % 120 === 0) await new Promise((r) => setTimeout(r, 0));
        if (S.cur && !S.cur.shot && S.cur.maxAlive >= 3 && alive.length >= S.cur.maxAlive) S.cur.shot = 'want';
      }
      S.timeout = !S.done;
    }, { LV: +LV, run }).catch((e) => errsAll.push('sim: ' + e.message));
    const res = await page.evaluate(() => window.__sim);
    all.push(res);
    if (run === 0) await page.screenshot({ path: `/tmp/shots/bal-${TAG}-end.png` });
    await page.close();
  }
  // oppsummering
  const ids = Object.keys(all[0]?.waves || {});
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  const avg = (f) => r1(all.map(f).filter((x) => x != null).reduce((a, b, _, A) => a + b / A.length, 0));
  const table = ids.map((id) => {
    const W = (s) => s.waves[id] || {};
    const gaps = (s) => { const sp = W(s).spawns || []; let m = 0; for (let i = 1; i < sp.length; i++) m = Math.max(m, sp[i] - sp[i - 1]); return m; };
    return { id, tid: avg((s) => W(s).t1 != null ? W(s).t1 - W(s).t0 : null), fiender: W(all[0]).spawns?.length, drept: avg((s) => W(s).kills), maksSamtidig: Math.max(...all.map((s) => W(s).maxAlive || 0)),
      forsteSpawn: avg((s) => W(s).firstSpawn != null ? W(s).firstSpawn - W(s).t0 : null), maksSpawnGap: avg(gaps), dodtidMaks: avg((s) => W(s).idleMax), pauseFoer: avg((s) => W(s).gapBefore),
      skade: avg((s) => W(s).dmg), naerDod: avg((s) => W(s).nearDeath) };
  });
  console.log(JSON.stringify({ runs: all.length, timeouts: all.filter((s) => s.timeout).length, table, errs: [...new Set(errsAll)].slice(0, 10) }, null, 1));
  await b.close();
})();
