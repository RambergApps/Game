// Ammokasser – logikk + tilstandsvisning. Kalles fra weapons.update / weapons.draw (ikke direkte fra andre moduler).
// Kontrakt mot Arena:
//   Arena skriver world.arena.ammoCrates = [{ id, x, y }] og tegner selve kassekroppen.
//   Vi skriver på hvert kasseobjekt: ready (bool), readyAt (world.time når den er klar igjen; 0 = klar), lastUsedBy.
//   Vi tegner bare tilstandslyset oppå kassens posisjon (cyan glød + ammo-ikon / rødlig + nedtellingsring / puls).
// Bare team 'player' kan bruke kasser. Kassen brennes IKKE hvis alt allerede er fullt.
import { TUNING } from './data.js';
import { refill, needsRefill } from './index.js';   // sirkulær import er trygg: brukes bare ved kall

const TAU = Math.PI * 2;
export const cratesOf = (world) => (Array.isArray(world.arena?.ammoCrates) ? world.arena.ammoCrates : []);

export function updateCrates(dt, world) {
  const T = TUNING.ammoCrate, list = cratesOf(world); if (!list.length) return;
  const players = (world._weapons?.loadouts || []).filter((e) => e.team === 'player' && !e.dead && e.loadout);
  if (world.player && !players.includes(world.player) && world.player.loadout && !world.player.dead) players.push(world.player);
  for (const c of list) {
    if (c.readyAt === undefined) c.readyAt = 0;
    const wasReady = c.ready;
    c.ready = world.time >= c.readyAt;
    if (c.ready && wasReady === false) c._pulseT = T.pulse;   // klar igjen → kort puls
    if (c._pulseT > 0) c._pulseT = Math.max(0, c._pulseT - dt);
    if (!c.ready) continue;
    for (const e of players) {
      if (Math.hypot(e.x - c.x, e.y - c.y) > T.radius) continue;
      const opts = { allWeapons: T.allWeapons, grenades: T.grenades, grenadeMax: T.grenadeMax ?? undefined, emit: true, crateId: c.id ?? null };
      if (!needsRefill(world, e, opts)) continue;   // alt fullt: ikke brenn nedkjølingen
      refill(world, e, opts);
      c.readyAt = world.time + T.cooldown; c.ready = false; c.lastUsedBy = e; c._usedT = 0.35;
      break;
    }
  }
}

export function drawCrates(ctx, world) {
  const T = TUNING.ammoCrate, list = cratesOf(world); if (!list.length) return;
  const t = world.time;
  ctx.save();
  for (const c of list) {
    const ready = c.ready ?? t >= (c.readyAt || 0), x = c.x, y = c.y;
    if (ready) {
      const k = 0.75 + 0.25 * Math.sin(t * 4 + (x + y) * 0.01);
      const g = ctx.createRadialGradient(x, y, 2, x, y, 30); g.addColorStop(0, `rgba(57,198,255,${0.45 * k})`); g.addColorStop(1, 'rgba(57,198,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
      // ammo-ikon: tre patroner
      for (let i = -1; i <= 1; i++) {
        const bx = x + i * 5 - 1.5, by = y - 6;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx + 0.8, by + 0.8, 3, 11);
        ctx.fillStyle = '#e8fbff'; ctx.fillRect(bx, by + 3, 3, 8); ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.moveTo(bx, by + 3); ctx.lineTo(bx + 1.5, by); ctx.lineTo(bx + 3, by + 3); ctx.fill();
      }
      ctx.strokeStyle = `rgba(57,198,255,${0.6 * k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, T.radius, 0, TAU); ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    } else {
      const left = Math.max(0, (c.readyAt || 0) - t), frac = 1 - left / T.cooldown;
      ctx.fillStyle = 'rgba(255,90,70,.16)'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,90,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
      ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(String(Math.ceil(left)), x + 0.7, y + 0.7); ctx.fillStyle = 'rgba(255,190,170,.95)'; ctx.fillText(String(Math.ceil(left)), x, y);
    }
    if (c._pulseT > 0) { const p = 1 - c._pulseT / T.pulse; ctx.strokeStyle = `rgba(160,235,255,${1 - p})`; ctx.lineWidth = 3 * (1 - p) + 1; ctx.beginPath(); ctx.arc(x, y, 12 + p * 30, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}
