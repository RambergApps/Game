// Generiske effekter. Et effekt-objekt: { x, y, t, life, update?(dt,world,fx), draw?(ctx,world,camera,fx), layer?:'under'|'over' }
export function addEffect(world, fx) { const e = { t: 0, life: 0.3, layer: 'over', ...fx }; world.effects.push(e); return e; }
export function updateEffects(dt, world) {
  for (const e of world.effects) { e.t += dt; e.update?.(dt, world, e); }
  world.effects = world.effects.filter((e) => e.t < e.life && !e.dead);
}
export function drawEffects(ctx, world, camera, layer = 'over') {
  for (const e of world.effects) if ((e.layer || 'over') === layer && e.draw) { ctx.save(); e.draw(ctx, world, camera, e); ctx.restore(); }
}
/** Gnister (standard støt-effekt). */
export function sparks(world, x, y, color = '#ffb347', n = 6, angle = null) {
  for (let i = 0; i < n; i++) {
    const a = angle === null ? world.rng() * Math.PI * 2 : angle + (world.rng() - 0.5) * 1.6, s = 80 + world.rng() * 220;
    addEffect(world, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.15 + world.rng() * 0.2,
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy *= 0.9; },
      draw(ctx, w, c, f) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - f.t / f.life; ctx.fillStyle = color; ctx.fillRect(f.x - 1, f.y - 1, 2, 2); } });
  }
}
