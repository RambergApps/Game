// PARKERT 26.10 (variant C): utkast, ikke i bruk – demoen bruker faceted + look/*.js. Se docs/VAPEN-DESIGN.md.
// BREACH – fritt roterende våpen i skråvinkelen (variant C). Eies av Breach Våpen. 2026-10-26.
// Tegner rifle/shotgun/marksman direkte som polygoner fra look-defene (look/<id>.js), rotert til en vilkårlig
// sikteretning, og gir ankerpunkter i verden fra SAMME transform som tegningen (munning og løpstupp kan ikke gli).
//
// Koordinater: verden x/y (px, y ned), z opp (px over bakken). Skjerm = PROJ.toScreen(x, y, z) = (x, y − z·0,75).
// Våpenrom: x fram langs løpet, y mot høyre, z opp, origo = høyre hånds grep. Rotasjon er ekte 3D om z-aksen,
// så venstresikte viser venstre side av våpenet med toppen opp (aldri speilet/opp-ned).
//
// Cache: per våpen-id × vinkelbøtte (64) lagres bare synlige flater + farge + rekkefølge (ingen sprites, ingen fase i nøkkelen).
// Bevegelige deler (pump/bolt/mag) forskyves per frame langs aksen i defen.
import { PROJ } from '../../shared/projection.js';
import { LIGHT_DIR, LIGHT_ELEVATION } from '../../shared/light.js';
import { LOOKS } from './index.js';

const ZS = PROJ.zScale, BUCKETS = 64, TAU = Math.PI * 2;
const L3 = (() => { const c = Math.cos(LIGHT_ELEVATION); return { x: LIGHT_DIR.x * c, y: LIGHT_DIR.y * c, z: Math.sin(LIGHT_ELEVATION) }; })();
const VIEW = { x: 0, y: Math.sin(PROJ.tilt), z: Math.cos(PROJ.tilt) };
const LED_COL = '#8fe8ff', LED_GLOW = 'rgba(57,198,255,0.45)';
/** Standard grepspunkt relativt fotpunktet (samme som paintedC.drawWardenC i dag). */
export const GRIP_OFFSET = Object.freeze({ forward: 5, side: 3.2, z: PROJ.aimHeight - 2 });

const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (rgb, k) => { const f = (v) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1) * 0.5))); return `rgb(${f(rgb[0])},${f(rgb[1])},${f(rgb[2])})`; };

