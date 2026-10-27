// Testside for fiende-AI. Bruker ekte kjerne (src/core) + stubbspiller og testarena her.
import { createWorld, createInput, createCamera, createLoop, spawnProjectile, angleTo, dist, lineOfSight, resolveCircleVsCover, sparks, LOW_COVER_RANGE } from '../core/index.js';
import * as enemies from './index.js';
import { coverProtecting } from './geom.js';
import { getSquad } from './squad.js';
import { weapons as W } from './weapon.js';

const params = new URLSearchParams(location.search);
const T = 32;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const world = createWorld({ seed: Number(params.get('seed') || 7), width: 40 * T, height: 24 * T });
const camera = createCamera(canvas);
camera.zoom = 1; camera.x = world.bounds.w / 2; camera.y = world.bounds.h / 2; camera.lead = 0;
const input = createInput(canvas);
world.camera = camera; world.input = input;

// ---------------------------------------------------------------- testarena
const R = (x, y, w, h, type) => ({ x: x * T, y: y * T, w: w * T, h: h * T, type });
world.cover = [
  // spillerens side
  R(7, 10, 1, 4, 'low'),
  R(4, 4, 2, 1, 'low'),
  R(4, 19, 2, 1, 'low'),
  R(9, 2, 3, 1, 'high'),
  R(9, 21, 3, 1, 'high'),
  // midtfelt
  R(13, 5, 2, 2, 'high'),
  R(13, 17, 2, 2, 'high'),
  R(17, 7, 1, 3, 'low'),
  R(17, 14, 1, 3, 'low'),
  R(19, 10, 2, 4, 'high'),
  // fiendens side
  R(24, 6, 1, 3, 'low'),
  R(24, 15, 1, 3, 'low'),
  R(26, 11, 3, 1, 'low'),
  R(29, 3, 2, 2, 'high'),
  R(29, 19, 2, 2, 'high'),
  R(32, 9, 1, 6, 'high'),
];

