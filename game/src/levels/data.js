// Spilltekst (name/objective) er på engelsk; kommentarer på norsk.
// BREACH – nivå- og bølgedata (eies av Breach Nivåer og story).
// Rene data + små hjelpefunksjoner. Ingen import fra core; trygt å laste i test-sider og Node.
//
// Format (se docs/NIVAER-OG-STORY.md, «Dataformat»):
//   LEVELS[i] = { n, id, arena, name, objective, cutsceneBefore?, cutsceneAfter?, playerSpawn, spawnPoints, waves[] }
//   wave      = { id, name, objective, maxAlive, breakAfter, upgradeAfter, cutsceneBefore?, groups[] }
//   objective = { type: 'clear' } | { type: 'hold', zone, seconds } | { type: 'kill', target: 'boss' }
//   boss-bølge = { id, name, type: 'boss', boss, zone, objective: {type:'kill',target:'boss'}, maxAlive,
//                  cutsceneBefore?, groups: [], phases: [{ phase, at, name, adds: group[] }] }
//     boss   : id hos Fiende-AI (world.modules.enemies.spawnBoss(world, boss, x, y, opts)), f.eks. 'ashmaw'
//     zone   : sone (world.arena.zones / level.zones) der bossen kommer opp
//     phases : at = hp-andel (1 → 0) fasen starter ved; adds = vanlige grupper, delay regnes fra fasestart.
//     Uten spawnBoss i enemies hopper levels over bølgen (console.info) – se docs/NIVAER-OG-STORY.md «Boss-API».
//   group     = { type, count, spawn, delay, interval }
//     type     : 'grunt' | 'flanker' | 'heavy' | 'grenadier'   (samme navn som enemies/createEnemy)
//     spawn    : id i level.spawnPoints
//     delay    : sekunder etter waveStart før første fiende i gruppen kommer
//     interval : sekunder mellom hver fiende i gruppen
//   spawnPoints: { id: { x, y, dir } } – x/y er NORMALISERT (0..1) mot world.bounds, slik at arena-rollen
//   kan overstyre med eksakte punkter (arena.spawnPoints[id]) uten at dataene her må endres.

import { DISPLAY_NAMES } from '../enemies/stats.js';

export const ENEMY_TYPES = ['grunt', 'flanker', 'heavy', 'grenadier', 'hunker'];

/** Trusselvekt per fiendetype – brukes kun til å måle vanskelighetskurven. */
export const THREAT = { grunt: 1, flanker: 1.5, heavy: 3, grenadier: 2, hunker: 1.8 };   // hunker 27.10: 120 hp + ryggskjold. Kun brett 2 (Alexander 27.10), ikke i brett 1.

// variant (valgfri): 'alpha' = mini-boss (Kiln Alpha). Se VARIANTS.
const g = (type, count, spawn, delay = 0, interval = 1.2, variant) => ({ type, count, spawn, delay, interval, ...(variant ? { variant } : {}) });

/** Varianter (Cinder). Levels skalerer bare hp; utseende/oppførsel for 'alpha' er foreslått til Fiende-AI/Karakter. */
export const VARIANTS = { alpha: { nameKey: 'kilnAlpha', hpMul: 2.2 } };

/** Monsternavn (spilltekst) eies av Fiende-AI: DISPLAY_NAMES i enemies/stats.js (ren data, ingen import). */
export { DISPLAY_NAMES };
const N = DISPLAY_NAMES;

