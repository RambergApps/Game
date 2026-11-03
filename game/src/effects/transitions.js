// BREACH – Effekter: overgangsobjekter og drivstofftank for brett 2 (eies av Breach Effekter, 27.10).
// Erstatter Storys plassholder drawObject i levels/brett2.js med SAMME kallform:
//   drawTransitionObject(ctx, kind, x, y, w, h, z, used, lamp, opts?)   (alias: drawObject)
//     ctx i skjermkoordinater; x,y,w,h = skjermrektangelet til fotavtrykket (block), z = camera.zoom.
//     kind: 'pry' (rund trykkdør) | 'ladder' (opts.dir 'up' | 'down' → luke) | 'crawl' (sprukket rør) | 'valve' (ventil + sluse) | 'wall'.
//     used = overgangen er tatt (døra står åpen). lamp = Storys lampefarge; blå 57,198,255 tolkes som «opplåst».
//     opts (valgfritt): { state: 'locked'|'open'|'used', t: world.time, open: 0..1 (åpningsgrad, f.eks. under sekvensen), dir }
//   drawTankDamage(ctx, world, camera)  – skadetrinn på FUEL 01 fra world._brett2.tank.hp (1 → 0). Skjermkoordinater inn.
//   warmTransitionSprites(TRANSITIONS?, tankRect?)  – bak alt (kalles fra warmup / lasteskjerm).  transitionWarmJobs() – samme som liste av små jobber.
// Ingen shadowBlur/filter. Alt med støy/gradient bakes ÉN gang per (kind, størrelse, tilstand) i verdens-px × RES.
// Perspektiv: PROJ (55° standard; ?view=34 = legacy). Fronter mot sør løftes PROJ.screenZ per z-px, bakken forkortes groundScaleY.
import { PROJ } from '../shared/projection.js';
import { makeCanvas, mulberry, fbm, glow, hotCore, puff, streak } from './sprites.js';

const TAU = Math.PI * 2, RES = 3, PAD = 14;
const G = PROJ.groundScaleY, SZ = PROJ.screenZ;
import * as V10 from './v10.js';
export { transitionParts, transitionFloor } from './v10.js';
const cache = new Map();
const memo = (k, f) => { let c = cache.get(k); if (!c) { c = f(); cache.set(k, c); } return c; };
const HGT = { pry: 72, ladderup: 104, ladderdown: 34, crawl: 72, valve: 72, wall: 72 };
const WARM = [255, 150, 62], FLARE = [255, 112, 34];

// ---------------------------------------------------------------- malerverktøy (kun ved bygging)
function lin(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; }
function ell(x, cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
function rivets(x, pts, r = 1.1) { for (const [px, py] of pts) { x.fillStyle = 'rgba(12,11,10,.7)'; ell(x, px + 0.4, py + 0.5, r, r * 0.9); x.fill(); x.fillStyle = 'rgba(176,166,150,.85)'; ell(x, px - 0.2, py - 0.2, r * 0.7, r * 0.6); x.fill(); } }
function hazard(x, x0, y0, w, h, s = 5) {
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip(); x.fillStyle = '#b08a26'; x.fillRect(x0, y0, w, h); x.fillStyle = '#1a1714';
  for (let k = -h; k < w + h; k += s * 2) { x.beginPath(); x.moveTo(x0 + k, y0 + h); x.lineTo(x0 + k + s, y0 + h); x.lineTo(x0 + k + s + h, y0); x.lineTo(x0 + k + h, y0); x.fill(); }
  x.restore();
}
/** Slitasje: lys/mørk fbm, rust i flekker, renner nedover på fronter (y > frontY), sotkant ved bakken. Pikselpass på hele lerretet. */
function weather(c, seed, frontY, groundY, rust = 1) {
  const x = c.getContext('2d'), W = c.width, H = c.height, id = x.getImageData(0, 0, W, H), d = id.data;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = (py * W + px) * 4; if (d[i + 3] < 8) continue;
    const u = px / RES, v = py / RES, n = fbm(u / 7, v / 7, seed, 4), r = fbm(u / 4, v / 4, seed + 9, 3);
    let k = 0.8 + 0.42 * n;
    const front = v > frontY, streakN = front ? fbm(u / 1.6, v / 22, seed + 3, 3) : 0;
    let ru = Math.max(0, (r - 0.68) * 2.6) * rust + (front ? Math.max(0, streakN - 0.62) * 2.2 * rust : 0);
    if (front && groundY) k *= 0.7 + 0.3 * Math.min(1, (groundY - v) / 10);                 // sot / skitt mot bakken
    ru = Math.min(0.85, ru);
    d[i] = Math.min(255, (d[i] * (1 - ru) + 104 * ru) * k); d[i + 1] = Math.min(255, (d[i + 1] * (1 - ru) + 52 * ru) * k); d[i + 2] = Math.min(255, (d[i + 2] * (1 - ru) + 26 * ru) * k);
  }
  x.putImageData(id, 0, 0);
}
/** Kassekropp: topp (lyst, slitt stål/betong) + sørfront. Returnerer geometri. */
function plug(x, W, F, E, top = '#4b4e50', side = '#33363a') {
  x.fillStyle = lin(x, 0, 0, W, F, [[0, top], [1, '#2f3133']]); x.fillRect(0, 0, W, F);
  x.fillStyle = lin(x, 0, F, 0, F + E, [[0, side], [1, '#1d1f21']]); x.fillRect(0, F, W, E);
  x.fillStyle = 'rgba(210,200,184,.22)'; x.fillRect(0, F - 1, W, 1.2);                           // lys kant der topp møter front
  x.strokeStyle = 'rgba(8,8,9,.9)'; x.lineWidth = 1.4; x.strokeRect(0.5, 0.5, W - 1, F + E - 1);
  hazard(x, 1.5, F - 5, W - 3, 3.2, 3);
}

