// BREACH – Variant C (prototype, Breach Warden-design 2026-10-23): malt overkropp (sprite per retning) + bein på rigg + rifle fra Våpens geometri.
// Ikke koblet inn i spillet. Testside: test.html. Alle mål i verdens-px; tegnes med ctx skalert (zoom).
// Konvensjon: vinkel 0 = øst, positiv med klokka (canvas, y ned). Skjerm = (x, y − z·zScale).
import { PROJ } from '../../projection.js';
import { LIGHT_DIR, LIGHT_ELEVATION } from '../../light.js';

const ZS = PROJ.zScale;
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const L3 = (() => { const c = Math.cos(LIGHT_ELEVATION); return { x: LIGHT_DIR.x * c, y: LIGHT_DIR.y * c, z: Math.sin(LIGHT_ELEVATION) }; })();
const VIEW = { x: 0, y: Math.sin(PROJ.tilt), z: Math.cos(PROJ.tilt) };   // mot kamera
const SPRITE_SCALE = 4;
// 27.10 (55°): overkroppen er malt for legacy (høyde 0,75 skjerm-px per z). Skaleres i y med PROJ.screenZ (= sin tilt) så den passer beina.
// Mål: hjelmtoppen ved ca. z 52 (PROJ.heights.actor 48 + antenne/kant) → høyde = (52 − belte-z) · screenZ i skjermenheter.
const UH = 121 / SPRITE_SCALE, BELT_Z = 19.8;
const KZ = PROJ.legacy ? 1 : Math.max(0.6, Math.min(1.25, (52 - BELT_Z) * PROJ.screenZ / UH));
const KX = PROJ.legacy ? 1 : Math.max(0.85, Math.min(1, 0.5 + 0.5 * KZ));   // litt smalere når den kortes inn (slankere silhuett som målbildet)   // img/upper_*.png er malt/nedskalert til 4×
export const PAL = { // WARDEN-DESIGN.md
  suit: '#1c2024', armorD: '#3a3f45', armor: '#5a6068', armorL: '#7d858e', spec: '#c3c9ce', blue: '#2f5f93', blueL: '#4f86c4', sole: '#141619', rim: '#dfe6ea',
};

// ---------------------------------------------------------------- lasting
const IMG = {};
export async function loadPaintedC(base = new URL('./img/', import.meta.url)) {
  const meta = await (await fetch(new URL('meta.json', base))).json();
  const load = (n) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = new URL(n, base).href; });
  for (const d of DIRS) IMG['upper_' + d] = { img: await load(`upper_${d}.png`), ...meta.upper[d] };
  for (const n of ['thigh', 'knee', 'shin', 'boot']) IMG['leg_' + n] = await load(`leg_${n}.png`);
  if (meta.dark) for (const n of ['thigh', 'knee', 'shin', 'boot']) IMG['leg_' + n + '_d'] = await load(`leg_${n}_d.png`);   // r2: forhåndsmørket
  return IMG;
}
export const dirIndex = (a) => ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;

// ---------------------------------------------------------------- gange (sagittalplan)
/** Grep (handR) i verden. 2026-10-27: kortere fram i E/W så rifla sitter i hånden (malt hånd ligger nær kroppen i profil). */
export function gripOf(x, y, aim, dz = 0) { const c = Math.cos(aim), s = Math.sin(aim), f = 5 - 3.6 * c * c, r = 3.2 - 1.2 * c * c; return { x: x + c * f - s * r, y: y + s * f + c * r, z: PROJ.aimHeight - 2 + dz }; }
const LT = 11, LS = 10.5, ANK = 2.6, HIP_W = 4.6;
/** phase: null = stå/sikt, ellers 0..1 i syklusen. Returnerer vinkler per bein (hofte, kne) og bekkenhøyde. */
function gait(phase, kneel = 0) {
  const legs = [0, 1].map((i) => {
    if (phase == null || kneel > 0.5) { const k = kneel; return { th: (i ? -0.06 : 0.1) + k * (i ? 0.35 : 1.25), kn: 0.12 + (i ? 0.02 : 0.06) + k * (i ? 1.9 : 1.55) }; }   // 2026-10-27: kne/dekning
    const p = (phase + i * 0.5) * Math.PI * 2;
    const th = 0.42 * Math.sin(p);                       // hoftesving
    const kn = 0.08 + 0.75 * Math.max(0, Math.sin(p + 1.9)) ** 1.5;   // kneet bøyes i svingfasen
    return { th, kn };
  });
  let reach = 0;
  for (const l of legs) { l.ts = l.th - l.kn; reach = Math.max(reach, LT * Math.cos(l.th) + LS * Math.cos(l.ts)); }
  return { legs, hipZ: ANK + reach };
}

