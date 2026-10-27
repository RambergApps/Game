# Deepwell Refinery v2 – plan for nivå 2 (Story og brett, 27.10)

Skisse: `docs/refinery-v2.png` (tegnet fra dataene). Generator + selvsjekk: `python3 reviews/story-tools/refinery-v2.py` → `reviews/story-tools/refinery-v2.js.txt`.

## Intensjon
Ett langt, sammenhengende raffineri (96 × 36 ruter = 3072 × 1152 px) som går fra sørvest til nordøst. Følgekameraet går med Warden. Fem kampseksjoner, hver med en port som åpnes når forrige er ryddet. Banen ender med et hold ved drivstofftanken, der Kiln Alpha kommer. Historien er den samme: Deepwell Refinery, «Keep them off the fuel», Kiln Alpha og `refinery-clear` etterpå.

Rute: **S1 Gate Yard → S2 Pipe Rack → S3 Crossroads (oljekanal) → S4 Pump Station → S5 Fuel Tank (hold)**.
- Formen er uregelmessig: seksjonene forskyves i høyde, og det er nisjer/innhakk i hjørnene (`NOTCH`) og en oljekanal (`water`) tvers over S3.
- Høye ting står bare langs kanten: containere, rørgater (`pipes`), tank og pumpehus.
- Inne i banen er det bare lav dekning: 49 stykker, 25 vertikale, 24 horisontale, 9 L-former. Vertikale barrierer er 0,75 × 1 (samme stil som Kessa Yard 27.10 16:00), andre vertikale ≤ 2.

## Revisjon 27.10 16:15
- Barrier-regel fra Kessa Yard: vertikal barrier maks 0,75 × 1 (hard sjekk). Første dekning er nå 8.25,27.5 (0,75 × 1). Siktfiks/Hunker-tillegg som står vertikalt lages som sandsekk. Alle sjekker består.

## Seksjoner og bølger (rev. 27.10 15:40 – Hunker inn)
Lav dekning per seksjon (fra dataene): S1 7, S2 8, **S3 12, S4 10, S5 12**. Hunker brukes bare i S3, S4 og S5. Hunker-spawner er s3east, s3south, s4east, s4south og s5south, og hver har 2–3 lave cover innen 5 ruter (hard sjekk).

| Bølge | Seksjon | Innganger | Fiender (Husk=grunt, Lurcher=flanker, Kiln=heavy, Spitter=grenadier) | maxAlive | Trussel | Varighet |
|---|---|---|---|---|---|---|
| 2-1 Pipe Row | S1 | s1north, s1south | Husk 4, Lurcher 1 | 5 | 5,5 | ~40 s |
| 2-2 Kiln | S2 | s2north, s2east, s2south | Kiln 1, Husk 4 | 4 | 7,0 | ~50 s |
| 2-3 Hunker | S3 | s3north, s3east | Husk 4, **Hunker 2** (introduksjon, ingen andre nye) | 6 | 7,6 | ~50 s |
| 2-4 Shell and Spine | S3 | s3north, s3south, s3east | Kiln 1, Husk 5, Hunker 3 | 7 | 13,4 | ~60 s |
| 2-5 The Flare | S4 | s4north, s4east, s4south | Kiln 2, Husk 5, Hunker 3, Spitter 1 | 8 | 18,4 | ~70 s |
| 2-6 Kiln Alpha (HOLD) | S5 | s5north, s5south, s5east, s5ne | Kiln Alpha (15 s), Kiln (50 s), Husk 10, Lurcher 4, Hunker 2, Spitter 1 | 9 | 27,6 | 75 s |

- Trussel = sum av THREAT × antall (data.js). Kiln Alpha er telt som 3; hp ×2,2 kommer i tillegg. Kurven stiger strengt (hard sjekk).
- Lurcher-plassholderne i 2-4 og 2-5 er byttet til `hunker`.
- Bølgen som rydder en seksjon (2-1, 2-2, 2-4, 2-5) gir `sectionClear`. 2-3 og 2-4 deler S3.
- Ferdig bølgeblokk i data.js-format ligger nederst i `refinery-v2.js.txt` (og i dataseksjonen under). Nytt felt `section` ignoreres av dagens direktør.

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
- **Hopp:** min. 3,08 ruter (snitt 4,0); Hunker-spawner ≥ 2 lave cover innen 5 ruter; trussel stiger strengt; alle bølgespawner hører til bølgens seksjon. Alt er nåbart med portene åpne.