// ---------------------------------------------------------------- objektene (lerretets enheter: verdens-px, skjermvertikal ved zoom 1)
// Felles: (0,0) = toppflatens øvre venstre hjørne; front fra y=F til F+E; bakkelinja (sørkant) y=F+E.
function paintDoor(x, W, F, E, open) {
  plug(x, W, F, E, '#55504a', '#3b3631');
  const cx = W / 2, cy = F + E * 0.52, r = Math.min(W * 0.4, E * 0.5 / SZ), rx = r, ry = r * SZ;    // vertikal skive mot sør → ellipse ry = r·SZ
  // karm: tykk stålring med bolter
  x.fillStyle = lin(x, cx - rx, cy - ry, cx + rx, cy + ry, [[0, '#8b8378'], [0.5, '#4f4a44'], [1, '#26231f']]); ell(x, cx, cy, rx * 1.16, ry * 1.16); x.fill();
  x.strokeStyle = 'rgba(6,6,6,.9)'; x.lineWidth = 1.2; ell(x, cx, cy, rx * 1.16, ry * 1.16); x.stroke();
  const bolts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; bolts.push([cx + Math.cos(a) * rx * 1.07, cy + Math.sin(a) * ry * 1.07]); } rivets(x, bolts, 1.2);
  // åpning (mørk) – synlig når døra er (delvis) åpen
  const g = x.createRadialGradient(cx, cy + ry * 0.3, 1, cx, cy, rx); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#0b0907'); g.addColorStop(1, '#2a2119');
  x.fillStyle = g; ell(x, cx, cy, rx * 0.96, ry * 0.96); x.fill();
  if (open > 0) { x.fillStyle = `rgba(255,140,60,${0.10 * open})`; ell(x, cx, cy + ry * 0.55, rx * 0.7, ry * 0.25); x.fill(); }  // svakt varmt lys innenfra
  // døra: skiven svinger på hengsel til venstre → bredde krymper med cos
  const sw = Math.cos(open * Math.PI * 0.5 * 0.92), dcx = cx - rx * 0.96 + rx * 0.96 * sw, drx = Math.max(1.5, rx * 0.95 * sw);
  if (open > 0.02) { x.fillStyle = '#1c1916'; x.fillRect(cx - rx * 1.2 - 2, cy - ry * 0.75, 4, ry * 1.5); }          // hengselblokk
  x.fillStyle = lin(x, dcx - drx, cy - ry, dcx + drx, cy + ry, [[0, '#6e6458'], [0.45, '#4a433c'], [1, '#24201c']]); ell(x, dcx, cy, drx, ry * 0.95); x.fill();
  x.strokeStyle = 'rgba(6,6,6,.95)'; x.lineWidth = 1.1; ell(x, dcx, cy, drx, ry * 0.95); x.stroke();
  if (sw > 0.25) {
    x.strokeStyle = 'rgba(20,18,16,.8)'; x.lineWidth = 1.6; ell(x, dcx, cy, drx * 0.7, ry * 0.66); x.stroke();                   // pakningsspor
    x.strokeStyle = 'rgba(190,176,150,.25)'; x.lineWidth = 0.8; x.beginPath(); x.ellipse(dcx, cy, drx * 0.72, ry * 0.68, 0, Math.PI * 1.05, Math.PI * 1.6); x.stroke();
    // låsehjul (rattet) i midten + skåte
    const hr = r * 0.32 * sw; x.strokeStyle = '#2a2622'; x.lineWidth = 2.4; ell(x, dcx, cy, hr, hr * SZ); x.stroke();
    x.strokeStyle = '#8f8476'; x.lineWidth = 1.2; ell(x, dcx - 0.3, cy - 0.3, hr, hr * SZ); x.stroke();
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + 0.3; x.beginPath(); x.moveTo(dcx - Math.cos(a) * hr, cy - Math.sin(a) * hr * SZ); x.lineTo(dcx + Math.cos(a) * hr, cy + Math.sin(a) * hr * SZ); x.stroke(); }
    x.fillStyle = '#7a6040'; ell(x, dcx, cy, hr * 0.28, hr * 0.24); x.fill();
    x.fillStyle = 'rgba(150,40,20,.55)'; x.fillRect(dcx - drx * 0.5, cy + ry * 0.62, drx, 2.2);                                     // falmet malt felt
  }
  // toppen: rørstuss og kabelbakke
  x.fillStyle = '#26282a'; x.fillRect(W * 0.12, F * 0.25, W * 0.76, 3); rivets(x, [[W * 0.15, F * 0.6], [W * 0.85, F * 0.6], [W * 0.15, F * 0.15], [W * 0.85, F * 0.15]]);
}
function paintLadderUp(x, W, F, E, open) {
  plug(x, W, F, E, '#4a4d4f', '#2f3236');
  // bærebjelker og en betongsokkel nederst
  x.fillStyle = '#4a4744'; x.fillRect(0, F + E - 9, W, 9); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, F + E - 9, W, 1.2);
  for (const bx of [3, W - 7]) { x.fillStyle = lin(x, bx, 0, bx + 4, 0, [[0, '#55595c'], [1, '#232527']]); x.fillRect(bx, F, 4, E - 9); }
  // stige: to vanger + trinn, lyst slitt stål, mørk skygge til høyre (lys fra venstre/oppe)
  const l = W * 0.32, rr = W * 0.68, y0 = F + 3, y1 = F + E - 2;
  for (const sx of [l, rr]) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(sx + 1.4, y0, 1.6, y1 - y0); x.fillStyle = '#b3aa9a'; x.fillRect(sx - 1, y0, 2.2, y1 - y0); }
  for (let q = y0 + 5; q < y1 - 2; q += 7) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(l, q + 1.3, rr - l, 1.2); x.fillStyle = '#a39a8a'; x.fillRect(l, q, rr - l, 1.5); }
  // sikkerhetsbur (bøyler)
  x.strokeStyle = 'rgba(150,142,128,.8)'; x.lineWidth = 1.1;
  for (let q = y0 + 14; q < y1 - 16; q += 14) { x.beginPath(); x.ellipse(W / 2, q, (rr - l) / 2 + 5, 4, 0, 0, Math.PI); x.stroke(); }
  for (const sx of [l - 5, W / 2, rr + 5]) { x.beginPath(); x.moveTo(sx, y0 + 14); x.lineTo(sx, y1 - 16 + (sx === W / 2 ? 4 : 0)); x.stroke(); }
  // toppluke på taket
  const hx = W / 2, hy = F * 0.5, hr = Math.min(W * 0.26, F * 0.42 / G);
  x.fillStyle = '#1e1f20'; ell(x, hx, hy, hr * 1.15, hr * G * 1.15); x.fill();
  if (open > 0.5) { x.fillStyle = '#050505'; ell(x, hx, hy, hr, hr * G); x.fill(); x.fillStyle = lin(x, hx - hr, 0, hx + hr, 0, [[0, '#5d584f'], [1, '#2a2723']]); ell(x, hx, hy - hr * G - hr * SZ * 0.9, hr, hr * SZ * 0.9); x.fill(); }
  else { x.fillStyle = lin(x, hx - hr, hy - hr, hx + hr, hy + hr, [[0, '#6a655c'], [1, '#2c2925']]); ell(x, hx, hy, hr, hr * G); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 0.8; ell(x, hx, hy, hr * 0.6, hr * G * 0.6); x.stroke(); }
  // rekkverk på taket
  x.strokeStyle = '#a08a3a'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(1, 1.5); x.lineTo(W - 1, 1.5); x.stroke();
}
function paintHatch(x, W, F, E, open) {
  // INGEN kasse: alt ligger i bakkeplanet (y fra E til E+F), lokket reiser seg når det åpnes. E = rom for lokket over bakken.
  const g0 = E, cx = W / 2, cy = g0 + F * 0.5, r = Math.min(W * 0.36, F * 0.38 / G), rx = r, ry = r * G;
  x.fillStyle = 'rgba(10,9,8,.45)'; ell(x, cx + 2, cy + 2, rx * 1.55, ry * 1.55); x.fill();                    // skitten flekk/olje
  x.fillStyle = lin(x, cx - rx, cy - ry, cx + rx, cy + ry, [[0, '#5a5650'], [1, '#2c2a27']]); x.fillRect(cx - rx * 1.38, cy - ry * 1.38, rx * 2.76, ry * 2.76);   // gulvplate
  x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 1; x.strokeRect(cx - rx * 1.38, cy - ry * 1.38, rx * 2.76, ry * 2.76);
  x.strokeStyle = 'rgba(200,190,170,.16)'; x.lineWidth = 0.7; for (let k = -6; k <= 6; k++) { x.beginPath(); x.moveTo(cx - rx * 1.3, cy + k * ry * 0.2); x.lineTo(cx - rx * 1.1, cy + k * ry * 0.2 + 1); x.stroke(); }
  hazard(x, cx - rx * 1.38, cy + ry * 1.38 - 3.2, rx * 2.76, 3.2, 3); hazard(x, cx - rx * 1.38, cy - ry * 1.38, rx * 2.76, 3.2, 3);
  x.fillStyle = '#1a1918'; ell(x, cx, cy, rx * 1.12, ry * 1.12); x.fill();
  rivets(x, Array.from({ length: 10 }, (_, i) => [cx + Math.cos(i / 10 * TAU) * rx * 1.05, cy + Math.sin(i / 10 * TAU) * ry * 1.05]), 0.9);
  if (open > 0.02) {
    // sjakt: svart, med stigetrinn som forsvinner nedover
    const sg = x.createRadialGradient(cx, cy - ry * 0.4, 1, cx, cy, rx); sg.addColorStop(0, '#000'); sg.addColorStop(1, '#17130f');
    x.fillStyle = sg; ell(x, cx, cy, rx, ry); x.fill();
    x.save(); ell(x, cx, cy, rx, ry); x.clip();
    for (let k = 0; k < 5; k++) { x.fillStyle = `rgba(160,150,132,${0.55 - k * 0.1})`; x.fillRect(cx - rx * 0.35, cy - ry * 0.55 + k * ry * 0.32, rx * 0.7, 1.2); }
    x.fillStyle = 'rgba(132,214,168,.10)'; ell(x, cx, cy + ry * 0.4, rx * 0.6, ry * 0.3); x.fill(); x.restore();        // kvikksølvgrønt skjær nedenfra
    // lokket reiser seg på hengsel i nordkant: høyde = sin(vinkel)
    const a = open * Math.PI * 0.5 * 0.95, lh = Math.sin(a) * r * 2 * SZ, ld = Math.cos(a) * ry * 2, ty = cy - ry - lh, by = cy - ry + ld;
    x.fillStyle = lin(x, cx - rx, ty, cx + rx, by, [[0, '#76705f'], [0.5, '#4c473f'], [1, '#2a2621']]);
    x.beginPath(); x.ellipse(cx, (ty + by) / 2, rx * 0.98, Math.max(1, Math.abs(by - ty) / 2), 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 1; x.stroke();
    x.strokeStyle = 'rgba(30,26,22,.8)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, (ty + by) / 2, rx * 0.6, Math.max(0.6, Math.abs(by - ty) * 0.3), 0, 0, TAU); x.stroke();
  } else {
    x.fillStyle = lin(x, cx - rx, cy - ry, cx + rx, cy + ry, [[0, '#7a7364'], [0.5, '#4f4a42'], [1, '#2b2823']]); ell(x, cx, cy, rx, ry); x.fill();
    x.strokeStyle = 'rgba(15,13,11,.85)'; x.lineWidth = 1.2; ell(x, cx, cy, rx * 0.62, ry * 0.62); x.stroke();
    x.strokeStyle = 'rgba(15,13,11,.7)'; x.lineWidth = 1; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(cx - rx * 0.55, cy + k * ry * 0.22); x.lineTo(cx + rx * 0.55, cy + k * ry * 0.22); x.stroke(); }
    x.fillStyle = '#2a2622'; x.fillRect(cx - 4, cy + ry * 0.7, 8, 2.4); x.fillStyle = '#9a8f7c'; x.fillRect(cx - 3.4, cy + ry * 0.7, 6.8, 1);   // håndtak
  }
  // to rekkverksstolper med kjetting foran (sør) – lave, gir skala
  for (const px of [cx - rx * 1.38, cx + rx * 1.38]) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(px + 1, cy + ry * 1.38 - 1, 3, 2); x.fillStyle = '#b8932c'; x.fillRect(px - 1, cy + ry * 1.38 - 20 * SZ, 2.4, 20 * SZ); }
  x.strokeStyle = '#3a3630'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - rx * 1.38, cy + ry * 1.38 - 18 * SZ); x.quadraticCurveTo(cx, cy + ry * 1.38 - 9 * SZ, cx + rx * 1.38, cy + ry * 1.38 - 18 * SZ); x.stroke();
}
function paintPipe(x, W, F, E, open, R) {
  // et tykt rør som går nord–sør: toppen = rørets rygg (sylinderskygge), fronten = rørenden mot sør, revnet opp
  const cx = W / 2, r = Math.min(W * 0.46, E * 0.5 / SZ), top = F + E - r * 2 * SZ;
  x.fillStyle = lin(x, cx - r, 0, cx + r, 0, [[0, '#3a3f43'], [0.25, '#6f757a'], [0.45, '#50565b'], [0.85, '#24282b'], [1, '#16181a']]);
  x.fillRect(cx - r, 0, r * 2, top + r * SZ);
  for (let q = 10; q < top; q += 26) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(cx - r, q, r * 2, 2); x.fillStyle = 'rgba(200,196,186,.14)'; x.fillRect(cx - r, q + 2, r * 2, 0.8); }   // flensringer
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(cx - r - 3, 0, 3, top + r * SZ); x.fillRect(cx + r, 0, 3, top + r * SZ);
  const ey = top + r * SZ, rx = r, ry = r * SZ;
  // flens rundt enden
  x.fillStyle = lin(x, cx - rx, ey - ry, cx + rx, ey + ry, [[0, '#5e5d58'], [1, '#1f1e1c']]); ell(x, cx, ey, rx * 1.08, ry * 1.08); x.fill(); x.strokeStyle = 'rgba(5,5,5,.9)'; x.lineWidth = 1.1; x.stroke();
  // takket, sprukket åpning
  const pts = []; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, k = 0.8 + (R() - 0.5) * 0.14 - (Math.sin(a) > 0.4 ? 0.06 : 0) + (i === 4 || i === 5 ? 0.12 : 0); pts.push([cx + Math.cos(a) * rx * k, ey + Math.sin(a) * ry * k]); }
  const ig = x.createRadialGradient(cx, ey - ry * 0.2, 1, cx, ey, rx); ig.addColorStop(0, '#000'); ig.addColorStop(0.75, '#090807'); ig.addColorStop(1, '#2b241d');
  x.fillStyle = ig; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(205,190,165,.2)'; x.lineWidth = 0.8; x.beginPath(); for (let i = 14; i < 24; i++) { const p = pts[i]; i === 14 ? x.moveTo(p[0], p[1]) : x.lineTo(p[0], p[1]); } x.stroke();
  // revner ut fra åpningen + avbøyd plateflik
  x.strokeStyle = 'rgba(6,5,4,.95)'; x.lineWidth = 1.3;
  for (const a of [-1.1, -0.4, 2.6, 0.9]) { let px = cx + Math.cos(a) * rx * 0.8, py = ey + Math.sin(a) * ry * 0.8; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += Math.cos(a) * 4 + (R() - 0.5) * 3; py += Math.sin(a) * 3 * SZ + (R() - 0.5) * 2; x.lineTo(px, py); } x.stroke(); }
  x.fillStyle = '#45433e'; x.beginPath(); x.moveTo(cx + rx * 0.5, ey - ry * 0.65); x.lineTo(cx + rx * 1.05, ey - ry * 1.2); x.lineTo(cx + rx * 0.85, ey - ry * 0.3); x.closePath(); x.fill();
  // oljesøl som renner ned under åpningen og på bakken
  x.fillStyle = 'rgba(14,11,8,.75)'; x.beginPath(); x.moveTo(cx - rx * 0.3, ey + ry * 0.7); x.quadraticCurveTo(cx - rx * 0.1, F + E + 4, cx + rx * 0.6, F + E + 5); x.lineTo(cx - rx * 0.6, F + E + 6); x.closePath(); x.fill();
  x.fillStyle = 'rgba(160,150,170,.16)'; x.fillRect(cx - rx * 0.2, F + E + 3, rx * 0.5, 0.8);
  if (open < 0.5) {
    // låst: rustent gitter boltet over hullet
    x.strokeStyle = '#2a2723'; x.lineWidth = 2.4; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(cx + k * rx * 0.24, ey - ry * 0.85); x.lineTo(cx + k * rx * 0.24, ey + ry * 0.85); x.stroke(); }
    x.strokeStyle = '#7d7466'; x.lineWidth = 1; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(cx + k * rx * 0.24 - 0.6, ey - ry * 0.85); x.lineTo(cx + k * rx * 0.24 - 0.6, ey + ry * 0.85); x.stroke(); }
    x.fillStyle = '#3a3631'; x.fillRect(cx - rx * 0.86, ey - 1.6, rx * 1.72, 3.2); rivets(x, [[cx - rx * 0.8, ey], [cx + rx * 0.8, ey]], 1.3);
  } else {
    // gitteret revet løs, ligger på skrå til venstre for enden
    x.save(); x.translate(cx - rx * 1.05, F + E - 3); x.rotate(-0.25); x.strokeStyle = '#2a2723'; x.lineWidth = 1.8;
    for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(k * 3.2, 0); x.lineTo(k * 3.2 - 1, -12); x.stroke(); } x.fillStyle = '#3a3631'; x.fillRect(-1, -6, 18, 2.4); x.restore();
  }
  // støtteklosser under røret
  x.fillStyle = '#3b3936'; x.fillRect(cx - r * 0.9, F + E - 4, 5, 4); x.fillRect(cx + r * 0.9 - 5, F + E - 4, 5, 4);
}
function paintValve(x, W, F, E, open) {
  plug(x, W, F, E, '#4c5054', '#30353a');
  // sluse: føringsskinner + tung gliplate med ribber; åpen → plata heist opp (forsvinner inn i toppen), mørk, våt åpning under
  const gl = 5, gr = W - 5, y0 = F + 2, y1 = F + E - 1, lift = (y1 - y0) * 0.82 * open;
  x.fillStyle = '#060606'; x.fillRect(gl, y0, gr - gl, y1 - y0);
  if (open > 0) { x.fillStyle = 'rgba(132,214,168,.10)'; x.fillRect(gl, y1 - 8, gr - gl, 8); x.fillStyle = 'rgba(160,190,200,.25)'; for (let k = 0; k < 6; k++) x.fillRect(gl + 3 + k * (gr - gl - 6) / 5, y1 - lift + 1, 0.8, lift * (0.3 + (k % 3) * 0.2)); }  // dryppende vann fra plata
  const py0 = y0, py1 = y1 - lift;
  if (py1 - py0 > 1) {
    x.fillStyle = lin(x, gl, 0, gr, 0, [[0, '#5c6266'], [0.3, '#6c7276'], [1, '#2c3033']]); x.fillRect(gl + 1, py0, gr - gl - 2, py1 - py0);
    for (let q = py1 - 3; q > py0 + 2; q -= 7) { x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(gl + 1, q, gr - gl - 2, 1.6); x.fillStyle = 'rgba(215,210,200,.16)'; x.fillRect(gl + 1, q - 1, gr - gl - 2, 0.8); }
    x.fillStyle = 'rgba(20,16,12,.6)'; x.fillRect(gl + 1, py1 - 2.2, gr - gl - 2, 2.2);                                               // slam på underkanten
  }
  for (const sx of [gl - 3, gr - 1]) { x.fillStyle = lin(x, sx, 0, sx + 4, 0, [[0, '#7b7d7c'], [1, '#2a2c2d']]); x.fillRect(sx, F, 4, E); rivets(x, [[sx + 2, F + 8], [sx + 2, F + E * 0.5], [sx + 2, F + E - 6]], 0.9); }
  // (rattet står nå ved siden av slusen: wheelSprite på t.wheel)
  x.fillStyle = '#2c2e30'; x.fillRect(W - 9, F + E * 0.36, 6, 5); rivets(x, [[W - 6, F + E * 0.36 + 2.5]], 0.8);   // akselkobling mot rattet
  // toppen: motor-/girkasse for sluseplata
  x.fillStyle = lin(x, W * 0.2, 0, W * 0.8, 0, [[0, '#5b5f61'], [1, '#2b2e30']]); x.fillRect(W * 0.22, F * 0.18, W * 0.56, F * 0.55);
  x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 1; x.strokeRect(W * 0.22, F * 0.18, W * 0.56, F * 0.55);
  x.fillStyle = 'rgba(176,138,38,.9)'; x.fillRect(W * 0.22, F * 0.18, W * 0.56, 2);
}
function paintWall(x, W, F, E) {
  plug(x, W, F, E, '#45484a', '#2d3033');
  for (let q = F + 8; q < F + E; q += 14) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(1, q, W - 2, 1.4); }
  rivets(x, [[4, F + 5], [W - 4, F + 5], [4, F + E - 5], [W - 4, F + E - 5]]);
}

