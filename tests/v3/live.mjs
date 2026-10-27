// Breach Test – sanntidskamp i index.html?view=34 og ?view=top: bilder når fiendekuler/granater er i lufta.
import fs from 'node:fs';
import { launch, open, startIndex, sleep, OUT } from './lib.mjs';
const res = {}; const b = await launch();
for (const view of ['34', 'top']) {
  const errs = []; const page = await open(b, `/index.html?view=${view}`, errs); await startIndex(page); await sleep(1000);
  await page.evaluate(() => { const B = window.BREACH, w = B.world; setInterval(() => { const p = w.player; if (p) { p.hp = p.maxHp; } }, 100);
    window.__live = () => { const p = w.player, cam = B.camera; const al = w.enemies.filter((e) => !e.dead).sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y));
      const t = al[0]; const s = t ? cam.worldToScreen(t.x, t.y) : null;
      return { n: al.length, eb: w.projectiles.filter((q) => q.team === 'enemy').length, pb: w.projectiles.filter((q) => q.team === 'player').length, gr: (w._grenades || []).filter((g) => !g.dead).length, grEnemy: (w._grenades || []).filter((g) => !g.dead && g.team === 'enemy').length, sx: s?.x, sy: s?.y, d: t ? Math.hypot(t.x - p.x, t.y - p.y) : 0, cards: !!document.querySelector('[class*=card]') || !!w.level?.cards, paused: w.paused, wave: w.level?.wave, px: p.x, py: p.y }; }; });
  const R = res[view] = { shots: [], maxEb: 0, grenadeShots: 0 };
  let nb = 0, ng = 0; const t0 = Date.now(); let k = 0;
  // flytt Warden opp i gården (mot midten) først
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await sleep(1400); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
  while (Date.now() - t0 < 70000 && (nb < 3 || ng < 2)) {
    const s = await page.evaluate(() => window.__live()); k++;
    if (s.paused) { await page.keyboard.press('Digit1'); await sleep(400); continue; }
    if (s.sx != null) await page.mouse.move(s.sx, s.sy);
    R.maxEb = Math.max(R.maxEb, s.eb);
    if (s.eb >= 2 && nb < 3) { nb++; await page.screenshot({ path: `${OUT}/raw/${view}-live-bullets-${nb}.png` }); R.shots.push({ f: `${view}-live-bullets-${nb}`, ...s }); }
    if (s.grEnemy >= 1 && ng < 2) { ng++; await page.screenshot({ path: `${OUT}/raw/${view}-live-grenade-${ng}.png` }); R.shots.push({ f: `${view}-live-grenade-${ng}`, ...s }); R.grenadeShots++; }
    if (k % 6 === 0) { await page.mouse.down(); await sleep(120); await page.mouse.up(); }
    if (s.d > 360 && k % 4 === 0) { const keys = s.sx > 640 ? ['KeyD'] : ['KeyA']; if (s.sy < 360) keys.push('KeyW'); else keys.push('KeyS'); for (const kk of keys) await page.keyboard.down(kk); await sleep(250); for (const kk of keys) await page.keyboard.up(kk); }
    await sleep(60);
  }
  R.errors = errs; console.log(view, JSON.stringify({ maxEb: R.maxEb, shots: R.shots.map((x) => x.f), errs }));
  await page.context().close();
}
await b.close(); fs.writeFileSync('/workspace/breach/tests/results/v3-skravinkel-live.json', JSON.stringify(res, null, 1)); console.log('FERDIG');
