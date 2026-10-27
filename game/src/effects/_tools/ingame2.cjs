// Spilltest v2: tar bilder INNE i siden (canvas.toDataURL i rAF) et fast antall ms etter hendelsen, så skjermbildet viser
// effekten i riktig fase selv om SwiftShader er treg. Testhjelp (bare i testsiden): spilleren er usårbar, og for nærkamp
// flyttes spilleren rett ved siden av nærmeste fiende. Rører ikke spillfilene.
// node ingame2.cjs [baseUrl] [outPrefix] [sek=60] [quality=high]
const path = require('path'), fs = require('fs'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => {
  const [base = 'http://localhost:8766', out = '/tmp/ig/v2', secs = '60', q = 'high'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: (process.env.CHROME || [process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((x) => require('fs').existsSync(x))), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const W = 1600, H = 900, p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [], warns = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); if (m.type() === 'warning' && /vfx/.test(m.text())) warns.push(m.text()); });
  await p.goto(base + '/index.html' + (process.env.QS || ''), { waitUntil: 'commit', timeout: 0 }); await p.waitForFunction(() => window.BREACH, null, { timeout: 60000 });
  await p.evaluate((q) => {
    const B = window.BREACH, w = B.world; B.startGame(); import('/src/effects/index.js').then((FX) => FX.setQuality(w, q));
    const c = document.getElementById('game'); window.__caps = []; window.__ev = {}; const want = []; const last = {};
    const sched = (key, ms, max = 3, gap = 1.5, ex, ey, ez = 0) => { const n = window.__ev[key] = (window.__ev[key] || 0) + 1; if (n > 40) return;
      if ((last[key] ?? -9) > w.time - gap || window.__caps.filter((x) => x.key.startsWith(key)).length >= max) return; last[key] = w.time;
      const t0 = performance.now(); for (const d of [].concat(ms)) want.push({ key: key + '-' + d + 'ms', at: t0 + d, ex, ey: ey == null ? null : ey - (ez || 0) * 0.75 }); };   // 0,75 = PROJ.zScale
    // Kamerafiks: ta transformen som faktisk ble brukt i siste tegning (camera.apply), ikke cam-feltene nå (hold/oppdatering kan ha flyttet dem)
    { const cm = B.camera, ap = cm.apply.bind(cm); window.__T = null; cm.apply = (ctx) => { ap(ctx); const m = ctx.getTransform(); window.__T = { a: m.a, e: m.e, f: m.f }; }; }
    w.events.on('weaponFire', (e) => e?.team === 'player' && sched('muzzle', 16, 3, 3, e.x, e.y, e.z));
    w.events.on('bulletImpact', (e) => { if (e?.kind === 'cover') sched('hit-' + (e.surface || 'x'), [20, 120], 6, 2, e.x, e.y, e.z); else if (e?.target?.team === 'enemy') sched('hit-chitin', [20, 120], 4, 2, e.x, e.y, e.z); });
    w.events.on('coverHit', () => (window.__ev.coverHit = (window.__ev.coverHit || 0) + 1));
    const cnt = (k, n = 1) => (window.__ev[k] = (window.__ev[k] || 0) + n);
    w.events.on('bulletImpact', (e) => cnt('BI-' + (e?.kind || '?'))); w.events.on('explosion', () => cnt('EXPL')); w.events.on('melee', (e) => e?.phase === 'hit' && cnt('MELEE-hits', e.hits?.length || 0)); w.events.on('weaponFire', (e) => { cnt('FIRE'); if (e?.draw) cnt('FIRE-draw'); });
    w.events.on('explosion', (e) => sched('explosion', [50, 300], 4, 1, e.x, e.y));
    w.events.on('melee', (e) => e?.phase === 'hit' && sched(e.hits?.length ? (e.hits.some((h) => h.killed) ? 'melee-kill' : 'melee') : 'melee-miss', [30, 150], 6, 0.5, e.x, e.y));
    w.events.on('death', () => sched('death', 150, 2, 2));
    w.events.on('spawnWarn', (e) => { sched('spawnWarn', 400, 1, 3); window.__hold = { x: e.x, y: e.y, until: performance.now() + 900 }; });
    w.events.on('spawnRise', (e) => { sched('spawnRise', 150, 1, 3); window.__hold = { x: e.x, y: e.y, until: performance.now() + 600 }; });
    window.__ms = [];
    const tick = () => { const s = w._vfx?.stats; if (s) window.__ms.push([s.updMs || 0, s.underMs || 0, s.overMs || 0, w._vfx.pool.live]);
      const Hh = window.__hold, cm = B.camera; if (Hh && performance.now() < Hh.until && cm) { cm.x += (Hh.x - cm.x) * 0.5; cm.y += (Hh.y - cm.y) * 0.5; }
      const now = performance.now(); for (let i = want.length - 1; i >= 0; i--) if (now >= want[i].at) { const T = window.__T, sx = want[i].ex == null || !T ? null : want[i].ex * T.a + T.e, sy = want[i].ey == null || !T ? null : want[i].ey * T.a + T.f;
        window.__caps.push({ key: want[i].key, url: c.toDataURL('image/png'), sx, sy }); want.splice(i, 1); }
      requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  }, q);
  const t0 = Date.now(); let lastT = -1, lastNade = Date.now(), lastMelee = Date.now(), saved = 0;
  while (Date.now() - t0 < +secs * 1000) {
    const doMelee = Date.now() - lastMelee > 6000;
    const st = await p.evaluate((doMelee) => {
      const B = window.BREACH, w = B.world, pl = w.player, cam = B.camera, c = document.getElementById('game'); if (pl) { pl.invuln = true; pl.hp = pl.maxHp ?? pl.hp; }
      const en = (w.enemies || []).filter((e) => !e.dead && !e.rising); let best = null, bd = 1e9;
      for (const e of en) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < bd) { bd = d; best = e; } }
      let tele = false; if (doMelee && best && pl) { pl.x = best.x; pl.y = best.y + 34; tele = true; bd = 34; }
      const r = c.getBoundingClientRect(), sx = r.width / c.width, toS = (x, y) => [((x - cam.x - (cam.shakeX || 0)) * cam.zoom + c.width / 2) * sx, ((y - cam.y - (cam.shakeY || 0)) * cam.zoom + c.height / 2) * sx];
      return { aim: best ? toS(best.x, best.y - 12) : null, time: w.time, n: en.length, dist: bd, tele };
    }, doMelee);
    if (st.time === lastT) await p.keyboard.press('Escape'); lastT = st.time;
    if (st.aim) await p.mouse.move(st.aim[0], st.aim[1]);
    if (st.tele) { lastMelee = Date.now(); await p.mouse.up(); await p.waitForTimeout(60); await p.keyboard.press('KeyF'); }
    else if (st.aim && Date.now() - lastNade > 8000) { lastNade = Date.now(); await p.mouse.up(); await p.keyboard.down('KeyG'); await p.waitForTimeout(450); await p.keyboard.up('KeyG'); }
    else if (st.aim) await p.mouse.down(); else await p.mouse.up();
    const caps = await p.evaluate(() => window.__caps.splice(0));
    for (const cp of caps) { const f = `${out}-${String(++saved).padStart(2, '0')}-${cp.key}.png`; fs.writeFileSync(f, Buffer.from(cp.url.split(',')[1], 'base64')); console.log(f + (cp.sx != null ? ` @${cp.sx | 0},${cp.sy | 0}` : '')); }
    await p.waitForTimeout(60);
  }
  await p.mouse.up();
  const r = await p.evaluate(() => ({ view: window.BREACH.world.view, ev: window.__ev, ms: window.__ms, stats: window.BREACH.world._vfx?.stats }));
  const tot = r.ms.map((m) => m[0] + m[1] + m[2]).sort((a, b) => a - b), Pc = (x) => +(tot[Math.floor(tot.length * x)] || 0).toFixed(2);
  console.log(JSON.stringify({ q, frames: tot.length, avg: +(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(3), p50: Pc(0.5), p95: Pc(0.95), max: Pc(0.999), peakLive: Math.max(...r.ms.map((m) => m[3])), hiddenSpawns: r.stats?.hidden || 0, view: r.view, ev: r.ev, byType: r.stats?.byType }));
  if (errs.length) console.log('ERR', errs.slice(0, 8)); if (warns.length) console.log('WARN', warns.slice(0, 8)); await b.close();
})();
