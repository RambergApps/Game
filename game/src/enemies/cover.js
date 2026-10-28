// Dekningspunkter og dekningsscoring.
// Hvert cover-rektangel gir "spots" langs sidene (32 px mellomrom), med utovervendt normal.
// High cover får i tillegg kikkepunkter rundt hjørnene (peeks).
import { lineOfSight, dist, angleDiff } from '../core/index.js';
import { TILE, coverProtecting, segmentClear } from './geom.js';
import { walk } from './walk.js';

const R = 16; // 26.10: Husk r 18 (var 14)
const OFF = R + 5;           // avstand fra kant til fiendens sentrum i dekning
const cache = new WeakMap(); // world → { sig, spots }

function signature(world) {
  let s = '';
  for (const c of world.cover) s += `${c.x},${c.y},${c.w},${c.h},${c.type}|`;
  return s;
}

function free(world, x, y, r = R) {
  const b = world.bounds;
  if (x < b.x + r || y < b.y + r || x > b.x + b.w - r || y > b.y + b.h - r) return false;
  if (!walk(world).isWalkable(world, x, y, r)) return false;   // A1: dekning/peek aldri i skjult stripe
  for (const c of world.cover) {
    const dx = Math.max(c.x - x, 0, x - (c.x + c.w)), dy = Math.max(c.y - y, 0, y - (c.y + c.h));
    if (dx * dx + dy * dy < (r - 0.5) * (r - 0.5)) return false;
  }
  return true;
}

export function getSpots(world) {
  const sig = signature(world);
  let entry = cache.get(world);
  if (entry && entry.sig === sig) return entry.spots;
  const spots = [];
  world.cover.forEach((c, ci) => {
    if (c.type !== 'high' && c.type !== 'low') return;   // 27.10: vann (type 'water', yard-v2) o.l. er ikke dekning
    const sides = [
      { name: 'n', nx: 0, ny: -1, len: c.w, at: (t) => [c.x + t, c.y], tx: 1, ty: 0 },
      { name: 's', nx: 0, ny: 1, len: c.w, at: (t) => [c.x + t, c.y + c.h], tx: 1, ty: 0 },
      { name: 'w', nx: -1, ny: 0, len: c.h, at: (t) => [c.x, c.y + t], tx: 0, ty: 1 },
      { name: 'e', nx: 1, ny: 0, len: c.h, at: (t) => [c.x + c.w, c.y + t], tx: 0, ty: 1 },
    ];
    for (const sd of sides) {
      const n = Math.max(1, Math.floor(sd.len / TILE));
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) * sd.len) / n;
        const [ex, ey] = sd.at(t);
        const x = ex + sd.nx * OFF, y = ey + sd.ny * OFF;
        if (!free(world, x, y)) continue;
        const spot = { id: `${ci}:${sd.name}:${i}`, x, y, nx: sd.nx, ny: sd.ny, cover: c, type: c.type, peeks: [] };
        if (c.type === 'high') {
          // Kikk rundt begge hjørnene langs siden
          for (const [cx, cy, dir] of [[...sd.at(0), -1], [...sd.at(sd.len), 1]]) {
            const px = cx + sd.tx * dir * (R + 6) + sd.nx * OFF, py = cy + sd.ty * dir * (R + 6) + sd.ny * OFF;
            if (free(world, px, py) && segmentClear(world, x, y, px, py, R - 4) && dist(x, y, px, py) < 110) spot.peeks.push({ x: px, y: py });
          }
        }
        spots.push(spot);
      }
    }
  });
  cache.set(world, { sig, spots });
  return spots;
}

/** Beskyttelseskvalitet 0..1 for et spot mot en trussel i (tx,ty): andel av 3 prøvepunkter som er dekket. */
export function protection(world, spot, tx, ty) {
  const dx = spot.x - tx, dy = spot.y - ty, L = Math.hypot(dx, dy) || 1;
  const px = -dy / L, py = dx / L;
  let ok = 0;
  for (const o of [-9, 0, 9]) {
    const sx = spot.x + px * o, sy = spot.y + py * o;
    if (spot.type === 'high') { if (!lineOfSight(world, tx, ty, sx, sy)) ok++; }
    else { const pr = coverProtecting(world, tx, ty, sx, sy, R); if (pr) ok++; }
  }
  return ok / 3;
}

