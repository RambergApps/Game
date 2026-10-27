import { PROJ as _P } from '../shared/projection.js';
// BREACH – gulv og lys for Kessa Yard (Effekter, 27.10). Mørk, kald, våt asfalt med slitte gule linjer og små, lokale lyskjegler.
// Arena kaller (fallback ved false/feil): bakeYardFloor(ctx, L, rng) → gulvlaget (erstatter drawFloor + drawPaint),
// drawLightPools(ctx, L, rng) → glødlaget (additivt, erstatter drawGlow), lightStyle(light) → { color, radius, intensity } per lampe.
// Alt bakes ved lasting (fritt budsjett). Ingenting tegnes per bilde herfra. Ingen shadowBlur.
const TAU = Math.PI * 2;
function canvas(w, h) { w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h)); if (typeof OffscreenCanvas !== 'undefined') { try { return new OffscreenCanvas(w, h); } catch (e) { /* */ } } const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function R0(rng) { const f = typeof rng === 'function' ? rng : Math.random; return { f, r: (a, b) => a + f() * (b - a), i: (a, b) => Math.floor(a + f() * (b - a + 1)) }; }
function blot(c, x, y, r, rgb, a, sy = 1) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.save(); c.translate(x, y); c.scale(1, sy); c.translate(-x, -y); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
// lavoppløst støy (glattes opp av drawImage) – billig «fbm»
function noise(w, h, R, dark, light, a = 255) { const c = canvas(w, h), x = c.getContext('2d'), id = x.createImageData(c.width, c.height); for (let i = 0; i < id.data.length; i += 4) { const v = R.f(); const col = v < 0.5 ? dark : light; id.data[i] = col[0]; id.data[i + 1] = col[1]; id.data[i + 2] = col[2]; id.data[i + 3] = Math.abs(v - 0.5) * 2 * a; } x.putImageData(id, 0, 0); return c; }

export const FLOOR = Object.freeze({ base: '#2a2e33', wet: [70, 90, 110], yellow: [196, 160, 52] });