## Teknisk oppgaveliste (klar til bygging)
Grunnlag (lest i koden 27.10):
- `loadArena` setter bounds fra cols·32 × rows·32 (arena/index.js 95/145), og `camera.padBottom` settes bare for yard v2 (143).
- `drawShadows` lager ett lerret på hele verdenen × RES (render.js 452).
- nav.js er grid-A* på 32 px som bygges på nytt når `world.cover` endres. En port som ligger i `world.cover` blokkerer altså pathing automatisk, men ombyggingen koster O(cols·rows·cover).
- levels/index.js har hold med tid i sirkelsone (`d.hold`, 228–232), `restartWave` og `resolveZone`. Spawnpunkter leses fra `world.arena.spawnPoints` (247).
- tests/run.mjs + tests/scenarios/*.json finnes (smoke.json).

### Arena (arena/*)
| ID | Oppgave | Avh. | Ferdig når | Str. |
|---|---|---|---|---|
| A1 | `arena/refinery-v2.js` fra `refinery-v2.js.txt` (objects, sections, gates, zones.tank, spawnPoints i ruter), registrert som `refinery-crossroads` variant v2 (bak `?refinery=v2` til godkjent) | – | brettet lastes, bounds 3072 × 1152, Warden går hele ruten med portene åpne (debug) | M |
| A2 | Ytelse på stort brett: skyggelerret i fliser eller lavere RES, lys/decals bare for aktiv + neste seksjon (`world.arena.activeSection`) | A1 | ≥ 55 fps i headless måling; minne for lag < ~150 MB (**usikkert** mål) | M |
| A3 | Kamera: `padBottom`/kantstopp for v2-brett generelt (ikke bare yard) og zoom 2,25 i smale partier | A1 | Warden ses alltid med HUD-plass; ingen svart kant i S1/S5 | S |
| A4 | Nye kinds `pipes` og `tank` (høye, kollisjon + skygge, bare langs kant) og `water` tegnet som olje i refinery (`style: 'oil'`) | A1 | tegnes, blokkerer gange; olje blokkerer ikke kuler | M |
| A5 | Kind `gate`: høy, i `world.cover`. `openGate(world, id)` senker den (0,8 s animasjon), fjerner den fra cover og sender `gateOpen {id, section}` | A1, S2 | port åpner seg på `sectionClear`; nav kan gå gjennom etterpå; lukket port blokkerer kuler og gange | M |
| A6 | `world.arena.sectionSpawns(sectionId)` → spawn-nøkler; spawnPoints i ruter → px | A1 | levels får bare aktiv seksjons spawner | S |

### Fiende-AI (enemies/*)
| ID | Oppgave | Avh. | Ferdig når | Str. |
|---|---|---|---|---|
| F1 | Pathing respekterer lukkede porter (bør komme gratis via cover i nav.js). Fiender i aktiv seksjon skal aldri stå fast mot en port | A5 | testscenario: 0 fiender med mål bak lukket port; ingen softlock > 8 s | S |
| F2 | Nav-ytelse på 96 × 36: ombygging bare ved cover-endring (port), evt. begrenset A* til aktiv seksjon + port (**usikkert** behov) | A1 | A* < 2 ms p95 med 9 fiender | M |
| F3 | Hunker-coversøk i stort brett: `bestSpot` med radius ~10 ruter og bare innen aktiv seksjon (`world.arena.activeSection`) | A6 | Hunker finner cover innen 1,5 s fra spawn i S3/S4/S5 | S |
| F4 | Kiln Alpha (variant alpha, hpMul 2,2) prioriterer tanken i hold (mål = `zones.tank` når `holdStart` er aktiv) | S5 | Alpha går mot tanken og trekker Fuel Integrity hvis ikke stoppet | S |

### Story og brett (levels/*, story/*) – meg
| ID | Oppgave | Avh. | Ferdig når | Str. |
|---|---|---|---|---|
| S1 | data.js LEVELS[1]: ny bølgeblokk (2-1…2-6 med `section`), spawnPoints/zones normalisert mot 96 × 36, objective-tekst uendret | A1 | `validateLevels()` = [] | S |
| S2 | levels/index.js: seksjonstilstand `d.section`, `sectionStart {section}` ved første bølge, `sectionClear {section}` når seksjonens siste bølge er ferdig → kaller `arena.openGate` | S1, A5 | events i riktig rekkefølge i test | M |
| S3 | Checkpoint per seksjon: `restartWave` gjenoppstår Warden ved seksjonsstart (`sections[].start`), åpnede porter forblir åpne, oppgraderinger beholdes | S2 | død i S4 → start ved S4-start, port 1–3 åpne | M |
| S4 | Spawner per seksjon: spawn-gruppe bruker bare `arena.sectionSpawns(d.section)`; fallback til dagens oppførsel | A6, S2 | ingen fiende spawner utenfor aktiv seksjon | S |
| S5 | Hold: `holdStart {zone, seconds}`, `holdTick {t, fuel}` (4 Hz), `holdEnd {ok}`; Fuel Integrity 100 → drain 2 %/s per fiende innen 2 ruter fra tanken, 5 %/s per Kiln; 0 → `fuelLost` → `restartWave` (cause 'fuel') | S2 | testscenario: fiender ved tanken → fuelLost → restart, oppgraderinger beholdt | M |
| S6 | Kiln Alpha-timing i 2-6: delay 15 s (s5ne), ekstra Kiln 50 s; banner «KILN ALPHA» ved spawn | S5 | Alpha kommer ved 15 ± 1 s | S |
| S7 | Ferdig-flyt: hold fullført → levelEnd → `refinery-clear` (uendret tekst) | S5 | cutscene spilles etter 2-6 | S |

### HUD/UI
| ID | Oppgave | Avh. | Ferdig når | Str. |
|---|---|---|---|---|
| H1 | Hold-HUD: «HOLD THE TANK  0:52» og bar «FUEL INTEGRITY» (rød under 30 %), leser `holdTick`/`d.hold.fuel` | S5 | vises bare i 2-6; tekst på engelsk | S |
| H2 | Seksjonsbanner: «SECTION CLEAR — GATE OPEN» på `sectionClear`, pil mot porten | S2, A5 | banner vises 2 s | S |

### Test
| ID | Oppgave | Avh. | Ferdig når | Str. |
|---|---|---|---|---|
| T1 | `tests/scenarios/refinery-route.json`: gå S1→S5 med debug-clear, alle porter åpnes, events sectionStart/sectionClear/gateOpen i rekkefølge | A1, A5, S2 | grønn i run.mjs | S |
| T2 | `refinery-hold.json`: hold 75 s ok → holdEnd ok; og variant med fiender ved tanken → fuelLost → restart | S5 | begge grønne | S |
| T3 | `refinery-checkpoint.json`: død i S3 → restart ved S3-start, oppgraderinger like | S3 | grønn | S |
| T4 | Ytelse: fps og A*-tid i S5 med 9 fiender | A2, F2 | rapport, fps ≥ 55 | S |
| T5 | Hunker: dukker bak cover i S3, skjold ×0,5 forfra (gjenbruk hunker-munning.mjs) | F3 | grønn | S |

### Byggerekkefølge og kritisk sti
1. A1 → S1 (data inn, validator grønn).
2. A5 + A6 → S2 → S4 (porter og seksjoner).
3. S3, S5 → F4, S6, S7, H1.
4. A2, A3, A4, F1–F3, H2 parallelt.
5. T1–T5.

**Kritisk sti:** A1 → A5 → S2 → S5 → H1 → T2 (ca. 1 M + 2 M + S). A2 (ytelse) er største risiko og bør måles rett etter A1.

**Usikkert:**
- om `world.cover` tåler at en port fjernes midt i spillet (nav bygges på nytt, men spots i cover.js?);
- minne for skyggelerret 3072 × 1152 × RES;
- om onscreen-telegrafen (28 px) gir Hunker for lite skuddtid på stort brett.

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
    ['barrier', 8.25, 27.5, 0.75, 1],
    ['barrier', 5.0, 23.425, 2, 0.75],
    ['sandbag', 10.425, 22.5, 0.75, 2],
    ['sandbag', 14.0, 23.575, 2, 0.75],
    ['barrier', 15.25, 24.325, 0.75, 1],
    ['crates', 11.3, 27.3, 2, 0.8],
    ['barrier', 14.025, 30.8, 0.75, 1],
    ['barrier', 24.15, 19.725, 2, 0.75],
    ['sandbag', 24.15, 20.475, 0.75, 1.5],
    ['barrier', 28.2, 19.425, 2, 0.75],
    ['sandbag', 33.025, 18.5, 0.75, 2],
    ['sandbag', 37.2, 19.425, 2, 0.75],
    ['barrier', 38.45, 20.175, 0.75, 1],
    ['crates', 26.4, 23.3, 2, 0.8],
    ['barrier', 31.075, 22.75, 0.75, 1],
    ['barrier', 54.4, 11.275, 2, 0.75],
    ['sandbag', 54.4, 12.025, 0.75, 1.5],
    ['barrier', 50.5, 18.925, 2, 0.75],
    ['sandbag', 45.125, 21.75, 0.75, 2],
    ['sandbag', 48.55, 22.075, 2, 0.75],
    ['barrier', 49.8, 22.825, 0.75, 1],
    ['crates', 52.75, 22.35, 2, 0.8],
    ['barrier', 47.225, 25.7, 0.75, 1],
    ['barrier', 62.35, 4.525, 2, 0.75],
    ['sandbag', 62.35, 5.275, 0.75, 1.5],
    ['barrier', 64.45, 8.725, 2, 0.75],
    ['sandbag', 63.125, 11.25, 0.75, 2],
    ['sandbag', 66.7, 12.325, 2, 0.75],
    ['barrier', 67.95, 13.075, 0.75, 1],
    ['crates', 70.75, 11.85, 2, 0.8],
    ['barrier', 83.325, 4.55, 0.75, 1],
    ['barrier', 86.75, 4.975, 2, 0.75],
    ['sandbag', 86.75, 5.725, 0.75, 1.5],
    ['barrier', 82.25, 12.025, 2, 0.75],
    ['sandbag', 80.925, 15.15, 0.75, 2],
    ['sandbag', 84.35, 15.475, 2, 0.75],
    ['barrier', 85.6, 16.225, 0.75, 1],
    ['crates', 78.35, 18.9, 2, 0.8],
    ['barrier', 83.025, 19.25, 0.75, 1],
    ['barrier', 45.365, 17.954, 2, 0.75],
    ['barrier', 65.246, 5.713, 2, 0.75],
    ['barrier', 80.344, 9.259, 2, 0.75],
    ['sandbag', 84.052, 8.557, 0.75, 2],
    ['sandbag', 56.904, 21.046, 0.75, 2],
    ['sandbag', 44.827, 27.872, 0.75, 2],
    ['barrier', 48.798, 28.497, 2, 0.75],
    ['sandbag', 72.974, 17.561, 0.75, 2],
    ['barrier', 69.229, 16.925, 2, 0.75],
    ['sandbag', 86.125, 20.702, 0.75, 2],
  ],
  ammoCrates: [[10.7, 27.7], [23.55, 20.1], [46.62, 26.2], [64.65, 6.09], [84.85, 12.4]],
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

// levels/data.js nivå 2 – bølger (LEVELS[1].waves). `section` er nytt felt (ignoreres av dagens direktør).
    waves: [
      { id: '2-1', name: 'Pipe Row', section: 'S1', objective: { type: 'clear' }, maxAlive: 5, breakAfter: 6, upgradeAfter: false,   // trussel 5.5
        groups: [g('grunt', 4, 's1north', 1, 1.0), g('flanker', 1, 's1south', 6, 2.0)] },
      { id: '2-2', name: N.heavy, section: 'S2', objective: { type: 'clear' }, maxAlive: 4, breakAfter: 7, upgradeAfter: true,   // trussel 7.0
        groups: [g('heavy', 1, 's2north', 2, 1.2), g('grunt', 2, 's2east', 3, 1.5), g('grunt', 2, 's2south', 8, 1.2)] },
      { id: '2-3', name: N.hunker, section: 'S3', objective: { type: 'clear' }, maxAlive: 6, breakAfter: 6, upgradeAfter: false,   // trussel 7.6
        groups: [g('grunt', 4, 's3north', 1, 1.0), g('hunker', 2, 's3east', 4, 3.0)] },
      { id: '2-4', name: 'Shell and Spine', section: 'S3', objective: { type: 'clear' }, maxAlive: 7, breakAfter: 7, upgradeAfter: true,   // trussel 13.4
        groups: [g('heavy', 1, 's3north', 1, 1.2), g('grunt', 3, 's3north', 2, 1.2), g('hunker', 2, 's3south', 4, 2.5), g('grunt', 2, 's3east', 8, 1.2), g('hunker', 1, 's3east', 12, 1.2)] },
      { id: '2-5', name: 'The Flare', section: 'S4', objective: { type: 'clear' }, maxAlive: 8, breakAfter: 7, upgradeAfter: false,   // trussel 18.4
        groups: [g('heavy', 1, 's4north', 1, 1.2), g('grunt', 3, 's4north', 2, 1.0), g('hunker', 2, 's4east', 5, 2.5), g('grenadier', 1, 's4south', 8, 1.2), g('hunker', 1, 's4south', 11, 1.2), g('heavy', 1, 's4east', 14, 1.2), g('grunt', 2, 's4north', 16, 1.0)] },
      { id: '2-6', name: N.kilnAlpha, section: 'S5', objective: { type: 'hold', zone: 'tank', seconds: 75 }, maxAlive: 9, breakAfter: 0, upgradeAfter: true,   // trussel 27.6
        groups: [g('grunt', 3, 's5north', 1, 1.0), g('grunt', 3, 's5south', 3, 1.0), g('heavy', 1, 's5ne', 15, 1.2, 'alpha'), g('flanker', 2, 's5east', 20, 1.5), g('hunker', 2, 's5south', 26, 2.5), g('grenadier', 1, 's5north', 34, 1.2), g('flanker', 2, 's5east', 42, 1.5), g('heavy', 1, 's5ne', 50, 1.2), g('grunt', 4, 's5north', 58, 1.0)] },
    ],
```
