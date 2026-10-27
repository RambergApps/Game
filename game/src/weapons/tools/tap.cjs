// Touchpad-trykk: kort klikk (mousedown+mouseup i samme frame) skal gi skudd. Teller weaponFire per trykk.
// Kjør: node game/src/weapons/tools/tap.cjs <tag> [port]  (N=trykk per celle, default 10) → tap-<tag>.json
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const tag = process.argv[2] || 'run', port = +(process.argv[3] || 8861), N = +(process.env.N || 10);
const base = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243';
const exe = path.join(base, fs.readdirSync(base).find((d) => d.startsWith('chrome-')), 'chrome-headless-shell');
const free = (p) => new Promise((r) => { const s = net.createServer().once('error', () => r(false)).once('listening', () => s.close(() => r(true))).listen(p, '127.0.0.1'); });
(async () => {
  if (!(await free(port))) { console.error(`port ${port} opptatt`); process.exit(2); }
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: '/workspace/breach/game', stdio: 'ignore' });
  console.log('server pid', srv.pid); await new Promise((r) => setTimeout(r, 700));
  const b = await chromium.launch({ executablePath: exe }), errs = [];
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.goto(`http://127.0.0.1:${port}/index.html?skipmenu=1`); await p.waitForTimeout(800);
    await p.evaluate(async () => { BREACH.startGame(); const L = await import('/src/levels/index.js'); L.startAt(BREACH.world, 1, 0, { skipCutscenes: true }); });
    await p.waitForTimeout(1500); await p.keyboard.press('Escape'); await p.waitForTimeout(800);
    await p.evaluate(async () => { const W = BREACH.world; window.__Wp = await import('/src/weapons/index.js');
      window.__T = { n: 0 }; W.events.on('weaponFire', (e) => { if (e.entity === W.player) __T.n++; });
      setInterval(() => { for (const e of W.enemies) { e.x = 40; e.y = 40; e.vx = e.vy = 0; e.stunned = 1; e.staggerUntil = 1e9; } W.paused = false; document.querySelectorAll('.bx-root').forEach((n) => n.remove()); const pl = W.player; pl.hp = pl.maxHp; pl.invuln = 999; }, 50); });
    await p.evaluate(async (m) => { (await import('/src/weapons/data.js')).TUNING.input.tap = m !== 'before'; }, process.env.MODE || 'after');
    const box = await p.locator('canvas').first().boundingBox(), mx = box.x + box.width * 0.5, my = box.y + box.height * 0.2;
    const place = async (pose, weapon) => {
      await p.evaluate(({ pose, weapon }) => { const W = BREACH.world, pl = W.player; if (pl.state === 'cover') pl.state = 'move';
        const sp = pose === 'cover' ? { x: 464, y: 751 } : { x: 704, y: 200 }; pl.x = sp.x; pl.y = sp.y; pl.vx = pl.vy = 0;
        __Wp.switchWeapon(W, pl, weapon); pl.loadout.infinite = true; }, { pose, weapon });
      await p.waitForTimeout(500);
      if (pose === 'cover') for (let t = 0; t < 4 && (await p.evaluate(() => BREACH.world.player.state)) !== 'cover'; t++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(500); }
      await p.mouse.move(mx, my); await p.waitForTimeout(200);
      return p.evaluate(() => BREACH.world.player.state);
    };
    const variants = {
      'cdp-0ms': async () => { await p.mouse.down(); await p.mouse.up(); },
      'sync-dispatch': () => p.evaluate(({ x, y }) => { const c = document.querySelector('canvas'), o = { clientX: x, clientY: y, button: 0, bubbles: true };
        c.dispatchEvent(new MouseEvent('mousedown', o)); c.dispatchEvent(new MouseEvent('mouseup', o)); }, { x: mx, y: my }),
      'cdp-8ms': async () => { await p.mouse.down(); await p.waitForTimeout(8); await p.mouse.up(); },
      'hold-500ms': async () => { await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); },
    };
    const out = { tag, N, cells: [] };
    for (const pose of (process.env.POSES || 'open,cover').split(',')) for (const weapon of ['rifle', 'shotgun', 'marksman']) {
      const state = await place(pose, weapon);
      for (const [v, fn] of Object.entries(variants)) {
        if (v === 'hold-500ms' && weapon !== 'rifle') continue;
        const counts = [];
        for (let i = 0; i < N; i++) {
          await p.evaluate(() => { __T.n = 0; }); await fn(); await p.waitForTimeout(weapon === 'rifle' ? 250 : 1100);
          counts.push(await p.evaluate(() => __T.n));
        }
        const diag = await p.evaluate(() => { const W = BREACH.world, pl = W.player, L = pl.loadout; return { st: pl.state, dead: pl.dead, paused: W.paused, lr: L.lastResult, w: L.slots[L.index].id, sw: L.switchT, rl: !!L.reload, lvl: W.level?.phase ?? W.level?.state ?? null, cut: !!W.cutscene, inMode: W.inputMode ?? null }; });
        const cell = { pose, state, diag, weapon, variant: v, counts, zero: counts.filter((c) => c === 0).length, mean: +(counts.reduce((a, b) => a + b) / N).toFixed(2), min: Math.min(...counts), max: Math.max(...counts) };
        out.cells.push(cell); console.log(JSON.stringify(cell));
      }
    }
    out.errs = errs; out.final = await p.evaluate(() => ({ st: BREACH.world.player.state, lvl: BREACH.world.level?.state ?? null })); fs.writeFileSync(path.join(__dirname, `tap-${tag}.json`), JSON.stringify(out, null, 1));
  } finally { await b.close(); srv.kill(); }
})();
