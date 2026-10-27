// VARIANT A (2026-10-23, «improved faceted»): flere/avfasede flater, rund hjelm, kuppel-skulderplater, koboltblå plater,
// glans (spec), kald gråblå sekk/skjerf, ett varmt varselmerke på sekken, tykkere AR-9 ('rifleA'). Kopi av warden.js (v4 urørt).
// Warden som kantet 3D-delmodell (lavpoly-prismer og fasetterte plater) for stilen 'faceted'.
// Bygges KUN ved baking. Tre lag: bein (hofte-rom), overkropp (torso-rom, inkl. armer/gevær/hjelm/sekk) og
// helkropp (rull/død). Mål fra WARDEN-DESIGN §2 og side-silhuetten: høyde 48 til hjelmtopp, hofte 22,
// skulderlinje ≈ 37, kropp ≈ 29 px over skulderplatene, sekk 14×8 (z 20–40), gevær ≈ 35 px.
// Koordinater: x fram, y høyre, z opp (verdens-px), ankret i bakkepunktet (0,0,0).
import { buildWeapon, weaponLook } from './weapons/index.js';
import './weapons/rifle.js';
import './weapons/rifleA.js';   // reserve: vår midlertidige AR-9
// Våpens utseender (game/src/weapons/look/<id>.js) foretrekkes: registreres etter reserven (samme id → siste vinner).
// Dynamisk, så spillet fortsatt starter hvis fila mangler (da brukes reserven).
try { await import('../../../weapons/look/index.js'); } catch (e) { console.warn('[faceted] weapons/look mangler – bruker reserve-AR-9', e?.message); }
import { model, frame, sub_frame, box, beam, loft, part, face, decal, rect8, ngon, add, sub, mul, norm, cross, lerp3, centroid } from './mesh.js';

const lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;

