// Sjekk (Arena 27.10): ingen celle inne i høy hindring (vegg/bygg/container …) er gangbar i walkable.js eller i fiendenes
// navgrid, og fiender som spawner og går havner aldri inne i en. Feiler (kode 1) ved brudd.  node src/arena/_tools/high-walk-check.cjs [query]
const { chromium } = require('/workspace/breach/node_modules/playwright-core'); const { spawn } = require('child_process');
(async () => { const Q = process.argv[2] || ''; const srv = spawn('python3', ['-m', 'http.server', '8903'], { cwd: __dirname + '/../../..', stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
 const b = await chromium.launch({ headless: true, channel: 'chrome' }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
 await p.goto('http://localhost:8903/index.html' + Q); await p.waitForFunction(() => window.BREACH && window.BREACH.world.arena);
 await p.mouse.click(640, 360); await p.waitForTimeout(1500); await p.keyboard.press('Space'); await p.waitForTimeout(500); await p.keyboard.press('Escape');
 const stat = await p.evaluate(async () => { const w = window.BREACH.world, A = await import('/src/arena/walkable.js'), N = await import('/src/enemies/nav.js');
  const nav = new N.NavGrid(w); nav.build?.(); const highs = w.cover.filter(c => c.type === 'high' && !c.invisible); let cells = 0, walk = 0, navFree = 0; const bad = [];
  for (const c of highs) for (let x = c.x + 16; x < c.x + c.w; x += 32) for (let y = c.y + 16; y < c.y + c.h; y += 32) { cells++;
    if (A.isWalkable(w, x, y, 1)) { walk++; bad.push(['walk', c.kind, x, y]); }
    const cx = Math.floor((x - nav.ox) / 32), cy = Math.floor((y - nav.oy) / 32); if (nav.free(cx, cy)) { navFree++; bad.push(['nav', c.kind, x, y]); } }
  return { highs: highs.length, cells, walk, navFree, bad: bad.slice(0, 5) }; });
 // fiender spawner og går: spilleren er udødelig og står stille, vi sampler fiendeposisjoner i ~40 s
 let samples = 0, inside = 0, maxSeen = 0; const ex = [];
 for (let i = 0; i < 160; i++) { await p.waitForTimeout(250);
  const r = await p.evaluate(() => { const w = window.BREACH.world; w.player.hp = w.player.maxHp || 100; const hs = w.cover.filter(c => c.type === 'high' && !c.invisible); const es = w.enemies.filter(e => !e.dead);
   const ins = es.filter(e => hs.some(c => e.x > c.x + 2 && e.x < c.x + c.w - 2 && e.y > c.y + 2 && e.y < c.y + c.h - 2)).map(e => [e.type || e.kind, Math.round(e.x), Math.round(e.y)]);
   return { n: es.length, ins }; });
  samples += r.n; inside += r.ins.length; maxSeen = Math.max(maxSeen, r.n); if (r.ins.length && ex.length < 5) ex.push(r.ins[0]); }
 const out = { query: Q || '(standard)', ...stat, enemySamples: samples, maxAlive: maxSeen, enemiesInsideHigh: inside, insideEx: ex, errs };
 console.log(JSON.stringify(out)); await b.close(); srv.kill(); process.exit(stat.walk || stat.navFree || inside || errs.length ? 1 : 0); })();
