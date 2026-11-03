// Forsvarsmodus (Fiende-AI 28.10, reviews/fiende-ai-forsvarsmodus-opplegg-2026-10-28.md).
// AV som standard: gjør ingenting med mindre bølgen har `defense` (levels/data.js) eller world.defenseConfig er satt.
// Bare forsvarere (cfg.types, standard ['hunker'] spawnet ≤ 2,5 ruter fra et anker) får e.defense. Andre fiender er urørt.
// Tilstander (e.defense.mode): ANCHOR → (SHIFT) → FALLBACK → HOLD_LINE. Modusen styrer bare HVOR de står:
// ingen endring i treffsjanse, skade, HP, tokens eller sikt. Under FALLBACK skyter de ikke (straffevindu).
// Koordinater i config er i ruter (×32 ved lasting). Hooks: installDefense(world) i init, defenseTick etter behavior.tick,
// drawDefense i draw.
import { getSpots, scoreSpot } from './cover.js';
import { getSquad, reserve, unreserve } from './squad.js';
import { goTo } from './ai.js';
import { setState } from './states.js';
import { BEHAVIORS } from './behaviors/index.js';

const T = 32;
const SPOTTED = new Set(['inCover', 'suppressed', 'telegraph', 'fire']);
const MOVING = new Set(['seekCover', 'returnCover', 'hunt', 'flank', 'advance', 'reposition', 'approach', 'chase']);
export const DEFAULTS = { types: ['hunker'], anchorR: 2, holdR: 0.75, lossFrac: 0.5, insideSec: 1.5, timeoutSec: 60,
  stagger: 1.5, telegraph: 0.8, shiftNoSight: 3, shiftCd: 1.5, arriveSec: 6, axis: 'x', dir: 1 };
// Akse: 'x' (retrett øst/vest) eller 'y' (nord/sør); dir +1 = retrett mot økende koordinat. breachX/fallbackX/sideX er verdier langs aksen.
const AL = (c, x, y) => c.dir * (c.axis === 'y' ? y : x);           // «framover» langs retrettaksen
const PE = (c, x, y) => (c.axis === 'y' ? x : y);                    // tverrakse
const PT = (c, al, pe) => (c.axis === 'y' ? { x: pe, y: al } : { x: al, y: pe });   // fra rå akseverdi + tverr til punkt

const S = (world) => world._defense || (world._defense = { cfg: null, members: [], phase: 'off', t0: 0 });
export const defenseState = (world) => world._defense || null;

function toPx(c) {
  const k = { ...DEFAULTS, ...c };
  const R = (r) => r && { x0: r.x0 * T, y0: r.y0 * T, x1: r.x1 * T, y1: r.y1 * T };
  return { ...k, anchors: k.anchors.map((a) => ({ ...a, x: a.x * T, y: a.y * T, r: (a.r ?? k.anchorR) * T })),
    ring: R(k.ring), hold: R(k.holdZone), breachX: k.breachX * T, fallbackX: k.fallbackX * T,
    fallbackSpots: (k.fallbackSpots || []).map((p) => ({ x: p.x * T, y: p.y * T })),
    // sidefelt langs aksen; standard = ringens utstrekning (−8 / −1 ruter), bør settes i config
    sideX: (k.sideX || (k.axis === 'y' ? [k.ring.y0 - 8, k.ring.y1 - 1] : [k.ring.x0 - 8, k.ring.x1 - 1])).map((v) => v * T),
    sideAnchors: k.sideAnchors || [k.anchors[0].id, k.anchors[k.anchors.length - 1].id] };
}
const inRect = (r, x, y) => r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** Kobles i enemies.init. Lytter på bølgestart/slutt og innhopp. Ingen effekt uten config. */
export function installDefense(world, waveLookup) {
  const st = S(world); if (st.installed) return; st.installed = true;
  BEHAVIORS.defender ||= defenderBehavior;
  world.events.on('waveStart', (p) => {
    const raw = world.defenseConfig?.[p.id] ?? waveLookup?.(p) ?? null;
    st.cfg = raw ? toPx(raw) : null; st.members = []; st.phase = st.cfg ? 'hold' : 'off'; st.t0 = world.time;
    st.waveId = p.id; st.insideT = 0; st.log = { anchorT: 0, defT: 0, retreatAt: null, reason: null, reachedHold: 0 };
  });
  world.events.on('waveEnd', () => { st.cfg = null; st.phase = 'off'; });
  world.events.on('spawnRise', (p) => { const e = p.entity; if (e && st.cfg) enlist(world, st, e); });
}

