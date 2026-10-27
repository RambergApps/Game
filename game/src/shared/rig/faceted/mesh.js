// Fasettert mini-3D for sprite-baking (Breach Warden-design og animasjon, delt med Monsterdesign).
// Kjøres KUN når en sprite bakes – aldri per bilde. Alt i verdens-px: x = øst, y = sør, z = opp.
// En modell er en liste DELER; hver del er et lite konvekst volum av plane FASETTER (polygoner med normal).
// Ingen ellipser/sirkler: runde former (hjelm) bygges som lavpoly-loft av mangekanter.
//
//   const M = model();
//   const T = frame([x,y,z], yaw, pitch, roll)            // lokal → verden (x fram, y høyre, z opp)
//   loft(M, T, rings, mat, o)    – ringer {pts:[[x,y]...], z, dx?, dy?} → sideflater + topp/bunn
//   box(M, T, x0,x1, y0,y1, z0,z1, mat, o)  – avfaset boks (o.c = avfasing)
//   beam(M, a, b, w, h, up, mat, o)          – avfaset prisme mellom to verdenspunkt (lemmer, løp)
//   decal(M, part, pts3, mat, o)             – flat merkeflate (chevron, stripe) på en fasett, tegnes etter delen
// Del: { id, faces:[{p, n, mat, seed, edge}], bias, mat, glow? }
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Stabil hash av en streng → heltall (frø for malingen, slik at samme fasett har samme strøk i alle retninger). */
export function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Lokal ramme: origo o (verden), yaw om z, pitch om lokal y (positiv = nese ned), roll om lokal x. */
export function frame(o, yaw = 0, pitch = 0, roll = 0, s = 1) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const T = (x, y, z) => {
    x *= s; y *= s; z *= s;
    const y1 = y * cr - z * sr, z1 = y * sr + z * cr;
    const x2 = x * cp + z1 * sp, z2 = -x * sp + z1 * cp;
    return [o[0] + x2 * cy - y1 * sy, o[1] + x2 * sy + y1 * cy, o[2] + z2];
  };
  T.o = o; T.yaw = yaw; T.pitch = pitch;
  T.dir = (x, y, z) => sub(T(x, y, z), T(0, 0, 0));
  return T;
}
/** Sammensatt ramme: T2 i T1-rom. */
export function sub_frame(T, o, yaw = 0, pitch = 0, roll = 0) {
  const L = frame([0, 0, 0], yaw, pitch, roll); const O = o;
  const F = (x, y, z) => { const q = L(x, y, z); return T(O[0] + q[0], O[1] + q[1], O[2] + q[2]); };
  F.dir = (x, y, z) => sub(F(x, y, z), F(0, 0, 0)); return F;
}

export function model() { return { parts: [] }; }
function centroid(P) { const c = [0, 0, 0]; for (const p of P) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return mul(c, 1 / P.length); }
function newell(P) { const n = [0, 0, 0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return norm(n); }

/** Ny del. o: { id, bias (dybdejustering), glow, own (egen kontur), z0 (AO-referanse) } */
export function part(M, id, o = {}) { const P = { id, faces: [], decals: [], bias: o.bias || 0, ...o }; M.parts.push(P); return P; }
/** Legg fasett til del; normal orienteres bort fra delens senter c (konvekst volum). */
export function face(P, pts, mat, c, o = {}) {
  let n = newell(pts); if (c) { const fc = centroid(pts); if (dot(n, sub(fc, c)) < 0) { n = mul(n, -1); pts = pts.slice().reverse(); } }
  P.faces.push({ p: pts, n, mat, seed: hash(P.id + ':' + P.faces.length), ...o }); return P;
}

/** Rektangel med avfasede hjørner (8 punkter, CCW sett ovenfra). c = avfasing. */
export const rect8 = (hx, hy, c = 0) => c <= 0 ? [[hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]]
  : [[hx, -hy + c], [hx, hy - c], [hx - c, hy], [-hx + c, hy], [-hx, hy - c], [-hx, -hy + c], [-hx + c, -hy], [hx - c, -hy]];
/** Regulær mangekant (n sider), rx/ry, rot = startvinkel. Brukes for lavpoly-«runde» former (hjelm). */
export const ngon = (n, rx, ry, rot = 0) => { const o = []; for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; o.push([Math.cos(a) * rx, Math.sin(a) * ry]); } return o; };

