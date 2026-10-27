// Opptak av et ekte spillklipp (v1.7): meny → intro (stemmer, venter på hver replikk) → kamp i Kessa Yard (ny musikk).
// Lyd: MediaRecorder på _tap() (ferdig miks). Bilde: skjermbilder ~8 fps med tidsstempel. Kjør fra /workspace/breach med
//   python3 -m http.server 8765 i game/, CHROME=… node game/src/audio/tools/voice/clip.cjs <utmappe> [kampsekunder]
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || '/tmp/clip'; const fightS = +(process.argv[3] || 30);
fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8765/index.html?menu=1'); await page.waitForSelector('[data-ui="main-menu"] .bm-btn'); await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);
  await page.evaluate(async () => {
    const A = window.__A = await import('/src/audio/index.js'); window.__C = await import('/src/core/combat.js');
    const w = window.BREACH.world; window.__ev = []; window.__T0 = performance.now();
    for (const t of ['cutsceneStart', 'cutsceneLine', 'cutsceneEnd', 'waveStart', 'waveEnd', 'shot']) w.events.on(t, (p) => window.__ev.push({ s: (performance.now() - window.__T0) / 1000, t, id: p?.id, i: p?.index }));
    const rec = new MediaRecorder(A._tap(), { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
    window.__chunks = []; rec.ondataavailable = (e) => window.__chunks.push(e.data); rec.start(500); window.__rec = rec;
    window.__recT0 = performance.now();
    window.__log = []; setInterval(() => { const m = A._meter(true), st = A.getState(); window.__log.push({ s: (performance.now() - window.__T0) / 1000, rms: m?.rms, pk: m?.peak, i: st.intensity, cs: st.cutscene, sp: st.voiceState?.speaking }); }, 100);
  });
  const recT0 = await page.evaluate(() => window.__recT0 - window.__T0);
  const frames = []; let shooting = true;
  const grab = async () => { const s = await page.evaluate(() => (performance.now() - window.__recT0) / 1000); const f = path.join(out, 'frames', `${String(frames.length).padStart(5, '0')}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 70 }); frames.push({ f, s }); };
  let grabbing = true; (async () => { while (grabbing) { await grab(); await page.waitForTimeout(60); } })();
  await page.waitForTimeout(1500);
  await page.click('.bm-btn[data-id="play"]');
  const st = () => page.evaluate(() => ({ end: window.__ev.some((e) => e.t === 'cutsceneEnd'), sp: window.__A.getState().voiceState?.speaking }));
  // intro: Enter når stemmen er ferdig (+0,6 s)
  let quiet = 0;
  for (let i = 0; i < 400; i++) { const s = await st(); if (s.end) break; quiet = s.sp ? 0 : quiet + 1; if (quiet >= 4) { await page.keyboard.press('Enter'); quiet = -6; } await page.waitForTimeout(150); }
  await page.evaluate(() => { const w = window.BREACH.world, P = w.player; setInterval(() => { if (P) P.hp = P.maxHp; }, 100);
    window.__kill = setInterval(() => { if (w.paused) return; const e = (w.enemies || []).find((e) => e && !e.dead && (e.spawnT ?? 1) > 0.3); if (e) window.__C.damage(e, 9999, P, w, { weapon: 'rifle' }); }, 2500); });
  const t1 = Date.now();
  for (let i = 0; Date.now() - t1 < fightS * 1000; i++) {
    await page.mouse.move(640 + 220 * Math.cos(i * 0.7), 360 + 160 * Math.sin(i * 0.7)); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up(); await page.waitForTimeout(250);
    if (i % 6 === 0) await page.keyboard.down('KeyD'); if (i % 6 === 3) { await page.keyboard.up('KeyD'); }
  }
  grabbing = false; await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'skjerm-kamp.png') });
  const b64 = await page.evaluate(() => new Promise((res) => { window.__rec.onstop = async () => { const b = new Blob(window.__chunks, { type: 'audio/webm' }); const ab = await b.arrayBuffer(); let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); res(btoa(s)); }; window.__rec.stop(); }));
  fs.writeFileSync(path.join(out, 'lyd.webm'), Buffer.from(b64, 'base64'));
  // concat-liste for ffmpeg (varighet per bilde fra tidsstempler)
  let list = ''; for (let i = 0; i < frames.length; i++) { const d = i + 1 < frames.length ? frames[i + 1].s - frames[i].s : 0.1; list += `file '${frames[i].f}'\nduration ${Math.max(0.01, d).toFixed(3)}\n`; }
  list += `file '${frames[frames.length - 1].f}'\n`; fs.writeFileSync(path.join(out, 'frames.txt'), list);
  const r = await page.evaluate(() => ({ ev: window.__ev.filter((e) => e.t !== 'shot'), shots: window.__ev.filter((e) => e.t === 'shot').length, log: window.__log, st: window.__A.getState() }));
  fs.writeFileSync(path.join(out, 'clip.json'), JSON.stringify({ errors, recT0, firstFrame: frames[0]?.s, ...r }));
  console.log(JSON.stringify({ errors, frames: frames.length, shots: r.shots, voice: r.st.voiceState, played: r.st.played._voice }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