function enlist(world, st, e) {
  const c = st.cfg; if (!c.types.includes(e.type)) return;
  let best = null, bd = 2.5 * T;
  for (const a of c.anchors) { const d = Math.hypot(a.x - e.x, a.y - e.y); if (d < bd && !st.members.some((m) => m.defense.anchor === a)) { bd = d; best = a; } }
  if (!best) return;
  e.defense = { mode: 'ANCHOR', anchor: best, home: best, shiftAt: -1e9, noSightT: 0, modeAt: world.time, baseBehavior: e.def.behavior };
  e.def = Object.create(e.def); e.def.behavior = 'defender';
  st.members.push(e);
}

// ------------------------------------------------------------------ dekningsvalg klemt til sone
function zoneOf(e) {
  const D = e.defense;
  if (D.mode === 'HOLD_LINE' || D.mode === 'FALLBACK') return { rect: D.cfg.hold };
  return { circ: D.anchor };
}
const inZone = (z, x, y) => z.rect ? inRect(z.rect, x, y) : Math.hypot(x - z.circ.x, y - z.circ.y) <= z.circ.r;

function pickSpot(world, e, z, t) {
  const sq = getSquad(world), d = e.def;
  const others = []; for (const o of world.enemies) if (o !== e && !o.dead) others.push(o.spot || o);
  const opts = { idealRange: d.idealRange, minRange: 0, maxRange: 1e9, band: null, typeBonus: { low: 1, high: 0 }, reserved: sq.reserved, others, current: e.spot };
  let best = null, bs = -Infinity;
  for (const sp of getSpots(world)) {
    if (!inZone(z, sp.x, sp.y)) continue;
    const own = sq.reserved.get(sp.id); if (own && own !== e && !own.dead) continue;
    const s = t ? scoreSpot(world, e, sp, t.x, t.y, opts) : -Math.hypot(sp.x - e.x, sp.y - e.y);
    if (s > bs) { bs = s; best = sp; }
  }
  return best;
}

function placeInZone(world, e) {
  const D = e.defense, z = zoneOf(e), p = world.player;
  const t = p && !p.dead ? (e.sees ? p : e.known || (() => { const c = D.cfg, m = c.anchors[c.anchors.length >> 1], a = D.anchor || p; return PT(c, c.axis === 'y' ? m.y - c.dir * 400 : m.x - c.dir * 400, PE(c, a.x, a.y)); })()) : null;
  const sp = pickSpot(world, e, z, t) || pickSpot(world, e, z, null);   // ingen skuddbar spot: nærmeste spot i sonen
  if (!sp) return setState(world, e, 'hold');   // ingen dekning i sonen i det hele tatt (skal ikke skje med S5-config)
  const same = e.spot && (sp === e.spot || sp.id === e.spot.id);
  if (same && Math.hypot(e.x - e.spot.x, e.y - e.spot.y) < 8) return setState(world, e, 'inCover');
  if (same && (e.state === 'seekCover' || e.state === 'returnCover')) return;   // allerede på vei mot spoten: ikke nullstill stien (28.10: ikke 'hunt' – den slapp jegere ut av sonen)
  if (e.spot && !same) unreserve(world, e);
  reserve(world, e, sp); e.spot = same ? e.spot : sp; goTo(world, e, e.spot.x, e.spot.y, 'seekCover');
}
function nearestFallback(e) {
  const L = e.defense.cfg.fallbackSpots; if (!L.length) { const c = e.defense.cfg; return PT(c, c.fallbackX, PE(c, e.x, e.y)); }
  return L.reduce((a, b) => (Math.hypot(b.x - e.x, b.y - e.y) < Math.hypot(a.x - e.x, a.y - e.y) ? b : a));
}

const defenderBehavior = {
  think(world, e, opts) {
    if (!e.defense?.cfg) return BEHAVIORS[e.defense?.baseBehavior || 'hunker'].think(world, e, opts);
    placeInZone(world, e);
  },
  tick(world, e, dt) {
    const base = BEHAVIORS[e.defense?.baseBehavior || 'hunker'], D = e.defense;
    // 28.10 (N/S-hunker 3 px fra spot): hunkerens egen flanke-/salveskift («spilleren > 70° fra coverets front») fyrte hvert bilde
    // ved sideskårene (fronten peker N/S, Warden kommer fra vest) → seekCover på nytt hele tiden. I ANCHOR/HOLD_LINE eier
    // forsvarsmodusen skår-byttet (SHIFT/solo-FALLBACK), så skiftet maskeres. Skjold, huk og alt annet i hunker.tick kjører som før.
    if (D?.cfg && (D.mode === 'ANCHOR' || D.mode === 'HOLD_LINE') && SPOTTED.has(e.state)) {
      const st = e.state, cr = e.crouch, seen = e.prevStateSeen;
      e.state = 'defMask'; e.prevStateSeen = 'defMask';
      try { base.tick?.(world, e, dt); } finally { e.state = st; e.prevStateSeen = seen; e.crouch = cr; }
      const tgt = st === 'inCover' || st === 'suppressed' ? 1 : 0;
      e.crouch = (e.crouch || 0) + (tgt - (e.crouch || 0)) * Math.min(1, dt * 10);
      if (seen !== st && st === 'fire') e.salvos = (e.salvos || 0) + 1;
      e.prevStateSeen = st;
      return;
    }
    base.tick?.(world, e, dt);
  },
};

