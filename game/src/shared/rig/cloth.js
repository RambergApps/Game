// Verlet-kjeder i verdensrom (skjerfender, senere kapper/hetter for fiender). KARAKTER-SPEC §5.4.
import { clamp } from './math.js';
/** spec: { anchor:[lx,ly] (torso-rom), segments, length } */
export function createChain(spec, x, y) {
  const pts = []; for (let i = 0; i <= spec.segments; i++) pts.push({ x: x - i * spec.length, y, px: x - i * spec.length, py: y });
  return { spec, pts, t: Math.random() * 10 };
}
/** L2W: torso-rom → verden. back: enhetsvektor for torso −x. drag: multiplikator (rull/slide ×2). */
export function stepChain(ch, dt, L2W, back, vel, drag = 1, avoid) {
  const { spec, pts } = ch; ch.t += dt;
  const a0 = L2W(spec.anchor[0], spec.anchor[1]); pts[0].x = a0[0]; pts[0].y = a0[1]; pts[0].px = a0[0]; pts[0].py = a0[1];
  const spd = Math.hypot(vel.x, vel.y);
  const nAmp = 40 * spd / 300, dt2 = dt * dt;
  for (let i = 1; i < pts.length; i++) { const p = pts[i];
    const nx = Math.sin(ch.t * 6 * 6.283 * .16 + i * 1.7 + spec.anchor[1]) * nAmp, ny = Math.cos(ch.t * 6 * 6.283 * .13 + i * 2.3) * nAmp;
    const ax = (-0.6 * vel.x + back.x * 120) * drag + nx, ay = (-0.6 * vel.y + back.y * 120) * drag + ny;
    const vx = (p.x - p.px) * .9, vy = (p.y - p.py) * .9; p.px = p.x; p.py = p.y; p.x += vx + ax * dt2; p.y += vy + ay * dt2; }
  for (let it = 0; it < 3; it++) {
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1e-4;
      // vinkelgrense ±35° mot forrige ledd
      if (i > 1) { const pa = pts[i - 2]; const ref = Math.atan2(a.y - pa.y, a.x - pa.x); let ang = Math.atan2(dy, dx); let df = ang - ref; df = Math.atan2(Math.sin(df), Math.cos(df)); df = clamp(df, -.61, .61); ang = ref + df; dx = Math.cos(ang) * d; dy = Math.sin(ang) * d; }
      const k = spec.length / d; b.x = a.x + dx * k; b.y = a.y + dy * k;
      if (avoid) avoid(b); }
  }
}
