// BREACH – Effekter: dekalsprites for Arenas dekningskrok (addCoverDecal). Arena baker dem inn i sin sprite-cache og klipper til flaten.
//   drawDecalSprite(ctx, kind, r, angle, seed)        – kald (permanent) dekal, sentrert i (0,0) i ctx sin nåværende transform
//   drawDecalHot(ctx, kind, r, angle, seed, heat)     – varmt overlegg (glødende metall / fersk ichor), heat 0..1, 'lighter'
//   kinds: bullet_metal (r 2–3) · bullet_concrete (r 3–5) · scorch (r 10–40) · ichor (r 4–12, størknet tjære, svak oransje kant) · slash (r 6–14)
// r = synlig radius i px (ikke spritens halvbredde). angle i radianer (retning for ichor/slash). seed = heltall (variant).
// Ingen gradienter per kall, ingen shadowBlur – bare drawImage av cachede sprites. Tegner aldri utenfor ±r·1.3.
import * as S from './sprites.js';

export const DECAL_KINDS = ['bullet_metal', 'bullet_concrete', 'scorch', 'ichor', 'slash'];
const TAU = Math.PI * 2;
// spritens halvbredde / synlig radius
const K = { bullet_metal: 32 / 7, bullet_concrete: 32 / 8, scorch: 1.12, ichor: 2.1, slash: 1.15 };
const NV = 6;   // varianter per kulehull (26.10: mørkere og mer varierte, Arena: «nesten som nagler»)

// Uregelmessig omriss: radius som funksjon av vinkel (lav-frekvent støy + noen hakk)
function blob(R, n, base, rough) { const a = []; const ph = [R() * TAU, R() * TAU, R() * TAU];
  for (let i = 0; i < n; i++) { const t = i / n * TAU; a.push(base * (1 + rough * (0.5 * Math.sin(t * 2 + ph[0]) + 0.3 * Math.sin(t * 3 + ph[1]) + 0.25 * Math.sin(t * 5 + ph[2]) + (R() - 0.5) * 0.5))); } return a; }
