// Hakkmåling (kald start): lasting/meny → intro (spilles ferdig) → overgang til spill → slutt. 
// node hakk.mjs URL TAG [--cpu 4] [--net 10] [--dpr 1]   (net = Mbit/s, 0 = ingen struping)
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const [URL0, TAG] = process.argv.slice(2); const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const KORN = process.argv.includes('--uten-korn'); const SKJUL = process.argv.includes('--uten-spillrender'); const CPU = arg('--cpu', 1), NET = arg('--net', 0), DPR = arg('--dpr', 1);
const O = `/workspace/breach/shots/test/qa/samlet-2229/${TAG}`; fs.mkdirSync(O, { recursive: true }); const sl = (ms) => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: DPR, recordVideo: { dir: O + '/video', size: { width: 1280, height: 720 } } });
await ctx.addInitScript(() => {
  const P = window.__perf = { fr: [], lt: [], dec: [], marks: [] }; performance.setResourceTimingBufferSize(5000);
  P.vis = []; let pv = ''; let last = 0; const f = (t) => { const ld = document.querySelector('[data-ui=loading]'), cs = document.querySelector('canvas.breach-cutscene'), mn = document.querySelector('.bm-root,[data-ui=menu],.menu-root'); const k = (ld ? 'L' + (ld.classList.contains('bl-in') ? 1 : 0) : '-') + (cs ? 'C' + (getComputedStyle(cs).opacity) : '-'); if (k !== pv) { P.vis.push([+t.toFixed(1), k]); pv = k; } if (last) P.fr.push([+t.toFixed(1), +(t - last).toFixed(1)]); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.lt.push([+e.startTime.toFixed(1), +e.duration.toFixed(1)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const lg = (k, t0, x) => P.dec.push([k, +t0.toFixed(1), +(performance.now() - t0).toFixed(1), String(x || '').slice(-70)]);
  const AC = window.AudioContext || window.webkitAudioContext; if (AC) { const o = AC.prototype.decodeAudioData; AC.prototype.decodeAudioData = function (ab, ...r) { const t0 = performance.now(); const sz = ab?.byteLength; const p = o.call(this, ab, ...r); Promise.resolve(p).then(() => lg('decodeAudioData', t0, sz + ' B'), () => {}); return p; }; }
  const od = HTMLImageElement.prototype.decode; HTMLImageElement.prototype.decode = function () { const t0 = performance.now(), s = this.src; return od.call(this).then((v) => { lg('img.decode', t0, s); return v; }); };
  const ds = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { ...ds, set(v) { lg('img.src', performance.now(), v); return ds.set.call(this, v); } });
  const ocib = window.createImageBitmap; window.createImageBitmap = function (...a) { const t0 = performance.now(); return ocib.apply(this, a).then((v) => { lg('createImageBitmap', t0, ''); return v; }); };
  const OA = window.Audio; window.Audio = function (...a) { lg('new Audio', performance.now(), a[0]); return new OA(...a); };
});
if (SKJUL) await ctx.addInitScript(() => { // KUN TEST: hopp over tegning på #game mens en mellomsekvens-canvas finnes (bevis for årsak)
  let on = false; new MutationObserver(() => { on = !!document.querySelector('canvas.breach-cutscene'); }).observe(document, { childList: true, subtree: true });
  const C = CanvasRenderingContext2D.prototype; for (const k of ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'clearRect']) { const o = C[k]; C[k] = function (...a) { if (on && this.canvas.id === 'game') return; return o.apply(this, a); }; } });
if (KORN) await ctx.addInitScript(() => { // KUN TEST: dropp 'overlay'-kornlaget på mellomsekvens-canvas (bevis for årsak)
  const C = CanvasRenderingContext2D.prototype, d = Object.getOwnPropertyDescriptor(C, 'globalCompositeOperation'), fr = C.fillRect;
  Object.defineProperty(C, 'globalCompositeOperation', { ...d, set(v) { if (v === 'overlay' && this.canvas.className === 'breach-cutscene') { this.__skip = true; return; } this.__skip = false; d.set.call(this, v); } });
  C.fillRect = function (...a) { if (this.__skip) return; return fr.apply(this, a); }; });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); const errs = [];
