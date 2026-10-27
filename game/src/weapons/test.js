// Våpen-testbane (tekst i spillet på engelsk). Stubber: spiller-dummy (WASD, mus), skyteblinker på 2–24 ruter i åpent lende,
// bak lav og bak høy dekning. Panelet til høyre viser FAKTISK skade målt fra 'hit'-hendelser (ikke formelen) og simulert TTK.
// Taster: 1/2/3/hjul bytt · R lad om (igjen = aktiv reload) · G hold/slipp granat · høyreklikk sikte · C dekning av/på
//         (skudd uten sikte i dekning = blindfire) · T bytt måltype · X nullstill målinger · F1 debug
import { createWorld, createInput, createCamera, createLoop, addEffect } from '../core/index.js';
import { ENEMY_TYPES } from '../enemies/stats.js';
import * as weapons from './index.js';
import { WEAPONS, TILE, rpm, TUNING } from './data.js';
import { simulateTTK } from './ttk.js';

const canvas = document.getElementById('c'), ctx = canvas.getContext('2d'), panel = document.getElementById('panel');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; } resize(); addEventListener('resize', resize);

const WW = 1330, WH = 820, SX = 70, LANE_W = 1000;   // x > LANE_W: nærkamp- og ammokassesone
const world = createWorld({ seed: 4242, width: WW, height: WH });
const camera = createCamera(canvas), input = createInput(canvas);
world.camera = camera; world.input = input;
weapons.init(world);

// ---------- bane ----------
const ROWS = {
  open: { y: 190, label: 'OPEN', dists: [2, 4, 8, 12, 16, 24], offs: [-78, -47, -16, 16, 47, 78] },
  low: { y: 470, label: 'LOW COVER', dists: [4, 8, 16], offs: [-44, 0, 44] },
  high: { y: 690, label: 'HIGH COVER', dists: [8, 16], offs: [-30, 30] },
};
const TYPES = ['grunt', 'flanker', 'heavy', 'grenadier'];
let typeIdx = 0;
const dummies = [];
for (const [row, R] of Object.entries(ROWS)) R.dists.forEach((t, i) => {
  const d = { row, tiles: t, x: SX + t * TILE, y: R.y + R.offs[i], r: 15, team: 'enemy', dead: false, hp: 100, maxHp: 100, armor: 0, respawn: 0, firstHit: -1, ttk: [], flash: 0, dummy: true };
  dummies.push(d);
  if (row === 'low') world.cover.push({ x: d.x - 15 - 26, y: d.y - 22, w: 16, h: 44, type: 'low', material: 'concrete' });
  if (row === 'high') world.cover.push({ x: d.x - 15 - 30, y: d.y - 26, w: 18, h: 52, type: 'high', material: 'metal' });
});
function applyType(d) { d.lastHit = -1; const T = ENEMY_TYPES[TYPES[typeIdx]]; d.type = TYPES[typeIdx]; d.r = T.radius; d.hp = d.maxHp = T.hp; d.armor = T.armor || 0; d.dead = false; d.firstHit = -1; d.coverHitChance = undefined; }
// nærkampsone (x > LANE_W): to mål på nært hold (flere mål i buen), ett bak HØY dekning (skal ikke treffes), ett bak LAV (skal treffes)
const MZ = { x: 1110 };
const MELEE_SPOTS = [
  { id: 'open-a', x: 1150, y: 140, cover: null }, { id: 'open-b', x: 1146, y: 182, cover: null },
  { id: 'high', x: 1152, y: 300, cover: 'high' }, { id: 'low', x: 1152, y: 420, cover: 'low' },
];
for (const m of MELEE_SPOTS) {
  const d = { row: 'melee', tiles: m.id, x: m.x, y: m.y, r: 15, team: 'enemy', dead: false, hp: 100, maxHp: 100, armor: 0, respawn: 0, firstHit: -1, ttk: [], flash: 0, dummy: true, melee: true };
  dummies.push(d);
  if (m.cover === 'high') world.cover.push({ x: m.x - 34, y: m.y - 26, w: 10, h: 52, type: 'high', material: 'metal' });
  if (m.cover === 'low') world.cover.push({ x: m.x - 34, y: m.y - 22, w: 10, h: 44, type: 'low', material: 'concrete' });
}
dummies.forEach(applyType);
world.enemies = dummies.slice();
// rammer rundt banen (+ skillevegg mot nærkampsonen med åpning)
world.cover.push({ x: 0, y: 330, w: LANE_W, h: 14, type: 'high', material: 'concrete' }, { x: 0, y: 590, w: LANE_W, h: 14, type: 'high', material: 'concrete' });
world.cover.push({ x: LANE_W, y: 0, w: 14, h: 520, type: 'high', material: 'concrete' }, { x: LANE_W, y: 600, w: 14, h: 220, type: 'high', material: 'concrete' });
world.cover.push({ x: LANE_W + 14, y: 520, w: WW - LANE_W - 14, h: 12, type: 'high', material: 'concrete' });
// ammokasser: STUB – Arena eier kassegrafikken og world.arena.ammoCrates i spillet. Weapons leser listen og tegner tilstandslyset.
world.arena = { id: 'weapons-test', ammoCrates: [{ id: 'crate-a', x: 1080, y: 690 }, { id: 'crate-b', x: 1170, y: 640 }, { id: 'crate-c', x: 1260, y: 740 }] };