function path(x, cx, cy, rs, sx = 1, sy = 1) { x.beginPath(); rs.forEach((r, i) => { const t = i / rs.length * TAU, px = cx + Math.cos(t) * r * sx, py = cy + Math.sin(t) * r * sy; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); }
/** Kulehull i dekning (64×64, synlig radius ≈ 7 px i spriten). metal: mørkt slag, utbulet/revet kant, avskallet maling, sot og rustkant.
 *  concrete: mørk krater med lysere avskalling rundt og små biter. */
function coverHole(kind, v) {
  return S.memoSprite(`cvh_${kind}${v}`, () => {
    const N = 64, c = S.makeCanvas(N, N), x = c.getContext('2d'), R = S.mulberry(7100 + v * 31 + (kind === 'metal' ? 0 : 500)), C = 32;
    const sc = 0.75 + R() * 0.55, ox = (R() - 0.5) * 2, oy = (R() - 0.5) * 2, el = 0.8 + R() * 0.4;   // størrelse/form varierer per variant
    if (kind === 'metal') {
      // sot (stor, myk, mørk) – forskjøvet litt
      const g = x.createRadialGradient(C + ox * 2, C + oy * 2, 0, C + ox * 2, C + oy * 2, 20 * sc); g.addColorStop(0, 'rgba(14,12,10,.55)'); g.addColorStop(0.5, 'rgba(18,15,12,.22)'); g.addColorStop(1, 'rgba(18,15,12,0)');
      x.fillStyle = g; x.fillRect(0, 0, N, N);
      // avskallet maling: uregelmessig flekk der grunnmetallet (mørk grå) synes
      x.fillStyle = 'rgba(70,68,64,.75)'; path(x, C + ox, C + oy, blob(R, 18, 10 * sc, 0.55), 1, el); x.fill();
      // rustkant
      x.strokeStyle = 'rgba(122,58,22,.55)'; x.lineWidth = 1.6; path(x, C + ox, C + oy, blob(R, 18, 10.5 * sc, 0.55), 1, el); x.stroke();
      // revet/utbulet kant (litt lysere metall på lyssiden, nordvest)
      const rim = blob(R, 14, 5.2 * sc, 0.35); x.fillStyle = 'rgba(96,92,86,.9)'; path(x, C, C, rim, 1, el); x.fill();
      x.fillStyle = 'rgba(150,144,132,.35)'; path(x, C - 0.8, C - 0.8, rim.map((r) => r * 0.92), 1, el); x.fill();
      // selve hullet: nesten svart, uregelmessig
      x.fillStyle = 'rgb(8,7,6)'; path(x, C + 0.4, C + 0.4, blob(R, 12, 3.4 * sc, 0.4), 1, el); x.fill();
      // små maling-flak rundt
      for (let i = 0; i < 4 + (v % 3); i++) { const a = R() * TAU, d = (11 + R() * 6) * sc; x.fillStyle = R() < 0.5 ? 'rgba(60,56,52,.6)' : 'rgba(110,52,20,.45)'; x.fillRect(C + Math.cos(a) * d, C + Math.sin(a) * d * el, 1 + R() * 1.8, 1 + R() * 1.4); }
    } else {
      const g = x.createRadialGradient(C, C, 0, C, C, 17 * sc); g.addColorStop(0, 'rgba(30,28,26,.35)'); g.addColorStop(1, 'rgba(30,28,26,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N);
      x.fillStyle = 'rgba(176,170,160,.38)'; path(x, C + ox, C + oy, blob(R, 16, 11 * sc, 0.7), 1, el); x.fill();      // avskalling (lys, frisk betong)
      x.fillStyle = 'rgba(70,66,62,.85)'; path(x, C, C, blob(R, 14, 6.5 * sc, 0.5), 1, el); x.fill();
      x.fillStyle = 'rgb(18,17,16)'; path(x, C + 0.5, C + 0.6, blob(R, 12, 3.6 * sc, 0.45), 1, el); x.fill();
      for (let i = 0; i < 5; i++) { const a = R() * TAU, d = (12 + R() * 8) * sc; x.fillStyle = 'rgba(40,38,36,.7)'; x.fillRect(C + Math.cos(a) * d, C + Math.sin(a) * d, 1 + R() * 1.5, 1 + R()); }
    }
    // varmt overlegg (metall): glødende kant rundt hullet
    const h = S.makeCanvas(N, N), hx = h.getContext('2d');
    if (kind === 'metal') { const hg = hx.createRadialGradient(C, C, 2 * sc, C, C, 8 * sc); hg.addColorStop(0, 'rgba(255,200,120,1)'); hg.addColorStop(0.45, 'rgba(255,110,30,.8)'); hg.addColorStop(1, 'rgba(160,30,0,0)'); hx.fillStyle = hg; hx.fillRect(0, 0, N, N); }
    return { base: c, hot: kind === 'metal' ? h : null };
  });
}

function slash(v) {
  return S.memoSprite(`slash${v}`, () => {
    const N = 64, c = S.makeCanvas(N, N), x = c.getContext('2d'), R = S.mulberry(4400 + v * 13);
    // 2–3 parallelle hakk (kolbe/klo): mørk fure med lys avskallet kant på lyssiden
    const n = 2 + (v % 2), gap = 9;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap + (R() - 0.5) * 2, len = 22 + R() * 8, x0 = 32 - len, x1 = 32 + len, bow = (R() - 0.5) * 6;
      x.lineCap = 'round';
      x.strokeStyle = 'rgba(200,196,188,.35)'; x.lineWidth = 4.2; x.beginPath(); x.moveTo(x0, 32 + off - 1.2); x.quadraticCurveTo(32, 32 + off + bow - 1.2, x1, 32 + off - 1.2); x.stroke();
      x.strokeStyle = 'rgba(14,13,12,.9)'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(x0 + 2, 32 + off); x.quadraticCurveTo(32, 32 + off + bow, x1 - 2, 32 + off); x.stroke();
      for (let k = 0; k < 4; k++) { const t = R(), px = x0 + (x1 - x0) * t, py = 32 + off + bow * 4 * t * (1 - t); x.fillStyle = 'rgba(30,28,26,.6)'; x.fillRect(px, py + 1.5, 1.5, 1.2); }
    }
    return c;
  });
}
function ichorCover(v) {   // flat, størknet tjære sentrert (ichorSplat er forskjøvet mot sprutretningen): beskjær rundt hovedpølen
  return S.memoSprite(`ichorCover${v}`, () => {
    const sp = S.ichorSplat(v), N = 96, c = S.makeCanvas(N, N), x = c.getContext('2d');
    for (let i = 0; i < 3; i++) x.drawImage(sp.base, 46 - 48, 64 - 48, N, N, 0, 0, N, N);   // 3× = tett tjære (spriten er halvgjennomsiktig)
    // svak oransje kant: hot-laget svakt og uskarpt forskjøvet
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(10,7,6,.86)'; x.fillRect(0, 0, N, N);   // 26.10: mørk tjære (ikke brun)
    x.globalAlpha = 1; x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, N, 40);   // svak blank refleks
    // oransje kant: omrisset (alfa-kant) forskjøvet innover → tynn glødende rand
    const e = S.makeCanvas(N, N), ex = e.getContext('2d'); ex.drawImage(sp.base, 46 - 48, 64 - 48, N, N, 0, 0, N, N); ex.globalCompositeOperation = 'source-in'; ex.fillStyle = 'rgb(230,96,22)'; ex.fillRect(0, 0, N, N);
    ex.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 5; i++) ex.drawImage(sp.base, 46 - 48 + 1.4, 64 - 48 + 1.4, N, N, 0, 0, N, N);   // 5× = hel maske, bare randen blir igjen
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.75; x.drawImage(e, 0, 0); x.globalAlpha = 0.1; x.drawImage(sp.hot, 46 - 48, 64 - 48, N, N, 0, 0, N, N);
    const h = S.makeCanvas(N, N); h.getContext('2d').drawImage(sp.hot, 46 - 48, 64 - 48, N, N, 0, 0, N, N);
    return { base: c, hot: h };
  });
}
function pick(kind, seed) {
  const v = Math.abs(seed | 0);
  switch (kind) {
    case 'bullet_metal': { const h = coverHole('metal', v % NV); return [h.base, h.hot]; }
    case 'bullet_concrete': { const h = coverHole('concrete', v % NV); return [h.base, null]; }
    case 'scorch': return [S.scorch(v % 3), null];
    case 'ichor': { const s = ichorCover(v % 4); return [s.base, s.hot]; }
    case 'slash': return [slash(v % 4), null];
    default: return [null, null];
  }
}
function put(ctx, img, kind, r, angle) {
  const h = r * (K[kind] || 1); const tr = ctx.getTransform();
  ctx.rotate(angle || 0); ctx.drawImage(img, -h, -h, h * 2, h * 2); ctx.setTransform(tr);
}
/** Kald dekal. Tegnes med ctx sin globalAlpha / blandemodus (source-over). Returnerer false for ukjent type. */
export function drawDecalSprite(ctx, kind, r, angle = 0, seed = 0) {
  try { const [base] = pick(kind, seed); if (!base || !(r > 0)) return false; put(ctx, base, kind, r, angle); return true; }
  catch (e) { return false; }
}
/** Varmt overlegg (additivt). heat 1 = nytt, 0 = kaldt. Bare bullet_metal og ichor har varme. */
export function drawDecalHot(ctx, kind, r, angle = 0, seed = 0, heat = 1) {
  try {
    const [, hot] = pick(kind, seed); if (!hot || !(heat > 0.02)) return false;
    const a = ctx.globalAlpha, g = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * Math.min(1, heat);
    put(ctx, hot, kind, r, angle); ctx.globalAlpha = a; ctx.globalCompositeOperation = g; return true;
  } catch (e) { return false; }
}
/** Varighet for varmt øyeblikk (s) per type – brukt av bind.js for o.hotDecals. */
export const HOT_TIME = { bullet_metal: 0.9, ichor: 0.7 };
