// Skaderetning i view 34: ekte fiendekule fra N/Ø/S/V, egen granat, fiendenærkamp, miljøskade (ingen kilde).
// Kjør: node game/src/ui/tools/dmgdir.cjs [port]  (statisk server med rot game/ på port, default 8766)
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const OUT = '/workspace/breach/game/src/ui/shots';
const port = process.argv[2] || 8766;
const base = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243';
const exe = path.join(base, fs.readdirSync(base).find((d) => d.startsWith('chrome-')), 'chrome-headless-shell');
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${port}/index.html?view=34&skipmenu=1`); await p.waitForTimeout(800);
  await p.evaluate(async () => { BREACH.startGame(); const L = await import('/src/levels/index.js'); L.startAt(BREACH.world, 1, 0, { skipCutscenes: true }); BREACH.world.paused = false; }); await p.waitForTimeout(1500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500);   // hopp over mellomsekvensen (story: ESC)
  await p.evaluate(() => { if (BREACH.ui?.pause?.isOpen?.()) BREACH.ui.pause.close?.(); });
  await p.evaluate(async () => {
    const W = BREACH.world; W.__ev = []; W.events.on('damageDirection', (e) => W.__ev.push({ a: +(e.angle * 180 / Math.PI).toFixed(1), amt: e.amount }));
    W.enemies.length = 0; W.player.invuln = false;
    window.__C = await import('/src/core/combat.js'); window.__G = await import('/src/weapons/grenades.js'); window.__D = await import('/src/weapons/data.js');
  });
  const R = {};
  const prep = () => p.evaluate(() => { const W = BREACH.world; W.player.hp = W.player.maxHp = 9999; W.player.invuln = false; W.enemies.length = 0; W.ui.damage.clear(); W.__ev.length = 0; W.paused = false; });
  for (const [n, dx, dy] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) {
    await prep();
    await p.evaluate(([dx, dy]) => {   // ekte fiendekule: owner = fiende 260 px unna, sikter mot spilleren
      const W = BREACH.world, pl = W.player, sx = pl.x + dx * 260, sy = pl.y + dy * 260;
      const foe = { x: sx, y: sy, team: 'enemy', hp: 1, r: 14 };
      __C.spawnProjectile(W, { x: sx - dx * 200, y: sy - dy * 200, angle: Math.atan2(-dy, -dx), team: 'enemy', owner: foe, dmg: 18 });
    }, [dx, dy]);
    await p.waitForFunction(() => BREACH.world.__ev.length > 0, null, { timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(60);
    R[n] = await p.evaluate(() => BREACH.world.__ev.slice()); await p.screenshot({ path: `${OUT}/20-dmgdir-${n}.png` });
  }
  await prep();   // egen granat sørøst for spilleren
  await p.evaluate(() => { const W = BREACH.world, pl = W.player; __G.explode(W, { x: pl.x + 50, y: pl.y + 50, def: __D.GRENADE, owner: pl, team: 'player', dead: false }); });
  await p.waitForTimeout(60); R.selfGrenade = await p.evaluate(() => BREACH.world.__ev.slice()); await p.screenshot({ path: `${OUT}/20-dmgdir-selfgrenade.png` });
  await prep();   // fiendens nærkamp fra vest/nordvest
  await p.evaluate(() => { const W = BREACH.world, pl = W.player; const foe = { x: pl.x - 30, y: pl.y - 30, team: 'enemy', hp: 1 }; __C.damage(pl, 30, { owner: foe, entity: foe, team: 'enemy', weapon: 'melee', kind: 'melee' }, W); });
  await p.waitForTimeout(60); R.melee = await p.evaluate(() => BREACH.world.__ev.slice()); await p.screenshot({ path: `${OUT}/20-dmgdir-melee.png` });
  await prep();   // miljøskade
  await p.evaluate(() => { const W = BREACH.world; __C.damage(W.player, 10, null, W); });
  await p.waitForTimeout(60); R.env = { ev: await p.evaluate(() => BREACH.world.__ev.length), list: await p.evaluate(() => BREACH.world.ui.damage.list.length) };
  await prep(); await p.evaluate(() => { const W = BREACH.world, pl = W.player; __C.damage(pl, 20, { x: pl.x + 300, y: pl.y, team: 'enemy' }, W); });
  await p.waitForTimeout(1000); R.fadedAfter1s = await p.evaluate(() => BREACH.world.ui.damage.list.length === 0);
  R.errors = errs; console.log(JSON.stringify(R, null, 1)); await b.close();
})();
