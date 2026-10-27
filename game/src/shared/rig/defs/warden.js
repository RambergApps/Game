// Warden – rigg-def + maling for stilen 'painted'. Protocol-fiender = samme def med skin:'protocol'
// (createRig(WARDEN, { skin:'protocol' }) eller withDef(WARDEN, { skin:'protocol', scale: .96, ... })).
// proportions/parts kan overstyres per def uten å røre malekoden (alle felt valgfrie).
import { TAU, PI, lerp, clamp, ik } from '../math.js';

export const WARDEN = {
  id: 'warden', skin: 'warden', scale: 1,
  proportions: {
    shoulder: [1, 10],            // skulderledd (fwd, ±side) – KARAKTER-SPEC §5.3
    pad: { x: -2.5, y: 11, w: 9.5, h: 7 },
    upperArm: [9.5, 10.5],        // høyre / venstre overarm
    foreArm: [10.5, 12.5],
    helmetR: 6.6, torsoW: 1, pack: { x: -16.5, w: 11, h: 18 },
  },
  parts: { antenna: true, scarf: true, emblem: true, pouches: true },
  readability: { rim: 1, contact: 1 },
  oblique: { rim: '223,230,234' },   // trekvart-stilen: Wardens kalde kantlys (WARDEN-DESIGN §3/§4.2); andre defs beholder light.js-fargen
  paint: paintWarden,
};
/** Lag en avledet def (f.eks. Protocol-variant med andre proporsjoner eller deler). */
export function withDef(base, over) {
  return { ...base, ...over, proportions: { ...base.proportions, ...(over.proportions || {}) }, parts: { ...base.parts, ...(over.parts || {}) } };
}

