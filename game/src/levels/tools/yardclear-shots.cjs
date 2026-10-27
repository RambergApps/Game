// Verifiserer malte yard-clear-paneler: HTTP-status + skjermbilder gjennom cam-banen. → /tmp/shots/yc-*.png
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const EXE = '/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const PORT = process.argv[2] || 8793;
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], net = {};
  page.on('console', (m) => { if (['error', 'warning', 'info'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  page.on('response', (r) => { if (r.url().includes('/img/story/')) net[r.url().split('/').pop()] = r.status(); });
  await page.goto(`http://localhost:${PORT}/index.html`); await page.waitForFunction(() => window.BREACH);
  await page.evaluate(() => {
    document.getElementById('start-screen')?.remove();
    const W = window.BREACH.world; window.__lines = [];
    W.events.on('cutsceneLine', (e) => window.__lines.push(e)); W.events.on('cutsceneEnd', (e) => (window.__end = e));
    W.modules.story.showCutscene('yard-clear', { world: W }).then((r) => (window.__done = r));
  });
  const shot = (n) => page.screenshot({ path: `/tmp/shots/yc-${n}.png` });
  const curPanel = () => page.evaluate(() => window.__lines.at(-1)?.panel);
  const durs = [9, 7, 8];
  for (let p = 0; p < 3; p++) {
    const t0 = Date.now(); const at = (s) => page.waitForTimeout(Math.max(0, s * 1000 - (Date.now() - t0)));
    await at(0.5); await shot(`${p + 1}a-start`);          // tidlig i banen, bilde før tekst
    await at(2.8); await shot(`${p + 1}b-line1`);
    await page.keyboard.press('Enter');                       // linje 2
    await at(durs[p] * 0.6); await shot(`${p + 1}c-mid`);
    await at(durs[p] + 0.4); await shot(`${p + 1}d-end`);    // slutten av cam-banen
    await page.keyboard.press('Enter');                       // fullfør tekst om nødvendig
    await page.waitForTimeout(150);
    if ((await curPanel()) === p) await page.keyboard.press('Enter');
    await page.waitForTimeout(p < 2 ? 900 : 1200);
  }
  const r = await page.evaluate(() => ({ lines: window.__lines.map((l) => `${l.panel}:${l.speaker}`), done: window.__done || null, end: window.__end || null,
    imgs: [...performance.getEntriesByType('resource')].filter((e) => e.name.includes('/img/story/')).map((e) => [e.name.split('/').pop(), e.transferSize]) }));
  console.log(JSON.stringify({ net, ...r, errs }, null, 1));
  await b.close();
})();