/** Hvor kan fienden skyte fra når den sitter i dette spotet? → {x,y} eller null. */
export function firingPoint(world, spot, tx, ty) {
  if (spot.type === 'low') return lineOfSight(world, spot.x, spot.y, tx, ty) ? { x: spot.x, y: spot.y } : null;
  let best = null, bd = Infinity;
  for (const p of spot.peeks) {
    if (!lineOfSight(world, p.x, p.y, tx, ty)) continue;
    const d = dist(p.x, p.y, spot.x, spot.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/**
 * Score et spot for fiende e mot trussel (tx,ty). Høyere er bedre; -Infinity = ugyldig.
 * opts: { idealRange, minRange, maxRange, band:[r0,r1] (ruter), typeBonus:{low,high}, reserved:Map(id→enemy), others:[{x,y}], current, front }
 */
export function scoreSpot(world, e, spot, tx, ty, opts) {
  const owner = opts.reserved.get(spot.id);
  if (owner && owner !== e) return -Infinity;
  if (e._badSpots && (e._badSpots.get(spot.id) ?? -1) > (world.time ?? 0)) return -Infinity;   // 28.10: blokkert/uten sti nylig
  const dT = dist(spot.x, spot.y, tx, ty);
  if (dT < opts.minRange || dT > opts.maxRange) return -Infinity;
  const q = protection(world, spot, tx, ty);
  if (q < 0.67) return -Infinity;
  let s = q * 2;
  s -= Math.abs(dT - opts.idealRange) / 90;                 // hold riktig avstand ("holder linja")
  if (opts.band) {                                           // skuddhold etter våpenets skadefall (stats.band, ruter)
    const [b0, b1] = opts.band, r = dT / 32;
    s += r >= b0 && r <= b1 ? 1.0 : -1.2 * (r < b0 ? b0 - r : r - b1);
  }
  s -= dist(e.x, e.y, spot.x, spot.y) / 160;                // kort vei er bra
  s += firingPoint(world, spot, tx, ty) ? 1.5 : -2.5;       // må kunne slåss herfra
  s += opts.typeBonus?.[spot.type] ?? 0;                     // datadrevet typepreferanse (stats.coverBias)
  if (opts.current === spot) s += 0.9;                      // hysterese: ikke hopp rundt
  for (const o of opts.others) {                            // spre laget
    const d = dist(o.x, o.y, spot.x, spot.y);
    if (d < 96) s -= (96 - d) / 22;
  }
  for (const [id, o] of opts.reserved) {                   // 28.10 spredning: ikke ta spot tett ved en alliert sin reserverte spot
    if (o === e || o.dead || id === spot.id || !o.spot) continue;
    const d = dist(o.spot.x, o.spot.y, spot.x, spot.y);
    if (d < 80) s -= (80 - d) / 20;
  }
  // Hold linja: ikke-flankere skal holde seg i lagets front (flanking er tokenstyrt)
  if (opts.front !== undefined) {
    const dev = Math.abs(angleDiff(opts.front, Math.atan2(spot.y - ty, spot.x - tx)));
    const lim = opts.frontDev ?? 0.87; // ~50°
    if (dev > lim) s -= (dev - lim) / 0.21; // −1 per ~12°
  }
  // Unngå å gå tvers gjennom spillerens skuddlinje: straff spots der veien krysser nær spilleren
  const midx = (e.x + spot.x) / 2, midy = (e.y + spot.y) / 2;
  if (dist(midx, midy, tx, ty) < opts.minRange * 0.8) s -= 1.5;
  return s;
}

export function bestSpot(world, e, tx, ty, opts) {
  let best = null, bs = -Infinity;
  for (const sp of getSpots(world)) {
    const s = scoreSpot(world, e, sp, tx, ty, opts);
    if (s > bs) { bs = s; best = sp; }
  }
  return best ? { spot: best, score: bs } : null;
}
