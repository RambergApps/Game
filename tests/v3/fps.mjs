// Breach Test – FPS/hovedtråd for index.html?view=34 vs ?view=top og src/player/test-v3.html (headless, uten GPU).
import fs from 'node:fs';
import { launch, open, startIndex, sleep } from './lib.mjs';
const CASES = [
  ['index-34-z1.5', '/index.html?view=34', 1.5, true], ['index-top-z1.5', '/index.html?view=top', 1.5, true],
  ['index-34-z2', '/index.html?view=34', 2, true], ['index-top-z2', '/index.html?view=top', 2, true],
  ['test-v3-z2', '/src/player/test-v3.html', 2, false], ['test-v3-z1', '/src/player/test-v3.html', 1, false],
];
const out = [];
const browser = await launch();
for (const [name, url, zoom, isIndex] of CASES) {
  const errs = []; const page = await open(browser, url, errs);
  if (isIndex) await startIndex(page);
  await sleep(2500);
  const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  await page.evaluate((z) => { const B = window.BREACH; B.camera.zoom = z; B.world.player.invuln = true;
    const R = window.__f = { d: [] }; let last = performance.now(); const tick = (t) => { R.d.push(t - last); last = t; if (!R.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    // hold spilleren i live
    setInterval(() => { const p = B.world.player; if (p) { p.hp = p.maxHp; if (p.dead) p.dead = false; } }, 200);
    if (B.oblique?.STATS) window.__f.ob0 = { ms: B.oblique.STATS.ms, n: B.oblique.STATS.figures };
  }, zoom);
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const t0 = Date.now();
  // skriptet spill 10 s: bevegelse i firkant, sikt rundt, skyt i utbrudd
  const keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.down(keys[i % 4]);
    for (let j = 0; j < 4; j++) { const a = (i * 4 + j) * 0.7; await page.mouse.move(640 + Math.cos(a) * 250, 360 + Math.sin(a) * 180); if (j % 2 === 0) { await page.mouse.down(); await sleep(180); await page.mouse.up(); } else await sleep(180); }
    await page.keyboard.up(keys[i % 4]); await sleep(150);
  }
  const wall = (Date.now() - t0) / 1000;
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const r = await page.evaluate(() => { const B = window.BREACH, R = window.__f; R.stop = true; const d = R.d.slice(5).filter((x) => x < 1000).sort((a, b) => a - b);
    const q = (p) => d[Math.min(d.length - 1, Math.floor(p * d.length))]; const mean = d.reduce((s, x) => s + x, 0) / d.length;
    const ob = B.oblique?.STATS && R.ob0 ? { msPerFig: (B.oblique.STATS.ms - R.ob0.ms) / Math.max(1, B.oblique.STATS.figures - R.ob0.n) } : null;
    return { frames: d.length, fps: +(1000 / mean).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +d[d.length - 1].toFixed(1), over20: d.filter((x) => x > 20).length, over33: d.filter((x) => x > 33.4).length, loopFps: +B.loop.stats.fps.toFixed(1), enemies: B.world.enemies.filter((e) => !e.dead).length, projectiles: B.world.projectiles.length, view: B.world.view, ob }; });
  const busy = (m1.TaskDuration - m0.TaskDuration) / wall, script = (m1.ScriptDuration - m0.ScriptDuration) / wall;
  const row = { name, url, zoom, wallS: +wall.toFixed(1), ...r, mainThreadBusy: +(busy * 100).toFixed(0), scriptPct: +(script * 100).toFixed(0), msPerFrameMain: +((m1.TaskDuration - m0.TaskDuration) * 1000 / r.frames).toFixed(1), errors: errs };
  console.log(JSON.stringify(row)); out.push(row);
  await page.context().close();
}
await browser.close();
fs.writeFileSync('/workspace/breach/tests/results/v3-skravinkel-fps.json', JSON.stringify(out, null, 1));
console.log('FERDIG');
