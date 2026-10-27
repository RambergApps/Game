// Klipp: S-12 mot Lurcher (lavest) 20 px vest for Warden, markøren på brystet. FØR (TUNING.pointBlank.pick=false) / ETTER.
// Kjør: node game/src/weapons/tools/pointblank-clip.cjs [port] → shots/pointblank/{before,after}.mp4 + .png + side-by-side
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { spawn, execSync } = require('child_process');
const port = process.argv[2] || 8779, OUT = path.join(__dirname, '../shots/pointblank'), TMP = '/tmp/pbclip';
const base = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243';
const exe = path.join(base, fs.readdirSync(base).find((d) => d.startsWith('chrome-')), 'chrome-headless-shell');
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP);
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: '/workspace/breach/game', stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const b = await chromium.launch({ executablePath: exe });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  try {
    await p.goto(`http://localhost:${port}/index.html?skipmenu=1`); await p.waitForTimeout(800);
    await p.evaluate(async () => { BREACH.startGame(); const L = await import('/src/levels/index.js'); L.startAt(BREACH.world, 1, 0, { skipCutscenes: true }); BREACH.world.paused = false; }); await p.waitForTimeout(1500);
    await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    await p.evaluate(async () => { window.PB = await import('/src/weapons/tools/pointblank-page.js'); await PB.setup(); window.__D = await import('/src/weapons/data.js'); });
    const stats = {};
    for (const mode of ['before', 'after']) {
      const info = await p.evaluate(async (mode) => { __D.TUNING.pointBlank.pick = mode === 'after'; __D.TUNING.pointBlank.sweep = mode === 'after';
        return PB.place({ px: 704, py: 260, type: 'flanker', gap: 20, deg: 180, weapon: 'shotgun', seed: 77 }); }, mode);
      let f = 0, hits = 0, pel = 0;
      for (let shot = 0; shot < 3; shot++) {
        await p.evaluate(() => { const S = __PB, W = S.W, e = S.foe, inp = W.input; e.x = S.fx; e.y = S.fy; const s = S.B.camera.worldToScreen(e.x, e.y - S.zc * __PROJ.zScale); inp.mouse.x = s.x; inp.mouse.y = s.y; inp.mouse.right = false; for (let i = 0; i < 6; i++) { W.paused = false; S.B.loop.step(1 / 60); e.x = S.fx; e.y = S.fy; } S.B.loop.render(); S.shots.clear(); });
        for (let k = 0; k < 16; k++) {
          await p.evaluate((k) => { const S = __PB, W = S.W, e = S.foe, inp = W.input; inp.mouse.left = k < 3; inp.mouse.leftPressed = k === 0; W.paused = false; S.B.loop.step(1 / 60); e.x = S.fx; e.y = S.fy; S.B.loop.render(); }, k);
          await p.screenshot({ path: `${TMP}/${mode}-${String(f++).padStart(3, '0')}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } });
          if (shot === 1 && k === 2) await p.screenshot({ path: `${OUT}/${mode}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } });
        }
        const r = await p.evaluate(() => [...__PB.shots.values()].map((s) => [s.hits, s.pellets])); for (const [h, n] of r) { hits += h; pel += n; }
        await p.evaluate(() => { for (let i = 0; i < 40; i++) { __PB.W.paused = false; __PB.B.loop.step(1 / 60); __PB.foe.x = __PB.fx; __PB.foe.y = __PB.fy; } });
      }
      stats[mode] = { hits, pellets: pel, info };
      execSync(`ffmpeg -y -loglevel error -framerate 12 -i ${TMP}/${mode}-%03d.png -pix_fmt yuv420p -vf "scale=600:400" ${OUT}/${mode}.mp4`);
    }
    execSync(`ffmpeg -y -loglevel error -i ${OUT}/before.png -i ${OUT}/after.png -filter_complex hstack ${OUT}/before-after.png`);
    console.log(JSON.stringify(stats));
  } finally { await b.close(); srv.kill(); }
})();
