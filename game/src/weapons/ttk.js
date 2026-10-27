// BREACH – TTK-simulering. Kjører det EKTE våpensystemet (tryFire → core spawnProjectile/updateProjectiles/damage,
// med spredning, skadefall, lav dekning-regelen og lading) i en egen headless world. Brukes av tools/ttk.mjs og test.html.
import { createWorld, updateProjectiles, updateEffects, STEP } from '../core/index.js';
import { ENEMY_TYPES } from '../enemies/stats.js';
import * as W from './index.js';
import { WEAPONS, GRENADE, grenadeDamage, falloffMult, TILE } from './data.js';

export const DISTS = [2, 4, 8, 12, 16, 24];
export const TARGETS = ['grunt', 'flanker', 'heavy', 'grenadier'];

/**
 * o: { weapon, target='grunt', tiles, cover: 'open'|'low'|'lowPopUp', posture: 'aim'|'hip'|'blind', moving=false,
 *      preAim=true (siktet stille før målet dukker opp; false = lading starter når målet dukker opp),
 *      smart=true (presisjon venter på lading når det dreper raskere), trials=200, seed=7, maxT=8 }
 * → { mean, p50, p90, killRate, shots, hitRate }
 */
export function simulateTTK(o) {
  const def = ENEMY_TYPES[o.target || 'grunt'], trials = o.trials || 200, dist = o.tiles * TILE, maxT = o.maxT || 8;
  const times = []; let shots = 0, pellets = 0, hits = 0, kills = 0;
  for (let k = 0; k < trials; k++) {
    const world = createWorld({ seed: (o.seed || 7) * 1000 + k, width: 1600, height: 400 });
    const sh = { x: 80, y: 200, r: 14, hp: 100, maxHp: 100, team: 'player', dead: false, aim: 0 };
    const tg = { x: 80 + dist, y: 200, r: def.radius, hp: def.hp, maxHp: def.hp, armor: def.armor || 0, team: 'enemy', dead: false, type: o.target };
    if (o.cover === 'low' || o.cover === 'lowPopUp') world.cover.push({ x: tg.x - def.radius - 22, y: 150, w: 16, h: 100, type: 'low', material: 'concrete' });
    if (o.cover === 'lowPopUp') tg.coverHitChance = 0.6;
    world.enemies.push(tg);
    W.createLoadout(sh, [o.weapon], {}, world);
    sh.loadout.aiming = o.posture === 'aim'; sh.loadout.aimT = o.preAim !== false ? 5 : 0;   // preAim:false = målet dukker opp nå
    const D = W.getWeapon(o.weapon), st = D.steady;
    world.events.on('projectileHit', ({ target }) => { if (target === tg) hits++; });
    let t = 0;
    while (t < maxT && !tg.dead) {
      W.update(STEP, world);
      // halvautomatisk: «slipp» avtrekkeren mens våpenet ikke kan skyte, så neste klikk blir en ny flanke (optimal klikking)
      const L = sh.loadout, semi = !D.auto;
      if (semi && (L.cooldown > 0 || L.reload || L.switchT > 0)) { updateProjectiles(STEP, world); updateEffects(STEP, world); world.time += STEP; t += STEP; continue; }
      // Presisjon, «smart» skytter: vent på mer lading hvis det gir drap raskere enn å skyte nå + oppfølger (fireInterval).
      if (st && o.posture === 'aim' && o.smart !== false) {
        const hd = tg.x - tg.r - W.getMuzzle(sh, 0).x, fall = D.dmg * falloffMult(D, hd) * (1 - tg.armor), k = Math.max(0, Math.min(1, (L.aimT - st.start) / (st.full - st.start)));
        const now = fall * (1 + (st.dmgMult - 1) * k), need = (tg.hp * 1.01) / fall;   // nødvendig multiplikator for én-skudd
        if (now < tg.hp && need <= st.dmgMult) {
          const tWait = st.start + ((need - 1) / (st.dmgMult - 1)) * (st.full - st.start) - L.aimT;
          if (tWait > 0 && tWait < D.fireInterval) { updateProjectiles(STEP, world); updateEffects(STEP, world); world.time += STEP; t += STEP; continue; }
        }
      }
      const r = W.tryFire(world, sh, { aimAngle: 0, aiming: o.posture === 'aim', blind: o.posture === 'blind', moving: o.moving ? 1 : 0 });
      if (r.fired) { shots++; pellets += r.pellets; }
      updateProjectiles(STEP, world); updateEffects(STEP, world);
      world.time += STEP; t += STEP;
    }
    if (tg.dead) { kills++; times.push(t); }
  }
  times.sort((a, b) => a - b);
  const q = (f) => (times.length ? times[Math.min(times.length - 1, Math.floor(f * times.length))] : Infinity);
  return { mean: times.length ? times.reduce((a, b) => a + b, 0) / times.length : Infinity, p50: q(0.5), p90: q(0.9), killRate: kills / trials, shots: shots / trials, hitRate: pellets ? hits / pellets : 0 };
}

/** Deterministisk skade per treff/avtrekk ved avstand (formel, uten bom). */
export function damageAt(id, tiles) { const w = WEAPONS[id]; const m = falloffMult(w, tiles * TILE); return { perHit: w.dmg * m, perShot: w.dmg * m * w.pellets }; }

/** Granatskade ved avstand (ruter) mot mål med radius r. */
export function grenadeAt(tiles, r = 15) { return grenadeDamage(GRENADE, tiles * TILE, r); }

/** Hele hovedtabellen. */
export function buildTable({ trials = 200, dists = DISTS, targets = TARGETS, cover = 'open', posture = 'aim', preAim = true } = {}) {
  const rows = [];
  for (const id of Object.keys(WEAPONS)) for (const tgt of targets) {
    const cells = dists.map((d) => simulateTTK({ weapon: id, target: tgt, tiles: d, cover, posture, preAim, trials }));
    rows.push({ weapon: id, target: tgt, cells });
  }
  return { dists, rows, cover, posture };
}
