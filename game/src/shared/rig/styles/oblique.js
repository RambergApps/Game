// Tegnestil «oblique» (Warden v3, trekvart pseudo-3D) – eies av Breach Karakter. Runde 2, 2026-10-23.
//
// Riggen er uendret (samme skjelett K, F-ramme, fri 360°, torsovridning, gange, kne, peek, blindfire, rull, slide, skjerf).
// Stilen løfter hver kroppsdel til en z-høyde og beskriver den som et lite konvekst VOLUM (ellipsoide, kapsel eller
// loft av ringer) i verdensrom. Hvert volum projiseres med PROJ (skjerm = x, y − z·0,75), skjermens konvekse skall
// fylles med v2s malte teksturer (painted.js: metall/stoff/maling/kantslitasje) og males mykt med gradienter langs
// volumet fra LIGHT_DIR/LIGHT_ELEVATION (varm nøkkel, kjølig skygge, topplys, AO nederst, høylys). Bokser får i tillegg
// en lys toppflate og myk front/side-forskjell så de leser trekvart. Delene males bakfra og fram (dybde langs V).
// Figuren tegnes i en offscreen-buffer i skjermoppløsning → tynn mørk kontur rundt hele silhuetten + kantlys fra
// LIGHT_DIR (READABILITY.rim) og svakt kaldt motlys (READABILITY.back) → leser mot travelt gulv ved 2×.
// Kontrakt: style = { name, drawFigure(ctx, rig, F, opts), sortKey(F) }. Ingen endring i rig.js/painted.js.
import { PROJ } from '../../projection.js';
import { LIGHT_DIR, LIGHT_ELEVATION, READABILITY } from '../../light.js';
import { api as PAPI, registerPaint } from './painted.js';
import { skinOf } from '../skins.js';

const TAU = Math.PI * 2, Z = PROJ.zScale;
const OBL = READABILITY.oblique || { scale: 1, rim: { alpha: .8, px: 1.2, color: '255,228,178' }, contour: { px: 1.1, alpha: .9 } };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ce = Math.cos(LIGHT_ELEVATION), se = Math.sin(LIGHT_ELEVATION);
const L3 = [LIGHT_DIR.x * ce, LIGHT_DIR.y * ce, se];
const VL = Math.hypot(1, Z); const V = [0, Z / VL, 1 / VL];          // mot betrakteren
const SHK = [-L3[0] / L3[2], -L3[1] / L3[2]];                         // bakkeskygge: p.xy + z·SHK
const L2 = (() => { const x = L3[0], y = L3[1] - L3[2] * Z, l = Math.hypot(x, y); return [x / l, y / l]; })(); // lys i skjermplan
const hasDOM = typeof document !== 'undefined';

// ================================================================== PALETT (bytt farger HER – alt annet leser herfra)
// Runde 3: PAL limt inn uendret fra docs/WARDEN-DESIGN.md §3.1 (kald gunmetal, mørk drakt, kaldt kantlys per figur).
// Per materiale: tint = multiply over teksturen (tone), lift = screen-løft (lyshet). Øvrige: RGB-strenger 'r,g,b' eller CSS.
export const PAL = {
  armor:  { tint: [200, 208, 216], lift: [62, 68, 76] },    // kald gunmetal (torso, knær)
  armorL: { tint: [214, 222, 230], lift: [84, 90, 98] },    // lys plate ≈ #7d858e i lys
  helm:   { tint: [222, 228, 234], lift: [96, 102, 110] },  // hjelmkuppel ≈ #98a0a8, lyseste del
  suit:   { lift: [8, 10, 12] },                            // nesten svart drakt #1c2024
  fabric: { lift: [46, 38, 24] },
  pouch:  { lift: [40, 40, 28] },                           // sekk/belte, grønngrå canvas
  boot:   { lift: [14, 13, 12] },
  glove:  { lift: [26, 27, 28] },
  gun:    { tint: [120, 130, 140], lift: [18, 21, 24] },    // #2b3036
  gunL:   { tint: [140, 150, 160], lift: [26, 29, 32] },    // #59626c-kanter
  key:    '214,222,230',                                    // kald nøkkellys-vask
  shade:  ['214,218,224', '96,102,112'],
  ao:     '24,26,30',
  spec:   '236,244,250',                                    // kaldt høylys / blankt stål
  topFace: ['236,242,246', '205,214,222'],
  partEdge: '12,14,16',
  visor: '11,42,54', helmDetail: ['20,22,24', '16,18,20'],   // visirglass #0b2a36
  contour: '10,12,15',                                      // kjølig mørk kontur
  scarf:  { dark: '26,17,9', base: '#a8814f', hi: '216,182,126' },   // uendret
  // NYE nøkler (trenger kode i oblique.js):
  pauldron: { base: '#2f5f93', chevron: '#e4e0d4' },        // begge skulderplater
  packLed:  '57,198,255',                                   // cyan stripe + LED på sekken (additiv)
  rim:      '223,230,234',                                  // Wardens kalde kantlys (overstyrer light.js per figur)
  // Tillegg fra fargetabellen (§2/§3), ikke i §3.1-blokken:
  visorCore: '57,198,255', visorHot: '184,243,255', bloom: .35,          // visir: kjerne #39c6ff, varmeste #b8f3ff, bloom 35 %
  gunStripe: '60,134,200',                                               // kort blå stripe på geværet #3c86c8
  wear: { steel: '195,201,206', mud: '74,59,44', rust: '107,74,50', soot: '35,32,29' },   // slitasje §2.7
};
const PAINT_SURFACE = true;    // malt overflate (strøk, avskallinger, gjørme/rust/sot nederst) bakt i blob-cachen

