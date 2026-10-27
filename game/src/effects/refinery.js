// BREACH – kunstsett for brett 2, Deepwell Refinery (Effekter, 27.10, FORSLAG – ikke koblet inn).
// Samme system som cover.js/ground.js: lav dekning som cachede sprites per type/størrelse/høyde/seed/zoomtrinn (kun drawImage per bilde),
// gulv, grøfter, kanter, tanker og rørgater bakes i gulvlaget ved lasting (tegnes aldri over figurer), lys via lightStyle/lightmapPool.
// Geometri fra PROJ (shared/projection.js): løft L = H·zScale. Nord–sør-stykker (h > w) bruker samme flate juks som paintNSBarrier v4:
// toppen senkes 60 % av fronten, bare 40 % lav sørkant, ingen sideflate → leses aldri som søyler. Ingen shadowBlur, ingen ctx.filter.
import { PROJ as PROJ0 } from '../shared/projection.js';
import { LIGHT_DIR, shadowOffset } from '../shared/light.js';

const TAU = Math.PI * 2;
const KINDS = { pipes: 'pipes', pipebundle: 'pipes', valve: 'valve', valvebox: 'valve', plinth: 'plinth', foundation: 'plinth' };
export function canDrawRefinery(kind) { return !!KINDS[kind]; }
const LW = Math.max(0, -LIGHT_DIR.x), LN = Math.max(0, -LIGHT_DIR.y);
function rng(seed) { let a = (seed >>> 0) || 1; const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.r = (a, b) => a + f() * (b - a); f.i = (a, b) => Math.floor(a + f() * (b - a + 1)); return f; }
function canvas(w, h) { w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h)); if (typeof OffscreenCanvas !== 'undefined') { try { return new OffscreenCanvas(w, h); } catch (e) { /* */ } } const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const step = (s) => Math.pow(2, Math.max(-2, Math.min(3, Math.round(Math.log2(Math.max(1e-3, s)) * 2) / 2)));
const tint = (c, k) => c.map((v) => v * k);
const rgb = (c, k = 0, a = 1) => `rgba(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + k))))).join(',')},${a})`;
function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
function speckle(c, R, x, y, w, h, n, col, a0, a1, s0 = 0.4, s1 = 1.4) { for (let i = 0; i < n; i++) { c.fillStyle = rgb(col, 0, R.r(a0, a1)); const s = R.r(s0, s1); c.fillRect(x + R() * w, y + R() * h, s, s * R.r(0.5, 1)); } }
function blot(c, x, y, r, col, a, sy = 1) { if (r <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.save(); c.translate(x, y); c.scale(1, sy); c.translate(-x, -y); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
function hazard(c, x, y, w, h, s) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#b48b22'; c.fillRect(x, y, w, h); c.fillStyle = '#1b1a17'; for (let i = -h - s * 2; i < w + h; i += s * 2) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + s, y + h); c.lineTo(x + i + s + h, y); c.lineTo(x + i + h, y); c.fill(); } c.fillStyle = 'rgba(40,30,20,0.4)'; c.fillRect(x, y, w, h); c.restore(); }

// paletter (mørke, kalde, skitne – samme toneområde som betongen i cover.js: topp ca. 80–90)
const STEEL = [78, 82, 84], RUST = [92, 52, 30], CON = [104, 107, 110], PAINT = [[70, 82, 70], [96, 84, 52], [60, 66, 74]];

// ---- rør: sylinderbånd. Langs x (horiz) eller langs y. a = båndets tykkelse (skjermrom), col = farge
function pipeBand(c, R, x, y, len, a, col, horiz, ins) {
  const g = horiz ? grad(c, 0, y, 0, y + a, [[0, rgb(col, -0.55)], [0.18, rgb(col, 0.1 + 0.15 * LN)], [0.32, rgb(col, 0.22)], [0.6, rgb(col, -0.12)], [1, rgb(col, -0.6)]])
                  : grad(c, x, 0, x + a, 0, [[0, rgb(col, -0.5)], [0.2, rgb(col, 0.12 + 0.15 * LW)], [0.34, rgb(col, 0.2)], [0.62, rgb(col, -0.15)], [1, rgb(col, -0.6)]]);
  c.fillStyle = g; if (horiz) c.fillRect(x, y, len, a); else c.fillRect(x, y, a, len);
  c.fillStyle = 'rgba(235,230,215,0.22)'; if (horiz) c.fillRect(x, y + a * 0.24, len, Math.max(0.4, a * 0.07)); else c.fillRect(x + a * 0.26, y, Math.max(0.4, a * 0.07), len);   // speilglans
  c.fillStyle = 'rgba(0,0,0,0.35)'; if (horiz) c.fillRect(x, y + a * 0.86, len, a * 0.14); else c.fillRect(x + a * 0.86, y, a * 0.14, len);   // kjernemørke
  // flenser / kledningsskjøter
  const sp = ins ? R.r(10, 14) : R.r(36, 56);
  for (let u = R.r(4, sp); u < len - 2; u += sp * R.r(0.85, 1.15)) {
    if (ins) { c.fillStyle = 'rgba(0,0,0,0.35)'; if (horiz) c.fillRect(x + u, y, 0.6, a); else c.fillRect(x, y + u, a, 0.6); continue; }
    c.fillStyle = rgb(col, -0.35); if (horiz) c.fillRect(x + u - 1.4, y - 0.6, 2.8, a + 1.2); else c.fillRect(x - 0.6, y + u - 1.4, a + 1.2, 2.8);
    c.fillStyle = rgb(col, 0.25); if (horiz) c.fillRect(x + u - 1.4, y + a * 0.22, 0.6, a * 0.25); else c.fillRect(x + a * 0.22, y + u - 1.4, a * 0.25, 0.6);
  }
  // rust og skitt (renner nedover/sørover)
  c.save(); c.beginPath(); if (horiz) c.rect(x, y, len, a); else c.rect(x, y, a, len); c.clip();
  for (let i = 0; i < len / 9; i++) { const u = R() * len; c.fillStyle = `rgba(${R() < 0.6 ? '96,50,24' : '24,20,16'},${R.r(0.15, 0.4)})`; if (horiz) c.fillRect(x + u, y + a * R.r(0.35, 0.7), R.r(1, 5), a * R.r(0.2, 0.6)); else c.fillRect(x + a * R.r(0.3, 0.8), y + u, a * R.r(0.15, 0.4), R.r(1, 5)); }
  speckle(c, R, x, y, horiz ? len : a, horiz ? a : len, Math.round(len * a / 8), [30, 26, 22], 0.1, 0.35);
  c.restore();
}
function pipeCols(R) { const pick = () => { const r = R(); return r < 0.45 ? tint(STEEL, R.r(0.85, 1.05)) : r < 0.75 ? tint(PAINT[Math.floor(R() * 3)], R.r(0.85, 1.0)) : tint(RUST, R.r(0.85, 1.05)); }; return pick; }

// Hver maler får (c, R, S): S = { w, d, f, g, horiz, dw, hz }. Ø–V: topp y ∈ [0,d], front [d, d+f]. N–S: topp [y0, y0+d], lav sørkant fe.
function paintPipes(c, R, S) {
  const { w, d, f, g, horiz } = S, pick = pipeCols(R);
  if (horiz) {
    // støtter (betongsviller) under rørene, synlige i fronten
    for (let u = R.r(6, 14); u < w - 6; u += R.r(40, 56)) { c.fillStyle = grad(c, 0, d + f * 0.5, 0, d + f, [[0, rgb(CON, -0.3)], [1, rgb(CON, -0.5)]]); c.fillRect(u, d + f * 0.45, 9, f * 0.55); c.fillStyle = rgb(CON, -0.05); c.fillRect(u, d + f * 0.4, 9, f * 0.08); }
    // to lag: tre nedre rør (bak → fram), to øvre i rillene
    const tot = d + f, n = 3, a = tot / n * 1.08, ins = R() < 0.3;
    for (let k = 0; k < n; k++) { const y = k * (tot - a) / (n - 1) + f * 0.12; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, y + a * 0.85, w, a * 0.25); pipeBand(c, R, 0, y, w, a * 0.92, pick(), true, ins && k === 1); }
    const a2 = a * 0.9; for (let k = 0; k < 2; k++) { const y = (k + 0.5) * (tot - a) / (n - 1) - f * 0.35 + f * 0.12; c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(2, y + a2 * 0.8, w - 4, a2 * 0.3); pipeBand(c, R, 2, y, w - 4, a2 * 0.92, pick(), true, false); }
    // rørender mot vest/øst: mørke åpne ender eller blindflens
    for (const ex of [0, w]) if (R() < 0.6) { c.fillStyle = 'rgba(10,9,8,0.8)'; c.fillRect(ex - (ex ? 1.5 : 0), f * 0.12, 1.5, tot - f * 0.12); }
  } else {
    const y0 = f * 0.6, fe = f * 0.4, n = Math.max(2, Math.min(4, Math.round(w / 9))), a = w / n;
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(w, y0 + 1, 3, d + fe);   // kort sideskygge (som N–S-barrieren)
    for (let u = R.r(6, 14); u < d - 4; u += R.r(40, 56) * g) { c.fillStyle = rgb(CON, -0.35); c.fillRect(-1, y0 + u, w + 2, 4 * g + 1); }
    for (let k = 0; k < n; k++) pipeBand(c, R, k * a, y0, d + fe * 0.3, a * 0.94, pick(), false, R() < 0.2);
    // sørender: lave sirkler (flens/åpning) i den lave sørkanten
    for (let k = 0; k < n; k++) { const cx = k * a + a * 0.47, cy = y0 + d + fe * 0.45, r = a * 0.44; c.fillStyle = rgb(STEEL, -0.2); c.beginPath(); c.ellipse(cx, cy, r, fe * 0.5, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(8,8,8,0.85)'; c.beginPath(); c.ellipse(cx, cy, r * 0.62, fe * 0.32, 0, 0, TAU); c.fill(); }
  }
}
function paintValve(c, R, S) {
  const { w, d, f, g, horiz } = S, y0 = horiz ? 0 : f * 0.6, F = horiz ? f : f * 0.4, BOX = tint(PAINT[Math.floor(R() * 3)], R.r(0.72, 0.85)), ix = 1, W = w - 2, bv = Math.min(2.6, W * 0.08);
  // topp: fasede kanter (lys NV, mørk SØ) rundt en innfelt plate
  c.fillStyle = rgb(BOX, -0.05); c.fillRect(ix, y0, W, d);
  c.fillStyle = rgb(BOX, 0.18 + 0.1 * LN); c.beginPath(); c.moveTo(ix, y0); c.lineTo(ix + W, y0); c.lineTo(ix + W - bv, y0 + bv * g); c.lineTo(ix + bv, y0 + bv * g); c.lineTo(ix + bv, y0 + d - bv * g); c.lineTo(ix, y0 + d); c.fill();
  c.fillStyle = rgb(BOX, -0.38); c.beginPath(); c.moveTo(ix + W, y0); c.lineTo(ix + W, y0 + d); c.lineTo(ix, y0 + d); c.lineTo(ix + bv, y0 + d - bv * g); c.lineTo(ix + W - bv, y0 + d - bv * g); c.lineTo(ix + W - bv, y0 + bv * g); c.fill();
  c.fillStyle = grad(c, ix, y0, ix + W, y0 + d, [[0, rgb(BOX, 0.06)], [1, rgb(BOX, -0.16)]]); c.fillRect(ix + bv, y0 + bv * g, W - bv * 2, d - bv * 2 * g);
  // bolter i hjørnene (hode + skygge)
  for (const [bx, by] of [[ix + bv * 1.6, y0 + bv * 1.6 * g], [ix + W - bv * 1.6, y0 + bv * 1.6 * g], [ix + bv * 1.6, y0 + d - bv * 1.6 * g], [ix + W - bv * 1.6, y0 + d - bv * 1.6 * g]]) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.ellipse(bx + 0.5, by + 0.5 * g, 1.1, 1.1 * g, 0, 0, TAU); c.fill(); c.fillStyle = rgb(STEEL, 0.25); c.beginPath(); c.ellipse(bx, by, 0.9, 0.9 * g, 0, 0, TAU); c.fill(); }
  // hevet ratt: spindelhus, kastet skygge, tykk felg med lys/mørk side, eiker, nav
  const nW = horiz ? Math.max(1, Math.round(w / 40)) : Math.max(1, Math.round(S.dw / 40)), up = Math.min(F * 0.5, 6 * g);
  for (let i = 0; i < nW; i++) {
    const cx = horiz ? ix + W * (i + 0.5) / nW : ix + W / 2, cy0 = horiz ? y0 + d / 2 : y0 + d * (i + 0.5) / nW, r = Math.min(horiz ? W / nW : W, horiz ? d / g : d / nW / g) * 0.36, cy = cy0 - up;
    blot(c, cx + 2.2, cy0 + 1.6 * g, r * 1.25, '0,0,0', 0.55, g);
    c.fillStyle = grad(c, cx - 2, 0, cx + 2, 0, [[0, rgb(STEEL, 0.15)], [1, rgb(STEEL, -0.45)]]); c.fillRect(cx - 1.8, cy, 3.6, up + 0.5);   // spindel
    const RIM = [96, 38, 26]; c.lineWidth = Math.max(1.4, r * 0.28);
    c.strokeStyle = rgb(RIM, -0.45); c.beginPath(); c.ellipse(cx + 0.4, cy + 0.5, r, r * g, 0, 0, TAU); c.stroke();
    c.strokeStyle = rgb(RIM, -0.05); c.beginPath(); c.ellipse(cx, cy, r, r * g, 0, 0, TAU); c.stroke();
    c.lineWidth = Math.max(0.5, r * 0.09); c.strokeStyle = 'rgba(230,170,140,0.45)'; c.beginPath(); c.ellipse(cx, cy, r, r * g, 0, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
    c.lineWidth = Math.max(0.7, r * 0.12); c.strokeStyle = rgb(RIM, -0.3); for (let s = 0; s < 3; s++) { const an = s * Math.PI / 3 + R() * 0.3; c.beginPath(); c.moveTo(cx - Math.cos(an) * r, cy - Math.sin(an) * r * g); c.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r * g); c.stroke(); }
    c.fillStyle = rgb(STEEL, 0.2); c.beginPath(); c.ellipse(cx, cy, r * 0.22, r * 0.22 * g, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(cx + 0.3, cy + 0.2, r * 0.08, r * 0.08 * g, 0, 0, TAU); c.fill();
    for (let k = 0; k < 4; k++) if (R() < 0.6) { c.fillStyle = 'rgba(70,40,22,0.6)'; const an = R() * TAU; c.fillRect(cx + Math.cos(an) * r - 0.6, cy + Math.sin(an) * r * g - 0.4, 1.4, 0.9); }
  }
  c.save(); c.beginPath(); c.rect(ix, y0, W, d); c.clip(); speckle(c, R, ix, y0, W, d, Math.round(W * d / 7), [30, 28, 24], 0.12, 0.4); blot(c, ix + R() * W, y0 + R() * d, R.r(4, 9), '90,48,24', 0.35, 0.6); blot(c, ix + R() * W, y0 + R() * d, R.r(5, 10), '14,12,10', 0.35, 0.6); c.restore();
  // front: synlig flate med kantlist, dør/luker, hengsler, rustrenner og skitt nederst
  const fy = y0 + d; c.fillStyle = grad(c, 0, fy, 0, fy + F, [[0, rgb(BOX, -0.2)], [1, rgb(BOX, -0.5)]]); c.fillRect(ix, fy, W, F);
  c.fillStyle = rgb(BOX, 0.1); c.fillRect(ix, fy, W, 0.8); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(ix, fy + 0.8, W, 0.5);
  if (horiz) { const dw = Math.min(W * 0.4, 16); for (const dx of nW > 1 ? [ix + 3, ix + W - dw - 3] : [ix + (W - dw) / 2]) { c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.7; c.strokeRect(dx, fy + F * 0.18, dw, F * 0.62); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(dx, fy + F * 0.18, dw, 0.5); for (let x = dx + 2; x < dx + dw - 2; x += 2.2) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, fy + F * 0.3, 1, F * 0.18); } c.fillStyle = rgb(STEEL, 0.1); c.fillRect(dx + dw - 2.5, fy + F * 0.5, 1.4, F * 0.14); } if (S.hz) hazard(c, ix + 1, fy + F * 0.84, W - 2, F * 0.12, 1.4); }
  else if (S.hz) hazard(c, ix + 1.5, fy + F * 0.2, W - 3, F * 0.5, 1.2);
  for (let q = 0; q < W / 5; q++) if (R() < 0.7) { c.fillStyle = `rgba(${R() < 0.7 ? '92,48,22' : '20,16,12'},${R.r(0.25, 0.5)})`; c.fillRect(ix + R() * W, fy + R.r(0, 0.3) * F, R.r(0.6, 1.4), F * R.r(0.3, 0.7)); }
  c.fillStyle = grad(c, 0, fy + F * 0.5, 0, fy + F, [[0, 'rgba(60,38,20,0)'], [1, 'rgba(50,34,20,0.6)']]); c.fillRect(ix, fy + F * 0.5, W, F * 0.5);
  for (const sx of [-1, 1]) if (R() < 0.7) { const py = horiz ? fy - d * 0.35 : y0 + d * 0.5; pipeBand(c, R, sx < 0 ? -3 : w - 1, py, 4, Math.max(3, d * 0.3), STEEL, true, false); }
  if (!horiz) { c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(w, y0 + 1, 3, d + F); }
}
function paintPlinth(c, R, S) {
  const { w, d, f, g, horiz } = S, y0 = horiz ? 0 : f * 0.6, F = horiz ? f : f * 0.4, C = tint([96, 97, 98], R.r(0.6, 0.68)), ch = Math.min(2.2, F * 0.15);
  c.fillStyle = grad(c, 0, y0, w, y0 + d, [[0, rgb(C, 0.02 + 0.05 * LW)], [1, rgb(C, -0.1)]]); c.fillRect(0, y0, w, d);
  c.fillStyle = rgb(C, 0.08); c.fillRect(0, y0, w, 0.7); c.fillRect(0, y0, 0.7, d);   // svak fas nord/vest
  c.save(); c.beginPath(); c.rect(0, y0, w, d); c.clip(); for (let i = 0; i < 4; i++) blot(c, R() * w, y0 + R() * d, R.r(6, 16), R() < 0.5 ? '20,18,15' : '60,40,24', R.r(0.25, 0.45), 0.6); for (let i = 0; i < w / 10; i++) { c.fillStyle = 'rgba(30,26,22,0.25)'; c.fillRect(R() * w, y0 + d * R.r(0.5, 0.9), R.r(1, 3), d * R.r(0.1, 0.4)); } c.restore();
  // fuger: én seksjon per ~2 felt
  const n = Math.max(1, Math.round((horiz ? w : S.dw) / 64)); for (let j = 1; j < n; j++) { c.fillStyle = 'rgba(8,8,8,0.8)'; if (horiz) c.fillRect(j * w / n - 0.6, y0, 1.2, d + F); else c.fillRect(0, y0 + j * d / n - 0.6, w, 1.2); }
  // ankerbolter + rustne bunnplaterester (fundament for fjernet utstyr)
  for (let j = 0; j < n; j++) { const bx = horiz ? (j + 0.5) * w / n : w / 2, by = horiz ? y0 + d / 2 : y0 + (j + 0.5) * d / n, pw = Math.min(horiz ? w / n : w, 22) * 0.5, ph = Math.min(horiz ? d : d / n, 22 * g) * 0.45;
    if (R() < 0.6) { c.fillStyle = rgb(RUST, -0.2, 0.75); c.fillRect(bx - pw, by - ph, pw * 2, ph * 2); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(bx - pw, by + ph - 0.6, pw * 2, 0.6); }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = bx + sx * pw * 0.8, py = by + sy * ph * 0.75; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(px - 0.6, py, 2, 1.2 * g + 0.4); c.fillStyle = rgb(STEEL, 0.1); c.fillRect(px - 0.6, py - 0.6, 1.3, 1.3); } }
  c.save(); c.beginPath(); c.rect(0, y0, w, d); c.clip(); speckle(c, R, 0, y0, w, d, Math.round(w * d / 8), [40, 40, 40], 0.12, 0.4);
  for (let i = 0; i < 2; i++) blot(c, R() * w, y0 + R() * d, R.r(5, 12), '14,12,10', R.r(0.35, 0.6), 0.6);   // olje
  c.restore();
  for (let q = 0; q < 5; q++) if (R() < 0.7) { c.fillStyle = rgb(C, -0.5, 0.9); const cx = R() * w, cy = y0 + d; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R.r(2, 5), cy); c.lineTo(cx + R.r(0, 3), cy + R.r(1, 2.5)); c.fill(); }   // avskalling
  const fy = y0 + d; c.fillStyle = rgb(C, -0.05); c.fillRect(0, fy, w, ch);
  c.fillStyle = grad(c, 0, fy + ch, 0, fy + F, [[0, rgb(C, -0.22)], [1, rgb(C, -0.46)]]); c.fillRect(0, fy + ch, w, F - ch);
  speckle(c, R, 0, fy, w, F, Math.round(w * F / 7), [30, 30, 30], 0.15, 0.5);
  c.fillStyle = grad(c, 0, fy + F * 0.4, 0, fy + F, [[0, 'rgba(50,36,24,0)'], [1, 'rgba(50,36,24,0.6)']]); c.fillRect(0, fy + F * 0.4, w, F * 0.6);
  if (S.hz && horiz) hazard(c, w - Math.min(14, w * 0.3) - 2, fy + F * 0.25, Math.min(14, w * 0.3), F * 0.3, 1.8);
  if (!horiz) { c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(w, y0 + 1, 3, d + F); }
}
const PAINTERS = { pipes: paintPipes, valve: paintValve, plinth: paintPlinth };

