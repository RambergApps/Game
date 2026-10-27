// BREACH – prosedyrale illustrasjoner for mellomsekvensene. Hver scene tegner et statisk bilde i 1600×900.
import { paint } from './paint.js';
import { drawHelmet } from './helmet.js';
import { ART2_SCENES, ART2_OVERLAYS, ART2_LIFT, ART2_PAINT } from './art2/reveal.js';   // v2-prøven (foundry-core-v2)
import { VW, VH, PAL, makeRng, rgba, mix, vgrad, glow, cone, fog, smoke, rain, embers, eyes, hazard, container,
  lampPost, reflection, wetFloor, crane, tank, pipe, chain, figure, vignette, grade } from './art.js';

const CONT = ['#5a2a22', '#24343f', '#3b3f2c', '#4a2f1f', '#2e3236', '#5b4a26'];

function containerWall(ctx, rng, y, rows, hBase, dark, lit) {
  let x = -40;
  while (x < VW + 40) {
    const w = 160 + rng() * 220, stack = 1 + Math.floor(rng() * rows);
    for (let r = 0; r < stack; r++) container(ctx, rng, x, y - (r + 1) * hBase, w, hBase - 2, mix(CONT[Math.floor(rng() * CONT.length)], '#06080a', dark), lit);
    x += w + 2 + (rng() < 0.2 ? 60 + rng() * 120 : 0);
  }
}

