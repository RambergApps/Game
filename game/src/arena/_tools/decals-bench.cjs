// Måling: vedvarende ild mot dekning (dekaler), view 34, 1600×1000, 10 s.
// Kjør: node src/arena/_tools/decals-bench.cjs [--rate=20] [--secs=10] [--view=34]  (http-server på :8765, rot game/)
// Rapporterer ms per ramme brukt på dekaler: addCoverDecal + direkte tegning + bake (world._arenaState.decalMs), og
// i tillegg drawCoverObject-tiden for objekter med fersk dekal (gammel kode reskalerte spriten der).
const { chromium } = require('playwright-core');
const os = require('os');
const arg = (k, d) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1] || d;
const RATE = +arg('rate', 20), SECS = +arg('secs', 10), VIEW = arg('view', '34');
(async () => {
  const exe = require('fs').readdirSync(os.homedir() + '/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell')).sort().pop();
  const b = await chromium.launch({ executablePath: `${os.homedir()}/.cache/ms-playwright/${exe}/chrome-headless-shell-linux64/chrome-headless-shell` });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://localhost:8765/index.html?view=${VIEW}&skipmenu=1`); await p.waitForFunction(() => window.BREACH?.world?.arena);
  await p.waitForTimeout(2500);
  const load0 = os.loadavg()[0];
  const r = await p.evaluate(async ({ RATE, SECS }) => {
    const { world: w, camera: c } = window.BREACH, A = w.modules.arena;
    await import('/src/effects/decals.js'); await new Promise((res) => setTimeout(res, 300));
    for (const e of w.enemies) e.dead = true; w.enemies.length = 0; w.player.invuln = 999;
    w.player.x = 560; w.player.y = 520; c.x = 560; c.y = 480; c.zoom = 1.6; c.lerp = 0;
    await new Promise((res) => setTimeout(res, 800));
    const objs = w.cover.filter((o) => o.w >= 20); let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const kinds = ['bullet_metal', 'bullet_concrete', 'bullet_metal', 'ichor', 'slash', 'scorch'];
    const frames = [], adds = []; let acc = 0, next = performance.now(), n = 0, firsts = 0; const seen = new Set();
    if (w._arenaState) w._arenaState.decalMs = 0;
    const t0 = performance.now();
    return await new Promise((done) => {
      const tick = () => {
        const now = performance.now();
        let ms = 0;
        while (now >= next) { next += 1000 / RATE; const o = objs[Math.floor(R() * objs.length)]; if (!seen.has(o.id)) { seen.add(o.id); firsts++; }
          const hp = A.coverHitPoint(w, o, o.x + 3 + R() * (o.w - 6), o.y + o.h + 1, 4 + R() * 30); const k = kinds[n++ % kinds.length];
          const a = performance.now(); A.addCoverDecal(w, hp.coverId, { x: hp.x, z: hp.z, kind: k, r: k === 'scorch' ? 16 : k === 'ichor' ? 8 : k === 'slash' ? 10 : 3, angle: R() * 6, seed: n }); const d = performance.now() - a; ms += d; adds.push(d); }
        const s = w._arenaState; ms = s?.decalLast || 0; if (s) s.decalLast = 0; // forrige bilde (rAF før render): inkluderer add, direkte tegning og bake
        frames.push(ms);
        if (now - t0 < SECS * 1000) requestAnimationFrame(tick); else {
          const q = (arr, f) => { const a = [...arr].sort((x, y) => x - y); return +a[Math.min(a.length - 1, Math.floor(a.length * f))].toFixed(2); };
          done({ frames: frames.length, decals: n, firsts, median: q(frames, 0.5), p95: q(frames, 0.95), max: +Math.max(...frames).toFixed(2), over2: frames.filter((x) => x > 2).length,
            addMedian: q(adds, 0.5), addMax: +Math.max(...adds).toFixed(2), stats: A.decalStats(w), slow: (w._arenaState.decalSlow || []).slice(0, 12), slowFrames: frames.map((x, i) => [i, +x.toFixed(1)]).filter((f) => f[1] > 2) });
        }
      };
      requestAnimationFrame(tick);
    });
  }, { RATE, SECS });
  console.log(JSON.stringify({ view: VIEW, rate: RATE, secs: SECS, load: [+load0.toFixed(1), +os.loadavg()[0].toFixed(1)], ...r, errs }));
  await b.close();
})();
