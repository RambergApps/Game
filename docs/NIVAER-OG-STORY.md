# BREACH – Nivåer og story

Eier: Breach Nivåer og story · Sist oppdatert: 23.10.2026 (Cinder)
Kode: `game/src/levels/` (data, oppgraderinger, direktør, kort, HUD) og `game/src/story/` (manus, bilder, maling, spiller) · Testside: `game/src/story/test.html`

Tone: mørk og alvorlig, lite tekst. Ingen vitser, ingen lange forklaringer. Spilleren skal *føle* situasjonen, ikke lese om den.

> **ERSTATTET 23.10:** Vinkling B «The Protocol» (kringkastede kamprøver, troppen som pant, «released = rewritten», Hale med rødt visir) er **utgått** og fjernet fra manus og spilltekst. Ny låst historie er **Konsept A – CINDER** (docs/PROSJEKT.md › Historie, detaljer i docs/STORY-KONSEPTER.md). Gammelt manus ligger bare i git-historikken.

## 0. Beslutninger (Alexander, 23.10.2026)

| # | Beslutning | Status |
|---|---|---|
| 1 | **Historie: Konsept A «CINDER»** (låst). Protocol/Hale-vrien er erstattet. | Gjort (`story/cutscenes.js`, `levels/data.js`, `levels/hud.js`) |
| 2 | **All tekst i spillet er på engelsk**. Dokumentasjon og kodekommentarer på norsk. | Gjort (se kap. 7) |
| 3 | **Ved død starter bølgen på nytt, og oppgraderingene beholdes.** | Gjort |
| 4 | **8 oppgraderingsvalg, «3 kort, velg 1»**. | Gjort |
| 5 | **Mellomsekvenser som tegneserie: 3–5 paneler per sekvens**, Space/Enter/klikk = neste, Esc = hopp over. | Gjort (`story/player.js`) |
| 6 | **Malte, realistiske bilder** (ikke tegneserie-figurer) erstatter de kodetegnede scenene. Maleren leverer per panel-id; kodescenene er plassholdere. | Format klart (kap. 5), bilder kommer fra annen rolle |
| 7 | Levels bruker `world.arena.zones` når den finnes; egne verdier bare som fallback (Breach). | Gjort (`resolveZone` i `levels/index.js`) |
| 8 | Alle fire fiendetyper er klare hos Fiende-AI: `READY_TYPES` har alle fire, `TYPE_FALLBACK` er fjernet. | Gjort |
| 10 | **Ashmaw i manus og data:** ny sekvens `ashmaw-rise` (4 paneler) etter 3-6, boss-bølge `3-7` (`type: 'boss'`) med adds per fase, ny `ending` der Warden slår Ashmaw. Uten `enemies.spawnBoss` hoppes bølgen over (console.info). | Gjort (venter på Fiende-AI, se kap. 3 «Boss-API») |
| 11 | **Rulletekst** etter `ending` (`story/credits.js`, `showCredits`), hendelser `creditsStart`/`creditsEnd`. | Gjort |
| 12 | **Død (Test P2-2):** `fallen` bare ved første død per økt (går videre selv etter 3 s); senere bare banneret «WARDEN DOWN – RESTARTING WAVE». Like tasthint overalt: `ENTER / CLICK  NEXT     ESC  SKIP`. Space konsumeres og svelges 300 ms etter sekvensen. | Gjort (målt: 1,0–1,8 s fra død til kontroll) |
| 13 | **CONTINUE:** `startLevel(world, n, { startAt })` / `startAt(world, n, i, opts)`, `getUpgradeState`/`setUpgradeState`, hendelsen `restart`. | Gjort |
| 9 | Innhopp med varsel: levels bruker `enemies.spawnWithWarning` (0,6–1,2 s, `spawnWarn` → `spawnRise`). Varslede innhopp teller i `maxAlive`, og bølgen avsluttes ikke før `pendingSpawns` er 0. Monsternavn kommer fra `DISPLAY_NAMES` i `enemies/stats.js`. | Gjort |

---

## 1. Historie – CINDER

- **Premiss:** Deepwell, verdens dypeste geotermiske brønn, boret inn i et rike av varmeetende kitin-skapninger, **the Cinderborn**. Varmesjokket vekket dem. De bryter opp gjennom sprekker og synkehull (BREACH) og søker mot alt som er varmt: havn, drivstoff, smelteverk. De er ikke onde, de er sultne – og de stopper ikke.
- **Warden (W-09)**, sersjant i **Garrison 9**, Kessa-havnas forsvarsenhet. Ordknapp, ansvarlig, ingen helt.
- **Troppen** (på samband, `speaker: 'command'` med `who`): **Hale** – nestkommanderende og radio, den Warden står nærmest. **Okafor** – ingeniør, sprengstoff; forstår hva brønnen er. **Brandt** – ung skarpskytter, første tokt; ser kontaktene først. **COMMAND** – Garrison-kommandoen.
- **Fiender:** Husk (Grunt, rød), Lurcher (Flanker, mørkerød), Kiln (Heavy, oransje kjerne), Spitter (Grenadier, lilla giftsekker). Kode-id-ene er uendret; visningsnavnene eies av Fiende-AI (`DISPLAY_NAMES` i `enemies/stats.js`, re-eksportert fra `levels/data.js`).
- **Bue:**
  1. **Kessa Yard** – evakueringen. Hold gården til siste skip går. Skipet går; troppen blir igjen. Svermen snur innover – «They’re chasing heat.»
  2. **Deepwell Refinery** – svermen mot drivstoffet. Mini-boss **Kiln Alpha** (2-6). Okafor ser borehullet: «We didn’t find them. We drilled into their house.» Ordre: forsegl brønnen.
  3. **The Deepwell** – ned i sjakten. Tennsatsen er manuell, noen må bli. Hale melder seg; Warden nekter og holder kjernen selv i 75 s. (Planlagt: sluttboss **Ashmaw** stiger opp.)
  - **Slutt:** Brønnen kollapser, varmen dør, Cinderborn sovner i kulda. Hale henter Warden med heisen. Kald daggry i Kessa Yard: «All of us. Going home.»

