// Squad-koordinator: skyte-tokens, flank-token, granat-token, reservasjon av dekningspunkter og delt kunnskap.
import { SQUAD_RULES } from './stats.js';

const squads = new WeakMap();

export function getSquad(world) {
  let s = squads.get(world);
  if (!s) {
    s = {
      rules: { ...SQUAD_RULES },
      shooters: new Set(),      // fiender i telegraf/skyting
      lastShotStart: -1e9,
      flankers: new Set(),
      flankCooldownUntil: 0,
      reserved: new Map(),      // spotId → enemy
      known: null,              // { x, y, t } siste kjente spillerposisjon (delt)
      engagedSince: null,       // når laget først fikk kontakt
      throwers: new Set(),      // fiender i kastebevegelse
      grenadeCooldownUntil: 0,
      camp: null,               // { x, y, since, inCover } – hvor lenge spilleren har ligget i samme dekning
      stats: { maxShooters: 0, maxFlankers: 0, deniedFire: 0, maxThrowers: 0, grenades: 0, deniedGrenade: 0 },
    };
    squads.set(world, s);
  }
  // Softlock-vakt (Test 26.10, 1-3 etter død/respawn): tokens kan lekke når Levels fjerner fiender uten 'death'
  // (bølgeomstart), og world.time kan gå bakover. Begge ga et lag som aldri fikk skyte igjen.
  if (s.lastPrune !== world.time) {
    if (s.lastPrune != null && world.time < s.lastPrune) {
      s.lastShotStart = -1e9; s.flankCooldownUntil = 0; s.grenadeCooldownUntil = 0; s.known = null; s.engagedSince = null; s.camp = null;
      for (const e of world.enemies || []) { e.nextHuntAt = 0; e.lastSightAt = world.time; e.advanceUntil = 0; }
      s.advancer = null; s.advanceUntil = 0; s.stats.timeReset = (s.stats.timeReset || 0) + 1;
    }
    s.lastPrune = world.time;
    const live = new Set((world.enemies || []).filter((e) => !e.dead));
    for (const set of [s.shooters, s.flankers, s.throwers]) for (const e of set) if (!live.has(e)) { set.delete(e); s.stats.pruned = (s.stats.pruned || 0) + 1; }
    for (const [id, e] of s.reserved) if (!live.has(e)) s.reserved.delete(id);
    if (s.advancer && !live.has(s.advancer)) s.advancer = null;
    for (const e of s.shooters) if (world.time - (e._fireTokenAt ?? world.time) > 8) { s.shooters.delete(e); s.stats.staleFire = (s.stats.staleFire || 0) + 1; }
  }
  return s;
}

export function requestFire(world, e, { ignoreGap = false } = {}) {
  const s = getSquad(world);
  if (s.shooters.has(e)) return true;
  // Kiln (heavy) har prioritet: én ekstra plass over kvoten (Test 26.10: Kiln sto 37 s uten å skyte)
  if (s.shooters.size >= s.rules.maxShooters + (e.type === 'heavy' ? 1 : 0)) { s.stats.deniedFire++; return false; }
  if (!ignoreGap && e.type !== 'heavy' && world.time - s.lastShotStart < s.rules.minShotGap) return false;
  s.shooters.add(e); e._fireTokenAt = world.time;
  s.lastShotStart = world.time;
  s.stats.maxShooters = Math.max(s.stats.maxShooters, s.shooters.size);
  return true;
}
export function releaseFire(world, e) { getSquad(world).shooters.delete(e); }

export function requestFlank(world, e) {
  const s = getSquad(world);
  if (s.flankers.has(e)) return true;
  if (s.flankers.size >= s.rules.maxFlankers || world.time < s.flankCooldownUntil) return false;
  s.flankers.add(e);
  s.stats.maxFlankers = Math.max(s.stats.maxFlankers, s.flankers.size);
  return true;
}
export function releaseFlank(world, e, cooldown = 0) {
  const s = getSquad(world);
  if (s.flankers.delete(e)) s.flankCooldownUntil = Math.max(s.flankCooldownUntil, world.time + cooldown);
}

/** Granat-token: maks rules.maxThrowers samtidig og rules.grenadeGap s mellom kast fra laget. */
export function requestGrenade(world, e) {
  const s = getSquad(world);
  if (s.throwers.has(e)) return true;
  if (s.throwers.size >= s.rules.maxThrowers || world.time < s.grenadeCooldownUntil) { s.stats.deniedGrenade++; return false; }
  s.throwers.add(e);
  s.grenadeCooldownUntil = world.time + s.rules.grenadeGap;
  s.stats.grenades++;
  s.stats.maxThrowers = Math.max(s.stats.maxThrowers, s.throwers.size);
  return true;
}
export function releaseGrenade(world, e) { getSquad(world).throwers.delete(e); }

export function reserve(world, e, spot) {
  const s = getSquad(world);
  unreserve(world, e);
  if (spot) { s.reserved.set(spot.id, e); e.spot = spot; }
}
export function unreserve(world, e) {
  const s = getSquad(world);
  if (e.spot && s.reserved.get(e.spot.id) === e) s.reserved.delete(e.spot.id);
  e.spot = null;
}

export function releaseAll(world, e) {
  releaseFire(world, e);
  releaseFlank(world, e, 1.5);
  releaseGrenade(world, e);
  unreserve(world, e);
}

/** Del observasjon av spilleren med laget. */
export function report(world, x, y) {
  const s = getSquad(world);
  s.known = { x, y, t: world.time };
  if (s.engagedSince === null) s.engagedSince = world.time;
}
