// Objekttyper for raffineri-brett (Board 02). Tegnes i samme pseudo-3/4-system som render.js:
// toppflaten løftes 'e' px nordover, sørsiden er synlig innenfor fotavtrykket.
//   high    : tank, unit, pipeline
//   low     : pipes, valve
//   overhead: overpipe, catwalk  (ingen kollisjon – går over hodet, tegnes i topplaget)
import { shade, rgba, roundRect, hazard, blot } from './paint.js';

const Y = '#c9a227';

// ---------------------------------------------------------------- lagertank / raffineritårn
export function drawTank(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2 - 2;
  const col = o.opts.color || '#666d71';
  // sokkel
  ctx.fillStyle = '#3a3d40'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + h - 4, w - 2, 3);
  hazard(ctx, x + 1, y + h - 7, 10, 6, 3); hazard(ctx, x + w - 11, y + h - 7, 10, 6, 3);
  // kropp: sirkel(bunn) ∪ rektangel ∪ sirkel(topp)
  const body = () => { ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI); ctx.lineTo(cx - R, cy - e); ctx.arc(cx, cy - e, R, Math.PI, 0); ctx.closePath(); };
  const g = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  g.addColorStop(0, shade(col, -0.1)); g.addColorStop(0.22, shade(col, 0.12)); g.addColorStop(0.45, shade(col, -0.12)); g.addColorStop(0.85, shade(col, -0.5)); g.addColorStop(1, shade(col, -0.68));
  body(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); body(); ctx.clip();
  // varselbånd ved foten
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI); ctx.lineTo(cx - R, cy - 6); ctx.arc(cx, cy - 6, R, Math.PI, 0, true); ctx.closePath(); ctx.clip();
  hazard(ctx, cx - R, cy - 6, R * 2, R + 6, 5); ctx.restore();
  // ringer / sveisesømmer
  for (let k = 1; k < 4; k++) {
    const hk = 6 + (e - 6) * k / 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy - hk, R, 0.05, Math.PI - 0.05); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(cx, cy - hk + 1.2, R, 0.1, Math.PI - 0.1); ctx.stroke();
  }
  // rustrenner nedover
  for (let i = 0; i < 7; i++) {
    const sx = cx + rng.range(-R * 0.9, R * 0.9), sy = cy - e + R * rng.range(0.6, 1);
    const gl = ctx.createLinearGradient(0, sy, 0, sy + e * rng.range(0.4, 0.9));
    gl.addColorStop(0, 'rgba(110,58,26,0.45)'); gl.addColorStop(1, 'rgba(110,58,26,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx, sy, rng.range(1.5, 4), e);
  }
  // stige med bur
  const lx = cx + R * 0.42;
  ctx.strokeStyle = '#25282a'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(lx - 3, cy - e + R - 2); ctx.lineTo(lx - 3, cy + R); ctx.moveTo(lx + 3, cy - e + R - 2); ctx.lineTo(lx + 3, cy + R); ctx.stroke();
  ctx.lineWidth = 0.8; for (let k = cy - e + R; k < cy + R; k += 3) { ctx.beginPath(); ctx.moveTo(lx - 3, k); ctx.lineTo(lx + 3, k); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(160,165,170,0.35)'; for (let k = cy - e + R + 4; k < cy + R - 4; k += 7) { ctx.beginPath(); ctx.arc(lx, k, 5, 0, Math.PI); ctx.stroke(); }
  // merking
  if (o.opts.label) {
    ctx.fillStyle = 'rgba(225,220,205,0.55)'; ctx.font = 'bold 10px "Arial Black", Arial'; ctx.textAlign = 'center';
    ctx.fillText(o.opts.label, cx - R * 0.35, cy + R - e * 0.35);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; body(); ctx.stroke();

  // topp
  const ty = cy - e;
  const tg = ctx.createRadialGradient(cx - R * 0.35, ty - R * 0.35, R * 0.1, cx, ty, R);
  tg.addColorStop(0, shade(col, 0.22)); tg.addColorStop(0.7, shade(col, 0)); tg.addColorStop(1, shade(col, -0.25));
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(cx, ty, R, 0, Math.PI * 2); ctx.fill();
  // takplater (radielle sømmer)
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.8;
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.25, ty + Math.sin(a) * R * 0.25); ctx.lineTo(cx + Math.cos(a) * (R - 3), ty + Math.sin(a) * (R - 3)); ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, ty, R, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 6; i++) blot(ctx, cx + rng.range(-R, R), ty + rng.range(-R, R), rng.range(5, 14), '#6a3a1c', rng.range(0.2, 0.4));
  for (let i = 0; i < 4; i++) blot(ctx, cx + rng.range(-R, R), ty + rng.range(-R, R), rng.range(6, 16), '#000', 0.2);
  ctx.restore();
  // gangbane med rekkverk rundt kanten
  ctx.strokeStyle = 'rgba(20,22,24,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, ty, R - 3, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,155,160,0.55)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 1.5]); ctx.beginPath(); ctx.arc(cx, ty, R - 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = Y; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, ty, R - 0.8, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, ty, R - 0.6, Math.PI * 0.95, Math.PI * 1.6); ctx.stroke();
  ctx.fillStyle = '#16181a';
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; ctx.fillRect(cx + Math.cos(a) * (R - 1) - 1, ty + Math.sin(a) * (R - 1) - 1, 2, 2); }
  // senterluke og utstyr
  ctx.fillStyle = '#2a2d30'; ctx.beginPath(); ctx.arc(cx, ty, R * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b7075'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#3c4044'; ctx.fillRect(cx + R * 0.3, ty - R * 0.45, R * 0.28, R * 0.2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx + R * 0.3, ty - R * 0.45, R * 0.28, 1);
  o._beacons = [{ x: cx - R * 0.68, y: ty - R * 0.68 }, { x: cx + R * 0.68, y: ty + R * 0.6 }];
  o._vents = o.opts.vent ? [{ x: cx, y: ty, big: true }] : [];
  o._topCircle = { x: cx, y: ty, r: R };
}

