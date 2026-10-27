// Tegnestil «painted» (Warden v2): slitt metall/stoff via offscreen-teksturer, per-del gradient + bevel + kantslitasje + AO,
// sprite-cache per del (skin|del|seed|lysbøtte|skalabøtte), figurlag med topplys, silhuett-kantlys, kvart-oppløst halo og skygge.
//
// STIL-KONTRAKT (byttbar): et stil-objekt har
//   style.drawFigure(ctx, rig, frame, opts)  – tegner hele figuren i verdensrom (ctx har kameratransform).
// Riggen kaller den; def.paint(api, frame) gjør selve delene via api-et under. En senere håndmalt sprite-stil kan
// implementere drawFigure helt uten def.paint (f.eks. slå opp sprite-ark med frame.hip/torso/phase), uten at
// spiller- eller fiendekoden endres. Velg med createRig(def, { style }) eller rig.setStyle(style).
import { LIGHT_DIR as LW, SHADOW_DIR, READABILITY } from '../../light.js';
import { skinOf } from '../skins.js';

const TAU = Math.PI * 2, PI = Math.PI;
const hasDOM = typeof document !== 'undefined';
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ------------------------------------------------------------ teksturer (lages én gang, flisbare 256²)
let TEX = null, PAT = null;
function buildTextures() {
  let s = 0x9e3779b9; const R = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const S = 256;
  const mk = (fn, size = S) => { const c = mkCanvas(size, size); const g = c.getContext('2d', { willReadFrequently: true }); fn(g, size); return c; };
  const wrap = (x, y, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const X = x + ox, Y = y + oy; if (X < -r || X > S + r || Y < -r || Y > S + r) continue; fn(X, Y); } };
  const blotch = (g, cells, amp, dark = '0,0,0', light = '255,255,255') => {
    const n = mk((h, z) => { const id = h.createImageData(z, z); for (let i = 0; i < z * z; i++) { const v = R(); const L = v > .5; const c = (L ? light : dark).split(','); id.data[i * 4] = +c[0]; id.data[i * 4 + 1] = +c[1]; id.data[i * 4 + 2] = +c[2]; id.data[i * 4 + 3] = Math.abs(v - .5) * 2 * 255 * amp; } h.putImageData(id, 0, 0); }, cells);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g.drawImage(n, ox, oy, S, S); g.restore();
  };
  const grain = (g, amp) => { const id = g.getImageData(0, 0, S, S); const d = id.data; for (let i = 0; i < d.length; i += 4) { const v = (R() - .5) * amp; d[i] += v; d[i + 1] += v; d[i + 2] += v; } g.putImageData(id, 0, 0); };
  const blobs = (g, n, rmin, rmax, col, amin, amax) => { for (let i = 0; i < n; i++) { const x = R() * S, y = R() * S, r = rmin + R() * (rmax - rmin), a = amin + R() * (amax - amin);
    wrap(x, y, r, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.ellipse(X, Y, r, r * (.5 + R() * .5), R() * PI, 0, TAU); g.fill(); }); } };
  const scratches = (g, n, lmin, lmax, a0, a1, w = .8) => { for (let i = 0; i < n; i++) { const x = R() * S, y = R() * S, l = lmin + R() * (lmax - lmin), a = R() * TAU, b = (R() - .5) * .6, al = a0 + R() * (a1 - a0), lw = w * (.5 + R());
    wrap(x, y, l, (X, Y) => { const ex = X + Math.cos(a) * l, ey = Y + Math.sin(a) * l, mx = (X + ex) / 2 + Math.cos(a + PI / 2) * l * b * .3, my = (Y + ey) / 2 + Math.sin(a + PI / 2) * l * b * .3;
      g.lineCap = 'round'; g.strokeStyle = `rgba(0,0,0,${al * .7})`; g.lineWidth = lw; g.beginPath(); g.moveTo(X + .7, Y + .9); g.quadraticCurveTo(mx + .7, my + .9, ex + .7, ey + .9); g.stroke();
      g.strokeStyle = `rgba(190,196,200,${al})`; g.lineWidth = lw * .8; g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(mx, my, ex, ey); g.stroke(); }); } };
  const chips = (g, n, rmin, rmax, col, a, rim = .45) => { for (let i = 0; i < n; i++) { const x = R() * S, y = R() * S, r = rmin + R() * (rmax - rmin), k = 5 + (R() * 4 | 0), pts = []; for (let j = 0; j < k; j++) { const t = j / k * TAU, rr = r * (.45 + R() * .7); pts.push([Math.cos(t) * rr, Math.sin(t) * rr * (.5 + R() * .6)]); }
    wrap(x, y, r, (X, Y) => { const poly = (dx, dy) => { g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(X + p[0] + dx, Y + p[1] + dy) : g.moveTo(X + p[0] + dx, Y + p[1] + dy)); g.closePath(); };
      if (rim) { poly(.8, 1); g.fillStyle = `rgba(0,0,0,${rim})`; g.fill(); } poly(0, 0); g.fillStyle = `rgba(${col},${a})`; g.fill(); }); } };
  const specks = (g, n, col, a0, a1, r0 = .4, r1 = 1.4) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${a0 + R() * (a1 - a0)})`; g.beginPath(); g.arc(R() * S, R() * S, r0 + R() * (r1 - r0), 0, TAU); g.fill(); } };
  const metal = (base, lift = 0) => mk(g => {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    blotch(g, 6, .4, '6,6,8', '110,114,118'); blotch(g, 24, .3, '4,4,4', '150,154,158'); blotch(g, 64, .22, '0,0,0', '170,174,178');
    blobs(g, 22, 14, 48, '34,26,16', .12, .38); blobs(g, 10, 10, 30, '150,136,110', .06, .16);
    scratches(g, 70, 3, 22, .12, .32 + lift * .1, .7); scratches(g, 14, 20, 60, .08, .2, .6);
    chips(g, 46, 1.2, 4.8, '150,154,156', .5 + lift * .1); chips(g, 30, .6, 1.6, '175,178,180', .45, .2);
    specks(g, 260, '20,16,10', .15, .5); specks(g, 120, '170,160,140', .08, .25, .3, .9); grain(g, 22);
  });
  const paint = (rgb, holes = 1) => mk(g => {
    g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, S, S); blotch(g, 10, .3, '5,10,16', '190,205,215'); blotch(g, 40, .12);
    blobs(g, 14, 10, 40, '30,24,16', .12, .4); grain(g, 18);
    g.globalCompositeOperation = 'destination-out';
    chips(g, 70 * holes, 1, 6, '0,0,0', 1, 0); chips(g, 120 * holes, .4, 1.6, '0,0,0', 1, 0); scratches(g, 40 * holes, 4, 28, .6, 1, 1.1);
    for (let i = 0; i < 4 * holes; i++) { const x = R() * S, y = R() * S, r = 12 + R() * 26; wrap(x, y, r, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.6, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X - r, Y - r, 2 * r, 2 * r); }); }
    g.globalCompositeOperation = 'source-over';
  });
  const cloth = (base, weave = .18, dirt = '40,30,18') => mk(g => {
    g.fillStyle = base; g.fillRect(0, 0, S, S); blotch(g, 5, .35, '20,14,8', '200,185,150'); blotch(g, 20, .18);
    for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(0,0,0,${weave * (.6 + R() * .5)})`; g.fillRect(0, y, S, 1); }
    for (let x = 0; x < S; x += 3) { g.fillStyle = `rgba(255,240,210,${weave * .35 * (.5 + R())})`; g.fillRect(x, 0, 1, S); }
    for (let i = 0; i < 500; i++) { const x = R() * S, y = R() * S, l = 2 + R() * 6; g.strokeStyle = `rgba(${R() < .5 ? '0,0,0' : '230,215,180'},${.08 + R() * .12})`; g.lineWidth = .5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (R() - .5) * 1.5); g.stroke(); }
    blobs(g, 26, 10, 44, dirt, .12, .42); blobs(g, 8, 8, 26, '190,175,140', .06, .14); specks(g, 200, '25,18,10', .15, .45); grain(g, 26);
  });
  TEX = {
    armor: metal('#262a2f'), armorL: metal('#31363c', 1), gun: metal('#1b1e21'),
    edge: mk(g => {
      for (let c = 0; c < 26; c++) { const cx = R() * S, cy = R() * S, cr = 8 + R() * 26, n = 6 + (R() * 26 | 0);
        for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.pow(R(), .7) * cr, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, r = .6 + R() * 3.2, k = 5 + (R() * 3 | 0);
          wrap(x, y, r, (X, Y) => { g.beginPath(); for (let j = 0; j < k; j++) { const t = j / k * TAU, rr = r * (.4 + R() * .8); j ? g.lineTo(X + Math.cos(t) * rr, Y + Math.sin(t) * rr) : g.moveTo(X + Math.cos(t) * rr, Y + Math.sin(t) * rr); } g.closePath(); g.fillStyle = `rgba(${168 + R() * 40 | 0},${172 + R() * 40 | 0},${176 + R() * 36 | 0},${.55 + R() * .45})`; g.fill(); }); } }
      specks(g, 500, '175,180,184', .2, .7, .3, 1);
    }),
    blue: paint('46,96,128'), red: paint('120,36,30'), white: paint('196,201,204', 1.6),
    fabric: cloth('#7a6b4e', .2), suit: cloth('#25282c', .22, '10,8,6'), pouch: cloth('#3d3a2e', .24, '18,14,8'),
    boot: mk(g => { g.fillStyle = '#24211d'; g.fillRect(0, 0, S, S); blotch(g, 8, .35, '5,5,5', '120,105,85'); blobs(g, 30, 6, 30, '112,98,74', .15, .45); scratches(g, 30, 3, 14, .1, .25, .6); specks(g, 400, '130,116,92', .15, .5); grain(g, 24); }),
  };
  const pc = mkCanvas(1, 1).getContext('2d'); PAT = {};
  for (const k in TEX) PAT[k] = pc.createPattern(TEX[k], 'repeat');
}
/** Registrer en egen malingstekstur for en skin (f.eks. Fiende-AI: registerPaint('amber','190,120,30')). */
export function registerPaint(name, rgb) { ensure(); const c = mkCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, 256, 256); g.globalAlpha = .55; g.drawImage(TEX.blue, 0, 0); g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.drawImage(TEX.blue, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'destination-in'; g.drawImage(TEX.blue, 0, 0); TEX[name] = c; PAT[name] = mkCanvas(1, 1).getContext('2d').createPattern(c, 'repeat'); }
function ensure() { if (!TEX && hasDOM) buildTextures(); }

