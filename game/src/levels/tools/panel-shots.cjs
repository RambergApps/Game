// Verifiserer malte paneler for gitte sekvenser via story/test.html: HTTP-status + skjermbilder gjennom cam-banen.
// Bruk: node panel-shots.cjs <prefix> <sekvens-id> [sekvens-id …]   → /tmp/shots/<prefix>-<panel>-<a..d>.png
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const EXE = '/home/box/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const [PREFIX, ...IDS] = process.argv.slice(2); const PORT = process.env.PORT || 8793;
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], net = {};
  page.on('console', (m) => { if (['error', 'warning', 'info'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  page.on('response', (r) => { if (r.url().includes('/img/story/')) net[r.url().split('/').pop()] = r.status(); });
  await page.goto(`http://localhost:${PORT}/src/story/test.html`); await page.waitForFunction(() => window.__story);
  const res = {};
  for (const id of IDS) {
    const info = await page.evaluate(async (id) => {
      const { CUTSCENES, PAINTED_PANELS } = await import('/src/story/cutscenes.js');
      window.__lines = []; window.__done = null; await (window.__prev || Promise.resolve());
      const { storyEvents } = await import('/src/story/index.js');
      if (!window.__hooked) { window.__hooked = 1; storyEvents.on?.('cutsceneLine', (e) => window.__lines.push(e)); }
      window.__prev = window.__story.showCutscene(id, {}).then((r) => (window.__done = r));
      return CUTSCENES[id].panels.map((p) => ({ id: p.id, dur: p.cam?.dur || 8, lines: p.lines.length, painted: PAINTED_PANELS.has(p.id) }));
    }, id);
    const lastLine = () => page.evaluate(() => { const l = window.__lines.at(-1); return l ? [l.panel, window.__lines.filter((x) => x.panel === l.panel).length] : [-1, 0]; });
    const waitPanel = async (pi) => { for (let k = 0; k < 80; k++) { const [p] = await lastLine(); if (p === pi) return true; await page.waitForTimeout(100); } return false; };
    for (let pi = 0; pi < info.length; pi++) {
      const P = info[pi];
      await waitPanel(pi);
      const t0 = Date.now(), at = (s) => page.waitForTimeout(Math.max(0, s * 1000 - (Date.now() - t0)));
      const shot = async (n) => { const [p, k] = await lastLine(); const name = `${PREFIX}-${info[p]?.id || 'done'}-${n}${p !== pi ? '-x' : ''}.png`; (global.__shotLog ||= []).push([P.id, n, info[p]?.id, k]); await page.screenshot({ path: `/tmp/shots/${name}` }); };
      await at(0.5); await shot('a-start');
      await at(2.6); await shot('b-line1');
      if (P.lines.length > 1) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); const [, n] = await lastLine(); if (n < 2) { await page.keyboard.press('Enter'); } }
      await at(Math.max(3.4, P.dur * 0.6)); await shot('c-mid');
      await at(Math.max(4.6, P.dur + 0.4)); await shot('d-end');
      if (!(await page.evaluate(() => !!window.__done))) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); const [p] = await lastLine(); if (p === pi && pi < info.length - 1) { await page.waitForTimeout(500); if ((await lastLine())[0] === pi) await page.keyboard.press('Enter'); } }
    }
    await page.waitForFunction(() => window.__done, null, { timeout: 8000 }).catch(() => {});
    res[id] = { panels: info, done: await page.evaluate(() => window.__done), lines: await page.evaluate(() => window.__lines.map((l) => `${l.panel}:${l.speaker}`)) };
  }
  console.log(JSON.stringify({ net, res, shots: global.__shotLog, errs }, null, 1));
  await b.close();
})();
