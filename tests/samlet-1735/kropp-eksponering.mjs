// Kroppssjekk bak cover + eksponering fra RMB-slipp (samlet 1735). node kropp-eksponering.mjs ROOT OUT PORT
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [ROOT, O, PORT] = process.argv.slice(2); fs.mkdirSync(O, { recursive: true });
const N = process.env.SIDE === 'N'; const sl = (ms) => new Promise(r => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await sl(800);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, args: ['--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: O, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage(); const R = { errs: [], cons: [], cover: [] }; const T0 = Date.now();
page.on('pageerror', e => R.errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') R.cons.push(m.text()); });
const ev = (f, a) => page.evaluate(f, a);
await page.goto(`http://127.0.0.1:${PORT}/index.html?yard=v2`); await page.waitForFunction(() => window.BREACH?.world?.player);
await page.mouse.click(640, 690); await sl(400);
for (let i = 0; i < 25; i++) { const t1 = await ev(() => window.BREACH.world.time || 0); await page.keyboard.press('Escape'); await sl(500); const t2 = await ev(() => window.BREACH.world.time || 0); if (t2 > t1 + 0.2 && !(await ev(() => window.BREACH.world.paused))) break; if (i % 6 === 5) await page.mouse.click(640, 690); }
await ev(() => { const w = window.BREACH.world; setInterval(() => { for (const e of w.enemies || []) { e.x = -5000; e.y = -5000; e.vx = e.vy = 0; } w.player.hp = 100; }, 30);
  window.__fl = []; let last = null; const tick = () => { const p = w.player; const x = !!p.exposed; if (x !== last) { window.__fl.push([performance.now(), x, p.posture]); last = x; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
const kinds = await ev(() => { const m = {}; for (const c of window.BREACH.world.cover) { const k = c.type + ':' + (c.kind || '?'); (m[k] = m[k] || []).push({ x: c.x, y: c.y, w: c.w, h: c.h }); } return m; });
const want = (process.env.WANT || 'low:sandbag,low:crates,high:wall,low:ledge,low:barrier').split(',');
const AY = await ev(() => 27 * (window.BREACH?.PROJ?.zScale ?? 0.75));
for (const k of want) {
  const list = (kinds[k] || []).filter(c => c.w >= 48 && c.w <= 200 && c.y > 120); if (!list.length) continue;
  for (const c of list.slice(0, 3)) {
    for (let z = 0; z < 3; z++) { if (!(await ev(() => window.BREACH.world.player.inCover))) break; await page.keyboard.press('KeyE'); await sl(450); }
    const cx = c.x + c.w / 2; await ev(([x, y]) => { const p = window.BREACH.world.player; p.x = x; p.y = y; p.vx = p.vy = 0; }, [cx, N ? c.y - 30 : c.y + c.h + 30]); await sl(250);
    await page.keyboard.down(N ? 'KeyS' : 'KeyW'); await sl(160); await page.keyboard.down('KeyE'); await sl(90); await page.keyboard.up('KeyE'); await sl(250); await page.keyboard.up(N ? 'KeyS' : 'KeyW'); await sl(700);
    const st = await ev(() => { const p = window.BREACH.world.player; return { inCover: p.inCover, posture: p.posture, x: p.x, y: p.y }; });
    if (!st.inCover || (N ? st.y > c.y + c.h : st.y < c.y)) continue;
    const aim = async () => { await page.mouse.move(ps.x, N ? ps.y + 200 : ps.y - 200, { steps: 4 }); };
    const ps = await ev(([x, y]) => (window.BREACH.camera || window.BREACH.world.camera).worldToScreen(x, y), [st.x, st.y]);
    const clip = { x: Math.max(0, Math.min(1280 - 360, ps.x - 180)), y: Math.max(0, Math.min(720 - 300, ps.y - 200)), width: 360, height: 300 };
    const nm = (N ? 'nord-' : '') + k.replace(/[^a-z]+/g, '-'); await aim(); await sl(200);
    await aim(); await sl(200);
    await page.screenshot({ path: `${O}/${nm}-1-dukket.png`, clip });
    const rel = [];
    for (let r = 0; r < 6; r++) {
      await page.mouse.down({ button: 'right' }); const tDown = (Date.now() - T0) / 1000; await sl(80);
      await sl(r === 0 ? 600 : 300 + r * 150); 
      const pre = await ev(() => ({ ex: window.BREACH.world.player.exposed, po: window.BREACH.world.player.posture }));
      const tRel = await ev(() => performance.now()); await page.mouse.up({ button: 'right' });
      const tUp = (Date.now() - T0) / 1000;
      await sl(700); if (r === 0) await page.screenshot({ path: `${O}/${nm}-5-nede.png`, clip });
      const fl = await ev(() => window.__fl.slice()); const off = fl.find(f => f[0] >= tRel - 20 && f[1] === false);
      rel.push({ tDown, tUp, clip, pre, ms: off ? +(off[0] - tRel).toFixed(1) : null }); await sl(300);
    }
    R.cover.push({ k, c, st, rel, videoSec: (Date.now() - T0) / 1000 }); break;
  }
}
const fl = await ev(() => window.__fl); let quick = 0; for (let i = 1; i < fl.length; i++) if (fl[i][0] - fl[i - 1][0] < 60) quick++;
R.flips = fl.length; R.quickFlips = quick; R.kinds = Object.keys(kinds);
await ctx.close(); await b.close(); srv.kill(); fs.writeFileSync(O + '/resultat.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify({ errs: R.errs, cons: R.cons, flips: R.flips, quick, cover: R.cover.map(c => ({ k: c.k, st: c.st.posture, rel: c.rel.map(r => `${r.pre.po}/${r.pre.ex}->${r.ms}`).join(' ') })) }, null, 1));
