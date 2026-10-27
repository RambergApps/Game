// BREACH – art2: tegneserieruter for prøvesekvensen 'foundry-core-v2' (haleReveal på nytt).
// Retning: få, store former; ekte nærbilder; kaldt cyan (Warden) mot rødt (Protocol/Hale) mot ravgult miljølys;
// mørke blekkonturer som i konseptkunsten; «kringkastingsblikket» (REC/LIVE) som ramme rundt The Protocol.
// Hver rute har en tegnefunksjon (før maling) og ev. et overlegg (skarp grafikk etter maling).
import { VW, VH, PAL, makeRng, rgba, mix, vgrad, glow, embers, hazard, chain, pipe, figure, vignette, grade } from '../art.js';
import { drawHelmet, VISOR_RED, HELMET_COL as COL, soft, brush, rimLight } from '../helmet.js';
import { soldier, enemy } from './figure.js';
import { CHARACTER_STYLE as CS } from './style.js';

const F = '"Barlow Condensed", "Bahnschrift SemiCondensed", "Arial Narrow", sans-serif';
const RED = '#ff3a24', CYAN = '#39c6ff', AMBER = '#ffb347';

/** Ravgul støperibakgrunn med uskarpe lys (bokeh) – felles for nærbildene. */
function foundryBokeh(ctx, rng, hot = 0.5) {
  vgrad(ctx, 0, 0, VW, VH, [[0, '#0a0504'], [0.55, '#1e0b05'], [1, '#090403']]);
  glow(ctx, 260, 620, 620, '#ff5a10', 0.32 * hot + 0.1, 1.3, 0.8);
  for (let i = 0; i < 30; i++) {
    const x = rng() * VW, y = 80 + rng() * 760, r = 14 + rng() * 70, c = rng() < 0.75 ? AMBER : rng() < 0.5 ? '#ff6a20' : RED;
    soft(ctx, x, y, r, c, 0.05 + rng() * 0.12 * hot);
  }
  for (let x = 40; x < VW; x += 230) { ctx.save(); ctx.filter = 'blur(10px)'; ctx.fillStyle = '#080404'; ctx.fillRect(x, 0, 46, VH); ctx.restore(); }
}

/** Blekkontur: mørk, litt ujevn strek rundt en sti (konseptkunstens tegneseriepreg). */
function ink(ctx, path, w = 5, a = 0.9) {
  ctx.save(); ctx.strokeStyle = `rgba(4,3,3,${a})`; ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.stroke(path); ctx.restore();
}