const PAINT = { pry: paintDoor, ladderup: paintLadderUp, ladderdown: paintHatch, crawl: paintPipe, valve: paintValve, wall: paintWall };
const keyKind = (kind, dir) => (kind === 'ladder' ? (dir === 'down' ? 'ladderdown' : 'ladderup') : PAINT[kind] ? kind : 'wall');

/** Bakt sprite: { img, W, F, E } i lerretsenheter (× RES). Åpningsgrad kvantiseres til 5 trinn. */
function objSprite(kk, W, D, step) {
  W = Math.round(W); D = Math.round(D);
  return memo(`t:${kk}:${W}:${D}:${step}`, () => {
    const F = D * G, E = HGT[kk] * SZ, c = makeCanvas((W + PAD * 2) * RES, (F + E + PAD * 2) * RES), x = c.getContext('2d');
    x.scale(RES, RES); x.translate(PAD, PAD); x.lineCap = 'round';
    const R = mulberry(W * 31 + D * 7 + kk.length * 131);
    // bakkeskygge (myk, mot sørøst) – i bakkeplanet ved fotavtrykket
    PAINT[kk](x, W, kk === 'ladderdown' ? D * G : F, E, step / 4, R);
    x.setTransform(1, 0, 0, 1, 0, 0);
    weather(c, W + D + kk.length * 5, PAD + (kk === 'ladderdown' ? 1e9 : F), PAD + F + E, kk === 'valve' ? 0.6 : 1);
    // rand-glød-maske: sprite-silhuetten mykt utvidet minus selve sprite → varm kontur utenfor
    const rim = makeCanvas(c.width / 2, c.height / 2), rx = rim.getContext('2d');
    rx.drawImage(c, 0, 0, rim.width, rim.height); rx.globalCompositeOperation = 'source-in'; rx.fillStyle = `rgb(${WARM})`; rx.fillRect(0, 0, rim.width, rim.height);
    const big = makeCanvas(rim.width, rim.height), bx = big.getContext('2d');
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.4, -1.4], [1.4, 1.4], [1.4, -1.4], [-1.4, 1.4]]) { bx.globalAlpha = 0.5; bx.drawImage(rim, dx, dy); }
    bx.globalAlpha = 1; bx.globalCompositeOperation = 'destination-out'; bx.drawImage(rim, 0, 0);
    // bakkeskygge (myk, mot sør) under objektet – etter randmasken så glimtet ikke omrisser skyggen
    if (kk !== 'ladderdown') { x.save(); x.globalCompositeOperation = 'destination-over'; x.scale(RES, RES); x.translate(PAD, PAD);
      const sh = x.createLinearGradient(0, E + F, 0, E + F + 10); sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sh; x.fillRect(2, E + F, W + 6, 10); x.restore(); }
    return { img: c, rim: big, W, F, E };
  });
}

