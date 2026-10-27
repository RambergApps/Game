// node warmup-chunked.mjs [port=8765] – piksel-sammenligning synkron warmup vs warmupChunked + frametider
import { createRequire } from 'module'; import fs from 'fs'; const require = createRequire(import.meta.url);
const { chromium } = require(new URL('../../../../node_modules/playwright-core', import.meta.url).pathname);
const port = process.argv[2] || '8765', H = process.env.HOME + '/.cache/ms-playwright';
const ex = fs.readdirSync(H).filter((d) => /chromium_headless/.test(d)).map((d) => H + '/' + d + '/chrome-headless-shell-linux64/chrome-headless-shell')[0];
const b = await chromium.launch({ executablePath: ex }); const p = await b.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(`http://localhost:${port}/src/effects/_tools/warmup-chunked.html`); await p.waitForFunction(() => window.__done, null, { timeout: 60000 }).catch(async () => console.log("TIMEOUT", errs, await p.evaluate(() => window.__dbg)));
console.log(JSON.stringify(await p.evaluate(() => window.__result), null, 1), 'errs', errs); await b.close();
