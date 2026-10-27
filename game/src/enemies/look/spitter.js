// Spitter (Grenadier, #9b59ff): høyreist, foroverbøyd tobent kast-skapning. Lesepunkter: TRE fiolette giftsekker på
// ryggen (gløder; tomme sekker mørkner – pose.sacks 0..3), lang nakke med smalt hode, lang kastearm (høyre) som
// svinger bak over skulderen (windup) og piskes fram (release) mens fremste fulle sekk tømmes. Granaten tegnes av AI/Våpen.
import { model, shell, cone, gline, gspot, rot, rotAbout, add, sub, mul, norm, lerp3, smooth, clamp, TAU } from './paint3d.js';
import { MATS } from './mats.js';
import { prism, plate, frame, outlines } from './facet.js';
import { ik, stride, mapItems } from './kin.js';

const VIO = [155, 89, 255], VHOT = [228, 206, 255], EYE = [196, 140, 255];

export function buildSpitter(p = {}) {
  const M = model();
  const g = p.g || 0, amp = p.amp || 0, br = p.br || 0, dd = p.die || 0, sacks = p.sacks ?? 3;
  const A = p.atk ?? -1;
  const wind = A < 0 ? 0 : A < 0.5 ? smooth(A / 0.5) : A < 0.65 ? 1 - smooth((A - 0.5) / 0.15) : 0;
  const whip = A < 0.5 ? 0 : A < 0.8 ? smooth((A - 0.5) / 0.3) : 1 - smooth((A - 0.8) / 0.2);
  const drain = A < 0 ? 0 : A < 0.5 ? A / 0.5 * 0.4 : A < 0.8 ? 0.4 + 0.6 * (A - 0.5) / 0.3 : 1;   // fremste sekk tømmes
  const bob = Math.abs(Math.sin(g * TAU)) * 1.2 * amp, breath = Math.sin(br * TAU);
  const lean = 0.22 - 0.2 * wind + 0.28 * whip;
  const BR = rot(0, lean, Math.sin(g * TAU) * 0.05 * amp), piv = [0, 0, 18];
  const B = (q) => add(rotAbout(q, piv, BR), [0, 0, -bob + breath * 0.3]);
  const body = model();
  // ---- torso: smal brystkasse + bekken, fasettert kitin
  shell(body, [0, 0, 26], [6.5, 6, 9], rot(0, 0.1), MATS.schitin, { nA: 6, nE: 3, seam: 'dark', gap: 0.18, jitter: 0.25, seed: 4, jit: 0.1 });
  shell(body, [-1, 0, 17], [5, 5.5, 4], rot(0, 0), MATS.schitin, { nA: 5, nE: 2, seam: 'dark', gap: 0.2, jitter: 0.3, seed: 5, jit: 0.1 });
  plate(body, [4.5, 0, 28], frame([1, 0, 0.35], [0, 0, 1]), [[7, 0], [3, 5], [-6, 4], [-7, 0], [-6, -4], [3, -5]], MATS.splate, { thick: 1, ridge: 1.1, seed: 6, jit: 0.07 });   // brystplate
  // ---- TRE SEKKER på ryggen (trekant: to nede, én oppe), glød i kjernen
  const SK = [[-7.5, -3.6, 25, 4.2], [-7.5, 3.6, 25, 4.2], [-6.5, 0, 32.5, 4.6]];
  SK.forEach(([x, y, z, r], i) => {
    const full = i < sacks, act = full && i === sacks - 1 ? drain : 0;
    const k = 1 - 0.35 * act, rr = [r * 0.9 * k, r * k, r * 1.1 * k];
    shell(body, [x - (1 - k) * 2, y, z], rr, rot(0, -0.2), full ? MATS.sack : MATS.sackOff, { nA: 6, nE: 3, seam: null, jitter: 0.2, seed: 50 + i, jit: 0.06,
      emit: full ? VIO : null, ei: full ? 0.55 + 0.35 * act : 0 });
    if (full) gspot(body, [x - r * 0.6, y, z + r * 0.3], r * 0.45, VIO, 0.7 + 0.3 * act, { hot: VHOT, bias: 1.4 });
    // kitinbøyler over sekken (bryter den runde formen)
    gline(body, [[x + 1, y - r, z], [x - r * 0.9, y, z + r * 0.9], [x + 1, y + r, z]], [70, 40, 120], 0.2, 0.5, { bias: 0.2 });
    cone(body, [x + 1.5, y, z + r * 0.9], [x - r * 1.2, y * 1.2, z + r * 1.4], 0.7, MATS.splate, { sides: 3 });
  });
  // slange fra fremste sekk til munnen (lyser når den tømmes)
  gline(body, [[-4, 0, 34], [1, 0, 37], [6, 0, 37.5]], VIO, 0.3, 0.35 + 0.65 * drain * (sacks > 0 ? 1 : 0), { hot: VHOT, bias: 0.8 });
  // ---- nakke + smalt hode (spytter), lys fiolett øye-/munnglød
  const nk = [[4, 0, 33], [8, 0, 37], [11.5 + whip * 2, 0, 38.5 - wind]];
  prism(body, nk, [2.6, 2.1, 1.8], MATS.schitin, { sides: 5, seed: 7, jit: 0.08 });
  const hc = add(nk[2], [3, 0, 0.4]);
  shell(body, hc, [4.6, 2.6, 2.4], rot(0, 0.15), MATS.splate, { nA: 5, nE: 2, seam: 'dark', gap: 0.2, jitter: 0.25, seed: 9, jit: 0.15, spec: 0.6 });
  cone(body, add(hc, [-1, 0, 1.6]), add(hc, [-5, 0, 4]), 1, MATS.splate, { sides: 4 });   // nakkekam
  for (const s of [-1, 1]) gspot(body, add(hc, [1.8, s * 1.5, 0.8]), 0.55, EYE, 1, { hot: VHOT });
  gspot(body, add(hc, [4.4, 0, -0.6]), 0.6 + whip * 0.8, VIO, 0.5 + whip * 0.5, { hot: VHOT });
  const Sl = B([2, -6, 30]), Sr = B([2, 6, 30.5]), Hl = B([-1, -4, 16]), Hr = B([-1, 4, 16]);
  mapItems(body, B); M.items.push(...body.items);
  // ---- bein: tynne, digitigrade, høye (Spitter er høyest av småtypene)
  for (const [s, H, ph] of [[-1, Hl, g], [1, Hr, g + 0.5]]) {
    const st = stride(ph, 8 * amp, 3 * amp);
    const foot = [st.dx, 6 * s, st.lift], ank = add(foot, [-2.6, 0, 5]);
    const knee = ik(H, ank, 7.5, 7, [1, 0.25 * s, 0]);
    prism(M, [H, knee, ank, foot], [3, 2.4, 1.6, 1.1], MATS.schitin, { sides: 4, seed: 30 + s, jit: 0.08 });
    cone(M, add(foot, [0.4, 0, 0.6]), add(foot, [3.6, 0, 0]), 0.9, MATS.splate, { sides: 3 });
    cone(M, knee, add(knee, [2.4, s * 0.6, 2.6]), 0.7, MATS.splate, { sides: 3 });
  }
  // ---- venstre arm: kort, klo foran brystet
  { const hand = [8, -7, 22 + wind * 2], el = ik(Sl, hand, 6, 6, [-1, -0.5, -0.5]);
    prism(M, [Sl, el, hand], [2.2, 1.8, 1.2], MATS.schitin, { sides: 4, seed: 40 });
    cone(M, hand, add(hand, [3, -0.5, -1]), 0.8, MATS.splate, { sides: 3 }); }
  // ---- KASTEARM (høyre): lang, tre ledd, hånd med glødende kule ved windup
  { const st = stride(g, 6 * amp, 2 * amp);
    const rest = [6 + st.dx * 0.4, 9, 18], back = [-8, 8, 42], fwd = [20, 5, 34];
    const hand = whip > 0 ? lerp3(back, fwd, whip) : lerp3(rest, back, wind);
    const el = ik(Sr, hand, 9, 9.5, whip > 0 ? [0, 1, 0.6] : [-0.4, 1, -0.4]);
    prism(M, [Sr, el, hand], [2.6, 2.1, 1.4], MATS.schitin, { sides: 4, seed: 60, jit: 0.08 });
    cone(M, el, add(el, [-2.4, 1.2, 1.6]), 0.8, MATS.splate, { sides: 3 });
    for (const a of [-0.5, 0, 0.5]) cone(M, hand, add(hand, [2.6 * Math.cos(a), 2.6 * Math.sin(a) + 0.4, 0.8]), 0.5, MATS.splate, { sides: 3 });
    if (A >= 0 && A < 0.65 && sacks > 0) gspot(M, add(hand, [0.6, 0, 1.4]), 1.1 + wind * 0.8, VIO, 0.6 + 0.4 * wind, { hot: VHOT, bias: 1.5 });
  }
  if (dd > 0) {
    const R = rot(0, -1.35 * dd, 0.3 * dd);
    mapItems(M, (q) => { const r = rotAbout(q, [-2, 0, 0], R); return [r[0], r[1], Math.max(0.2, r[2])]; });
  }
  return M;
}