// ---------------------------------------------------------------- bygging (én gang per våpen)
const MESH = new Map();
function build(id) {
  const def = LOOKS[id] || LOOKS.rifle;
  const V = [], F = [], moveIdx = [];      // V: [x,y,z] i våpenrom; moveIdx: bevegelig del per vertex (-1 = fast)
  const MOVES = Object.keys(def.moving || {});
  const partMove = new Map();
  const add = (x, y, z, mv) => { V.push([x, y, z]); moveIdx.push(mv); return V.length - 1; };
  const face = (idx, mat, minScale, o = {}) => {
    const P = idx.map(i => V[i]);
    const c = P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length, a[2] + p[2] / P.length], [0, 0, 0]);
    let n = o.n;
    if (!n) {   // Newell-normal, orientert bort fra delens senter
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
      const l = Math.hypot(nx, ny, nz) || 1; n = { x: nx / l, y: ny / l, z: nz / l };
      if (o.center && (c[0] - o.center[0]) * n.x + (c[1] - o.center[1]) * n.y + (c[2] - o.center[2]) * n.z < 0) n = { x: -n.x, y: -n.y, z: -n.z };
    }
    F.push({ idx, mat, minScale: minScale || 0, n, c, top: n.z > 0.7, led: mat === 'led', on: o.on, plate: !!o.plate });
  };
  const hexa = (C, mat, minScale, mv) => {   // C: 8 hjørner (0-3 bunn, 4-7 topp, samme rekkefølge)
    const i = C.map(p => add(p[0], p[1], p[2], mv));
    const ctr = C.reduce((a, p) => [a[0] + p[0] / 8, a[1] + p[1] / 8, a[2] + p[2] / 8], [0, 0, 0]);
    const o = { center: ctr };
    for (const q of [[4, 5, 6, 7], [0, 3, 2, 1], [0, 1, 5, 4], [3, 7, 6, 2], [1, 2, 6, 5], [0, 4, 7, 3]]) face(q.map(k => i[k]), mat, minScale, o);
  };
  for (const p of def.parts) {
    const mv = p.move ? MOVES.indexOf(p.move) : (p.on && partMove.has(p.on) ? partMove.get(p.on) : -1);
    if (p.id) partMove.set(p.id, mv);
    if (p.box) {
      const [x0, x1, y0, y1, z0, z1] = p.box, tp = p.taper || [1, 1], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, ts = p.topShift || 0;
      const bot = [[cx - hx, cy - hy], [cx + hx, cy - hy], [cx + hx, cy + hy], [cx - hx, cy + hy]];
      const top = [[cx + ts - hx * tp[0], cy - hy * tp[1]], [cx + ts + hx * tp[0], cy - hy * tp[1]], [cx + ts + hx * tp[0], cy + hy * tp[1]], [cx + ts - hx * tp[0], cy + hy * tp[1]]];
      hexa([...bot.map(q => [q[0], q[1], z0]), ...top.map(q => [q[0], q[1], z1])], p.mat, p.minScale, mv);
    } else if (p.beam) {
      const [a, b] = p.beam, d = [b.x - a.x, b.y - a.y, b.z - a.z], l = Math.hypot(...d) || 1; d[0] /= l; d[1] /= l; d[2] /= l;
      const s = [0, 1, 0], v = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]];
      if (v[2] < 0) { v[0] = -v[0]; v[1] = -v[1]; v[2] = -v[2]; }
      const tb = p.taper ?? 1, w = p.w / 2, h = p.h / 2;
      const ring = (P, k) => [[-w, -h], [w, -h], [w, h], [-w, h]].map(([sy, sz]) => [P.x + s[0] * sy * k + v[0] * sz * k, P.y + s[1] * sy * k + v[1] * sz * k, P.z + s[2] * sy * k + v[2] * sz * k]);
      // hexa forventer bunn/topp; bruk ring a som «bunn», ring b som «topp» (flatene orienteres via senteret)
      hexa([...ring(a, 1), ...ring(b, typeof tb === 'number' ? tb : 1)], p.mat, p.minScale, mv);
    } else if (p.plate) {
      const i = p.plate.map(q => add(q.x, q.y, q.z, mv));
      face(i, p.mat, p.minScale, { n: p.n || { x: 0, y: 0, z: 1 }, on: p.on, plate: true });
    }
  }
  const pal = def.palette, rgb = {};
  for (const k of Object.keys(pal)) rgb[k] = hexRGB(pal[k]);
  const pts = {};
  for (const [k, q] of Object.entries(def.points)) pts[k] = [q.x || 0, q.y || 0, q.z || 0];
  const mesh = { id: def.id, def, V, F, moveIdx, MOVES, moveAxis: MOVES.map(m => { const a = def.moving[m].axis; const l = Math.hypot(a.x, a.y, a.z) || 1; return [a.x / l * def.moving[m].travel, a.y / l * def.moving[m].travel, a.z / l * def.moving[m].travel]; }),
    fade: MOVES.map(m => !!def.moving[m].fade), rgb, pts, buckets: new Array(BUCKETS * 2).fill(null),
    lengthPx: def.lengthPx };
  MESH.set(id, mesh); return mesh;
}
const meshOf = (id) => MESH.get(id) || build(id);