// materialer: tex = painted-tekstur, k = teksturskala, lift = løft (lysere/varmere enn v2), wear = kantslitasje
const MAT = {
  // Runde 2 (normal zoom): varmere og lysere rustning/hjelm, mørk drakt for kontrast (lys plate mot mørk kjerne).
  armor:  { tex: 'armor',  k: .075, key: .7, spec: .45, wear: .9, paint: 1 },
  armorL: { tex: 'armorL', k: .075, key: .7, spec: .5, wear: 1.1, paint: 1 },
  suit:   { tex: 'fabric', k: .06,  key: .4, spec: .08, wear: 0, dim: .6, paint: .5 },
  fabric: { tex: 'fabric', k: .06,  key: .5, spec: .05, wear: 0 },
  pouch:  { tex: 'pouch',  k: .07,  key: .55, spec: .08, wear: .25, paint: .6 },
  helm:   { tex: 'armorL', k: .075, key: .72, spec: .75, wear: 1, paint: 1 },
  boot:   { tex: 'boot',   k: .07,  key: .45, spec: .15, wear: .4, paint: .5 },
  gun:    { tex: 'gun',    k: .07,  key: .5, spec: .55, wear: .8, paint: .4 },
  gunL:   { tex: 'armor',  k: .07,  key: .5, spec: .55, wear: 1, paint: .5 },
  glove:  { tex: 'suit',   k: .05,  key: .45, spec: .1, wear: .3, paint: .4 },
  knee:   { tex: 'armor',  k: .075, key: .7, spec: .45, wear: 1.2, paint: 1, mud: 1, pal: 'armor' },     // kneplater: gjørme/rust
  pauldron: { tex: 'armorL', k: .075, key: .6, spec: .4, wear: 1.2, paint: .8 },                         // blå maling (PAL.pauldron.base)
  scarfC: { tex: 'fabric', k: .06, key: .55, spec: .05, wear: 0, paint: .7, pal: 'scarf' },              // skjerfkrage (PAL.scarf.base)
};
for (const k of ['boot']) MAT[k].mud = 1; MAT.suit.mud = .45; MAT.armor.mud = .25; MAT.pouch.mud = .5;

// ------------------------------------------------------------------ geometri-hjelpere
function frameT(ox, oy, oz, a, s = 1, pitch = 0) {
  const c = Math.cos(a), sn = Math.sin(a), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (x, y, z) => { const x1 = x * cp - z * sp, z1 = x * sp + z * cp; return [ox + s * (c * x1 - sn * y), oy + s * (sn * x1 + c * y), oz + s * z1]; };
}
// Bakkeplan-skala rundt fotpunktet (READABILITY.oblique.scale): settes per figur i renderFigure; høyden (z) skaleres ikke.
let AX = 0, AY = 0, SC = 1;
const proj = (p) => [AX + (p[0] - AX) * SC, AY + (p[1] - AY) * SC - p[2] * Z];
const dotV = (p) => p[1] * V[1] + p[2] * V[2];
function hull(P) { // Andrew monotone chain, P = [[x,y]...] → CCW skall
  const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function ellPts(T, ax, ay, az, nA = 10, nE = 5) { // ellipsoide i lokalrom T
  const out = []; for (let j = 0; j <= nE; j++) { const e = -Math.PI / 2 + j / nE * Math.PI, ce = Math.cos(e), se = Math.sin(e);
    const n = (j === 0 || j === nE) ? 1 : nA; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push(T(Math.cos(a) * ce * ax, Math.sin(a) * ce * ay, se * az)); } } return out;
}
function sphPts(C, r, n = 8) { const T = (x, y, z) => [C[0] + x, C[1] + y, C[2] + z]; return ellPts(T, r, r, r, n, 4); }
const rect8 = (hx, hy, c) => [[hx, -hy + c], [hx, hy - c], [hx - c, hy], [-hx + c, hy], [-hx, hy - c], [-hx, -hy + c], [-hx + c, -hy], [hx - c, -hy]];
const ringAt = (T, pts, z, dx = 0, dy = 0) => pts.map(([x, y]) => T(x + dx, y + dy, z));

// ------------------------------------------------------------------ bygg Warden-volum fra F
// Felles kroppsramme (brukes av buildWarden OG socketZ, så sockets får nøyaktig samme høyde som det som tegnes).
const G_LEN = .62, G_TH = 1.7;   // rifle AR-9: lengdefaktor og tykkelse (§2.6)
function bodyFrame(F) {
  const K = F.skel; const P = F.posture || {};
  const kn = P.kneel || 0, roll = P.roll || 0, slide = P.slide || 0;
  const hScale = F.mode === 'death' ? 1 : (F.height || 1);   // død: liggeposen styres av fall (layDown), ikke av høyde
  let hipZ = lerp(22, 12, kn) * Math.min(1, .45 + hScale * .55);
  hipZ = lerp(hipZ, 9, roll); hipZ = lerp(hipZ, 10, slide);
  const bob = .9 * (F.amp || 0) * (.5 - .5 * Math.cos((F.phase || 0) * 2 * TAU));
  const pz = hipZ - bob;
  const s = K.s; const pitch = -.14 * kn - .9 * roll + .32 * slide;
  const TTp = frameT(K.ox, K.oy, pz, K.ta, s, pitch);
  const gunZ = pz + lerp(11.0, 10.2, kn) * s;
  const W = (gx, gy, gz) => { const [lx, ly] = K.R2L(gx * G_LEN, gy); return TTp(lx, ly, (gz * G_TH + gunZ - pz) / s); };
  const hzc = pz + lerp(19.8, 18.2, kn) * s;
  return { K, kn, roll, slide, pz, s, pitch, TTp, gunZ, W, hzc };
}
/** Høyde z (verdens-px over bakken, samme enhet som PROJ.heights) for en rigg-socket slik oblique tegner den. */
export function socketZ(F, name) {
  if (!F || !F.skel) return 0;
  const B = bodyFrame(F); let z;
  switch (name) {
    case 'muzzle': z = B.W(34, 0, .45)[2]; break;                       // munningen (tuppen av det tegnede løpet)
    case 'butt': z = B.W(-11, 0, -.3)[2]; break;
    case 'handR': case 'throwHand': z = B.W(5, 1.8 / G_TH, -.8)[2]; break;
    case 'handL': z = B.W(21.5, -.9 / G_TH, -.6)[2]; break;
    case 'head': z = B.TTp(1.6 + B.kn * 2, 0, (B.hzc - B.pz) / B.s)[2]; break;   // hjelmsenter
    case 'chest': z = B.TTp(5, 0, 9)[2]; break;
    case 'back': z = B.TTp(-10.2, 0, 7)[2]; break;
    default: return 0;
  }
  const dk = F.mode === 'death' ? (F.clip?.death ? F.clip.death.fall : 1) : 0;   // liggende: alt nær bakken
  return lerp(z, Math.min(z, 3), dk);
}
/** Tegnet munningstupp i verden (x, y, z) i oblique – bakkeplan-skala (READABILITY.oblique.scale) rundt fotpunktet tatt med. */
export function muzzleDraw(F) {
  const B = bodyFrame(F), q = B.W(34, 0, .45), sc = OBL.scale ?? 1;
  return { x: F.x + (q[0] - F.x) * sc, y: F.y + (q[1] - F.y) * sc, z: socketZ(F, 'muzzle') };
}