export const MAT = {
  armor: { p: 'armor', k: .085, spec: .55, dark: .66, edge: .9, wear: .85 },
  armorL: { p: 'armorL', k: .085, spec: .65, dark: .62, edge: 1.05, wear: 1.05 },
  suit: { p: 'suit', k: .07, spec: .35, dark: .6, edge: .35, wear: 0 },
  fabric: { p: 'fabric', k: .06, spec: .45, dark: .55, edge: .4, wear: 0 },
  pouch: { p: 'pouch', k: .07, spec: .4, dark: .6, edge: .5, wear: .2 },
  gun: { p: 'gun', k: .07, spec: .45, dark: .6, edge: 1, wear: .8 },
  gunL: { p: 'armor', k: .07, spec: .5, dark: .6, edge: 1.1, wear: 1 },
  boot: { p: 'boot', k: .07, spec: .4, dark: .6, edge: .6, wear: .4 },
  glove: { p: 'suit', k: .05, spec: .3, dark: .6, edge: .6, wear: .3 },
};

// ------------------------------------------------------------ del-renderer
let ctx = null;          // gjeldende kontekst (byttes under baking)
let SKIN = skinOf('warden'), SKIN_ID = 'warden';
export const FLAGS = { cache: true, ao: true, rim: true, halo: true, shadow: true, grad: true, bevel: true, wear: true, tex: true, ring: true };
export const STATS = { hit: 0, miss: 0, size: 0 };

