const path = require('path'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => { const [url, out, wait = '5000'] = process.argv.slice(2);
  const ex = require('fs').readdirSync(process.env.HOME + '/.cache/ms-playwright').filter((d) => /chromium_headless/.test(d)).map((d) => process.env.HOME + '/.cache/ms-playwright/' + d + '/chrome-headless-shell-linux64/chrome-headless-shell')[0];
  const b = await chromium.launch({ executablePath: ex }); const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url); await p.waitForTimeout(+(process.env.WAIT0 || 4500)); await p.mouse.click(800, 450); await p.waitForTimeout(800); await p.keyboard.press('Escape'); await p.waitForTimeout(800); await p.mouse.click(800, 450); await p.waitForTimeout(+wait);
  for (let k = 0; k < 4; k++) { const t = await p.evaluate(() => document.body.innerText || ''); if (/PAUSED|ESC SKIP|ESC\s+SKIP/i.test(t)) { await p.keyboard.press('Escape'); await p.waitForTimeout(900); } else break; }
  if (process.env.JS) { console.log(await p.evaluate(process.env.JS)); await p.waitForTimeout(+(process.env.WAIT2 || 1500)); }
  await p.screenshot({ path: out }); console.log('errs', errs); await b.close(); })();