/** Gulvlaget i verdenskoordinater (ctx har allerede Arenas RES-skala). Returnerer true = Arena hopper over drawFloor og drawPaint. */
export function bakeYardFloor(ctx, L, rng) {
  if (!L || !L.width) return false;
  const W = L.width, H = L.height, T = L.tile || 32, R = R0(rng);
  ctx.save();
  ctx.fillStyle = FLOOR.base; ctx.fillRect(0, 0, W, H);
  // storskala tonevariasjon (mørke og litt lysere/kalde partier), to oktaver
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.55; ctx.drawImage(noise(W / 64, H / 64, R, [12, 15, 19], [62, 70, 82]), 0, 0, W, H);
  ctx.globalAlpha = 0.35; ctx.drawImage(noise(W / 16, H / 16, R, [12, 13, 15], [66, 70, 78]), 0, 0, W, H);
  ctx.globalAlpha = 1;
  // asfaltkorn i full oppløsning (pikselrom)
  const m = ctx.getTransform(), gw = Math.ceil(W * m.a), gh = Math.ceil(H * m.d);
  { const gc = canvas(gw, gh), gx = gc.getContext('2d'), id = gx.createImageData(gc.width, gc.height), d = id.data; let s = (L.seed >>> 0) || 7;
    for (let i = 0; i < d.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const r = s / 4294967296, c = r < 0.5 ? 0 : 200; d[i] = c; d[i + 1] = c; d[i + 2] = c + (c ? 20 : 0); d[i + 3] = r < 0.03 || r > 0.975 ? 70 : Math.abs(r - 0.5) * 30; }
    gx.putImageData(id, 0, 0); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(gc, 0, 0); ctx.restore(); }
  // våte partier: kald blank hinne (svak), dekkspor
  for (let i = 0; i < 16; i++) blot(ctx, R.f() * W, R.f() * H, R.r(60, 160), '60,78,96', R.r(0.06, 0.13), R.r(0.4, 0.8));
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x0 = R.f() * W, y0 = R.f() * H, x1 = R.f() * W, y1 = R.f() * H, cx = R.f() * W, cy = R.f() * H; for (const o of [-9, 9]) { ctx.beginPath(); ctx.moveTo(x0 + o, y0); ctx.quadraticCurveTo(cx + o, cy, x1 + o, y1); ctx.strokeStyle = 'rgba(4,5,6,0.16)'; ctx.lineWidth = 6; ctx.stroke(); } }
  // reparerte felt (lappet asfalt) og plateskjøter
  for (let i = 0; i < 10; i++) { const x = R.f() * W, y = R.f() * H, w = R.r(40, 140), h = R.r(30, 90); ctx.fillStyle = `rgba(${R.f() < 0.5 ? '10,11,13' : '44,48,54'},${R.r(0.18, 0.32)})`; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, w, h); }
  // sprekker (mørk + svak lys kant)
  for (let i = 0; i < 90; i++) { let x = R.f() * W, y = R.f() * H, a = R.f() * TAU; const n = R.i(4, 14), pts = [[x, y]]; for (let k = 0; k < n; k++) { a += R.r(-0.8, 0.8); const l = R.r(3, 11); x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
    ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.strokeStyle = 'rgba(2,2,3,0.7)'; ctx.lineWidth = R.r(0.5, 1.3); ctx.stroke();
    ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + 0.7, py + 0.7) : ctx.moveTo(px + 0.7, py + 0.7))); ctx.strokeStyle = 'rgba(160,175,190,0.05)'; ctx.lineWidth = 0.5; ctx.stroke(); }
  // oljeflekker og rustrenner
  for (let i = 0; i < 30; i++) { let x = R.f() * W, y = R.f() * H; const n = R.i(3, 8), b = R.r(4, 12), a = R.f() * TAU; for (let k = 0; k < n; k++) { x += Math.cos(a) * b * 0.6 + R.r(-3, 3); y += Math.sin(a) * b * 0.6 + R.r(-3, 3); blot(ctx, x, y, b * R.r(0.6, 1.3), '3,3,4', R.r(0.18, 0.35)); } }
  for (let i = 0; i < 8; i++) blot(ctx, R.f() * W, R.f() * H, R.r(12, 30), '60,36,20', R.r(0.08, 0.15));
  // gule linjer (maling): kjørefelt fra L.paint.lanes, ellers en ramme rundt spilleområdet; slitt via destination-out
  paintLines(ctx, L, R, W, H, T);
  // pytter (lagres i L._puddles for Arenas refleks): mørk, kald, blank med svak lys kant
  L._puddles = [];
  for (let i = 0; i < 14; i++) {
    let x, y, tries = 0; do { x = R.r(2, (L.cols || W / T) - 2) * T; y = R.r(3, (L.rows || H / T) - 2) * T; tries++; } while (tries < 30 && (L.objects || []).some((o) => x > o.x - 40 && x < o.x + o.w + 40 && y > o.y - 40 && y < o.y + o.h + 24));
    const circles = []; for (let k = 0, n = R.i(4, 8); k < n; k++) circles.push([x + R.r(-28, 28), y + R.r(-12, 12), R.r(7, 17)]);
    L._puddles.push(circles);
    const path = (e) => { ctx.beginPath(); for (const [cx, cy, r] of circles) { ctx.moveTo(cx + r + e, cy); ctx.ellipse(cx, cy, r + e, (r + e) * 0.6, 0, 0, TAU); } };
    path(4); ctx.fillStyle = 'rgba(10,14,20,0.35)'; ctx.fill();
    path(0); ctx.fillStyle = 'rgba(14,20,28,0.65)'; ctx.fill();
    ctx.save(); path(0); ctx.clip(); for (const [cx, cy, r] of circles) blot(ctx, cx - r * 0.3, cy - r * 0.25, r * 0.9, '90,110,130', 0.18, 0.5); ctx.restore();
  }
  // inngangsplate (som Arenas, dempet) – maling må med når vi returnerer true
  const e = L.entry; if (e) { ctx.fillStyle = 'rgba(40,46,54,0.6)'; ctx.fillRect(e.x, e.y, e.w, e.h); ctx.strokeStyle = 'rgba(80,88,98,0.8)'; ctx.lineWidth = 1.6; ctx.strokeRect(e.x + 10, e.y + 10, e.w - 20, e.h - 20); ctx.strokeStyle = 'rgba(57,198,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(e.x + 14, e.y + 14, e.w - 28, e.h - 28);
    ctx.font = 'bold 13px "Arial Narrow", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(140,180,205,0.6)'; ctx.fillText('ENTRY', e.x + e.w / 2, e.y + e.h - 10); }
  // småskrot
  for (let i = 0; i < 300; i++) { const x = R.f() * W, y = R.f() * H, r = R.r(0.6, 2); ctx.fillStyle = R.f() < 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(170,175,180,0.12)'; ctx.fillRect(x, y, r, r * R.r(0.5, 1.5)); }
  ctx.restore();
  return true;
}
function paintLines(ctx, L, R, W, H, T) {
  const m = ctx.getTransform(), pc = canvas(W * m.a, H * m.d), p = pc.getContext('2d'); p.scale(m.a, m.d);
  const [yr, yg, yb] = FLOOR.yellow; p.strokeStyle = `rgb(${yr},${yg},${yb})`; p.lineCap = 'butt';
  const lanes = (L.paint && L.paint.lanes) || [];
  const line = (pts, w, dash) => { p.lineWidth = w; p.setLineDash(dash || []); p.beginPath(); pts.forEach(([x, y], i) => (i ? p.lineTo(x * T, y * T) : p.moveTo(x * T, y * T))); p.stroke(); };
  for (const ln of lanes) line(ln, 3.2, null);
  // ramme rundt spilleområdet (innenfor høy dekning langs kantene), som i målbildet
  const cols = L.cols || W / T, rows = L.rows || H / T, south = L.walkableSouth || rows - 2;
  line([[2.2, 5.6], [cols - 2.2, 5.6]], 3, null); line([[2.2, south - 0.6], [cols - 2.2, south - 0.6]], 3, [26, 10]);
  for (const o of L.objects || []) if (o.kind === 'container' || o.kind === 'stack') { p.setLineDash([]); p.lineWidth = 2.2; p.strokeRect(o.x - 7, o.y - 7, o.w + 14, o.h + 14); }
  // slitasje: hakk og avskalling
  p.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < W * H / 260; i++) { p.fillStyle = `rgba(0,0,0,${R.r(0.3, 1)})`; const s = R.r(0.8, 3.5); p.fillRect(R.f() * W, R.f() * H, s, s * R.r(0.4, 1)); }
  for (let i = 0; i < 40; i++) { const x = R.f() * W, y = R.f() * H, r = R.r(8, 30), g = p.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); p.fillStyle = g; p.fillRect(x - r, y - r, r * 2, r * 2); }
  p.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.85; ctx.drawImage(pc, 0, 0); ctx.restore();
}

