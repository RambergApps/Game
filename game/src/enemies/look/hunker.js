// Hunker (#e0c234, svovelgul) – krumbøyd menneskeudyr som bruker LAVT cover. Lesepunkter: høy, kuppelformet
// beltedyrrygg av forkullede, overlappende beinplater med svovelgul glød i sømmene; menneskearmer og -hender rundt en
// grov slaggrifle; lav hodeskalle med snute og gule øyne under skjoldkanten; dyrebein (digitigrad) og kort platehale.
// Parametre: g/amp gange, crouch 0–1 krumbøyd sprint, cov 1 = coverstilling der peek 0–1 er oppreisningen
// (peek 0: dukket helt, toppen ≈ z 22 < low 24; peek 1: reist, rifla på muren, munning z ≈ 27), atk = skuddfase
// (blink kun i atk < 0.34), fl = kjøttreaksjon (treff), die. Munningslys/partikler eier VFX.
import { model, shell, tube, cone, gline, gspot, rot, rotAbout, add, sub, mul, norm, lerp3, clamp, smooth, TAU } from './paint3d.js';
import { MATS } from './mats.js';
import { prism, plate, frame, outlines } from './facet.js';
import { ik, stride, mapItems } from './kin.js';

// v3 (Alexanders valg): standard = A (lys beinkuppel, port arms) + rygg-/sidepigger fra B. ?hunkerVar=B / =0 (v2) beholdt for sammenligning.
const VAR = (((globalThis.location?.search || '').match(/hunkerVar=([AB0])/) || [])[1] || 'A').replace('0', '');
const Y = [224, 194, 52], YHOT = [255, 246, 196];
const HPLATE = { lo: [2, 2, 2], mid: [13, 13, 13], hi: [44, 44, 46], edge: [92, 92, 96], seam: [2, 2, 2], spec: 0.35 };   // forkullet bein, koksgrå (ingen oliven)   // forkullet bein
const HSKIN = { lo: [1, 1, 1], mid: [10, 10, 10], hi: [36, 36, 38], edge: [86, 86, 90], seam: [1, 1, 1], spec: 0.3 };
const SLAG = { lo: [4, 4, 4], mid: [26, 25, 24], hi: [78, 74, 70], edge: [136, 128, 118], seam: [3, 3, 3], spec: 0.8 };
if (VAR === 'A') { Object.assign(HPLATE, { lo: [20, 17, 13], mid: [70, 62, 50], hi: [176, 162, 136], edge: [236, 214, 170], spec: 0.5 }); }   // A: lys bein
if (VAR === 'B') { Object.assign(HPLATE, { lo: [4, 4, 4], mid: [30, 28, 26], hi: [96, 90, 80], edge: [200, 160, 100], spec: 0.45 }); }      // B: mørk, varm rim
if (VAR) { Object.assign(SLAG, { lo: [8, 7, 6], mid: [52, 48, 44], hi: [140, 132, 120], edge: [220, 206, 180] }); Object.assign(HSKIN, { hi: [52, 50, 46], edge: [140, 116, 86] }); }
export const HUNKER_SCALE = 1.2;
export const HUNKER_MUZZLE = { fwd: 23, z: 27, side: 0 };   // side: + = høyre for facing (v3b settes under)   // verdens-px (etter HUNKER_SCALE) fram fra fotpunktet / høyde, i skytestilling

