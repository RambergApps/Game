// BREACH – malt nærbilde av Wardens hjelm (panel `wardenVisor` i intro).
// Ingen konturer: formen bygges med myke lys/skygge-flekker klippet til silhuetten, kaldt kantlys bakfra,
// cyan visir som skarpeste punkt, regn og fukt, slitasje og skitt. Stil: KARAKTER-SPEC / src/player (COL).
import { VW, VH, PAL, makeRng, rgba, mix, glow, rain, vignette, grade } from './art.js';

const COL = {
  armorD: '#0d1013', armor: '#1a1e23', armorM: '#333a42', armorL: '#5b6570',
  rim: '#a9c0d2', visor: '#39c6ff', visorD: '#06202d',
  scarfD: '#4a3722', scarf: '#6e5232', scarfL: '#a8814f',
  stripe: '#2e4f66', stripeL: '#4f7894',
};

const layer = () => { const c = document.createElement('canvas'); c.width = VW; c.height = VH; return [c, c.getContext('2d')]; };

/** Myk flekk (normal blanding) – byggestein for maling av volum. */
function soft(ctx, x, y, r, color, a, sx = 1, sy = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.5, rgba(color, a * 0.55)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/** Penselstrøk-tekstur innenfor gjeldende klipp: korte, tilspissede strøk i gitt retning. */
function brush(ctx, rng, n, x0, y0, w, h, col, a, len, wid, ang, jitter = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * w, y = y0 + rng() * h, l = len * (0.5 + rng()), d = wid * (0.5 + rng() * 0.8), t = ang + (rng() - 0.5) * jitter;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t); ctx.fillStyle = rgba(col, a * (0.4 + rng() * 0.6));
    ctx.beginPath(); ctx.moveTo(-l / 2, 0); ctx.quadraticCurveTo(0, -d, l / 2, 0); ctx.quadraticCurveTo(0, d * 0.7, -l / 2, 0); ctx.fill(); ctx.restore();
  }
}

// ---------- silhuetter (glatte kurver, ingen polygoner) ----------
function shellPath() { // hjelmskallet i 3/4 profil mot høyre: flat kuppel, brask som stikker fram, vinklet kjeve, nakkeskjerm
  const p = new Path2D();
  p.moveTo(700, 628);
  p.bezierCurveTo(650, 600, 622, 520, 630, 430);       // nakkeskjerm/bakhode
  p.bezierCurveTo(636, 320, 690, 210, 800, 168);
  p.bezierCurveTo(900, 132, 1060, 138, 1170, 196);     // flat kuppel
  p.bezierCurveTo(1230, 230, 1270, 280, 1290, 318);    // brask stikker fram
  p.bezierCurveTo(1294, 330, 1280, 338, 1262, 340);
  p.bezierCurveTo(1270, 380, 1270, 420, 1262, 444);    // visirfront
  p.bezierCurveTo(1262, 500, 1250, 560, 1222, 604);    // vinklet kjeve
  p.bezierCurveTo(1200, 636, 1150, 652, 1090, 650);
  p.bezierCurveTo(1040, 648, 1000, 630, 975, 608);     // halsåpning
  p.bezierCurveTo(920, 628, 800, 650, 700, 628);
  p.closePath(); return p;
}
function visorPath() { // visirbånd som bøyer rundt fronten
  const p = new Path2D();
  p.moveTo(985, 328);
  p.bezierCurveTo(1060, 312, 1170, 318, 1258, 345);
  p.bezierCurveTo(1270, 380, 1268, 412, 1256, 438);
  p.bezierCurveTo(1170, 428, 1070, 432, 1000, 452);
  p.bezierCurveTo(978, 420, 974, 368, 985, 328);
  p.closePath(); return p;
}
function earPath() {
  const p = new Path2D(); p.ellipse(842, 430, 92, 112, -0.12, 0, Math.PI * 2); return p;
}
function jawPath() { // kjeve-/pusteparti under visiret
  const p = new Path2D();
  p.moveTo(1004, 470); p.bezierCurveTo(1080, 452, 1180, 450, 1252, 462);
  p.bezierCurveTo(1258, 540, 1236, 590, 1196, 622);
  p.bezierCurveTo(1130, 650, 1060, 652, 1010, 630);
  p.bezierCurveTo(990, 580, 990, 520, 1004, 470); p.closePath(); return p;
}
function torsoPath() { // brystplate/overkropp, nesten i silhuett
  const p = new Path2D();
  p.moveTo(250, 900); p.bezierCurveTo(300, 760, 520, 690, 760, 640);
  p.bezierCurveTo(950, 640, 1150, 640, 1290, 660);
  p.bezierCurveTo(1380, 700, 1440, 800, 1460, 900); p.closePath(); return p;
}
function scarfPath() { // skjerfet viklet rundt halsen, ujevn underkant
  const p = new Path2D();
  p.moveTo(720, 640);
  p.bezierCurveTo(820, 600, 960, 612, 1090, 640);
  p.bezierCurveTo(1170, 652, 1230, 640, 1282, 660);
  p.bezierCurveTo(1300, 700, 1296, 740, 1270, 770);
  p.bezierCurveTo(1200, 790, 1150, 760, 1080, 782);
  p.bezierCurveTo(1000, 806, 930, 770, 860, 790);
  p.bezierCurveTo(800, 806, 750, 780, 712, 740);
  p.bezierCurveTo(700, 700, 704, 664, 720, 640); p.closePath(); return p;
}
function scarfTailPath() { // en hale som henger over skulderen bakover
  const p = new Path2D();
  p.moveTo(760, 700); p.bezierCurveTo(700, 760, 660, 820, 640, 900);
  p.lineTo(720, 900); p.bezierCurveTo(740, 830, 780, 780, 830, 740); p.closePath(); return p;
}
function shoulderPath() {
  const p = new Path2D();
  p.moveTo(240, 900); p.bezierCurveTo(260, 800, 380, 740, 560, 760);
  p.bezierCurveTo(640, 770, 700, 820, 720, 900); p.closePath(); return p;
}