/** Lampestil uten å endre dataene: mindre radius, mindre oransje, litt lavere intensitet. light = rad fra L.lights. */
export function lightStyle(l) {
  // Arena (index.js styleLight) bruker dette ÉN gang ved bygging: color/r/i erstattes. Vanlige lamper får vår natriumrav; spesiallys beholder sin farge.
  const c = l && l.color, special = l && (/alarm|spawn|beacon|flare|blue|red|hazard/.test(l.kind || '') || (c && (c[2] > c[0] || c[1] < c[0] * 0.45)));
  if (l && l._fx) return { color: l.color, radius: l.r, intensity: l.i };
  return { color: special && c ? c : SODIUM, radius: ((l && l.r) || 5) * 0.72, intensity: Math.min(1.5, ((l && l.i) ?? 1) * 1.35) };
}

// ---- lyskart-kroker (Arena: buildLightmap/lightPool/applyLight). Lyskartet er lagret med halv styrke (HDR 2):
// ut ≈ albedo·(amb + lys)·2 + albedo·lys·0,8·2 ≈ albedo·lys·3,6 i kjernen. Mørk asfalt ~(42,46,51): for gyllen ut ~(210,150,55)
// trengs lys/255 ≈ (1,0,0.8,0.3) → kjerne rgb(255,196,72) uten bleking mot hvitt; avtoning beholder metningen (ikke brunt: G holdes ≥ 0,7·R).
const SODIUM = [255, 135, 50];
const _pool = new Map();
function poolSprite(col, i) {
  const key = col.join(',') + '|' + Math.round(i * 20); let c = _pool.get(key); if (c) return c;
  const S = 128; c = canvas(S, S); const x = c.getContext('2d'), h = S / 2, [r, g, b] = col, A = (k) => Math.min(1, i * k).toFixed(3);
  const gr = x.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, `rgba(${r},${g},${b},${A(1)})`); gr.addColorStop(0.25, `rgba(${r},${g},${b},${A(1)})`);
  gr.addColorStop(0.45, `rgba(${r},${Math.round(g * 0.86)},${Math.round(b * 0.7)},${A(0.4)})`);
  gr.addColorStop(0.7, `rgba(${r},${Math.round(g * 0.72)},${Math.round(b * 0.55)},${A(0.1)})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, S, S); _pool.set(key, c); if (_pool.size > 64) _pool.delete(_pool.keys().next().value); return c;
}
/** Erstatter Arenas lightPool (lyskart + sprite-cache for dynamisk lys). Radius = lightStyle(l).radius·tile·1,4 (samme som Arena). */
export function lightmapPool(ctx, L, l, alphaMul = 1) {
  if (!L || !l) return false; const T = L.tile || 32, st = (L.lights || []).includes(l) || l.x === 0 ? { color: l.color || SODIUM, radius: l.r, intensity: l.i } : lightStyle(l), ls = (L.theme && L.theme.lightScale) || 1, r = st.radius * T * 1.4, i = st.intensity * alphaMul / ls * 1.25;
  const spr = poolSprite(st.color, Math.min(1.5, i)); ctx.save(); ctx.translate(l.x * T, l.y * T); let cx = 0;
  if (l.spread) { ctx.rotate(l.dir || 0); ctx.scale(1, l.spread); cx = r * 0.42; }
  ctx.drawImage(spr, cx - r, -r, r * 2, r * 2); ctx.restore(); return true;
}
/** Kald, mørk blågrå ambient (full skala; Arena halverer den selv). */
export function ambient(L) { return (L && L.theme && L.theme.fxAmbient) || 'rgb(118,116,122)'; }
export function vignette(L) { return 0.22; }

/** Glødlaget (additivt): bare svak bloom rundt lampehodet + varm glans i pytter nær lampa. Erstatter drawGlow. */
export function drawLightPools(ctx, L, rng) {
  if (!L || !L.lights) return false; const T = L.tile || 32;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of L.lights) {
    if (l.kind === 'beacon' || l.kind === 'flare' || l.kind === 'none') continue;
    const st = { color: l.color || SODIUM, radius: l.r, intensity: l.i }, x = l.x * T, y = l.y * T, r = st.radius * T, hy = l.kind === 'post' ? y - 19 : y - 1.5, [cr, cg, cb] = st.color, i = st.intensity;
    blot(ctx, x, y + 4, r * 0.5, `${cr},${cg},${cb}`, 0.07 * i, 0.9);
    for (const p of L._puddles || []) for (const [px, py, pr] of p) { const dd = Math.hypot(px - x, py - y); if (dd < r * 1.1) { const k = (1 - dd / (r * 1.1)) * i; blot(ctx, px, py, pr * 0.9, `${cr},${cg},${cb}`, 0.28 * k, 0.55); blot(ctx, px + (x - px) * 0.15, py + 2, pr * 0.35, '255,225,150', 0.4 * k, 0.4); } }
    blot(ctx, x, hy, 16, `${cr},${cg},${cb}`, 0.25 * i);
    blot(ctx, x, hy, 4, '255,236,190', 0.7);
    ctx.fillStyle = '#ffeec8'; ctx.fillRect(x - 3, hy - 1, 6, 2);
  }
  ctx.restore();
  return true;
}
export const drawFloor = bakeYardFloor;
export const drawGlow = drawLightPools;

// ---- kanter (kai/vann/plattform): flatt i det bakte gulvlaget, før lyset. Aldri over figurer (ingen dybdesortering, ingen høyde over gulvnivå).
// edge = { kind: 'quay'|'water'|'platform', x0, y0, x1, y1, side } i verdens-px; side = retningen fallet går mot.
export function drawEdge(ctx, L, e, rng) {
  if (!e || !/^(quay|water|platform)$/.test(e.kind)) return false;
  const R0_ = R0(rng), R = Object.assign(() => R0_.f(), R0_), T = (L && L.tile) || 32, horiz = e.side === 's' || e.side === 'n', sgn = e.side === 's' || e.side === 'e' ? 1 : -1;
  const len = horiz ? e.x1 - e.x0 : e.y1 - e.y0; if (len <= 0) return false;
  const zS = (_P && _P.zScale) || 1.428, K = e.kind === 'platform' ? 5 : 7, drop = e.kind === 'quay' ? Math.round(10 * zS) + 2 : e.kind === 'platform' ? 5 : 0;
  ctx.save();
  // lokal ramme: u langs kanten, v mot fallet (v>0 = fall/vann, v<0 = land)
  if (horiz) ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([1, 0, 0, sgn, e.x0, e.y0])));
  else ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([0, 1, sgn, 0, e.x0, e.y0])));
  // fall/kaivegg under gulvnivå (mot vannet)
  if (drop) {
    const gw = ctx.createLinearGradient(0, 0, 0, drop); gw.addColorStop(0, e.kind === 'quay' ? '#4a4a48' : 'rgba(0,0,0,0.55)'); gw.addColorStop(0.5, e.kind === 'quay' ? '#2b2c2b' : 'rgba(0,0,0,0.3)'); gw.addColorStop(1, e.kind === 'quay' ? '#151718' : 'rgba(0,0,0,0)');
    ctx.fillStyle = gw; ctx.fillRect(0, 0, len, drop);
    if (e.kind === 'quay') {
      for (let u = R.r(4, 20); u < len; u += R.r(18, 40)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(u, 0, 1, drop); }          // blokkfuger
      for (let i = 0; i < len / 10; i++) { const u = R.r(0, len); blot(ctx, u, drop * R.r(0.55, 0.9), R.r(3, 8), R() < 0.6 ? '30,46,30' : '86,48,24', R.r(0.25, 0.5), 0.5); }   // alge/rust
      ctx.fillStyle = 'rgba(120,150,160,0.18)'; ctx.fillRect(0, drop * 0.62, len, 0.8);                                                  // fuktlinje
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, drop - 1.5, len, 1.5);                                                          // vannkontakt
    }
  }
  // kantstein (land-siden, v ∈ [-K, 0]) – lys betong/granitt, slitt
  const gs = ctx.createLinearGradient(0, -K, 0, 0); gs.addColorStop(0, '#6e6c66'); gs.addColorStop(0.35, '#8b8880'); gs.addColorStop(1, '#5d5b56');
  ctx.fillStyle = gs; ctx.fillRect(0, -K, len, K);
  for (let u = R.r(10, 30); u < len; u += R.r(26, 44)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(u, -K, 0.8, K); }
  for (let i = 0; i < len / 6; i++) { const u = R.r(0, len), w = R.r(1, 4); ctx.fillStyle = `rgba(20,20,20,${R.r(0.25, 0.55)})`; ctx.fillRect(u, -R.r(0.6, 1.6), w, R.r(0.6, 1.6)); }   // avskalling mot fallet
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, -K, len, 0.7);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, -K - 1, len, 1);                                                                    // kontaktlinje mot asfalten
  // gul-svart varselstripe innenfor kantsteinen
  const sw = 3; ctx.save(); ctx.beginPath(); ctx.rect(0, -K - 1 - sw, len, sw); ctx.clip(); ctx.fillStyle = '#c9a334'; ctx.fillRect(0, -K - 1 - sw, len, sw);
  ctx.fillStyle = '#16161a'; for (let u = -8; u < len + 8; u += 8) { ctx.beginPath(); ctx.moveTo(u, -K - 1); ctx.lineTo(u + 4, -K - 1); ctx.lineTo(u + 7, -K - 1 - sw); ctx.lineTo(u + 3, -K - 1 - sw); ctx.fill(); }
  ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < len / 5; i++) { ctx.fillStyle = `rgba(0,0,0,${R.r(0.2, 0.6)})`; ctx.fillRect(R.r(0, len), -K - 1 - sw, R.r(1, 5), sw); } ctx.restore();
  // pullerter: flate sirkler ovenfra (kontaktskygge + høylys), ingen høyde
  if (e.kind !== 'platform') for (let u = R.r(T * 0.8, T * 1.6); u < len - 6; u += R.r(T * 2.5, T * 3.5)) {
    const v = -K / 2, r = 3.6; blot(ctx, u + 1.2, v + 1.2, r + 2.5, '0,0,0', 0.55);
    ctx.fillStyle = '#2d3033'; ctx.beginPath(); ctx.arc(u, v, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a4f53'; ctx.beginPath(); ctx.arc(u - 0.4, v - 0.4, r * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,60,30,0.35)'; ctx.beginPath(); ctx.arc(u + 0.8, v + 0.6, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(u - 1.6, v - 1.8, 1.4, 0.9);
  }
  ctx.restore();
  return true;
}

// ---- vann (havn): bakt i gulvlaget etter lyset. Mørkt grågrønt, dypere bort fra kaien, brutte refleksjoner,
// vertikalt strukne varme lampegjenskinn, oljefilm + skum mot kaiveggen. Toppen (kaiveggen fra drawEdge) males ikke over.
export function drawWater(ctx, L, w, rng) {
  if (!w || !(w.w > 0 && w.h > 0)) return false;
  const R0_ = R0(rng), R = Object.assign(() => R0_.f(), R0_), zS = (_P && _P.zScale) || 1.428, drop = Math.round(10 * zS) + 2;
  const ws = ((L && L.objects) || []).filter((o) => o.kind === 'water');
  const isW = (x, y) => ws.some((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
  const landN = !isW(w.x + w.w / 2, w.y - 2), x = w.x, W = w.w, y0 = w.y, y = w.y + (landN ? drop : 0), H = w.h - (landN ? drop : 0); if (H <= 0) return true;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y0, W, w.h); ctx.clip(); ctx.fillStyle = '#161e20'; ctx.fillRect(x, y0, W, w.h);
  const g = ctx.createLinearGradient(0, y, 0, y + H); g.addColorStop(0, landN ? '#222c2e' : '#1f282a'); g.addColorStop(0.35, '#1c2527'); g.addColorStop(1, '#12191b');
  ctx.fillStyle = g; ctx.fillRect(x, y, W, H);
  for (let i = 0; i < W * H / 900; i++) blot(ctx, x + R() * W, y + R() * H, R.r(10, 30), R() < 0.5 ? '8,12,13' : '40,52,54', R.r(0.12, 0.25), 0.4);   // dybdeflekker
  // brutte bølgerefleksjoner (korte, horisontale streker, svakere med dybde)
  for (let i = 0; i < W * H / 120; i++) { const yy = y + R() * H, k = 1 - (yy - y) / H, l = R.r(3, 12); ctx.fillStyle = `rgba(190,215,205,${(0.1 + 0.18 * k) * R.r(0.5, 1)})`; ctx.fillRect(x + R() * W, yy, l, 0.7); }
  // lampegjenskinn: vertikalt strukket, brutt i streker
  const T = (L && L.tile) || 32;
  for (const l of (L && L.lights) || []) { const lx = l.x * T, ly = l.y * T; if (lx < x - 40 || lx > x + W + 40 || ly < w.y - 4 * T || ly > w.y + w.h) continue;
    const c = l.color || SODIUM, len = Math.min(H, 70), k = Math.max(0, 1 - (w.y - ly) / (4 * T)) * (l.i || 1);
    for (let j = 0; j < 22; j++) { const t = j / 22, yy = y + 2 + t * len, ww = (6 + R() * 10) * (1 - t * 0.5), a = (0.4 * (1 - t) + 0.05) * k * R.r(0.5, 1);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`; ctx.fillRect(lx - ww / 2 + R.r(-3, 3), yy, ww, R.r(0.8, 1.8)); }
    blot(ctx, lx, y + 10, 14, `${c[0]},${c[1]},${c[2]}`, 0.18 * k, 2.2); }
  if (landN) {   // oljefilm og skum mot kaiveggen
    for (let i = 0; i < W / 30; i++) blot(ctx, x + R() * W, y + R.r(3, 14), R.r(8, 18), R() < 0.5 ? '70,40,80' : '40,80,70', 0.1, 0.35);
    for (let u = 0; u < W; u += R.r(2, 6)) { ctx.fillStyle = `rgba(190,200,190,${R.r(0.1, 0.35)})`; ctx.fillRect(x + u, y + R.r(0, 2.5), R.r(1, 4), 0.8); }
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, W, 1.5);
  }
  ctx.restore(); return true;
}

