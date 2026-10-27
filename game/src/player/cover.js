// Dekningsdeteksjon for Warden (ANIMASJON.md §5.3). Flater med samme normal på linje slås sammen til «linjer»
// slik at man glir sømløst langs kasser som står inntil hverandre.
import { circleRectCollide } from '../core/index.js';
import { TUNING as T } from './tuning.js';
import { clamp } from './math.js';

let cache = { src: null, n: -1, lines: [] };

/** Alle dekningslinjer (bygges på nytt hvis world.cover er byttet ut eller endret lengde). */
export function coverLines(world) {
  if (cache.src === world.cover && cache.n === world.cover.length) return cache.lines;
  const faces = [];
  for (const c of world.cover) {
    if (c.type !== 'high' && c.type !== 'low') continue;   // vann (type 'water', yard-v2) stopper gange, men er ikke dekning
    faces.push({ nx: -1, ny: 0, f: c.x, tmin: c.y, tmax: c.y + c.h, c });
    faces.push({ nx: 1, ny: 0, f: c.x + c.w, tmin: c.y, tmax: c.y + c.h, c });
    faces.push({ nx: 0, ny: -1, f: c.y, tmin: c.x, tmax: c.x + c.w, c });
    faces.push({ nx: 0, ny: 1, f: c.y + c.h, tmin: c.x, tmax: c.x + c.w, c });
  }
  const groups = new Map();
  for (const fc of faces) {
    const k = `${fc.nx},${fc.ny},${fc.c.type},${Math.round(fc.f / 2)}`;
    if (!groups.has(k)) groups.set(k, []); groups.get(k).push(fc);
  }
  const lines = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.tmin - b.tmin);
    let cur = null;
    for (const fc of g) {
      if (cur && fc.tmin - cur.tmax <= T.coverMergeGap && Math.abs(fc.f - cur.f) <= 2) { cur.tmax = Math.max(cur.tmax, fc.tmax); cur.covers.push(fc.c); }
      else { cur = { nx: fc.nx, ny: fc.ny, f: fc.f, tmin: fc.tmin, tmax: fc.tmax, type: fc.c.type, covers: [fc.c] }; lines.push(cur); }
    }
  }
  for (const l of lines) { l.tx = l.nx !== 0 ? 0 : 1; l.ty = l.nx !== 0 ? 1 : 0; l.cover = l.covers[0]; }
  cache = { src: world.cover, n: world.cover.length, lines };
  return lines;
}

/** Verdensposisjon for kroppssenter i dekning ved posisjon `along` langs linjen. */
export function coverPos(line, along, standoff = T.coverStandoff) {
  return line.nx !== 0 ? { x: line.f + line.nx * standoff, y: along } : { x: along, y: line.f + line.ny * standoff };
}
export const alongOf = (line, x, y) => (line.nx !== 0 ? y : x);
/** Hvilket cover-rektangel på linjen som ligger bak posisjonen `along`. */
export function coverAt(line, along) { for (const c of line.covers) { const a = line.nx !== 0 ? c.y : c.x, b = a + (line.nx !== 0 ? c.h : c.w); if (along >= a - 1 && along <= b + 1) return c; } return line.cover; }

/** Er en sirkel (r) fri for alt cover og innenfor bounds? */
export function freeAt(world, x, y, r = T.collisionRadius - 0.5) {
  const b = world.bounds; if (x < b.x + r || y < b.y + r || x > b.x + b.w - r || y > b.y + b.h - r) return false;
  for (const c of world.cover) if (circleRectCollide(x, y, r, c)) return false;
  return true;
}
function sweepFree(world, ax, ay, bx, by, r = T.collisionRadius - 1) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 5));
  for (let i = 1; i <= n; i++) { const t = i / n; if (!freeAt(world, ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false; }
  return true;
}

/** Finn beste dekningskandidat. opts: { radius, cone, dir:{x,y}|null, exclude:line|null, lookahead } → { line, along, x, y, dist } | null */
export function findCover(world, px, py, opts) {
  const { radius, cone = Math.PI, dir = null, exclude = null, lookahead = T.coverLookahead } = opts;
  const lx = px + (dir ? dir.x * lookahead : 0), ly = py + (dir ? dir.y * lookahead : 0);
  const cosCone = Math.cos(cone);
  let best = null;
  for (const L of coverLines(world)) {
    if (L === exclude) continue;
    const side = L.nx !== 0 ? (px - L.f) * L.nx : (py - L.f) * L.ny;
    if (side < -1) continue;                                   // spilleren står på feil side av flaten
    const lo = L.tmin + T.coverEndInset, hi = L.tmax - T.coverEndInset; if (hi < lo) continue;
    const along = clamp(alongOf(L, lx, ly), lo, hi);
    const fp = L.nx !== 0 ? { x: L.f, y: clamp(py, L.tmin, L.tmax) } : { x: clamp(px, L.tmin, L.tmax), y: L.f };
    if (Math.hypot(fp.x - px, fp.y - py) > radius) continue;
    const S = coverPos(L, along), dx = S.x - px, dy = S.y - py, d = Math.hypot(dx, dy);
    let cosT = 1;
    if (dir && d > 10) { cosT = (dx * dir.x + dy * dir.y) / d; if (cosT < cosCone) continue; }
    if (!freeAt(world, S.x, S.y)) continue;
    if (d > 2 && !sweepFree(world, px, py, S.x, S.y)) continue;
    let score = d * (1 + 1.5 * (1 - cosT));
    if (dir && -(L.nx * dir.x + L.ny * dir.y) > 0.7) score *= 0.8;
    if (!best || score < best.score) best = { line: L, along, x: S.x, y: S.y, dist: d, score };
  }
  return best;
}

/** Hjørneinfo for posisjon `along` på linjen: { side:-1|1|0, dist } (side = retning langs tangenten mot nærmeste frie ende). */
export function cornerInfo(world, L, along) {
  const dl = along - L.tmin, dh = L.tmax - along;
  const side = dl < dh ? -1 : 1, dist = Math.min(dl, dh);
  // ende er konveks (kan kikkes rundt) hvis plassen like forbi enden er fri
  const endA = side < 0 ? L.tmin - 14 : L.tmax + 14, p = coverPos(L, endA, T.coverStandoff - 4);
  const convex = freeAt(world, p.x, p.y, 8);
  return { side, dist, convex, at: convex && dist <= T.cornerZone + T.coverEndInset + 2 };
}