/** Kaldt kantlys: fyll formen, trekk fra en forskjøvet og uskarp kopi → myk lysende kant på én side. */
function rimLight(ctx, path, dx, dy, blur, col, a) {
  const [c, x] = layer();
  x.fillStyle = col; x.fill(path);
  x.globalCompositeOperation = 'destination-out'; x.filter = `blur(${blur}px)`; x.translate(dx, dy); x.fill(path);
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(1.2px)'; ctx.drawImage(c, 0, 0); ctx.restore();
}

/** Visirpaletter. CYAN = Warden (standard). RED = omprogrammert (Hale i v2-prøven). */
export const VISOR_CYAN = { visor: '#39c6ff', visorD: '#06202d', g0: '#03141c', g2: '#0d5a7a', g3: '#2aa6d6', drop: '#bff0ff', hot: '#d8f6ff', led: '#e8fbff', eye: '#c4f1ff', spillA: '#1a2f3c', spillB: '#1a3a48', spillC: '#1d3440', face: '#0b2a36', spec: 'rgba(225,250,255,0.95)' };
export const VISOR_RED = { visor: '#ff3a24', visorD: '#2a0605', g0: '#140302', g2: '#7a120a', g3: '#ff4a2a', drop: '#ffc0b0', hot: '#ffd8c8', led: '#ffe0d8', eye: '#ff6040', spillA: '#3a1410', spillB: '#481a12', spillC: '#40180f', face: '#2a0806', spec: 'rgba(255,225,215,0.95)' };

/**
 * Malt hjelmnærbilde. o (valgfri, standard = Wardens intro-bilde):
 *  V: visirpalett (VISOR_CYAN | VISOR_RED) · eyes: øyne bak visiret (true) · callsign: stensil ('W-09')
 *  bg(ctx, rng): egen bakgrunn i stedet for nattregn · rain: regn foran (true) · inVisor(ctx): tegn inni visirklippet (refleks)
 *  post: grade + vignett til slutt (true)
 */
