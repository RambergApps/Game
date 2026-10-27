// BREACH – Våpen i skrå trekvartvinkel (view=34). Høyde (z) og dybde for alt Våpen tegner i lufta.
// Logikken er fortsatt ren ovenfra: z påvirker BARE tegningen (og payloadene, så VFX slipper å regne selv).
//
//   muzzleZ(world, e, d)     – løpshøyde i verdens-px: e.muzzleZ (tall eller funksjon(world, d)) → e.gunZ → d.muzzle.z
//                              → aktørhøyde × d.muzzle.zFrac (standard 0,6)
//                              (stående 48 → 28,8, huket 30 → 18). Warden-design / Fiende-AI eksponerer muzzleZ.
//   lift(world)              – skjerm-px oppover per verdens-px z: PROJ.zScale i 34, 0 ovenfra.
//   sy(world, y, z)          – skjerm-y for et punkt i høyde z (verdenskoordinater, kameratransform satt).
//   hidden(world, x, y, z)   – true hvis punktet (x, y, z) er bak et dekningsobjekt sett fra kameraet (se under).
//   coverHeight(o)           – høyde i verdens-px for et cover-/coverObjects-objekt.
//
// Okklusjon (hvorfor ikke bare et «luftlag» etter drawSorted): alt etter drawSorted tegnes OVER tak og vegger.
// I 34 går synslinjen fra et punkt mot kameraet langs (0, +d, +d/zScale): sørover og oppover samtidig. Et punkt er
// skjult hvis den linja går gjennom en boks: x innenfor boksen, punktet nord for boksens sørkant (y < o.y + o.h) og
// z + max(0, o.y − y) / zScale ≤ boksens høyde. Det er nøyaktig det samme som at boksen ville blitt tegnet etter
// punktet i drawSorted OG dekker det på skjermen, men uten å endre core/shared. Lav dekning skjuler bare det som er
// lavere enn den (en kule i løpshøyde 28,8 over en sandsekk på 24 vises).
import { PROJ } from '../shared/projection.js';
import { coverElev } from '../shared/depth.js';
import { TUNING } from './data.js';

const NONE = [];
export const is34 = (world) => world?.view === '34';
export function lift(world) { return is34(world) ? PROJ.zScale : 0; }
export function sy(world, y, z) { return is34(world) ? y - (z || 0) * PROJ.zScale : y; }

export function muzzleZ(world, e, d = null) {
  const wm = d?.muzzle;
  if (!e) return Number.isFinite(wm?.z) ? wm.z : PROJ.heights.actor * (wm?.zFrac ?? 0.6);
  const m = Number.isFinite(e.muzzle?.z) ? e.muzzle.z : typeof e.muzzleZ === 'function' ? e.muzzleZ(world, d) : e.muzzleZ;   // riggen vet hvor våpenet tegnes (samme rekkefølge som core: muzzle.z → muzzleZ)
  if (Number.isFinite(m)) return m;
  if (Number.isFinite(e.gunZ)) return e.gunZ;
  if (Number.isFinite(wm?.z)) return wm.z;                                         // fast høyde per våpen (designark)
  const crouch = e.crouch || e.crouching || e.inCover === 'low' || e.posture === 'crouch' || e.state === 'cover';
  return (crouch ? PROJ.heights.actorCrouch : PROJ.heights.actor) * (wm?.zFrac ?? 0.6);
}
/** Treffhøyde på en kropp: målets egen muzzleZ-nivå er for høyt for korte mål; bruk halv aktørhøyde, klippet til kulas z. */
export function bodyHitZ(target, z) {
  const h = target?.height ?? ((target?.crouch || target?.inCover === 'low') ? PROJ.heights.actorCrouch : PROJ.heights.actor);
  return Math.max(4, Math.min(z ?? h * 0.6, h * 0.85));
}
export function coverHeight(o) {
  if (!o) return 0;
  if (Number.isFinite(o.height)) return o.height;
  if (o.elev !== undefined) return o.elev / PROJ.zScale;
  return o.type === 'low' ? PROJ.heights.low : o.kind === 'wall' || o.kind === 'building' ? PROJ.heights.wall : PROJ.heights.high;
}

function covers(world) {
  const a = world.modules?.arena;
  const list = a?.coverObjects ? a.coverObjects(world) : null;   // Arena cacher lista (stabil til layout endres)
  return list && list.length ? list : (world.cover || NONE);
}
export function hidden(world, x, y, z) {
  if (!is34(world) || TUNING.fx?.occlusion === false) return false;
  const list = covers(world), zs = PROJ.zScale;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o.noOcclude || x < o.x || x > o.x + o.w || y >= o.y + o.h) continue;
    const H = o.elev !== undefined ? o.elev / zs : coverHeight(o);
    const d = o.y > y ? o.y - y : 0;
    if (z + d / zs <= H) return true;
  }
  return false;
}
/** Andel av et linjestykke (a→b, konstant z) som er synlig, som liste av [t0, t1]-intervaller (n prøver). */
export function visibleRuns(world, ax, ay, bx, by, z, n = 6, out = []) {
  out.length = 0;
  if (!is34(world)) { out.push(0, 1); return out; }
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const t = i / n, vis = !hidden(world, ax + (bx - ax) * t, ay + (by - ay) * t, z);
    if (vis && start < 0) start = t;
    if (!vis && start >= 0) { out.push(start, Math.max(start, t - 1 / n)); start = -1; }
  }
  if (start >= 0) out.push(start, 1);
  return out;
}
/** Effekt-hjelper: hopp over tegning når effekten er skjult (f.x, f.y, f.z). */
export const fxHidden = (w, f) => hidden(w, f.x, f.y, f.z || 0);
