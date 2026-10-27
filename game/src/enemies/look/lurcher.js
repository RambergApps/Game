// Lurcher (Flanker, #8e1e1e) – lav insekt-øgle: segmentert kropp, lang piggete hale, spisst hode med to røde øyne,
// hinnekrage (rød, glødende årer) som folder seg ut ved sprint og før utfallet, fire gangbein + to fangbein foran.
import { model, shell, tube, cone, membrane, gline, gspot, rot, rotAbout, add, sub, mul, norm, lerp3, clamp, smooth, TAU } from './paint3d.js';
import { MATS as M0 } from './mats.js';
const MATS = { ...M0, chitin: M0.lchitin, plate: M0.lplate, bone: M0.lbone, frill: M0.lfrill };
import { prism, plate, frame, outlines } from './facet.js';
import { ik, stride, mapItems } from './kin.js';

const EYE = [142, 30, 30], EYEHOT = [255, 196, 168], VEIN = [142, 30, 30], VEINHOT = [255, 120, 90];

export function buildLurcher(p = {}) {
  const M = model();
  const g = p.g || 0, amp = p.amp || 0, br = p.br || 0, fl = p.fl || 0, dd = p.die || 0;
  let fr = p.fr ?? 0.25;
  const A = p.atk ?? -1;
  let coil = 0, lunge = 0;
  if (A >= 0) {
    if (A < 0.5) { coil = smooth(clamp(A / 0.5)); fr = Math.max(fr, coil); }
    else if (A < 0.8) { const t = (A - 0.5) / 0.3; lunge = Math.sin(t * Math.PI * 0.5 + 0.2); coil = 1 - t; fr = 1; }
    else { const t = (A - 0.8) / 0.2; lunge = 1 - smooth(t); fr = 1 - 0.6 * t; }
  }
  fr = clamp(fr * (1 - dd));
  const breath = Math.sin(br * TAU);
  const sway = (x) => Math.sin(g * TAU + x * 0.16) * 1.6 * amp + Math.sin(br * TAU + x * 0.2) * 0.4;
  // kroppsforskyvning: krøller seg bakover (coil), stuper fram (lunge), rykker ved treff
  const shiftX = -2.6 * coil + 7 * lunge - 2.5 * fl, dropZ = -2.2 * coil - 0.8 * lunge + Math.abs(Math.sin(g * TAU)) * 0.7 * amp;
  const BR = rot(0, -0.12 * coil + 0.12 * lunge - 0.2 * fl, 0);
  const B = (q) => add(rotAbout(q, [0, 0, 8], BR), [shiftX, 0, dropZ]);
  const body = model();

  // ---- kropp + hale (segmentert kitin)
  const spine = [[8, 0, 8.5], [3, 0, 9.4], [-3, 0, 9.2], [-8, 0, 8.4]].map((q) => [q[0], q[1] + sway(q[0]), q[2] + (q[0] < 0 ? 0 : breath * 0.2)]);
  prism(body, spine, [3.8, 5.6, 5.8, 4.4], MATS.chitin, { sides: 6, rings: 1, flat: 0.78, seed: 5, capStart: true, twist: 0 });
  const tail = [[-8, 0, 8.4], [-13, 0, 9.2], [-18, 0, 9.8], [-23, 0, 9], [-27, 0, 7.4], [-30, 0, 5.6]].map((q) => [q[0], q[1] + sway(q[0]) * (1 + (-q[0] - 8) * 0.07), q[2]]);
  prism(body, tail, [4.2, 3.2, 2.4, 1.6, 1.0, 0.3], MATS.chitin, { sides: 4, seed: 6, flat: 0.8 });
  // halebladet: flat, spiss plate på tuppen som bryter omrisset
  { const t0 = tail[4], t1 = tail[5], d = norm(sub(t1, t0)); plate(body, add(t1, mul(d, 2)), frame([0, 0, 1], d), outlines.kite(6.5, 5, 0.7), MATS.plate, { thick: 0.7, ridge: 0.9, seed: 7 }); }
  // ryggskjold: fasetterte overlappende plater langs ryggen (tagget profil)
  for (let i = 0; i < 6; i++) { const q = i < 3 ? spine[i] : tail[i - 2], nxt = i < 3 ? spine[i + 1] : tail[i - 1], h = i < 3 ? 4.2 : 2.6 - (i - 3) * 0.4;
    plate(body, add(q, [0, 0, h]), frame([0.2, 0, 1], norm(sub(nxt, q))), outlines.scute(i < 3 ? 6.5 : 4.5, i < 3 ? 8.5 : 5, null), MATS.plate, { thick: 1, ridge: 1.4, apexU: -1, seed: 40 + i }); }
  const chain = [...spine.slice(1), ...tail.slice(1, 5)];
  for (let i = 0; i < chain.length - 1; i++) { const q = chain[i], h = i < 3 ? 4.6 : 2.8 - (i - 3) * 0.5; const b = add(q, [0, 0, h * 0.85]);
    cone(body, b, add(b, [-2.2, 0, 3.8 - i * 0.3]), 1.0, MATS.bone, { sides: 3 });
    if (i === 2 || i === 4) for (const sd of [-1, 1]) cone(body, add(q, [0, sd * h * 0.55, h * 0.4]), add(q, [-1.8, sd * (h * 0.55 + 2.6), h * 0.3]), 0.7, MATS.bone, { sides: 3 }); }
  // ---- hode, snute, øyne, kjever
  const hc = [13.5, sway(13.5), 8.2], hR = rot(0, 0.12), hr = [5.6, 3.1, 2.7];
  shell(body, hc, hr, hR, MATS.plate, { nA: 6, nE: 2, seam: 'dark', gap: 0.2, jitter: 0.3, seed: 9, spec: 0.45, jit: 0.22 });
  plate(body, add(hc, [0.5, 0, 2.4]), frame([0.15, 0, 1], [1, 0, 0]), outlines.kite(7, 6.5, 0.8), MATS.plate, { thick: 0.8, ridge: 1.2, seed: 10, edgeTop: 0.35 });   // pannekile
  cone(body, add(hc, [3.8, 0, -0.4]), add(hc, [8 + lunge, 0, -1.9]), 1.7, MATS.plate, { sides: 5 });
  cone(body, add(hc, [-1, 0, 2.1]), add(hc, [-5, 0, 4.2]), 1.1, MATS.plate, { sides: 4 });
  for (const s of [-1, 1]) {
    cone(body, add(hc, [5, s * 1.3, -1.8]), add(hc, [7.2 + lunge * 1.5, s * (2.2 + coil), -4.4]), 0.6, MATS.bone, { sides: 4 });
    gspot(body, add(hc, [2.6, s * 1.95, 0.85]), 0.7, EYE, 1, { hot: EYEHOT, bias: 1.6 });
  }
  // ---- hinnekrage: ribber fra nakken, hinne imellom med glødende årer
  const root = [9.5, sway(9.5), 10.2], N = 5, tips = [];
  for (let k = 0; k < N; k++) {
    const th = -1 + (2 * k) / (N - 1);
    const open = [-0.38, Math.sin(th * 1.62), Math.cos(th * 1.62) * 0.95 + 0.12], closed = [-1, Math.sin(th * 1.62) * 0.4, 0.22];
    const d = norm(lerp3(closed, open, fr)), len = 14.5 * (1 - 0.2 * Math.abs(th)) * (0.7 + 0.3 * fr);
    tips.push(add(root, mul(d, len)));
  }
  membrane(body, root, tips, MATS.frill, { scallop: 0.2, gap: 0.12 });
  for (const t of tips) tube(body, [lerp3(root, t, 0.05), t], [0.6, 0.15], MATS.chitin, { sides: 3, rings: 1, seam: null, capLen: 0.3 });
  const va = 0.4 + 0.6 * fr;
  for (let k = 0; k < N - 1; k++) {
    const mid = lerp3(lerp3(tips[k], tips[k + 1], 0.5), root, 0.25), m1 = lerp3(root, mid, 0.45);
    gline(body, [lerp3(root, mid, 0.12), m1, mid], VEIN, 0.22, va, { hot: VEINHOT, bias: 0.9, body: [60, 10, 10] });
  }
  const hips = [[5, 3.4, 8], [-3.5, 4, 8]].flatMap(([x, y, z]) => [[x, -y, z], [x, y, z]]).map(B);
  const fh = [[10, -2.4, 7.2], [10, 2.4, 7.2]].map(B);
  mapItems(body, B); M.items.push(...body.items);

  // ---- fire gangbein (høye knær, insekt) + to fangbein
  const legs = [[hips[0], -1, 6.5, g], [hips[1], 1, 6.5, g + 0.5], [hips[2], -1, -6, g + 0.5], [hips[3], 1, -6, g]];
  for (const [H, s, fx, ph] of legs) {
    const st = stride(ph, 8.9 * amp, 3 * amp);
    const foot = [fx + st.dx + shiftX * 0.25, s * (12.5 - 2 * coil), st.lift];
    const knee = ik(H, foot, 8.5, 9.5, [0, s * 0.45, 1]);
    prism(M, [H, knee, foot], [2.4, 1.8, 0.5], MATS.chitin, { sides: 4, seed: 70 + fx * s, capLen: 0.8 });
    cone(M, add(knee, [0, 0, 0.6]), add(knee, [-1.8, s * 1.2, 3.6]), 0.75, MATS.bone, { sides: 3 });
  }
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const st = stride(g + (s > 0 ? 0.5 : 0), 5 * amp, 2 * amp);
    const hook = add([16.5 + st.dx + 5.5 * lunge + shiftX * 0.5, s * (5.5 + coil * 1.5), 2.2 + st.lift + coil * 2.5 + lunge * 2], [0, 0, 0]);
    const knee = ik(fh[i], hook, 6.5, 7.5, [-0.3, s * 0.6, 1]);
    prism(M, [fh[i], knee, hook], [1.8, 1.3, 0.35], MATS.chitin, { sides: 4, seed: 80 + i, capLen: 0.9 });
    cone(M, lerp3(knee, hook, 0.4), add(lerp3(knee, hook, 0.4), [-0.5, s * 0.3, 2.2]), 0.5, MATS.bone, { sides: 3 });
  }
  if (dd > 0) {
    const R = rot(0, 0.1 * dd, 1.7 * dd);
    mapItems(M, (q) => { const r = rotAbout(q, [0, -3, 5], R); return [r[0], r[1], Math.max(0.2, r[2] * (1 - 0.35 * dd) + dd * 1.5)]; });
  }
  return M;
}
