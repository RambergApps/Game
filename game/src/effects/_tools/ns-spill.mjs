// Før/etter i spillet for NS-barrierene ved Pier (11.5,21 / 11.5,23.6). Før: gamle data (0,75×1,5 + 0,75×1,25) og gammel skygge
// (arena-ns-skygge.diff reversert) – byttes KUN i nettleseren via page.route. Etter: spillet som det er. → reviews/img/ns-barrierer-spill-for-etter.png
import { createRequire } from 'node:module'; import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(REPO, 'package.json')); const { chromium } = require('playwright-core');
const port = 8700 + Math.floor(Math.random() * 90), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), TMP = '/workspace/vfxr';
const t = TMP + '/rold'; fs.rmSync(t, { recursive: true, force: true }); fs.mkdirSync(t + '/game/src/arena', { recursive: true });
fs.copyFileSync(path.join(REPO, 'game/src/arena/render.js'), t + '/game/src/arena/render.js'); execFileSync('patch', ['-p1', '-R', '-s', '-i', path.join(REPO, 'reviews/diffs/arena-ns-skygge.diff')], { cwd: t });
const OLDR = fs.readFileSync(t + '/game/src/arena/render.js', 'utf8');
const OLDY = fs.readFileSync(path.join(REPO, 'game/src/arena/yard-v2.js'), 'utf8').replace("['barrier', 11.5, 21.25, 0.75, 1]", "['barrier', 11.5, 21, 0.75, 1.5]").replace("['barrier', 11.5, 23.625, 0.75, 1]", "['barrier', 11.5, 23.5, 0.75, 1.25]");
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(900);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
for (const v of ['for', 'etter']) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); pg.on('pageerror', (e) => console.log('ERR', String(e)));
  if (v === 'for') { await pg.route('**/src/arena/render.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: OLDR })); await pg.route('**/src/arena/yard-v2.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: OLDY })); }
  await pg.goto(`http://127.0.0.1:${port}/index.html?view=34&dpr=1&zoom=2.25`); await pg.waitForFunction(() => window.BREACH?.world?.player);
  await pg.evaluate(() => window.BREACH.startGame?.()); await sleep(1500);
  for (let i = 0; i < 12; i++) { const ph = await pg.evaluate(() => window.BREACH.world.modules?.levels?._debug?.(window.BREACH.world)?.phase); if (ph !== 'cutscene') break; await pg.keyboard.press('Escape'); await sleep(600); }
  const r = await pg.evaluate(() => { const B = window.BREACH, w = B.world; B.loop.stop();
    const ns = w.cover.filter((c) => c.kind === 'barrier' && c.x === 368 && c.y >= 660 && c.y < 780);
    const p = w.player; p.x = 368 - 26; p.y = 712; p.vx = p.vy = 0; w.input.mouse.worldX = p.x - 200; w.input.mouse.worldY = p.y;
    for (let i = 0; i < 30; i++) { for (const e of w.enemies) e.hp = 0, e.dead = true; B.camera.zoom = B.PROJ.zoom; B.camera.x = 380; B.camera.y = 730; B.loop.advance(1); }
    return { ns: ns.map((c) => [c.x, c.y, c.w, c.h]), s: B.camera.worldToScreen(380, 730) };
  });
  console.log(v, JSON.stringify(r));
  await pg.screenshot({ path: `${TMP}/nsp-${v}.png`, clip: { x: Math.round(r.s.x - 200), y: Math.round(r.s.y - 190), width: 400, height: 380 } }); await pg.close();
}
await b.close(); srv.kill();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${TMP}/nsp-for.png`, '-i', `${TMP}/nsp-etter.png`, '-filter_complex', '[0]scale=640:608[a];[1]scale=640:608[b];[a][b]hstack=2', path.join(REPO, 'reviews/img/ns-barrierer-spill-for-etter.png')]);
console.log('ok');
