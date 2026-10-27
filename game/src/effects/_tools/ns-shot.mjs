// Før/etter i spillet. Standard: NS-barrierer v4 (venstre) og v5 (høyre) → reviews/img/ns-barrierer-v5.png.
// --skygge: v5 med dagens skygge (venstre) og v5 med foreslått skygge (høyre; arena/render.js byttes KUN i nettleseren via page.route
// med reviews/diffs/arena-ns-skygge.diff anvendt i en kopi) → reviews/img/ns-barrierer-v5-skygge.png.
import { createRequire } from 'node:module'; import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(REPO, 'package.json')); const { chromium } = require('playwright-core');
const port = 8900 + Math.floor(Math.random() * 90), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), TMP = '/workspace/vfxr'; fs.mkdirSync(TMP, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(900);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const SKY = process.argv.includes('--skygge'), PATCHED = SKY ? (() => { const t = '/workspace/vfxr/rp'; fs.rmSync(t, { recursive: true, force: true }); fs.mkdirSync(t + '/game/src/arena', { recursive: true }); fs.copyFileSync(path.join(REPO, 'game/src/arena/render.js'), t + '/game/src/arena/render.js'); execFileSync('patch', ['-p1', '-s', '-i', path.join(REPO, 'reviews/diffs/arena-ns-skygge.diff')], { cwd: t }); return fs.readFileSync(t + '/game/src/arena/render.js', 'utf8'); })() : null;
for (const v of (SKY ? ['5a', '5b'] : [4, 5])) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); pg.on('pageerror', (e) => console.log('ERR', String(e)));
  await pg.addInitScript((v) => { globalThis.__BREACH_NSV = v; }, v === 4 ? 4 : 5);
  if (v === '5b') await pg.route('**/src/arena/render.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: PATCHED }));
  await pg.goto(`http://127.0.0.1:${port}/index.html?view=34&dpr=1&zoom=2.25`); await pg.waitForFunction(() => window.BREACH?.world?.player);
  await pg.evaluate(() => window.BREACH.startGame?.()); await sleep(1500);
  for (let i = 0; i < 12; i++) { const ph = await pg.evaluate(() => window.BREACH.world.modules?.levels?._debug?.(window.BREACH.world)?.phase); if (ph !== 'cutscene') break; await pg.keyboard.press('Escape'); await sleep(600); }
  const r = await pg.evaluate(() => { const B = window.BREACH, w = B.world; B.loop.stop();
    const ns = w.cover.filter((c) => c.type === 'low' && (c.kind === 'barrier') && c.h > c.w).sort((a, b) => b.h - a.h);
    const c = ns[0]; if (!c) return { none: true, kinds: [...new Set(w.cover.map((c) => c.kind + ':' + (c.h > c.w ? 'ns' : 'ew')))] };
    const p = w.player; p.x = c.x - 26; p.y = c.y + c.h * 0.6; p.vx = p.vy = 0; w.input.mouse.worldX = p.x - 200; w.input.mouse.worldY = p.y;
    for (let i = 0; i < 30; i++) { for (const e of w.enemies) e.hp = 0, e.dead = true; B.camera.zoom = B.PROJ.zoom; B.camera.x = c.x + c.w / 2; B.camera.y = c.y + c.h / 2; B.loop.advance(1); }
    const s = B.camera.worldToScreen(c.x + c.w / 2, c.y + c.h / 2); return { c, n: ns.length, s, zoom: B.camera.zoom };
  });
  console.log(v, JSON.stringify(r)); if (r.none) process.exit(1);
  const cx = Math.max(0, Math.min(1280 - 360, Math.round(r.s.x - 180))), cy = Math.max(0, Math.min(720 - 300, Math.round(r.s.y - 150)));
  await pg.screenshot({ path: `${TMP}/ns${v}.png`, clip: { x: cx, y: cy, width: 360, height: 300 } }); await pg.close();
}
await b.close(); srv.kill();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${TMP}/ns${SKY ? '5a' : 4}.png`, '-i', `${TMP}/ns${SKY ? '5b' : 5}.png`, '-filter_complex', '[0]scale=720:600[a];[1]scale=720:600[b];[a][b]hstack=2', path.join(REPO, SKY ? 'reviews/img/ns-barrierer-v5-skygge.png' : 'reviews/img/ns-barrierer-v5.png')]);
console.log('ok');
