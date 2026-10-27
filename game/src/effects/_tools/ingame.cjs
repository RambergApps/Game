// Spilltest av effektene i en MIDLERTIDIG KOPI av spillet med core-loop-effects.diff (rører ikke originalen).
// node ingame.cjs [baseUrl=http://localhost:8766] [outPrefix=/workspace/breach/reviews/img/effekter-spill] [sek=30] [quality=high]
// Starter bane 1, gjør spilleren usårbar (bare i testsiden), sikter på nærmeste fiende og skyter. Tar skjermbilder ved sprekk,
// oppbrudd, treff og død + jevnlig, og måler effektsystemets update/draw-tid per bilde i spillet (uten tilbakelesing).
const path = require('path'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => {
  const [base = 'http://localhost:8766', out = '/workspace/breach/reviews/img/effekter-spill', secs = '30', q = 'high'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: (process.env.CHROME || [process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((x) => require('fs').existsSync(x))), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const W = 1600, H = 900, p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[vfx]')) errs.push(m.type() + ': ' + m.text()); });
  await p.goto(base + '/index.html', { waitUntil: 'commit', timeout: 0 }); await p.waitForFunction(() => window.BREACH, null, { timeout: 60000 });
  await p.evaluate((q) => {
    const B = window.BREACH, w = B.world; w._vfx && (w._vfx.Q = w._vfx.Q); B.startGame();
    import('/src/effects/index.js').then((FX) => FX.setQuality(w, q));
    window.__ev = []; for (const t of ['spawnWarn', 'spawnRise', 'projectileHit', 'death', 'coverHit', 'explosion', 'melee']) w.events.on(t, (e) => { if (t === 'melee' && e?.phase !== 'hit') return; window.__ev.push({ t, time: w.time, enemy: e?.target?.team === 'enemy', x: e?.x, y: e?.y }); if (t === 'spawnWarn' || t === 'spawnRise') window.__hold = { x: e.x, y: e.y, until: performance.now() + 900 }; });
    window.__ms = []; const tick = () => { const H = window.__hold, cm = B.camera; if (H && performance.now() < H.until && cm) { cm.x += (H.x - cm.x) * 0.5; cm.y += (H.y - cm.y) * 0.5; } const s = w._vfx?.stats; if (s) window.__ms.push([s.updMs || 0, s.underMs || 0, s.overMs || 0, w._vfx.pool.live]); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  }, q);
  let shots = 0, lastShot = { spawnWarn: -9, spawnRise: -9, projectileHit: -9, death: -9, explosion: -9, melee: -9 }, lastNade = Date.now(), seen = 0; const t0 = Date.now(), files = [];
  await p.mouse.move(W / 2 + 200, H / 2);
  while (Date.now() - t0 < +secs * 1000) {
    const st = await p.evaluate(() => {
      const B = window.BREACH, w = B.world, pl = w.player, cam = B.camera, c = document.getElementById('game'); if (pl) { pl.invuln = true; pl.hp = pl.maxHp ?? pl.hp; }
      const en = (w.enemies || []).filter((e) => !e.dead && (!e.rise || true)); let best = null, bd = 1e9;
      for (const e of en) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < bd) { bd = d; best = e; } }
      const toS = (x, y) => [(x - cam.x - (cam.shakeX || 0)) * cam.zoom + c.width / 2, (y - cam.y - (cam.shakeY || 0)) * cam.zoom + c.height / 2];
      return { aim: best ? toS(best.x, best.y - 16) : null, ev: window.__ev.length, time: w.time, n: en.length, dist: bd };
    });
    if (!st.n) await p.keyboard.press('Escape');
    if (st.aim) { await p.mouse.move(st.aim[0], st.aim[1]); await p.mouse.down(); } else await p.mouse.up();
    if (st.aim && st.dist < 70) { await p.keyboard.press('KeyF'); }
    else if (st.aim && st.dist > 140 && Date.now() - lastNade > 7000) { lastNade = Date.now(); await p.mouse.up(); await p.keyboard.down('KeyG'); await p.waitForTimeout(500); await p.keyboard.up('KeyG'); }
    const ev = await p.evaluate((k) => window.__ev.slice(k), seen); seen += ev.length;
    for (const e of ev) {
      const key = e.t === 'coverHit' ? null : e.t; if (!key || (key === 'projectileHit' && !e.enemy)) continue;
      const gap = key === 'projectileHit' ? 2.5 : 1.5; if (e.time - lastShot[key] < gap || shots > 40) continue; lastShot[key] = e.time;
      const delay = key === 'spawnWarn' ? 450 : key === 'spawnRise' ? 120 : key === 'death' ? 160 : key === 'explosion' ? 90 : key === 'melee' ? 40 : 60; await p.waitForTimeout(delay);
      const f = `${out}-${String(++shots).padStart(2, '0')}-${key}.png`; await p.screenshot({ path: f }); files.push(f);
    }
    await p.waitForTimeout(80);
  }
  await p.mouse.up();
  console.log('state', JSON.stringify(await p.evaluate(() => ({ time: window.BREACH.world.time, ev: window.__ev.length, kinds: window.__ev.reduce((m, e) => (m[e.t] = (m[e.t] || 0) + 1, m), {}), level: window.BREACH.world.level?.id, paused: window.BREACH.world.paused }))));
  await p.screenshot({ path: out + '-end.png' });
  const ms = await p.evaluate(() => window.__ms); const tot = ms.map((m) => m[0] + m[1] + m[2]).sort((a, b) => a - b), Pc = (x) => +(tot[Math.floor(tot.length * x)] || 0).toFixed(2);
  const live = ms.map((m) => m[3]); console.log(JSON.stringify({ q, frames: tot.length, avg: +(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(3), p50: Pc(0.5), p95: Pc(0.95), max: Pc(0.999), peakLive: Math.max(...live) }));
  console.log(files.join('\n')); if (errs.length) console.log('ERR', errs.slice(0, 8)); await b.close();
})();
