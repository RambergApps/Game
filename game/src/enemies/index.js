// BREACH – fiende-AI (src/enemies). Offentlig API iht. docs/CORE-API.md:
//   init(world), update(dt, world), draw(ctx, world, camera), createEnemy(world, type, x, y)
// Ekstra: ENEMY_TYPES (stats), registerState (nye tilstander), getSquad (koordinator/diagnostikk),
//         pickSpawn (spawnpunkt fra world.arena.enemySpawns), poseOf (tilstandsfelt for rigg/tegning).
import { dist, lineOfSight, nearestCover } from '../core/index.js';
import { ENEMY_TYPES, displayName as nameOf, bodyOf } from './stats.js';
import { PROJ } from '../shared/projection.js';
import { STATES, setState, registerState, muzzle as muzzleOf } from './states.js';
import * as ai from './ai.js';
import { getSquad, report } from './squad.js';
import { drawEnemies, drawActor } from './render.js';
import { BEHAVIORS } from './behaviors/index.js';
import { updateGrenades, grenadeState } from './grenades.js';
import { poseOf } from './pose.js';
import { equip, updateWeapons, drawWeapons } from './weapon.js';
import { checkStagger, staggeredState } from './stagger.js';
import { huntTick } from './hunt.js';
import { onScreen, ATTACK_STATES } from './onscreen.js';
import { releaseFire } from './squad.js';
const stats = (globalThis.__breachOffscreen ||= {});
import { makeBoss, bossTick, bossInit } from './boss.js';
import { spawnWithWarning, updateSpawns, pendingSpawns, clearPendingSpawns, spawnState, _bindCreate } from './spawn.js';
import './look/index.js';   // Monsterdesign: tegning per type (eier src/enemies/look/)
registerState('staggered', staggeredState);

// Typespesifikke tilstander fra oppførslene (Heavy: spinup/sustain, Grenadier: throw)
for (const B of Object.values(BEHAVIORS)) for (const [name, def] of Object.entries(B.states || {})) registerState(name, def);

let nextId = 1;
const inited = new WeakSet();
const CORPSE_TIME = 10;

/**
 * Opprett fiende og legg den i world.enemies.
 * x/y utelatt (eller ikke tall) → pickSpawn(world): world.arena.enemySpawns hvis den finnes, ellers kant av banen.
 * opts.aware (standard true): bølgefiender vet omtrent hvor spilleren er og går rett i 'alert'
 * (med reaksjonstid). Sett aware:false for vakter som må oppdage spilleren selv.
 */
export function createEnemy(world, type, x, y, opts = {}) {
  const def = ENEMY_TYPES[type];
  if (!def) throw new Error(`Ukjent fiendetype: ${type}`);
  init(world);
  if (!Number.isFinite(x) || !Number.isFinite(y)) ({ x, y } = pickSpawn(world));
  const p = world.player;
  const facing = p ? Math.atan2(p.y - y, p.x - x) : Math.PI;
  const e = {
    id: nextId++, type, def, team: 'enemy',
    spawnX: x, spawnY: y,
    x, y, r: def.radius, hp: def.hp, maxHp: def.hp, armor: def.armor || 0, dead: false,
    vx: 0, vy: 0, facing, aim: facing,
    state: null, stateT: 0, prevState: null,
    guard: opts.aware === false, aware: false, sees: false, seeT: 0, known: null, targetSpeed: 0,
    spot: null, coverHeld: null, path: null, pathIdx: 0, moving: false,
    suppression: 0, peekCd: 0.4 + world.rng() * 0.8, crouch: 0,
    muzzleT: 0, hurtT: 0, after: 'cover',
    lowBias: 0.6 + world.rng() * 0.8,     // personlig smak for lav dekning (blander laget)
    spin: 0, spinPhase: 0,                // Heavy: tromle 0..1
    coverHitChance: undefined,            // core: treffsjanse bak lav dekning per positur (settes hver frame)
    variant: opts.variant ?? null,        // f.eks. 'alpha' (Kiln Alpha). Levels kan også sette e.variant i onSpawn; HP eies av Levels (VARIANTS.hpMul)
    displayName: null,
    bornAt: world.time || 0, riseDur: Number.isFinite(opts.rise) ? Math.max(0, opts.rise) : 0,   // innhopp: P.rise i poseOf
  };
  e.displayName = opts.displayName || nameOf(e);
  applyBody(e, world);                     // høyder i trekvart (muzzleZ/aimHeight/height) fra første frame
  equip(world, e);                         // Våpen-loadout (alle skudd via weapons.tryFire)
  world.enemies.push(e);
  setState(world, e, 'idle');
  if (opts.aware !== false && p && !p.dead) ai.alertEnemy(world, e, 0.2 + world.rng() * 0.5);
  return e;
}