/** Synlige flater, farge og rekkefølge for én vinkelbøtte × detaljnivå (1× eller ≥2×). Ingen fase i nøkkelen. */
function bucket(M, a, zoom) {
  const b = ((Math.round(a / TAU * BUCKETS) % BUCKETS) + BUCKETS) % BUCKETS, hi = zoom >= 1.5 ? 1 : 0, key = b * 2 + hi;
  let E = M.buckets[key]; if (E) return E;
  const ang = b / BUCKETS * TAU, c = Math.cos(ang), s = Math.sin(ang), D = hi ? 2 : 1;
  const list = [], bestLed = new Map();
  M.F.forEach((f, fi) => {
    const n = { x: f.n.x * c - f.n.y * s, y: f.n.x * s + f.n.y * c, z: f.n.z }, dot = n.x * VIEW.x + n.y * VIEW.y + n.z * VIEW.z;
    if (f.led) {   // LED: alltid den plata som vender mest mot kamera, fra 1×
      const k = f.on || 'led', cur = bestLed.get(k);
      if (dot > -0.35 && (!cur || dot > cur.dot)) bestLed.set(k, { fi, dot });
      return;
    }
    if (f.minScale > D * 1.01 || dot <= 0.02) return;
    const lit = Math.max(0, n.x * L3.x + n.y * L3.y + n.z * L3.z);
    const base = M.rgb[f.mat] || M.rgb.metal;
    const k = 0.45 + 0.75 * lit + (f.top ? 0.08 : 0) + (f.plate ? 0.08 : 0);
    const dc = f.c[0] * s + f.c[1] * c, dep = dc + f.c[2] * 0.6 + (f.plate ? 0.3 : 0);
    list.push({ fi, col: shade(base, k), dep, edge: f.top });
  });
  for (const { fi } of bestLed.values()) list.push({ fi, col: LED_COL, dep: 1e3, edge: false, led: true });
  list.sort((A, B) => A.dep - B.dep);
  // Path2D per gruppe (påfølgende flater med samme farge og samme bevegelige del), projisert ved bøttevinkelen
  // relativt til grepet: sx = x·c − y·s, sy = x·s + y·c − z·zScale. Resten av vinkelen tas med ctx.rotate (≤ 2,8°, feil ≤ 0,3 px).
  const groups = [];
  for (const e of list) {
    const f = M.F[e.fi], mv = M.moveIdx[f.idx[0]];
    let g = groups[groups.length - 1];
    if (!g || g.col !== e.col || g.mv !== mv || g.edge !== e.edge || e.led || g.led) { g = { path: new Path2D(), col: e.col, mv, edge: e.edge, led: !!e.led }; groups.push(g); }
    f.idx.forEach((vi, k) => { const v = M.V[vi], x = v[0] * c - v[1] * s, y = v[0] * s + v[1] * c - v[2] * ZS; k ? g.path.lineTo(x, y) : g.path.moveTo(x, y); });
    g.path.closePath();
  }
  const outlinePath = new Path2D(); for (const g of groups) if (!g.led && g.mv < 0) outlinePath.addPath(g.path);
  const moveOutline = groups.filter(g => !g.led && g.mv >= 0);
  E = { ang, c, s, groups, outlinePath, moveOutline };
  M.buckets[key] = E; return E;
}

// ---------------------------------------------------------------- offentlig API
/** Grepspunkt (høyre hånd) i verden for en figur i fotpunkt (x, y) som sikter langs aim. */
export function gripWorld(x, y, aim, off = GRIP_OFFSET, out = {}) {
  const c = Math.cos(aim), s = Math.sin(aim), f = off.forward ?? 5, sd = off.side ?? 3.2;
  out.x = x + c * f - s * sd; out.y = y + s * f + c * sd; out.z = off.z ?? GRIP_OFFSET.z; return out;
}
/** Skal våpenet tegnes BAK overkroppen? (sikter bort fra kamera). Samme regel som paintedC. */
export const weaponBehind = (aim) => Math.sin(aim) < -0.35;
/** Lengde i px (målt fra delene). */
export const weaponLength = (id) => meshOf(id).lengthPx;

const P3 = (M, k, origin, c, s, o) => { const p = M.pts[k] || M.pts.grip; o.x = origin.x + p[0] * c - p[1] * s; o.y = origin.y + p[0] * s + p[1] * c; o.z = origin.z + p[2]; return o; };
/**
 * Ankerpunkter i verden {x,y,z} for våpen `id` med grep i `origin` og sikteretning `aim`.
 * → { grip, fore, stock, muzzle, muzzleDraw, led, angle }. muzzle = løpsaksen ved munningens front (kuler),
 * muzzleDraw = 0,5 px foran (glimt). Begge regnes fra samme transform som drawWeapon. `out` gjenbrukes (ingen allokering).
 */
export function weaponAnchors(id, origin, aim, out) {
  const M = meshOf(id), c = Math.cos(aim), s = Math.sin(aim);
  out = out || { grip: {}, fore: {}, stock: {}, muzzle: {}, muzzleDraw: {}, led: {}, angle: 0 };
  P3(M, 'grip', origin, c, s, out.grip); P3(M, 'fore', origin, c, s, out.fore); P3(M, 'stock', origin, c, s, out.stock);
  P3(M, 'muzzle', origin, c, s, out.muzzle); P3(M, 'led', origin, c, s, out.led);
  out.muzzleDraw.x = out.muzzle.x + c * 0.5; out.muzzleDraw.y = out.muzzle.y + s * 0.5; out.muzzleDraw.z = out.muzzle.z;
  out.angle = aim; return out;
}
/** Sett entity.muzzle og entity.muzzleDraw fra ankrene (bruk etter weaponAnchors i samme frame). */
export function applyMuzzle(entity, A) {
  const m = entity.muzzle || (entity.muzzle = {}), d = entity.muzzleDraw || (entity.muzzleDraw = {});
  m.x = A.muzzle.x; m.y = A.muzzle.y; m.z = A.muzzle.z; d.x = A.muzzleDraw.x; d.y = A.muzzleDraw.y; d.z = A.muzzleDraw.z;
}