/** Samme kallform som Storys drawObject i levels/brett2.js (+ valgfri opts). */
export function drawTransitionObject(ctx, kind, x, y, w, h, z, used, lamp, opts = {}) {
  const g = opts.g || G, kk = keyKind(kind, opts.dir), Ww = w / z, Dw = h / (z * g);
  const state = opts.state || (used ? 'used' : (typeof lamp === 'string' && lamp.indexOf('57,198,255') >= 0) ? 'open' : 'locked');
  const glowOn = opts.glow != null ? opts.glow : state === 'open';
  const open = opts.open != null ? opts.open : state === 'used' ? 1 : 0, step = Math.round(Math.max(0, Math.min(1, open)) * 4);
  const s = objSprite(kk, Ww, Dw, step), t = opts.t != null ? opts.t : performance.now() / 1000;
  const sx = x - PAD * z, sy = y - s.E * z - PAD * z, sw = s.img.width / RES * z, shh = s.img.height / RES * z;
  ctx.save();
  if (glowOn) {                                                       // bakkehalo foran åpningen (additiv, under objektet)
    // halo på bakken mot vest (der Warden kommer fra, facing 0) og langs sørfoten
    const p = 0.5 + 0.5 * Math.sin(t * 2.6), hw = Math.max(w, 64 * z) * 1.5, hh = hw * g;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.2 + 0.12 * p;
    ctx.drawImage(glow(...WARM, 1.2), x - hw * 0.55, y + h * 0.5 - hh / 2, hw, hh);
    ctx.globalAlpha = 0.12 + 0.08 * p; ctx.drawImage(glow(...WARM, 1.2), x + w / 2 - hw * 0.5, y + h - hh * 0.3, hw, hh * 0.6);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  ctx.drawImage(s.img, sx, sy, sw, shh);
  // lampe: rød låst (rolig), varm puls opplåst, av når brukt
  const lx = x + w * (kk === 'ladderdown' ? 0.18 : 0.86), ly = kk === 'ladderdown' ? y + h * 0.2 - 18 * SZ * z : y - s.E * z + 6 * z;
  if (state !== 'used') {
    const p = glowOn ? 0.65 + 0.35 * Math.sin(t * 5.2) : state === 'open' ? 0.8 : 0.55 + 0.08 * Math.sin(t * 1.3), col = state === 'open' ? WARM : [255, 58, 30], r = 9 * z;
    ctx.fillStyle = '#141414'; ctx.fillRect(lx - 2 * z, ly - 1.6 * z, 4 * z, 3.4 * z);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p; ctx.drawImage(hotCore(...col), lx - r / 2, ly - r / 2, r, r);
    ctx.globalAlpha = p * 0.5; ctx.drawImage(glow(...col, 1), lx - r * 1.6, ly - r * 1.6, r * 3.2, r * 3.2);
  } else { ctx.fillStyle = '#2a2b2c'; ctx.fillRect(lx - 1.6 * z, ly - 1.2 * z, 3.2 * z, 2.6 * z); }
  if (glowOn) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.6)); ctx.drawImage(s.rim, sx, sy, sw, shh); }
  ctx.restore();
}

