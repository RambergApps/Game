// Gjenskaper Fiende-AI sine «gule» skjulte treff i snapshot 1735 (før fiks). node gjenskap.mjs ROOT PORT
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [ROOT, PORT] = process.argv.slice(2); const O = '/workspace/breach/shots/test/qa/skjult-gul'; const sl = (ms) => new Promise(r => setTimeout(r, ms));
const U = JSON.parse(fs.readFileSync(O + '/utvalg.json'));
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await sl(800);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const ev = (f, a) => page.evaluate(f, a);
await page.goto(`http://127.0.0.1:${PORT}/index.html?view=34`); await page.waitForFunction(() => window.BREACH?.world?.modules?.levels); await page.mouse.click(640, 690); await sl(1500);
for (let i = 0; i < 20 && (await ev(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase)) === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sl(600); }
for (let i = 0; i < 4 && (await ev(() => window.BREACH.world.paused)); i++) { await page.keyboard.press('Escape'); await sl(700); }
const cov = await ev(() => window.BREACH.world.cover.filter(c => c.type === 'low').map(c => [c.x, c.y, c.w, c.h, c.kind]));
const ref = JSON.parse(fs.readFileSync('/tmp/fa27/hid/s22/hid.json')).cover.filter(c => c.type === 'low').map(c => [c.x, c.y, c.w, c.h, c.kind]);
const sameCover = JSON.stringify(cov) === JSON.stringify(ref);
await ev(() => { const w = window.BREACH.world; w.modules.levels._debugWave(w, 4, 0.5); });
for (let i = 0; i < 40; i++) { if (await ev(() => (window.BREACH.world.enemies || []).some(e => !e.dead && e.type === 'grunt'))) break; await sl(500); }
await ev(() => { const w = window.BREACH.world; window.__tg = w.enemies.find(e => !e.dead && e.type === 'grunt');
  setInterval(() => { const p = w.player, P = window.__P; p.hp = p.maxHp; if (!P) return; for (const e of w.enemies) { if (e === window.__tg) { e.x = P.sx; e.y = P.sy; e.vx = e.vy = 0; e.hp = e.maxHp; e.fireCd = 99; if ('aim' in e) e.aim = Math.atan2(P.wy - P.sy, P.wx - P.sx); e.angle = Math.atan2(P.wy - P.sy, P.wx - P.sx); } else { e.x = -5000; e.y = -5000; } } }, 10);
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; cv.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;pointer-events:none;z-index:999'; document.body.appendChild(cv); window.__ov = cv; });
await page.keyboard.press('F1'); await sl(300);
const rows = [];
for (let i = 0; i < U.length; i++) { const o = U[i];
  for (let z = 0; z < 3; z++) { if (!(await ev(() => window.BREACH.world.player.inCover))) break; await page.keyboard.press('KeyE'); await sl(400); }
  await ev((o) => { window.__P = o; const p = window.BREACH.world.player; p.x = o.wx; p.y = o.wy; p.vx = p.vy = 0; }, o); await sl(250);
  await page.keyboard.press('KeyE'); await sl(700);
  // sett tilbake til nøyaktig posisjon hvis cover-snap flyttet ham litt
  const st = await ev((o) => { const p = window.BREACH.world.player; return { inCover: p.inCover, posture: p.posture, x: +p.x.toFixed(1), y: +p.y.toFixed(1), exposed: p.exposed }; }, o);
  await sl(400);
  await ev((o) => { const B = window.BREACH, cam = B.camera, cv = window.__ov, g = cv.getContext('2d'); g.clearRect(0, 0, 1280, 720); const S = (x, y) => cam.worldToScreen(x, y);
    const c = o.cover; const q = [S(c.x, c.y), S(c.x + c.w, c.y), S(c.x + c.w, c.y + c.h), S(c.x, c.y + c.h)];
    g.lineWidth = 2; g.strokeStyle = '#00e5ff'; g.beginPath(); q.forEach((p, k) => k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke();
    g.fillStyle = '#ff00ff'; for (const [x, y] of o.ender) { const p = S(x, y); g.beginPath(); g.arc(p.x, p.y, 5, 0, 7); g.fill(); }
    const a = S(o.ox, o.oy), t = S(o.wx, o.wy); g.strokeStyle = '#ffeb3b'; g.lineWidth = 2; g.setLineDash([8, 5]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(t.x, t.y); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#ff3030'; g.beginPath(); g.arc(t.x, t.y, 11 * cam.zoom, 0, 7); g.stroke(); g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(a.x, a.y, 4, 0, 7); g.fill();
    if (o.kryss) { const k1 = S(o.kryss[0], o.kryss[1]), k2 = S(o.kryss[2], o.kryss[3]); g.strokeStyle = '#ff3030'; g.lineWidth = 4; g.beginPath(); g.moveTo(k1.x, k1.y); g.lineTo(k2.x, k2.y); g.stroke(); }
    g.font = 'bold 15px sans-serif'; g.fillStyle = '#000a'; g.fillRect(8, 640, 1264, 72); g.fillStyle = '#fff';
    g.fillText(`#${o.nr} ${o.kat} | ${o.seed} t=${o.t}s ${o.src} ${o.amt} HP | vinkel mot normal ${o.ang}° | Warden ${o.endDist} px innenfor nærmeste ende (kropp ${o.overheng} px forbi) | skytter ${o.skytterAvst} px`, 16, 662);
    g.fillText(`cover ${c.kind} (${c.x},${c.y} ${c.w}×${c.h}) flate ${o.face} | linje ${o.kryss ? 'KRYSSER coveret ' + JSON.stringify(o.kryss) : 'krysser ikke coveret'} | skytter ${o.sammeSide ? 'PÅ WARDENS SIDE' : 'på motsatt side'}${o.skytterForbiEnden ? ', forbi enden' : ', innenfor bredden'} | ${o.dom}`, 16, 686);
    g.fillText('gul stiplet = munning→Warden, cyan = cover, magenta = ender, rød ring = Warden (r 11), rød strek = del av linja inne i coveret', 16, 708); }, { ...o, nr: i + 1 });
  await sl(150);
  const fn = `${String(i + 1).padStart(2, '0')}-${o.kat}-${o.seed}-t${o.t}.png`; await page.screenshot({ path: `${O}/${fn}` });
  rows.push({ nr: i + 1, fn, st }); console.log(i + 1, fn, JSON.stringify(st));
}
fs.writeFileSync(O + '/gjenskap.json', JSON.stringify({ sameCover, rows, errs }, null, 1)); console.log('sameCover', sameCover, 'errs', errs.length);
await b.close(); srv.kill();