/**
 * Velg spawnpunkt. Kilde: world.arena.enemySpawns ([{x,y}] eller { navn: {x,y} }), ellers banekanten
 * lengst fra spilleren. Foretrekker punkt ≥ 360 px fra spilleren uten fri sikt, og sprer innhopp
 * (straff for punkt brukt nylig). opts.near = {x,y} velger nærmeste gyldige punkt i stedet.
 */
export function pickSpawn(world, opts = {}) {
  const p = world.player, b = world.bounds;
  let pts = world.arena?.enemySpawns;
  if (pts && !Array.isArray(pts)) pts = Object.values(pts);
  pts = (pts || []).filter((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y));
  const n = ai.nav(world);
  if (!pts.length) { // fallback: rutenett langs kanten lengst fra spilleren
    const far = p ? (p.x < b.x + b.w / 2 ? 1 : 0) : 1;
    const x = far ? b.x + b.w - 48 : b.x + 48;
    for (let i = 1; i < 8; i++) pts.push({ x, y: b.y + (b.h * i) / 8 });
  }
  const used = spawnUse.get(world) || new Map();
  spawnUse.set(world, used);
  let best = null, bs = -Infinity;
  pts.forEach((q, i) => {
    const cell = n.cellOf(q.x, q.y);
    const c = n.free(cell[0], cell[1]) ? q : (() => { const f = n.nearestFree(cell[0], cell[1]); return f ? n.center(f[0], f[1]) : null; })();
    if (!c) return;
    let s = 0;
    if (opts.near) s = -dist(c.x, c.y, opts.near.x, opts.near.y);
    else if (p && !p.dead) {
      const d = dist(c.x, c.y, p.x, p.y);
      s += d < 360 ? -10 + d / 60 : Math.min(d, 900) / 300;
      if (lineOfSight(world, c.x, c.y, p.x, p.y) && d < 500) s -= 2;
    }
    s -= Math.max(0, 3 - (world.time - (used.get(i) ?? -99))) * 1.5; // spre innhopp
    s += world.rng() * 0.6;
    if (s > bs) { bs = s; best = { x: c.x, y: c.y, i }; }
  });
  if (!best) return { x: b.x + b.w - 48, y: b.y + b.h / 2, source: 'fallback' };
  used.set(best.i, world.time);
  return { x: best.x, y: best.y, source: world.arena?.enemySpawns ? 'arena' : 'fallback' };
}
const spawnUse = new WeakMap();

/**
 * Levels' boss-API (levels/index.js topp, docs/BOSS.md §5). Fase 1: stubb – tanky plassholder med hp-faser,
 * bossPhase/bossStagger/bossSummon/bossDefeated. Ukjent id → null (Levels hopper da over bølgen).
 */
export function spawnBoss(world, id, x, y, opts = {}) {
  if (!ENEMY_TYPES[id]?.bossType) return null;
  init(world);
  const e = createEnemy(world, id, x, y, { aware: true });
  return e ? makeBoss(world, e, id, opts) : null;
}

