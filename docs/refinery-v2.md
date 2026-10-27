# Deepwell Refinery v2 – plan for nivå 2 (Story og brett, 27.10)

Skisse: `docs/refinery-v2.png` (tegnet fra dataene). Generator + selvsjekk: `python3 reviews/story-tools/refinery-v2.py` → `reviews/story-tools/refinery-v2.js.txt`.

## Intensjon
Ett langt, sammenhengende raffineri (96 × 36 ruter = 3072 × 1152 px) som går fra sørvest til nordøst. Følgekameraet går med Warden. Fem kampseksjoner, hver med en port som åpnes når forrige er ryddet. Banen ender med et hold ved drivstofftanken, der Kiln Alpha kommer. Historien er den samme: Deepwell Refinery, «Keep them off the fuel», Kiln Alpha og `refinery-clear` etterpå.

Rute: **S1 Gate Yard → S2 Pipe Rack → S3 Crossroads (oljekanal) → S4 Pump Station → S5 Fuel Tank (hold)**.
- Formen er uregelmessig: seksjonene forskyves i høyde, og det er nisjer/innhakk i hjørnene (`NOTCH`) og en oljekanal (`water`) tvers over S3.
- Høye ting står bare langs kanten: containere, rørgater (`pipes`), tank og pumpehus.
- Inne i banen er det bare lav dekning: 41 stykker, 20 vertikale (≤ 2 ruter), 21 horisontale, 9 L-former.

## Seksjoner og bølger
| Seksjon | Bølge(r) | Innganger (spawn-nøkler) | Fiender | maxAlive | Varighet |
|---|---|---|---|---|---|
| S1 Gate Yard | 2-1 Pipe Row | s1north, s1south | Husk 4, Lurcher 2 | 6 | ~45 s |
| S2 Pipe Rack | 2-2 Kiln | s2north, s2east, s2south | Kiln 1, Husk 3 | 4 | ~50 s |
| S3 Crossroads | 2-3 Three Ways + 2-4 Shell and Spine | s3north, s3south, s3east | Husk 6, Lurcher 4, Kiln 1, Hunker 2 (ny i 2-4) | 7 | ~2 × 55 s |
| S4 Pump Station | 2-5 The Flare | s4north, s4east, s4south | Kiln 2, Husk 4, Lurcher 3, Spitter 1, Hunker 2 | 8 | ~70 s |
| S5 Fuel Tank | 2-6 Kiln Alpha (HOLD) | s5north, s5south, s5east, s5ne | Kiln Alpha + Husk 6, Lurcher 4, Kiln 1, Spitter 1 i puljer | 9 | 75 s hold |

- Enemy-id-er: Husk = `grunt`, Lurcher = `flanker`, Kiln = `heavy`, Spitter = `grenadier`, Hunker = `hunker`.
- **Usikkert:** `hunker` finnes i enemies/ (pose.js, test.js), men ikke i `ENEMY_TYPES`/`THREAT` i data.js. Validatoren avviser den til Fiende-AI legger den inn. Til da settes 2-4/2-5 med `flanker` på Hunkers plass.
- Bølgen som rydder seksjonen sender `sectionClear`, og porten åpnes. Kortvalget kommer der det står nå (`upgradeAfter` på 2-2/2-4/2-6).

## Hold (2-6)
- Sone: sirkel med sentrum 83,5/14 og r 3 ruter (`zones.tank`), foran tanken FUEL 01. Varighet 75 s.
- Regel: tidtakeren går bare når Warden er i sonen (finnes i dag). NYTT: *Fuel integrity* 100 %. Hver fiende innenfor 2 ruter fra tanken trekker 2 %/s, og en Kiln trekker 5 %/s.
- Kiln Alpha kommer fra s5ne etter ~15 s, og en ny Kiln-pulje kommer ved ~50 s.
- HUD (engelsk): «Hold the tank — 75 s» / «FUEL INTEGRITY» / feil: «The fuel is lost.»
- Feil (integritet 0 eller død): bølgen starter på nytt, og oppgraderingene beholdes (låst regel). Seksjonsportene forblir åpne.

## Start
- ENTRY er et rektangel x 4, y 26,75, 3 × 2,5. `spawnA` står på 5,5/28 (176/896 px).
- Første dekning er barrier 8.25,27 (0,75 × 2), 3,1 ruter foran. Første ammo ligger på 5,2 ruter. Hver seksjonsstart har sin egen ammokasse ved dekning.

