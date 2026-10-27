// Fiende-AI: kun geometri som kjernen (src/core/geom.js) ikke dekker.
// Siktlinje, raycast, nærmeste cover, kollisjon og prosjektiler kommer fra core.
import { segmentRect, angleDiff, clamp, dist, LOW_COVER_RANGE } from '../core/index.js';

export const TILE = 32;

/** Drei vinkel a mot b med maks steg. */
export function turnToward(a, b, maxStep) {
  const d = angleDiff(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
}

export const randRange = (world, a, b) => a + (b - a) * world.rng();
export const pick = (world, [a, b]) => randRange(world, a, b);

export function pointInRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

export function distToRect(x, y, r) {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Fri bane for en sirkel med radius pad langs segmentet (alt cover blokkerer bevegelse). */
export function segmentClear(world, ax, ay, bx, by, pad) {
  for (const c of world.cover) if (segmentRect(ax, ay, bx, by, c, pad) !== null) return false;
  return true;
}

/**
 * Hvilket cover beskytter et mål i (tx,ty) mot en skytter i (fx,fy)? Speiler reglene i core/combat:
 * high mellom dem → 'high'; low som målet står tett bak (≤ LOW_COVER_RANGE + r) og som ikke er
 * skytterens eget (≥ 40 px fra skytter) → 'low'. Returnerer { cover, type } eller null.
 */
export function coverProtecting(world, fx, fy, tx, ty, r = 14) {
  let low = null;
  const L = dist(fx, fy, tx, ty);
  for (const c of world.cover) {
    const t = segmentRect(fx, fy, tx, ty, c);
    if (t === null) continue;
    if (c.type === 'high') return { cover: c, type: 'high' };
    if (c.type !== 'low') continue;   // vann stopper gange, ikke kuler
    const along = t * L;
    if (!low && along >= 40 && L - along <= LOW_COVER_RANGE + r) low = { cover: c, type: 'low' };
  }
  return low;
}

export { clamp, dist, angleDiff };
