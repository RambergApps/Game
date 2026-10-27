// Skjermbilder av levels-HUD og oppgraderingskort (før/etter-sammenligning). Bruk: node hud-shots.cjs <prefix> [port]
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const EXE = '/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const [PRE = 'hud', PORT = 8793] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => window.BREACH);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = (n) => p.screenshot({ path: `/tmp/shots/${PRE}-${n}.png` });
  await ev(() => { document.getElementById('start-screen')?.remove(); const W = BREACH.world; W.paused = false; W.rng = (() => { let s = 99; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })(); W.modules.levels.setFallenSeen(true); W.player.invuln = true; W.modules.levels.startLevel(W, 1, { skipCutscenes: true }); });
  const D = 'BREACH.world.modules.levels._debug(BREACH.world)';
  const freezeBanner = (age) => ev(([D, age]) => { const d = eval(D); if (d.banner) d.banner.t0 = performance.now() / 1000 - age; BREACH.world.paused = true; }, [D, age]);
  const unfreeze = () => ev(() => { BREACH.world.paused = false; });
  await p.waitForTimeout(500); await freezeBanner(1.2); await p.waitForTimeout(120); await shot('01-chapter'); await unfreeze();
  await p.waitForFunction((D) => eval(D).phase === 'wave', D, { timeout: 20000 });
  await freezeBanner(1.0); await p.waitForTimeout(120); await shot('02-wave-banner'); await unfreeze();
  await p.waitForFunction(() => BREACH.world.enemies.length >= 2, null, { timeout: 20000 }); await p.waitForTimeout(1500);
  await ev(() => { BREACH.world.paused = true; }); await p.waitForTimeout(120); await shot('03-combat-hud'); await unfreeze();
  // død (andre gang → banner) → REGROUP-nedtelling
  await ev(async () => { const W = BREACH.world, { damage } = await import('/src/core/index.js'); W.player.invuln = false; damage(W.player, 99999, null, W); });
  await p.waitForFunction((D) => eval(D).phase === 'break', D, { timeout: 10000 }); await p.waitForTimeout(100);
  await freezeBanner(0.8); await p.waitForTimeout(120); await shot('04-death-banner'); await unfreeze();
  await p.waitForTimeout(800); await ev(() => { BREACH.world.paused = true; }); await shot('05-regroup'); await unfreeze();
  await p.waitForFunction((D) => eval(D).phase === 'wave', D, { timeout: 10000 }); await p.waitForTimeout(500);
  await ev(() => { BREACH.world.player.invuln = true; BREACH.world.modules.levels.restartWave(BREACH.world); });
  await freezeBanner(0.6); await p.waitForTimeout(120); await shot('06-menu-restart-banner'); await unfreeze();
  // boss-bar (stub)
  await p.waitForFunction((D) => eval(D).phase === 'wave', D, { timeout: 10000 });
  await ev((D) => { const d = eval(D); d.boss = { id: 'ashmaw', name: 'Ashmaw', e: { hp: 540, maxHp: 1200 }, phase: 2, phaseName: 'Furnace', phases: [{ at: 1 }, { at: 0.7 }, { at: 0.35 }] }; BREACH.world.paused = true; }, D);
  await p.waitForTimeout(150); await shot('07-boss-bar'); await ev((D) => { eval(D).boss = null; BREACH.world.paused = false; }, D);
  // kort: hopp til 1-2 og fullfør
  await ev(() => { const W = BREACH.world; W.modules.levels.startLevel(W, 1, { startAt: '1-2', skipCutscenes: true }); });
  await p.waitForFunction((D) => eval(D).phase === 'wave', D, { timeout: 20000 });
  await ev((D) => { const d = eval(D); d.queue = []; for (const e of BREACH.world.enemies) e.dead = true; d.pend?.forEach((h) => h.cancel?.()); d.pend = []; }, D);
  await p.waitForFunction((D) => eval(D).cards, D, { timeout: 10000 }); await p.waitForTimeout(900);
  await p.mouse.move(10, 10); await p.waitForTimeout(150); await shot('08-cards');
  const r = await ev((D) => (eval(D).cards.rects || []).map((x) => x && [x.x, x.y, x.w, x.h]), D);
  const c = await ev(() => { const cv = document.getElementById('game'), r = cv.getBoundingClientRect(); return [cv.width / r.width, cv.height / r.height]; });
  if (r && r[1]) { await p.mouse.move((r[1][0] + r[1][2] / 2) / c[0], (r[1][1] + r[1][3] / 2) / c[1]); await p.waitForTimeout(350); await shot('09-cards-hover'); }
  await p.keyboard.press('Digit2'); await p.waitForTimeout(90); await shot('10-cards-picked');
  // sluttskjerm
  await p.waitForTimeout(800);
  await ev((D) => { const d = eval(D); d.phase = 'done'; d.doneT0 = performance.now() / 1000 - 2; BREACH.world.paused = true; }, D);
  await p.waitForTimeout(200); await shot('11-done');
  console.log(JSON.stringify({ errs, rects: r }));
  await b.close();
})();
