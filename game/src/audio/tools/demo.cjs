// Live demoflyt (v1.4.1): hovedmeny (Arena, ?menu=1) → intro → brett 1 (bølge 1–5, fiender drepes automatisk) → yard-clear.
// Logger hendelser, lyder (diff av getState().played hvert 250 ms) og masternivå (_meter) → hull, dobbeltlyder, hengende støy.
// Kjør fra game/: NODE_PATH=../node_modules node src/audio/tools/demo.cjs > /tmp/demo.out
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('http://localhost:8765/index.html?menu=1'); await page.waitForSelector('[data-ui="main-menu"] .bm-btn'); await page.waitForTimeout(2200);
  await page.evaluate(async () => {
    window.__audio = await import('/src/audio/index.js'); window.__combat = await import('/src/core/combat.js');
    const w = window.BREACH.world; window.__ev = []; const T0 = performance.now(); window.__T0 = T0;
    for (const t of ['menuOpen', 'menuStart', 'levelStart', 'cutsceneStart', 'cutsceneEnd', 'waveStart', 'waveEnd', 'waveClear', 'levelEnd', 'upgrade', 'upgradeOffer', 'restart', 'playerDeath'])
      w.events.on(t, (p) => window.__ev.push({ s: +((performance.now() - T0) / 1000).toFixed(2), t, id: p?.id ?? p?.waveId ?? p?.level, skipped: p?.skipped }));
    window.__log = []; let prev = {};
    window.__samp = setInterval(() => {
      const A = window.__audio, st = A.getState(); const d = {};
      for (const [k, v] of Object.entries(st.played || {})) if (v !== (prev[k] || 0)) d[k] = v - (prev[k] || 0);
      prev = { ...st.played };
      window.__log.push({ s: +((performance.now() - T0) / 1000).toFixed(2), db: A._meter() === null ? null : +A._meter().toFixed(1), d, cs: st.cutscene, bed: st.radioBed, scene: st.scene, menu: st.menuMusic, paused: st.paused, i: +(st.intensity || 0).toFixed(2), v: st.voices });
    }, 250);
  });
  // første tast låser opp lyden (nettleserregel) → menystemningen starter; så hover over knappene og PLAY
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(5000);
  for (const id of ['levels', 'settings', 'credits', 'play']) { await page.hover(`.bm-btn[data-id="${id}"]`); await page.waitForTimeout(450); }
  await page.screenshot({ path: process.env.OUT + '/demo-1-meny.png' });
  await page.waitForTimeout(1500);
  await page.click('.bm-btn[data-id="play"]');
  const has = (t, id) => page.evaluate(([t, id]) => window.__ev.some((e) => e.t === t && (id === undefined || e.id === id)), [t, id]);
  // intro: Enter linje for linje (ekte forløp)
  for (let i = 0; i < 80 && !(await has('cutsceneEnd')); i++) { await page.waitForTimeout(i === 4 ? 0 : 1600); if (i === 4) await page.screenshot({ path: process.env.OUT + '/demo-2-intro.png' }); await page.keyboard.press('Enter'); }
  await page.evaluate(() => { const w = window.BREACH.world, P = w.player;
    window.__god = setInterval(() => { if (P) P.hp = P.maxHp; }, 100);
    window.__kill = setInterval(() => { if (w.paused) return; for (const e of w.enemies || []) if (e && !e.dead && (e.spawnT ?? 1) > 0.3) window.__combat.damage(e, 9999, P, w, { weapon: 'rifle' }); }, 1200);
  });
  let shot = false;
  for (let i = 0; i < 400 && !(await has('cutsceneStart', 'yard-clear')); i++) {
    await page.waitForTimeout(500);
    if (!shot && await has('waveStart')) { await page.waitForTimeout(1500); await page.screenshot({ path: process.env.OUT + '/demo-3-brett1.png' }); shot = true; }
    if (i % 4 === 0) await page.keyboard.press('Digit1');
  }
  await page.evaluate(() => { clearInterval(window.__kill); });
  for (let i = 0; i < 80 && !(await has('cutsceneEnd', 'yard-clear')); i++) { await page.waitForTimeout(1800); if (i === 2) await page.screenshot({ path: process.env.OUT + '/demo-4-yard-clear.png' }); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => ({ ev: window.__ev, log: window.__log, state: window.__audio.getState() }));
  console.log(JSON.stringify({ errors, ...r }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
