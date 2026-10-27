// BREACH – nivådirektør (eies av Breach Nivåer og story). Følger docs/CORE-API.md:
//   init(world), update(dt, world), draw(), drawHud(ctx, world, camera), startLevel(world, n)
// Kjører bølgene fra data.js, spawner via world.modules.enemies.createEnemy, viser oppgraderingskort
// (upgrades.js) og mellomsekvenser (story) på riktige tidspunkt.
//
// Hendelser ut: levelStart {level, id}, waveStart {level, wave, id, name}, waveEnd {level, wave, id},
//               levelEnd {level, id}, upgrade {id, stats, instant}, gameComplete {}
//               restart {level, waveId, cause: 'death'|'menu'|…}, bossStart {id, wave}, bossEnd {id, skipped}
// Leser:        world.events 'death' (spillerdød → «fallen» + ny bølge, fiendedrap → healOnKill),
//               'bossPhase' {id, phase} og 'bossDefeated' {id} (fra Fiende-AI, se under)
//
// BOSS-API SOM LEVELS FORVENTER (Fiende-AI eier bossen; docs/BOSS.md er ikke levert ennå – tilpass her):
//   world.modules.enemies.spawnBoss(world, id, x, y, opts) → boss-entitet (ligger i world.enemies)
//     id   'ashmaw'; x/y = midten av sonen wave.zone ('core'); opts = { wave, phases: [{phase, at, name}] }
//     entiteten: { hp, maxHp, dead, phase? (1..3), displayName? }
//   world.events: 'bossPhase' {id, phase, name?}  → levels legger inn adds for fasen (wave.phases[phase-1].adds)
//                 'bossDefeated' {id}             → bølgen er vunnet
//   Mangler hendelsene, leser levels boss.phase, ellers hp/maxHp mot wave.phases[].at; død = dead || hp <= 0.
//   Mangler spawnBoss helt: console.info og bølgen hoppes over (waveEnd {…, skipped: true}) så spillet kan fullføres.
//   Levels sender selv bossStart {id, wave} og bossEnd {id, skipped} (for HUD/Lyd).
import { LEVELS, getLevel, spawnSchedule, resolveSpawn, CUTSCENE_ON_DEATH, VARIANTS, DISPLAY_NAMES } from './data.js';
import { createUpgradeState, rollOffer, pick, computeStats } from './upgrades.js';
import { showCutscene, showCredits, preloadCutscene } from '../story/index.js';
import { openCards, drawCards } from './cards.js';
import { drawHud as drawLevelHud } from './hud.js';
import { loadFont } from './ui-kit.js';

const dirs = new WeakMap();

// MIDLERTIDIG (krav fra Breach 23.10): Heavy og Grenadier er ikke klare i enemies/.
// data.js beholder riktige typer; her byttes de ut ved innhopp. Fjern linjen/sett {} når de er klare.
const READY_TYPES = ['grunt', 'flanker', 'heavy', 'grenadier'];
const FIRST_BREAK = 3;      // s før første bølge i et nivå
const RETRY_BREAK = 2.5;    // s før bølgen startes på nytt etter død (spilleren har kontroll i pausen)
const DEATH_FALL = 2.0;     // s: fall (0,45 s, rig death-klipp) + ~1,5 s liggende før respawn/game over
export { BUILD } from './build.js';

/** Økt-tilstand. «fallen» vises bare ved FØRSTE død per økt; lagringen kan sette flagget (profile.seenCutscenes). */
export const session = { fallenSeen: false };
export function setFallenSeen(v = true) { session.fallenSeen = !!v; }
const now = () => performance.now() / 1000;

function D(world) {
  let d = dirs.get(world);
  if (!d) {
    d = {
      phase: 'idle', n: 0, level: null, wi: -1, wave: null, t: 0, queue: [], mine: [], remaining: 0,
      breakLeft: 0, next: null, banner: null, pings: [], hold: null, zone: null, cards: null,
      upgrades: createUpgradeState(), stats: null, pausedByMe: false, deadT: 0, waveDone: false, retry: false,
      token: 0,
    };
    d.stats = computeStats(d.upgrades);
    dirs.set(world, d);
  }
  return d;
}
export const _debug = (world) => D(world); // for tester