// ---------------------------------------------------------------- materialer (palett fra WARDEN-DESIGN §3)
// ramp = [skygge, mellom, lys]; top = toppflate-lys. stroke/wear/mud = mengde maling, slitasje, skitt.
export const WARDEN_MATS = {
  // spec = glanspunkt-styrke, shin = skarphet, soft = myk overgang (ingen mørke fuger mellom fasetter i samme del)
  armor:    { ramp: ['#0d1015', '#353d47', '#7d8894'], top: '#9aa5b0', stroke: .55, wear: .25, edge: .35, spec: .75, shin: 14, soft: 1 },
  armorL:   { ramp: ['#12161c', '#434c57', '#8e99a5'], top: '#aab4be', stroke: .55, wear: .3, edge: .35, spec: .85, shin: 14, soft: 1 },
  helm:     { ramp: ['#1b2027', '#58626e', '#b9c3cc'], top: '#dfe6ec', stroke: .45, wear: .2, edge: .2, spec: 1.1, shin: 18, soft: 1, lift: .02 },
  helmRidge:{ ramp: ['#0e2550', '#1f4fa8', '#4f86e6'], top: '#6d9cf0', stroke: .2, wear: .2, edge: .3, spec: .9, shin: 16 },
  cobalt:   { ramp: ['#0a1f4d', '#1d4fb4', '#4c86f0'], top: '#79a6f6', stroke: .45, wear: .3, edge: .3, spec: 1.0, shin: 14, soft: 1 },
  suit:     { ramp: ['#0b0d11', '#1c2129', '#353e4a'], stroke: .5, wear: 0, edge: .25, soft: 1 },
  pack:     { ramp: ['#0f1318', '#262e38', '#46525f'], top: '#56626f', stroke: .8, wear: .25, edge: .45, mud: .15, spec: .25, shin: 10 },
  packLid:  { ramp: ['#131820', '#2d3743', '#53606e'], top: '#64717f', stroke: .8, wear: .3, edge: .5, spec: .3, shin: 10 },
  pouch:    { ramp: ['#12171d', '#2f3843', '#56626f'], top: '#65717e', stroke: .7, wear: .15, edge: .45, mud: .15 },
  strap:    { ramp: ['#0e1116', '#232a33', '#3d4652'], stroke: .3, wear: 0, edge: .4 },
  scarf:    { ramp: ['#141a22', '#36424f', '#66737f'], top: '#77838f', stroke: 1.0, wear: 0, edge: .25, jit: .12, soft: 1 },
  pauldron: { ramp: ['#0a1f4d', '#1d4fb4', '#4c86f0'], top: '#7eaaf7', stroke: .5, wear: .3, edge: .3, spec: 1.15, shin: 16, soft: 1 },
  chevron:  { ramp: ['#b9c0c8', '#eef2f5', '#ffffff'], stroke: .2, wear: .3, edge: 0, flat: false },
  hazard:   { ramp: ['#b8560c', '#ff9a1f', '#ffd25a'], top: '#ffd860', stroke: .2, wear: .25, edge: 0, flat: false },
  hazardDk: { ramp: ['#141414', '#1d1d1d', '#2a2a2a'], stroke: 0, wear: 0, edge: 0, flat: true },
  gun:      { ramp: ['#08090b', '#1e2328', '#4a535d'], top: '#606a75', stroke: .4, wear: .5, edge: .5, spec: .7, shin: 20 },
  gunL:     { ramp: ['#14181c', '#343b43', '#6b7681'], top: '#828d98', stroke: .4, wear: .6, edge: .5, spec: .8, shin: 20 },
  gunStripe:{ ramp: ['#1f4a72', '#3c86c8', '#6fb1ea'], stroke: 0, wear: 0, edge: 0, flat: true },
  boot:     { ramp: ['#0a0b0e', '#1f232a', '#3e4550'], top: '#4c5560', stroke: .6, wear: .3, edge: .4, mud: .5, soft: 1 },
  knee:     { ramp: ['#141921', '#4a5562', '#9aa6b2'], top: '#b4bfca', stroke: .5, wear: .35, edge: .3, mud: .3, spec: .9, shin: 14, soft: 1 },
  glove:    { ramp: ['#0b0d10', '#22272e', '#454e58'], stroke: .4, wear: .2, edge: .4 },
  visor:    { ramp: ['#03121a', '#08283a', '#1a5a78'], stroke: 0, wear: 0, edge: .8, flat: true },
  cyan:     { glow: '57,198,255', glowBody: '150,232,255', hot: '230,252,255' },
  cyanDim:  { glow: '40,150,200', glowBody: '70,170,210' },
  default:  { ramp: ['#222', '#555', '#888'] },
};
export const PAINT_OPTS = { aoH: 30, wearCol: '#d4dbe2', mudCol: '#2a2e33', rustCol: '#4a3a30', sootCol: '#16181c', specCol: '#f4f9ff' };

// ---------------------------------------------------------------- mål
export const DIM = {
  hipZ: 22, hipZKneel: 12.5, helmZ: 19.8, helmZKneel: 18.2, gunZ: 11.2, gunZKneel: 10.4,
  gunScale: .72,                         // riggens våpenenheter → tegnede px (grep 5 → 3,6)
  gripX: 3.6,                            // grepets plass langs riggens våpenakse (= R2L(5,·) · gunScale)
};