// ---------------------------------------------------------------- stubbspiller
const player = {
  x: 6 * T + 6, y: 12 * T, r: 15, hp: 200, maxHp: 200, team: 'player', dead: false, aim: 0, speed: 165,
  cooldown: 0, invuln: false, bot: false, dodge: false, hold: false,
};
world.player = player;
const playerMod = {
  update(dt, w) {
    const p = w.player;
    if (p.dead) { if (input.pressed('KeyR')) respawn(); return; }
    let mx = 0, my = 0;
    if (input.down('KeyW')) my--; if (input.down('KeyS')) my++;
    if (input.down('KeyA')) mx--; if (input.down('KeyD')) mx++;
    if (p.dodge && p.dodgeFrom && w.time >= p.dodgeFrom.at) { // testbot: unngå granatmarkør etter reaksjonstid
      const f = p.dodgeFrom, dd = dist(p.x, p.y, f.x, f.y);
      if (dd < f.r + 28) { const a = Math.atan2(p.y - f.y, p.x - f.x) + (dd < 4 ? 1 : 0); mx = Math.cos(a); my = Math.sin(a); }
      else if (w.time > f.at + 3.5) p.dodgeFrom = null;
    }
    // Testbot: reaksjon på Flanker-nærkamp ('meleeCharge') etter p.reactT s: 'roll' = rull unna (kun bevegelse,
    // INGEN iframes – strengeste test), 'counter' = nærkamp tilbake (stagger), 'turn' = snu seg (ingen effekt på slaget)
    let spd = p.speed;
    const mr = p.meleeReact && p.meleeThreat;
    if (mr && w.time >= p.meleeThreat.at) {
      const e = p.meleeThreat.e;
      if (p.meleeReact === 'roll' && w.time < p.meleeThreat.at + 0.35) { const a = Math.atan2(p.y - e.y, p.x - e.x); mx = Math.cos(a); my = Math.sin(a); spd = p.speed * 2.2; }
      else if (p.meleeReact === 'counter' && !p.meleeThreat.done) { p.meleeThreat.done = true; p.aim = angleTo(p.x, p.y, e.x, e.y); playerMelee(w, p); }
      if (w.time > p.meleeThreat.at + 0.6) p.meleeThreat = null;
    }
    if (input.pressed && input.pressed('KeyF')) playerMelee(w, p);
    const l = Math.hypot(mx, my) || 1;
    p.x += (mx / l) * spd * dt; p.y += (my / l) * spd * dt;
    resolveCircleVsCover(w, p);
    p.cooldown -= dt;
    let wantFire = false;
    if (p.bot && !p.hold) {
      // Testbot: sikt på nærmeste synlige fiende, skyt korte salver
      let best = null, bd = 1e9;
      for (const e of w.enemies) if (!e.dead && lineOfSight(w, p.x, p.y, e.x, e.y)) { const d = dist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      if (best) { p.aim = angleTo(p.x, p.y, best.x, best.y); wantFire = (w.time % 1.6) < 0.5; }
    } else if (input.mouse) {
      p.aim = angleTo(p.x, p.y, input.mouse.worldX, input.mouse.worldY);
      wantFire = input.mouse.left;
    }
    if (wantFire && p.cooldown <= 0) {
      p.cooldown = 0.12;
      spawnProjectile(w, { x: p.x + Math.cos(p.aim) * 24, y: p.y + Math.sin(p.aim) * 24, angle: p.aim + (w.rng() - 0.5) * 0.06, dmg: 14, team: 'player', owner: p, speed: 1000 });
      p.flash = 0.05;
    }
    p.flash = Math.max(0, (p.flash || 0) - dt);
    p.regenT = (p.regenT || 0) + dt;
  },
  draw(ctx, w) { drawPlayer(ctx, w.player, w); },
};
/** Spillerens nærkamp via Våpen (tryMelee: 100°, 1,3 r, 50 skade, staggerUntil = tid + 0,4). Tast F / testbot. */
function playerMelee(w, p) { if (W.tryMelee(w, p, p.aim)) stats.playerMelee = (stats.playerMelee || 0) + 1; }
function respawn() { Object.assign(player, { x: 6 * T + 6, y: 12 * T, hp: player.maxHp, dead: false }); }
world.events.on('hit', ({ target, blocked }) => { if (target === player && !blocked) { player.hurt = 0.15; camera.shake(3, 120); } });
world.events.on('coverHit', ({ x, y, projectile, partial }) => sparks(world, x, y, partial ? '#d9d2c0' : '#ffb347', 5, projectile.angle + Math.PI));
world.events.on('projectileHit', ({ x, y }) => sparks(world, x, y, '#ff5040', 7));

function drawPlayer(ctx, p, w) {
  if (p.dead) {
    ctx.fillStyle = 'rgba(57,198,255,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 18, 11, 0.4, 0, Math.PI * 2); ctx.fill(); return;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 5, 17, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(p.x, p.y); ctx.rotate(p.aim);
  const r = p.r;
  ctx.fillStyle = '#1c1f22'; ctx.fillRect(-r * 0.95, -r * 0.5, r * 0.55, r);
  const g = ctx.createRadialGradient(r * 0.15, -r * 0.2, 1, 0, 0, r * 1.05);
  g.addColorStop(0, '#5a6068'); g.addColorStop(0.7, '#3a3f45'); g.addColorStop(1, '#202326');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.64, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  for (const s of [-1, 1]) { ctx.fillStyle = '#5a6068'; ctx.beginPath(); ctx.ellipse(-1, s * r * 0.82, r * 0.38, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#111'; ctx.stroke(); }
  ctx.fillStyle = '#8a7a5c'; ctx.fillRect(-r * 0.4, -2, r * 0.5, 4);
  ctx.fillStyle = '#141618'; ctx.fillRect(r * 0.05, 1.5, r * 1.6, 6);
  ctx.fillStyle = '#2a2f33'; ctx.beginPath(); ctx.arc(r * 0.05, 0, r * 0.44, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#39c6ff'; ctx.shadowColor = '#39c6ff'; ctx.shadowBlur = 8; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(r * 0.05, 0, r * 0.3, -0.7, 0.7); ctx.stroke(); ctx.restore();
  if (p.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(160,230,255,0.9)'; ctx.beginPath(); ctx.arc(r * 1.8, 4, 6, 0, Math.PI * 2); ctx.fill(); }
  if (p.hurt > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,80,60,${p.hurt * 3})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); p.hurt -= 1 / 60; }
  ctx.restore();
}

// ---------------------------------------------------------------- arena-tegning (testbane)
const floor = document.createElement('canvas');
floor.width = world.bounds.w; floor.height = world.bounds.h;
paintFloor(floor.getContext('2d'));
function paintFloor(g) {
  const W = floor.width, H = floor.height;
  g.fillStyle = '#2b2e31'; g.fillRect(0, 0, W, H);
  let s = 99; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 3); }
  for (let i = 0; i < 26; i++) { const x = rnd() * W, y = rnd() * H, r = 20 + rnd() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 4 * T) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y <= H; y += 4 * T) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.035)';
  for (let x = 1; x <= W; x += 4 * T) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  // varselstriper ved spawn-sonen
  g.save(); g.beginPath(); g.rect(W - 3 * T, 0, 6, H); g.clip();
  for (let y = -20; y < H; y += 18) { g.fillStyle = '#c9a227'; g.beginPath(); g.moveTo(W - 3 * T, y); g.lineTo(W - 3 * T + 6, y + 6); g.lineTo(W - 3 * T + 6, y + 14); g.lineTo(W - 3 * T, y + 8); g.fill(); }
  g.restore();
  g.fillStyle = 'rgba(201,162,39,0.08)'; g.fillRect(W - 3 * T + 6, 0, 3 * T, H);
}
function stripes(ctx, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#c9a227';
  for (let i = -h; i < w + h; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + 6, y); ctx.lineTo(x + i + 6 - h, y + h); ctx.lineTo(x + i - h, y + h); ctx.fill(); }
  ctx.restore();
}
const arenaMod = {
  draw(ctx, w) {
    ctx.drawImage(floor, 0, 0);
    // lyskjegler
    for (const [lx, ly] of [[10 * T, 12 * T], [22 * T, 4 * T], [22 * T, 20 * T], [34 * T, 12 * T]]) {
      const gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, 230); gr.addColorStop(0, 'rgba(255,179,71,0.10)'); gr.addColorStop(1, 'rgba(255,179,71,0)');
      ctx.fillStyle = gr; ctx.fillRect(lx - 230, ly - 230, 460, 460);
    }
  },
  drawCover(ctx, w) {
    for (const c of w.cover) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const sh = c.type === 'high' ? 10 : 5;
      ctx.fillRect(c.x + sh * 0.6, c.y + sh, c.w, c.h);
      if (c.type === 'high') {
        const g = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h); g.addColorStop(0, '#565c61'); g.addColorStop(1, '#2f3337');
        ctx.fillStyle = g; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = '#3d4246'; ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
        for (let x = c.x + 10; x < c.x + c.w - 6; x += 10) { ctx.beginPath(); ctx.moveTo(x + 0.5, c.y + 5); ctx.lineTo(x + 0.5, c.y + c.h - 5); ctx.stroke(); }
        ctx.strokeStyle = '#6a7177'; ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
        ctx.fillStyle = '#ffb347'; ctx.fillRect(c.x + 3, c.y + 3, 3, 3);
      } else {
        ctx.fillStyle = '#4a4d50'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = '#5b5f62'; ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
        const horiz = c.w >= c.h;
        if (horiz) stripes(ctx, c.x + 2, c.y + c.h / 2 - 3, c.w - 4, 6); else stripes(ctx, c.x + c.w / 2 - 3, c.y + 2, 6, c.h - 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      }
    }
  },
  drawTop(ctx, w) {
    // vignett
    const W = w.bounds.w, H = w.bounds.h;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
};
const hud = {
  draw(ctx, w) {
    const p = w.player;
    const H = w.bounds.h;
    ctx.fillStyle = 'rgba(10,11,12,0.75)'; ctx.fillRect(14, H - 44, 230, 30);
    ctx.fillStyle = '#39c6ff'; ctx.font = 'bold 11px system-ui'; ctx.fillText('PLAYER', 22, H - 25);
    ctx.fillStyle = '#222'; ctx.fillRect(80, H - 34, 150, 10);
    ctx.fillStyle = p.hp > p.maxHp * 0.3 ? '#39c6ff' : '#ff5a3c'; ctx.fillRect(80, H - 34, 150 * (p.hp / p.maxHp), 10);
    if (p.suppression > 0.05) { // undertrykking fra Heavy (player.suppression) – testvisning
      ctx.fillStyle = 'rgba(10,11,12,0.75)'; ctx.fillRect(14, H - 74, 230, 24);
      ctx.fillStyle = p.suppressed ? '#ff7a1a' : '#8a9096'; ctx.fillText(p.suppressed ? 'SUPPRESSED' : 'suppression', 22, H - 57);
      ctx.fillStyle = '#222'; ctx.fillRect(110, H - 66, 120, 8);
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(110, H - 66, 120 * Math.min(1, p.suppression), 8);
    }
    const alive = w.enemies.filter((e) => !e.dead).length;
    ctx.fillStyle = 'rgba(10,11,12,0.75)'; ctx.fillRect(w.bounds.w - 150, 14, 136, 30);
    ctx.fillStyle = '#ffb347'; ctx.fillText(`HOSTILES  ${alive}`, w.bounds.w - 140, 33);
    if (p.dead) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, w.bounds.w, w.bounds.h); ctx.fillStyle = '#ff5a3c'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center'; ctx.fillText('YOU ARE DOWN – press R', w.bounds.w / 2, w.bounds.h / 2); ctx.textAlign = 'left'; }
  },
};

