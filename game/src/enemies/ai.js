// Delte AI-tjenester: navigasjon, bevegelse, persepsjon, spredning, dekning- og flankevalg.
import { onScreen } from './onscreen.js';
import { lineOfSight, angleTo, dist, angleDiff, resolveCircleVsCover, clamp } from '../core/index.js';
import { turnToward, coverProtecting, segmentClear } from './geom.js';
import { NavGrid } from './nav.js';
import { walk } from './walk.js';
import { bestSpot, getSpots } from './cover.js';
import { getSquad, reserve, unreserve, requestFlank, releaseFlank, report } from './squad.js';
import { setState } from './states.js';
import { BEHAVIORS } from './behaviors/index.js';

const DEG = Math.PI / 180;
const navs = new WeakMap();
export function nav(world) {
  let n = navs.get(world);
  if (!n) { n = new NavGrid(world); navs.set(world, n); }
  return n;
}

export const behavior = (e) => BEHAVIORS[e.def.behavior] || BEHAVIORS.grunt;

/** Trussel = spilleren hvis synlig, ellers siste kjente posisjon (egen eller lagets). */
export function threat(world, e) {
  const p = world.player;
  if (!p || p.dead) return null;
  if (e.sees) return p;
  return e.known;
}

// ---------------------------------------------------------------- beslutning
export function think(world, e, opts = {}) {
  e.lastThink = world.time;
  behavior(e).think(world, e, opts);
}

/** Felles dekningsvalg (brukes av grunt og som fallback for andre). */
export function chooseCover(world, e, params = {}) {
  const t = threat(world, e);
  if (!t) return setState(world, e, 'idle');
  const d = e.def, sq = getSquad(world);
  const close = dist(e.x, e.y, t.x, t.y) < 300 || e.hp < e.maxHp * 0.5;
  const others = [];
  for (const o of world.enemies) if (o !== e && !o.dead) others.push(o.spot || o);
  const r = bestSpot(world, e, t.x, t.y, {
    front: squadFront(world, t, e),
    idealRange: params.idealRange ?? d.idealRange,
    minRange: params.minRange ?? d.minRange,
    maxRange: params.maxRange ?? d.maxRange,
    band: params.band ?? d.band,
    typeBonus: coverBonus(e, close),
    reserved: sq.reserved, others,
    current: params.reposition ? null : e.spot,
  });
  if (!r) { unreserveCover(world, e); return setState(world, e, 'hold'); }
  if (r.spot === e.spot && dist(e.x, e.y, r.spot.x, r.spot.y) < 8) return setState(world, e, 'inCover');
  if (r.spot !== e.spot) unreserveCover(world, e);
  reserve(world, e, r.spot);
  goTo(world, e, r.spot.x, r.spot.y, 'seekCover');
}

/**
 * Poeng per dekningstype. Low lar fienden skyte over kanten uten å kikke rundt hjørner (spilleren ser
 * den reise seg = ærlig varsel). Hver fiende har sin egen lowBias (0.6–1.4) så laget blander typer.
 * Nært (< 300 px) eller lav HP: high vinner.
 */
export function coverBonus(e, close) {
  const b = e.def.coverBias || { low: 0, high: 0 };
  if (close) return { low: Math.min(0, b.low), high: Math.max(0.8, b.high) };
  return { low: b.low * (e.lowBias ?? 1), high: b.high };
}

/** Lagets front: retning fra trusselen mot snittet av ikke-flankende lagkamerater (inkl. e). */
export function squadFront(world, t, e) {
  let fx = 0, fy = 0;
  for (const o of world.enemies) {
    if (o.dead || !o.def || o.state === 'flank' || o.state === 'engage') continue;
    const a = Math.atan2(o.y - t.y, o.x - t.x); fx += Math.cos(a); fy += Math.sin(a);
  }
  return fx || fy ? Math.atan2(fy, fx) : Math.atan2(e.y - t.y, e.x - t.x);
}

function unreserveCover(world, e) {
  if (e.coverHeld) {
    world.events.emit('coverExit', { entity: e, cover: e.coverHeld.cover, x: e.x, y: e.y, team: 'enemy' });
    e.coverHeld = null;
  }
  unreserve(world, e);
}

// ---------------------------------------------------------------- flanking
/** Er målet isolert / festet slik at en flanke lønner seg? */
export function flankWorthIt(world, e) {
  const sq = getSquad(world), p = world.player;
  if (!p || p.dead || !sq.known || sq.engagedSince === null) return false;
  if (world.time - sq.engagedSince < 2.5) return false;
  if (world.time - sq.known.t > 8) return false;
  const allies = (world.allies || []).filter((a) => !a.dead && dist(a.x, a.y, p.x, p.y) < 220).length;
  const isolated = allies === 0;
  // "Festet": spilleren er beskyttet mot minst én av lagkameratene
  let pinned = false;
  for (const o of world.enemies) {
    if (o === e || o.dead) continue;
    if (coverProtecting(world, o.x, o.y, p.x, p.y, p.r)) { pinned = true; break; }
  }
  return isolated && (pinned || p.hp < p.maxHp * 0.5);
}

