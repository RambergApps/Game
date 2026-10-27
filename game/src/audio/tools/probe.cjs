// Probe v1.6: menymusikk + måler i headless Chrome.
const { chromium } = require('playwright-core');
const out = process.argv[2] || '/workspace/breach/reviews/lyd-2026-10-23';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--autoplay-policy=user-gesture-required'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  const ev = []; 
  await page.goto('http://localhost:8765/index.html?menu=1'); await page.waitForTimeout(2500);
  const A = (f) => page.evaluate(`import('/src/audio/index.js').then((m) => (${f})(m))`);
  await page.evaluate(() => { const e = window.BREACH?.world?.events; if (e) for (const n of ['menuOpen','menuStart','menuClose']) e.on(n, (p) => (window.__mev = window.__mev || []).push([n, JSON.stringify(p), performance.now()|0])); });
  const r = {};
  r.pre = await A((m) => m._meter(true));
  await page.mouse.click(5, 5); // første interaksjon (utenfor knapper)
  const sample = async (lbl, n = 6) => { const s = []; for (let i = 0; i < n; i++) { s.push(await A((m) => m._meter(true))); await page.waitForTimeout(250); } r[lbl] = s; };
  await page.waitForTimeout(1800); await sample('menu');
  r.menuState = await A((m) => ({ menuMusic: m.getState().menuMusic, menuGain: m.getState().menuGain, state: m.getState().state }));
  await page.screenshot({ path: out + '/v16-meny.png' });
  r.directBefore = await A((m) => m.getState().played.uiClick || 0);
  await A((m) => { m.play('uiClick', { force: true }); m.play('explosion', { force: true }); });
  r.directAfter = await A((m) => ({ uiClick: m.getState().played.uiClick || 0, explosion: m.getState().played.explosion || 0, total: m.getState().played._total, before: 0 }));
  await page.waitForTimeout(150); r.duringExplosion = await A((m) => m._meter(true));
  await page.waitForTimeout(2500);
  // PLAY
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400); r.afterPlay400 = await A((m) => ({ meter: m._meter(true), menuMusic: m.getState().menuMusic, menuGain: m.getState().menuGain, played: m.getState().played._menuMusic }));
  await page.waitForTimeout(2500); r.afterClose = await A((m) => ({ meter: m._meter(true), menuMusic: m.getState().menuMusic, menuGain: m.getState().menuGain, played: m.getState().played._menuMusic }));
  // QUIT-scenario: menyen åpnes igjen (boot:false) → menymusikk på nytt, spillmusikk ut
  await page.evaluate(() => window.BREACH.menu.open(window.BREACH.world)); await page.waitForTimeout(2500);
  r.reopen = await A((m) => ({ meter: m._meter(true), menuMusic: m.getState().menuMusic, menuGain: m.getState().menuGain, played: m.getState().played._menuMusic }));
  await page.evaluate(() => window.BREACH.menu.close('close')); await page.waitForTimeout(1200);
  r.reclose = await A((m) => ({ meter: m._meter(true), menuMusic: m.getState().menuMusic, menuGain: m.getState().menuGain, menuEvents: m.getState().menuEvents }));
  r.events = await page.evaluate(() => window.__mev);
  r.errs = errs; console.log(JSON.stringify(r, null, 1)); await b.close();
})();
