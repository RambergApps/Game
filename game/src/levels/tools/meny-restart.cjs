// RESTART WAVE fra den ekte pausemenyen i index.html, midt i en bølge med levende fiender og varslede innhopp.
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const EXE = '/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const PORT = process.argv[2] || 8793;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], out = {}; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => window.BREACH);
  await p.evaluate(() => localStorage.removeItem('breach.settings'));
  await p.evaluate(() => { const W = BREACH.world; BREACH.startGame(); });
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(400); if (await p.$('.breach-cutscene')) await p.keyboard.press('Escape'); }
  // hopp rett til 1-3 (via direktøren, uten mellomsekvens) og vent på fiender
  await p.evaluate(() => { const W = BREACH.world; W.modules.levels.startLevel(W, 1, { startAt: '1-3', skipCutscenes: true, upgrades: { plating: 1 } }); window._ev = []; W.events.on('restart', (e) => _ev.push(['restart', e])); W.events.on('cutsceneStart', (e) => _ev.push(['cutsceneStart', e])); W.events.on('waveStart', (e) => _ev.push(['waveStart', e.id])); });
  await p.waitForFunction(() => BREACH.world.enemies.filter((e) => !e.dead).length >= 2, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  const st = () => p.evaluate(() => { const W = BREACH.world, d = W.modules.levels._debug(W); return { t: +W.time.toFixed(2), paused: !!W.paused, menu: !!document.querySelector('.bx-root'), phase: d.phase, wave: W.level.waveId, enemies: W.enemies.filter((e) => !e.dead).length, pend: (d.pend || []).filter((h) => !h.enemy && !h.cancelled).length, queue: d.queue.length, hp: Math.round(W.player.hp), maxHp: W.player.maxHp, stacks: W.modules.levels.getUpgradeState(W), toast: document.querySelector('.bx-toast')?.textContent || '' }; });
  await p.evaluate(() => { BREACH.world.player.hp = 31; });
  out.before = await st();
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  out.menuOpen = await st();
  for (let i = 0; i < 2; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(80); }
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  out.confirm = !!(await p.$('.bx-modal'));
  await p.screenshot({ path: '/tmp/shots/meny-restart-confirm.png' });
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  out.after150ms = await st();
  await p.screenshot({ path: '/tmp/shots/meny-restart-banner.png' });
  await p.waitForTimeout(3500);
  out.after3_6s = await st();
  out.events = await p.evaluate(() => _ev);
  console.log(JSON.stringify({ ...out, errs }, null, 1));
  await b.close();
})();
