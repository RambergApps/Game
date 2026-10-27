// Skjermbilder av arenaene i headless Chromium.
// Kjør: node src/arena/_tools/shots.cjs <sett> [navn...]   sett = yard | refinery | v3
// Forutsetter http-server på :8765 med rot i game/. Lagrer PNG i shots/ og JPG (q85) av utvalgte.
const { chromium } = require('playwright-core');
const fs = require('fs');
const { execFileSync } = require('child_process');
const OUT = '/workspace/breach/shots';
const BASE = process.env.BASE || 'http://localhost:8765';
const set = process.argv[2] || 'yard';
const only = process.argv.slice(3);
const T = '/src/arena/test.html';

const SETS = {
  yard: {
    prefix: 'arena-yard-v2',
    shots: [
      ['overview', `${T}?arena=yard`, 1600, 1220],
      ['close', `${T}?arena=yard&x=420&y=640&zoom=1.6`],
      ['close-light', `${T}?arena=yard&x=480&y=600&zoom=2.6`],
      ['close2', `${T}?arena=yard&x=860&y=360&zoom=2`],
      ['overlay', `${T}?arena=yard&overlay=crz`, 1600, 1220],
      // A1-bevis: spiller rett mot nordsiden av container (9,16)-(11,22) og fiende nord for stabel (16,12)
      ['roof', `${T}?arena=yard&x=470&y=470&zoom=2.4&actors=320,505,player;545,370,enemy;990,250,enemy`],
      ['flash', `${T}?arena=yard&x=560&y=520&zoom=1.5`, 1600, 1000, 1500, 'flash'],
      ['game', '/index.html', 1600, 1000, 2500],
    ],
  },
  v3: {
    prefix: 'arena-v3-trekvart',
    shots: [
      ['first', `${T}?view=34&arena=yard&x=560&y=500&zoom=1.6&actors=690,470,enemy;728,586,player;224,470,enemy;300,540,player;560,395,enemy;420,520,player`, 1600, 1000],
      ['overview', `${T}?view=34&arena=yard`, 1600, 1220],
      ['game', `${T}?view=34&arena=yard&x=500&y=480&zoom=1.9&actors=690,470,enemy;728,586,player;224,470,enemy;300,540,player;560,395,enemy;420,520,player`, 1600, 1000],
      ['game-top', `${T}?arena=yard&x=500&y=480&zoom=1.9&actors=690,470,enemy;728,586,player;224,470,enemy;300,540,player;560,395,enemy;420,520,player`, 1600, 1000],
      ['overlay', `${T}?view=34&arena=yard&x=500&y=480&zoom=1.9&overlay=cz&actors=690,470,enemy;728,586,player;224,470,enemy;300,540,player;560,395,enemy;420,520,player`, 1600, 1000],
      ['overlay-full', `${T}?view=34&arena=yard&overlay=cz`, 1600, 1220],
      ['refinery', `${T}?view=34&arena=refinery-crossroads`, 1600, 1180],
      ['tanks2', `${T}?view=34&arena=refinery-crossroads&x=330&y=260&zoom=2.2`, 1600, 1000],
      ['tanks', `${T}?view=34&arena=refinery-crossroads&x=330&y=470&zoom=2.4&actors=320,452,enemy;360,640,player;250,560,player`, 1600, 1000],
    ],
  },
  ammo: {
    prefix: 'arena-ammo',
    shots: [
      ['34', `${T}?view=34&arena=yard&x=740&y=470&zoom=2.6&actors=600,520,player;840,450,enemy`, 1600, 1000, 1500, 'ammo-closed'],
      ['top', `${T}?arena=yard&x=740&y=470&zoom=2.6&actors=600,520,player;840,450,enemy`, 1600, 1000, 1500, 'ammo-closed'],
      ['overlay', `${T}?view=34&arena=yard&overlay=cz`, 1600, 1220],
      ['refinery', `${T}?view=34&arena=refinery-crossroads&overlay=z`, 1600, 1180],
    ],
  },
  refinery: {
    prefix: 'arena-refinery',
    shots: [
      ['overview', `${T}?arena=refinery-crossroads`, 1600, 1180],
      ['close', `${T}?arena=refinery-crossroads&x=560&y=560&zoom=1.7`],
      ['close2', `${T}?arena=refinery-crossroads&x=1050&y=420&zoom=1.8`],
      ['close3', `${T}?arena=refinery-crossroads&x=300&y=330&zoom=2`],
      ['overlay', `${T}?arena=refinery-crossroads&overlay=crz`, 1600, 1180],
      ['roof', `${T}?arena=refinery-crossroads&x=420&y=560&zoom=2.4&actors=310,450,player;160,605,enemy;560,560,enemy`],
      ['flash', `${T}?arena=refinery-crossroads&x=680&y=500&zoom=1.5`, 1600, 1000, 1500, 'flash'],
      ['game', '/index.html', 1600, 1000, 2500, 'game-refinery'],
    ],
  },
};

