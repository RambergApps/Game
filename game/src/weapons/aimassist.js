// Sikteassistanse (kulemagnetisme) for spilleren. Styrke fra innstillingene: world.settings.aimAssist (0 = av, 1 = maks).
// Ren funksjon av aim + verdenstilstand (ingen rng). Brukes bare for team 'player'.
import { lineOfSight } from '../core/geom.js';

export const AIM_ASSIST = { coneDeg: [1.5, 5], pull: [0.35, 0.8], maxRange: 900 };

/** Returnerer justert sikteretning (rad). Velger fienden med minst vinkelavvik innenfor kjeglen og fri sikt. */
export function assistAim(world, e, aim, strength, range = AIM_ASSIST.maxRange) {
  const s = Math.min(1, Math.max(0, +strength || 0));
  if (s <= 0 || !world?.enemies?.length) return aim;
  const A = AIM_ASSIST, cone = (A.coneDeg[0] + (A.coneDeg[1] - A.coneDeg[0]) * s) * Math.PI / 180;
  let best = null, bestAbs = Infinity;
  for (const t of world.enemies) {
    if (!t || t.dead) continue;
    const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
    if (d < 1 || d > Math.min(range, A.maxRange)) continue;
    let diff = Math.atan2(dy, dx) - aim; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const allow = cone + Math.atan2(t.r || 14, d) * 0.5;      // større mål nært gir litt bredere kjegle
    const ad = Math.abs(diff);
    if (ad > allow || ad >= bestAbs) continue;
    if (!lineOfSight(world, e.x, e.y, t.x, t.y)) continue;
    best = diff; bestAbs = ad;
  }
  if (best === null) return aim;
  return aim + best * (A.pull[0] + (A.pull[1] - A.pull[0]) * s);
}