/**
 * Loft: ringer med samme antall punkter, lavest først. ring = { pts, z, dx=0, dy=0 }.
 * o: { mats: {side, top, bottom} | per-side funksjon (i, ringIndex) → mat, cap: [bunn?, topp?], id, bias, glow }.
 */
export function loft(M, T, rings, mat, o = {}) {
  const P = part(M, o.id || ('loft' + M.parts.length), o);
  const W = rings.map(r => r.pts.map(([x, y]) => T(x + (r.dx || 0), y + (r.dy || 0), r.z)));
  const all = [].concat(...W); const c = centroid(all);
  const n = W[0].length;
  for (let r = 0; r < W.length - 1; r++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n; const q = [W[r][i], W[r][j], W[r + 1][j], W[r + 1][i]];
    const m = typeof o.side === 'function' ? o.side(i, r) : (o.side || mat);
    if (m) face(P, q, m, c, { edge: o.edge ?? 1 });
  }
  const cap = o.cap || [true, true];
  if (cap[0]) face(P, W[0].slice(), o.bottom || mat, c, { edge: o.edge ?? 1 });
  if (cap[1]) face(P, W[W.length - 1].slice(), o.top || mat, c, { edge: o.edge ?? 1, top: 1 });
  P.c = c; P.T = T; return P;
}
/** Avfaset boks i ramme T. o.c = avfasing (verdens-px), o.taper = [sx, sy] skalering på toppen, o.top/o.side materialer. */
export function box(M, T, x0, x1, y0, y1, z0, z1, mat, o = {}) {
  const hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, c = Math.min(o.c ?? .8, hx * .6, hy * .6);
  const tp = o.taper || [1, 1];
  const bot = rect8(hx, hy, c), top = rect8(hx * tp[0], hy * tp[1], c * Math.min(tp[0], tp[1]));
  const rings = [{ pts: bot, z: z0, dx: cx, dy: cy }];
  if (o.bevel) { const b = o.bevel; rings.push({ pts: rect8(hx, hy, c), z: z1 - b, dx: cx, dy: cy }); rings.push({ pts: rect8(Math.max(.2, hx * tp[0] - b), Math.max(.2, hy * tp[1] - b), Math.max(0, c * .5)), z: z1, dx: cx + (o.topShift || 0), dy: cy }); }
  else rings.push({ pts: top, z: z1, dx: cx + (o.topShift || 0), dy: cy });
  return loft(M, T, rings, mat, o);
}
/** Prisme mellom verdenspunkt a og b. Tverrsnitt w (side) × h (opp), avfasing c, taper = skala ved b. up = hint for «opp». */
export function beam(M, a, b, w, h, up, mat, o = {}) {
  const u = norm(sub(b, a)); let s = cross(up || [0, 0, 1], u); if (Math.hypot(...s) < 1e-3) s = cross([1, 0, 0], u); s = norm(s); const v = cross(u, s);
  const c = Math.min(o.c ?? .7, w * .3, h * .3), tb = o.taper ?? 1;
  const ring = (P, k) => rect8(w / 2 * k, h / 2 * k, c * k).map(([x, y]) => add(P, add(mul(s, x), mul(v, y))));
  const A = ring(a, 1), B = ring(b, tb);
  const P = part(M, o.id || ('beam' + M.parts.length), o); const all = A.concat(B); const C = centroid(all);
  for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; face(P, [A[i], A[j], B[j], B[i]], (o.sideMat && o.sideMat(i)) || mat, C, { edge: 1 }); }
  if (o.capA !== false) face(P, A.slice(), o.capMatA || mat, C, { edge: 1 });
  if (o.capB !== false) face(P, B.slice(), o.capMatB || mat, C, { edge: 1 });
  P.c = C; P.axis = { a, b, s, v, u }; return P;
}
/** Flat merkeflate (chevron/stripe/visir) på delen P. Tegnes etter delens fasetter, bare når ref-normalen vender mot kamera. */
export function decal(P, pts, mat, n, o = {}) { P.decals.push({ p: pts, mat, n: n ? norm(n) : newell(pts), seed: hash(P.id + ':d' + P.decals.length), ...o }); return P; }
export { centroid, newell };