### Mini-boss og boss

| | Kiln Alpha (slutten av nivå 2) | Ashmaw (sluttboss, nivå 3) |
|---|---|---|
| Status | **I spillet** som enkel variant: bølge 2-6 (nå «Kiln Alpha»), første Heavy har `variant: 'alpha'` → `hp × 2,2`, `e.variant = 'alpha'`, `e.displayName = DISPLAY_NAMES.kilnAlpha` (satt av levels i `onSpawn`). | **I data og manus**, venter på Fiende-AI: bølge `3-7` (`type: 'boss', boss: 'ashmaw'`), sekvensen `ashmaw-rise` før og `ending` etter. Uten `enemies.spawnBoss` hoppes bølgen over. |
| Rolle | Den eldste Kiln, vokter raffineriet. | Kolonimoren i bunnen av brønnen; kommer opp når ladningen settes. |
| Silhuett | Kiln ×1,33 med sagtakket ryggkam; to gul-hvite kjerner `#fff0b0` (foran/bak). Se `docs/FIENDE-DESIGN.md`. | Lav svart kuppel ~120 px med **8 ventiler i ring** (`#ff7a1a`/`#ffb347`), ovnskjeft foran (`#ff5a1a`), **korte krabbebein** ut til alle kanter. Se `docs/FIENDE-DESIGN.md`. |
| Faser | 1: smeltespray. 2 (< 50 %): raserer dekning, går rett på. | 1 Graving (erupterer under dekning med 1,2 s varsel, knuser lav dekning; ventiler på ryggen = svakt punkt → flank). 2 Ovnen (smeltekjegle, spyr Husks). 3 Kollaps (åpne ventiler, kaller Lurchers fra sprekker). |
| Seier | Drep den (kjernen bak). | Knus alle ventilene → hun faller i brønnen, ladningen går. |
| Trenger | Fiende-AI: egen tegning/skala og fase 2 (forslag). | Fiende-AI (type `boss`, svake punkter, faser via `registerState`), Arena (`coverBreak`, bosshull), Levels (bølgetype `boss` i `data.js`, bossbar, `bossPhase`-hendelse), Lyd, Story (`boss-intro`). Se STORY-KONSEPTER.md. |

---

## 2. Nivåplan

Nivå-id-er og arena-id-er er uendret (Arena eier arenaene); bare visningsnavn, mål og bølgenavn er nye. *Forslag til Arena:* `name`/`board` i `arena/foundry.js` m.fl. sier fortsatt «Underground Foundry»/«BOARD 03».

| # | Navn (id) | Mål (spilltekst) | Spillerstart | Fiendeinnganger (sprekker/synkehull) | Ny fiende |
|---|---|---|---|---|---|
| 1 | **Kessa Yard** (`container-yard`, arena `yard`) | «Hold the yard until the last ship clears.» (5 bølger) | Entry, sør | N, NV, NØ, Ø (sideruta), V | Husk (1-1), Lurcher (1-3) |
| 2 | **Deepwell Refinery** (`refinery-crossroads`) | «Hold the crossroads. Keep them off the fuel.» (6 bølger, mini-boss) | Spawn A, sør | N, NV, NØ, V, Ø | Kiln (2-2), Kiln Alpha (2-6) |
| 3 | **The Deepwell** (`underground-foundry`) | «Reach the bottom of the shaft. Seal the well.» (5 bølger + hold 75 s) | Vest | NØ, Ø (broen), N (gantry), S | Spitter (3-1) |

**Kjernesonen (3-6):** `world.arena.zones.core` (Arena: 22,5 / 19, r 2,4 ruter) brukes når den finnes. Nivådataens egen sone er bare fallback og er nå speilet til samme punkt (0,5625 / 0,6333, r 0,08). Den gamle (0,45 / 0,55 ≈ 18 / 16,5, r 3,6 ruter) lå oppå en stabel.

### Bølger

⬆ = oppgraderingsvalg etter bølgen. Tid i sekunder fra `waveStart`. Navn i spillet på engelsk. Tall uendret.

#### 1. Kessa Yard

| Bølge | Navn | Grupper | Fiender | Maks | Trussel |
|---|---|---|---|---|---|
| 1-1 | First Contact | 3× Husk @ N (1,5 / 1,8); 1× Husk @ NV (9) | 4 | 3 | 4 |
| 1-2 ⬆ | Glow in the Cracks | 3× Husk @ N (1 / 1,6); 2× Husk @ NØ (9 / 1,6) | 5 | 4 | 5 |
| 1-3 | Lurchers | 3× Husk @ N (1 / 1,2); 2× Lurcher @ Ø (6 / 2,5); 1× Husk @ NV (10); 1× Lurcher @ V (14) | 7 | 5 | 8,5 |
| 1-4 ⬆ | Pincer | 4× Husk @ NV (1 / 1); 2× Lurcher @ V (5 / 2); 1× Spitter @ N (9); 2× Husk @ N (13 / 1,2) | 9 | **5** (var 6) | 11 |
| 1-5 ⬆ | Last Ship (topp) | 4× Husk @ N (1 / 0,9); 2× Husk @ NØ (3); 2× Lurcher @ Ø (6 / 1,6); 1× Spitter @ NV (9); 1× Kiln @ N (11); 1× Lurcher @ V (13); 3× Husk @ N (17 / 0,8); 2× Husk @ NV (18); 1× Lurcher @ Ø (20) | **17** (var 12) | 7 | 22 |

