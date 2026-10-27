// Røyktest av Pages-bygget (e2ddb33): intro, én runde brett 1 (bølge 1→2, assist), slutt med ending-03b. node roeyk.mjs
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire('/workspace/breach/tests/x.mjs'); const { chromium } = require('playwright-core');
const URL0 = 'https://rambergapps.github.io/Game/game/index.html?view=34', O = '/workspace/breach/shots/test/qa/pages-1907'; const sl = (ms) => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: O + '/video', size: { width: 1280, height: 720 } } });
const page = await ctx.newPage(); const R = { cerr: [], perr: [], bad: [], failed: [], audio: [], img: [], steps: {} };
page.on('pageerror', e => R.perr.push(String(e))); page.on('console', m => { if (m.type() === 'error') R.cerr.push(m.text()); });
page.on('response', r => { const u = r.url(), s = r.status(); if (s >= 400) R.bad.push(s + ' ' + u); if (/\.(ogg|mp3|wav)(\?|$)/.test(u)) R.audio.push(s + ' ' + u); if (/\.(webp|png)(\?|$)/.test(u)) R.img.push(s + ' ' + u); });
page.on('requestfailed', q => R.failed.push((q.failure()?.errorText || '?') + ' ' + q.url()));
const ev = (f, a) => page.evaluate(f, a); const ph = () => ev(() => window.BREACH.world.modules.levels._debug(window.BREACH.world).phase);
const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(1);
await page.goto(URL0); await page.waitForFunction(() => window.BREACH?.world?.modules?.levels, null, { timeout: 30000 }); await sl(1500);
await page.screenshot({ path: O + '/01-meny.png' }); await page.mouse.click(640, 690); await sl(2000);
R.steps.introPhase = await ph(); R.steps.introStart = T();
for (let i = 0; i < 12; i++) { await sl(1500); if (i === 3) await page.screenshot({ path: O + '/02-intro.png' }); }   // ~18 s intro med stemmer
await page.screenshot({ path: O + '/03-intro-sent.png' });
for (let i = 0; i < 20 && (await ph()) === 'cutscene'; i++) { await page.keyboard.press('Escape'); await sl(600); }
for (let i = 0; i < 4 && (await ev(() => window.BREACH.world.paused)); i++) { await page.keyboard.press('Escape'); await sl(700); }
R.steps.afterIntro = { phase: await ph(), paused: await ev(() => !!window.BREACH.world.paused), t: T() };
// assist: Warden udødelig, fiender svake; boten sikter på nærmeste og skyter, går litt
await ev(() => { const w = window.BREACH.world; setInterval(() => { w.player.hp = w.player.maxHp; for (const e of w.enemies || []) if (!e.dead && e.hp > 3) e.hp = 3; }, 100);
  const F = window.__fps = []; let n = 0, last = performance.now(); const f = (t) => { n++; if (t - last >= 1000) { F.push(+(n * 1000 / (t - last)).toFixed(1)); n = 0; last = t; } requestAnimationFrame(f); }; requestAnimationFrame(f);
  window.__waves = []; w.events.on('waveStart', (p) => window.__waves.push([+w.time.toFixed(1), p.id])); });
R.steps.roundStart = T(); let shot = 0, keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
for (let i = 0; i < 240; i++) { // maks ~120 s
  const tg = await ev(() => { const w = window.BREACH.world, p = w.player, cam = window.BREACH.camera; let best = null, bd = 1e9; for (const e of w.enemies || []) { if (e.dead || e.hp <= 0) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } } if (!best) return null; const q = cam.worldToScreen(best.x, best.y - 20.25); return { x: q.x, y: q.y }; });
  if (tg) { await page.mouse.move(Math.max(5, Math.min(1275, tg.x)), Math.max(5, Math.min(715, tg.y))); await page.mouse.down(); }
  const k = keys[(i >> 3) % 4]; await page.keyboard.down(k); await sl(500); await page.keyboard.up(k); if (tg) await page.mouse.up();
  if (i === 20) await page.screenshot({ path: O + '/04-kamp.png' });
  const wv = await ev(() => window.__waves); if (wv.length >= 2 && !R.steps.w2) { R.steps.w2 = T(); await page.screenshot({ path: O + '/05-bolge2.png' }); }
  if (R.steps.w2 && (Date.now() - t0) / 1000 - +R.steps.w2 > 12) break;
}
R.steps.waves = await ev(() => window.__waves); R.steps.roundEnd = T(); R.fps = await ev(() => window.__fps.slice(2));
// slutt via story/index.js (samme snarvei som samlet-1735/credits.mjs)
R.steps.endStart = T();
await ev(() => { import('./src/story/index.js').then(m => { m.showCutscene('ending', { world: window.BREACH.world }).then(() => { window.__endDone = 1; }); }); });
let k3 = 0; for (let i = 0; i < 150; i++) { await sl(1000); if (i % 3 === 0) await page.screenshot({ path: `${O}/06-slutt-${String(k3++).padStart(2, '0')}.png` });
  if (await ev(() => window.__endDone)) break; if (i % 5 === 4) await page.mouse.click(640, 400); }
R.steps.endDone = await ev(() => !!window.__endDone); R.steps.endEnd = T(); await page.screenshot({ path: O + '/07-etter-slutt.png' });
fs.writeFileSync(O + '/resultat.json', JSON.stringify(R, null, 1)); await ctx.close(); await b.close(); console.log('FERDIG');