export const LEVELS = [
  {
    n: 1, id: 'container-yard', arena: 'yard', name: 'Kessa Yard',
    objective: 'Hold the yard until the last ship clears.',
    cutsceneBefore: 'intro', cutsceneAfter: 'yard-clear',
    playerSpawn: 'entry',
    spawnPoints: {   // Kessa Yard v2 (27.10, Storys forslag i reviews/story-tools/yard-v2.js.txt); ingen ekstraksjon
      entry:     { x: 0.20, y: 0.72, dir: 'N' },  // Entry zone (spiller)
      north:     { x: 0.51, y: 0.06, dir: 'N' },  // nordporten – vanlig fiendeinngang
      northwest: { x: 0.04, y: 0.25, dir: 'NW' },
      west:      { x: 0.04, y: 0.45, dir: 'W' },
      northeast: { x: 0.94, y: 0.22, dir: 'NE' },
      east:      { x: 0.94, y: 0.55, dir: 'E' },  // Side route (C) – flankerute
      south:     { x: 0.88, y: 0.82, dir: 'S' },  // ny: sørøst ved innløpet
      pier:      { x: 0.40, y: 0.95, dir: 'S' },  // ny: piren
    },
    waves: [
      // Balanse brett 1 (demo, 23.10 – se reviews/brett1-demo-2026-10-23.md): én ny ting per bølge, topp i 1-5,
      // korte pauser (kortvalget er selve pusten etter 1-2/1-4/1-5).
      { id: '1-1', name: 'First Contact', objective: { type: 'clear' }, maxAlive: 3, breakAfter: 4, upgradeAfter: false,
        groups: [g('grunt', 3, 'north', 1.5, 1.8), g('grunt', 1, 'northwest', 9)] },                // lær: Husk, to retninger
      { id: '1-2', name: 'Glow in the Cracks', objective: { type: 'clear' }, maxAlive: 4, breakAfter: 3, upgradeAfter: true,
        groups: [g('grunt', 3, 'north', 1, 1.6), g('grunt', 2, 'northeast', 9, 1.6)] },
      { id: '1-3', name: `${N.flanker}s`, objective: { type: 'clear' }, maxAlive: 5, breakAfter: 4, upgradeAfter: false,
        groups: [g('grunt', 3, 'north', 1, 1.2), g('flanker', 2, 'east', 6, 2.5), g('grunt', 1, 'northwest', 10),
                 g('flanker', 1, 'west', 14)] },                                                           // NY: Lurcher (flanke)
      { id: '1-4', name: 'Pincer', objective: { type: 'clear' }, maxAlive: 5, breakAfter: 3, upgradeAfter: true,   // 6→5 (Test P2-6, 26.10)
        groups: [g('grunt', 4, 'northwest', 1, 1.0), g('flanker', 2, 'west', 5, 2.0), g('grenadier', 1, 'north', 9),
                 g('grunt', 2, 'north', 13, 1.2)] },                                                        // NY: én Spitter (smakebit)
      { id: '1-5', name: 'Last Ship', objective: { type: 'clear' }, maxAlive: 7, breakAfter: 0, upgradeAfter: true,
        // 26.10: tydeligere topp – flere samtidig (mål 6–7), Spitter dekker Kilnens fremrykk, sluttstorm fra to kanter.
        groups: [g('grunt', 4, 'north', 1, 0.9), g('grunt', 2, 'northeast', 3, 1.0), g('flanker', 2, 'east', 6, 1.6),
                 g('grenadier', 1, 'northwest', 9), g('heavy', 1, 'north', 11), g('flanker', 1, 'west', 13),
                 g('grunt', 3, 'north', 17, 0.8), g('grunt', 2, 'northwest', 18, 0.8), g('flanker', 1, 'east', 20)] }, // TOPP: første Kiln
    ],
  },
  {
    n: 2, id: 'refinery-crossroads', arena: 'refinery-crossroads', name: 'Deepwell Refinery',
    objective: 'Hold the crossroads. Keep them off the fuel.',
    cutsceneAfter: 'refinery-clear',
    playerSpawn: 'spawnA',
    spawnPoints: {
      spawnA:    { x: 0.42, y: 0.94, dir: 'S' },  // Spawn A (Warden)
      north:     { x: 0.52, y: 0.04, dir: 'N' },  // Spawn B (fiende)
      northwest: { x: 0.22, y: 0.10, dir: 'NW' }, // ved raffineritårnet
      northeast: { x: 0.80, y: 0.08, dir: 'NE' }, // ved prosessenheten
      west:      { x: 0.04, y: 0.40, dir: 'W' },  // Flank route (venstre)
      east:      { x: 0.96, y: 0.70, dir: 'E' },  // Flank route under rørbroen
    },
    waves: [
      { id: '2-1', name: 'Pipe Row', objective: { type: 'clear' }, maxAlive: 6, breakAfter: 6, upgradeAfter: false,
        groups: [g('grunt', 4, 'north', 1, 1.0), g('flanker', 2, 'west', 6, 2.0)] },
      { id: '2-2', name: N.heavy, objective: { type: 'clear' }, maxAlive: 4, breakAfter: 7, upgradeAfter: true,
        groups: [g('heavy', 1, 'north', 2), g('grunt', 2, 'north', 3, 1.5)] },                // NY: heavy (lav total)
      { id: '2-3', name: 'Three Ways', objective: { type: 'clear' }, maxAlive: 7, breakAfter: 6, upgradeAfter: false,
        groups: [g('grunt', 4, 'north', 1, 1.0), g('flanker', 2, 'east', 5, 2.0), g('flanker', 2, 'west', 9, 2.0)] },
      { id: '2-4', name: 'Shell and Spine', objective: { type: 'clear' }, maxAlive: 7, breakAfter: 7, upgradeAfter: true,
        groups: [g('heavy', 1, 'north', 1), g('grunt', 2, 'northwest', 2, 1.2), g('grunt', 2, 'northeast', 4, 1.2),
                 g('flanker', 2, 'east', 10, 2.0)] },
      { id: '2-5', name: 'The Flare', objective: { type: 'clear' }, maxAlive: 8, breakAfter: 7, upgradeAfter: false,
        groups: [g('heavy', 1, 'north', 1), g('grunt', 4, 'north', 2, 1.0), g('flanker', 2, 'west', 6, 2.0),
                 g('heavy', 1, 'northeast', 12), g('flanker', 1, 'east', 14)] },
      { id: '2-6', name: N.kilnAlpha, objective: { type: 'clear' }, maxAlive: 9, breakAfter: 0, upgradeAfter: true,
        groups: [g('heavy', 1, 'north', 1, 1.2, 'alpha'), g('grunt', 3, 'northwest', 2, 1.0), g('grunt', 3, 'northeast', 2, 1.0),
                 g('flanker', 2, 'west', 7, 1.5), g('flanker', 2, 'east', 9, 1.5), g('heavy', 1, 'north', 16)] }, // MINI-BOSS: Kiln Alpha
    ],
  },
  {
    n: 3, id: 'underground-foundry', arena: 'underground-foundry', name: 'The Deepwell',
    objective: 'Reach the bottom of the shaft. Seal the well.',
    cutsceneAfter: 'ending',
    playerSpawn: 'west',
    spawnPoints: {
      west:      { x: 0.06, y: 0.42, dir: 'W' },  // Player spawn
      northeast: { x: 0.86, y: 0.10, dir: 'NE' }, // Enemy spawn
      east:      { x: 0.96, y: 0.62, dir: 'E' },  // Øst-broen (flaskehals)
      north:     { x: 0.48, y: 0.04, dir: 'N' },  // gantry/trapper
      south:     { x: 0.40, y: 0.96, dir: 'S' },  // vestflanken/ sideruta
    },
    // Fallback når world.arena.zones mangler. Arena eier sonen (foundry.js: 22.5, 19, r 2.4 ruter på 40×30) – speilet her.
    zones: { core: { x: 0.5625, y: 0.6333, r: 0.08 } },
    // Sluttboss ASHMAW etter 3-6 er PLANLAGT (krever Fiende-AI/Arena, se docs/NIVAER-OG-STORY.md). Leses ikke av direktøren.
    waves: [
      { id: '3-1', name: `${N.grenadier}s`, objective: { type: 'clear' }, maxAlive: 5, breakAfter: 6, upgradeAfter: false,
        groups: [g('grunt', 3, 'northeast', 1, 1.2), g('grenadier', 1, 'northeast', 5)] },     // NY: grenadier (lav total)
      { id: '3-2', name: 'The Bridge', objective: { type: 'clear' }, maxAlive: 7, breakAfter: 6, upgradeAfter: true,
        groups: [g('grunt', 4, 'northeast', 1, 1.0), g('grenadier', 1, 'east', 6), g('flanker', 2, 'south', 10, 2.0)] },
      { id: '3-3', name: 'Furnaces', objective: { type: 'clear' }, maxAlive: 7, breakAfter: 7, upgradeAfter: false,
        groups: [g('heavy', 1, 'northeast', 1), g('grunt', 3, 'northeast', 2, 1.0), g('grenadier', 2, 'east', 8, 3.0)] },
      { id: '3-4', name: 'No Way Up', objective: { type: 'clear' }, maxAlive: 8, breakAfter: 7, upgradeAfter: true,
        groups: [g('grunt', 4, 'north', 1, 1.0), g('grenadier', 2, 'northeast', 4, 3.0), g('flanker', 2, 'south', 7, 1.5),
                 g('flanker', 2, 'north', 11, 1.5)] },
      { id: '3-5', name: 'Melting Point', objective: { type: 'clear' }, maxAlive: 9, breakAfter: 8, upgradeAfter: false,
        groups: [g('heavy', 1, 'northeast', 1), g('grunt', 4, 'east', 2, 1.0), g('grenadier', 2, 'north', 6, 3.0),
                 g('flanker', 2, 'south', 9, 1.5), g('heavy', 1, 'east', 15)] },
      { id: '3-6', name: 'Hold the Fuse', cutsceneBefore: 'foundry-core',
        objective: { type: 'hold', zone: 'core', seconds: 75 }, maxAlive: 9, breakAfter: 0, upgradeAfter: false,
        groups: [g('grunt', 4, 'northeast', 2, 1.5), g('flanker', 2, 'south', 8, 2.0), g('grenadier', 1, 'east', 12),
                 g('heavy', 1, 'northeast', 20), g('grunt', 4, 'north', 28, 2.0), g('flanker', 2, 'east', 36, 2.0),
                 g('grenadier', 2, 'northeast', 44, 4.0), g('heavy', 1, 'east', 52), g('grunt', 4, 'northeast', 58, 1.5)] },
      // BOSS (Cinder): Ashmaw kommer opp av brønnen mens lunta brenner. Faser fra docs/STORY-KONSEPTER.md:
      //   1 Burrow   (100 %): graver, erupterer under dekning – få Husks, spilleren skal lese varslene.
      //   2 Furnace  (70 %):  smeltekjegle i midten; Ashmaw kaster selv 2–3 Husks per runde (Fiende-AI) – levels legger bare litt på.
      //   3 Collapse (35 %):  halvt nede i hullet, tilkaller Lurchers fra sprekkene.
      { id: '3-7', name: N.ashmaw || 'Ashmaw', type: 'boss', boss: 'ashmaw', zone: 'core', cutsceneBefore: 'ashmaw-rise',
        objective: { type: 'kill', target: 'boss' }, maxAlive: 6, breakAfter: 0, upgradeAfter: false,
        groups: [],
        phases: [
          { phase: 1, at: 1.0, name: 'Burrow', adds: [g('grunt', 2, 'north', 5, 3.0), g('grunt', 2, 'east', 16, 3.0)] },
          { phase: 2, at: 0.7, name: 'Furnace', adds: [g('grunt', 2, 'northeast', 3, 4.0), g('grenadier', 1, 'north', 10)] },
          { phase: 3, at: 0.35, name: 'Collapse', adds: [g('flanker', 2, 'south', 1, 1.5), g('flanker', 2, 'east', 7, 1.5), g('flanker', 2, 'north', 14, 1.5)] },
        ] },
    ],
  },
];