function setPat(m, seed, scale = 1) { const p = PAT[m.p] || PAT.armor; const k = m.k * scale; const ox = (seed * 97.13) % 37, oy = (seed * 61.7) % 41; p.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy])); return p; }
const devScale = () => { const m = ctx.getTransform(); return Math.hypot(m.a, m.b); };
function trueLocalLight(c = ctx) { const m = c.getTransform(); const det = (m.a * m.d - m.b * m.c) || 1; const x = (m.d * LW.x - m.c * LW.y) / det, y = (-m.b * LW.x + m.a * LW.y) / det; const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }

function partRender(path, M, o, L, aoV, seed) {
  const r = (o.r || 9), cx = o.cx || 0, cy = o.cy || 0, c = ctx;
  c.lineJoin = 'round';
  if (o.ao && FLAGS.ao) { const px = devScale(); c.save(); c.shadowColor = `rgba(0,0,0,${o.ao})`; c.shadowBlur = (o.aoB || 2) * px; c.shadowOffsetX = -aoV.x * (o.aoD || 1) * px; c.shadowOffsetY = -aoV.y * (o.aoD || 1) * px; c.beginPath(); path(c); c.fillStyle = '#0b0c0e'; c.fill(); c.restore(); }
  c.beginPath(); path(c); c.fillStyle = FLAGS.tex ? setPat(M, seed, o.ts || 1) : '#333'; c.fill();
  if (o.tint) { c.fillStyle = o.tint; c.fill(); }
  c.save(); c.clip();
  if (o.decal) o.decal(L, c);
  if (FLAGS.grad) { let g;
    if (o.cap) { const [len, w] = o.cap; const ny = L.y >= 0 ? 1 : -1, h = w * .62; g = c.createLinearGradient(len / 2, ny * h, len / 2, -ny * h); }
    else { const hx = cx + L.x * r * .42, hy = cy + L.y * r * .42; g = c.createRadialGradient(hx, hy, 0, cx - L.x * r * .1, cy - L.y * r * .1, r * 1.22); }
    g.addColorStop(0, `rgba(255,236,206,${.16 * M.spec})`); g.addColorStop(.4, 'rgba(0,0,0,0)'); g.addColorStop(.7, `rgba(2,3,4,${M.dark * .45})`); g.addColorStop(1, `rgba(2,3,4,${M.dark})`);
    c.fillStyle = g; c.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6); }
  if (FLAGS.bevel) {
    c.save(); c.translate(L.x * 1.6, L.y * 1.6); c.beginPath(); path(c); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.5)'; c.stroke(); c.restore();
    if (M.edge > 0) {
      c.save(); c.translate(-L.x * 1.1, -L.y * 1.1); c.beginPath(); path(c); c.lineWidth = 2.2; c.strokeStyle = `rgba(205,210,214,${.055 * M.edge})`; c.stroke(); c.restore();
      c.save(); c.translate(-L.x * .55, -L.y * .55); c.beginPath(); path(c); c.lineWidth = .6; c.strokeStyle = `rgba(220,224,228,${.38 * M.edge})`; c.stroke();
      if (M.wear > 0 && o.wear !== false && FLAGS.wear) { c.globalAlpha = Math.min(1, M.wear); c.lineWidth = 1.5; c.strokeStyle = setPat({ p: 'edge', k: .05 }, seed * 3 + 1); c.stroke(); c.globalAlpha = 1; }
      c.restore();
    } }
  c.restore();
  if (o.edgeLine !== false) { c.beginPath(); path(c); c.lineWidth = o.edgeW || .45; c.strokeStyle = 'rgba(3,4,5,.5)'; c.stroke(); }
}
const PCACHE = new Map(); const PC_MAX = 3000; const LSTEPS = 48;
function bakePart(path, M, o, seed, lb, sq) {
  const [bx, by, bw, bh] = o.bb; const pad = (o.ao ? (o.aoB || 2) * 1.3 + (o.aoD || 1) : 0) + .8;
  const x = bx - pad, y = by - pad, w = bw + pad * 2, h = bh + pad * 2;
  const cv = mkCanvas(Math.max(1, Math.ceil(w * sq)), Math.max(1, Math.ceil(h * sq)));
  const g = cv.getContext('2d'); g.setTransform(cv.width / w, 0, 0, cv.height / h, -x * cv.width / w, -y * cv.height / h);
  const la = lb / LSTEPS * TAU; const L = { x: Math.cos(la), y: Math.sin(la) };
  const prev = ctx; ctx = g; try { partRender(path, M, o, L, L, seed); } finally { ctx = prev; }
  return { c: cv, x, y, w, h };
}
let partSeed = 0;
function part(path, mat, o = {}) {
  const M = MAT[mat] || MAT.armor; const seed = o.seed != null ? o.seed : ++partSeed;
  if (!o.key || !FLAGS.cache) { partRender(path, M, o, trueLocalLight(), LW, seed); return; }
  const m = ctx.getTransform(); const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  const sb = Math.round(Math.log2(sc) * 4); const sq = Math.pow(2, sb / 4);
  const L = trueLocalLight(); const la = Math.atan2(L.y, L.x); const lb = ((Math.round(la / TAU * LSTEPS) % LSTEPS) + LSTEPS) % LSTEPS;
  const k = SKIN_ID + '|' + o.key + '|' + seed + '|' + lb + '|' + sb;
  let spr = PCACHE.get(k);
  if (!spr) { spr = bakePart(path, M, o, seed, lb, sq); PCACHE.set(k, spr); STATS.miss++; if (PCACHE.size > PC_MAX) PCACHE.delete(PCACHE.keys().next().value); } else STATS.hit++;
  STATS.size = PCACHE.size;
  ctx.drawImage(spr.c, spr.x, spr.y, spr.w, spr.h);
}
const capsulePath = (x1, y1, x2, y2, w) => { const a = Math.atan2(y2 - y1, x2 - x1), h = w / 2; return c => { c.moveTo(x1 + Math.cos(a + PI / 2) * h, y1 + Math.sin(a + PI / 2) * h); c.arc(x2, y2, h, a + PI / 2, a - PI / 2, true); c.arc(x1, y1, h, a - PI / 2, a + PI / 2, true); c.closePath(); }; };
function capsule(x1, y1, x2, y2, w, mat, o = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1); const len = Math.max(.5, Math.round(Math.hypot(x2 - x1, y2 - y1) * 2) / 2);
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(a);
  part(capsulePath(0, 0, len, 0, w), mat, Object.assign({ key: 'cap' + len + '_' + w, bb: [-w / 2 - .2, -w / 2 - .2, len + w + .4, w + .4], cap: [len, w], cx: len / 2, cy: 0, r: Math.max(w, len / 2 + w / 2) }, o));
  ctx.restore();
}
// glød uten shadowBlur (Effekter/VFX): formen tegnes svakt forskjøvet rundt seg selv + originalen. col beholdes for API-et.
function glow(fn, col, blur, alpha = 1) {
  const d = blur * 0.5; ctx.save(); ctx.globalAlpha *= alpha;
  const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.22;
  for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { ctx.save(); ctx.translate(ox, oy); fn(ctx); ctx.restore(); }
  ctx.globalAlpha = a0; fn(ctx); ctx.restore();
}

