// Gjenskaper Fiende-AI sine «gule» skjulte treff i snapshot 1735 (før fiks). node gjenskap.mjs ROOT PORT
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [ROOT, PORT] = process.argv.slice(2); const O = '/workspace/breach/shots/test/qa/fiks-1853'; const UJ = '/workspace/breach/shots/test/qa/skjult-gul/utvalg.json'; const PICK = [1, 2, 4, 5, 7]; const sl = (ms) => new Promise(r => setTimeout(r, ms));
const U = JSON.parse(fs.readFileSync(UJ)).filter(o => PICK.includes(o.nr)); fs.mkdirSync(O, { recursive: true });
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
  setInterval(() => { const p = w.player, P = window.__P; p.hp = p.maxHp; if (!P) return; for (const e of w.enemies) { if (e === window.__tg) { e.x = P.sx; e.y = P.sy; e.vx = e.vy = 0; e.hp = e.maxHp; if (!window.__fire) e.fireCd = 99; if ('aim' in e) e.aim = Math.atan2(P.wy - P.sy, P.wx - P.sx); e.angle = Math.atan2(P.wy - P.sy, P.wx - P.sx); } else { e.x = -5000; e.y = -5000; } } }, 10);
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
  const an = await ev(async (o) => { const C = await import('./src/core/combat.js'); const w = window.BREACH.world, t = w.player; const res = C.lowCoverProtecting(w, { ox: o.ox, oy: o.oy }, t);
    const seg = (x1, y1, x2, y2, c) => { let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1; for (const [p, q] of [[-dx, x1 - c.x], [dx, c.x + c.w - x1], [-dy, y1 - c.y], [dy, c.y + c.h - y1]]) { if (p === 0) { if (q < 0) return false; } else { const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); } } return t0 <= t1; };
    const L0 = Math.hypot(o.ox - t.x, o.oy - t.y), ux = (o.ox - t.x) / L0, uy = (o.oy - t.y) / L0, rr = (t.r || 14) * 0.95; let free = 0; const pts = [];
    for (const a of [null, 0, -1.4, -0.9, -0.45, 0.45, 0.9, 1.4]) { let sx = t.x, sy = t.y; if (a !== null) { const ca = Math.cos(a), sa = Math.sin(a); sx += (ux * ca - uy * sa) * rr; sy += (ux * sa + uy * ca) * rr; } const bl = w.cover.some(c => (c.type === 'low' || c.type === 'high') && seg(o.ox, o.oy, sx, sy, c)); if (!bl) free++; pts.push([+sx.toFixed(1), +sy.toFixed(1), bl]); }
    return { beskyttet: !!res, blokker: res ? [res.x, res.y, res.w, res.h, res.kind] : null, fritt: free, av: 8, pts }; }, o);
  await ev(() => { window.__fire = 1; window.__ph = { hit: 0, dmg: 0, shots: 0 }; const w = window.BREACH.world; if (!window.__hk) { window.__hk = 1; w.events.on('hit', (e) => { if (window.__fire && e.target === w.player && !e.blocked) { window.__ph.hit++; window.__ph.dmg += e.amount; } }); w.events.on('weaponFire', (e) => { if (window.__fire && e.entity === window.__tg) window.__ph.shots++; }); } });
  await sl(6000); const live = await ev(() => { window.__fire = 0; return window.__ph; }); an.live = live;
  await ev((o) => { const p = window.BREACH.world.player; p.x = o.wx; p.y = o.wy; }, o); await sl(300);
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
    g.fillText('gul stiplet = munning→Warden, cyan = cover, magenta = ender, rød ring = Warden (r 11), rød strek = del av linja inne i coveret', 16, 708); }, { ...o, dom: '1853: se rapport' });
  await sl(150);
  const fn = `nr${String(o.nr).padStart(2, '0')}-${o.kat.replace('å','a')}-${o.seed}-t${o.t}.png`; await page.screenshot({ path: `${O}/${fn}` });
  rows.push({ nr: o.nr, fn, st, an }); console.log(o.nr, fn, JSON.stringify(st), JSON.stringify({ ...an, pts: undefined }));
}
fs.writeFileSync(O + '/gjenskap-1853.json', JSON.stringify({ sameCover, rows, errs }, null, 1)); console.log('sameCover', sameCover, 'errs', errs.length);
await b.close(); srv.kill();
