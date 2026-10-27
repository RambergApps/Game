// Felles sprite-baking og -cache (eies av Breach Warden-design og animasjon; brukes av Warden og Monsterdesign).
// Baking skjer i nettleseren, ved behov (lat), med tidsbudsjett per bilde. Kjøretid = noen få drawImage per figur.
// Ingen shadowBlur/filter. Uskarphet = ned-/oppskalering.
//
// ---- API (alt valgfritt bortsett fra paint) -------------------------------------------------------------
//   bucketOf(angle, n) → 0..n-1         yawOf(i, n) → vinkel (rad)          (n = 16 for monstre, 32 for Warden)
//   bakeSprite({ bbox:{x0,y0,x1,y1}, D, SS, pad, paint(bc, gc), shadow?(sc), glow?, contour?, rim?, grain? })
//       bbox i verdens-px relativt til ankeret (fotpunktet = 0,0). paint får transform verden → piksler (D·SS).
//       → sprite { body, glow, shadow, ax, ay, w, h, gx, gy, gw, gh, sx, sy, sw, sh, D, bytes }
//   drawSprite(ctx, spr, x, y, { alpha, glowAlpha, shadowAlpha, scale, dy })   – ctx i verdensrom
//   createSpriteCache({ name, maxBytes, budgetMs })  → cache
//       cache.get(key, bakeFn, fallbackKeys?)  → sprite. Treff = LRU-oppdatering. Bom: bak hvis budsjettet for
//           dette bildet tillater det, ellers returner første fallback som finnes (og bak senere). Finnes ingen
//           fallback, bakes det alltid (figuren skal aldri forsvinne).
//       cache.peek(key), cache.has(key), cache.clear(), cache.stats, cache.bytes()
//   sharedCache(id, opts) – samme cache for alle aktører med samme id (f.eks. 'warden|warden|D2' eller 'husk|D2').
//   cacheReport() → [{ name, count, bytes, hits, misses, bakes, bakeMs, maxBakeMs, evictions, deferred }]
// --------------------------------------------------------------------------------------------------------
const TAU = Math.PI * 2;
export function canvas(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export const bucketOf = (a, n) => ((Math.round(a / TAU * n) % n) + n) % n;
export const yawOf = (i, n) => i / n * TAU;
/** Kvantiser 0..1 til `levels` nivåer (0, 1/(l-1), …, 1). */
export const q01 = (v, levels) => Math.round(Math.max(0, Math.min(1, v || 0)) * (levels - 1)) / (levels - 1);

// Lys i skjermplanet (opp-venstre) for kantlys – samme som oblique/paint.js.
import { L2 } from './paint.js';

function down(src, W, H, q = 'high') {   // v4.3: q valgfri ('low' er mye billigere i programvaretegning; standard uendret)
  let c = src, w = src.width, h = src.height;
  while (w / 2 >= W * 1.3) { const n = canvas(w / 2, h / 2), x = n.getContext('2d'); x.imageSmoothingQuality = q; x.drawImage(c, 0, 0, n.width, n.height); c = n; w = n.width; h = n.height; }
  const out = canvas(W, H), o = out.getContext('2d'); o.imageSmoothingQuality = q; o.drawImage(c, 0, 0, W, H); return out;
}
let GRAIN = null;
function grain(ctx) {
  if (!GRAIN) { const n = 64, c = canvas(n, n), g = c.getContext('2d'); let s = 777; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 700; i++) { const v = r() < .5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${.06 + r() * .16})`; g.fillRect(r() * n | 0, r() * n | 0, 1 + (r() * 2 | 0), 1); } GRAIN = c; }
  return ctx.createPattern(GRAIN, 'repeat');
}

/** Bak én sprite. Se toppen av fila. */
export function bakeSprite(o) {
  const D = o.D || 2, SS = o.SS || 2, pad = o.pad ?? 2.5;
  const b = o.bbox, x0 = b.x0 - pad, y0 = b.y0 - pad, ww = b.x1 - b.x0 + 2 * pad, hh = b.y1 - b.y0 + 2 * pad;
  const W = Math.ceil(ww * D), H = Math.ceil(hh * D), K = D * SS;
  const hi = canvas(W * SS, H * SS), bc = hi.getContext('2d');
  const ghi = o.glow ? canvas(W * SS, H * SS) : null, gc = ghi ? ghi.getContext('2d') : null;
  for (const c of [bc, gc]) if (c) c.setTransform(K, 0, 0, K, -x0 * K, -y0 * K);
  o.paint(bc, gc, { px: K });
  if (o.grain !== 0) { bc.setTransform(1, 0, 0, 1, 0, 0); bc.globalCompositeOperation = 'source-atop'; bc.globalAlpha = o.grain ?? .5; bc.fillStyle = grain(bc); bc.fillRect(0, 0, hi.width, hi.height); bc.globalAlpha = 1; bc.globalCompositeOperation = 'source-over'; }
  const body = down(hi, W, H, o.downQ);
  // kontur (utvidet silhuett) + kantlys på lyssiden (silhuett minus silhuett forskjøvet bort fra lyset)
  const out = canvas(W, H), oc = out.getContext('2d');
  if (o.contour !== false) { const C = o.contour || {}, cp = (C.px ?? .9) * D, con = canvas(W, H), cx = con.getContext('2d');
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; cx.drawImage(body, Math.cos(a) * cp, Math.sin(a) * cp); }
    cx.globalCompositeOperation = 'source-in'; cx.fillStyle = `rgba(${C.color || '10,12,15'},${C.a ?? .92})`; cx.fillRect(0, 0, W, H); oc.drawImage(con, 0, 0); }
  oc.drawImage(body, 0, 0);
  if (o.rim !== false) { const R = o.rim || {}, rp = (R.px ?? 1) * D, rim = canvas(W, H), rx = rim.getContext('2d');
    rx.drawImage(body, 0, 0); rx.globalCompositeOperation = 'source-in'; rx.fillStyle = `rgba(${R.color || '223,230,234'},1)`; rx.fillRect(0, 0, W, H);
    rx.globalCompositeOperation = 'destination-out'; rx.drawImage(body, -L2[0] * rp, -L2[1] * rp);
    oc.globalAlpha = R.a ?? .8; oc.drawImage(rim, 0, 0); oc.globalAlpha = 1; }
  let bytes = W * H * 4;
  const spr = { body: out, ax: -x0, ay: -y0, w: W / D, h: H / D, D, bytes: 0 };
  // glød: beskåret til glødflatene + myk halo (nedskalert kopi)
  if (ghi) {
    const gs = down(ghi, W, H, o.downQ), d = gs.getContext('2d').getImageData(0, 0, W, H).data; let gx0 = W, gy0 = H, gx1 = -1, gy1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < gx0) gx0 = x; if (x > gx1) gx1 = x; if (y < gy0) gy0 = y; if (y > gy1) gy1 = y; }
    if (gx1 >= 0) { const hp = Math.ceil(2.5 * D); gx0 = Math.max(0, gx0 - hp); gy0 = Math.max(0, gy0 - hp); gx1 = Math.min(W - 1, gx1 + hp); gy1 = Math.min(H - 1, gy1 + hp);
      const GW = gx1 - gx0 + 1, GH = gy1 - gy0 + 1, glow = canvas(GW, GH), g = glow.getContext('2d');
      g.drawImage(gs, -gx0, -gy0); g.globalCompositeOperation = 'lighter';
      for (const [f, a] of [[3, .5], [6, .3]]) { const s = canvas(GW / f, GH / f); s.getContext('2d').drawImage(gs, gx0, gy0, GW, GH, 0, 0, Math.ceil(GW / f), Math.ceil(GH / f)); g.globalAlpha = a; g.drawImage(s, 0, 0, GW, GH); }
      spr.glow = glow; spr.gx = gx0 / D; spr.gy = gy0 / D; spr.gw = GW / D; spr.gh = GH / D; bytes += GW * GH * 4; }
  }
  // skygge: halv oppløsning (myk)
  if (o.shadow) { const sb = o.shadowBox || b, sx0 = sb.x0 - pad, sy0 = sb.y0 - pad, SW = Math.ceil((sb.x1 - sb.x0 + 2 * pad) * D), SH = Math.ceil((sb.y1 - sb.y0 + 2 * pad) * D);
    const s1 = canvas(SW, SH), c1 = s1.getContext('2d'); c1.setTransform(D, 0, 0, D, -sx0 * D, -sy0 * D); o.shadow(c1);
    const sh = down(s1, Math.ceil(SW / 2), Math.ceil(SH / 2), o.downQ); spr.shadow = sh; spr.sx = sx0; spr.sy = sy0; spr.sw = SW / D; spr.sh = SH / D; bytes += sh.width * sh.height * 4; }
  spr.bytes = bytes; return spr;
}

/** Tegn sprite (ctx i verdensrom). Skygge tegnes separat med drawShadow, så alle skygger kan legges under alle kropper. */
export function drawSprite(ctx, s, x, y, o = {}) {
  const k = o.scale || 1, dy = o.dy || 0;
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha = o.alpha;
  ctx.drawImage(s.body, x - s.ax * k, y - s.ay * k + dy, s.w * k, s.h * k);
  if (s.glow && (o.glowAlpha ?? 1) > 0) { const ga = (o.glowAlpha ?? 1) * (o.alpha ?? 1); const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga;
    ctx.drawImage(s.glow, x + (s.gx - s.ax) * k, y + (s.gy - s.ay) * k + dy, s.gw * k, s.gh * k); ctx.globalCompositeOperation = op; }
  ctx.globalAlpha = 1;
}
export function drawShadow(ctx, s, x, y, a = .34) { if (!s.shadow) return; ctx.globalAlpha = a; ctx.drawImage(s.shadow, x + s.sx, y + s.sy, s.sw, s.sh); ctx.globalAlpha = 1; }

// ---------------------------------------------------------------- LRU-cache med tidsbudsjett
const REG = new Map();
let winStart = 0, spent = 0;                                // budsjettvindu deles av alle cacher (ett bilde ≈ 16 ms)
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
export function createSpriteCache(opts = {}) {
  const map = new Map(); let bytes = 0;
  const maxBytes = opts.maxBytes ?? 24 * 1024 * 1024, budgetMs = opts.budgetMs ?? 3;
  const stats = { name: opts.name || 'cache', hits: 0, misses: 0, bakes: 0, bakeMs: 0, maxBakeMs: 0, evictions: 0, deferred: 0, deferredLast: 0, frameBakes: 0, maxFrameBakeMs: 0 };
  function evict() { while (bytes > maxBytes && map.size > 1) { const [k, v] = map.entries().next().value; map.delete(k); bytes -= v.bytes; stats.evictions++; } }
  // opts.defer (Breach Warden, v4.2): forventet bake over budsjettet + reserve finnes → vis reserven og bak i ledig tid (ingen hakk).
  const avgMs = () => stats.bakes ? stats.bakeMs / stats.bakes : 0;
  function put(key, spr) { map.set(key, spr); bytes += spr.bytes; evict(); return spr; }
  const cache = {
    stats, maxBytes,
    has: (k) => map.has(k), peek: (k) => map.get(k),
    get(key, bakeFn, fallback) {
      const hit = map.get(key);
      if (hit) { map.delete(key); map.set(key, hit); stats.hits++; return hit; }
      stats.misses++;
      const t = now(); if (t - winStart > 14) { winStart = t; spent = 0; }
      // v4.3: opts.defer === 'always' → bak aldri i spillrammen når en reserve finnes.
      if (fallback && (opts.defer === 'always' || spent > budgetMs || (opts.defer && spent + avgMs() > budgetMs))) { for (let i = 0; i < fallback.length; i++) { const fk = fallback[i], f = map.get(fk); if (f) { stats.deferred++; if (i === fallback.length - 1) { stats.deferredLast++; if (String(key)[0] === 'L') stats.frozenLegs = (stats.frozenLegs || 0) + 1; } if (opts.defer) idleQueue(cache, key, bakeFn); return f; } } }
      const t0 = now(); const spr = bakeFn(); const ms = now() - t0; spent += ms;
      stats.bakes++; stats.bakeMs += ms; stats.maxBakeMs = Math.max(stats.maxBakeMs, ms); stats.frameBakeKinds = stats.frameBakeKinds || {}; const kk = String(key)[0] + (fallback ? '+fb' : ''); stats.frameBakeKinds[kk] = (stats.frameBakeKinds[kk] || 0) + 1; stats.frameBakes++; stats.maxFrameBakeMs = Math.max(stats.maxFrameBakeMs, ms);
      return put(key, spr);
    },
    /** v4.3: legg inn en sprite bakt et annet sted (bakearbeider). Valgfri; endrer ikke get/warm. */
    set(key, spr, ms = 0) { if (map.has(key)) return; put(key, spr); stats.remoteBakes = (stats.remoteBakes || 0) + 1; stats.remoteMs = (stats.remoteMs || 0) + ms; stats.maxRemoteMs = Math.max(stats.maxRemoteMs || 0, ms); },
    /** Bak uten å returnere (forvarming i ledig tid). */
    warm(key, bakeFn) { if (!map.has(key)) { const t0 = now(); put(key, bakeFn()); const ms = now() - t0; stats.bakes++; stats.bakeMs += ms; stats.maxBakeMs = Math.max(stats.maxBakeMs, ms); } },
    clear() { map.clear(); bytes = 0; },
    bytes: () => bytes, count: () => map.size, keys: () => [...map.keys()],
  };
  return cache;
}
// Ledig-tid-kø for utsatte baker (kun cacher med opts.defer). Nyeste først, maks 48, ~6 ms per tikk.
const IQ = new Map(); let iqTimer = null;
function idleQueue(cache, key, fn) {
  const id = cache.stats.name + '|' + key; if (IQ.has(id)) IQ.delete(id); IQ.set(id, { cache, key, fn });
  while (IQ.size > 48) IQ.delete(IQ.keys().next().value);
  if (!iqTimer) iqTimer = setTimeout(runIdle, 0);
}
function runIdle() {
  iqTimer = null; const t0 = now();
  if (IQ.size) {   // v4.3: én bake per tikk (holder hver tikk kort)
    const id = [...IQ.keys()].pop(); const j = IQ.get(id); IQ.delete(id); j.cache.warm(j.key, j.fn); }
  if (IQ.size) iqTimer = setTimeout(runIdle, 4);
}
/** v4.3: be om baking i ledig tid uten å bake nå (valgfritt; brukes av faceted ved zoom-bytte). */
export function deferBake(cache, key, fn) { if (!cache.has(key)) idleQueue(cache, key, fn); }
export function idleQueueSize() { return IQ.size; }
export function sharedCache(id, opts = {}) { let c = REG.get(id); if (!c) { c = createSpriteCache({ name: id, ...opts }); REG.set(id, c); } return c; }
export function cacheReport() { return [...REG.values()].map(c => ({ ...c.stats, count: c.count(), bytes: c.bytes(), maxBytes: c.maxBytes })); }
export function clearAllCaches() { for (const c of REG.values()) c.clear(); }