export function buildWarden(F) {
  const parts = [];
  const { K, kn, roll, slide, pz, s, pitch, TTp, gunZ, W, hzc } = bodyFrame(F);
  const add = (o) => { parts.push(o); return o; };
  const vol = (pts, mat, o = {}) => add({ pts, mat, ...o });
  const hip = F.hipAngle, hc = Math.cos(hip), hs = Math.sin(hip);
  const Hw = (lx, ly) => [F.x + hc * lx - hs * ly, F.y + hs * lx + hc * ly];
  // ---- bein: tydelige lår/legger, kne og støvel; fotplanting fra riggens feet (lift = svingfase)
  for (const f of F.feet) {
    const s = f.s; const [hx, hy] = Hw(0, s * 4.8); const lift = (f.lift || 0) * 4.5;
    const ank = [f.wx, f.wy, 2.8 + lift];
    const [kx0, ky0] = Hw(f.kx, f.ky);
    const kneeZ = lerp(lerp(12 + lift * .7, s < 0 ? 9.5 : 2.4, kn), 7, roll);
    const fwd = (1.6 + lift * .4) * (1 - kn);
    const kneeW = [lerp((hx + ank[0]) / 2, kx0, .5 + .5 * kn) + hc * fwd, lerp((hy + ank[1]) / 2, ky0, .5 + .5 * kn) + hs * fwd, kneeZ];
    const hipW = [hx, hy, pz - 1.5];
    vol([...sphPts(hipW, 3.9, 6), ...sphPts(kneeW, 3.2, 6)], 'suit', { kind: 'limb' });
    vol([...sphPts(kneeW, 3.1, 6), ...sphPts(ank, 2.6, 6)], 'suit', { kind: 'limb' });
    vol(ellPts(frameT(kneeW[0] + hc * 1.5, kneeW[1] + hs * 1.5, kneeW[2] + .4, hip), 2.0, 2.5, 2.6, 8, 3), 'knee', { kind: 'pad', bias: .2 });
    const fa = hip + (f.fa || 0); const TB = frameT(f.wx, f.wy, lift, fa);
    vol([...ringAt(TB, rect8(5.0, 2.8, 1.2), 0, 1.4), ...ringAt(TB, rect8(4.8, 2.7, 1.2), 1.9, 1.4), ...ringAt(TB, rect8(3.3, 2.5, 1.0), 4.2, .3)], 'boot', { kind: 'box', top: ringAt(TB, rect8(3.3, 2.5, 1.0), 4.2, .3) });
  }
  // ---- torso (K-rom), lener i kne/rull/slide
  const dirOf = (x, y, z) => { const a = TTp(x, y, z), o = TTp(0, 0, 0); return [a[0] - o[0], a[1] - o[1], a[2] - o[2]]; };
  vol([...ringAt(TTp, rect8(4.4, 6.8, 2), -1.8), ...ringAt(TTp, rect8(4.8, 7.2, 2), 2.4)], 'pouch', { kind: 'box', top: ringAt(TTp, rect8(4.8, 7.2, 2), 2.4) });
  const torsoTop = ringAt(TTp, rect8(5.0, 8.2, 2.6), 14.6);
  vol([...ringAt(TTp, rect8(4.6, 7.0, 2.2), 2.0), ...ringAt(TTp, rect8(6.0, 9.4, 2.8), 8.0), ...ringAt(TTp, rect8(6.3, 9.8, 3.0), 12.6), ...torsoTop], 'armor', { kind: 'box', top: torsoTop });
  // bred brystplate (lysere), sitter foran
  const chestTop = ringAt(TTp, rect8(1.0, 6.2, .8), 13.6, 5.6);
  vol([...ringAt(TTp, rect8(1.3, 5.6, 1.0), 4.4, 5.6), ...ringAt(TTp, rect8(1.5, 6.8, 1.0), 11.8, 5.9), ...chestTop], 'armorL', { kind: 'box', top: chestTop, bias: .6 });
  // ---- sekk (§2.4/§5B): ≈ 14 × 8 i grunnplan, z ≈ 20–38 (rel. hofte −2…16), lys toppflate, lokk-linje, cyan stripe + LED
  const PX = -10.2, PHX = 4.0, PHY = 7.0, PZ0 = -2, PZ1 = 16.2;
  const packTop = ringAt(TTp, rect8(PHX - .3, PHY - .3, 1.3), PZ1, PX);
  vol([...ringAt(TTp, rect8(PHX - .2, PHY - .3, 1.4), PZ0, PX), ...ringAt(TTp, rect8(PHX, PHY, 1.5), PZ1 - 3.2, PX), ...packTop], 'pouch', { kind: 'box', top: packTop, bias: -.4, own: true,
    lid: ringAt(TTp, rect8(PHX + .02, PHY + .02, 1.5), PZ1 - 3.2, PX),
    glow: [
      { pts: [TTp(PX - 1.6, -4.6, PZ1 + .05), TTp(PX - 1.6, 4.6, PZ1 + .05), TTp(PX - 2.9, 4.6, PZ1 + .05), TTp(PX - 2.9, -4.6, PZ1 + .05)], n: [0, 0, 1] },          // stripe på toppen
      { pts: [TTp(PX - PHX - .05, -4.2, PZ1 - 4.6), TTp(PX - PHX - .05, 4.2, PZ1 - 4.6), TTp(PX - PHX - .05, 4.2, PZ1 - 5.9), TTp(PX - PHX - .05, -4.2, PZ1 - 5.9)], n: [-1, 0, 0] }, // stripe bakpå
      { pts: [TTp(PX - 1.4, -PHY - .05, 6.4), TTp(PX + .6, -PHY - .05, 6.4), TTp(PX + .6, -PHY - .05, 8.6), TTp(PX - 1.4, -PHY - .05, 8.6)], n: [0, -1, 0], led: 1 },           // LED på venstre side (paintC)
    ].map(g => ({ ...g, n: dirOf(...g.n) })) });
  // ---- rifle AR-9 (§2.6): ≈ 30 px, kort og tykk, egen kontur, kort blå stripe
  const TH = G_TH;
  const gbox = (x0, x1, hy, z0, z1, mat, o = {}) => { const A = [[x0, -hy * TH], [x1, -hy * TH], [x1, hy * TH], [x0, hy * TH]];
    const top = A.map(([x, y]) => W(x, y, z1)); return vol([...A.map(([x, y]) => W(x, y, z0)), ...top], mat, { kind: 'box', top, gun: true, own: true, ...o }); };
  // armer bak riflen: skulder → albue → hånd
  const hR = W(5, 1.8 / TH, -.8), hL = W(21.5, -.9 / TH, -.6);
  for (const [sd, H] of [[1, hR], [-1, hL]]) {
    const sh = TTp(1, sd * 9.0, 11.4); const el = [lerp(sh[0], H[0], .45), lerp(sh[1], H[1], .45), Math.min(sh[2], H[2]) - 3.4];
    vol([...sphPts(sh, 2.9, 6), ...sphPts(el, 2.5, 6)], 'suit', { kind: 'limb' });
    vol([...sphPts(el, 2.4, 6), ...sphPts(H, 2.1, 6)], 'glove', { kind: 'limb', bias: .1 });
  }
  gbox(-11, -1, 1.15, -1.7, 1.1, 'gun', { bias: .5 });
  gbox(-1, 16, 1.4, -1.2, 1.9, 'gunL', { bias: .5, stripe: [W(6, -1.41, .2), W(12, -1.41, .2), W(12, -1.41, .9), W(6, -1.41, .9)], stripeTop: [W(6, -.35, 1.92), W(12, -.35, 1.92), W(12, .35, 1.92), W(6, .35, 1.92)] });
  gbox(16, 27, 1.15, -.6, 1.5, 'gun', { bias: .5 }); gbox(27, 34, .6, 0, .9, 'gun', { bias: .5 });
  gbox(5, 9.5, 1.0, -5.2, -1.0, 'gun', { bias: .45 }); gbox(3, 9.5, .7, 1.9, 3.1, 'gun', { bias: .55 });
  // ---- skulderplater (§2.3): begge blå #2f5f93 med dobbel nedoverpekende chevron
  for (const sd of [-1, 1]) {
    const T = frameT(...TTp(.4, sd * 10.4, 12.6), K.ta, s, pitch);
    vol(ellPts(T, 5.0, 4.3, 3.3, 10, 4), 'pauldron', { kind: 'dome', chevron: { T, sd }, bias: .3 });
  }
  // ---- skjerf (§2.5): krage som ring rundt nakken (z ≈ 38–42) + to korte haler bakover/nedover (verlet fra riggen)
  const hc3 = TTp(1.6 + kn * 2, 0, (hzc - pz) / s);
  const hPitch = lerp(pitch * .5, .55, roll);    // rull: hjelmen vippes opp så en visirflik vender mot kamera
  const HT = frameT(hc3[0], hc3[1], hc3[2], K.ta, s, hPitch);
  const CT = frameT(...TTp(-.6, 0, 16.6), K.ta, s, pitch);
  vol(ellPts(CT, 5.4, 7.2, 2.3, 10, 3), 'scarfC', { kind: 'collar', bias: .15 });
  if (F.scarf) for (let ci = 0; ci < F.scarf.length; ci++) {
    const ch = F.scarf[ci]; const a0 = ch[0]; const pts = ch.map(([x, y], i) => TTp(a0[0] + (x - a0[0]) * .5 - 3.2, a0[1] + (y - a0[1]) * .5 + (ci ? 2 : -2), 17.4 - i * 2.2 - ci * .4));
    add({ pts, mat: 'fabric', kind: 'scarf', w: ci ? 2.0 : 2.5, bias: .2 });
  }
  // ---- hjelm (§2.2): Ø ≈ 11,5, midtrygg, øreplater, antenne på venstre side, visirbånd ≈ 120°
  add({ pts: ellPts(HT, 5.6, 5.4, 5.3, 12, 6), mat: 'helm', kind: 'helmet', HT, bias: .4 });
  vol([HT(-1.4, -5.1, 1.2), HT(-1.0, -5.3, 1.6), HT(-2.6, -5.9, 6.6), HT(-2.3, -6.1, 6.9)], 'gun', { kind: 'antenna', bias: .45 });
  // ---- død (§4.6): ekte liggende positur på ryggen, venstre side litt opp (LED synes), geværet mistet ved siden av
  const dk = F.mode === 'death' ? (F.clip?.death ? F.clip.death.fall : 1) : 0;
  if (dk > 0) layDown(parts, F, dk);
  return parts;
}
// Liggende død: roter hele figuren bakover rundt fotpunktet (θ ≈ 85°) og litt rundt lengdeaksen, løft til bakken,
// og legg geværet flatt ved høyre side. Alle punkter og lokale rammer (hjelm/chevron) transformeres likt.
function layDown(parts, F, k) {
  const th = 1.48 * k, ct = Math.cos(th), st = Math.sin(th), ph = .38 * k, cph = Math.cos(ph), sph = Math.sin(ph);
  const a = F.hipAngle, ux = Math.cos(a), uy = Math.sin(a);
  const X = (p) => { const rx = p[0] - F.x, ry = p[1] - F.y; const d = rx * ux + ry * uy, l = -rx * uy + ry * ux;
    const d1 = d * ct - p[2] * st + 21 * st, z1 = d * st + p[2] * ct;
    const l2 = l * cph + z1 * sph, z2 = z1 * cph - l * sph;
    return [F.x + d1 * ux - l2 * uy, F.y + d1 * uy + l2 * ux, z2]; };
  let zmin = 1e9; const tf = (P) => P.map(X);
  for (const p of parts) { if (p.gun) continue; p.pts = tf(p.pts); if (p.top) p.top = tf(p.top); if (p.lid) p.lid = tf(p.lid);
    if (p.glow) p.glow = p.glow.map(g => ({ ...g, pts: tf(g.pts), n: rotN(X, g.n) }));
    if (p.HT) { const T0 = p.HT; p.HT = (x, y, z) => X(T0(x, y, z)); }
    if (p.chevron) { const T0 = p.chevron.T; p.chevron = { ...p.chevron, T: (x, y, z) => X(T0(x, y, z)) }; }
    for (const q of p.pts) if (q[2] < zmin) zmin = q[2]; }
  const lift = Math.max(0, -zmin + .4 * k);
  const up = (q) => { q[2] += lift; };
  for (const p of parts) { if (p.gun) continue; p.pts.forEach(up); p.top?.forEach(up); p.lid?.forEach(up); p.glow?.forEach(g => g.pts.forEach(up));
    if (p.HT) { const T0 = p.HT; p.HT = (x, y, z) => { const q = T0(x, y, z); q[2] += lift; return q; }; }
    if (p.chevron) { const T0 = p.chevron.T; p.chevron = { ...p.chevron, T: (x, y, z) => { const q = T0(x, y, z); q[2] += lift; return q; } }; } }
  // gevær: faller ut av hendene og legges flatt ≈ 9 px til høyre for kroppen
  let gz = 1e9; for (const p of parts) if (p.gun) for (const q of p.pts) gz = Math.min(gz, q[2]);
  const ox = (-uy) * 11 * k + ux * 6 * k, oy = ux * 11 * k + uy * 6 * k;
  const G = (q) => [q[0] + ox, q[1] + oy, lerp(q[2], .8 + (q[2] - gz) * .45, k)];
  for (const p of parts) if (p.gun) { p.pts = p.pts.map(G); if (p.top) p.top = p.top.map(G); if (p.stripe) p.stripe = p.stripe.map(G); if (p.stripeTop) p.stripeTop = p.stripeTop.map(G); }
}
function rotN(X, n) { const o = X([0, 0, 0]), a = X(n); return [a[0] - o[0], a[1] - o[1], a[2] - o[2]]; }