export function init(world) {
  const d = D(world);
  loadFont();
  if (d.inited) return; d.inited = true;
  world.playerStats = d.stats;
  world.events.on('bossPhase', (e) => { if (d.boss && (!e?.id || e.id === d.boss.id)) enterBossPhase(d, e?.phase | 0); });
  world.events.on('bossDefeated', (e) => { if (d.boss && (!e?.id || e.id === d.boss.id)) d.boss.defeated = true; });
  world.events.on('death', ({ target }) => {
    if (!target) return;
    if (target.team === 'enemy' && d.stats.healOnKill > 0 && world.player && !world.player.dead) {
      world.player.hp = Math.min(world.player.maxHp, world.player.hp + d.stats.healOnKill);
    }
  });
}

/** Bølgeindeks (0-basert) fra startAt: bølge-id ('2-3') eller 0-basert indeks (number). Ukjent → 0. */
export function waveIndexOf(L, startAt) {
  if (startAt == null) return 0;
  if (typeof startAt === 'number') return Number.isInteger(startAt) && startAt >= 0 && startAt < L.waves.length ? startAt : 0;
  const i = L.waves.findIndex((w) => w.id === String(startAt));
  if (i < 0) console.info(`[levels] startAt '${startAt}' finnes ikke i ${L.id} – starter på bølge 1`);
  return Math.max(0, i);
}

/**
 * Start nivå n (1..3). Kan kalles på nytt; avbryter alt som pågår.
 * opts (for CONTINUE/lagring og testsiden):
 *   startAt        bølge-id ('2-3') ELLER 0-basert indeks (2 = tredje bølge). Standard 0.
 *   skipCutscenes  true = ingen mellomsekvens før første bølge; array = id-er som er sett (hoppes over).
 *                  Uansett: nivåets cutsceneBefore spilles bare når startAt er bølge 1. Bølgens egen
 *                  cutsceneBefore (f.eks. 'foundry-core' før 3-6) spilles som normalt hvis den ikke er sett.
 *   upgrades       stabler { id: antall } fra lagringen (setUpgradeState).
 *   pendingUpgrade true = vis kortvalget før første bølge.
 */
export function startLevel(world, n = 1, opts = {}) {
  const d = D(world); init(world);
  const L = getLevel(n);
  if (!L) { console.info(`[levels] nivå ${n} finnes ikke`); return; }
  const first = waveIndexOf(L, opts.startAt);
  const seen = opts.skipCutscenes === true ? null : new Set(Array.isArray(opts.skipCutscenes) ? opts.skipCutscenes : []);
  const want = (id) => (id && opts.skipCutscenes !== true && !seen.has(id) ? id : null);
  if (opts.upgrades) setUpgradeState(world, opts.upgrades);
  d.token++;
  closeCards(world, d);
  world.input?.reset?.();                                   // ny start (CONTINUE/LEVEL SELECT) midt i en sekvens: ingen holdte taster
  d.n = n; d.level = L; d.wi = -1; d.wave = null; d.queue = []; d.hold = null; d.zone = null; d.pings = [];
  d.waveDone = false; d.retry = false;
  // world.level eies av oss; arena legger .arena på samme objekt – behold det.
  world.level = Object.assign(world.level || {}, { n, id: L.id, name: L.name, wave: 0, waveId: null, objective: L.objective });
  loadArenaFor(world, L);
  clearField(world, d);
  placePlayer(world, d, true);
  world.events.emit('levelStart', { level: n, id: L.id });
  const tok = d.token;
  playCutscene(world, d, first === 0 ? want(L.cutsceneBefore) : null).then(() => {
    if (tok !== d.token) return;
    // Forhåndslasting under kapittelbanneret: «fallen» helt (reservescenen males i kode ~0,5 s hvis bildet mangler),
    // og malte bilder for nivåets øvrige sekvenser (bølgenes cutsceneBefore og cutsceneAfter, f.eks. yard-clear).
    if (preloadCutscene) setTimeout(() => {
      if (!session.fallenSeen) preloadCutscene(CUTSCENE_ON_DEATH);
      for (const id of [...L.waves.map((w) => w.cutsceneBefore), L.cutsceneAfter]) if (id) preloadCutscene(id, { paintedOnly: true });
    }, 50);
    d.banner = { kicker: `CHAPTER ${String(n).padStart(2, '0')}`, title: L.name.toUpperCase(), sub: L.objective, t0: now(), dur: 2.0, col: '#39c6ff', stripes: true };
    const go = () => startBreak(d, FIRST_BREAK + 1.2, () => beginWave(world, d, first, { skipCutscene: !want(L.waves[first]?.cutsceneBefore) }));
    if (opts.pendingUpgrade) offerUpgrade(world, d, go); else go();
  });
}

