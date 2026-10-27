// Reproduserbart ytelsesscenario (eies av Arena, budsjett i docs/YTELSE.md).
// Bruk:  cd /workspace/breach/game && node src/arena/_tools/perf-scenario.cjs [--view=34|top] [--vp=1280x720] [--n=10] [--secs=6] [--ab]
// Starter egen http-server (port 8767), index.html?view=..., hopper over intro, spawner en full bølge (n fiender, blandet
// grunt/flanker/heavy/grenadier) rundt spilleren, gjør spilleren udødelig og skyter mot nærmeste fiende (granat hvert 3. s).
// Måler: FPS/p95 (rAF), CPU-profil (CDP) med ms/bilde per SYSTEM – attribuert via kalltreet under loop.js render()/step().
// --ab: i tillegg A/B med arena av (world._arenaSkip) og 3/4-dekning av.
// --bench: synkron segmentmåling (anbefalt på delt boks): stopper loopen og kjører K bilder selv – step() og så
//   render-rekkefølgen fra core/loop.js segment for segment, med ctx.getImageData(1×1) etter hvert segment så
//   rasteriseringen tvinges ut og havner på riktig system. Median + p90 per segment (robust mot last fra andre).
const { createRequire } = require('module');
const r = createRequire(__dirname + '/../../../../package.json');
const { chromium } = r('playwright-core');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : (process.argv.includes('--' + k) ? true : d); };
const VIEW = String(arg('view', '34')), [VW, VH] = String(arg('vp', '1280x720')).split('x').map(Number), N = +arg('n', 10), SECS = +arg('secs', 6), AB = !!arg('ab', false);
const BENCH = !!arg('bench', false), K = +arg('k', 120);
const PORT = 8767, ROOT = path.resolve(__dirname, '../../..');
function chromePath() { try { const base = path.join(process.env.HOME, '.cache/ms-playwright'); for (const d of fs.readdirSync(base)) for (const q of [path.join(base, d, 'chrome-linux64/chrome'), path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell')]) if (fs.existsSync(q)) return q; } catch (e) { /* */ } return fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined; }
const measure = (p, n = 240) => p.evaluate((n) => new Promise((res) => { const d = []; let l = performance.now(), k = 0; const f = (t) => { d.push(t - l); l = t; if (++k < n) requestAnimationFrame(f); else { d.sort((a, b) => a - b); const avg = d.reduce((a, b) => a + b) / d.length; res({ fps: +(1000 / avg).toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), worst: +d[d.length - 1].toFixed(1) }); } }; requestAnimationFrame(f); }), n);

// System for et direkte kall fra render()/step() i core/loop.js
function systemOf(cf) {
  const u = cf.url, f = cf.functionName, m = u.match(/\/src\/(.+)$/); const file = m ? m[1] : u;
  if (/^arena\//.test(file)) return f === 'drawTop' ? 'arena.drawTop (tak/lys/glød/blink)' : f === 'draw' ? 'arena.draw (gulv)' : f === 'update' ? 'update: arena' : 'arena (annet)';
  if (/^shared\/depth/.test(file)) return 'drawSorted (aktører + dekning)';
  if (/^enemies\//.test(file)) return f === 'update' ? 'update: enemies (AI)' : 'enemies.draw (tillegg)';
  if (/^player\//.test(file)) return f === 'update' ? 'update: player' : f === 'drawHud' ? 'HUD' : 'player.draw (tillegg)';
  if (/^weapons\//.test(file)) return f === 'update' ? 'update: weapons' : 'weapons.draw (spor/granater)';
  if (/^levels\//.test(file)) return f === 'drawHud' ? 'HUD' : 'update: levels';
  if (/^core\/combat/.test(file)) return f === 'drawProjectiles' ? 'prosjektiler (tegning)' : 'update: prosjektiler';
  if (/^core\/effects/.test(file)) return f === 'drawEffects' ? 'effekter (tegning)' : 'update: effekter';
  if (/^shared\/separateActors/.test(file)) return 'update: physics';
  if (/^audio\//.test(file)) return 'update: audio';
  if (/^core\/(camera|input)/.test(file)) return 'update: kamera/input';
  if (/^core\/debug/.test(file)) return 'debug';
  return f ? `annet: ${f}` : 'loop (egen tid)';
}

const LOAD0 = require('os').loadavg().map((x) => +x.toFixed(2));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 800));
  const b = await chromium.launch({ executablePath: chromePath(), args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  try {
    const p = await b.newPage({ viewport: { width: VW, height: VH } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`http://127.0.0.1:${PORT}/index.html?view=${VIEW}`); await p.waitForFunction(() => window.BREACH?.world);
    await p.waitForTimeout(1500);
    await p.evaluate(() => window.BREACH.startGame && window.BREACH.startGame());
    for (let i = 0; i < 12; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.BREACH.world.paused === false)) break; await p.keyboard.press('Escape'); }
    // full bølge rundt spilleren (deterministisk plassering), stopp nivåets egne innhopp
    const spawned = await p.evaluate((N) => {
      const w = window.BREACH.world, E = w.modules.enemies, L = w.modules.levels, pl = w.player;
      const d = L._debug?.(w); if (d) { d.queue = []; }
      const types = ['grunt', 'grunt', 'flanker', 'heavy', 'grenadier', 'grunt', 'flanker', 'grenadier', 'grunt', 'heavy', 'grunt', 'flanker'];
      let n = 0;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2, R = 260 + (i % 3) * 60;
        let x = pl.x + Math.cos(a) * R, y = pl.y + Math.sin(a) * R;
        const B = w.bounds; x = Math.max(B.x + 60, Math.min(B.x + B.w - 60, x)); y = Math.max(B.y + 60, Math.min(B.y + B.h - 60, y));
        if (E.createEnemy(w, types[i % types.length], x, y)) n++;
      }
      setInterval(() => { if (w.player) { w.player.hp = w.player.maxHp || 100; w.player.dead = false; } if (d) d.queue = []; }, 50);
      return n;
    }, N);
    const aim = async () => p.evaluate(() => { const { world: w, camera: c } = window.BREACH; const pl = w.player; let best = null, bd = 1e9; for (const e of w.enemies) if (!e.dead) { const dd = Math.hypot(e.x - pl.x, e.y - pl.y); if (dd < bd) { bd = dd; best = e; } } const q = best ? c.worldToScreen(best.x, best.y) : { x: innerWidth * 0.7, y: innerHeight * 0.4 }; const cv = document.querySelector('canvas'), rr = cv.getBoundingClientRect(); return { x: rr.left + q.x * rr.width / cv.width, y: rr.top + q.y * rr.height / cv.height }; });
    let firing = true, k = 0;
    const loop = (async () => { await p.mouse.down(); while (firing) { const s = await aim(); await p.mouse.move(Math.max(5, Math.min(VW - 5, s.x)), Math.max(5, Math.min(VH - 5, s.y))); if (++k % 20 === 0) await p.keyboard.press('KeyG'); await p.waitForTimeout(150); } await p.mouse.up(); })();
    await p.waitForTimeout(1200);
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
    await p.evaluate(() => { window.__fr = 0; const f = () => { window.__fr++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const st0 = await p.evaluate(() => { const w = window.BREACH.world; return { alive: w.enemies.filter((e) => !e.dead).length, view: w.view, depthSorted: w.depthSorted }; });
    const f0 = await p.evaluate(() => window.__fr);
    await cdp.send('Profiler.start');
    const fpsRun = measure(p, Math.round(SECS * 60));
    const fps = await fpsRun;
    const { profile } = await cdp.send('Profiler.stop');
    const frames = (await p.evaluate(() => window.__fr)) - f0;
    const st1 = await p.evaluate(() => { const w = window.BREACH.world; return { alive: w.enemies.filter((e) => !e.dead).length, projectiles: (w.projectiles || []).length, effects: (w.effects || []).length, grenades: (w.grenades || []).length }; });
    // attribusjon
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const dt = {}; for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i] || 0);
    const incl = (id) => { const n = byId.get(id); let t = dt[id] || 0; for (const c of n.children || []) t += incl(c); return t; };
    const sys = new Map(); let total = 0, idle = 0, gc = 0, loopT = 0;
    const add = (k, v) => sys.set(k, (sys.get(k) || 0) + v);
    for (const n of profile.nodes) { total += dt[n.id] || 0; if (n.callFrame.functionName === '(idle)') idle += dt[n.id] || 0; if (n.callFrame.functionName === '(garbage collector)') gc += dt[n.id] || 0; }
    for (const n of profile.nodes) {
      const cf = n.callFrame; if (!/core\/loop\.js$/.test(cf.url) || !/^(render|step)$/.test(cf.functionName)) continue;
      loopT += incl(n.id); add('loop (egen tid)', dt[n.id] || 0);
      for (const c of n.children || []) { const cn = byId.get(c); const cc = cn.callFrame; let key = systemOf(cc);
        if (cc.functionName === 'call' && /core\/loop/.test(cc.url)) { add('loop (egen tid)', dt[c] || 0); for (const g of cn.children || []) add(systemOf(byId.get(g).callFrame), incl(g)); continue; }
        if (/^(fillRect|setTransform|apply)$/.test(cc.functionName) || /core\/camera/.test(cc.url)) key = cc.functionName === 'update' ? 'update: kamera/input' : 'loop: tøm/kamera';
        add(key, incl(c)); }
    }
    const ms = (us) => +(us / 1000 / frames).toFixed(2);
    const rows = [...sys.entries()].map(([k, v]) => [k, ms(v)]).sort((a, b) => b[1] - a[1]);
    const out = { view: VIEW, vp: `${VW}x${VH}`, spawned, ...st0, end: st1, frames, secs: SECS, fps, js_ms_per_frame: ms(total - idle), loop_ms_per_frame: ms(loopT), gc_ms_per_frame: ms(gc), systems: Object.fromEntries(rows) };
    if (AB) {
      const W = 'window.BREACH.world'; out.ab = {};
      for (const [k, v] of [['normal', `${W}._arenaSkip = null`], ['arena_off', `${W}._arenaSkip = { cover: 1, floor: 1, top: 1 }`], ['cover34_off', `${W}._arenaSkip = { cover: 1 }`], ['normal_again', `${W}._arenaSkip = null`]]) { await p.evaluate(v); await p.waitForTimeout(300); out.ab[k] = await measure(p); }
    }

    if (BENCH) {
      out.bench = await p.evaluate(async (K) => {
        const B = window.BREACH, w = B.world, cam = B.camera, loop = B.loop, M = w.modules;
        const fx = await import('/src/core/effects.js'), cb = await import('/src/core/combat.js'), dp = await import('/src/shared/depth.js');
        const ctx = document.querySelector('canvas').getContext('2d');
        loop.stop();
        const flush = () => ctx.getImageData(0, 0, 1, 1);
        const segs = {}; const rec = (k, v) => (segs[k] || (segs[k] = [])).push(v);
        let t;
        const T = (k, f) => { t = performance.now(); f(); flush(); rec(k, performance.now() - t); };
        for (let i = 0; i < K; i++) {
          T('logikk (step)', () => loop.step(1 / 60));
          const c = ctx.canvas;
          T('tøm + kamera', () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#121416'; ctx.fillRect(0, 0, c.width, c.height); cam.apply(ctx); });
          T('arena.draw (gulv)', () => M.arena?.draw?.(ctx, w, cam));
          T('effekter under', () => fx.drawEffects(ctx, w, cam, 'under'));
          T('arena.drawCover', () => M.arena?.drawCover?.(ctx, w, cam));
          w.depthSorted = w.view === '34' && dp.canSort(w);
          T('drawSorted (dekning+aktører)', () => { if (w.depthSorted) dp.drawSorted(ctx, w, cam, { cover: M.arena?.coverObjects?.(w), drawCover: M.arena?.drawCoverObject }); });
          T('enemies.draw', () => M.enemies?.draw?.(ctx, w, cam));
          T('player.draw', () => M.player?.draw?.(ctx, w, cam));
          T('weapons.draw', () => M.weapons?.draw?.(ctx, w, cam));
          T('prosjektiler', () => cb.drawProjectiles(ctx, w));
          T('effekter over', () => fx.drawEffects(ctx, w, cam, 'over'));
          T('arena.drawTop', () => M.arena?.drawTop?.(ctx, w, cam));
          T('HUD', () => { ctx.setTransform(1, 0, 0, 1, 0, 0); M.hud?.draw?.(ctx, w, cam); (M.level || M.levels)?.drawHud?.(ctx, w, cam); M.player?.drawHud?.(ctx, w, cam); });
          if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        const o = {}; let sumMed = 0;
        for (const [k, a] of Object.entries(segs)) { a.sort((x, y) => x - y); const med = a[a.length >> 1], p90 = a[Math.floor(a.length * 0.9)]; sumMed += med; o[k] = { med: +med.toFixed(2), p90: +p90.toFixed(2) }; }
        o['SUM (median)'] = +sumMed.toFixed(2);
        // kontroll: hele loop.render() + step i ett, med én flush (nærmest det spillet faktisk gjør)
        { const a = []; for (let i = 0; i < 60; i++) { t = performance.now(); loop.step(1 / 60); loop.render(); flush(); a.push(performance.now() - t); if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0)); } a.sort((x, y) => x - y); o['HEL ramme step+render (median)'] = +a[30].toFixed(2); o['HEL ramme p90'] = +a[54].toFixed(2); }
        // drawSorted i deler: bare dekning vs bare aktører
        const part = (opt) => { const a = []; for (let i = 0; i < 30; i++) { ctx.setTransform(1, 0, 0, 1, 0, 0); cam.apply(ctx); t = performance.now(); dp.drawSorted(ctx, w, cam, opt); flush(); a.push(performance.now() - t); } a.sort((x, y) => x - y); return +a[15].toFixed(2); };
        if (w.depthSorted) { o['  dekning alene'] = part({ cover: M.arena.coverObjects(w), drawCover: M.arena.drawCoverObject, actors: [] }); o['  aktører alene'] = part({ silhouettes: false }); }
        const alive = w.enemies.filter((e) => !e.dead).length; o.aktorer = alive + 1; o.effekter = (w.effects || []).length;
        loop.start();
        return o;
      }, K);
    }
    firing = false; await loop;
    out.errors = errs.slice(0, 5);
    out.load = { start: LOAD0, slutt: require('os').loadavg().map((x) => +x.toFixed(2)) };
    console.log(JSON.stringify(out, null, 1));
  } finally { await b.close(); srv.kill(); }
})();
