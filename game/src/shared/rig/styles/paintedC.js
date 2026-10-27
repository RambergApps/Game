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
  const o = { x: F.x, y: F.y, aim, move: walk ? F.moveAngle : (F.hipAngle ?? aim), phase: walk ? F.phase || 0 : null,
    kneel, gunZ: (P.blind || 0) * 9 - (1 - (P.aim || 0)) * 2 + (pose.bz || 0), alpha: F.alpha ?? 1 };
  if (F.mode === 'cover' && F.cover?.type === 'low') {   // 27.10: lav dekning – dukket (hunch) ↔ reist over kanten, styrt av rå peek (0,14 s opp / 0,12 s ned)
    const pr = Math.min(1, Math.max(0, P.peekRaw ?? P.peek ?? 0)), up = pr * pr * (3 - 2 * pr), bl = Math.min(1, Math.max(0, P.blindRaw ?? P.blind ?? 0));
    const nx = F.cover.nx || 0, ny = F.cover.ny || 0;   // n peker bort fra dekningen
    const deep = F.cover.kind === 'barrier' ? 1.45 : 1;   // mur er visuelt lavere enn sekker/kasser → kryp mer sammen
    o.kneel = 1 - up; o.phase = null; o.hunch = (1 - up) * deep;   // v2: ingen frittstående z-løft av overkroppen (ga brudd mot hoftene)
    const ln = 4.5 * up + 1.5 * (1 - up);
    o.x -= nx * ln; o.y -= ny * ln;   // v2: HELE figuren (bein + overkropp) flyttes mot kanten – henger sammen
    o.gunZ = (1 - up) * (-9 + bl * 15) + up * o.gunZ;   // dukket: rifla nede; blindfire: bare rifla over kanten
  }
  return o;
}
const rollU = (r) => { if (!r) return 0; const k = r.k || 0; return r.phase === 'dive' ? .18 * k : r.phase === 'over' ? .18 + .48 * k : r.phase === 'land' ? .66 + .18 * k : .84 + .16 * k; };
/** Rull og død i C-stil: samme malte overkropp (retning = bevegelse/fall) + rad 4-bein, tuck/fall som rotasjon og sammenpressing. */
function wholeArgs(F) {
  const dir = F.mode === 'death' ? F.hipAngle : (F.moveAngle ?? F.torsoAngle ?? F.hipAngle), c = Math.cos(dir), s = Math.sin(dir);
  const base = { x: F.x, y: F.y, aim: dir, move: dir, phase: null, alpha: F.alpha ?? 1 };
  if (F.mode === 'death') {   // 27.10 r2: ekte dødsanim – rykk, knærne svikter, faller til siden, krøller seg sammen (fosterstilling), holdes
    const ns = Math.abs(s) > 0.6, side = c >= 0 ? 1 : -1;
    if (ns) { base.move = side > 0 ? 0 : Math.PI; base.aim = side > 0 ? 0.6 : Math.PI - 0.6; }   // visiret synlig når han ligger
    const u = F.clip?.death?.u ?? 1, sm = (a, b) => { const q = Math.min(1, Math.max(0, (u - a) / (b - a))); return q * q * (3 - 2 * q); };
    const rk = sm(0, .1) * (1 - sm(.1, .3)), kn = sm(.1, .42), lq = Math.min(1, Math.max(0, (u - .38) / .3)), l = lq * lq;   // fall akselererer
    const bo = Math.sin(Math.min(1, Math.max(0, (u - .68) / .14)) * Math.PI) * (1 - sm(.68, .9)), cu = sm(.62, .95);
    const C = ns ? 1 : Math.abs(c), S = ns ? 0 : s, X = ns ? side : c;
    return { ...base, kneel: kn, lie: l, curl: cu, curlSide: side, gunZ: -6 * kn, noGun: u > .26, drop: u > .26 ? sm(.22, .45) : null,
      up: { rot: side * (-0.12 * rk + 0.18 * kn * (1 - l) + l * 1.25 * (0.35 + 0.65 * C) + 0.12 * cu),
        sy: 1 - 0.45 * l * Math.abs(S) - 0.16 * cu, dx: X * (10 * l - 1.5 * cu) - X * 1.5 * rk, dy: S * 7 * l + 5.4 * kn - 2.2 * bo - 1.5 * rk + 1.2 * cu } };
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
    const r = drawWardenC(ctx, { ...A, x: A.x - Math.cos(A.aim) * rec, y: A.y - Math.sin(A.aim) * rec, legs: 'painted', look: A.noGun ? null : look, dropLook: A.drop != null ? look : null, zoom });
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