function heightOf(o, P) { return o.height ?? (o.elev != null ? o.elev / P.zScale : P.heights.low); }
const seedOf = (o) => (o.seed ?? ((o.id ?? 0) * 7919 + Math.round(o.x) * 31 + Math.round(o.y) * 17)) >>> 0;
const cache = new Map(); let cacheBytes = 0; const MAX_BYTES = 96e6;
function build(kind, o, H, P, qx, qy, seed) {
  const lift = H * P.zScale, g = qy / qx, horiz = o.w >= o.h, so = shadowOffset(H);
  const PL = 4, PT = 3, PR = Math.ceil(Math.max(0, so.x)) + 6, PB = Math.ceil(Math.max(0, so.y)) + 5;
  const d = o.h * g, f = lift * g, cv = canvas(Math.min(4096, (o.w + PL + PR) * qx), Math.min(4096, (o.h + lift + PT + PB) * qy)), c = cv.getContext('2d'), R = rng(seed);
  c.scale(qx, qx); c.translate(PL, PT * g);
  const S = { w: o.w, d, f, g, H, dw: o.h, horiz, hz: R() < 0.6 };
  // kontaktskygge (myk, i bakkeplanet) – N–S: bare smal (som N–S-barrieren), så de ikke får en «høy» skygge
  const fy0 = f, sx = Math.min(horiz ? 6 : 2.5, so.x), sy = Math.min(horiz ? 6 : 2.5, so.y) * g;
  for (let q = 4; q >= 0; q--) { const e = q * 1.1; c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.moveTo(-e * 0.3, fy0); c.lineTo(o.w + sx + e, fy0 + sy); c.lineTo(o.w + sx + e, fy0 + d + sy + e * g); c.lineTo(sx - e * 0.4, fy0 + d + sy + e * g); c.lineTo(-e * 0.3, fy0 + d); c.closePath(); c.fill(); }
  c.fillStyle = grad(c, 0, d + f - 1, 0, d + f + 3 * g, [[0, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(-1.5, d + f - 1, o.w + 3, 3 * g + 1);
  PAINTERS[kind](c, R, S);
  c.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 3; i++) blot(c, R() * o.w, R() * (d + f), R.r(4, 10), '28,24,20', R.r(0.1, 0.22), 0.6); c.globalCompositeOperation = 'source-over';
  return { c: cv, pl: PL, pt: PT, pr: PR, pb: PB, lift, bytes: cv.width * cv.height * 4 };
}
function sprite(kind, o, H, P, sx, sy) {
  const qx = step(sx), qy = qx * step(sy / Math.max(1e-6, sx) * 4) / 4, seed = seedOf(o), key = `${kind}|${o.w}|${o.h}|${H}|${seed}|${qx}|${qy}|${P.zScale.toFixed(4)}`;
  let s = cache.get(key);
  if (!s) { s = build(kind, o, H, P, qx, qy, seed); cache.set(key, s); cacheBytes += s.bytes; while (cacheBytes > MAX_BYTES && cache.size > 1) { const k = cache.keys().next().value; cacheBytes -= cache.get(k).bytes; cache.delete(k); } }
  return s;
}
/** Samme kallformer som drawLowCover: (ctx, o, env{PROJ,part?}) eller (ctx, o, world, camera, opts{part?}). Returnerer true hvis typen er vår. */
export function drawRefineryCover(ctx, o, a3, a4, a5) {
  const kind = o && KINDS[o.kind ?? o.type]; if (!kind) return false;
  const P = (a3 && a3.PROJ) || (a3 && a3.world && a3.world.PROJ) || PROJ0, part = a3 && a3.PROJ ? a3.part : a5 && a5.part, H = heightOf(o, P);
  const m = ctx.getTransform(), s = sprite(kind, o, H, P, Math.hypot(m.a, m.b) || 1, Math.hypot(m.c, m.d) || 1);
  const L = s.lift, img = s.c, iw = img.width, ih = img.height, ww = o.w + s.pl + s.pr, wh = o.h + L + s.pt + s.pb, x = o.x - s.pl, y = o.y - L - s.pt;
  if (!part) ctx.drawImage(img, x, y, ww, wh);
  else { const cut = (s.pt + o.h) / wh; if (part === 'top' || part === 'back') ctx.drawImage(img, 0, 0, iw, ih * cut, x, y, ww, wh * cut); else ctx.drawImage(img, 0, ih * cut, iw, ih * (1 - cut), x, y + wh * cut, ww, wh * (1 - cut)); }
  return true;
}
export function warmRefinerySprites(world, zooms = [1, 2, 4]) {
  const P = (world && world.PROJ) || PROJ0, list = (world && (world.level?.objects || world.objects || world.covers)) || []; let n = 0;
  for (const o of list) { const k = KINDS[o.kind ?? o.type]; if (!k) continue; for (const z of zooms) { sprite(k, o, heightOf(o, P), P, z, z * (P.groundScaleY || 1)); n++; } } return n;
}
export function _refineryCacheStats() { return { sprites: cache.size, mb: +(cacheBytes / 1e6).toFixed(1) }; }

// =====================================================================================  GULVLAGET (bakes ved lasting)
// L = { width, height, tile, seed, grates:[{x,y,w,h}], trenches:[{x,y,w,h}], objects } (verdens-px). Returnerer true (Arena hopper over drawFloor/drawPaint).
function noise(w, h, R, dark, light, a = 255) { const c = canvas(w, h), x = c.getContext('2d'), id = x.createImageData(c.width, c.height); for (let i = 0; i < id.data.length; i += 4) { const v = R(); const col = v < 0.5 ? dark : light; id.data[i] = col[0]; id.data[i + 1] = col[1]; id.data[i + 2] = col[2]; id.data[i + 3] = Math.abs(v - 0.5) * 2 * a; } x.putImageData(id, 0, 0); return c; }
export const REFINERY_FLOOR = Object.freeze({ base: '#33332f', oil: '12,10,8', yellow: [176, 146, 52] });
export function bakeRefineryFloor(ctx, L, rng0) {
  if (!L || !L.width) return false;
  const W = L.width, H = L.height, T = L.tile || 32, R = rng((L.seed ?? 11) * 2654435761);
  ctx.save(); ctx.fillStyle = REFINERY_FLOOR.base; ctx.fillRect(0, 0, W, H); ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.5; ctx.drawImage(noise(W / 64, H / 64, R, [14, 14, 13], [66, 66, 62]), 0, 0, W, H);
  ctx.globalAlpha = 0.3; ctx.drawImage(noise(W / 12, H / 12, R, [16, 15, 14], [70, 70, 66]), 0, 0, W, H); ctx.globalAlpha = 1;
  // betongplater (4×4 felt) med ekspansjonsfuger og svak toneforskjell per plate
  const PS = T * 4; for (let y = 0; y < H; y += PS) for (let x = 0; x < W; x += PS) { ctx.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '90,90,84'},${R.r(0.03, 0.09)})`; ctx.fillRect(x, y, PS, PS); }
  ctx.fillStyle = 'rgba(6,6,6,0.55)'; for (let x = PS; x < W; x += PS) ctx.fillRect(x - 0.7, 0, 1.4, H); for (let y = PS; y < H; y += PS) ctx.fillRect(0, y - 0.7, W, 1.4);
  ctx.fillStyle = 'rgba(150,150,140,0.06)'; for (let x = PS; x < W; x += PS) ctx.fillRect(x + 0.7, 0, 0.6, H); for (let y = PS; y < H; y += PS) ctx.fillRect(0, y + 0.7, W, 0.6);
  // korn i pikselrom
  const m = ctx.getTransform(), gw = Math.ceil(W * m.a), gh = Math.ceil(H * m.d);
  { const gc = canvas(gw, gh), gx = gc.getContext('2d'), id = gx.createImageData(gc.width, gc.height), d = id.data; let s = ((L.seed ?? 11) >>> 0) || 7;
    for (let i = 0; i < d.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const r = s / 4294967296, c = r < 0.5 ? 0 : 190; d[i] = c + (c ? 6 : 0); d[i + 1] = c; d[i + 2] = c - (c ? 8 : 0); d[i + 3] = r < 0.03 || r > 0.975 ? 60 : Math.abs(r - 0.5) * 26; }
    gx.putImageData(id, 0, 0); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(gc, 0, 0); ctx.restore(); }
  // oljeflekker: store mørke søl (flere lag, brun-svart kjerne, svak regnbuehinne i kanten), drypp og slepespor
  for (let i = 0; i < W * H / 26000; i++) { const x = R() * W, y = R() * H, r = R.r(14, 46);
    for (let k = 0; k < 6; k++) blot(ctx, x + R.r(-r, r) * 0.6, y + R.r(-r, r) * 0.4, r * R.r(0.4, 0.9), REFINERY_FLOOR.oil, R.r(0.25, 0.45), R.r(0.5, 0.9));
    if (R() < 0.5) blot(ctx, x + r * 0.3, y, r * 0.8, R() < 0.5 ? '60,40,70' : '40,70,60', 0.05, 0.5); blot(ctx, x - r * 0.2, y - r * 0.15, r * 0.35, '90,95,100', 0.06, 0.5); }
  ctx.lineCap = 'round'; for (let i = 0; i < W * H / 60000; i++) { let x = R() * W, y = R() * H, a = R() * TAU; ctx.strokeStyle = 'rgba(10,8,6,0.22)'; ctx.lineWidth = R.r(2, 5); ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { a += R.r(-0.3, 0.3); x += Math.cos(a) * 14; y += Math.sin(a) * 14; ctx.lineTo(x, y); } ctx.stroke(); }
  // sprekker
  for (let i = 0; i < W * H / 9000; i++) { let x = R() * W, y = R() * H, a = R() * TAU; const n = R.i(4, 12); ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < n; k++) { a += R.r(-0.8, 0.8); const l = R.r(3, 10); x += Math.cos(a) * l; y += Math.sin(a) * l; ctx.lineTo(x, y); } ctx.strokeStyle = 'rgba(3,3,3,0.65)'; ctx.lineWidth = R.r(0.5, 1.2); ctx.stroke(); }
  // rust fra stål og avløpssluk
  for (let i = 0; i < W * H / 40000; i++) blot(ctx, R() * W, R() * H, R.r(10, 26), '84,46,22', R.r(0.08, 0.16), 0.7);
  for (let i = 0; i < W * H / 120000; i++) drain(ctx, R, R.r(T, W - T), R.r(T, H - T));
  // gangfelt: slitt gul linjemaling langs L.paint.lanes (felt-koordinater)
  for (const ln of (L.paint && L.paint.lanes) || []) { ctx.strokeStyle = rgb(REFINERY_FLOOR.yellow, -0.05, 0.6); ctx.lineWidth = 2.6; ctx.setLineDash([22, 9]); ctx.beginPath(); ln.forEach(([x, y], k) => (k ? ctx.lineTo(x * T, y * T) : ctx.moveTo(x * T, y * T))); ctx.stroke(); ctx.setLineDash([]); }
  for (const gr of L.grates || []) drawGrate(ctx, R, gr);
  for (const tr of L.trenches || []) drawTrench(ctx, R, tr);
  // småskrot (bolter, muttere, sveiseslagg)
  for (let i = 0; i < W * H / 900; i++) { const x = R() * W, y = R() * H, r = R.r(0.5, 1.8); ctx.fillStyle = R() < 0.6 ? 'rgba(0,0,0,0.5)' : 'rgba(170,165,150,0.12)'; ctx.fillRect(x, y, r, r * R.r(0.5, 1.4)); }
  ctx.restore(); return true;
}
function drain(ctx, R, x, y) { blot(ctx, x, y, 14, '8,8,8', 0.5, 0.8); ctx.fillStyle = '#1a1b1b'; ctx.fillRect(x - 7, y - 5, 14, 10); ctx.fillStyle = '#060606'; for (let i = -5; i < 6; i += 2.5) ctx.fillRect(x + i - 0.6, y - 4, 1.2, 8); ctx.strokeStyle = 'rgba(120,118,110,0.4)'; ctx.lineWidth = 0.8; ctx.strokeRect(x - 7, y - 5, 14, 10); }
/** Metallrist (gangbar, bakkenivå): mørk sjakt under, synlige rør, stålramme og tette bærestaver. */
export function drawGrate(ctx, R, gr) {
  R = typeof R === 'function' && R.r ? R : rng(Math.round(gr.x * 7 + gr.y * 13)); const { x, y, w, h } = gr;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#0b0c0c'; ctx.fillRect(x, y, w, h);
  for (let k = 0; k < 2; k++) { const py = y + h * (0.3 + k * 0.4); ctx.fillStyle = grad(ctx, 0, py - 4, 0, py + 4, [[0, 'rgba(40,40,38,0)'], [0.4, 'rgba(58,56,52,0.9)'], [1, 'rgba(10,10,10,0.9)']]); ctx.fillRect(x, py - 4, w, 8); }   // rør i sjakta
  blot(ctx, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.6, '30,40,34', 0.25, 0.5);
  // stavgitter: bærestaver langs lengste akse + tverrstaver
  const along = w >= h; ctx.fillStyle = 'rgba(92,94,92,0.95)';
  if (along) { for (let v = y + 1.5; v < y + h; v += 3) ctx.fillRect(x, v, w, 1.1); ctx.fillStyle = 'rgba(70,72,70,0.9)'; for (let u = x + 4; u < x + w; u += 12) ctx.fillRect(u, y, 0.8, h); }
  else { for (let u = x + 1.5; u < x + w; u += 3) ctx.fillRect(u, y, 1.1, h); ctx.fillStyle = 'rgba(70,72,70,0.9)'; for (let v = y + 4; v < y + h; v += 12) ctx.fillRect(x, v, w, 0.8); }
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; if (along) for (let v = y + 1.5; v < y + h; v += 3) ctx.fillRect(x, v, w, 0.35); else for (let u = x + 1.5; u < x + w; u += 3) ctx.fillRect(u, y, 0.35, h);
  for (let i = 0; i < w * h / 300; i++) blot(ctx, x + R() * w, y + R() * h, R.r(4, 12), R() < 0.6 ? '86,46,22' : '10,9,8', R.r(0.2, 0.4), 0.6);   // rust/olje
  // panelskjøter + stålramme
  const pw = 64; ctx.fillStyle = 'rgba(0,0,0,0.6)'; if (along) for (let u = x + pw; u < x + w; u += pw) ctx.fillRect(u - 0.8, y, 1.6, h); else for (let v = y + pw; v < y + h; v += pw) ctx.fillRect(x, v - 0.8, w, 1.6);
  ctx.restore();
  ctx.strokeStyle = '#2a2b2a'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); ctx.strokeStyle = 'rgba(140,138,128,0.25)'; ctx.lineWidth = 0.7; ctx.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
}
/** Rørgrøft: nedsenket kanal i gulvet (under gulvnivå → dekker aldri figurer), rør langs grøfta, oljevann i bunnen. Kantene tegnes av drawTrenchEdge. */
export function drawTrench(ctx, R, tr) {
  R = typeof R === 'function' && R.r ? R : rng(Math.round(tr.x * 5 + tr.y * 11)); const { x, y, w, h } = tr, along = w >= h, P = PROJ0, wall = Math.min(along ? h : w, 10 * P.zScale) * 0.55;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#0d0e0d'; ctx.fillRect(x, y, w, h);
  // nordveggen (synlig fra kameraet, under gulvnivå): betong mot mørkt
  if (along) { ctx.fillStyle = grad(ctx, 0, y, 0, y + wall, [[0, '#3c3c38'], [1, '#141414']]); ctx.fillRect(x, y, w, wall); for (let u = x + R.r(10, 30); u < x + w; u += R.r(30, 50)) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(u, y, 1, wall); } }
  else { ctx.fillStyle = grad(ctx, x, 0, x + wall * 0.6, 0, [[0, '#30302d'], [1, '#121212']]); ctx.fillRect(x, y, wall * 0.6, h); }
  // bunn: oljevann med svak kald glans
  const bx = along ? x : x + wall * 0.6, by = along ? y + wall : y, bw = along ? w : w - wall * 0.6, bh = along ? h - wall : h;
  ctx.fillStyle = '#121615'; ctx.fillRect(bx, by, bw, bh);
  for (let i = 0; i < bw * bh / 200; i++) { ctx.fillStyle = `rgba(150,170,160,${R.r(0.04, 0.12)})`; ctx.fillRect(bx + R() * bw, by + R() * bh, along ? R.r(3, 10) : 0.6, along ? 0.6 : R.r(3, 10)); }
  for (let i = 0; i < bw * bh / 900; i++) blot(ctx, bx + R() * bw, by + R() * bh, R.r(5, 14), R() < 0.5 ? '60,40,70' : '40,70,60', 0.07, 0.5);
  // rør langs grøfta (på konsoller)
  const n = Math.max(1, Math.round((along ? bh : bw) / 14)); const pick = pipeCols(R);
  for (let k = 0; k < n; k++) { const a = Math.min(8, (along ? bh : bw) / n * 0.7), off = (k + 0.5) * (along ? bh : bw) / n - a / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; if (along) ctx.fillRect(bx, by + off + a * 0.8, bw, a * 0.4); else ctx.fillRect(bx + off + a * 0.8, by, a * 0.4, bh);
    pipeBand(ctx, R, along ? bx : bx + off, along ? by + off : by, along ? bw : bh, a, tint(pick(), 0.7), along, false); }
  ctx.restore(); return true;
}
/** Kant/rekkverk mot grøft – FLATT i gulvlaget (som drawEdge): stålvinkel + gul-svart kant + liggende rekkverk-«skygge», stolpefester.
 *  e = { kind:'trench'|'rail', x0,y0,x1,y1, side:'n'|'s'|'e'|'w' } (side = retningen grøfta ligger). Tegnes aldri over figurer. */
export function drawTrenchEdge(ctx, L, e, rng0) {
  if (!e || !/^(trench|rail)$/.test(e.kind)) return false;
  const R = rng(Math.round(e.x0 * 3 + e.y0 * 7 + 1)), horiz = e.side === 's' || e.side === 'n', sgn = e.side === 's' || e.side === 'e' ? 1 : -1, len = horiz ? e.x1 - e.x0 : e.y1 - e.y0; if (len <= 0) return false;
  ctx.save(); const M = ctx.getTransform(); ctx.setTransform(M.multiply(horiz ? new DOMMatrix([1, 0, 0, sgn, e.x0, e.y0]) : new DOMMatrix([0, 1, sgn, 0, e.x0, e.y0])));
  // v>0 = grøfta, v<0 = gulv. Stålvinkel (kantlist) v ∈ [-4, 0]
  ctx.fillStyle = grad(ctx, 0, -4, 0, 0, [[0, '#5b5c58'], [0.4, '#73736c'], [1, '#2c2d2c']]); ctx.fillRect(0, -4, len, 4);
  for (let u = R.r(4, 12); u < len; u += R.r(8, 16)) { ctx.fillStyle = `rgba(${R() < 0.6 ? '90,46,22' : '10,10,10'},${R.r(0.25, 0.5)})`; ctx.fillRect(u, -4, R.r(2, 6), 4); }
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, len, 1.2);
  // gul-svart stripe på gulvet
  const sw = 3; ctx.save(); ctx.beginPath(); ctx.rect(0, -4 - sw, len, sw); ctx.clip(); ctx.fillStyle = '#b8952c'; ctx.fillRect(0, -4 - sw, len, sw); ctx.fillStyle = '#151517';
  for (let u = -8; u < len + 8; u += 8) { ctx.beginPath(); ctx.moveTo(u, -4); ctx.lineTo(u + 4, -4); ctx.lineTo(u + 7, -4 - sw); ctx.lineTo(u + 3, -4 - sw); ctx.fill(); }
  ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < len / 5; i++) { ctx.fillStyle = `rgba(0,0,0,${R.r(0.2, 0.6)})`; ctx.fillRect(R.r(0, len), -4 - sw, R.r(1, 5), sw); } ctx.restore();
  if (e.kind === 'rail') {
    // liggende rekkverk: stolpefester (flate plater) + rekkverkets skygge kastet ned i grøfta – ingen høyde over gulvnivå
    for (let u = 6; u < len - 2; u += 40) { blot(ctx, u + 1, -2, 4, '0,0,0', 0.5); ctx.fillStyle = '#3a3b38'; ctx.fillRect(u - 2.5, -3.6, 5, 3.2); ctx.fillStyle = '#b8952c'; ctx.fillRect(u - 1.4, -2.9, 2.8, 1.9); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(u - 1.4, -2.9, 2.8, 0.5); }
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 4, len, 1.6); ctx.fillRect(0, 8, len, 1.2); for (let u = 6; u < len - 2; u += 40) ctx.fillRect(u - 0.6, 1, 1.2, 9);
  }
  ctx.restore(); return true;
}

// =====================================================================================  KANTSTYKKER (høye, bare utenfor spilleområdet, bakt i gulvlaget)
// Regel: høye stykker skal stå NORD for spilleområdet (eller ved Ø/V-kanten med høyden helt utenfor). edgeSafe sjekker det.
/** true hvis stykkets skjermutstrekning (inkl. høyde) ligger utenfor L.play = {x,y,w,h} (verdens-px). */
export function edgeSafe(L, b) { const p = L && L.play; if (!p) return true; return b.x + b.w <= p.x || b.x >= p.x + p.w || b.y + b.h <= p.y || b.y >= p.y + p.h; }
const tankBounds = (t, P = PROJ0) => { const lift = (t.height ?? 150) * P.zScale; return { x: t.x - t.r, y: t.y - t.r - lift, w: t.r * 2, h: t.r * 2 + lift }; };
/** Stor lagertank. t = { x, y (senter fotavtrykk), r (radius), height?, label?, seed? } i verdens-px. Returnerer false (tegner ikke) hvis den står i spilleområdet. */
export function drawEdgeTank(ctx, L, t) {
  const P = PROJ0, b = tankBounds(t, P); if (!edgeSafe(L, b)) return false;
  const R = rng(t.seed ?? Math.round(t.x * 3 + t.y)), lift = (t.height ?? 150) * P.zScale, { x, y, r } = t, top = y - lift, C = tint([112, 112, 104], R.r(0.78, 0.9));
  ctx.save();
  blot(ctx, x + r * 0.4, y + r * 0.3, r * 1.5, '0,0,0', 0.55, 0.8);                                               // bakkeskygge (SØ)
  ctx.fillStyle = rgb(CON, -0.35); ctx.beginPath(); ctx.ellipse(x, y + 3, r + 6, r + 6, 0, 0, TAU); ctx.fill();       // ringfundament
  // kropp: rektangel + nedre halvsirkel; horisontal skyggegradient (lys fra vest)
  ctx.beginPath(); ctx.moveTo(x - r, top); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, r, 0, Math.PI, 0, true); ctx.lineTo(x + r, top); ctx.closePath();
  ctx.fillStyle = grad(ctx, x - r, 0, x + r, 0, [[0, rgb(C, -0.15)], [0.22, rgb(C, 0.12)], [0.5, rgb(C, -0.08)], [0.85, rgb(C, -0.45)], [1, rgb(C, -0.6)]]); ctx.fill();
  ctx.save(); ctx.clip();
  for (let k = 1; k < 6; k++) { const yy = top + lift * k / 6; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, yy + r * 0.0, r, r, 0, 0, Math.PI); ctx.stroke(); }   // platesømmer (horisontale ringer)
  for (let i = 0; i < 18; i++) { const sx = x + R.r(-r, r), sy = top + R.r(0, lift * 0.6); ctx.fillStyle = `rgba(${R() < 0.7 ? '90,48,22' : '20,18,16'},${R.r(0.15, 0.35)})`; ctx.fillRect(sx, sy, R.r(1, 3), R.r(lift * 0.15, lift * 0.5)); }   // rustrenner
  blot(ctx, x, y, r * 1.1, '40,30,20', 0.4, 0.4);                                                               // skitt ved foten
  if (t.label !== false) { ctx.fillStyle = 'rgba(30,30,28,0.55)'; ctx.font = `bold ${Math.round(r * 0.32)}px "Arial Narrow", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(t.label || 'DW-04', x - r * 0.15, top + lift * 0.45); }
  ctx.restore();
  // tak (sirkel ovenfra) + kant + spiraltrapp (antydet)
  ctx.fillStyle = grad(ctx, x - r, top - r, x + r, top + r, [[0, rgb(C, 0.12)], [1, rgb(C, -0.3)]]); ctx.beginPath(); ctx.ellipse(x, top, r, r, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgb(C, -0.5); ctx.lineWidth = 1.4; ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, top, r * 0.6, r * 0.6, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#26282a'; ctx.fillRect(x - 3, top - 3, 6, 6); ctx.strokeStyle = 'rgba(184,149,44,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, top, r - 2, r - 2, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,30,30,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let k = 0; k <= 20; k++) { const a = Math.PI * (0.55 + k * 0.022), yy = top + lift * k / 20; const px = x + Math.cos(a) * r, py = yy + Math.sin(a) * r * 0.0; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
  ctx.restore(); return true;
}
/** Rørgate langs kanten: stålbukker hver ~5. felt med 2 nivåer rør. r = { x0, x1, y, height?, seed? } (Ø–V, langs nordkanten). */
export function drawPipeRack(ctx, L, r) {
  const P = PROJ0, H1 = (r.height ?? 90) * P.zScale, b = { x: r.x0, y: r.y - H1 - 30, w: r.x1 - r.x0, h: H1 + 40 }; if (!edgeSafe(L, b)) return false;
  const R = rng(r.seed ?? Math.round(r.x0 + r.y)), T = (L && L.tile) || 32, len = r.x1 - r.x0, pick = pipeCols(R), dep = 22;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(r.x0 + 8, r.y + 2, len, dep * 0.8);   // bakkeskygge
  const bents = []; for (let u = 0; u <= len; u += T * 5) bents.push(r.x0 + u);
  const col = (bx, yb) => { ctx.fillStyle = grad(ctx, bx - 2.5, 0, bx + 2.5, 0, [[0, '#4a4c4a'], [0.4, '#5c5e5a'], [1, '#1c1d1c']]); ctx.fillRect(bx - 2.5, yb - H1, 5, H1); ctx.fillStyle = 'rgba(184,149,44,0.55)'; ctx.fillRect(bx - 2.5, yb - 8, 5, 6); };
  for (const bx of bents) col(bx, r.y - dep);   // bakre søyler
  for (const lv of [0.55, 1.0]) { const yy = r.y - H1 * lv; for (let k = 0; k < 3; k++) { const a = 5.5 - k * 0.6; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(r.x0, yy - dep + k * 7 + a, len, 2); pipeBand(ctx, R, r.x0, yy - dep + k * 7, len, a, pick(), true, R() < 0.3); }
    ctx.fillStyle = '#2b2c2b'; for (const bx of bents) ctx.fillRect(bx - 2, yy - dep - 1, 4, dep + 2); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(r.x0, yy + 1, len, 2); ctx.fillStyle = '#3e403e'; ctx.fillRect(r.x0, yy - 1, len, 2.4); }
  for (const bx of bents) col(bx, r.y);         // fremre søyler
  ctx.restore(); return true;
}

// =====================================================================================  LYS (lightStyle / lightmapPool, som ground.js)
// Lamper i L.lights med kind: 'flare' (oransje fakkelglød, ved fakkeltårn i kanten), 'mercury' (grønnlig kvikksølvdamp, arbeidslys), ellers natrium (ground.js-tonen).
export const REFINERY_LIGHT = Object.freeze({ flare: [255, 112, 34], mercury: [132, 214, 168], sodium: [255, 135, 50] });
export function refineryLightStyle(l) {
  const k = (l && l.kind) || '', base = (l && l.r) || 5, i = (l && l.i) ?? 1;
  if (k === 'flare') return { color: REFINERY_LIGHT.flare, radius: base * 1.0, intensity: Math.min(1.5, i * 1.4) };
  if (k === 'mercury' || k === 'green') return { color: REFINERY_LIGHT.mercury, radius: base * 0.7, intensity: Math.min(1.4, i * 1.25) };
  return { color: (l && l.color) || REFINERY_LIGHT.sodium, radius: base * 0.72, intensity: Math.min(1.5, i * 1.35) };
}
const _pool = new Map();
function poolSprite(col, i, kind) {
  const key = col.join(',') + '|' + Math.round(i * 20) + '|' + kind; let c = _pool.get(key); if (c) return c;
  const S = 128, h = S / 2, [r, g, b] = col, A = (k) => Math.min(1, i * k).toFixed(3); c = canvas(S, S); const x = c.getContext('2d'), gr = x.createRadialGradient(h, h, 0, h, h, h);
  if (kind === 'flare') { gr.addColorStop(0, `rgba(${r},${Math.round(g * 1.25)},${Math.round(b * 1.4)},${A(1)})`); gr.addColorStop(0.3, `rgba(${r},${g},${b},${A(0.75)})`); gr.addColorStop(0.65, `rgba(${Math.round(r * 0.8)},${Math.round(g * 0.6)},${Math.round(b * 0.5)},${A(0.25)})`); }
  else { gr.addColorStop(0, `rgba(${r},${g},${b},${A(1)})`); gr.addColorStop(0.25, `rgba(${r},${g},${b},${A(0.95)})`); gr.addColorStop(0.5, `rgba(${Math.round(r * 0.8)},${g},${Math.round(b * 0.85)},${A(0.35)})`); gr.addColorStop(0.75, `rgba(${Math.round(r * 0.6)},${Math.round(g * 0.8)},${Math.round(b * 0.7)},${A(0.08)})`); }
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.fillRect(0, 0, S, S); _pool.set(key, c); if (_pool.size > 64) _pool.delete(_pool.keys().next().value); return c;
}
/** Erstatter Arenas lightPool for brett 2. Samme signatur som ground.js lightmapPool. Radius = style.radius·tile·1,4. */
export function refineryLightmapPool(ctx, L, l, alphaMul = 1) {
  if (!L || !l) return false; const T = L.tile || 32, st = l._styled ? { color: l.color, radius: l.r, intensity: l.i } : refineryLightStyle(l), ls = (L.theme && L.theme.lightScale) || 1, r = st.radius * T * 1.4, i = st.intensity * alphaMul / ls * 1.25;
  ctx.drawImage(poolSprite(st.color, Math.min(1.5, i), l.kind === 'flare' ? 'flare' : 'lamp'), l.x * T - r, l.y * T - r, r * 2, r * 2); return true;
}
/** Kald, svakt grønnlig-grå ambient (ikke oliven: B ≥ R). */
export function refineryAmbient(L) { return (L && L.theme && L.theme.fxAmbient) || 'rgb(112,118,120)'; }
// glødsprites (additivt glødlag)
let _fl = null;
function flareSprites() { if (_fl) return _fl; const f = canvas(32, 64), x = f.getContext('2d');
  let g = x.createRadialGradient(16, 46, 0, 16, 40, 30); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.2, 'rgba(255,190,90,0.9)'); g.addColorStop(0.5, 'rgba(255,110,30,0.5)'); g.addColorStop(1, 'rgba(160,40,10,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(16, 2); x.bezierCurveTo(30, 26, 28, 56, 16, 60); x.bezierCurveTo(4, 56, 2, 26, 16, 2); x.fill();
  const b = canvas(64, 64), y = b.getContext('2d'); g = y.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); y.fillStyle = g; y.fillRect(0, 0, 64, 64);
  return (_fl = { flame: f, bloom: b }); }
