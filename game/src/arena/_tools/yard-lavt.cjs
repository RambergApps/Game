// Røyktest + skjermbilder for testvarianten ?yard=lavt. Kjør: node src/arena/_tools/yard-lavt.cjs (fra game/)
const { chromium } = require('playwright-core'); const { spawn, execFileSync } = require('child_process'); const fs = require('fs');
const GAME = __dirname + '/../../..', OUT = '/workspace/breach/shots/arena/yard-lavt';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn('python3', ['-m', 'http.server', '8767'], { cwd: GAME, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true })); const errs = [];
  const mk = async (w, h) => { const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e))); return p; };
  // 1) oversikt (arenatestside)
  let p = await mk(1600, 1220); await p.goto('http://localhost:8767/src/arena/test.html?view=34&arena=yard&yard=lavt'); await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/oversikt.jpg', type: 'jpeg', quality: 85 });
  // 2) spillet med varianten
  p = await mk(1600, 1000); await p.goto('http://localhost:8767/?yard=lavt'); await p.waitForFunction(() => window.BREACH);
  await p.mouse.click(800, 500); await p.waitForTimeout(1500); await p.keyboard.press('Space'); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.mouse.move(1100, 300);
  try { await p.waitForFunction(() => (window.BREACH.world.enemies || []).filter(e => !e.dead).length >= 3, null, { timeout: 25000 }); } catch (e) { }
  await p.keyboard.down('KeyD'); await p.waitForTimeout(1800); await p.keyboard.up('KeyD'); await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const { world } = window.BREACH; const hiMid = (world.cover || []).filter(c => c.type === 'high' && c.kind !== 'blocker' && !(c.x <= 32 || c.y <= 32 || c.x + c.w >= 1248 || c.y + c.h >= 928));
    return { arena: world.arena?.name, highMid: hiMid.length, cover: world.cover.length, enemies: world.enemies.filter(e => !e.dead).map(e => [Math.round(e.x), Math.round(e.y)]), ammo: world.arena.ammoCrates.map(a => [a.x / 32, a.y / 32]) }; });
  await p.screenshot({ path: OUT + '/midt-i-bolge.jpg', type: 'jpeg', quality: 85 });
  console.log(JSON.stringify({ errs, ...r })); await b.close(); srv.kill(); process.exit(errs.length || r.highMid ? 1 : 0);
})();
