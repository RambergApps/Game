import { lineOfSight } from './geom.js';
// F1-overlay: cover-rektangler, LOS-linjer spiller↔fiender, nærmeste cover, fps.
export function drawDebugWorld(ctx, world) {
  ctx.save(); ctx.lineWidth = 1;
  for (const c of world.cover) { ctx.strokeStyle = c.type === 'high' ? '#ff3b3b' : '#3bff7a'; ctx.setLineDash(c.type === 'high' ? [] : [4, 3]); ctx.strokeRect(c.x, c.y, c.w, c.h); ctx.fillStyle = ctx.strokeStyle; ctx.font = '8px monospace'; ctx.fillText(c.type, c.x + 2, c.y + 9); }
  ctx.setLineDash([]);
  const p = world.player;
  if (p) for (const e of world.enemies) { if (e.dead) continue; const ok = lineOfSight(world, p.x, p.y, e.x, e.y); ctx.strokeStyle = ok ? 'rgba(80,255,120,.8)' : 'rgba(255,60,60,.6)'; ctx.setLineDash(ok ? [] : [3, 4]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(e.x, e.y); ctx.stroke(); }
  ctx.setLineDash([]);
  for (const a of [p, ...world.enemies]) if (a && !a.dead) { ctx.strokeStyle = '#ffff00'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r || 14, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
export function drawDebugHud(ctx, world, stats) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(8, 8, 250, 92);
  ctx.fillStyle = '#39c6ff'; ctx.font = '12px monospace';
  const m = world.input.mouse;
  [`DEBUG (F1)  fps ${stats.fps.toFixed(0)}`, `t ${world.time.toFixed(2)}s  steps ${stats.steps}`, `enemies ${world.enemies.filter((e) => !e.dead).length}  bullets ${world.projectiles.length}`, `effects ${world.effects.length}  cover ${world.cover.length}`, `mouse ${m.worldX.toFixed(0)},${m.worldY.toFixed(0)}`, `player ${world.player ? world.player.x.toFixed(0) + ',' + world.player.y.toFixed(0) : '-'}`]
    .forEach((s, i) => ctx.fillText(s, 16, 24 + i * 13));
  ctx.restore();
}