export function init(world) {
  if (inited.has(world)) return;
  inited.add(world);
  // P1 (23.10): source.x/y/entity/weapon/variant i ALLE treff fylles nå av core (combat.js hitSource, fra p.srcX/srcY som
  // fireWeapon setter). Vår midlertidige sourceForHit-lytter er fjernet.
  bossInit(world);   // bossDefeated ved bossens død (boss.js)
  // Hører spillerens skudd
  world.events.on('shot', ({ team, owner }) => {
    if (team !== 'player' || !owner) return;
    let heard = false;
    for (const e of world.enemies) {
      if (e.dead || dist(e.x, e.y, owner.x, owner.y) >= 700) continue;
      heard = true;
      if (!e.aware) ai.alertEnemy(world, e, 0.1 + world.rng() * 0.3);
    }
    // Lyden røper posisjonen: laget får oppdatert «sist kjent» (Heavy kan undertrykke den, Grenadier sikte på den).
    if (heard) report(world, owner.x, owner.y);
  });
  // Treff: undertrykking + oppmerksomhet
  world.events.on('hit', ({ target, blocked, amount }) => {
    if (blocked || !(amount > 0)) return;   // invuln-blokkert treff (core: amount 0, blocked true) gir ingen reaksjon
    if (!target || target.team !== 'enemy' || target.dead || !target.def) return;
    target.hurtT = 0.12; target.hitAt = world.time;
    target.suppression = Math.min(target.def.suppressThreshold * 2, target.suppression + 0.5 * (target.def.suppressResist ?? 1));
    if (!target.aware) ai.alertEnemy(world, target, 0.05);
  });
}

export function update(dt, world) {
  init(world);
  ai.nav(world).ensure();
  trackCamp(world);
  decayPlayerSuppression(world, dt);
  updateWeapons(dt, world);   // kun når loopen ikke har mods.weapons (testsiden); hovedspillet: loopen kaller weapons.update
  updateGrenades(dt, world);
  updateSpawns(world, createEnemy);   // innhopp med varsel (spawnWithWarning → 'spawnWarn' … createEnemy)
  for (const e of world.enemies) {
    if (!e.def) continue; // fremmede entiteter (f.eks. plassholdere) ignoreres
    if (e.dead) {
      if (e.state !== 'dead') setState(world, e, 'dead');
      STATES.dead.update(world, e, dt);
      continue;
    }
    e.stateT += dt;
    e.muzzleT = Math.max(0, e.muzzleT - dt);
    e.hurtT = Math.max(0, e.hurtT - dt);
    nearMisses(world, e);
    e.suppression = Math.max(0, e.suppression - dt * 0.55);
    ai.perceive(world, e, dt);
    bossTick(world, e);
    if (ATTACK_STATES.has(e.state) && !e.onScreen) {   // 27.10: ut av bildet under varsel/salve → avbryt, slipp token, ny vurdering
      releaseFire(world, e); stats.offscreenAbort = (stats.offscreenAbort || 0) + 1; ai.think(world, e, { reposition: true });
    }
    huntTick(world, e, dt);   // P1: jakt etter 4–6 s uten sikt + stillstands-vakthund (hunt.js)
    const p = world.player;
    if ((!p || p.dead) && e.state !== 'idle') { e.aware = false; setState(world, e, 'idle'); }
    checkStagger(world, e);   // nærkamp-stagger avbryter alt (se stagger.js)
    STATES[e.state].update(world, e, dt);
    ai.integrate(world, e, dt);
    ai.behavior(e).tick?.(world, e, dt);
    const wantCrouch = e.state === 'inCover' || e.state === 'suppressed' || e.state === 'reloadDuck' ? 1 : (e.def.moveCrouch && (e.state === 'seekCover' || e.state === 'returnCover')) ? e.def.moveCrouch : 0;
    if (e.def.moveCrouch && (e.state === 'seekCover' || e.state === 'returnCover')) e.crouch = Math.max(e.crouch, e.def.moveCrouch);   // Hunker: krøket sprint 0,5 med en gang
    e.crouch += (wantCrouch - e.crouch) * Math.min(1, dt * 10);
    e.coverHitChance = posture(e);
    applyBody(e, world);
  }
  // Rydd bort lik etter en stund (fiendemodulen eier world.enemies-listen sine fiender)
  if (world.enemies.some((e) => e.def && e.dead && e.corpseT > CORPSE_TIME)) {
    world.enemies = world.enemies.filter((e) => !(e.def && e.dead && e.corpseT > CORPSE_TIME));
  }
}

/**
 * Høyder i trekvart (stats.js BODY): e.height (Våpen bodyHitZ), e.muzzleZ (Våpen view34.muzzleZ – løpshøyde som spillerens
 * p.muzzleZ) og e.aimHeight (brysthøyde). e.aimPoint = det fienden sikter mot, i målets brysthøyde (spiller: PROJ.aimHeight).
 */