/** API-et def.paint får. ctx() gir gjeldende kontekst (rå strøk), part/capsule/glow er cachede malte deler. */
let READ = READABILITY;
export const api = {
  get read() { return READ; },
  get c() { return ctx; }, part, capsule, glow, light: () => trueLocalLight(), get skin() { return SKIN; },
  pat: (p, k, seed) => setPat({ p, k }, seed), MAT,
};

// ------------------------------------------------------------ figurlag + lys
let LAYER, LCTX, RIM, RCTX, HALO, HCTX, SH, SHCTX;
function buffers() { if (LAYER) return; LAYER = mkCanvas(8, 8); LCTX = LAYER.getContext('2d'); RIM = mkCanvas(8, 8); RCTX = RIM.getContext('2d'); HALO = mkCanvas(8, 8); HCTX = HALO.getContext('2d'); SH = mkCanvas(8, 8); SHCTX = SH.getContext('2d'); }

/** Kontaktskygge: union av kropp + føtter, tegnet i kvart oppløsning og skalert opp (billig blur), forskjøvet langs SHADOW_DIR. */
function drawShadow(main, F, sc, m) {
  if (!FLAGS.shadow) return;
  const hgt = F.height * (F.shadowLift || 1); const off = 7.4 * hgt + 2.6; // ≈ (4.4, 6.6)·h + (1.8, 2.6) som v2
  const half = Math.ceil(56 * sc), size = half * 2, q = Math.max(4, Math.ceil(size / 4));
  if (SH.width < q) { SH.width = SH.height = q; }
  const pp = m.transformPoint(new DOMPoint(F.x, F.y));
  const ox = Math.round(pp.x) - half, oy = Math.round(pp.y) - half;
  const k = q / size; SHCTX.setTransform(1, 0, 0, 1, 0, 0); SHCTX.clearRect(0, 0, q, q);
  SHCTX.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, (m.e - ox) * k, (m.f - oy) * k); SHCTX.fillStyle = '#000';
  const body = (c, dx, dy, grow) => { F.shadowShape(c, dx, dy, grow); };
  SHCTX.globalAlpha = .62; SHCTX.beginPath(); body(SHCTX, SHADOW_DIR.x * off, SHADOW_DIR.y * off, 1); SHCTX.fill();
  SHCTX.globalAlpha = .5; SHCTX.beginPath(); body(SHCTX, .6, .9, .82); SHCTX.fill(); SHCTX.globalAlpha = 1;   // tett kontakt-AO
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.imageSmoothingEnabled = true; main.imageSmoothingQuality = 'low';
  main.globalAlpha = F.alpha ?? 1; main.drawImage(SH, 0, 0, q, q, ox, oy, size, size); main.restore();
}