// ---- liv per bilde (billig: ferdigbakte spriter/mønstre, cull mot view, egen RNG, ingen setTransform)
function hash(a, b) { let h = (Math.imul(Math.round(a * 97) | 0, 73856093) ^ Math.imul(Math.round(b * 89) | 0, 19349663)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h % 10000) / 10000; }
let _wave = null, _glint = null, _dust = null, _ring = null;
function lifeSprites() {
  if (_wave) return;
  const R = R0(((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(7));
  _wave = canvas(256, 64); let x = _wave.getContext('2d');
  for (let i = 0; i < 90; i++) { const px = R.r(0, 256), py = R.r(0, 64), l = R.r(4, 16), a = R.r(0.25, 0.7); for (const o of [-256, 0, 256]) { x.fillStyle = `rgba(200,225,215,${a.toFixed(2)})`; x.fillRect(px + o, py, l, 1); } }
  _glint = canvas(16, 4); x = _glint.getContext('2d'); let g = x.createLinearGradient(0, 0, 16, 0); g.addColorStop(0, 'rgba(255,170,80,0)'); g.addColorStop(0.5, 'rgba(255,200,120,1)'); g.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = g; x.fillRect(0, 1, 16, 2);
  _dust = canvas(64, 64); x = _dust.getContext('2d'); g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,215,170,0.12)'); g.addColorStop(0.45, 'rgba(255,215,170,0.2)'); g.addColorStop(0.72, 'rgba(255,215,170,0.5)'); g.addColorStop(0.88, 'rgba(255,215,170,0.22)'); g.addColorStop(1, 'rgba(255,215,170,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);   // ring: tett i kjeglekanten, tynt i midten
  _ring = canvas(32, 32); x = _ring.getContext('2d'); x.strokeStyle = 'rgba(200,215,220,0.8)'; x.lineWidth = 1.2; x.beginPath(); x.arc(16, 16, 13, 0, TAU); x.stroke();
}
function lifeData(L) {
  if (L._life) return L._life; const T = L.tile || 32, zS = (_P && _P.zScale) || 1.428, drop = Math.round(10 * zS) + 2;
  const ws = (L.objects || []).filter((o) => o.kind === 'water'), isW = (x, y) => ws.some((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
  const waters = ws.map((w) => { const landN = !isW(w.x + w.w / 2, w.y - 2), y = w.y + (landN ? drop : 0);
    const glints = (L.lights || []).filter((l) => { const lx = l.x * T, ly = l.y * T; return lx > w.x - 30 && lx < w.x + w.w + 30 && ly > w.y - 4 * T && ly < w.y + w.h; }).map((l) => ({ x: l.x * T, k: Math.max(0.2, 1 - (w.y - l.y * T) / (4 * T)) * (l.i || 1), c: l.color }));
    return { w, landN, y, h: w.y + w.h - y, glints }; });
  return (L._life = { waters, pud: (L._puddles || []).slice(0, 14) });
}
const vis = (v, x0, y0, x1, y1) => !v || (x1 >= v.x0 && x0 <= v.x1 && y1 >= v.y0 && y0 <= v.y1);
/** Gulvnivå, under figurene: rullende bølgestriper, glitrende lampegjenskinn, skvulp mot kaien, sjeldne ringer i pytter. */
export function drawFloorLife(ctx, L, t, view) {
  if (!L) return false; lifeSprites(); const D = lifeData(L); t = t || 0;
  for (const q of D.waters) { const { w } = q; if (!vis(view, w.x, q.y, w.x + w.w, q.y + q.h)) continue;
    ctx.save();
    const x0 = Math.max(w.x, view ? view.x0 : w.x), x1 = Math.min(w.x + w.w, view ? view.x1 : w.x + w.w), y0 = Math.max(q.y, view ? view.y0 : q.y), y1 = Math.min(q.y + q.h, view ? view.y1 : q.y + q.h);
    if (!_wave._pat) _wave._pat = ctx.createPattern(_wave, 'repeat');
    const pat = _wave._pat; if (pat.setTransform) pat.setTransform(new DOMMatrix([1, 0, 0, 1, w.x + ((t * 8) % 256), q.y + Math.sin(t * 0.7) * 1.5]));
    ctx.globalAlpha = 0.14; ctx.fillStyle = pat; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of q.glints) { if (g.x < x0 - 20 || g.x > x1 + 20) continue;
      for (let j = 0; j < 6; j++) { const tt = j / 6, yy = q.y + 3 + tt * Math.min(q.h, 64), sw = Math.sin(t * 1.6 + j * 1.3) * (2 + tt * 4), fl = 0.55 + 0.45 * Math.sin(t * 5.3 + j * 2.1);
        ctx.globalAlpha = Math.min(1, 0.9 * g.k * (1 - tt * 0.8) * fl); ctx.drawImage(_glint, g.x - 8 + sw - tt * 4, yy, 16 + tt * 10, 2.5); } }
    ctx.globalCompositeOperation = 'source-over';
    if (q.landN) { for (let xx = x0 - (x0 % 18); xx < x1; xx += 30) { const s = Math.sin(t * 1.3 + xx * 0.11); ctx.globalAlpha = 0.25 + 0.2 * s; ctx.fillStyle = '#c8d2cc'; ctx.fillRect(xx + s * 3, q.y + 1 + (1 + s) * 1.2, 6 + 3 * s, 0.9); } }
    ctx.restore(); }
  // sjeldne ringer i pytter (fast pool, deterministisk fra t)
  const P = D.pud; if (P.length) { ctx.save(); for (let k = 0; k < 2; k++) { const per = 2.6, cyc = Math.floor(t / per + k * 0.5), ph = (t / per + k * 0.5) - cyc, c = P[Math.floor(hash(cyc, k) * P.length)]; if (!c || !c[0]) continue;
      const [px, py, pr] = c[0]; if (!vis(view, px - 10, py - 10, px + 10, py + 10)) continue; const r = 2 + ph * Math.min(10, pr * 0.6); ctx.globalAlpha = 0.35 * (1 - ph); ctx.drawImage(_ring, px - r, py - r * 0.6, r * 2, r * 1.2); } ctx.restore(); }
  return true;
}
/** Over scenen (additivt, svakt): store myke damp-/støvspriter som driver i lyskjeglene. */
export function drawAirLife(ctx, L, t, view) {
  if (!L || !L.lights) return false; lifeSprites(); const T = L.tile || 32; t = t || 0;
  ctx.save();
  for (const l of L.lights) { const x = l.x * T, y = l.y * T, r = (l.r || 5) * T * 0.6; if (!vis(view, x - r, y - r, x + r, y + r)) continue;
    const h = hash(l.x, l.y), f = lampFlicker(l, t);
    for (let k = 0; k < 1; k++) { const ph = t * (0.05 + 0.03 * k) + h * 6 + k * 3, dx = Math.sin(ph) * r * 0.5, dy = Math.cos(ph * 0.8) * r * 0.25 - k * 6, s = r * 0.32;
      const S2 = r * 0.45; ctx.globalAlpha = 0.2 * f * (0.75 + 0.25 * Math.sin(ph * 2.1)); ctx.drawImage(_dust, x + dx * 0.25 - S2, y + dy * 0.25 - S2 * 0.6, S2 * 2, S2 * 1.2); } }
  ctx.restore(); return true;
}
/** 0..1 – flimring for ca. 15 % av lampene (valgt med seed fra posisjon). Arena ganger den inn i alfa for lys og lampefot. */
export function lampFlicker(l, t) {
  if (!l) return 1; const h = hash(l.x, l.y); if (h > 0.15 && !l.flicker) return 1;
  const s = Math.sin(t * 13 + h * 50) * Math.sin(t * 3.1 + h * 20); const drop = (Math.floor(t * 6 + h * 9) % 23 === 0) ? 0.45 : 0; return Math.max(0, Math.min(1, 0.9 + 0.1 * s - drop));
}
