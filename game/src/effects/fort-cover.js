// MOCKUP «Ringborgen» v1 (28.10) – skyteskår-barriere for portene i S5. Bare for cover-objekter med fort:true.
// Lav stålbarriere (man skyter over den): sandsekkleppe på toppen, skjold med skårhakk mot vest, mørk vannrett skyteluke på sørfronten, varselkant.
// Samme koordinatsystem som paintSteelLow i cover.js: x ∈ [0,w], topp y ∈ [0,top], front ned til yb. Bare rette flater.
const rgb = (c, k = 0, a = 1) => `rgba(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + k))))).join(',')},${a})`;
function hazard(c, x, y, w, h, s) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#c99a1c'; c.fillRect(x, y, w, h); c.fillStyle = '#1b1a17'; for (let i = -h - s * 2; i < w + h; i += s * 2) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + s, y + h); c.lineTo(x + i + s + h, y); c.lineTo(x + i + h, y); c.fill(); } c.fillStyle = 'rgba(40,30,20,0.3)'; c.fillRect(x, y, w, h); c.restore(); }
const JUTE = [[100, 86, 62], [92, 84, 64], [86, 78, 58]];
function bag(c, R, x, y, w, h) {
  const col = JUTE[Math.floor(R() * JUTE.length)];
  c.fillStyle = 'rgba(8,6,4,0.4)'; c.beginPath(); c.ellipse(x + w / 2 + 0.6, y + h / 2 + 0.9, w / 2 + 0.4, h / 2 + 0.3, 0, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(x + w * 0.35, y + h * 0.3, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.6);
  g.addColorStop(0, rgb(col, 0.18)); g.addColorStop(0.6, rgb(col, -0.05)); g.addColorStop(1, rgb(col, -0.4));
  c.fillStyle = g; c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(20,14,8,0.55)'; c.lineWidth = 0.5; c.stroke();
}
export function paintLoophole(c, R, S) {
  const { w, f } = S, d0 = S.d, BASE = [88, 94, 100];
  const y0 = f * 0.2, yb = d0 + f - y0, ft = Math.max(f * 0.75, d0 * 0.68), top = yb - ft, ch = Math.min(ft * 0.2, 3);
  c.save(); c.translate(0, y0);
  // skygge mot øst/sør
  for (let q = 5; q >= 0; q--) { const e = q * 1.4; c.fillStyle = 'rgba(0,0,0,0.17)'; c.fillRect(w * 0.05, yb - 1, w + 4 + e, 4 + e * 0.6); c.fillRect(w - 1, top * 0.35, 4 + e, yb - top * 0.35); }
  c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(-0.5, yb - 0.6, w + 1.5, 1.6);
  // TOPP: mørk stålplate
  c.fillStyle = rgb(BASE, -0.5); c.fillRect(0, 0, w, top);
  c.fillStyle = rgb(BASE, 0.5); c.fillRect(0, 0, w, 0.9);
  if (S.horiz) {   // øst–vest: sekker i nordre halvdel, skjold med skårhakk langs sørkanten av toppen
    const n = Math.max(2, Math.round(w / 9)), bw = w / n;
    for (let i = 0; i < n; i++) bag(c, R, i * bw + 0.3, 0.3, bw * 1.04, top * 0.55);
    const sy0 = top * 0.58; c.fillStyle = rgb(BASE, -0.15); c.fillRect(0, sy0, w, top - sy0);
    c.fillStyle = rgb(BASE, 0.45); c.fillRect(0, sy0, w, 0.9);
    const k = Math.max(1, Math.round(w / 16));
    for (let j = 0; j < k; j++) { const cx = w * (j + 0.5) / k, sw = Math.min(6, w / k * 0.4); c.fillStyle = '#07080a'; c.fillRect(cx - sw / 2, sy0 + 0.9, sw, top - sy0 - 0.9); }
  } else {
  // sandsekkleppe i østre halvdel av toppen (rad med sekker langs lengden)
    const bw = w * 0.5, bx = w * 0.46, n = Math.max(2, Math.round(top / 7)), bh = top / n;
    for (let i = 0; i < n; i++) bag(c, R, bx, i * bh + 0.3, bw, bh * 1.05);
    // stålskjold langs vestkanten med skårhakk (mørke åpninger ovenfra)
    const sw = w * 0.36;
    c.fillStyle = rgb(BASE, -0.15); c.fillRect(0, 0, sw, top);
    c.fillStyle = rgb(BASE, 0.45); c.fillRect(0, 0, 0.9, top);
    c.fillStyle = rgb(BASE, -0.6); c.fillRect(sw - 1, 0, 1, top);
    const k = Math.max(1, Math.round(top / 16));
    for (let j = 0; j < k; j++) { const cy = top * (j + 0.5) / k, sh = Math.min(5, top / k * 0.38);
      c.fillStyle = '#07080a'; c.fillRect(0, cy - sh / 2, sw - 1, sh);
      c.fillStyle = rgb(BASE, 0.35); c.fillRect(0, cy - sh / 2 - 0.8, sw - 1, 0.8); }
  }
  // fase
  c.fillStyle = rgb(BASE, 0.45); c.fillRect(0, top, w, ch);
  // FRONT (sør): stålplate med mørk vannrett skyteluke + varselkant nederst
  const fy = top + ch, fh = yb - fy;
  const gr = c.createLinearGradient(0, fy, 0, yb); gr.addColorStop(0, rgb(BASE, -0.05)); gr.addColorStop(1, rgb(BASE, -0.42)); c.fillStyle = gr; c.fillRect(0, fy, w, fh);
  c.fillStyle = rgb(BASE, -0.7); c.fillRect(w - 1.6, fy, 1.6, fh);
  const sy = fy + fh * 0.22, sH = Math.max(2, fh * 0.2);
  c.fillStyle = rgb(BASE, 0.4); c.fillRect(2, sy - 1, w - 4, 1);          // lys leppe over luka
  c.fillStyle = '#060708'; c.fillRect(2.5, sy, w - 5, sH);                // skyteluka
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(2.5, sy + sH, w - 5, 0.8);
  hazard(c, 0.5, fy + fh * 0.62, w - 2.2, fh * 0.26, 1.5);
  for (const xx of [1.6, w - 3.4]) for (const yy of [fy + 1.2, yb - 1.6]) { c.fillStyle = rgb(BASE, 0.4); c.fillRect(xx, yy, 0.9, 0.9); }
  for (let q = 0; q < 3; q++) { c.fillStyle = `rgba(110,56,24,${R.r(0.25, 0.5)})`; c.fillRect(R() * w, fy + R.r(0.4, 0.6) * fh, R.r(0.6, 1.2), fh * R.r(0.2, 0.4)); }
  c.restore();
}
