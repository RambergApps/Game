// Skjermbilde + video av ny standardvinkel midt i bølge. node src/arena/_tools/vinkel-shot.cjs [query]
const { chromium } = require('playwright-core'); const { spawn, execFileSync } = require('child_process'); const fs = require('fs');
const OUT = '/workspace/breach/shots/arena/vinkel', Q = process.argv[2] || '';
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8767'], { cwd: __dirname + '/../../..', stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true, channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: '/tmp/vinkel-vid', size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:8767/index.html' + Q); await page.waitForFunction(() => window.BREACH);
  await page.mouse.click(640, 360); await page.waitForTimeout(1500); await page.keyboard.press('Space'); await page.waitForTimeout(500); await page.keyboard.press('Escape');
  for (let i = 0; i < 120; i++) { const n = await page.evaluate(() => window.BREACH.world.enemies.filter(e => !e.dead).length); if (n >= 3) break; await page.waitForTimeout(500); }
  const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < (+process.env.DUR || 16000)) {
    const tgt = await page.evaluate(() => { const { world, camera } = window.BREACH; world.player.hp = world.player.maxHp || 100; const e = world.enemies.find(e => !e.dead); if (!e) return null; const s = camera.worldToScreen(e.x, e.y); return s; });
    if (tgt) await page.mouse.move(tgt.x, tgt.y - 20);
    await page.mouse.down(); await page.keyboard.down(['KeyA', 'KeyD'][(k >> 3) & 1]); await page.waitForTimeout(250); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD'); await page.mouse.up(); k++;
    if (k === (+process.env.SHOTK || 30)) await page.screenshot({ path: OUT + '/' + (process.env.NAME || 'ny-vinkel') + '.png' });
  }
  const st = await page.evaluate(() => { const { world, camera } = window.BREACH; return { zoom: camera.zoom, g: camera.g, enemies: world.enemies.filter(e => !e.dead).length, view: world.view }; });
  const vp = await page.video().path(); await ctx.close(); await b.close(); srv.kill();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2', '-i', vp, '-t', '14', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', OUT + '/' + (process.env.NAME || 'ny-vinkel') + '.mp4']);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', OUT + '/' + (process.env.NAME || 'ny-vinkel') + '.png', '-q:v', '3', OUT + '/' + (process.env.NAME || 'ny-vinkel') + '.jpg']);
  console.log(JSON.stringify({ errs, ...st }));
})();