// ------------------------------------------------------------------ tekstur/maling
let TEXOK = false;
function ensureTex() { if (TEXOK || !hasDOM) return TEXOK; try { registerPaint('obl_probe', '128,128,128'); TEXOK = true; } catch (e) { TEXOK = false; } return TEXOK; }
function pat(name, k, F, seed = 0) {
  const p = PAPI.pat(name, 1, seed); if (!p) return null;
  if (p.setTransform) p.setTransform(new DOMMatrix().translate(F.x + seed * 7.3, F.y + seed * 3.1).rotate((F.skel?.ta || 0) * 57.2958).scale(k));
  return p;
}
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function pathPoly(c, P) { c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); c.closePath(); }
function bounds(P) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; }

// Ytelse (runde 3): all lyssetting avhenger bare av delens skjermboks og den faste lysretningen L2, så hvert materiale
// bakes ÉN gang til en liten «lys-blob» (tekstur + tone + løft + varm nøkkel + kjølig skygge + AO + høylys).
// Per del per bilde: clip til skallet + ett drawImage + kantstrek. Ingen gradients, shadowBlur eller filter per bilde.
const BLOB = new Map(); const BS = 64, NV = 3;   // NV varianter per materiale (ulik strøk/slitasje), velges per del
function rng(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Malt overflate (runde 2): penselstrøk, flekker og kantslitasje males ÉN gang inn i blob-en (null kostnad per bilde).
function paintSurface(c, M, v) {
  const R = BS / 2, r = rng(911 * v + M.tex.length * 37 + ((M.lift || [7])[0] | 0)), pk = M.paint || 0, wk = M.wear || 0;
  if (pk <= 0 && wk <= 0) return;
  c.lineCap = 'round';
  // penselstrøk: korte, svakt buede strøk i omtrent samme retning (lysere og mørkere enn grunnen)
  const base = -0.6 + (r() - .5) * .5;
  for (let i = 0; i < 26 * pk; i++) {
    const x = r() * BS, y = r() * BS, a = base + (r() - .5) * .5, L = 6 + r() * 12, w = 1.2 + r() * 2.2, lt = r() < .55;
    c.strokeStyle = lt ? `rgba(255,236,200,${(.05 + r() * .07) * pk})` : `rgba(30,20,10,${(.06 + r() * .08) * pk})`; c.lineWidth = w;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * L * .5 + (r() - .5) * 3, y + Math.sin(a) * L * .5 + (r() - .5) * 3, x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke();
  }
  // flekker: myke mørke skjolder (skitt/olje), bakes med radialgradient én gang
  for (let i = 0; i < 3 * pk; i++) {
    const x = R + (r() - .5) * BS * .8, y = R + (r() - .3) * BS * .7, rr = 5 + r() * 9;
    const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(40,28,16,${.22 * pk})`); g.addColorStop(1, 'rgba(40,28,16,0)');
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // kantslitasje: lyse avskallinger + mørke riper langs den lyse kanten (ytterringen mot L2)
  const la = Math.atan2(L2[1], L2[0]);
  for (let i = 0; i < 40 * wk; i++) {
    const a = la + (r() - .5) * 3.4, d = R * (.62 + r() * .3), x = R + Math.cos(a) * d, y = R + Math.sin(a) * d, sz = .8 + r() * 2.2;
    c.fillStyle = `rgba(236,222,196,${.25 + r() * .35})`; c.fillRect(x, y, sz, sz * (.5 + r() * .6));
  }
  for (let i = 0; i < 6 * wk; i++) {
    const x = r() * BS, y = r() * BS, a = r() * TAU, L = 3 + r() * 7;
    c.strokeStyle = `rgba(20,14,8,${.25 + r() * .2})`; c.lineWidth = .7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke();
  }
}
function blobOf(mat, v = 0) {
  const key = mat + v; let cv = BLOB.get(key); if (cv) return cv;
  const M = { ...MAT[mat], ...PAL[MAT[mat].pal || mat] }; cv = document.createElement('canvas'); cv.width = cv.height = BS; const c = cv.getContext('2d');
  const all = () => c.fillRect(0, 0, BS, BS);
  const p = TEXOK ? PAPI.pat(M.tex, 1, 0) : null;
  if (p && p.setTransform) p.setTransform(new DOMMatrix().scale(M.k * 6.4));
  c.fillStyle = p || '#3a3f45'; all();
  if (M.base) { c.fillStyle = M.base; all(); if (p) { c.globalAlpha = .4; c.globalCompositeOperation = 'soft-light'; c.fillStyle = p; all(); c.globalAlpha = 1; } }   // malt farge (skulderplate, skjerfkrage)
  if (M.dim) { c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(30,26,20,${M.dim * .6})`; all(); }
  if (M.tint && !M.base) { c.globalCompositeOperation = 'multiply'; c.fillStyle = rgba(M.tint, 1); all(); }
  c.globalCompositeOperation = 'screen'; if (M.lift) { c.fillStyle = rgba(M.lift, 1); all(); }
  if (PAINT_SURFACE) { c.globalCompositeOperation = 'source-over'; paintSurface(c, M, v); c.globalCompositeOperation = 'screen'; }
  const R = BS / 2, lx = R + L2[0] * R, ly = R + L2[1] * R, dx = R - L2[0] * R, dy = R - L2[1] * R;
  let g = c.createLinearGradient(lx, ly, dx, dy);
  g.addColorStop(0, `rgba(${PAL.key},${M.key * .75})`); g.addColorStop(.45, `rgba(${PAL.key},${M.key * .19})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; all();
  c.globalCompositeOperation = 'multiply';
  g = c.createLinearGradient(lx, ly, dx, dy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgb(${PAL.shade[0]})`); g.addColorStop(1, `rgb(${PAL.shade[1]})`);
  c.fillStyle = g; all();
  g = c.createLinearGradient(0, BS, 0, BS * .72); g.addColorStop(0, `rgb(${PAL.ao})`); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; all();
  if (M.spec > .1) { c.globalCompositeOperation = 'screen'; const hx = R + L2[0] * R * .45, hy = R + L2[1] * R * .45; g = c.createRadialGradient(hx, hy, 0, hx, hy, R * .7);
    g.addColorStop(0, `rgba(${PAL.spec},${.32 * M.spec})`); g.addColorStop(1, `rgba(${PAL.spec},0)`); c.fillStyle = g; all(); }
  c.globalCompositeOperation = 'source-over';
  BLOB.set(key, cv); return cv;
}

function paintVolume(c, part, F, SK, i) {
  const H = part.hull; const [x0, y0, x1, y1] = bounds(H);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2 + .6;
  const P = blobPat(c, part.mat, i % NV), k = 2 * R / BS;
  MX.a = k; MX.d = k; MX.e = cx - R; MX.f = cy - R; P.setTransform(MX);
  pathPoly(c, H); c.fillStyle = P; c.fill();
  if (part.own) { c.lineWidth = OW; c.strokeStyle = `rgba(${PAL.contour},.9)`; c.stroke(); }   // gevær og sekk: egen kontur (§4.3)
  else { c.lineWidth = .5; c.strokeStyle = `rgba(${PAL.partEdge},.55)`; c.stroke(); }
  if (part.glow || part.stripe) paintGlow(c, part);
  if (!part.top && part.kind !== 'helmet' && !part.chevron && !part.emblem) return;
  c.save(); c.clip();
  if (part.top) { const T = part.top.map(proj); pathPoly(c, T); c.fillStyle = `rgba(${PAL.topFace[0]},.16)`; c.fill(); c.lineWidth = .45; c.strokeStyle = `rgba(${PAL.topFace[1]},.55)`; c.stroke(); }
  if (part.lid) { const T = part.lid.map(proj); pathPoly(c, T); c.lineWidth = .5; c.strokeStyle = `rgba(${PAL.partEdge},.7)`; c.stroke(); }
  if (part.kind === 'helmet') paintHelmet(c, part, F, SK);
  if (part.chevron) paintChevron(c, part, F, SK);
  if (part.emblem) paintEmblem(c, part, F, SK);
  c.restore();
}
const BPAT = new Map(); let MX = null;
function blobPat(c, mat, v = 0) { const key = mat + v; let p = BPAT.get(key); if (!p) { p = c.createPattern(blobOf(mat, v), 'no-repeat'); BPAT.set(key, p); } if (!MX) MX = new DOMMatrix(); return p; }
function surf(T, a, e, r) { return T(Math.cos(a) * Math.cos(e) * r[0], Math.sin(a) * Math.cos(e) * r[1], Math.sin(e) * r[2]); }
function normalVis(T, a, e) { const p = surf(T, a, e, [1, 1, 1]), o = T(0, 0, 0); const n = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; return n[1] * V[1] + n[2] * V[2]; }
function bandPoly(T, r, a0, a1, e0, e1, n = 8) { // flekk på ellipsoideflata → skjermpolygon; null hvis baksiden
  const top = [], bot = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); if (normalVis(T, a, (e0 + e1) / 2) < .05) return null; top.push(proj(surf(T, a, e1, r))); bot.push(proj(surf(T, a, e0, r))); }
  return top.concat(bot.reverse());
}
function paintHelmet(c, part, F, SK) {
  const T = part.HT, r = [5.65, 5.45, 5.35];
  // visir: smal, rett spalte foran (synlig mot kamera), glød i skin-farge
  const vis = bandPoly(T, r, -1.05, 1.05, -.26, .15, 10);
  if (vis) { pathPoly(c, vis); c.fillStyle = `rgba(${PAL.visor},.95)`; c.fill();
    c.globalCompositeOperation = 'lighter';
    const vi = bandPoly(T, r, -.95, .95, -.15, .06, 10); if (vi) { pathPoly(c, vi); c.lineWidth = 1 / PXS; c.strokeStyle = `rgba(${PAL.visorCore},${PAL.bloom * GK})`; c.stroke(); c.fillStyle = `rgba(${PAL.visorCore},${GK})`; c.fill(); }
    const hi = bandPoly(T, r, -.3, .3, -.06, .03, 4); if (hi) { pathPoly(c, hi); c.fillStyle = `rgba(${PAL.visorHot},${.9 * GK})`; c.fill(); }
    c.globalCompositeOperation = 'source-over'; }
  // malt stripe over toppen (front → bakhode)
  { const L = [], Rr = []; for (let k = 0; k <= 7; k++) { const e = .35 + k * .2, ee = e > Math.PI / 2 ? Math.PI - e : e, fl = e > Math.PI / 2 ? Math.PI : 0;
      L.push(proj(surf(T, -.1 + fl, ee, r))); Rr.push(proj(surf(T, .1 + fl, ee, r))); }
    pathPoly(c, L.concat(Rr.reverse())); c.fillStyle = `rgba(${PAL.spec},.42)`; c.fill(); }   // midtrygg som høylys
  // øreplate/sensor (mørk) på høyre side + bakhode-detalj (synlig når han ser bort)
  for (const e0 of [1.35, -1.8]) { const ear = bandPoly(T, r, e0, e0 + .45, -.45, .05, 4); if (ear) { pathPoly(c, ear); c.fillStyle = `rgba(${PAL.helmDetail[0]},.7)`; c.fill(); } }
  const back = bandPoly(T, r, Math.PI - .5, Math.PI + .5, -.5, -.25, 6); if (back) { pathPoly(c, back); c.fillStyle = `rgba(${PAL.helmDetail[1]},.6)`; c.fill(); }
}
function paintChevron(c, part, F, SK) { // Λ på skulderplatens topp
  const { T } = part.chevron; const z = 3.15;
  const L = (pts) => pts.map(([x, y]) => proj(T(x, y, z * Math.sqrt(Math.max(0, 1 - (x * x) / 23 - (y * y) / 17)))));
  const ch = L([[2.6, -1.9], [2.6, -.8], [-.8, 0], [2.6, .8], [2.6, 1.9], [-2.2, 0]]);
  pathPoly(c, ch); c.fillStyle = PAL.pauldron.chevron; c.globalAlpha = .9; c.fill();
  const ch2 = L([[1.0, -1.9], [1.0, -.8], [-2.4, 0], [1.0, .8], [1.0, 1.9], [-3.6, 0]].map(([x, y]) => [x + .2, y]));
  pathPoly(c, ch2); c.fill(); c.globalAlpha = 1;
}
// Cyan (sekkstripe/LED) og blå geværstripe: additivt ('lighter') rett etter delens bakte blob, bare når flaten vender mot kamera.
let GK = 1, OW = 1;
function paintGlow(c, part) {
  if (part.stripe) { for (const S of [part.stripe, part.stripeTop]) { const Q = S.map(proj); pathPoly(c, Q); c.fillStyle = `rgba(${PAL.gunStripe},.9)`; c.fill(); } }
  if (!part.glow) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const g of part.glow) { if (g.n[1] * V[1] + g.n[2] * V[2] < .08) continue; const Q = g.pts.map(proj); pathPoly(c, Q);
    c.lineWidth = 1 / PXS; c.strokeStyle = `rgba(${PAL.packLed},${PAL.bloom * GK})`; c.stroke();
    c.fillStyle = `rgba(${PAL.packLed},${GK})`; c.fill(); if (g.led) { c.fillStyle = `rgba(${PAL.visorHot},${.7 * GK})`; c.fill(); } }
  c.restore();
}
let PXS = 1;
function paintEmblem(c, part, F, SK) {
  const T = part.emblem; const P = [T(7.25, -1, 10.6), T(7.25, 1, 10.6), T(7.3, 0, 8.2)].map(proj);
  pathPoly(c, P); c.fillStyle = SK.glow; c.globalAlpha = .9; c.fill(); c.globalAlpha = 1;
}
function paintScarf(c, part, F) {
  const P = part.pts.map(proj); if (P.length < 2) return;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]);
  c.strokeStyle = `rgba(${PAL.scarf.dark},.92)`; c.lineWidth = part.w * .85 + .9; c.stroke();
  c.strokeStyle = PAL.scarf.base; c.lineWidth = part.w * .85; c.stroke();                 // skjerf-palett (spec §1.1): sand
  c.strokeStyle = `rgba(${PAL.scarf.hi},.85)`; c.lineWidth = part.w * .35; c.stroke();   // lys rygg på stoffet
}

