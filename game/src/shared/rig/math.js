// Felles matte for riggen (Warden + Protocol-fiender). All vinkelaritmetikk går via wrap() – ingen hopp ved ±π.
export const TAU = Math.PI * 2, PI = Math.PI;
/** Vinkel → [-π, π). */
export const wrap = (a) => a - TAU * Math.floor((a + PI) / TAU);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpAng = (a, b, t) => wrap(a + wrap(b - a) * t);
/** Rammeuavhengig eksponentiell demping mot b. */
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const dampAng = (a, b, k, dt) => wrap(a + wrap(b - a) * (1 - Math.exp(-k * dt)));
/** Kritisk dempet vinkelfjær på korteste vei. s = { a, v }. */
export function springAngle(s, target, omega, dt, maxRate = Infinity) {
  const e = wrap(target - s.a);
  s.v += (omega * omega * e - 2 * omega * s.v) * dt;
  s.v = clamp(s.v, -maxRate, maxRate);
  s.a = wrap(s.a + s.v * dt);
}
/** Underdempet skalarfjær (implisitt, stabil). s = { x, v }. */
export function spring(s, target, freq, zeta, dt) {
  const w = TAU * freq, f = 1 + 2 * dt * zeta * w, oo = w * w, hoo = dt * oo, hhoo = dt * hoo, det = 1 / (f + hhoo);
  s.x = (f * s.x + dt * s.v + hhoo * target) * det; s.v = (s.v + hoo * (target - s.x)) * det;
}
export const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeInOutSine = (t) => -(Math.cos(PI * t) - 1) / 2;
export const easeOut3 = (t) => 1 - Math.pow(1 - t, 3);
export const easeOut2 = (t) => 1 - (1 - t) * (1 - t);
export const easeIn2 = (t) => t * t;
export const easeOutBack = (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
/** Liten deterministisk PRNG (for slitasjemerker o.l. – samme mønster hver ramme). */
export function prng(seed) { let s = (seed * 2654435761) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const D = PI / 180; export const deg = (d) => d * D;
/** 2-ledds IK: skulder (sx,sy) → hånd (hx,hy), lengder l1/l2, bendSign ±1 → [albueX, albueY, håndX, håndY]. */
export function ik(sx, sy, hx, hy, l1, l2, bendSign) {
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy); const maxd = l1 + l2 - 0.01;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; hx = sx + dx; hy = sy + dy; d = maxd; }
  if (d < 1e-6) return [sx + l1, sy, hx, hy];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)); const mx = sx + dx * a / d, my = sy + dy * a / d;
  return [mx - dy / d * h * bendSign, my + dx / d * h * bendSign, hx, hy];
}
export const smooth01 = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
