// Husk (Grunt, #c0392b), v2: foroverbøyd firbeint skapning med tre tydelige lesepunkter:
//   SKALL: fem store fasetterte skallplater over en glødende kjerne (gløden synes bare i fugene), tre ryggpigger.
//   HODE:  kantet kile foran og under skallkanten, med panneplate og glødende øyespalte, peker i gangretningen.
//   BLADARM: høyre underarm ender i et langt, flatt blad med glødende egg. Det løftes og stikkes ved angrep.
// Venstre forbein er en enkel klo-støtte, og bakbeina er digitigrade. Få pigger, store flater og tydelige valørgrupper:
// skallet er lysest (plate), kroppen mørk (chitin) og bladet beinfarget.
// buildHusk(pose) → modell i lokalrom (x fram, y høyre, z opp; verdens-px før kind.scale).
import { rng, model, shell, cone, gline, gspot, rot, rotAbout, add, sub, mul, norm, cross, dot, lerp3, smooth, TAU } from './paint3d.js';
import { MATS } from './mats.js';
import { prism, plate, frame } from './facet.js';
import { ik, stride, mapItems } from './kin.js';

const GLOW = [192, 57, 43], HOT = [255, 110, 70], CORE = [255, 206, 160];   // #c0392b, varmere mot kjernen
const PLATES = [   // [asimut, elevasjon, lengde, bredde, rotasjon i planet]: store skallplater, tupp bakover
  [0.15, 1.05, 23, 19, 0],                   // stor rygg-/skulderplate
  [0.05, 0.38, 14, 14, 0.2],                 // foran (skulderskjold, lavt)
  [Math.PI * 0.6, 0.32, 16, 13, -0.3],       // høyre flanke
  [-Math.PI * 0.6, 0.32, 16, 13, 0.3],       // venstre flanke
  [Math.PI, 0.45, 14, 13, 0],                // bak
];
const shellOutline = (L, W) => [[L * 0.62, 0], [L * 0.4, W * 0.5], [-L * 0.25, W * 0.56], [-L * 0.62, W * 0.22], [-L * 0.5, -W * 0.12], [-L * 0.3, -W * 0.52], [L * 0.38, -W * 0.48]];

