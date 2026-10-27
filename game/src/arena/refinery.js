// Board 02 – «Deepwell Refinery» (id «refinery-crossroads»). Ren layoutdata i ruter (1 rute = 32 px). 42 × 30 ruter.
// Konseptreferanse: BOARD 02 // REFINERY CROSSROADS – Spawn A (vår tropp) i sør, Spawn B (fiender) i nord,
// A = venstre felt (under rørbrua, forbi tank T-2), B = sentralkrysset (åpent, omstridt),
// C = høyre flanke (under råoljeledningen, opp østsiden langs T-4).
//
// Objektformat: [kind, x, y, w, h, opts?] (rutekoordinater, øvre venstre hjørne)
//   high    : wall, building, tank, unit, pipeline
//   low     : barrier, sandbag, crates, barrels, pipes, valve
//   overhead: overpipe, catwalk  – går over hodet, INGEN kollisjon, ikke i world.cover

export const REFINERY = {
  id: 'refinery-crossroads', // alias 'refinery' i ARENAS
  name: 'Deepwell Refinery',
  board: 'BOARD 02',
  cols: 42,
  rows: 30,
  seed: 0xB02C,
  entry: { x: 18, y: 23.3, w: 6, h: 4 }, // slutter på 27,3 – nord for sørveggens toppflate
  exit: { x: 18, y: 1, w: 6, h: 3 },
  playerSpawn: { x: 21, y: 25 },

  theme: { floor: '#4c4b4a', ambient: 'rgb(60,70,100)', warm: [255, 142, 58], puddle: '#ffa860', lightScale: 0.85 },

  objects: [
    // Ytre mur
    ['wall', 0, 0, 42, 1],
    ['wall', 0, 29, 42, 1],
    ['wall', 0, 1, 1, 28],
    ['wall', 41, 1, 1, 28],

    // --- Nord: raffineritårn, prosessenheter, ekstraksjon
    ['tank', 2.5, 2.5, 4.5, 4.5, { label: 'T-1', vent: true, color: '#626a6e' }],
    ['crates', 8, 2.5, 2, 1], // 26.10: 48 px fra nordmuren
    ['unit', 11, 5, 6, 3, { sign: 'P-2' }],
    ['pipes', 18, 6, 4, 1],
    ['tank', 24.5, 2.5, 3, 3, { label: 'T-3', color: '#6e6c62' }],
    ['valve', 29, 5, 1, 1, { leak: true }],
    ['unit', 31, 0, 8, 7, { sign: 'P-1' }], // 26.10: overlapper ytre mur (klemfelle)

    // --- Sentralt: L-formet hovedledning skiller krysset fra høyre felt
    ['pipeline', 23, 8, 6, 2, { label: 'FEED 01', valve: 0.3 }],
    ['pipeline', 27, 10, 2, 6, {}],
    ['barrier', 16, 10, 2, 1],
    ['valve', 22, 11, 1, 1, { color: '#c9a227' }],
    ['barrier', 15, 13, 1, 2],
    ['pipes', 20, 16, 3, 1],
    ['barrier', 25, 17, 1, 2],

    // --- Vest: venstre felt mellom rørgata langs muren og tank T-2
    ['pipeline', 0, 8, 3, 13, { colors: ['#5d6367', '#5d6367'] }],
    ['crates', 4, 10, 2, 1],
    ['barrier', 6, 10, 1, 1],
    ['catwalk', 3, 13, 5, 1],
    ['crates', 3, 14, 2, 1],
    ['tank', 8, 15, 4, 4, { label: 'T-2', color: '#6c7273' }],
    ['barrier', 6, 18, 1, 2],
    ['overpipe', 3, 19, 10, 2, { n: 3, label: 'STEAM 04' }],
    ['valve', 8, 21, 1, 1, { leak: true }],
    ['sandbag', 3, 22, 2, 1],
    ['building', 0, 24, 7, 6, { sign: 'R1' }], // 26.10: overlapper ytre mur (klemfelle)

    // --- Sør: ut av inngangen
    ['unit', 12, 22, 4, 3, { sign: 'P-3' }],
    ['barrels', 13, 20, 1, 1],
    ['sandbag', 17, 22, 2, 1],
    ['barrier', 23, 22, 2, 1],
    ['barrels', 16, 26, 1, 1],

    // --- Øst: høyre felt og flanken under råoljeledningen
    ['overpipe', 26, 20, 15, 2, { n: 2, label: 'CRUDE LINE 02', leak: 0.72, colors: ['#6a5036', '#5f666a'] }],
    ['barrier', 26, 24, 1, 2],
    ['pipes', 28, 24, 3, 1],
    ['unit', 34, 24, 8, 6, { sign: 'P-4' }], // 26.10: overlapper ytre mur (klemfelle)
    ['barrier', 31, 18, 1, 2],
    ['valve', 35, 17, 1, 1, {}],
    ['sandbag', 33, 15, 2, 1],
    ['tank', 36.5, 10.5, 3, 3, { label: 'T-4', color: '#5f676b' }],
    ['barrels', 30, 12, 1, 1],
    ['crates', 33, 9, 2, 1],
  ],

  routes: {
    mid: { name: 'A – Left Lane', pts: [[19, 27], [16.5, 27.8], [13, 26.6], [8.6, 23.4], [5.6, 21], [5.2, 16.5], [5.6, 12.6], [8, 11], [8.4, 8], [9, 4.2], [14, 3.6], [19.5, 2.6]] },
    central: { name: 'B – Central Crossroads', pts: [[21, 26], [21, 23.5], [21, 19.5], [18.5, 17.5], [18.5, 12.3], [19.6, 9.2], [23, 7], [22, 3.2]] },
    flank: { name: 'C – Right Flank', pts: [[23, 27.6], [28.5, 27.6], [32.6, 26], [32.8, 23], [32.5, 19], [32.4, 13.5], [32, 8.5], [29.6, 7.2], [26.2, 5.2], [23, 3]] },
  },

  killZones: [
    { x: 16, y: 12, w: 9, h: 6, name: 'Crossroads' },
    { x: 10, y: 2, w: 8, h: 3, name: 'Tower Pass' },
  ],

  // Ammokasser (ruter, senter). A: venstre felt ved T-2, B: krysset, C: høyre flanke, + nord ved P-2.
  ammoCrates: [[6.8, 16.5], [17.2, 15.2], [34.1, 14.1], [12.5, 9.5]],

  // Navngitte spawnpunkter (ruter) – nøklene matcher level.spawnPoints for nivå 2 i levels/data.js.
  spawnPoints: {
    spawnA: { x: 21, y: 25, dir: 'S' },
    north: { x: 21, y: 3.5, dir: 'N' },
    northwest: { x: 9, y: 5.2, dir: 'NW' },
    northeast: { x: 30.8, y: 8.8, dir: 'NE' },
    west: { x: 6.9, y: 13.1, dir: 'W' },
    east: { x: 38.5, y: 18.6, dir: 'E' },
  },

  enemySpawns: [
    { x: 21, y: 2.5 }, { x: 15, y: 3.5 }, { x: 27.8, y: 6 }, { x: 33, y: 10.5 },
    { x: 9, y: 8.5 }, { x: 24.5, y: 12 }, { x: 37, y: 17.5 },
  ],

  // kind: 'wall' | 'post' | 'beacon' (rødt blink) | 'flare' (fakkel på tårn)
  lights: [
    { x: 4.5, y: 3.0, r: 7, kind: 'flare', i: 0.75, color: [255, 120, 40], noOcc: true },
    { x: 3.15, y: 16.5, r: 5, dir: 0, spread: 0.8, kind: 'wall', i: 0.8 },
    { x: 14, y: 8.2, r: 6, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 1.0 },
    { x: 35, y: 7.2, r: 6.5, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 1.0 },
    { x: 33, y: 7.2, r: 4.5, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.7, flicker: true },
    { x: 14, y: 21.8, r: 5, dir: -Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.8 },
    { x: 4, y: 23.8, r: 5, dir: -Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.85, flicker: true },
    { x: 37, y: 23.8, r: 5.5, dir: -Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.9 },
    { x: 21.5, y: 20.2, r: 6.5, kind: 'post', i: 1.0 },
    { x: 24.2, y: 12.6, r: 5.5, kind: 'post', i: 0.85 },
    { x: 9.6, y: 10.6, r: 5.5, kind: 'post', i: 0.85 },
    { x: 30.2, y: 15.3, r: 5, kind: 'post', i: 0.8 },
    { x: 26.2, y: 26.8, r: 5, kind: 'post', i: 0.7 },
    { x: 16.5, y: 3.6, r: 4.5, kind: 'post', i: 0.65, flicker: true },
    { x: 33.4, y: 21.0, r: 4, kind: 'post', i: 0.6 },
    { x: 16.3, y: 9.8, r: 2.6, kind: 'beacon', i: 0.7, color: [255, 40, 28], noOcc: true },
    { x: 25.5, y: 22.4, r: 2.6, kind: 'beacon', i: 0.7, color: [255, 40, 28], noOcc: true },
    { x: 3.2, y: 21.8, r: 2.4, kind: 'beacon', i: 0.6, color: [255, 40, 28], noOcc: true },
  ],

  grates: [[7, 14, 6, 6], [35, 9, 6, 6], [1, 1, 7, 7], [17, 5, 6, 3]],
  steam: [[20.6, 11.6], [8.6, 20.7], [30.5, 26.4]],

  paint: {
    lanes: [[[8.5, 26.8], [17, 26.8]], [[25, 27.9], [33, 27.9]], [[24, 6.6], [30, 6.6]]],
    walkways: [[[5.5, 22], [5.5, 8.6]], [[32.6, 22.5], [32.6, 8.6]], [[16.4, 24], [25.6, 24]]],
    labels: [
      ['A', 5.6, 17.4, 54, 0.5], ['B', 21, 21.6, 54, 0.5], ['C', 33, 24.7, 54, 0.5],
      ['R-02', 20.6, 14.6, 26, 0.3], ['DANGER · H2S', 9.8, 12.6, 11, 0.45], ['CRUDE', 30.4, 19.4, 13, 0.35], ['EVAC ROUTE >', 25.2, 16.9, 11, 0.16],
    ],
  },


  props: [
    { kind: 'trench', pts: [[18.6, 11.5], [26.6, 11.5]] },
    { kind: 'trench', pts: [[33.8, 22.6], [40.6, 22.6]] },
    { kind: 'drain', x: 20.6, y: 19 }, { kind: 'drain', x: 9.5, y: 7.6 }, { kind: 'drain', x: 30.5, y: 22.8 },
    { kind: 'cone', x: 24.6, y: 21.3 }, { kind: 'cone', x: 25.3, y: 21.6 }, { kind: 'cone', x: 17.4, y: 9.6 },
    { kind: 'pallet', x: 11, y: 26.6, a: 0.25 }, { kind: 'pallet', x: 38.4, y: 8.4, a: -0.2 },
    { kind: 'cable', pts: [[12.2, 8.2], [13.4, 9.8], [12.9, 12]] },
    { kind: 'cable', pts: [[34, 7.3], [33.2, 8.6], [34.6, 9.4]] },
    { kind: 'vent', x: 23.4, y: 15.2 }, { kind: 'vent', x: 38.6, y: 17.6 },
  ],
};
