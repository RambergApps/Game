// Innhopp med varsel (CINDER 23.10): Cinderborn kryper opp fra sprekker i bakken. Før selve createEnemy sendes
// world.events 'spawnWarn' { x, y, type, t, id, displayName } (t = varseltid i s, 0,6–1,2) – Arena tegner sprekken,
// Lyd spiller rumlingen. Når tiden er ute: createEnemy på samme punkt + 'spawnRise' { x, y, type, id, entity }.
// Bruker world.time (respekterer timeScale/hitstop og pause). Ingen ny fiendegrafikk: et enkelt varsel ved sprekken
// tegnes av render.js KUN hvis Arena ikke tar det (world.arena.handlesSpawnWarn === true eller arena.drawSpawnWarn finnes).
//
// For Nivåer (levels/index.js spawnEnemy kaller i dag mod.createEnemy direkte):
//   const h = mod.spawnWithWarning(world, type, x, y, { onSpawn: (e) => { /* variant, d.mine.push(e) */ } });
//   – h.enemy er null til fienden finnes; tell mod.pendingSpawns(world) som «gjenstår» så bølgen ikke avsluttes for tidlig.
//   – mod.clearPendingSpawns(world) ved nivåbytte/omstart.

import { displayName as nameOfType } from './stats.js';

let nextId = 1;
/** Varighet (s) for oppstigningen etter createEnemy – kun visuell (P.rise), fienden handler normalt. */
export const RISE = 0.45;
const list = (world) => (world._enemySpawns ||= []);

/**
 * Planlegg et innhopp med varsel. opts: { warn?: s (ellers 0,6–1,2 fra world.rng), onSpawn?(e), ...createEnemy-opts }
 * → håndtak { id, type, x, y, t, at, enemy: null|entity, cancelled, cancel() }
 */
export function spawnWithWarning(world, type, x, y, opts = {}) {
  const { warn, onSpawn, ...createOpts } = opts;
  if (!Number.isFinite(createOpts.rise)) createOpts.rise = RISE;   // 'spawnRise'-animasjon: P.rise {progress, duration}
  const rng = world.rng || Math.random;
  const t = Number.isFinite(warn) ? Math.max(0, warn) : 0.6 + rng() * 0.6;
  const h = { id: nextId++, type, x, y, t, at: (world.time || 0) + t, t0: world.time || 0, enemy: null, cancelled: false, onSpawn, createOpts, variant: createOpts.variant ?? null,
    cancel() { this.cancelled = true; } };
  list(world).push(h);
  const displayName = nameOfType(type, createOpts.variant);
  world.events?.emit('spawnWarn', { x, y, type, t, id: h.id, displayName, variant: createOpts.variant ?? null, team: 'enemy' });
  if (t <= 0) flush(world, true);
  return h;
}

/** Kalles fra enemies.update før fiendene oppdateres. */
export function updateSpawns(world, createEnemy) {
  const L = world._enemySpawns; if (!L || !L.length) return;
  for (let i = L.length - 1; i >= 0; i--) {
    const h = L[i];
    if (h.cancelled) { L.splice(i, 1); continue; }
    if ((world.time || 0) < h.at) continue;
    L.splice(i, 1);
    const e = createEnemy(world, h.type, h.x, h.y, h.createOpts);
    h.enemy = e || null;
    if (e && h.onSpawn) h.onSpawn(e);   // før hendelsen, så lyttere ser variant/hp som Levels setter i onSpawn
    world.events?.emit('spawnRise', { x: h.x, y: h.y, type: h.type, id: h.id, entity: e, variant: e?.variant ?? null, duration: h.createOpts.rise, team: 'enemy' });
  }
}
let flushFn = null;
export function _bindCreate(fn) { flushFn = fn; }
function flush(world) { if (flushFn) updateSpawns(world, flushFn); }

export const pendingSpawns = (world) => (world._enemySpawns ? world._enemySpawns.filter((h) => !h.cancelled).length : 0);
export function clearPendingSpawns(world) { if (world._enemySpawns) world._enemySpawns.length = 0; }
/** For tegning/lyd/test: kopi-fri liste over ventende innhopp (les, ikke endre). */
export const spawnState = (world) => world._enemySpawns || [];
export const arenaHandlesSpawnWarn = (world) => !!(world.arena?.handlesSpawnWarn || world.modules?.arena?.drawSpawnWarn || world._vfx?.owns?.spawn);
