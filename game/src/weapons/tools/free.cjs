// Skjermbilder av look/free-test.html → shots/C/. Bruk: (cd game && python3 -m http.server 8765) & node free.cjs
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const PORT = process.env.PORT || 8765, OUT = __dirname + '/../shots/C/';
(async () => {
  const b = await chromium.launch({ executablePath: require('fs').readdirSync(process.env.HOME + '/.cache/ms-playwright').filter(d => d.startsWith('chromium')).map(d => { const b = process.env.HOME + '/.cache/ms-playwright/' + d; return [b + '/chrome-linux64/chrome', b + '/chrome-headless-shell-linux64/chrome-headless-shell'].find(f => require('fs').existsSync(f)); }).find(Boolean) });
  const res = {};
  for (const [z, w, h, dots] of [[1, 1060, 300, 1], [2, 2080, 560, 1], [1, 1060, 300, 0], [2, 2080, 560, 0]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`http://localhost:${PORT}/src/weapons/look/free-test.html?zoom=${z}&dots=${dots}`); await p.waitForFunction(() => window.BREACH && window.BREACH.ready, null, { timeout: 15000 });
    await p.screenshot({ path: OUT + `free-${z}x${dots ? '' : '-clean'}.png` });
    res[z + (dots ? '' : 'c')] = { errs, perf: await p.evaluate(() => window.BREACH.perf), gap: await p.evaluate(() => window.BREACH.maxGap) };
    await p.close();
  }
  // nærbilde: øst-kolonnen (0) og vest (8) for alle tre, 2× forstørret ×3
  const { execSync } = require('child_process');
  execSync(`python3 -c "from PIL import Image as I; im=I.open('${OUT}free-2x-clean.png'); W=im.width; a=im.crop((10,70,300,520)).resize((870,1350),I.LANCZOS); b=im.crop((10+8*128,70,10+8*128+290,520)).resize((870,1350),I.LANCZOS); c=I.new('RGB',(1740,1350)); c.paste(a,(0,0)); c.paste(b,(870,0)); c.save('${OUT}free-closeup-E-W.png')"`);
  console.log(JSON.stringify(res)); await b.close();
})();
