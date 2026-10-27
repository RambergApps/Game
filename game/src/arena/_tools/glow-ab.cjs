// A/B av drawTop med og uten bakt glød (B 26.10), vekslende i samme side så belastningen rammer begge likt.
// Kjør: node src/arena/_tools/glow-ab.cjs [--n=300]  (http-server på :8765)
const { chromium } = require('playwright-core'); const os = require('os');
const N = +((process.argv.find((a) => a.startsWith('--n=')) || '').split('=')[1] || 300);
(async () => {
  const b = await chromium.launch({ executablePath: os.homedir() + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8765/index.html?skipmenu=1'); await p.waitForFunction(() => window.BREACH?.world?.arena); await p.waitForTimeout(2500);
  const l0 = os.loadavg()[0];
  const r = await p.evaluate(async (N) => {
    const { world: w, camera: c, loop } = window.BREACH; loop.stop?.(); w.depthSorted = true; w._depthDrawn = true;
    const A = w.modules.arena, cv = document.querySelector('canvas'), ctx = cv.getContext('2d');
    const T = { on: [], off: [] }, px = () => ctx.getImageData(0, 0, 1, 1);
    const run = (on) => { w.arenaGlowBake = on; ctx.save(); c.apply ? c.apply(ctx) : null; px(); const t = performance.now(); A.drawTop(ctx, w, c); px(); const d = performance.now() - t; ctx.restore(); return d; };
    for (let i = 0; i < 20; i++) { run(true); run(false); }
    for (let i = 0; i < N; i++) { if (i & 1) { T.off.push(run(false)); T.on.push(run(true)); } else { T.on.push(run(true)); T.off.push(run(false)); } }
    const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length * f)].toFixed(2); };
    // pikseldiff: tegn en hel ramme med og uten
    const shot = (on) => { w.arenaGlowBake = on; loop.render ? loop.render() : null; return ctx.getImageData(0, 0, cv.width, cv.height).data; };
    const a = shot(false); window.__A = cv.toDataURL('image/png'); const bb = shot(true); window.__B = cv.toDataURL('image/png'); let sum = 0, mx = 0, n99 = 0;
    for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - bb[i]), Math.abs(a[i + 1] - bb[i + 1]), Math.abs(a[i + 2] - bb[i + 2])); sum += d; if (d > mx) mx = d; if (d > 8) n99++; }
    return { on: { med: q(T.on, 0.5), p95: q(T.on, 0.95) }, off: { med: q(T.off, 0.5), p95: q(T.off, 0.95) }, diff: { meanPerPx: +(sum / (a.length / 4)).toFixed(3), max: mx, pctOver8: +(100 * n99 / (a.length / 4)).toFixed(2) } };
  }, N);
  if (process.env.SAVE) for (const k of ['A', 'B']) require('fs').writeFileSync(`/workspace/breach/shots/arena-glowbake-${k === 'A' ? 'off' : 'on'}.png`, Buffer.from((await p.evaluate((k) => window['__' + k], k)).split(',')[1], 'base64'));
  console.log(JSON.stringify({ ...r, load: [+l0.toFixed(1), +os.loadavg()[0].toFixed(1)], errs }));
  await b.close();
})();