// ?weapons=1: registrer Breach Våpen (granater, treffeffekter) slik hovedspillet vil gjøre det – tester Våpen-stien i grenades.js
const weapons = params.has('weapons') ? await import('../weapons/index.js').catch(() => null) : null;
if (weapons) { world.modules = { ...(world.modules || {}), weapons }; weapons.init?.(world); }
const loop = createLoop({ world, ctx, camera, input, mods: { player: playerMod, arena: arenaMod, hud,
  enemies: weapons ? { ...enemies, draw(c, w, cam) { enemies.draw(c, w, cam); weapons.draw(c, w, cam); } } : enemies,
  physics: weapons ? { update: (dt, w) => weapons.update(dt, w) } : undefined } });
enemies.init(world);

// ---------------------------------------------------------------- spawn
// Testarenaens spawnpunkter i samme format som Arena (world.arena.enemySpawns, px). createEnemy uten x/y bruker dem.
const SPAWNS = [[37, 4], [37, 9], [37, 12], [37, 15], [37, 20], [35, 7], [35, 17]];
world.arena = { id: 'enemies-test', enemySpawns: SPAWNS.map(([x, y]) => ({ x: x * T, y: y * T })) };
function spawn(type, x, y) { return enemies.createEnemy(world, type, x, y); }
function squad() {
  spawn('grunt', 37 * T, 6 * T); spawn('grunt', 37 * T, 12 * T); spawn('grunt', 37 * T, 18 * T);
  spawn('flanker', 36 * T, 3 * T); spawn('flanker', 36 * T, 21 * T);
}
function mixed() { spawn('grunt'); spawn('grunt'); spawn('heavy'); spawn('grenadier'); spawn('flanker'); }

