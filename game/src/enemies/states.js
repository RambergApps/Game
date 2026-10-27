// Generell tilstandsmaskin for alle fiendetyper.
// Tilstander: idle, alert, seekCover, inCover, peek, telegraph, fire, returnCover,
//             suppressed, hold, flank, engage, dead.
// Typespesifikke tilstander (Heavy: spinup/sustain, Grenadier: throw) ligger i behaviors/*.js
// som `states: {…}` og registreres av index.js via registerState().
// Typespesifikke valg ligger i behaviors/*.js (think + valgfrie hooks), tall i stats.js.
import { lineOfSight, angleTo, dist, angleDiff } from '../core/index.js';
import { fireWeapon, topUp, muzzleXY } from './weapon.js';
import { turnToward, pick, coverProtecting } from './geom.js';
import { protection, firingPoint } from './cover.js';
import { requestFire, releaseFire, releaseFlank, getSquad, releaseAll } from './squad.js';
import * as ai from './ai.js';
import { HUNT } from './stats.js';
import { onScreen, ATTACK_STATES } from './onscreen.js';

const DEG = Math.PI / 180;
export const STATES = {};
export function registerState(name, def) { STATES[name] = def; }

export function setState(world, e, name, data) {
  // 27.10: ingen varsel/angrep fra utenfor kamerabildet – vent i 'hold' (jakt-logikken flytter den inn mot spilleren)
  if (ATTACK_STATES.has(name) && !onScreen(world, e)) { releaseFire(world, e); if (e.state === 'hold') return; name = 'hold'; data = undefined; }
  // Hunker 27.10: peek/fire KUN fra dekningsplassen, i rekkefølgen dukket (cover 1) → telegraph (peek) → fire
  if (e.type === 'hunker' && (name === 'telegraph' || name === 'fire')) {
    const at = e.spot && Math.hypot(e.x - e.spot.x, e.y - e.spot.y) < 10;
    const ok = at && (name === 'telegraph' ? (e.state === 'inCover' || e.state === 'suppressed' || e.state === 'peek') : e.state === 'telegraph');
    if (!ok) { releaseFire(world, e); name = e.spot ? (at ? 'inCover' : 'seekCover') : 'hold'; data = undefined; if (e.state === name) return; }
  }
  const prev = STATES[e.state];
  if (prev && prev.exit) prev.exit(world, e, name);
  e.prevState = e.state;
  e.state = name;
  e.stateT = 0;
  const next = STATES[name];
  if (!next) throw new Error(`Ukjent fiendetilstand: ${name}`);
  if (next.enter) next.enter(world, e, data);
}

// ---------------------------------------------------------------- hjelpere
export function threatPos(world, e) {
  const p = world.player;
  if (e.sees && p) return p;
  return e.known;
}

export function aimAt(e, dt, tx, ty, rateMul = 1) {
  const a = angleTo(e.x, e.y, tx, ty);
  e.aim = turnToward(e.aim, a, e.def.turnRate * rateMul * dt);
  e.facing = e.aim;
}

export function muzzle(e) {
  const m = muzzleXY(e);   // Hunker: HUNKER_MUZZLE fwd/side (weapon.js)
  return { x: m.x, y: m.y, z: e.muzzleZ ?? 0 };   // z: løpshøyde (stats.js BODY)
}

/** Vil skuddet treffe en lagkamerat først? */
export function friendlyInLine(world, e, tx, ty) {
  const m = muzzle(e);
  const L = dist(m.x, m.y, tx, ty) || 1;
  const dx = (tx - m.x) / L, dy = (ty - m.y) / L;
  for (const o of world.enemies) {
    if (o === e || o.dead) continue;
    const ox = o.x - m.x, oy = o.y - m.y, along = ox * dx + oy * dy;
    if (along <= 0 || along >= L) continue;
    if (Math.abs(ox * dy - oy * dx) < o.r + 6) return true;
  }
  return false;
}

export function back(world, e) {
  releaseFire(world, e);
  e.lastAtkAt = world.time;
  if (e.after === 'engage') return setState(world, e, 'engage');
  if (e.after === 'hold') return setState(world, e, 'hold');
  if (e.spot) return setState(world, e, 'returnCover');
  return ai.think(world, e);
}

// ---------------------------------------------------------------- tilstander
registerState('idle', {
  enter(w, e) { ai.stop(e); },
  update(w, e, dt) { e.facing += Math.sin(w.time * 0.7 + e.id) * 0.2 * dt; e.aim = e.facing; },
});