// ---------------------------------------------------------------- bein (hofte-rom, yaw = hoftevinkel)
/** q: { feet (legPoses i hofte-rom), kneel, slide, roll, hipZ } */
export function buildLegs(M, yaw, q) {
  const T = frame([0, 0, 0], yaw);
  const kn = q.kneel || 0, roll = q.roll || 0;
  const pz = q.hipZ;
  for (const f of q.feet) {
    const s = f.s, lift = (f.lift || 0) * 4.5;
    const hip = T(0, s * 4.4, pz - 1.8), ank = T(f.fx, f.fy, 2.6 + lift);
    const k0 = [lerp((0 + f.fx) / 2, f.kx, .5 + .5 * kn), lerp((s * 4.4 + f.fy) / 2, f.ky, .5 + .5 * kn)];
    const fwd = (1.8 + lift * .4) * (1 - kn);
    const kneeZ = lerp(lerp(12 + lift * .7, s < 0 ? 9.5 : 2.6, kn), 7, roll);
    const knee = T(k0[0] + fwd, k0[1], kneeZ);
    const up = T.dir(1, 0, 0);
    beam(M, hip, knee, 6.2, 6.0, up, 'armor', { id: 'thigh' + s, taper: .72, c: 1.9, capA: false });
    beam(M, knee, ank, 5.4, 5.4, up, 'armorL', { id: 'shin' + s, taper: .66, c: 1.6, capA: false, bias: .05 });
    // kneplate: kantet kile som peker fram
    const kd = norm(sub(ank, hip)); const kf = T.dir(1, 0, 0);
    const KT = frame(add(knee, mul(kf, 1.6)), yaw, -Math.atan2(kd[2], Math.hypot(kd[0], kd[1])) + Math.PI / 2 * (1 - kn) * .0);
    loft(M, KT, [{ pts: ngon(10, 1.6, 2.9), z: -2.9, dx: .2 }, { pts: ngon(10, 2.2, 3.0), z: -.8, dx: .7 }, { pts: ngon(10, 2.0, 2.7), z: 1.4, dx: .6 }, { pts: ngon(10, 1.0, 1.6), z: 2.9, dx: .1 }], 'knee', { id: 'knee' + s, bias: .35 });
    // støvel: klumpete, avfaset tå
    const BT = frame(T(f.fx, f.fy, lift), yaw + (f.fa || 0));
    box(M, BT, -3.4, 6.0, -3.0, 3.0, 0, 4.6, 'boot', { id: 'boot' + s, c: 1.9, taper: [.66, .82], topShift: -1.4, bevel: 1.4, bias: .1 });
  }
  // hofte / belte med lommer
  const HT = frame(T(0, 0, pz), yaw);
  loft(M, HT, [{ pts: ngon(12, 4.2, 6.4), z: -3.6 }, { pts: ngon(12, 4.6, 6.8), z: -1.2 }, { pts: ngon(12, 4.3, 6.5), z: 1.6 }], 'suit', { id: 'belt', bias: .2 });
  for (const y of [-3.6, 0, 3.6]) box(M, HT, 3.2, 5.2, y - 1.5, y + 1.5, -3.2, .8, 'pouch', { id: 'bpouch' + y, c: .5, bevel: .5, bias: .3 });
  return M;
}

// ---------------------------------------------------------------- overkropp (torso-rom)
/**
 * q: { pose:{bx,by,a,f}, kneel, slide, roll, pitch, hipZ, helmFwd, helmPitch }
 * Returnerer M; ankeret er bakkepunktet under bekkenet (riggens K.ox/K.oy).
 */
