// Maler for fasetterte modeller (mesh.js) – brukes bare under baking. Generisk: materialtabellen sendes inn.
// Malt, ikke flat lavpoly: hver fasett får valør fra LIGHT_DIR (3-trinns rampe), tilfeldig valørvariasjon,
// myk overgang over flaten (gradient mot lyset), penselstrøk i fasettens retning, mørk fuge / lys avskallet kant,
// og gjørme/rust/sot nederst. Glødflater males også i et eget glødlag (gc); nærmere fasetter visker det ut.
import { PROJ } from '../../projection.js';
import { LIGHT_DIR, LIGHT_ELEVATION } from '../../light.js';
import { dot, centroid } from './mesh.js';

const Z = PROJ.zScale;
const ce = Math.cos(LIGHT_ELEVATION), se = Math.sin(LIGHT_ELEVATION);
export const L3 = [LIGHT_DIR.x * ce, LIGHT_DIR.y * ce, se];
const VL = Math.hypot(Z, 1);
export const V = [0, Z / VL, 1 / VL];                                     // mot kamera
export const L2 = (() => { const x = L3[0], y = L3[1] - L3[2] * Z, l = Math.hypot(x, y); return [x / l, y / l]; })(); // lys i skjermplan
export const SHK = [-L3[0] / L3[2], -L3[1] / L3[2]];                     // bakkeskygge: p.xy + z·SHK
export const proj = (p) => [p[0], p[1] - p[2] * Z];

export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const HEX = new Map();
export function rgbOf(c) { if (Array.isArray(c)) return c; let v = HEX.get(c); if (v) return v;
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } else v = c.split(',').map(Number);
  HEX.set(c, v); return v; }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = (t) => t * t * (3 - 2 * t);

