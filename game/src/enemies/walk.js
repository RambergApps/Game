// Arenas gangbarhets-API (A1 26.10). Modulen src/arena/walkable.js tar world som første argument; world.arena-varianten
// gjør det ikke (isWalkable(x, y, r) osv.), så den pakkes inn. Fallback: ingen begrensning utover bounds.
import * as W from '../arena/walkable.js';
const NONE = { walkableRect: (w) => w.bounds, clampWalkable: () => false, isWalkable: () => true, rescueStuck: () => false, southBlocker: () => null };
const wrapped = new WeakMap();
export function walk(world) {
  if (W && typeof W.isWalkable === 'function') return W;
  const a = world?.arena;
  if (a && typeof a.isWalkable === 'function') {
    let o = wrapped.get(a);
    if (!o) {
      o = { walkableRect: () => a.walkable?.(), clampWalkable: (w, e, r) => a.clampWalkable?.(e, r), isWalkable: (w, x, y, r) => a.isWalkable(x, y, r),
        rescueStuck: (w, e, r) => a.rescueStuck?.(e, r), southBlocker: () => a.southBlocker?.() ?? null };
      wrapped.set(a, o);
    }
    return o;
  }
  return NONE;
}