export function buildUpper(M, yaw, q) {
  const kn = q.kneel || 0;
  const TT = torsoFrame(yaw, q);
  // ---- mage (mørk drakt) + plate carrier (kantet loft)
  box(M, TT, -3.6, 3.6, -5.6, 5.6, -1.5, 5, 'suit', { id: 'belly', c: 1.6 });
  loft(M, TT, [
    { pts: ngon(14, 4.4, 6.6), z: 3.2, dx: .2 },
    { pts: ngon(14, 5.6, 8.4), z: 7.0, dx: .3 },
    { pts: ngon(14, 6.0, 9.2), z: 10.6, dx: .3 },
    { pts: ngon(14, 5.4, 8.6), z: 13.6, dx: 0 },
    { pts: ngon(14, 3.8, 6.0), z: 15.4, dx: -.4 },
  ], 'armor', { id: 'torso', bias: 0 });
  // brystplate: spiss femkant med midtrygg (fasetter mot lyset) – lysere plate foran
  // rund brystplate: halv-ellipse foran (9 punkter) lukket mot kroppen, 4 ringer → myk kuppel. Koboltblå.
  const cp = (k, z, dx = 0) => { const o = []; for (let i = 0; i <= 8; i++) { const t = -Math.PI / 2 + i / 8 * Math.PI; o.push([4.0 + dx + Math.cos(t) * 2.9 * k, Math.sin(t) * 7.0 * k]); } return o.reverse(); };
  loft(M, TT, [{ pts: cp(.75, 4.2), z: 4.2 }, { pts: cp(1.0, 7.0), z: 7.0 }, { pts: cp(1.04, 10.4), z: 10.4 }, { pts: cp(.86, 13.4, -.5), z: 13.4 }, { pts: cp(.5, 14.6, -1.0), z: 14.6 }], 'cobalt', { id: 'chest', bias: .25, cap: [true, true] });
  // magasinlommer på buken
  for (const y of [-3.4, 0, 3.4]) box(M, TT, 4.4, 6.4, y - 1.4, y + 1.4, 0.2, 4.0, 'pouch', { id: 'mag' + y, c: .7, bevel: .7, bias: .3 });
  // ---- nakke + skjerfkrage (grov sjukant, litt skjev = stoff)
  const col = (rx, ry, rot) => ngon(7, rx, ry, rot).map(([x, y], i) => [x + (i % 2 ? .3 : -.2), y]);
  loft(M, TT, [{ pts: col(5.6, 7.0, .2), z: 13.2, dx: -.4 }, { pts: col(5.9, 7.2, .25), z: 15.6, dx: -.3 }, { pts: col(4.4, 5.4, .3), z: 17.6, dx: .1 }], 'scarf', { id: 'collar', bias: .3, cap: [false, true] });
  // ---- sekk: firkantet blokk høyt på ryggen, lokk, sidelommer, stropper, cyan stripe + LED
  const PK = box(M, TT, -12.0, -4.4, -6.6, 6.6, -1.8, 16.6, 'pack', { id: 'pack', c: 1.4, bevel: 1.0, bias: -.3 });
  const LID = box(M, TT, -12.4, -4.2, -7.0, 7.0, 14.6, 18.6, 'packLid', { id: 'lid', c: 1.5, bevel: .9, taper: [.94, .94], bias: -.25 });
  for (const sd of [-1, 1]) {
    const P = box(M, TT, -11.2, -6.0, sd > 0 ? 6.6 : -8.8, sd > 0 ? 8.8 : -6.6, .4, 9.6, 'pouch', { id: 'spouch' + sd, c: .8, bevel: .7, bias: -.2 });
    if (sd < 0) decal(P, [TT(-9.6, -8.85, 5.4), TT(-7.8, -8.85, 5.4), TT(-7.8, -8.85, 7.6), TT(-9.6, -8.85, 7.6)], 'cyan', TT.dir(0, -1, 0));   // LED (venstre, paintC)
    beam(M, TT(-4.6, sd * 4.6, 16.4), TT(1.5, sd * 5.4, 15.8), 2.0, .8, TT.dir(0, 0, 1), 'strap', { id: 'strapA' + sd, bias: .45 });
    beam(M, TT(1.5, sd * 5.4, 15.8), TT(5.6, sd * 5.0, 10.5), 2.0, .8, TT.dir(1, 0, 0), 'strap', { id: 'strapB' + sd, bias: .4 });
  }
  decal(LID, [TT(-7.4, -5.4, 18.66), TT(-5.6, -5.4, 18.66), TT(-5.6, 1.0, 18.66), TT(-7.4, 1.0, 18.66)], 'cyan', TT.dir(0, 0, 1));          // stripe på toppen
  // ETT varmt aksentpunkt: oransje/gul varselplate på lokket (bak til høyre), med to mørke skråstriper
  { const zt = 18.66, x0 = -12.2, x1 = -8.0, y0 = 1.2, y1 = 6.8;
    decal(LID, [TT(x0, y0, zt), TT(x1, y0, zt), TT(x1, y1, zt), TT(x0, y1, zt)], 'hazard', TT.dir(0, 0, 1));
    for (const o of [.6, 3.0]) decal(LID, [TT(x0, y0 + o, zt + .01), TT(x0, y0 + o + 1.0, zt + .01), TT(x1, y0 + o + 2.0, zt + .01), TT(x1, y0 + o + 1.0, zt + .01)], 'hazardDk', TT.dir(0, 0, 1));
    decal(PK, [TT(-12.06, 1.2, 14.4), TT(-12.06, 6.4, 14.4), TT(-12.06, 6.4, 16.4), TT(-12.06, 1.2, 16.4)], 'hazard', TT.dir(-1, 0, 0)); }
  decal(PK, [TT(-12.06, -4.6, 10.4), TT(-12.06, 4.6, 10.4), TT(-12.06, 4.6, 12.0), TT(-12.06, -4.6, 12.0)], 'cyan', TT.dir(-1, 0, 0));     // stripe bakpå
  // ---- våpen: fra en våpen-def (faceted/weapons/, eies av Breach Våpen). Grepet (def.points.grip) festes i riggens
  // handR-punkt langs våpenaksen; handL på def.points.fore. Bevegelige deler (pump/bolt/mag) bakes som egne sprites.
  const look = q.look || weaponLook('rifleA');
  const WT = weaponFrame(TT, q.pose, kn, look);
  const W = buildWeapon(M, WT, look, { D: q.D, all: q.allParts });
  const gparts = W.parts; M.muzzle = W.muzzle; M.hands = W.hands;
  // ---- armer: skulder → albue → hånd (hender på grep og håndvern)
  const hR = W.hands.R, hL = W.hands.L || WT(9, -1.2, .2);
  for (const [sd, H] of [[1, hR], [-1, hL]]) {
    const sh = TT(.8, sd * 8.6, 12.0);
    const mid = lerp3(sh, H, .5); const out = TT.dir(0, sd, 0);
    const el = add(add(mid, mul(out, 2.2)), [0, 0, -3.0]);
    beam(M, sh, el, 4.2, 4.2, TT.dir(0, 0, 1), 'armor', { id: 'uarm' + sd, taper: .78, c: 1.3, bias: .2 });
    beam(M, el, H, 3.9, 3.9, TT.dir(0, 0, 1), 'armorL', { id: 'farm' + sd, taper: .7, c: 1.2, bias: .35 });
    const hd = norm(sub(H, el)); beam(M, H, add(H, mul(hd, 1.6)), 2.8, 2.6, TT.dir(0, 0, 1), 'glove', { id: 'glove' + sd, c: .7, bias: .7 });
  }
  // ---- skulderplater: koboltblå kupler (12-kant, 5 ringer) med hvit dobbel chevron på toppen
  for (const sd of [-1, 1]) {
    const PT = sub_frame(TT, [.3, sd * 10.0, 12.0], 0, 0, -sd * .38);
    const top = loft(M, PT, [
      { pts: ngon(12, 5.2, 3.9), z: -2.2, dy: sd * 1.0 },
      { pts: ngon(12, 5.6, 4.1), z: -.7, dy: sd * .5 },
      { pts: ngon(12, 5.2, 3.7), z: .9, dy: sd * .1 },
      { pts: ngon(12, 4.2, 2.9), z: 2.0 },
      { pts: ngon(12, 3.0, 2.0), z: 2.5 },
    ], 'pauldron', { id: 'pad' + sd, bias: .4 });
    const zt = 2.56, V = (o) => [[-2.0, -.6 + o], [0, .9 + o], [2.0, -.6 + o], [2.0, .2 + o], [0, 1.7 + o], [-2.0, .2 + o]];
    for (const o of [-1.5, .1]) { const pts = V(o).map(([x, y]) => PT(x * 1.05, sd * y * .62 + .1 * sd, zt)); decal(top, sd > 0 ? pts : pts.reverse(), 'chevron', PT.dir(0, 0, 1)); }
  }
  // ---- hjelm: lavpoly kuppel (10-kant) med skjørt, visirbånd ≈ 120°, ansiktsplate, øreplater, midtrygg, antenne
  const hz = lerp(DIM.helmZ, DIM.helmZKneel, kn);
  const HT = sub_frame(TT, [1.4 + (q.helmFwd || 0), 0, hz], 0, q.helmPitch || 0);
  const NH = 16, rot = Math.PI / NH;
  const RR = [[-4.4, 4.9, -.5], [-3.0, 5.8, -.2], [-1.4, 6.25, 0], [.4, 6.35, 0], [2.0, 6.0, 0], [3.4, 5.2, -.1], [4.6, 3.9, -.25], [5.5, 2.3, -.4], [5.95, .7, -.45]];
  const rAt = (z) => { for (let i = 0; i < RR.length - 1; i++) if (z <= RR[i + 1][0]) { const t = (z - RR[i][0]) / (RR[i + 1][0] - RR[i][0]); return lerp(RR[i][1], RR[i + 1][1], t); } return RR[RR.length - 1][1]; };
  const H = loft(M, HT, RR.map(([z, r, dx]) => ({ pts: ngon(NH, r, r * .97, rot), z, dx })), 'helm', { id: 'helm', bias: .55 });
  // visir: bredt mørkt glassbånd + kraftig cyan kjerne, følger kuppelen (−65°…+65°)
  const vband = (a0, a1, z0, z1, off, mat, n = 6) => { for (let i = 0; i < n; i++) { const t0 = lerp(a0, a1, i / n), t1 = lerp(a0, a1, (i + 1) / n);
      const P = (t, z) => HT(Math.cos(t) * (rAt(z) + off), Math.sin(t) * (rAt(z) * .97 + off), z);
      const pts = [P(t0, z0), P(t1, z0), P(t1, z1), P(t0, z1)]; const nn = HT.dir(Math.cos((t0 + t1) / 2), Math.sin((t0 + t1) / 2), .15);
      decal(H, pts, mat, nn); } };
  vband(-1.15, 1.15, -1.6, 2.0, .1, 'visor');
  vband(-1.0, 1.0, -.35, 1.05, .18, 'cyan');
  // koboltblå hjelmstripe over toppen (fram → bak)
  { const zs = [2.0, 3.4, 4.6, 5.5, 5.95];
    const L = [], R = []; for (const sgn of [1, -1]) for (const z of (sgn > 0 ? zs : zs.slice().reverse())) { const r = rAt(z) + .06; L.push(HT(sgn * Math.sqrt(Math.max(0, r * r - .9 * .9)), -.9, z)); R.push(HT(sgn * Math.sqrt(Math.max(0, r * r - .9 * .9)), .9, z)); }
    const C0 = HT(0, 0, -1.0); for (let i = 0; i < L.length - 1; i++) { const q = [L[i], L[i + 1], R[i + 1], R[i]]; const m = q.reduce((a, b) => add(a, b), [0, 0, 0]).map(v => v / 4); decal(H, q, 'cobalt', sub(m, C0)); } }
  loft(M, HT, [{ pts: ngon(8, 1.6, 2.4), z: -4.8, dx: 4.6 }, { pts: ngon(8, 1.9, 2.8), z: -3.4, dx: 5.0 }, { pts: ngon(8, 1.5, 2.6), z: -1.6, dx: 5.1 }], 'helm', { id: 'face', bias: .6 });
  for (const sd of [-1, 1]) box(M, HT, -2.0, 1.4, sd > 0 ? 5.7 : -7.1, sd > 0 ? 7.1 : -5.7, -2.4, .6, 'gunL', { id: 'ear' + sd, c: 1.0, bevel: .7, bias: .62 });
  const ant = beam(M, HT(-1.0, -6.6, 0), HT(-3.4, -7.0, 9.0), .55, .55, HT.dir(1, 0, 0), 'gun', { id: 'antenna', c: .1, bias: .7 }); ant.noShadow = 1;
  M.gunParts = gparts;
  return M;
}