// ───────────────────────── 1. ETABLERENDE: kringkastingskameraet ─────────────────────────
// Høyt kamera over kjernen. Fiendens rekke; Hale i midten med rødt visir. Warden stor i forgrunnen.
// Overlegget (REC, seertall, sporingsbokser) forteller HVEM (W-09 vs. H-04), HVOR (Board 03, kjernen) og INNSATSEN.
export function v2Feed(ctx) {
  const rng = makeRng(301);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#080404'], [0.45, '#240d05'], [1, '#0a0504']]);
  glow(ctx, 800, 250, 700, '#ff5a10', 0.38, 1.3, 0.7);
  // kjernen bak (smal, høy, glødende sømmer)
  const cx = 800, w = 250;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, '#0d0807'); g.addColorStop(0.35, '#2e1810'); g.addColorStop(0.6, '#3e2416'); g.addColorStop(1, '#0a0605');
  ctx.fillStyle = g; ctx.fillRect(cx - w / 2, 0, w, 430);
  for (const y of [70, 160, 250, 340]) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,80,0.9)'; ctx.fillRect(cx - w / 2, y, w, 6); ctx.restore();
    glow(ctx, cx, y + 3, 170, '#ff7a1a', 0.35, 1.3, 0.25);
  }
  pipe(ctx, cx - w / 2, 200, 0, 120, 16, '#1a1412', '#ff8a3a', 0.3); pipe(ctx, cx + w / 2, 200, 1600, 140, 16, '#1a1412', '#ff8a3a', 0.3);
  for (let i = 0; i < 7; i++) chain(ctx, 120 + i * 230 + rng() * 50, 0, 100 + rng() * 180, '#060505', rng() * 8);
  // gulv i perspektiv (høyt kamera): gitterlinjer mot et forsvinningspunkt
  vgrad(ctx, 0, 430, VW, 470, [[0, '#2a130a'], [1, '#0a0605']]);
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(800 + i * 40, 430); ctx.lineTo(800 + i * 260, 900); ctx.stroke(); }
  for (let k = 0; k < 8; k++) { const y = 430 + Math.pow(k / 8, 1.6) * 470; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
  ctx.restore();
  // smeltekanal fra kjernen
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const mg = ctx.createLinearGradient(0, 430, 0, 900); mg.addColorStop(0, 'rgba(255,140,40,0.5)'); mg.addColorStop(1, 'rgba(150,40,10,0.2)'); ctx.fillStyle = mg;
  ctx.beginPath(); ctx.moveTo(cx - 30, 430); ctx.lineTo(cx + 30, 430); ctx.lineTo(cx + 110, 900); ctx.lineTo(cx - 110, 900); ctx.fill(); ctx.restore();
  hazard(ctx, 0, 430, VW, 10, 0.55, 18);
  // fiendens rekke foran kjernen (skisser etter CHARACTER_STYLE.enemy)
  const line = [[250, 560, 1.75, 'grunt'], [370, 585, 1.9, 'heavy'], [520, 600, 1.95, 'grunt'], [930, 600, 1.95, 'grunt'], [1060, 590, 1.9, 'grenadier'], [1190, 570, 1.8, 'flanker'], [1305, 555, 1.7, 'grunt']];
  for (const [x, y, sc, type] of line) enemy(ctx, { x, y, s: sc, type, flip: x > 800 });
  // Hale – fremste rekke, midt foran smeltekanalen: samme utstyr som Warden, men rødt visir/LED (omprogrammert)
  glow(ctx, 690, 520, 130, RED, 0.2, 1, 0.8);
  soldier(ctx, { x: 690, y: 655, s: 2.6, who: 'hale', skin: 'protocol', rim: '#ff8a3a', rimA: 0.45 });
  // Warden i forgrunnen (stor, nedre høyre, vendt mot rekka) – kaldt kantlys, cyan visir
  glow(ctx, 1360, 560, 360, '#0b2a36', 0.45, 1, 1.2);
  soldier(ctx, { x: 1390, y: 1010, s: 5.4, who: 'warden', skin: 'warden', flip: true, rimA: 0.6 });
  embers(ctx, rng, 220, 0, 60, VW, 780, '#ffa040');
  grade(ctx, '#1a0a04', 0.28, '#ff7a30', 0.05); vignette(ctx, 0.8);
}
/** Skarp kringkastingsgrafikk (tegnes etter malingen). */
export function v2FeedOverlay(ctx) {
  ctx.save();
  const m = 46, L = 64;
  ctx.strokeStyle = 'rgba(235,235,230,0.7)'; ctx.lineWidth = 3;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [VW - m, m, -1, 1], [m, VH - m, 1, -1], [VW - m, VH - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke();
  }
  // REC + LIVE
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(m + 34, m + 40, 11, 0, Math.PI * 2); ctx.fill();
  ctx.font = `700 30px ${F}`; ctx.letterSpacing = '4px'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2efe8'; ctx.fillText('REC', m + 54, m + 41);
  ctx.fillStyle = RED; ctx.fillRect(m + 132, m + 22, 92, 38);
  ctx.fillStyle = '#fff'; ctx.fillText('LIVE', m + 144, m + 42);
  ctx.font = `600 26px ${F}`; ctx.fillStyle = 'rgba(242,239,232,0.92)';
  ctx.fillText('THE PROTOCOL  //  BOARD 03 — THE CORE', m + 240, m + 42);
  // seertall + odds (øverst til høyre)
  ctx.textAlign = 'right';
  ctx.font = `700 34px ${F}`; ctx.fillStyle = '#f2efe8'; ctx.fillText('2,184,330', VW - m - 30, m + 42);
  ctx.font = `600 18px ${F}`; ctx.fillStyle = 'rgba(242,239,232,0.6)'; ctx.fillText('WATCHING', VW - m - 30, m + 72);
  ctx.fillStyle = 'rgba(10,6,5,0.75)'; ctx.fillRect(VW - m - 330, m + 92, 300, 40);
  ctx.font = `600 22px ${F}`; ctx.fillStyle = AMBER; ctx.fillText('ODDS  W-09 HOLDS THE CORE   1 : 9', VW - m - 42, m + 113);
  ctx.textAlign = 'left';
  // sporingsboks: Hale (rød) og Warden (cyan)
  const box = (x0, y0, x1, y1, col, label, sub) => {
    ctx.strokeStyle = col; ctx.lineWidth = 3; const c = 18;
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * c); ctx.lineTo(x, y); ctx.lineTo(x + sx * c, y); ctx.stroke(); }
    ctx.font = `700 22px ${F}`; ctx.letterSpacing = '3px'; const tw = ctx.measureText(label).width;
    ctx.fillStyle = col; ctx.fillRect(x0, y0 - 34, tw + 18, 28);
    ctx.fillStyle = '#0a0606'; ctx.fillText(label, x0 + 9, y0 - 19);
    if (sub) { ctx.font = `600 18px ${F}`; ctx.letterSpacing = '2px'; ctx.fillStyle = col; ctx.fillText(sub, x0 + tw + 28, y0 - 19); }
  };
  box(620, 345, 760, 665, RED, 'H-04  HALE', 'RELEASED');
  box(1180, 360, 1560, 860, CYAN, 'W-09', 'OPERATOR');
  ctx.restore();
}

