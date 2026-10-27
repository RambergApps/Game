// Warden som kantet 3D-delmodell (lavpoly-prismer og fasetterte plater) for stilen 'faceted'.
// Bygges KUN ved baking. Tre lag: bein (hofte-rom), overkropp (torso-rom, inkl. armer/gevær/hjelm/sekk) og
// helkropp (rull/død). Mål fra WARDEN-DESIGN §2 og side-silhuetten: høyde 48 til hjelmtopp, hofte 22,
// skulderlinje ≈ 37, kropp ≈ 29 px over skulderplatene, sekk 14×8 (z 20–40), gevær ≈ 35 px.
// Koordinater: x fram, y høyre, z opp (verdens-px), ankret i bakkepunktet (0,0,0).
import { buildWeapon, weaponLook } from './weapons/index.js';
import './weapons/rifle.js';   // reserve: vår midlertidige AR-9
// Våpens utseender (game/src/weapons/look/<id>.js) foretrekkes: registreres etter reserven (samme id → siste vinner).
// Dynamisk, så spillet fortsatt starter hvis fila mangler (da brukes reserven).
try { await import('../../../weapons/look/index.js'); } catch (e) { console.warn('[faceted] weapons/look mangler – bruker reserve-AR-9', e?.message); }
import { model, frame, sub_frame, box, beam, loft, part, face, decal, rect8, ngon, add, sub, mul, norm, cross, lerp3, centroid } from './mesh.js';

const lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;

