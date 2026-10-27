// Geometri. Cover = { x, y, w, h, type }, (x,y) er øvre venstre hjørne.
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function angleDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

/** Segment A→B mot rektangel (slab). Returnerer t∈[0,1] for første treff eller null. */
export function segmentRect(ax, ay, bx, by, r, pad = 0) {
  const dx = bx - ax, dy = by - ay; let t0 = 0, t1 = 1;
  const x0 = r.x - pad, x1 = r.x + r.w + pad, y0 = r.y - pad, y1 = r.y + r.h + pad;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t0;
}

/** Første cover langs A→B. opts.types (default ['high']), opts.pad. → { cover, t, x, y, nx, ny } | null */
export function raycastCover(world, ax, ay, bx, by, opts = {}) {
  const types = opts.types || ['high'], pad = opts.pad || 0; let best = null;
  for (const c of world.cover) {
    if (!types.includes(c.type)) continue;
    const t = segmentRect(ax, ay, bx, by, c, pad);
    if (t !== null && (!best || t < best.t)) best = { cover: c, t };
  }
  if (!best) return null;
  const x = ax + (bx - ax) * best.t, y = ay + (by - ay) * best.t, c = best.cover;
  const dl = Math.abs(x - (c.x - pad)), dr = Math.abs(x - (c.x + c.w + pad)), dt = Math.abs(y - (c.y - pad)), db = Math.abs(y - (c.y + c.h + pad));
  const m = Math.min(dl, dr, dt, db);
  const [nx, ny] = m === dl ? [-1, 0] : m === dr ? [1, 0] : m === dt ? [0, -1] : [0, 1];
  return { ...best, x, y, nx, ny };
}

/** true hvis ingen HIGH cover blokkerer A→B. Low cover blokkerer ikke sikt. */
export function lineOfSight(world, ax, ay, bx, by) { return raycastCover(world, ax, ay, bx, by) === null; }

/** Nærmeste punkt på rektangel. */
export function closestPointOnRect(r, x, y) { return { x: clamp(x, r.x, r.x + r.w), y: clamp(y, r.y, r.y + r.h) }; }

/** Nærmeste cover innen maxDist (målt til kanten). opts.type: 'low'|'high' filter, opts.filter(c).
 *  → { cover, dist, point:{x,y}, normal:{x,y} (fra cover mot (x,y)) } | null */
export function nearestCover(world, x, y, maxDist = Infinity, opts = {}) {
  let best = null;
  for (const c of world.cover) {
    if (opts.type && c.type !== opts.type) continue;
    if (opts.filter && !opts.filter(c)) continue;
    const p = closestPointOnRect(c, x, y), d = dist(x, y, p.x, p.y);
    if (d <= maxDist && (!best || d < best.dist)) best = { cover: c, dist: d, point: p };
  }
  if (best) {
    let nx = x - best.point.x, ny = y - best.point.y; const l = Math.hypot(nx, ny);
    if (l > 1e-6) { nx /= l; ny /= l; } else { const c = best.cover; const cx = c.x + c.w / 2, cy = c.y + c.h / 2; if (Math.abs(x - cx) / c.w > Math.abs(y - cy) / c.h) { nx = Math.sign(x - cx) || 1; ny = 0; } else { nx = 0; ny = Math.sign(y - cy) || 1; } }
    best.normal = { x: nx, y: ny };
  }
  return best;
}

/** Sirkel (cx,cy,r) mot rektangel. → null eller { x, y } = push-vektor for å løse overlapp. */
export function circleRectCollide(cx, cy, r, rect) {
  const p = closestPointOnRect(rect, cx, cy); let dx = cx - p.x, dy = cy - p.y; const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; return { x: dx * k, y: dy * k }; }
  // sentrum inne i rektangelet: skyv ut korteste vei
  const l = cx - rect.x, rr = rect.x + rect.w - cx, t = cy - rect.y, b = rect.y + rect.h - cy, m = Math.min(l, rr, t, b);
  return m === l ? { x: -(l + r), y: 0 } : m === rr ? { x: rr + r, y: 0 } : m === t ? { x: 0, y: -(t + r) } : { x: 0, y: b + r };
}

/** Flytt en sirkel-entity ut av alt cover (begge typer) og innenfor world.bounds. Muterer e.x/e.y. */
export function resolveCircleVsCover(world, e, r = e.r) {
  for (let i = 0; i < 2; i++) for (const c of world.cover) { const p = circleRectCollide(e.x, e.y, r, c); if (p) { e.x += p.x; e.y += p.y; } }
  const b = world.bounds; e.x = clamp(e.x, b.x + r, b.x + b.w - r); e.y = clamp(e.y, b.y + r, b.y + b.h - r);
}