export function drawHelmet(ctx, o = {}) {
  const V = o.V || VISOR_CYAN, eyesOn = o.eyes !== false, rainOn = o.rain !== false;
  const rng = makeRng(o.seed || 2209);
  // ---------- bakgrunn: natt, regn, uskarpe gårdslys ----------
  if (o.bg) o.bg(ctx, rng); else {
  const bg = ctx.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#07090c'); bg.addColorStop(1, '#0b0d10');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 26; i++) {
    const x = rng() * VW * 0.5, y = 100 + rng() * 650, r = 18 + rng() * 60, c = rng() < 0.82 ? PAL.light : '#ff3020';
    soft(ctx, x, y, r, c, 0.05 + rng() * 0.08);
  }
  soft(ctx, 360, 360, 460, '#8fa3b5', 0.05); // kald himmelglød bak (kilden til kantlyset)
  soft(ctx, 1500, 300, 300, PAL.visor, 0.05);
  }

  // ---------- overkropp, skulder og skjerf (i forgrunnen, nederst) ----------
  const torso = torsoPath();
  ctx.save(); ctx.clip(torso);
  ctx.fillStyle = '#08090b'; ctx.fillRect(240, 620, 1240, 300);
  soft(ctx, 700, 760, 260, COL.armor, 0.7, 1.5, 0.6);
  soft(ctx, 1200, 820, 220, V.spillA, 0.25, 1.2, 0.6);   // svak cyan refleks fra visiret på brystet
  brush(ctx, rng, 400, 240, 620, 1240, 300, '#000000', 0.2, 30, 5, -0.2);
  ctx.restore();
  rimLight(ctx, torso, 10, 12, 16, COL.rim, 0.22);

  const sh = shoulderPath();
  ctx.save(); ctx.clip(sh);
  ctx.fillStyle = COL.armorD; ctx.fillRect(200, 700, 560, 220);
  soft(ctx, 420, 760, 220, COL.armorM, 0.45, 1.4, 0.5);
  ctx.save(); ctx.translate(470, 830); ctx.rotate(-0.12); // blå stripe og Λ
  ctx.fillStyle = rgba(COL.stripe, 0.85); ctx.fillRect(-170, -14, 300, 18); ctx.fillStyle = rgba(COL.stripeL, 0.35); ctx.fillRect(-170, -14, 300, 4);
  ctx.strokeStyle = 'rgba(214,218,220,0.35)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-120, 50); ctx.lineTo(-96, 14); ctx.lineTo(-72, 50); ctx.stroke();
  ctx.restore();
  brush(ctx, rng, 260, 220, 740, 520, 180, '#000000', 0.18, 26, 4, -0.2);
  ctx.restore();
  rimLight(ctx, sh, 10, 10, 14, COL.rim, 0.28);

  const tail = scarfTailPath();
  ctx.save(); ctx.clip(tail); ctx.fillStyle = '#1a130c'; ctx.fillRect(620, 690, 240, 220);
  soft(ctx, 740, 760, 60, COL.scarfD, 0.6, 0.6, 1.6, 0.6); brush(ctx, rng, 160, 620, 690, 240, 220, '#050302', 0.3, 24, 3, 1.1, 0.3); ctx.restore();
  const sc = scarfPath();
  ctx.save(); ctx.clip(sc);
  ctx.fillStyle = '#1e160e'; ctx.fillRect(690, 590, 620, 230);
  for (let i = 0; i < 7; i++) { // viklinger: uregelmessige, buede rygger og daler som brytes opp
    const y = 640 + i * 20 + rng() * 14, x0 = 690 + rng() * 120, x1 = 1060 + rng() * 260, bend = (rng() - 0.5) * 50;
    ctx.save(); ctx.filter = `blur(${5 + rng() * 6}px)`;
    ctx.strokeStyle = rgba(rng() < 0.5 ? COL.scarfD : COL.scarf, 0.45 + rng() * 0.4); ctx.lineWidth = 8 + rng() * 14;
    ctx.beginPath(); ctx.moveTo(x0, y + 10); ctx.bezierCurveTo(x0 + 180, y - 22 + bend, x1 - 200, y + 20 - bend, x1, y - 4 + (rng() - 0.5) * 20); ctx.stroke();
    ctx.strokeStyle = `rgba(6,4,3,${0.5 + rng() * 0.35})`; ctx.lineWidth = 5 + rng() * 9;
    ctx.beginPath(); ctx.moveTo(x0 + 40, y + 24); ctx.bezierCurveTo(x0 + 200, y - 4 + bend, x1 - 180, y + 34 - bend, x1 - 30, y + 14); ctx.stroke();
    ctx.restore();
  }
  soft(ctx, 820, 650, 90, COL.scarf, 0.35, 1.5, 0.45, -0.2);    // øverste vikling fanger kaldt lys fra venstre
  brush(ctx, rng, 420, 690, 590, 620, 230, COL.scarf, 0.10, 26, 2.5, 0.05, 0.3);
  brush(ctx, rng, 420, 690, 590, 620, 230, '#050302', 0.25, 24, 3, 0.05, 0.3);
  soft(ctx, 1120, 670, 160, '#030202', 0.65, 1.4, 0.5);          // skygge under kjeven
  soft(ctx, 1230, 700, 80, V.spillB, 0.25, 1, 0.6);              // cyan søl
  ctx.restore();
  rimLight(ctx, sc, 8, 10, 10, '#c8d4dc', 0.2);

  // ---------- hjelmskallet ----------
  const shell = shellPath();
  ctx.save(); ctx.clip(shell);
  ctx.fillStyle = COL.armorD; ctx.fillRect(560, 100, 760, 620);
  // volum: hovedlys fra nordvest (kaldt, svakt), kjernskygge mot høyre/ned, refleks fra visiret nedenfra-foran
  soft(ctx, 820, 250, 300, COL.armorM, 0.85, 1.25, 0.9, -0.4);
  soft(ctx, 790, 230, 200, COL.armorL, 0.55, 1.3, 0.8, -0.5);
  soft(ctx, 720, 210, 70, '#8c98a4', 0.35, 1.6, 0.7, -0.6);       // speilblink på kuppelen
  soft(ctx, 1080, 260, 220, COL.armor, 0.7, 1.3, 0.8);
  soft(ctx, 1000, 560, 260, '#050607', 0.75, 1.4, 0.7);            // kjernskygge under
  soft(ctx, 690, 520, 160, '#050607', 0.6, 0.7, 1.4);              // bakhode i skygge
  // panneplate: myk kant mot visiret (ikke strek) – mørk fuge med lys underkant
  ctx.save(); ctx.filter = 'blur(5px)';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(900, 170); ctx.bezierCurveTo(960, 230, 980, 280, 985, 330); ctx.stroke();      // plateskjøt kuppel/side
  ctx.beginPath(); ctx.moveTo(985, 322); ctx.bezierCurveTo(1080, 308, 1180, 314, 1270, 340); ctx.stroke();   // skygge under brasken
  ctx.restore();
  ctx.save(); ctx.filter = 'blur(3px)'; ctx.strokeStyle = rgba(COL.armorL, 0.35); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(1000, 270); ctx.bezierCurveTo(1100, 250, 1200, 262, 1284, 316); ctx.stroke();      // lys på braskanten
  ctx.restore();
  // bakre plate-kant langs bakhodet
  ctx.save(); ctx.filter = 'blur(6px)'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(700, 300); ctx.bezierCurveTo(720, 420, 740, 540, 800, 650); ctx.stroke(); ctx.restore();
  // penseltekstur på skallet: følger kuppelens krumning
  brush(ctx, rng, 700, 600, 120, 700, 560, COL.armorL, 0.07, 40, 5, -0.5, 0.8);
  brush(ctx, rng, 500, 600, 120, 700, 560, '#000000', 0.12, 36, 5, -0.5, 0.8);
  // skitt og regnstriper: mørke renner som går nedover fra kuppelen
  for (let i = 0; i < 26; i++) {
    const x = 640 + rng() * 620, y = 160 + rng() * 260, l = 60 + rng() * 220, w = 2 + rng() * 6;
    const g = ctx.createLinearGradient(0, y, 0, y + l); g.addColorStop(0, 'rgba(20,16,12,0.45)'); g.addColorStop(1, 'rgba(20,16,12,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + w, y + l * 0.3, x - w, y + l * 0.6, x + w * 0.5, y + l); ctx.lineTo(x + w * 1.5, y + l); ctx.bezierCurveTo(x + w, y + l * 0.6, x + w * 2, y + l * 0.3, x + w, y); ctx.fill();
  }
  for (let i = 0; i < 40; i++) soft(ctx, 620 + rng() * 660, 140 + rng() * 540, 10 + rng() * 40, '#1a140e', 0.25 + rng() * 0.25, 1 + rng(), 0.6 + rng() * 0.6, rng() * 3);
  // avskallet maling og riper (lyse metallglimt, korte, mest på kantene)
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = 640 + rng() * 620, y = 150 + rng() * 520, a = -0.6 + (rng() - 0.5) * 1.2, l = 6 + rng() * 34;
    ctx.strokeStyle = `rgba(150,165,178,${0.12 + rng() * 0.22})`; ctx.lineWidth = 0.8 + rng() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    if (rng() < 0.25) { ctx.fillStyle = `rgba(110,120,130,${0.2 + rng() * 0.2})`; ctx.beginPath(); ctx.ellipse(x, y, 2 + rng() * 5, 1.5 + rng() * 3, rng() * 3, 0, Math.PI * 2); ctx.fill(); }
  }
  // stensilert kallesignal, slitt
  ctx.save(); ctx.translate(760, 300); ctx.rotate(-0.28); ctx.font = '600 46px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(200,205,210,0.12)'; ctx.fillText(o.callsign || 'W-09', 0, 0); ctx.restore();
  // cyan refleks fra visiret på kinnplaten og kjeven
  soft(ctx, 1150, 470, 160, V.visor, 0.18, 1.3, 0.6);
  ctx.restore();

  // ---------- øremodul ----------
  const ear = earPath();
  ctx.save(); ctx.clip(ear);
  ctx.fillStyle = COL.armorD; ctx.fillRect(740, 300, 210, 250);
  soft(ctx, 815, 380, 90, COL.armorM, 0.8, 1, 1.1);
  soft(ctx, 800, 360, 40, COL.armorL, 0.45);
  soft(ctx, 880, 500, 90, '#040506', 0.7);
  for (let i = 0; i < 4; i++) { ctx.save(); ctx.filter = 'blur(1.5px)'; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(780, 400 + i * 22, 110, 6); ctx.fillStyle = 'rgba(120,135,148,0.18)'; ctx.fillRect(780, 407 + i * 22, 110, 2); ctx.restore(); }
  brush(ctx, rng, 120, 740, 300, 210, 250, '#000000', 0.15, 20, 4, -0.4);
  ctx.restore();
  ctx.save(); ctx.filter = 'blur(8px)'; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; // kontaktskygge rundt modulen
  ctx.beginPath(); ctx.ellipse(852, 442, 96, 116, -0.12, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); ctx.restore();
  rimLight(ctx, ear, 6, 7, 8, COL.rim, 0.3);
  // antenne fra øremodulen
  ctx.save(); ctx.filter = 'blur(0.6px)'; ctx.strokeStyle = 'rgba(8,10,12,0.95)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(790, 340); ctx.lineTo(700, 110); ctx.stroke();
  ctx.strokeStyle = rgba(COL.rim, 0.4); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(788, 338); ctx.lineTo(698, 108); ctx.stroke(); ctx.restore();
  glow(ctx, 812, 476, 14, V.visor, 0.7); glow(ctx, 812, 476, 4, V.led, 0.9);   // statusdiode (cyan, sparsomt)

  // ---------- kjeve/pusteparti ----------
  const jaw = jawPath();
  ctx.save(); ctx.clip(jaw);
  ctx.fillStyle = '#0a0c0e'; ctx.fillRect(980, 440, 300, 220);
  soft(ctx, 1150, 480, 140, V.spillC, 0.65, 1.2, 0.5);   // cyan søl ovenfra
  soft(ctx, 1120, 600, 120, '#030405', 0.8, 1.4, 0.7);
  for (let i = 0; i < 5; i++) { ctx.save(); ctx.filter = 'blur(1.2px)'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(1100, 520 + i * 18, 110, 5); ctx.fillStyle = rgba(V.visor, 0.08); ctx.fillRect(1100, 518 + i * 18, 110, 2); ctx.restore(); }
  brush(ctx, rng, 160, 980, 440, 300, 220, '#000000', 0.18, 20, 4, 0.2);
  ctx.restore();
  ctx.save(); ctx.filter = 'blur(6px)'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 12; ctx.stroke(jaw); ctx.restore(); // myk fuge, ikke strek

  // ---------- visir ----------
  const vis = visorPath();
  ctx.save(); ctx.clip(vis);
  let g = ctx.createLinearGradient(985, 330, 1265, 440);
  g.addColorStop(0, V.g0); g.addColorStop(0.45, V.visorD); g.addColorStop(0.8, V.g2); g.addColorStop(1, V.g3);
  ctx.fillStyle = g; ctx.fillRect(960, 300, 320, 170);
  // ansikt bak glasset: mørk brynkant, nese, to øyne som fanger lyset
  soft(ctx, 1110, 390, 110, '#000000', 0.55, 1.1, 0.55);
  soft(ctx, 1135, 365, 60, V.face, 0.6, 1.6, 0.35);                  // panne/bryn
  soft(ctx, 1188, 405, 26, V.face, 0.6, 0.6, 1.3);                   // nese
  for (const [ex, ey] of eyesOn ? [[1112, 388], [1205, 384]] : []) {
    soft(ctx, ex, ey, 20, '#000000', 0.7, 1.3, 0.7);
    soft(ctx, ex + 2, ey, 13, V.eye, 0.9, 1.5, 0.65);
    ctx.fillStyle = rgba(V.led, 0.85); ctx.fillRect(ex + 1, ey - 1, 2, 2);
  }
  // glødende innside (visiret lyser innenfra)
  glow(ctx, 1230, 395, 160, V.visor, 0.35, 1.2, 0.6);
  // regn: dråper og renner på glasset
  for (let i = 0; i < 38; i++) {
    const x = 990 + rng() * 270, y = 325 + rng() * 120, r = 1.5 + rng() * 4.5;
    soft(ctx, x, y + r * 0.6, r * 1.6, '#000000', 0.25);
    ctx.fillStyle = rgba(V.drop, 0.12 + rng() * 0.2); ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(V.led, 0.85); ctx.fillRect(x - r * 0.35, y - r * 0.6, 1.4, 1.4);
    if (rng() < 0.18) { const l = 12 + rng() * 40; ctx.fillStyle = rgba(V.drop, 0.18); ctx.fillRect(x - 0.8, y, 1.6, l); }
  }
  if (o.inVisor) o.inVisor(ctx, rng);
  // skarpeste punkt: speilrefleks langs visirets overkant
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(2px)'; ctx.strokeStyle = rgba(V.visor, 0.9); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(1010, 342); ctx.bezierCurveTo(1090, 330, 1180, 334, 1250, 356); ctx.stroke();
  ctx.filter = 'none'; ctx.strokeStyle = V.spec; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(1150, 337); ctx.bezierCurveTo(1190, 339, 1220, 344, 1248, 354); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // visiret kaster lys ut i regnet og ned på kjeven
  glow(ctx, 1240, 395, 340, V.visor, 0.22, 1.1, 0.55);
  glow(ctx, 1262, 392, 70, V.hot, 0.35, 0.6, 1.2);

  // ---------- kantlys på skallet (kaldt, fra venstre bak) ----------
  rimLight(ctx, shell, 18, 16, 26, COL.rim, 0.34);
  // regndråper og fukt på skallet (perler som fanger kantlyset)
  ctx.save(); ctx.clip(shell);
  for (let i = 0; i < 80; i++) {
    const x = 630 + rng() * 640, y = 140 + rng() * 520, r = 1.2 + rng() * 3.2;
    const lit = Math.max(0, 1 - Math.hypot(x - 700, y - 260) / 520);
    soft(ctx, x + r * 0.5, y + r, r * 1.8, '#000000', 0.3);
    ctx.fillStyle = `rgba(190,215,230,${0.08 + lit * 0.35})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(235,245,255,${0.1 + lit * 0.45})`; ctx.fillRect(x - r * 0.4, y - r * 0.5, 1.3, 1.3);
  }
  ctx.restore();

  // ---------- atmosfære ----------
  if (rainOn) { rain(ctx, rng, 420, 0.12, 40); rain(ctx, rng, 50, 0.2, 90); }
  if (o.post !== false) { grade(ctx, '#0b1620', 0.3, '#5a7a90', 0.02); vignette(ctx, 0.88); }
}

// hjelpere delt med art2/ (v2-prøven)
export { COL as HELMET_COL, soft, brush, rimLight, layer };
