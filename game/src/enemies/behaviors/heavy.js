// Heavy: treg, mye HP og panser, minigun med oppspinning (varsel) og vedvarende sperreild.
// Når spilleren er synlig: vanlig ild. Når spilleren har gått i dekning (kjent posisjon < suppressMemory s):
// sperreild mot dekningen spilleren ligger bak – kulene stoppes av dekningen, men spilleren holdes nede
// ('suppress'-hendelse + world.player.suppression 0..1 / .suppressed som Karakter kan lese).
// Tilstander: spinup → sustain (registreres av index.js). Oppspinning er telegrafen (≥ 1 s).
import { lineOfSight, segmentRect, dist, clamp, nearestCover } from '../../core/index.js';
import { chooseCover, spreadRad, stop, nav, moveDirect } from '../ai.js';
import { setState, back, aimAt, muzzle, friendlyInLine } from '../states.js';
import { requestFire, releaseFire } from '../squad.js';
import { pick } from '../geom.js';
import { fireWeapon, isReloading, ammo } from '../weapon.js';

const DEG = Math.PI / 180;

/** Første dekning langs linja som ikke er skytterens egen (≥ 40 px fra start). → {cover, x, y, along} | null */
function firstCoverHit(world, ax, ay, bx, by, highOnly = false) {
  const L = dist(ax, ay, bx, by) || 1;
  let best = null;
  for (const c of world.cover) {
    if (highOnly && c.type !== 'high') continue;
    const t = segmentRect(ax, ay, bx, by, c);
    if (t === null || t * L < 40) continue;
    if (!best || t < best.t) best = { cover: c, t, x: ax + (bx - ax) * t, y: ay + (by - ay) * t, along: t * L };
  }
  return best;
}

/**
 * Hva kan Heavy skyte på fra (fx,fy)? → { x, y, mode: 'direct'|'suppress' } | null
 * direct: fri sikt til spilleren. suppress: sist kjente posisjon ligger tett bak dekning (≤ 90 px fra treffpunktet).
 */
export function heavyTarget(world, e, fx, fy) {
  const p = world.player;
  if (!p || p.dead) return null;
  if (lineOfSight(world, fx, fy, p.x, p.y) && lineOfSight(world, e.x, e.y, p.x, p.y) && e.sees) return { x: p.x, y: p.y, mode: 'direct' };
  const k = e.known;
  if (!k || world.time - k.t > e.def.minigun.suppressMemory) return null;
  const hit = firstCoverHit(world, fx, fy, k.x, k.y);
  if (hit && dist(hit.x, hit.y, k.x, k.y) <= 90) return { x: k.x, y: k.y, mode: 'suppress' };
  // Sist kjente punkt ligger åpent (spilleren rakk å gli inn bak noe): hamre løs på nærmeste dekning ved punktet.
  const nc = nearestCover(world, k.x, k.y, 110);
  if (!nc) return null;
  const c = nc.cover, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const h2 = firstCoverHit(world, fx, fy, cx, cy);
  if (!h2 || h2.cover !== c) return null;
  return { x: cx, y: cy, mode: 'suppress' };
}

/** Legg undertrykking på spilleren (felles API-forslag: world.events 'suppress'). */
export function applySuppress(world, e, amount) {
  const p = world.player;
  if (!p || p.dead) return;
  p.suppression = Math.min(1.5, (p.suppression || 0) + amount);
  p.suppressed = p.suppression >= 0.5;
  world.events.emit('suppress', { target: p, entity: e, source: e, amount, level: p.suppression, x: p.x, y: p.y, team: 'enemy', weapon: e.def.weapon });
}

const DUCK_FROM = new Set(['spinup', 'sustain', 'marchStep', 'inCover', 'peek', 'seekCover', 'returnCover', 'hold', 'alert', 'engage']);
/**
 * Ladepause (Våpen rev. 4: 60 skudd → 3,0 s automatisk lading). Dette er spillerens rettferdige åpning:
 * Heavy slutter å skyte, går tilbake til dekningen hvis den er nær (≤ 4 r), ellers huker den seg der den står,
 * og en Grunt får beskjed om å gi dekningsild. Varsel: 'heavyReload' {phase:'start'|'end', duration} + pose.reload
 * (grønn ring + «RELOADING»). topUp() kjøres aldri for Heavy, så ladingen kommer bare når magasinet er tomt.
 */
