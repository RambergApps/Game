// Yard v2 probe (headed :21): banner vs Warden, trappeåpning, pir/svart bånd (video), silhuett lav/høy.
import { chromium } from 'playwright-core'; import { spawn } from 'child_process'; import fs from 'fs';
const OUT = '/workspace/breach/shots/test/qa/yard-v2/probe'; fs.mkdirSync(OUT, { recursive: true });
const port = 8798; const srv = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1'], { cwd: '/workspace/breach/game', stdio: 'ignore' });
const sl = (ms) => new Promise(r => setTimeout(r, ms)); await sl(800);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, args: ['--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--window-size=1280,800'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
const log = (...a) => { console.log(...a); fs.appendFileSync(OUT + '/probe.log', a.join(' ') + '\n'); };
const t0 = Date.now(); await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => window.BREACH?.world?.player);
await page.mouse.click(640, 690); await sl(400); await page.keyboard.press("Escape"); await sl(150); const tc = Date.now();
const S = () => page.evaluate(() => { const w = window.BREACH.world, p = w.player, c = w.camera; const z = c.zoom, g = c.g ?? 0.574;
  return { t: +w.time?.toFixed?.(2), px: Math.round(p.x), py: Math.round(p.y), sx: Math.round((p.x - c.x) * z + 640), sy: Math.round((p.y - c.y) * z * g + 360) }; });
// 1) banner
for (const ms of [300, 900, 1500, 2100, 2800]) { await sl(Math.max(0, ms - (Date.now() - tc))); const s = await S(); await page.screenshot({ path: `${OUT}/banner-${ms}.png` }); log('banner', ms, JSON.stringify(s)); }
// helpers
await page.evaluate(() => { const p = window.BREACH.world.player; p.hp = p.maxHp = 1e6; });
const tp = (x, y) => page.evaluate(([x, y]) => { const p = window.BREACH.world.player; p.x = x; p.y = y; p.vx = p.vy = 0; }, [x, y]);
// 2) trappeåpning: skann sørkant plattform
const scan = await page.evaluate(async () => { const w = window.BREACH.world; const pc = await import('/src/player/cover.js'); const r = [];
  for (let x = 1000; x <= 1260; x += 4) r.push(pc.freeAt(w, x, 462) ? 1 : 0); let s = '', a = null, segs = [];
  r.forEach((v, i) => { const x = 1000 + i * 4; if (v && a == null) a = x; if (!v && a != null) { segs.push([a, x - 4]); a = null; } }); if (a != null) segs.push([a, 1260]); return segs; });
log('trapp fri x-segmenter ved y=462', JSON.stringify(scan));
const op = scan.find(s => s[1] - s[0] >= 20) || [1200, 1230]; const ox = (op[0] + op[1]) / 2;
await tp(ox, 540); await sl(300); await page.keyboard.down('KeyW'); for (let i = 0; i < 12; i++) { await sl(200); log('trapp N', JSON.stringify(await S())); } await page.keyboard.up('KeyW');
await page.screenshot({ path: `${OUT}/trapp-oppe.png` });
await page.keyboard.down('KeyS'); for (let i = 0; i < 12; i++) { await sl(200); log('trapp S', JSON.stringify(await S())); } await page.keyboard.up('KeyS');
// 3) pir: gå sør langs piren og tilbake (video)
await tp(512, 760); await sl(400); log('pir start', JSON.stringify(await S()));
await page.keyboard.down('KeyS'); for (let i = 0; i < 10; i++) { await sl(200); log('pir S', JSON.stringify(await S())); } await page.keyboard.up('KeyS');
await page.screenshot({ path: `${OUT}/pir-tupp.png` });
await page.keyboard.down('KeyA'); await sl(500); await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); await sl(900); await page.keyboard.up('KeyD');
await page.keyboard.down('KeyW'); await sl(1500); await page.keyboard.up('KeyW');

// 3b) vann-dekning: gå mot vannet, trykk E
const WP = [[200,800,'KeyS','kai V'],[350,800,'KeyS','kai V2'],[475,900,'KeyA','pir V-side'],[550,900,'KeyD','pir Ø-side'],[800,760,'KeyD','kai mot Ø-basseng'],[1100,800,'KeyS','kai Ø'],[340,772,'KeyD','lav barriere ved vann (kontroll)']];
for (const [x,y,k,lab] of WP) { await tp(x,y); await sl(250); await page.keyboard.down(k); await sl(600); await page.keyboard.press('KeyE'); await sl(500); await page.keyboard.up(k); await sl(300);
  const r = await page.evaluate(() => { const w = window.BREACH.world, p = w.player; let nw = 1e9, nc = 1e9; for (const c of w.cover) { const d = Math.hypot(Math.max(c.x-p.x,0,p.x-c.x-c.w), Math.max(c.y-p.y,0,p.y-c.y-c.h)); if (c.type==='water') nw=Math.min(nw,d); else if (c.type==='low'||c.type==='high') nc=Math.min(nc,d); }
    const inW = w.cover.some(c => c.type==='water' && p.x>c.x && p.x<c.x+c.w && p.y>c.y && p.y<c.y+c.h); return { x: Math.round(p.x), y: Math.round(p.y), inCover: !!p.inCover, dVann: Math.round(nw), dDekning: Math.round(nc), iVann: inW }; });
  await page.screenshot({ path: `${OUT}/vann-${lab.replace(/[^a-z0-9]+/gi,'-')}.png` }); log('vann', lab, JSON.stringify(r)); await page.keyboard.press('KeyE'); await sl(300); }
// 4) silhuett: start bølge 1-3, finn dukket fiende bak lav/høy dekning
await page.evaluate(async () => { const L = await import('/src/levels/index.js'); L._debugWave(window.BREACH.world, 2, 1); });
const got = { low: 0, high: 0 };
for (let i = 0; i < 150 && (got.low < 2 || got.high < 2); i++) {
  await sl(250);
  const c = await page.evaluate(() => { const w = window.BREACH.world, p = w.player; p.hp = 1e6;
    for (const e of w.enemies || []) { if (e.dead || e.hp <= 0) continue; const st = e.state?.name ?? e.state; const duck = e.crouch || e.crouching || e.inCover === 'low' || e.ducked;
      if (!duck && st !== 'inCover') continue; let best = null, bd = 1e9; for (const r of w.cover) { if (r.type !== 'low' && r.type !== 'high') continue; const dx = Math.max(r.x - e.x, 0, e.x - r.x - r.w), dy = Math.max(r.y - e.y, 0, e.y - r.y - r.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = r; } }
      if (!best || bd > 24) continue; const cy = best.y + best.h / 2; if (e.y >= cy) continue; // dekning skal være foran (sør for) fienden i skjermen
      return { id: e.id, type: e.type, st, duck: !!duck, ex: Math.round(e.x), ey: Math.round(e.y), ct: best.type, ck: best.kind }; }
    return null; });
  if (c && got[c.ct] < 2) { await tp(c.ex + 40, Math.min(c.ey + 230, 820)); await sl(350); got[c.ct]++; await page.screenshot({ path: `${OUT}/silhuett-${c.ct}-${got[c.ct]}.png` }); log('silhuett', JSON.stringify(c), JSON.stringify(await S())); }
}
log('feil', errs.length, errs.slice(0, 3).join(' | '));
await ctx.close(); await b.close(); srv.kill();