/** Torso-rammen (bekken-origo) – delt av baking og munningsberegning, så tallene aldri driver fra hverandre. */
export function torsoFrame(yaw, q) { return frame([0, 0, q.hipZ], yaw, q.pitch || 0); }
/** Våpenrammen: riggens våpenpivot (pose bx/by, vinkel a, f → nese-ned-pitch), grepet i DIM.gripX. */
export function weaponFrame(TT, pose, kn, look) {
  const gunZ = lerp(DIM.gunZ, DIM.gunZKneel, kn || 0);
  const gpitch = Math.acos(Math.max(.3, Math.min(1, pose.f)));
  const GT = sub_frame(TT, [pose.bx, pose.by, gunZ], pose.a, gpitch);
  const g = look.points.grip || { x: 0, y: 0, z: 0 };
  return sub_frame(GT, [DIM.gripX - (g.x || 0), -(g.y || 0), -1.2 - (g.z || 0)]);
}
/** Bare én bevegelig våpendel (pump/bolt/mag) i samme ramme som overkroppen – egen liten sprite. */
export function buildMoving(M, yaw, q, group) {
  const TT = torsoFrame(yaw, q); const look = q.look || weaponLook('rifleA');
  buildWeapon(M, weaponFrame(TT, q.pose, q.kneel || 0, look), look, { D: q.D, only: group }); return M;
}