/** Alias etter docs/LAGRING-OG-OPPLAERING.md: startAt(world, n, waveIndex, { upgrades, pendingUpgrade, skipCutscenes }). */
export function startAt(world, n, waveIndex = 0, opts = {}) { return startLevel(world, n, { ...opts, startAt: waveIndex }); }

/** Oppgraderingsstabler for lagring: { id: antall }. */
export function getUpgradeState(world) { return { ...D(world).upgrades.stacks }; }
/** Gjenopprett stabler fra lagring og regn ut spillerverdiene på nytt (uten engangseffekter). */
export function setUpgradeState(world, stacks = {}) {
  const d = D(world);
  d.upgrades = createUpgradeState(); d.upgrades.stacks = { ...stacks };
  applyStats(world, d, computeStats(d.upgrades), null);
}

export function update(dt, world) {
  const d = D(world), p = world.player;
  if (d.banner && now() - d.banner.t0 > d.banner.dur) d.banner = null;
  d.mine = d.mine.filter((e) => !e.dead && world.enemies.includes(e));
  d.pend = (d.pend || []).filter((h) => !h.enemy && !h.cancelled);
  d.remaining = d.mine.length + d.pend.length + d.queue.length;

  if (p && p.dead && d.phase !== 'dead' && d.phase !== 'done' && d.phase !== 'credits' && d.phase !== 'cutscene' && d.phase !== 'idle') {
    d.phase = 'dead'; d.deadT = 0; return;
  }
  switch (d.phase) {
    case 'dead':
      d.deadT += dt;
      if (d.deadT > DEATH_FALL) onDeath(world, d);
      break;
    case 'break':
      d.breakLeft -= dt;
      if (d.breakLeft <= 0 && d.next) { const f = d.next; d.next = null; f(); }
      break;
    case 'wave': runWave(dt, world, d); break;
  }
}

export function draw() {}

export function drawHud(ctx, world, camera) {
  const d = D(world);
  drawLevelHud(ctx, world, camera, d);
  if (d.cards) drawCards(ctx, d.cards, d.n);
}

// ---------------------------------------------------------------- bølger
function beginWave(world, d, i, { retry = false, skipCutscene = false } = {}) {
  const L = d.level, w = L.waves[i];
  if (!w) return;
  const tok = d.token;
  const go = () => {
    if (tok !== d.token) return;
    d.wi = i; d.wave = w; d.t = 0; d.waveDone = false; d.retry = false;
    d.queue = spawnSchedule(w).map((s) => ({ ...s }));
    d.hold = null; d.zone = null;
    if (w.objective.type === 'hold') {
      d.zone = resolveZone(world, L, w.objective.zone);
      d.hold = { t: 0, need: w.objective.seconds, inZone: false };
    }
    world.level.wave = i + 1; world.level.waveId = w.id;
    if (w.type === 'boss' && !startBoss(world, d, w)) {
      // Ingen boss-API ennå: hopp over bølgen, men hold flyten (waveStart → waveEnd) intakt.
      world.events.emit('waveStart', { level: d.n, wave: i + 1, id: w.id, name: w.name, boss: w.boss });
      d.phase = 'wave';
      return finishWave(world, d, { skipped: true });
    }
    d.phase = 'wave';
    const boss = w.type === 'boss';
    d.banner = { kicker: retry ? 'REGROUP' : boss ? 'FINAL' : `WAVE ${i + 1} OF ${L.waves.length}`, title: w.name.toUpperCase(),
      sub: w.objective.type === 'hold' ? `Hold the core for ${w.objective.seconds} seconds.` : boss ? 'Break her vents. Keep her in the shaft.' : null,
      t0: now(), dur: boss ? 3.2 : 2.6, col: boss ? '#ff7a1a' : '#ffb347' };
    world.events.emit('waveStart', { level: d.n, wave: i + 1, id: w.id, name: w.name });
  };
  if (w.cutsceneBefore && !retry && !skipCutscene) playCutscene(world, d, w.cutsceneBefore).then(go);
  else go();
}

