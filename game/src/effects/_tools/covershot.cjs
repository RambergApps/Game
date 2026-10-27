const path = require('path'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => { const [url, out, sel = '#c'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: process.env.CHROME || require('fs').readdirSync(process.env.HOME + '/.cache/ms-playwright').filter((d) => /chromium_headless/.test(d)).map((d) => process.env.HOME + '/.cache/ms-playwright/' + d + '/chrome-headless-shell-linux64/chrome-headless-shell')[0] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url); await p.waitForTimeout(+(process.env.WAIT || 1500)); await p.screenshot({ path: out }); console.log('errs', errs, await p.evaluate(() => window.__done)); await b.close(); })();
