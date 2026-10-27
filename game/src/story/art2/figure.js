// BREACH – art2: skissefigurer (sidevisning) for mellomsekvensene. Alle designkjennetegn leses fra CHARACTER_STYLE.
// Bevisst skissenivå (blekkontur + 2–3 toner) til Karakters malte v3 er godkjent.
import { CHARACTER_STYLE as CS } from './style.js';
import { rgba, glow } from '../art.js';

const cap = (p, x1, y1, x2, y2, r) => { const a = Math.atan2(y2 - y1, x2 - x1); p.moveTo(x1 + Math.cos(a + Math.PI / 2) * r, y1 + Math.sin(a + Math.PI / 2) * r); p.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2); p.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2); p.closePath(); };
const P = (fn) => { const p = new Path2D(); fn(p); return p; };

/** Fyll en sti med toneovergang (lys oppe/foran) + blekkontur. */
function part(ctx, path, tone, lw, rim) {
  const g = ctx.createLinearGradient(0, -110, 0, 0); g.addColorStop(0, tone.l); g.addColorStop(0.5, tone.m); g.addColorStop(1, tone.d);
  ctx.fillStyle = g; ctx.fill(path);
  if (rim) { ctx.save(); ctx.clip(path); ctx.strokeStyle = rgba(rim.col, rim.a); ctx.lineWidth = lw * 3; ctx.translate(-rim.dx, -1); ctx.stroke(path); ctx.restore(); }
  ctx.strokeStyle = CS.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(path);
}

/**
 * Troppssoldat (Warden, Hale, Okafor, Brandt). o: { x, y (føtter), s (px per enhet), flip, who, skin: 'warden'|'protocol'|'dark',
 * pose: 'stand'|'aim'|'low', rim: farge for kantlys (standard kaldt), rimA, glowA }
 */