Balanse 26.10 (målt headless, udødelig spiller, auto-drap i rekkefølge): se `reviews/brett1-demo-2026-10-26.md`. Alle bølger < 90 s, lengste dødtid ≈ 2,6 s (starten av bølgen: banner + sprekkvarsel).

#### 2. Deepwell Refinery

| Bølge | Navn | Grupper | Fiender | Maks | Trussel |
|---|---|---|---|---|---|
| 2-1 | Pipe Row | 4× Husk @ N; 2× Lurcher @ V (6 / 2) | 6 | 6 | 7 |
| 2-2 ⬆ | Kiln | 1× Kiln @ N (2); 2× Husk @ N (3 / 1,5) | 3 | 4 | 5 |
| 2-3 | Three Ways | 4× Husk @ N; 2× Lurcher @ Ø (5); 2× Lurcher @ V (9) | 8 | 7 | 10 |
| 2-4 ⬆ | Shell and Spine | 1× Kiln @ N; 2× Husk @ NV; 2× Husk @ NØ; 2× Lurcher @ Ø (10) | 7 | 7 | 10 |
| 2-5 | The Flare | 1× Kiln @ N; 4× Husk @ N; 2× Lurcher @ V; 1× Kiln @ NØ (12); 1× Lurcher @ Ø (14) | 9 | 8 | 14,5 |
| 2-6 ⬆ | **Kiln Alpha** (mini-boss) | **1× Kiln Alpha @ N (1)**; 3× Husk @ NV; 3× Husk @ NØ; 2× Lurcher @ V (7); 2× Lurcher @ Ø (9); 1× Kiln @ N (16) | 12 | 9 | 18 (+ alfa) |

#### 3. The Deepwell

| Bølge | Navn | Grupper | Fiender | Maks | Trussel |
|---|---|---|---|---|---|
| 3-1 | Spitters | 3× Husk @ NØ; 1× Spitter @ NØ (5) | 4 | 5 | 5 |
| 3-2 ⬆ | The Bridge | 4× Husk @ NØ; 1× Spitter @ Ø (6); 2× Lurcher @ S (10) | 7 | 7 | 9 |
| 3-3 | Furnaces | 1× Kiln @ NØ; 3× Husk @ NØ; 2× Spitter @ Ø (8 / 3) | 6 | 7 | 10 |
| 3-4 ⬆ | No Way Up | 4× Husk @ N; 2× Spitter @ NØ; 2× Lurcher @ S; 2× Lurcher @ N (11) | 10 | 8 | 14 |
| 3-5 | Melting Point | 1× Kiln @ NØ; 4× Husk @ Ø; 2× Spitter @ N; 2× Lurcher @ S; 1× Kiln @ Ø (15) | 10 | 9 | 17 |
| 3-6 | Hold the Fuse **(hold kjernen 75 s)** | 4× Husk; 2× Lurcher; 1× Spitter; 1× Kiln (20); 4× Husk (28); 2× Lurcher (36); 2× Spitter (44); 1× Kiln (52); 4× Husk (58) | 21 | 9 | 30 |
| 3-7 | **Ashmaw (boss)** – `type: 'boss'`, sone `core`, mål `{ type: 'kill', target: 'boss' }` | Fase 1 *Burrow* (100 %): 2× Husk @ N (5 s), 2× Husk @ Ø (16 s) · Fase 2 *Furnace* (≤ 70 %): 2× Husk @ NØ (3 s), 1× Spitter @ N (10 s) – Ashmaw kaster selv 2–3 Husks · Fase 3 *Collapse* (≤ 35 %): 3× 2 Lurcher @ S/Ø/N (1/7/14 s) | 1 + 11 | 6 | – |

### Vanskelighetskurve

Uendret: Trussel = Husk 1 · Lurcher 1,5 · Spitter 2 · Kiln 3. Én ny type om gangen i en «pustebølge» (2-2, 3-1), sagtann mellom nivåene, retning før mengde, `maxAlive` 4 → 9 som hovedbryter, 6–8 s pause.

---
## 3. Dataformat (nivåer, bølger, oppgraderingsvalg)

Alt ligger i `src/levels/data.js` som rene JS-objekter. Ingen import fra core, så filen kan lastes i testsider og verktøy.