function runWave(dt, world, d) {
  const w = d.wave; if (!w) return;
  d.t += dt;
  // innhopp etter tidsplan, men aldri flere enn maxAlive samtidig
  // varslede innhopp (spawnWithWarning) teller med i maxAlive
  d.pend = (d.pend || []).filter((h) => !h.enemy && !h.cancelled);
  while (d.queue.length && d.queue[0].t <= d.t && d.mine.length + d.pend.length < w.maxAlive) {
    const s = d.queue.shift();
    const e = spawnEnemy(world, d, s);
    if (e) d.mine.push(e);
  }
  if (d.boss) {
    const B = d.boss, e = B.e;
    if (Number.isFinite(e.phase)) enterBossPhase(d, e.phase);
    else if (e.maxHp > 0) {
      const frac = Math.max(0, e.hp) / e.maxHp;
      let ph = 1; for (const p of w.phases || []) if (frac <= p.at) ph = Math.max(ph, p.phase);
      enterBossPhase(d, ph);
    }
    if (B.defeated || e.dead || e.hp <= 0) {
      world.events.emit('bossEnd', { id: B.id, skipped: false });
      d.queue = []; cancelPending(world, d); d.boss = null;
      return finishWave(world, d);
    }
    return;
  }
  if (d.hold) {
    const p = world.player, z = d.zone;
    d.hold.inZone = !!(p && z && !p.dead && Math.hypot(p.x - z.x, p.y - z.y) <= z.r);
    if (d.hold.inZone) d.hold.t += dt;
    if (d.hold.t >= d.hold.need) { d.queue = []; cancelPending(world, d); return finishWave(world, d); }
  } else if (!d.queue.length && !d.mine.length && !pendingCount(world, d)) finishWave(world, d);
}

/** Sone i verdenskoordinater. world.arena.zones (Arena, verdens-px) vinner; nivådata (normalisert) er fallback. */
function resolveZone(world, L, name) {
  const a = world.arena?.zones?.[name];
  if (a && Number.isFinite(a.x) && Number.isFinite(a.y) && a.r > 0) return { x: a.x, y: a.y, r: a.r };
  const z = L.zones?.[name], b = world.bounds;
  return z && b ? { x: b.x + z.x * b.w, y: b.y + z.y * b.h, r: z.r * Math.min(b.w, b.h) } : null;
}

function spawnEnemy(world, d, s) {
  const mod = world.modules?.enemies;
  if (!mod?.createEnemy) { console.info('[levels] enemies.createEnemy mangler – hopper over innhopp'); return null; }
  const pts = world.arena?.spawnPoints || world.arena?.enemySpawns;
  const pos = resolveSpawn(d.level, s.spawn, world.bounds, pts);
  // litt spredning så en gruppe ikke står oppå hverandre
  const a = world.rng() * Math.PI * 2, r = 10 + world.rng() * 26;
  let x = pos.x + Math.cos(a) * r, y = pos.y + Math.sin(a) * r;
  const b = world.bounds; x = Math.max(b.x + 40, Math.min(b.x + b.w - 40, x)); y = Math.max(b.y + 40, Math.min(b.y + b.h - 40, y));
  const type = s.type;
  if (!READY_TYPES.includes(type)) console.warn('[levels] ukjent fiendetype', type);
  const v = s.variant && VARIANTS[s.variant];
  const dress = (e) => {
    if (!e || !v) return e;
    e.variant = s.variant; e.hp = e.maxHp = Math.round(e.maxHp * (v.hpMul || 1));
    e.displayName = DISPLAY_NAMES[v.nameKey] || mod.DISPLAY_NAMES?.[v.nameKey] || e.displayName;
    return e;
  };
  d.pings.push({ x, y, t0: now() }); if (d.pings.length > 24) d.pings.shift();
  if (mod.spawnWithWarning) {
    // CINDER: sprekk-varsel 0,6–1,2 s ('spawnWarn' → 'spawnRise'). Fienden legges i d.mine når den dukker opp.
    const tok = d.token, w = d.wave;
    const h = mod.spawnWithWarning(world, type, x, y, { onSpawn: (e) => {
      if (tok !== d.token || d.wave !== w) return;
      dress(e); if (!d.mine.includes(e)) d.mine.push(e);
    } });
    if (h && !h.enemy) (d.pend ||= []).push(h);
    return h?.enemy || null;
  }
  return dress(mod.createEnemy(world, type, x, y));
}