/** Cutscene som spilles når spilleren dør (game over). */
export const CUTSCENE_ON_DEATH = 'fallen';

// ---------- hjelpefunksjoner ----------

/** n er 1-basert. */
export function getLevel(n) { return LEVELS[n - 1] || null; }

export function getWave(n, waveIndex) { return getLevel(n)?.waves[waveIndex] || null; }

/** Totalt antall fiender i en bølge. */
export function enemyCount(wave) { return wave.groups.reduce((s, gr) => s + gr.count, 0); }

/** Trusselsum for en bølge (vanskelighetskurve). */
export function waveThreat(wave) { return wave.groups.reduce((s, gr) => s + gr.count * (THREAT[gr.type] || 1), 0); }

/**
 * Flat, tidssortert spawn-liste for en bølge: [{ t, type, spawn }].
 * Direktøren (levels/index.js) spiser denne og respekterer wave.maxAlive ved å utsette
 * neste spawn til antall levende fiender er under taket.
 */
export function spawnSchedule(wave, groups = wave.groups) {
  const out = [];
  for (const gr of groups) for (let i = 0; i < gr.count; i++) out.push({ t: gr.delay + i * gr.interval, type: gr.type, spawn: gr.spawn, ...(gr.variant ? { variant: gr.variant } : {}) });
  return out.sort((a, b) => a.t - b.t);
}