```js
// Nivå
{
  n: 1,                          // 1-basert rekkefølge
  id: 'container-yard',          // nivå-id (uendret; visningsnavn 'Kessa Yard')
  arena: 'yard',                 // sendes til arena.loadArena(world, id)
  name: 'Container Yard',        // vises i HUD (engelsk)
  objective: 'Hold the yard. …', // kort måltekst til HUD (engelsk)
  cutsceneBefore: 'intro',       // valgfri: showCutscene(id) før første bølge
  cutsceneAfter: 'yard-clear',   // valgfri: etter siste bølge
  playerSpawn: 'entry',          // nøkkel i spawnPoints
  spawnPoints: {                 // normalisert mot world.bounds (0..1)
    north: { x: 0.62, y: 0.04, dir: 'N' }, …
  },
  zones: { core: { x: 0.45, y: 0.55, r: 0.09 } },   // valgfri: for hold-mål
  waves: [ /* bølger */ ],
}

// Bølge
{
  id: '1-3', name: 'Side Street',
  objective: { type: 'clear' },             // eller { type: 'hold', zone: 'core', seconds: 75 }
  maxAlive: 5,                              // tak for levende fiender
  breakAfter: 6,                            // sekunder pause etterpå
  upgradeAfter: false,                      // vis oppgraderingsvalg etterpå
  cutsceneBefore: 'foundry-core',           // valgfri
  groups: [
    { type: 'grunt',   count: 3, spawn: 'north', delay: 1, interval: 1.2 },
    { type: 'flanker', count: 2, spawn: 'east',  delay: 6, interval: 2.5 },
  ],
}
```

- `type` er nøyaktig det `enemies.createEnemy(world, type, x, y)` tar imot: `grunt | flanker | heavy | grenadier`.
- `spawn` slås opp med `resolveSpawn(level, id, world.bounds, arenaPoints?)`. Hvis `arenaPoints` er et objekt med navngitte punkter (`{ north: {x,y} }`), vinner de. Hvis det er arenaens navnløse liste (`world.arena.enemySpawns`, slik `arena/yard.js` har i dag), velges punktet nærmest den normaliserte retningen. Uten arenadata brukes det normaliserte punktet mot `world.bounds`.
- `arena` må matche en id i `arena/index.js` (`ARENAS`). I dag finnes bare `yard`. `refinery-crossroads` og `underground-foundry` er forslag til id-er for de to neste arenaene.
- Hjelpefunksjoner: `getLevel(n)`, `getWave(n, i)`, `enemyCount(w)`, `waveThreat(w)`, `spawnSchedule(w)` → `[{t, type, spawn}]` sortert på tid, `introductions()`, `validateLevels()` (tom liste = ok).
- **Hold-regel (3-6):** Tidtakeren teller bare mens Warden står i sonen, og nullstilles ikke når han går ut. Når tiden er ute, stoppes resterende innhopp og bølgen er vunnet, selv om fiender lever.

**Oppgraderingsvalg** (`src/levels/upgrades.js`):
```js
{ id: 'cover-plates', name: 'Cover Plating', role: 'forsvar', rarity: 'vanlig', max: 2, minLevel: 1,
  kind: 'stack', text: '−20% damage taken in cover.', mods: [['coverDamageMult', 'mul', 0.8]] }
```
API: `createUpgradeState()`, `rollOffer(state, { level, hpRatio }, world.rng)` → 3 id-er, `pick(state, id)` → `{ stats, instant }`, `computeStats(state)`.

**Direktøren i `levels/index.js` (koblet inn):**
- `startLevel(world, n, opts)`: laster arenaen (`world.modules.arena.loadArena`) hvis id-en finnes, ellers beholdes gjeldende arena (i dag alltid `yard`). Spilleren plasseres på `world.arena.playerSpawn`. Emit `levelStart`, spill `cutsceneBefore`, vis banner «CHAPTER 0n».
- Per bølge: emit `waveStart { level, wave, id, name }`, spawn etter `spawnSchedule()` med `world.modules.enemies.createEnemy(world, type, x, y)` ved nærmeste punkt i `world.arena.enemySpawns` (+ litt spredning), respekter `maxAlive`. Emit `waveEnd { level, wave, id }` når køen er tom og alle er døde, eller når hold-tiden er ute.
- Etter ⬆-bølger: oppgraderingskort (`levels/cards.js`), spillet pauses; deretter pause med nedtelling (`breakAfter`). Emit `upgrade { id, stats }`.
- Ved død (`death` med `target === world.player`): 1,0 s fall → **bare første gang i økta** mellomsekvensen `fallen` (går videre selv etter 2 s uten inndata, `autoEndAfter: 2`; bildet `fallen-01` forhåndslastes ved oppstart og ved `startLevel`) → feltet ryddes, spilleren plasseres og helbredes, emit `restart { level, waveId, cause: 'death' }`. Senere dødsfall: banneret «SIGNAL LOST / WARDEN DOWN – RESTARTING WAVE» (2 s) i stedet for sekvensen. Spilleren har kontroll fra respawn; bølgen starter etter 2,5 s REGROUP. Oppgraderingene beholdes. Flagget `session.fallenSeen` (eksportert, `setFallenSeen(true|false)`) kan settes av lagringen fra `profile.seenCutscenes`.
  - **Målt i headless (26.10):** 1. død uten inndata 3,17 s (ny kontekst/kald cache) og 3,21 s (varm); 1. død med Esc 1,61 s; 2. død 1,01 s. Mål < 4 s nådd i alle tilfeller.
  - Tidligere (23.10, ca. 14:05, `autoEndAfter: 3`): 1. død uten inndata 5,07 s (1,0 + 3 s sekvens + uttoning); 2. død 1,76 s; 3. død 1,01 s. Mål < 4 s er nådd for alle unntatt første (der Esc gir ~1,5 s).
