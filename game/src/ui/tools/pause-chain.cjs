// Pausemeny-kjeden i index.html: Esc → RESUME (Enter, ingen skudd), RESTART WAVE (bekreft), QUIT TO MENU (bekreft).
// Bruker main.js-kroken hvis den finnes (BREACH.ui / window.UI), ellers initUI injisert. Kjør: node pause-chain.cjs
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], out = {}; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.removeItem('breach.settings'));
  await p.evaluate(() => BREACH.startGame()); await p.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { if (await p.$('.breach-cutscene')) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); } }
  await p.waitForTimeout(4500);
  out.hook = await p.evaluate(async () => {
    const hooked = !!(BREACH.ui || window.UI || document.querySelector('.bx-root'));
    window._UI = BREACH.ui || window.UI || null;
    if (!window._UI || !window._UI.pause) { const ui = await import('/src/ui/index.js'); window._UI = ui.initUI(BREACH.world, { loop: BREACH.loop }); return hooked ? 'main.js (uten handle)' : 'injisert'; }
    return 'main.js';
  });
  await p.evaluate(() => { window._ev = { shot: 0, restart: 0, quit: 0 }; const E = BREACH.world.events;
    E.on('shot', () => _ev.shot++); E.on('ui:restartWave', () => _ev.restart++); E.on('ui:quitToMenu', () => _ev.quit++); });
  const st = () => p.evaluate(() => ({ t: +BREACH.world.time.toFixed(3), paused: !!BREACH.world.paused, open: _UI.pause.isOpen(), ev: { ..._ev },
    wave: BREACH.world.wave ?? BREACH.world.level?.wave ?? null, hp: BREACH.world.player?.hp, toast: document.querySelector('.bx-toast')?.textContent || '' }));
  await p.mouse.move(900, 300);
  // 1) RESUME med Enter: ingen skudd skal gå av (Enter/klikk svelges)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); out.pauseOpen = await st();
  await p.keyboard.press('Enter'); await p.waitForTimeout(400); out.afterResume = await st();
  // 1b) RESUME med museklikk på menyelementet
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const r = await p.$('.bx-item'); if (r) await r.click(); await p.waitForTimeout(400); out.afterResumeClick = await st();
  // 2) RESTART WAVE – skad spilleren og drep fiender først, så vi ser at bølgen faktisk startes på nytt
  out.beforeRestart = await p.evaluate(() => { const w = BREACH.world; w.player.hp = 40; const n = w.enemies.length; for (const e of w.enemies) { e.hp = 0; e.dead = true; }
    return { enemies: n, hp: w.player.hp, ammo: w.player.loadout?.slots?.map((s) => s.mag + '/' + s.reserve).join(' ') }; });
  await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  for (let i = 0; i < 2; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(80); }
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  out.confirmShown = !!(await p.$('.bx-modal'));
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter'); await p.waitForTimeout(800); out.afterRestart = await st();
  await p.waitForTimeout(2500);
  out.restartEffect = await p.evaluate(() => { const w = BREACH.world; return { enemies: w.enemies.filter((e) => !e.dead).length, hp: w.player.hp, dead: !!w.player.dead,
    ammo: w.player.loadout?.slots?.map((s) => s.mag + '/' + s.reserve).join(' '), t: +w.time.toFixed(2) }; });
  await p.screenshot({ path: '/workspace/breach/game/src/ui/shots/10-chain-restart.png' });
  if (out.afterRestart.open) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  // 3) QUIT TO MENU
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(80); }
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.keyboard.press('ArrowLeft'); 
  const nav = p.waitForNavigation({ timeout: 2500 }).then(() => 'reload').catch(() => 'ingen reload');
  await p.keyboard.press('Enter'); out.quitNav = await nav; await p.waitForTimeout(600);
  out.afterQuit = await p.evaluate(() => ({ menuText: document.body.innerText.slice(0, 120), ev: window._ev || null }));
  await p.screenshot({ path: '/workspace/breach/game/src/ui/shots/11-chain-quit.png' });
  console.log(JSON.stringify({ ...out, errs }, null, 1));
  await b.close();
})();
