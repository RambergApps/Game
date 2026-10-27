// Skjermbilde av dekaler på dekning (kulehullskroken). Kjør: node src/arena/_tools/decals-shot.cjs [34|top]
// Forutsetter http-server på :8765 med rot i game/. Lagrer shots/arena-decals-v1(.png/.jpg) (top: -top).
const { createRequire } = require('module'); const r = createRequire(__dirname + '/../../../../package.json');
const { chromium } = r('playwright-core'); const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
function chromePath() { try { const base = path.join(process.env.HOME, '.cache/ms-playwright'); for (const d of fs.readdirSync(base)) for (const q of [path.join(base, d, 'chrome-linux64/chrome'), path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell')]) if (fs.existsSync(q)) return q; } catch (e) { /* */ } return fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined; }
const VIEW = process.argv[2] || '34', OUT = '/workspace/breach/shots/arena-decals-' + (process.env.TAG || 'v2') + (VIEW === 'top' ? '-top' : '');
(async () => {
  const b = await chromium.launch({ executablePath: chromePath() }); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://localhost:8765/index.html?view=${VIEW}&skipmenu=1`); await p.waitForFunction(() => window.BREACH?.world?.arena);
  await p.mouse.click(800, 500); await p.waitForTimeout(1500); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  for (let i = 0; i < 6 && await p.evaluate(() => window.BREACH.world.paused); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.waitForTimeout(9000);
  const info = await p.evaluate(async () => {
    const { world: w, camera: c } = window.BREACH, A = w.modules.arena;
    await import('/src/effects/decals.js'); await new Promise((r) => setTimeout(r, 200));
    for (const e of w.enemies) e.dead = true; w.enemies.length = 0;
    // flytt kamera/spiller til et område med flere dekningsobjekter
    const pl = w.player; pl.x = 470; pl.y = 520; pl.invuln = 99; c.x = pl.x; c.y = pl.y - 40; c.zoom = 2.2; c.lerp = 0;
    const vis = w.cover.filter((o) => Math.abs(o.x + o.w / 2 - c.x) < 420 && Math.abs(o.y + o.h / 2 - c.y) < 260 && o.w >= 24);
    let n = 0, seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const hits = [];
    for (const o of vis) {
      const H = (o.type === 'high' ? 48 : 24);
      for (let i = 0; i < 6; i++) { const hp = A.coverHitPoint(w, o, o.x + 4 + rnd() * (o.w - 8), o.y + o.h + 1, 4 + rnd() * (H - 8));
        hits.push(hp.face); A.addCoverDecal(w, hp.coverId, { x: hp.x, z: hp.z, kind: hp.material === 'metal' ? 'bullet_metal' : 'bullet_concrete', r: 3 + rnd() * 2, angle: rnd() * 6, seed: n++ }); }
      A.addCoverDecal(w, o.id, { x: o.x + o.w * 0.3, z: H * 0.4, kind: 'ichor', r: 9, angle: 1, seed: n++ });
      A.addCoverDecal(w, o.id, { x: o.x + o.w * 0.7, z: H * 0.6, kind: 'slash', r: 12, angle: -0.5, seed: n++ });
      A.addCoverDecal(w, o.id, { x: o.x + o.w * 0.5, y: o.y + o.h * 0.5, z: 999, kind: 'scorch', r: 18, angle: 0, seed: n++ }); // topp
    }
    const side = A.coverHitPoint(w, vis[0], vis[0].x - 1, vis[0].y + 5);
    w.paused = true; window.__usedVfx = (await import('/src/arena/decals.js')).usingVfxSprites();
    return { n: vis.length, faces: [...new Set(hits)], side: side.face + ' ' + side.nx, stats: A.decalStats(w), hookFound: typeof A.coverHitPoint === 'function', vfxSprites: window.__usedVfx };
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '.png' });
  // tømming: arenaLoaded/levelStart
  const cleared = await p.evaluate(() => { const w = window.BREACH.world; w.events.emit('levelStart', { level: 1 }); return w.modules.arena.decalStats(w); });
  execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],quality=85)', OUT + '.png', OUT + '.jpg']);
  console.log(JSON.stringify({ info, cleared, errs }));
  await b.close();
})();
