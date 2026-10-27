// BREACH Våpen – skjermbilder fra selve spillet (index.html?skipmenu=1): bytter til våpen 1/2/3 og tar et utsnitt rundt spilleren.
// Bruk: node ingame.cjs  (krever http.server på 8799 i game/) → shots/ingame-{rifle,shotgun,marksman}.png + shots/ingame-weapons.png
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8799/index.html?skipmenu=1&view=34'); await p.waitForTimeout(1500); await p.evaluate(() => window.BREACH.startGame()); await p.waitForTimeout(2500);
  await p.mouse.move(1100, 360); // sikt østover
  const info = [];
  for (const [k, id] of [['1', 'rifle'], ['2', 'shotgun'], ['3', 'marksman']]) {
    await p.keyboard.press(k); await p.waitForTimeout(900);
    const s = await p.evaluate(() => { const B = window.BREACH, pl = B.world.player; const sc = B.camera.worldToScreen ? B.camera.worldToScreen(pl.x, pl.y) : null;
      return { w: pl.weaponId, x: pl.x, y: pl.y, sc, muzzle: pl.muzzle, draw: pl.muzzleDraw }; });
    info.push(s);
    const cx = s.sc ? s.sc.x : 640, cy = s.sc ? s.sc.y : 360;
    await p.screenshot({ path: path.join(OUT, `ingame-${id}.png`), clip: { x: Math.max(0, cx - 110), y: Math.max(0, cy - 90), width: 220, height: 150 } });
  }
  console.log(JSON.stringify(info), 'errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
