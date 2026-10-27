// node fshot.cjs <scenario> <q> <port> <outPrefix> <frame,frame,...> – lagrer test.html-bilder på faste bildenummer (deterministisk scenario)
const path = require('path'), fs = require('fs'); const { chromium } = require(path.resolve(__dirname, '../../../../node_modules/playwright-core'));
(async () => { const [s, q, port, out, fr] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: (process.env.CHROME || [process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find((x) => require('fs').existsSync(x))), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto(`http://localhost:${port}/src/effects/test.html?scenario=${s}&q=${q}&shot=${fr}${process.env.EXTRA || ''}`, { waitUntil: 'commit', timeout: 0 }); await p.waitForFunction(() => window.__done, null, { timeout: 240000 });
  const shots = await p.evaluate(() => window.__shots || {}); for (const [f, d] of Object.entries(shots)) { fs.writeFileSync(`${out}-${f}.png`, Buffer.from(d.split(',')[1], 'base64')); console.log(`${out}-${f}.png`); }
  console.log(JSON.stringify(await p.evaluate(() => window.__result))); await b.close(); })();
