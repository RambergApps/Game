// Yard v2 probe (headed :21): banner vs Warden, trappeåpning, pir/svart bånd (video), silhuett lav/høy.
import { chromium } from 'playwright-core'; import { spawn } from 'child_process'; import fs from 'fs';
const OUT = '/workspace/breach/shots/test/qa/yard-v2/vann'; fs.mkdirSync(OUT, { recursive: true });
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
await sl(1500);

await page.evaluate(() => { const p = window.BREACH.world.player; p.hp = p.maxHp = 1e6; });
const tp = (x, y) => page.evaluate(([x, y]) => { const p = window.BREACH.world.player; p.x = x; p.y = y; p.vx = p.vy = 0; }, [x, y]);

const WP = [[200,800,'KeyS','kai V'],[300,800,'KeyS','kai V2'],[470,880,'KeyA','pir V-side'],[555,880,'KeyD','pir Ø-side'],[800,740,'KeyD','kai mot Ø-basseng'],[1150,800,'KeyS','kai Ø'],[640,800,'KeyS','kai midt'],[340,772,'KeyD','lav barriere ved vann (kontroll)'],[330,755,'KeyD','lav barriere 2 (kontroll)']];
for (const [x,y,k,lab] of WP) { await tp(x,y); await sl(250); await page.keyboard.down(k); await sl(350); await page.keyboard.down('KeyE'); await sl(90); await page.keyboard.up('KeyE'); await sl(500); await page.keyboard.up(k); await sl(300);
  const r = await page.evaluate(() => { const w = window.BREACH.world, p = w.player; let nw = 1e9, nc = 1e9; for (const c of w.cover) { const d = Math.hypot(Math.max(c.x-p.x,0,p.x-c.x-c.w), Math.max(c.y-p.y,0,p.y-c.y-c.h)); if (c.type==='water') nw=Math.min(nw,d); else if (c.type==='low'||c.type==='high') nc=Math.min(nc,d); }
    const inW = w.cover.some(c => c.type==='water' && p.x>c.x && p.x<c.x+c.w && p.y>c.y && p.y<c.y+c.h); return { x: Math.round(p.x), y: Math.round(p.y), inCover: !!p.inCover, dVann: Math.round(nw), dDekning: Math.round(nc), iVann: inW }; });
  await page.screenshot({ path: `${OUT}/vann-${lab.replace(/[^a-z0-9]+/gi,'-')}.png` }); log('vann', lab, JSON.stringify(r)); await page.keyboard.down('KeyE'); await sl(90); await page.keyboard.up('KeyE'); await sl(300); }
log('feil', errs.length, errs.slice(0,3).join(' | '));
await ctx.close(); await b.close(); srv.kill();
