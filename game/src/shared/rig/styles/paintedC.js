// Tegnestil «paintedC» (Warden variant C i spillet) – Breach Warden-design, 2026-10-27.
// Malt overkropp (8 retninger, img/c5 = c4 + kjølig kantlys, lysere hjelm/skuldre (kontrast mot asfalt); img/c4 = c3 med ommalt rygg/sekk N/NW/NE og 55°-hjelmtopp; img/c3 = c2 med mer kobolt/cyan og lysere hjelm) + malte pansrede bein (rad 4) på riggen.
// Rulling og død delegeres foreløpig til faceted (helkropp-sprites). Før bildene er lastet tegnes faceted.
import { PROJ } from '../../projection.js';
import { faceted } from './faceted.js';
import { loadPaintedC, drawWardenC, hipBob, gripOf } from '../paintedC/paintedC.js';
import { weaponLook } from '../faceted/weapons/index.js';

let ready = false;
if (typeof document !== 'undefined') loadPaintedC(new URL('../paintedC/img/c5/', import.meta.url)).then(() => { ready = true; }, (e) => console.warn('paintedC load', e));
export const STATS = { figures: 0, ms: 0 };

function args(rig, F) {
  const P = F.posture || {}, K = F.skel || {};
  const aim = K.ra ?? K.ta ?? F.torsoAngle ?? F.aimAngle ?? 0;
  const kneel = Math.max(P.kneel || 0, P.slide || 0);
  const walk = (F.amp || 0) > 0.2 && kneel < 0.5;
  const pose = K.pose || {};
  return { x: F.x, y: F.y, aim, move: walk ? F.moveAngle : (F.hipAngle ?? aim), phase: walk ? F.phase || 0 : null,
    kneel, gunZ: (P.blind || 0) * 9 - (1 - (P.aim || 0)) * 2 + (pose.bz || 0), alpha: F.alpha ?? 1 };
}
const rollU = (r) => { if (!r) return 0; const k = r.k || 0; return r.phase === 'dive' ? .18 * k : r.phase === 'over' ? .18 + .48 * k : r.phase === 'land' ? .66 + .18 * k : .84 + .16 * k; };
/** Rull og død i C-stil: samme malte overkropp (retning = bevegelse/fall) + rad 4-bein, tuck/fall som rotasjon og sammenpressing. */
function wholeArgs(F) {
  const dir = F.mode === 'death' ? F.hipAngle : (F.moveAngle ?? F.torsoAngle ?? F.hipAngle), c = Math.cos(dir), s = Math.sin(dir);
  const base = { x: F.x, y: F.y, aim: dir, move: dir, phase: null, alpha: F.alpha ?? 1 };
  if (F.mode === 'death') {
    const ns = Math.abs(s) > 0.6, side = c >= 0 ? 1 : -1;   // N/S: faller til siden (ligger på tvers, leses bedre ovenfra)
    if (ns) { base.move = side > 0 ? 0 : Math.PI; base.aim = side > 0 ? 0.6 : Math.PI - 0.6; }   // visiret synlig når han ligger
    const k = F.clip?.death ? F.clip.death.fall : 1, kn = Math.min(1, k * 2), l = Math.max(0, k * 2 - 1);
    return { ...base, kneel: kn, lie: l, gunZ: -6 * kn, noGun: k > 0.45,
      up: ns ? { rot: l * 1.3 * side, sy: 1 - 0.15 * l, dx: side * 1 * l, dy: 5 * kn } : { rot: l * 1.25 * side * (0.35 + 0.65 * Math.abs(c)), sy: 1 - 0.45 * l * Math.abs(s), dx: c * 10 * l, dy: s * 7 * l + 9 * kn * 0.6 } };
  }
  const u = rollU(F.clip?.roll), t = Math.sin(Math.PI * Math.min(1, u * 1.15));   // tuck 0→1→0
  return { ...base, kneel: Math.min(1, t * 1.5), gunZ: -8 * t, noGun: t > 0.55,
    up: { rot: Math.sin(u * Math.PI * 2) * 0.55 * Math.sign(c || 1) * (0.3 + 0.7 * Math.abs(c)), sy: 1 - 0.3 * t, dx: c * 4 * t, dy: s * 4 * t + 6 * t } };
}
function whole(F) { return F.mode === 'death' || (F.clip?.roll && (F.posture?.roll || 0) > 0.2); }

export const paintedC = {
  name: 'paintedC',
  get ready() { return ready; },
  drawFigure(ctx, rig, F, opts = {}) {
    if (!ready) return faceted.drawFigure(ctx, rig, F, opts);
    const t0 = performance.now();
    const m = ctx.getTransform(), zoom = Math.hypot(m.a, m.b) || 1;
    const look = weaponLook(rig.__wpnId || 'rifle');
    const A = whole(F) ? wholeArgs(F) : args(rig, F);
    if (typeof opts.under === 'function') opts.under(ctx); else if (typeof F.under === 'function') F.under(ctx);
    const rec = (F.S?.recoil || 0) * 2.2;
    const r = drawWardenC(ctx, { ...A, x: A.x - Math.cos(A.aim) * rec, y: A.y - Math.sin(A.aim) * rec, legs: 'painted', look: A.noGun ? null : look, zoom });
    if (F.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * F.flash; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(A.x, A.y - 18, 10, 18, 0, 0, 7); ctx.fill(); ctx.restore(); }
    rig.__cMuzzle = r.muzzle; STATS.figures++; STATS.ms += performance.now() - t0;
  },
  /** Munning {x,y,z} fra samme geometri som tegningen (grep + våpen-defens muzzle). Faceted før lasting/i rull. */
  muzzleOf(rig, weaponId) {
    const F = rig.frame(); if (!ready) return faceted.muzzleOf(rig, weaponId);
    const A = whole(F) ? wholeArgs(F) : args(rig, F), look = weaponLook(weaponId || 'rifle'), m = look.points.muzzle, a = A.aim, c = Math.cos(a), s = Math.sin(a);
    const g = gripOf(A.x, A.y, a, A.gunZ + hipBob(A.phase, A.kneel));
    return { x: g.x + m.x * c - m.y * s, y: g.y + m.x * s + m.y * c, z: g.z + (m.z || 0) };
  },
  sortKey(F) { return PROJ.sortKey({ x: F.x, y: F.y, r: 12 }); },
};
export default paintedC;
