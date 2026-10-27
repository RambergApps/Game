// Før/etter kant: fiender bak containeren 37,19 (én dypt under taket, én over nordkanten). Før = dagens shared/depth.js, etter = NEWD-diff
// (reviews/diffs/arena-silhuett-kant.diff) på en kopi, servert KUN via page.route. NEWD=… OUT=… node …
import { createRequire } from 'node:module'; import { spawn, execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(REPO, 'package.json')); const { chromium } = require('playwright-core');
const port = 8600 + Math.floor(Math.random() * 90), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), TMP = '/workspace/vfxr';
const t = TMP + '/dpp'; fs.rmSync(t, { recursive: true, force: true }); fs.mkdirSync(t + '/game/src/shared', { recursive: true });
fs.copyFileSync(path.join(REPO, 'game/src/shared/depth.js'), t + '/game/src/shared/depth.js'); if (process.env.NEWD) execFileSync('patch', ['-p1', '-s', '-i', path.join(REPO, process.env.NEWD || '')], { cwd: t });
const NEW = fs.readFileSync(t + '/game/src/shared/depth.js', 'utf8');
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(900);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
for (const v of ['for', 'etter']) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); pg.on('pageerror', (e) => console.log('ERR', String(e)));
  if (v === 'etter' && process.env.NEWD) await pg.route('**/src/shared/depth.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: NEW }));
  await pg.goto(`http://127.0.0.1:${port}/index.html?view=34&dpr=1&zoom=2.25`); await pg.waitForFunction(() => window.BREACH?.world?.player);
  await pg.evaluate(() => window.BREACH.startGame?.()); await sleep(1500);
  for (let i = 0; i < 12; i++) { const ph = await pg.evaluate(() => window.BREACH.world.modules?.levels?._debug?.(window.BREACH.world)?.phase); if (ph !== 'cutscene') break; await pg.keyboard.press('Escape'); await sleep(600); }
  const r = await pg.evaluate(() => { const B = window.BREACH, w = B.world; B.loop.stop();
    const c = w.cover.find((c) => c.kind === 'container' && c.x === 1184) || w.cover.find((c) => c.kind === 'container');
    let k = 0; while (w.enemies.filter((e) => !e.dead).length < 2 && k++ < 1200) B.loop.advance(1);
    const es = w.enemies.filter((e) => !e.dead).slice(0, 2), pos = (globalThis.__POS || [[c.x + 30, c.y + 60], [c.x + 44, c.y - 15]]);

    es.forEach((e, i) => { for (const [k, j] of [['x', 0], ['y', 1]]) Object.defineProperty(e, k, { get: () => pos[i][j], set: () => {}, configurable: true }); });   // låst posisjon (testkrok): kollisjon kan ikke dytte ut
    const p = w.player; const pin = () => { p.x = c.x - 60; p.y = c.y + c.h + 30; p.vx = p.vy = 0; p.hp = 100; es.forEach((e, i) => { e.x = pos[i][0]; e.y = pos[i][1]; e.vx = e.vy = 0; e.hp = Math.max(e.hp, 50); }); };
    for (let i = 0; i < 20; i++) { pin(); B.camera.zoom = B.PROJ.zoom; B.camera.x = c.x + c.w / 2; B.camera.y = c.y + c.h / 2; B.loop.advance(1); }
    for (let i = 0; i < 10; i++) { p.x = c.x - 60; es.forEach((e, i) => { e.x = pos[i][0]; e.y = pos[i][1]; }); B.loop.advance(1); }
    return { es: es.map((e) => [e.id, Math.round(e.x), Math.round(e.y), e.type, e.dead]), all: w.enemies.filter((e) => !e.dead).map((e) => [e.id, Math.round(e.x), Math.round(e.y)]), c: [c.x, c.y, c.w, c.h, c.elev], n: es.length, k, s: B.camera.worldToScreen(c.x + c.w / 2, c.y + c.h / 2) };
  });
  console.log(v, JSON.stringify(r));
  await pg.screenshot({ path: `${TMP}/sil-${v}.png`, clip: { x: Math.max(0, Math.round(r.s.x - 220)), y: Math.max(0, Math.round(r.s.y - 330)), width: 440, height: 420 } }); await pg.close();
}
await b.close(); srv.kill();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${TMP}/sil-for.png`, '-i', `${TMP}/sil-etter.png`, '-filter_complex', '[0]scale=660:630[a];[1]scale=660:630[b];[a][b]hstack=2', path.resolve(REPO, process.env.OUT || 'reviews/img/silhuett-for-etter.png')]);
console.log('ok');
