// Cover-lekk (27.10): deterministisk test av lav dekning i Kessa Yard v2. Ekte kuler (spawnProjectile + core/combat), Warden dukket.
// Klassifisering: vis = fri linje fra munning til et punkt på Wardens hitbox (sirkel p.r, 24 punkter + sentrum) som ikke krysser lav/høy dekning
// (krysninger < 40 px fra munning ignoreres, som SHOOTER_IGNORE). prot = kopi av core/combat.js lowCoverProtecting.
// a = treff med vis (rettferdig), b = treff uten vis (urettferdig treff), c = reddet av lav dekning (0.9-rullen) selv om vis (urettferdig blokkert).
import { chromium } from 'playwright-core'; import { spawn } from 'child_process'; import fs from 'fs';
const OUT = '/workspace/breach/shots/test/qa/cover-lekk'; fs.mkdirSync(OUT, { recursive: true });
const N = +(process.argv.find(a => a.startsWith('--n='))?.slice(4) || 240);
const port = 8801; const srv = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1'], { cwd: '/workspace/breach/game', stdio: 'ignore' });
const sl = (ms) => new Promise(r => setTimeout(r, ms)); await sl(800);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: !process.argv.includes('--headed'), args: ['--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html?yard=v2`); await page.waitForFunction(() => window.BREACH?.world?.player);
await page.mouse.click(640, 690); await sl(400);
for (let i = 0; i < 20; i++) { const t1 = await page.evaluate(() => window.BREACH.world.time || 0); await page.keyboard.press('Escape'); await sl(500); const t2 = await page.evaluate(() => window.BREACH.world.time || 0); if (t2 > t1 + 0.2) break; if (i === 10) await page.mouse.click(640, 690); }
await sl(1000); console.log('tid', await page.evaluate(() => window.BREACH.world.time));
await page.evaluate(async () => {
  const w = window.BREACH.world; const core = await import('/src/core/index.js'); window.__core = core;
  setInterval(() => { for (const e of w.enemies || []) { e.x = -5000; e.y = -5000; e.vx = e.vy = 0; } w.player.hp = Math.max(w.player.hp, 1e6); }, 30);
  const SI = 40, LCR = core.LOW_COVER_RANGE ?? 48;
  window.__prot = (ox, oy, tx, ty, r) => { const L = Math.hypot(tx - ox, ty - oy); for (const c of w.cover) { if (c.type !== 'low') continue; const t = core.segmentRect(ox, oy, tx, ty, c); if (t === null) continue; const al = t * L; if (al < SI) continue; if (L - al <= LCR + (r || 14)) return { c, back: +(L - al).toFixed(1) }; } return null; };
  window.__firstLow = (ox, oy, tx, ty) => { const L = Math.hypot(tx - ox, ty - oy); let best = null; for (const c of w.cover) { if (c.type !== 'low') continue; const t = core.segmentRect(ox, oy, tx, ty, c); if (t === null || t * L < SI) continue; if (!best || t < best.t) best = { t, back: +(L - t * L).toFixed(1), kind: c.kind }; } return best; };
  window.__vis = (ox, oy, tx, ty, r) => { const pts = [[tx, ty]]; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([tx + Math.cos(a) * r * 0.98, ty + Math.sin(a) * r * 0.98]); }
    let n = 0; for (const [px, py] of pts) { const L = Math.hypot(px - ox, py - oy); let blk = false; for (const c of w.cover) { if (c.type !== 'low' && c.type !== 'high') continue; const t = core.segmentRect(ox, oy, px, py, c); if (t !== null && t * L >= SI) { blk = true; break; } } if (!blk) n++; } return n; };
  window.__inside = (x, y) => w.cover.some(c => x > c.x - 12 && x < c.x + c.w + 12 && y > c.y - 12 && y < c.y + c.h + 12);
  window.__ev = { hit: 0, save: 0, block: 0 }; w.events.on('projectileHit', (e) => { if (e.target === w.player) window.__ev.hit++; });
  w.events.on('coverHit', (e) => { if (e.projectile?.__t) { if (e.partial) window.__ev.save++; else window.__ev.block++; } });
});
const T = 32;
// Covere: [navn, finn-rect, side (normal mot skytter): 'S'|'N'|'W'|'E']
const COVERS = [
  ['sandsekk 3x1 (13,22), skudd fra N', { kind: 'sandbag', x: 13 * T, y: 22 * T }, 'N'],
  ['sandsekk 3x1 (8,11), skudd fra S', { kind: 'sandbag', x: 8 * T, y: 11 * T }, 'S'],
  ['kasser 2x1 (17,14), skudd fra S', { kind: 'crates', x: 17 * T, y: 14 * T }, 'S'],
  ['N–S-barriere 0,75x1 (13.125,15.75), skudd fra Ø', { kind: 'barrier', x: 13.125 * T, y: 15.75 * T }, 'E'],
  ['Ø–V-barriere 2x1 (27,13), skudd fra S', { kind: 'barrier', x: 27 * T, y: 13 * T }, 'S'],
];
const findRect = (q) => page.evaluate((q) => { const w = window.BREACH.world; const c = w.cover.find(c => c.kind === q.kind && Math.abs(c.x - q.x) < 2 && Math.abs(c.y - q.y) < 2); return c ? { x: c.x, y: c.y, w: c.w, h: c.h, type: c.type, kind: c.kind } : null; }, q);
const NORM = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
const rows = []; const maps = [];
async function enterCover(rect, side) {
  for (let k = 0; k < 3; k++) { const ic = await page.evaluate(() => window.BREACH.world.player.inCover); if (!ic) break; await page.keyboard.down('KeyE'); await sl(90); await page.keyboard.up('KeyE'); await sl(400); }
  const [nx, ny] = NORM[side]; const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  // Warden står på motsatt side av normalen (skytter på normal-siden)
  const wx = nx ? (nx > 0 ? rect.x - 16 : rect.x + rect.w + 16) : cx, wy = ny ? (ny > 0 ? rect.y - 16 : rect.y + rect.h + 16) : cy;
  await page.evaluate(([x, y]) => { const p = window.BREACH.world.player; p.x = x; p.y = y; p.vx = p.vy = 0; }, [wx + (nx ? -nx * 20 : 0), wy + (ny ? -ny * 20 : 0)]);
  await sl(150); const key = nx ? (nx > 0 ? 'KeyD' : 'KeyA') : (ny > 0 ? 'KeyS' : 'KeyW');
  await page.keyboard.down(key); await sl(150); await page.keyboard.down('KeyE'); await sl(90); await page.keyboard.up('KeyE'); await sl(250); await page.keyboard.up(key); await sl(700);
  return page.evaluate(() => { const p = window.BREACH.world.player; return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), r: p.r, posture: p.posture, inCover: p.inCover, exposed: p.exposed, chance: p.coverHitChance }; });
}
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7);
for (const [name, q, side] of COVERS.filter(c => !ONLY || c[0].includes(ONLY))) {
  const rect = await findRect(q); if (!rect) { console.log('mangler', name); continue; }
  let W = await enterCover(rect, side); if (!W.inCover) W = await enterCover(rect, side);
  console.log(name, JSON.stringify(rect), 'Warden', JSON.stringify(W));
  const [nx, ny] = NORM[side];
  for (const ang of [0, 30, 60, 80]) for (const d of [120, 250, 400]) {
    const a = Math.atan2(ny, nx) + ang * Math.PI / 180; const sx = W.x + Math.cos(a) * d, sy = W.y + Math.sin(a) * d;
    const r = await page.evaluate(async ([sx, sy, n]) => {
      const w = window.BREACH.world, p = w.player, core = window.__core; const tA = w.time; const st = { posture: p.posture, chance: p.coverHitChance, r: p.r, x: p.x, y: p.y };
      const vis = window.__vis(sx, sy, p.x, p.y, p.r), prot = window.__prot(sx, sy, p.x, p.y, p.r), fl = window.__firstLow(sx, sy, p.x, p.y);
      window.__ev = { hit: 0, save: 0, block: 0 }; const owner = { x: sx, y: sy, type: 'test', team: 'enemy', r: 14 };
      const out = { hit: 0, save: 0, block: 0, miss: 0 }; const B = 40;
      for (let k = 0; k < n; k += B) { window.__ev = { hit: 0, save: 0, block: 0 };
        for (let j = 0; j < B && k + j < n; j++) { const ang = Math.atan2(p.y - sy, p.x - sx) + (Math.random() - 0.5) * 2 * 1.0 * Math.PI / 180; const pr = core.spawnProjectile(w, { x: sx, y: sy, angle: ang, team: 'enemy', owner, dmg: 0.0001, speed: 1400, range: 600 }); pr.__t = 1; }
        await new Promise(r => setTimeout(r, 650)); out.hit += window.__ev.hit; out.save += window.__ev.save; out.block += window.__ev.block; }
      out.miss = n - out.hit - out.save - out.block; out.dt = +(w.time - tA).toFixed(2);
      return { ...out, vis, prot: !!prot, back: prot?.back ?? fl?.back ?? null, lowKind: fl?.kind ?? null, inside: window.__inside(sx, sy), oob: sx < 14 || sy < 14 || sx > w.bounds.x + w.bounds.w - 14 || sy > w.bounds.y + w.bounds.h - 14, st, after: { posture: p.posture, x: +p.x.toFixed(1), y: +p.y.toFixed(1) } };
    }, [sx, sy, N]);
    const shotsOnBody = r.hit + r.save; const A = r.vis ? r.hit : 0, Bq = (!r.vis && !r.prot) ? r.hit : 0, B01 = (!r.vis && r.prot) ? r.hit : 0, C = r.vis ? r.save : 0;
    const row = { cover: name, ang, d, ...r, a: A, b: Bq, b01: B01, c: C, rate: shotsOnBody ? +(r.hit / shotsOnBody).toFixed(3) : null };
    rows.push(row); console.log(`${name} ${ang}° ${d}px: treff ${r.hit} redd ${r.save} blokk ${r.block} bom ${r.miss} | vis ${r.vis}/25 prot ${r.prot} bak ${r.back} ${r.inside ? '(skytter i/ved dekning)' : ''} ${r.oob ? '(UTENFOR BRETTET)' : ''} | a ${A} b ${Bq} rull ${B01} c ${C} | ${r.st.posture}/${r.st.chance} -> ${r.after.posture}`);
  }
  // Kart: rutenett av skytterposisjoner
  const m = await page.evaluate(([nx, ny]) => { const w = window.BREACH.world, p = w.player; const R = 460, S = 8, cells = [];
    for (let gx = -R; gx <= R; gx += S) for (let gy = -R; gy <= R; gy += S) { const dd = Math.hypot(gx, gy); if (dd < 50 || dd > R) continue; if (gx * nx + gy * ny < -10) continue; const sx = p.x + gx, sy = p.y + gy;
      if (sx < 0 || sy < 0 || sx > w.bounds.w || sy > w.bounds.h || w.cover.some(c => sx > c.x && sx < c.x + c.w && sy > c.y && sy < c.y + c.h)) { cells.push([gx, gy, 4]); continue; }
      const vis = window.__vis(sx, sy, p.x, p.y, p.r) > 0, prot = !!window.__prot(sx, sy, p.x, p.y, p.r); cells.push([gx, gy, vis ? (prot ? 3 : 0) : (prot ? 1 : 2)]); }
    return { px: p.x, py: p.y, r: p.r, cells, cover: w.cover.filter(c => Math.abs(c.x + c.w / 2 - p.x) < 520 && Math.abs(c.y + c.h / 2 - p.y) < 520).map(c => ({ x: c.x - p.x, y: c.y - p.y, w: c.w, h: c.h, type: c.type })) }; }, [nx, ny]);
  maps.push({ name, ...m });
}
// Positur-hale etter slipp: RMB (popUp/exposed) og LMB-blind
await enterCover(await findRect(COVERS[0][1]), 'S');
const tail = await page.evaluate(async () => { const p = window.BREACH.world.player; const res = {}; const cv = document.querySelector('canvas'); const r = cv.getBoundingClientRect();
  const fire = (type, btn) => cv.dispatchEvent(new MouseEvent(type, { bubbles: true, button: btn, buttons: type === 'mousedown' ? (btn === 2 ? 2 : 1) : 0, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.75 }));
  const watch = async (label, btn, holdMs) => { fire('mousedown', btn); window.dispatchEvent(new MouseEvent('mousedown', { button: btn, buttons: btn === 2 ? 2 : 1 })); await new Promise(r => setTimeout(r, holdMs)); const before = { posture: p.posture, exposed: p.exposed, chance: p.coverHitChance };
    fire('mouseup', btn); window.dispatchEvent(new MouseEvent('mouseup', { button: btn, buttons: 0 })); const t0 = performance.now(); const seq = [];
    while (performance.now() - t0 < 1200) { await new Promise(r => requestAnimationFrame(r)); seq.push([+(performance.now() - t0).toFixed(0), p.posture, p.exposed ? 1 : 0, p.coverHitChance]); }
    const firstHidden = seq.find(s => s[1] === 'hidden' && !s[2] && s[3] === 0.1); res[label] = { before, msTilSkjult: firstHidden ? firstHidden[0] : null, seq: seq.filter((s, i) => i === 0 || seq[i - 1][1] !== s[1] || seq[i - 1][2] !== s[2] || seq[i - 1][3] !== s[3]) }; };
  await watch('RMB popUp', 2, 600); await new Promise(r => setTimeout(r, 500)); await watch('LMB blind', 0, 600); return res; });