// ───────────────────────── 2. NÆRBILDE: Hale snur seg ─────────────────────────
// Samme hjelmtegning som Wardens nærbilde – men rødt visir, ingen øyne bak glasset, ravgult lys nedenfra.
export function v2HaleTurns(ctx) {
  drawHelmet(ctx, {
    V: VISOR_RED, eyes: false, callsign: 'H-04', rain: false, post: false, seed: 4404,
    bg: (c, rng) => foundryBokeh(c, rng, 0.8),
  });
  const rng = makeRng(4405);
  // ravgult underlys fra smeltekanalen (miljøet får farge Hale – hun er ikke lenger «Warden»)
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  soft(ctx, 700, 980, 520, '#ff7a20', 0.22, 1.4, 0.6); soft(ctx, 1250, 640, 160, '#ff5a10', 0.18, 1.3, 0.7);
  ctx.restore();
  // bevegelse: skjerfhalen og glør trekkes med vendingen (fartsstriper)
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 26; i++) { const y = 120 + rng() * 680, x = 80 + rng() * 520, l = 80 + rng() * 260; ctx.fillStyle = `rgba(255,170,90,${0.03 + rng() * 0.07})`; ctx.fillRect(x, y, l, 2); }
  ctx.restore();
  embers(ctx, rng, 120, 0, 80, VW, 760, '#ffa040');
  grade(ctx, '#1a0604', 0.3, '#ff6a30', 0.05); vignette(ctx, 0.9);
}

// ───────────────────────── 3. EKSTREMT NÆRT: Wardens visir speiler det røde ─────────────────────────
// Speilvendt (Warden ser mot venstre, mot Hale): kun visir og brask fyller bildet; øynene bak glasset er vidåpne.
export function v2WardenEyes(ctx) {
  const rng = makeRng(5501);
  foundryBokeh(ctx, rng, 0.6);
  ctx.save();
  const z = 2.35, fx = 1135, fy = 395;               // visirsenteret i hjelmtegningen
  ctx.translate(VW / 2 + 40, VH / 2 - 10); ctx.scale(-z, z); ctx.translate(-fx, -fy);
  drawHelmet(ctx, {
    rain: false, post: false, seed: 2209, bg: () => {},
    inVisor: (c) => {   // refleks: den røde visirstripa + rekka av røde øyne, bøyd langs glasset
      c.save(); c.globalCompositeOperation = 'screen';
      soft(c, 1080, 400, 70, '#ff6a20', 0.35, 2.2, 0.5);
      c.restore(); c.save();
      c.fillStyle = 'rgba(8,4,4,0.85)'; c.beginPath(); c.ellipse(1062, 404, 34, 26, -0.05, 0, Math.PI * 2); c.fill();   // Hales hjelm som mørk form i speilet
      c.globalCompositeOperation = 'screen';
      c.fillStyle = 'rgba(255,58,36,1)'; c.beginPath(); c.ellipse(1066, 401, 26, 5.5, -0.08, 0, Math.PI * 2); c.fill();
      soft(c, 1060, 402, 34, RED, 0.6, 1.6, 0.6);
      for (const [x, y] of [[1010, 410], [1028, 407], [1098, 404], [1116, 406], [1150, 409], [994, 412]]) { c.fillStyle = 'rgba(255,42,26,0.8)'; c.fillRect(x, y, 3, 1.6); }
      c.restore();
    },
  });
  ctx.restore();
  // ravgult kantlys på braska fra kjernen er lov på bakgrunnen, ikke på Warden: kun kald spill her
  glow(ctx, 800, 450, 520, '#39c6ff', 0.08, 1.4, 0.6);
  grade(ctx, '#071018', 0.3, '#5a7a90', 0.02); vignette(ctx, 0.92);
}