const lerp = (a, b, t) => a + (b - a) * t;
export function buildHunker(p = {}) {
  const M = model(), body = model();
  const g = p.g || 0, amp = p.amp || 0, br = p.br || 0, dd = p.die || 0, fl = p.fl || 0;
  const cov = p.cov || 0, pk = cov ? clamp(p.peek ?? 0) : 0, cr = clamp(p.crouch || 0), A = p.atk ?? -1;
  const flash = A >= 0 && A < 0.34, recoil = A < 0 ? 0 : A < 0.34 ? 1.4 : A < 0.67 ? 0.6 : 0;
  const breath = Math.sin(br * TAU) * 0.4, bob = Math.abs(Math.sin(g * TAU)) * 0.9 * amp;
  const aim = cov ? smooth(pk) : (A >= 0 ? 1 : 0);
  // ---- stilling: bekken P, bryst C (rygg/skjold følger linja P→C)
  let pz, cz, cx;
  if (cov) { pz = lerp(-4, 12.5, aim); cz = lerp(4.5, 21, aim); cx = lerp(7, 3.5, aim); }
  else if (A >= 0) { pz = 12.5; cz = 21; cx = 3.5; }
  else { pz = 14 - 4.5 * cr; cz = 22 - 8 * cr; cx = 4 + 3 * cr; }
  pz += breath * 0.3 - bob; cz += breath - bob;
  const fw = cov ? 10 * (1 - aim) : 0;   // dukket: presset fram mot muren
  const P = [-5 + fw - recoil - fl * 1.5, 0, pz], C = [cx + fw - recoil - fl * 2.5, 0, cz + fl * 0.8];
  const d = norm(sub(C, P)), n = [-d[2], 0, d[0]], R = 8.2;
  // ---- kjerne under skjoldet
  shell(body, lerp3(P, C, 0.5), [9.5, 6.6, 6], rot(0, -Math.atan2(d[2], d[0])), HSKIN, { nA: 6, nE: 2, seam: 'dark', gap: 0.18, jitter: 0.25, seed: 4, jit: 0.1 });
  // ---- beltedyrrygg: 6 bånd × 3 overlappende beinplater, gule sømmer mellom båndene
  const NB = 4, bands = [];
  for (let b = 0; b < NB; b++) {
    const t = b / (NB - 1), base = add(lerp3(P, C, -0.15 + t * 1.25), [0, 0, 0]), lift = R * (VAR === 'A' ? (cov ? lerp(0.72, 1.45, aim) : 1.45) + 0 : VAR === 'B' ? 0.75 + 0.15 : 0.8 + 0.32 * 1) * (VAR ? 1 : 1) * (VAR ? 1 : (0.8 + 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.1))) / 1.12) * (VAR ? (0.85 + 0.15 * Math.sin(Math.PI * t)) : 1);
    const row = [];
    for (const s of [-1, 0, 1]) {
      const a = s * (VAR === 'B' ? 1.3 : 1.0), out = norm(add(mul(n, Math.cos(a)), [0, Math.sin(a), 0])), c = add(base, mul(out, lift * (s ? 0.92 : 1)));
      plate(body, c, frame(out, d), outlines.scute((s ? 7.6 : 8.6) * (VAR === 'B' ? 1.25 : VAR === 'A' ? 1.12 : 1), (s ? 9 : 9.8) * (VAR ? 1.1 : 1), null), HPLATE, { thick: 1.6, ridge: 1.5, apexU: -1, seed: 200 + b * 3 + s, gap: 0.12, jit: 0.08, edgeTop: 0.3, edgeSide: 0.12 });
      if (VAR || (b + s + 3) % 2) gline(body, [add(c, add(mul(out, 1.3), mul(d, 2.2))), add(c, add(mul(out, 1.6), [0, s * 0.8 + 0.7, 0])), add(c, add(mul(out, 1.2), mul(d, -2)))], Y, 0.18, 0.35, { bias: 1, body: [120, 100, 24] });   // sprekk i platen
      row.push(add(c, mul(out, 0.6)));
    }
    bands.push(row);
  }
  for (let b = 0; b < NB - 1; b++) { const r0 = bands[b], r1 = bands[b + 1], m = (i) => lerp3(r0[i], r1[i], 0.5);
    gline(body, [m(0), m(1), m(2)], Y, VAR === 'B' ? 0.7 : VAR ? 0.5 : 0.42, cov ? lerp(0.45, 0.8, aim) : 0.8, cov && aim < 0.3 ? { bias: 1.1, body: [170, 146, 34] } : { hot: YHOT, bias: 1.1, body: [170, 146, 34] }); }   // dukket: sømmene ulmer uten halo (ingen glød over muren)
  // ryggpigger langs midten (bryter omrisset oppover)
  for (let b = 0; b < NB; b++) { const q = bands[b][1]; cone(body, q, add(q, add(mul(n, (2.6 - b * 0.3) * (cov ? 0.4 + 0.6 * aim : 1)), mul(d, -1.8))), 1.3, HPLATE, { sides: 3 }); if (VAR) { for (const s of [-1, 1]) { const q2 = bands[b][s < 0 ? 0 : 2]; cone(body, q2, add(q2, add(mul(n, 2), [0, s * 1.6, 0])), 1.1, HPLATE, { sides: 3 }); } } }
  // langsgående sømmer mellom midt- og sideplater
  for (const i of [0, 2]) gline(body, bands.map((r) => lerp3(r[1], r[i], 0.5)), Y, 0.34, 0.7, { bias: 1.1, body: [150, 128, 30] });
  // skjoldkant foran: i dekning bøyes den fram som et skjold over hodet
  { const sh = cov ? 1 - aim : 0.25, c = add(add(C, mul(d, 5 + sh)), mul(n, R * 0.55 + sh * 1.5)), nn = norm(add(n, mul(d, 0.6 + sh * 0.6)));
    plate(body, c, frame(nn, [0, 1, 0]), outlines.star(5.5, 4, 0.82, null).map(([a, b2]) => [a * 1.25, b2]), HPLATE, { thick: 1.5, ridge: 1.2, seed: 230 }); }
  if (VAR) { const cf = add(lerp3(P, C, 0.85), mul(d, 3.5));
    for (const s of [-1, 1]) gline(body, [add(cf, [0.5, s * 0.6, 2]), add(cf, [1.6, s * 2.4, 0]), add(cf, [1.2, s * 3.6, -2.4])], Y, 0.32, 0.9, { hot: YHOT, bias: 1.2, body: [150, 120, 26] }); }
  // ---- kort platehale
  { const t0 = add(P, [-3, 0, -1]), tl = [t0, add(t0, [-6, 0, -3]), add(t0, [-11, 0, -6 + Math.min(0, -t0[2] + 7)])];
    prism(body, tl, [4, 2.6, 0.6], HSKIN, { sides: 4, seed: 240 });
    for (let k = 0; k < 2; k++) plate(body, add(lerp3(tl[k], tl[k + 1], 0.5), [0, 0, 2.6 - k]), frame([-0.2, 0, 1], [-1, 0, 0]), outlines.scute(4, 5, null), HPLATE, { thick: 1, ridge: 1, seed: 241 + k }); }
  // ---- hode: lav hodeskalle med snute, under skjoldkanten
  const hc = add(add(C, mul(d, VAR ? 8.5 : 6.5)), mul(n, cov ? -1.5 * (1 - aim) : VAR ? -1 : -0.5)), hz = rot(0, 0.25 - 0.25 * aim);
  shell(body, hc, [4.6, 3.6, 3.1], hz, HPLATE, { nA: 6, nE: 2, seam: 'dark', gap: 0.2, jitter: 0.3, seed: 250, jit: 0.15 });
  cone(body, add(hc, [3, 0, -0.6]), add(hc, [VAR ? 8.6 : 7.6, 0, -2]), VAR ? 2.3 : 1.9, HPLATE, { sides: 5 });
  if (VAR) { plate(body, add(hc, [1.2, 0, 3]), frame([0.35, 0, 1], [1, 0, 0]), outlines.scute(6.5, 5.5, null), HPLATE, { thick: 1, ridge: 1.3, seed: 253 });
    for (const s of [-1, 1]) plate(body, add(C, [0, s * 7, cov ? lerp(-3, 1, aim) : 1]), frame([0, s * 0.6, 1], [1, 0, 0]), outlines.scute(6, 6, null), HPLATE, { thick: 1.2, ridge: 1.3, seed: 254 + s }); }   // skulderplater
  for (const s of [-1, 1]) gspot(body, add(hc, [2.8 + (VAR ? 0.8 : 0), s * 1.8, 0.9]), VAR ? 1.05 : 0.75, Y, 1, { hot: YHOT, bias: 1.7 });
  const S = [-1, 1].map((s) => add(C, [-0.5, s * 6.2, -1.5]));
  const hips = [-1, 1].map((s) => add(P, [0, s * 4.2, -1]));
  // ---- slaggrifle (stokk ved skulder, løp fram) + menneskearmer
  const rz = cov || A >= 0 ? lerp(cz - 1, HUNKER_MUZZLE.z / HUNKER_SCALE, aim) : cz - 3 - 2 * cr, rx = C[0] - 1, ry = 2.2;
  const lowReady = cov || A >= 0 ? 1 - aim : 1, hug = cov ? 1 - aim : 0;
  const tip0 = [rx + 19 - lowReady * 2, ry - lowReady * 1.5, rz - lowReady * 5.5], tip = lerp3(tip0, [rx + 3, ry - 15, rz + 1.5], hug);   // i dekning: rifla på tvers foran brystet, lavt
  let r0 = [rx, ry, rz], tipF = tip;
  if (VAR && !cov && A < 0) {
    if (VAR === 'A') { r0 = [C[0] + 4, 8.5, pz - 3]; tipF = [C[0] + 9, -8, cz + 6]; }          // port arms: diagonalt over brystet
    else { r0 = [P[0] - 4, 9.5, pz - 2]; tipF = [C[0] + 16, 11, pz + 1]; }                    // langs høyre side, hoftehøyde
  }
  const yawR = VAR && !/hunkerRifle=0/.test(globalThis.location?.search || '') ? 0.44 * aim : 0;   // v3b: i sikte/peek vinkles rifla ~25° til høyre side (ingen snabel mot kamera)
  if (yawR) { r0 = add(r0, [0, 2.5 * aim, 0]); const v = sub(tipF, r0), c = Math.cos(yawR), sn = Math.sin(yawR); tipF = add(r0, [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2]]); }
  const dirR = norm(sub(tipF, r0)), at = (u) => add(r0, mul(dirR, u));
  mapItems(body, (q) => q); M.items.push(...body.items);
  if (VAR) { prism(M, [at(-6), at(-1)], [2.4, 1.5], SLAG, { sides: 4, seed: 259 }); gline(M, [at(7), at(16)], Y, 0.22, 0.6, { bias: 1 }); gspot(M, at(17.6), 0.9, YHOT, 0.9, { bias: 1.4 }); }   // kolbe, gul stripe, lys munning
  prism(M, [at(-1), at(6)], [2.4, 2.1], SLAG, { sides: 4, seed: 260 });                     // mekanisme
  prism(M, [at(6), at(17.5)], [1.25, 1.05], SLAG, { sides: 4, seed: 261, capLen: 0.1 });     // løp
  prism(M, [add(at(3.5), [0, 0, -1.2]), add(at(5), [0, 0, -5])], [1.3, 1.1], SLAG, { sides: 4, seed: 262 });   // magasin
  gline(M, [at(1), at(5)], Y, 0.35, 0.7, { bias: 1 });                                         // glødende slaggkammer
  if (flash) gspot(M, at(18.3), 1.8, Y, 1, { hot: YHOT, bias: 2 });
  else gspot(M, at(17.8), 0.5, Y, 0.6, { bias: 1 });
  const hands = VAR && !cov && A < 0 ? (VAR === 'B' ? [at(10), at(0.5)] : [at(9), at(0.5)]) : [at(8.5), at(2)];
  for (let i = 0; i < 2; i++) { const s = i ? 1 : -1, h = hands[i], e = ik(S[i], h, 7, 7.5, [-0.4, s * 0.9, -0.6]);
    prism(M, [S[i], e, h], VAR ? [3, 2.5, 2] : [2.6, 2.1, 1.5], HSKIN, { sides: 4, seed: 270 + i });
    plate(M, add(S[i], [0, s * 1.4, 1.6]), frame([0, s * 0.7, 1], [1, 0, 0]), outlines.scute(4, 4.5, null), HPLATE, { thick: 1, ridge: 1.2, seed: 272 + i });
    for (let f = 0; f < 3; f++) cone(M, add(h, [0.4, s * 0.3, -0.4 + f * 0.5]), add(h, [1.6, -s * 0.9, -1.4 + f * 0.6]), 0.42, HSKIN, { sides: 3 }); }
  // ---- dyrebein (digitigrade): lår, legg, mellomfot, klør
  for (let i = 0; i < 2; i++) { const s = i ? 1 : -1, H = hips[i], st = stride(g + i * 0.5, 6.5 * amp, 2.6 * amp);
    const sp = cov ? lerp(9, 6, aim) : 6.5, fx = cov ? lerp(4, 0, aim) : 1;
    const foot = [fx + st.dx - recoil * 0.3, s * sp, st.lift], heel = add(foot, [-3.2, 0, 3.4]);
    const knee = ik(H, heel, 7.5, 7, [1, s * 0.3, 0.2]);
    prism(M, [H, knee, heel, foot], [3.4, 2.4, 1.6, 1.1], HSKIN, { sides: 4, seed: 280 + i });
    plate(M, add(knee, [0.6, s * 0.6, 0.8]), frame([0.7, s * 0.4, 0.5], [0, 0, 1]), outlines.kite(4, 3.4, 0.6), HPLATE, { thick: 0.9, ridge: 1, seed: 282 + i });
    for (const k of [-1, 0, 1]) cone(M, foot, add(foot, [2.4, k * 1.3, -0.4]), 0.55, HPLATE, { sides: 3 }); }
  if (dd > 0) {   // velter over på siden, skjoldet opp/ut
    const Rr = rot(0, 0.15 * dd, 1.35 * dd);
    mapItems(M, (q) => { const r = rotAbout(q, [0, 0, 4], Rr); return [r[0], r[1], Math.max(0.2, r[2] * (1 - 0.35 * dd) + dd * 1.2)]; });
  }
  return M;
}

// v3b: munning i skytestilling, målt fra modellen (verdens-px etter skala): rifla vinklet ~25° til høyre.
{ const C0 = [3.5, 0, 21], r0 = [C0[0] - 1, 2.2 + 2.5, HUNKER_MUZZLE.z / HUNKER_SCALE], t = [C0[0] - 1 + 19, 2.2, HUNKER_MUZZLE.z / HUNKER_SCALE];
  if (VAR) { const v = sub(t, r0), c = Math.cos(0.44), sn = Math.sin(0.44), tp = add(r0, [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, 0]), d = norm(sub(tp, r0)), m = add(r0, mul(d, 17.8));
    HUNKER_MUZZLE.fwd = +(m[0] * HUNKER_SCALE).toFixed(1); HUNKER_MUZZLE.side = +(m[1] * HUNKER_SCALE).toFixed(1); } }