// ---------------------------------------------------------------- testmåling
const stats = {
  byType: {}, shotsProtected: 0, hitsProtected: 0, shots: 0, shotsNoLos: 0, shotsNoTelegraph: 0, minTelegraph: Infinity,
  playerHits: 0, highCoverStops: 0, partialCoverStops: 0, maxFlanking: 0, maxShooters: 0, errors: [],
  flank: { shots: 0, hits: 0, telegraphs: 0, minTelegraph: Infinity },
  coverTime: {},          // { type: { low: s, high: s } } tid i dekning per type
  coverEnters: {},        // { type: { low: n, high: n } }
  suppressive: { shots: 0, events: 0, maxLevel: 0, suppressedTime: 0 },
  spinups: [], heavyShotsNoSpin: 0,
  shotRange: {},          // { type: { '0-4': n, '4-8': n, '8-12': n, '12-16': n, '16+': n } } skuddhold i ruter (skytter → spiller)
  grenade: { windups: 0, throws: 0, explosions: 0, warn: [], dmgToPlayer: 0, hitsOnPlayer: 0, firstWindupAt: null, enRoute: 0 },
};
world.events.on('shot', ({ projectile: p, team }) => {
  if (team !== 'enemy') return;
  if (p.owner && world.time < (p.owner.staggerUntil ?? -1)) stats.stagger.shotsDuring++; // telemetri fra weapon.js (tryFire sender 'shot' før vi får kula tilbake)
  stats.shots++;
  const bt = stats.byType[p.owner?.type] || (stats.byType[p.owner?.type] = { shots: 0, hits: 0 });
  bt.shots++;
  { const r = dist(p.owner?.x ?? p.x, p.owner?.y ?? p.y, player.x, player.y) / 32, k = r < 4 ? '0-4' : r < 8 ? '4-8' : r < 12 ? '8-12' : r < 16 ? '12-16' : '16+';
    const sr = stats.shotRange[p.owner?.type] || (stats.shotRange[p.owner?.type] = { '0-4': 0, '4-8': 0, '8-12': 0, '12-16': 0, '16+': 0 }); sr[k]++; }
  p._prot = !!coverProtecting(world, p.x, p.y, player.x, player.y, player.r);
  if (p._prot) stats.shotsProtected++;
  if (p.flank) stats.flank.shots++;
  if (p.owner?.type === 'heavy' && !(p.telegraphed >= 0.9)) stats.heavyShotsNoSpin++;
  if (p.suppressive) stats.suppressive.shots++;
  else if (!lineOfSight(world, p.x, p.y, player.x, player.y)) stats.shotsNoLos++;
  if (!(p.telegraphed >= 0.4)) stats.shotsNoTelegraph++;
  stats.minTelegraph = Math.min(stats.minTelegraph, p.telegraphed ?? 0);
});
world.events.on('projectileHit', ({ projectile: p, target }) => {
  if (target !== player) return;
  stats.playerHits++;
  if (stats.byType[p.owner?.type]) stats.byType[p.owner.type].hits++;
  if (p._prot) stats.hitsProtected++;
  if (p.flank) stats.flank.hits++;
});
world.events.on('telegraph', ({ flank, duration, spinup }) => {
  if (flank) { stats.flank.telegraphs++; stats.flank.minTelegraph = Math.min(stats.flank.minTelegraph, duration); }
  if (spinup) stats.spinups.push(+duration.toFixed(2));
});
world.events.on('coverEnter', ({ entity, cover }) => {
  const c = stats.coverEnters[entity.type] || (stats.coverEnters[entity.type] = { low: 0, high: 0 });
  c[cover.type]++;
});
world.events.on('suppress', ({ level }) => { stats.suppressive.events++; stats.suppressive.maxLevel = Math.max(stats.suppressive.maxLevel, level); });
stats.melee = { charges: 0, strikes: 0, hits: 0, minCharge: Infinity, interrupted: 0, shotsNear: 0, nonHolder: 0, dodged: 0 };
stats.stagger = { events: 0, heavyDur: [], otherDur: [], shotsDuring: 0, spinupInterrupted: 0, telegraphInterrupted: 0 };
world.events.on('meleeCharge', ({ entity, duration }) => {
  stats.melee.charges++; stats.melee.minCharge = Math.min(stats.melee.minCharge, duration);
  if (!getSquad(world).flankers.has(entity)) stats.melee.nonHolder++;
  if (world.time - (entity.lastFireAt ?? -99) < 0.6) stats.melee.shotsNear++;
  if (player.meleeReact) player.meleeThreat = { e: entity, at: world.time + (player.reactT ?? 0.25) };
});
world.events.on('melee', ({ entity, phase, targets, team }) => {
  if (phase !== 'hit') return;
  if (team === 'enemy') { stats.melee.strikes++; if (targets?.includes(player)) stats.melee.hits++; }
  else if (entity === player) stats.playerMeleeHits = (stats.playerMeleeHits || 0) + (targets?.length || 0);
});
world.events.on('enemyStagger', ({ entity, duration, interrupted }) => {
  stats.stagger.events++; (entity.type === 'heavy' ? stats.stagger.heavyDur : stats.stagger.otherDur).push(+duration.toFixed(2));
  if (interrupted === 'spinup') stats.stagger.spinupInterrupted++;
  if (interrupted === 'telegraph' || interrupted === 'meleeCharge') stats.stagger.telegraphInterrupted++;
  if (interrupted === 'meleeCharge') stats.melee.interrupted++;
});
const windupAt = new Map();
world.events.on('grenadeWindup', ({ entity, x, y, radius }) => {
  stats.grenade.windups++; windupAt.set(entity, world.time);
  if (stats.grenade.firstWindupAt == null) stats.grenade.firstWindupAt = +world.time.toFixed(2);
  if (entity && entity.prevState && entity.prevState !== 'inCover') stats.grenade.enRoute++;
  if (player.dodge) player.dodgeFrom = { x, y, r: radius, at: world.time + 0.35 };
});
world.events.on('grenade', ({ phase, team }) => { if (team === 'enemy' && phase !== 'land') stats.grenade.throws++; });
let lastExplosion = -1;
world.events.on('explosion', ({ entity, hits }) => {
  stats.grenade.explosions++; lastExplosion = world.time;
  for (const h of hits || []) if (h.target === player) { stats.grenade.dmgToPlayer += h.amount; stats.grenade.hitsOnPlayer++; } // Våpen: skade før hendelsen
  if (windupAt.has(entity)) stats.grenade.warn.push(+(world.time - windupAt.get(entity)).toFixed(2));
});
world.events.on('hit', ({ target, amount }) => {
  if (target === player && world.time === lastExplosion) { stats.grenade.dmgToPlayer += amount; stats.grenade.hitsOnPlayer++; }
});
world.events.on('coverHit', ({ projectile, partial }) => { if (projectile.team === 'enemy') partial ? stats.partialCoverStops++ : stats.highCoverStops++; });
function track() {
  const fl = world.enemies.filter((e) => !e.dead && (e.state === 'flank' || e.state === 'engage')).length;
  stats.maxFlanking = Math.max(stats.maxFlanking, fl);
  const sh = world.enemies.filter((e) => !e.dead && (e.state === 'telegraph' || e.state === 'fire')).length;
  stats.maxShooters = Math.max(stats.maxShooters, sh);
  for (const e of world.enemies) {
    if (e.dead || !e.spot || !['inCover', 'peek', 'telegraph', 'fire', 'spinup', 'sustain', 'throw', 'suppressed'].includes(e.state)) continue;
    const c = stats.coverTime[e.type] || (stats.coverTime[e.type] = { low: 0, high: 0 });
    c[e.spot.type] += 1 / 60;
  }
  if (player.suppressed) stats.suppressive.suppressedTime += 1 / 60;
}

