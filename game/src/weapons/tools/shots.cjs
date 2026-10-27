// Skjermbilder av våpen-testbanen i headless Chromium. Kjør fra /workspace/breach: node game/src/weapons/tools/shots.cjs
// Starter selv en http-server (python3) på :8771 med rot i game/.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const GAME = path.resolve(__dirname, '../../..'), OUT = path.resolve(__dirname, '../shots'), PORT = 8771;
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const exe = fs.readdirSync(process.env.HOME + '/.cache/ms-playwright').find((d) => /^chromium-\d/.test(d));
  const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/${exe}/chrome-linux64/chrome`, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${PORT}/src/weapons/test.html`); await page.waitForTimeout(1200);
  const snap = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // stopp sanntidsloopen så scenene er deterministiske
  await ev(() => BREACH.loop.stop());
  const sum = await ev(() => BREACH.autoMeasure({ pulls: 5, rows: ['open', 'low', 'high'] }));
  fs.writeFileSync(`${OUT}/measured.json`, JSON.stringify(sum, null, 1));
  await ev(() => { BREACH.loop.advance(90); });
  await page.waitForTimeout(400); // panel + simulert TTK
  // 1 oversikt: AR-salve mot 16 ruter
  await ev(() => BREACH.stage({ weapon: 'rifle', tx: 70 + 16 * 32, ty: 190 + 47, fire: 6, advanceAfter: 1 }));
  await page.waitForTimeout(2500); await ev(() => BREACH.loop.advance(0)); await snap('01-overview-rifle');
  const zoomTo = (o) => ev((o) => { document.getElementById('panel').style.display = o.panel ? '' : 'none'; const c = BREACH.camera; c.zoom = o.z; c.x = o.x; c.y = o.y; BREACH.loop.advance(0); }, o);
  // 2 hagle nært
  await ev(() => BREACH.stage({ weapon: 'shotgun', tx: 70 + 4 * 32, ty: 190 - 47, fire: 1, advanceAfter: 2 }));
  await zoomTo({ z: 3.2, x: 200, y: 180 }); await snap('02-shotgun-close');
  // 3 presisjon langt
  await ev(() => BREACH.stage({ weapon: 'marksman', tx: 70 + 24 * 32, ty: 190 + 78, fire: 1, advanceAfter: 3 }));
  await zoomTo({ z: 1.7, x: 470, y: 230 }); await snap('03-marksman-long');
  // 4 granat i lav-dekning-banen
  await ev(() => { BREACH.stage({ weapon: 'rifle', y: 470, tx: 70 + 8 * 32, ty: 470, grenade: { x: 70 + 8 * 32 + 10, y: 470 }, advanceAfter: 1 }); const g = BREACH.world._grenades; let n = 0; while (BREACH.world._grenades?.length && n++ < 300) BREACH.loop.advance(1); BREACH.loop.advance(4); });
  await zoomTo({ z: 2.4, x: 330, y: 470 }); await snap('04-grenade-explosion');
  await ev(() => BREACH.loop.advance(40)); await zoomTo({ z: 2.4, x: 330, y: 470 }); await snap('05-grenade-aftermath');
  // 6 aktiv reload HUD
  await ev(() => { BREACH.stage({ weapon: 'rifle', tx: 600, ty: 200, reloadAt: 0.62 }); });
  await zoomTo({ z: 2.2, x: 330, y: 260 }); await snap('06-active-reload-hud');
  // 7 hagle-blindfire i dekning (spredning)
  await ev(() => { BREACH.stage({ weapon: 'rifle', y: 470, tx: 70 + 16 * 32, ty: 470, aiming: false, advanceAfter: 0 }); BREACH.player.inCover = true; for (let i = 0; i < 40; i++) { BREACH.weapons.tryFire(BREACH.world, BREACH.player, { aimAngle: BREACH.player.aim, blind: true, inCover: true }); BREACH.loop.advance(1); } BREACH.player.inCover = false; });
  await zoomTo({ z: 1.8, x: 330, y: 470 }); await snap('07-blindfire-spread');
  // 8 presisjon: forhåndsvisning av skade i trådkorset (fullt ladet, 16 ruter)
  await ev(() => { BREACH.stage({ weapon: 'marksman', tx: 70 + 16 * 32, ty: 190 + 47, advanceAfter: 70 }); });
  await zoomTo({ z: 2.6, x: 520, y: 220 }); await snap('08-marksman-preview');
  await ev(() => BREACH.release());
  // 9 nærkamp: to mål i buen
  const m1 = await ev(() => { BREACH.stageMelee({ x: 1110, y: 160, angle: 0, frames: 11 }); return BREACH.meleeLog.at(-1); });
  await zoomTo({ z: 4, x: 1140, y: 165 }); await snap('09-melee-two-targets');
  // 10 nærkamp: høy dekning blokkerer, lav gjør ikke
  const m2 = await ev(() => { BREACH.stageMelee({ x: 1110, y: 300, angle: 0, frames: 30 }); const a = BREACH.meleeLog.at(-1); BREACH.stageMelee({ x: 1110, y: 420, angle: 0, frames: 11 }); return [a, BREACH.meleeLog.at(-1)]; });
  await zoomTo({ z: 3.2, x: 1150, y: 360 }); await snap('10-melee-high-vs-low-cover');
  // 11 ammokasser klare, 12 én på nedkjøling
  await ev(() => { BREACH.release(); BREACH.player.x = 1170; BREACH.player.y = 580; BREACH.loop.advance(30); });
  await zoomTo({ z: 3.0, x: 1170, y: 680 }); await snap('11-crates-ready');
  const crate = await ev(() => { BREACH.emptyAmmo(); BREACH.player.x = 1170; BREACH.player.y = 636; BREACH.loop.advance(2); BREACH.player.y = 580; BREACH.loop.advance(60 * 6); const c = BREACH.world.arena.ammoCrates; return { refills: BREACH.refillLog.slice(), crates: c.map((k) => ({ id: k.id, ready: k.ready, left: +(k.readyAt - BREACH.world.time).toFixed(1) })), cur: BREACH.weapons.current(BREACH.player).slots, gren: BREACH.player.loadout.grenades }; });
  await zoomTo({ z: 3.0, x: 1170, y: 680 }); await snap('12-crates-cooldown');
  // rev. 4: fiendeslag mot spilleren (30 / 0,25) og Heavy som lader
  const r4m = await ev(() => { const r = BREACH.enemyMeleeTest(); const F = BREACH.rev4Stubs.find((x) => x.type === 'flanker'); BREACH.player.x = 1268; BREACH.player.y = 245; BREACH.player.hp = 100; BREACH.player.staggerUntil = 0; F.loadout.meleeCd = 0; BREACH.weapons.tryMelee(BREACH.world, F, 0); for (let i = 0; i < 11; i++) BREACH.loop.advance(1); return r; });
  console.log('rev4 melee', JSON.stringify(r4m)); sum.rev4Melee = r4m;
  await zoomTo({ z: 3.4, x: 1250, y: 245 }); await snap('13-enemy-melee-stagger');
  const r4h = await ev(() => { const r = BREACH.heavyTest(5); return r; });
  console.log('rev4 heavy', JSON.stringify(r4h)); sum.rev4Heavy = r4h;
  await zoomTo({ z: 2.6, x: 1150, y: 470 }); await snap('14-heavy-reloading');
  sum.melee = { twoTargets: m1, highThenLow: m2 }; sum.crate = crate;
  fs.writeFileSync(`${OUT}/measured.json`, JSON.stringify(sum, null, 1));
  console.log('melee', JSON.stringify(sum.melee)); console.log('crate', JSON.stringify(crate));
  console.log(errors.length ? errors.join('\n') : 'No console errors.');
  console.log(JSON.stringify(sum.measured));
  await browser.close(); srv.kill();
})().catch((e) => { console.error(e); process.exit(1); });