export function tryFlank(world, e) {
  if (!requestFlank(world, e)) return false;
  const plan = planFlank(world, e);
  if (!plan) { releaseFlank(world, e, 1.5); return false; }
  unreserveCover(world, e);
  setState(world, e, 'flank', plan);
  return true;
}

export function planFlank(world, e) {
  const p = world.player, F = e.def.flank;
  // Front = retning fra spilleren mot resten av laget
  let fx = 0, fy = 0;
  for (const o of world.enemies) if (o !== e && !o.dead) { const a = angleTo(p.x, p.y, o.x, o.y); fx += Math.cos(a); fy += Math.sin(a); }
  const front = fx || fy ? Math.atan2(fy, fx) : angleTo(p.x, p.y, e.x, e.y);
  const n = nav(world);
  const cands = [];
  for (const rad of [F.ringMin, (F.ringMin + F.ringMax) / 2, F.ringMax]) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = p.x + Math.cos(a) * rad, y = p.y + Math.sin(a) * rad;
      const [cx, cy] = n.cellOf(x, y);
      if (!n.free(cx, cy)) continue;
      const b = world.bounds;
      if (x < b.x + 20 || y < b.y + 20 || x > b.x + b.w - 20 || y > b.y + b.h - 20) continue;
      if (!lineOfSight(world, x, y, p.x, p.y)) continue;
      if (coverProtecting(world, x, y, p.x, p.y, p.r)) continue; // spilleren må stå åpent herfra
      const side = Math.abs(angleDiff(front, a));              // 0 = front, PI = rett bak
      if (side < 65 * DEG) continue;
      let s = 0;
      s += side < 150 * DEG ? 2 : 1.4;                         // side best, rett bak ok
      s -= dist(e.x, e.y, x, y) / 220;
      if (p.aim !== undefined && Math.abs(angleDiff(p.aim, angleTo(p.x, p.y, x, y))) < 35 * DEG) s -= 2; // ikke inn i siktet
      cands.push({ x, y, s, a });
    }
  }
  cands.sort((u, v) => v.s - u.s);
  const aim = p.aim ?? angleTo(p.x, p.y, e.x, e.y);
  const cost = (cx, cy) => {
    const c = n.center(cx, cy);
    const d = dist(c.x, c.y, p.x, p.y);
    if (d > 520 || !lineOfSight(world, c.x, c.y, p.x, p.y)) return 0;
    let k = 1.2;                                               // synlig rute: litt dyrt
    if (Math.abs(angleDiff(aim, angleTo(p.x, p.y, c.x, c.y))) < 40 * DEG) k += 5; // i siktekjeglen: veldig dyrt
    if (Math.abs(angleDiff(front, angleTo(p.x, p.y, c.x, c.y))) < 30 * DEG) k += 2; // ikke rett gjennom fronten
    return k;
  };
  for (const c of cands.slice(0, 4)) {
    const path = n.findPath(e.x, e.y, c.x, c.y, { cost, smooth: 'light', maxNodes: 4000 });
    if (path && path.length) return { x: c.x, y: c.y, path, px: p.x, py: p.y };
  }
  return null;
}

// ---------------------------------------------------------------- bevegelse
export function stop(e) { e.path = null; e.pathIdx = 0; e.moving = false; }

export function goTo(world, e, x, y, state) {
  const path = nav(world).findPath(e.x, e.y, x, y);
  e.path = path && path.length ? path : [{ x, y }];
  e.pathIdx = 0;
  if (state) setState(world, e, state);
}

/** Følg e.path. Returnerer true når fremme. */
export function follow(world, e, dt, speed) {
  if (!e.path || e.pathIdx >= e.path.length) { e.moving = false; return true; }
  const wp = e.path[e.pathIdx];
  const last = e.pathIdx === e.path.length - 1;
  if (dist(e.x, e.y, wp.x, wp.y) < (last ? 4 : 10)) { e.pathIdx++; return follow(world, e, dt, speed); }
  steer(world, e, dt, wp.x, wp.y, speed, last);
  return false;
}

/** Gå rett mot punkt (korte avstander). true når fremme. */
export function moveDirect(world, e, dt, x, y, speed) {
  if (dist(e.x, e.y, x, y) < 4) { e.moving = false; return true; }
  steer(world, e, dt, x, y, speed, true);
  return false;
}

function steer(world, e, dt, tx, ty, speed, arrive) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  let v = speed;
  if (arrive) v = Math.min(speed, d * 6);
  e.vx = (dx / d) * v; e.vy = (dy / d) * v;
  e.moving = true;
  if (!e.sees) e.facing = turnToward(e.facing, Math.atan2(dy, dx), 8 * dt);
}