// ---------------------------------------------------------------- prosessenhet
export function drawUnit(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const ty = y - e, fy = y + h - e;
  const col = o.opts.color || '#535b61';
  // fasade
  ctx.fillStyle = shade(col, -0.35); ctx.fillRect(x, fy, w, e);
  for (let i = x + 3; i < x + w - 3; i += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(i, fy + 2, 1, e - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(i + 1, fy + 2, 1, e - 4);
  }
  hazard(ctx, x, fy + e - 5, w, 5, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, fy, w, 1.5);
  o._windows = []; o._beacons = [];
  // instrumentpanel, målere og dør
  const nP = Math.max(1, Math.floor(w / 72));
  for (let k = 0; k < nP; k++) {
    const px = x + 10 + k * (w - 20) / nP + rng.range(0, 10);
    ctx.fillStyle = '#1c1f22'; ctx.fillRect(px, fy + 5, 18, 10);
    ctx.fillStyle = '#d9d2bf'; ctx.beginPath(); ctx.arc(px + 5, fy + 10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a02818'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(px + 5, fy + 10); ctx.lineTo(px + 6.8, fy + 8.2); ctx.stroke();
    o._windows.push({ x: px + 10, y: fy + 7, w: 6, h: 3, c: rng.chance(0.6) ? '#ff5a2a' : '#ffb347' });
  }
  if (w >= 96) {
    const dx = x + w * 0.62;
    ctx.fillStyle = '#1e2124'; ctx.fillRect(dx, fy + 4, 20, e - 9);
    ctx.strokeStyle = '#5a5f63'; ctx.lineWidth = 0.8; ctx.strokeRect(dx, fy + 4, 20, e - 9);
    o._beacons.push({ x: dx + 10, y: fy + 2, small: true });
  }
  // tak
  ctx.fillStyle = col; ctx.fillRect(x, ty, w, h);
  const g = ctx.createLinearGradient(x, ty, x + w, ty + h); g.addColorStop(0, 'rgba(255,255,255,0.09)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.fillRect(x, ty, w, h);
  // plater med naglerader
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
  for (let i = 32; i < w; i += 32) { ctx.beginPath(); ctx.moveTo(x + i, ty); ctx.lineTo(x + i, ty + h); ctx.stroke(); }
  for (let i = 32; i < h; i += 32) { ctx.beginPath(); ctx.moveTo(x, ty + i); ctx.lineTo(x + w, ty + i); ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, h); ctx.clip();
  for (let i = 0; i < (w * h) / 900; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(5, 14), rng.chance(0.5) ? '#5a3418' : '#000', rng.range(0.15, 0.3));
  ctx.restore();
  // varmeveksler med kjøleribber
  const hxw = Math.min(w * 0.45, 90), hxh = Math.min(h * 0.4, 34);
  const hx = x + 8, hy = ty + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(hx + 3, hy + 4, hxw, hxh);
  ctx.fillStyle = '#2b2f33'; ctx.fillRect(hx, hy, hxw, hxh);
  for (let i = 2; i < hxw - 2; i += 2.5) { ctx.fillStyle = (Math.round(i / 2.5) % 2) ? '#4d5358' : '#1d2023'; ctx.fillRect(hx + i, hy + 2, 1.2, hxh - 4); }
  ctx.strokeStyle = '#5c6267'; ctx.lineWidth = 1; ctx.strokeRect(hx, hy, hxw, hxh);
  // vifter/piper (damp)
  o._vents = [];
  const nS = Math.max(1, Math.floor(w / 80));
  for (let k = 0; k < nS; k++) {
    const sx = x + w - 18 - k * 34, sy = ty + h * 0.32 + (k % 2) * 10, r = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(sx + 3, sy + 4, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#55595d'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#121416'; ctx.beginPath(); ctx.arc(sx, sy, r - 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(sx, sy, r - 0.5, Math.PI, Math.PI * 1.6); ctx.stroke();
    o._vents.push({ x: sx, y: sy, big: true });
  }
  // rørføring over taket
  const py = ty + h - 12;
  for (const [off, c] of [[0, '#6a6f73'], [5, '#7a4a2a']]) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + 4, py + off + 2, w - 8, 3.5);
    ctx.fillStyle = c; ctx.fillRect(x + 4, py + off, w - 8, 3.2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 4, py + off, w - 8, 0.8);
  }
  // kantrekkverk med varselhjørner
  ctx.strokeStyle = '#5b6166'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, ty + 1, w - 2, h - 2);
  for (const [cx, cy] of [[x, ty], [x + w - 10, ty], [x, ty + h - 10], [x + w - 10, ty + h - 10]]) hazard(ctx, cx, cy, 10, 10, 3);
  o._beacons.push({ x: x + 5, y: ty + 5 }, { x: x + w - 5, y: ty + 5 });
  if (o.opts.sign) { ctx.fillStyle = 'rgba(220,215,200,0.55)'; ctx.font = 'bold 11px "Arial Black", Arial'; ctx.textAlign = 'left'; ctx.fillText(o.opts.sign, x + 6, fy + e - 8); }
}

// ---------------------------------------------------------------- store rør på bakkeplan (høy dekning)
function cylH(ctx, x, y, len, d, col, flangeEvery = 48) {
  const g = ctx.createLinearGradient(0, y, 0, y + d);
  g.addColorStop(0, shade(col, -0.25)); g.addColorStop(0.25, shade(col, 0.18)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.7));
  ctx.fillStyle = g; ctx.fillRect(x, y, len, d);
  for (let i = flangeEvery / 2; i < len - 4; i += flangeEvery) {
    const fg = ctx.createLinearGradient(0, y - 1.5, 0, y + d + 1.5);
    fg.addColorStop(0, shade(col, -0.3)); fg.addColorStop(0.3, shade(col, 0.1)); fg.addColorStop(1, shade(col, -0.75));
    ctx.fillStyle = fg; ctx.fillRect(x + i, y - 1.5, 5, d + 3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + i + 5, y, 1, d);
  }
}
function cylV(ctx, x, y, len, d, col, flangeEvery = 48) {
  const g = ctx.createLinearGradient(x, 0, x + d, 0);
  g.addColorStop(0, shade(col, -0.1)); g.addColorStop(0.3, shade(col, 0.15)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.7));
  ctx.fillStyle = g; ctx.fillRect(x, y, d, len);
  for (let i = flangeEvery / 2; i < len - 4; i += flangeEvery) {
    const fg = ctx.createLinearGradient(x - 1.5, 0, x + d + 1.5, 0);
    fg.addColorStop(0, shade(col, 0)); fg.addColorStop(0.3, shade(col, 0.15)); fg.addColorStop(1, shade(col, -0.75));
    ctx.fillStyle = fg; ctx.fillRect(x - 1.5, y + i, d + 3, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y + i + 5, d, 1.2);
  }
}
function capH(ctx, cx, cy, d, col) {
  ctx.fillStyle = shade(col, -0.35); ctx.beginPath(); ctx.ellipse(cx, cy, 3, d / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
}

export function drawPipeline(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const horiz = w >= h;
  const cols = o.opts.colors || ['#5f6569', '#6b4a32'];
  const lift = e * 0.55;
  if (horiz) {
    // sviller/sadler under rørene (synlig sørside)
    for (let i = 10; i < w - 8; i += 64) {
      ctx.fillStyle = '#2c2f31'; ctx.fillRect(x + i, y + 3, 12, h - 3);
      ctx.fillStyle = '#4b4f52'; ctx.fillRect(x + i, y + h - lift - 2, 12, lift);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + i, y + h - 3, 12, 3);
      hazard(ctx, x + i, y + h - 7, 12, 4, 2.5);
    }
    const n = h >= 64 ? 2 : 1, d = (h - 6) / n;
    for (let k = 0; k < n; k++) {
      const py = y + 2 + k * (d + 2) - lift;
      // sørlig «skyggeside» (sylinderens underside mot gulvet)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, py + d, w, lift * 0.6);
      cylH(ctx, x, py, w, d, cols[k % cols.length]);
      capH(ctx, x + 1.5, py + d / 2, d, cols[k % cols.length]); capH(ctx, x + w - 1.5, py + d / 2, d, cols[k % cols.length]);
      ctx.save(); ctx.beginPath(); ctx.rect(x, py, w, d); ctx.clip();
      for (let i = 0; i < w / 40; i++) blot(ctx, x + rng() * w, py + rng() * d, rng.range(4, 10), '#5a2e14', rng.range(0.2, 0.45));
      ctx.restore();
      if (o.opts.label && k === 0) { ctx.fillStyle = 'rgba(230,225,210,0.5)'; ctx.font = 'bold 7px Arial'; ctx.textAlign = 'left'; ctx.fillText(o.opts.label, x + 24, py + d * 0.62); ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(x + 14, py + d * 0.3); ctx.lineTo(x + 20, py + d / 2); ctx.lineTo(x + 14, py + d * 0.7); ctx.fill(); }
    }
  } else {
    for (let i = 10; i < h - 8; i += 64) {
      ctx.fillStyle = '#2c2f31'; ctx.fillRect(x + 2, y + i, w - 4, 10);
      ctx.fillStyle = '#4b4f52'; ctx.fillRect(x + 2, y + i + 10 - lift, w - 4, lift);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 2, y + i + 8, w - 4, 2);
    }
    const n = w >= 64 ? 2 : 1, d = (w - 6) / n;
    for (let k = 0; k < n; k++) {
      const px = x + 2 + k * (d + 2);
      const len = h - lift;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px, y - lift + len, d, lift * 0.7);
      cylV(ctx, px, y - lift, len, d, cols[k % cols.length]);
      // synlig endeflate mot sør
      ctx.fillStyle = shade(cols[k % cols.length], -0.45); ctx.beginPath(); ctx.ellipse(px + d / 2, y - lift + len, d / 2, d * 0.28, 0, 0, Math.PI); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(px, y - lift, d, len); ctx.clip();
      for (let i = 0; i < h / 40; i++) blot(ctx, px + rng() * d, y - lift + rng() * len, rng.range(4, 10), '#5a2e14', rng.range(0.2, 0.45));
      ctx.restore();
    }
  }
  if (o.opts.valve) {
    const vx = horiz ? x + w * o.opts.valve : x + w / 2, vy = horiz ? y + h / 2 - lift : y + h * o.opts.valve - lift;
    wheel(ctx, vx, vy - 4, 7, '#a8321e');
  }
}

