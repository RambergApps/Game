// Jakt («hunt») og stillstands-vakthund – P1 fra Breach 23.10 (test: fiender uten sikt lå passive i dekning i minutter).
//
// Regler:
//  • Etter huntDelay (4–6 s, tilfeldig per fiende) uten EGEN sikt går fienden mot siste kjente posisjon.
//    Er den allerede der (eller har vært der), får den spillerens faktiske posisjon («rettferdig jakt»: laget vet omtrent
//    hvor han er – ingen fiende glemmer ham lenger).
//  • Taktisk: først prøves en dekning som er NÆRMERE målet (≥ 80 px framrykk) og som har skuddpunkt – vanlig seekCover
//    med reservasjon, så lagkoordinering (skyte-token, flank-token, granat-token, spredning) er uendret. Finnes ingen,
//    går den via nav i tilstanden 'hunt' til den ser spilleren (da tar vanlig think() over).
//  • Vakthund: en fiende som står stille (< 10 px/s) uten sikt i mer enn WATCHDOG s, uansett tilstand (unntatt kast,
//    stagger, oppstigning, Heavy-omlading), tvinges inn i et jaktsteg. Gir en hard øvre grense på stillstand uten sikt.
//  • Ikke-vakter (opts.aware !== false) som har mistet «aware» (f.eks. etter spillerens død) vekkes igjen når han lever.
import { dist } from '../core/index.js';
import { bestSpot } from './cover.js';
import { getSquad, reserve } from './squad.js';
import { registerState, setState } from './states.js';
import * as ai from './ai.js';
import { HUNT } from './stats.js';
import { damage } from '../core/combat.js';
import { releaseAll, releaseFire, unreserve } from './squad.js';
import { walk } from './walk.js';   // Arenas gyldighetssjekk/clamp (A1-ansvarsdeling 26.10), med fallback

// Softlock-vakt (Test 26.10 A1/A2): «fremdrift» = rykket ≥ 24 px nærmere spilleren, telegraf/skudd/kast, eller tok skade.
// (fremdrift = egen forflytning ≥ 32 px) > 5 s uten: slipp tokens og ta et jaktsteg (uten lagventing). > 8 s og utenfor spillområdet/nav: flytt til nærmeste
// ledige nav-celle. > 20 s: fjernes og telles som drept (vanlig damage → 'death').
export const SOFTLOCK = { act: 5, move: 8, kill: 20 };
const PROGRESS_STATES = new Set(['telegraph', 'fire', 'throw', 'melee', 'lunge', 'stream', 'windup', 'flank']);
function softlockGuard(world, e, now) {
  const p = world.player; if (!p || p.dead || e.guard || e.boss || !e.def.speed) { e.slRef = null; return false; }
  const d = Math.hypot(e.x - p.x, e.y - p.y);
  const r = e.slRef;
  // fremdrift = fienden selv har flyttet seg ≥ 32 px OG er ≥ 16 px nærmere (ikke frem-og-tilbake), skadet, eller angriper
  if (!r || now < r.t || (Math.hypot(e.x - r.x, e.y - r.y) > 32 && d < r.d - 16) || e.hp < r.hp || PROGRESS_STATES.has(e.state)) { e.slRef = { x: e.x, y: e.y, d, hp: e.hp, t: now, acted: 0 }; return false; }
  const idle = now - r.t, st = stats(world);
  st.maxNoProgress = Math.max(st.maxNoProgress || 0, idle);
  if (idle > SOFTLOCK.kill) { st.softKill = (st.softKill || 0) + 1; damage(e, (e.hp || 1) + 1e6, { kind: 'softlock', type: 'softlock', world, x: e.x, y: e.y }, world); return true; }
  if (idle > SOFTLOCK.move && r.acted < 2) {
    r.acted = 2;
    const n = ai.nav(world), b = world.bounds, m = 40;
    const inB = !b || (e.x > b.x + m && e.y > b.y + m && e.x < b.x + b.w - m && e.y < b.y + b.h - m);
    const [cx, cy] = n.cellOf(e.x, e.y);
    const W = walk(world), okArena = W.isWalkable(world, e.x, e.y, e.r || 14);
    if (!okArena && W.rescueStuck(world, e, e.r || 14)) { e.vx = e.vy = 0; ai.stop(e); st.softMove = (st.softMove || 0) + 1; }
    else if (!okArena || !inB || !n.free(cx, cy)) {
      for (let rad = 1; rad < 12; rad++) {
        let best = null;
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad || !n.free(cx + dx, cy + dy)) continue;
          const c = n.center(cx + dx, cy + dy);
          if (b && (c.x < b.x + m || c.y < b.y + m || c.x > b.x + b.w - m || c.y > b.y + b.h - m)) continue;
          if (!W.isWalkable(world, c.x, c.y, e.r || 14)) continue;
          const dd = Math.hypot(c.x - p.x, c.y - p.y); if (!best || dd < best.dd) best = { ...c, dd };
        }
        if (best) { e.x = best.x; e.y = best.y; e.vx = e.vy = 0; ai.stop(e); st.softMove = (st.softMove || 0) + 1; break; }
      }
    }
    e.nextHuntAt = 0; releaseAll(world, e); huntStep(world, e, 'softlock'); return true;
  }
  if (idle > SOFTLOCK.act && r.acted < 1) { r.acted = 1; st.softAct = (st.softAct || 0) + 1; e.nextHuntAt = 0; releaseAll(world, e); huntStep(world, e, 'stall'); return true; }
  return false;
}
export { HUNT };

