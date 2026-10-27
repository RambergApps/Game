// QA-klipp (Breach Test, 27.10): headed Chrome, recordVideo per scenario, trim til 10–20 s (webm+mp4), per-bilde-logg og kontaktark.
// Bruk: DISPLAY=:21 node tests/qa-klipp.mjs [--scen gange,strafe,rulling,dekning,dod1,dod2,dod3] [--out shots/test/qa/warden-c] [--zoom 2.4]
import { createRequire } from 'node:module'; import { spawn, execFileSync } from 'node:child_process'; import net from 'node:net'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = { scen: 'gange,strafe,rulling,dekning,dod1,dod2,dod3', out: 'shots/test/qa/warden-c', zoom: 2.4, q: '?view=34', wave: '', sek: '17000' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (k in A) A[k] = process.argv[++i]; }
const OUT = path.resolve(REPO, A.out); fs.mkdirSync(OUT, { recursive: true }); const TMP = path.join(OUT, '_raw'); fs.mkdirSync(TMP, { recursive: true });
const W = 1280, H = 720, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), hasFF = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(800);
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: [`--window-size=${W},${H + 90}`, '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', '--autoplay-policy=no-user-gesture-required'] });
const DIRS = { E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1], N: [0, -1], NE: [1, -1] };
const KEYS = (d) => { const [x, y] = DIRS[d]; return [y < 0 && 'KeyW', y > 0 && 'KeyS', x < 0 && 'KeyA', x > 0 && 'KeyD'].filter(Boolean); };
const ang = (d) => Math.atan2(DIRS[d][1], DIRS[d][0]);
const SUMMARY = { mtimes: {}, clips: {} };
for (const f of ['src/shared/rig/styles/paintedC.js', 'src/shared/rig/paintedC/paintedC.js', 'src/player/index.js', 'src/player/state.js']) SUMMARY.mtimes[f] = fs.statSync(path.join(REPO, 'game', f)).mtime.toString().slice(16, 24);
fs.readdirSync(path.join(REPO, 'game/src/shared/rig/paintedC/img'), { recursive: true }).forEach(() => {}); 

