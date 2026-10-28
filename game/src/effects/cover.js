// BREACH – lav dekning malt for høy vinkel (Kessa Yard, plan 27.10). Eies av Breach Effekter.
// Geometri som arena/render.js + shared/depth.js: cover-rektangel (x, y, w, h) i bakkeplanet, høyde H (verdens-px).
// Løft L = H · PROJ.zScale (verdens-y). Toppflate = rektangelet forskjøvet −L, front = sørflaten fra y+h−L til y+h.
// Alt tegnes som ferdige sprites (cache per type, størrelse, høyde, seed og zoomtrinn) → kun drawImage per bilde.
// Ingen shadowBlur. Lys fra shared/light.js (nordvest): lyse nord/vest-kanter, mørkere front, kontaktskygge nederst.
import { PROJ as PROJ0 } from '../shared/projection.js';
import { LIGHT_DIR, shadowOffset } from '../shared/light.js';

const KINDS = { barrier: 'barrier', sandbag: 'sandbag', sandbags: 'sandbag', crates: 'crates', pallet: 'crates', crate: 'crates', barrels: 'barrels', barrel: 'barrels', tunnel: 'tunnel' };
export function canDrawCover(kind) { return !!KINDS[kind]; }
const cache = new Map(); let cacheBytes = 0; const MAX_BYTES = 160e6;