// ------------------------------------------------------------------ per bilde (etter behavior.tick)
export function defenseTick(world, e, dt) {
  const D = e.defense; if (!D) return;
  const st = world._defense;
  if (!st?.cfg || st.phase === 'off') { // bølgen er over: tilbake til vanlig oppførsel
    e.def = Object.getPrototypeOf(e.def); e.defense = null; return;
  }
  D.cfg = st.cfg;
  if (D.mode === 'FALLBACK' || D.mode === 'RETREAT_CALL') e.lastAtkAt = world.time;   // ingen snapAttack under retrett
  if (D.mode === 'RETREAT_CALL') {
    if (world.time >= D.goAt) { D.mode = 'FALLBACK'; D.modeAt = world.time; placeInZone(world, e); }
    return;
  }
  if (D.mode === 'FALLBACK') {
    if (inRect(st.cfg.hold, e.x, e.y) && (e.state === 'inCover' || e.state === 'hold' || world.time - D.modeAt > st.cfg.arriveSec)) { D.mode = 'HOLD_LINE'; D.modeAt = world.time; st.log.reachedHold++; }
    else if (!MOVING.has(e.state) && e.state !== 'inCover' && e.state !== 'hold') placeInZone(world, e);
    else if (e.spot && !inZone(zoneOf(e), e.spot.x, e.spot.y)) placeInZone(world, e);
    return;
  }
  // ANCHOR / HOLD_LINE: håndhev sonen (hunker-skift, jakt og stuck-vakt kan peke ut av den)
  const z = zoneOf(e), tgt = e.spot || (e.path && e.path[e.path.length - 1]);
  if (MOVING.has(e.state) && tgt && !inZone(z, tgt.x, tgt.y)) { placeInZone(world, e); return; }
  if (e.state === 'hunt' || e.state === 'flank') { placeInZone(world, e); return; }
  // 28.10 flanketest: forsvarere drev ut av sonen i tilstander utenfor MOVING (f.eks. søk/forfølgelse) → hent tilbake
  if (!inZone(z, e.x, e.y) && !(MOVING.has(e.state) && tgt && inZone(z, tgt.x, tgt.y))) { placeInZone(world, e); return; }
  if (D.mode === 'ANCHOR') {
    D.noSightT = e.sees ? 0 : D.noSightT + dt;
    if (D.noSightT > st.cfg.shiftNoSight && world.time - D.shiftAt > st.cfg.shiftCd) shiftTo(world, e, neighbourToward(st, e, world.player));
  }
}