// ---------------------------------------------------------------- hjelpere
/** 27.10: kameraets bakkeforkorting (PROJ.groundScaleY) leses fra ctx – malte bilder (skjermkunst) strekkes 1/g i y så de ikke klemmes. */
let IG = 1; const setIG = (ctx) => { const m = ctx.getTransform(); IG = Math.abs(m.d) > 1e-6 ? Math.abs(m.a / m.d) : 1; };
const scr = (p) => ({ x: p.x, y: p.y - p.z * ZS });
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
function taper(ctx, A, B, wA, wB, fill) {   // avsmalnende kvad A→B med bredder
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  ctx.beginPath();
  ctx.moveTo(A.x + nx * wA / 2, A.y + ny * wA / 2);
  ctx.quadraticCurveTo((A.x + B.x) / 2 + nx * (wA + wB) / 3.6, (A.y + B.y) / 2 + ny * (wA + wB) / 3.6, B.x + nx * wB / 2, B.y + ny * wB / 2);
  ctx.lineTo(B.x - nx * wB / 2, B.y - ny * wB / 2);
  ctx.quadraticCurveTo((A.x + B.x) / 2 - nx * (wA + wB) / 3.6, (A.y + B.y) / 2 - ny * (wA + wB) / 3.6, A.x - nx * wA / 2, A.y - ny * wA / 2);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
/** Myk sylindergradient på tvers av segmentet: lys mot LIGHT_DIR (skjerm), mørk på motsatt side. */
function cylGrad(ctx, A, B, w, base, hiK = 1.7, loK = 0.45) {
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l;
  if (nx * LIGHT_DIR.x + ny * LIGHT_DIR.y < 0) { nx = -nx; ny = -ny; }   // n peker mot lyset
  const m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const g = ctx.createLinearGradient(m.x + nx * w / 2, m.y + ny * w / 2, m.x - nx * w / 2, m.y - ny * w / 2);
  g.addColorStop(0, shade(base, hiK * 0.85)); g.addColorStop(0.18, shade(base, hiK)); g.addColorStop(0.45, shade(base, 1.0)); g.addColorStop(1, shade(base, loK));
  return g;
}

// ---------------------------------------------------------------- bein: prosedyral (loft + avfaset kneplate + støvel)
function legProc(ctx, J, f, dark) {
  const { hip, knee, ank, toe, heel } = J;
  const H = scr(hip), K = scr(knee), A = scr(ank), T = scr(toe), Hl = scr(heel);
  const k = dark ? 0.72 : 1;
  // lår: drakt under, så blå/grå lårplate
  taper(ctx, H, K, 7.2, 4.6, cylGrad(ctx, H, K, 7.2, shade(PAL.suit, 1.4 * k).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, b) => '#' + [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join(''))));
  const Hp = { x: H.x + (K.x - H.x) * 0.12, y: H.y + (K.y - H.y) * 0.12 }, Kp = { x: H.x + (K.x - H.x) * 0.78, y: H.y + (K.y - H.y) * 0.78 };
  taper(ctx, Hp, Kp, 6.4, 4.4, cylGrad(ctx, Hp, Kp, 6.4, k < 1 ? '#2a4a72' : PAL.blue, 1.9, 0.5));
  // legg
  taper(ctx, K, A, 4.8, 3.0, cylGrad(ctx, K, A, 4.8, k < 1 ? '#40464d' : PAL.armor, 1.6, 0.45));
  const Ks = { x: K.x + (A.x - K.x) * 0.15, y: K.y + (A.y - K.y) * 0.15 }, As = { x: K.x + (A.x - K.x) * 0.7, y: K.y + (A.y - K.y) * 0.7 };
  taper(ctx, Ks, As, 3.6, 2.4, cylGrad(ctx, Ks, As, 3.6, k < 1 ? '#555c64' : PAL.armorL, 1.5, 0.5));
  // støvel: såle (mørk, tykk), overdel med tåhette, mansjett
  const fx = T.x - Hl.x, fy = T.y - Hl.y, fl = Math.hypot(fx, fy) || 1;
  ctx.save();
  ctx.translate(A.x, A.y + 0.4);
  const ang = Math.atan2(fy, fx), sideOn = Math.min(1, fl / 6.5);
  ctx.rotate(ang); ctx.scale(1, 1);
  const len = Math.max(3.4, fl), back = len * 0.28, w = 3.4 + (1 - sideOn) * 1.0;
  // såle
  ctx.beginPath(); ctx.roundRect(-back - 0.3, -w / 2 - 0.2 + 1.1, len + 0.8, w + 0.4, 1.6); ctx.fillStyle = PAL.sole; ctx.fill();
  // overdel
  const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  g.addColorStop(0, shade(PAL.armor, 1.7 * k)); g.addColorStop(0.4, shade(PAL.armorD, 1.1 * k)); g.addColorStop(1, shade(PAL.armorD, 0.5 * k));
  ctx.beginPath(); ctx.roundRect(-back, -w / 2, len, w, [1.2, w / 2, w / 2, 1.2]); ctx.fillStyle = g; ctx.fill();
  // tåhette-glans
  ctx.beginPath(); ctx.ellipse(len - back - 1.4, -w * 0.18, 1.1, 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(223,230,234,${0.55 * k})`; ctx.fill();
  ctx.restore();
  // mansjett
  ctx.beginPath(); ctx.ellipse(A.x, A.y - 0.6, 2.0, 1.2, 0, 0, Math.PI * 2); ctx.fillStyle = shade(PAL.armorD, 0.8 * k); ctx.fill();
  // kneplate: avfaset åttekant, radial glans
  const kd = { x: f.x * 1.3, y: f.y * 1.3 };
  const C = { x: K.x + kd.x, y: K.y + kd.y - 0.6 };
  const r = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; ctx.lineTo(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r * 1.05); }
  ctx.closePath();
  const rg = ctx.createRadialGradient(C.x + LIGHT_DIR.x * 1.2, C.y + LIGHT_DIR.y * 1.2, 0.2, C.x, C.y, r * 1.3);
  rg.addColorStop(0, shade(PAL.spec, k)); rg.addColorStop(0.35, shade(PAL.armorL, k)); rg.addColorStop(1, shade(PAL.armorD, 0.7 * k));
  ctx.fillStyle = rg; ctx.fill();
  ctx.lineWidth = 0.35; ctx.strokeStyle = `rgba(10,12,14,0.8)`; ctx.stroke();
}

// ---------------------------------------------------------------- bein: malte deler (lår, legg, støvel, kneplate) fra legparts
function partAlong(ctx, img, A, B, w, ext0 = 0.1, ext1 = 0.1) {
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 0.01;
  ctx.save(); ctx.translate(A.x, A.y); ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  ctx.drawImage(img, -w / 2, -l * ext0, w, l * (1 + ext0 + ext1)); ctx.restore();
}
function legPainted(ctx, J, f, dark) {
  // 2026-10-27: retningsavhengig. f = bevegelsesretning (verden). fr > 0 = fronten mot kamera (sør), < 0 = ryggen; sd = profil.
  const H = scr(J.hip), K = scr(J.knee), A = scr(J.ank), T = scr(J.toe), Hl = scr(J.heel);
  const P = (n) => (dark && IMG['leg_' + n + '_d']) || IMG['leg_' + n];
  if (dark && !IMG.leg_thigh_d) ctx.filter = 'brightness(0.68)';
  const fr = f.y, sd = Math.abs(f.x), back = Math.max(0, -fr), frontK = Math.max(0, fr);
  const wk = 0.78 + 0.22 * Math.abs(fr);   // profil: smalere lår/legg
  partAlong(ctx, P('thigh'), H, K, 8.4 * wk, 0.12, 0.08);
  partAlong(ctx, P('shin'), K, A, 6.2 * wk, 0.08, 0.05);
  if (back > 0.15) {   // bakside: drakt/legg-bakside (mørk, uten pansring foran) + leggmuskel-skygge
    taper(ctx, H, K, 7.4 * wk, 5.2 * wk, `rgba(22,26,32,${0.62 * back})`);
    taper(ctx, K, A, 5.6 * wk, 3.6 * wk, `rgba(18,22,28,${0.5 * back})`);
  }
  legLight(ctx, H, K, 7.6 * wk); legLight(ctx, K, A, 5.6 * wk);
  // støvel: profil (malt sidebilde) skaleres med |f.x| og speiles etter retning; forfra/bakfra egen tå/hæl
  const bh = 6.2, bw = 3.6 + 4.2 * sd;
  ctx.save(); ctx.translate(A.x, A.y + 1.2); ctx.scale(1, IG);
  if (f.x < -0.05) ctx.scale(-1, 1);
  ctx.drawImage(P('boot'), -bw * 0.35, -bh * 0.75, bw, bh); ctx.restore();
  if (frontK > 0.35) {   // tåhette mot kamera, lyst kant
    ctx.beginPath(); ctx.ellipse(A.x + (T.x - A.x) * 0.55, A.y + 1.6 + (T.y - A.y) * 0.55, 2.6, 1.8, 0, 0, Math.PI * 2); ctx.fillStyle = dark ? '#2a3038' : '#3d4652'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(A.x + (T.x - A.x) * 0.55, A.y + 1.0 + (T.y - A.y) * 0.55, 1.5, 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(200,220,240,${0.5 * frontK})`; ctx.fill();
  } else if (back > 0.35) {   // hæl og såle mot kamera
    ctx.beginPath(); ctx.ellipse(A.x, A.y + 1.6, 2.5, 1.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#121418'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(A.x, A.y + 0.9, 1.8, 0.7, 0, 0, Math.PI * 2); ctx.fillStyle = '#2a3038'; ctx.fill();
  }
  // kneplate: bare på framsiden; i profil stikker den fram i gangretningen, bakfra skjult
  const kv = Math.min(1, (fr + 0.35) / 0.9);
  if (kv > 0.05) {
    const C = { x: K.x + f.x * (1.2 + 1.4 * sd), y: K.y + f.y * 1.2 - 0.5 }, kw = 6.0 * (0.55 + 0.45 * Math.abs(fr) + 0.0);
    ctx.globalAlpha *= kv; ctx.drawImage(P('knee'), C.x - kw / 2, C.y - 3.4 * IG, kw, 6.8 * IG); ctx.globalAlpha /= kv;
  } else {   // knehase bakfra
    ctx.beginPath(); ctx.ellipse(K.x, K.y, 2.2, 1.2, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,12,16,0.6)'; ctx.fill();
  }
  ctx.filter = 'none';
}

/** Runde 2: felles lys fra LIGHT_DIR over de malte delene, så alle retninger får samme lysside (malt lys er fast i bildet). */
function legLight(ctx, A, B, w) {
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l;
  if (nx * LIGHT_DIR.x + ny * LIGHT_DIR.y < 0) { nx = -nx; ny = -ny; }
  const m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const g = ctx.createLinearGradient(m.x + nx * w / 2, m.y + ny * w / 2, m.x - nx * w / 2, m.y - ny * w / 2);
  g.addColorStop(0, 'rgba(230,240,250,0.34)'); g.addColorStop(0.3, 'rgba(230,240,250,0.10)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(4,8,14,0.55)');
  taper(ctx, A, B, w, w * 0.7, g);
}

// ---------------------------------------------------------------- rifle fra Våpens geometri (bokser, flatskygge, LIGHT_DIR)
const hexK = (hex, k) => shade(hex, k);
export function drawRifle(ctx, look, origin, a, zoom = 1) {
  const c = Math.cos(a), s = Math.sin(a);
  const W = (p) => ({ x: origin.x + p.x * c - p.y * s, y: origin.y + p.x * s + p.y * c, z: origin.z + p.z });
  const N = (n) => ({ x: n.x * c - n.y * s, y: n.x * s + n.y * c, z: n.z });
  const faces = [];
  const pal = look.palette;
  for (const p of look.parts) {
    if (p.minScale && p.minScale > zoom * 1.01) continue;
    const col = pal[p.mat] || pal.metal;
    let boxes = [];
    if (p.box) boxes.push(p.box);
    else if (p.beam) { const [e0, e1] = p.beam; boxes.push([e0.x, e1.x, -p.w / 2, p.w / 2, e0.z - p.h / 2, e0.z + p.h / 2]); }
    for (const [x0, x1, y0, y1, z0, z1] of boxes) {
      const v = (x, y, z) => W({ x, y, z });
      const F = [
        [[v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], { x: 0, y: 0, z: 1 }],
        [[v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)], { x: 0, y: 1, z: 0 }],
        [[v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], { x: 0, y: -1, z: 0 }],
        [[v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)], { x: 1, y: 0, z: 0 }],
        [[v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)], { x: -1, y: 0, z: 0 }],
      ];
      for (const [pts, n0] of F) {
        const n = N(n0); if (n.x * VIEW.x + n.y * VIEW.y + n.z * VIEW.z <= 0.02) continue;
        const lit = Math.max(0, n.x * L3.x + n.y * L3.y + n.z * L3.z);
        const dep = pts.reduce((q, P) => q + P.y + P.z * 0.6, 0) / 4;
        faces.push({ pts, col: hexK(col, 0.55 + 0.95 * lit + (n0.z ? 0.15 : 0)), dep, edge: n0.z === 1 });
      }
    }
    if (p.plate) {
      const n = N(p.n); if (n.x * VIEW.x + n.y * VIEW.y + n.z * VIEW.z > 0.02) {
        const pts = p.plate.map(W); const dep = pts.reduce((q, P) => q + P.y + P.z * 0.6, 0) / 4 + 0.05;
        faces.push({ pts, col: p.mat === 'led' ? '#7fe3ff' : hexK(col, 1.15), dep: dep + 0.5, edge: false });
      }
    }
  }
  faces.sort((A, B) => A.dep - B.dep);
  for (const fc of faces) {
    ctx.beginPath(); fc.pts.forEach((P, i) => { const q = scr(P); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath(); ctx.fillStyle = fc.col; ctx.fill();
    ctx.lineWidth = 0.25; ctx.strokeStyle = fc.edge ? 'rgba(195,201,206,0.35)' : 'rgba(8,10,12,0.5)'; ctx.stroke();
  }
}

// ---------------------------------------------------------------- hele figuren
/**
 * drawWardenC(ctx, { x, y, aim, move, phase, legs: 'proc'|'painted', look, zoom })
 *  aim  – siktevinkel (overkropp velges blant 8 malte retninger, rifla roteres fritt)
 *  move – bevegelsesretning for beina (torso-vridning = aim − move, beina har egen retning)
 */
export function drawWardenC(ctx, o) {
  setIG(ctx);
  const { x = 0, y = 0, aim = 0, phase = null, legs = 'proc', look, zoom = 1, kneel = 0, gunZ = 0, alpha = 1, up: UP = null, lie = 0 } = o;
  const move = o.move ?? aim;
  const fw = { x: Math.cos(move), y: Math.sin(move) }, rt = { x: -fw.y, y: fw.x };
  const G = gait(phase, kneel);
  const bob = G.hipZ - gait(null).hipZ;
  ctx.globalAlpha = alpha;
  const J = G.legs.map((l, i) => {
    const side = i ? -1 : 1;   // 0 = høyre bein
    const hip = { x: x + rt.x * HIP_W * side * 0.5, y: y + rt.y * HIP_W * side * 0.5, z: G.hipZ };
    const kz = hip.z - LT * Math.cos(l.th), ks = LT * Math.sin(l.th);
    const knee = { x: hip.x + fw.x * ks, y: hip.y + fw.y * ks, z: kz };
    const az = kz - LS * Math.cos(l.ts), as = ks + LS * Math.sin(l.ts);
    const ank = { x: hip.x + fw.x * as, y: hip.y + fw.y * as, z: az };
    const lift = Math.max(0, az - ANK) * 0.25;
    const toe = { x: ank.x + fw.x * 4.6, y: ank.y + fw.y * 4.6, z: az - ANK + lift * (l.th < 0 ? -1 : 1) };
    const heel = { x: ank.x - fw.x * 1.6, y: ank.y - fw.y * 1.6, z: az - ANK };
    return { hip, knee, ank, toe, heel, side };
  });
  if (lie > 0) for (const j of J) {   // 2026-10-27: død – beina legges ned bak hofta (lerp fra knestilling)
    const L = (a, b) => ({ x: a.x + (b.x - a.x) * lie, y: a.y + (b.y - a.y) * lie, z: a.z + (b.z - a.z) * lie });
    const h0 = { x: j.hip.x - fw.x * 4, y: j.hip.y - fw.y * 4, z: 3 }, sx = j.hip.x - x, sy = j.hip.y - y;
    const k0 = { x: x + sx * 1.3 - fw.x * (4 + LT), y: y + sy * 1.3 - fw.y * (4 + LT), z: 2.5 };
    const a0 = { x: x + sx * 1.6 - fw.x * (4 + LT + LS), y: y + sy * 1.6 - fw.y * (4 + LT + LS), z: 2.2 };
    j.hip = L(j.hip, h0); j.knee = L(j.knee, k0); j.ank = L(j.ank, a0);
    j.toe = L(j.toe, { x: a0.x - fw.x * 1.5, y: a0.y - fw.y * 1.5, z: 6 }); j.heel = L(j.heel, { x: a0.x - fw.x * 0.5, y: a0.y - fw.y * 0.5, z: 0.5 });
  }
  // nær/fjern bein: større skjerm-y (nærmere kamera) tegnes sist
  const order = [0, 1].sort((a, b) => (J[a].hip.y - J[b].hip.y) || (a - b));
  const drawLeg = legs === 'painted' ? legPainted : legProc;
  // kontaktskygge
  ctx.save(); ctx.translate(x + 2, y + 1); ctx.scale(1, 0.5); { const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 12.5); sg.addColorStop(0, 'rgba(0,0,0,0.42)'); sg.addColorStop(0.7, 'rgba(0,0,0,0.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; } ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();   // r2: gradient i stedet for blur-filter
  ctx.filter = 'none';
  const front = Math.sin(aim) > -0.35;    // rifla foran overkroppen (sikter ikke bort fra kamera)
  const grip = gripOf(x, y, aim, bob + gunZ);
  J.forEach((j, i) => { j.dark = i === order[0] && Math.abs(J[0].hip.y - J[1].hip.y) > 0.5; });
  drawLeg(ctx, J[order[0]], fw, J[order[0]].dark);
  drawLeg(ctx, J[order[1]], fw, false);
  if (look && !front) drawRifle(ctx, look, grip, aim, zoom);
  const u = IMG['upper_' + DIRS[dirIndex(aim)]];
  const belt = scr({ x, y, z: G.hipZ - 4.2 + 3.2 * Math.max(0, Math.sin(aim)) * (1 - kneel) });   // 2026-10-27: S/SW/SE – overkroppen litt opp så beina ses
  const sc = 1 / SPRITE_SCALE;
  if (UP) {   // rull/død: rotasjon + sammenpressing rundt midten av overkroppen
    const cx = belt.x + (UP.dx || 0), yS = IG * KZ * (1 - lie) + lie * Math.max(1, 0.45 * IG * KZ), cy = belt.y + lie * (G.hipZ - 6) * ZS - u.ay * sc * 0.45 * yS + (UP.dy || 0);   // 27.10 (55°): liggende overkropp ligger i bakkeplanet (ingen 1/g-strekk, belte nær bakken)
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, yS); ctx.rotate(UP.rot || 0); ctx.scale(1, UP.sy ?? 1);
    ctx.drawImage(u.img, -u.ax * sc * KX, -u.ay * sc * 0.55, u.w * sc * KX, u.h * sc); ctx.restore();
  } else ctx.drawImage(u.img, belt.x - u.ax * sc * KX, belt.y - u.ay * sc * IG * KZ, u.w * sc * KX, u.h * sc * IG * KZ);
  if (look && front) drawRifle(ctx, look, grip, aim, zoom);
  ctx.globalAlpha = 1;
  return { muzzle: (() => { const m = look?.points?.muzzle; if (!m) return null; const c = Math.cos(aim), s = Math.sin(aim); return { x: grip.x + m.x * c - m.y * s, y: grip.y + m.x * s + m.y * c, z: grip.z + m.z }; })() };
}
export { DIRS };
export const hipBob = (phase, kneel = 0) => gait(phase, kneel).hipZ - gait(null).hipZ;