- **`restartWave(world, { cause = 'menu' })`** (pausemenyens RESTART WAVE, `src/ui/pauseMenu.js` → `world.modules.levels.restartWave(world)`): samme bølge, alle fiender, varslede innhopp og prosjektiler ryddes, oppgraderinger beholdes, ingen mellomsekvens, Warden får full HP/ammo på startpunktet (`player.respawn`), emit `restart { level, waveId, cause }`, banner «REGROUP / RESTARTING WAVE» og 2,5 s pause før bølgen. Returnerer `true` ved suksess, `false` når ingen bølge er aktiv (mellomsekvens, kortvalg, nivåslutt, død, rulletekst, pausen før første bølge). Rører ikke `world.paused` – menyen lukker sin egen pause. Knapp «Restart wave» i `levels/test.html`. Testet 26.10 midt i 1-3 fra den ekte pausemenyen (se `reviews/brett1-demo-2026-10-26.md`).
- Etter siste nivå: `ending` → emit `gameComplete` → **rulletekst** (`showCredits`, fase `credits`) → sluttskjerm (fase `done`). `levelEnd` kommer før `ending`.
- Byggstempel: `BUILD` i `levels/build.js` (eksportert fra `levels/index.js`), nederst til høyre i HUD-en («BUILD 2026-10-23 14:20»). Tom streng → `document.lastModified`.

**startLevel-opsjoner (CONTINUE, lagring, testside):**

| Opsjon | Betydning |
|---|---|
| `startAt` | **Bølge-id** (`'2-3'`) **eller 0-basert indeks** (`2` = tredje bølge). Ukjent id → bølge 1 + `console.info`. |
| `skipCutscenes` | `true` = ingen mellomsekvens før første bølge. Array = id-er som er sett (`profile.seenCutscenes`) og hoppes over. Nivåets `cutsceneBefore` spilles uansett bare når `startAt` er bølge 1; bølgens egen sekvens (f.eks. `foundry-core` før 3-6) spilles hvis den ikke er sett. |
| `upgrades` | Stabler `{ id: antall }` → `setUpgradeState` (spillerverdier regnes på nytt). |
| `pendingUpgrade` | `true` = kortvalget vises før første bølge. |

Alias etter LAGRING-OG-OPPLAERING.md: `startAt(world, n, waveIndex, opts)`. Også `getUpgradeState(world)` → stabler og `setUpgradeState(world, stacks)`. Loadout (ammo/granater) eies av Våpen/Karakter og håndteres ikke her.

**Boss-API (forventet – docs/BOSS.md fra Fiende-AI er ikke levert; tilpass `startBoss`/`enterBossPhase` i `levels/index.js`):**
- Bølgen: `{ id: '3-7', type: 'boss', boss: 'ashmaw', zone: 'core', objective: { type: 'kill', target: 'boss' }, maxAlive, groups: [], phases: [{ phase, at, name, adds: [group] }] }`. `at` = hp-andel der fasen starter; `adds.delay` regnes fra fasestart.
- Levels kaller `world.modules.enemies.spawnBoss(world, id, x, y, { wave, phases: [{ phase, at, name }] })` med x/y = midten av sonen (`world.arena.zones.core`, ellers `level.zones`). Forventer en entitet i `world.enemies` med `hp`, `maxHp`, `dead`, valgfritt `phase` (1..3) og `displayName`.
- Levels lytter på `bossPhase { id, phase }` (legger inn adds for nye faser, bare framover) og `bossDefeated { id }` (bølgen vunnet). Uten hendelser: `boss.phase`, ellers hp/maxHp mot `phases[].at`; død = `dead || hp <= 0`.
- Levels sender selv `bossStart { id, wave }` og `bossEnd { id, skipped }`.
- **Mangler `spawnBoss`** (eller den kaster/returnerer null): `console.info`, `bossEnd { skipped: true }`, `waveStart` + `waveEnd { …, skipped: true }`, og spillet går videre til `ending`. `ashmaw-rise` spilles likevel.
- HUD: enkel bosslinje øverst i midten (navn, hp, fasestreker, «PHASE n · NAME»). Pynt utover det hører til Effekter.
- Ved død under bossen: samme dødsflyt; feltet (inkl. bossen) ryddes, og `spawnBoss` kalles på nytt.

## 4. Oppgraderinger mellom bølgene

**Når:** etter bølgene merket ⬆: 1-2, 1-4, 1-5, 2-2, 2-4, 2-6, 3-2, 3-4. Det gir **8 valg** gjennom spillet.
**Hvordan:** Tre kort trekkes. Spilleren velger ett med klikk eller tast 1/2/3. Det finnes ikke noe «hopp over», men Field Kit fungerer som sikkerhetsnett. Kortene vises over et nedtonet spillbilde, og spillet står på pause.

| id | Navn (i spillet) | Effekt | Maks | Rolle | Merknad |
|---|---|---|---|---|---|
| `plating` | Reinforced Plate | +20 maks HP | 2 | forsvar | |
| `cover-plates` | Cover Plating | −20 % skade i dekning | 2 | forsvar | gulv 0,6 |
| `adrenaline` | Adrenaline | +6 HP per drap | 2 | forsvar | |
| `ext-mag` | Extended Mag | +30 % magasin, relativt (`mul 1,3`). AR-9: 24 → 31 → 38 | 2 | angrep | tak 1,6 × grunnverdien (`REL_LIMITS`); grunnverdien leses fra `weapons/data.js` (`WEAPONS.rifle.mag`) |
| `fast-reload` | Quick Loader | −20 % ladetid (1,8 → 1,44 → 1,2 s) | 2 | angrep | gulv ⅔ × grunnverdien (`REL_LIMITS`); grunnverdien 1,8 s leses fra `WEAPONS.rifle.reloadTime` (= tuning `reloadMs` 1800) |
| `steady-hand` | Steady Hand | −35 % spredning fra dekning | 1 | angrep | belønner dekning |
| `grenade-belt` | Grenade Belt | +1 granat | 2 | taktikk | |
| `servo-joints` | Servo Joints | +20 % lengre rull (`rollDistMult`) | 1 | taktikk | rullen har ingen ventetid i Karakter-tuning |
| `ap-rounds` | AP Rounds | Kula går gjennom 1 mål (60 % skade på mål nr. 2) | 1 | angrep | sjelden, først fra nivå 2 |
| `field-kit` | Field Kit | Helbred 50 % nå | ∞ | forsvar | dukker bare opp når HP < 60 % |

