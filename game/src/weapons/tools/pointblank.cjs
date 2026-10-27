// Kloss hold: treffrate per celle (avstand × vinkel × positur × fiendetype × våpen). Fast seed per celle.
// Kjør: node game/src/weapons/tools/pointblank.cjs <tag> [port]   → pointblank-<tag>.json (+ skrives inn i pointblank.md for hånd)
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const tag = process.argv[2] || 'run', port = process.argv[3] || 8771, N = +(process.env.N || 20);
const base = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243';
const exe = path.join(base, fs.readdirSync(base).find((d) => d.startsWith('chrome-')), 'chrome-headless-shell');
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: '/workspace/breach/game', stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const b = await chromium.launch({ executablePath: exe });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.goto(`http://localhost:${port}/index.html?skipmenu=1`); await p.waitForTimeout(800);
    await p.evaluate(async () => { BREACH.startGame(); const L = await import('/src/levels/index.js'); L.startAt(BREACH.world, 1, 0, { skipCutscenes: true }); BREACH.world.paused = false; }); await p.waitForTimeout(1500);
    await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    await p.evaluate(() => { if (BREACH.ui?.pause?.isOpen?.()) BREACH.ui.pause.close?.(); BREACH.world.level && (BREACH.world.level.spawnPaused = true); });
    console.log(await p.evaluate(async () => { window.PB = await import('/src/weapons/tools/pointblank-page.js'); return PB.setup(); }));
    // åpent punkt (ingen dekning innen 130 px) og et punkt rett sør for lav dekning
    const spots = await p.evaluate(() => { const W = BREACH.world, B = W.bounds, free = (x, y, m) => W.cover.every((c) => x < c.x - m || x > c.x + c.w + m || y < c.y - m || y > c.y + c.h + m);
      let open = null; const clear = (x, y) => W.cover.every((c) => x + 60 < c.x || x - 60 > c.x + c.w || y + 40 < c.y || y - 150 > c.y + c.h);
      for (let y = 200; y < B.h - 60 && !open; y += 8) for (let x = 80; x < B.w - 80; x += 8) if (clear(x, y)) { open = { x, y }; break; }
      const low = W.cover.filter((c) => c.type === 'low' && c.w >= 48 && free(c.x + c.w / 2, c.y - 90, 60) && free(c.x + c.w / 2, c.y + c.h + 30, 20)).map((c) => ({ x: c.x + c.w / 2, y: c.y + c.h + 15, c: [c.x, c.y, c.w, c.h] }))[0];
      return { open, low }; });
    console.log(JSON.stringify(spots));
    const weapons = (process.env.WEAPONS || 'shotgun,rifle,marksman').split(',');
    const poses = (process.env.POSES || 'hip,aim,cover,blind').split(',');
    const types = (process.env.TYPES || 'grunt,flanker,heavy,grenadier').split(',');
    const MODE = process.env.MODE || 'after';   // before = TUNING.pointBlank.pick/sweep av (gammel oppførsel)
    await p.evaluate(async (m) => { const D = await import('/src/weapons/data.js'); D.TUNING.pointBlank.pick = D.TUNING.pointBlank.sweep = m !== 'before'; }, MODE);
    const out = { tag, N, MODE, spots, cells: [] };
    for (const weapon of weapons) for (const pose of poses) for (const type of (weapon === 'shotgun' ? types : ['grunt'])) for (const gap of (process.env.GAPS || '10,20,40,80').split(',').map(Number)) for (const deg of (pose === 'cover' || pose === 'blind' ? [-90, -75] : (process.env.DEGS || '0,15,180').split(',').map(Number))) {
      if (gap === 0 && deg !== 0 && deg !== -90) continue;
      if ((pose === 'cover' || pose === 'blind') && !spots.low) continue;
      const sp = pose === 'cover' || pose === 'blind' ? spots.low : spots.open;
      // dekning: fienden står nord for den lave dekningen; gap regnes fra Warden (dekningen ligger imellom)
      const info = await p.evaluate((o) => PB.place(o), { px: sp.x, py: sp.y, type, gap: pose === 'cover' || pose === 'blind' ? gap + 40 : gap, deg, weapon, seed: 1000 + gap * 7 + deg });
      if (pose === 'cover' || pose === 'blind') for (let t = 0; t < 3 && (await p.evaluate(() => BREACH.world.player.state)) !== 'cover'; t++) { await p.keyboard.down('KeyE'); await p.evaluate(() => { BREACH.loop.step(1 / 60); }); await p.keyboard.up('KeyE'); await p.evaluate(() => { for (let i = 0; i < 40; i++) BREACH.loop.step(1 / 60); }); }
      const coverState = await p.evaluate(() => BREACH.world.player.state);
      const r = await p.evaluate((o) => PB.shoot(o), { n: N, aim: pose === 'aim' || pose === 'cover', weapon });
      const why = r.find((x) => x && x.why); const ok = r.filter((x) => x && !x.why), any = ok.filter((s) => s.hits > 0).length / (ok.length || 1), frac = ok.reduce((a, s) => a + s.hits / s.pellets, 0) / (ok.length || 1);
      const zP = ok.map((s) => s.zPass).filter(Number.isFinite), z0 = ok.map((s) => s.z0).filter(Number.isFinite);
      const cell = { weapon, pose, type, gap, deg, center: +info.r.toFixed(1), shots: ok.length, any: +any.toFixed(2), frac: +frac.toFixed(2), z0: z0.length ? +(z0.reduce((a, b) => a + b) / z0.length).toFixed(1) : null, zPass: zP.length ? +(zP.reduce((a, b) => a + b) / zP.length).toFixed(1) : null, hz: (() => { const h = ok.map((s) => s.hz).filter(Number.isFinite); return h.length ? +(h.reduce((a, b) => a + b) / h.length).toFixed(1) : null; })(), why: why?.why, missMin: ok.length ? +Math.min(...ok.map((s) => s.missMin ?? 99)).toFixed(1) : null, state: ok[0]?.state, posture: ok[0]?.posture, mz: ok[0]?.mz };
      cell.coverState = coverState; out.cells.push(cell); console.log(JSON.stringify(cell));
    }
    if (process.env.SHOT) { await p.evaluate(async (o) => { await PB.place(o); }, { px: spots.open.x, py: spots.open.y, type: 'grunt', gap: 10, deg: 0, weapon: 'shotgun', seed: 1 }); }
    out.errs = errs; fs.writeFileSync(path.join(__dirname, `pointblank-${tag}.json`), JSON.stringify(out, null, 1));
  } finally { await b.close(); srv.kill(); }
})();
