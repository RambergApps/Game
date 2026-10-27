// node bench.cjs [typical|heavy] [high|medium|low|'' (standard)] [port=8765] – kjører test.html?scenario=… i hodeløs Chromium og skriver resultatet
const path = require('path'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => { const [s = 'typical', q = '', port = '8765'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: (process.env.CHROME || [process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((x) => require('fs').existsSync(x))), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/src/effects/test.html?scenario=${s}${q ? '&q=' + q : ''}`, { waitUntil: 'commit', timeout: 0 }); await p.waitForFunction(() => window.__done, null, { timeout: 240000 });
  console.log(JSON.stringify(await p.evaluate(() => window.__result)), errs.length ? errs : ''); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }); await b.close(); })();
