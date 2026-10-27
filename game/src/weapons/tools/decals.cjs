// Dekaler på dekning (rifle + hagle) i view 34 + hold-W-pausetest. Kjør: node decals.cjs (server på :8765, rot game/)
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html?view=34'); await p.waitForTimeout(800);
  await p.evaluate(() => BREACH.startGame()); await p.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { if (await p.$('.breach-cutscene')) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); } }
  await p.waitForTimeout(2500);
  const pos = () => p.evaluate(() => ({ x: +BREACH.world.player.x.toFixed(1), y: +BREACH.world.player.y.toFixed(1) }));
  await p.evaluate(() => { const P = BREACH.world.player; P.x = 470; P.y = 560; P.invuln = 999; }); await p.waitForTimeout(100);
  const p0 = await pos();
  // --- hold W, pause, slipp, fortsett
  await p.keyboard.down('KeyS'); await p.waitForTimeout(600); await p.keyboard.up('KeyS'); await p.waitForTimeout(200); const pCtl = await pos(); console.log('CONTROL S 600ms', JSON.stringify(pCtl));
  await p.keyboard.down('KeyW'); await p.waitForTimeout(600); const pHeld = await pos();
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.keyboard.up('KeyW'); await p.waitForTimeout(200);
  const ui = await p.evaluate(() => !!(BREACH.ui?.pause?.isOpen?.()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  const a = await pos(); await p.waitForTimeout(700); const c = await pos();
  const inputW = await p.evaluate(() => BREACH.world.input?.down?.('KeyW') ?? BREACH.input?.down?.('KeyW') ?? null);
  console.log('HOLDW', JSON.stringify({ before: p0, whileHeld: pHeld, pauseOpen: ui, afterResume: a, after700ms: c, moved: Math.hypot(c.x - a.x, c.y - a.y).toFixed(1), inputW }));
  // --- dekaler
  const res = await p.evaluate(async () => {
    const W = BREACH.world, A = W.modules.arena, wp = W.modules.weapons, P = W.player;
    const cov = A.coverObjects(W); const hi = cov.find(o => o.type === 'high' && o.w > 40 && o.w < 200 && o.y > 64) , lo = cov.find(o => o.type === 'low');
    for (const e of W.enemies || []) e.dead = true; W.enemies && (W.enemies.length = 0); P.invuln = 999;
    const out = { hi: hi && { id: hi.id, x: hi.x, y: hi.y, w: hi.w, h: hi.h }, lo: lo && { id: lo.id, x: lo.x, y: lo.y } };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const shoot = async (o, id, n, gap) => {
      P.x = o.x + o.w / 2; P.y = o.y + o.h + 90; P.hp = P.maxHp || P.hp;
      wp.switchWeapon(W, P, id); await sleep(500);
      for (let i = 0; i < n; i++) { const tx = o.x + o.w * (0.2 + 0.6 * Math.random()); const ang = Math.atan2(o.y + o.h / 2 - P.y, tx - P.x);
        const L = P.loadout; if (L) { const s = L.slots?.find?.(s => s.id === id || s.def?.id === id); if (s) s.mag = 99; }
        wp.tryFire(W, P, { aimAngle: ang, aiming: true }); await sleep(gap); }
    };
    const t0 = performance.now();
    await shoot(hi, 'rifle', 30, 110); await shoot(hi, 'shotgun', 4, 900);
    await shoot(lo, 'rifle', 20, 110); await shoot(lo, 'shotgun', 4, 900);
    out.stats = W._wDecals?.stats; const ds = W._arenaState?.decals; out.list = ds ? [...ds.entries()].map(([id, r]) => [id, r.list.map(d => [Math.round(d.x), Math.round(d.z), d.y == null ? 'F' : 'T', +d.r.toFixed(1)])]) : null; out.arena = A.decalStats(W);
    const C = BREACH.camera; P.x = (hi.x + hi.w / 2 + lo.x + lo.w / 2) / 2; P.y = Math.max(hi.y + hi.h, lo.y + lo.h) + 40; if (C) { C.x = P.x; C.y = (hi.y + hi.h + lo.y + lo.h) / 2; C.zoom = 2.2; C.lerp = 0; }
    out.lo.w = lo.w; out.lo.h = lo.h; await sleep(300); W.paused = true;
    return out;
  });
  console.log('DECALS', JSON.stringify(res));
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/workspace/breach/game/src/weapons/shots/demo/decals.png' });
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
})();