// Demo 26.10: også seekCover og peek (Test: Husker i seekCover/peek sto 244–314 px unna uten sikt). Tilstandsbytte nullstiller
// IKKE tiden uten sikt (lastSightAt settes bare av e.sees; peek uten sikt teller ikke som «sett»).
const HUNTABLE = new Set(['inCover', 'hold', 'idle', 'returnCover', 'suppressed', 'seekCover', 'peek']);
const WATCHDOG_EXEMPT = new Set(['dead', 'staggered', 'throw', 'reloadDuck', 'alert', 'telegraph', 'fire', 'spinup', 'sustain', 'meleeCharge', 'meleeStrike', 'meleeRecover', 'bossIdle']);

function stats(world) {
  const s = getSquad(world).stats;
  if (s.hunts === undefined) { s.hunts = 0; s.huntCover = 0; s.huntDirect = 0; s.watchdog = 0; s.maxStillBlind = 0; }
  return s;
}

/** Kalles hvert steg etter perceive(), før tilstanden oppdateres. */
export function huntTick(world, e, dt) {
  const p = world.player;
  if (!p || p.dead || e.dead || e.def.bossType) { e.stillBlindT = 0; return; }
  // A2 27.10: faktisk fart fra forflytning. vx/vy er ØNSKET fart og forblir høy når fienden dytter mot en vegg/dekning
  // (instrumentert: fart 123–210, sti 1 punkt, posisjon uendret i 7–19 s, så stuck-sjekken på vx slo aldri til).
  if (e._px != null && dt > 0) e.realSpeed = (e.realSpeed ?? 0) * 0.8 + 0.2 * Math.hypot(e.x - e._px, e.y - e._py) / dt;
  e._px = e.x; e._py = e.y;
  if (!HUNT.enabled) return legacyStill(world, e, dt);
  const sq = getSquad(world), now = world.time;
  if (!e.aware) {                                  // aldri «glemt»: bølgefiender vekkes igjen (vakter med aware:false gjør ikke)
    if (!e.guard && now - (e.bornAt ?? 0) > (e.riseDur || 0)) ai.alertEnemy(world, e, 0.3 + world.rng() * 0.5);
    return;
  }
  if (e.sees) { if (e.sightSince == null) e.sightSince = now; } else e.sightSince = null;
  if (softlockGuard(world, e, now)) return;
  if (e.huntDelay == null) e.huntDelay = HUNT.delay[0] + world.rng() * (HUNT.delay[1] - HUNT.delay[0]);
  if (e.sees && e.state !== 'hunt') e.hunting = false;
  if (e.contactAt == null && (e.sees || (sq.known && now - sq.known.t < 0.5))) e.contactAt = now;
  if (e.sees) { e.lastSightAt = now; e.huntStage = 0; e.stillBlindT = 0; blockedSeeing(world, e, dt, now); return; }   // 28.10: fastlåst-sjekk også med sikt
  if (blockedCheck(world, e, dt, now)) return;
  if (e.lastSightAt == null) e.lastSightAt = now;
  if (!e.known) e.known = { x: p.x, y: p.y, t: now, hunt: true };   // aldri null mens den er aware
  // Stillstand uten sikt
  const still = Math.hypot(e.vx || 0, e.vy || 0) < 10 && !WATCHDOG_EXEMPT.has(e.state) && (now - (e.bornAt ?? 0)) > (e.riseDur || 0);
  e.stillBlindT = still ? (e.stillBlindT || 0) + dt : 0;
  const st = stats(world);
  if (e.stillBlindT > st.maxStillBlind) st.maxStillBlind = e.stillBlindT;
  if (e.stillBlindT > HUNT.watchdog) { st.watchdog++; return huntStep(world, e, 'watchdog'); }
  if (now - e.lastSightAt > e.huntDelay && HUNTABLE.has(e.state) && now >= (e.nextHuntAt ?? 0)) {
    // seekCover mot en dekning som allerede er et jaktsteg: la den komme fram (nextHuntAt styrer neste steg)
    if (e.state === 'seekCover' && e.hunting && e.moving && e.stateT < 6 && (e.realSpeed ?? 0) > 20) return;
    // Lagkoordinering: én rykker fram av gangen, de andre holder (kort – advanceGap – så ingen står lenge)
    if (sq.advancer && sq.advancer !== e && !sq.advancer.dead && now < (sq.advanceUntil ?? 0)) { e.nextHuntAt = sq.advanceUntil + world.rng() * 0.3; return; }
    sq.advancer = e; sq.advanceUntil = now + (HUNT.advanceGap ?? 0.7);
    huntStep(world, e, 'blind');
  }
}