page.on('pageerror', e => errs.push(String(e))); page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); }); page.on('requestfailed', q => errs.push('FAIL ' + q.url())); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await cdp.send('Network.enable'); await cdp.send('Network.clearBrowserCache'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
if (NET) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: NET * 125000, uploadThroughput: NET * 62500 });
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
const TT0 = Date.now(); const T0 = () => (Date.now() - TT0) / 1000; const ev = (f, a) => page.evaluate(f, a); const mark = (n) => ev((n) => window.__perf.marks.push([n, +performance.now().toFixed(1)]), n);
await page.goto(URL0, { waitUntil: 'commit' }); await cdp.send('Profiler.start'); const pn0 = await ev(() => performance.now());
await page.waitForFunction(() => window.BREACH?.world?.modules?.levels, null, { timeout: 180000, polling: 200 });
await page.waitForLoadState('load', { timeout: 180000 }).catch(() => {}); await sl(1500); await mark('meny'); await page.screenshot({ path: O + '/meny.png' });
// etter første lasting: cache på igjen (spillet selv skal kunne cache), men den er tom
await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
const ph = () => ev(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase);
await mark('introKlikk'); await page.mouse.click(640, 690);
let cs = false; for (let i = 0; i < 100 && !cs; i++) { await sl(100); cs = await ev(() => !!document.querySelector('canvas.breach-cutscene')); } await mark('introSynlig');
for (let i = 0; i < 180; i++) { await sl(500); if (i === 20) await page.screenshot({ path: O + '/intro.png' }); if (!(await ev(() => !!document.querySelector('canvas.breach-cutscene')))) break; }
let introSkip = false; if (await ev(() => !!document.querySelector('canvas.breach-cutscene'))) { introSkip = true; await page.keyboard.press('Escape'); await sl(800); }
await mark('introSlutt'); await sl(6000); await page.screenshot({ path: O + '/spill.png' }); await mark('spill6s');
for (let i = 0; i < 4 && (await ev(() => window.BREACH.world.paused)); i++) { await page.keyboard.press('Escape'); await sl(500); }
await ev(() => { window.BREACH.world.player.hp = 1e6; }); await sl(1000);
const VAP = {}; if (process.argv.includes('--vapen')) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ev(() => { const w = window.BREACH.world; window.__sh = 0; w.events.on('shot', (p) => { if (p.team === 'player') window.__sh++; }); setInterval(() => { w.player.hp = w.player.maxHp; }, 200); });
  const cnt = () => ev(() => window.__sh), fill = () => ev(() => { const w = window.BREACH.world; w.modules.weapons.refill(w, w.player); });
  for (const [slot, id, fi] of [[2, 'S-12', 0.8], [3, 'M-4', 0.95], [1, 'AR-9', 0.1]]) {
    await page.keyboard.press('Digit' + slot); await sl(900); await page.mouse.move(900, 300); const r = VAP[id] = {};
    for (const [nm, hold, gap] of [['enkelt-0ms', 0, 0], ['enkelt-30ms', 30, 0], ['enkelt-70ms', 70, 0]]) { await fill(); await sl(1200); const a = await cnt(); await page.mouse.down(); if (hold) await sl(hold); await page.mouse.up(); await sl(1200); r[nm] = (await cnt()) - a; }
    await fill(); await sl(1200); let a = await cnt(); const per = [];
    for (let i = 0; i < 10; i++) { const b0 = await cnt(); await page.mouse.down(); await sl(40); await page.mouse.up(); await sl(Math.max(150, fi * 1000 + 120)); per.push((await cnt()) - b0); if (i % 3 === 2) await fill(); }
    r['10-trykk-per'] = per; r['10-trykk-sum'] = (await cnt()) - a;
    await fill(); await sl(1200); a = await cnt(); await page.mouse.down(); await sl(2000); await page.mouse.up(); await sl(500); r['hold-2s'] = (await cnt()) - a; }
  // kort runde 1-1 i bevegelse (klippes fra video)
  VAP.rundeStart = T0(); await page.keyboard.press('Digit1');
  for (let i = 0; i < 36; i++) { const tg = await ev(() => { const w = window.BREACH.world, p = w.player, cam = window.BREACH.camera; let b = null, bd = 1e9; for (const e of w.enemies || []) { if (e.dead || e.hp <= 0) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; b = e; } } if (!b) return null; const q = cam.worldToScreen(b.x, b.y - 20.25); return q; });
    if (tg) { await page.mouse.move(Math.max(5, Math.min(1275, tg.x)), Math.max(5, Math.min(715, tg.y))); await page.mouse.down(); } const k = ['KeyW', 'KeyA', 'KeyS', 'KeyD'][(i >> 3) % 4]; await page.keyboard.down(k); await sl(500); await page.keyboard.up(k); await page.mouse.up(); }
  VAP.rundeSlutt = T0(); VAP.wave = await ev(() => window.BREACH.world.level?.waveId); await page.screenshot({ path: O + '/runde.png' });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
await mark('sluttStart'); await ev(() => { import('./src/story/index.js').then(m => m.showCutscene('ending', { world: window.BREACH.world }).then(() => { window.__endDone = 1; })); });
for (let i = 0; i < 300; i++) { await sl(500); if (i === 30) await page.screenshot({ path: O + '/slutt.png' }); if (await ev(() => window.__endDone)) break; }
await mark('sluttSlutt'); const endDone = await ev(() => !!window.__endDone);
const prof = (await cdp.send('Profiler.stop')).profile;
const P = await ev(() => ({ ...window.__perf, res: performance.getEntriesByType('resource').map(r => [r.name, +r.startTime.toFixed(1), +r.responseEnd.toFixed(1), r.transferSize, r.encodedBodySize, r.decodedBodySize, r.initiatorType]), dpr: devicePixelRatio, nav: performance.getEntriesByType('navigation')[0]?.toJSON() }));
fs.writeFileSync(O + '/profil.cpuprofile', JSON.stringify(prof));
await mark('slutt'); fs.writeFileSync(O + '/raa.json', JSON.stringify({ VAP, wallVideo0: TT0, URL0, TAG, CPU, NET, DPR, pn0, introSkip, endDone, errs, ...P }));
await ctx.close(); await b.close(); console.log('FERDIG', TAG, 'errs', errs.length, 'introSkip', introSkip, 'endDone', endDone);
