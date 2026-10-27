// Grenadier: holder avstand i dekning, skyter korte salver, og kaster granat for å skylle spilleren ut
// når han har ligget i samme dekning lenge (squad.camp). Granat-token i squad: maks én kaster, felles pause.
// Varsel: kastebevegelse (windup) + landingsmarkør fra første øyeblikk, så flytid + lunte (~2.5 s totalt).
import { dist } from '../../core/index.js';
import { chooseCover, nav, coverBonus, follow } from '../ai.js';
import { bestSpot } from '../cover.js';
import { setState, back, aimAt } from '../states.js';
import { getSquad, requestGrenade, releaseGrenade } from '../squad.js';
import { throwGrenade } from '../grenades.js';

const EN_ROUTE = new Set(['seekCover', 'returnCover', 'alert', 'hold']);

/**
 * Hvor skal granaten, og er det lov å kaste nå? → {x, y, reason} | null   (P1 23.10: kastet for sjelden – 0 kast på 30 s)
 * Felles krav: egen cooldown ute og fersk posisjon (≤ 2.5 s, egen sikt ELLER lagets «callout»).
 * Grunner (første som slår til):
 *  'camp'   spilleren har ligget i samme dekning ≥ campTime (2.5 → 1.5 s)
 *  'still'  spilleren har stått i ro (< 48 px) ≥ stillTime (1.5 s), også i det åpne
 *  'group'  ≥ 2 på spillerlaget innen groupRadius (spiller + allierte) → midtpunktet
 *  'press'  kontakt i ≥ pressAfter (6–8 s, per Spitter) uten kast ennå → første kast innen ~8–12 s etter kontakt
 * Varsel (windup + landingsmarkør), maks én kaster (squad-token), lagets grenadeGap og egen cooldown er uendret.
 */
function grenadeTarget(world, e) {
  const G = e.def.grenade, sq = getSquad(world), p = world.player, now = world.time;
  if (!p || p.dead || now < (e.grenadeReadyAt ?? 0)) return null;
  let k = e.known;
  for (const o of world.enemies) {
    if (o === e || o.dead || !o.def || !o.known) continue;
    if (!k || o.known.t > k.t) k = o.known;
  }
  // Første kast (oppskylling) tåler eldre «sist kjent» (G.firstStale s); senere kast krever fersk posisjon (2,5 s).
  if (!k || now - k.t > (e.throws ? 2.5 : (G.firstStale ?? 2.5))) return null;
  // Første kast tidligst G.firstMin s etter egen kontakt (P1: mål 8–12 s), så spilleren rekker å se Spitteren.
  if (!e.throws && (e.contactAt == null || now - e.contactAt < (G.firstMin ?? 0))) return null;
  const camp = sq.camp, still = sq.still;
  if (camp && camp.inCover && now - camp.since >= G.campTime) return { x: k.x, y: k.y, reason: 'camp' };
  if (still && now - still.since >= (G.stillTime ?? 1.5)) return { x: k.x, y: k.y, reason: 'still' };
  const team = [p, ...(world.allies || []).filter((a) => !a.dead)];
  if (team.length >= 2) {
    const R = G.groupRadius ?? 96;
    for (const a of team) {
      const near = team.filter((b) => dist(a.x, a.y, b.x, b.y) <= R);
      if (near.length >= 2) {
        const cx = near.reduce((s, b) => s + b.x, 0) / near.length, cy = near.reduce((s, b) => s + b.y, 0) / near.length;
        return { x: cx, y: cy, reason: 'group' };
      }
    }
  }
  if (e.pressAfter == null) e.pressAfter = (G.pressAfter?.[0] ?? 6) + world.rng() * ((G.pressAfter?.[1] ?? 8) - (G.pressAfter?.[0] ?? 6));
  if (!e.throws && e.contactAt != null && now - e.contactAt >= e.pressAfter) return { x: k.x, y: k.y, reason: 'press' };
  return null;
}
const campTarget = grenadeTarget;   // gammelt navn (brukt under)

/** Sekker på ryggen (kun visning, P.sacksLeft): én tømmes per kast, én fylles igjen hvert SACK_REFILL s. Styrer ikke kast. */
const SACKS = 3, SACK_REFILL = 5;
function refillSacks(w, e) { if (e.sacks == null) e.sacks = SACKS; if (e.sacks < SACKS && w.time >= (e.sackRefillAt ?? 0)) { e.sacks++; e.sackRefillAt = w.time + SACK_REFILL; } }