/** Spawnpunkt i verdenskoordinater. arenaPoints (fra arena-rollen) vinner over normaliserte standardpunkter. */
export function resolveSpawn(level, spawnId, bounds, arenaPoints = null) {
  // Arena kan gi navngitte punkter ({ north: {x,y} }) – de vinner direkte.
  if (arenaPoints && !Array.isArray(arenaPoints) && arenaPoints[spawnId]) {
    const e = arenaPoints[spawnId]; return { x: e.x, y: e.y };
  }
  const p = level.spawnPoints[spawnId];
  if (!p) throw new Error(`[levels] ukjent spawnpunkt '${spawnId}' i ${level.id}`);
  const want = { x: bounds.x + p.x * bounds.w, y: bounds.y + p.y * bounds.h };
  // Arena kan også gi en navnløs liste (world.arena.enemySpawns): velg nærmeste punkt.
  if (Array.isArray(arenaPoints) && arenaPoints.length) {
    let best = arenaPoints[0], bd = Infinity;
    for (const q of arenaPoints) { const d = (q.x - want.x) ** 2 + (q.y - want.y) ** 2; if (d < bd) { bd = d; best = q; } }
    return { x: best.x, y: best.y };
  }
  return want;
}

/** Første bølge der hver fiendetype opptrer: { grunt: '1-1', flanker: '1-3', ... } */
export function introductions() {
  const seen = {};
  for (const L of LEVELS) for (const w of L.waves) for (const gr of [...w.groups, ...(w.phases || []).flatMap((p) => p.adds || [])]) if (!seen[gr.type]) seen[gr.type] = w.id;
  return seen;
}