// 1. Porten i containergården om natten. Warden i forgrunnen, Kolonnen i mørket bak porten.
function yardGate(ctx) {
  const rng = makeRng(11);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#06080b'], [0.45, '#12161b'], [0.62, '#1b1d20'], [1, '#08090a']]);
  glow(ctx, 1050, 470, 700, '#ff8a3a', 0.10, 1.4, 0.45);           // fjern by-glød
  crane(ctx, 260, 470, 330, '#0c0e11'); crane(ctx, 1180, 470, 380, '#0b0d10');
  fog(ctx, 330, 220, '#4a5560', 0.25);
  containerWall(ctx, rng, 545, 3, 70, 0.5, 0.35);
  fog(ctx, 420, 200, '#55606a', 0.18);
  // porten
  const gx = 760, gw = 520, gy = 300, gb = 600;
  ctx.fillStyle = '#020203'; ctx.fillRect(gx, gy + 40, gw, gb - gy - 40);         // mørket bak porten
  smoke(ctx, rng, gx, gy + 60, gw, 220, '#30160f', 0.25, 14);
  for (const [ex, ey, s] of [[880, 470, 1.3], [990, 440, 1.0], [1060, 500, 1.6], [1140, 455, 1.0], [935, 520, 1.9], [1210, 480, 1.2], [1110, 412, 0.8]]) eyes(ctx, ex, ey, s);
  glow(ctx, 1015, 515, 70, PAL.heavy, 0.25, 1, 0.8);                               // Heavy-glød i mørket
  ctx.fillStyle = '#121518'; ctx.fillRect(gx - 34, gy, 34, gb - gy); ctx.fillRect(gx + gw, gy, 34, gb - gy);
  ctx.fillRect(gx - 34, gy, gw + 68, 40);
  hazard(ctx, gx - 34, gy + 6, gw + 68, 22, 0.85, 22);
  hazard(ctx, gx - 30, gy + 60, 26, gb - gy - 80, 0.5, 14); hazard(ctx, gx + gw + 4, gy + 60, 26, gb - gy - 80, 0.5, 14);
  // halvåpen grind (venstre fløy)
  ctx.fillStyle = '#16191c'; ctx.fillRect(gx, gy + 40, 210, gb - gy - 40);
  ctx.strokeStyle = '#0a0b0d'; ctx.lineWidth = 4;
  for (let x = gx + 14; x < gx + 210; x += 26) { ctx.beginPath(); ctx.moveTo(x, gy + 40); ctx.lineTo(x, gb); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(gx, gy + 40); ctx.lineTo(gx + 210, gb); ctx.moveTo(gx + 210, gy + 40); ctx.lineTo(gx, gb); ctx.stroke();
  glow(ctx, gx + gw + 17, gy + 22, 30, '#ff3020', 0.8); glow(ctx, gx - 17, gy + 22, 30, '#ff3020', 0.8); // varsellys
  // gulv
  wetFloor(ctx, rng, 600);
  lampPost(ctx, 620, 640, 330, PAL.light, 0.20, 150);
  lampPost(ctx, 1420, 650, 300, PAL.light, 0.16, 120);
  reflection(ctx, 641, 650, 230, PAL.light, 0.28, 14); reflection(ctx, 1441, 660, 200, PAL.light, 0.22, 12);
  reflection(ctx, gx - 17, 610, 160, '#ff3020', 0.2, 8); reflection(ctx, gx + gw + 17, 610, 160, '#ff3020', 0.2, 8);
  // lav betongsperre i mellomgrunnen
  ctx.fillStyle = '#1c1f22'; ctx.fillRect(470, 668, 260, 46); hazard(ctx, 470, 668, 260, 9, 0.7, 12);
  ctx.fillStyle = 'rgba(255,179,71,0.08)'; ctx.fillRect(470, 668, 260, 3);
  // Warden
  glow(ctx, 360, 520, 260, '#8fa3b5', 0.10); glow(ctx, 330, 860, 220, PAL.light, 0.10, 1, 0.25);
  figure(ctx, { x: 330, y: 872, s: 4.4, kind: 'warden', rim: PAL.light, rimA: 0.8, rimDir: 1, fill: '#07090b' });
  rain(ctx, rng, 900, 0.16, 30); rain(ctx, rng, 120, 0.28, 60);
  grade(ctx, '#0b1620', 0.35, '#ff9a40', 0.03); vignette(ctx, 0.9);
}

// 2. Nærbilde av Wardens hjelm i profil: kantete plater, cyan visir, regn og varmt kantlys bakfra.
function plate(ctx, pts, stops, x0, y0, x1, y1, edge = null) {
  const p = new Path2D(); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath();
  const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fill(p);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2.5; ctx.stroke(p);
  if (edge) { ctx.save(); ctx.clip(p); ctx.translate(-3, -2); ctx.strokeStyle = edge; ctx.lineWidth = 4; ctx.stroke(p); ctx.restore(); }
  return p;
}
function wardenVisor(ctx) { drawHelmet(ctx); } // malt nærbilde, se helmet.js

// 3. Etter kampen i gården: Warden kneler bak lav dekning, raffineriet brenner i horisonten.
function yardAftermath(ctx) {
  const rng = makeRng(33);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#0a0c0f'], [0.5, '#1e1a18'], [0.6, '#1a1716'], [1, '#08090a']]);
  // raffineriet i horisonten
  glow(ctx, 1230, 470, 600, '#ff6a20', 0.42, 1.3, 0.5);
  for (const [x, w, h] of [[1040, 50, 190], [1110, 34, 140], [1180, 70, 230], [1290, 40, 160], [1350, 60, 120], [1420, 26, 260]]) { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(x, 500 - h, w, h); }
  glow(ctx, 1433, 228, 60, '#ffb347', 0.9, 0.6, 1.4); glow(ctx, 1433, 228, 160, '#ff6a20', 0.35); // fakkel
  smoke(ctx, rng, 1000, 150, 520, 250, '#140d0b', 0.55, 30);
  fog(ctx, 420, 160, '#5a3a2a', 0.25);
  containerWall(ctx, rng, 560, 2, 64, 0.75, 0.25);
  smoke(ctx, rng, -100, 380, 1100, 260, '#1a1c1e', 0.35, 26);
  wetFloor(ctx, rng, 560, '#141517', '#070808');
  glow(ctx, 1230, 640, 360, '#ff6a20', 0.12, 1, 0.25);
  // falne fiender (slukkede øyne) til venstre
  ctx.fillStyle = '#060607';
  for (const [x, y, sc] of [[260, 690, 1], [520, 760, 1.2], [140, 630, 0.7]]) { ctx.beginPath(); ctx.ellipse(x, y, 70 * sc, 14 * sc, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x - 40 * sc, y - 8 * sc, 18 * sc, 13 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
  eyes(ctx, 485, 748, 1.4, PAL.eye, 0.3);
  // Warden på kne bak lav dekning, ser mot raffineriet
  glow(ctx, 980, 640, 260, '#ff8a3a', 0.10, 1, 0.5);
  figure(ctx, { x: 960, y: 800, s: 3.9, kind: 'warden', pose: 'kneel', rim: '#ff8a3a', rimA: 0.9, rimDir: 1, fill: '#07090b' });
  ctx.fillStyle = '#1b1e21'; ctx.fillRect(760, 724, 460, 96);
  vgrad(ctx, 760, 724, 460, 96, [[0, 'rgba(255,140,60,0.14)'], [1, 'rgba(0,0,0,0.55)']]);
  hazard(ctx, 760, 724, 460, 12, 0.7, 16);
  ctx.fillStyle = 'rgba(255,150,70,0.3)'; ctx.fillRect(760, 724, 460, 2);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(760 + rng() * 460, 742 + rng() * 70, 1 + rng() * 4, 0, Math.PI * 2); ctx.fill(); }
  embers(ctx, rng, 90, 700, 150, 900, 500, '#ff9a40');
  rain(ctx, rng, 300, 0.08, 26);
  grade(ctx, '#1a0e08', 0.3, '#ff7a30', 0.04); vignette(ctx, 0.9);
}

// 4. Raffinerikrysset brenner. Warden står alene midt i krysset.
function refineryBurning(ctx) {
  const rng = makeRng(44);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#0d0907'], [0.55, '#2a140b'], [0.7, '#1a0f0a'], [1, '#070606']]);
  glow(ctx, 800, 560, 900, '#ff5a10', 0.22, 1.4, 0.6);
  smoke(ctx, rng, 0, 40, VW, 360, '#0d0807', 0.6, 50);
  tank(ctx, 90, 210, 210, 480, PAL.metal, '#ff7a1a', 0.5); tank(ctx, 330, 300, 130, 390, PAL.metal, '#ff7a1a', 0.45);
  tank(ctx, 1230, 180, 240, 510, PAL.metal, '#ff7a1a', 0.5); tank(ctx, 1120, 330, 110, 360, PAL.metal, '#ff7a1a', 0.4);
  // rørbro
  pipe(ctx, -20, 330, 1640, 300, 22, '#1d2024', '#ff9a40', 0.25); pipe(ctx, -20, 380, 1640, 352, 14, '#191b1e', '#ff9a40', 0.2);
  ctx.fillStyle = '#0c0d0f'; ctx.fillRect(-20, 395, 1660, 10);
  for (let x = 40; x < VW; x += 140) ctx.fillRect(x, 300, 10, 410);
  // flamme på venstre tank
  glow(ctx, 195, 205, 220, '#ff7a1a', 0.6); glow(ctx, 195, 180, 70, '#ffd070', 0.9, 0.7, 1.6);
  pipe(ctx, 780, 690, 780, 140, 9, '#141618'); glow(ctx, 780, 120, 80, '#ffb347', 0.95, 0.5, 1.6); glow(ctx, 780, 130, 200, '#ff6a20', 0.45);
  smoke(ctx, rng, 600, 0, 400, 140, '#0a0605', 0.7, 18);
  fog(ctx, 520, 220, '#ff6a20', 0.12);
  wetFloor(ctx, rng, 690, '#191210', '#070505');
  reflection(ctx, 195, 700, 200, '#ff7a1a', 0.18, 60); reflection(ctx, 780, 700, 200, '#ffb347', 0.25, 20);
  hazard(ctx, 0, 690, VW, 10, 0.35, 20);
  // falne
  ctx.fillStyle = '#050405';
  for (const [x, y, s] of [[560, 790, 1.2], [1040, 770, 1], [1250, 830, 1.4]]) { ctx.beginPath(); ctx.ellipse(x, y, 70 * s, 13 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  glow(ctx, 1250, 822, 50, PAL.heavy, 0.35); // en Heavy som slukner
  figure(ctx, { x: 820, y: 800, s: 2.4, kind: 'warden', rim: '#ff8a3a', rimA: 0.9, rimDir: -1, fill: '#060708', flip: true });
  embers(ctx, rng, 220, 0, 100, VW, 700, '#ffa040');
  grade(ctx, '#1a0a04', 0.35, '#ff7a30', 0.05); vignette(ctx, 0.92);
}

// 5. Nedstigningen til støperiet. Trapp ned i oransje glød.
function foundryDescent(ctx) {
  const rng = makeRng(55);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#050506'], [0.6, '#170b06'], [1, '#3a1606']]);
  // sjakt-vegger i perspektiv
  const vpX = 820, vpY = 760;
  ctx.fillStyle = '#0b0b0c';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(560, 0); ctx.lineTo(700, vpY - 40); ctx.lineTo(0, VH); ctx.fill();
  ctx.beginPath(); ctx.moveTo(VW, 0); ctx.lineTo(1080, 0); ctx.lineTo(950, vpY - 40); ctx.lineTo(VW, VH); ctx.fill();
  glow(ctx, vpX, vpY + 40, 420, '#ff6a10', 0.75, 1.3, 0.8);
  glow(ctx, vpX, vpY + 60, 160, '#ffcc70', 0.6, 1.6, 0.5);
  // ribber i veggene
  for (let i = 0; i < 9; i++) {
    const t = i / 9, y = 30 + t * 700;
    ctx.strokeStyle = rgba('#ff7a1a', 0.06 + t * 0.25); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(560 + t * 140 - 400 * (1 - t), y); ctx.lineTo(560 + t * 140, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1080 - t * 130, y); ctx.lineTo(1080 - t * 130 + 400 * (1 - t), y); ctx.stroke();
  }
  // trapp
  for (let i = 0; i < 16; i++) {
    const t = i / 16, y = 900 - t * 330, w = 520 - t * 360, x = vpX - w / 2;
    ctx.fillStyle = mix('#141110', '#2a1208', t); ctx.fillRect(x, y - 22 * (1 - t) - 3, w, 22 * (1 - t) + 3);
    ctx.fillStyle = rgba('#ff8a3a', 0.12 + t * 0.4); ctx.fillRect(x, y - 22 * (1 - t) - 3, w, 2);
  }
  hazard(ctx, vpX - 260, 878, 520, 22, 0.8, 20);
  // rekkverk
  ctx.strokeStyle = '#090909'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(vpX - 280, 840); ctx.lineTo(vpX - 95, 540); ctx.moveTo(vpX + 280, 840); ctx.lineTo(vpX + 95, 540); ctx.stroke();
  ctx.lineWidth = 3; for (let i = 0; i <= 6; i++) { const t = i / 6; ctx.beginPath(); ctx.moveTo(vpX - 280 + 185 * t, 840 - 300 * t); ctx.lineTo(vpX - 280 + 185 * t, 900 - 300 * t); ctx.moveTo(vpX + 280 - 185 * t, 840 - 300 * t); ctx.lineTo(vpX + 280 - 185 * t, 900 - 300 * t); ctx.stroke(); }
  for (let i = 0; i < 7; i++) chain(ctx, 600 + rng() * 420, -10, 200 + rng() * 360, '#070707', rng() * 6);
  // fiendeøyne langt nede
  eyes(ctx, 790, 610, 0.8); eyes(ctx, 860, 625, 0.7); eyes(ctx, 742, 640, 0.9);
  figure(ctx, { x: 815, y: 820, s: 2.7, kind: 'warden', rim: '#ff8a3a', rimA: 0.95, rimDir: 1, fill: '#050506', flip: true, eye: false });
  embers(ctx, rng, 160, 500, 200, 640, 650, '#ff9a40');
  smoke(ctx, rng, 400, 450, 800, 300, '#1a0a05', 0.35, 20);
  grade(ctx, '#1a0a04', 0.3, '#ff7a30', 0.05); vignette(ctx, 0.95);
}

// 6. Støperikjernen. Massiv glødende kjerne, Heavy og Grenadier flankerer, Warden i forgrunnen.
function foundryCore(ctx) {
  const rng = makeRng(66);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#070505'], [0.6, '#1f0c06'], [1, '#0a0605']]);
  glow(ctx, 800, 430, 760, '#ff5a10', 0.35, 1.2, 0.9);
  // bakvegg-struktur
  for (let x = 0; x < VW; x += 200) { ctx.fillStyle = '#0d0a09'; ctx.fillRect(x, 0, 36, 700); ctx.fillStyle = 'rgba(255,120,40,0.08)'; ctx.fillRect(x + 34, 0, 3, 700); }
  ctx.fillStyle = '#0b0908'; ctx.fillRect(0, 90, VW, 26); hazard(ctx, 0, 116, VW, 10, 0.45, 18);
  for (let i = 0; i < 10; i++) chain(ctx, 80 + i * 160 + rng() * 60, 120, 120 + rng() * 260, '#060505', rng() * 8);
  // kjernen
  const cx = 800, top = 150, bot = 700, w = 330;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, '#0d0807'); g.addColorStop(0.3, '#2a1610'); g.addColorStop(0.55, '#3a2216'); g.addColorStop(1, '#0a0605');
  ctx.fillStyle = g; ctx.fillRect(cx - w / 2, top, w, bot - top);
  ctx.beginPath(); ctx.ellipse(cx, top, w / 2, 30, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#0c0808'; ctx.fillRect(cx - w / 2 - 40, top + 40, w + 80, 34); ctx.fillRect(cx - w / 2 - 40, bot - 80, w + 80, 40);
  for (const y of [260, 360, 460, 560]) { // glødende sømmer
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    sg.addColorStop(0, 'rgba(255,90,20,0.1)'); sg.addColorStop(0.5, 'rgba(255,190,90,0.95)'); sg.addColorStop(1, 'rgba(255,90,20,0.1)');
    ctx.fillStyle = sg; ctx.fillRect(cx - w / 2, y, w, 7); ctx.restore();
    glow(ctx, cx, y + 3, 200, '#ff7a1a', 0.35, 1.2, 0.25);
  }
  glow(ctx, cx, 400, 120, '#ffe0a0', 0.5, 0.7, 1.4);
  pipe(ctx, cx - w / 2, 300, 120, 140, 18, '#1a1412', '#ff8a3a', 0.3); pipe(ctx, cx + w / 2, 300, 1500, 160, 18, '#1a1412', '#ff8a3a', 0.3);
  pipe(ctx, cx - w / 2, 520, 0, 470, 14, '#1a1412', '#ff8a3a', 0.25); pipe(ctx, cx + w / 2, 520, 1600, 500, 14, '#1a1412', '#ff8a3a', 0.25);
  // gulv med smeltekanal
  vgrad(ctx, 0, 700, VW, 200, [[0, '#1a0e0a'], [1, '#060404']]);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,120,30,0.7)'; ctx.beginPath(); ctx.moveTo(cx - 60, 700); ctx.lineTo(cx + 60, 700); ctx.lineTo(cx + 230, 900); ctx.lineTo(cx - 230, 900); ctx.fill();
  ctx.restore(); glow(ctx, cx, 820, 300, '#ff6a10', 0.5, 1, 0.5);
  hazard(ctx, 0, 700, VW, 8, 0.5, 16);
  // fiender
  figure(ctx, { x: 360, y: 720, s: 3.0, kind: 'heavy', rim: '#ff8a3a', rimA: 0.8, rimDir: 1, fill: '#070505' });
  figure(ctx, { x: 1250, y: 715, s: 2.6, kind: 'grenadier', rim: '#ff8a3a', rimA: 0.8, rimDir: -1, fill: '#070505', flip: true });
  figure(ctx, { x: 1440, y: 690, s: 1.9, kind: 'grunt', rim: '#ff8a3a', rimA: 0.6, rimDir: -1, fill: '#070505', flip: true });
  figure(ctx, { x: 160, y: 690, s: 1.8, kind: 'flanker', rim: '#ff8a3a', rimA: 0.6, rimDir: 1, fill: '#070505' });
  // Warden i forgrunnen (ryggen mot oss, ser mot kjernen)
  figure(ctx, { x: 900, y: 930, s: 3.4, kind: 'warden', rim: '#ffa050', rimA: 0.9, rimDir: 1, fill: '#040405', eye: false });
  embers(ctx, rng, 260, 0, 60, VW, 760, '#ffa040');
  grade(ctx, '#1a0a04', 0.3, '#ff7a30', 0.05); vignette(ctx, 0.9);
}

// 3b. «Frigivelsen»: Hale, med sekk over hodet og uten våpen, føres ut den fjerne porten mellom to vakter.
//     Warden ser det gjennom gjerdet i forgrunnen.
function haleTaken(ctx) {
  const rng = makeRng(39);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#07090c'], [0.5, '#151a1f'], [0.62, '#101316'], [1, '#050607']]);
  // porten langt borte: hardt arbeidslys som renner ut i regnet
  ctx.fillStyle = '#0b0d0f'; ctx.fillRect(820, 250, 520, 330);
  vgrad(ctx, 900, 300, 360, 280, [[0, '#2a3036'], [1, '#141719']]);
  ctx.fillStyle = '#d8dde0'; ctx.globalAlpha = 0.16; ctx.fillRect(930, 300, 300, 280); ctx.globalAlpha = 1;
  glow(ctx, 1080, 420, 420, '#c8d2da', 0.22, 1.2, 0.6);
  glow(ctx, 1080, 300, 90, '#eef4f8', 0.55, 0.7, 1.4);
  hazard(ctx, 820, 236, 520, 16, 0.6, 18);
  glow(ctx, 836, 244, 26, PAL.grunt, 0.8); glow(ctx, 1324, 244, 26, PAL.grunt, 0.8);
  containerWall(ctx, rng, 590, 2, 60, 0.7, 0.12);
  fog(ctx, 470, 140, '#5a646e', 0.22);
  wetFloor(ctx, rng, 590, '#16191c', '#060708');
  reflection(ctx, 1080, 600, 280, '#c8d2da', 0.16, 70);
  // Hale mellom to vakter, på vei inn i lyset (ryggene mot oss)
  const fy = 610, fs = 2.3;
  figure(ctx, { x: 985, y: fy, s: fs, kind: 'grunt', rim: '#c8d2da', rimA: 0.75, rimDir: 1, fill: '#060708', eye: false });
  figure(ctx, { x: 1175, y: fy + 4, s: fs, kind: 'grunt', rim: '#c8d2da', rimA: 0.75, rimDir: -1, fill: '#060708', eye: false, flip: true });
  figure(ctx, { x: 1078, y: fy + 2, s: fs * 0.98, kind: 'warden', unarmed: true, hood: true, rim: '#c8d2da', rimA: 0.8, rimDir: 1, fill: '#0a0c0e', eyeA: 0.6 });
  // kjetting mellom hendene og vakta
  ctx.strokeStyle = 'rgba(150,160,168,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(1096, fy - 118); ctx.quadraticCurveTo(1120, fy - 100, 1150, fy - 128); ctx.stroke();
  // gjerdet i forgrunnen
  ctx.save(); ctx.strokeStyle = 'rgba(14,16,18,0.9)'; ctx.lineWidth = 2;
  for (let x = -400; x < VW + 400; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 400, VH); ctx.moveTo(x + 400, 0); ctx.lineTo(x, VH); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(160,175,188,0.08)'; ctx.lineWidth = 1;
  for (let x = -400; x < VW + 400; x += 46) { ctx.beginPath(); ctx.moveTo(x + 1, 0); ctx.lineTo(x + 401, VH); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#060708'; ctx.fillRect(250, 0, 22, VH); ctx.fillRect(0, 96, VW, 10);
  // Warden i forgrunnen til venstre, hånd mot gjerdet, ser etter dem
  glow(ctx, 430, 760, 260, '#2a3a48', 0.25);
  figure(ctx, { x: 420, y: 980, s: 4.6, kind: 'warden', rim: '#a9c0d2', rimA: 0.42, rimDir: 1, fill: '#050607', eyeA: 0.8 });
  for (let i = 0; i < 70; i++) { const x = rng() * VW, y = rng() * VH; ctx.fillStyle = `rgba(190,205,215,${0.08 + rng() * 0.18})`; ctx.fillRect(x, y, 1.5, 2.5); } // dråper på gjerdet
  rain(ctx, rng, 360, 0.09, 28);
  grade(ctx, '#0a1218', 0.32, '#9fb0bd', 0.03); vignette(ctx, 0.92);
}

// 6b. Avsløringen: blant fiendene ved kjernen står Hale – skjerf, blå stripe, men rødt visir.
function haleReveal(ctx) {
  const rng = makeRng(68);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#060404'], [0.55, '#1c0b06'], [1, '#080504']]);
  glow(ctx, 800, 380, 700, '#ff5a10', 0.3, 1.2, 0.8);
  for (let x = 60; x < VW; x += 220) { ctx.fillStyle = '#0c0908'; ctx.fillRect(x, 0, 40, 620); }
  for (let i = 0; i < 8; i++) chain(ctx, 100 + i * 200 + rng() * 60, 0, 140 + rng() * 240, '#050404', rng() * 8);
  smoke(ctx, rng, 0, 260, VW, 300, '#170806', 0.45, 26);
  vgrad(ctx, 0, 640, VW, 260, [[0, '#170c08'], [1, '#050303']]);
  // bakre rekke: fiender, røde øyne
  for (const [x, y, s, k, f] of [[210, 650, 1.7, 'grunt', false], [420, 640, 1.6, 'flanker', false], [1180, 640, 1.6, 'grunt', true], [1400, 655, 1.8, 'heavy', true], [620, 630, 1.4, 'grunt', false], [990, 632, 1.4, 'grunt', true]]) {
    figure(ctx, { x, y, s, kind: k, rim: '#ff8a3a', rimA: 0.55, rimDir: f ? -1 : 1, fill: '#060404', flip: f });
  }
  // fremre rekke: Hale i midten, flankert av to grunts
  figure(ctx, { x: 470, y: 820, s: 3.2, kind: 'grunt', rim: '#ff8a3a', rimA: 0.7, rimDir: 1, fill: '#060404' });
  figure(ctx, { x: 1150, y: 825, s: 3.2, kind: 'grunt', rim: '#ff8a3a', rimA: 0.7, rimDir: -1, fill: '#060404', flip: true });
  glow(ctx, 800, 560, 300, '#3a0a08', 0.4);
  figure(ctx, { x: 800, y: 880, s: 4.6, kind: 'warden', visor: '#ff3a24', rim: '#a9c0d2', rimA: 0.75, rimDir: 1, fill: '#07080a', flip: true });
  glow(ctx, 770, 430, 140, '#ff2a1a', 0.18, 1, 0.6);
  embers(ctx, rng, 200, 0, 80, VW, 760, '#ffa040');
  grade(ctx, '#1a0a04', 0.3, '#ff6a30', 0.05); vignette(ctx, 0.92);
}

// 7. Daggry. Kontrollrommet er falt; troppen går fri mot toget. Warden støtter Hale ut, Hales visir er mørkt.
function dawnYard(ctx) {
  const rng = makeRng(77);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#1a2128'], [0.42, '#56606a'], [0.55, '#3a3f45'], [1, '#0e1012']]);
  glow(ctx, 1150, 470, 520, '#c9b7a0', 0.12, 1.6, 0.4);
  crane(ctx, 300, 520, 300, '#262c32'); crane(ctx, 1240, 520, 260, '#2a3036');
  fog(ctx, 380, 220, '#8a96a0', 0.35);
  // toget langt borte
  ctx.fillStyle = '#1e2328'; ctx.fillRect(820, 492, 640, 26);
  for (let x = 840; x < 1450; x += 22) glow(ctx, x, 503, 9, PAL.light, 0.55);
  glow(ctx, 1460, 503, 60, '#fff2d8', 0.6, 1.5, 0.5);
  fog(ctx, 450, 120, '#9aa4ad', 0.35);
  containerWall(ctx, rng, 600, 2, 62, 0.55, 0.05);
  smoke(ctx, rng, 0, 420, VW, 220, '#7d8790', 0.12, 20);
  wetFloor(ctx, rng, 600, '#2a2f34', '#0c0e10');
  glow(ctx, 1150, 650, 420, '#c9b7a0', 0.08, 1, 0.2);
  // kontrollrommet brenner ut på kranbommen; portene står åpne
  ctx.fillStyle = '#121518'; ctx.fillRect(608, 380, 16, 220); ctx.fillRect(668, 380, 16, 220);   // tårnbein
  ctx.beginPath(); ctx.moveTo(560, 384); ctx.lineTo(730, 384); ctx.lineTo(716, 322); ctx.lineTo(574, 322); ctx.fill(); // kontrollrommet
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i === 2 ? '#2a1a12' : '#3a2416'; ctx.fillRect(584 + i * 34, 336, 26, 22); }  // knuste vinduer
  glow(ctx, 640, 348, 90, '#ff7a30', 0.45, 1, 0.8); glow(ctx, 690, 345, 30, '#ffb070', 0.5);
  smoke(ctx, rng, 540, 120, 240, 220, '#2e3338', 0.5, 16);
  // troppen går foran, fri, mot toget
  for (const [x, y, s, f] of [[790, 642, 1.3, false], [880, 638, 1.25, true]]) {   // Okafor og Brandt
    figure(ctx, { x, y, s, kind: 'warden', unarmed: true, rim: '#c9d2da', rimA: 0.35, rimDir: 1, fill: '#1a1e22', eyeA: 0.5, flip: f });
  }
  // Warden støtter Hale (visiret mørkt, armen over Wardens skulder)
  const wx = 1120, wy = 850, ws = 3.5;
  ctx.save(); ctx.translate(wx + 70, wy); ctx.rotate(0.1);
  figure(ctx, { x: 0, y: 0, s: ws * 0.97, kind: 'warden', unarmed: true, visorDead: true, rim: '#c9d2da', rimA: 0.55, rimDir: 1, fill: '#0c0e11', eyeA: 0 });
  ctx.restore();
  figure(ctx, { x: wx, y: wy, s: ws, kind: 'warden', rim: '#c9d2da', rimA: 0.5, rimDir: 1, fill: '#0b0d10', eyeA: 0.4 });
  // Hales arm over Wardens skuldre
  ctx.strokeStyle = '#0c0e11'; ctx.lineCap = 'round'; ctx.lineWidth = 9 * ws / 3.5 * 2.2;
  ctx.beginPath(); ctx.moveTo(wx + 70 + 6 * ws, wy - 88 * ws); ctx.quadraticCurveTo(wx + 20 * ws, wy - 96 * ws, wx - 18 * ws, wy - 86 * ws); ctx.stroke();
  ctx.strokeStyle = 'rgba(201,210,218,0.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + 70 + 6 * ws, wy - 92 * ws); ctx.quadraticCurveTo(wx + 20 * ws, wy - 101 * ws, wx - 18 * ws, wy - 91 * ws); ctx.stroke();
  smoke(ctx, rng, 0, 760, VW, 160, '#4a525a', 0.18, 14);
  rain(ctx, rng, 160, 0.06, 22);
  grade(ctx, '#18222c', 0.35, '#c9b7a0', 0.03); vignette(ctx, 0.8);
}

// 8. Linjen brast. Warden ligger; fiender i mot­lys over ham.
function fallen(ctx) {
  const rng = makeRng(88);
  vgrad(ctx, 0, 0, VW, VH, [[0, '#0a0405'], [0.55, '#1c0807'], [1, '#050203']]);
  glow(ctx, 800, 300, 600, '#c0392b', 0.25, 1.4, 0.7);
  lampPost(ctx, 1260, 690, 420, '#ff5030', 0.18, 160);
  smoke(ctx, rng, 0, 150, VW, 400, '#1a0606', 0.5, 30);
  wetFloor(ctx, rng, 660, '#140808', '#040202');
  reflection(ctx, 1281, 700, 200, '#ff5030', 0.2, 16);
  for (const [x, y, sc, k, f] of [[330, 690, 2.4, 'grunt', false], [1230, 680, 2.6, 'flanker', true], [560, 720, 3.3, 'grunt', false], [960, 730, 3.9, 'heavy', true]]) {
    figure(ctx, { x, y, s: sc, kind: k, rim: '#ff5a3a', rimA: 0.6, rimDir: f ? 1 : -1, fill: '#050203', flip: f });
  }
  // Wardens hjelm i forgrunnen, på siden i sølen, visiret flimrer svakt
  ctx.save(); ctx.translate(820, 800); ctx.rotate(-0.35); ctx.scale(1.15, 1.15);
  const hp = new Path2D(); hp.moveTo(-120, 40); hp.lineTo(-130, -40); hp.lineTo(-70, -100); hp.lineTo(40, -105); hp.lineTo(110, -70); hp.lineTo(135, -20); hp.lineTo(120, 40); hp.closePath();
  const hg = ctx.createLinearGradient(0, -105, 0, 40); hg.addColorStop(0, '#3a2a2a'); hg.addColorStop(0.3, '#16171a'); hg.addColorStop(1, '#060607');
  ctx.fillStyle = hg; ctx.fill(hp); ctx.strokeStyle = 'rgba(255,90,58,0.45)'; ctx.lineWidth = 3; ctx.stroke(hp);
  ctx.fillStyle = '#04161f'; ctx.beginPath(); ctx.moveTo(20, -60); ctx.lineTo(128, -40); ctx.lineTo(130, -14); ctx.lineTo(24, -30); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(PAL.visor, 0.35); ctx.beginPath(); ctx.moveTo(30, -55); ctx.lineTo(80, -46); ctx.lineTo(82, -32); ctx.lineTo(32, -38); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, -52); ctx.lineTo(75, -40); ctx.lineTo(70, -30); ctx.moveTo(75, -40); ctx.lineTo(95, -42); ctx.stroke(); // sprekk
  ctx.restore();
  glow(ctx, 880, 768, 80, PAL.visor, 0.22, 1.3, 0.6);
  reflection(ctx, 890, 820, 70, PAL.visor, 0.15, 40);
  embers(ctx, rng, 60, 0, 300, VW, 500, '#ff6040');
  rain(ctx, rng, 400, 0.1, 30, -0.1, '#c08080');
  grade(ctx, '#200606', 0.35, '#ff3020', 0.05); vignette(ctx, 0.95);
}

export const SCENES = { yardGate, wardenVisor, yardAftermath, haleTaken, refineryBurning, foundryDescent, foundryCore, haleReveal, dawnYard, fallen, ...ART2_SCENES };

const cache = new Map();
// løft av mellomtoner per scene (skjerm-blending av bildet med seg selv – svart forblir svart)
const LIFT = { yardGate: 0.45, wardenVisor: 0.12, yardAftermath: 0.55, haleTaken: 0.4, refineryBurning: 0.25, foundryDescent: 0.35, foundryCore: 0.25, haleReveal: 0.3, dawnYard: 0.1, fallen: 0.35, ...ART2_LIFT };
/** Returnerer et ferdig tegnet 1600×900-lerret (bufret). */
// Wardens kantlys: kaldt stål – miljøets ravlys skal aldri farge ham (KARAKTER-SPEC).
const WARDEN_RIM = '#a9c0d2';

// Per-scene justering av malebehandlingen (skittfarge og mengde).
const PAINT = {
  yardGate: { warm: [30, 30, 32], grime: 0.5 },
  wardenVisor: { warm: [26, 28, 32], grime: 0.45, keep: 0.26 },
  yardAftermath: { warm: [44, 30, 18], grime: 0.6 },
  haleTaken: { warm: [28, 30, 34], grime: 0.55 },
  refineryBurning: { warm: [48, 28, 14], grime: 0.6 },
  foundryDescent: { warm: [44, 26, 14], grime: 0.55 },
  foundryCore: { warm: [46, 26, 12], grime: 0.55 },
  haleReveal: { warm: [46, 24, 12], grime: 0.55 },
  dawnYard: { warm: [36, 36, 38], grime: 0.5 },
  fallen: { warm: [40, 14, 12], grime: 0.6 },
  ...ART2_PAINT,
};

export function renderScene(id) {
  if (cache.has(id)) return cache.get(id);
  const c = document.createElement('canvas'); c.width = VW; c.height = VH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  const fn = SCENES[id];
  if (fn) { fn(ctx); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = LIFT[id] ?? 0.3; ctx.drawImage(c, 0, 0); ctx.restore(); } else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, VW, VH); console.warn(`[story] ukjent scene '${id}'`); }
  let out = c;
  if (fn) { try { out = paint(c, { seed: [...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0, ...(PAINT[id] || {}) }); } catch (err) { console.info('[story] maling feilet', err); } }
  const ov = ART2_OVERLAYS[id];   // skarp grafikk (kringkasting) etter malingen
  if (fn && ov) { const o2 = out.getContext ? out : null; if (o2) { const x = o2.getContext('2d'); x.save(); ov(x); x.restore(); } }
  cache.set(id, out); return out;
}
export function clearSceneCache() { cache.clear(); }