export function buildHusk(p = {}) {
  const M = model();
  const g = p.g || 0, amp = p.amp || 0, br = p.br || 0, dd = p.die || 0;
  const A = p.atk ?? -1;
  const raise = A < 0 ? 0 : A < 0.5 ? smooth(A / 0.5) : A < 0.8 ? 1 : 1 - smooth((A - 0.8) / 0.2);
  const thrust = A >= 0.5 && A < 0.8 ? Math.sin(((A - 0.5) / 0.3) * Math.PI) : 0;
  const heat = A < 0 ? 0 : A < 0.5 ? A / 0.5 : A < 0.8 ? 1 : 1 - (A - 0.8) / 0.2;
  const bob = Math.abs(Math.sin(g * TAU)) * 1.0 * amp, breath = Math.sin(br * TAU);
  const pitch = -0.1 * raise, roll = Math.sin(g * TAU) * 0.04 * amp;
  const piv = [-5, 0, 12], BR = rot(0, pitch, roll);
  const B = (q) => add(rotAbout(q, piv, BR), [0, 0, -bob + breath * 0.3]);
  const body = model();

  // ---- kropp under skallet (mørk) og glødende kjerne
  shell(body, [3, 0, 11.5], [10, 8, 6], rot(0, 0.22), MATS.chitin, { nA: 5, nE: 2, seam: 'dark', gap: 0.2, jitter: 0.3, seed: 3, jit: 0.1 });
  const cR = rot(0, 0.3), cc = [-3.5, 0, 14.5], cr = [11.5, 9, 7.6 + breath * 0.3];   // lavere, lengre skall (ikke egg)
  shell(body, cc, cr, cR, MATS.magma, { nA: 6, nE: 2, e0: -0.2, e1: Math.PI / 2, seam: null, jitter: 0.3, seed: 21, jit: 0.1, emit: [240, 84, 52], ei: 1.25 });
  const surf = (a, e, k = 1) => add(cc, cR([Math.cos(a) * Math.cos(e) * cr[0] * k, Math.sin(a) * Math.cos(e) * cr[1] * k, Math.sin(e) * cr[2] * k]));
  const nrm = (a, e) => norm(cR([Math.cos(a) * Math.cos(e) / cr[0], Math.sin(a) * Math.cos(e) / cr[1], Math.sin(e) / cr[2]]));
  // ---- SKALL: fem store plater, lav rygg (rolige flater), tykk kant
  PLATES.forEach(([a, e, L, W, tw], i) => {
    const c = surf(a, e, 1.06), n = nrm(a, e);
    const back = norm([-1, Math.sin(a) * 0.5, -0.2]);
    let F = frame(n, back);
    if (tw) { const cs = Math.cos(tw), sn = Math.sin(tw); F = { u: add(mul(F.u, cs), mul(F.v, sn)), v: sub(mul(F.v, cs), mul(F.u, sn)), n: F.n }; }
    plate(body, c, F, shellOutline(L * 0.92, W * 0.84), MATS.plate, { thick: 1.8, ridge: 1.3, apexU: -L * 0.12, seed: 100 + i * 13, gap: 0.12, spec: 0.7, jit: 0.07, edgeTop: 0.8, edgeSide: 0.3 });
  });
  // tre ryggpigger (sagtakket profil sett fra siden), en glødende sprekk på tvers av midtplaten
  [[Math.PI, 1.2, 6.5], [Math.PI, 0.7, 5]].forEach(([a, e, l]) => { const b0 = surf(a, e, 1.12), n = nrm(a, e);
    cone(body, b0, add(b0, mul(norm(add(n, [-0.7, 0, 0.35])), l)), 2, MATS.bone, { sides: 4 }); });
  // organiske revner: forgrenede, uregelmessige stammer langs platekant/buen, tykk ved knutepunkt → tynn ende
  const rc = rng(77), J = (k) => (rc() - 0.5) * k;
  const crack = (a, e, da, de, n, w, depth) => {
    let pa = a, pe = e, pts = [surf(pa, pe, 1.36)], hubW = w;
    gspot(body, pts[0], w * 0.75, HOT, 0.8, { hot: CORE, bias: 1.3 });            // varmeste punkt i knuten
    for (let i = 1; i <= n; i++) {
      da += J(0.35); de += J(0.25); pa += da; pe = Math.max(0.12, Math.min(1.45, pe + de));
      const q = surf(pa, pe, 1.36), t = i / n, wi = hubW * (1 - t * 0.8);
      gline(body, [pts[pts.length - 1], q], GLOW, wi, 1 - t * 0.55, { hot: t < 0.4 ? HOT : null, bias: 1.4 - t });
      pts.push(q);
      if (depth > 0 && i < n && rc() < 0.55) crack(pa, pe, da * 0.6 + J(0.5), de + J(0.4), Math.max(2, (n - i) >> 1 | 0), wi * 0.6, depth - 1);
    }
  };
  // stammer: langs ryggbuen og ned mellom platene (startpunkter = plateskjøter)
  [[0.9, 1.15, -0.16, -0.02, 6, 0.85], [-0.6, 1.1, 0.15, -0.03, 5, 0.75], [Math.PI * 0.8, 1.0, -0.12, -0.06, 5, 0.65], [Math.PI * 0.5, 0.55, 0.14, -0.05, 4, 0.55], [-Math.PI * 0.5, 0.55, -0.14, -0.05, 4, 0.55],
   [Math.PI * 0.95, 0.75, 0.1, -0.08, 4, 0.5], [0.25, 0.45, -0.12, 0.04, 4, 0.45]].forEach(([a, e, da, de, n, w]) => crack(a, e, da, de, n, w, 2));

  // ---- HODE: kantet kile fram og ned, panneplate, glødende øyespalte, to kjever
  const hc = [21.5, 0, 12.5], hR = rot(0, 0.12), hr = [8, 6.6, 5.2];   // større hode, løftet fram under skallkanten
  shell(body, hc, hr, hR, MATS.chitin, { nA: 5, nE: 2, seam: 'dark', gap: 0.2, jitter: 0.25, seed: 8, jit: 0.1 });
  const hs = (a, e) => add(hc, hR([Math.cos(a) * Math.cos(e) * hr[0] * 1.05, Math.sin(a) * Math.cos(e) * hr[1] * 1.05, Math.sin(e) * hr[2] * 1.05]));
  plate(body, add(hs(0.1, 0.8), [0.5, 0, 0.4]), frame(hR([0.3, 0, 1]), hR([1, 0, 0.15])), [[8.5, 0], [2, 5.6], [-4.5, 5], [-6, 0], [-4.5, -5], [2, -5.6]], MATS.bone, { thick: 1.2, ridge: 1.2, apexU: -1, seed: 9, jit: 0.07 });
  gline(body, [-0.7, -0.3, 0.3, 0.7].map((a) => hs(a, 0.05 + Math.abs(a) * 0.12)), [255, 70, 45], 0.9, 1, { hot: CORE, bias: 0.9 });
  for (const s of [-1, 1]) gspot(body, hs(s * 0.42, 0.18), 1.25, [255, 80, 50], 1, { hot: CORE });
  for (const s of [-1, 1]) cone(body, hs(s * 0.45, -0.55), add(hs(s * 0.35, -0.7), [4.2, s * 1.2, -2]), 1.2, MATS.bone, { sides: 3 });

  const Sl = B([6, -9, 13]), Sr = B([6, 9.5, 14]), Hl = B([-6, -7, 11]), Hr = B([-6, 7, 11]);
  mapItems(body, B); M.items.push(...body.items);

  // ---- bakbein (digitigrade), diagonal trav
  for (const [s, H, ph] of [[-1, Hl, g], [1, Hr, g + 0.5]]) {
    const st = stride(ph, 8.5 * amp, 3 * amp);
    const foot = [-4 + st.dx, 10 * s, st.lift], ank = add(foot, [-2.4, 0, 4]);
    const knee = ik(H, ank, 8, 7, [1, 0.35 * s, 0]);
    prism(M, [H, knee, ank, foot], [4.6, 3.6, 2.6, 1.8], MATS.chitin, { sides: 4, seed: 30 + s, jit: 0.08 });
    cone(M, add(foot, [0.6, 0, 0.8]), add(foot, [4.6, 0, 0]), 1.1, MATS.bone, { sides: 3 });
  }
  // ---- venstre forbein: klo-støtte
  {
    const st = stride(g + 0.5, 8.5 * amp, 3 * amp);
    const hand = lerp3([13 + st.dx, -14, st.lift], [11, -15, 3], raise * 0.6);
    const elbow = ik(Sl, hand, 8, 8.5, [-1, -0.6, 0.5]);
    prism(M, [Sl, elbow, hand], [4, 3.2, 2.2], MATS.chitin, { sides: 4, seed: 40, jit: 0.08 });
    cone(M, hand, add(hand, [4.5, -0.8, -0.6]), 1.2, MATS.bone, { sides: 3 });
  }
  // ---- BLADARM (høyre): overarm + underarm + langt flatt blad med glødende egg
  {
    const st = stride(g, 8.5 * amp, 3 * amp);
    const restTip = [34 + st.dx, 15, 3 + st.lift], aimTip = [35 + thrust * 6, 9, 12 + 3 * raise];
    const tip = lerp3(restTip, aimTip, raise);
    const elbow = ik(Sr, lerp3(Sr, tip, 0.36), 7, 5.5, [-0.4, 1, 0.5]);
    const wrist = lerp3(elbow, tip, 0.38);
    prism(M, [Sr, elbow, wrist], [5, 4.2, 3.4], MATS.chitin, { sides: 4, seed: 60, jit: 0.08, capEnd: false });
    const u = norm(sub(tip, wrist)), side = norm(cross(u, [0, 0, 1])), up = norm(cross(side, u));
    const L = Math.hypot(...sub(tip, wrist)), bc = lerp3(wrist, tip, 0.45);
    // bladet ligger på høykant (flatsiden mot siden), så det leses som et blad i alle vinkler
    const F = { u, v: up, n: side };
    plate(M, bc, F, [[L * 0.6, 0], [L * 0.1, 3.6], [-L * 0.45, 2.6], [-L * 0.5, -0.8], [L * 0.2, -2]], MATS.bone, { thick: 0.9, ridge: 0.6, seed: 63, jit: 0.06, spec: 0.9, edgeTop: 0.9 });
    plate(M, bc, { u, v: up, n: mul(side, -1) }, [[L * 0.6, 0], [L * 0.1, 3.6], [-L * 0.45, 2.6], [-L * 0.5, -0.8], [L * 0.2, -2]], MATS.bone, { thick: 0.9, ridge: 0.6, seed: 64, jit: 0.06, spec: 0.9 });
    gline(M, [0.05, 0.45, 0.85, 1].map((t) => add(lerp3(wrist, tip, t), mul(up, 2.2 * (1 - t) + 0.2))), GLOW, 0.24, 0.8 + heat * 0.2, { hot: HOT, bias: 0.6 });
    for (const t of [0.3, 0.52, 0.72]) { const b0 = add(lerp3(wrist, tip, t), mul(up, 2.4 * (1 - t) + 0.6)); cone(M, b0, add(b0, add(mul(up, 2.2 * (1 - t) + 0.8), mul(u, -1.6))), 0.9, MATS.bone, { sides: 3 }); }   // sagtenner
    gspot(M, tip, 0.6 + heat * 0.8, [255, 80, 50], 0.6 + heat * 0.4, { hot: CORE });
  }

  // ---- død: velter mot høyre og synker sammen
  if (dd > 0) {
    const R = rot(0, 0.15 * dd, -1.25 * dd);
    mapItems(M, (q) => { const r = rotAbout(q, [0, 9, 0], R); return [r[0], r[1], Math.max(0.2, r[2] * (1 - 0.3 * dd))]; });
  }
  return M;
}
/** Bladtuppen i lokalrom (før kind.scale), for munningspunkt: hvilestilling og angrep. */
export const HUSK_TIP = { rest: [34, 15, 3], aim: [35, 9, 15] };