// ---------------------------------------------------------------- UI
const $ = (id) => document.getElementById(id);
$('sp-grunt').onclick = () => spawn('grunt');
$('sp-flanker').onclick = () => spawn('flanker');
$('sp-heavy').onclick = () => spawn('heavy');
$('sp-grenadier').onclick = () => spawn('grenadier');
$('sp-hunker').onclick = () => spawn('hunker');
// ?spawn=hunker[,grunt…] → spawner typene ved oppstart (Monsterdesign-skjermbilder)
for (const t of (params.get('spawn') || '').split(',').filter(Boolean)) spawn(t);
$('sp-squad').onclick = squad;
$('sp-mixed').onclick = mixed;
$('clear').onclick = () => { world.enemies.length = 0; };
const toggle = (id, get, set) => { const b = $(id); const sync = () => b.classList.toggle('on', !!get()); b.onclick = () => { set(!get()); sync(); }; sync(); return sync; };
const syncDebug = toggle('debug', () => world.debug, (v) => (world.debug = v));
toggle('god', () => player.invuln, (v) => (player.invuln = v));
toggle('pause', () => world.paused, (v) => (world.paused = v));
addEventListener('keydown', (e) => { if (e.code === 'F1') { e.preventDefault(); setTimeout(syncDebug, 30); } });
setInterval(() => {
  $('states').textContent = world.enemies.filter((e) => !e.dead).map((e) => `${(e.def.displayName || e.def.name).padEnd(8)} #${String(e.id).padEnd(3)} ${e.state}`).join('\n') || '(none)';
}, 200);