// ---------------------------------------------------------------- rødt ventilratt på egen søyle (står VED SIDEN AV døra/slusen, på t.wheel)
export const WHEEL_COL = { rim: '#6b2c22', hi: 'rgba(146,82,72,.7)', dark: '#3a0d08', spoke: '#6a1c12', hub: '#5a140d' };   // midlertidig dempet rustrød – bytt her
const WH = { post: 40, at: 30, r: 9 };
function wheelSprite(step) {
  return memo(`wheel:${step}:${WHEEL_COL.rim}`, () => {
    const W = 30, H = (WH.post + 8) * SZ + 14, c = makeCanvas(W * RES, H * RES), x = c.getContext('2d'); x.scale(RES, RES); x.lineCap = 'round';
    const bx = W / 2, by = H - 5, hy = by - WH.at * SZ, r = WH.r, C = WHEEL_COL;
    x.fillStyle = 'rgba(0,0,0,.45)'; ell(x, bx + 2, by + 1, 9, 3); x.fill();                                                   // bakkeskygge
    x.fillStyle = '#2c2e30'; x.fillRect(bx - 5, by - 3, 10, 4);                                                               // fotplate
    x.fillStyle = lin(x, bx - 3, 0, bx + 3, 0, [[0, '#5e6264'], [1, '#222527']]); x.fillRect(bx - 2.6, by - WH.post * SZ, 5.2, WH.post * SZ);   // søyle
    x.fillStyle = '#26282a'; x.fillRect(bx - 5, hy - 3.5, 10, 7);                                                             // ventilhus
    x.save(); x.translate(bx, hy); const rot = step / 4 * 2.4;
    x.strokeStyle = C.dark; x.lineWidth = 3.4; ell(x, 0, 0, r, r * SZ); x.stroke();
    x.strokeStyle = C.rim; x.lineWidth = 2.1; ell(x, -0.4, -0.5, r, r * SZ); x.stroke();
    x.strokeStyle = 'rgba(230,170,140,.22)'; x.lineWidth = 0.7; x.beginPath(); x.ellipse(-0.4, -0.8, r, r * SZ, 0, Math.PI * 1.1, Math.PI * 1.55); x.stroke();
    x.strokeStyle = C.spoke; x.lineWidth = 1.6; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + rot; x.beginPath(); x.moveTo(-Math.cos(a) * r, -Math.sin(a) * r * SZ); x.lineTo(Math.cos(a) * r, Math.sin(a) * r * SZ); x.stroke(); }
    x.fillStyle = C.hub; ell(x, 0, 0, 2.6, 2.2); x.fill(); x.fillStyle = '#b9a47e'; ell(x, -0.5, -0.5, 1, 0.8); x.fill(); x.restore();
    x.setTransform(1, 0, 0, 1, 0, 0); weather(c, 51, 0, H - 5, 0.8);
    return { img: c, W, H, bx, by };
  });
}

