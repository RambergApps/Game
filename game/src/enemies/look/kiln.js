// Kiln (Heavy, #ff7a1a): lav, bred, tung skapning med STORE mørke plater og oransje glødesømmer langs platekantene
// (ingen symbolkryss). Lesepunkter: bred skulderpukkel av plater, glødende ovnskjerne bak i ryggen (lyser opp ved
// oppspinning), og en tung roterende TROMME (seks løp) på høyre framarm. atk 0–0.5 = oppspinning (tromma roterer, kjernen
// hetes), 0.5–0.8 = skyting (rekyl bakover), 0.8–1 = nedspinning. Munningslyset eier VFX.
import { model, shell, tube, cone, gline, gspot, rot, rotAbout, add, sub, mul, norm, lerp3, smooth, clamp, TAU } from './paint3d.js';
import { MATS } from './mats.js';
import { prism, plate, frame } from './facet.js';
import { ik, stride, mapItems } from './kin.js';

const KMETAL = { lo: [3, 3, 3], mid: [24, 24, 24], hi: [80, 78, 76], edge: [140, 136, 132], seam: [3, 3, 3], spec: 0.8 };   // kald, mørk tromme
const OR = [255, 122, 26], OHOT = [255, 214, 150];
export const KILN_MUZZLE = [31, 12, 13];   // tromma ut, lokalrom før scale

function seamPlate(M, c, F, out, mat, o, glowK) {
  plate(M, c, F, out, mat, o);
  // glødesøm langs ytterkanten (ikke hele rundt: bryter av ved spissen, varierende styrke)
  const P = out.map(([a, b]) => add(add(c, mul(F.u, a * 1.04)), add(mul(F.v, b * 1.04), mul(F.n, -0.25))));
  const n = P.length, k0 = o.seamFrom ?? 1;
  for (let j = 0; j < n - 2; j++) { const a = P[(k0 + j) % n], b = P[(k0 + j + 1) % n], t = j / (n - 3);
    gline(M, [a, b], OR, 0.42 * (1 - 0.4 * Math.abs(t - 0.5) * 2) * glowK, 0.75 + 0.25 * glowK, { hot: t > 0.25 && t < 0.75 ? OHOT : null, bias: 1.2 }); }
}

