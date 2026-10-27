// BREACH – boss-stubb (Fiende-AI, fase 1). Oppfyller Levels' kontrakt (toppen av levels/index.js, docs/BOSS.md §5):
//   spawnBoss(world, id, x, y, {wave, phases:[{phase, at, name}]}) → entitet {hp, maxHp, dead, phase, defeated, displayName}
//   Hendelser: bossPhase {id, phase, prev, name, hpFrac, x, y}, bossStagger {id, duration, reason, x, y},
//              bossSummon {id, phase} (Levels kan legge inn adds; bossen spawner ingen selv), bossDefeated {id, x, y}.
// Fasene følger hp-andel mot phases[].at (Burrow 1,0 / Furnace 0,7 / Collapse 0,35). Full oppførsel (angrep, ventil-skade,
// weakPointHit, coverBreak) kommer i fase 2 – stubben er en tanky plassholder som snur seg mot spilleren.
const DEFAULT_PHASES = [{ phase: 1, at: 1.0, name: 'Burrow' }, { phase: 2, at: 0.7, name: 'Furnace' }, { phase: 3, at: 0.35, name: 'Collapse' }];
const PHASE_STAGGER = 2.0;   // s, faseskift = åpent vindu (BOSS.md)
const inited = new WeakSet();

/** Gjør en nyopprettet fiende til boss (kalles fra spawnBoss i index.js). */
export function makeBoss(world, e, id, opts = {}) {
  const phases = (opts.phases?.length ? opts.phases : DEFAULT_PHASES).map((p) => ({ ...p })).sort((a, b) => a.phase - b.phase);
  Object.assign(e, { isBoss: true, bossId: id, bossWave: opts.wave ?? null, bossPhases: phases, phase: 1, defeated: false });
  emitPhase(world, e, 1, 0);
  return e;
}

function phaseFor(e) {
  const frac = Math.max(0, e.hp) / (e.maxHp || 1);
  let ph = 1; for (const p of e.bossPhases) if (frac <= p.at) ph = Math.max(ph, p.phase);
  return ph;
}

function emitPhase(world, e, phase, prev) {
  const p = e.bossPhases.find((q) => q.phase === phase);
  world.events?.emit('bossPhase', { id: e.bossId, phase, prev, name: p?.name ?? null, hpFrac: Math.max(0, e.hp) / (e.maxHp || 1), x: e.x, y: e.y, entity: e, team: 'enemy' });
  world.events?.emit('bossSummon', { id: e.bossId, phase, kind: 'phase', x: e.x, y: e.y, entity: e, team: 'enemy' });
}

/** Per steg for levende bosser: faseskift (bare framover) med stagger-vindu. */
export function bossTick(world, e) {
  if (!e.isBoss || e.dead) return;
  const ph = phaseFor(e);
  if (ph <= e.phase) return;
  const prev = e.phase; e.phase = ph;
  emitPhase(world, e, ph, prev);
  e.bossStaggerUntil = world.time + PHASE_STAGGER;
  world.events?.emit('bossStagger', { id: e.bossId, duration: PHASE_STAGGER, reason: 'phase', x: e.x, y: e.y, entity: e, team: 'enemy' });
}

/** Lytter: bossens død → bossDefeated (én gang). */
export function bossInit(world) {
  if (inited.has(world)) return; inited.add(world);
  world.events.on('death', ({ target }) => {
    if (!target?.isBoss || target.defeated) return;
    target.defeated = true;
    world.events.emit('bossDefeated', { id: target.bossId, x: target.x, y: target.y, entity: target, team: 'enemy' });
  });
}
