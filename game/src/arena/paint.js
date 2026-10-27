// Små tegnehjelpere for arenagrafikk (Canvas 2D).

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try { return new OffscreenCanvas(Math.ceil(w), Math.ceil(h)); } catch (e) { /* fall back */ }
  }
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  return c;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// amt -1..1: mot svart (negativ) eller hvit (positiv)
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return `rgb(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)})`;
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Diagonale varselstriper innenfor et rektangel
export function hazard(ctx, x, y, w, h, stripe = 8, col = '#c9a227', dark = '#16171a') {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = dark;
  const n = Math.ceil((w + h) / stripe) + 2;
  for (let i = -2; i < n; i += 2) {
    const sx = x + i * stripe;
    ctx.beginPath();
    ctx.moveTo(sx, y); ctx.lineTo(sx + stripe, y);
    ctx.lineTo(sx + stripe - h, y + h); ctx.lineTo(sx - h, y + h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Myk flekk (radial gradient)
export function blot(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.6, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function chevron(ctx, cx, cy, s, dir = -Math.PI / 2) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(dir + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.35); ctx.lineTo(0, -s * 0.45); ctx.lineTo(s, s * 0.35);
  ctx.lineTo(s, s * 0.75); ctx.lineTo(0, -s * 0.05); ctx.lineTo(-s, s * 0.75);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
