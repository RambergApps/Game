// Små kinematikkhjelpere for Cinderborn-modellene.
import { add, sub, mul, norm, dot } from './paint3d.js';

/** To-ledds IK: fra a til c med lengder l1/l2, knær mot bend. → kne/albue. */
export function ik(a, c, l1, l2, bend) {
  const d = sub(c, a), L = Math.hypot(d[0], d[1], d[2]) || 1, dn = mul(d, 1 / L);
  const Lc = Math.min(L, l1 + l2 - 0.01);
  const x = (l1 * l1 - l2 * l2 + Lc * Lc) / (2 * Lc), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const b = norm(sub(bend, mul(dn, dot(bend, dn))));
  return add(add(a, mul(dn, x)), mul(b, h));
}
/** Steg: fase 0..1 → fotforskyvning (støttefase 0–0,5 lineært bakover = ingen gli; svingfase med løft). */
export function stride(ph, sw, lift) {
  const p = ((ph % 1) + 1) % 1;
  if (p < 0.5) return { dx: sw - (p / 0.5) * 2 * sw, lift: 0 };
  const t = (p - 0.5) / 0.5; return { dx: -sw + (t * t * (3 - 2 * t)) * 2 * sw, lift: Math.sin(t * Math.PI) * lift };
}
/** Bruk f på alle punkter i en modell (også inner). */
export function mapItems(M, f) { for (const it of M.items) { it.pts = it.pts.map(f); if (it.inner) it.inner = f(it.inner); } }