function rng(seed) { let a = (seed >>> 0) || 1; const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.r = (a, b) => a + f() * (b - a); return f; }
function canvas(w, h) { if (typeof OffscreenCanvas !== 'undefined') { try { return new OffscreenCanvas(w, h); } catch (e) { /* */ } } const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const step = (s) => Math.pow(2, Math.max(-2, Math.min(3, Math.round(Math.log2(Math.max(1e-3, s)) * 2) / 2)));   // halve oktaver
const tint = (c, k) => c.map((v) => v * k);
const rgb = (c, k = 0, a = 1) => `rgba(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + k))))).join(',')},${a})`;

/** Les argumentene (begge kallformene). */
function args(a3, a4, a5) {
  if (a3 && a3.PROJ) return { P: a3.PROJ, part: a3.part, env: a3 };
  return { P: (a3 && a3.PROJ) || PROJ0, part: a5 && a5.part, world: a3, camera: a4 };
}
function heightOf(o, P) { return o.height ?? (o.elev != null ? o.elev / P.zScale : P.heights.low); }   // NB: o.elev i arenaen er løftet (H·zScale), så det regnes tilbake
const kindOf = (o) => KINDS[o.kind ?? o.type];
const seedOf = (o) => (o.seed ?? ((o.id ?? 0) * 7919 + Math.round(o.x) * 31 + Math.round(o.y) * 17)) >>> 0;

/** Flatene i verdensrom før kameraets bakkeskala (samme rom som cover-rektangelet): { top:{x,y,w,h}, front:{x,y,w,h}, lift }. */
export function coverFaces(o, P = PROJ0) {
  const L = heightOf(o, P) * P.zScale;
  return { lift: L, top: { x: o.x, y: o.y - L, w: o.w, h: o.h }, front: { x: o.x, y: o.y + o.h - L, w: o.w, h: L },
    topPoly: [[o.x, o.y - L], [o.x + o.w, o.y - L], [o.x + o.w, o.y + o.h - L], [o.x, o.y + o.h - L]],
    frontPoly: [[o.x, o.y + o.h - L], [o.x + o.w, o.y + o.h - L], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]] };
}
/** Samme flater i skjermrom for en gitt transform (DOMMatrix eller {a,b,c,d,e,f}), f.eks. ctx.getTransform(). */
export function coverFacesScreen(o, m, P = PROJ0) {
  const f = coverFaces(o, P), tp = ([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  return { top: f.topPoly.map(tp), front: f.frontPoly.map(tp) };
}

// ---------------------------------------------------------------- malerverktøy (enheter: verdens-x-px; y-flater ferdig forkortet)
function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
function speckle(c, R, x, y, w, h, n, col, a0, a1, s0 = 0.4, s1 = 1.4) { for (let i = 0; i < n; i++) { c.fillStyle = rgb(col, 0, R.r(a0, a1)); const s = R.r(s0, s1); c.fillRect(x + R() * w, y + R() * h, s, s * R.r(0.5, 1)); } }
function stain(c, R, x, y, rx, ry, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, rgb(col, 0, a)); g.addColorStop(1, rgb(col, 0, 0)); c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = g; c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore(); }
function hazard(c, x, y, w, h, s) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#c99a1c'; c.fillRect(x, y, w, h); c.fillStyle = '#1b1a17'; for (let i = -h - s * 2; i < w + h; i += s * 2) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + s, y + h); c.lineTo(x + i + s + h, y); c.lineTo(x + i + h, y); c.fill(); } c.fillStyle = 'rgba(40,30,20,0.35)'; c.fillRect(x, y, w, h); c.restore(); }
// lysretning → hvor mye nord- og vestkanter lyses opp
const LN = Math.max(0, -LIGHT_DIR.y), LW = Math.max(0, -LIGHT_DIR.x);

// Hver maler får (c, R, S): S = { w, d (topp-dybde, forkortet), f (fronthøyde, forkortet), g (forkorting), horiz }
// Toppflaten ligger i y ∈ [0, d], fronten i [d, d + f]. Lang akse er x når horiz; ellers ligger objektet nord–sør.
function paintNSBarrier(c, R, S) { return paintJersey(c, R, S); } // 28.10: jersey-blokk erstatter v5 (v4/v5 beholdt under for sammenligning)
// v5 (27.10): lang, lav jersey-rekke. Toppen senket (front bare 28 % av løftet), tverrprofil fot–flanke–rygg–flanke–fot,
// tydelige tverrfuger ca. hver 1,5 rute (leses som liggende seksjoner, ikke søyle), sørende med jersey-trapes + gul/svart stripe.
function paintNSBarrierV5(c, R, S) {
  // 27.10 sent: stykker under ~1,4 rute (Arenas 0,75×1) blir ÉN lav blokk med skrå fot og stripe etter frø – ikke to klemte.
  // Rekke av 2–3 korte, lave jersey-blokker med gulv mellom (aldri én sammenhengende plate). Hver blokk: tverrprofil fot–flanke–rygg–flanke–fot
  // og egen lav sørende (jersey-trapes). Toppen er senket: fronten er bare 28 % av løftet, så ingenting leses høyere enn treffboksen.
  const { w, d, f } = S, CON = tint([104, 107, 110], R.r(0.84, 1.0)), fe = f * 0.28, y0 = f - fe, n = S.dw < 44 ? 1 : Math.max(2, Math.round(S.dw / 30)), gap = Math.min(5, d / n * 0.22);
  const xs = [0.16, 0.27, 0.42, 0.58, 0.73, 0.84].map((k) => k * w), tone = [-0.38, -0.06 + 0.08 * LW, 0.02, -0.24, -0.46], X0 = xs[0], XW = xs[5] - xs[0];
  const sd = (d - gap * (n - 1)) / n, hzAt = S.hz ? (R() < 0.5 ? 0 : n - 1) : -1;
  for (let j = 0; j < n; j++) {
    const ya = y0 + j * (sd + gap), ey = ya + sd;
    c.fillStyle = 'rgba(0,0,0,0.42)'; c.fillRect(xs[5], ya + 1.5, 2.5, sd + fe - 1); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(xs[5] + 2.5, ya + 2, 1.5, sd + fe - 1);   // lav kontaktskygge østover
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(X0, ey + fe, XW + 2, Math.min(gap, 2.5));                                                                           // skygge i gulvfugen
    for (let i = 0; i < 5; i++) { c.fillStyle = rgb(CON, tone[i]); c.fillRect(xs[i], ya, xs[i + 1] - xs[i], sd); }
    c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(xs[2], ya, 0.6, sd); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(xs[3], ya, 0.6, sd); c.fillRect(xs[1] - 0.3, ya, 0.6, sd); c.fillRect(xs[4] - 0.3, ya, 0.6, sd);
    c.fillStyle = rgb(CON, 0.1, 0.8); c.fillRect(xs[1], ya, xs[4] - xs[1], 0.7);   // lys nordkant
    c.save(); c.beginPath(); c.rect(X0, ya, XW, sd); c.clip(); speckle(c, R, X0, ya, XW, sd, Math.round(XW * sd / 9), [40, 40, 40], 0.12, 0.4); if (R() < 0.5) stain(c, R, X0 + R() * XW, ya + R() * sd, R.r(3, 6), R.r(2, 3), [38, 34, 30], 0.35);
    c.fillStyle = grad(c, X0, 0, X0 + XW, 0, [[0, 'rgba(60,44,28,0.35)'], [0.2, 'rgba(60,44,28,0)'], [0.8, 'rgba(60,44,28,0)'], [1, 'rgba(60,44,28,0.4)']]); c.fillRect(X0, ya, XW, sd); c.restore();
    c.fillStyle = 'rgba(10,10,10,0.7)'; c.fillRect(w * 0.47, ya + sd * 0.45, w * 0.06, 1.2);   // løftehull
    for (let q = 0; q < 2; q++) if (R() < 0.7) { c.fillStyle = rgb(CON, -0.5, 0.9); const cx = R() < 0.5 ? xs[1] : xs[4] - 2, cy = ya + R() * sd; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + 2, cy + R.r(1, 3)); c.lineTo(cx, cy + R.r(2, 4)); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(X0, ey, XW, 0.7);
    c.fillStyle = grad(c, 0, ey, 0, ey + fe, [[0, rgb(CON, -0.16)], [1, rgb(CON, -0.36)]]); c.beginPath(); c.moveTo(xs[2], ey); c.lineTo(xs[3], ey); c.lineTo(xs[4], ey + fe * 0.55); c.lineTo(xs[5], ey + fe); c.lineTo(X0, ey + fe); c.lineTo(xs[1], ey + fe * 0.55); c.closePath(); c.fill();
    if (j === hzAt) { hazard(c, xs[1] + 0.5, ey + fe * 0.5, xs[4] - xs[1] - 1, fe * 0.38, 1.3); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(X0, ey + fe * 0.5, XW, fe * 0.4); }
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(X0 - 0.5, ey + fe - 0.8, XW + 1, 1);
  }
}
function paintNSBarrierV4(c, R, S) {
  // Bevisst juks: lys betongtopp (lyseste flate) med langsgående midtrille, lav sørkant (40 % av løftet), ingen sideflate, kort sideskygge.
  const { w, d, f, g } = S, CON = tint([104, 107, 110], R.r(0.84, 1.0)), n = Math.max(1, Math.round(S.dw / 64)), y0 = f * 0.6, fe = f * 0.4, sx = LW >= 0 ? 1 : -1;
  c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(sx > 0 ? w : -4, y0 + 1, 4, d + fe);                 // kort skygge til siden
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(sx > 0 ? w + 4 : -6, y0 + 2, 2, d + fe);
  c.fillStyle = grad(c, 0, 0, w, 0, [[0, rgb(CON, -0.04 + 0.06 * LW)], [0.5, rgb(CON, 0.0)], [1, rgb(CON, -0.12)]]); c.fillRect(0, y0, w, d);
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(w / 2 - 0.6, y0, 1.2, d); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(w / 2 + 0.6, y0, 0.6, d);   // midtrille
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y0, 0.7, d); c.fillRect(w - 0.7, y0, 0.7, d);
  for (let j = 1; j < n; j++) { const y = y0 + j * d / n; c.fillStyle = 'rgba(8,8,8,0.8)'; c.fillRect(0, y - 0.6, w, 1.2); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, y + 0.6, w, 0.6); }
  c.save(); c.beginPath(); c.rect(0, y0, w, d); c.clip(); speckle(c, R, 0, y0, w, d, Math.round(w * d / 9), [40, 40, 40], 0.12, 0.4); if (R() < 0.6) stain(c, R, R() * w, y0 + R() * d, R.r(3, 8), R.r(2, 4), [38, 34, 30], 0.35); c.restore();
  for (let q = 0; q < 4; q++) if (R() < 0.7) { c.fillStyle = rgb(CON, R() < 0.3 ? -0.05 : -0.5, 0.9); const cx = R() < 0.5 ? 0 : w - 2, cy = y0 + R() * d; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + 2, cy + R.r(1, 3)); c.lineTo(cx, cy + R.r(2, 5)); c.fill(); }   // avskalling
  c.fillStyle = grad(c, 0, y0 + d, 0, d + f, [[0, rgb(CON, -0.18)], [1, rgb(CON, -0.34)]]); c.fillRect(0, y0 + d, w, fe);   // lav sørkant
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(0, y0 + d, w, 0.6); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-0.5, d + f - 0.8, w + 1, 1);
  if (S.hz) { const hw = Math.min(w * 0.28, 8); hazard(c, R() < 0.5 ? 1.5 : w - hw - 1.5, y0 + d + fe * 0.15, hw, fe * 0.6, 1.2); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, y0 + d, w, fe); }
  c.fillStyle = grad(c, 0, y0 + d + fe * 0.4, 0, d + f, [[0, 'rgba(60,44,28,0)'], [1, 'rgba(60,44,28,0.5)']]); c.fillRect(0, y0 + d + fe * 0.4, w, fe * 0.6);
}
function paintNS(kind, c, R, S) {
  if (kind === 'barrier') return paintNSBarrier(c, R, S);
  // h > w, alle typer: flat mørk topp nær gulvtonen + jukse-sideflate på skyggesiden (bredde = løft·0,35) + kort mørk sørfront + myk bakkeskygge langs langsiden.
  const { w, d, f, g } = S, lift = f / g, sw = Math.min(w * 0.4, lift * 0.35), east = LW >= 0, n = Math.max(1, Math.round(S.dw / 64));
  const base = kind === 'sandbag' ? tint(JUTE[0], R.r(0.6, 0.7)) : kind === 'crates' ? tint([92, 74, 52], R.r(0.6, 0.7)) : tint([104, 107, 110], R.r(0.58, 0.66));
  const tx = east ? 0 : sw, tw = w - sw, sx = east ? tw : 0;
  // bakkeskygge langs skyggesida
  c.fillStyle = grad(c, east ? w : 0, 0, east ? w + 6 : -6, 0, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(east ? w : -6, f * 0.6, 6, d + f * 0.4);
  // topp
  c.fillStyle = rgb(base, 0); c.fillRect(tx, 0, tw, d);
  c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(tx, 0, tw, 0.8); c.fillRect(east ? tx : tx + tw - 0.8, 0, 0.8, d);   // svak lys kant mot lyset
  if (kind === 'sandbag') { const rh = R.r(7, 9) * g; for (let y = 0, k = 0; y < d; y += rh, k++) { const off = k % 2 ? tw / 4 : 0;
      for (let x = -off; x < tw; x += tw / 2) { c.fillStyle = rgb(base, R.r(-0.06, 0.06)); c.beginPath(); c.ellipse(tx + x + tw / 4, y + rh / 2, tw / 4 - 0.4, rh / 2 - 0.3, 0, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(tx, y + rh - 0.5, tw, 0.6); } }
  else if (kind === 'crates') { for (let j = 0; j < n; j++) { const y = j * d / n; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(tx, y, tw, 0.8); for (let p = 1; p < 4; p++) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(tx + tw * p / 4, y, 0.5, d / n); } } }
  else { for (let j = 1; j < n; j++) { const y = j * d / n; c.fillStyle = 'rgba(5,5,5,0.8)'; c.fillRect(tx, y - 0.6, tw, 1.2); }
    for (let j = 0; j < n; j++) { c.fillStyle = 'rgba(10,10,10,0.55)'; c.fillRect(tx + tw * 0.42, (j + 0.45) * d / n, tw * 0.16, d / n * 0.08); } }
  c.save(); c.beginPath(); c.rect(tx, 0, tw, d); c.clip(); speckle(c, R, tx, 0, tw, d, Math.round(tw * d / 10), [30, 30, 30], 0.1, 0.4); c.restore();
  // sideflate (skyggesida): fra toppkant ned til bakken, mørk med gradient mot foten
  c.fillStyle = grad(c, 0, 0, 0, d + f, [[0, rgb(base, -0.42)], [1, rgb(base, -0.6)]]); c.fillRect(sx, 0, sw, d + f);
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(east ? sx : sx + sw - 0.7, 0, 0.7, d + f);
  for (let j = 1; j < n; j++) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(sx, j * d / n, sw, 0.8); }
  // sørfront: kort, mørk, lav kontrast
  c.fillStyle = grad(c, 0, d, 0, d + f, [[0, rgb(base, -0.3)], [1, rgb(base, -0.45)]]); c.fillRect(tx, d, tw, f);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(tx, d, tw, 0.6);
  if (kind === 'barrier' && S.hz) { hazard(c, tx + tw * 0.3, d + f * 0.2, tw * 0.4, f * 0.35, 1.4); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(tx, d, tw, f); }
}
function paintBarrier(c, R, S) {
  // Jersey-barriere i mørk, kald betong. Topp: smal rygg + to skrå sider. Front (sør): smal vegg, skrå fot, bred fot med skitt.
  const { w, d, f, horiz } = S, k = R.r(0.84, 1.0), CON = tint([104, 107, 110], k), seg = 64;
  const n = horiz ? Math.max(1, Math.round(w / seg)) : 1, sw = w / n, nY = horiz ? 1 : Math.max(1, Math.round(S.dw / seg)), sd = d / nY;
  const ix = horiz ? 0 : w * 0.26, iy = horiz ? d * 0.42 : 0;   // smalere enn ruta på tvers
  for (let j = 0; j < nY; j++) for (let i = 0; i < n; i++) {
    const x = i * sw + 0.4 + ix, y = j * sd + (j === 0 ? iy : 0), W = sw - 0.8 - ix * 2, D = sd - (j === 0 ? iy : 0) - (j < nY - 1 ? 0.7 : 0);
    // topp: nordskråning (lys, mot lyset), rygg (lysest), sørskråning (mørkere)
    if (horiz) {
      const t0 = y, t1 = y + D * 0.42, t2 = y + D * 0.58, t3 = y + D;
      c.fillStyle = rgb(CON, 0.02 + 0.1 * LN); c.fillRect(x, t0, W, t1 - t0);
      c.fillStyle = rgb(CON, 0.2); c.fillRect(x, t1, W, t2 - t1);
      c.fillStyle = rgb(CON, -0.14); c.fillRect(x, t2, W, t3 - t2);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, t2, W, 0.6); c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x, t1, W, 0.5);
    } else {
      const s0 = x, s1 = x + W * 0.4, s2 = x + W * 0.6, s3 = x + W;
      c.fillStyle = rgb(CON, 0.02 + 0.1 * LW); c.fillRect(s0, y, s1 - s0, D);
      c.fillStyle = rgb(CON, 0.2); c.fillRect(s1, y, s2 - s1, D);
      c.fillStyle = rgb(CON, -0.18); c.fillRect(s2, y, s3 - s2, D);
    }
    c.fillStyle = 'rgba(15,15,15,0.6)'; if (horiz) { c.fillRect(x + W * 0.22, y + D * 0.46, 2, D * 0.1); c.fillRect(x + W * 0.74, y + D * 0.46, 2, D * 0.1); }
    speckle(c, R, x, y, W, D, Math.round(W * D / 9), [40, 40, 40], 0.12, 0.4);
    if (R() < 0.6) stain(c, R, x + R() * W, y + R() * D, R.r(3, 8), R.r(2, 4), [38, 34, 30], 0.35);
    // fuge mellom seksjoner (topp)
    c.fillStyle = 'rgba(8,8,8,0.85)'; if (horiz && i > 0) c.fillRect(x - 0.8, y, 1.2, D); if (!horiz && j > 0) c.fillRect(x, y - 0.8, W, 1.2);
    if (j === nY - 1) {
      const fy = d, a = f * 0.46, b = f * 0.24, e = f - a - b;
      c.fillStyle = grad(c, 0, fy, 0, fy + a, [[0, rgb(CON, -0.12)], [1, rgb(CON, -0.24)]]); c.fillRect(x, fy, W, a);
      c.fillStyle = grad(c, 0, fy + a, 0, fy + a + b, [[0, rgb(CON, 0.02)], [1, rgb(CON, -0.22)]]); c.beginPath(); c.moveTo(x, fy + a); c.lineTo(x + W, fy + a); c.lineTo(x + W + 1.2, fy + a + b); c.lineTo(x - 1.2, fy + a + b); c.fill();   // skrå fot (mørkere enn toppen, så den ikke leser som topp)
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 1.2, fy + a + b - 0.5, W + 2.4, 0.7);
      c.fillStyle = grad(c, 0, fy + a + b, 0, fy + f, [[0, rgb(CON, -0.38)], [1, rgb(CON, -0.55)]]); c.fillRect(x - 1, fy + a + b, W + 2, e);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, fy, W, 0.6); c.fillStyle = rgb(CON, 0.14); c.fillRect(x, fy + 0.6, W, 1.1);                        // mørk kant mellom topp og front (ingen lys kant på fronten)
      // avskallede kanter
      for (let q = 0; q < 4; q++) if (R() < 0.7) { c.fillStyle = rgb(CON, R() < 0.3 ? -0.05 : -0.5, 0.9); const cx = x + R() * W, cy = fy + (R() < 0.5 ? 0.6 : a + b); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R.r(1.5, 4), cy); c.lineTo(cx + R.r(0, 2.5), cy + R.r(1, 3)); c.fill(); }
      // gul/svart stripe (seed)
      if (S.hz && (i === 0 || i === n - 1)) { const hw = Math.min(W * 0.28, 8); hazard(c, i === n - 1 && n > 1 ? x + W - hw - 1.5 : x + 1.5, fy + a * 0.2, hw, a * 0.6, 1.8); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, fy, W, a); }
      speckle(c, R, x, fy, W, f, Math.round(W * f / 8), [30, 30, 30], 0.15, 0.5);
      // skitt og rust nederst
      c.fillStyle = grad(c, 0, fy + f * 0.55, 0, fy + f, [[0, 'rgba(60,44,28,0)'], [1, 'rgba(60,44,28,0.55)']]); c.fillRect(x - 1, fy + f * 0.55, W + 2, f * 0.45);
      for (let q = 0; q < 3; q++) if (R() < 0.6) { c.fillStyle = 'rgba(70,45,25,0.35)'; c.fillRect(x + R() * W, fy + R.r(0.1, 0.5) * f, 0.8, f * R.r(0.2, 0.5)); }   // rustrenner
      c.fillStyle = 'rgba(10,10,10,0.75)'; c.fillRect(x + W * 0.18, fy + f - 2.4, 3.5, 1.6); c.fillRect(x + W * 0.72, fy + f - 2.4, 3.5, 1.6);
      if (i > 0 && horiz) { c.fillStyle = 'rgba(5,5,5,0.9)'; c.fillRect(x - 0.8, fy, 1.4, f); }
    }
  }
}
const JUTE = [[100, 86, 62], [86, 88, 70], [94, 80, 58], [80, 82, 68]];
// Pute: avrundet firkant med bulende sider, lys midte (oppe-venstre mot lyset), mørk kant, myk skygge rundt. cx/cy = midtpunkt.
function pillowPath(c, w, h, R) {
  const bx = w * 0.06, by = h * 0.1, x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2, k = Math.min(w, h) * 0.38;
  c.beginPath(); c.moveTo(x0 + k, y0 + R.r(0, 0.6));
  c.quadraticCurveTo(0, y0 - by, x1 - k, y0 + R.r(0, 0.6)); c.quadraticCurveTo(x1, y0, x1 + bx * 0.3, y0 + k);
  c.quadraticCurveTo(x1 + bx, 0, x1 + bx * 0.3, y1 - k); c.quadraticCurveTo(x1, y1, x1 - k, y1);
  c.quadraticCurveTo(0, y1 + by, x0 + k, y1); c.quadraticCurveTo(x0, y1, x0 - bx * 0.3, y1 - k);
  c.quadraticCurveTo(x0 - bx, 0, x0 - bx * 0.3, y0 + k); c.quadraticCurveTo(x0, y0, x0 + k, y0 + R.r(0, 0.6)); c.closePath();
}
function pillow(c, R, cx, cy, w, h, col, rot, opts = {}) {
  c.save(); c.translate(cx, cy); c.rotate(rot);
  // myk skygge rundt/under (ingen shadowBlur: to forstørrede, gjennomsiktige kopier)
  for (const [s, a] of [[1.16, 0.18], [1.07, 0.3]]) { c.save(); c.translate(w * 0.03, h * 0.12); c.scale(s, s); pillowPath(c, w, h, R); c.fillStyle = `rgba(8,6,4,${a})`; c.fill(); c.restore(); }
  pillowPath(c, w, h, R);
  const k = R.r(-0.08, 0.06), lx = -w * 0.18 * (opts.lx ?? 1), ly = -h * 0.22;
  const g = c.createRadialGradient(lx, ly, 0, 0, 0, Math.max(w, h) * 0.62);
  g.addColorStop(0, rgb(col, k + 0.16 * (opts.light ?? 1))); g.addColorStop(0.55, rgb(col, k - 0.04)); g.addColorStop(1, rgb(col, k - 0.42)); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(16,12,8,0.6)'; c.lineWidth = 0.6; c.stroke();
  c.save(); pillowPath(c, w, h, R); c.clip();
  // svak vevtekstur + noen folder
  for (let i = 0; i < w * h / 5; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '20,14,8' : '150,130,100'},${R.r(0.04, 0.1)})`; c.fillRect(-w / 2 + R() * w, -h / 2 + R() * h, R.r(0.4, 1), 0.35); }
  c.strokeStyle = 'rgba(20,14,8,0.22)'; c.lineWidth = 0.5; for (let i = 0; i < 2; i++) { const y = R.r(-0.25, 0.3) * h; c.beginPath(); c.moveTo(-w * 0.3, y); c.quadraticCurveTo(0, y + R.r(-1, 1.5), w * 0.3, y + R.r(-1, 1)); c.stroke(); }
  c.restore();
  // foldet og bundet ende
  if (opts.tie) { const ex = opts.tie > 0 ? w / 2 - 1.2 : -w / 2 + 1.2; c.fillStyle = rgb(col, k - 0.32); c.beginPath(); c.ellipse(ex, 0, Math.min(3, w * 0.12), h * 0.34, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgb(col, k - 0.05); c.beginPath(); c.ellipse(ex + (opts.tie > 0 ? 1.4 : -1.4), -h * 0.05, 1.6, h * 0.2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(30,22,14,0.8)'; c.fillRect(ex - 0.4, -h * 0.3, 0.8, h * 0.6); }
  c.restore();
}
function paintSandbag(c, R, S) {
  const { w, d, f, horiz, g } = S, base = R.r(0.85, 1), J0 = JUTE[Math.floor(R() * JUTE.length)], J1 = JUTE[Math.floor(R() * JUTE.length)];
  const pal = () => tint(R() < 0.7 ? J0 : J1, base * R.r(0.88, 1.05)), layers = R() < 0.5 ? 2 : 3, lh = f / layers;
  // front: 2–3 lag store puter sett fra sør (ender eller langsider), bakerste lag først
  c.fillStyle = 'rgba(12,10,8,0.9)'; rr(c, 0.5, d * 0.5, w - 1, f + d * 0.5, 3); c.fill();
  for (let l = 0; l < layers; l++) {
    const yy = d + lh * (l + 0.55), bl0 = R.r(13.2, 17.6), off = l % 2 ? bl0 * 0.5 : R.r(0, 2), dim = 1 - 0.06 * (layers - 1 - l);
    for (let x0 = -off; x0 < w - 2; ) { const bl = Math.min(w + 1 - x0, bl0 * R.r(0.85, 1.15)); if (bl > 5) pillow(c, R, x0 + bl / 2, yy, bl + 1.5, lh * R.r(1.05, 1.25), tint(pal(), dim * 0.86), R.r(-0.06, 0.06), { tie: R() < 0.18 ? (R() < 0.5 ? 1 : -1) : 0, light: 0.6 }); x0 += bl; }
  }
  // topp: rader av puter ovenfra (2 rader på tvers), store og flate
  const rows = 2;
  if (horiz) { const rd = d / rows; for (let r = 0; r < rows; r++) { const bl0 = R.r(15.4, 21), off = r % 2 ? bl0 * 0.45 : R.r(0, 2); for (let x0 = -off; x0 < w - 2; ) { const bl = Math.min(w + 1 - x0, bl0 * R.r(0.85, 1.15)); if (bl > 5) pillow(c, R, x0 + bl / 2, rd * (r + 0.5), bl + 1.2, rd * R.r(1.0, 1.2), pal(), R.r(-0.08, 0.08), { tie: R() < 0.15 ? 1 : 0 }); x0 += bl; } } }
  else { const rw = w / rows; for (let r = 0; r < rows; r++) { const bl0 = R.r(15.4, 21) * g, off = r % 2 ? bl0 * 0.45 : 0; for (let y0 = -off; y0 < d - 1; ) { const bl = Math.min(d + 1 - y0, bl0 * R.r(0.85, 1.15)); if (bl > 4) pillow(c, R, rw * (r + 0.5), y0 + bl / 2, rw * R.r(1.0, 1.15), bl + 1, pal(), R.r(-0.06, 0.06), {}); y0 += bl; } } }
}
function paintCrates(c, R, S) {
  const { w, d, f } = S, WOOD = tint([[92, 70, 48], [80, 64, 46], [74, 70, 56]][Math.floor(R() * 3)], R.r(0.85, 1.0));
  const pal = Math.max(3, f * 0.26), cf = f - pal, n = Math.max(1, Math.round(w / R.r(28, 34))), cw = w / n;
  // pall: dekkbord + klosser, mørke åpninger mellom
  const py = d + cf; c.fillStyle = '#100d0a'; c.fillRect(0, py, w, pal);
  c.fillStyle = rgb([96, 78, 56], -0.15); c.fillRect(0, py, w, pal * 0.28);                      // dekkbord
  for (let i = 0; i < 3; i++) { const bx = i * (w - 6) / 2; c.fillStyle = rgb([96, 78, 56], -0.25); c.fillRect(bx, py + pal * 0.28, 6, pal * 0.5); }   // klosser
  c.fillStyle = rgb([96, 78, 56], -0.3); c.fillRect(0, py + pal * 0.78, w, pal * 0.22);           // bunnbord
  for (let q = 0; q < w; q += 9) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(q, py, 0.5, pal * 0.28); }
  for (let i = 0; i < n; i++) {
    const x = i * cw + 0.5, W = cw - 1, col = tint(WOOD, R.r(0.92, 1.06)), pl = Math.max(3, Math.round(W / 6));
    for (let p = 0; p < pl; p++) { c.fillStyle = rgb(col, 0.06 + R.r(-0.08, 0.06) + 0.06 * LN); c.fillRect(x + p * W / pl, 0.3, W / pl - 0.6, d - 0.6); }
    c.strokeStyle = rgb(col, -0.5); c.lineWidth = 1.6; c.strokeRect(x + 0.8, 1.1, W - 1.6, d - 1.9);
    const fy = d; c.fillStyle = rgb(col, -0.28); c.fillRect(x, fy, W, cf);
    for (let p = 1; p < 4; p++) { c.fillStyle = 'rgba(10,6,3,0.5)'; c.fillRect(x, fy + p * cf / 4, W, 0.6); }
    c.strokeStyle = rgb(col, -0.52); c.lineWidth = 1.8; c.strokeRect(x + 0.9, fy + 0.9, W - 1.8, cf - 1.8);
    if (R() < 0.6) { c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 1.6, fy + cf - 1.6); c.lineTo(x + W - 1.6, fy + 1.6); c.stroke(); }
    if (R() < 0.5) { c.fillStyle = 'rgba(190,180,150,0.22)'; c.font = `bold ${Math.max(3, cf * 0.26)}px sans-serif`; c.fillText(['AMMO', 'KX-7', '07', 'FRAG'][Math.floor(R() * 4)], x + W * 0.28, fy + cf * 0.62); }
    c.fillStyle = 'rgba(255,240,210,0.12)'; c.fillRect(x, fy, W, 0.7);
    speckle(c, R, x, 0, W, d + cf, Math.round(W * (d + cf) / 10), [20, 14, 8], 0.12, 0.4);
  }
}
function paintBarrels(c, R, S) {
  const { w, d, f } = S, COLS = [[92, 40, 30], [40, 56, 72], [66, 70, 46], [110, 88, 40], [58, 58, 56]];
  const nx = Math.max(1, Math.round(w / 24)), ny = Math.max(1, Math.round(S.dw / 24)), bw = w / nx, rd = d / ny, rx = Math.min(bw, rd / S.g) * 0.44, ry = rx * S.g;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (nx * ny > 2 && R() < 0.12) continue;
    const col = COLS[Math.floor(R() * COLS.length)].map((v) => v * 1), cx = i * bw + bw / 2 + R.r(-0.6, 0.6), cy = j * rd + rd / 2, bot = cy + f;
    // kropp
    c.fillStyle = grad(c, cx - rx, 0, cx + rx, 0, [[0, rgb(col, 0.25 * LW)], [0.35, rgb(col, 0.15)], [0.75, rgb(col, -0.25)], [1, rgb(col, -0.5)]]);
    c.beginPath(); c.ellipse(cx, bot, rx, ry, 0, 0, Math.PI); c.lineTo(cx - rx, cy); c.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.7;
    for (const t of [0.3, 0.68]) { c.beginPath(); c.ellipse(cx, cy + f * t, rx, ry, 0, 0, Math.PI); c.stroke(); }
    if (R() < 0.6) { c.fillStyle = 'rgba(70,40,20,0.45)'; c.fillRect(cx - rx * R.r(0, 0.6), cy + f * R.r(0.3, 0.7), rx * R.r(0.3, 0.8), f * 0.2); }
    // lokk
    c.fillStyle = rgb(col, 0.05); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgb(col, -0.45); c.lineWidth = 0.9; c.beginPath(); c.ellipse(cx, cy, rx * 0.88, ry * 0.86, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(20,20,20,0.65)'; c.beginPath(); c.ellipse(cx + rx * 0.4, cy - ry * 0.2, rx * 0.13, ry * 0.13, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,240,220,0.18)'; c.beginPath(); c.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.5, ry * 0.25, 0, 0, Math.PI * 2); c.fill();
  }
}
function paintTunnel(c, R, S) {   // kulvert med åpning mot sør: tak (sylinder, ribbet) + sørportal med mørk åpning. 'back' = taket, 'front' = portalen
  const { w, d, f, g } = S, steel = R() < 0.6, M = steel ? tint([92, 96, 98], R.r(0.9, 1.05)) : tint([108, 108, 104], R.r(0.9, 1.04));
  // tak: sylinder sett ovenfra – lys rygg litt nord for midten, mørk mot sør/nord-kant
  c.fillStyle = grad(c, 0, 0, 0, d, [[0, rgb(M, -0.35)], [0.3, rgb(M, 0.12)], [0.45, rgb(M, 0.2)], [0.8, rgb(M, -0.1)], [1, rgb(M, -0.3)]]); rr(c, 0, 0, w, d, Math.min(d * 0.5, 5)); c.fill();
  if (steel) { for (let x = 2; x < w - 1; x += 3.2) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x, 0.5, 1, d - 1); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x + 1.2, d * 0.3, 0.7, d * 0.25); } }
  else { for (let x = 24; x < w - 4; x += R.r(28, 36)) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x, 0, 1.2, d); } }
  for (let i = 0; i < 4; i++) stain(c, R, R() * w, R.r(0.4, 1) * d, R.r(4, 9), R.r(2, 4) * g, steel ? [96, 52, 26] : [40, 36, 30], R.r(0.18, 0.35));   // rust/skitt
  // portal (sørfront): kant/hodevegg + mørk bue-åpning
  const fy = d; c.fillStyle = grad(c, 0, fy, 0, fy + f, [[0, rgb(M, -0.05)], [1, rgb(M, -0.4)]]); c.fillRect(0, fy, w, f);
  const ow = Math.min(w * 0.42, f * 1.5), cx = w / 2, oy = fy + f, oh = f * 0.82;
  for (let k = Math.ceil(w / (ow * 2.6)), j = 0; j < k; j++) { const x0 = w * (j + 0.5) / k;
    c.fillStyle = steel ? rgb(M, 0.16) : rgb(M, 0.08); c.beginPath(); c.ellipse(x0, oy, Math.min(ow, w / k * 0.46) + 2, oh + 1.6, 0, Math.PI, 0); c.fill();   // lys ring/kant
    const gi = grad(c, 0, oy - oh, 0, oy, [[0, '#060607'], [0.7, '#0d0e10'], [1, '#17181a']]); c.fillStyle = gi; c.beginPath(); c.ellipse(x0, oy, Math.min(ow, w / k * 0.46), oh, 0, Math.PI, 0); c.fill();
    if (steel) { c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.6; for (let r = 0.7; r < 1; r += 0.12) { c.beginPath(); c.ellipse(x0, oy, Math.min(ow, w / k * 0.46) * r, oh * r, 0, Math.PI, 0); c.stroke(); } } }
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(0, fy, w, 0.7);
  speckle(c, R, 0, 0, w, d + f, Math.round(w * (d + f) / 12), [40, 34, 28], 0.1, 0.35);
}
// Arena (Breach 28.10, lav dekning): massiv lav jersey-blokk. Topp komprimert så fronten blir >= ~55 % av toppdybden.
function paintJersey(c, R, S) {
  const { w, f } = S, d0 = S.d, CON = tint([112, 113, 110], R.r(0.9, 1.0));
  const y0 = f * 0.42, ft = Math.max(f * 0.55, d0 * 0.5), top = d0 + f - y0 - ft; c.save(); c.translate(0, y0);          // toppflate y∈[0,top], front y∈[top, d0+f]
  const n = S.horiz ? Math.max(1, Math.round(w / 40)) : 1, gap = n > 1 ? 1.2 : 0, sw = (w - gap * (n - 1)) / n;
  const yb = d0 + f - y0;
  // slagskygge mot SØ (som sandsekkene) + kontakt-AO
  for (let q = 5; q >= 0; q--) { const e = q * 1.3; c.fillStyle = 'rgba(0,0,0,0.21)'; c.beginPath();
    c.moveTo(w * 0.1, yb - 1); c.lineTo(w + 4 + e, yb - 1); c.lineTo(w + 6 + e, yb + 4 + e * 0.6); c.lineTo(2 + e * 0.4, yb + 4 + e * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(w - 1, ft * 0.2); c.lineTo(w + 4 + e, ft * 0.35 + 2); c.lineTo(w + 4 + e, yb + 2); c.lineTo(w - 1, yb); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(-0.5, yb - 0.6, w + 1.5, 1.6);
  for (let j = 0; j < n; j++) {
    const x0 = j * (sw + gap), x1 = x0 + sw, ins = sw * 0.2, fs = sw * 0.08;
    // TOPP: smal rygg + skrå flanker sett ovenfra
    c.fillStyle = rgb(CON, -0.42); c.fillRect(x0, 0, ins, top);                                   // vestflanke (lys side mot lys)
    c.fillStyle = grad(c, 0, 0, 0, top, [[0, rgb(CON, -0.32)], [1, rgb(CON, -0.4)]]); c.fillRect(x0 + ins, 0, sw - 2 * ins, top);
    c.fillStyle = rgb(CON, -0.6); c.fillRect(x1 - ins, 0, ins, top);                             // østflanke mørk
    c.fillStyle = rgb(CON, 0.55); c.fillRect(x0 + ins, 0, sw - 2 * ins, 0.9);                     // lys toppkant nord
    c.fillStyle = rgb(CON, 0.45); c.fillRect(x0 + ins, top - 0.8, sw - 2 * ins, 0.8);             // lys kant topp→front
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x1 - ins, 0, 0.6, top);
    // FRONT: jersey-profil (rygg → skrå flanke → loddrett fot)
    const yk = top + ft * 0.55;
    c.fillStyle = grad(c, 0, top, 0, yk, [[0, rgb(CON, -0.22)], [1, rgb(CON, -0.38)]]);
    c.beginPath(); c.moveTo(x0 + ins, top); c.lineTo(x1 - ins, top); c.lineTo(x1 - fs, yk); c.lineTo(x0 + fs, yk); c.closePath(); c.fill();
    c.fillStyle = rgb(CON, -0.05); c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + ins, 0); c.lineTo(x0 + ins, top); c.lineTo(x0 + fs, yk); c.lineTo(x0, yk); c.closePath(); c.fill(); // vest-silhuett
    c.fillStyle = rgb(CON, -0.5); c.beginPath(); c.moveTo(x1, 0); c.lineTo(x1 - ins, 0); c.lineTo(x1 - ins, top); c.lineTo(x1 - fs, yk); c.lineTo(x1, yk); c.closePath(); c.fill();
    c.fillStyle = grad(c, 0, yk, 0, yb, [[0, rgb(CON, -0.34)], [1, rgb(CON, -0.52)]]); c.fillRect(x0, yk, sw, yb - yk);   // fot
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x0 + fs, yk - 0.4, sw - 2 * fs, 0.7);    // knekk-highlight
    if (S.hz && j === 0 || n === 1) hazard(c, x0 + 1, yk + (yb - yk) * 0.22, sw - 2, (yb - yk) * 0.5, 1.6);
    // slitasje: avskallinger på kanter
    for (let q = 0; q < 4; q++) { const cx = x0 + R() * sw, cy = R() < 0.5 ? top : yk; c.fillStyle = rgb(CON, R() < 0.5 ? -0.6 : 0.3, 0.9);
      c.beginPath(); c.moveTo(cx, cy - 0.6); c.lineTo(cx + R.r(1, 2.5), cy + R.r(0, 1)); c.lineTo(cx + R.r(-1, 1), cy + R.r(1, 2)); c.fill(); }
    c.save(); c.beginPath(); c.rect(x0, 0, sw, yb); c.clip(); speckle(c, R, x0, 0, sw, yb, Math.round(sw * yb / 6), [50, 50, 48], 0.15, 0.45); c.restore();
    c.fillStyle = 'rgba(10,10,10,0.75)'; c.fillRect(x0 + sw * 0.44, top * 0.45, sw * 0.12, 1.4);   // løftehull
  }
  c.restore();
}
function paintBarrierMix(c, R, S) { return S.w <= 64 ? paintJersey(c, R, S) : paintBarrier(c, R, S); }
const PAINT = { barrier: paintBarrierMix, sandbag: paintSandbag, crates: paintCrates, barrels: paintBarrels, tunnel: paintTunnel };

function build(kind, o, H, P, qx, qy, seed) {
  const lift = H * P.zScale, g = qy / qx, horiz = o.w >= o.h, so = shadowOffset(H);
  const PL = 3, PT = 3, PR = Math.ceil(Math.max(0, so.x)) + 5, PB = Math.ceil(Math.max(0, so.y)) + 5;
  const d = o.h * g, f = lift * g, W = Math.ceil((o.w + PL + PR) * qx), Hh = Math.ceil((o.h + lift + PT + PB) * qy);
  const cv = canvas(Math.max(1, Math.min(4096, W)), Math.max(1, Math.min(4096, Hh))), c = cv.getContext('2d'), R = rng(seed);
  c.scale(qx, qx); c.translate(PL, PT * g);
  const S = { w: o.w, d, f, g, H, dw: o.h, horiz, hz: R() < 0.65 };
  // bakkeskygge (myk, i bakkeplanet, langs SHADOW_DIR) + kontakt-AO ved foten. Fotavtrykket ligger i y ∈ [f, f + d].
  const fx0 = 0, fy0 = f, fw = o.w, fh = d, sx = Math.min(6, so.x), sy = Math.min(6, so.y) * g;   // Arena klipper spriten 8 px utenfor rektangelet; resten av bakkeskyggen tegner Arena (drawShadows)
  const nsB = kind === 'barrier' && Math.max(o.w, o.h) <= 64; // 28.10: alle lave jersey-blokker (≤ 2 ruter) har egen slagskygge i paintJersey
  if (!nsB) for (let q = 4; q >= 0; q--) { const e = q * 1.2; c.fillStyle = `rgba(0,0,0,${0.13})`; c.beginPath();
    c.moveTo(fx0 - e * 0.3, fy0 - e * 0.3 * g); c.lineTo(fx0 + fw + e * 0.3, fy0 - e * 0.3 * g); c.lineTo(fx0 + fw + sx + e, fy0 + sy - e * g); c.lineTo(fx0 + fw + sx + e, fy0 + fh + sy + e * g); c.lineTo(fx0 + sx - e * 0.5, fy0 + fh + sy + e * g); c.lineTo(fx0 - e * 0.3, fy0 + fh + e * 0.3 * g); c.closePath(); c.fill(); }
  if (!nsB) { c.fillStyle = grad(c, 0, d + f - 1, 0, d + f + 3 * g, [[0, 'rgba(0,0,0,0.8)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(-1.5, d + f - 1, o.w + 3, 3 * g + 1); }   // 27.10: klammer – før lakk fillRect ut for NS-barrierer (hard svart strek under)
  if (globalThis.__COVER_DEBUG) { c.fillStyle = '#f00'; c.fillRect(0, 0, o.w, d); c.fillStyle = '#0f0'; c.fillRect(0, d, o.w, f); }
  else {
    if (!horiz && (kind === 'barrier' || kind === 'sandbag' || kind === 'crates')) paintNS(kind, c, R, S); else PAINT[kind](c, R, S);
    c.globalCompositeOperation = 'source-atop';   // matt skitt over objektet (ikke skyggen: den er under, men source-atop treffer alt; holdes svakt)
    for (let i = 0; i < 3; i++) stain(c, R, R() * o.w, R() * d, R.r(4, 10), R.r(3, 6) * g, [28, 24, 20], R.r(0.12, 0.25));
    c.globalCompositeOperation = 'source-over';
  }
  return { c: cv, pl: PL, pt: PT, pr: PR, pb: PB, lift, bytes: cv.width * cv.height * 4 };
}
function sprite(kind, o, H, P, sx, sy) {
  const qx = step(sx), qy = qx * step(sy / Math.max(1e-6, sx) * 4) / 4, seed = seedOf(o);   // forkortingen (sy/sx) kvantiseres i kvarttrinn
  const key = `${kind}|${o.w}|${o.h}|${H}|${seed}|${qx}|${qy}|${P.zScale.toFixed(4)}`;
  let s = cache.get(key);
  if (!s) { s = build(kind, o, H, P, qx, qy, seed); cache.set(key, s); cacheBytes += s.bytes; while (cacheBytes > MAX_BYTES && cache.size > 1) { const k = cache.keys().next().value; cacheBytes -= cache.get(k).bytes; cache.delete(k); } }
  return s;
}

/** Tegn lav dekning. Kallformer: drawLowCover(ctx, cover, env)  med env = { PROJ, time, lit, view, part? }
 *                                 drawLowCover(ctx, o, world, camera, opts?) med opts = { part? }
 *  part: 'top'|'back' (tak/nordside) | 'front' (sørfront) | utelatt (= begge). Bruker ctx sin nåværende transform (cover-koordinater = verdens-px).
 *  Returnerer true hvis typen ble tegnet, false hvis typen ikke er vår. */
export function drawLowCover(ctx, o, a3, a4, a5) {
  const kind = o && kindOf(o); if (!kind) return false;
  if (globalThis.__LCLOG && !o.__l) { o.__l = 1; globalThis.__LCLOG.push({ k: kind, x: o.x, y: o.y, w: o.w, h: o.h, height: o.height, elev: o.elev }); }
  const { P, part } = args(a3, a4, a5), H = heightOf(o, P), m = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0, c: 0, d: 1 };
  const sx = Math.hypot(m.a, m.b) || 1, sy = Math.hypot(m.c, m.d) || 1, s = sprite(kind, o, H, P, sx, sy);
  const L = s.lift, img = s.c, iw = img.width, ih = img.height, ww = o.w + s.pl + s.pr, wh = o.h + L + s.pt + s.pb;
  const x = o.x - s.pl, y = o.y - L - s.pt;
  if (!part) ctx.drawImage(img, x, y, ww, wh);
  else { const cut = (s.pt + o.h) / wh; if (part === 'top' || part === 'back') ctx.drawImage(img, 0, 0, iw, ih * cut, x, y, ww, wh * cut); else ctx.drawImage(img, 0, ih * cut, iw, ih * (1 - cut), x, y + wh * cut, ww, wh * (1 - cut)); }
  return true;
}
/** Forhåndstegn sprites for alle lave dekninger i world (world.level.objects / world.objects / world.covers) ved zoomtrinn 1, 2, 4. */
export function warmCoverSprites(world, zooms = [1, 2, 4]) {
  const P = (world && world.PROJ) || PROJ0, list = (world && (world.level?.objects || world.objects || world.covers || world.arena?.objects)) || [];
  let n = 0; for (const o of list) { const k = kindOf(o); if (!k) continue; for (const z of zooms) { sprite(k, o, heightOf(o, P), P, z, z * (P.groundScaleY || 1)); n++; } } return n;
}
export function _coverCacheStats() { return { sprites: cache.size, mb: +(cacheBytes / 1e6).toFixed(1) }; }
