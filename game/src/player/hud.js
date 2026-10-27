// Warden – skjerm-HUD (HP). All tekst på skjermen er engelsk.
import { TUNING as T } from './tuning.js';

export function drawHpBar(ctx, world, p, P) {
  const W = ctx.canvas.width, H = ctx.canvas.height, s = Math.max(1, Math.min(1.4, H / 800));
  const x = 22 * s, y = H - 26 * s, w = 220 * s, h = 12 * s;
  const frac = Math.max(0, p.hp / p.maxHp), shown = P.hpShown ?? frac;
  ctx.save();
  // panel
  ctx.fillStyle = 'rgba(12,16,20,.72)'; ctx.beginPath(); ctx.moveTo(x - 10 * s, y - 30 * s); ctx.lineTo(x + w + 4 * s, y - 30 * s); ctx.lineTo(x + w + 14 * s, y - 20 * s); ctx.lineTo(x + w + 14 * s, y + h + 10 * s); ctx.lineTo(x - 10 * s, y + h + 10 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,150,170,.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#39c6ff'; ctx.fillRect(x - 10 * s, y - 30 * s, 40 * s, 2 * s);
  ctx.font = `700 ${11 * s}px system-ui, sans-serif`; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#9aa4ad'; ctx.fillText('WARDEN', x, y - 12 * s);
  const st = p.dead ? 'DOWN' : P.health === 'regen' ? 'REGENERATING' : frac < T.omenSymbolBelow ? 'CRITICAL' : '';
  if (st) { ctx.fillStyle = p.dead || frac < T.omenSymbolBelow ? '#ff6a55' : '#7fd8ff'; ctx.fillText(st, x + 62 * s, y - 12 * s); }
  ctx.textAlign = 'right'; ctx.fillStyle = '#e8edf1'; ctx.font = `700 ${13 * s}px system-ui, sans-serif`;
  ctx.fillText(`${Math.ceil(p.hp)}`, x + w, y - 12 * s); ctx.textAlign = 'left';
  // bar
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x, y, w, h);
  if (shown > frac) { ctx.fillStyle = 'rgba(255,120,90,.55)'; ctx.fillRect(x + w * frac, y, w * (shown - frac), h); }
  const col = frac < T.omenSymbolBelow ? '#ff5a45' : frac < 0.6 ? '#ffb347' : '#cfe9f5';
  ctx.fillStyle = col; ctx.fillRect(x, y, w * frac, h);
  if (P.health === 'regen') {   // påfylling: pulserende blå glød rundt baren, løpende glans og lysende fyllkant
    const pu = 0.5 + 0.5 * Math.sin(world.time * 5);
    ctx.save(); ctx.shadowColor = 'rgba(57,198,255,.9)'; ctx.shadowBlur = (4 + 8 * pu) * s;
    ctx.strokeStyle = `rgba(57,198,255,${0.4 + 0.45 * pu})`; ctx.lineWidth = 1.5 * s; ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s); ctx.restore();
    const k = (world.time * 1.6) % 1; const g = ctx.createLinearGradient(x + w * frac * (k - .2), 0, x + w * frac * k, 0); g.addColorStop(0, 'rgba(57,198,255,0)'); g.addColorStop(1, 'rgba(57,198,255,.6)'); ctx.fillStyle = g; ctx.fillRect(x, y, w * frac, h);
    ctx.fillStyle = `rgba(200,240,255,${0.75 + 0.25 * pu})`; ctx.fillRect(x + w * frac - 1.5 * s, y - 2 * s, 3 * s, h + 4 * s);
  }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 10; i++) ctx.fillRect(x + w * i / 10 - 0.5, y, 1, h);
  ctx.restore();
}

/** Lav-HP-vignett (omen). */
export function drawVignette(ctx, world, p) {
  const frac = p.hp / p.maxHp; if (p.dead || frac >= T.omenVignetteStart) return;
  const k = 1 - frac / T.omenVignetteStart, W = ctx.canvas.width, H = ctx.canvas.height;
  const pulse = frac < T.omenSymbolBelow ? 0.75 + 0.25 * Math.sin(world.time * 6) : 1;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(120,10,6,0)'); g.addColorStop(1, `rgba(120,10,6,${0.42 * k * pulse})`);
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