/** Kryp inn mot dekningspunktet. */
export function hug(e, dt) {
  if (!e.spot) return;
  e.x += (e.spot.x - e.x) * Math.min(1, dt * 8);
  e.y += (e.spot.y - e.y) * Math.min(1, dt * 8);
}

/** Integrer hastighet, separasjon mellom fiender og kollisjon (kjøres hver frame). */
export function integrate(world, e, dt) {
  if (!e.moving) { e.vx *= 0.7; e.vy *= 0.7; }
  // separasjon
  for (const o of world.enemies) {
    if (o === e || o.dead) continue;
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), min = e.r + o.r + 2;
    if (d > 0 && d < min) { const k = ((min - d) / d) * 0.5; e.x += dx * k; e.y += dy * k; }
  }
  e.x += e.vx * dt; e.y += e.vy * dt;
  resolveCircleVsCover(world, e);
  { const wk = walk(world); if (!wk.isWalkable(world, e.x, e.y, (e.r || 14) * 0.5)) wk.rescueStuck(world, e, e.r); wk.clampWalkable(world, e, e.r); }   // rescue kun når den er godt inne i noe (ellers rykk ved dekningskant)   // A1: ikke inn i sørmuren/skjult stripe
  if (e.moving) {
    e.walkPhase = (e.walkPhase || 0) + Math.hypot(e.vx, e.vy) * dt * 0.08;
    e.stepT = (e.stepT || 0) - dt;
    if (e.stepT <= 0) { e.stepT = 0.36; world.events.emit('footstep', { x: e.x, y: e.y, team: 'enemy', entity: e, surface: 'concrete' }); }
  }
}

// ---------------------------------------------------------------- persepsjon og sikte
export function perceive(world, e, dt) {
  const p = world.player;
  const sq = getSquad(world);
  if (!p || p.dead) { e.sees = false; return; }
  const d = dist(e.x, e.y, p.x, p.y);
  const fovOk = e.aware || Math.abs(angleDiff(e.facing, angleTo(e.x, e.y, p.x, p.y))) < 75 * DEG || d < 120;
  e.onScreen = onScreen(world, e);   // 27.10: utenfor kamerabildet = ser ikke (jakter inn mot spilleren i stedet)
  e.sees = e.onScreen && d < e.def.vision && fovOk && lineOfSight(world, e.x, e.y, p.x, p.y);
  if (e.sees) {
    e.seeT += dt; e.lostCount = 0;
    e.known = { x: p.x, y: p.y, t: world.time };
    report(world, p.x, p.y);
  } else {
    e.seeT = Math.max(0, e.seeT - dt * 1.5);
    if (sq.known && (!e.known || sq.known.t > e.known.t) && e.aware) e.known = { ...sq.known };
  }
  // målets fart (for spredning)
  if (e._lpx !== undefined) {
    const v = Math.hypot(p.x - e._lpx, p.y - e._lpy) / Math.max(dt, 1e-4);
    e.targetSpeed += (v - e.targetSpeed) * Math.min(1, dt * 6);
  }
  e._lpx = p.x; e._lpy = p.y;
  if (!e.aware && (e.sees || (sq.known && world.time - sq.known.t < 0.2 && d < 900))) {
    const delay = e.sees ? null : 0.25 + world.rng() * 0.4; // lagkamerater reagerer litt senere
    alertEnemy(world, e, delay);
  }
}

export function alertEnemy(world, e, delay = null) {
  if (e.aware || e.dead) return;
  e.aware = true;
  if (!e.known && world.player) e.known = { x: world.player.x, y: world.player.y, t: world.time };
  if (e.known && !getSquad(world).known) report(world, e.known.x, e.known.y);
  setState(world, e, 'alert', delay === null ? undefined : { delay: delay + (e.def.reaction[0]) });
}

/** Spredning i radianer (halvbredde). Avtar med vedvarende sikt, øker mot bevegelse/dekning. */
export function spreadRad(world, e) {
  const d = e.def, p = world.player;
  let s = d.spreadDeg * (1 - (1 - d.spreadMinFactor) * clamp(e.seeT / 3, 0, 1)) * DEG;
  // Sidefeil-gulv (px): selv ferdig oppvarmet sikte bommer med minst ±minErrPx (trekant) ved spilleren, uansett avstand
  // → jevn treffrate i skuddbåndet i stedet for 98 % på 8 r. Bevegelse/dekning legges OPPÅ, så de straffes mer.
  if (d.minErrPx && p) { const dd = Math.max(64, Math.hypot(p.x - e.x, p.y - e.y)); s = Math.max(s, Math.atan(d.minErrPx / dd)); }
  s += d.moveSpreadDeg * clamp(e.targetSpeed / 170, 0, 1) * DEG;
  if (p && coverProtecting(world, e.x, e.y, p.x, p.y, p.r)) s += d.coverSpreadDeg * DEG;
  return s;
}

export { getSpots, segmentClear };