function path(c, Q) { c.beginPath(); c.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < Q.length; i++) c.lineTo(Q[i][0], Q[i][1]); c.closePath(); }
function area2(Q) { let a = 0; for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

/** Fargen (rgb) en fasett med normal n får i et materiale – brukes også for flatt «lav kvalitet»-modus. */
export function shade(M, n, zc, o, jit = 0) {
  const ramp = M.ramp.map(rgbOf);
  const dif = Math.max(0, dot(n, L3)), sky = n[2] * .5 + .5;
  let t = clamp(.08 + .66 * dif + .26 * sky * sky + jit + (M.lift || 0));
  if (M.contrast) t = clamp(.5 + (t - .5) * M.contrast);                    // valgfritt: mer lys/skygge-kontrast (bakoverkompatibelt)
  let col = t < .5 ? mix(ramp[0], ramp[1], t * 2) : mix(ramp[1], ramp[2], (t - .5) * 2);
  if (M.top && n[2] > .7) col = mix(col, rgbOf(M.top), (n[2] - .7) / .3 * .55 * (.4 + .6 * dif));
  if (M.spec) col = mix(col, [255, 255, 255], clamp(Math.pow(dif, 6) * M.spec));   // valgfritt: glanspunkt på fasetter mot lyset
  const ao = .58 + .42 * smooth(clamp(zc / (o.aoH || 26)));                  // mørkere mot gulvet
  col = col.map(v => v * ao);
  return { col, t, dif };
}

/**
 * Mal modellen M i bc (kropp) og gc (glød, kan være null). Begge har transform satt (verden → piksler) av bake.js.
 * mats: { navn: { ramp:[mørk,mellom,lys], top?, stroke, wear, mud, edge, glow?:'r,g,b', flat? } }
 * o: { px (piksler per verdens-px, for strektykkelse), aoH, wearCol, mudCol, rustCol, sootCol, lite (færre strøk) }
 */
export function paintModel(bc, gc, M, mats, o = {}) {
  const parts = M.parts.map(P => { let d = 0, n = 0; for (const f of P.faces) for (const p of f.p) { d += p[1] * V[1] + p[2] * V[2]; n++; } return { P, d: d / Math.max(1, n) + (P.bias || 0) }; });
  parts.sort((a, b) => a.d - b.d);
  for (const { P } of parts) {
    const vis = P.faces.filter(f => dot(f.n, V) > .015 || P.twoSided);
    vis.sort((a, b) => (centroid(a.p)[1] * V[1] + centroid(a.p)[2] * V[2]) - (centroid(b.p)[1] * V[1] + centroid(b.p)[2] * V[2]));
    for (const f of vis) paintFace(bc, gc, f, mats[f.mat] || mats.default, o, P);
    for (const d of P.decals) if (dot(d.n, V) > .05) paintFace(bc, gc, { ...d, decal: true }, mats[d.mat] || mats.default, o, P);
  }
}

function paintFace(bc, gc, f, M, o, P) {
  const Q = f.p.map(proj); if (Q.length < 3) return;
  const A = Math.abs(area2(Q)); if (A < .02) return;
  const zc = centroid(f.p)[2] - (P.z0 || 0);
  const r = rng(f.seed);
  const { col, dif } = M.glow ? { col: [0, 0, 0], dif: 0 } : shade(M, f.n, zc, o, (r() - .5) * (M.jit ?? .12));
  const px = o.px || 3;
  // ---- glødlag: alt som males ugjennomsiktig visker ut glød bak seg
  if (gc) { path(gc, Q); if (M.glow) { gc.globalCompositeOperation = 'source-over'; gc.fillStyle = `rgba(${M.glow},1)`; gc.fill(); }
    else { gc.globalCompositeOperation = 'destination-out'; gc.fillStyle = '#000'; gc.fill(); gc.globalCompositeOperation = 'source-over'; } }
  if (M.glow) { path(bc, Q); bc.fillStyle = `rgba(${M.glowBody || M.glow},1)`; bc.fill(); if (M.hot) { const c0 = centroid(Q.map(q => [q[0], q[1], 0])); bc.save(); path(bc, Q); bc.clip(); bc.fillStyle = `rgba(${M.hot},.85)`; bc.fillRect(c0[0] - .9, c0[1] - .5, 1.8, 1); bc.restore(); } return; }
  path(bc, Q); bc.fillStyle = css(col); bc.fill();
  // fuge mot naboflaten (dekker antialias-sømmer mellom fasetter)
  bc.lineJoin = 'round'; bc.lineWidth = .25; bc.strokeStyle = css(col, .9); bc.stroke();
  if (M.flat || o.lite === 2) return;
  bc.save(); path(bc, Q); bc.clip();
  // ---- myk overgang over flaten: lysere mot lyset, mørkere bort
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of Q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2 + .3;
  const g = bc.createLinearGradient(cx + L2[0] * R, cy + L2[1] * R, cx - L2[0] * R, cy - L2[1] * R);
  const lt = mix(col, [236, 242, 246], .22 * (.3 + dif)), dk = col.map(v => v * .72);
  g.addColorStop(0, css(lt, .55)); g.addColorStop(.5, css(col, 0)); g.addColorStop(1, css(dk, .5));
  bc.fillStyle = g; bc.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
  // ---- penselstrøk i fasettens lengderetning (lysere og mørkere enn grunnen)
  let li = 0, ll = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > ll) { ll = l; li = i; } }
  const ea = Math.atan2(Q[(li + 1) % Q.length][1] - Q[li][1], Q[(li + 1) % Q.length][0] - Q[li][0]);
  const sk = (M.stroke ?? .8) * (o.lite ? .45 : 1);
  const N = Math.round(clamp(A * 1.1 * sk, 2 * sk, 46));
  bc.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), a = ea + (r() - .5) * .45, L = .9 + r() * Math.min(4.5, ll * .7), w = .35 + r() * .75;
    const up = r() < .5 + (dif - .4) * .4; const c2 = up ? mix(col, [228, 236, 242], .1 + r() * .16) : col.map(v => v * (.74 + r() * .14));
    bc.strokeStyle = css(c2, .35 + r() * .35); bc.lineWidth = w;
    const mx = x + Math.cos(a) * L * .5 + (r() - .5) * .5, my = y + Math.sin(a) * L * .5 + (r() - .5) * .5;
    bc.beginPath(); bc.moveTo(x, y); bc.quadraticCurveTo(mx, my, x + Math.cos(a) * L, y + Math.sin(a) * L); bc.stroke();
  }
  // ---- gjørme / rust / sot nederst (aldri jevn støy over flaten)
  if (M.mud) { const low = 1 - smooth(clamp(zc / 14)); const n = Math.round(M.mud * (2 + A * .25) * (.25 + low));
    for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y1 - r() * (y1 - y0) * (.35 + .5 * (1 - low)), rr = .5 + r() * 1.6;
      const mc = rgbOf(r() < .55 ? (o.mudCol || '#4a3b2c') : r() < .5 ? (o.rustCol || '#6b4a32') : (o.sootCol || '#23201d'));
      bc.fillStyle = css(mc, .35 + r() * .35); bc.beginPath(); const k = 5 + (r() * 3 | 0);   // uregelmessig flekk (mangekant)
      for (let j = 0; j < k; j++) { const t = j / k * 6.283, q = rr * (.6 + r() * .6); j ? bc.lineTo(x + Math.cos(t) * q, y + Math.sin(t) * q * .7) : bc.moveTo(x + Math.cos(t) * q, y + Math.sin(t) * q * .7); }
      bc.closePath(); bc.fill(); } }
  bc.restore();
  // ---- kanter: lys avskallet kant på lyssiden, mørk fuge ellers (gir skarpe, lesbare fasetter)
  const ccw = area2(Q) > 0 ? 1 : -1;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length]; const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey); if (el < .2) continue;
    const nx = ey / el * ccw, ny = -ex / el * ccw;  // utover (skjerm)
    const lit = nx * L2[0] + ny * L2[1];
    if (lit > .2 && dif > .15 && f.edge !== 0) {
      bc.strokeStyle = css(mix(col, rgbOf(M.wearCol || o.wearCol || '#c3c9ce'), .55 + .3 * lit), .55 + .35 * lit); bc.lineWidth = .32 + .25 * (M.wear || 0);
      // avskallet: kanten brytes opp i biter
      let t = 0; bc.beginPath(); while (t < 1) { const s = .12 + r() * .35, gp = r() * .18 * (M.wear || .3); const t1 = Math.min(1, t + s);
        bc.moveTo(a[0] + ex * t, a[1] + ey * t); bc.lineTo(a[0] + ex * t1, a[1] + ey * t1); t = t1 + gp; } bc.stroke();
      if (M.wear) { const n = Math.round(M.wear * el * .22); bc.fillStyle = css(rgbOf(M.wearCol || o.wearCol || '#c3c9ce'), .7);
        for (let k = 0; k < n; k++) { const t = r(), d = r() * .7; bc.fillRect(a[0] + ex * t - nx * d - .2, a[1] + ey * t - ny * d - .2, .3 + r() * .5, .25 + r() * .35); } }
    } else if (M.edge !== 0) {
      bc.strokeStyle = `rgba(10,12,15,${(M.edge ?? .55) * (lit < -.2 ? .9 : .55)})`; bc.lineWidth = .3; bc.beginPath(); bc.moveTo(a[0], a[1]); bc.lineTo(b[0], b[1]); bc.stroke();
    }
  }
}

/** Kastet skygge i bakkeplanet: skallet av hver dels bakkeprojeksjon. */
export function paintShadow(c, M, col = 'rgba(8,8,10,1)') {
  c.beginPath();
  for (const P of M.parts) { if (P.noShadow) continue; const G = hull2(P.faces.flatMap(f => f.p).map(p => [p[0] + p[2] * SHK[0], p[1] + p[2] * SHK[1]]));
    if (G.length < 3) continue; c.moveTo(G[0][0], G[0][1]); for (let i = 1; i < G.length; i++) c.lineTo(G[i][0], G[i][1]); c.closePath(); }
  c.fillStyle = col; c.fill('nonzero');
}
export function hull2(P) {
  const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
/** Skjermboks for modellen (projisert) og for bakkeskyggen. */
export function bounds(M, withShadow = true) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const ext = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const P of M.parts) for (const f of P.faces) for (const p of f.p) { ext(p[0], p[1] - p[2] * Z); if (withShadow && !P.noShadow) ext(p[0] + p[2] * SHK[0], p[1] + p[2] * SHK[1]); }
  return { x0, y0, x1, y1 };
}