/** Lagstyring (én gang per bilde, før fiendene): utløsere, flankering, logging. */
export function defenseWorld(world, dt) {
  const st = world._defense; if (!st?.cfg || st.phase === 'off') return;
  const c = st.cfg, p = world.player, live = st.members.filter((e) => !e.dead);
  if (st.phase === 'hold') for (const e of live) if (e.defense) { st.log.defT += dt; if (e.defense.mode === 'ANCHOR' && Math.hypot(e.x - e.defense.anchor.x, e.y - e.defense.anchor.y) <= c.anchorR * T) st.log.anchorT += dt; }
  const inSpan = (c, p) => { const q = PE(c, p.x, p.y), lo = c.axis === 'y' ? c.ring.x0 : c.ring.y0, hi = c.axis === 'y' ? c.ring.x1 : c.ring.y1; return q >= lo && q <= hi; };
  if (st.phase !== 'hold' || !p || p.dead || !st.members.length) return;
  const dead = st.members.length - live.length;
  st.insideT = inRect(c.ring, p.x, p.y) ? st.insideT + dt : 0;
  let why = null;
  if (dead >= Math.max(1, Math.ceil(c.lossFrac * st.members.length))) why = 'tap';
  else if (st.insideT >= c.insideSec) why = 'inne i ringen';
  else if (AL(c, p.x, p.y) > c.dir * c.breachX && inSpan(c, p)) why = 'forbi linjen';   // bare innenfor ringens tverrbredde (ikke utenfor muren)
  else if (world.time - st.t0 >= c.timeoutSec && dead >= 1) why = 'tid';
  if (why) return callRetreat(world, st, why);
  // flankering
  const pa = c.axis === 'y' ? p.y : p.x, pp = PE(c, p.x, p.y), lo = c.axis === 'y' ? c.ring.x0 : c.ring.y0, hi = c.axis === 'y' ? c.ring.x1 : c.ring.y1;
  const side = pa >= c.sideX[0] && pa <= c.sideX[1] ? (pp < lo ? c.sideAnchors[0] : pp > hi ? c.sideAnchors[1] : null) : null;
  for (const e of live) {
    const D = e.defense; if (!D || D.mode !== 'ANCHOR') continue;
    if (AL(c, p.x, p.y) > AL(c, D.anchor.x, D.anchor.y) + 24 && e.sees) { solo(world, e); continue; }   // bak skåret og sett: denne alene trekker seg
  }
  if (side && world.time - (st.sideAt || -1e9) > c.shiftCd) {
    const a = c.anchors.find((q) => q.id === side);
    if (a && !live.some((e) => e.defense?.anchor === a)) {
      const near = live.filter((e) => e.defense?.mode === 'ANCHOR').sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y))[0];
      if (near) { shiftTo(world, near, a); st.sideAt = world.time; }
    }
  }
}

function neighbourToward(st, e, p) {
  const A = st.cfg.anchors, i = A.indexOf(e.defense.anchor); if (!p || i < 0) return null;
  const c = st.cfg, j = PE(c, p.x, p.y) < PE(c, e.x, e.y) ? i - 1 : i + 1; const a = A[j];
  return a && !st.members.some((m) => !m.dead && m.defense?.anchor === a) ? a : null;
}
function shiftTo(world, e, a) {
  if (!a || a === e.defense.anchor) return;
  e.defense.anchor = a; e.defense.shiftAt = world.time; e.defense.noSightT = 0;
  world.events.emit('defenseShift', { entity: e, to: a.id, team: 'enemy' });
  placeInZone(world, e);
}
function solo(world, e) {
  e.defense.mode = 'FALLBACK'; e.defense.modeAt = world.time; e.defense.solo = true;
  world.events.emit('defenseSoloFallback', { entity: e, team: 'enemy' });
  placeInZone(world, e);
}
function callRetreat(world, st, why) {
  st.phase = 'retreat'; st.log.retreatAt = +(world.time - st.t0).toFixed(1); st.log.reason = why;
  const p = world.player, c = st.cfg;
  const live = st.members.filter((e) => !e.dead && e.defense && e.defense.mode !== 'FALLBACK' && e.defense.mode !== 'HOLD_LINE')
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const half = Math.ceil(live.length / 2);
  live.forEach((e, i) => { const D = e.defense; D.mode = 'RETREAT_CALL'; D.callAt = world.time; D.goAt = world.time + c.telegraph + (i < half ? 0 : c.stagger); });
  world.events.emit('retreatCall', { reason: why, n: live.length, x: c.fallbackX, team: 'enemy' });
}

/** «Fall back!»-ikon over forsvarere fra ropet til de er fremme (verdenskoordinater). Ingen lyd. */
export function drawDefense(ctx, world) {
  const st = world._defense; if (!st?.members?.length) return;
  for (const e of st.members) {
    const D = e.defense; if (e.dead || !D || !(D.mode === 'RETREAT_CALL' || D.mode === 'FALLBACK')) continue;
    const y = e.y - (e.r || 14) - 30, k = 0.6 + 0.4 * Math.abs(Math.sin(world.time * 8));
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#e8b32a'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
    // pila følger retrettretningen (axis/dir); x/+1 gir samme pil som før (til høyre for teksten)
    const c = st.cfg || {}, dir = c.dir < 0 ? -1 : 1, ang = c.axis === 'y' ? dir * Math.PI / 2 : (dir > 0 ? 0 : Math.PI);
    const ax = c.axis === 'y' ? e.x - 4 : e.x - 4 + dir * 17, ay = c.axis === 'y' ? y - 4 + dir * 12 : y;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(4, 0); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
    ctx.strokeText('FALL BACK!', e.x - 4, y + 4); ctx.fillText('FALL BACK!', e.x - 4, y + 4); ctx.restore();
  }
}