async function scenario(name, fn) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: TMP, size: { width: W, height: H } } });
  const T0 = Date.now(); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html${A.q === "none" ? "" : A.q}`); await page.waitForFunction(() => window.BREACH?.world?.player && window.BREACH?.world?.modules?.levels);
  await page.mouse.click(W / 2, H - 30); await sleep(1500);
  const st = () => page.evaluate(() => { const w = window.BREACH.world, d = w.modules.levels._debug(w); return { phase: d.phase, paused: !!w.paused }; });
  for (let i = 0; i < 20 && (await st()).phase === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(600); }
  await page.evaluate(async ({ zoom }) => {
    const w = window.BREACH.world, C = (await import('/src/shared/rig/styles/paintedC.js')).paintedC, L = w.modules.levels;
    const Q = window.__qa = { log: [], tag: '', ready: C.ready, god: true };
    setInterval(() => { const d = L._debug(w); if (d.phase === 'break') d.breakLeft = Q.fight ? 0 : 999; if (Q.god && w.player && !Q.fight) { w.player.hp = w.player.maxHp; } if (!Q.fight) for (const e of w.enemies || []) { e.hp = 0; } else { const B = window.BREACH, p = w.player; const on = (e) => { const q = B.camera.worldToScreen(e.x, e.y); return q.x > 0 && q.x < innerWidth && q.y > 0 && q.y < innerHeight; }; Q.seen = Q.seen || {}; let anyOn = false; for (const e of w.enemies || []) { if (e.hp <= 0) continue; const o = on(e); anyOn ||= o; if (o && !Q.seen[e.id ?? e.uid ?? e.x]) Q.seen[e.id ?? e.uid ?? e.x] = { d: Math.round(Math.hypot(e.x - p.x, e.y - p.y)), t: performance.now() | 0, type: e.type || e.kind }; } if (Q.lastHp != null && p.hp < Q.lastHp) { Q.hits = (Q.hits || 0) + 1; if (!anyOn) Q.offHits = (Q.offHits || 0) + 1; } Q.lastHp = p.hp; if (Q.god && p.hp < p.maxHp * 0.5) p.hp = p.maxHp; Q.lastHp = p.hp; } if (zoom > 0) window.BREACH.camera.zoom = zoom; }, 50);
    const orig = C.drawFigure.bind(C);
    C.drawFigure = function (ctx, rig, F, opts) { if (rig === w.player?.__rig || rig === window.BREACH.world.modules?.player?.rig || F === w.__lastF || true) {
        const P = F.posture || {}, K = F.skel || {}, aim = K.ra ?? K.ta ?? F.torsoAngle ?? F.aimAngle ?? 0, kneel = Math.max(P.kneel || 0, P.slide || 0), walk = (F.amp || 0) > 0.2 && kneel < 0.5;
        const p = w.player; const whole = F.mode === 'death' || (F.clip?.roll && (P.roll || 0) > 0.2);
        Q.log.push({ t: +performance.now().toFixed(0), tag: Q.tag, x: +F.x.toFixed(1), y: +F.y.toFixed(1), vx: +(p?.vx || 0).toFixed(0), vy: +(p?.vy || 0).toFixed(0), mode: F.mode, aim: +aim.toFixed(2), move: F.moveAngle != null ? +F.moveAngle.toFixed(2) : null, hip: F.hipAngle != null ? +F.hipAngle.toFixed(2) : null,
          leg: whole ? null : +(walk ? F.moveAngle : (F.hipAngle ?? aim)).toFixed(2), walk, phase: walk ? +(F.phase || 0).toFixed(3) : null, amp: +(F.amp || 0).toFixed(2), kneel: +kneel.toFixed(2), whole, roll: F.clip?.roll?.phase || null, fall: F.clip?.death?.fall ?? null, ready: C.ready, cx: +window.BREACH.camera.x.toFixed(1), cy: +window.BREACH.camera.y.toFixed(1), z: window.BREACH.camera.zoom, g: window.BREACH.camera.g, px: +(p?.x||0).toFixed(1), py: +(p?.y||0).toFixed(1), pa: p?.aim != null ? +p.aim.toFixed(3) : null, mwx: +(w.input?.mouse?.worldX||0).toFixed(1), mwy: +(w.input?.mouse?.worldY||0).toFixed(1), fire: !!w.input?.mouse?.down }); }
      return orig(ctx, rig, F, opts); };
  }, { zoom: +A.zoom });
  await sleep(1200);
  const tStart = (Date.now() - T0) / 1000; const marks = [];
  const helper = {
    page, marks, sleep,
    tag: (t) => page.evaluate((t) => { window.__qa.tag = t; }, t),
    pos: () => page.evaluate(() => { const B = window.BREACH, p = B.world.player, s = B.camera.worldToScreen(p.x, p.y); return { x: p.x, y: p.y, sx: s.x, sy: s.y, ay: B.world.view === '34' ? 27 * (B.PROJ?.zScale ?? 0.75) * B.camera.zoom * (B.camera.g || 1) : 0 }; }),
    aimAt: async (a, r = 220) => { const q = await helper.pos(); await page.mouse.move(q.sx + Math.cos(a) * r, q.sy - q.ay + Math.sin(a) * r); },
    snap: async (label) => { const q = await helper.pos(); const f = path.join(TMP, `${name}-${label}.png`); const cx = Math.max(0, Math.min(W - 200, q.sx - 100)), cy = Math.max(0, Math.min(H - 220, q.sy - 160)); await page.screenshot({ path: f, clip: { x: cx, y: cy, width: 200, height: 220 } }); return f; },
    teleport: (x, y) => page.evaluate(([x, y]) => { const p = window.BREACH.world.player; p.x = x; p.y = y; p.vx = p.vy = 0; }, [x, y]),
    hold: async (keys, ms, aimA, label, frames) => { for (const k of keys) await page.keyboard.down(k); const shots = []; const n = frames || 0; const seg = ms / (n + 1); const wait = async () => { const t = Date.now(); while (Date.now() - t < seg) { if (aimA != null) await helper.aimAt(aimA); await sleep(60); } }; for (let i = 0; i < n; i++) { await wait(); shots.push(await helper.snap(`${label}-${i}`)); } await wait(); for (const k of keys) await page.keyboard.up(k); return shots; },
    phase: st,
  };
  const sheets = await fn(helper);
  const tEnd = (Date.now() - T0) / 1000;
  const log = await page.evaluate(() => window.__qa.log); const ready = await page.evaluate(() => window.__qa.ready);
  const vpath = await page.video().path(); await ctx.close();
  const dur = Math.min(20, Math.max(10, tEnd - tStart)), ss = Math.max(0, tEnd - dur - 0.3);
  const base = path.join(OUT, `klipp-${name}`);
  if (hasFF) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss.toFixed(2), '-i', vpath, '-t', dur.toFixed(2), '-c:v', 'libvpx', '-b:v', '2M', '-deadline', 'realtime', '-an', base + '.webm']);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss.toFixed(2), '-i', vpath, '-t', dur.toFixed(2), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-an', base + '.mp4']); }
  else fs.copyFileSync(vpath, base + '.webm');
  // kontaktark per etikett
  for (const [label, files] of Object.entries(sheets || {})) { if (!files.length) continue; const outp = path.join(OUT, `ark-${name}-${label}.png`);
    execFileSync('python3', ['-c', `import sys;from PIL import Image,ImageDraw;fs=sys.argv[2:];ims=[Image.open(f) for f in fs];w=sum(i.width for i in ims);h=max(i.height for i in ims)+16;o=Image.new('RGB',(w,h),(20,20,20));x=0
