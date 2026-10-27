const path = require('path'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => { const [url, out, secs] = process.argv.slice(2);
  const ex = require('fs').readdirSync(process.env.HOME + '/.cache/ms-playwright').filter((d) => /chromium_headless/.test(d)).map((d) => process.env.HOME + '/.cache/ms-playwright/' + d + '/chrome-headless-shell-linux64/chrome-headless-shell')[0];
  const b = await chromium.launch({ executablePath: ex, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctxb = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } }); const p = await ctxb.newPage();
  await p.goto(url); await p.waitForTimeout(4500); await p.mouse.click(640, 360); await p.waitForTimeout(800); await p.keyboard.press('Escape'); await p.waitForTimeout(800); await p.mouse.click(640, 360); await p.waitForTimeout(3000);
  for (let k = 0; k < 4; k++) { const t = await p.evaluate(() => document.body.innerText || ''); if (/PAUSED|ESC\s+SKIP/i.test(t)) { await p.keyboard.press('Escape'); await p.waitForTimeout(900); } else break; }
  await p.evaluate(process.env.JS || '1'); const t0 = Date.now(); await p.waitForTimeout(+secs * 1000 + 1000);
  console.log('life', JSON.stringify(await p.evaluate(() => { const s = BREACH.world._arenaState || {}; return s.life; })), 'start', (t0 - 0));
  await p.screenshot({ path: out + '/still.png' }); await ctxb.close(); await b.close(); })();