// ---------------------------------------------------------------- kjøring
const manual = params.has('manual');
const origStep = loop.step;
if (!manual) {
  // wrap for måling i sanntid
  const raf = () => { track(); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  loop.start();
  if (params.has('squad')) squad();
  if (params.has('mixed')) mixed();
} else loop.render();

/** API for headless-tester. */
window.__bt = {
  world, loop, stats, player, spawn, squad, mixed, enemies,
  step(seconds) { const n = Math.round(seconds * 60); for (let i = 0; i < n; i++) { loop.step(1 / 60); track(); } loop.render(); },
  setPlayer(x, y, aim) { player.x = x; player.y = y; if (aim !== undefined) player.aim = aim; },
  setDebug(v) { world.debug = v; syncDebug(); loop.render(); },
  /** Zoom kameraet inn på et punkt (for nærbilder i tester). zoom=1 tilbakestiller. */
  view(x, y, zoom) {
    if (zoom === 1 || zoom === undefined) { camera.zoom = 1; camera.x = world.bounds.w / 2; camera.y = world.bounds.h / 2; }
    else { camera.zoom = zoom; camera.x = x; camera.y = y; }
    loop.render();
  },
  setGod(v) { player.invuln = v; },
  setBot(v) { player.bot = v; },
  setHold(v) { player.hold = v; },
  setDodge(v) { player.dodge = v; },
  setMeleeReact(v, reactT = 0.25) { player.meleeReact = v; player.reactT = reactT; },
  playerMelee() { playerMelee(world, player); },
  setCover(list) { world.cover = list.map(([x, y, w, h, type]) => R(x, y, w, h, type)); },
  snapshot() {
    return world.enemies.map((e) => ({ id: e.id, type: e.type, variant: e.variant ?? null, displayName: e.displayName || null, maxHp: Math.round(e.maxHp), state: e.state, x: Math.round(e.x), y: Math.round(e.y), dead: e.dead, hp: Math.round(e.hp), spot: e.spot ? { id: e.spot.id, type: e.spot.type } : null, sees: e.sees, spin: +(e.spin || 0).toFixed(2) }));
  },
};

/** Felles testrigg-kontrakt (PROSJEKT.md): eksponer world. */
window.BREACH = Object.assign(window.BREACH || {}, { world });
