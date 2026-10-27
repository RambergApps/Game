// node game/src/effects/_tools/shot.cjs [page] [out.png] [width] [height]
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => {
  const page = process.argv[2] || 'designark.html', out = process.argv[3] || '/workspace/breach/reviews/img/effekter-designark.png';
  const w = +(process.argv[4] || 2400), h = +(process.argv[5] || 1800);
  const b = await chromium.launch({ executablePath: (process.env.CHROME || [process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((x) => require('fs').existsSync(x))), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  const t0 = Date.now(); await p.goto('http://localhost:8765/src/effects/' + page);
  await p.waitForFunction(() => window.__done === true, null, { timeout: 120000 }).catch((e) => errs.push('timeout'));
  const el = await p.$('canvas'); await el.screenshot({ path: out });
  console.log('saved', out, (Date.now() - t0) + ' ms', 'errors:', JSON.stringify(errs));
  await b.close();
})();
