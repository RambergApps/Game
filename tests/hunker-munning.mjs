// Hunker munning: spawn-side, skjermbilder under skudd (headless).
import { chromium } from 'playwright-core'; import { spawn } from 'child_process'; import fs from 'fs';
const OUT = '/workspace/breach/shots/test/qa/yard-v2/hunker'; fs.mkdirSync(OUT, { recursive: true });
const port = 8799; const srv = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1'], { cwd: '/workspace/breach/game', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(`http://127.0.0.1:${port}/src/enemies/test.html?spawn=hunker`); await p.waitForTimeout(3000);
for (let i = 0; i < 8; i++) { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/hunker-${i}.png` }); }
console.log('feil', errs.length, errs.slice(0, 2).join(' | ')); await b.close(); srv.kill();
