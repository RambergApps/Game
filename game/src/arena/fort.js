// MOCKUP «Ringborgen» v1 (28.10) – bare i /workspace/mock-festning-v1. Tegnes kun for objekter med opts.fort (S5 i refinery-v3.js).
// Rett sørvegg + topp ovenfra, ingen skjeve flater. Kald grå/blågrå stålcontainer som festningsmur, og merking på BULWARK-tanken.
import { shade, hazard, blot } from './paint.js';
const STEEL = '#7d8a96';       // kald blågrå malt stål
const Y = '#c9a227';

/** Grå festningscontainer. o = arena-objekt (verdens-px), elev = løft. */
export function drawFortContainer(ctx, o, rng) {
  const { x, y, w, h } = o, e = o.elev, col = STEEL, horiz = w >= h;
  const fy = y + h - e, fh = e;
  // SØRVEGG: korrugert stål, mørke hjørnestolper, varselkant nederst
  ctx.fillStyle = shade(col, -0.32); ctx.fillRect(x, fy, w, fh);
  for (let i = x + 3.5; i < x + w - 3.5; i += 3.2) { ctx.fillStyle = (Math.round((i - x) / 3.2) % 2) ? shade(col, -0.18) : shade(col, -0.46); ctx.fillRect(i, fy + 1.5, 1.6, fh - 3); }
  ctx.fillStyle = shade(col, -0.72); ctx.fillRect(x, fy, 3, fh); ctx.fillRect(x + w - 3, fy, 3, fh);
  ctx.fillStyle = shade(col, -0.1); ctx.fillRect(x, fy, w, 1.3);
  hazard(ctx, x + 3, fy + fh - 4.5, w - 6, 3, 2.5, Y);
  ctx.fillStyle = shade(col, -0.78); ctx.fillRect(x, fy + fh - 1.5, w, 1.5);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(30,24,18,${rng.range(0.15, 0.3)})`; ctx.fillRect(x + 3 + rng() * (w - 6), fy + 2, rng.range(0.6, 1.4), fh * rng.range(0.3, 0.7)); }
  // TOPP
  const ty = y - e;
  ctx.fillStyle = col; ctx.fillRect(x, ty, w, h);
  const L = horiz ? w : h;
  for (let i = 4; i < L - 4; i += 4) {
    ctx.fillStyle = (i / 4) % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)';
    if (horiz) ctx.fillRect(x + i, ty + 2.5, 2, h - 5); else ctx.fillRect(x + 2.5, ty + i, w - 5, 2);
  }
  const g = ctx.createLinearGradient(x, ty, x + w, ty + h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(x, ty, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, h); ctx.clip();
  for (let i = 0; i < 3; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(4, 9), '#5a3a20', rng.range(0.12, 0.25));
  for (let i = 0; i < 4; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(5, 12), '#000000', rng.range(0.12, 0.25));
  // falmet sjablong langs lengden
  if (L > 90) {
    ctx.save(); ctx.translate(x + w / 2, ty + h / 2); if (!horiz) ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(215,220,222,0.28)'; ctx.font = 'bold 8px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`B-${rng.int(10, 99)}`, 0, 0); ctx.restore();
  }
  ctx.restore();
  // mørk ramme + lys NV-kant
  ctx.strokeStyle = shade(col, -0.62); ctx.lineWidth = 1.8; ctx.strokeRect(x + 0.9, ty + 0.9, w - 1.8, h - 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 1.5, ty + 1, w - 3, 0.8); ctx.fillRect(x + 1, ty + 1.5, 0.8, h - 3);
  // varselkant på endene av toppen (gul/svart, samme stil som ellers)
  if (horiz) { hazard(ctx, x + 2, ty + 2, 5, h - 4, 2.5, Y); hazard(ctx, x + w - 7, ty + 2, 5, h - 4, 2.5, Y); }
  else { hazard(ctx, x + 2, ty + 2, w - 4, 5, 2.5, Y); hazard(ctx, x + 2, ty + h - 7, w - 4, 5, 2.5, Y); }
  // hjørnebeslag
  ctx.fillStyle = '#15171a';
  for (const [cx, cy] of [[x, ty], [x + w - 4, ty], [x, ty + h - 4], [x + w - 4, ty + h - 4]]) ctx.fillRect(cx, cy, 4, 4);
  ctx.fillStyle = '#5a6068';
  for (const [cx, cy] of [[x + 1.5, ty + 1.5], [x + w - 2.5, ty + 1.5], [x + 1.5, ty + h - 2.5], [x + w - 2.5, ty + h - 2.5]]) ctx.fillRect(cx, cy, 1, 1);
}

/** Merking på BULWARK-tanken: varselring på taket + bred varselring og sjablong på sørsiden. Kalles til slutt i kinds.js drawTank. */
export function drawFortTankMarks(ctx, o, cx, cy, R, e, ty) {
  // sørside: klipp til sylinderkroppen
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI); ctx.lineTo(cx - R, cy - e); ctx.arc(cx, cy - e, R, Math.PI, 0); ctx.closePath(); ctx.clip();
  // varselbånd rundt kroppen i ~60 % høyde (følger sylinderen: buede kanter, ingen skjeve flater)
  const b0 = e * 0.6, bh = 7;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy - b0 + bh, R, 0, Math.PI); ctx.lineTo(cx - R, cy - b0); ctx.arc(cx, cy - b0, R, Math.PI, 0, true); ctx.closePath(); ctx.clip();
  hazard(ctx, cx - R, cy - b0 - 2, R * 2, R + bh + 4, 5, Y);
  const sh = ctx.createLinearGradient(cx - R, 0, cx + R, 0); sh.addColorStop(0, 'rgba(0,0,0,0.1)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.05)'); sh.addColorStop(0.85, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - b0 - 2, R * 2, R + bh + 4); ctx.restore();
  // sjablong BULWARK på sørsiden (vest for stigen)
  ctx.save(); ctx.translate(cx - R * 0.22, cy + R - e * 0.3);
  ctx.font = 'bold 13px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText('BULWARK', 0.8, 0.8);
  ctx.fillStyle = 'rgba(222,216,198,0.62)'; ctx.fillText('BULWARK', 0, 0);
  // sjablongbroer (små hull i bokstavene)
  ctx.fillStyle = 'rgba(80,86,90,0.55)'; for (let i = -3; i <= 3; i++) ctx.fillRect(i * 10.5 - 0.5, -1.2, 1, 2.4);
  ctx.restore();
  ctx.restore();
  // TAK: gul/svart varselring innenfor gangbanen
  ctx.save(); ctx.beginPath(); ctx.arc(cx, ty, R * 0.78, 0, Math.PI * 2); ctx.arc(cx, ty, R * 0.66, 0, Math.PI * 2, true); ctx.clip();
  hazard(ctx, cx - R, ty - R, R * 2, R * 2, 6, Y);
  ctx.fillStyle = 'rgba(30,24,16,0.25)'; ctx.fillRect(cx - R, ty - R, R * 2, R * 2); ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8;
  for (const r of [R * 0.78, R * 0.66]) { ctx.beginPath(); ctx.arc(cx, ty, r, 0, Math.PI * 2); ctx.stroke(); }
}

// ---------------------------------------------------------------- MOCKUP «Muren» v1 (28.10)
/** Festningsmur-segment (container-kind, opts.fort === 'wall'). Sørvegg: stålpaneler med fuger, varselbånd, mørk fot. Topp: platetak med fuger og varselkant. */
export function drawFortWall(ctx, o, rng) {
  const { x, y, w, h } = o, e = o.elev, col = '#76828d', horiz = w >= h;
  const fy = y + h - e, fh = e;
  // SØRVEGG
  const fg = ctx.createLinearGradient(0, fy, 0, fy + fh); fg.addColorStop(0, shade(col, -0.18)); fg.addColorStop(1, shade(col, -0.55));
  ctx.fillStyle = fg; ctx.fillRect(x, fy, w, fh);
  const pw = horiz ? 32 : w;
  for (let px = x; px < x + w - 0.5; px += pw) {
    const ww = Math.min(pw, x + w - px);
    for (let i = px + 3; i < px + ww - 3; i += 3.4) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(i, fy + 2, 1.4, fh - 4); }
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px, fy, 1.6, fh);                      // panelfuge
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(px + 1.6, fy, 0.8, fh);
    for (const yy of [fy + 2, fy + fh - 7]) for (const xx of [px + 3, px + ww - 4]) { ctx.fillStyle = 'rgba(200,205,210,0.45)'; ctx.fillRect(xx, yy, 1, 1); }
  }
  hazard(ctx, x, fy + fh * 0.5, w, Math.max(4, fh * 0.13), 4, Y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, fy + fh * 0.5 + Math.max(4, fh * 0.13), w, 1);
  for (let i = 0; i < w / 9; i++) { const sx = x + rng() * w, sl = fh * rng.range(0.2, 0.5); const gl = ctx.createLinearGradient(0, fy + 3, 0, fy + 3 + sl); gl.addColorStop(0, 'rgba(110,58,26,0.4)'); gl.addColorStop(1, 'rgba(110,58,26,0)'); ctx.fillStyle = gl; ctx.fillRect(sx, fy + 3, rng.range(0.8, 2), sl); }
  ctx.fillStyle = shade(col, -0.1); ctx.fillRect(x, fy, w, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x, fy + fh - 2, w, 2);
  // TOPP
  const ty = y - e;
  ctx.fillStyle = shade(col, 0.05); ctx.fillRect(x, ty, w, h);
  const L = horiz ? w : h;
  for (let i = 3; i < L - 3; i += 4) { ctx.fillStyle = (Math.round(i / 4) % 2) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)'; if (horiz) ctx.fillRect(x + i, ty + 3, 2, h - 6); else ctx.fillRect(x + 3, ty + i, w - 6, 2); }
  const g = ctx.createLinearGradient(x, ty, x + w, ty + h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.22)'); ctx.fillStyle = g; ctx.fillRect(x, ty, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, h); ctx.clip();
  for (let i = 0; i < w * h / 900; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(4, 10), rng() < 0.5 ? '#5a3a20' : '#000000', rng.range(0.12, 0.25));
  ctx.restore();
  // segmentfuger hver 4. rute
  for (let i = 128; i < L - 4; i += 128) { ctx.fillStyle = '#15171a'; if (horiz) ctx.fillRect(x + i - 1.5, ty, 3, h); else ctx.fillRect(x, ty + i - 1.5, w, 3); ctx.fillStyle = 'rgba(255,255,255,0.15)'; if (horiz) ctx.fillRect(x + i + 1.5, ty, 0.8, h); else ctx.fillRect(x, ty + i + 1.5, w, 0.8); }
  // kraftige varselkanter langs langsidene av toppen
  if (horiz) { hazard(ctx, x, ty + h - 6, w, 5, 4, Y); hazard(ctx, x, ty + 1, w, 4, 4, Y); }
  else { hazard(ctx, x + 1, ty, 5, h, 4, Y); hazard(ctx, x + w - 6, ty, 5, h, 4, Y); }
  ctx.strokeStyle = '#121416'; ctx.lineWidth = 1.6; ctx.strokeRect(x + 0.8, ty + 0.8, w - 1.6, h - 1.6);
}

/** Portstolpe (building-kind, opts.fort === 'post'): tung stålpilar med varselbånd. */
export function drawFortPost(ctx, o, rng) {
  const { x, y, w, h } = o, e = o.elev, col = '#6c767f', fy = y + h - e, ty = y - e;
  const fg = ctx.createLinearGradient(x, 0, x + w, 0); fg.addColorStop(0, shade(col, -0.05)); fg.addColorStop(0.3, shade(col, 0.1)); fg.addColorStop(1, shade(col, -0.55));
  ctx.fillStyle = fg; ctx.fillRect(x, fy, w, e);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + w * 0.5 - 0.6, fy, 1.2, e);
  hazard(ctx, x, fy + e * 0.18, w, 6, 4, Y); hazard(ctx, x, fy + e - 12, w, 7, 4, Y);
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x, fy + e - 2, w, 2);
  ctx.fillStyle = shade(col, 0.15); ctx.fillRect(x, ty, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 3, ty + 3, w - 6, h - 6);
  ctx.strokeStyle = '#121416'; ctx.lineWidth = 1.6; ctx.strokeRect(x + 0.8, ty + 0.8, w - 1.6, h - 1.6);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 1, ty + 1, w - 2, 1);
  for (const [cx, cy] of [[x + 4, ty + 4], [x + w - 5, ty + 4], [x + 4, ty + h - 5], [x + w - 5, ty + h - 5]]) { ctx.fillStyle = '#9aa0a4'; ctx.fillRect(cx, cy, 1.4, 1.4); }
}

/** Vakttårn (building-kind, opts.fort === 'tower'): hevet stålplattform på bein med rekkverk og lyskaster. Rett sørside, topp ovenfra. */
export function drawFortTower(ctx, o, rng) {
  const { x, y, w, h } = o, e = o.elev, ty = y - e, fy = y + h - e, deckT = 5;
  // bein + kryssavstivning (linjer, ingen skjeve flater)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 2, y + h - 3, w - 4, 3);
  ctx.strokeStyle = '#3c4146'; ctx.lineWidth = 1.2;
  const legs = [x + 2, x + w / 2 - 1.5, x + w - 5];
  for (let k = 0; k < legs.length - 1; k++) { const a = legs[k] + 1.5, b = legs[k + 1] + 1.5;
    for (let yy = fy + deckT; yy < y + h - 8; yy += 14) { ctx.beginPath(); ctx.moveTo(a, yy); ctx.lineTo(b, yy + 14); ctx.moveTo(b, yy); ctx.lineTo(a, yy + 14); ctx.stroke(); }
    ctx.fillStyle = '#33383c'; ctx.fillRect(a, y + h - 10, b - a, 1.6); }
  for (const lx of legs) { ctx.fillStyle = '#2a2e32'; ctx.fillRect(lx, fy + deckT, 3, e - deckT); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(lx, fy + deckT, 0.8, e - deckT); }
  // stige på sørsiden
  const la = x + w * 0.62, lb = la + 7;
  for (const lx of [la, lb]) { ctx.fillStyle = '#8d9397'; ctx.fillRect(lx, fy, 1.4, e); }
  for (let yy = fy + 6; yy < y + h - 1; yy += 5) { ctx.fillStyle = '#6a7074'; ctx.fillRect(la, yy, lb - la, 1.2); }
  // dekkkant (sørside av plattformen) med varselbånd
  ctx.fillStyle = '#3a3f43'; ctx.fillRect(x, fy, w, deckT); hazard(ctx, x, fy + 0.8, w, deckT - 1.6, 3, Y); ctx.strokeStyle = '#121314'; ctx.lineWidth = 1; ctx.strokeRect(x, fy, w, deckT);
  // DEKK: rist ovenfra
  ctx.fillStyle = '#4a5055'; ctx.fillRect(x, ty, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let yy = ty + 2; yy < ty + h - 1; yy += 2.4) ctx.fillRect(x + 2, yy, w - 4, 0.9);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let xx = x + 8; xx < x + w - 2; xx += 8) ctx.fillRect(xx, ty + 2, 1, h - 4);
  const g = ctx.createLinearGradient(x, ty, x + w, ty + h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = g; ctx.fillRect(x, ty, w, h);
  ctx.strokeStyle = '#121314'; ctx.lineWidth = 1.4; ctx.strokeRect(x + 0.7, ty + 0.7, w - 1.4, h - 1.4);
  // rekkverk: rett ovenfra = ramme innenfor kanten + stolper, åpning over stigen
  ctx.strokeStyle = '#a9afb3'; ctx.lineWidth = 1.3; ctx.beginPath();
  ctx.moveTo(la - 1, ty + h - 2); ctx.lineTo(x + 2, ty + h - 2); ctx.lineTo(x + 2, ty + 2); ctx.lineTo(x + w - 2, ty + 2); ctx.lineTo(x + w - 2, ty + h - 2); ctx.lineTo(lb + 2, ty + h - 2); ctx.stroke();
  ctx.fillStyle = '#d8dcde'; for (const [px, py] of [[x + 2, ty + 2], [x + w - 2, ty + 2], [x + 2, ty + h - 2], [x + w - 2, ty + h - 2], [x + w / 2, ty + 2], [x + 2, ty + h / 2], [x + w - 2, ty + h / 2]]) ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4);
  // lyskaster på nordøstre hjørne
  const lx = x + w - 7, ly = ty + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(lx - 4, ly - 2, 9, 7);
  ctx.fillStyle = '#25282b'; ctx.fillRect(lx - 4.5, ly - 3.5, 9, 6); ctx.fillStyle = '#fff1c4'; ctx.fillRect(lx - 3, ly + 1, 6, 1.6);
  o._windows = [{ x: lx - 3, y: ly + 1, w: 6, h: 1.6, c: '#ffd27a' }];
  // vaktboks/kasse på dekket
  ctx.fillStyle = '#5a5634'; ctx.fillRect(x + 5, ty + 5, 8, 6); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + 5, ty + 10, 8, 1);
}

/** v2B: overligger over porten (overpipe-kind => overhead-laget med aktørhull, går aldri foran Warden). Smal stålbjelke ovenfra + tynn sørkant. */
export function drawFortLintel(ctx, o) {
  const { x, w, h } = o, e = o.elev, ty = o.y - e;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 2, ty + h, w - 4, 3);                 // skygge under bjelkens sørkant
  ctx.fillStyle = '#2b2f33'; ctx.fillRect(x, ty + h - 1, w, 5);                              // sørflate (I-bjelkens steg)
  hazard(ctx, x + 1, ty + h - 0.2, w - 2, 3.2, 4, Y);
  ctx.fillStyle = '#5d666e'; ctx.fillRect(x, ty, w, h);                                       // toppflens
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, ty, w, 1.2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, ty + h / 2 - 0.6, w, 1.2);
  for (let i = x + 10; i < x + w - 6; i += 20) { ctx.fillStyle = '#a7adb1'; ctx.fillRect(i, ty + 3, 1.4, 1.4); ctx.fillRect(i, ty + h - 5, 1.4, 1.4); }
  ctx.fillStyle = '#16181a'; ctx.fillRect(x, ty, 4, h + 4); ctx.fillRect(x + w - 4, ty, 4, h + 4);  // bolteplater over stolpene
  // lampe midt under bjelken (varm)
  ctx.fillStyle = '#ffd88a'; ctx.fillRect(x + w / 2 - 4, ty + h + 2.8, 8, 1.6);
  o._windows = [{ x: x + w / 2 - 4, y: ty + h + 2.8, w: 8, h: 1.6, c: '#ffcf70' }];
}
/** v2B: terskel på gulvet i portåpningen + varm lysflekk (v10-stil, gulvlaget). */
export function drawFortGateFloor(ctx, o) {
  const T = 32, x0 = o.x + T, x1 = o.x + o.w - T, cx = (x0 + x1) / 2, yS = o.y + o.h + 0.75 * T;  // murens sørkant (y 24)
  const g = ctx.createRadialGradient(cx, yS, 4, cx, yS, 3.4 * T);
  g.addColorStop(0, 'rgba(255,196,110,0.30)'); g.addColorStop(0.5, 'rgba(255,170,80,0.12)'); g.addColorStop(1, 'rgba(255,160,70,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 3.4 * T, yS - 3.4 * T, 6.8 * T, 6.8 * T);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0, yS - 1, x1 - x0, 9);
  hazard(ctx, x0, yS, x1 - x0, 7, 5, '#c9a227');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0, o.y - 1.45 * T, x1 - x0, 2);           // svak nordkant av terskelfeltet
}
