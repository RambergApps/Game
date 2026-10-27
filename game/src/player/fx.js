// Partikler og effekter for Warden via core-effekter (addEffect). Bruker world.rng (deterministisk).
import { addEffect } from '../core/index.js';
import { TAU } from './math.js';

let PUFF = null;
function puff() {
  if (PUFF) return PUFF;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(150,146,138,1)'); r.addColorStop(0.45, 'rgba(120,117,110,.5)'); r.addColorStop(1, 'rgba(110,108,100,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (PUFF = c);
}

/** Støvdotter. dir = hovedretning (rad) eller null (alle retninger). */
export function dust(world, x, y, n, spd, size, life, dir = null, spreadA = 1.6) {
  const R = world.rng;
  for (let i = 0; i < n; i++) {
    const a = dir === null ? R() * TAU : dir + (R() - 0.5) * spreadA, v = spd * (0.3 + R() * 0.7);
    addEffect(world, {
      x: x + (R() - 0.5) * 6, y: y + (R() - 0.5) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: size * (0.6 + R() * 0.6), gr: size * 1.5,
      life: life * (0.7 + R() * 0.6), al: 0.2 + R() * 0.16, layer: 'under',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.exp(-3 * dt); f.vx *= k; f.vy *= k; f.r += f.gr * dt; },
      draw(ctx, w, c, f) { const k = f.t / f.life; ctx.globalAlpha = f.al * (1 - k) * (k < 0.12 ? k / 0.12 : 1); ctx.drawImage(puff(), f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); },
    });
  }
}

/** Skrapegnister fra støvler mot metallgulv (korte, varme streker). */
export function scrapeSparks(world, x, y, dir, n = 2, spd = 220) {
  const R = world.rng;
  for (let i = 0; i < n; i++) {
    const a = dir + (R() - 0.5) * 0.9, v = spd * (0.5 + R() * 0.8);
    addEffect(world, {
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.12 + R() * 0.16, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.exp(-6 * dt); f.vx *= k; f.vy *= k; },
      draw(ctx, w, c, f) {
        const k = f.t / f.life; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,${(200 - k * 90) | 0},${(110 - k * 60) | 0},${1 - k})`; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.025, f.y - f.vy * 0.025); ctx.stroke();
      },
    });
  }
}

/** Småbiter (betong/maling) som spretter fra dekningen ved hard stopp. */
export function debris(world, x, y, dir, n = 6) {
  const R = world.rng;
  for (let i = 0; i < n; i++) {
    const a = dir + (R() - 0.5) * 2.2, v = 60 + R() * 120;
    addEffect(world, {
      x, y, z: 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 60 + R() * 80, s: 0.8 + R() * 1.1, life: 2.5, layer: 'under',
      update(dt, w, f) { if (f.z <= 0 && Math.abs(f.vz) < 10) return; f.vz -= 600 * dt; f.z += f.vz * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.z < 0) { f.z = 0; f.vz = -f.vz * 0.3; f.vx *= 0.5; f.vy *= 0.5; } },
      draw(ctx, w, c, f) { ctx.globalAlpha = Math.min(1, (f.life - f.t) * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(f.x + f.z * 0.3, f.y + f.z * 0.45, f.s, f.s); ctx.fillStyle = '#6a6c6d'; ctx.fillRect(f.x, f.y - f.z * 0.2, f.s, f.s); },
    });
  }
}