function reloadWatch(world, e) {
  const rl = isReloading(e);
  if (rl && !e._reloading) {
    e._reloading = true; e.reloads = (e.reloads || 0) + 1;
    const a = ammo(e);
    world.events.emit('heavyReload', { entity: e, x: e.x, y: e.y, team: 'enemy', phase: 'start', duration: a?.reloadTotal || 3 });
    requestCoverFire(world, e);
    if (DUCK_FROM.has(e.state)) setState(world, e, 'reloadDuck');
  } else if (!rl && e._reloading) {
    e._reloading = false;
    world.events.emit('heavyReload', { entity: e, x: e.x, y: e.y, team: 'enemy', phase: 'end' });
  }
}

/** Nærmeste Grunt i dekning med fersk kontakt kikker ut straks (dekningsild) – vanlig telegraf og token gjelder. */
function requestCoverFire(world, e) {
  let best = null, bd = 1e9;
  for (const o of world.enemies) {
    if (o === e || o.dead || o.type !== 'grunt' || o.state !== 'inCover' || !o.known || world.time - o.known.t > 4) continue;
    const d = dist(o.x, o.y, e.x, e.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  best.peekCd = 0; best.coverFireFor = e;
  world.events.emit('coverFire', { entity: best, for: e, x: best.x, y: best.y, team: 'enemy' });
}

const MARCH_STATES = new Set(['seekCover', 'returnCover', 'alert', 'hold']);
/**
 * Marsjild: Heavy er treg (62 px/s) og dekningen kan ligge langt unna. Har den sett spilleren i ≥ marchFireAfter s
 * uten å ha spunnet opp (eller ≥ marchFireEvery s siden forrige salve) og fortsatt er på vei, stopper den der den står
 * (nærmeste brukbare posisjon = her, med sikt/sperreild-mål) og spinner opp. Samme telegraf (≥ 1 s), samme
 * stagger-avbrudd og samme skyttertoken; etter salven går den videre til dekningen (back → returnCover).
 */
function marchFire(world, e) {
  const M = e.def.minigun;
  if (isReloading(e)) return;
  if (e.sees && e.firstSeenAt == null) e.firstSeenAt = world.time;
  if (e.state === 'spinup') { e.lastSpinupAt = world.time; if (e.firstSpinupAt == null) e.firstSpinupAt = world.time; }
  if (!MARCH_STATES.has(e.state) || e.firstSeenAt == null) return;
  if (e.state === 'alert' && e.stateT < 0.3) return;   // reaksjonstid først
  const since = e.lastSpinupAt != null ? world.time - e.lastSpinupAt : world.time - e.firstSeenAt;
  const need = e.lastSpinupAt != null ? M.marchFireEvery : M.marchFireAfter;
  if (since < need) return;
  const p = world.player;
  if (!p || p.dead || dist(e.x, e.y, p.x, p.y) > e.def.maxRange) return;
  const m = muzzle(e);
  const t = heavyTarget(world, e, m.x, m.y);
  if (t && !friendlyInLine(world, e, t.x, t.y)) return startMarchFire(world, e, t.mode);
  // Ingen fri skuddlinje herfra (lagkamerat i veien / sikt blokkert): gå til nærmeste brukbare punkt (≤ ~3 r) og skyt derfra.
  if (world.time < (e.marchSearchAt ?? 0)) return;
  e.marchSearchAt = world.time + 0.5;
  const fp = nearestFiringPoint(world, e);
  if (fp) setState(world, e, 'marchStep', fp);
}

function startMarchFire(world, e, mode) {
  if (!requestFire(world, e)) return;
  stop(e);
  e.after = 'cover'; e.marchFire = (e.marchFire || 0) + 1; e.marchBurst = true;
  world.events.emit('heavyMarchFire', { entity: e, x: e.x, y: e.y, team: 'enemy', mode, sinceSeen: world.time - e.firstSeenAt });
  setState(world, e, 'spinup');
}

/** Er linja (fx,fy)→(tx,ty) fri for lagkamerater? (som friendlyInLine, men fra et vilkårlig punkt) */
function clearOfFriends(world, e, fx, fy, tx, ty) {
  const L = dist(fx, fy, tx, ty) || 1, dx = (tx - fx) / L, dy = (ty - fy) / L;
  for (const o of world.enemies) {
    if (o === e || o.dead) continue;
    const ox = o.x - fx, oy = o.y - fy, along = ox * dx + oy * dy;
    if (along > 0 && along < L && Math.abs(ox * dy - oy * dx) < o.r + 10) return false;
  }
  return true;
}

/** Nærmeste ledige punkt (ringer på 40/72/104 px) med fri sikt til spilleren og ingen lagkamerat i skuddlinja. */
function nearestFiringPoint(world, e) {
  const p = world.player, n = nav(world);
  if (!p || p.dead || !e.known) return null;
  for (const R of [40, 72, 104]) {
    let best = null;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R;
      const c = n.cellOf(x, y);
      if (!n.free(c[0], c[1]) || !lineOfSight(world, e.x, e.y, x, y)) continue;
      if (!lineOfSight(world, x, y, p.x, p.y) || !clearOfFriends(world, e, x, y, p.x, p.y)) continue;
      const dd = dist(x, y, p.x, p.y);
      if (dd > e.def.maxRange) continue;
      if (!best || dd > best.dd) best = { x, y, dd };   // samme ring: foretrekk punktet som ikke går nærmere spilleren
    }
    if (best) return best;
  }
  return null;
}

export const heavy = {
  think(world, e, opts) { chooseCover(world, e, opts); },

  /** I dekning: sperreild mot spillerens dekning når den ikke ser ham. */
  inCover(world, e) {
    if (isReloading(e)) return true;   // ladepause: bli nede (reloadDuck tar over fra tick)
    if (e.peekCd > 0 || e.sees || !e.spot) return false;
    const pts = e.spot.type === 'low' ? [{ x: e.spot.x, y: e.spot.y }] : e.spot.peeks;
    for (const fp of pts) {
      const t = heavyTarget(world, e, fp.x, fp.y);
      if (!t) continue;
      if (!requestFire(world, e)) { e.peekCd = 0.3; return true; }
      e.after = 'cover';
      setState(world, e, 'peek', fp);
      return true;
    }
    return false;
  },

  /** Kjøres hver frame: tromlespinn (leses av tegning/lyd via pose). */
  tick(world, e, dt) {
    const spinning = e.state === 'spinup' || e.state === 'sustain';
    if (!spinning) e.spin = Math.max(0, (e.spin || 0) - dt / e.def.minigun.spinDown);
    e.spinPhase = ((e.spinPhase || 0) + (e.spin || 0) * dt * 38) % (Math.PI * 2);
    reloadWatch(world, e);
    // Etter marsjsalve: når den først kommer i dekning, kikk raskt (ellers rekker sist kjente posisjon å bli for gammel
    // til sperreild mens den går – målt: Heavy mistet spilleren og ble stående idle).
    if (e.marchBurst && e.state === 'inCover') { e.peekCd = Math.min(e.peekCd || 0, 0.4); e.marchBurst = false; }
    marchFire(world, e);
  },

  states: {
    /** Ladepause: tilbake i nær dekning eller huk der den står, ingen skudd, til Våpen er ferdig å lade. */
    reloadDuck: {
      enter(w, e) {
        releaseFire(w, e); e.spin = Math.min(e.spin || 0, 0.6); e.path = null;
        e.duckTo = e.spot && dist(e.x, e.y, e.spot.x, e.spot.y) <= 4 * 32 ? e.spot : null;
      },
      update(w, e, dt) {
        const p = w.player;
        if (p && !p.dead) aimAt(e, dt, p.x, p.y, 0.4);
        if (e.duckTo && dist(e.x, e.y, e.duckTo.x, e.duckTo.y) > 4) moveDirect(w, e, dt, e.duckTo.x, e.duckTo.y, e.def.runSpeed);
        else stop(e);
        if (!isReloading(e) || e.stateT > 6) {
          e.peekCd = 0.35;
          if (e.duckTo && e.spot === e.duckTo) return setState(w, e, 'inCover');
          return back(w, e);
        }
      },
      exit(w, e) { e.duckTo = null; },
    },
    /** Kort forflytning (≤ 1.5 s) til nærmeste punkt med fri skuddlinje, så marsjild derfra. */
    marchStep: {
      enter(w, e, fp) { e.marchPt = fp; e.path = null; },
      update(w, e, dt) {
        const fp = e.marchPt, p = w.player;
        if (!fp || !p || p.dead) return back(w, e);
        aimAt(e, dt, p.x, p.y, 0.8);
        const arrived = moveDirect(w, e, dt, fp.x, fp.y, e.def.runSpeed);
        if (arrived || e.stateT > 1.5) {
          const m = muzzle(e), t = heavyTarget(w, e, m.x, m.y);
          if (t && !friendlyInLine(w, e, t.x, t.y)) { startMarchFire(w, e, t.mode); if (e.state === 'spinup') return; }
          e.lastSpinupAt = w.time - e.def.minigun.marchFireEvery + 1.5;   // prøv igjen om litt, ikke hver frame
          return back(w, e);
        }
      },
      exit(w, e) { e.marchPt = null; },
    },
    spinup: {
      enter(w, e) {
        const M = e.def.minigun;
        e.telegraphDur = M.spinUp * (0.95 + w.rng() * 0.15);
        e.noLosT = 0; e.flankShot = false;
        w.events.emit('spinup', { entity: e, x: e.x, y: e.y, team: 'enemy', duration: e.telegraphDur, weapon: e.def.weapon });
        w.events.emit('telegraph', { entity: e, x: e.x, y: e.y, team: 'enemy', duration: e.telegraphDur, weapon: e.def.weapon, flank: false, spinup: true });
      },
      update(w, e, dt) {
        const m = muzzle(e);
        const t = heavyTarget(w, e, m.x, m.y);
        e.noLosT = t ? 0 : e.noLosT + dt;
        if (e.noLosT > 0.4) return back(w, e);
        if (t) aimAt(e, dt, t.x, t.y, 0.8);
        e.spin = Math.max(e.spin || 0, clamp(e.stateT / e.telegraphDur, 0, 1));
        if (e.stateT >= e.telegraphDur) setState(w, e, 'sustain');
      },
      exit(w, e, next) { if (next !== 'sustain') w.events.emit('spindown', { entity: e, x: e.x, y: e.y, team: 'enemy' }); },
    },
    sustain: {
      enter(w, e) {
        const M = e.def.minigun;
        e.sustainDur = pick(w, M.sustain);
        e.shotT = 0; e.suppT = 0; e.noLosT = 0;
        e.telegraphDone = e.telegraphDur; e.spin = 1;
      },
      update(w, e, dt) {
        const M = e.def.minigun, d = e.def;
        const m = muzzle(e);
        const t = heavyTarget(w, e, m.x, m.y);
        e.noLosT = t ? 0 : e.noLosT + dt;
        if (e.noLosT > 0.35 || e.stateT > e.sustainDur) {
          e.peekCd = pick(w, d.peekCooldown) * (e.fireMode === 'suppress' ? 0.6 : 1); // sperreild: kortere pause
          return back(w, e);
        }
        if (!t) return;
        // Spilleren dukket under salven: fortsett som sperreild en stund (dette er det som holder ham nede)
        if (t.mode === 'suppress' && e.fireMode === 'direct') e.sustainDur = Math.max(e.sustainDur, e.stateT + M.holdDown);
        e.fireMode = t.mode;
        aimAt(e, dt, t.x, t.y, Math.min(1, M.sweepRate / d.turnRate)); // begrenset sveip: man kan løpe fra strålen
        const hit = firstCoverHit(w, m.x, m.y, m.x + Math.cos(e.aim) * 640, m.y + Math.sin(e.aim) * 640, true);
        e.streamLen = hit ? hit.along : 640; // til tegning: strålen stopper i dekningen
        // undertrykking: strålen passerer nær spilleren
        e.suppT += dt;
        const p = w.player;
        if (e.suppT >= 0.25 && p && !p.dead) {
          e.suppT = 0;
          const c = Math.cos(e.aim), s = Math.sin(e.aim);
          const ox = p.x - m.x, oy = p.y - m.y, along = ox * c + oy * s;
          if (along > 0 && Math.abs(ox * s - oy * c) < M.suppressRadius) applySuppress(w, e, M.suppressAmount);
        }
        e.shotT -= dt;
        while (e.shotT <= 0) {
          e.shotT += M.interval;
          if (friendlyInLine(w, e, t.x, t.y)) continue;
          if (t.mode === 'direct' && !lineOfSight(w, m.x, m.y, w.player.x, w.player.y)) continue; // aldri «direkte» gjennom high cover
          const ramp = M.rampSpread * DEG * (1 - clamp(e.stateT / 0.5, 0, 1));
          const r = fireWeapon(w, e, {
            spread: spreadRad(w, e) + ramp, posture: 'hip',
            tags: { telegraphed: e.telegraphDone, losAtFire: t.mode === 'direct', suppressive: t.mode === 'suppress', enemyWeapon: d.weapon },
          });
          if (!r.fired) {
            if (r.reason === 'empty' || r.reason === 'reloading') { e.peekCd = pick(w, d.peekCooldown) * 0.5; return back(w, e); } // lader: vindu for spilleren
            e.shotT = Math.max(e.shotT, 0); break; // våpenets cooldown styrer takten
          }
        }
      },
      exit(w, e) { e.fireMode = null; w.events.emit('spindown', { entity: e, x: e.x, y: e.y, team: 'enemy' }); },
    },
  },
};