// ---------------------------------------------------------------- Storys verdenslag-API (bindende 23:38)
// drawObject(ctx, t, s): ctx = verdenskoordinater med camera.apply (x·zoom, y·zoom·g). t = TRANSITIONS-oppføring i ruter
// ({kind, dir, opening|block, wheel}) eller { kind: 'tank', rect }. s = { unlocked, used, inReach, busy, t, hp, hpMax }.
// Varm puls/glød KUN når s.unlocked && !s.inReach && !s.used. Kalles y-sortert fra levels/brett2.js worldObjects.
const TL = 32, openStart = new Map();
const FAKE_CAM = { zoom: 1, g: G, worldToScreen: (wx, wy) => ({ x: wx, y: wy * G }) };
// ---------------------------------------------------------------- v6: overgangene sitter i veggens SIDEFLATE (aldri på veggtoppen)
// Alle brett 2-overganger står i nord–sør-vegger (blokk 2 ruter bred, 3–5 lang) og nås fra vest → sideflaten er vestkanten.
// Sideflaten er et smalt skrått parallellogram tegnet OPPÅ blokkens vestre del (tar ingen korridorbredde):
// venstre kant = veggfoten (loddrett), høyre kant = topp-kanten, hevet K. Objektkunsten (v2-frontflaten) legges inn med samme skjær.
const FACE = { S: 32, K: 18, up: 0 };
export const TRANSITION_TYPES = { pry: 'B', valve: 'B', crawl: 'D', ladderup: 'C', ladderdown: 'E' };
function faceGeo(o) { const X = o.x * TL, yT = o.y * TL * G - FACE.up, yB = (o.y + o.h) * TL * G; return { X, yT, yB, S: FACE.S, K: FACE.K }; }
function facePath(ctx, f, y0, y1) { ctx.beginPath(); ctx.moveTo(f.X, y0); ctx.lineTo(f.X + f.S, y0 - f.K); ctx.lineTo(f.X + f.S, y1 - f.K); ctx.lineTo(f.X, y1); ctx.closePath(); }
function drawFace(ctx, f) {   // selve sideflaten: grått stål, lys fotkant, mørk overkant
  facePath(ctx, f, f.yT + f.K, f.yB); ctx.fillStyle = lin(ctx, f.X, 0, f.X + f.S, 0, [[0, '#4e5256'], [1, '#2a2d30']]); ctx.fill();
  ctx.strokeStyle = 'rgba(8,8,9,.9)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(210,205,195,.35)'; ctx.fillRect(f.X - 0.5, f.yT + f.K, 1, f.yB - f.yT - f.K);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.moveTo(f.X, f.yB); ctx.lineTo(f.X + f.S, f.yB - f.K); ctx.lineTo(f.X + f.S, f.yB - f.K + 3); ctx.lineTo(f.X, f.yB + 3); ctx.fill();
}
function artInFace(ctx, f, img, sx, sy, sw, sh, W, E, cyB, hScale, rim, rimA) {   // v2-kunst (W×E, frontflate) skjært inn i sideflaten, foten ved cyB
  const h = E * hScale; ctx.save(); facePath(ctx, f, f.yT + f.K, f.yB + 2); ctx.clip();
  ctx.transform(f.S / W, -f.K / W, 0, hScale, f.X, cyB - h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, E); ctx.restore();
  if (rim && rimA > 0) { ctx.save(); ctx.transform(f.S / W, -f.K / W, 0, hScale, f.X, cyB - h); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = rimA; ctx.drawImage(rim, sx / 2, sy / 2, sw / 2, sh / 2, 0, 0, W, E); ctx.restore(); }
}
function lampAt(ctx, x, y, state, glowOn, t) {
  if (state === 'used') { ctx.fillStyle = '#2a2b2c'; ctx.fillRect(x - 1.6, y - 1.2, 3.2, 2.6); return; }
  const p = glowOn ? 0.65 + 0.35 * Math.sin(t * 5.2) : state === 'open' ? 0.8 : 0.55 + 0.08 * Math.sin(t * 1.3), col = state === 'open' ? WARM : [255, 58, 30], r = 9;
  ctx.fillStyle = '#141414'; ctx.fillRect(x - 2, y - 1.6, 4, 3.4); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p; ctx.drawImage(hotCore(...col), x - r / 2, y - r / 2, r, r);
  ctx.globalAlpha = p * 0.5; ctx.drawImage(glow(...col, 1), x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2); ctx.restore();
}
function floorGlow(ctx, x, y, t) { const p = 0.5 + 0.5 * Math.sin(t * 2.6), hw = 90, hh = hw * G; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.2 + 0.12 * p; ctx.drawImage(glow(...WARM, 1.2), x - hw / 2, y - hh / 2, hw, hh); ctx.restore(); }
function ladderC(ctx, f, cyB, H, glowOn, t) {   // fasit C: stige inntil sideflaten, i flatens skjærte ramme, løftet ut fra flaten
  const out = 6, P = (u, h, o = out) => [f.X + f.S * u - o, cyB - h - f.K * u + o * 0.4];
  const U = [0.2, 0.8], N = 7, Hh = H - 4;
  // slagskygge på sideflaten (stigens omriss forskjøvet inn på flaten, mørk)
  ctx.save(); facePath(ctx, f, f.yT + f.K, f.yB); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineCap = 'butt';
  const S = (u, h) => P(u, h, -3);
  ctx.lineWidth = 3; for (const u of U) { const [a1, b1] = S(u, 0), [a2, b2] = S(u, Hh); ctx.beginPath(); ctx.moveTo(a1, b1 - 2); ctx.lineTo(a2, b2 - 2); ctx.stroke(); }
  ctx.lineWidth = 2.2; for (let i = 1; i <= N; i++) { const h = Hh * i / (N + 1), [a1, b1] = S(U[0], h), [a2, b2] = S(U[1], h); ctx.beginPath(); ctx.moveTo(a1, b1 - 2); ctx.lineTo(a2, b2 - 2); ctx.stroke(); }
  ctx.restore();
  // gulvfotavtrykk
  for (const u of U) { const [a1, b1] = P(u, 0); ctx.fillStyle = 'rgba(0,0,0,.6)'; ell(ctx, a1 + 1, b1 + 1, 3.5, 1.8); ctx.fill(); ctx.fillStyle = '#1b1d1f'; ctx.fillRect(a1 - 2, b1 - 1, 4, 2); }
  // trinn (bak vangene): tykke, lys topp, mørk underkant
  for (let i = 1; i <= N; i++) { const h = Hh * i / (N + 1), [a1, b1] = P(U[0], h), [a2, b2] = P(U[1], h); ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(a1, b1 + 1.4); ctx.lineTo(a2, b2 + 1.4); ctx.stroke();
    ctx.strokeStyle = '#555a5e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,212,196,.7)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(a1, b1 - 0.8); ctx.lineTo(a2, b2 - 0.8); ctx.stroke(); }
  // vanger: mørk sideflate + lys forside + tynt varmt kantlys, bøyle over kanten
  for (const u of U) { const [a1, b1] = P(u, 0), [a2, b2] = P(u, Hh + 5);
    ctx.fillStyle = '#141618'; ctx.fillRect(a1 + 1, b2, 1.6, b1 - b2);
    ctx.fillStyle = lin(ctx, a1 - 1.6, 0, a1 + 1, 0, [[0, '#8a9094'], [1, '#3c4145']]); ctx.fillRect(a1 - 1.6, b2, 2.6, b1 - b2);
    ctx.fillStyle = `rgba(${FLARE},.35)`; ctx.fillRect(a1 - 1.6, b2, 0.6, b1 - b2);
    ctx.strokeStyle = '#3c4145'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a1, b2); ctx.quadraticCurveTo(a1 + 2, b2 - 6, a1 + 7, b2 - 6); ctx.stroke(); }
  if (glowOn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 2.6); for (const u of U) { const [a1, b1] = P(u, 0), [a2, b2] = P(u, Hh + 5); ctx.strokeStyle = `rgb(${WARM})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); } ctx.restore(); }
  // nisje øverst i sideflaten der stigen ender (mørk, myk innfelling i flatens skjær – ingen luke i veggtoppen)
  ctx.save(); facePath(ctx, f, f.yT + f.K, f.yB); ctx.clip();
  const [n0x, n0y] = P(0.08, Hh + 10, 0), [n1x, n1y] = P(0.92, Hh + 10, 0), nh = 16;
  for (let k = 0; k < 4; k++) { const e = k * 1.2; ctx.fillStyle = `rgba(0,0,0,${0.16 + k * 0.1})`; ctx.beginPath(); ctx.moveTo(n0x + e, n0y + e * 0.6); ctx.lineTo(n1x - e, n1y + e * 0.6); ctx.lineTo(n1x - e, n1y + nh - e); ctx.lineTo(n0x + e, n0y + nh - e); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function sideObject(ctx, t, o, open, state, glowOn, now) {
  const kk = keyKind(t.kind, t.dir), f = faceGeo(o), step = Math.round(Math.max(0, Math.min(1, open)) * 4), pulse = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(now * 2.6));
  const mid = (o.y + o.h * 0.5) * TL * G, yFoot = f.yB - 4;
  if (kk === 'ladderdown') {   // E: gulvluke i gulvet foran veggen (vest), lokket hengslet opp bak
    const W = 52, D = 40, sp = objSprite('ladderdown', W, D, step), cx = f.X - 1.6 * TL, sx = cx - W / 2 - PAD, sy = mid - sp.F / 2 - sp.E - PAD;
    if (glowOn) floorGlow(ctx, cx, mid, now);
    ctx.drawImage(sp.img, sx, sy, sp.img.width / RES, sp.img.height / RES);
    if (glowOn) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse; ctx.drawImage(sp.rim, sx, sy, sp.img.width / RES, sp.img.height / RES); ctx.restore(); }
    lampAt(ctx, cx - W * 0.42, mid - sp.F * 0.3 - 10, state, glowOn, now); return;
  }
  if (glowOn) floorGlow(ctx, f.X - 22, mid + 6, now);
  drawFace(ctx, f);
  if (kk === 'ladderup') { ladderC(ctx, f, yFoot, f.yB - f.yT - f.K - 10, glowOn, now); lampAt(ctx, f.X + f.S * 0.5, f.yT + f.K + 6, state, glowOn, now); return; }
  const W = Math.round(o.w * TL), D = Math.round(o.h * TL), sp = objSprite(kk, W, D, step), E = sp.E;
  const span = f.yB - f.yT - f.K - 4, hS = Math.min(1.25, span / E);
  const E6 = E + 6; artInFace(ctx, f, sp.img, PAD * RES, (PAD + sp.F - 6) * RES, W * RES, E6 * RES, W, E6, yFoot + 2, Math.min(1.25, span / E6), sp.rim, glowOn ? pulse * 0.8 : 0);   // +6: farebåndet på karmen
  // terskel/flens-skygge på gulvet foran åpningen
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(f.X, yFoot + 2); ctx.lineTo(f.X - 6, yFoot + 5); ctx.lineTo(f.X - 6, yFoot + 5 - E * hS * 0.9); ctx.lineTo(f.X, yFoot + 2 - E * hS * 0.9); ctx.fill();
  lampAt(ctx, f.X + f.S * 0.5, yFoot + 2 - E * hS - f.K * 0.5 - 3, state, glowOn, now);
}

export function drawObject(ctx, t, s = {}) {
  if (!t) return;
  ctx.save(); ctx.scale(1, 1 / G);                     // ramme: x = verden, y = skjerm ved zoom 1 (= verden·G) – samme enheter som spritene
  try {
    if (t.kind === 'tank') { const hp = s.hpMax ? (s.hp ?? s.hpMax) / s.hpMax : (s.hp ?? 1); tankCore(ctx, t.rect, hp, s.t || 0, FAKE_CAM, s.hitAt ?? null); return; }
    const o = t.opening || t.block; if (!o) return;
    if (V10.handlesV10(t)) { ctx.restore(); ctx.save(); V10.transitionFloor(ctx, t, s); for (const p of V10.transitionParts(t, s) || []) p.draw(ctx); return; }   // v10 (erstatter v6): reserve for dagens krok – med v10-kroken kommer delene y-sortert via transitionParts
    const now = s.t || 0; let open = s.used ? 1 : 0;
    if (s.busy) { if (!openStart.has(t.id)) openStart.set(t.id, now); open = Math.min(1, (now - openStart.get(t.id)) / 0.8); } else openStart.delete(t.id);
    const state = s.used ? 'used' : s.unlocked ? 'open' : 'locked', glowOn = !!s.unlocked && !s.inReach && !s.used;
    if (s.busy && !s.used) open = Math.max(open, 0);
    sideObject(ctx, t, o, open, state, glowOn, now);
    if (t.kind === 'pry' || t.kind === 'valve') {
      const wp = t.wheel || { x: o.x + o.w + 0.45, y: o.y + o.h };
      const ws = wheelSprite(Math.round(open * 4) % 5), wx = Math.min(wp.x, o.x - 0.7) * TL, wy = Math.max(wp.y, o.y + o.h + 0.3) * TL * G;   // v6: ratt på gulvet vest for sideflaten, sør for døra
      ctx.drawImage(ws.img, wx - ws.bx, wy - ws.by, ws.W, ws.H);
      if (glowOn) { const p = 0.5 + 0.5 * Math.sin(now * 2.6); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.2 * p; const hy = wy - WH.at * SZ, r = 16; ctx.drawImage(glow(...WARM, 1), wx - r, hy - r * 0.7, r * 2, r * 1.4); }
    }
  } finally { ctx.restore(); }
}

// ---------------------------------------------------------------- drivstofftanken (FUEL 01) – skadetrinn
// Leser world._brett2.tank (Story: { hp 0..1, rect {x,y,w,h} i ruter, hitAt }). Tegnes over arenaens tank i dens egen form
// (render/kinds.js drawTank: R = min(w,h)/2 − 2, høyde elev = 80·zScale verdens-y). Trinn: >0,75 rent, ≤0,75 sot+bulker,
// ≤0,5 + lekkasje og pøl, ≤0,25 + flenge, gnister og damp (partikler, maks 14).
const TANK_H = PROJ.heights.high * 1.25;
// Flengens omriss (verdens-px relativt til sentrum gx,gy) – delt mellom bake og pulsering.
const GASH = (() => { const b = [[-26, -4], [-15, -15], [-3, -10], [8, -19], [22, -8], [17, 5], [4, 11], [-10, 7], [-22, 9]], r = mulberry(4242), o = [];
  b.forEach((p, i) => { const q = b[(i + 1) % b.length]; for (let k = 0; k < 4; k++) { const t = k / 4, j = k ? (r() - 0.5) * 5 : 0; o.push([p[0] + (q[0] - p[0]) * t + j, p[1] + (q[1] - p[1]) * t + (r() - 0.5) * 5]); } }); return o; })();
function tankGeo(R, e, cx, cy) { const fy0 = cy - e + R, fy1 = cy + R * 0.9; return { fy0, fy1, gx: cx - R * 0.3, gy: fy0 + (fy1 - fy0) * 0.3, lx: cx + R * 0.38, ly: fy0 + (fy1 - fy0) * 0.42 }; }
function tankStage(R, e, stage) {
  return memo(`tank:${Math.round(R)}:${Math.round(e)}:${stage}`, () => {
    const W = R * 2 + 60, H = e + R * 2 + 70, c = makeCanvas(W * 2, H * 2), x = c.getContext('2d'), Rn = mulberry(77 + stage * 13);
    x.scale(2, 2); const cx = W / 2, cy = 14 + e + R, q = tankGeo(R, e, cx, cy);
    // søl på bakken: mørk pøl med rennende tunger og kald oljehinne (tegnes før kroppen klippes)
    if (stage >= 2) { const pr = R * (stage >= 3 ? 1.15 : 0.75), px0 = q.lx, pcy = cy + R + 6;
      for (let k = 0; k < (stage >= 3 ? 7 : 4); k++) { const ax = px0 + (Rn() - 0.3) * pr * 1.3, ay = pcy + (Rn() - 0.2) * pr * 0.35, ar = pr * (0.3 + Rn() * 0.45);
        const pg = x.createRadialGradient(ax, ay, 0, ax, ay, ar); pg.addColorStop(0, 'rgba(7,6,5,.92)'); pg.addColorStop(0.75, 'rgba(14,11,8,.7)'); pg.addColorStop(1, 'rgba(14,11,8,0)'); x.fillStyle = pg; ell(x, ax, ay, ar, ar * 0.36); x.fill(); }
      x.globalCompositeOperation = 'lighter';
      for (const [dx, col] of [[-0.25, 'rgba(60,40,90,.16)'], [0.05, 'rgba(30,70,60,.14)'], [0.3, 'rgba(90,60,30,.12)']]) { x.fillStyle = col; ell(x, px0 + pr * dx, pcy - 2, pr * 0.32, pr * 0.06); x.fill(); }
      x.fillStyle = 'rgba(200,190,210,.14)'; ell(x, px0 - pr * 0.1, pcy - 3, pr * 0.22, 1.2); x.fill();
      if (stage >= 3) { const hg = x.createRadialGradient(q.gx, pcy, 0, q.gx, pcy, pr * 0.8); hg.addColorStop(0, `rgba(${FLARE},.22)`); hg.addColorStop(1, `rgba(${FLARE},0)`); x.fillStyle = hg; ell(x, q.gx, pcy, pr * 0.8, pr * 0.25); x.fill(); }
      x.globalCompositeOperation = 'source-over'; }
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, Math.PI); x.lineTo(cx - R, cy - e); x.arc(cx, cy - e, R, Math.PI, 0); x.closePath(); x.clip();
    const { fy0, fy1 } = q;
    const soot = (px, py, r, a) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(10,9,8,${a})`); g.addColorStop(1, 'rgba(10,9,8,0)'); x.fillStyle = g; x.fillRect(px - r, py - r * 1.6, r * 2, r * 2.6); };
    const nS = [0, 5, 9, 14][stage]; for (let i = 0; i < nS; i++) soot(cx + (Rn() - 0.5) * R * 1.7, fy0 + Rn() * (fy1 - fy0), 14 + Rn() * 26, 0.25 + Rn() * 0.25 + stage * 0.06);
    if (stage >= 2) { const sg = x.createLinearGradient(0, fy1, 0, fy0); sg.addColorStop(0, `rgba(12,10,8,${0.28 * stage})`); sg.addColorStop(1, 'rgba(12,10,8,0)'); x.fillStyle = sg; x.fillRect(cx - R, fy0, R * 2, fy1 - fy0 + R); }
    // bulker: store innslag malt med skyggeside (oppe til venstre – kanten skygger inn) og lys bunn (nede til høyre fanger lyset), revner rundt
    const nD = [0, 4, 7, 10][stage];
    for (let i = 0; i < nD; i++) { const px = cx + (Rn() - 0.5) * R * 1.55, py = fy0 + 14 + Rn() * (fy1 - fy0 - 24), r = 9 + Rn() * (8 + stage * 4), ry = r * 0.8;
      if (stage >= 3 && Math.hypot(px - q.gx, py - q.gy) < 34) continue;
      const sh = x.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r); sh.addColorStop(0, 'rgba(4,4,4,.78)'); sh.addColorStop(0.55, 'rgba(8,8,8,.45)'); sh.addColorStop(1, 'rgba(8,8,8,0)'); x.fillStyle = sh; ell(x, px, py, r, ry); x.fill();
      const lt = x.createRadialGradient(px + r * 0.4, py + r * 0.35, 0, px + r * 0.4, py + r * 0.35, r * 0.6); lt.addColorStop(0, 'rgba(150,146,136,.34)'); lt.addColorStop(1, 'rgba(150,146,136,0)'); x.fillStyle = lt; ell(x, px + r * 0.3, py + r * 0.3, r * 0.55, ry * 0.5); x.fill();
      x.strokeStyle = 'rgba(170,164,152,.15)'; x.lineWidth = 1.1; x.beginPath(); x.ellipse(px, py, r * 0.95, ry * 0.95, 0, Math.PI * 0.05, Math.PI * 0.6); x.stroke();     // lys leppe nede/høyre
      x.strokeStyle = 'rgba(3,3,3,.7)'; x.lineWidth = 1.3; x.beginPath(); x.ellipse(px, py, r, ry, 0, Math.PI * 1.0, Math.PI * 1.6); x.stroke();                        // mørk kant oppe/venstre
      x.strokeStyle = 'rgba(6,6,6,.55)'; x.lineWidth = 0.7; for (let k = 0; k < 3; k++) { const an = Rn() * TAU; x.beginPath(); x.moveTo(px + Math.cos(an) * r * 0.5, py + Math.sin(an) * ry * 0.5); x.lineTo(px + Math.cos(an) * r * 1.35, py + Math.sin(an) * ry * 1.35); x.stroke(); }
      for (let k = 0; k < 1 + stage; k++) { const hx = px + (Rn() - 0.5) * r, hy = py + (Rn() - 0.5) * ry; x.fillStyle = 'rgba(150,144,134,.18)'; x.beginPath(); x.arc(hx - 0.4, hy - 0.4, 1.8, 0, TAU); x.fill(); x.fillStyle = 'rgba(5,4,3,.95)'; x.beginPath(); x.arc(hx, hy, 1 + Rn() * 0.6, 0, TAU); x.fill(); } }
    // lekkasje: hull + tunge oljestriper ned til bakken
    if (stage >= 2) { const { lx, ly } = q;
      x.fillStyle = '#050403'; ell(x, lx, ly, 4, 3.2); x.fill(); x.strokeStyle = 'rgba(170,160,150,.4)'; x.lineWidth = 0.8; x.beginPath(); x.ellipse(lx, ly, 4.6, 3.8, 0, Math.PI, TAU); x.stroke();
      for (let k = 0; k < 6; k++) { const ox = lx + (k - 2.5) * 2.1 + (Rn() - 0.5), w = 1.4 + Rn() * 1.6, g = x.createLinearGradient(0, ly, 0, cy + R); g.addColorStop(0, 'rgba(6,5,3,.95)'); g.addColorStop(1, 'rgba(6,5,3,.45)'); x.fillStyle = g; x.fillRect(ox - w / 2, ly + 1, w, cy + R - ly); }
      x.fillStyle = 'rgba(200,190,210,.2)'; x.fillRect(lx - 2.6, ly + 4, 0.8, (cy + R - ly) * 0.7); }
    // flenge: oppskåret plate, sort indre, krøllede kanter og glohet rand (FLARE)
    if (stage >= 3) { const { gx, gy } = q; soot(gx, gy - 18, 40, 0.75);
      const path = (s = 1) => { x.beginPath(); GASH.forEach(([a, b], i) => i ? x.lineTo(gx + a * s, gy + b * s) : x.moveTo(gx + a * s, gy + b * s)); x.closePath(); };
      x.fillStyle = '#2a2724'; path(1.18); x.fill();                                              // bøyd plate rundt hullet
      x.strokeStyle = 'rgba(120,110,98,.35)'; x.lineWidth = 0.8; path(1.18); x.stroke();
      const ig = x.createRadialGradient(gx, gy + 4, 2, gx, gy, 24); ig.addColorStop(0, 'rgba(70,26,8,1)'); ig.addColorStop(0.5, '#0b0605'); ig.addColorStop(1, '#020202'); x.fillStyle = ig; path(); x.fill();
      x.globalCompositeOperation = 'lighter';
      x.lineJoin = 'round'; x.strokeStyle = `rgba(${FLARE},.22)`; x.lineWidth = 6; path(); x.stroke();
      x.strokeStyle = `rgba(${FLARE},.7)`; x.lineWidth = 1.6; path(); x.stroke();
      { const er = mulberry(9); for (const [a, b] of GASH) if (er() < 0.5) { x.fillStyle = `rgba(255,${150 + (er() * 60) | 0},70,.7)`; x.beginPath(); x.arc(gx + a, gy + b, 0.6 + er(), 0, TAU); x.fill(); } }
      x.strokeStyle = 'rgba(255,210,150,.8)'; x.lineWidth = 0.8; x.beginPath(); GASH.slice(16, 34).forEach(([a, b], i) => i ? x.lineTo(gx + a, gy + b) : x.moveTo(gx + a, gy + b)); x.stroke();
      x.globalCompositeOperation = 'source-over'; }
    x.restore();
    return { img: c, W, H, cx, cy };
  });
}
const tp = [];   // partikkelbasseng for tanken (gjenbruk, maks 16)
let tLast = 0;
export function drawTankDamage(ctx, world, camera) {   // tynn wrapper (skjermkoordinater, gammel HUD-kallform)
  const t = world?._brett2?.tank; if (!t || !t.rect || !camera?.worldToScreen) return;
  tankCore(ctx, t.rect, t.hp ?? 1, world.time || 0, camera, t.hitAt);
}
function tankCore(ctx, rect, hp0, now, camera, hitAt = null) {
  const t = { rect, hitAt };
  const hp = Math.max(0, Math.min(1, hp0)), stage = hp > 0.75 ? 0 : hp > 0.5 ? 1 : hp > 0.25 ? 2 : 3;
  const dt = Math.min(0.1, Math.max(0, now - tLast)); tLast = now;
  const ox = t.rect.x * 32, oy = t.rect.y * 32, ow = t.rect.w * 32, oh = t.rect.h * 32, R = Math.min(ow, oh) / 2 - 2, e = TANK_H * PROJ.zScale;
  const cx = ox + ow / 2, cy = oy + oh / 2, z = camera.zoom || 1, g = camera.g || G;
  const P = (wx, wy) => camera.worldToScreen(wx, wy);
  if (stage > 0) { const s = tankStage(R, e, stage), a = P(cx - s.cx, cy - s.cy); ctx.drawImage(s.img, a.x, a.y, s.W * z, s.H * z * g); }
  const q = tankGeo(R, e, cx, cy);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (t.hitAt != null && now - t.hitAt < 0.15 && stage > 0) { const c = P(cx, cy - e * 0.5); ctx.globalAlpha = 0.12; ctx.drawImage(glow(...FLARE, 1), c.x - R * z, c.y - R * z * g, R * 2 * z, R * 2 * z * g); }
  if (stage >= 3) { // glød fra flengen; kritisk (hp ≤ 0,12) pulserer svakt
    const crit = hp <= 0.12, pu = crit ? 0.5 + 0.5 * Math.sin(now * 6.5) : 0.5, c = P(q.gx, q.gy), r = (30 + 8 * pu) * z;
    ctx.globalAlpha = 0.32 + (crit ? 0.3 * pu : 0); ctx.drawImage(glow(...FLARE, 1), c.x - r, c.y - r * g, r * 2, r * 2 * g);
    if (crit) { const f = P(q.gx, cy + R + 6), fr = R * 0.9 * z; ctx.globalAlpha = 0.1 + 0.1 * pu; ctx.drawImage(glow(...FLARE, 1), f.x - fr, f.y - fr * 0.3, fr * 2, fr * 0.6); } }
  ctx.restore();
  if (stage < 2) { tp.length = 0; return; }
  // partikler: damp fra lekkasjen (trinn 2+); røyk + gnister fra flengen (trinn 3)
  const rate = stage >= 3 ? (hp <= 0.12 ? 16 : 11) : 3;
  if (tp.length < 16 && Math.random() < rate * dt) { const r0 = Math.random(), sp = stage >= 3 && r0 < 0.4, sm = stage >= 3 && !sp && r0 < 0.8;
    const sx = sp || sm ? q.gx + (Math.random() - 0.5) * 30 : q.lx, sy = sp || sm ? q.gy - 6 : q.ly;
    tp.push({ k: sp ? 0 : sm ? 1 : 2, x: sx, y: sy, vx: sp ? -40 + Math.random() * 100 : sm ? 6 + Math.random() * 10 : 4 + Math.random() * 8, vy: sp ? -70 + Math.random() * 40 : sm ? -22 - Math.random() * 10 : -10 - Math.random() * 6, life: 0, max: sp ? 0.35 + Math.random() * 0.3 : sm ? 2 + Math.random() : 1.4 + Math.random() * 0.8, v: (Math.random() * 4) | 0 }); }
  ctx.save();
  for (let i = tp.length - 1; i >= 0; i--) { const p = tp[i]; p.life += dt; if (p.life > p.max) { tp.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 0) p.vy += 260 * dt; const k = p.life / p.max, s = P(p.x, p.y);
    if (p.k === 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; const L = 8 * z; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(p.vy * g, p.vx)); ctx.drawImage(streak(255, 170, 70), -L, -1.2 * z, L, 2.4 * z); ctx.restore(); }
    else if (p.k === 1) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.55 * (1 - k) * Math.min(1, k * 6); const r = (12 + 34 * k) * z; ctx.drawImage(puff('smoke', p.v), s.x - r, s.y - r * 1.4 - 20 * k * z, r * 2, r * 2); }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.32 * (1 - k) * Math.min(1, k * 5); const r = (8 + 22 * k) * z; ctx.drawImage(puff('steam', p.v), s.x - r, s.y - r, r * 2, r * 2); } }
  ctx.restore();
}

