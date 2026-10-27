// Probe: vann i dekningslinjer/fiendeplasser (Yard v2). Headless.
import { chromium } from 'playwright-core'; import { spawn } from 'child_process';
const port = 8797; const srv = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1'], { cwd: '/workspace/breach/game', stdio: 'ignore' });
await new Promise(r=>setTimeout(r,800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true }); const page = await b.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => window.BREACH?.world?.player);
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const w = window.BREACH.world; const pc = await import('/src/player/cover.js'); const ec = await import('/src/enemies/cover.js');
  const water = w.cover.filter(c => c.kind === 'water' || c.type === 'water');
  const isW = (x,y) => water.some(c => x>=c.x-2 && x<=c.x+c.w+2 && y>=c.y-2 && y<=c.y+c.h+2);
  const lines = pc.coverLines(w); const wl = lines.filter(l => l.covers.some(c => water.includes(c)));
  const spots = ec.getSpots(w); const ws = spots.filter(s => isW(s.x, s.y) || (s.cover && water.includes(s.cover)));
  return { waterRects: water.map(c=>({x:c.x,y:c.y,w:c.w,h:c.h,type:c.type,kind:c.kind})), lines: lines.length, waterLines: wl.map(l=>({nx:l.nx,ny:l.ny,f:l.f,type:l.type,len:l.tmax-l.tmin})), spots: spots.length, waterSpots: ws.slice(0,8).map(s=>({x:Math.round(s.x),y:Math.round(s.y),type:s.type})), nWaterSpots: ws.length };
});
console.log(JSON.stringify({ ...r, errs }, null, 1)); await b.close(); srv.kill();