/** Liggende død: hele modellen roteres bakover rundt fotpunktet (θ ≈ 85°), geværet legges flatt ved høyre side. */
export function layDown(M, yaw, k) {
  const th = 1.48 * k, ct = Math.cos(th), st = Math.sin(th), ph = .38 * k, cph = Math.cos(ph), sph = Math.sin(ph);
  const ux = Math.cos(yaw), uy = Math.sin(yaw);
  const X = (p) => { const d = p[0] * ux + p[1] * uy, l = -p[0] * uy + p[1] * ux;
    const d1 = d * ct - p[2] * st + 21 * st, z1 = d * st + p[2] * ct;
    const l2 = l * cph + z1 * sph, z2 = z1 * cph - l * sph;
    return [d1 * ux - l2 * uy, d1 * uy + l2 * ux, z2]; };
  const gun = new Set(M.gunParts || []);
  let zmin = 1e9, gz = 1e9;
  for (const P of M.parts) { const g = gun.has(P); for (const f of [...P.faces, ...P.decals]) { if (!g) f.p = f.p.map(X); for (const q of f.p) g ? (gz = Math.min(gz, q[2])) : (zmin = Math.min(zmin, q[2])); } }
  const lift = Math.max(0, -zmin + .3 * k);
  const ox = -uy * 12 * k + ux * 5 * k, oy = ux * 12 * k + uy * 5 * k;
  for (const P of M.parts) { const g = gun.has(P); for (const f of [...P.faces, ...P.decals]) {
    f.p = f.p.map(q => g ? [q[0] + ox, q[1] + oy, lerp(q[2], .9 + (q[2] - gz) * .5, k)] : [q[0], q[1], q[2] + lift]);
    f.n = recompute(f); } }
  return M;
}
function recompute(f) { const P = f.p; const n = [0, 0, 0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return norm(n); }

/** Kollbøtte: hele den sammenkrøpne modellen roteres om sideaksen (pitch θ) rundt ballsenteret, og løftes til bakken. */
export function tumble(M, yaw, theta, cz = 10) {
  const ux = Math.cos(yaw), uy = Math.sin(yaw), c = Math.cos(theta), s = Math.sin(theta);
  const X = (p) => { const d = p[0] * ux + p[1] * uy, l = -p[0] * uy + p[1] * ux, z = p[2] - cz;
    const d1 = d * c + z * s, z1 = -d * s + z * c; return [d1 * ux - l * uy, d1 * uy + l * ux, z1 + cz]; };
  let zmin = 1e9;
  for (const P of M.parts) for (const f of [...P.faces, ...P.decals]) { f.p = f.p.map(X); for (const q of f.p) zmin = Math.min(zmin, q[2]); }
  const lift = -zmin + .2;
  for (const P of M.parts) for (const f of [...P.faces, ...P.decals]) { for (const q of f.p) q[2] += lift; f.n = recompute(f); }
  return M;
}
export { model };