/** Ett jaktsteg: dekning nærmere målet hvis mulig, ellers nav mot målet i 'hunt'. */
export function huntStep(world, e, reason) {
  const p = world.player, now = world.time, sq = getSquad(world), st = stats(world);
  e.nextHuntAt = now + HUNT.stepGap[0] + world.rng() * (HUNT.stepGap[1] - HUNT.stepGap[0]);
  e.stillBlindT = 0;
  st.hunts++;
  // Flank i stedet for rett fram når flank-tokenet er ledig (tryFlank tar tokenet og slipper det hvis ingen rute)
  const fc = HUNT.flankChance?.[e.type] ?? 0;
  if (e.def.flank && fc > 0 && world.rng() < fc && ai.tryFlank(world, e)) { st.huntFlank = (st.huntFlank || 0) + 1; e.hunting = true; return; }
  // Mål: siste kjente posisjon først; er vi der (eller har vært), spillerens faktiske posisjon.
  let k = e.known;
  if (sq.known && (!k || sq.known.t > k.t)) k = sq.known;
  if (!e.huntStage && k && dist(e.x, e.y, k.x, k.y) > 72) e.huntStage = 1;
  else { e.huntStage = 2; k = { x: p.x, y: p.y }; }
  e.known = { x: k.x, y: k.y, t: now, hunt: true };
  const tx = k.x, ty = k.y, D = dist(e.x, e.y, tx, ty), d = e.def;
  world.events.emit('enemyHunt', { entity: e, x: e.x, y: e.y, tx, ty, team: 'enemy', stage: e.huntStage, reason });
  // Taktisk framrykk: dekning nærmere enn i dag.
  const maxR = Math.min(d.maxRange, D - HUNT.advanceMin);
  if (now >= (e.noCoverUntil ?? 0) && maxR > (d.minRange || 0) + 16) {
    const others = [];
    for (const o of world.enemies) if (o !== e && !o.dead) others.push(o.spot || o);
    const r = bestSpot(world, e, tx, ty, {
      idealRange: Math.max(d.minRange || 0, Math.min(d.idealRange, D - 160)), minRange: d.minRange || 0, maxRange: maxR,
      typeBonus: ai.coverBonus(e, false), reserved: sq.reserved, others, current: null, front: ai.squadFront(world, { x: tx, y: ty }, e),
    });
    if (r && r.spot !== e.spot && r.score > -6 && dist(e.x, e.y, r.spot.x, r.spot.y) > 24) {
      st.huntCover++;
      if (e.coverHeld) world.events.emit('coverExit', { entity: e, cover: e.coverHeld.cover, x: e.x, y: e.y, team: 'enemy' });
      e.coverHeld = null;
      reserve(world, e, r.spot);
      e.hunting = true;
      return ai.goTo(world, e, r.spot.x, r.spot.y, 'seekCover');
    }
  }
  st.huntDirect++;
  e.hunting = true;
  ai.goTo(world, e, tx, ty, 'hunt');
}