registerState('alert', {
  enter(w, e, d) { ai.stop(e); e.alertT = d?.delay ?? pick(w, e.def.reaction); },
  update(w, e, dt) {
    const t = threatPos(w, e);
    if (t) aimAt(e, dt, t.x, t.y, 1.5);
    if (e.stateT >= e.alertT) ai.think(w, e);
    // Utgang (Test 26.10: Kiln 37 s i alert): fant think() ingen ny tilstand, gå til hold (skyter/jakter derfra)
    if (e.state === 'alert' && e.stateT >= e.alertT + 1) setState(w, e, 'hold');
  },
});


/** Sikt→angrep ≤ 4 s (Test 26.10): har den sett spilleren sammenhengende i SNAP_AFTER s uten å angripe (f.eks. lang vei
 *  til dekning eller flankrute), stopper den og angriper der den står; etterpå fortsetter den til dekningen (returnCover). */
const SNAP_AFTER = 2.4;
function snapAttack(w, e) {
  if (!e.sees || e.sightSince == null) return false;
  const since = w.time - Math.max(e.sightSince, e.lastAtkAt ?? -1e9);
  if (since < SNAP_AFTER || !requestFire(w, e, { ignoreGap: true })) return false;
  ai.stop(e); e.after = e.state === 'flank' ? 'engage' : 'cover';
  w.events.emit('snapAttack', { entity: e, x: e.x, y: e.y, team: 'enemy', since: +since.toFixed(2) });
  setState(w, e, e.def.attackState || 'telegraph');
  return true;
}

registerState('seekCover', {
  enter(w, e) { e.recheckT = 0; },
  update(w, e, dt) {
    const t = threatPos(w, e);
    const arrived = ai.follow(w, e, dt, e.def.runSpeed);
    if (t && e.sees) { e.facing = angleTo(e.x, e.y, t.x, t.y); e.aim = turnToward(e.aim, e.facing, e.def.turnRate * dt); }
    if (arrived) return setState(w, e, 'inCover');
    if (snapAttack(w, e)) return;
    e.recheckT += dt;
    if (e.recheckT > 0.6 && t) {
      e.recheckT = 0;
      if (protection(w, e.spot, t.x, t.y) < 0.34) return ai.think(w, e);
    }
    if (e.stateT > 8) ai.think(w, e);
  },
});

registerState('inCover', {
  enter(w, e) {
    ai.stop(e);
    e.badCoverT = 0; e.checkT = 0;
    if (e.coverHeld !== e.spot) {
      e.coverHeld = e.spot; e.coverSince = w.time;
      e.repositionAt = w.time + pick(w, e.def.repositionAfter);
      w.events.emit('coverEnter', { entity: e, cover: e.spot.cover, x: e.x, y: e.y, team: 'enemy' });
    }
  },
  update(w, e, dt) {
    if (!e.spot) return ai.think(w, e);
    ai.hug(e, dt);
    const t = threatPos(w, e);
    if (t) aimAt(e, dt, t.x, t.y, 0.6);
    if (e.suppression >= e.def.suppressThreshold) return setState(w, e, 'suppressed');
    topUp(w, e); // lad i ly
    // Er dekningen fortsatt god?
    e.checkT += dt;
    if (t && e.checkT > 0.25) {
      e.checkT = 0;
      e.badCover = protection(w, e.spot, t.x, t.y) < 0.67;
    }
    e.badCoverT = e.badCover ? e.badCoverT + dt : 0;
    if (e.badCoverT > 0.6) { e.badCover = false; return ai.think(w, e, { reposition: true }); }
    if (w.time > e.repositionAt) { e.repositionAt = w.time + pick(w, e.def.repositionAfter); return ai.think(w, e, { reposition: true }); }
    // Typespesifikk hook (f.eks. flanker vurderer å flanke)
    const B = ai.behavior(e);
    if (B.inCover && B.inCover(w, e, dt) === true) return;
    // Kikk ut og skyt
    e.peekCd -= dt;
    const age = w.time - (e.known?.t ?? -99);
    if (age > 7 && !e.sees) { // mistet kontakt: ny vinkel mot siste kjente posisjon. Glemmer ALDRI (P1 23.10) – jakten i hunt.js tar over etter 4–6 s
      e.lostCount = (e.lostCount || 0) + 1;
      if (e.known && (HUNT.enabled || e.lostCount <= 3)) e.known = { x: e.known.x, y: e.known.y, t: w.time - 4.5, lost: true };
      else if (!HUNT.enabled) e.known = null;   // gammel oppførsel (kun før/etter-måling)
      return ai.think(w, e, { reposition: true });
    }
    if (e.peekCd <= 0 && t && age < 7) {
      const fp = firingPoint(w, e.spot, t.x, t.y);
      if (!fp) { e.noShotT = (e.noShotT || 0) + dt; if (e.noShotT > 2.5) { e.noShotT = 0; ai.think(w, e, { reposition: true }); } return; }
      e.noShotT = 0;
      if (requestFire(w, e)) { e.after = 'cover'; setState(w, e, 'peek', fp); }
      else e.peekCd = 0.2 + w.rng() * 0.3;
    }
  },
});