function wheel(ctx, x, y, r, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + 0.3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * (r - 1), y - Math.sin(a) * (r - 1)); ctx.lineTo(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)); ctx.stroke(); }
  ctx.fillStyle = '#2a2c2e'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,200,0.3)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(x, y, r - 1, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
}

// ---------------------------------------------------------------- lav rørklynge
export function drawPipes(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const horiz = w >= h;
  const cols = ['#6a7074', '#7b5236', '#596066', '#8a7a3a'];
  const n = 3, D = horiz ? h - 8 : w - 8, d = D / n;
  // støtter
  ctx.fillStyle = '#2f3234';
  if (horiz) for (let i = 6; i < w - 4; i += 28) { ctx.fillRect(x + i, y + 3, 5, h - 5); ctx.fillStyle = '#5b5f62'; ctx.fillRect(x + i, y + 3 - e, 5, h - 5); ctx.fillStyle = '#2f3234'; }
  else for (let i = 6; i < h - 4; i += 28) { ctx.fillRect(x + 3, y + i, w - 6, 5); ctx.fillStyle = '#5b5f62'; ctx.fillRect(x + 3, y + i - e, w - 6, 5); ctx.fillStyle = '#2f3234'; }
  for (let k = 0; k < n; k++) {
    const c = cols[(k + o.id) % cols.length];
    const lift = e - k * 1.5;
    if (horiz) {
      const py = y + 4 + k * d - lift;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, py + d, w, 3);
      cylH(ctx, x + 1, py, w - 2, d - 0.8, c, 36);
    } else {
      const px = x + 4 + k * d;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px, y - lift + h, d - 0.8, 3);
      cylV(ctx, px, y - lift, h, d - 0.8, c, 36);
    }
  }
  // en ventil midt på
  const vx = horiz ? x + w * 0.5 : x + w / 2, vy = horiz ? y + h / 2 - e - 2 : y + h * 0.5 - e;
  wheel(ctx, vx, vy, 5.5, '#b33a22');
  // hazard-ender
  if (horiz) { hazard(ctx, x, y + h - 4, 6, 4, 2.5); hazard(ctx, x + w - 6, y + h - 4, 6, 4, 2.5); }
  o._steam = rng.chance(0.5) ? [{ x: x + rng.range(0.2, 0.8) * w, y: y - e, small: true }] : [];
}

