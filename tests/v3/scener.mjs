// Breach Test – v3-skråvinkel: identiske, deterministiske scener i index.html?view=34 og ?view=top.
// Løkka stoppes og stegvis kjøres (loop.step) med låst kamera og mus, så bildene kan sammenlignes direkte.
// Bruk: node tests/v3/scener.mjs   (krever server på V3_BASE, standard http://127.0.0.1:8000 i game/)
import fs from 'node:fs';
import { launch, open, startIndex, sleep, OUT } from './lib.mjs';
fs.mkdirSync(OUT + '/raw', { recursive: true });
const RES = { views: {} };

async function installStage(page) {
  await page.evaluate(() => {
    const B = window.BREACH, w = B.world, cam = B.camera, inp = B.input, L = B.loop, PM = w.modules.player, EM = w.modules.enemies;
    L.stop();
    const S = window.__S = { cam: null, aim: null, keep: null, hits: [], shots: [], events: [] };
    w.events.on('*', ({ type, payload: p }) => {
      if (type === 'hit' && p?.target?.team === 'enemy') S.hits.push({ id: p.target.id, blocked: !!p.blocked, amount: p.amount });
      if (['grenade', 'explosion', 'coverEnter', 'coverExit', 'roll'].includes(type)) S.events.push([type, +w.time.toFixed(2)]);
    });
    const lock = () => {
      if (S.cam) { cam.x = S.cam.x; cam.y = S.cam.y; cam.zoom = S.cam.zoom; }
      cam.shakeX = 0; cam.shakeY = 0; if ('trauma' in cam) cam.trauma = 0;
      if (S.aim) { const s = cam.worldToScreen(S.aim.x, S.aim.y); inp.mouse.x = s.x; inp.mouse.y = s.y; }
      if (w.player) { w.player.hp = w.player.maxHp; }
      if (S.keep) { for (let i = w.enemies.length - 1; i >= 0; i--) if (!S.keep.has(w.enemies[i])) w.enemies.splice(i, 1); }
    };
    window.__st = {
      setup(o) {
        w.projectiles.length = 0; w.effects.length = 0; w.enemies.length = 0;
        PM.respawn(w, o.px, o.py); w.player.invuln = false;
        S.cam = { x: o.cx ?? o.px, y: o.cy ?? o.py, zoom: o.zoom ?? 1.5 };
        S.aim = { x: o.ax, y: o.ay };
        S.keep = new Set();
        S.en = (o.enemies || []).map(([t, x, y, extra]) => { const e = EM.createEnemy(w, t, x, y); Object.assign(e, extra || {}); S.keep.add(e); return { e, x, y }; });
        inp.mouse.left = false; inp.mouse.right = false;
        lock(); L.step(1 / 60); lock(); L.render();
        return true;
      },
      run(n, o = {}) {
        for (let i = 0; i < n; i++) {
          lock();
          if (o.pin) for (const q of S.en) { q.e.x = q.x; q.e.y = q.y; q.e.vx = 0; q.e.vy = 0; }
          if (o.left !== undefined) { inp.mouse.left = o.left; if (o.left && i === 0) inp.mouse.leftPressed = true; }
          if (o.right !== undefined) inp.mouse.right = o.right;
          L.step(1 / 60);
        }
        lock(); if (o.pin) for (const q of S.en) { q.e.x = q.x; q.e.y = q.y; }
        L.render();
        return this.info();
      },
      zoom(z) { S.cam.zoom = z; lock(); L.render(); },
      aimAt(x, y) { S.aim = { x, y }; lock(); },
      info() {
        const p = w.player, P = PM._debug();
        return { t: +w.time.toFixed(2), p: { x: +p.x.toFixed(1), y: +p.y.toFixed(1), state: P.st.name, sub: P.cov?.sub || null, cover: P.cov?.line?.type || null, aim: +P.aim.toFixed(4), muzzle: p.muzzle && { x: +p.muzzle.x.toFixed(1), y: +p.muzzle.y.toFixed(1) } },
          mouseWorld: { x: +inp.mouse.worldX.toFixed(1), y: +inp.mouse.worldY.toFixed(1) },
          aimExpected: +Math.atan2(inp.mouse.worldY - p.y, inp.mouse.worldX - p.x).toFixed(4),
          enemies: w.enemies.filter((e) => !e.dead).map((e) => ({ type: e.type, x: Math.round(e.x), y: Math.round(e.y), state: e.state, crouch: +(e.crouch || 0).toFixed(2), cover: e.coverHeld?.type || null })),
          proj: w.projectiles.map((q) => ({ x: +q.x.toFixed(1), y: +q.y.toFixed(1), a: +(q.angle ?? Math.atan2(q.vy, q.vx)).toFixed(4), team: q.team, z: q.z ?? null })),
          nEffects: w.effects.length, grenades: (w.grenades || w._grenades || []).length, view: w.view };
      },
      // overlegg (kun i testbildet): logisk munning (magenta), kuler (cyan kryss), musepunkt (gul)
      overlay() {
        const ctx = document.getElementById('game').getContext('2d'); ctx.save(); cam.apply(ctx);
        const p = w.player; if (p.muzzle) { ctx.fillStyle = '#ff00ff'; ctx.beginPath(); ctx.arc(p.muzzle.x, p.muzzle.y, 2.5, 0, 7); ctx.fill(); }
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 1; for (const q of w.projectiles) { ctx.beginPath(); ctx.moveTo(q.x - 4, q.y - 4); ctx.lineTo(q.x + 4, q.y + 4); ctx.moveTo(q.x + 4, q.y - 4); ctx.lineTo(q.x - 4, q.y + 4); ctx.stroke(); }
        ctx.strokeStyle = '#ffee00'; ctx.beginPath(); ctx.arc(inp.mouse.worldX, inp.mouse.worldY, 4, 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,0,255,.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.aim) * 400, p.y + Math.sin(p.aim) * 400); ctx.stroke();
        ctx.restore();
      },
      hits() { const h = S.hits.slice(); S.hits.length = 0; return h; },
      events() { return S.events.splice(0); },
    };
  });
}

