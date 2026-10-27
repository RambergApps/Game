// BREACH Våpen – demo-verifisering i selve spillet (index.html?view=34): ekte look-defer, accent, munning, kuler/glimt,
// og bilder av Warden ved container i 1× og 2× for alle tre våpen. Bruk: node demo.cjs <before|after> <port>
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const OUT = '/workspace/breach/game/src/weapons/shots/demo/';
const tag = process.argv[2] || 'after', port = process.argv[3] || '8799';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || /weapons\/look mangler/.test(m.text())) errs.push(m.text()); });
  await p.goto(`http://localhost:${port}/index.html?view=34&skipmenu=1`); await p.waitForTimeout(800);
  await p.evaluate(() => BREACH.startGame()); await p.waitForTimeout(600);
  for (let i = 0; i < 4; i++) { if (await p.$('.breach-cutscene')) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); } }
  await p.waitForTimeout(4000);
  await p.evaluate(() => { const w = BREACH.world; BREACH.loop.stop();
    const cov = w.modules.arena.coverObjects(w).filter(o => o.type === 'high' && !o.ammo && o.w >= 120 && o.h >= 40 && o.h < o.w);
    cov.sort((a, b) => Math.hypot(a.x - 800, a.y - 500) - Math.hypot(b.x - 800, b.y - 500)); window._c = cov[0]; });
  const res = [];
  for (const [key, id] of [['1', 'rifle'], ['2', 'shotgun'], ['3', 'marksman']]) {
    await p.mouse.move(1000, 360);
    await p.keyboard.press(key);
    for (const zoom of [1, 2]) {
      const r = await p.evaluate(async ({ id, zoom }) => {
        const B = BREACH, w = B.world, pl = w.player, c = window._c, W = w.modules.weapons;
        const fac = await import('/src/shared/rig/styles/faceted.js'), WI = await import('/src/shared/rig/faceted/weapons/index.js');
        w.enemies.length = 0; w.projectiles.length = 0; w.effects.length = 0;
        const S = { x: c.x + c.w * 0.55, y: c.y + c.h + 30, a: 0 };
        B.camera.zoom = zoom; B.camera.lead = 0; B.camera.lerp = 1e4;
        for (let i = 0; i < 40; i++) { pl.x = S.x; pl.y = S.y; pl.aim = 0; pl.angle = 0; B.loop.step(1 / 60); }
        const look = WI.weaponLook(id), mats = WI.weaponMats(look);
        const mo = pl.rig ? fac.muzzleOf(pl.rig, id) : null, fwd = (m) => m && +(((m.x - pl.x) * Math.cos(S.a) + (m.y - pl.y) * Math.sin(S.a))).toFixed(1);
        const out = { id, zoom, wid: pl.weaponId, lookName: look.name, lookVersion: look.version, lengthPx: look.lengthPx,
          accentPlates: look.parts.filter(q => q.mat === 'accent').length, accentMat: !!mats[`${id}:accent`],
          muzzleOf: mo && { ...mo, fwd: fwd(mo) }, muzzle: pl.muzzle && { ...pl.muzzle, fwd: fwd(pl.muzzle) }, draw: pl.muzzleDraw && { ...pl.muzzleDraw, fwd: fwd(pl.muzzleDraw) } };
        let ev = null; const off = w.events.on('weaponFire', (e) => { if (e.entity === pl) ev = e; });
        for (const sl of pl.loadout.slots) sl.mag = 99; pl.loadout.cooldown = 0; pl.loadout.reload = null;
        const n0 = w.projectiles.length, e0 = w.effects.length;
        W.tryFire(w, pl, { aimAngle: 0, aiming: true });
        const pr = w.projectiles[n0]; out.bullet = pr && { x: +pr.x.toFixed(1), y: +pr.y.toFixed(1), z: pr.z };
        out.fire = ev && { x: +ev.x.toFixed(1), y: +ev.y.toFixed(1), z: ev.z, draw: ev.draw }; out.fxAdded = w.effects.length - e0;
        out.d_bullet = pr ? +Math.hypot(pr.x - pl.muzzle.x, pr.y - pl.muzzle.y).toFixed(2) : null;
        out.d_flash = ev ? +Math.hypot(ev.draw.x - pl.muzzleDraw.x, ev.draw.y - pl.muzzleDraw.y).toFixed(2) : null;
        if (typeof off === 'function') off();
        w.projectiles.length = 0; w.effects.length = 0; pl.loadout.recoil = 0;
        for (let i = 0; i < 20; i++) { pl.x = S.x; pl.y = S.y; B.loop.step(1 / 60); }
        B.loop.render(); const s = B.camera.worldToScreen(pl.x, pl.y); out.sc = s; return out;
      }, { id, zoom });
      res.push(r);
      const W2 = 200 * zoom, H2 = 150 * zoom;
      await p.screenshot({ path: `${OUT}${tag}-${id}-${zoom}x.png`, clip: { x: Math.max(0, r.sc.x - W2 * 0.4), y: Math.max(0, r.sc.y - H2 * 0.65), width: W2, height: H2 } });
    }
  }
  console.log(JSON.stringify(res, null, 0).replace(/\},\{"id"/g, '},\n{"id"'));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
