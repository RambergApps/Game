// BREACH Våpen – synes LED-en? Tegner hvert våpen i 8 retninger (zoom 2) med LED i cyan og i magenta og teller
// pikslene som endrer seg rundt hver figur. Bruk: node leds.cjs  (krever http.server på 8799 i game/)
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:8799/src/weapons/look/test.html?manual=1'); await p.waitForFunction(() => window.LOOKTEST_READY);
  const out = await p.evaluate(async (Z) => {
    const T = window.LOOKTEST, res = {};
    const angs = [0, .785, 1.571, 2.356, 3.142, -2.356, -1.571, -.785];
    for (const id of ['rifle', 'shotgun', 'marksman']) {
      const base = T.LOOKS[id], shots = [];
      for (const led of [base.palette.led, '#ff00ff']) {
        const v = { ...base, version: base.version + (led === '#ff00ff' ? 900 : 0), palette: { ...base.palette, led } };
        T.LOOKS[id] = v; T.registerWeaponLook(v); T.clearAllCaches();   // scene('after') registrerer LOOKS.rifle på nytt
        const figs = angs.map((a, i) => ({ dx: 100 + (i % 4) * 60, dy: 30 + Math.floor(i / 4) * 70, a, weapon: id }));
        const r = T.scene({ zoom: Z, mode: 'after', figs, cam: { dx: 190, dy: 65 } });
        const c = document.querySelector('canvas'), g = c.getContext('2d');
        shots.push({ img: g.getImageData(0, 0, c.width, c.height).data, w: c.width, figs: r.map(f => f.screen) });
      }
      T.LOOKS[id] = base; T.registerWeaponLook(base); T.clearAllCaches();
      const [A, B] = shots, cnt = new Array(8).fill(0);
      for (let i = 0; i < 8; i++) { const s = A.figs[i]; if (!s) continue;
        for (let y = Math.max(0, (s.y | 0) - 90); y < (s.y | 0) + 40; y++) for (let x = Math.max(0, (s.x | 0) - 90); x < (s.x | 0) + 90; x++) {
          const k = (y * A.w + x) * 4; if (Math.abs(A.img[k] - B.img[k]) + Math.abs(A.img[k + 1] - B.img[k + 1]) + Math.abs(A.img[k + 2] - B.img[k + 2]) > 60) cnt[i]++; } }
      res[id] = cnt;
    }
    return res;
  }, +(process.env.Z || 2));
  console.log('LED-piksler per retning [Ø, SØ, S, SV, V, NV, N, NØ] ved zoom ' + (process.env.Z || 2) + ':'); for (const [k, v] of Object.entries(out)) console.log(k.padEnd(9), v.join(' '));
  await b.close();
})();
