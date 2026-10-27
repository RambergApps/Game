// Varsel for fiender utenfor skjermen: plasserer fiender i 8 retninger (inkl. sør nær HUD) og tar skjermbilder.
// Kjør: node game/src/ui/tools/offscreen.cjs [port]  (statisk server med rot game/, default 8767)
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const OUT = '/workspace/breach/game/src/ui/shots', port = process.argv[2] || 8767;
const base = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243';
const exe = path.join(base, fs.readdirSync(base).find((d) => d.startsWith('chrome-')), 'chrome-headless-shell');
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${port}/index.html?skipmenu=1`); await p.waitForTimeout(800);
  await p.evaluate(async () => { BREACH.startGame(); const L = await import('/src/levels/index.js'); L.startAt(BREACH.world, 1, 0, { skipCutscenes: true }); BREACH.world.paused = false; }); await p.waitForTimeout(1500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  await p.evaluate(() => { if (BREACH.ui?.pause?.isOpen?.()) BREACH.ui.pause.close?.(); });
  const place = (set) => p.evaluate(async (set) => {
    const W = BREACH.world, pl = W.player, E = await import('/src/enemies/index.js');
    pl.hp = pl.maxHp = 9999; pl.invuln = 999; W.enemies.length = 0;
    const B = W.bounds; pl.x = B.x + B.w / 2; pl.y = B.y + B.h * 0.42; BREACH.camera.x = pl.x; BREACH.camera.y = pl.y;
    for (const [t, dx, dy] of set) { const e = E.createEnemy(W, t, pl.x + dx, pl.y + dy); e.update = null; e.frozen = true; }
    W.paused = false; return { b: W.bounds, pos: W.enemies.map((e) => [e.type, e.x | 0, e.y | 0]), view: W.view, zoom: BREACH.camera.zoom, n: W.enemies.length };
  }, set);
  const freeze = () => p.evaluate(() => { const W = BREACH.world; W.timeScale = 0.0001; });
  const info = [];
  // 1) 8 retninger, blandede typer og avstander
  info.push(await place([['grunt', 0, -700], ['flanker', 900, -500], ['heavy', 1100, 0], ['grenadier', 700, 600], ['grunt', 0, 520], ['flanker', -450, 560], ['heavy', -1200, 0], ['grenadier', -800, -700], ['grunt', 2200, 200]]));
  await freeze(); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/21-offscreen-8dir.png` });
  // 2) sør nær HUD: en vifte langs bunnkanten
  await p.evaluate(() => { BREACH.world.timeScale = 1; });
  info.push(await place([['grunt', -900, 500], ['flanker', -400, 500], ['heavy', -120, 520], ['grenadier', 0, 600], ['grunt', 150, 520], ['flanker', 450, 500], ['heavy', 900, 500]]));
  await freeze(); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/21-offscreen-south.png` });
  const stat = await p.evaluate(() => ({ cam: [BREACH.camera.x | 0, BREACH.camera.y | 0], pl: [BREACH.world.player.x | 0, BREACH.world.player.y | 0], set: BREACH.ui?.settings?.offscreenEnemies ?? BREACH.world.ui?.getSettings().offscreenEnemies }));
  console.log(JSON.stringify({ errs, info, stat })); await b.close();
})();