**Regler mot ubalanse:**
1. Ingen duplikater i samme tilbud. Kort som er maksimert eller under `minLevel`, trekkes ikke.
2. Vekting: vanlig 3, sjelden 1. Et kort som ble vist men ikke valgt, får halv vekt i neste tilbud, slik at tilbudene varierer.
3. Minst ett forsvarskort per tilbud når det er mulig.
4. Alt regnes fra grunnverdier hver gang (`computeStats`), og verdiene klemmes inn i `LIMITS` (absolutte) og `REL_LIMITS` (× grunnverdien, for våpenavhengige tall som `magSize` og `reloadTime`), for eksempel maks 140 HP og minst 60 % skade i dekning. Dermed kan ingen kombinasjon gi udødelighet.
5. Ingen rå skadeøkning: oppgraderingene gjør spilleren *mer disiplinert* (dekning, lading, granater), ikke til en kulesprøyte. Det passer visjonen.
6. Determinisme: bruk `world.rng`, slik at Breach Test kan gjenskape en runde.

Grunnverdiene (`BASE_STATS`) følger Karakter-tuning der den finnes. Spilleren leser foreløpig bare `maxHp`; resten ligger i `world.playerStats` og venter på Karakter (se review).

---
---

## 5. Mellomsekvenser (manus, engelsk) – CINDER

**Format:** hver sekvens er 3–5 **paneler** (tegneserieruter); `fallen` er bevisst ett panel, vises bare ved første død og går videre selv etter 3 s. Teksten skrives tegn for tegn nede til venstre. **Enter / klikk** = fullfør linjen, deretter neste linje/panel (Space virker også, men konsumeres alltid og svelges 300 ms etter sekvensen, så det aldri blir rull i spillet). **Esc** = hopp over hele sekvensen. Bunntekst overalt: `ENTER / CLICK  NEXT     ESC  SKIP` (`HINT` i `story/player.js`). Per panel: `transition` (fade/cut/swipe), `cam` (Ken Burns), `textDelay` (bilde før tekst).

**Panelbilder (malte):** hvert panel har en stabil `id` (`intro-01` …) og `image: 'img/story/<id>.webp'` (relativt til `game/`).
- **Format: WebP, 16:9, 1920×1080** (vises med «cover» i 16:9-ruten mellom letterbox-stolpene; viktig innhold innenfor midtre ~85 % fordi kamera zoomer opptil 1,4×). Kvalitet ~85, mål < 400 kB.
- Bildet lastes **bare** når panel-id-en står i `PAINTED_PANELS` (i `story/cutscenes.js`) – maleren legger til id-en ved levering. Ellers, eller hvis filen mangler/feiler, brukes den kodetegnede scenen (`scene`) som plassholder. Ingen 404 i konsollen før bildet finnes.
- Plassholderscenene er gamle kodebilder og passer bare grovt. *Bildebeskrivelsen* i tabellen er det maleren skal lage.
- **Monstrenes utseende følger `docs/FIENDE-DESIGN.md`** og trekvart-bildene `reviews/img/cinderborn/*-trekvart.jpg`: Husk (krumbøyd, skjold venstre, spydarm høyre), Lurcher (lav insekt-øgle, fire bein, hale, gjennomskinnelig mørkerød **hinnekrage**, ingen vinger), Kiln (bred kantet blokk, glødende sømmer), Kiln Alpha (Kiln ×1,33, sagtakket ryggkam, **gul-hvite tvillingkjerner `#fff0b0`**), Spitter (**nesten svart kitin `#211c1a`**, seks tynne bein, **tre fiolette sekker** `#9b59ff`), Ashmaw (lav svart kuppel, **8 ventiler i ring**, ovnskjeft foran, **korte krabbebein**).

**Talere (`speaker`, uendret, avtalt med Lyd) + valgfri `who`:**

| speaker | Hvem | Visning |
|---|---|---|
| `announcer` | nødkringkasting (PA/radio til sivile) | etikett `// BROADCAST` |
| `command` | stemme på samband: `who` = HALE / OKAFOR / BRANDT / COMMAND | etikett `// HALE` osv. (`// RADIO` uten `who`) |
| `warden` | Wardens stemme | hvit, ingen etikett |
| `caption` | stum tekst | dempet grå, ingen etikett |