for i in ims:o.paste(i,(x,16));x+=i.width
ImageDraw.Draw(o).text((4,2),sys.argv[1],fill=(255,255,0));o.save(sys.argv[1+0] if False else '${outp}')`, `${name} ${label}`, ...files]); }
  fs.writeFileSync(path.join(OUT, `logg-${name}.json`), JSON.stringify(log));
  SUMMARY.clips[name] = { sec: +dur.toFixed(1), webm: base + '.webm', mp4: hasFF ? base + '.mp4' : null, frames: log.length, errors: errs, paintedReady: ready, sheets: Object.keys(sheets || {}).map((l) => `ark-${name}-${l}.png`) };
  console.log(name, JSON.stringify(SUMMARY.clips[name]));
  return log;
}
const SC = {
  async gange(h) { const S = {}; await h.teleport(330, 800); for (const d of Object.keys(DIRS)) { await h.tag('gange-' + d); await h.aimAt(ang(d)); S[d] = await h.hold(KEYS(d), 1300, ang(d), 'gange-' + d, 4); await h.teleport(330, 800); } return S; },
  async bryst(h) { await h.page.evaluate(() => { window.__qa.fight = true; }); await h.tag('bryst'); const S = { bryst: [] }; let shots = 0, hits = 0; const t0 = Date.now(); const res = [];
    while (shots < 11 && Date.now() - t0 < 40000) { const e = await h.page.evaluate(() => { const B = window.BREACH, w = B.world, p = w.player; const L = (w.enemies || []).filter(e => e.hp > 0).map(e => ({ e, d: Math.hypot(e.x - p.x, e.y - p.y) })).sort((a, b) => a.d - b.d); if (!L.length || L[0].d > 420) return null; const e = L[0].e, q = B.camera.worldToScreen(e.x, e.y), ay = 27 * (B.PROJ?.zScale ?? 0.75) * B.camera.zoom * (B.camera.g || 1); return { sx: q.x, sy: q.y - ay, hp: e.hp, i: w.enemies.indexOf(e), d: L[0].d | 0 }; });
      if (!e) { await h.sleep(200); continue; } await h.page.mouse.move(e.sx, e.sy); await h.sleep(120); const e2 = await h.page.evaluate((i) => { const B = window.BREACH, en = B.world.enemies[i], q = B.camera.worldToScreen(en.x, en.y), ay = 27 * (B.PROJ?.zScale ?? 0.75) * B.camera.zoom * (B.camera.g || 1); return { sx: q.x, sy: q.y - ay, hp: en.hp }; }, e.i); await h.page.mouse.move(e2.sx, e2.sy); await h.page.mouse.down(); await h.sleep(40); await h.page.mouse.up(); shots++; if (shots <= 4) S.bryst.push(await h.snap('bryst-' + shots)); await h.sleep(260);
      const hp = await h.page.evaluate((i) => window.BREACH.world.enemies[i]?.hp ?? 0, e.i); const hit = hp < e2.hp; if (hit) hits++; res.push({ d: e.d, hit }); }
    console.log('BRYST', JSON.stringify({ shots, hits, res })); return S; },
  async bryst2(h) { await h.page.evaluate(() => { window.__qa.fight = true; }); await h.tag('bryst2'); const S = { bryst2: [] }; const t0 = Date.now(); const res = [];
    while (Date.now() - t0 < 30000 && !(await h.page.evaluate(() => (window.BREACH.world.enemies || []).some(e => e.hp > 0)))) await h.sleep(200);
    const offs = [[180, 0], [150, 90], [0, 160], [-150, 90], [-180, 0], [-150, -90], [0, -150], [150, -90], [220, 40], [-220, 40], [120, 140]];
    for (let i = 0; i < offs.length; i++) { const [ox, oy] = offs[i];
      const r = await h.page.evaluate(([ox, oy]) => { const B = window.BREACH, w = B.world, p = w.player; p.x = 560; p.y = 330; p.vx = p.vy = 0; const e = (w.enemies || []).find(e => e.hp > 0); if (!e) return null; clearInterval(window.__pin); window.__pin = setInterval(() => { e.x = 560 + ox; e.y = 330 + oy; e.vx = e.vy = 0; p.x = 560; p.y = 330; }, 5); return { i: w.enemies.indexOf(e) }; }, [ox, oy]);
      if (!r) break; await h.sleep(500); const q = await h.page.evaluate((i) => { const B = window.BREACH, en = B.world.enemies[i], s = B.camera.worldToScreen(en.x, en.y), ay = 27 * (B.PROJ?.zScale ?? 0.75) * B.camera.zoom * (B.camera.g || 1); return { sx: s.x, sy: s.y - ay, hp: en.hp }; }, r.i);
      await h.page.mouse.move(q.sx, q.sy); await h.sleep(250); const hp0 = await h.page.evaluate((i) => window.BREACH.world.enemies[i].hp, r.i); await h.page.mouse.down(); await h.sleep(90); await h.page.mouse.up(); await h.sleep(350);
      if (i < 4) S.bryst2.push(await h.snap('b2-' + i)); const hp1 = await h.page.evaluate((i) => window.BREACH.world.enemies[i]?.hp ?? 0, r.i); res.push({ off: [ox, oy], hit: hp1 < hp0 }); if (hp1 <= 0) await h.page.evaluate((i) => { window.BREACH.world.enemies[i].hp = 0; }, r.i); }
    await h.page.evaluate(() => clearInterval(window.__pin)); console.log('BRYST2', JSON.stringify({ hits: res.filter(x => x.hit).length, n: res.length, res })); return S; },
  async kamp(h) { await h.page.evaluate((wv) => { window.__qa.fight = true; if (wv !== '') { const w = window.BREACH.world; w.modules.levels._debugWave(w, +wv, 0.5); } }, A.wave); await h.tag('kamp'); const S = { kamp: [] }; const t0 = Date.now(); let k = 0; const keys = [['KeyD'], ['KeyS'], ['KeyA'], ['KeyW']];
    while (Date.now() - t0 < +A.sek) { const e = await h.page.evaluate(() => { const B = window.BREACH, w = B.world, p = w.player; const L = (w.enemies || []).filter(e => e.hp > 0).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)); if (!L.length) return null; const q = B.camera.worldToScreen(L[0].x, L[0].y), ay = 27 * (B.PROJ?.zScale ?? 0.75) * B.camera.zoom * (B.camera.g || 1); return { sx: q.x, sy: q.y - ay }; });
      const kk = keys[(k++ >> 3) % 4]; for (const x of kk) await h.page.keyboard.down(x); if (e) { await h.page.mouse.move(e.sx, e.sy); await h.page.mouse.down(); } await h.sleep(200); await h.page.mouse.up(); for (const x of kk) await h.page.keyboard.up(x); if (k % 20 === 0) S.kamp.push(await h.snap('kamp-' + k)); }
    console.log('KAMP', JSON.stringify(await h.page.evaluate(() => ({ seen: window.__qa.seen, hits: window.__qa.hits, offHits: window.__qa.offHits })))); return S; },
  async r2gange(h) { const S = {}, O = [500, 200];
    for (const d of Object.keys(DIRS)) { await h.teleport(...O); await h.tag('gange-' + d); S['g' + d] = await h.hold(KEYS(d), 1300, ang(d), 'gange-' + d, 4); } return S; },
  async r2strafeE(h) { return SC.__st(h, 0, 'E'); }, async r2strafeW(h) { return SC.__st(h, Math.PI, 'W'); },
  async __st(h, fa, fn) { const S = {}, O = [500, 200]; for (const d of Object.keys(DIRS)) { await h.teleport(...O); await h.tag(`strafe${fn}-` + d); S[`s${fn}${d}`] = await h.hold(KEYS(d), 1100, fa, `strafe${fn}-` + d, 3); } return S; },
  async r2salve(h) { const S = { salve: [] }; await h.page.evaluate(() => { window.__mm = []; addEventListener('mousemove', e => window.__mm.push([+performance.now().toFixed(0), e.clientX, e.clientY, e.isTrusted]), true); });
    for (let k = 0; k < 2; k++) { await h.teleport(500, 200); await h.sleep(800); await h.tag('salve' + k + '-W'); await h.hold([], 900, Math.PI, 'x', 0); await h.page.evaluate(() => { window.__mm.push(['STILLE', performance.now()]); }); await h.page.mouse.down(); if (k === 0) { for (let i = 0; i < 4; i++) { await h.sleep(300); S.salve.push(await h.snap(`salve${k}-${i}`)); } } else { await h.sleep(1300); } await h.page.mouse.up(); await h.sleep(500); }
    console.log('MM', JSON.stringify(await h.page.evaluate(() => { const i = window.__mm.findIndex(x => x[0] === 'STILLE'); return window.__mm.slice(Math.max(0, i - 2)); })).slice(0, 3000)); return S; },
  async r2rest(h) { const S = {}, O = [500, 200]; await h.teleport(...O); await h.tag('salve-W'); await h.hold([], 700, Math.PI, 'x', 0); await h.page.mouse.down(); const sv = []; for (let i = 0; i < 4; i++) { await h.sleep(250); sv.push(await h.snap('salve-' + i)); } await h.page.mouse.up(); S.salve = sv;
    await h.teleport(332, 800); await h.tag('vegg-E'); S.veggE = await h.hold(['KeyD'], 1200, 0, 'vegg-E', 3);
    await h.teleport(332, 800); await h.tag('vegg-W'); S.veggW = await h.hold(['KeyA'], 1200, Math.PI, 'vegg-W', 3);
    await h.teleport(332, 800); await h.tag('skli-NW'); S.skli = await h.hold(['KeyA', 'KeyW'], 1200, -2.36, 'skli-NW', 3);
    return S; },
  async strafe(h) { const S = {}; await h.teleport(330, 800); for (const d of ['N', 'S', 'W', 'NW', 'SW', 'NE', 'SE', 'E']) { await h.tag('strafe-' + d); await h.aimAt(0); if (d === 'W' || d === 'SW') await h.page.mouse.down(); S[d] = await h.hold(KEYS(d), 1200, 0, 'strafe-' + d, 3); await h.page.mouse.up(); await h.teleport(330, 800); } await h.tag('skyt-V'); await h.hold([], 600, Math.PI, 'x', 0); await h.page.mouse.down(); await h.sleep(120); S['skyt-W'] = [await h.snap('skytW0')]; await h.sleep(300); S['skyt-W'].push(await h.snap('skytW1')); await h.page.mouse.up(); await h.tag('skyt-E'); await h.hold([], 600, 0, 'x', 0); await h.page.mouse.down(); await h.sleep(150); S['skyt-W'].push(await h.snap('skytE0')); await h.page.mouse.up(); return S; },
  async rulling(h) { const S = {}; await h.teleport(330, 800); for (const d of Object.keys(DIRS)) { await h.tag('rull-' + d); await h.aimAt(ang(d)); for (const k of KEYS(d)) await h.page.keyboard.down(k); await h.sleep(120); await h.page.keyboard.press('Space'); const f = []; for (let i = 0; i < 4; i++) { await h.sleep(110); f.push(await h.snap(`rull-${d}-${i}`)); } for (const k of KEYS(d)) await h.page.keyboard.up(k); S[d] = f; await h.sleep(350); await h.teleport(330, 800); await h.sleep(150); } return S; },
  async dekning(h) { const S = {}; await h.tag('lav'); await h.teleport(144, 770); await h.aimAt(-Math.PI / 2); S.lav = await h.hold(['KeyW'], 600, -Math.PI / 2, 'lav-inn', 1); await h.page.keyboard.press('KeyE'); await h.sleep(900); S.lav.push(await h.snap('lav-i')); await h.page.mouse.down(); await h.sleep(500); S.lav.push(await h.snap('lav-skyt')); await h.page.mouse.up(); await h.page.keyboard.press('KeyE'); S.lav.push(...await h.hold(['KeyS'], 700, 0, 'lav-ut', 1));
    await h.tag('hoy'); await h.teleport(262, 610); await h.aimAt(0); S.hoy = await h.hold(['KeyD'], 600, 0, 'hoy-inn', 1); await h.page.keyboard.press('KeyE'); await h.sleep(900); S.hoy.push(await h.snap('hoy-i')); S.hoy.push(...await h.hold(['KeyS'], 900, 0, 'hoy-gli', 1)); await h.page.mouse.down(); await h.sleep(500); S.hoy.push(await h.snap('hoy-skyt')); await h.page.mouse.up(); await h.page.keyboard.press('KeyE'); S.hoy.push(...await h.hold(['KeyA'], 800, 0, 'hoy-ut', 1)); return S; },
};
const dod = (dirs) => async (h) => { const S = {}; for (const d of dirs) { await h.tag('dod-' + d); await h.teleport(330, 800); await h.aimAt(ang(d)); for (const k of KEYS(d)) await h.page.keyboard.down(k); await h.sleep(250);
  await h.page.evaluate(async () => { const w = window.BREACH.world, p = w.player, cb = await import('/src/core/combat.js'); window.__qa.god = false; p.invuln = false; cb.damage(p, p.hp + 50, { x: p.x + 100, y: p.y, team: 'enemy', owner: { x: p.x + 100, y: p.y, team: 'enemy' } }, w); });
  for (const k of KEYS(d)) await h.page.keyboard.up(k); const f = []; for (let i = 0; i < 4; i++) { await h.sleep(300); f.push(await h.snap(`dod-${d}-${i}`)); } S[d] = f;
  for (let i = 0; i < 30; i++) { const s = await h.phase(); if (s.phase === 'cutscene') { await h.page.keyboard.press('Escape'); await h.sleep(400); continue; } if (s.paused) { await h.page.keyboard.press('Escape'); await h.sleep(300); } const alive = await h.page.evaluate(() => !window.BREACH.world.player.dead && window.BREACH.world.player.hp > 0); if (alive && s.phase !== 'dead') break; await h.sleep(250); }
  await h.page.evaluate(() => { window.__qa.god = true; }); await h.sleep(300); } return S; };
SC.dod1 = dod(['E', 'SE', 'S']); SC.dod2 = dod(['SW', 'W', 'NW']); SC.dod3 = dod(['N', 'NE']);
for (const n of A.scen.split(',')) { try { await scenario(n, SC[n]); } catch (e) { console.log('FEIL', n, String(e)); SUMMARY.clips[n] = { error: String(e) }; } }
fs.writeFileSync(path.join(OUT, 'oppsummering.json'), JSON.stringify(SUMMARY, null, 1)); console.log(JSON.stringify(SUMMARY.mtimes));
await browser.close(); srv.kill();