function applyBody(e, world) {
  const b = bodyOf(e);
  e.height = b.height; e.muzzleZ = b.muzzleZ; e.aimHeight = b.aimHeight;
  e.muzzle = muzzleOf(e);   // {x, y, z} som player.muzzle (x/y = samme punkt fireWeapon skyter fra)
  const p = world?.player, t = e.sees && p && !p.dead ? p : e.known;
  const tz = Number.isFinite(p?.aimHeight) ? p.aimHeight : PROJ.aimHeight;
  if (t) { if (!e.aimPoint) e.aimPoint = { x: 0, y: 0, z: 0 }; e.aimPoint.x = t.x; e.aimPoint.y = t.y; e.aimPoint.z = tz; }
  else e.aimPoint = null;
}

/**
 * Treffsjanse bak lav dekning per positur (core leser entity.coverHitChance):
 * dukket i dekning 0.12, reist opp for å skyte over lav kant 0.6, ellers core-standard (0.35).
 */
function posture(e) {
  if (e.state === 'inCover' || e.state === 'suppressed' || e.state === 'seekCover' || e.state === 'returnCover') return 0.12;
  if (e.spot?.type === 'low' && e.state !== 'flank' && e.state !== 'engage') return 0.6;
  return undefined;
}

/** Hvor lenge har spilleren ligget i samme dekning? (Grenadier bruker squad.camp) */
function trackCamp(world) {
  const p = world.player, sq = getSquad(world);
  if (!p || p.dead) { sq.camp = null; return; }
  const inCover = !!nearestCover(world, p.x, p.y, (p.r || 15) + 20);
  const c = sq.camp;
  if (!c || !inCover || !c.inCover || dist(c.x, c.y, p.x, p.y) > 56) sq.camp = { x: p.x, y: p.y, since: world.time, inCover };
  // P1 (23.10): stillestående spiller uansett dekning (Spitter kaster også mot en som står i ro)
  if (!sq.still || dist(sq.still.x, sq.still.y, p.x, p.y) > 48) sq.still = { x: p.x, y: p.y, since: world.time };
}

/** Spillerens undertrykking (fra Heavy) avtar. Feltene leses av Karakter/HUD: player.suppression, player.suppressed. */
function decayPlayerSuppression(world, dt) {
  const p = world.player;
  if (!p || !(p.suppression > 0)) return;
  p.suppression = Math.max(0, p.suppression - dt * 0.45);
  p.suppressed = p.suppression >= 0.5;
}

/** Spillerkuler som suser tett forbi gir undertrykking (suppression). */
function nearMisses(world, e) {
  for (const pr of world.projectiles) {
    if (pr.team !== 'player') continue;
    const seen = pr._supp || (pr._supp = new Set());
    if (seen.has(e.id)) continue;
    // avstand fra fiende til segmentet forrige→nå
    const ax = pr.px ?? pr.x, ay = pr.py ?? pr.y, bx = pr.x, by = pr.y;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((e.x - ax) * dx + (e.y - ay) * dy) / L2));
    if (dist(e.x, e.y, ax + dx * t, ay + dy * t) < 40) { seen.add(e.id); e.suppression = Math.min(e.def.suppressThreshold * 2, e.suppression + 0.3 * (e.def.suppressResist ?? 1)); }
  }
}

export function draw(ctx, world, camera) { drawEnemies(ctx, world, camera); drawWeapons(ctx, world, camera); }

export { ENEMY_TYPES, registerState, getSquad, STATES, poseOf, grenadeState, drawActor };
export { spawnWithWarning, pendingSpawns, clearPendingSpawns, spawnState };
export { DISPLAY_NAMES, displayName } from './stats.js';
_bindCreate((w, t, x, y, o) => createEnemy(w, t, x, y, o));
// Fiende-design: tegneregister per type/variant (se RENDER.md). Varsler/markører tegnes fortsatt av Fiende-AI.
export { registerEnemyArt, unregisterEnemyArt, getEnemyArt, listEnemyArt } from './art.js';