async function scenes(page, view) {
  const R = RES.views[view] = { scenes: {} };
  const shot = async (name) => { const f = `${OUT}/raw/${view}-${name}.png`; await page.screenshot({ path: f }); return f; };
  const st = (fn, ...a) => page.evaluate(([fn, a]) => window.__st[fn](...a), [fn, a]);
  const keyHold = async (key, frames, o) => { await page.keyboard.down(key); const r = await st('run', frames, o || {}); await page.keyboard.up(key); return r; };

  const P2 = process.env.PART === '2' || process.env.PART === '3';
  if (process.env.PART === '3') {
    // S11 Warden NORD for lav dekning (sett bakfra i skrå), sikter sør; fiende i dekning sør for lav barriere
    await st('setup', { px: 432, py: 752, ax: 432, ay: 900, zoom: 2, enemies: [['grunt', 330, 640]] });
    await st('run', 5); await keyHold('KeyE', 3, {}); R.scenes.lowNorth = await st('run', 45);
    await shot('s11-low-north-z2'); R.scenes.lowNorthAim = await st('run', 30, { right: true }); await shot('s11b-low-north-popup-z2');
    await st('run', 4, { right: true, left: true }); await shot('s11c-low-north-fire-z2'); await st('run', 2, { right: false, left: false });
    // S12 fiende huket bak lav dekning (sandbag 26, 544..640 x 608..640) på nordsiden og sørsiden, sett fra spilleren i sør
    await st('setup', { px: 590, py: 830, cx: 590, cy: 680, ax: 590, ay: 600, zoom: 2, enemies: [['grunt', 575, 594, { crouch: 1 }], ['grunt', 615, 655, { crouch: 1 }]] });
    R.scenes.enemyLow = await st('run', 2, { pin: true }); await shot('s12-enemy-low-z2');
    return;
  }
  if (!P2) {
  // S1 spawn-pute (kjent feil: chevroner/topplag over Warden)
  await st('setup', { px: 128, py: 848, ax: 300, ay: 848, zoom: 1.5 });
  R.scenes.spawn = await st('run', 20);
  await shot('s1-spawn-z15'); await st('zoom', 3); await shot('s1-spawn-z3');

  // S2 åpent gulv: Warden + alle fire fiendetyper (lesbarhet mot gulvet)
  await st('setup', { px: 470, py: 450, ax: 700, ay: 330, zoom: 1.5, enemies: [['grunt', 640, 330], ['flanker', 700, 600], ['heavy', 880, 300], ['grenadier', 420, 250]] });
  R.scenes.open = await st('run', 30, { pin: true });
  await shot('s2-open-z15'); await st('zoom', 2); await shot('s2-open-z2');

  // S3 lav dekning: Warden i dekning sør for lav barriere 32, fiende huket bak lav barriere 21, en stående i det fri
  await st('setup', { px: 624, py: 336, ax: 640, ay: 200, zoom: 1.5, enemies: [['grunt', 704, 176], ['grunt', 560, 230]] });
  R.scenes.lowPre = await st('run', 5);
  R.scenes.low = await keyHold('KeyE', 3, {}); R.scenes.low = await st('run', 45);
  await shot('s3-low-cover-z15'); await st('zoom', 2); await shot('s3-low-cover-z2');
  // kikk/sikt over lav dekning (høyre mus)
  R.scenes.lowAim = await st('run', 30, { right: true });
  await shot('s3b-low-popup-z2');
  R.scenes.lowFire = await st('run', 4, { right: true, left: true }); await shot('s3c-low-popup-fire-z2');
  await st('run', 2, { right: false, left: false });

  // S4 høy dekning: Warden mot vestsiden av container 33, fiende rett nord for container 29 (bak høy dekning sett i skrå)
  await st('setup', { px: 716, py: 330, ax: 900, ay: 330, zoom: 1.5, enemies: [['grunt', 680, 466], ['flanker', 640, 470]] });
  await keyHold('KeyE', 3, {}); R.scenes.high = await st('run', 45, { pin: true });
  await shot('s4-high-cover-z15'); await st('zoom', 2); await shot('s4-high-cover-z2');

  // S5 okklusjon: Warden NORD for container 29 (rett bak den i skrå), fiender nord for container 25, Warden sikter sør
  await st('setup', { px: 690, py: 466, cx: 640, cy: 560, ax: 640, ay: 690, zoom: 1.5, enemies: [['grunt', 560, 690], ['heavy', 650, 688], ['grunt', 600, 800]] });
  R.scenes.occl = await st('run', 20, { pin: true });
  await shot('s5-occlusion-z15'); await st('zoom', 2); await shot('s5-occlusion-z2');
  R.scenes.occlFire = await st('run', 6, { pin: true, left: true }); await shot('s5b-occlusion-fire-z2'); await st('run', 1, { left: false, pin: true });

  // S6 skyting: tracer vs tegnet munning, zoom 3, fire retninger + overlegg
  R.scenes.aim = [];
  for (const [i, a] of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -3 * Math.PI / 4].entries()) {
    await st('setup', { px: 470, py: 450, ax: 470 + Math.cos(a) * 200, ay: 450 + Math.sin(a) * 200, zoom: 3 });
    await st('run', 25);
    const r = await st('run', 2, { left: true });
    R.scenes.aim.push({ dirDeg: Math.round(a * 180 / Math.PI), ...r });
    await shot(`s6-aim-${i}-z3`); await st('overlay'); await shot(`s6-aim-${i}-z3-overlay`);
    await st('run', 2, { left: false });
  }
  // S6b sikting 360°: avvik mellom logisk sikte og musepunkt
  await st('setup', { px: 470, py: 450, ax: 670, ay: 450, zoom: 1.5 });
  const dev = [];
  for (let k = 0; k < 24; k++) { const a = -Math.PI + k * Math.PI / 12; await st('aimAt', 470 + Math.cos(a) * 180, 450 + Math.sin(a) * 180); const r = await st('run', 12); dev.push({ deg: Math.round(a * 180 / Math.PI), aim: r.p.aim, exp: r.aimExpected, err: +(((r.p.aim - r.aimExpected + 3 * Math.PI) % (2 * Math.PI)) - Math.PI).toFixed(4), mz: r.p.muzzle, p: r.p }); }
  R.aim360 = dev;

  }
  // S7 treff-forsøk: grunt 280 px øst, festet. Sikte på fotpunkt vs. på tegnet bryst (34: 20 verdens-px over foten)
  R.hitTest = {};
  for (const [label, dy, ads] of [['fot', 0, false], ['bryst', -20, false], ['fot-ads', 0, true], ['bryst-ads', -20, true], ['hode', -30, true]]) {
    await st('setup', { px: 560, py: 815, ax: 840, ay: 815 + dy, zoom: 1.5, enemies: [['grunt', 840, 815, { hp: 1e6, maxHp: 1e6 }]] });
    await st('hits');
    await st('run', 30, { pin: true, right: ads });
    let fired = 0;
    for (let s = 0; s < 12; s++) { await st('run', 1, { pin: true, left: true, right: ads }); await st('run', 9, { pin: true, left: false, right: ads }); fired++; }
    await st('run', 40, { pin: true, left: false, right: ads });
    const h = await st('hits');
    R.hitTest[label] = { aimDy: dy, ads, shots: fired, hits: h.filter((x) => !x.blocked).length };
  }

  if (!P2) {
  // S8 granat: hold G, slipp, bilder i lufta
  await st('setup', { px: 470, py: 450, ax: 640, ay: 330, zoom: 1.5, enemies: [['grunt', 660, 330]] });
  await st('run', 10, { pin: true });
  await page.keyboard.down('KeyG'); await st('run', 20, { pin: true }); await shot('s8-grenade-aim-z15');
  await page.keyboard.up('KeyG');
  R.scenes.gren = await st('run', 14, { pin: true }); await shot('s8-grenade-flight-z15'); await st('zoom', 2); await shot('s8-grenade-flight-z2');
  R.scenes.gren2 = await st('run', 40, { pin: true }); await shot('s8-grenade-boom-z15');
  R.grenEvents = await st('events');
  // fiendegranat (grenadier) – kast mot spilleren
  await st('setup', { px: 470, py: 450, ax: 600, ay: 450, zoom: 1.5, enemies: [['grenadier', 640, 300]] });
  }
  if (P2) await st('setup', { px: 470, py: 450, ax: 600, ay: 450, zoom: 1.5, enemies: [['grenadier', 640, 300]] });
  let gseen = null;
  for (let k = 0; k < 200 && !gseen; k++) { const r = await st('run', 6); const ev = await st('events'); if (ev.some((e) => e[0] === 'grenade')) { gseen = r; await st('run', 12); await shot('s8b-enemy-grenade-z15'); await st('zoom', 2); await shot('s8b-enemy-grenade-z2'); } }
  R.enemyGrenade = !!gseen;

  if (!P2) {
  // S9 rulling
  await st('setup', { px: 470, py: 450, ax: 700, ay: 450, zoom: 2 });
  await st('run', 10);
  await page.keyboard.down('KeyD'); await page.keyboard.down('Space'); await st('run', 2); await page.keyboard.up('Space');
  R.scenes.roll = await st('run', 10); await shot('s9-roll-z2'); await page.keyboard.up('KeyD'); await st('run', 30);

  }
  // S10 kamp i sanntid: kuler mot spilleren, bilder ved 1.5 og 2
  await st('setup', { px: 600, py: 655, ax: 600, ay: 420, zoom: 1.5, enemies: [['grunt', 520, 420], ['grunt', 700, 400], ['grenadier', 640, 300]] });
  let best = 0;
  for (let k = 0; k < 150; k++) { const r = await st('run', 4, { left: k % 3 === 0 }); const n = r.proj.filter((q) => q.team === 'enemy').length; if (n > best && n >= 1) { best = n; await shot('s10-firefight-z15'); } if (best >= 3) break; }
  await st('zoom', 2); await shot('s10-firefight-z2');
  R.firefightEnemyBullets = best;
}

const browser = await launch();
for (const view of ['34', 'top']) {
  const errs = [];
  const page = await open(browser, `/index.html?view=${view}`, errs);
  await startIndex(page); await sleep(1500);
  await installStage(page);
  try { await scenes(page, view); } catch (e) { RES.views[view].fatal = String(e.stack || e); console.error(view, e); }
  RES.views[view].errors = errs;
  await page.close();
}
await browser.close();
fs.mkdirSync('/workspace/breach/tests/results', { recursive: true });
fs.writeFileSync(`/workspace/breach/tests/results/v3-skravinkel-scener${process.env.PART ? '-' + process.env.PART : ''}.json`, JSON.stringify(RES, null, 1));
console.log('FERDIG', Object.keys(RES.views), JSON.stringify(RES.views['34']?.hitTest), JSON.stringify(RES.views.top?.hitTest));