(async () => {
  const exe = fs.readdirSync(process.env.HOME + '/.cache/ms-playwright').find((d) => d.startsWith('chromium-'));
  const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/${exe}/chrome-linux64/chrome`, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const S = SETS[set];
  fs.mkdirSync('/tmp/arena-shots', { recursive: true });
  for (const [name, url, w = 1600, h = 1000, wait = 1500, action] of S.shots) {
    if (only.length && !only.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('console', (m) => { if (m.type() === 'info') console.log(name, m.text()); if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`[${name}] requestfailed: ${r.url()}`));
    await page.goto(BASE + url); await page.waitForTimeout(wait);
    if (action === 'flash') {
      // skudd fra spiller og fiende + eksplosjon, frosset midt i forløpet
      await page.evaluate(() => {
        const w = window.BREACH.world, ev = w.events;
        ev.emit('explosion', { x: 640, y: 560, radius: 80 });
        ev.emit('shot', { projectile: { x: 420, y: 650, angle: -0.6, team: 'player' }, team: 'player' });
        ev.emit('shot', { projectile: { x: 760, y: 400, angle: 2.4, team: 'enemy' }, team: 'enemy' });
        ev.emit('coverHit', { x: 600, y: 470 });
        w.paused = true;
        for (const f of w._arenaState.fx.flashes) f.t = f.kind === 'explosion' ? f.life * 0.09 : f.life * 0.15;
      });
      await page.waitForTimeout(200);
    }
    if (action === 'ammo-closed') {
      // kasse 2 «brukt» (Våpen setter ready=false under nedkjøling) – lukket lokk, dempet
      await page.evaluate(() => { const c = window.BREACH.world.arena.ammoCrates; c[1].ready = false; c[1].readyAt = 1e9; });
      await page.waitForTimeout(300);
    }
    if (action === 'game-refinery') {
      await page.evaluate(() => { const w = window.BREACH.world; const m = w.modules?.arena; if (m?.loadArena) { m.loadArena(w, 'refinery-crossroads'); if (w.player) { w.player.x = w.arena.playerSpawn.x; w.player.y = w.arena.playerSpawn.y; } } });
      await page.waitForTimeout(1200);
    }
    const info = await page.evaluate(() => { const B = window.BREACH; if (!B) return null; const w = B.world; return { arena: w.arena?.id, size: [w.arena?.cols, w.arena?.rows], cover: w.cover.length, bounds: w.bounds, fps: Math.round(B.loop?.stats?.fps || 0), build: window.ARENA_TEST?.buildMs | 0, player: w.player ? [Math.round(w.player.x), Math.round(w.player.y)] : null }; });
    const file = `${OUT}/${S.prefix}-${name}.png`;
    await page.screenshot({ path: file });
    fs.copyFileSync(file, `/tmp/arena-shots/${S.prefix}-${name}.png`);
    console.log(name, JSON.stringify(info));
    await page.close();
  }
  console.log(errors.length ? errors.join('\n') : 'Ingen konsollfeil.');
  await browser.close();
})();