registerState('peek', {
  enter(w, e, fp) { e.firePoint = fp; },
  update(w, e, dt) {
    const fp = e.firePoint;
    const t = threatPos(w, e);
    if (t) aimAt(e, dt, t.x, t.y);
    const there = ai.moveDirect(w, e, dt, fp.x, fp.y, e.def.speed);
    if (there) return setState(w, e, e.def.attackState || 'telegraph');
    if (e.stateT > 1.2) back(w, e);
  },
});

registerState('telegraph', {
  enter(w, e) {
    ai.stop(e);
    e.telegraphDur = e.def.telegraph * (0.9 + w.rng() * 0.25);
    e.flankShot = e.after === 'engage';
    if (e.flankShot) e.flankVolleys = (e.flankVolleys || 0) + 1;
    if (e.flankShot) { // skudd fra flanke/bakfra: lengre og tydeligere varsel (+ retningsmarkør ved spilleren)
      const F = e.def.flank || {};
      e.telegraphDur *= e.engageBursts ? (F.telegraphMulNext ?? 1.3) : (F.telegraphMul ?? 1.75);
    }
    e.noLosT = 0;
    const p = w.player;
    w.events.emit('telegraph', {
      entity: e, x: e.x, y: e.y, team: 'enemy', duration: e.telegraphDur, weapon: e.def.weapon,
      flank: e.flankShot, target: p || null, dir: p ? angleTo(p.x, p.y, e.x, e.y) : null, // dir: fra spilleren mot skytteren
    });
  },
  update(w, e, dt) {
    const p = w.player;
    if (!p || p.dead) return back(w, e);
    const m = muzzle(e);
    const los = lineOfSight(w, m.x, m.y, p.x, p.y) && lineOfSight(w, e.x, e.y, p.x, p.y);
    e.noLosT = los ? 0 : e.noLosT + dt;
    if (e.noLosT > 0.25) return back(w, e);
    aimAt(e, dt, p.x, p.y);
    if (e.stateT >= e.telegraphDur) setState(w, e, 'fire');
  },
});

registerState('fire', {
  enter(w, e) {
    const [a, b] = (e.flankShot && e.def.flank?.burst) || e.def.burst;
    e.burstLeft = a + Math.floor(w.rng() * (b - a + 1));
    e.shotT = 0;
    e.telegraphDone = e.telegraphDur;
  },
  update(w, e, dt) {
    const p = w.player;
    if (!p || p.dead) return back(w, e);
    aimAt(e, dt, p.x, p.y, 0.45);       // sikter etter, men tregere under salven
    e.shotT -= dt;
    if (e.shotT > 0) return;
    const m = muzzle(e);
    if (!lineOfSight(w, m.x, m.y, p.x, p.y) || !lineOfSight(w, e.x, e.y, p.x, p.y)) return back(w, e); // aldri gjennom high cover
    if (friendlyInLine(w, e, p.x, p.y)) { e.shotT = 0.12; if (e.stateT > 1.5) back(w, e); return; }
    const d = e.def;
    const spread = ai.spreadRad(w, e) * (e.flankShot ? (d.flank?.spreadMul ?? 1) : 1);
    // Skuddet går gjennom Våpen (tryFire). Telegraf, LOS og token er sjekket over.
    const r = fireWeapon(w, e, {
      spread, posture: 'aim',
      tags: { telegraphed: e.telegraphDone, losAtFire: true, flank: e.flankShot, enemyWeapon: d.weapon },
    });
    if (!r.fired) {
      if (r.reason === 'empty' || r.reason === 'reloading') { e.peekCd = pick(w, d.peekCooldown); e.engageBursts = (e.engageBursts || 0) + 1; return back(w, e); }
      return; // cooldown: prøv igjen neste steg
    }
    e.burstLeft--;
    e.shotT = d.burstInterval;
    if (e.burstLeft <= 0) {
      e.peekCd = pick(w, d.peekCooldown);
      e.engageBursts = (e.engageBursts || 0) + 1;
      back(w, e);
    }
  },
});

registerState('returnCover', {
  update(w, e, dt) {
    if (!e.spot) return ai.think(w, e);
    const t = threatPos(w, e);
    if (t) aimAt(e, dt, t.x, t.y, 0.6);
    if (ai.moveDirect(w, e, dt, e.spot.x, e.spot.y, e.def.speed)) setState(w, e, 'inCover');
    else if (e.stateT > 1.5) ai.goTo(w, e, e.spot.x, e.spot.y, 'seekCover');
  },
});

