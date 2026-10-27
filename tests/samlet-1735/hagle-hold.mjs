// Hagle: treff per hagl på kort hold i ekte spill. node hagle-hold.mjs ROOT PORT OUTJSON [slot]
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [ROOT, PORT, OUTJ, SLOT = '2'] = process.argv.slice(2); const sl = (ms) => new Promise(r => setTimeout(r, ms));
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await sl(800);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, args: ['--disable-backgrounding-occluded-windows'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
const ev = (f, a) => page.evaluate(f, a);
await page.goto(`http://127.0.0.1:${PORT}/index.html?yard=v2`); await page.waitForFunction(() => window.BREACH?.world?.player);
await page.mouse.click(640, 690); await sl(400);
for (let i = 0; i < 25; i++) { const t1 = await ev(() => window.BREACH.world.time || 0); await page.keyboard.press('Escape'); await sl(500); const t2 = await ev(() => window.BREACH.world.time || 0); if (t2 > t1 + 0.2 && !(await ev(() => window.BREACH.world.paused))) break; if (i % 6 === 5) await page.mouse.click(640, 690); }
// vent på fiender
for (let i = 0; i < 40; i++) { if (await ev(() => (window.BREACH.world.enemies || []).some(e => !e.dead))) break; await sl(500); }
await page.keyboard.press('Digit' + SLOT); await sl(600);
const rows = [];
for (const d of (process.env.DS || '20,60,100').split(',').map(Number)) {
  await ev((d) => { const w = window.BREACH.world, p = w.player; window.__D = d; p.x = 22 * 32; p.y = 20 * 32; p.hp = 1e6;
    const all = (w.enemies || []).filter(e => !e.dead); window.__tg = all[0]; window.__st = { hit: 0, fire: 0, cover: 0 };
    if (!window.__iv) { window.__iv = setInterval(() => { const w = window.BREACH.world, p = w.player, t = window.__tg; p.hp = 1e6; for (const e of w.enemies || []) { if (e === t) { e.x = p.x; e.y = p.y - window.__D; e.vx = e.vy = 0; if (!e.__big) { e.__big = 1; e.hp = 1e6; } e.fireCd = 9; } else { e.x = -5000; e.y = -5000; } } }, 10);
      w.events.on('hit', (e) => { const q = window.__st, s = e.source || {}; if (e.target === window.__tg && (s.owner === w.player || s.entity === w.player || s === w.player)) { q.ph = (q.ph || 0) + 1; q.hpLoss = (q.hpLoss || 0) + (e.amount || 0); (q.perShot = q.perShot || {})[q.fire] = (q.perShot[q.fire] || 0) + 1; } }); w.events.on('projectileHit', (e) => { window.__st.any = (window.__st.any || 0) + 1; if (e.target && e.target !== window.BREACH.world.player) window.__st.hit++; }); w.events.on('bulletImpact', (e) => { const q = window.__st; if (!q.imp) q.imp = []; if (q.imp.length < 6 && (e.projectile?.team || e.team) === 'player') q.imp.push([Math.round(e.x), Math.round(e.y), e.kind || e.type || '', e.projectile?.team || e.team || '']); }); w.events.on('weaponFire', (e) => { if (e.entity === w.player) { const q = window.__st; (q.ang = q.ang || []).length < 5 && q.ang.push([+e.angle.toFixed(2), e.pellets, e.weapon?.id || e.weapon, Math.round(e.x), Math.round(e.y)]); } }); w.events.on('coverHit', () => { window.__st.cov = (window.__st.cov || 0) + 1; }); w.events.on('weaponFire', (e) => { if ((e.entity || e.shooter || e.source || e.owner) === w.player) { window.__st.fire++; window.__st.pel = (window.__st.pel || 0) + (e.pellets || 0); } window.__st.fireAll = (window.__st.fireAll || 0) + 1; }); }
  }, d); await sl(1800);
  const s = await ev(() => { const B = window.BREACH, t = window.__tg; return B.camera.worldToScreen(t.x, t.y - 20); });
  await page.mouse.move(s.x, s.y); await sl(200); await ev(() => { window.__st = { hit: 0, fire: 0 }; window.__tg.hp = 1e6; });
  for (let k = 0; k < 10; k++) { const s2 = await ev(() => { const B = window.BREACH, t = window.__tg; return B.camera.worldToScreen(t.x, t.y - 20); }); await page.mouse.move(s2.x, s2.y); await sl(120); await page.mouse.down(); await sl(60); await page.mouse.up(); await sl(900); if (k % 5 === 4 || k === 9) { await page.keyboard.press('KeyR'); await sl(2500); } }
  const st = await ev(() => ({ ...window.__st, hpTgEnd: window.__tg.hp, tg: { x: window.__tg.x, y: window.__tg.y, type: window.__tg.type, state: window.__tg.state, dead: window.__tg.dead, r: window.__tg.r }, p: [window.BREACH.world.player.x, window.BREACH.world.player.y], wpn: window.BREACH.world.player.weapon?.id })); rows.push({ d, ...st, hitsPerShot: +((st.ph||0) / Math.max(1, st.fire)).toFixed(2) }); console.log(JSON.stringify(rows.at(-1)));
}
fs.writeFileSync(OUTJ, JSON.stringify({ rows, errs }, null, 1)); await b.close(); srv.kill(); console.log('errs', errs.length);