// ---------------------------------------------------------------- oppvarming
// Størrelser: send inn TRANSITIONS fra levels/brett2.js (block w×h i ruter); uten liste brukes standardblokkene (2×3–2×5).
const SIZES = [['pry', 'up', 2, 4], ['ladder', 'up', 2, 4], ['crawl', 'up', 2, 3], ['ladder', 'down', 2, 4], ['valve', 'up', 2, 5]];
export function transitionWarmJobs(transitions = null, tankRect = null) {
  const jobs = [], list = transitions ? transitions.filter((t) => t.opening || t.block).map((t) => { const o = t.opening || t.block; return [t.kind, t.dir || 'up', o.w, o.h]; }) : SIZES;
  for (const [k, dir, w, h] of list) for (const st of [0, 4]) jobs.push(() => objSprite(keyKind(k, dir), w * 32, h * 32, st));
  const tr = tankRect || { w: 5, h: 9 }, R = Math.min(tr.w * 32, tr.h * 32) / 2 - 2, e = TANK_H * PROJ.zScale; for (let s = 1; s <= 3; s++) jobs.push(() => tankStage(R, e, s));
  for (const st of [0, 4]) jobs.push(() => wheelSprite(st));
  jobs.push(() => { glow(...WARM, 1.2); glow(...WARM, 1); glow(255, 58, 30, 1); hotCore(...WARM); hotCore(255, 58, 30); streak(255, 170, 70); });
  return jobs;
}
export function warmTransitionSprites(transitions, tankRect) { for (const j of transitionWarmJobs(transitions, tankRect)) j(); }

export function drawWheelAt(ctx, wx, wy, step = 0) { const ws = wheelSprite(step % 5); ctx.drawImage(ws.img, wx - ws.bx, wy - ws.by, ws.W, ws.H); }
V10.setWheel(drawWheelAt);