// ------------------------------------------------------------------ figur → buffer → kontur + kantlys
let BUF, BC, TMP, TC; const BW = 96, BH = 104, BAX = 48, BAY = 72;
function buffers(w, h) {
  if (!BUF) { BUF = document.createElement('canvas'); BC = BUF.getContext('2d'); TMP = document.createElement('canvas'); TC = TMP.getContext('2d'); }
  if (BUF.width !== w || BUF.height !== h) { BUF.width = TMP.width = w; BUF.height = TMP.height = h; }
}
export const STATS = { figures: 0, ms: 0 }; export const PROF = { build: 0, shadow: 0, paint: 0, comp: 0 }; if (typeof window !== 'undefined') window.__OPROF = PROF;

let POOL = null;   // kontaktskygge-pøl (radial) bakes én gang
function poolSprite() { if (POOL) return POOL; POOL = document.createElement('canvas'); POOL.width = 64; POOL.height = 40; const c = POOL.getContext('2d');
  c.setTransform(2, 0, 0, 2 * 20 / 32, 0, 0); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); return POOL; }
function drawShadow(ctx, parts, F, alpha) {
  ctx.save(); ctx.beginPath();
  for (const pt of parts) { if (pt.kind === 'scarf') continue; const G = hull(pt.pts.map(q => [AX + (q[0] - AX) * SC + q[2] * SHK[0], AY + (q[1] - AY) * SC + q[2] * SHK[1]])); if (G.length < 3) continue;
    ctx.moveTo(G[0][0], G[0][1]); for (let i = 1; i < G.length; i++) ctx.lineTo(G[i][0], G[i][1]); ctx.closePath(); }
  ctx.fillStyle = `rgba(10,8,6,${alpha})`; ctx.fill('nonzero');
  ctx.globalAlpha = Math.min(1, alpha * .85 / .34); ctx.drawImage(poolSprite(), F.x - 16, F.y + 1 - 10, 32, 20);
  ctx.restore();
}

