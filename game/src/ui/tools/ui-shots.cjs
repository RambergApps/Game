// Skjermbilder + atferdstester for src/ui. Kjør: node game/src/ui/tools/ui-shots.cjs [port] (server i game/ på port, default 8765)
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const OUT = process.env.OUT || '/workspace/breach/game/src/ui/shots';
const port = process.argv[2] || 8765, URL = `http://localhost:${port}/src/ui/test.html`;
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
  const R = {};
  await p.goto(URL); await p.evaluate(() => localStorage.removeItem('breach.settings')); await p.reload(); await p.waitForTimeout(1200);
  await p.mouse.move(900, 300); await p.waitForTimeout(300); await shot('00-game');
  // Esc åpner
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  R.escOpens = await p.evaluate(() => ({ open: BREACH.UI.pause.isOpen(), paused: BREACH.world.paused }));
  const t0 = await p.evaluate(() => BREACH.world.time); await p.waitForTimeout(700);
  R.timeFrozenRealLoop = (await p.evaluate(() => BREACH.world.time)) === t0;
  await shot('01-pause');
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(120); await shot('02-pause-focus-settings');
  await p.keyboard.press('Enter'); await p.waitForTimeout(350); await shot('03-settings');
  // tastatur: ned til music, venstre 3x, ned til showFps, Enter
  await p.keyboard.press('ArrowDown'); for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowLeft');
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  // mus: dra screen shake til 50 %
  const tr = await p.$('[data-key="screenShake"] .bx-track'); const bb = await tr.boundingBox();
  await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height / 2); await p.waitForTimeout(200);
  await p.mouse.move(bb.x + bb.width * 0.5, bb.y - 60); await p.waitForTimeout(150);
  await shot('04-settings-changed');
  R.afterEdit = await p.evaluate(() => ({ s: { ...BREACH.ui.getSettings() }, shakeScale: BREACH.camera.shakeScale, ls: JSON.parse(localStorage.getItem('breach.settings')), fpsShown: !!document.querySelector('.bx-fps:not([style*="none"])') }));
  await p.mouse.move(1200, 700); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  R.backToPause = await p.evaluate(() => ({ open: BREACH.UI.pause.isOpen(), settings: BREACH.UI.pause.settingsOpen }));
  // Quit-bekreftelse
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  R.confirmShown = await p.evaluate(() => !!document.querySelector('.bx-modal'));
  await shot('05-confirm-quit');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // RESUME med mus: ingen skudd skal gå av
  const shots0 = await p.evaluate(() => BREACH.tests.shots.player);
  const rb = await (await p.$('.bx-item[data-id="resume"]')).boundingBox();
  await p.mouse.move(rb.x + 60, rb.y + rb.height / 2); await p.waitForTimeout(100);
  await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(600);
  R.resumeClick = await p.evaluate((s0) => ({ open: BREACH.UI.pause.isOpen(), paused: BREACH.world.paused, playerShots: BREACH.tests.shots.player - s0, mouseLeft: BREACH.input.mouse.left }), shots0);
  // Esc veksler av og på
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  R.escToggle = await p.evaluate(() => ({ open: BREACH.UI.pause.isOpen(), paused: BREACH.world.paused }));
  R.timeFrozenAdvance = await p.evaluate(() => BREACH.tests.timeFrozen(120));
  // restart via hendelse
  await p.keyboard.press('Escape'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  R.restart = await p.evaluate(() => ({ log: [...BREACH.tests.log], open: BREACH.UI.pause.isOpen(), paused: BREACH.world.paused }));
  // skadeindikator: utenfor skjermen + nært
  await p.evaluate(() => { BREACH.tests.hurtFrom(-1100, -420, 24); BREACH.tests.hurtFrom(260, 160, 10); }); await p.waitForTimeout(140);
  await shot('06-damage-indicator');
  await p.waitForTimeout(1100);
  R.damageFaded = await p.evaluate(() => BREACH.world.ui.damage.list.length === 0);
  // frittstående settings (hovedmeny-bruk)
  await p.keyboard.press('KeyK'); await p.waitForTimeout(350); await shot('07-settings-standalone');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // lagring overlever omlasting
  await p.reload(); await p.waitForTimeout(1000);
  R.persisted = await p.evaluate(() => ({ music: BREACH.ui.getSettings().music, showFps: BREACH.ui.getSettings().showFps, shakeScale: BREACH.camera.shakeScale, fpsText: document.querySelector('.bx-fps')?.textContent }));
  await shot('08-fps-visible');
  // korrupt lagring
  await p.evaluate(() => localStorage.setItem('breach.settings', '{"version":1,"master":"loud", bad json')); await p.reload(); await p.waitForTimeout(900);
  R.corrupt = await p.evaluate(() => ({ s: { ...BREACH.ui.getSettings() } }));
  await p.evaluate(() => localStorage.setItem('breach.settings', JSON.stringify({ version: 99, master: 7, sfx: -2, showFps: 'yes', junk: 1 }))); await p.reload(); await p.waitForTimeout(900);
  R.clamped = await p.evaluate(() => ({ ...BREACH.ui.getSettings() }));
  await p.evaluate(() => localStorage.removeItem('breach.settings'));
  R.errors = errs;
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