registerState('suppressed', {
  enter(w, e) { releaseFire(w, e); ai.stop(e); },
  update(w, e, dt) {
    if (e.spot && dist(e.x, e.y, e.spot.x, e.spot.y) > 6) ai.moveDirect(w, e, dt, e.spot.x, e.spot.y, e.def.runSpeed);
    else ai.hug(e, dt);
    if (!e.spot) return ai.think(w, e, { urgent: true });
    if (e.stateT > 1.0 && e.suppression < e.def.suppressThreshold * 0.4) { e.peekCd = 0.3 + w.rng() * 0.5; setState(w, e, 'inCover'); }
    // Ikke fastlåst for alltid: etter maxSuppressed s biter den tennene sammen og kjemper igjen (spilleren må presse/flanke)
    else if (e.stateT > (e.def.maxSuppressed ?? 4)) { e.suppression = e.def.suppressThreshold * 0.5; e.peekCd = 0.2; setState(w, e, 'inCover'); }
  },
});

registerState('hold', {
  // Ingen brukbar dekning: stå på riktig avstand, skyt med token, tenk på nytt jevnlig.
  enter(w, e) { ai.stop(e); e.holdThink = 1.5 + w.rng(); },
  update(w, e, dt) {
    const t = threatPos(w, e);
    if (!t) return setState(w, e, 'idle');
    aimAt(e, dt, t.x, t.y);
    const d = dist(e.x, e.y, t.x, t.y);
    if (d < e.def.minRange) ai.moveDirect(w, e, dt, e.x - (t.x - e.x), e.y - (t.y - e.y), e.def.speed); // trekk unna
    else ai.stop(e);
    if (e.stateT > e.holdThink) return ai.think(w, e);
    e.peekCd -= dt;
    if (e.peekCd <= 0 && e.sees && requestFire(w, e)) { e.after = 'hold'; setState(w, e, e.def.attackState || 'telegraph'); }
  },
});

registerState('flank', {
  enter(w, e, plan) {
    e.flankPlan = plan; e.engageBursts = 0;
    e.path = plan.path; e.pathIdx = 0;
    w.events.emit('flank', { entity: e, x: plan.x, y: plan.y, team: 'enemy' });
  },
  update(w, e, dt) {
    const arrived = ai.follow(w, e, dt, e.def.runSpeed);
    const t = threatPos(w, e);
    if (t && e.sees && dist(e.x, e.y, t.x, t.y) < 320) { e.facing = angleTo(e.x, e.y, t.x, t.y); e.aim = turnToward(e.aim, e.facing, e.def.turnRate * dt); }
    if (arrived) return setState(w, e, 'engage');
    if (snapAttack(w, e)) return;
    if (e.stateT > e.def.flank.maxTime) { releaseFlank(w, e, e.def.flank.cooldown); return ai.think(w, e); }
  },
});

registerState('engage', {
  // Flanker på flankeposisjon: press målet med salver (egen token-kvote via flank-token).
  enter(w, e) { ai.stop(e); e.noSeeT = 0; e.engageWait = e.engageBursts ? pick(w, [0.35, 0.6]) : 0.15; },
  update(w, e, dt) {
    const p = w.player;
    if (!p || p.dead) { releaseFlank(w, e, 0); return setState(w, e, 'idle'); }
    aimAt(e, dt, p.x, p.y);
    e.noSeeT = e.sees ? 0 : e.noSeeT + dt;
    const F = e.def.flank;
    if (e.engageBursts >= F.engageBursts || e.noSeeT > 1.2 || e.suppression >= e.def.suppressThreshold * 1.5) {
      releaseFlank(w, e, F.cooldown);
      return ai.think(w, e, { urgent: true });
    }
    const B = ai.behavior(e);
    if (B.engage && B.engage(w, e, dt) === true) return;   // Flanker: nærkamp
    if (w.time < (e.noFireUntil || 0)) return;            // ikke skudd i samme vindu som et slag
    if (e.stateT > e.engageWait && e.sees && requestFire(w, e, { ignoreGap: true })) { e.after = 'engage'; setState(w, e, 'telegraph'); }
  },
});

registerState('dead', {
  enter(w, e) { releaseAll(w, e); ai.stop(e); e.corpseT = 0; e.deathAngle = e.facing + (w.rng() - 0.5) * 0.8;
    // Supplement til core 'death' (som ikke har variant i payload): samme steg som fienden registreres død hos oss.
    w.events.emit('enemyDeath', { entity: e, type: e.type, variant: e.variant ?? null, displayName: e.displayName || null, x: e.x, y: e.y, team: 'enemy', source: e.lastHitBy ?? null });
  },
  update(w, e, dt) { e.corpseT += dt; },
});

export { getSquad, coverProtecting, angleDiff, DEG };
