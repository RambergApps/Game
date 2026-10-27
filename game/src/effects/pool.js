// BREACH – Effekter: partikkelbasseng. Faste objekter allokeres én gang; ingen allokering per bilde.
// Hard tak: MAX_PARTICLES (+ MAX_DECALS på bakken, + MAX_EMITTERS). Fullt basseng → eldste plass gjenbrukes.
export const MAX_PARTICLES = 900;
export const MAX_DECALS = 140;
export const MAX_EMITTERS = 32;
export const SOFT_CAP = 400;   // 26.10 (Arena): partikkeltopp ≤ 400 i tung kamp. Over taket gjenbrukes eldste plass (ringpeker).

// tegnemodus
export const M_SPRITE = 0, M_STREAK = 1, M_SHARD = 2, M_FIRE = 3, M_RING = 4, M_DROP = 5, M_GLOW = 6;
// lag
export const L_UNDER = 0, L_OVER = 1;

function blank() {
  return { on: false, mode: 0, layer: 1, add: false, img: null, img2: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, drag: 0, grav: 0, bounce: 0,
    t: 0, life: 1, delay: 0, size: 1, size2: 1, grow: 0, rot: 0, vrot: 0, alpha: 1, fadeIn: 0, fadeOut: 1, stretch: 0, rest: false, land: 0, seed: 0, heat: 0, flip: 1 };
}

export function createPool() {
  const P = new Array(MAX_PARTICLES), D = new Array(MAX_DECALS), E = new Array(MAX_EMITTERS);
  for (let i = 0; i < MAX_PARTICLES; i++) P[i] = blank();
  for (let i = 0; i < MAX_DECALS; i++) D[i] = { on: false, img: null, hot: null, x: 0, y: 0, z: 0, rot: 0, size: 1, sy: 1, t: 0, life: 10, cool: 3, alpha: 1, hotA: 1 };
  for (let i = 0; i < MAX_EMITTERS; i++) E[i] = { on: false, kind: '', x: 0, y: 0, t: 0, life: 1, acc: 0, size: 1, v: 0, id: null, done: false, p: 0 };
  return { P, D, E, pc: 0, dc: 0, ec: 0, live: 0, dropped: 0, peak: 0, cap: SOFT_CAP, taken: 0 };
}

/** Hent en ledig partikkel (nullstilt). Fullt basseng → overskriv (teller dropped). */
export function take(pool) {
  const P = pool.P, n = P.length;
  if (pool.live + pool.taken >= pool.cap) { pool.dropped++; let j = pool.pc, k = 0; while (!P[j].on && k++ < n) j = (j + 1) % n; const p = P[j]; pool.pc = (j + 1) % n; if (pool.log) pool.log.push(p); return reset(p); }   // mykt tak (live = forrige update)
  for (let k = 0; k < n; k++) {
    const i = (pool.pc + k) % n;
    if (!P[i].on) { pool.pc = (i + 1) % n; pool.taken++; if (pool.log) pool.log.push(P[i]); return reset(P[i]); }
  }
  pool.dropped++; const p = P[pool.pc]; pool.pc = (pool.pc + 1) % n; if (pool.log) pool.log.push(p); return reset(p);
}
function reset(p) {
  p.on = true; p.mode = 0; p.layer = 1; p.add = false; p.img = null; p.img2 = null; p.x = p.y = p.z = p.vx = p.vy = p.vz = 0; p.drag = 0; p.grav = 0; p.bounce = 0;
  p.t = 0; p.life = 1; p.delay = 0; p.size = 1; p.size2 = 1; p.grow = 0; p.rot = 0; p.vrot = 0; p.alpha = 1; p.fadeIn = 0; p.fadeOut = 1; p.stretch = 0; p.rest = false; p.land = 0; p.seed = 0; p.heat = 0; p.flip = 1;
  return p;
}
export function takeDecal(pool) { const d = pool.D[pool.dc]; pool.dc = (pool.dc + 1) % pool.D.length; d.on = true; d.t = 0; d.baked = false; d.hot = null; d.z = 0; d.sy = 1; d.alpha = 1; d.hotA = 1; return d; }
export function takeEmitter(pool) {
  const E = pool.E; for (let k = 0; k < E.length; k++) { const i = (pool.ec + k) % E.length; if (!E[i].on) { pool.ec = (i + 1) % E.length; const e = E[i]; e.on = true; e.t = 0; e.acc = 0; e.done = false; e.p = 0; e.id = null; return e; } }
  return null;
}
