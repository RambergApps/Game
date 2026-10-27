// Probe (full runde 26.10): skaderetning, Warden (farge, zoom 3, bake-utsettelser), lyd (tap på destination: topp/RMS/clipping + opptak).
// Bruk: DISPLAY=:21 node tests/probe-full-ekstra.mjs [--size 1280x720]
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import net from 'node:net'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = path.join(REPO, 'shots/test/full-2026-10-26'); fs.mkdirSync(OUT, { recursive: true });
let size = '1280x720'; for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--size') size = process.argv[++i]; const [W, H] = size.split('x').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(REPO, 'game'), stdio: 'ignore' }); await sleep(800);
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: [`--window-size=${W},${H + 90}`, '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => {
  const T = window.__tap = { peak: 0, clip: 0, samples: 0, rmsMax: -200, log: [], chunks: [] }; const orig = AudioNode.prototype.connect; const taps = new WeakMap();
  AudioNode.prototype.connect = function (dst, ...a) {
    const r = orig.call(this, dst, ...a);
    try { if (dst instanceof AudioDestinationNode) { const ac = this.context; let t = taps.get(ac); if (!t) { const an = ac.createAnalyser(); an.fftSize = 2048; const md = ac.createMediaStreamDestination(); t = { an, md }; taps.set(ac, t); T.ac = ac; T.an = an; T.md = md;
          const buf = new Float32Array(2048); setInterval(() => { an.getFloatTimeDomainData(buf); let pk = 0, e = 0; for (const v of buf) { const x = Math.abs(v); if (x > pk) pk = x; if (x >= 0.999) T.clip++; e += v * v; } T.samples++; T.peak = Math.max(T.peak, pk); const db = 10 * Math.log10(e / buf.length + 1e-12); T.rmsMax = Math.max(T.rmsMax, db); T.log.push([+(performance.now() / 1000).toFixed(1), +pk.toFixed(3), +db.toFixed(1), T.tag || '']); }, 100); }
        orig.call(this, t.an); orig.call(this, t.md); } } catch (e) { T.err = String(e); }
    return r; };
});
const page = await ctx.newPage(); const errs = []; const http404 = [];
page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('response', (r) => { if (r.status() >= 400) http404.push(`${r.status()} ${r.url()}`); });
const R = {};
await page.goto(`http://127.0.0.1:${port}/index.html?menu=1`); await page.waitForFunction(() => window.BREACH?.world?.modules?.levels); await sleep(1500);
await page.mouse.click(W / 2, H - 20); // brukergest → lyd låses opp
await page.evaluate(() => { window.__tap.tag = 'meny'; if (window.__tap.md) { const rec = new MediaRecorder(window.__tap.md.stream); window.__rec = rec; rec.ondataavailable = (e) => window.__tap.chunks.push(e.data); rec.start(1000); } });
await sleep(4000); await page.screenshot({ path: path.join(OUT, 'x-meny.png') });
const playBtn = await page.$('.bm-btn[data-id="play"]'); await page.evaluate(() => { window.__tap.tag = 'intro'; }); if (playBtn) await playBtn.click();
await sleep(7000); await page.screenshot({ path: path.join(OUT, 'x-intro.png') });
const st = () => page.evaluate(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase);
for (let i = 0; i < 12 && (await st()) === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sleep(600); }
await sleep(1500);
// ---- skaderetning
await page.evaluate(() => { window.__dd = []; window.BREACH.world.events.on('damageDirection', (p) => window.__dd.push({ deg: Math.round(p.angle * 180 / Math.PI), amount: p.amount, sx: Math.round(p.sourceX), sy: Math.round(p.sourceY) })); });
const hit = (dx, dy, src = 'owner') => page.evaluate(async ([dx, dy, src]) => { const w = window.BREACH.world, p = w.player, cb = await import('/src/core/combat.js'); p.hp = p.maxHp; p.invuln = false;
  const s = src === 'env' ? null : src === 'envobj' ? { kind: 'fire' } : { owner: { x: p.x + dx, y: p.y + dy, team: 'enemy' }, team: 'enemy' }; cb.damage(p, 8, s, w); }, [dx, dy, src]);