## Selvsjekk (harde feil)
Følgende er sjekket, og alle består:
- **Plassering av dekning:** klaring 1,25 ruter mot vegger, høye ting, vann og porter; dybde ≥ 0,625; vertikal ≤ 2; ingen overlapp.
- **Start:** ENTRY har klaring og ligger ikke i skygge (+0,76/+1,18 + 0,15); første dekning ligger 1,5–3,5 ruter foran og ammo1 5–6 ruter.
- **Spawner:** hver spawn er ≥ 8 ruter fra seksjonsstarten, og siktlinjen fra hver spawn til seksjonsstarten er blokkert.
- **Korridorer:** de er minst 3 ruter brede (r 1,5 mot høye ting), og Kiln (r 22 px + 0,1) kommer forbi all dekning fra start til alle seksjoner og spawner.
- **Hopp:** min. 3,08 ruter (snitt 4,3). Alt er nåbart med portene åpne.

## Dette må Arena (og andre) bygge nytt
- **Verdensstørrelse:** createWorld er 1600 × 1200 som standard, og `loadArena` setter `bounds` fra cols·32 × rows·32. 96 × 36 (3072 × 1152) bør gå. **Usikkert:** ytelsen til forhåndstegnede lag (decals/top-lag, skyggelerret i `drawShadows` lager et lerret på hele verdenen × RES). Anbefalt maks er ~100 × 40 ruter. Hvis det trenger tiling, kan vi krympe S3.
- **Kamera:** følgekamera stopper mot brettkantene (CORE-API 27.10), så det trengs ikke noe nytt. Sjekk `padBottom` (settes bare for yard v2) og zoom 2,25 på et smalt brett.
- **Porter:** ny kind `gate` (høy, blokkerer gange og kuler, ingen dekning). Den fjernes/senkes med animasjon på `sectionClear {section}`. Arena eier kollisjonen og tegningen.
- **Hold med tank-HP:** dagens hold (levels/index.js) har bare tid-i-sone. Det trengs `fuel` (0–100) i `d.hold`, et drain fra fiender nær `zones.tank`, en HUD-bar «FUEL INTEGRITY» og feilutfall → `restartWave`. Det er min kode, og jeg bygger det.
- **Spawner per seksjon:** levels trenger `section` per bølge (eller `sections[].spawns`) og må bare bruke spawnene i aktiv seksjon. Fiender i en lukket seksjon må ikke pathe gjennom porter. Fiende-AI sjekker pathing med porter.
- **Ytelse:** færre aktive fiender (maxAlive ≤ 9), og fiender i inaktive seksjoner oppdateres ikke. Lys bare i aktiv og neste seksjon (**usikkert:** lyskostnaden på stort brett).
- **levels/index.js (meg):** `sectionOf(wave)`, sende `sectionClear` når seksjonens siste bølge er ryddet, flytte checkpoint (restart i aktiv seksjon), hold med `fuel`, spawnPoints i ruter → normalisert mot de nye bounds.
- **Nye events:** `sectionStart {section}`, `sectionClear {section}`, `gateOpen {id}`, `holdStart {zone, seconds}`, `holdTick {t, fuel}`, `holdEnd {ok}`, `fuelLost`.
- **Nye objektkinds:** `pipes`, `tank`, `gate`. `water` brukes som oljekanal (tegnes som olje).