fs.writeFileSync(OUT + '/cover-lekk.json', JSON.stringify({ N, rows, tail, errs }, null, 1)); fs.writeFileSync(OUT + '/maps.json', JSON.stringify(maps));
console.log('HALE', JSON.stringify(tail)); console.log('feil', errs.length);
// Kartbilder (tegnes i nettleser-canvas)
for (const [i, m] of maps.entries()) {
  const png = await page.evaluate((m) => { const S = 8, R = 460, sc = 1, W = (2 * R + 40), cv = document.createElement('canvas'); cv.width = W; cv.height = W + 70; const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    const O = R + 20, col = ['#e8c547', '#2fa84f', '#e03a3a', '#3a7be0', '#333'];
    for (const [x, y, k] of m.cells) { g.fillStyle = col[k]; g.fillRect(O + x - S / 2, O + y - S / 2, S, S); }
    for (const c of m.cover) { g.fillStyle = c.type === 'high' ? '#888' : c.type === 'low' ? '#c9b48a' : '#335'; g.fillRect(O + c.x, O + c.y, c.w, c.h); g.strokeStyle = '#000'; g.strokeRect(O + c.x, O + c.y, c.w, c.h); }
    g.fillStyle = '#4cc3ff'; g.beginPath(); g.arc(O, O, m.r, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.stroke();
    g.font = '15px sans-serif'; g.fillStyle = '#fff'; g.fillText(m.name + ' – Warden dukket (blå sirkel = hitbox r ' + m.r + ')', 10, W + 18);
    const L = [['gul: rettferdig treff (fri linje, ikke beskyttet)', 0], ['grønn: rettferdig beskyttet (ingen fri linje, 0,1)', 1], ['rød: (b) urettferdig treff – ingen fri linje, men ikke beskyttet (100 %)', 2], ['blå: (c) urettferdig blokkert – fri linje, men 0,1', 3]];
    L.forEach(([t, k], j) => { g.fillStyle = col[k]; g.fillRect(10 + (j % 2) * 470, W + 28 + Math.floor(j / 2) * 20, 12, 12); g.fillStyle = '#ddd'; g.font = '12px sans-serif'; g.fillText(t, 28 + (j % 2) * 470, W + 39 + Math.floor(j / 2) * 20); });
    return cv.toDataURL('image/png'); }, m);
  fs.writeFileSync(`${OUT}/kart-${i + 1}-${m.name.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '')}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
await b.close(); srv.kill();