export function soldier(ctx, o) {
  const who = CS.squad[o.who || 'warden'] || CS.squad.warden, G = CS.glow[o.skin || who.skin];
  const S = CS.shape, s = o.s || 1, lw = Math.max(1.1, 2.2 / s * Math.min(3, s)) / s * 1.4;
  const rim = { col: o.rim || CS.rim, a: o.rimA ?? 0.55, dx: 2.2 };
  const aim = o.pose !== 'low';
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.flip ? -s : s, s);
  // sekk + antenne (baksiden)
  const pk = S.pack, ant = who.longAntenna ? [[-20, -84], [-34, -130]] : S.antenna;
  ctx.strokeStyle = CS.gun.l; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ant[0][0], ant[0][1]); ctx.quadraticCurveTo(ant[0][0] - 2, (ant[0][1] + ant[1][1]) / 2, ant[1][0], ant[1][1]); ctx.stroke();
  part(ctx, P((p) => p.roundRect(pk.x, pk.y, pk.w, pk.h, 3)), CS.armor, lw, rim);
  if (G.led) { glow(ctx, pk.x + 4, pk.y + 7, 7, G.led, 0.8); ctx.fillStyle = G.led; ctx.fillRect(pk.x + 3, pk.y + 6, 2.4, 2.4); }
  // bein
  part(ctx, P((p) => { cap(p, -4, -46, -8, -24, 5.5); cap(p, -8, -24, -6, -3, 5); }), CS.suit, lw, rim);
  part(ctx, P((p) => { cap(p, 4, -46, 9, -24, 5.8); cap(p, 9, -24, 7, -3, 5.2); }), CS.suit, lw, rim);
  part(ctx, P((p) => { p.roundRect(-13, -6, 14, 6, 2); p.roundRect(2, -6, 15, 6, 2); }), CS.gun, lw, null);   // støvler
  // overkropp + belte
  part(ctx, P((p) => p.roundRect(-13, -84, 25, 40, 6)), CS.armor, lw, rim);
  ctx.fillStyle = CS.suit.d; ctx.fillRect(-13, -50, 25, 5);
  // rifle (lang – retningssignalet): blå strek, prikk på siktet
  const ry = S.rifle.y + (aim ? 0 : 10), len = S.rifle.len;
  part(ctx, P((p) => { p.roundRect(-6, ry - 3, len, 6, 1.5); p.roundRect(8, ry + 2, 6, 10, 1); p.roundRect(-10, ry - 2, 8, 7, 2); }), CS.gun, lw, null);
  ctx.strokeStyle = o.skin === 'protocol' ? 'rgba(120,36,30,0.9)' : rgba(CS.blue, 0.85); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, ry); ctx.lineTo(len - 10, ry); ctx.stroke();
  if (G.sight) { glow(ctx, 18, ry - 5, 5, G.sight, 0.9); ctx.fillStyle = G.sight; ctx.fillRect(17, ry - 6, 2, 2); }
  // arm til grepet
  part(ctx, P((p) => { cap(p, 2, -78, 8, -64, 4.2); cap(p, 8, -64, 16, ry + 1, 3.8); }), CS.suit, lw, rim);
  // skulderplate: blått felt + Λ
  const sp = P((p) => p.roundRect(-8, -86, 16, 13, 5));
  part(ctx, sp, CS.armorLight, lw, rim);
  for (let i = 0; i < who.stripes; i++) { ctx.fillStyle = o.skin === 'protocol' ? '#a32a1e' : CS.blue; ctx.fillRect(-7 + i * 5, -84, 3.2, 9); }
  if (who.stripes) { ctx.strokeStyle = CS.emblem; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(3, -76); ctx.lineTo(5, -82); ctx.lineTo(7, -76); ctx.stroke(); }
  // skjerf: krage + to haler bakover over sekken
  if (who.scarf) {
    const sc = { ...CS.scarf, ...(who.scarfCol ? { l: who.scarfCol, m: who.scarfCol, d: '#2a2c28' } : {}) };
    part(ctx, P((p) => { p.moveTo(-11, -86); p.bezierCurveTo(-20, -82, -24, -70, -30, -60); p.lineTo(-25, -59); p.bezierCurveTo(-20, -70, -16, -78, -9, -82); p.closePath();
      p.moveTo(-10, -84); p.bezierCurveTo(-18, -76, -18, -64, -22, -54); p.lineTo(-18, -54); p.bezierCurveTo(-14, -64, -13, -74, -7, -80); p.closePath(); }), sc, lw, null);
    part(ctx, P((p) => p.ellipse(0, -86, 13, 5, 0, 0, Math.PI * 2)), sc, lw, null);
  }
  // hjelm: rund, lys topp-stripe, bred visirbue foran
  const R = S.helmetR, hy = -97;
  part(ctx, P((p) => p.arc(2, hy, R, 0, Math.PI * 2)), CS.armorLight, lw, rim);
  ctx.strokeStyle = rgba(CS.armorLight.l, 0.9); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(2, hy, R - 1.6, -2.4, -1.0); ctx.stroke();
  const [a0, a1] = S.visorArc;
  ctx.fillStyle = '#071016'; ctx.beginPath(); ctx.arc(2, hy, R + 0.6, a0, a1); ctx.arc(2, hy, R - 5, a1, a0, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = G.visor; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(2, hy, R - 1.2, a0 + 0.15, a1 - 0.1); ctx.stroke();
  if (o.skin !== 'dark') glow(ctx, 2 + R * 0.8, hy, 12, G.visor, (o.glowA ?? 0.6));
  else { ctx.strokeStyle = 'rgba(169,192,210,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(2, hy, R - 1.2, a0 + 0.3, a0 + 0.7); ctx.stroke(); } // slukket: kun kaldt gjenskinn
  ctx.restore();
}

/** Protocol-fiende i skisse (grunt/flanker/heavy/grenadier). Varm palett, ingen cyan. */
export function enemy(ctx, o) {
  const E = CS.enemy[o.type] || CS.enemy.grunt, s = o.s || 1, lw = 1.6 / Math.min(1.4, s * 0.5);
  const rim = { col: o.rim || '#ff8a3a', a: o.rimA ?? 0.6, dx: 2.2 };
  const dark = { d: '#0a0807', m: '#1a1412', l: '#2c221d' };
  const big = o.type === 'heavy' ? 1.25 : 1;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale((o.flip ? -s : s) * big, s * big);
  part(ctx, P((p) => { cap(p, -4, -46, -7, -4, 5.5); cap(p, 4, -46, 8, -4, 5.8); }), dark, lw, rim);
  part(ctx, P((p) => p.roundRect(-13, -84, 25, 40, 6)), dark, lw, rim);
  if (o.type === 'heavy') { part(ctx, P((p) => p.roundRect(-30, -86, 18, 38, 4)), dark, lw, rim); glow(ctx, 4, -68, 14, E.glow, 0.8); }
  if (o.type === 'grenadier') for (let i = 0; i < 3; i++) { ctx.fillStyle = '#2b2236'; ctx.beginPath(); ctx.arc(-6 + i * 7, -66, 3, 0, 7); ctx.fill(); }
  part(ctx, P((p) => p.roundRect(-6, -70, o.type === 'flanker' ? 34 : 46, 6, 1.5)), dark, lw, null);
  part(ctx, P((p) => p.roundRect(-8, -86, 16, 12, 4)), dark, lw, rim);
  ctx.fillStyle = E.accent; ctx.fillRect(-7, -84, 4, 8);
  if (o.type === 'flanker') part(ctx, P((p) => { p.moveTo(-10, -86); p.quadraticCurveTo(-6, -118, 10, -104); p.quadraticCurveTo(14, -92, 10, -86); p.closePath(); p.moveTo(-12, -84); p.lineTo(-30, -40); p.lineTo(-14, -46); p.closePath(); }), { d: '#2a0808', m: E.accent, l: '#b03030' }, lw, null);
  else part(ctx, P((p) => p.arc(2, -97, 10.5, 0, Math.PI * 2)), dark, lw, rim);
  if (o.type === 'grenadier') { for (const dx of [6, 11]) { glow(ctx, dx, -97, 6, E.glow, 0.9); ctx.fillStyle = E.glow; ctx.beginPath(); ctx.arc(dx, -97, 2, 0, 7); ctx.fill(); } }
  else { ctx.strokeStyle = E.glow; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(4, -98); ctx.lineTo(12, -98); ctx.stroke(); glow(ctx, 9, -98, 10, E.glow, 0.7); }
  ctx.restore();
}