## Ferdig data
```js
export const REFINERY_V2 = {
  id: 'refinery-crossroads', variant: 'v2', name: 'Deepwell Refinery', board: 'BOARD 02',
  cols: 96, rows: 36,
  entry: {'x': 4, 'y': 26.75, 'w': 3, 'h': 2.5},
  playerSpawn: {'x': 5.5, 'y': 28},
  sections: [{'id': 'S1', 'name': 'Gate Yard', 'rect': [2, 18, 17, 16], 'start': [5.5, 28], 'spawns': ['s1north', 's1south']}, {'id': 'S2', 'name': 'Pipe Rack', 'rect': [21, 14, 20, 16], 'start': [23.5, 25.5], 'spawns': ['s2north', 's2east', 's2south']}, {'id': 'S3', 'name': 'Crossroads', 'rect': [43, 6, 16, 26], 'start': [45, 21], 'spawns': ['s3north', 's3south', 's3east']}, {'id': 'S4', 'name': 'Pump Station', 'rect': [61, 3, 14, 18], 'start': [62.8, 11], 'spawns': ['s4north', 's4east', 's4south']}, {'id': 'S5', 'name': 'Fuel Tank', 'rect': [77, 3, 16, 24], 'start': [79.5, 12], 'spawns': ['s5north', 's5south', 's5east', 's5ne']}],
  gates: [{'section': 'S1', 'x': 19, 'y': 23.5, 'w': 2, 'h': 4, 'opensOn': 'sectionClear'}, {'section': 'S2', 'x': 41, 'y': 19, 'w': 2, 'h': 4, 'opensOn': 'sectionClear'}, {'section': 'S3', 'x': 59, 'y': 8, 'w': 2, 'h': 4, 'opensOn': 'sectionClear'}, {'section': 'S4', 'x': 75, 'y': 10, 'w': 2, 'h': 4, 'opensOn': 'sectionClear'}],
  zones: {'tank': {'x': 83.5, 'y': 14, 'r': 3.0, 'seconds': 75, 'tank': 'FUEL 01'}},
  objects: [
    ['wall', 0, 0, 96, 1],
    ['wall', 0, 1, 96, 1],
    ['wall', 0, 2, 96, 1],
    ['wall', 0, 3, 61, 1],
    ['wall', 75, 3, 7, 1],
    ['wall', 93, 3, 3, 1],
    ['wall', 0, 4, 61, 1],
    ['wall', 75, 4, 7, 1],
    ['wall', 93, 4, 3, 1],
    ['wall', 0, 5, 61, 1],
    ['wall', 75, 5, 7, 1],
    ['wall', 93, 5, 3, 1],
    ['wall', 0, 6, 49, 1],
    ['wall', 59, 6, 2, 1],
    ['wall', 75, 6, 7, 1],
    ['wall', 93, 6, 3, 1],
    ['wall', 0, 7, 49, 1],
    ['wall', 59, 7, 2, 1],
    ['wall', 75, 7, 7, 1],
    ['wall', 93, 7, 3, 1],
    ['wall', 0, 8, 49, 1],
    ['wall', 75, 8, 2, 1],
    ['wall', 93, 8, 3, 1],
    ['wall', 0, 9, 49, 1],
    ['wall', 75, 9, 2, 1],
    ['wall', 93, 9, 3, 1],
    ['wall', 0, 10, 49, 1],
    ['wall', 93, 10, 3, 1],
    ['wall', 0, 11, 43, 1],
    ['wall', 93, 11, 3, 1],
    ['wall', 0, 12, 43, 1],
    ['wall', 59, 12, 2, 1],
    ['wall', 93, 12, 3, 1],
    ['wall', 0, 13, 43, 1],
    ['wall', 59, 13, 2, 1],
    ['wall', 93, 13, 3, 1],
    ['wall', 0, 14, 29, 1],
    ['wall', 41, 14, 2, 1],
    ['wall', 59, 14, 2, 1],
    ['wall', 75, 14, 2, 1],
    ['wall', 93, 14, 3, 1],
    ['wall', 0, 15, 29, 1],
    ['wall', 41, 15, 2, 1],
    ['wall', 59, 15, 7, 1],
    ['wall', 75, 15, 2, 1],
    ['wall', 93, 15, 3, 1],
    ['wall', 0, 16, 29, 1],
    ['wall', 41, 16, 2, 1],
    ['wall', 59, 16, 7, 1],
    ['wall', 75, 16, 2, 1],
    ['wall', 93, 16, 3, 1],
    ['wall', 0, 17, 29, 1],
    ['wall', 41, 17, 2, 1],
    ['wall', 59, 17, 7, 1],
    ['wall', 75, 17, 2, 1],
    ['wall', 93, 17, 3, 1],
    ['wall', 0, 18, 8, 1],
    ['wall', 19, 18, 2, 1],
    ['wall', 41, 18, 2, 1],
    ['wall', 59, 18, 7, 1],
    ['wall', 75, 18, 2, 1],
    ['wall', 93, 18, 3, 1],
    ['wall', 0, 19, 8, 1],
    ['wall', 19, 19, 2, 1],
    ['wall', 59, 19, 7, 1],
    ['wall', 75, 19, 2, 1],
    ['wall', 93, 19, 3, 1],
    ['wall', 0, 20, 8, 1],
    ['wall', 19, 20, 5, 1],
    ['wall', 59, 20, 7, 1],
    ['wall', 75, 20, 2, 1],
    ['wall', 93, 20, 3, 1],
    ['wall', 0, 21, 8, 1],
    ['wall', 59, 21, 22, 1],
    ['wall', 93, 21, 3, 1],
    ['wall', 0, 22, 2, 1],
    ['wall', 59, 22, 22, 1],
    ['wall', 93, 22, 3, 1],
    ['wall', 0, 23, 2, 1],
    ['wall', 41, 23, 2, 1],
    ['wall', 59, 23, 22, 1],
    ['wall', 93, 23, 3, 1],
    ['wall', 0, 24, 2, 1],
    ['wall', 41, 24, 2, 1],
    ['wall', 59, 24, 22, 1],
    ['wall', 93, 24, 3, 1],
    ['wall', 0, 25, 2, 1],
    ['wall', 41, 25, 2, 1],
    ['wall', 59, 25, 22, 1],
    ['wall', 93, 25, 3, 1],
    ['wall', 0, 26, 2, 1],
    ['wall', 33, 26, 10, 1],
    ['wall', 53, 26, 28, 1],
    ['wall', 93, 26, 3, 1],
    ['wall', 0, 27, 2, 1],
    ['wall', 33, 27, 10, 1],
    ['wall', 53, 27, 43, 1],
    ['wall', 0, 28, 2, 1],
    ['wall', 19, 28, 2, 1],
    ['wall', 33, 28, 10, 1],
    ['wall', 53, 28, 43, 1],
    ['wall', 0, 29, 2, 1],
    ['wall', 19, 29, 2, 1],
    ['wall', 33, 29, 10, 1],
    ['wall', 53, 29, 43, 1],
    ['wall', 0, 30, 2, 1],
    ['wall', 19, 30, 24, 1],
    ['wall', 53, 30, 43, 1],
    ['wall', 0, 31, 2, 1],
    ['wall', 19, 31, 24, 1],
    ['wall', 53, 31, 43, 1],
    ['wall', 0, 32, 2, 1],
    ['wall', 19, 32, 77, 1],
    ['wall', 0, 33, 2, 1],
    ['wall', 19, 33, 77, 1],
    ['wall', 0, 34, 96, 1],
    ['wall', 0, 35, 96, 1],
    ['container', 4, 32.5, 6, 1.5, {'color': 1}],
    ['container', 12, 18, 5, 1.4, {'color': 3}],
    ['pipes', 23, 28.6, 9, 1.4, {}],
    ['pipes', 29, 14, 11, 1.2, {}],
    ['tank', 53.5, 26, 5.5, 5.5, {}],
    ['building', 70, 3, 5, 4, {'sign': 'PUMP 2'}],
    ['pipes', 61, 19.6, 4, 1.4, {}],
    ['tank', 88, 9, 5, 10, {'sign': 'FUEL 01'}],
    ['container', 82, 25.5, 6, 1.5, {'color': 0}],
    ['water', 49, 15.5, 10, 2],
    ['gate', 19, 23.5, 2, 4, {'section': 'S1'}],
    ['gate', 41, 19, 2, 4, {'section': 'S2'}],
    ['gate', 59, 8, 2, 4, {'section': 'S3'}],
    ['gate', 75, 10, 2, 4, {'section': 'S4'}],
    ['barrier', 8.25, 27, 0.75, 2],
    ['barrier', 5.0, 23.425, 2, 0.75],
    ['sandbag', 10.425, 22.5, 0.75, 2],
    ['sandbag', 14.0, 23.575, 2, 0.75],
    ['barrier', 15.25, 24.325, 0.75, 1.5],
    ['crates', 11.3, 27.3, 2, 0.8],
    ['barrier', 14.025, 30.3, 0.75, 2],
    ['barrier', 24.15, 19.725, 2, 0.75],
    ['sandbag', 24.15, 20.475, 0.75, 1.5],
    ['barrier', 28.2, 19.425, 2, 0.75],
    ['sandbag', 33.025, 18.5, 0.75, 2],
    ['sandbag', 37.2, 19.425, 2, 0.75],
    ['barrier', 38.45, 20.175, 0.75, 1.5],
    ['crates', 26.4, 23.3, 2, 0.8],
    ['barrier', 31.075, 22.25, 0.75, 2],
    ['barrier', 54.4, 11.275, 2, 0.75],
    ['sandbag', 54.4, 12.025, 0.75, 1.5],
    ['barrier', 50.5, 18.925, 2, 0.75],
    ['sandbag', 45.125, 21.75, 0.75, 2],
    ['sandbag', 48.55, 22.075, 2, 0.75],
    ['barrier', 49.8, 22.825, 0.75, 1.5],
    ['crates', 52.75, 22.35, 2, 0.8],
    ['barrier', 47.225, 25.2, 0.75, 2],
    ['barrier', 62.35, 4.525, 2, 0.75],
    ['sandbag', 62.35, 5.275, 0.75, 1.5],
    ['barrier', 64.45, 8.725, 2, 0.75],
    ['sandbag', 63.125, 11.25, 0.75, 2],
    ['sandbag', 66.7, 12.325, 2, 0.75],
    ['barrier', 67.95, 13.075, 0.75, 1.5],
    ['crates', 70.75, 11.85, 2, 0.8],
    ['barrier', 87.375, 4.35, 0.75, 2],
    ['barrier', 80.3, 15.775, 2, 0.75],
    ['sandbag', 80.3, 16.525, 0.75, 1.5],
    ['barrier', 84.35, 15.475, 2, 0.75],
    ['sandbag', 83.025, 18.75, 0.75, 2],
    ['sandbag', 88.7, 22.525, 2, 0.75],
    ['barrier', 89.95, 23.275, 0.75, 1.5],
    ['barrier', 45.365, 17.954, 2, 0.75],
    ['barrier', 65.246, 5.713, 2, 0.75],
    ['barrier', 80.344, 9.259, 2, 0.75],
    ['barrier', 84.052, 8.557, 0.75, 2],
  ],
  ammoCrates: [[10.7, 27.7], [23.55, 20.1], [46.62, 26.2], [67.35, 13.82], [82.9, 16.15]],
  spawnPoints: {
    spawnA: { x: 5.5, y: 28, dir: 'E' },
    s1north: { x: 15, y: 20.2, dir: 'N' },
    s1south: { x: 17, y: 32.8, dir: 'S' },
    s2north: { x: 31.5, y: 16.6, dir: 'N' },
    s2east: { x: 39.8, y: 16.6, dir: 'E' },
    s2south: { x: 36, y: 22.5, dir: 'S' },
    s3north: { x: 52, y: 7.3, dir: 'N' },
    s3south: { x: 47.5, y: 30.8, dir: 'S' },
    s3east: { x: 57.8, y: 25, dir: 'E' },
    s4north: { x: 67.5, y: 4.3, dir: 'N' },
    s4east: { x: 73.8, y: 16, dir: 'E' },
    s4south: { x: 70, y: 19.8, dir: 'S' },
    s5north: { x: 85.5, y: 4.3, dir: 'N' },
    s5south: { x: 85, y: 24.3, dir: 'S' },
    s5east: { x: 91.5, y: 21, dir: 'E' },
    s5ne: { x: 91.6, y: 6, dir: 'NE' },
  },
};

// levels/data.js nivå 2 (normalisert 0..1 mot 96x36)
    spawnPoints: {
      spawnA: { x: 0.057, y: 0.778, dir: 'E' },
      s1north: { x: 0.156, y: 0.561, dir: 'N' },
      s1south: { x: 0.177, y: 0.911, dir: 'S' },
      s2north: { x: 0.328, y: 0.461, dir: 'N' },
      s2east: { x: 0.415, y: 0.461, dir: 'E' },
      s2south: { x: 0.375, y: 0.625, dir: 'S' },
      s3north: { x: 0.542, y: 0.203, dir: 'N' },
      s3south: { x: 0.495, y: 0.856, dir: 'S' },
      s3east: { x: 0.602, y: 0.694, dir: 'E' },
      s4north: { x: 0.703, y: 0.119, dir: 'N' },
      s4east: { x: 0.769, y: 0.444, dir: 'E' },
      s4south: { x: 0.729, y: 0.550, dir: 'S' },
      s5north: { x: 0.891, y: 0.119, dir: 'N' },
      s5south: { x: 0.885, y: 0.675, dir: 'S' },
      s5east: { x: 0.953, y: 0.583, dir: 'E' },
      s5ne: { x: 0.954, y: 0.167, dir: 'NE' },
    },
    zones: { tank: { x: 0.8698, y: 0.3889, r: 0.0312 } },
```
