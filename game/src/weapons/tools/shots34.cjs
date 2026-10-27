// BREACH Våpen – før/etter-bilder for skråvinkel (index.html?view=34). Bruk: node shots34.cjs <prefiks>
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const OUT = '/workspace/breach/game/src/weapons/shots/34/';
const tag = process.argv[2] || 'x';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html?view=34'); await p.waitForTimeout(800);
  await p.evaluate(() => BREACH.startGame()); await p.waitForTimeout(600);
  for (let i = 0; i < 4; i++) { if (await p.$('.breach-cutscene')) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); } }
  await p.waitForTimeout(4500);
  const info = await p.evaluate(() => {
    const B = BREACH, w = B.world; B.loop.stop();
    const cov = w.modules.arena.coverObjects(w).filter(o => o.type === 'high' && !o.ammo && o.w >= 120 && o.h >= 40 && o.h < o.w);
    // velg en container nær sentrum
    cov.sort((a, b) => Math.hypot(a.x - 800, a.y - 500) - Math.hypot(b.x - 800, b.y - 500));
    window._c = cov[0]; return { view: w.view, n: cov.length, c: cov[0] && { x: cov[0].x, y: cov[0].y, w: cov[0].w, h: cov[0].h, elev: cov[0].elev } };
  });
  console.log(JSON.stringify(info));
  const scene = async (name, setup) => {
    const dir = await p.evaluate((s) => { const S = new Function('c', 'return ' + s)(window._c); return S.a; }, setup);
    await p.mouse.move(640 + Math.cos(dir) * 260, 360 + Math.sin(dir) * 260);
    await p.evaluate((s) => {
      const B = BREACH, w = B.world, pl = w.player, c = window._c, W = w.modules.weapons;
      w.enemies.length = 0; w.projectiles.length = 0; w.effects.length = 0;
      const S = new Function('c', 'return ' + s)(c); pl.x = S.x; pl.y = S.y; pl.aim = S.a; pl.angle = S.a;
      for (const sl of pl.loadout.slots) sl.mag = 99; pl.loadout.cooldown = 0; pl.loadout.reload = null;
      B.camera.lead = 0; B.camera.lerp = 1e4; for (let i = 0; i < 30; i++) { pl.x = S.x; pl.y = S.y; B.loop.step(1 / 60); }
      pl.x = S.x; pl.y = S.y; window._S = S;
    }, setup);
    for (const [k, n] of [['a', 3], ['b', 7]]) {
      await p.evaluate(({ n }) => { const B = BREACH, w = B.world, pl = w.player, S = window._S, W = w.modules.weapons;
        w.projectiles.length = 0;
        for (let i = 0; i < 3; i++) { pl.loadout.cooldown = 0; pl.x = S.x; pl.y = S.y; W.tryFire(w, pl, { aimAngle: S.a + (i - 1) * 0.01, aiming: true }); pl.loadout.wasHeld = false; pl.loadout.trigger = false; B.loop.step(1 / 60); }
        for (let i = 0; i < n; i++) { pl.x = S.x; pl.y = S.y; B.loop.step(1 / 60); } B.loop.render(); }, { n });
      await p.screenshot({ path: `${OUT}${tag}-${name}-${k}.png`, clip: { x: 240, y: 110, width: 800, height: 500 } });
    }
  };
  // 1) nord for containeren, skyter øst langs nordkanten: kulene skal skjules av taket
  await scene('behind', '({ x: c.x + 10, y: c.y - 16, a: 0 })');
  // 2) sør for containeren, skyter nord inn i sørveggen: gnister på fronten i løpshøyde
  await scene('front', '({ x: c.x + c.w / 2, y: c.y + c.h + 90, a: -Math.PI / 2 })');
  // 3) nord for containeren, skyter sør inn i den: treffet skal ikke lande midt på taket
  await scene('north', '({ x: c.x + c.w / 2, y: c.y - 70, a: Math.PI / 2 })');
  // 4) fri skyting øst i åpent rom (glimt på løpet)
  await scene('open', '({ x: c.x - 40, y: c.y + c.h + 60, a: -0.15 })');
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