function paintWarden(api, F) {
  const { part, capsule, glow } = api; const c = () => api.c; const SK = api.skin;
  const K = F.skel, S = F.S, def = F.def, Pr = { ...WARDEN.proportions, ...def.proportions }, parts = { ...WARDEN.parts, ...def.parts };
  const roll = F.clip.roll, mel = F.clip.melee, imp = F.clip.impact, death = F.clip.death;
  const kneel = S.kneel, T = F.time;
  const g = c();
  const hc = Math.cos(S.hip), hs = Math.sin(S.hip);
  const sway = Math.sin(S.phase * TAU) * 1.7 * S.amp * (1 - kneel);
  const hipYaw = K.wob * (1 - kneel);
  const over = roll && roll.phase === 'over';
  // ---------------------------------------------------------------- bein (hofte-rom)
  const legS = lerp(.95, 1, S.h.x);
  const drawLeg = (f) => {
    const g = c(); const jx = f.jx, jy = f.jy + sway * .4; const ls = 1 + f.lift * .16;
    capsule(jx, jy, f.kx, f.ky, 6.4, 'suit', { seed: 10 + f.s });
    capsule(f.kx, f.ky, f.fx, f.fy, 5.6, 'suit', { seed: 12 + f.s });
    { const a = Math.atan2(f.fy - f.ky, f.fx - f.kx); g.save(); g.translate(lerp(f.kx, f.fx, .45), lerp(f.ky, f.fy, .45)); g.rotate(a);
      part(c => c.roundRect(-2.6, -2.1, 5.2, 4.2, 1.4), 'armor', { key: 'shin', bb: [-3, -2.5, 6, 5], r: 3, seed: 14 + f.s, ao: .4, aoB: 1.2, aoD: .6 }); g.restore(); }
    g.save(); g.translate(f.kx, f.ky); part(c => c.ellipse(0, 0, 3.2, 2.8, 0, 0, TAU), 'armorL', { key: 'knee', bb: [-3.4, -3, 6.8, 6], r: 3.2, seed: 16 + f.s, ao: .5, aoB: 1.4, aoD: .7 });
    // lys kneskål når kneet er i bakken (kne-positur)
    if (kneel > .4 && f.s > 0) { g.fillStyle = `rgba(215,220,224,${.22 * kneel})`; g.beginPath(); g.ellipse(-.6, -.6, 1.5, 1.1, 0, 0, TAU); g.fill(); }
    g.restore();
    g.save(); g.translate(f.fx, f.fy); g.rotate(f.fa); g.scale(ls, ls);
    part(c => c.roundRect(-4.5, -3.2, 11, 6.4, 3), 'boot', { key: 'boot', bb: [-4.7, -3.4, 11.4, 6.8], r: 5.5, cx: 1, seed: 18 + f.s, ao: .45, aoB: 1.4, aoD: .6 });
    part(c => c.roundRect(2.6, -2.6, 3.6, 5.2, [1, 2.4, 2.4, 1]), 'gun', { key: 'toe', bb: [2.4, -2.8, 4, 5.6], r: 3, cx: 4.4, seed: 20 + f.s, edgeLine: false });
    g.restore();
  };
  const feet = F.feet.slice().sort((a, b) => a.lift - b.lift);
  if (!over) {
    g.save(); g.translate(S.x, S.y); g.rotate(S.hip); g.scale(legS, legS);
    feet.forEach(drawLeg);
    g.save(); g.translate(0, sway * .6); g.rotate(hipYaw);
    part(c => c.roundRect(-6, -10, 11, 20, 4), 'suit', { key: 'pelvis', bb: [-6.2, -10.2, 11.4, 20.4], r: 10, seed: 30 });
    if (parts.pouches) {
      part(c => c.roundRect(-7.5, -11.5, 4.5, 6, 1.5), 'pouch', { key: 'pa', bb: [-7.7, -11.7, 4.9, 6.4], r: 4, cx: -5, cy: -8, seed: 31, ao: .45, aoB: 1.2 });
      part(c => c.roundRect(-7.5, 5.5, 4.5, 6, 1.5), 'pouch', { key: 'pb', bb: [-7.7, 5.3, 4.9, 6.4], r: 4, cx: -5, cy: 8, seed: 32, ao: .45, aoB: 1.2 });
      part(c => c.roundRect(0, -11, 5, 7, 2), 'armor', { key: 'pc', bb: [-.2, -11.2, 5.4, 7.4], r: 5, cx: 2, cy: -8, seed: 33, ao: .45, aoB: 1.2 });
      part(c => c.roundRect(0, 4, 5, 7, 2), 'armor', { key: 'pd', bb: [-.2, 3.8, 5.4, 7.4], r: 5, cx: 2, cy: 8, seed: 34, ao: .45, aoB: 1.2 });
    }
    g.restore(); g.restore();
  }
  // ---------------------------------------------------------------- overkropp (torso-rom)
  g.save(); g.translate(K.ox, K.oy); g.rotate(K.ta);
  let sx = K.s, sy = K.s;
  if (roll) { sx *= roll.sx * roll.scale; sy *= roll.sy * roll.scale; }
  if (mel) { sx *= mel.sx; sy *= mel.sy; }
  if (imp) { sx *= imp.squashN; sy *= imp.stretchT; }
  if (death) { sx *= 1 + .25 * death.fall; sy *= 1 - .05 * death.fall; }
  g.scale(sx, sy);
  const packX = roll ? roll.packX : 0, packTop = roll ? roll.packTop : 0;
  const helmetHidden = roll && roll.helmetHidden;
  const helmetX = 1.8 + (roll ? roll.helmetX : 0) + kneel * 2 - S.slideB * 2 + (death ? 5 * death.fall : 0);
  const helmetS = (roll ? roll.helmetS : 1) * (1 - .06 * kneel);
  const visor = (roll ? roll.visor : 1) * (death ? death.visor : 1);
  const swing = S.packSwing * (1 - packTop);
  const drawPack = () => {
    const g = c(); const Pk = Pr.pack;
    g.save(); g.translate(packX, 0); g.translate(Pk.x + Pk.w, 0); g.rotate(swing); g.translate(-(Pk.x + Pk.w), swing * 6);
    part(c => c.roundRect(Pk.x, -Pk.h / 2, Pk.w, Pk.h, 3.5), 'armor', { key: 'bp', bb: [Pk.x - .2, -Pk.h / 2 - .2, Pk.w + .4, Pk.h + .4], r: 10, cx: Pk.x + Pk.w / 2, seed: 40, ao: .55 + packTop * .2, aoB: 2 + packTop, aoD: 1 });
    part(c => c.roundRect(-15, -6.5, 6, 13, 2), 'armorL', { key: 'bpl', bb: [-15.2, -6.7, 6.4, 13.4], r: 7, cx: -12, seed: 41, ao: .5, aoB: 1.2, aoD: .6 });
    part(c => c.roundRect(-16, -1.2, 7, 2.4, 1), 'gun', { key: 'bph', bb: [-16.2, -1.4, 7.4, 2.8], r: 3, cx: -12.5, seed: 42, wear: false });
    glow(c => { c.fillStyle = SK.glow; c.fillRect(-16, 4.8, 1.3, 1.8); }, SK.glow, 2.2, .9);
    if (parts.antenna) { const aq = -10 - S.amp * Math.sin(S.phase * TAU * 2) + swing * 8;
      g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.05; g.beginPath(); g.moveTo(-14, -7.5); g.quadraticCurveTo(-20, aq, -25, -9 + swing * 10); g.stroke();
      g.strokeStyle = '#3e444a'; g.lineWidth = .4; g.beginPath(); g.moveTo(-14, -7.7); g.quadraticCurveTo(-20, aq - .2, -25, -9.2 + swing * 10); g.stroke(); }
    g.restore();
  };
  if (packTop < .5) drawPack();
  // torso-kjerne
  const torsoPath = c => { c.moveTo(-8, -11); c.quadraticCurveTo(0, -14, 6.5, -9.5); c.quadraticCurveTo(9.5, 0, 6.5, 9.5); c.quadraticCurveTo(0, 14, -8, 11); c.quadraticCurveTo(-10.5, 0, -8, -11); c.closePath(); };
  const ballK = over ? roll.k > .1 && roll.k < .9 : false;   // kollbøtte: rund rygg i stedet for brystplate-silhuett
  if (ballK) part(c => c.ellipse(-1, 0, 11, 12.8, 0, 0, TAU), 'armor', { key: 'torsoBall', bb: [-12.2, -13, 22.4, 26], r: 12.5, seed: 44, ao: .7, aoB: 2.6, aoD: 1.2 });
  else part(torsoPath, 'armor', { key: 'torso', bb: [-10.8, -13, 20.6, 26], r: 12, seed: 44, ao: .6, aoB: 2.2, aoD: 1 });
  if (!over || roll.k < .15 || roll.k > .85) {
    part(c => { c.moveTo(-1, -8); c.quadraticCurveTo(6, -7, 7.5, -2); c.lineTo(7.5, 2); c.quadraticCurveTo(6, 7, -1, 8); c.quadraticCurveTo(1, 0, -1, -8); c.closePath(); }, 'armorL', { key: 'chest', bb: [-1.5, -8.3, 9.3, 16.6], r: 8, cx: 3, seed: 45, ao: .5, aoB: 1.4, aoD: .7 });
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .7; g.beginPath(); g.moveTo(1, -6); g.lineTo(6.5, -1.8); g.moveTo(1, 6); g.lineTo(6.5, 1.8); g.stroke();
    for (const s of [-1, 1]) part(c => { c.moveTo(-6.5, s * 6.2); c.lineTo(2.2, s * 5.4); c.lineTo(2.2, s * 7.8); c.lineTo(-6.5, s * 8.4); c.closePath(); }, 'pouch', { key: 'strap', bb: [-6.7, s > 0 ? 5.2 : -8.6, 9.1, 3.4], r: 3, cx: -2, cy: s * 7, seed: 46 + s, ao: .4, aoB: 1, aoD: .5, wear: false });
  }
  // ---------------------------------------------------------------- armer + rifle (§5.3: overarm → plate → underarm/albue/hånd)
  const p = K.pose;
  const hR = K.R2L(5, 1.8), hL = K.R2L(21.5, -.9);
  const sh = Pr.shoulder; const kin = kneel * 2;
  const shR = [sh[0] + kneel, sh[1] - kin * .5], shL = [sh[0] + kneel, -sh[1] + kin * .5];
  const eR = ik(shR[0], shR[1], hR[0], hR[1], Pr.upperArm[0], Pr.foreArm[0], -1), eL = ik(shL[0], shL[1], hL[0], hL[1], Pr.upperArm[1], Pr.foreArm[1], 1);
  const drawRifle = () => {
    const g = c(); g.save(); g.translate(p.bx, p.by); g.rotate(p.a); g.scale(p.f, 1);
    const ao = { ao: .55, aoB: 1.6, aoD: .9 };
    part(c => { c.moveTo(-8.5, -2); c.lineTo(1, -2.4); c.lineTo(1, 2.4); c.lineTo(-8.5, 2.8); c.quadraticCurveTo(-10, 0, -8.5, -2); c.closePath(); }, 'gun', { key: 'r1', bb: [-10, -2.6, 11.2, 5.6], r: 6, cx: -4, seed: 60, ...ao });
    part(c => c.roundRect(12, -5, 3.6, 3, .8), 'gun', { key: 'r2', bb: [11.8, -5.2, 4, 3.4], r: 3, cx: 14, cy: -3.5, seed: 61 });
    part(c => c.roundRect(1, -3, 16.5, 6, 1.5), 'gunL', { key: 'r3', bb: [.8, -3.2, 16.9, 6.4], r: 8, cx: 9, seed: 62, ...ao });
    part(c => c.roundRect(17, -2.2, 13.5, 4.4, 1), 'gun', { key: 'r4', bb: [16.8, -2.4, 13.9, 4.8], r: 7, cx: 23, seed: 63, ...ao });
    g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 19; i < 29; i += 2.6) g.fillRect(i, -1.3, 1.3, 2.6);
    part(c => c.rect(30.5, -1, 6, 2), 'gun', { key: 'r5', bb: [30.3, -1.2, 6.4, 2.4], r: 3, cx: 33, seed: 64, wear: false });
    part(c => c.roundRect(36, -1.7, 3.6, 3.4, .6), 'gunL', { key: 'r6', bb: [35.8, -1.9, 4, 3.8], r: 2, cx: 38, seed: 65 });
    part(c => c.roundRect(5, -1.7, 7, 3.4, 1), 'gun', { key: 'r7', bb: [4.8, -1.9, 7.4, 3.8], r: 4, cx: 8.5, seed: 66, ao: .5, aoB: 1, aoD: .5 });
    glow(c => { c.fillStyle = SK.glow; c.fillRect(11.2, -.9, .9, 1.8); }, SK.glow, 1.5, .8);
    g.strokeStyle = SK.gunStripe; g.lineWidth = .8; g.beginPath(); g.moveTo(2.5, 2.4); g.lineTo(15, 2.4); g.stroke();
    // kolbeslag: lys slagkant på kolben i slagfasen
    if (mel && mel.strike > .3) { g.strokeStyle = `rgba(230,236,240,${.5 * mel.strike})`; g.lineWidth = 1; g.beginPath(); g.moveTo(-9.6, -1.8); g.quadraticCurveTo(-10.6, 0, -9.6, 2.2); g.stroke(); }
    g.restore();
  };
  const pad = (s, armA) => {
    const g = c(); const P = Pr.pad; g.save();
    g.translate(P.x + kneel * 1 + Math.cos(armA) * 1, s * (P.y - kneel * 2) + Math.sin(armA) * 1); { let d = armA - (s > 0 ? 1.2 : -1.2); d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotate(s * .1 + clamp(d * .35, -.4, .4)); }
    part(c => c.roundRect(-P.w / 2 + .6, s > 0 ? .8 : -P.h + .2, P.w - 1.2, P.h * .62, 2), 'armor', { key: 'padu', bb: [-P.w / 2, s > 0 ? .6 : -P.h, P.w, P.h * .7], r: 6, cy: s * 3, seed: 80 + s, ao: .5, aoB: 1.4, aoD: .7 });
    part(c => c.roundRect(-P.w / 2, -P.h / 2, P.w, P.h, [3.2, 3.8, 3.8, 3.2]), 'armorL', { key: 'pad', bb: [-P.w / 2 - .2, -P.h / 2 - .2, P.w + .4, P.h + .4], r: 7, seed: 82 + s, ao: .65, aoB: 2.2, aoD: 1.1, decal: (L, c) => {
      c.fillStyle = api.pat(SK.paint, .06, 90 + s); c.fillRect(-P.w / 2, s > 0 ? P.h / 2 - 2 : -P.h / 2, P.w, 2);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-P.w / 2, s > 0 ? P.h / 2 - 2.1 : -P.h / 2 + 2, P.w, .3);
      if (parts.emblem) { c.save(); c.translate(-1, -s * .4); c.beginPath(); c.moveTo(1.4, 0); c.lineTo(-1.1, -1.45); c.lineTo(-1.1, 1.45); c.closePath(); c.moveTo(.4, 0); c.lineTo(-.65, -.6); c.lineTo(-.65, .6); c.closePath(); c.globalAlpha = .8; c.fillStyle = api.pat('white', .035, 94 + s); c.fill('evenodd'); c.restore(); }
    } });
    g.restore();
  };
  const upper = (shp, e, seed) => capsule(shp[0], shp[1], e[0], e[1], 6.2, 'armor', { seed, ao: .45, aoB: 1.5, aoD: .7 });
  const lower = (e, h, seed) => { capsule(e[0], e[1], e[2], e[3], 5.4, 'suit', { seed, edgeW: 1.2 });
    const g = c(); g.save(); g.translate(e[0], e[1]); part(c => c.arc(0, 0, 2.7, 0, TAU), 'armorL', { key: 'elbow', bb: [-2.9, -2.9, 5.8, 5.8], r: 3, seed: seed + 1, ao: .4, aoB: 1 }); g.restore(); };
  if (!over) {
    upper(shL, eL, 50); upper(shR, eR, 53);
    drawRifle();
    pad(-1, Math.atan2(eL[1] - shL[1], eL[0] - shL[0])); pad(1, Math.atan2(eR[1] - shR[1], eR[0] - shR[0]));
    lower(eL, hL, 51); lower(eR, hR, 54);
    for (const [i, h] of [hL, hR].entries()) { g.save(); g.translate(h[0], h[1]);
      part(c => c.arc(0, 0, 2.9, 0, TAU), 'glove', { key: 'glove', bb: [-3.1, -3.1, 6.2, 6.2], r: 3, seed: 70 + i, ao: .5, aoB: 1.2, aoD: .6 });
      g.strokeStyle = 'rgba(150,160,170,.35)'; g.lineWidth = .5; g.beginPath(); g.arc(0, 0, 2.6, -2.4, -.8); g.stroke(); g.restore(); }
  } else {
    // ball: armene klemmer riflen inn mot brystet – riflen stikker ut på skrå, underarmene synes over ballen
    drawRifle();
    for (const s of [-1, 1]) { const e = [4, s * 9.5], h = [8.5, -s * 2.5]; capsule(e[0], e[1], h[0], h[1], 5.2, 'suit', { seed: 51 + s, edgeW: 1.2 });
      g.save(); g.translate(h[0], h[1]); part(c => c.arc(0, 0, 2.8, 0, TAU), 'glove', { key: 'glove', bb: [-3, -3, 6, 6], r: 3, seed: 70 + s, ao: .5, aoB: 1.2, aoD: .6 }); g.restore(); }
    // nakken bøyd inn: mørk fold i framkant (hodet er gjemt under)
    g.save(); g.beginPath(); g.ellipse(-1, 0, 11, 12.8, 0, 0, TAU); g.clip(); const gf = g.createRadialGradient(10, 0, 1, 10, 0, 8); gf.addColorStop(0, 'rgba(0,0,0,.5)'); gf.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gf; g.fillRect(0, -10, 12, 20); g.restore();
  }
  // kolbeslag: kort bevegelses-smear langs kolbens bane (lesbart ved 2×, ingen tegneserie-linjer)
  if (mel && mel.phase === 'strike') { const a1 = lerp(-1.1, .35, mel.k); const gS = c();
    gS.save(); gS.lineCap = 'round';
    for (let i = 0; i < 2; i++) { gS.strokeStyle = `rgba(225,232,238,${(.16 - i * .06) * (1 - mel.k * .5)})`; gS.lineWidth = 2.4 - i * .6; gS.beginPath(); gS.arc(0, 0, 21 - i * 3, a1 - .9 + i * .15, a1); gS.stroke(); }
    gS.restore(); }
  // ---------------------------------------------------------------- skjerf (verlet, torso-rom)
  if (parts.scarf && F.scarf) {
    for (const [i, pts] of F.scarf.entries()) {
      const N = pts.length, lp = [], rp = [];
      for (let j = 0; j < N; j++) { const q0 = pts[Math.max(0, j - 1)], q1 = pts[Math.min(N - 1, j + 1)]; const da = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]); const hw = lerp(1.7, .8, j / (N - 1)); lp.push([pts[j][0] + Math.cos(da + PI / 2) * hw, pts[j][1] + Math.sin(da + PI / 2) * hw]); rp.push([pts[j][0] - Math.cos(da + PI / 2) * hw, pts[j][1] - Math.sin(da + PI / 2) * hw]); }
      const rib = c => { c.moveTo(lp[0][0], lp[0][1]); for (let j = 1; j < N; j++) { const m0 = lp[j - 1], m1 = lp[j]; c.quadraticCurveTo(m0[0], m0[1], (m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2); } c.lineTo(lp[N - 1][0], lp[N - 1][1]); c.lineTo(rp[N - 1][0], rp[N - 1][1]); for (let j = N - 2; j >= 0; j--) { const m0 = rp[j + 1], m1 = rp[j]; c.quadraticCurveTo(m0[0], m0[1], (m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2); } c.lineTo(rp[0][0], rp[0][1]); c.closePath(); };
      part(rib, 'fabric', { r: 6, cx: pts[N >> 1][0], cy: pts[N >> 1][1], seed: 100 + i, ao: .5, aoB: 1.4, aoD: .8 });
      const e = pts[N - 1], e2 = pts[N - 2]; const da = Math.atan2(e[1] - e2[1], e[0] - e2[0]);
      g.strokeStyle = 'rgba(60,48,30,.7)'; g.lineWidth = .5; g.beginPath();
      for (const o of [-.5, .5]) { g.moveTo(e[0] + Math.cos(da + PI / 2) * o, e[1] + Math.sin(da + PI / 2) * o); g.lineTo(e[0] + Math.cos(da + o * .6) * 1.6 + Math.cos(da + PI / 2) * o, e[1] + Math.sin(da + o * .6) * 1.6 + Math.sin(da + PI / 2) * o); }
      g.stroke();
    }
  }
  // skjerf-/hetteringen
  if (!over) {
    const ring = c => { c.moveTo(-6.5, -5); c.quadraticCurveTo(-3, -9.2, 2.5, -8.2); c.quadraticCurveTo(7.5, -6, 8, 0); c.quadraticCurveTo(7.5, 6.5, 2, 8.3); c.quadraticCurveTo(-4, 9.3, -7, 5); c.quadraticCurveTo(-8.5, 0, -6.5, -5); c.closePath(); };
    part(ring, 'fabric', { key: 'ring', bb: [-8.6, -9.4, 17, 18.8], r: 9.5, cx: .5, seed: 110, ao: .6, aoB: 2, aoD: 1, decal: (L, c) => {
      for (const [k, a] of [-2.25, -1.45, -.6, 1.15, 1.95, 2.7].entries()) { c.lineCap = 'round'; c.strokeStyle = 'rgba(30,22,12,.5)'; c.lineWidth = .9; c.beginPath(); c.arc(.5, 0, 6.9 + (k & 1) * .6, a, a + .5); c.stroke();
        c.strokeStyle = 'rgba(225,205,165,.16)'; c.lineWidth = .6; c.beginPath(); c.arc(.5 - L.x * .5, -L.y * .5, 7.6 + (k & 1) * .6, a + .05, a + .45); c.stroke(); } } });
  }
  // ---------------------------------------------------------------- hjelm
  if (!helmetHidden) {
    const Lh = api.light(); const aoA = .6 + kneel * .1; const ax = helmetX - Lh.x * 1.6, ay = -Lh.y * 1.6;
    const gr = g.createRadialGradient(ax, ay, 4.5, ax, ay, 8.8); gr.addColorStop(0, `rgba(0,0,0,${aoA})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(ax, ay, 8.8, 0, TAU); g.fill();
    g.save(); g.translate(helmetX, 0); g.scale(helmetS, helmetS);
    const R = Pr.helmetR;
    part(c => c.arc(0, 0, R, 0, TAU), 'armorL', { key: 'helmet', bb: [-R - .2, -R - .2, 2 * R + .4, 2 * R + .4], r: R + .3, seed: 120, ao: .55, aoB: 1.6, aoD: .8, decal: (L, c) => {
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5.8, 0); c.lineTo(2.6, 0); c.stroke();
      c.strokeStyle = 'rgba(170,176,180,.18)'; c.lineWidth = .4; c.beginPath(); c.moveTo(-5.6, -.95); c.lineTo(2.4, -.95); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .55; c.beginPath(); c.arc(0, 0, 4.4, -2.5, -1.5); c.stroke(); c.beginPath(); c.arc(0, 0, 4.4, 1.5, 2.5); c.stroke(); } });
    if (visor > .02) glow(c => { c.globalAlpha *= visor; c.strokeStyle = SK.stripe; c.lineWidth = .6; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-5.2, 0); c.lineTo(2.2, 0); c.stroke(); }, SK.glow, 1.6);
    const va = .86; const vis = c => { c.arc(0, 0, 6.15, -va, va); c.arc(0, 0, 3.9, va * .92, -va * .92, true); c.closePath(); };
    g.beginPath(); vis(g); g.fillStyle = '#071016'; g.fill();
    if (visor > .02) glow(c => { c.globalAlpha *= visor; c.strokeStyle = SK.glowDim; c.lineWidth = 1.25; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 5.0, -va * .85, va * .85); c.stroke(); }, SK.glow, 3, .95);
    g.save(); g.beginPath(); vis(g); g.clip(); g.strokeStyle = SK.visorHi; g.lineWidth = .35; g.beginPath(); g.arc(0, 0, 5.25, -va * .6, va * .4); g.stroke(); g.restore();
    const L2 = api.light(); g.fillStyle = 'rgba(255,240,215,.13)'; g.beginPath(); g.ellipse(L2.x * 2.7, L2.y * 2.7, 1.9, 1.1, Math.atan2(L2.y, L2.x) + PI / 2, 0, TAU); g.fill();
    g.restore();
  }
  // ---------------------------------------------------------------- kollbøtte: ryggen mot kamera
  if (over) {
    g.save(); g.translate(-1, 0); g.scale(.8, .8); drawPack(); g.restore();
    // høylysbånd som sveiper én gang fra framkant til bakkant, klippet til ballen
    g.save(); g.beginPath(); g.ellipse(-2, 0, 12.5, 13, 0, 0, TAU); g.clip();
    const bx = lerp(9, -15, roll.band); const gb = g.createLinearGradient(bx - 3, 0, bx + 3, 0);
    gb.addColorStop(0, 'rgba(255,248,236,0)'); gb.addColorStop(.5, 'rgba(255,248,236,.34)'); gb.addColorStop(1, 'rgba(255,248,236,0)');
    g.fillStyle = gb; g.fillRect(bx - 3, -14, 6, 28); g.restore();
    if (roll.boots != null) { // støvlene kommer over toppen
      for (const s of [-1, 1]) { g.save(); g.translate(roll.boots, s * 4.4); g.rotate(PI); g.scale(1.12, 1.12);
        part(c => c.roundRect(-4.5, -3.2, 11, 6.4, 3), 'boot', { key: 'boot', bb: [-4.7, -3.4, 11.4, 6.8], r: 5.5, cx: 1, seed: 18 + s, ao: .6, aoB: 1.8, aoD: .8 });
        part(c => c.roundRect(2.6, -2.6, 3.6, 5.2, [1, 2.4, 2.4, 1]), 'gun', { key: 'toe', bb: [2.4, -2.8, 4, 5.6], r: 3, cx: 4.4, seed: 20 + s, edgeLine: false });
        g.restore(); }
    }
  }
  g.restore();
}