export const grenadier = {
  think(world, e, opts) { chooseCover(world, e, opts); },

  inCover(world, e) {
    const G = e.def.grenade, k = campTarget(world, e);
    if (!k) return false;
    const tx = k.x, ty = k.y, d = dist(e.x, e.y, tx, ty);
    if (d > G.maxRange) return advance(world, e, tx, ty, G);   // for langt: rykk fram til dekning innenfor kastehold
    if (d < G.minRange) return false;
    if (!requestGrenade(world, e)) { e.grenadeReadyAt = world.time + 0.8; return false; }
    e.throwReason = k.reason;
    setState(world, e, 'throw', { tx, ty });
    return true;
  },

  /**
   * Kast underveis (justeringsrunde): ligger spilleren og camper og grenadieren passerer innenfor kastehold på vei
   * til dekning, stopper den og kaster der og da (i stedet for å vente til den er i dekning + campTime på nytt).
   * Samme varsel (windup + landingsmarkør, ~2.5 s), samme token (maks én kaster), og den står åpent mens den kaster.
   */
  tick(world, e) {
    refillSacks(world, e);
    if (!EN_ROUTE.has(e.state) || (e.state === 'alert' && e.stateT < 0.3)) return;
    const G = e.def.grenade, k = campTarget(world, e);
    if (!k) return;
    const d = dist(e.x, e.y, k.x, k.y);
    if (d > G.maxRange * 0.95 || d < G.minRange) return;
    if (!requestGrenade(world, e)) { e.grenadeReadyAt = world.time + 0.8; return; }
    e.vx = 0; e.vy = 0;
    e.throwEnRoute = (e.throwEnRoute || 0) + 1;
    e.throwReason = k.reason;
    setState(world, e, 'throw', { tx: k.x, ty: k.y });
  },

  states: {
    throwRun: {
      enter(w, e, { px, py }) {
        const path = nav(w).findPath(e.x, e.y, px, py);
        e.path = path && path.length ? path : [{ x: px, y: py }]; e.pathIdx = 0; e.toThrow = false;
      },
      update(w, e, dt) {
        const G = e.def.grenade, p = w.player;
        if (!p || p.dead || !e.known) return back(w, e);
        const tx = e.known.x, ty = e.known.y;
        const arrived = follow(w, e, dt, e.def.runSpeed);
        aimAt(e, dt, tx, ty, 1.2);
        const d = dist(e.x, e.y, tx, ty);
        if ((arrived || d <= G.maxRange * 0.92) && d >= G.minRange) { e.toThrow = true; return setState(w, e, 'throw', { tx, ty }); }
        if (e.stateT > 4 || e.suppression >= e.def.suppressThreshold) return back(w, e);
      },
      exit(w, e) { if (!e.toThrow) { releaseGrenade(w, e); e.grenadeReadyAt = w.time + 2; } e.toThrow = false; e.path = null; },
    },
    throw: {
      enter(w, e, { tx, ty }) {
        const G = e.def.grenade, n = nav(w);
        const a = w.rng() * Math.PI * 2, r = w.rng() * G.error;
        let x = tx + Math.cos(a) * r, y = ty + Math.sin(a) * r;
        const cell = n.cellOf(x, y);                        // aldri inne i en kasse
        if (!n.free(cell[0], cell[1])) { const c = n.nearestFree(cell[0], cell[1]); if (c) ({ x, y } = n.center(c[0], c[1])); }
        e.throwTarget = { x, y };
        e.thrown = false; e.vx = 0; e.vy = 0; e.moving = false; e.path = null;
        const total = G.windup + G.flight + G.fuse;
        w.events.emit('grenadeWindup', { entity: e, x, y, team: 'enemy', duration: G.windup, total, radius: G.radius, weapon: 'grenade', reason: e.throwReason || null });
      },
      update(w, e, dt) {
        const G = e.def.grenade, T = e.throwTarget;
        aimAt(e, dt, T.x, T.y, 1.5);
        if (!e.thrown && e.suppression >= e.def.suppressThreshold) return back(w, e); // spilleren kan avbryte kastet
        if (!e.thrown && e.stateT >= G.windup) {
          e.thrown = true; e.throws = (e.throws || 0) + 1; e.sacks = Math.max(0, (e.sacks ?? SACKS) - 1); e.sackRefillAt = w.time + SACK_REFILL;   // visuelt (P.sacksLeft)
          const c = Math.cos(e.aim), s = Math.sin(e.aim);
          throwGrenade(w, { x: e.x + c * 12 - s * 8, y: e.y + s * 12 + c * 8, tx: T.x, ty: T.y, team: 'enemy', owner: e,
            flight: G.flight, fuse: G.fuse, radius: G.radius, dmg: G.dmg });
          e.grenadeReadyAt = w.time + G.cooldown;
          releaseGrenade(w, e);
        }
        if (e.thrown && e.stateT >= G.windup + G.recover) back(w, e);
      },
      exit(w, e) { releaseGrenade(w, e); if (!e.thrown) e.grenadeReadyAt = w.time + 2; },
    },
  },
};

/** Spilleren camper utenfor kastehold: finn dekning innenfor rekkevidde og gå dit (maks hvert 4. s). */
function advance(world, e, tx, ty, G) {
  if (world.time < (e.advanceAt ?? 0) || getSquad(world).throwers.size >= 1) return false;
  e.advanceAt = world.time + 4;
  const sq = getSquad(world), others = [];
  for (const o of world.enemies) if (o !== e && !o.dead) others.push(o.spot || o);
  const r = bestSpot(world, e, tx, ty, {
    idealRange: G.maxRange * 0.8, minRange: G.minRange + 40, maxRange: G.maxRange * 0.95,
    typeBonus: coverBonus(e, true), reserved: sq.reserved, others, current: null,
  });
  if (!r || r.spot === e.spot) {
    // Ingen dekning innen rekkevidde: løp ut i det åpne til kastehold (risikabelt = spilleren får et vindu), kast, løp tilbake.
    const d = dist(e.x, e.y, tx, ty), k = (G.maxRange * 0.88) / d;
    let px = tx + (e.x - tx) * k, py = ty + (e.y - ty) * k;
    const n = nav(world), cell = n.cellOf(px, py);
    if (!n.free(cell[0], cell[1])) { const c = n.nearestFree(cell[0], cell[1]); if (!c) return false; ({ x: px, y: py } = n.center(c[0], c[1])); }
    if (!requestGrenade(world, e)) return false;
    setState(world, e, 'throwRun', { px, py });
    return true;
  }
  chooseCover(world, e, { idealRange: G.maxRange * 0.8, minRange: G.minRange + 40, maxRange: G.maxRange * 0.95, reposition: true });
  e.grenadeAdvance = true;
  world.events.emit('grenadierAdvance', { entity: e, x: e.x, y: e.y, team: 'enemy' });
  return e.state !== 'inCover';
}