registerState('hunt', {
  enter(w, e) { e.repathT = HUNT.repath; },
  update(w, e, dt) {
    const p = w.player;
    if (!p || p.dead) return setState(w, e, 'idle');
    if (e.sees) { e.hunting = false; return ai.think(w, e); }           // kontakt: vanlig kamp (dekning, token, flanke)
    if (e.suppression >= e.def.suppressThreshold && e.spot) return setState(w, e, 'suppressed');
    const arrived = ai.follow(w, e, dt, (e.def.speed + e.def.runSpeed) / 2);
    // Står fast (ingen sti / blokkert): ny vurdering i stedet for å stå i 'hunt' (Test: Kiln sto 9 s i hunt)
    e.huntStuckT = (e.realSpeed ?? 0) < 10 ? (e.huntStuckT || 0) + dt : 0;
    if (e.huntStuckT > (HUNT.stuckT ?? 1.2)) { e.huntStuckT = 0; e.hunting = false; e.nextHuntAt = 0; return ai.think(w, e, { reposition: true }); }
    e.repathT -= dt;
    if (arrived || e.repathT <= 0) {                                    // fram / tid for nytt mål: spillerens posisjon nå
      e.repathT = HUNT.repath; e.huntStage = 2;
      e.known = { x: p.x, y: p.y, t: w.time, hunt: true };
      ai.goTo(w, e, p.x, p.y);
    }
    if (e.stateT > HUNT.maxHuntT) ai.think(w, e);
  },
});

/** Kun måling (HUNT.enabled = false): gammel oppførsel, men stillstand uten sikt måles likt. */
function legacyStill(world, e, dt) {
  if (e.sees || !e.aware) { e.stillBlindT = 0; return; }
  const still = Math.hypot(e.vx || 0, e.vy || 0) < 10 && !WATCHDOG_EXEMPT.has(e.state);
  e.stillBlindT = still ? (e.stillBlindT || 0) + dt : 0;
  const st = stats(world); if (e.stillBlindT > st.maxStillBlind) st.maxStillBlind = e.stillBlindT;
}

// A2 27.10: blind fiende som «går» uten å flytte seg (dytter mot hindring) i > 1 s → ny rute.
// seekCover/returnCover: dropp den dekningen 3 s og jakt via nav. hunt: sidesteg til en gangbar celle 64–96 px unna.
const BLOCK_STATES = new Set(['seekCover', 'returnCover', 'hunt']);
// 28.10 (fastlåst ved defensivt spill): blockedCheck kjørte bare UTEN sikt. Fiender i seekCover/returnCover som så Warden
// over lavt cover og presset mot coverkanten (sti mangler/hjørne) ble aldri sjekket. Med sikt: nær spot (< 24 px) → regnes som fremme;
// ellers merkes spoten som blokkert i 10 s og fienden velger ny dekning via vanlig think() (tilstand 'hold').
function blockedSeeing(world, e, dt, now) {
  if ((e.state !== 'seekCover' && e.state !== 'returnCover') || !e.moving || (e.realSpeed ?? 0) >= 10) { e.blockedT = 0; return false; }
  e.blockedT = (e.blockedT || 0) + dt;
  if (e.blockedT < 1.0) return false;
  e.blockedT = 0; const st = stats(world); st.blockedSee = (st.blockedSee || 0) + 1;
  if (e.spot && Math.hypot(e.spot.x - e.x, e.spot.y - e.y) < 24) { e.path = null; e.pathIdx = 0; return true; }   // follow() → fremme
  if (e.spot?.id != null) (e._badSpots ||= new Map()).set(e.spot.id, now + 10);
  releaseFire(world, e); unreserve(world, e); ai.stop(e); setState(world, e, 'hold'); return true;
}
function blockedCheck(world, e, dt, now) {
  if (!BLOCK_STATES.has(e.state) || !e.moving || (e.realSpeed ?? 0) >= 10) { e.blockedT = 0; return false; }
  e.blockedT = (e.blockedT || 0) + dt;
  if (e.blockedT < 1.0) return false;
  e.blockedT = 0;
  const st = stats(world); st.blocked = (st.blocked || 0) + 1;
  releaseFire(world, e);
  if (e.state !== 'hunt') { if (e.spot?.id != null) (e._badSpots ||= new Map()).set(e.spot.id, now + 10); unreserve(world, e); e.noCoverUntil = now + 3; huntStep(world, e, 'blocked'); return true; }   // 28.10: blokkert spot velges ikke igjen på 10 s (fastlåst-fiks)
  const wk = walk(world), r = e.r || 16;
  for (let i = 0; i < 8; i++) {
    const a = world.rng() * Math.PI * 2, D = 64 + world.rng() * 32, x = e.x + Math.cos(a) * D, y = e.y + Math.sin(a) * D;
    if (wk.isWalkable(world, x, y, r)) { e.noCoverUntil = now + 3; ai.goTo(world, e, x, y, 'hunt'); e.repathT = 1.0; return true; }
  }
  e.noCoverUntil = now + 3; huntStep(world, e, 'blocked'); return true;
}
