// node perf.cjs [typical|heavy] [high|medium|low] [sync 0|1]   – krever http.server på :8765 fra game/
const path = require('path'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => { const [s = 'typical', q = 'high', sync = '0'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: (process.env.CHROME || [process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((x) => require('fs').existsSync(x))), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:8765/src/effects/_tools/perf.html?s=${s}&q=${q}&sync=${sync}`, { waitUntil: 'commit', timeout: 0 }); await p.waitForFunction(() => window.__done, null, { timeout: 240000 });
  console.log(JSON.stringify(await p.evaluate(() => window.__result)), errs.length ? errs : ''); await b.close(); })();