await page.evaluate(() => { window.__tap.tag = 'treff'; });
await hit(300, 0); await sleep(120); await page.screenshot({ path: path.join(OUT, 'x-skaderetning-ost.png') });
await hit(0, 300); await sleep(120); await hit(-200, -200); await sleep(120); await page.screenshot({ path: path.join(OUT, 'x-skaderetning-sor-nv.png') });
await sleep(1200); await hit(2400, 0); await sleep(150); await page.screenshot({ path: path.join(OUT, 'x-skaderetning-utenfor-skjerm.png') });
await sleep(1200); const nEnv0 = await page.evaluate(() => window.__dd.length); await hit(0, 0, 'env'); await hit(0, 0, 'envobj'); await sleep(150); await page.screenshot({ path: path.join(OUT, 'x-skaderetning-miljo.png') });
const nEnv1 = await page.evaluate(() => window.__dd.length);
await sleep(1200); await page.evaluate(async () => { const S = await import('/src/ui/settings.js'); S.setSetting('damageIndicator', false, { save: false }); });
await hit(300, 0); await sleep(120); await page.screenshot({ path: path.join(OUT, 'x-skaderetning-av.png') });
await page.evaluate(async () => { const S = await import('/src/ui/settings.js'); S.setSetting('damageIndicator', true, { save: false }); });
R.damageDirection = { events: await page.evaluate(() => window.__dd), envEventsAdded: nEnv1 - nEnv0, settingLabel: await page.evaluate(async () => (await import('/src/ui/settingsScreen.js')).toString?.() ? 'Damage direction (settingsScreen.js:19)' : null).catch(() => null) };
// ---- Warden: farge (snitt rundt fotpunktet), zoom 3 første bilder, bake-utsettelser
const wardenColor = () => page.evaluate(() => { const B = window.BREACH, p = B.world.player, c = document.getElementById('game') || document.querySelector('canvas'), s = B.camera.worldToScreen(p.x, p.y - 22); const g = c.getContext('2d'); try { const d = g.getImageData(Math.round(s.x - 10), Math.round(s.y - 10), 20, 20).data; let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } return { r: Math.round(r / n), g: Math.round(gg / n), b: Math.round(b / n) }; } catch (e) { return String(e); } });
R.wardenColor = await wardenColor();
await page.evaluate(() => { const c = window.BREACH.camera; window.__z = { frames: [], z0: c.zoom }; });
const bakeBefore = await page.evaluate(async () => (await import('/src/shared/rig/faceted/bake.js')).cacheReport());
R.zoom3 = await page.evaluate(async () => { const c = window.BREACH.camera; const fr = []; let last = performance.now(); c.zoom = 3; await new Promise((res) => { let n = 0; const f = (t) => { fr.push(+(t - last).toFixed(1)); last = t; if (++n < 40) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); return fr; });
await page.screenshot({ path: path.join(OUT, 'x-warden-zoom3.png') });
const bakeZ3 = await page.evaluate(async () => (await import('/src/shared/rig/faceted/bake.js')).cacheReport());
R.zoom3second = await page.evaluate(async () => { const c = window.BREACH.camera; c.zoom = 1.5; await new Promise((r) => setTimeout(r, 300)); const fr = []; let last = performance.now(); c.zoom = 3; await new Promise((res) => { let n = 0; const f = (t) => { fr.push(+(t - last).toFixed(1)); last = t; if (++n < 20) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); c.zoom = 1.5; return fr; });
// bevegelse: gå i alle retninger, tell utsatte baker (bein «fryser»)
await page.evaluate(() => { window.__tap.tag = 'gange+skudd'; });
const d0 = await page.evaluate(async () => (await import('/src/shared/rig/faceted/bake.js')).cacheReport().reduce((n, c) => n + c.deferred, 0));
for (const k of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) { await page.keyboard.down(k); await sleep(700); if (k === 'KeyD') await page.screenshot({ path: path.join(OUT, 'x-warden-gange.png') }); await page.keyboard.up(k); }
await page.mouse.move(W / 2 + 200, H / 2 - 100); await page.mouse.down(); await sleep(1500); await page.mouse.up();
const d1 = await page.evaluate(async () => (await import('/src/shared/rig/faceted/bake.js')).cacheReport());
R.bake = { before: bakeBefore, afterZoom3: bakeZ3, after: d1, deferredDuringWalk: d1.reduce((n, c) => n + c.deferred, 0) - d0, bytesTotal: d1.reduce((n, c) => n + c.bytes, 0) };
// ---- lyd: API
R.audio = await page.evaluate(async () => { const a = await import('/src/audio/index.js'); const v0 = a.getVolumes(); a.setSfxVolume(0.5); const v1 = a.getVolumes(); a.setSfxVolume(v0.sfx); const m = a.mute(true); a.mute(false); const names = a.SOUND_NAMES; const st = a.getState();
  const before = window.__tap.peak; window.__tap.tag = 'overlapp'; for (let i = 0; i < 12; i++) a.play('explosion', {}); for (let i = 0; i < 20; i++) a.play(names.find((n) => /rifle|assault|shot/.test(n)) || names[0], {});
  await new Promise((r) => setTimeout(r, 1500)); return { v0, v1, muteOk: m === true, nSounds: names.length, names, state: st, meterDb: a._meter?.(), peakBeforeOverlap: before }; });
await page.evaluate(() => new Promise((r) => { if (!window.__rec) return r(); window.__rec.onstop = r; window.__rec.stop(); }));
const b64 = await page.evaluate(async () => { const T = window.__tap; if (!T.chunks.length) return null; const blob = new Blob(T.chunks, { type: 'audio/webm' }); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768)); return btoa(s); });
if (b64) fs.writeFileSync(path.join(OUT, 'lyd-opptak.webm'), Buffer.from(b64, 'base64'));
R.tap = await page.evaluate(() => { const T = window.__tap; const by = {}; for (const [t, pk, db, tag] of T.log) { const o = by[tag] = by[tag] || { n: 0, peak: 0, rmsMax: -200, silent: 0 }; o.n++; o.peak = Math.max(o.peak, pk); o.rmsMax = Math.max(o.rmsMax, db); if (pk < 0.001) o.silent++; } return { peak: T.peak, clipSamples: T.clip, windows: T.samples, byTag: by, err: T.err || null, recorded: T.chunks.length }; });
R.errs = errs; R.http = http404;
fs.writeFileSync(path.join(REPO, 'tests/results/full-2026-10-26/ekstra.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify({ dd: R.damageDirection, color: R.wardenColor, z3: R.zoom3.slice(0, 8), z3b: R.zoom3second.slice(0, 6), bake: { deferredWalk: R.bake.deferredDuringWalk, bytes: R.bake.bytesTotal, caches: R.bake.after.map((c) => [c.name, c.count, Math.round(c.bytes / 1048576 * 10) / 10 + 'MB', 'deferred', c.deferred, 'maxBakeMs', +c.maxBakeMs.toFixed(1)]) }, audio: { ...R.audio, names: undefined }, tap: R.tap, errs, http: http404 }, null, 1));
await browser.close(); srv.kill();
