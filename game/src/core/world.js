import { createEvents } from './events.js';
// Mulberry32 – deterministisk rng (seedbar).
export function createRng(seed = 1337) {
  let s = seed >>> 0;
  const rng = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(rng.range(a, b + 1));
  return rng;
}
export function createWorld({ seed = 1337, width = 1600, height = 1200 } = {}) {
  return {
    time: 0,            // sekunder simulert
    player: null,       // settes av player/index.js init()
    enemies: [],        // { x, y, r, hp, maxHp, team:'enemy', dead, type, ... }
    cover: [],          // { x, y, w, h, type:'low'|'high' }
    projectiles: [],    // se combat.js
    effects: [],        // { x, y, t, life, update?(dt,world), draw?(ctx,world,cam) }
    level: null,
    bounds: { x: 0, y: 0, w: width, h: height },
    arena: null, // settes av arena.loadArena – fast felt, overlever levels.startLevel
    events: createEvents(),
    rng: createRng(seed),
    debug: false,
    input: null, camera: null, // settes av main.js
    timeScale: 1,       // skalerer simulerings-dt i loopen (0.3 = sakte film). Lyd/UI/kamera bruker ekte dt.
    hitstopT: 0,        // gjenstående frys (s, ekte tid)
    /** Frys simuleringen i `seconds` (ekte tid). Overlappende kall forlenger ikke – lengste vinner. Kappes til 0.25 s. */
    hitstop(seconds) { this.hitstopT = Math.max(this.hitstopT, Math.min(0.25, seconds || 0)); },
  };
}