/** Lesbarhet ved 2×: svak, kald lyspøl rundt føttene (ikke en tegneserie-ring) + tynn mørk kontur via halo. */
function drawContactLight(main, F) {
  if (!FLAGS.ring || !F.contact) return;
  const s = skinOf(F.skin); const a = F.contact, R = readOf(F), G = R.groundAO, Rg = R.ring;
  main.save(); main.translate(F.x, F.y);
  // mørk kontaktpøl: skiller figuren fra lyst/travelt gulv uten kontur-strek
  if (G.alpha > 0) { const ga = main.createRadialGradient(0, 0, 3, 0, 0, G.r); ga.addColorStop(0, `rgba(4,6,8,${G.alpha * a})`); ga.addColorStop(.6, `rgba(4,6,8,${G.alpha * .5 * a})`); ga.addColorStop(1, 'rgba(4,6,8,0)');
    main.fillStyle = ga; main.beginPath(); main.arc(0, 0, G.r, 0, TAU); main.fill(); }
  const g = main.createRadialGradient(0, 0, 8, 0, 0, 30);
  g.addColorStop(0, `rgba(${s.rim},${Rg.pool * a})`); g.addColorStop(.6, `rgba(${s.rim},${Rg.pool * .5 * a})`); g.addColorStop(1, `rgba(${s.rim},0)`);
  main.fillStyle = g; main.beginPath(); main.arc(0, 0, 30, 0, TAU); main.fill();
  // diskret kontaktring i skin-fargen med mørk underlinje (leses på både lyst og mørkt gulv) + sikteretningsbue (roterer aldri med rulling)
  if (Rg.under > 0) { main.lineWidth = 2.2; main.strokeStyle = `rgba(0,0,0,${Rg.under * a})`; main.beginPath(); main.arc(0, 0, Rg.r + .7, 0, TAU); main.stroke(); }
  main.lineWidth = .8; main.strokeStyle = `rgba(${s.ring},${Rg.alpha * a})`; main.beginPath(); main.arc(0, 0, Rg.r, 0, TAU); main.stroke();
  main.lineWidth = 1.2; main.strokeStyle = `rgba(${s.ring},${Rg.aimAlpha * a})`; main.beginPath(); main.arc(0, 0, Rg.r, F.aim - .3, F.aim + .3); main.stroke();
  main.restore();
}