| Sekvens (når) | Panel-id · plassholder | Malt bilde (brief) | Linjer |
|---|---|---|---|
| `intro` – før 1-1 · CHAPTER 01 · Kessa Yard | `intro-01` · yardGate | Havna om natta, kø av sivile mot skipene, regn, kraner | caption: «Kessa Port. Day three of the evacuation.» · caption: «Forty kilometres inland, the Deepwell drill hit something that bled.» |
| | `intro-02` · yardAftermath | Høyttalermast over containerne, folk som løper; asfalten har sprekker | announcer: «All civilians to the piers. Stay off open ground. Repeat: stay off open ground.» |
| | `intro-03` · wardenVisor | Nærbilde Warden, cyan visir, Hale bak med radio | command/HALE: «Last ship loads in twenty. Garrison Nine holds the yard.» · warden: «Then we hold the yard.» |
| | `intro-04` · yardGate (nært) | Sprekk i asfalten gløder rødt; kitinklo bryter opp | caption: «The asphalt glows from underneath.» · warden: «Contact. They’re coming up through the cracks.» |
| `yard-clear` – etter 1-5 · CHAPTER 02 · Deepwell Refinery | `yard-clear-01` · yardAftermath | Siste skip forbi moloen, troppen på kaia, Husk-lik | caption: «The last ship clears the breakwater.» · command/BRANDT: «That’s everyone. Everyone but us.» |
| | `yard-clear-02` · wardenVisor | Warden ser innover land; glød langs horisonten | command/COMMAND: «Garrison Nine, the swarm is moving inland. Toward the refinery.» · warden: «They’re not chasing people. They’re chasing heat.» |
| | `yard-clear-03` · refineryBurning | Raffineriet i natt, tanker, flammer | caption: «Deepwell Refinery. Eleven million litres of fuel.» · warden: «Then that’s where we stop them.» |
| `refinery-clear` – etter 2-6 · CHAPTER 03 · The Deepwell | `refinery-clear-01` · refineryBurning | Kiln Alpha død, kjernen gløder fortsatt | caption: «The Kiln goes down. Its core keeps burning for a full minute.» · command/OKAFOR: «Warden. Look at the drill tower.» |
| | `refinery-clear-02` · foundryDescent | Borehullet under riggen, bredt som en gate, varmedis | caption: «Under the rig, the borehole. Wide as a street. Breathing heat.» · command/OKAFOR: «We didn’t find them. We drilled into their house.» |
| | `refinery-clear-03` · foundryCore | Okafor med ladningene, kart over sjakten | command/COMMAND: «Seal it. Charges at the bottom of the shaft.» · warden: «How far down?» · command/HALE: «All the way.» |
| | `refinery-clear-04` · wardenVisor | Troppen i heisburet, ser ned | warden: «Garrison Nine. We’re going down.» |
| `foundry-core` – før 3-6 · The Core | `foundry-core-01` · foundryCore | Bunnen av sjakten, kjernen, ladningen på plass | caption: «The Deepwell. Two kilometres down.» · command/OKAFOR: «Charge is set. The fuse is manual. Someone stays.» |
| | `foundry-core-02` · wardenVisor | Hale og Warden ansikt til ansikt | command/HALE: «I’ll do it.» · warden: «No. Get them to the lift, Hale. That’s an order.» |
| | `foundry-core-03` · foundryDescent | Sjakten rister, glødende øyne i alle sprekker | caption: «The shaft starts to shake. Something big is climbing.» · command/BRANDT: «Contacts. Every crack. Hundreds.» |
| | `foundry-core-04` · v2Charge | Pansret hånd på tennsatsen | warden: «Seventy-five seconds. Hold the core.» |
| `ashmaw-rise` – etter 3-6, før 3-7 · FINAL · Ashmaw **(NY)** | `ashmaw-rise-01` · foundryCore | Bunnen av sjakten; lunta brenner (rød gnistlinje langs kabelen mot ladningen), heisburet stiger i bakgrunnen med troppen | caption: «The fuse is lit. The charge is counting down.» · command/BRANDT: «Lift’s loaded. Warden, get on. Now.» |
| | `ashmaw-rise-02` · foundryDescent | Gulvet i brønnen revner; en lav svart kuppel løfter seg opp på korte krabbebein, 8 oransje ventiler i ring, ovnskjeften gløder (FIENDE-DESIGN.md, `ashmaw-trekvart.jpg`). Warden liten i forgrunnen for skala | caption: «The floor of the well splits. A black dome climbs out on short crab legs. Eight vents, burning like furnaces.» · command/OKAFOR: «That’s the mother. That’s what they were keeping warm.» |
| | `ashmaw-rise-03` · wardenVisor | Nærbilde Warden; Ashmaws ventilglød speiles oransje i det cyan visiret | command/HALE: «She’s on top of the charge. If she pulls it loose, it was all for nothing.» · warden: «Then she doesn’t leave the shaft.» |
| | `ashmaw-rise-04` · v2Charge | Lavt vinkel bak Warden: Ashmaw fyller bildet, kjeften åpen, hvitglødende; Warden hever rifla. Tittelkort-følelse | caption: «ASHMAW.» · warden: «Take the lift up, Hale. I’ve got her.» |
| `ending` – etter 3-7 (Ashmaw nedkjempet) · Cold Dawn **(ENDRET)** | `ending-01` · foundryCore **(ny brief)** | Siste ventil sprenges (svarte, knuste ventiler rundt kuppelen); Ashmaw synker bakover ned i hullet, krabbebeina glir; Warden står med rifla senket | caption: «The last vent bursts. Ashmaw sinks back into the well she came from.» · warden: «Stay down.» |
| | `ending-02` · foundryDescent **(ny brief)** | Ladningen går: sjakten kollapser over hullet; i forgrunnen stivner Husks og Lurchers, gløden slukner, rim på kitinet | caption: «The charge blows. The Deepwell folds in on itself, and on her.» · caption: «Without the heat, the Cinderborn slow. Then stop. Then sleep.» |
| | `ending-03` · wardenVisor | Heisen kommer ned, Hale rekker ut hånden | command/HALE: «Lift’s coming back down, Warden. You coming up?» · warden: «Yeah. I’m coming up.» |
| | `ending-04` · dawnYard | Kessa Yard i kald daggry, troppen samlet | caption: «Kessa Yard. Dawn. Cold, for the first time in weeks.» · warden: «All of us. Going home.» |
| `fallen` – første død i økta · Down (går videre selv etter 3 s) | `fallen-01` · fallen | Hjelmen i sølen, rød glød | caption: «Signal lost.» · command/HALE: «Warden’s down! Get up — we hold this together.» |