// ---------------------------------------------------------------- materialer (palett fra WARDEN-DESIGN §3)
// ramp = [skygge, mellom, lys]; top = toppflate-lys. stroke/wear/mud = mengde maling, slitasje, skitt.
export const WARDEN_MATS = {
  // v4.1 fargeløft (Breach Karakter 23.10): koboltblå plater, mer kontrast + glans på metall, kald gråblå sekk/skjerf, ett oransje merke
  armor:    { ramp: ['#0c1a2e', '#2f5f93', '#4f86c4'], top: '#6b9fd6', stroke: .5, wear: .3, edge: .6, contrast: 1.2, spec: .22 , wearCol: '#8db6e4' },   // v4.2 kobolt (var lysegrå)
  armorL:   { ramp: ['#0e1d31', '#2a5486', '#4677b0'], top: '#5f90c6', stroke: .5, wear: .35, edge: .6, contrast: 1.2, spec: .25 , wearCol: '#83abd8' },
  chestPlate:{ ramp: ['#0b2347', '#1d56a6', '#4a8ae0'], top: '#6aa6f0', stroke: .5, wear: .45, edge: .6, contrast: 1.2, spec: .3 , wearCol: '#8db6e4' },
  helm:     { ramp: ['#1b2633', '#465a72', '#8297b0'], top: '#9db0c6', stroke: .5, wear: .25, edge: .55, lift: .04, contrast: 1.3, spec: .3 , wearCol: '#9fb6d0' },
  helmRidge:{ ramp: ['#0e2a55', '#2464bf', '#5a9bf0'], stroke: .3, wear: .3, edge: .4, spec: .4 },
  suit:     { ramp: ['#0f1215', '#20262c', '#3a424b'], stroke: .6, wear: 0, edge: .3, mud: .3, contrast: 1.15 },
  pack:     { ramp: ['#10151c', '#253040', '#435264'], top: '#536376', stroke: 1, wear: .35, edge: .6, mud: .15, contrast: 1.2 , wearCol: '#6c8199' },
  packLid:  { ramp: ['#141a22', '#2c3847', '#4d5d71'], top: '#5e7085', stroke: 1, wear: .4, edge: .7, contrast: 1.2 , wearCol: '#6c8199' },
  pouch:    { ramp: ['#18202a', '#344252', '#566a7e'], top: '#677c92', stroke: .9, wear: .2, edge: .6, mud: .15, contrast: 1.2 , wearCol: '#6c8199' },
  strap:    { ramp: ['#141a21', '#2a333e', '#46525f'], stroke: .3, wear: 0, edge: .5 },
  scarf:    { ramp: ['#1f2a36', '#3e4e61', '#6a7e94'], top: '#7c90a6', stroke: 1.1, wear: 0, edge: .45, jit: .16 },
  pauldron: { ramp: ['#0a2550', '#1f5fb8', '#5096ef'], top: '#6eaaf5', stroke: .5, wear: .45, edge: .6, contrast: 1.2, spec: .3 , wearCol: '#8db6e4' },
  chevron:  { ramp: ['#9a978e', '#e2ded2', '#fbf8ef'], stroke: .3, wear: .6, edge: 0, flat: false },
  accent:   { ramp: ['#8a3e0c', '#ef7d1c', '#ffbe55'], stroke: .3, wear: .2, edge: 0, flat: false },
  gun:      { ramp: ['#121518', '#2b3036', '#4e5761'], top: '#626c77', stroke: .5, wear: .7, edge: .7, contrast: 1.25, spec: .5 },
  gunL:     { ramp: ['#1e2328', '#3e454d', '#6c7681'], top: '#828c97', stroke: .5, wear: .9, edge: .7, contrast: 1.25, spec: .55 },
  gunStripe:{ ramp: ['#1f4a72', '#3c86c8', '#6fb1ea'], stroke: 0, wear: 0, edge: 0, flat: true },
  boot:     { ramp: ['#121316', '#26282c', '#454850'], top: '#545862', stroke: .7, wear: .5, edge: .5, mud: .8 },
  knee:     { ramp: ['#1a222c', '#3d4a5a', '#687a8e'], top: '#7b8ea3', stroke: .8, wear: .45, edge: .6, mud: .6, spec: .3 , wearCol: '#8fa3b8' },
  glove:    { ramp: ['#111316', '#2a2f35', '#4a525b'], stroke: .4, wear: .3, edge: .5 },
  visor:    { ramp: ['#041720', '#0a2c3a', '#1c5266'], stroke: 0, wear: 0, edge: .8, flat: true },
  cyan:     { glow: '57,198,255', glowBody: '150,232,255', hot: '230,252,255' },
  cyanDim:  { glow: '40,150,200', glowBody: '70,170,210' },
  default:  { ramp: ['#222', '#555', '#888'] },
};
export const PAINT_OPTS = { aoH: 30, wearCol: '#c3c9ce', mudCol: '#3a3f44', rustCol: '#5a4a3e', sootCol: '#1d2024' };

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
    const hip = T(0, s * 4.4, pz - 1.8); let ank = T(f.fx, f.fy, 2.6 + lift);
    const k0 = [lerp((0 + f.fx) / 2, f.kx, .5 + .5 * kn), lerp((s * 4.4 + f.fy) / 2, f.ky, .5 + .5 * kn)];
    const fwd = (1.8 + lift * .4) * (1 - kn);
    const kneeZ = lerp(lerp(12 + lift * .7, s < 0 ? 9.5 : 2.6, kn), 7, roll);
    const knee = T(k0[0] + fwd, k0[1], kneeZ);
    // v4.1 (Breach Karakter): bakre legg i kne var en lang, flat «stang» bakover – legg den kort og brettet (tå i bakken)
    let footX = f.fx, footY = f.fy, kneelRear = 0;
    if (kn > .05 && s > 0) { kneelRear = kn; const dx = ank[0] - knee[0], dy = ank[1] - knee[1], d = Math.hypot(dx, dy) || 1;
      const L = lerp(d, Math.min(d, 7.5), kn); ank = [knee[0] + dx / d * L, knee[1] + dy / d * L, lerp(ank[2], 4.2, kn)];
      const lp = T.inv ? T.inv(ank) : null; if (lp) { footX = lp[0]; footY = lp[1]; } else { const c = Math.cos(yaw), sn = Math.sin(yaw); footX = c * ank[0] + sn * ank[1]; footY = -sn * ank[0] + c * ank[1]; } }
    const up = T.dir(1, 0, 0);
    beam(M, hip, knee, 5.6, 5.8, up, 'armor', { id: 'thigh' + s, taper: .82, c: 1.1, capA: false });
    beam(M, knee, ank, 4.8, 5.0, up, 'armor', { id: 'shin' + s, taper: .86, c: 1.0, capA: false, bias: .05 });
    // kneplate: kantet kile som peker fram
    const kd = norm(sub(ank, hip)); const kf = T.dir(1, 0, 0);
    const KT = frame(add(knee, mul(kf, 1.6)), yaw, -Math.atan2(kd[2], Math.hypot(kd[0], kd[1])) + Math.PI / 2 * (1 - kn) * .0);
    box(M, KT, -1.4, 2.6, -2.7, 2.7, -2.8, 2.8, 'knee', { id: 'knee' + s, c: 1.0, taper: [.7, .85], bias: .35 });
    // støvel: klumpete, avfaset tå
    const BT = frame(T(footX, footY, lift), yaw + (f.fa || 0));
    if (kneelRear > .5) box(M, BT, -4.6, .4, -2.8, 2.8, 0, 3.4, 'boot', { id: 'boot' + s, c: 1.0, taper: [.8, .9], bevel: .8, bias: .1 });   // tå i bakken, hælen opp/bak
    else box(M, BT, -3.4, 6.0, -3.1, 3.1, 0, 4.8, 'boot', { id: 'boot' + s, c: 1.2, taper: [.72, .88], topShift: -1.2, bevel: 1.0, bias: .1 });
  }
  // hofte / belte med lommer
  const HT = frame(T(0, 0, pz), yaw);
  box(M, HT, -4.2, 4.0, -6.4, 6.4, -3.6, 1.6, 'pouch', { id: 'belt', c: 2.0, taper: [.95, .95], bias: .2 });
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
    { pts: rect8(4.4, 6.8, 1.8), z: 3.2, dx: .2 },
    { pts: rect8(5.8, 9.0, 2.6), z: 9.0, dx: .3 },
    { pts: rect8(5.4, 8.8, 2.6), z: 13.6, dx: 0 },
    { pts: rect8(3.8, 6.0, 1.8), z: 15.2, dx: -.4 },
  ], 'armor', { id: 'torso', bias: 0 });
  // brystplate: spiss femkant med midtrygg (fasetter mot lyset) – lysere plate foran
  const cp = (k, z, dx = 0) => [[6.9 * k + dx, 0], [5.9 * k + dx, 6.6 * k], [4.0 + dx, 7.0 * k], [4.0 + dx, -7.0 * k], [5.9 * k + dx, -6.6 * k]];
  const CH = loft(M, TT, [{ pts: cp(1, 4.6), z: 4.6 }, { pts: cp(1.04, 9.4), z: 9.4 }, { pts: cp(.9, 13.8, -.6), z: 13.8 }], 'chestPlate', { id: 'chest', bias: .25, cap: [true, true] });
  // magasinlommer på buken
  for (const y of [-3.4, 0, 3.4]) box(M, TT, 4.6, 6.6, y - 1.4, y + 1.4, 0.2, 4.6, 'pouch', { id: 'mag' + y, c: .5, bevel: .6, bias: .3 });
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
  decal(LID, [TT(-10.9, -5.0, 18.66), TT(-9.1, -5.0, 18.66), TT(-9.1, 5.0, 18.66), TT(-10.9, 5.0, 18.66)], 'cyan', TT.dir(0, 0, 1));          // stripe på toppen
  decal(LID, [TT(-7.4, 2.4, 18.66), TT(-5.6, 2.4, 18.66), TT(-5.6, 4.6, 18.66), TT(-7.4, 4.6, 18.66)], 'accent', TT.dir(0, 0, 1));          // v4.1: lite varmt oransje merke (eneste varme aksent)
  decal(PK, [TT(-12.06, -4.6, 10.4), TT(-12.06, 4.6, 10.4), TT(-12.06, 4.6, 12.0), TT(-12.06, -4.6, 12.0)], 'cyan', TT.dir(-1, 0, 0));     // stripe bakpå
  // ---- våpen: fra en våpen-def (faceted/weapons/, eies av Breach Våpen). Grepet (def.points.grip) festes i riggens
  // handR-punkt langs våpenaksen; handL på def.points.fore. Bevegelige deler (pump/bolt/mag) bakes som egne sprites.
  const look = q.look || weaponLook('rifle');
  const WT = weaponFrame(TT, q.pose, kn, look);
  const W = buildWeapon(M, WT, look, { D: q.D, all: q.allParts });
  const gparts = W.parts; M.muzzle = W.muzzle; M.hands = W.hands;
  // ---- armer: skulder → albue → hånd (hender på grep og håndvern)
  const hR = W.hands.R, hL = W.hands.L || WT(9, -1.2, .2);
  for (const [sd, H] of [[1, hR], [-1, hL]]) {
    const sh = TT(.8, sd * 8.6, 12.0);
    const mid = lerp3(sh, H, .5); const out = TT.dir(0, sd, 0);
    const el = add(add(mid, mul(out, 2.2)), [0, 0, -3.0]);
    beam(M, sh, el, 3.6, 3.8, TT.dir(0, 0, 1), 'armor', { id: 'uarm' + sd, taper: .9, c: .9, bias: .2 });
    beam(M, el, H, 3.4, 3.4, TT.dir(0, 0, 1), 'armorL', { id: 'farm' + sd, taper: .82, c: .9, bias: .35 });
    const hd = norm(sub(H, el)); beam(M, H, add(H, mul(hd, 1.6)), 2.8, 2.6, TT.dir(0, 0, 1), 'glove', { id: 'glove' + sd, c: .7, bias: .7 });
  }
  // ---- skulderplater: kantede, lagdelte, stikker ut; blå med dobbel chevron
  for (const sd of [-1, 1]) {
    const PT = sub_frame(TT, [.4, sd * 10.2, 12.6], 0, 0, -sd * .42);
    const top = box(M, PT, -4.3, 4.1, -2.6, 3.2, -1.0, 2.2, 'pauldron', { id: 'pad' + sd, c: 1.1, bevel: .9, taper: [.86, .8], bias: .4 });
    box(M, PT, -3.5, 3.5, 1.2, 4.4, -3.1, -.6, 'pauldron', { id: 'padL' + sd, c: .9, bevel: .6, bias: .38 });
    // chevron (dobbel V som peker utover/nedover armen), på toppflaten
    const zt = 2.24, V = (o) => [[-2.0, -.6 + o], [0, .9 + o], [2.0, -.6 + o], [2.0, .2 + o], [0, 1.7 + o], [-2.0, .2 + o]];
    for (const o of [-1.4, .2]) { const pts = V(o).map(([x, y]) => PT(x * .9, sd * y * .62 + .3 * sd, zt)); decal(top, sd > 0 ? pts : pts.reverse(), 'chevron', PT.dir(0, 0, 1)); }
  }
  // ---- hjelm: lavpoly kuppel (10-kant) med skjørt, visirbånd ≈ 120°, ansiktsplate, øreplater, midtrygg, antenne
  const hz = lerp(DIM.helmZ, DIM.helmZKneel, kn);
  const HT = sub_frame(TT, [1.4 + (q.helmFwd || 0), 0, hz], 0, q.helmPitch || 0);
  const rot = Math.PI / 10;   // en kant (ikke et hjørne) peker fram → bredt flatt visirfelt
  const H = loft(M, HT, [
    { pts: ngon(10, 4.9, 4.9, rot), z: -4.4, dx: -.5 },
    { pts: ngon(10, 6.0, 5.8, rot), z: -1.4 },
    { pts: ngon(10, 5.9, 5.7, rot), z: 2.0 },
    { pts: ngon(10, 4.3, 4.3, rot), z: 4.3, dx: -.3 },
    { pts: ngon(5, 2.2, 2.2, 0).flatMap(p => [p, p]), z: 5.6, dx: -.4 },
  ], 'helm', { id: 'helm', bias: .55 });
  // visir: mørkt glass + cyan kjerne, følger frontfasettene (−60°…+60°)
  const vband = (a0, a1, z0, z1, off, mat) => { const n = 4; for (let i = 0; i < n; i++) { const t0 = lerp(a0, a1, i / n), t1 = lerp(a0, a1, (i + 1) / n);
      const r = (z) => z < 0 ? lerp(6.0, 5.9, (z + 1.4) / 3.4) : lerp(6.0, 5.9, (z + 1.4) / 3.4);
      const P = (t, z) => HT(Math.cos(t) * (r(z) + off), Math.sin(t) * (r(z) * .967 + off), z);
      const pts = [P(t0, z0), P(t1, z0), P(t1, z1), P(t0, z1)]; const nn = HT.dir(Math.cos((t0 + t1) / 2), Math.sin((t0 + t1) / 2), 0);
      decal(H, pts, mat, nn); } };
  vband(-1.1, 1.1, -1.3, 1.9, .12, 'visor');
  vband(-1.02, 1.02, -.4, 1.2, .2, 'cyan');   // v4.1: bredere visirglød
  box(M, HT, 3.6, 6.0, -2.6, 2.6, -4.6, -1.5, 'helm', { id: 'face', c: .8, taper: [.8, .85], bias: .6 });
  for (const sd of [-1, 1]) box(M, HT, -1.8, 1.6, sd > 0 ? 5.3 : -6.7, sd > 0 ? 6.7 : -5.3, -2.6, 1.0, 'gunL', { id: 'ear' + sd, c: .6, bevel: .5, bias: .62 });
  beam(M, HT(3.6, 0, 3.4), HT(-.6, 0, 5.75), 1.3, .9, HT.dir(0, 0, 1), 'helmRidge', { id: 'ridgeA', c: .25, bias: .7 });
  beam(M, HT(-.6, 0, 5.75), HT(-4.6, 0, 3.3), 1.3, .9, HT.dir(0, 0, 1), 'helmRidge', { id: 'ridgeB', c: .25, bias: .7 });
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
  const TT = torsoFrame(yaw, q); const look = q.look || weaponLook('rifle');
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