// Lesbarhet: felles preset fra light.js (READABILITY), kan byttes globalt (setReadability) eller overstyres per def (F.readPreset).
let RD = READABILITY;
export function setReadability(preset) { RD = preset || READABILITY; }
function deepMerge(a, b) { const o = { ...a }; for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && a[k] && typeof a[k] === 'object') ? { ...a[k], ...b[k] } : b[k]; return o; }
const readOf = (F) => F.readPreset ? deepMerge(RD, F.readPreset) : RD;

export const painted = {
  name: 'painted',
  flags: FLAGS, stats: STATS,
  clearCache() { PCACHE.clear(); },
  /** Tegn hele figuren. ctx = hovedkontekst med kameratransform (verdensrom). */
  drawFigure(main, rig, F, opts = {}) {
    if (!hasDOM) return; ensure(); buffers();
    SKIN_ID = F.skin; SKIN = skinOf(F.skin); partSeed = 0;
    const m = main.getTransform(); const sc = Math.hypot(m.a, m.b);
    const rimK = opts.rim ?? F.rim ?? 1, RD0 = readOf(F);
    drawShadow(main, F, sc, m);
    drawContactLight(main, F);
    if (F.under) F.under(main);                               // eierens bakkelag (cover-AO, cyan kant) tegnes før figuren
    const half = Math.ceil(52 * sc), size = half * 2;
    const pp = m.transformPoint(new DOMPoint(F.x, F.y)); const ox = Math.round(pp.x) - half, oy = Math.round(pp.y) - half;
    if (LAYER.width < size) { LAYER.width = LAYER.height = size; RIM.width = RIM.height = size; }
    LCTX.setTransform(1, 0, 0, 1, 0, 0); LCTX.clearRect(0, 0, size, size);
    LCTX.setTransform(m.a, m.b, m.c, m.d, m.e - ox, m.f - oy); LCTX.imageSmoothingEnabled = true; LCTX.imageSmoothingQuality = 'high';
    ctx = LCTX; READ = RD0; try { rig.def.paint(api, F); } finally { ctx = null; }
    // topplys: høyeste punkt (hjelmen) lysest, ekstremiteter faller mot gulvet
    const hp = m.transformPoint(new DOMPoint(F.headX, F.headY)); const hx = hp.x - ox, hy = hp.y - oy;
    LCTX.setTransform(1, 0, 0, 1, 0, 0); LCTX.globalCompositeOperation = 'source-atop';
    const g = LCTX.createRadialGradient(hx + LW.x * 3 * sc, hy + LW.y * 3 * sc, 7 * sc, hx, hy, 38 * sc);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, `rgba(4,5,6,${RD0.topFalloff * .36})`); g.addColorStop(1, `rgba(4,5,6,${RD0.topFalloff})`);
    LCTX.fillStyle = g; LCTX.fillRect(0, 0, size, size);
    const g2 = LCTX.createRadialGradient(hx + LW.x * 4 * sc, hy + LW.y * 4 * sc, 0, hx + LW.x * 4 * sc, hy + LW.y * 4 * sc, 15 * sc);
    g2.addColorStop(0, 'rgba(255,232,200,.09)'); g2.addColorStop(1, 'rgba(255,232,200,0)'); LCTX.fillStyle = g2; LCTX.fillRect(0, 0, size, size);
    if (F.flash > 0) { LCTX.fillStyle = `rgba(255,255,255,${.55 * F.flash})`; LCTX.fillRect(0, 0, size, size); }
    // silhuett-kantlys på lyssiden (S minus S forskjøvet bort fra lyset). Sterkere enn v2 for lesbarhet ved 2×.
    if (FLAGS.rim && rimK > 0) {
      const d = Math.max(1.2, RD0.rim.width * sc), db = Math.max(1, RD0.back.width * sc);
      RCTX.setTransform(1, 0, 0, 1, 0, 0); RCTX.globalCompositeOperation = 'copy'; RCTX.drawImage(LAYER, 0, 0, size, size, 0, 0, size, size);
      RCTX.globalCompositeOperation = 'destination-out'; RCTX.drawImage(LAYER, 0, 0, size, size, -LW.x * d, -LW.y * d, size, size);
      RCTX.globalCompositeOperation = 'source-in'; RCTX.fillStyle = `rgb(${SKIN.rim})`; RCTX.fillRect(0, 0, size, size); RCTX.globalCompositeOperation = 'source-over';
      LCTX.globalCompositeOperation = 'source-atop'; LCTX.globalAlpha = Math.min(1, RD0.rim.alpha * rimK); LCTX.drawImage(RIM, 0, 0, size, size, 0, 0, size, size);
      // svakt, kaldt motlys på skyggesiden (skiller mørk rustning fra mørkt gulv uten å se tegnet ut)
      RCTX.globalCompositeOperation = 'copy'; RCTX.drawImage(LAYER, 0, 0, size, size, 0, 0, size, size);
      RCTX.globalCompositeOperation = 'destination-out'; RCTX.drawImage(LAYER, 0, 0, size, size, LW.x * db, LW.y * db, size, size);
      RCTX.globalCompositeOperation = 'source-in'; RCTX.fillStyle = `rgb(${RD0.back.color})`; RCTX.fillRect(0, 0, size, size); RCTX.globalCompositeOperation = 'source-over';
      LCTX.globalAlpha = Math.min(1, RD0.back.alpha * rimK); LCTX.drawImage(RIM, 0, 0, size, size, 0, 0, size, size); LCTX.globalAlpha = 1;
    }
    LCTX.globalCompositeOperation = 'source-over';
    main.save(); main.setTransform(1, 0, 0, 1, 0, 0);
    const alpha = F.alpha ?? 1;
    // etterbilder (rull/slide): samme lag, forskjøvet bakover langs bevegelsen
    if (F.ghosts && F.ghosts.length) for (const gh of F.ghosts) {
      const gp = m.transformPoint(new DOMPoint(gh.x, gh.y)); main.globalAlpha = gh.a * alpha;
      main.drawImage(LAYER, 0, 0, size, size, Math.round(gp.x) - half, Math.round(gp.y) - half, size, size);
    }
    if (FLAGS.halo) { // mørk separasjon mot gulvet: silhuett i 1/4 oppløsning skalert opp = billig blur
      const q = Math.ceil(size / 4); if (HALO.width < q) { HALO.width = HALO.height = q; }
      HCTX.setTransform(1, 0, 0, 1, 0, 0); HCTX.globalCompositeOperation = 'copy'; HCTX.imageSmoothingEnabled = true; HCTX.drawImage(LAYER, 0, 0, size, size, 0, 0, q, q);
      HCTX.globalCompositeOperation = 'source-in'; HCTX.fillStyle = '#000'; HCTX.fillRect(0, 0, q, q); HCTX.globalCompositeOperation = 'source-over';
      main.imageSmoothingEnabled = true; main.imageSmoothingQuality = 'low'; main.globalAlpha = Math.min(1, RD0.halo.alpha * alpha); const e = RD0.halo.spread * sc; main.drawImage(HALO, 0, 0, q, q, ox - e, oy - e, size + 2 * e, size + 2 * e);
    }
    main.globalAlpha = alpha; main.drawImage(LAYER, 0, 0, size, size, ox, oy, size, size); main.restore();
  },
};
