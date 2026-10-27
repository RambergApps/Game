// Breach Test – ren tegnekostnad per bilde (loop.render() ×N med tvungen flush via getImageData), samme scene i 34 og top.
import fs from 'node:fs';
import { launch, open, startIndex, sleep, OUT } from './lib.mjs';
const CASES = [['index-34', '/index.html?view=34', true], ['index-top', '/index.html?view=top', true], ['test-v3', '/src/player/test-v3.html', false]];
const out = []; const b = await launch();
for (const [name, url, isIdx] of CASES) {
  const errs = []; let page; try { page = await open(b, url, errs); } catch (e) { console.log('retry', name); page = await open(b, url, errs); } if (isIdx) await startIndex(page); await sleep(2000);
  for (const zoom of [1, 1.5, 2, 3]) {
    const r = await page.evaluate(async (zoom) => {
      const B = window.BREACH, w = B.world, L = B.loop, PM = w.modules.player, EM = w.modules.enemies; L.stop();
      w.enemies.length = 0; PM.respawn(w, 600, 655);
      for (const [t, x, y] of [['grunt', 520, 420], ['grunt', 700, 400], ['grenadier', 640, 300], ['heavy', 800, 640], ['flanker', 450, 600], ['grunt', 560, 690]]) EM.createEnemy(w, t, x, y);
      B.camera.zoom = zoom; B.camera.x = 600; B.camera.y = 600; for (let i = 0; i < 10; i++) L.step(1 / 60);
      B.camera.zoom = zoom; B.camera.x = 600; B.camera.y = 600;
      const ctx = document.getElementById('game').getContext('2d');
      for (let i = 0; i < 10; i++) { L.render(); ctx.getImageData(0, 0, 1, 1); }
      const t0 = performance.now(); const N = 60; for (let i = 0; i < N; i++) { L.render(); ctx.getImageData(0, 0, 1, 1); }
      const ms = (performance.now() - t0) / N;
      // simuleringssteg alene
      const t1 = performance.now(); for (let i = 0; i < 60; i++) L.step(1 / 60); const stepMs = (performance.now() - t1) / 60;
      return { ms: +ms.toFixed(2), stepMs: +stepMs.toFixed(2), enemies: w.enemies.length };
    }, zoom);
    out.push({ name, zoom, ...r, errors: errs.length }); console.log(name, zoom, JSON.stringify(r));
    await page.reload(); await page.waitForFunction(() => window.BREACH && window.BREACH.world); if (isIdx) await startIndex(page); await sleep(1500);
  }
  await page.context().close();
}
// spawn-pute-sjekk (kjent feil): Warden gående sør på puten i 34, zoom 3
{
  const errs = []; const page = await open(b, '/index.html?view=34', errs); await startIndex(page); await sleep(1500);
  for (const [i, [x, y]] of [[128, 848], [128, 895], [180, 905], [90, 880], [250, 860]].entries()) {
    await page.evaluate(([x, y]) => { const B = window.BREACH, w = B.world; B.loop.stop(); w.modules.player.respawn(w, x, y); for (let k = 0; k < 8; k++) B.loop.step(1 / 60); B.camera.zoom = 3; B.camera.x = x; B.camera.y = y - 10; B.camera.shakeX = B.camera.shakeY = 0; B.loop.render(); }, [x, y]);
    await page.screenshot({ path: `${OUT}/raw/34-s13-spawnpad-${i}-z3.png` });
  }
  await page.context().close();
}
await b.close();
fs.writeFileSync('/workspace/breach/tests/results/v3-skravinkel-render.json', JSON.stringify(out, null, 1)); console.log('FERDIG');
