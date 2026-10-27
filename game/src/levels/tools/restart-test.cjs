// Tester levels.restartWave (pausemenyens RESTART WAVE). Bruk: node game/src/levels/tools/restart-test.cjs [port]
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const EXE = '/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const PORT = process.argv[2] || 8793;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://localhost:${PORT}/index.html`); await page.waitForFunction(() => window.BREACH);
  const r = await page.evaluate(async () => {
    const W = window.BREACH.world, L = W.modules.levels, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ev = []; for (const k of ['restart', 'waveStart', 'cutsceneStart', 'spawnWarn', 'spawnRise']) W.events.on(k, (p) => ev.push([k, JSON.stringify(p?.cause ? p : (p?.id ?? ''))]));
    document.getElementById('start-screen')?.remove(); W.paused = false;
    const out = { hasModuleFn: typeof W.modules.levels.restartWave === 'function' };
    L.startLevel(W, 1, { startAt: '1-4', skipCutscenes: true, upgrades: { plating: 2 } });
    out.duringLevelStartBreak = L.restartWave(W);
    const until = async (f, ms = 15000) => { const t0 = performance.now(); while (!f()) { if (performance.now() - t0 > ms) return false; await sleep(50); } return true; };
    await until(() => L._debug(W).phase === 'wave');
    await until(() => W.enemies.length >= 3);
    await sleep(600);
    const d = L._debug(W);
    W.player.hp = 23; W.player.x += 200;
    const wpn = W.modules.weapons; const lo = wpn?.getLoadout?.(W) || W.player.loadout;
    const ammo = () => (W.player.loadout?.slots || []).map((x) => `${x.id}:${x.mag}/${x.reserve}`).join(' ') + ` g${W.player.loadout?.grenades ?? '?'}`;
    for (const sl of W.player.loadout?.slots || []) { sl.mag = 0; if (sl.reserve !== Infinity) sl.reserve = 0; }
    const before = { ammo: ammo(), enemies: W.enemies.length, pend: (d.pend || []).length, queue: d.queue.length, hp: W.player.hp, maxHp: W.player.maxHp, stacks: L.getUpgradeState(W), wave: W.level.waveId };
    W.paused = true;                         // som når pausemenyen er åpen
    out.restartOk = L.restartWave(W);
    W.paused = false;
    await sleep(50); const after = { ammo: ammo(), enemies: W.enemies.length, pend: (d.pend || []).length, queue: d.queue.length, hp: W.player.hp, maxHp: W.player.maxHp, stacks: L.getUpgradeState(W), phase: d.phase, wave: W.level.waveId, banner: d.banner?.title, pos: [Math.round(W.player.x), Math.round(W.player.y)], spawn: W.arena?.playerSpawn && [Math.round(W.arena.playerSpawn.x), Math.round(W.arena.playerSpawn.y)], fallenCanvas: !!document.querySelector('canvas.breach-cutscene') };
    out.before = before; out.after = after;
    await sleep(400); out.lateSpawnsAfterRestart = W.enemies.length;
    await until(() => d.phase === 'wave'); out.reWaveStarted = d.phase === 'wave'; out.queueAfterRestartWave = d.queue.length;
    // kortvalg → false
    L._debugWave(W, 1, 0.1); await until(() => d.phase === 'wave');
    d.queue = []; for (const e of W.enemies) e.dead = true;
    await until(() => d.phase === 'upgrade', 5000);
    out.duringUpgrade = { phase: d.phase, ret: L.restartWave(W) };
    d.cards?.cleanup?.(); d.cards = null;
    // mellomsekvens → false
    L.startLevel(W, 1, {});
    await sleep(300); out.duringCutscene = { phase: d.phase, ret: L.restartWave(W) };
    out.events = ev.filter((e) => e[0] === 'restart' || e[0] === 'cutsceneStart');
    return out;
  });
  await page.screenshot({ path: '/tmp/shots/restart-test.png' });
  console.log(JSON.stringify({ ...r, errs }, null, 1));
  await b.close();
})();