// ---------------------------------------------------------------- boss
/** Start boss-bølgen via Fiende-AI. false = API mangler/feilet → bølgen hoppes over. */
function startBoss(world, d, w) {
  const mod = world.modules?.enemies;
  if (typeof mod?.spawnBoss !== 'function') {
    console.info(`[levels] enemies.spawnBoss mangler – hopper over boss-bølgen ${w.id} (${w.boss}). Forventet API: se toppen av levels/index.js.`);
    world.events.emit('bossEnd', { id: w.boss, skipped: true });
    return false;
  }
  const z = resolveZone(world, d.level, w.zone || 'core');
  const pos = z || resolveSpawn(d.level, d.level.playerSpawn, world.bounds);
  let e = null;
  try { e = mod.spawnBoss(world, w.boss, pos.x, pos.y, { wave: w.id, phases: (w.phases || []).map(({ phase, at, name }) => ({ phase, at, name })) }); }
  catch (err) { console.info(`[levels] spawnBoss('${w.boss}') feilet – hopper over ${w.id}`, err); }
  if (!e) { world.events.emit('bossEnd', { id: w.boss, skipped: true }); return false; }
  if (!e.displayName) e.displayName = DISPLAY_NAMES[w.boss] || w.name;
  d.boss = { id: w.boss, e, phase: 0, defeated: false, name: e.displayName, phases: w.phases || [] };
  world.events.emit('bossStart', { id: w.boss, wave: w.id });
  enterBossPhase(d, 1);
  return true;
}

/** Gå til fase n (bare framover) og legg inn adds for hver ny fase, med delay fra nå. */
function enterBossPhase(d, n) {
  const B = d.boss; if (!B || !(n > B.phase)) return;
  for (let k = B.phase + 1; k <= n; k++) {
    const ph = B.phases.find((p) => p.phase === k); if (!ph) continue;
    B.phaseName = ph.name;
    d.queue.push(...spawnSchedule(d.wave, ph.adds || []).map((s) => ({ ...s, t: s.t + d.t })));
  }
  d.queue.sort((a, b) => a.t - b.t);
  B.phase = n;
}

function finishWave(world, d, { skipped = false } = {}) {
  const L = d.level, w = d.wave, i = d.wi;
  d.phase = 'between'; d.waveDone = true; d.hold = d.hold ? { ...d.hold, inZone: true } : null;
  world.events.emit('waveEnd', skipped ? { level: d.n, wave: i + 1, id: w.id, skipped: true } : { level: d.n, wave: i + 1, id: w.id });
  const last = i >= L.waves.length - 1;
  const tok = d.token;
  if (!last) d.banner = { kicker: `WAVE ${i + 1}`, title: 'CLEARED', t0: now(), dur: 1.8, col: '#39c6ff' };
  const after = () => {
    if (tok !== d.token) return;
    if (last) return finishLevel(world, d);
    startBreak(d, w.breakAfter ?? 6, () => beginWave(world, d, i + 1));
  };
  if (w.upgradeAfter) setTimeout(() => { if (tok === d.token && d.phase === 'between') offerUpgrade(world, d, after); }, last ? 400 : 1400);
  else if (last) setTimeout(after, 900);
  else after();
}

function finishLevel(world, d) {
  const L = d.level, tok = d.token;
  world.events.emit('levelEnd', { level: d.n, id: L.id });
  d.hold = null; d.zone = null;
  playCutscene(world, d, L.cutsceneAfter).then(() => {
    if (tok !== d.token) return;
    if (getLevel(d.n + 1)) startLevel(world, d.n + 1);
    else finishGame(world, d);
  });
}

/** Etter sluttsekvensen: gameComplete (Lyd) → rulletekst (story/credits.js) → sluttskjerm. */
async function finishGame(world, d) {
  const tok = d.token;
  d.phase = 'credits'; world.paused = true; d.pausedByMe = true;
  world.events.emit('gameComplete', {});
  try { if (showCredits) await showCredits({ world }); } catch (err) { console.info('[levels] rulletekst feilet', err); }
  if (tok !== d.token) return;
  d.phase = 'done'; d.doneT0 = now(); world.paused = true; d.pausedByMe = true;
}

