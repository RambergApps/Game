// Måler død → kontroll (Story og brett). Bruk: node game/src/levels/tools/dodstid.cjs [port]
// Kontroll = Warden lever, ingen mellomsekvens-canvas, world.paused=false og direktøren i 'break'/'wave'.
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const EXE = '/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const PORT = process.argv[2] || 8793;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://localhost:${PORT}/index.html`); await page.waitForFunction(() => window.BREACH);
  await page.evaluate(() => { document.getElementById('start-screen')?.remove(); const W = window.BREACH.world; W.paused = false; W.modules.levels.startLevel(W, 1, { skipCutscenes: true }); });
  await page.waitForFunction(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase === 'wave', null, { timeout: 20000 });
  const die = async (esc) => {
    const p = page.evaluate(async () => {
      const W = window.BREACH.world, L = W.modules.levels, { damage } = await import('/src/core/index.js');
      W.player.invuln = false; const t0 = performance.now(); let tCs = null, tRespawn = null;
      damage(W.player, 99999, null, W);
      return await new Promise((res) => {
        const tick = () => {
          const d = L._debug(W), cs = !!document.querySelector('canvas.breach-cutscene');
          if (cs && tCs == null) tCs = performance.now() - t0;
          if (!W.player.dead && tRespawn == null) tRespawn = performance.now() - t0;
          const ctl = !W.player.dead && !cs && !W.paused && (d.phase === 'break' || d.phase === 'wave');
          if (ctl) return res({ control: +((performance.now() - t0) / 1000).toFixed(2), cutsceneAt: tCs && +(tCs / 1000).toFixed(2), respawn: tRespawn && +(tRespawn / 1000).toFixed(2), banner: d.banner?.title || null });
          if (performance.now() - t0 > 20000) return res({ timeout: true });
          requestAnimationFrame(tick);
        };
        tick();
      });
    });
    if (esc) { await page.waitForSelector('canvas.breach-cutscene', { timeout: 5000 }); await page.waitForTimeout(200); await page.keyboard.press('Escape'); }
    return p;
  };
  const out = {};
  await page.evaluate(() => window.BREACH.world.modules.levels.setFallenSeen(false));
  out.forsteDodUtenInndata = await die(false);
  await page.waitForTimeout(3500);
  await page.evaluate(() => window.BREACH.world.modules.levels.setFallenSeen(false));
  out.forsteDodMedEsc = await die(true);
  await page.waitForTimeout(3500);
  out.andreDod = await die(false);
  await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/shots/dod-banner.png' });
  console.log(JSON.stringify({ ...out, errs }, null, 1));
  await b.close();
})();