/** Glødlaget (additivt, bakes): lampehoder og svak bloom. Fakler (kind 'flare') får bare bloom her; flammen er levende (drawFlareLife). */
export function drawRefineryGlow(ctx, L) {
  if (!L || !L.lights) return false; const T = L.tile || 32; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of L.lights) { const st = refineryLightStyle(l), [r, g, b] = st.color, x = l.x * T, y = l.y * T, hy = y - (l.kind === 'flare' ? 0 : 2);
    blot(ctx, x, y + 4, st.radius * T * 0.5, `${r},${g},${b}`, 0.06 * st.intensity, 0.9);
    if (l.kind === 'flare') continue;
    blot(ctx, x, hy, 14, `${r},${g},${b}`, 0.25 * st.intensity); blot(ctx, x, hy, 4, l.kind === 'mercury' ? '220,255,235' : '255,236,190', 0.7);
    ctx.fillStyle = l.kind === 'mercury' ? '#e2fff0' : '#ffeec8'; ctx.fillRect(x - 3, hy - 1, 6, 2); }
  ctx.restore(); return true;
}
/** Per bilde (under 0,05 ms): fakkelflammer med flimring og pulserende bloom. Fakkeltårn står i kanten; flammen er additiv og dekker aldri figurer i banen. */
export function drawFlareLife(ctx, L, t, view) {
  if (!L || !L.lights) return false; const S = flareSprites(), T = L.tile || 32; t = t || 0; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of L.lights) { if (l.kind !== 'flare') continue; const x = l.x * T, y = l.y * T - (l.stack ?? 0); if (view && (x < view.x0 - 200 || x > view.x1 + 200 || y < view.y0 - 200 || y > view.y1 + 200)) continue;
    const h = (l.x * 13.1 + l.y * 7.7) % 6.28, n = 0.75 + 0.15 * Math.sin(t * 9 + h) + 0.1 * Math.sin(t * 23 + h * 2), sw = Math.sin(t * 2.3 + h) * 3;
    ctx.globalAlpha = 0.28 * n; ctx.drawImage(S.bloom, x - 70, y - 90, 140, 140);
    ctx.globalAlpha = 0.95; ctx.drawImage(S.flame, x - 9 + sw * 0.3, y - 44 * n, 18, 46 * n);
    ctx.globalAlpha = 0.6; ctx.drawImage(S.flame, x - 5 + sw, y - 58 * n, 10, 40 * n); }
  ctx.restore(); return true;
}
/** Fakkeltårn (bakes i gulvlaget, bare utenfor spilleområdet): tynn mast + plattform. l = lampen med kind 'flare' og stack (høyde i px). */
export function drawFlareStack(ctx, L, l) {
  const T = (L && L.tile) || 32, x = l.x * T, y = l.y * T, H = l.stack ?? 120; if (!edgeSafe(L, { x: x - 10, y: y - H, w: 20, h: H + 10 })) return false;
  ctx.save(); blot(ctx, x + 10, y + 6, 22, '0,0,0', 0.5, 0.6);
  ctx.fillStyle = grad(ctx, x - 4, 0, x + 4, 0, [[0, '#4d4f4c'], [0.4, '#5f615c'], [1, '#1d1e1d']]); ctx.fillRect(x - 4, y - H, 8, H);
  for (let k = 0; k < H; k += 16) { ctx.fillStyle = k % 32 ? 'rgba(160,40,30,0.6)' : 'rgba(210,200,190,0.35)'; ctx.fillRect(x - 4, y - H + k, 8, 8); }
  ctx.fillStyle = '#2a2b2a'; ctx.fillRect(x - 9, y - H - 2, 18, 4); ctx.fillStyle = '#171717'; ctx.fillRect(x - 3, y - H - 6, 6, 5);
  ctx.restore(); return true;
}