**Til Mellomsekvens:** nye paneler å male er `ashmaw-rise-01` … `-04`; `ending-01` og `ending-02` har **nye briefer** (innholdet er endret). Øvrige panel-id-er er uendret.

**Rulletekst (`story/credits.js`):** `await showCredits({ world })` → `{ skipped }`. Kjøres av levels etter `ending` og `gameComplete`. Langsom rulling (55 ref-px/s, ~55 s) over mørk bakgrunn med svake glør og glød nedenfra. Hold Enter/klikk = 5× fart, Esc = hopp over. Sluttlinjen stopper midt på skjermen i 3,2 s og tones ut. Innhold (engelsk): **BREACH** · «CINDER // THE DEEPWELL» · Direction: Alexander Nielsen · Project lead, Character, Arena, Enemy AI, Enemy design, Weapons, Audio, Effects, Cutscene art, Levels & story, Test: «Breach <Rolle> (Grok Bot)» · Garrison Nine: The Warden · Hale · Okafor · Brandt · Typeface: Barlow Condensed, © 2017 The Barlow Project Authors · SIL Open Font License 1.1 · «Built with plain JavaScript and Canvas 2D. No engine.» · **«Garrison Nine. Stand down.»**

**API:** `await showCutscene('intro', { world })` → `{ id, skipped }`. Kall køes. `cutsceneActive` er `true` mens en sekvens vises; tastene stoppes i capture-fasen og lekker ikke til spillet.

---

## 6. Lydhendelser fra mellomsekvensene (avtalt med Lyd)

Sendes med `world.events.emit(type, data)` når world finnes (fra `opts.world`, `story.init(world)` eller `window.BREACH.world`). Uten world (testsiden) går de bare til den lokale emitteren `storyEvents` (`storyEvents.on(type, fn)` → avmeld-funksjon), som alltid får dem.

| Hendelse | Data | Når |
|---|---|---|
| `cutsceneStart` | `{ id }` | Når sekvensen starter (etter at bildene er klare), før første linje |
| `cutsceneLine` | `{ id, index, speaker, panel }` | Hver gang en ny tekstlinje vises, også første linje i et nytt bilde. `index` løper 0, 1, 2 … gjennom hele sekvensen; `panel` er bildets indeks |
| `cutsceneEnd` | `{ id, skipped, auto? }` | Når overlayet fjernes. `skipped: true` hvis spilleren hoppet over; `auto: true` når sekvensen gikk videre selv (`fallen`) |
| `creditsStart` | `{}` | Rulleteksten starter (etter `gameComplete`) |
| `creditsEnd` | `{ skipped }` | Rulleteksten er ferdig/hoppet over; sluttskjermen vises |

Rekkefølgen er alltid `cutsceneStart` → `cutsceneLine` × n → `cutsceneEnd`. Ved hopp over kommer `cutsceneEnd { skipped: true }` rett etter siste viste linje; linjer som aldri ble vist, sendes ikke. Ukjent id sender ingen hendelser. Testet i headless Chromium (testsiden: full gjennomspilling av `intro` gir index 0–4 og `skipped:false`; hopp over i `foundry-core` gir index 0–1 og `skipped:true`; i spillet kommer `cutsceneStart`/`Line`/`End` på `world.events` før `waveStart`).

---

---

## 7. Spilltekst på engelsk

- Manus (`story/cutscenes.js`), talere (`// BROADCAST`, `// HALE`, `// OKAFOR`, `// BRANDT`, `// COMMAND`), hint («ENTER / CLICK  NEXT     ESC  SKIP», rulletekst «HOLD ENTER / CLICK  FASTER     ESC  SKIP»), rulletekst (`story/credits.js`), nivå- og bølgenavn og mål (`levels/data.js`), kort (`levels/upgrades.js`, `levels/cards.js`), bannere og HUD (`levels/hud.js`, `levels/index.js`: «CHAPTER 01», «WAVE 2 OF 5», «CLEARED», «GET READY», «NEXT WAVE», «REGROUP» (ved død), «SIGNAL LOST / WARDEN DOWN – RESTARTING WAVE», «FINAL / ASHMAW – Break her vents. Keep her in the shaft.», bosslinje «PHASE 1 · BURROW», «BUILD …», «HOLD THE CORE», «IN ZONE», «CORE», sluttskjerm «GARRISON NINE // COLD DAWN – WELL SEALED – RELOAD TO PLAY AGAIN»).
- Stil: korte setninger, ingen vitser. Militært samband for troppen, ordknapp førsteperson for Warden. Ord som «board», «Operator», «asset», «Protocol» brukes ikke lenger.
- Utviklermeldinger og kommentarer på norsk.
