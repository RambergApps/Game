// BREACH Våpen – før/etter: Warden med våpnene ved en container (look/test.html). Bruk: node looks.cjs [tag]
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/workspace/breach/game/src/weapons/shots/looks/'; fs.mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'v1', PORT = process.env.PORT || 8799;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${PORT}/src/weapons/look/test.html?manual=1`); await p.waitForFunction(() => window.LOOKTEST_READY, null, { timeout: 15000 });
  const sets = {
    // tre Wardens sør for containeren, sikter øst (sidebilde: lengde og silhuett)
    east: [{ dx: 100, dy: 30, a: 0, weapon: 'rifle' }, { dx: 100, dy: 80, a: 0, weapon: 'shotgun' }, { dx: 100, dy: 130, a: 0, weapon: 'marksman' }],
    // skrått mot kamera / bort / vest (andre vinkelbøtter)
    mixed: [{ dx: -48, dy: 256, a: 0.7, weapon: 'rifle' }, { dx: 12, dy: 256, a: -2.3, weapon: 'shotgun' }, { dx: 72, dy: 256, a: Math.PI, weapon: 'marksman' }],   // sør for containeren 512,704 – ingen ammokasse i rammen
    // nærbilde (bare til egen kontroll): sikter øst, sørvest og nord
    close: [{ dx: 100, dy: 30, a: 0, weapon: 'shotgun' }, { dx: 100, dy: 80, a: 2.4, weapon: 'shotgun' }, { dx: 100, dy: 130, a: -1.57, weapon: 'shotgun' }],
  };
  const res = {};
  for (const [sname, figs] of Object.entries(sets)) for (const zoom of [1, 2]) for (const mode of ['before', 'after']) {
    const cam = sname === 'mixed' ? { dx: 12, dy: 246 } : { dx: 115, dy: 70 };
    const r = await p.evaluate((o) => window.LOOKTEST.scene(o), { zoom, mode, figs, cam });
    const name = `${tag}-${sname}-${zoom}x-${mode}`; res[name] = r;
    const w = zoom === 1 ? 320 : 640, h = zoom === 1 ? 220 : 440;
    await p.screenshot({ path: `${OUT}${name}.png`, clip: { x: 640 - w / 2, y: 360 - h / 2, width: w, height: h } });
  }
  fs.writeFileSync(`${OUT}${tag}-measure.json`, JSON.stringify({ res, errs }, null, 1));
  console.log(JSON.stringify(res.ignored || Object.fromEntries(Object.entries(res).filter(([k]) => k.includes('east-2x')).map(([k, v]) => [k, v.map(x => ({ w: x.weapon, look: x.look, len: x.len, m: x.muzzle, sock: x.rigSocket }))])), null, 0));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