function startBreak(d, secs, next) { d.phase = 'break'; d.breakLeft = secs; d.next = next; }

// ---------------------------------------------------------------- oppgraderinger
function offerUpgrade(world, d, then) {
  const p = world.player;
  const offer = rollOffer(d.upgrades, { level: d.n, hpRatio: p ? p.hp / (p.maxHp || 100) : 1 }, world.rng);
  if (!offer.length) return then();
  d.phase = 'upgrade';
  pause(world, d, true);
  const canvas = document.getElementById('game') || document.querySelector('canvas:not(.breach-cutscene)');
  world.events.emit('upgradeOffer', { offer });
  d.cards = openCards(offer, { ...d.upgrades.stacks }, (id) => {
    d.cards = null; world.input?.reset?.();
    const { stats, instant } = pick(d.upgrades, id);
    applyStats(world, d, stats, instant);
    world.events.emit('upgrade', { id, stats, instant });
    pause(world, d, false);
    then();
  }, canvas);
}

function applyStats(world, d, stats, instant) {
  const p = world.player, old = d.stats;
  d.stats = stats; world.playerStats = stats;
  if (p) {
    const delta = stats.maxHp - (old?.maxHp ?? p.maxHp);
    p.maxHp = stats.maxHp; if (delta > 0) p.hp += delta;
    if (instant?.healRatio) p.hp += p.maxHp * instant.healRatio;
    p.hp = Math.min(p.maxHp, p.hp);
  }
}

function closeCards(world, d) { if (d.cards) { d.cards.cleanup?.(); d.cards = null; world.input?.reset?.(); } }

// ---------------------------------------------------------------- død
// Død → 1,0 s fall → (bare første gang i økta: «fallen», går videre selv etter 2 s, korte toninger) → respawn med full HP
// og banner «WARDEN DOWN – RESTARTING WAVE» (~2 s) mens REGROUP-pausen går → samme bølge på nytt.
// Spilleren har kontroll fra respawn (mål: < 4 s fra død når «fallen» ikke vises).
function onDeath(world, d) {
  if (d.phase !== 'dead') return;
  d.phase = 'cutscene';
  const tok = d.token;
  const i = currentWaveIndex(d);
  const firstTime = !session.fallenSeen;
  session.fallenSeen = true;
  const restart = () => {
    if (tok !== d.token) return;
    resetWave(world, d, i, 'death', !firstTime);
  };
  if (firstTime) playCutscene(world, d, CUTSCENE_ON_DEATH).then(restart);
  else restart();
}

/** Bølgen som gjelder nå: pågående bølge, eller neste hvis forrige er ryddet (pause før neste bølge). */
function currentWaveIndex(d) {
  const last = d.level.waves.length - 1;
  return Math.min(last, Math.max(0, d.waveDone ? d.wi + 1 : d.wi));
}

/**
 * Felles omstart (død og pausemeny): rydd felt og varslede innhopp, behold oppgraderinger,
 * sett Warden tilbake med full helse (player.respawn → Våpen fyller ammo), send 'restart' og start bølgen etter REGROUP-pausen.
 */
function resetWave(world, d, i, cause, banner) {
  clearField(world, d);
  placePlayer(world, d, true);
  d.queue = []; d.hold = null; d.zone = null; d.retry = true;
  d.wi = i; d.waveDone = false; d.wave = d.level.waves[i] || d.wave;
  world.level.wave = i + 1; world.level.waveId = d.level.waves[i]?.id ?? null;
  if (banner) d.banner = cause === 'death'
    ? { kicker: 'SIGNAL LOST', title: 'WARDEN DOWN – RESTARTING WAVE', t0: now(), dur: 2.0, col: '#ff4d3a' }
    : { kicker: 'REGROUP', title: 'RESTARTING WAVE', t0: now(), dur: 1.8, col: '#ffb347' };
  world.events.emit('restart', { level: d.n, waveId: d.level.waves[i]?.id, cause });
  startBreak(d, RETRY_BREAK, () => beginWave(world, d, i, { retry: true }));
}

