// Oppfølging: kropp bak mur/ledge/barrier via teleport. Stillbilder via canvas.toDataURL (rører ikke input). node mur.mjs ROOT OUT PORT
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [ROOT, O, PORT] = process.argv.slice(2); fs.mkdirSync(O, { recursive: true }); const sl = (ms) => new Promise(r => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await sl(800);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, args: ['--disable-backgrounding-occluded-windows'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: O, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage(); const R = { errs: [], cons: [], res: [] }; const T0 = Date.now();
page.on('pageerror', e => R.errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') R.cons.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) R.cons.push(r.status() + ' ' + r.url()); });
const ev = (f, a) => page.evaluate(f, a);
const snap = async (name) => { const d = await ev(() => document.querySelector('canvas').toDataURL('image/png')); fs.writeFileSync(`${O}/${name}.png`, Buffer.from(d.split(',')[1], 'base64')); };
await page.goto(`http://127.0.0.1:${PORT}/index.html?yard=v2`); await page.waitForFunction(() => window.BREACH?.world?.player);
await page.mouse.click(640, 690); await sl(400);
for (let i = 0; i < 25; i++) { const t1 = await ev(() => window.BREACH.world.time || 0); await page.keyboard.press('Escape'); await sl(500); const t2 = await ev(() => window.BREACH.world.time || 0); if (t2 > t1 + 0.2 && !(await ev(() => window.BREACH.world.paused))) break; if (i % 6 === 5) await page.mouse.click(640, 690); }
await ev(() => { const w = window.BREACH.world; setInterval(() => { for (const e of w.enemies || []) { e.x = -5000; e.y = -5000; e.vx = e.vy = 0; } w.player.hp = 100; }, 30); });
const kinds = await ev(() => { const m = {}; for (const c of window.BREACH.world.cover) { const k = c.type + ':' + (c.kind || '?'); (m[k] = m[k] || []).push({ x: c.x, y: c.y, w: c.w, h: c.h }); } return m; });
R.kinds = Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.length]));
const want = (process.env.WANT||'high:wall').split(',');
for (const k of want) for (const SD of ['N','S','W','E']) { const N = SD==='N';
  const list = kinds[k].filter(c => c.y > 60).sort((a, b) => a.w - b.w);
  let ok = false;
  for (const c of list.slice(0, 8)) {
    for (let z = 0; z < 3; z++) { if (!(await ev(() => window.BREACH.world.player.inCover))) break; await page.keyboard.press('KeyE'); await sl(450); }
    const cx = c.x + c.w / 2; await ev(([x, y]) => { const p = window.BREACH.world.player; p.x = x; p.y = y; p.vx = p.vy = 0; }, SD==='W'?[c.x-30,c.y+c.h/2]:SD==='E'?[c.x+c.w+30,c.y+c.h/2]:[cx, N ? c.y - 30 : c.y + c.h + 30]); await sl(300);
    await page.keyboard.down(({N:'KeyS',S:'KeyW',W:'KeyD',E:'KeyA'})[SD]); await sl(160); await page.keyboard.down('KeyE'); await sl(90); await page.keyboard.up('KeyE'); await sl(250); await page.keyboard.up(({N:'KeyS',S:'KeyW',W:'KeyD',E:'KeyA'})[SD]); await sl(700);
    const st = await ev(() => { const p = window.BREACH.world.player; return { inCover: p.inCover, posture: p.posture, x: p.x, y: p.y }; });
    if (!st.inCover) continue;
    const ps = await ev(([x, y]) => (window.BREACH.camera || window.BREACH.world.camera).worldToScreen(x, y), [st.x, st.y]);
    await page.mouse.move(SD==='W'?ps.x-200:SD==='E'?ps.x+200:ps.x, SD==='W'||SD==='E'?ps.y: N ? ps.y + 200 : ps.y - 200, { steps: 4 }); await sl(300);
    const nm = 'mur-' + SD+'-' + k.replace(/[^a-z]+/g, '-');
    await snap(nm + '-1-dukket'); const tA = (Date.now() - T0) / 1000;
    await page.mouse.down({ button: 'right' }); await sl(700);
    const up = await ev(() => ({ po: window.BREACH.world.player.posture, ex: window.BREACH.world.player.exposed }));
    await snap(nm + '-2-reist');
    await page.mouse.up({ button: 'right' }); await sl(600);
    await snap(nm + '-3-dukket-igjen');
    R.res.push({ k, side: SD, c, st, ps, up, vt: [tA, (Date.now() - T0) / 1000] }); ok = true; break;
  }
  if (!ok) R.res.push({ k, side: SD, feil: 'kom ikke i cover' });
}
await ctx.close(); await b.close(); srv.kill(); fs.writeFileSync(O + '/mur-resultat-'+want.join('_').replace(/[^a-z_]/g,'')+'.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R.res.map(r => [r.k, r.side, r.feil || r.st.posture, r.up && r.up.po, r.up && r.up.ex, r.ps && [Math.round(r.ps.x), Math.round(r.ps.y)], r.vt])), R.errs, R.cons, R.kinds);