export function buildKiln(p = {}) {
  const M = model();
  const g = p.g || 0, amp = p.amp || 0, br = p.br || 0, dd = p.die || 0;
  const A = p.atk ?? -1;
  const spin = A < 0 ? 0 : A < 0.5 ? A / 0.5 : A < 0.8 ? 1 : 1 - (A - 0.8) / 0.2;
  const heat = 0.45 + 0.55 * spin;
  const recoil = A >= 0.5 && A < 0.8 ? (Math.floor(((A - 0.5) / 0.3) * 4) % 2 ? 1.6 : 0.6) : 0;
  const drumA = A < 0 ? 0 : A * TAU * 1.7;
  const bob = Math.abs(Math.sin(g * TAU)) * 0.8 * amp, breath = Math.sin(br * TAU);
  const BR = rot(0, 0.05 - 0.03 * recoil, Math.sin(g * TAU) * 0.03 * amp), piv = [0, 0, 14];
  const B = (q) => add(rotAbout(q, piv, BR), [-recoil, 0, -bob + breath * 0.3]);
  const body = model();
  // ---- kropp: bred, lav tønne
  shell(body, [0, 0, 15], [13, 12, 9], rot(0, 0.08), MATS.kchitin, { nA: 7, nE: 3, seam: 'dark', gap: 0.18, jitter: 0.25, seed: 3, jit: 0.1 });
  // ---- ovnskjerne bak i ryggen (gløder gjennom en luke mellom platene)
  shell(body, [-8, 0, 22], [5, 6, 4], rot(0, -0.4), MATS.kcore, { nA: 6, nE: 2, seam: null, jitter: 0.25, seed: 21, emit: OR, ei: 0.7 + 0.6 * spin });
  gspot(body, [-11, 0, 24], 1.5 + spin * 1.1, OR, 0.6 + 0.4 * spin, { hot: OHOT, bias: 1.6 });
  // ---- store plater: skulderpukkel (venstre/høyre), rygg foran og bak, hjelmplate over hodet
  const PL = [
    [[3, -7, 24], [0.15, -0.55, 1], [1, 0, 0], 13, 10, 2],
    [[3, 7.5, 24.5], [0.15, 0.55, 1], [1, 0, 0], 13, 10, 3],
    [[-3, 0, 25.5], [-0.3, 0, 1], [1, 0, 0], 9, 12, 0],
    [[-13, 0, 18], [-1, 0, 0.6], [0, 0, 1], 9, 15, 1],
    [[12, 0, 19], [1, 0, 0.8], [0, 0, 1], 8, 11, 4],
  ];
  PL.forEach(([c, n, f, L, W, s], i) => seamPlate(body, c, frame(n, f), [[L * 0.6, 0], [L * 0.38, W * 0.52], [-L * 0.3, W * 0.58], [-L * 0.62, W * 0.2], [-L * 0.55, -W * 0.25], [-L * 0.25, -W * 0.56], [L * 0.4, -W * 0.48]],
    MATS.kplate, { thick: 2, ridge: 1.6, apexU: -L * 0.1, seed: 100 + i * 7, gap: 0.12, jit: 0.07, edgeTop: 0.8, edgeSide: 0.35, seamFrom: s }, i < 2 ? heat : 0.7));
  // ---- hode: lavt, foran under platene, to oransje øyespalter
  const hc = [15, 0, 12];
  shell(body, hc, [5, 5.5, 3.6], rot(0, 0.15), MATS.kchitin, { nA: 5, nE: 2, seam: 'dark', gap: 0.2, jitter: 0.25, seed: 8, jit: 0.1 });
  for (const s of [-1, 1]) gline(body, [add(hc, [4.2, s * 1, 1]), add(hc, [3.4, s * 3.2, 1.6])], OR, 0.5, 1, { hot: OHOT, bias: 1 });
  for (const s of [-1, 1]) cone(body, add(hc, [3, s * 2.6, -2]), add(hc, [7, s * 3.4, -3.2]), 1, KMETAL, { sides: 3 });
  const Sl = B([8, -11, 17]), Sr = B([8, 11, 17]);
  const hips = [[-8, -9, 12], [-8, 9, 12]].map(B);
  mapItems(body, B); M.items.push(...body.items);
  // ---- fire korte, tykke bein
  const legs = [[Sl, -1, 9, g], [hips[0], -1, -8, g + 0.5], [hips[1], 1, -8, g], [Sr, 1, 9, g + 0.5]];
  for (const [H, s, fx, ph] of legs) {
    const st = stride(ph, 6 * amp, 2.2 * amp);
    const foot = [fx + st.dx - recoil * 0.3, s * 15, st.lift], knee = ik(H, foot, 7, 7.5, [fx > 0 ? -0.3 : 0.6, s * 0.8, 0.8]);
    prism(M, [H, knee, foot], [4.6, 3.8, 3], MATS.kchitin, { sides: 4, seed: 70 + fx * s, jit: 0.08 });
    plate(M, add(knee, [0, s * 1, 1.6]), frame([0, s * 0.6, 1], [1, 0, 0]), [[3.5, 0], [0, 3], [-3.5, 0], [0, -3]], MATS.kplate, { thick: 1, ridge: 1, seed: 80 + fx });
  }
  // ---- TROMME på høyre framarm: hus + seks løp rundt aksen, glødende kammer ved oppspinning
  {
    const r0 = add(Sr, [2 - recoil, 1, 0]), ax = [1, 0, 0], c0 = add(r0, [4, 0, -3]);
    const ctr = (x) => add(c0, [x, 0, 0]);
    shell(M, ctr(2), [5.5, 4.4, 4.4], rot(0, 0), KMETAL, { nA: 6, nE: 2, seam: 'dark', gap: 0.15, jitter: 0.1, seed: 90, jit: 0.05 });
    gline(M, [ctr(-1.5), ctr(5.5)], OR, 0.9 * spin + 0.15, 0.3 + 0.7 * spin, { hot: OHOT, bias: 1 });   // kammer-glød (spinUp)
    for (let k = 0; k < 6; k++) { const a = drumA + k * TAU / 6, o = [0, Math.cos(a) * 2.6, Math.sin(a) * 2.6];
      tube(M, [add(ctr(5), o), add(ctr(15.5), o)], [0.9, 0.8], KMETAL, { sides: 4, rings: 1, seam: null, capLen: 0.2 }); }
    shell(M, ctr(14.5), [0.9, 3.7, 3.7], rot(0, 0), KMETAL, { nA: 6, nE: 1, seam: null, jitter: 0.05, seed: 91 });
    prism(M, [Sr, r0, ctr(0)], [4.4, 4, 3.6], MATS.kchitin, { sides: 4, seed: 92 });
  }
  if (dd > 0) {
    const R = rot(0, 0.1 * dd, 1.1 * dd);
    mapItems(M, (q) => { const r = rotAbout(q, [0, 14, 0], R); return [r[0], r[1], Math.max(0.2, r[2] * (1 - 0.3 * dd))]; });
  }
  return M;
}