// ───────────────────────── 4. HANDLING/REAKSJON: hansken planter ladningen ─────────────────────────
// Lav vinkel mot kjernens kappe. Wardens hanske slår en breach-ladning fast; cyan diode mot ravgul søm.
export function v2Charge(ctx) {
  const rng = makeRng(6601);
  // kjernekappen: stålplate som fyller bildet, glødende søm øverst
  vgrad(ctx, 0, 0, VW, VH, [[0, '#1c120d'], [0.5, '#120c0a'], [1, '#070505']]);
  brush(ctx, rng, 900, 0, 0, VW, VH, '#2a1d16', 0.25, 90, 6, 0.05, 0.3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createLinearGradient(0, 0, VW, 0); sg.addColorStop(0, 'rgba(255,90,20,0.2)'); sg.addColorStop(0.45, 'rgba(255,200,110,0.95)'); sg.addColorStop(1, 'rgba(255,90,20,0.15)');
  ctx.fillStyle = sg; ctx.fillRect(0, 120, VW, 12); ctx.restore();
  glow(ctx, 720, 126, 600, '#ff7a1a', 0.45, 1.6, 0.35);
  for (let x = 60; x < VW; x += 150) for (const y of [180, 820]) { soft(ctx, x, y, 14, '#000', 0.7); soft(ctx, x - 3, y - 4, 5, '#ff9a50', 0.35); }
  hazard(ctx, 0, 840, VW, 26, 0.6, 26);
  // ladningen
  const bx = 330, by = 380, bw = 520, bh = 290;
  const box = new Path2D(); box.roundRect(bx, by, bw, bh, 22);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; ctx.fillStyle = '#15181c'; ctx.fill(box); ctx.restore();
  ctx.save(); ctx.clip(box);
  vgrad(ctx, bx, by, bw, bh, [[0, '#2a3036'], [0.4, '#191d22'], [1, '#0c0e11']]);
  brush(ctx, rng, 160, bx, by, bw, bh, '#5b6570', 0.12, 40, 3, 0, 0.4);
  soft(ctx, bx + 120, by + 30, 120, '#ff9a50', 0.18, 1.6, 0.4);     // ravgult fra sømmen på toppen av boksen (miljø, ikke Warden)
  ctx.restore();
  ink(ctx, box, 6);
  // display + diodestripe
  ctx.fillStyle = '#05080a'; ctx.fillRect(bx + 40, by + 70, 200, 96);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.font = `700 78px ${F}`; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(57,198,255,0.95)'; ctx.fillText('0:75', bx + 58, by + 120);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i < 4 ? 'rgba(57,198,255,0.9)' : 'rgba(57,198,255,0.25)'; ctx.fillRect(bx + 40 + i * 34, by + 190, 26, 10); }
  ctx.restore();
  glow(ctx, bx + 140, by + 120, 260, CYAN, 0.3, 1.3, 0.8);
  // magnetklemmer
  for (const x of [bx - 30, bx + bw - 10]) { const c = new Path2D(); c.roundRect(x, by + 60, 40, bh - 120, 8); ctx.fillStyle = '#0d0f12'; ctx.fill(c); ink(ctx, c, 4); }
  // hansken: stor pansret hånd som presser ladningen fast – fingre i to ledd, mansjett, inn fra øvre høyre (CHARACTER_STYLE-farger)
  const cap = (x1, y1, x2, y2, r) => { const a = Math.atan2(y2 - y1, x2 - x1), p = new Path2D(); p.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2); p.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2); p.closePath(); return p; };
  const shade = (p, x0, y0, x1, y1, T = CS.armor) => {
    ctx.save(); ctx.clip(p);
    const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, T.l); g.addColorStop(0.4, T.m); g.addColorStop(1, T.d);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    brush(ctx, rng, 90, Math.min(x0, x1) - 60, Math.min(y0, y1) - 60, Math.abs(x1 - x0) + 120, Math.abs(y1 - y0) + 120, T.d, 0.25, 30, 3, 0.6, 0.6);
    soft(ctx, 640, 520, 220, CYAN, 0.2, 1.3, 0.8);            // cyan fra displayet
    ctx.restore();
  };
  const arm = new Path2D(); arm.moveTo(1700, 40); arm.lineTo(1700, 540); arm.bezierCurveTo(1450, 540, 1250, 580, 1120, 610); arm.lineTo(1000, 330); arm.bezierCurveTo(1200, 230, 1450, 110, 1700, 40); arm.closePath();
  shade(arm, 1100, 200, 1500, 600, CS.suit); rimLight(ctx, arm, 10, 12, 14, CS.rim, 0.55); ink(ctx, arm, 7);
  const plate = new Path2D(); plate.moveTo(1240, 230); plate.bezierCurveTo(1350, 180, 1480, 140, 1620, 110); plate.lineTo(1660, 400); plate.bezierCurveTo(1520, 430, 1400, 470, 1300, 520); plate.closePath();
  shade(plate, 1260, 150, 1600, 500, CS.armor); ink(ctx, plate, 6);
  ctx.save(); ctx.clip(plate); ctx.fillStyle = CS.blue; ctx.beginPath(); ctx.moveTo(1380, 180); ctx.lineTo(1430, 165); ctx.lineTo(1480, 450); ctx.lineTo(1430, 470); ctx.fill(); ctx.restore();   // blå stripe
  const cuff = new Path2D(); cuff.moveTo(985, 320); cuff.bezierCurveTo(1040, 290, 1090, 280, 1120, 285); cuff.lineTo(1190, 595); cuff.bezierCurveTo(1150, 605, 1120, 615, 1100, 630); cuff.closePath();
  shade(cuff, 1000, 280, 1180, 620, CS.armorLight); ink(ctx, cuff, 6);
  const palm = new Path2D(); palm.moveTo(1050, 330); palm.bezierCurveTo(980, 300, 840, 330, 800, 380); palm.lineTo(790, 560); palm.bezierCurveTo(860, 610, 1000, 620, 1110, 605); palm.closePath();
  shade(palm, 820, 320, 1100, 610, CS.armor); rimLight(ctx, palm, 10, 12, 14, CS.rim, 0.55); ink(ctx, palm, 7);
  const F4 = [[810, 395, 700, 380, 610, 420, 40], [805, 450, 690, 455, 600, 500, 42], [805, 505, 700, 530, 625, 580, 40], [815, 555, 730, 600, 680, 650, 36]];
  for (const [x1, y1, x2, y2, x3, y3, r] of F4) {
    const a2 = cap(x2, y2, x3, y3, r * 0.9), a1 = cap(x1, y1, x2, y2, r);
    shade(a2, x3 - 40, y3 - 40, x2 + 40, y2 + 40, CS.suit); ink(ctx, a2, 6);
    shade(a1, x2 - 40, y2 - 50, x1 + 40, y1 + 50, CS.armorLight); rimLight(ctx, a1, 6, 8, 10, CS.rim, 0.5); ink(ctx, a1, 6);
  }
  const th1 = cap(960, 600, 880, 680, 44), th2 = cap(880, 680, 790, 690, 38);
  for (const t of [th2, th1]) { shade(t, 780, 600, 980, 720, CS.armorLight); ink(ctx, t, 6); }
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(255,200,140,${0.18 - i * 0.05})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(640, 510, 330 + i * 40, 200 + i * 26, 0, Math.PI * 0.85, Math.PI * 1.55); ctx.stroke(); }
  ctx.restore();
  // gnister fra magnetfestet
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) { const a = -Math.PI * (0.1 + rng() * 0.8), l = 20 + rng() * 90, x = bx + 10 + rng() * 30, y = by + bh - 40 + rng() * 30; ctx.strokeStyle = `rgba(255,${180 + rng() * 60},120,${0.4 + rng() * 0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  ctx.restore();
  embers(ctx, rng, 90, 0, 60, VW, 700, '#ffa040');
  grade(ctx, '#0a0a10', 0.25, '#ff8a40', 0.03); vignette(ctx, 0.9);
}

export const ART2_SCENES = { v2Feed, v2HaleTurns, v2WardenEyes, v2Charge };
export const ART2_OVERLAYS = { v2Feed: v2FeedOverlay };
export const ART2_LIFT = { v2Feed: 0.12, v2HaleTurns: 0.12, v2WardenEyes: 0.1, v2Charge: 0.15 };
export const ART2_PAINT = {
  v2Feed: { warm: [46, 26, 12], grime: 0.45 },
  v2HaleTurns: { warm: [40, 20, 12], grime: 0.4, keep: 0.26 },
  v2WardenEyes: { warm: [26, 28, 32], grime: 0.4, keep: 0.26 },
  v2Charge: { warm: [40, 26, 16], grime: 0.45, keep: 0.22 },
};