/** Enkel selvsjekk av dataene. Returnerer liste med feil (tom = ok). */
export function validateLevels() {
  const errs = [];
  for (const L of LEVELS) {
    const normal = L.waves.filter((w) => w.type !== 'boss').length;
    if (normal < 5 || normal > 6) errs.push(`${L.id}: ${normal} vanlige bølger (skal være 5–6)`);
    if (!L.spawnPoints[L.playerSpawn]) errs.push(`${L.id}: mangler playerSpawn '${L.playerSpawn}'`);
    for (const w of L.waves) {
      if (w.objective.type === 'hold' && !L.zones?.[w.objective.zone]) errs.push(`${w.id}: ukjent sone '${w.objective.zone}'`);
      if (w.type === 'boss') {
        if (!w.boss) errs.push(`${w.id}: boss-bølge uten boss-id`);
        if (!L.zones?.[w.zone]) errs.push(`${w.id}: ukjent boss-sone '${w.zone}'`);
        if (!w.phases?.length) errs.push(`${w.id}: boss-bølge uten faser`);
      }
      for (const gr of [...w.groups, ...(w.phases || []).flatMap((p) => p.adds || [])]) {
        if (!ENEMY_TYPES.includes(gr.type)) errs.push(`${w.id}: ukjent fiendetype '${gr.type}'`);
        if (!L.spawnPoints[gr.spawn]) errs.push(`${w.id}: ukjent spawn '${gr.spawn}'`);
        if (gr.spawn === L.playerSpawn) errs.push(`${w.id}: fiender spawner på spillerens startpunkt`);
      }
    }
  }
  return errs;
}
