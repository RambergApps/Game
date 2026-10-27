// BREACH – felles tegnehjelpere for nivå-HUD og oppgraderingskort (eies av Nivåer og story).
// Palett fra PROSJEKT.md. Fonten deles med story (Barlow Condensed, OFL).
export const C = {
  visor: '#39c6ff', light: '#ffb347', hazard: '#c9a227', concrete: '#2b2e31', metal: '#3d4246',
  armor: '#3a3f45', armorL: '#5a6068', fabric: '#8a7a5c', ink: '#e8e2d4', dim: '#8d949b', red: '#e5533d',
  grunt: '#c0392b',
};
export const ROLE = {
  forsvar: { col: '#39c6ff', label: 'DEFENSE' },
  angrep: { col: '#ffb347', label: 'OFFENSE' },
  taktikk: { col: '#c9a227', label: 'TACTICS' },
};

let fontP = null, fontOk = false;
export function loadFont() {
  if (fontP) return fontP;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return (fontP = Promise.resolve());
  const base = new URL('../story/fonts/', import.meta.url);
  const faces = [['400', 'BarlowCondensed-Regular.ttf'], ['600', 'BarlowCondensed-SemiBold.ttf']]
    .map(([w, f]) => new FontFace('Barlow Condensed', `url(${new URL(f, base)})`, { weight: w }));
  fontP = Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)).catch(() => null))).then(() => { fontOk = true; });
  return fontP;
}
export const font = (px, w = 600) => `${w} ${Math.round(px)}px "Barlow Condensed", "Arial Narrow", sans-serif`;

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/** Tekst med bokstavavstand (canvas letterSpacing finnes ikke overalt). */
export function spaced(ctx, text, x, y, sp, align = 'left') {
  if (!sp) { ctx.textAlign = align; ctx.fillText(text, x, y); return; }
  const chars = [...text]; let w = 0;
  for (const ch of chars) w += ctx.measureText(ch).width + sp;
  w -= sp;
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
  return w;
}
export function spacedWidth(ctx, text, sp) { let w = 0; for (const ch of text) w += ctx.measureText(ch).width + sp; return w - sp; }

/** Plate med avskårne hjørner (cut = [tl, tr, br, bl]). */
export function platePath(ctx, x, y, w, h, cut = [10, 0, 10, 0]) {
  const [a, b, c, d] = cut;
  ctx.beginPath();
  ctx.moveTo(x + a, y); ctx.lineTo(x + w - b, y); ctx.lineTo(x + w, y + b);
  ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + d, y + h);
  ctx.lineTo(x, y + h - d); ctx.lineTo(x, y + a); ctx.closePath();
}

/** Varselstriper innenfor et rektangel. */
export function hazard(ctx, x, y, w, h, a = 1, step = 12) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = rgba('#141516', a); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(C.hazard, a);
  for (let i = -h; i < w + h; i += step * 2) {
    ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + step, y + h); ctx.lineTo(x + i + step + h, y); ctx.lineTo(x + i + h, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
