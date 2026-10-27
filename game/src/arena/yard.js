// Board 01 – «Kessa Yard» (id 'yard'). Ren layoutdata i ruter (1 rute = 32 px).
// Konseptreferanse: BOARD 01 // KESSA YARD (inngang sørvest, ekstraksjon nord,
// A = containergate (midtrute), B = sentrale stabler, C = siderute (flanke)).
//
// Objektformat: [kind, x, y, w, h, opts?]  (rutekoordinater, øvre venstre hjørne)
// kind -> dekningstype:
//   high: wall, building, container, stack, cratestack
//   low : barrier, sandbag, crates, barrels
// 'prop' er dekor uten kollisjon (lyktestolper, kumlokk osv. legges i props).

export const YARD = {
  id: 'yard',
  name: 'Kessa Yard',
  board: 'BOARD 01',
  cols: 40,
  rows: 30,
  seed: 0xB01A,
  entry: { x: 1, y: 23.3, w: 7, h: 4 }, // slutter på 27,3 – nord for sørveggens toppflate (54 px), så Warden aldri står under den
  exit: { x: 21, y: 1, w: 6, h: 3 },
  playerSpawn: { x: 4, y: 24.8 },
  // Gangbar sørgrense i view 34: y 27,3 ruter (874 px) = toppflatens kant. Se src/arena/walkable.js (Test 26.10, 1-3).
  // 26.10: alt som sto inntil ytre mur (B1–B5, container 19,27) overlapper nå muren, så kollisjonen alltid skyver innover.
  walkableSouth: 27.3,

  objects: [
    // Ytre mur
    ['wall', 0, 0, 40, 1],
    ['wall', 0, 29, 40, 1],
    ['wall', 0, 1, 1, 28],
    ['wall', 39, 1, 1, 28],

    // Bygninger langs kanten
    ['building', 0, 0, 9, 5, { sign: 'B1' }], // 26.10: overlapper ytre mur (klemfelle)
    ['building', 10, 0, 4, 3, { sign: 'B2' }], // 26.10: overlapper ytre mur (klemfelle)
    ['building', 29, 0, 11, 5, { sign: 'B3' }], // 26.10: overlapper ytre mur (klemfelle)
    ['building', 0, 9, 3, 6, {}], // 26.10: overlapper ytre mur (klemfelle)
    ['building', 36, 8, 4, 7, { sign: 'B4' }], // 26.10: overlapper ytre mur (klemfelle)
    ['building', 33, 25, 7, 5, { sign: 'B5' }], // 26.10: overlapper ytre mur (klemfelle)

    // --- Inngang: første dekning ut av sonen
    ['sandbag', 3, 22, 3, 1],
    ['barrier', 9, 24, 1, 3],

    // --- Rute A: containergate (vest), x 3..8
    ['barrier', 6, 20, 1, 2],
    ['container', 9, 16, 2, 6, { color: 1 }],
    ['crates', 3, 18, 2, 1],
    ['barrier', 6, 15, 2, 1],
    ['crates', 3, 12, 1, 2],
    ['container', 9, 7, 2, 6, { color: 0 }],
    ['barrier', 6, 10, 1, 2],
    ['crates', 4, 7, 2, 1],
    ['barrels', 6, 7, 1, 1], // 26.10: inntil kassene (før 7,6): 64 px til B1 og containeren (spawn northwest)

    // --- Nordkorridor mot ekstraksjon (bevisst kill-zone x 12..19, y 3..6)
    ['barrier', 21, 6, 2, 1],
    ['barrier', 25, 5, 1, 2],

    // --- Rute B: sentrale stabler
    ['barrier', 12, 24, 3, 1],
    ['cratestack', 13, 20, 2, 2],
    ['container', 16, 22, 6, 2, { color: 3 }],
    ['sandbag', 17, 19, 3, 1],
    ['crates', 13, 16, 2, 1],
    ['stack', 16, 12, 2, 5, { color: 2, color2: 4 }],
    ['container', 19, 15, 5, 2, { color: 0 }],
    ['barrels', 20, 12, 2, 1],
    ['crates', 13, 10, 1, 2],
    ['barrier', 18, 9, 3, 1],
    ['container', 23, 8, 2, 5, { color: 4 }],

    // --- Øst / midt-øst
    ['crates', 25, 14, 2, 1],
    ['container', 26, 17, 2, 6, { color: 2 }],
    ['cratestack', 28, 11, 2, 2],
    ['container', 30, 7, 2, 5, { color: 1 }],
    ['stack', 30, 14, 2, 6, { color: 3, color2: 0 }],

    // --- Rute C: flanke (sør, så opp østsiden x 32..35)
    ['crates', 16, 26, 1, 1],
    ['container', 19, 27.5, 6, 2.5, { color: 4 }], // 26.10: overlapper ytre mur (klemfelle)
    ['barrier', 23, 24, 3, 1],
    ['sandbag', 28, 26, 2, 1],
    ['cratestack', 29, 22, 2, 2],
    ['sandbag', 34, 21, 2, 1],
    ['barrier', 32, 17, 1, 2],
    ['crates', 34, 13, 2, 1],
    ['barrier', 32, 9, 1, 2],
    ['crates', 33.6, 6.5, 1, 0.75], // 26.10: 48 px til B3, 51 til B4-hjørnet (spawn northeast)
  ],

  // Rutene som polylinjer i rutekoordinater (sentrum av ruter)
  routes: {
    mid: { name: 'A – Container Lane', pts: [[5, 25], [5.5, 19.5], [5, 14], [6.5, 9], [8.5, 7], [9.5, 5], [16, 4], [23.5, 3]] },
    central: { name: 'B – Central Stacks', pts: [[6, 26], [11, 22.5], [15, 18], [15, 14], [15, 11], [19.5, 10.5], [22.2, 8], [24, 5], [23.5, 3]] },
    flank: { name: 'C – Side Route', pts: [[6, 27.5], [15, 25.5], [22, 25.5], [27, 24.6], [32, 24.4], [33, 23], [33.5, 16], [33.5, 8], [32, 5.5], [27, 4], [24, 2.5]] },
  },

  // Bevisste åpne felt der fienden har overtak
  killZones: [
    { x: 11, y: 3, w: 9, h: 3, name: 'North Corridor' },
    { x: 20, y: 17, w: 5, h: 4, name: 'Courtyard' },
  ],

  // Ammokasser (ruter, senter). Ved dekning, men ute i åpningen. Den første står ~5,4 ruter fra spawn, på østsiden
  // av den lave barrieren (6,20) – opplæringens kasse-hint i 1-2 (docs/LAGRING-OG-OPPLAERING.md).
  ammoCrates: [[7.75, 20.9], [20.5, 18], [32.9, 20.6], [26.3, 12.2]],

  // Navngitte spawnpunkter (ruter) – nøklene matcher level.spawnPoints i levels/data.js (nivå 1 + 2/3 i yard).
  // 'south' brukes av nivå 3 (Foundry-plassholderen) – vestflanken bakfra.
  spawnPoints: {
    entry: { x: 4, y: 24.8, dir: 'S' },
    north: { x: 23, y: 3.5, dir: 'N' },
    northwest: { x: 5, y: 6.2, dir: 'NW' },
    northeast: { x: 36.5, y: 6.5, dir: 'NE' },
    east: { x: 36, y: 18, dir: 'E' },
    west: { x: 2.5, y: 16.6, dir: 'W' },
    south: { x: 12, y: 27.4, dir: 'S' },
  },

  // Fiendeposisjoner (forslag til Fiende-AI/Nivåer)
  enemySpawns: [
    { x: 24, y: 2.5 }, { x: 17, y: 7 }, { x: 28, y: 9.5 }, { x: 33, y: 11 },
    { x: 21, y: 13.5 }, { x: 12, y: 8.5 }, { x: 27, y: 15 },
  ],

  // Lys: x,y i ruter, r i ruter, dir i radianer (0 = øst, med klokka),
  // spread < 1 gir avlang kjegle i retning dir. kind: 'wall' | 'post' | 'flood'
  lights: [
    { x: 3, y: 5.2, r: 6, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 1.0 },
    { x: 7, y: 5.2, r: 5.5, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.9, flicker: true },
    { x: 12, y: 3.2, r: 5, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.8 },
    { x: 31, y: 5.2, r: 6, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 1.0 },
    { x: 36.5, y: 5.2, r: 5, dir: Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.85, flicker: true },
    { x: 35.8, y: 11.5, r: 5, dir: Math.PI, spread: 0.7, kind: 'wall', i: 0.9 },
    { x: 3.2, y: 12, r: 5, dir: 0, spread: 0.7, kind: 'wall', i: 0.75 },
    { x: 35, y: 24.8, r: 5.5, dir: -Math.PI / 2, spread: 0.7, kind: 'wall', i: 0.9 },
    { x: 15, y: 18.5, r: 6.5, kind: 'post', i: 1.0 },
    { x: 22.3, y: 11, r: 6, kind: 'post', i: 0.95 },
    { x: 8, y: 13.6, r: 5, kind: 'post', i: 0.8, flicker: true },
    { x: 28.5, y: 20.5, r: 6, kind: 'post', i: 0.9 },
    { x: 26.5, y: 26, r: 5, kind: 'post', i: 0.7 },
    { x: 12, y: 26.5, r: 5, kind: 'post', i: 0.65 },
    { x: 33.3, y: 14, r: 4.5, kind: 'post', i: 0.7 },
  ],

  // Gulvmaling: stiplede kjørefelt og store sonebokstaver [tekst, x, y, px, alfa]
  paint: {
    lanes: [[[10.5, 25.6], [31.5, 25.6]], [[32.3, 23.5], [32.3, 13]], [[8.4, 23], [8.4, 6.2]], [[11, 7.3], [19.5, 7.3]]],
    labels: [['A', 5, 16.9, 54, 0.55], ['B', 12, 19.2, 54, 0.55], ['C', 34, 25.6, 54, 0.55], ['Y-01', 21, 21.3, 26, 0.35], ['Y-02', 28, 15.6, 26, 0.35], ['EVAC ROUTE >', 9.2, 27.3, 11, 0.3], ['RESTRICTED · MIL ZONE 4', 18.6, 4.6, 10, 0.28]],
  },

  // Dekor uten kollisjon
  props: [
    { kind: 'drain', x: 11.5, y: 14 }, { kind: 'drain', x: 21, y: 19.5 }, { kind: 'drain', x: 33.5, y: 19 },
    { kind: 'drain', x: 18, y: 4.5 }, { kind: 'pallet', x: 4.5, y: 14.5, a: 0.2 },
    { kind: 'pallet', x: 27.6, y: 25.2, a: -0.3 }, { kind: 'cone', x: 10.6, y: 23.6 }, { kind: 'cone', x: 10.4, y: 22.9 },
    { kind: 'cone', x: 24.7, y: 7.4 }, { kind: 'cable', pts: [[3.2, 5], [3.6, 7], [2.9, 9]] },
    { kind: 'vent', x: 37.2, y: 16.5 }, { kind: 'pallet', x: 19.5, y: 7.6, a: 0.05 },
  ],
};