/**
 * Tegn våpenet. ctx står i verdenskoordinater (kameraets transform/zoom er allerede satt).
 * o: { zoom=1 (skjerm-px per verdens-px → detaljnivå), move?: {pump,bolt,mag} 0..1, alpha=1, outline=true }
 */
export function drawWeapon(ctx, id, origin, aim, o = {}) {
  const M = meshOf(id), zoom = o.zoom || 1, E = bucket(M, aim, zoom), mv = o.move, G = E.groups;
  const lw = 0.55 / zoom, alpha = o.alpha ?? 1, outline = o.outline !== false;
  ctx.save();
  ctx.translate(origin.x, origin.y - origin.z * ZS); ctx.rotate(aim - E.ang);
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; if (alpha !== 1) ctx.globalAlpha = alpha;
  // Silhuett: ÉN bred mørk strek under alle flatene (fyllene dekker de indre kantene) – én stroke i stedet for én per flate.
  if (outline) { ctx.strokeStyle = 'rgba(6,8,10,0.75)'; ctx.lineWidth = lw * 2; ctx.stroke(E.outlinePath); if (!mv) for (const g of E.moveOutline) ctx.stroke(g.path); ctx.lineWidth = lw; }
  for (let i = 0; i < G.length; i++) {
    const g = G[i]; let dx = 0, dy = 0;
    if (g.mv >= 0) {
      const t = mv ? (mv[M.MOVES[g.mv]] || 0) : 0;
      if (t) { const A = M.moveAxis[g.mv]; dx = (A[0] * E.c - A[1] * E.s) * t; dy = (A[0] * E.s + A[1] * E.c - A[2] * ZS) * t;
        if (M.fade[g.mv]) { const a = alpha * Math.max(0, 1 - t * 1.4); if (a <= 0.01) continue; ctx.globalAlpha = a; } }
    }
    if (dx || dy) ctx.translate(dx, dy);
    ctx.fillStyle = g.col; ctx.fill(g.path);
    if (g.led) { ctx.strokeStyle = LED_GLOW; ctx.lineWidth = 1.2 / zoom; ctx.stroke(g.path); ctx.lineWidth = lw; }
    else if (outline && g.edge) { ctx.strokeStyle = 'rgba(200,206,212,0.4)'; ctx.stroke(g.path); }   // lys kant bare på toppflater
    if (dx || dy) ctx.translate(-dx, -dy);
    if (g.mv >= 0 && ctx.globalAlpha !== alpha) ctx.globalAlpha = alpha;
  }
  ctx.restore();
}

/** Bevegelige deler fra hendelser: 'chamber' (pump/bolt fram-tilbake 0,32 s), 'reload' start → mag ut, active/end → inn. */
export function bindWeaponMotion(world, entity) {
  const st = { pump: 0, bolt: 0, mag: 0, _c: -1, _r: 0 };
  const offs = [
    world.events.on('chamber', (p) => { if (p.entity === entity) st._c = 0; }),
    world.events.on('reload', (p) => { if (p.entity !== entity) return; st._r = p.phase === 'start' ? 1 : -1; }),
  ];
  st.update = (dt) => {
    if (st._c >= 0) { st._c += dt / 0.32; const t = st._c >= 1 ? 0 : Math.sin(Math.PI * st._c); st.pump = st.bolt = t; if (st._c >= 1) st._c = -1; }
    if (st._r) { st.mag = Math.max(0, Math.min(1, st.mag + st._r * dt / 0.25)); if (st._r < 0 && st.mag === 0) st._r = 0; }
    return st;
  };
  st.dispose = () => offs.forEach(f => f && f());
  return st;
}
export const WEAPON_IDS = ['rifle', 'shotgun', 'marksman'];
