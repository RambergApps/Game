// BREACH – hjelpere for våpen-utseende (faceted). Eies av Breach Våpen. 2026-10-23.
// Delene skrives i designarkets mål (reviews/img/vapen-design/geometry.json, AR-9 = 30 px) og skaleres
// likt til spillskala (Breach 23.10: skala 36 → AR-9 36 px, S-12 30 px, M-4 50 px).
// Våpenrom: x fram langs løpet, y mot høyre, z opp, origo = høyre hånds grep. Verdens-px.
import { registerWeaponLook, weaponMats } from '../../shared/rig/faceted/weapons/index.js';

export const GAME_LENGTH = { rifle: 36, shotgun: 30, marksman: 50 };
export const SHEET_LENGTH = { rifle: 30, shotgun: 25, marksman: 42 };
export const scaleOf = (id) => GAME_LENGTH[id] / SHEET_LENGTH[id];

/** Boks fra sideprofil: x0..x1 langs løpet, z0..z1 opp, w bredde (sentrert på yc). */
export const B = (id, x0, x1, z0, z1, w, mat, o = {}, yc = 0) => ({ id, box: [x0, x1, yc - w / 2, yc + w / 2, z0, z1], mat, ...o });
/** Flat plate på begge sider av en del (y = ±halv bredde + 0,04), synlig fra den siden som vender mot kamera. */
export function sidePlates(on, x0, x1, z0, z1, hw, mat, o = {}) {
  const y = hw + .04;
  return [1, -1].map(s => ({ plate: [{ x: x0, y: s * y, z: z0 }, { x: x1, y: s * y, z: z0 }, { x: x1, y: s * y, z: z1 }, { x: x0, y: s * y, z: z1 }], on, mat, n: { x: 0, y: s, z: 0 }, ...o }));
}
/** Plate på toppflaten av en del (z), f.eks. linse eller slisser. */
export const topPlate = (on, x0, x1, y0, y1, z, mat, o = {}) => ({ plate: [{ x: x0, y: y0, z }, { x: x1, y: y0, z }, { x: x1, y: y1, z }, { x: x0, y: y1, z }], on, mat, n: { x: 0, y: 0, z: 1 }, ...o });
/** Plate på frontflaten (+x) av en del – munningsåpning. */
export const frontPlate = (on, x, y0, y1, z0, z1, mat, o = {}) => ({ plate: [{ x, y: y0, z: z0 }, { x, y: y1, z: z0 }, { x, y: y1, z: z1 }, { x, y: y0, z: z1 }], on, mat, n: { x: 1, y: 0, z: 0 }, ...o });

const r3 = (v) => Math.round(v * 1000) / 1000;
const sp = (p, k) => ({ ...p, x: r3((p.x || 0) * k), y: r3((p.y || 0) * k), z: r3((p.z || 0) * k) });
/** Skaler hele defen likt (geometri, festepunkter, vandring). Ikke-geometriske felt beholdes. */
export function scaled(def, k) {
  const parts = def.parts.map(p => {
    const q = { ...p };
    if (p.box) q.box = p.box.map(v => r3(v * k));
    if (p.beam) { q.beam = p.beam.map(e => sp(e, k)); q.w = p.w * k; q.h = p.h * k; }
    if (p.plate) q.plate = p.plate.map(e => sp(e, k));
    for (const f of ['c', 'bevel', 'topShift']) if (p[f] != null) q[f] = p[f] * k;
    return q;
  });
  const points = {}; for (const [n, p] of Object.entries(def.points)) points[n] = sp(p, k);
  const moving = {}; for (const [n, m] of Object.entries(def.moving || {})) moving[n] = { ...m, travel: m.travel * k };
  return { ...def, parts, points, moving, sheetScale: k };
}

/**
 * Ekstra palettnøkkel `accent` (AR-9: blå stripe, S-12: messing i skallholderen). Warden-designs weaponMats lager i dag
 * bare metal/metalDark/polymer/wrap/led. Finnes ikke `${id}:accent`, males accent-platene som `fallback` (ingen grå
 * standardflate i spillet). Forslag til Warden-design: legg 'accent' (flat, wear 0) inn i weaponMats.
 */
function accentFallback(def, fallback = 'metal') {
  let ok = false; try { ok = !!weaponMats(def)[`${def.id}:accent`]; } catch { ok = false; }
  if (ok) return def;
  return { ...def, parts: def.parts.map(p => p.mat === 'accent' ? { ...p, mat: p.accentFallback || fallback } : p) };
}

/** Skaler, sikre accent og registrer. Legger også til `lengthPx` (målt fra delene) for kontroll. */
export function defineLook(def) {
  const k = scaleOf(def.id);
  let d = accentFallback(scaled(def, k));
  let x0 = 1e9, x1 = -1e9;
  for (const p of d.parts) { if (p.box) { x0 = Math.min(x0, p.box[0]); x1 = Math.max(x1, p.box[1]); } if (p.beam) for (const e of p.beam) { x0 = Math.min(x0, e.x); x1 = Math.max(x1, e.x); } }
  d.lengthPx = +(x1 - x0).toFixed(2);
  return registerWeaponLook(d);
}