export function renderFigure(ctx, F, opts = {}) {
  const t0 = performance.now();
  ensureTex(); const SK = skinOf(F.skin);
  AX = F.x; AY = F.y; SC = OBL.scale ?? 1;
  const tA = performance.now(); const parts = buildWarden(F);
  for (const p of parts) { p.depth = 0; for (const q of p.pts) p.depth += dotV(q); p.depth = p.depth / p.pts.length + (p.bias || 0); if (p.kind !== 'scarf') p.hull = hull(p.pts.map(proj)); }
  if (STATS.measure) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, w0 = 1e9, w1 = -1e9; for (const p of parts) if (p.hull) for (const q of p.hull) { x0 = Math.min(x0, q[0] - F.x); x1 = Math.max(x1, q[0] - F.x); y0 = Math.min(y0, q[1] - F.y); } for (const p of parts) if (p.kind !== 'scarf') for (const q of p.pts) { const r = Math.hypot(q[0] - F.x, q[1] - F.y); if (p.mat !== 'gun' && p.mat !== 'gunL' && p.mat !== 'glove') w1 = Math.max(w1, r); } STATS.measure = { w: x1 - x0, top: -y0, bodyR: w1, ta: F.skel?.ta }; }
  parts.sort((a, b) => a.depth - b.depth); PROF.build += performance.now() - tA; const tB = performance.now();
  const m = ctx.getTransform(); const px = Math.hypot(m.a, m.b) || 1;
  const a = (F.alpha ?? 1) * (opts.alpha ?? 1);
  if (opts.shadow !== false) drawShadow(ctx, parts, F, (opts.shadowAlpha ?? .34) * a);
  if (typeof opts.under === 'function') opts.under(ctx); else if (typeof F.under === 'function') F.under(ctx);
  PROF.shadow += performance.now() - tB; const tC = performance.now();
  // Tegnes rett i ctx (ingen buffer/masker). Kantlys = samme konturbane strøket i lys farge, forskjøvet mot lyset,
  // under den mørke konturen; bare lyssiden stikker ut. Buffer brukes kun når figuren har alpha < 1 (korrekt gruppe-alpha).
  const o = (opts.contourPx ?? OBL.contour.px) / px, direct = a >= .999;
  OW = o; PXS = px; const dc = F.mode === 'death' ? (F.clip?.death ? Math.max(F.clip.death.fall, 1 - F.clip.death.visor) : 1) : 0; GK = 1 - .6 * dc;   // død: cyan → 40 %, aldri 0   // o = synlig konturbredde utenfor silhuetten (verdens-px)
  let c = ctx, X = 0, Y = 0, w = 0, h = 0;
  if (direct) ctx.save();
  else { w = Math.ceil(BW * px); h = Math.ceil(BH * px); buffers(w, h); c = BC; X = F.x - BAX; Y = F.y - BAY;
    BC.setTransform(1, 0, 0, 1, 0, 0); BC.clearRect(0, 0, w, h); BC.setTransform(px, 0, 0, px, (BAX - F.x) * px, (BAY - F.y) * px); }
  const tD = performance.now();
  c.beginPath(); for (const p of parts) { if (p.kind === 'scarf' || !p.hull || p.hull.length < 3) continue; const H = p.hull; c.moveTo(H[0][0], H[0][1]); for (let j = 1; j < H.length; j++) c.lineTo(H[j][0], H[j][1]); c.closePath(); }
  c.lineJoin = 'round';
  // kantlys: konturbanen strøket i varm lys farge, forskjøvet OBL.rim.px skjerm-px mot lyset; mørk kontur over → bare lyssiden synes
  const rim = OBL.rim, rk = rim.px / px, rimC = F.def?.oblique?.rim || rim.color;   // kantlysfarge per figur (Warden: kald, defs/warden.js)
  c.translate(L2[0] * rk, L2[1] * rk); c.lineWidth = o * 2; c.strokeStyle = `rgba(${rimC},${rim.alpha})`; c.stroke(); c.translate(-L2[0] * rk, -L2[1] * rk);
  c.lineWidth = o * 2; c.strokeStyle = `rgba(${PAL.contour},${OBL.contour.alpha})`; c.stroke();
  for (let i = 0; i < parts.length; i++) { const p = parts[i]; if (p.kind === 'scarf') paintScarf(c, p, F); else paintVolume(c, p, F, SK, i); }
  if (F.flash > 0) { c.fillStyle = `rgba(255,255,255,${.6 * F.flash})`; for (const p of parts) if (p.hull && p.hull.length > 2) { pathPoly(c, p.hull); c.fill(); } }
  if (direct) ctx.restore();
  else { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(BUF, X, Y, BW, BH); ctx.restore(); }
  PROF.comp += performance.now() - tD; STATS.figures++; STATS.ms += performance.now() - t0;
}

export const oblique = {
  name: 'oblique', buildWarden, renderFigure, socketZ, muzzleDraw, STATS, PAL,
  /** Etter endring i PAL ved kjøretid: tøm blob-cachen så fargene bakes på nytt. */
  resetPalette() { BLOB.clear(); BPAT.clear(); },
  drawFigure(ctx, rig, F, opts = {}) { if (!hasDOM) return; renderFigure(ctx, F, opts); },
  sortKey(F) { return PROJ.sortKey({ x: F.x, y: F.y, r: 12 }); },
};
export default oblique;
