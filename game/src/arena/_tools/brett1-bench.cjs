// Standard målescenario for brett 1 (eies av Arena, se docs/YTELSE.md).
// Kjør: cd game && node src/arena/_tools/brett1-bench.cjs [--scenario=typical|heavy] [--reps=3] [--secs=10] [--view=34] [--flush=1]
// Kessa Yard, 1600×1000, spillet kjører i sin egen rAF-loop. Per bilde samles tid per system fra loop.js sine
// world.perf.mark-merker (system = neste merke − dette). --flush=1 (standard): ctx.getImageData(1×1) før hvert
// render-merke, så rasteriseringen havner på systemet som bestilte den (litt overhead, men ærlig fordeling).
// Lastdriver: fiendene holdes i live (N), syntetiske skudd fylles på til målrate (≈40 % mot dekning),
// granater (eksplosjoner), dødsfall med gjenoppliving. Spilleren er udødelig.
const { createRequire } = require('module'); const rq = createRequire(__dirname + '/../../../../package.json');
const { chromium } = rq('playwright-core'); const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SC = arg('scenario', 'typical'), REPS = +arg('reps', 3), SECS = +arg('secs', 10), VIEW = arg('view', '34'), FLUSH = arg('flush', '1') === '1';
const GB = arg('glowbake', '1');
const SCN = { idle: { n: 0, shots: 0, explEvery: 1e9, burst: 0, deaths: 0, coverFrac: 0 }, typical: { n: 6, shots: 8, explEvery: 6, burst: 1, deaths: 0.5, coverFrac: 0.4 }, heavy: { n: 10, shots: 20, explEvery: 4.5, burst: 3, deaths: 2, coverFrac: 0.4 } }[SC];
function chromePath() { try { const base = path.join(process.env.HOME, '.cache/ms-playwright'); for (const d of fs.readdirSync(base)) for (const q of [path.join(base, d, 'chrome-linux64/chrome'), path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell')]) if (fs.existsSync(q)) return q; } catch (e) { /* */ } return undefined; }
const PORT = 8768, ROOT = path.resolve(__dirname, '../../..');
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: chromePath(), args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const runs = [];
  try {
    for (let rep = 0; rep < REPS; rep++) {
      const load0 = os.loadavg()[0];
      const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`http://127.0.0.1:${PORT}/index.html?view=${VIEW}&skipmenu=1&glowbake=${GB}`); await p.waitForFunction(() => window.BREACH?.world?.arena);
      await p.mouse.click(800, 500); await p.waitForTimeout(1500);
      for (let i = 0; i < 8 && await p.evaluate(() => window.BREACH.world.paused); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
      const res = await p.evaluate(async ({ S, SECS, FLUSH }) => {
        const { world: w } = window.BREACH, E = w.modules.enemies, LV = w.modules.levels;
        const cb = await import('/src/core/combat.js'), G = await import('/src/weapons/grenades.js');
        let fxq = null; try { fxq = await import('/src/effects/index.js'); } catch (e) { /* */ }
        const ctx = document.querySelector('canvas').getContext('2d');
        const d = LV._debug?.(w); const pl = w.player;
        const types = ['grunt', 'flanker', 'heavy', 'grenadier', 'grunt', 'flanker', 'grunt', 'heavy', 'grenadier', 'grunt'];
        let ti = 0; const spawnOne = () => { const a = Math.random() * 6.283, R = 220 + Math.random() * 160; const B = w.bounds;
          const x = Math.max(B.x + 60, Math.min(B.x + B.w - 60, pl.x + Math.cos(a) * R)), y = Math.max(B.y + 60, Math.min(B.y + B.h - 60, pl.y + Math.sin(a) * R)); return E.createEnemy(w, types[ti++ % types.length], x, y); };
        const alive = () => w.enemies.filter((e) => !e.dead);
        for (const e of w.enemies) e.dead = true; while (alive().length < S.n) spawnOne();
        // syntetiske skudd/granater/dødsfall
        let shotsSeen = 0, cHits = 0, expl = 0, deaths = 0; w.events.on('shot', () => shotsSeen++); w.events.on('coverHit', () => cHits++); w.events.on('explosion', () => expl++); w.events.on('death', () => deaths++);
        let tShot = 0, tExpl = 0, tDeath = 0, last = w.time, aiShots = 0;
        const drive = () => {
          if (d) d.queue = []; pl.hp = pl.maxHp || 100; pl.dead = false;
          const dt = Math.max(0, w.time - last); last = w.time; const al = alive(); if (!al.length) return;
          tShot += dt * S.shots;
          while (tShot >= 1) { tShot--; const e = al[(Math.random() * al.length) | 0];
            let tx = pl.x, ty = pl.y;
            if (Math.random() < S.coverFrac && w.cover.length) { const near = w.cover.filter((c) => Math.abs(c.x + c.w / 2 - e.x) < 300 && Math.abs(c.y + c.h / 2 - e.y) < 300 && c.type === 'high'); const c = near[(Math.random() * near.length) | 0]; if (c) { tx = c.x + c.w / 2; ty = c.y + c.h / 2; } }
            cb.spawnProjectile(w, { x: e.x, y: e.y, angle: Math.atan2(ty - e.y, tx - e.x) + (Math.random() - 0.5) * 0.08, team: 'enemy', owner: e, dmg: 0, speed: 900, z: 27 }); }
          tExpl += dt; if (tExpl >= S.explEvery) { tExpl = 0; for (let k = 0; k < S.burst; k++) { const e = al[(Math.random() * al.length) | 0]; G.spawnGrenade(w, { x: e.x, y: e.y, angle: Math.atan2(pl.y - e.y, pl.x - e.x) + (k - 1) * 0.5, distance: 160 + k * 40, team: 'enemy', owner: e, dmg: 0 }); } }
          tDeath += dt * S.deaths; while (tDeath >= 1) { tDeath--; const e = al[(Math.random() * al.length) | 0]; cb.damage(e, 99999, pl, w); }
          while (alive().length < S.n) spawnOne();
        };
        // samler: erstatter world.perf (ingen overlegg)
        const sys = {}, cur = {}; let curN = null, t0 = 0, frames = 0, upd = 0, rnd = 0, rb = 0; const frame = [];
        const add = (k, v) => { cur[k] = (cur[k] || 0) + v; };
        w.perf = { enabled: true, mark(name) {
          if (FLUSH && name.startsWith('render:') && name !== 'render:begin') ctx.getImageData(0, 0, 1, 1);
          const t = performance.now(); if (curN) add(curN, t - t0);
          if (name === 'update:end') { curN = null; return; }
          if (name === 'render:begin') { rb = t; drive(); curN = null; t0 = performance.now(); return; }
          if (name === 'render:end') { curN = null; let u = 0, r = 0; for (const k in cur) { (sys[k] || (sys[k] = [])).push(cur[k]); if (k.startsWith('update')) u += cur[k]; else r += cur[k]; cur[k] = 0; }
            (sys['update (total)'] || (sys['update (total)'] = [])).push(u); (sys['render (total)'] || (sys['render (total)'] = [])).push(r); frames++; return; }
          curN = name; t0 = t; }, setContext() {}, snapshot() { return {}; }, reset() {} };
        // oppvarming 1,5 s, så måling SECS s
        await new Promise((r) => setTimeout(r, 1500));
        for (const k in sys) sys[k].length = 0; frames = 0; shotsSeen = cHits = expl = deaths = 0;
        let raf = [], lt = performance.now(), on = true; const tick = (t) => { raf.push(t - lt); lt = t; if (on) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
        const w0 = w.time; await new Promise((r) => setTimeout(r, SECS * 1000)); on = false; const simS = w.time - w0;
        const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return +(s[Math.min(s.length - 1, Math.floor(s.length * f))] || 0).toFixed(3); };
        const out = {}; for (const k in sys) if (sys[k].length) out[k] = { med: q(sys[k], 0.5), p95: q(sys[k], 0.95) };
        const vs = fxq?.stats?.(w);
        return { frames, simS: +simS.toFixed(2), raf: { med: q(raf, 0.5), p95: q(raf, 0.95) }, systems: out, rates: { shots: +(shotsSeen / simS).toFixed(1), coverHits: +(cHits / simS).toFixed(1), expl: +(expl / simS).toFixed(2), deaths: +(deaths / simS).toFixed(2) }, alive: alive().length, vfx: vs ? { live: vs.live, peak: vs.peak, decals: vs.decals } : null, coverDecals: w.modules.arena.decalStats?.(w) };
      }, { S: SCN, SECS, FLUSH });
      res.load = [+load0.toFixed(2), +os.loadavg()[0].toFixed(2)]; res.errs = errs.slice(0, 3); runs.push(res);
      await p.close();
    }
  } finally { await b.close(); srv.kill(); }
  // median over repetisjoner
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r.systems)))];
  const agg = {}; for (const k of keys) { const a = runs.map((r) => r.systems[k]).filter(Boolean); agg[k] = { med: +med(a.map((x) => x.med)).toFixed(3), p95: +med(a.map((x) => x.p95)).toFixed(3) }; }
  console.log(JSON.stringify({ scenario: SC, view: VIEW, flush: FLUSH, reps: REPS, secs: SECS, cpus: os.cpus().length, median_of_reps: agg, raf: runs.map((r) => r.raf), rates: runs.map((r) => r.rates), frames: runs.map((r) => r.frames), load: runs.map((r) => r.load), vfx: runs.map((r) => r.vfx), coverDecals: runs.map((r) => r.coverDecals), errs: runs.flatMap((r) => r.errs) }, null, 1));
})();