/**
 * Start gjeldende bølge på nytt (pausemenyens RESTART WAVE – Våpen, src/ui/pauseMenu.js).
 * Samme logikk som død-omstart, men uten «fallen» og uten død: fiender og varslede innhopp ryddes,
 * oppgraderinger beholdes, Warden får full helse/ammo og står på startpunktet. Sender restart {level, waveId, cause}.
 * Gjør ingenting og returnerer false når ingen bølge er aktiv (mellomsekvens, kortvalg, nivåslutt, død, rulletekst,
 * pausen før første bølge i nivået). Ellers true. Tilgjengelig som world.modules.levels.restartWave.
 */
export function restartWave(world, { cause = 'menu' } = {}) {
  const d = dirs.get(world);
  if (!d || !d.level || d.cards) return false;
  if (d.phase !== 'wave' && d.phase !== 'break') return false;
  if (d.wi < 0 && !d.waveDone) return false;             // pausen før første bølge: ingenting å starte på nytt
  if (d.waveDone && d.wi >= d.level.waves.length - 1) return false;
  d.token++;                                              // ugyldiggjør ventende tidtakere/innhopp fra forrige forsøk
  resetWave(world, d, currentWaveIndex(d), cause, true);
  return true;
}

// ---------------------------------------------------------------- hjelpere
async function playCutscene(world, d, id) {
  if (!id) return;
  const prev = d.phase; d.phase = 'cutscene';
  pause(world, d, true);
  try { await showCutscene(id, { world }); } catch (err) { console.info('[levels] mellomsekvens feilet', err); }
  pause(world, d, false);
  if (d.phase === 'cutscene') d.phase = prev === 'dead' ? 'between' : prev;
}

function pause(world, d, on) {
  world.input?.reset?.();                                   // nullstill holdte taster ved pause av/på (S-feilen 26.10)
  if (on) { if (!world.paused) { world.paused = true; d.pausedByMe = true; } }
  else if (d.pausedByMe) { world.paused = false; d.pausedByMe = false; }
}

function loadArenaFor(world, L) {
  const arena = world.modules?.arena;
  if (!arena?.loadArena) return;
  const known = arena.ARENAS ? !!arena.ARENAS[L.arena] : true;
  if (!known) { console.info(`[levels] arena '${L.arena}' finnes ikke ennå – beholder '${world.arena?.id}'`); return; }
  if (world.arena?.id !== L.arena) arena.loadArena(world, L.arena);
}

function clearField(world, d) {
  for (const e of world.enemies) e.dead = true;
  world.enemies = [];
  if (Array.isArray(world.projectiles)) world.projectiles.length = 0;
  d.mine = []; d.queue = []; d.boss = null;
  cancelPending(world, d);
}

/** Varslede innhopp som ikke har dukket opp ennå (Fiende-AI sin teller når den finnes, ellers vår egen liste). */
function pendingCount(world, d) {
  const mod = world.modules?.enemies;
  const own = (d.pend || []).filter((h) => !h.enemy && !h.cancelled).length;
  return mod?.pendingSpawns ? Math.max(own, mod.pendingSpawns(world)) : own;
}
function cancelPending(world, d) {
  for (const h of d.pend || []) h.cancel?.();
  d.pend = [];
  world.modules?.enemies?.clearPendingSpawns?.(world);
}

function placePlayer(world, d, heal) {
  const p = world.player; if (!p) return;
  const sp = world.arena?.playerSpawn || resolveSpawn(d.level, d.level.playerSpawn, world.bounds);
  const mod = world.modules?.player;
  if (mod?.respawn) { mod.respawn(world, sp.x, sp.y); }
  else {
    p.x = sp.x; p.y = sp.y;
    if (heal) { p.dead = false; p.hp = p.maxHp; }
  }
  if (world.camera) { world.camera.x = p.x; world.camera.y = p.y; }
}

export { LEVELS };

/** Kun for tester/feilsøking: hopp til bølge i (0-basert) i gjeldende nivå etter en kort pause. */
export function _debugWave(world, i, secs = 1) {
  const d = D(world); if (!d.level) return;
  d.queue = []; clearField(world, d); d.wi = i - 1; d.waveDone = true;
  startBreak(d, secs, () => beginWave(world, d, i));
}
