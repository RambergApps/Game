/**
 * separateActors – myk sirkel-mot-sirkel-separasjon mellom spiller og fiender (og fiender imellom).
 * Eier: Breach Karakter (game/src/shared/). Avtalt med Breach. Brukes av spiller og Fiende-AI.
 *
 * Bruk (én gang per fast steg, ETTER at spiller og fiender har flyttet seg, FØR prosjektiler/tegning):
 *   import { separateActors } from '../shared/separateActors.js';   // fra src/player, src/enemies, src/main.js
 *   separateActors(world, dt);                                      // dt = STEP = 1/60 s
 *
 * Leser:  world.player, world.enemies[], world.cover[] ({x,y,w,h,type}), world.bounds.
 *         Per entitet: x, y, r (påkrevd), dead (core setter dead = true ved hp <= 0),
 *         valgfritt: sepR (egen separasjonsradius, ellers r), mass (standard 1, se SEPARATION),
 *         immovable / inCover (true = blir ikke flyttet, men skyver andre), noSeparate (hoppes over helt).
 * Skriver: bare x, y. Endrer aldri fart, tilstand eller hp.
 *
 * Regler:
 *  - Fjærlignende skyv: per par flyttes overlappen ned med `stiffness`·dt (andel per sekund),
 *    begrenset til `maxPushPerTick` px per entitet per tick. Det blir aldri harde snapp.
 *  - Skyvet deles etter invers masse. En immovable entitet (eller en i dekning) står i ro.
 *  - Ingen dytting inn i dekning: hvis en ny posisjon overlapper en dekningsrute, fjernes
 *    komponenten inn i ruten (glir langs flaten). Deretter kjøres core sin resolveCircleVsCover
 *    med entitetens kollisjonsradius (`collisionR ?? r`) som sikkerhetsnett, bare for
 *    entiteter som faktisk ble flyttet.
 *  - Døde entiteter (dead === true) og entiteter uten tall i x/y/r ignoreres.
 *  - Deterministisk: bruker ikke world.rng. Ved helt sammenfallende sentrum velges en fast retning per par.
 */
import { circleRectCollide, resolveCircleVsCover } from '../core/geom.js';

export const SEPARATION = {
  stiffness: 14,        // 1/s: andel av overlapp som fjernes per sekund (14 → ca. 23 % per tick ved 60 Hz)
  maxPushPerTick: 2.5,  // px: maks forflytning per entitet per tick (= 150 px/s)
  slop: 0.5,            // px: overlapp under dette ignoreres (unngår skjelving)
  defaultMass: 1,
  massByType: { heavy: 3, grunt: 1, flanker: 0.8, grenadier: 1 },
  playerMass: 1.5,
};

const ok = (e) => e && !e.dead && !e.noSeparate && Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.r);
const sepR = (e) => (Number.isFinite(e.sepR) ? e.sepR : e.r);
const pinned = (e) => !!(e.immovable || e.inCover);
function massOf(e, isPlayer) {
  if (Number.isFinite(e.mass) && e.mass > 0) return e.mass;
  if (isPlayer) return SEPARATION.playerMass;
  return SEPARATION.massByType[e.type] ?? SEPARATION.defaultMass;
}

/** @param {object} world  core-verden  @param {number} dt  sekunder (STEP) */
export function separateActors(world, dt) {
  if (!world || !(dt > 0)) return;
  const list = [];
  if (ok(world.player)) list.push({ e: world.player, m: massOf(world.player, true), dx: 0, dy: 0 });
  const enemies = Array.isArray(world.enemies) ? world.enemies : [];
  for (const e of enemies) if (ok(e) && e !== world.player) list.push({ e, m: massOf(e, false), dx: 0, dy: 0 });
  const n = list.length;
  if (n < 2) return;

  const k = Math.min(1, SEPARATION.stiffness * dt);
  for (let i = 0; i < n; i++) {
    const A = list[i], a = A.e;
    for (let j = i + 1; j < n; j++) {
      const B = list[j], b = B.e;
      const pa = pinned(a), pb = pinned(b);
      if (pa && pb) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const rr = sepR(a) + sepR(b);
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-6) { const ang = (i * 7 + j * 13) * 2.399963; dx = Math.cos(ang); dy = Math.sin(ang); d = 1; }
      else { dx /= d; dy /= d; }
      const overlap = rr - (d2 < 1e-12 ? 0 : d) - SEPARATION.slop;
      if (overlap <= 0) continue;
      const push = overlap * k;
      const wa = pa ? 0 : 1 / A.m, wb = pb ? 0 : 1 / B.m, ws = wa + wb;
      A.dx -= dx * push * (wa / ws); A.dy -= dy * push * (wa / ws);
      B.dx += dx * push * (wb / ws); B.dy += dy * push * (wb / ws);
    }
  }

  const cover = Array.isArray(world.cover) ? world.cover : [];
  for (const A of list) {
    let { dx, dy } = A;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) continue;
    const cap = SEPARATION.maxPushPerTick;
    if (len > cap) { dx *= cap / len; dy *= cap / len; }
    const e = A.e, r = Number.isFinite(e.collisionR) ? e.collisionR : e.r;
    // fjern komponenten som peker inn i dekning (gli langs flaten)
    for (const c of cover) {
      const hit = circleRectCollide(e.x + dx, e.y + dy, r, c);
      if (!hit) continue;
      const hl = Math.hypot(hit.x, hit.y);
      if (hl < 1e-6) continue;
      const nx = hit.x / hl, ny = hit.y / hl;      // peker ut av dekningen
      const into = dx * nx + dy * ny;
      if (into < 0) { dx -= into * nx; dy -= into * ny; }
    }
    e.x += dx; e.y += dy;
    // sikkerhetsnett: core-oppløsning mot dekning og arenagrense (krever world.bounds)
    const tmp = { x: e.x, y: e.y };
    if (world.bounds) resolveCircleVsCover(world, tmp, r);
    else for (let it = 0; it < 2; it++) for (const c of cover) { const p = circleRectCollide(tmp.x, tmp.y, r, c); if (p) { tmp.x += p.x; tmp.y += p.y; } }
    e.x = tmp.x; e.y = tmp.y;
  }
}

export default separateActors;