// ---------- spiller-dummy (stub – Karakter tegner den ekte figuren) ----------
const player = { x: SX, y: ROWS.open.y, r: 14, hp: 100, maxHp: 100, team: 'player', dead: false, aim: 0, inCover: false };
world.player = player;
weapons.createLoadout(player, ['rifle', 'shotgun', 'marksman'], {}, world);
camera.follow(null);

// ---------- måling ----------
const M = {}; // M[weapon][tiles] = { hits, dmg, shots:Set, perShot: Map(shotId→sum), dist }
const ttkLog = {}; // ttkLog[weapon][tiles] = [s]
let shotsFired = {}, shotEvents = 0, triggerPulls = 0;
function bucket(w, t) { M[w] ??= {}; return (M[w][t] ??= { hits: 0, dmg: 0, perShot: new Map(), dist: 0, raw: 0 }); }
world.events.on('shot', (p) => { if (p.team === 'player') shotEvents++; });
world.events.on('weaponFire', (p) => { if (p.entity === player) { triggerPulls++; shotsFired[p.weapon] = (shotsFired[p.weapon] || 0) + 1; } });
world.events.on('hit', ({ target, amount, source }) => {
  if (!target?.dummy) return;
  const w = source?.projectile?.weapon || source?.weapon; if (!w) return;
  const b = bucket(w, target.row + ':' + target.tiles), pr = source.projectile;
  b.hits++; b.dmg += amount; b.raw += amount / (1 - (target.armor || 0));
  if (pr) { b.dist += Math.hypot(target.x - pr.ox, target.y - pr.oy); b.perShot.set(pr.shotId, (b.perShot.get(pr.shotId) || 0) + amount); }
  else { b.dist += Math.hypot(target.x - source.x, target.y - source.y); b.perShot.set('g' + world.time.toFixed(3), (b.perShot.get('g' + world.time.toFixed(3)) || 0) + amount); }
  if (target.firstHit < 0) target.firstHit = world.time;
  target.lastHit = world.time;
  target.flash = 0.08;
  addEffect(world, { x: target.x + (world.rng() - 0.5) * 14, y: target.y - target.r - 6, life: 0.8, v: amount, layer: 'over', draw(c, w2, cam, f) {
    const k = f.t / f.life; c.globalAlpha = 1 - k * k; c.font = `700 ${f.v >= 50 ? 12 : 9}px system-ui`; c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,.7)'; c.fillText(Math.round(f.v), f.x + 0.8, f.y - k * 18 + 0.8); c.fillStyle = f.v >= 50 ? '#ffffff' : '#ffd08a'; c.fillText(Math.round(f.v), f.x, f.y - k * 18); } });
});
world.events.on('death', ({ target, source }) => {
  if (!target?.dummy) return; const w = source?.projectile?.weapon || source?.weapon || '?';
  ((ttkLog[w] ??= {})[target.tiles + target.row] ??= []).push(Math.max(0, world.time - target.firstHit));
  target.respawn = 1.0;
});

// ---------- moduler for core-loop ----------
const ctl = {
  update(dt, w) {
    if (input.pressed('KeyT')) { typeIdx = (typeIdx + 1) % TYPES.length; dummies.forEach(applyType); }
    if (input.pressed('KeyX')) { for (const k in M) delete M[k]; for (const k in ttkLog) delete ttkLog[k]; shotsFired = {}; shotEvents = triggerPulls = 0; }
    if (input.pressed('KeyC')) player.inCover = !player.inCover;
    if (input.pressed('KeyZ')) emptyAmmo();
    if (input.pressed('KeyM')) { player.x = MZ.x; player.y = 160; }
    if (input.pressed('KeyB')) { player.x = 1170; player.y = 580; }
    if (input.pressed('KeyJ')) enemyMeleeTest();
    if (input.pressed('KeyH')) heavyTest();
  },
};
const playerMod = {
  update(dt, w) {
    if (!scripted) {
      let mx = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0), my = (input.down('KeyS') ? 1 : 0) - (input.down('KeyW') ? 1 : 0);
      const l = Math.hypot(mx, my) || 1, sp = input.mouse.right ? 95 : 150;
      player.x = Math.max(20, Math.min(WW - 20, player.x + (mx / l) * sp * dt)); player.y = Math.max(20, Math.min(WH - 20, player.y + (my / l) * sp * dt));
      player.aim = Math.atan2(input.mouse.worldY - player.y, input.mouse.worldX - player.x);
      weapons.handleInput(w, player, input, { aiming: input.mouse.right, inCover: player.inCover, blind: player.inCover && !input.mouse.right });
    }
    // Testsiden har IKKE mods.weapons i loopen, så den kaller update/draw selv (i spillet gjør main.js-loopen det).
    weapons.update(dt, w);
  },
  draw(c, w, cam) {
    drawShooter(c, player);
    weapons.draw(c, w, cam);
    const L = player.loadout;
    if (!scripted || showReticle) weapons.drawReticle(c, w, player, reticle().x, reticle().y);
  },
  drawHud(c, w) { weapons.drawHud(c, w, player); drawHelp(c); },
};
let scripted = false, showReticle = false, scriptAim = null;
const reticle = () => scriptAim || { x: input.mouse.worldX, y: input.mouse.worldY };
const dummyMod = {
  update(dt, w) { for (const d of dummies) { d.flash = Math.max(0, d.flash - dt); if (d.dead && (d.respawn -= dt) <= 0) applyType(d);
    // treningsdukke: full helse igjen etter 2,5 s uten treff, så målt TTK alltid er én sammenhengende kamp
    if (!d.dead && d.firstHit >= 0 && w.time - d.lastHit > 2.5) applyType(d); } },
  draw(c) { for (const d of dummies) drawDummy(c, d); for (const e of rev4Stubs) drawRev4Stub(c, e); },
};
function emptyAmmo() { const L = player.loadout; for (const s of L.slots) { s.mag = 0; s.reserve = 0; } L.grenades = 0; L.reload = null; }
let refillLog = [], meleeLog = [];
world.events.on('refill', (p) => { refillLog.push({ crateId: p.crateId, t: +world.time.toFixed(2) }); });
const grenadeLog = [];   // rev. 3: windup → throw med tidspunkt og kastpunkt
world.events.on('grenade', (p) => { if (p.entity === player) grenadeLog.push({ phase: p.phase, t: +world.time.toFixed(3), windup: p.windup, x: Math.round(p.x), y: Math.round(p.y) }); });
world.events.on('melee', (p) => { if (p.phase === 'hit') meleeLog.push({ t: +world.time.toFixed(2), targets: p.targets.map((x) => x.tiles) }); });
const crateMod = {
  // STUB-kasse: enkel kassekropp så testsiden kan prøves. I spillet tegner Arena denne.
  draw(c) { for (const k of world.arena.ammoCrates) drawStubCrate(c, k); },
};
const floorMod = { draw(c, w, cam) { drawFloor(c); crateMod.draw(c); }, drawTop: drawHighCover };

const loop = createLoop({ world, ctx, camera, input, mods: { level: ctl, player: playerMod, enemies: dummyMod, arena: floorMod } });
function fit() { const pw = innerWidth > 1100 ? 450 : 0; camera.zoom = Math.min((canvas.width - pw) / (WW + 30), canvas.height / (WH + 30)); camera.x = WW / 2 + pw / 2 / camera.zoom; camera.y = WH / 2; }
fit(); addEventListener('resize', fit);
loop.start();

// ---------- tegning ----------
let FLOOR = null;
function buildFloor() {
  const c = document.createElement('canvas'); c.width = WW; c.height = WH; const g = c.getContext('2d');
  g.fillStyle = '#24272a'; g.fillRect(0, 0, WW, WH);
  // betongplater med variasjon
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < WH; y += 64) for (let x = 0; x < WW; x += 64) { const v = 30 + rnd() * 9; g.fillStyle = `rgb(${v},${v + 3},${v + 6})`; g.fillRect(x + 1, y + 1, 62, 62); }
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + rnd() * 0.04})`; g.fillRect(rnd() * WW, rnd() * WH, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; for (let x = 0; x <= WW; x += 64) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, WH); g.stroke(); } for (let y = 0; y <= WH; y += 64) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(WW, y + 0.5); g.stroke(); }
  // rutemarkører per bane
  for (const R of Object.values(ROWS)) {
    g.strokeStyle = 'rgba(201,162,39,.28)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(SX, R.y); g.lineTo(LANE_W - 20, R.y); g.stroke(); g.setLineDash([]);
    for (let t = 0; t <= 28 && SX + t * TILE < LANE_W; t++) { const x = SX + t * TILE, big = t % 4 === 0; g.fillStyle = big ? 'rgba(201,162,39,.55)' : 'rgba(201,162,39,.22)'; g.fillRect(x - 0.5, R.y - (big ? 7 : 3), 1, big ? 14 : 6); }
    g.font = '700 10px system-ui'; g.fillStyle = 'rgba(201,162,39,.7)'; g.fillText(R.label, SX - 50, R.y - 100 + (R === ROWS.open ? 0 : 40));
    g.fillStyle = 'rgba(57,198,255,.35)'; g.beginPath(); g.arc(SX, R.y, 6, 0, Math.PI * 2); g.fill();
  }
  g.font = '700 10px system-ui'; g.fillStyle = 'rgba(201,162,39,.7)'; g.fillText('MELEE (F)', LANE_W + 26, 40); g.fillText('AMMO CRATES (STUB BODIES)', LANE_W + 26, 560);
  g.fillStyle = 'rgba(57,198,255,.35)'; g.beginPath(); g.arc(MZ.x, 160, 6, 0, Math.PI * 2); g.fill();
  return c;
}
function drawFloor(c) {
  FLOOR ??= buildFloor(); c.drawImage(FLOOR, 0, 0);
  for (const cv of world.cover) if (cv.type === 'low') drawLow(c, cv);
  for (const d of dummies) { c.font = '600 9px system-ui'; c.textAlign = 'center'; c.fillStyle = 'rgba(217,226,232,.55)'; c.fillText(d.melee ? d.tiles.toUpperCase() : `${d.tiles} t`, d.melee ? d.x + 34 : d.x, d.melee ? d.y + 3 : d.y + d.r + 22); }
}
function drawLow(c, r) {
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(r.x + 4, r.y + 5, r.w, r.h);
  const g = c.createLinearGradient(r.x, 0, r.x + r.w, 0); g.addColorStop(0, '#4a4f54'); g.addColorStop(1, '#33373b');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(r.x, r.y, r.w, 2);
  c.save(); c.beginPath(); c.rect(r.x, r.y + 4, r.w, 6); c.clip(); for (let i = -2; i < r.w / 4 + 2; i++) { c.fillStyle = i % 2 ? '#c9a227' : '#1d1f21'; c.beginPath(); c.moveTo(r.x + i * 6, r.y + 10); c.lineTo(r.x + i * 6 + 6, r.y + 4); c.lineTo(r.x + i * 6 + 12, r.y + 4); c.lineTo(r.x + i * 6 + 6, r.y + 10); c.fill(); } c.restore();
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}
function drawHighCover(c) {
  for (const r of world.cover) {
    if (r.type !== 'high') continue;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(r.x + 8, r.y + 10, r.w, r.h);
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#525a61'); g.addColorStop(1, '#353b40');
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
    c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(r.x, r.y, r.w, 2);
    if (r.h > r.w) for (let y = r.y + 8; y < r.y + r.h - 4; y += 10) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(r.x + 3, y, r.w - 6, 1); }
    else for (let x = r.x + 10; x < r.x + r.w; x += 64) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x, r.y + 2, 1, r.h - 3); }
    c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
}
function drawDummy(c, d) {
  const T = ENEMY_TYPES[d.type], col = T.color, acc = T.accent;
  c.save(); c.translate(d.x, d.y);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(3, 5, d.r + 2, d.r * 0.8, 0, 0, Math.PI * 2); c.fill();
  if (d.dead) { c.globalAlpha = 0.35; c.strokeStyle = acc; c.setLineDash([3, 3]); c.beginPath(); c.arc(0, 0, d.r, 0, Math.PI * 2); c.stroke(); c.restore(); return; }
  const g = c.createRadialGradient(-d.r * 0.3, -d.r * 0.3, 1, 0, 0, d.r); g.addColorStop(0, d.flash > 0 ? '#ffffff' : col); g.addColorStop(1, d.flash > 0 ? '#ffd8c0' : T.dark);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, d.r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(8,6,6,.9)'; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = acc; c.globalAlpha = 0.85; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, d.r * 0.55, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(0, 0, d.r * 0.18, 0, Math.PI * 2); c.fillStyle = acc; c.fill(); c.globalAlpha = 1;
  // stagger (target.staggerUntil settes av nærkamp)
  if (d.staggerUntil > world.time) { const k = (d.staggerUntil - world.time) / 0.4; c.strokeStyle = `rgba(255,214,90,${0.5 + 0.5 * k})`; c.lineWidth = 2; c.setLineDash([3, 3]); c.lineDashOffset = -world.time * 40; c.beginPath(); c.arc(0, 0, d.r + 5, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.font = '800 8px system-ui'; c.textAlign = 'center'; c.fillStyle = '#ffd65a'; c.fillText('STAGGER', 0, d.r + 14); }
  // HP-bar
  const w = 30, k = d.hp / d.maxHp; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(-w / 2 - 1, -d.r - 10, w + 2, 5); c.fillStyle = '#3a1512'; c.fillRect(-w / 2, -d.r - 9, w, 3); c.fillStyle = k > 0.5 ? acc : '#ff5a3c'; c.fillRect(-w / 2, -d.r - 9, w * k, 3);
  c.restore();
}
function drawStubCrate(c, k) {
  c.save(); c.translate(k.x, k.y);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-14, -9, 31, 23);
  c.fillStyle = '#3c4a3a'; c.fillRect(-15, -11, 30, 22); c.strokeStyle = '#1c231b'; c.lineWidth = 1.5; c.strokeRect(-14.5, -10.5, 29, 21);
  c.fillStyle = '#56664f'; c.fillRect(-15, -11, 30, 4); c.fillStyle = '#2a3329'; c.fillRect(-2, -11, 4, 22);
  c.font = '600 7px system-ui'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,214,90,.8)'; c.fillText('STUB', 0, 20);
  c.restore();
}
function drawShooter(c, p) {
  c.save(); c.translate(p.x, p.y);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(3, 5, 16, 12, 0, 0, Math.PI * 2); c.fill();
  if (p.inCover) { c.strokeStyle = 'rgba(57,198,255,.35)'; c.setLineDash([4, 4]); c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
  const g = c.createRadialGradient(-4, -4, 1, 0, 0, 14); g.addColorStop(0, '#6b737b'); g.addColorStop(1, '#2c3136');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(6,7,9,.95)'; c.lineWidth = 1.5; c.stroke();
  c.rotate(p.aim); c.fillStyle = '#39c6ff'; c.fillRect(6, -2.5, 4, 5);   // visir = retningsmarkør (stub)
  c.restore();
}
function drawHelp(c) {
  c.save(); c.translate(0, c.canvas.height - 152); c.fillStyle = 'rgba(10,13,16,.8)'; c.fillRect(12, 12, 380, 128); c.fillStyle = '#39c6ff'; c.fillRect(12, 12, 46, 2);
  c.textAlign = 'left'; c.font = '700 12px system-ui'; c.fillStyle = '#39c6ff'; c.fillText('BREACH // WEAPONS TEST RANGE', 22, 32);
  c.font = '11px system-ui'; c.fillStyle = '#c9ced4';
  c.fillText('WASD move · LMB fire · RMB aim · 1/2/3 or wheel switch', 22, 50);
  c.fillText('R reload (press again = active reload) · hold G = grenade arc · J enemy melee test · H heavy reload test', 22, 66);
  c.fillText(`C cover: ${player.inCover ? 'ON (LMB without RMB = blind fire)' : 'off'} · T target: ${TYPES[typeIdx].toUpperCase()}`, 22, 82);
  c.fillText('F melee · M go to melee zone · B go to crates · Z empty all ammo', 22, 98);
  c.fillText(`Melee hits: ${meleeLog.length ? '[' + (meleeLog.at(-1).targets.join(', ') || 'miss') + ']' : '–'} · refills: ${refillLog.length}`, 22, 114);
  c.fillStyle = '#7d8a94'; c.fillText(`X reset stats · shot events ${shotEvents} / trigger pulls ${triggerPulls}`, 22, 130);
  c.restore();
}

// ---------- panel: målt skade + simulert TTK ----------
const OPEN = ROWS.open.dists;
let simRows = null;
function fmt(v, d = 0) { return Number.isFinite(v) ? v.toFixed(d) : '–'; }
function renderPanel() {
  const cur = player.loadout ? weapons.current(player).id : '';
  let h = `<h2>MEASURED DAMAGE <small>from hit events · target: ${TYPES[typeIdx]}${ENEMY_TYPES[TYPES[typeIdx]].armor ? ` (armor ${ENEMY_TYPES[TYPES[typeIdx]].armor * 100}%)` : ''}</small></h2>`;
  h += `<table><tr><th>avg dmg / trigger</th>${OPEN.map((t) => `<th>${t} t</th>`).join('')}</tr>`;
  for (const id of Object.keys(WEAPONS)) h += `<tr class="${id === cur ? 'cur' : ''}"><td>${WEAPONS[id].short}</td>${OPEN.map((t) => { const b = M[id]?.['open:' + t]; if (!b || !b.perShot.size) return '<td class="dim">·</td>'; let s = 0; for (const v of b.perShot.values()) s += v; return `<td>${fmt(s / b.perShot.size)}</td>`; }).join('')}</tr>`;
  h += `</table><table><tr><th>avg dmg / hit · hits</th>${OPEN.map((t) => `<th>${t} t</th>`).join('')}</tr>`;
  for (const id of [...Object.keys(WEAPONS), 'grenade']) h += `<tr class="${id === cur ? 'cur' : ''}"><td>${WEAPONS[id]?.short || 'Grenade'}</td>${OPEN.map((t) => { const b = M[id]?.['open:' + t]; return b?.hits ? `<td>${fmt(b.dmg / b.hits, 1)}<span class="dim"> ·${b.hits}</span></td>` : '<td class="dim">·</td>'; }).join('')}</tr>`;
  h += `</table><h2>COVER LANES <small>measured TTK, first hit → kill</small></h2><table><tr><th></th><th>low 4 t</th><th>low 8 t</th><th>low 16 t</th><th>high 8 t</th><th>high 16 t</th></tr>`;
  for (const id of Object.keys(WEAPONS)) { const cell = (row, t) => { const lg = ttkLog[id]?.[t + row]; return `<td>${lg?.length ? fmt(lg.reduce((a, b2) => a + b2, 0) / lg.length, 2) + 's' : '<span class="dim">·</span>'}</td>`; };
    h += `<tr class="${id === cur ? 'cur' : ''}"><td>${WEAPONS[id].short} TTK</td>${cell('low', 4)}${cell('low', 8)}${cell('low', 16)}${cell('high', 8)}${cell('high', 16)}</tr>`; }
  h += `</table><h2>MEASURED TTK <small>first hit → kill, open lane</small></h2><table><tr><th></th>${OPEN.map((t) => `<th>${t} t</th>`).join('')}</tr>`;
  for (const id of [...Object.keys(WEAPONS), 'grenade']) h += `<tr class="${id === cur ? 'cur' : ''}"><td>${WEAPONS[id]?.short || 'Grenade'}</td>${OPEN.map((t) => { const lg = ttkLog[id]?.[t + 'open']; return lg?.length ? `<td>${fmt(lg.reduce((a, b) => a + b, 0) / lg.length, 2)}<span class="dim"> ·${lg.length}</span></td>` : '<td class="dim">·</td>'; }).join('')}</tr>`;
  h += `</table><h2>SIMULATED TTK <small>seconds, aimed, ${simRows ? simRows.trials : '…'} runs, vs ${TYPES[typeIdx]}</small></h2>`;
  if (simRows && simRows.type === TYPES[typeIdx]) { h += `<table><tr><th></th>${OPEN.map((t) => `<th>${t} t</th>`).join('')}</tr>`; for (const r of simRows.rows) h += `<tr class="${r.id === cur ? 'cur' : ''}"><td>${WEAPONS[r.id].short}</td>${r.cells.map((c) => `<td>${c.killRate < 0.5 ? '–' : fmt(c.mean, 2)}</td>`).join('')}</tr>`; h += '</table>'; }
  else h += '<p class="note">calculating…</p>';
  h += `<p class="note">${Object.values(WEAPONS).map((w) => `<b>${w.short}</b> ${w.dmg}${w.pellets > 1 ? '×' + w.pellets : ''} dmg · ${rpm(w)} rpm · mag ${w.mag}`).join('<br>')}<br>Shot events per trigger pull: ${triggerPulls ? (shotEvents / triggerPulls).toFixed(2) : '–'} (should be 1.00)</p>`;
  panel.innerHTML = h;
}
setInterval(renderPanel, 250); renderPanel();
function runSim(trials = 40) {
  const type = TYPES[typeIdx], rows = []; const ids = Object.keys(WEAPONS); let i = 0;
  const job = () => { if (type !== TYPES[typeIdx]) return runSim(trials); if (i >= ids.length) { simRows = { type, rows, trials }; return; }
    const id = ids[i++]; rows.push({ id, cells: OPEN.map((t) => simulateTTK({ weapon: id, target: type, tiles: t, posture: 'aim', trials })) }); setTimeout(job, 0); };
  simRows = null; job();
}
runSim(); let lastType = typeIdx; setInterval(() => { if (lastType !== typeIdx) { lastType = typeIdx; runSim(); } }, 300);

// ---------- automatisk måling (testrigg / skjermbilder) ----------
/** Skyter hvert våpen mot hvert mål i åpent lende og i dekningsbanene, med loop.advance (synkront). */
function autoMeasure({ pulls = 4, rows = ['open', 'low'], ids = Object.keys(WEAPONS), aiming = true } = {}) {
  scripted = true; const L = player.loadout; const adv = (n) => { for (let i = 0; i < n; i++) loop.step(1 / 60); };
  for (const id of ids) {
    weapons.switchWeapon(world, player, id); adv(40);
    for (const d of dummies.filter((x) => rows.includes(x.row))) {
      player.x = SX; player.y = ROWS[d.row].y; player.aim = Math.atan2(d.y - player.y, d.x - player.x);
      applyType(d); weapons.refill(world, player); let n = 0, guard = 0, killed = false; const maxPulls = d.row === 'high' ? pulls : 45;
      while ((n < pulls || !killed) && n < maxPulls && guard++ < 6000) {
        if (d.dead) { killed = true; adv(70); continue; }
        weapons.setAiming(player, aiming); adv(1);
        const s = L.slots[L.index];
        if (s.mag === 0 && !L.reload) { weapons.startReload(world, player); }
        if (L.cooldown > 0 || L.reload || L.switchT > 0) continue;
        const r = weapons.tryFire(world, player, { aimAngle: player.aim, aiming });
        if (r.fired) { n++; if (!WEAPONS[id].auto) adv(1); }
      }
      adv(30);
    }
    weapons.refill(world, player);
  }
  scripted = false; loop.render(); renderPanel();
  return summary();
}
function summary() {
  const out = {};
  for (const [w, byT] of Object.entries(M)) { out[w] = {}; for (const [t, b] of Object.entries(byT)) { let s = 0; for (const v of b.perShot.values()) s += v; out[w][t] = { hits: b.hits, perHit: +(b.dmg / b.hits).toFixed(2), perTrigger: +(s / b.perShot.size).toFixed(2), dist: +(b.dist / b.hits).toFixed(1) }; } }
  return { measured: out, ttk: ttkLog, shotEvents, triggerPulls };
}
/** Stillbilde-scene for skjermbilder: posisjon/sikte/våpen + valgfritt skudd og granat. */
function stage({ weapon = 'rifle', x = SX, y = ROWS.open.y, tx, ty, fire = 0, aiming = true, grenade = null, advanceAfter = 2, reloadAt = null } = {}) {
  scripted = true; showReticle = true; weapons.refill(world, player); player.loadout.reload = null; weapons.switchWeapon(world, player, weapon); loop.advance(40);
  player.x = x; player.y = y; player.aim = Math.atan2(ty - y, tx - x); scriptAim = { x: tx, y: ty };
  weapons.setAiming(player, aiming);
  for (let i = 0; i < fire; i++) { weapons.tryFire(world, player, { aimAngle: player.aim, aiming }); loop.advance(WEAPONS[weapon].auto ? 1 : 2); }
  if (grenade) { weapons.throwGrenade(world, player, grenade.x, grenade.y); loop.advance(Math.ceil(TUNING.grenade.windup * 60) + 1); }   // oppladning → slipp
  if (reloadAt !== null) { const L = player.loadout; L.slots[L.index].mag = 3; weapons.startReload(world, player); loop.advance(Math.round(reloadAt * 60)); }
  loop.advance(advanceAfter);
  return weapons.current(player);
}
/** Nærkamp-scene: stå ved (x, y), slå mot vinkel, spol 'frames' steg (11 ≈ kontakt ved 0,165 s + litt). */
function stageMelee({ x = MZ.x, y = 160, angle = 0, frames = 11, weapon = 'rifle' } = {}) {
  scripted = true; showReticle = false; weapons.switchWeapon(world, player, weapon); loop.advance(40); player.loadout.meleeCd = 0;
  player.x = x; player.y = y; player.aim = angle; const ok = weapons.tryMelee(world, player, angle); loop.advance(frames); return ok;
}
function release() { scripted = false; showReticle = false; scriptAim = null; }
// ---------- rev. 4: fiendeslag (30 / 0,25), stagger-avbrudd og Heavy med magasin/lading ----------
// Stubber (Fiende-AI eier de ekte fiendene): en «Flanker» som slår spilleren og en «Heavy» som skyter mot øst.
const rev4Stubs = [], rev4Log = { melee: null, heavy: null };
function stub(type, weapon, x, y, aim) {
  let e = rev4Stubs.find((s) => s.type === type);
  if (!e) { e = { type, x, y, r: type === 'heavy' ? 18 : 14, team: 'enemy', hp: 100, maxHp: 100, armor: 0, dead: false, aim, def: { weapon } }; rev4Stubs.push(e); world.enemies.push(e); weapons.createEnemyLoadout(e, world, null, { weapon }); }
  Object.assign(e, { x, y, aim, dead: false, hp: e.maxHp, staggerUntil: 0 }); const L = e.loadout; L.melee = null; L.meleeCd = 0; L.reload = null; L.slots[0].mag = L.slots[0].def.mag; L.cooldown = 0;
  return e;
}
function resetPlayer(x, y, aim) { Object.assign(player, { x, y, aim, hp: 100, dead: false, staggerUntil: 0 }); const L = player.loadout; L.melee = null; L.meleeCd = 0; L.reload = null; }
function runUntil(pred, max = 120) { let n = 0; while (!pred() && n++ < max) loop.advance(1); while (world.hitstopT > 0) loop.advance(1); return n; }
/** Fiendeslag mot spilleren (standard 30 / 0,25), opts-overstyring, og stagger-avbrudd av spillerens slag. */
function enemyMeleeTest() {
  scripted = true; showReticle = false; const out = {}, ev = [];
  const off = world.events.on('melee', (p) => ev.push({ who: p.entity === player ? 'player' : 'flanker', phase: p.phase, n: p.targets.length, interrupted: !!p.interrupted, dmg: p.dmg, stagger: p.stagger, t: world.time }));
  // A: standardslag
  let F = stub('flanker', 'smg', 1232, 245, 0); resetPlayer(1268, 245, Math.PI); loop.advance(1);
  ev.length = 0; const ok = weapons.tryMelee(world, F, 0); runUntil(() => ev.some((x) => x.who === 'flanker' && x.phase === 'hit'));
  const hitT = ev.find((x) => x.phase === 'hit').t;
  out.standard = { started: ok, startDmg: ev[0]?.dmg, startStagger: ev[0]?.stagger, playerHpLoss: 100 - player.hp, playerStagger: +(player.staggerUntil - hitT).toFixed(3),
    playerCanMeleeWhileStaggered: weapons.tryMelee(world, player, Math.PI) };
  runUntil(() => world.time >= player.staggerUntil, 60); out.standard.playerCanMeleeAfter = weapons.tryMelee(world, player, Math.PI); runUntil(() => !player.loadout.melee, 60);
  // B: overstyring per slag
  F = stub('flanker', 'smg', 1232, 245, 0); resetPlayer(1268, 245, Math.PI); ev.length = 0;
  weapons.tryMelee(world, F, 0, { dmg: 12, stagger: 0.1 }); runUntil(() => ev.some((x) => x.phase === 'hit'));
  out.override = { playerHpLoss: 100 - player.hp, playerStagger: +(player.staggerUntil - ev.find((x) => x.phase === 'hit').t).toFixed(3) };
  runUntil(() => ev.some((x) => x.phase === 'end'), 60);
  // C: stagger-avbrudd – spilleren starter sitt slag 4 steg etter fienden; fiendens treff (steg 10) kommer før spillerens kontakt
  F = stub('flanker', 'smg', 1232, 245, 0); resetPlayer(1268, 245, Math.PI); ev.length = 0;
  weapons.tryMelee(world, F, 0); loop.advance(4); const pStarted = weapons.tryMelee(world, player, Math.PI);
  runUntil(() => ev.some((x) => x.who === 'player' && x.phase === 'end'), 60);
  const pe = ev.filter((x) => x.who === 'player');
  out.interrupt = { playerStarted: pStarted, playerEvents: pe.map((x) => x.phase + (x.interrupted ? '(interrupted)' : '')).join(','), playerHit: pe.some((x) => x.phase === 'hit'), flankerHp: F.hp,
    interruptedAfter: +(pe.at(-1).t - pe[0].t).toFixed(3) };
  off?.(); runUntil(() => world.time >= player.staggerUntil, 60); player.hp = 100;
  rev4Log.melee = out; return out;
}
/** Heavy: skyt kontinuerlig i 'secs' sekunder; mål skudd per magasin, ladetid og pause. */
function heavyTest(secs = 9) {
  scripted = true; const H = stub('heavy', 'minigun', 1050, 470, 0); resetPlayer(1270, 120, Math.PI);
  const shots = [], rel = [], reasons = {}; let reloadingSamples = 0;
  const o1 = world.events.on('weaponFire', (p) => { if (p.entity === H) shots.push(world.time); });
  const o2 = world.events.on('reload', (p) => { if (p.entity === H) rel.push({ phase: p.phase, t: world.time, weapon: p.weapon, time: p.time }); });
  const t0 = world.time; let peek = null;
  for (let i = 0; i < secs * 60; i++) {
    const r = weapons.tryFire(world, H, { aimAngle: 0, posture: 'aim' }); if (!r.fired) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    if (weapons.isReloading(H)) { reloadingSamples++; if (!peek) peek = weapons.current(H); }
    loop.advance(1);
  }
  o1?.(); o2?.();
  const s0 = rel.find((x) => x.phase === 'start'), e0 = rel.find((x) => x.phase === 'end');
  const out = {
    magSize: H.loadout.slots[0].def.mag, reloadTime: H.loadout.slots[0].def.reloadTime,
    shotsBeforeReload: s0 ? shots.filter((t) => t <= s0.t).length : shots.length, firstReloadAt: s0 ? +(s0.t - t0).toFixed(2) : null,
    reloadDuration: s0 && e0 ? +(e0.t - s0.t).toFixed(2) : null, gapNoFire: s0 && e0 ? +((shots.find((t) => t > e0.t - 1e-9) ?? NaN) - shots.filter((t) => t <= s0.t).at(-1)).toFixed(2) : null,
    totalShots: shots.length, reloads: rel.map((x) => x.phase + '@' + (x.t - t0).toFixed(2) + (x.weapon ? ':' + x.weapon : '')).join(' '), reasons,
    current: peek && { reloading: peek.reloading, mag: peek.mag, magSize: peek.magSize, reloadTotal: peek.reloadTotal },
  };
  rev4Log.heavy = out; return out;
}
function drawRev4Stub(c, e) {
  const L = e.loadout, s = L?.slots[0]; c.save(); c.translate(e.x, e.y);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(3, 5, e.r + 2, e.r * 0.8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = e.type === 'heavy' ? '#8a3a2c' : '#b8642a'; c.beginPath(); c.arc(0, 0, e.r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#0a0b0d'; c.lineWidth = 1.5; c.stroke();
  c.rotate(e.aim); c.fillStyle = '#ffb05a'; c.fillRect(e.r - 4, -3, 10, 6); c.rotate(-e.aim);
  const st = world.time < (e.staggerUntil || 0);
  c.textAlign = 'center'; c.font = '700 10px system-ui'; c.fillStyle = '#ffd08a';
  c.fillText(e.type === 'heavy' ? (L.reload ? `RELOADING ${Math.round((L.reload.t / L.reload.total) * 100)}%` : `HEAVY ${s.mag}/${s.def.mag}`) : 'FLANKER STUB', 0, -e.r - 8);
  if (st) { c.fillStyle = '#ffd34a'; c.fillText('STAGGER', 0, e.r + 14); }
  c.restore();
  if (world.time < (player.staggerUntil || 0)) { c.save(); c.textAlign = 'center'; c.font = '700 10px system-ui'; c.fillStyle = '#ffd34a'; c.fillText('STAGGER', player.x, player.y + 28); c.restore(); }
}

window.BREACH = { stageMelee, enemyMeleeTest, heavyTest, rev4Log, rev4Stubs, world, loop, camera, input, weapons, player, dummies, autoMeasure, summary, stage, release, M, emptyAmmo, refillLog, meleeLog, grenadeLog, MELEE_SPOTS, setType: (t) => { typeIdx = TYPES.indexOf(t); dummies.forEach(applyType); } };