// ---------------------------------------------------------------- ventilstasjon (lav)
export function drawValve(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.fillStyle = '#58595a'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 3, y + h - 6, w - 6, 3);
  hazard(ctx, x + 3, y + 3, w - 6, 3, 3);
  // stuss
  const r = 6;
  ctx.fillStyle = '#3f4447'; ctx.fillRect(cx - r, cy - e, r * 2, e);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx - r + 1.5, cy - e, 1.5, e);
  ctx.fillStyle = '#5c6266'; ctx.beginPath(); ctx.arc(cx, cy - e, r, 0, Math.PI * 2); ctx.fill();
  // rør ut til siden
  ctx.fillStyle = '#6b4a32'; ctx.fillRect(x, cy - e * 0.5 - 2, w * 0.45, 4); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, cy - e * 0.5 - 2, w * 0.45, 1);
  wheel(ctx, cx, cy - e - 1, 8, o.opts.color || '#b8341f');
  // manometer
  ctx.fillStyle = '#ddd5c0'; ctx.beginPath(); ctx.arc(x + w - 7, y + 8 - e * 0.4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 0.8; ctx.stroke();
  o._steam = o.opts.leak ? [{ x: cx + 4, y: cy - e, small: true }] : [];
}

// ---------------------------------------------------------------- rørbru over hodet (ingen kollisjon)
export function drawOverpipe(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const horiz = w >= h;
  const cols = o.opts.colors || ['#666c70', '#7a5234', '#5a6266'];
  // ben (fra gulv opp til rack)
  const legs = [];
  if (horiz) { for (let i = 8; i < w; i += 128) legs.push(x + i); legs.push(x + w - 12); }
  else { for (let i = 8; i < h; i += 128) legs.push(y + i); legs.push(y + h - 12); }
  for (const p of legs) {
    if (horiz) {
      for (const ly of [y + 3, y + h - 3]) {
        ctx.fillStyle = '#26292b'; ctx.fillRect(p, ly - e, 5, e);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(p, ly - e, 1, e);
        hazard(ctx, p, ly - 8, 5, 8, 2.5);
      }
    } else {
      ctx.fillStyle = '#26292b'; ctx.fillRect(x + 2, p - e, 5, e); ctx.fillRect(x + w - 7, p - e, 5, e);
      hazard(ctx, x + 2, p - 8, 5, 8, 2.5); hazard(ctx, x + w - 7, p - 8, 5, 8, 2.5);
    }
  }
  // rack: tverrbjelker
  const ty = y - e;
  ctx.fillStyle = '#2b2e30';
  if (horiz) { for (let i = 4; i < w; i += 32) ctx.fillRect(x + i, ty, 4, h); ctx.fillRect(x, ty, w, 3); ctx.fillRect(x, ty + h - 3, w, 3); }
  else { for (let i = 4; i < h; i += 32) ctx.fillRect(x, ty + i, w, 4); ctx.fillRect(x, ty, 3, h); ctx.fillRect(x + w - 3, ty, 3, h); }
  // rør
  const n = o.opts.n || 3, D = (horiz ? h : w) - 8, d = D / n;
  for (let k = 0; k < n; k++) {
    const c = cols[k % cols.length];
    if (horiz) cylH(ctx, x, ty + 4 + k * d, w, d - 1.5, c, 64); else cylV(ctx, x + 4 + k * d, ty, h, d - 1.5, c, 64);
  }
  ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, h); ctx.clip();
  for (let i = 0; i < (w + h) / 30; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(4, 10), '#5a2e14', rng.range(0.15, 0.35));
  ctx.restore();
  // rørklammer/tverrbjelker over rørene
  for (let i = 16; i < (horiz ? w : h) - 6; i += 64) {
    ctx.fillStyle = '#1d2022'; if (horiz) ctx.fillRect(x + i, ty - 1, 3.5, h + 2); else ctx.fillRect(x - 1, ty + i, w + 2, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; if (horiz) ctx.fillRect(x + i, ty - 1, 1, h + 2); else ctx.fillRect(x - 1, ty + i, w + 2, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; if (horiz) ctx.fillRect(x, ty + h, w, 2.5); else ctx.fillRect(x + w, ty, 2.5, h);
  if (o.opts.label) {
    ctx.fillStyle = Y; ctx.font = 'bold 7px Arial'; ctx.textAlign = 'left';
    if (horiz) ctx.fillText(o.opts.label, x + 40, ty + 4 + d * 0.62);
  }
  o._steam = o.opts.leak ? [{ x: horiz ? x + w * o.opts.leak : x + w / 2, y: horiz ? ty + h / 2 : ty + h * o.opts.leak, small: false }] : [];
}

// ---------------------------------------------------------------- gangbru (ingen kollisjon)
export function drawCatwalk(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const horiz = w >= h;
  const ty = y - e;
  // ben
  const step = 96;
  if (horiz) for (let i = 12; i < w - 6; i += step) { ctx.fillStyle = '#232628'; ctx.fillRect(x + i, y + h - e - 2, 4, e); hazard(ctx, x + i, y + h - 7, 4, 7, 2); }
  else for (let i = 12; i < h - 6; i += step) { ctx.fillStyle = '#232628'; ctx.fillRect(x + w / 2 - 2, y + i - e, 4, e); hazard(ctx, x + w / 2 - 2, y + i - 7, 4, 7, 2); }
  // rist (delvis gjennomsiktig – gulvet skimtes)
  ctx.fillStyle = 'rgba(30,33,36,0.82)'; ctx.fillRect(x, ty, w, h);
  ctx.strokeStyle = 'rgba(110,116,122,0.45)'; ctx.lineWidth = 0.6;
  ctx.save(); ctx.beginPath(); ctx.rect(x + 3, ty + 3, w - 6, h - 6); ctx.clip();
  for (let i = -h; i < w + h; i += 3) { ctx.beginPath(); ctx.moveTo(x + i, ty); ctx.lineTo(x + i + h, ty + h); ctx.stroke(); }
  for (let i = 0; i < (horiz ? w : h); i += 24) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; if (horiz) ctx.fillRect(x + i, ty, 1.5, h); else ctx.fillRect(x, ty + i, w, 1.5); }
  ctx.restore();
  // rekkverk (gult) på begge sider
  ctx.strokeStyle = Y; ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (horiz) { ctx.moveTo(x, ty + 1.5); ctx.lineTo(x + w, ty + 1.5); ctx.moveTo(x, ty + h - 1.5); ctx.lineTo(x + w, ty + h - 1.5); }
  else { ctx.moveTo(x + 1.5, ty); ctx.lineTo(x + 1.5, ty + h); ctx.moveTo(x + w - 1.5, ty); ctx.lineTo(x + w - 1.5, ty + h); }
  ctx.stroke();
  ctx.fillStyle = '#7a6a2a';
  if (horiz) for (let i = 0; i <= w; i += 16) { ctx.fillRect(x + i - 1, ty, 2, 3); ctx.fillRect(x + i - 1, ty + h - 3, 2, 3); }
  else for (let i = 0; i <= h; i += 16) { ctx.fillRect(x, ty + i - 1, 3, 2); ctx.fillRect(x + w - 3, ty + i - 1, 3, 2); }
  // sørkant (tykkelse)
  if (horiz) { ctx.fillStyle = '#17191b'; ctx.fillRect(x, ty + h, w, 3); }
}
