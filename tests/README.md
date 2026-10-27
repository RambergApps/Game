# Breach testrigg (tests/)

Gjenbrukbar Playwright-rigg (playwright-core + headless Chromium) som eies av **Breach Test**.
Den starter en lokal `python3 -m http.server`, åpner spillet i 1280x720, kjører et skriptet
inndatascenario, tar skjermbilder, samler feil, måler FPS/frametid og skriver et JSON-resultat.
Riggen skriver aldri i `game/` eller `docs/`.

## Kjør

```bash
cd /workspace/breach
node tests/run.mjs                      # game/index.html + alle game/src/*/test.html, scenario smoke
```

Vanlige valg:

| Argument | Betydning | Standard |
|---|---|---|
| `--root DIR` | Rotmappe som serveres | `game/` |
| `--page REL` | Test bare denne siden (kan gjentas), f.eks. `--page src/enemies/test.html` | index + oppdagede test.html |
| `--scenario FIL` | Scenariofil (JSON) | `tests/scenarios/smoke.json` |
| `--out DIR` | Skjermbilder | `shots/test/` |
| `--results DIR` | JSON-resultater | `tests/results/` |
| `--roles a,b` | Roller som *forventes* å ha test.html (rapporteres som «mangler») | `player,arena,enemies,levels,story,audio` |
| `--no-discover` | Bare index.html | |
| `--strict` | Avslutt med kode 1 også når forventede testsider mangler. Norsk spilltekst blir feil i stedet for advarsel, se Språksjekk | |
| `--size 1920x1080` | Annen viewport | `1280x720` |
| `--chrome STI` | Egen Chromium/Chrome | nyeste `~/.cache/ms-playwright/chromium-*`, ellers `/usr/bin/google-chrome` |
| `--quiet` | Bare sammendragslinjen | |
| `--step-timeout MS` | Minste tidsgrense per steg (steg med `ms` får `ms` + 15 s) | `30000` |
| `--page-timeout MS` | Tidsgrense for én hel side | `180000` |
| `--no-start` | Ikke start spillet automatisk | |

Avslutningskode: `0` = ingen feil, `1` = feil på minst én side, `2` = feil argument, `3` = riggen krasjet.

## Oppstart («Klikk for å starte»)

Hvis `world.paused === true` etter lasting, tar riggen skjermbilde `startskjerm`, kaller `window.BREACH.startGame()`
(ellers klikk midt på canvas) og krever at `world.paused` blir `false`. Hvis en mellomsekvens (`.breach-cutscene`)
pauser spillet igjen, tas skjermbilde `mellomsekvens` og den hoppes over med Escape. Starter ikke spillet → FEIL.

## Robusthet

- Hver side kjører i egen browser context, i egen try/catch, med tidsgrense per steg og per side.
- `page.on('crash')`, `page.on('close')`, navigering og frakobling av nettleseren registreres (`pageEvents`, `cause`).
  Er nettleseren død, startes en ny før neste side. `window.close()` logges (Chromium blokkerer det uansett).
- Ved henging sjekker riggen om JS-tråden svarer, og rapporterer «siden henger».
- SIGINT/SIGTERM/SIGHUP håndteres av riggen (ikke Playwright): delresultat lagres som `AVBRUTT`, nettleser og server stoppes.
  `tests/results/siste.json` oppdateres etter hver side.
- En full kjøring tar ca. 30–40 s per side (≈ 4 min for alle). Ikke avbryt den – kjør den i bakgrunnen
  eller bruk `--page` for én side.

## Hva som måles per side

- **Feil**: `console.error`, uhåndterte unntak (`pageerror`), mislykkede forespørsler og HTTP ≥ 400 (f.eks. 404 for moduler/assets).
  `favicon.ico` ignoreres. Forespørsler til andre verter enn den lokale serveren regnes som feil
  (krav: ingen eksterne avhengigheter ved kjøring).
- **Ytelse** (`perf`-steg): rAF-sampling i siden → FPS (snitt og verste 1-sekundsvindu), frametid snitt/p50/p95/p99/maks,
  antall rammer > 20 ms og > 33 ms. Med `during` kjøres inndata samtidig (måling under kamp).
- **Tilstand** (`state`-steg): leser `window.BREACH.world` (eller `window.world`) hvis den finnes – spillerposisjon, HP, sikte,
  fiender (per type), cover (low/high), kuler, effekter, kamera, loop-FPS/steg. Ikke påkrevd.
- **Hendelser**: teller `world.events.emit(...)` per type (shot, hit, death, coverEnter, …).
- **Inndata-effekt**: flyttet spilleren seg, endret siktet seg, ble det skutt – og endret skjermbildene seg (sha1).
- **Canvas**: størrelse og om den er blank.
- **Hovedtråd** (i `perf`): andel tid hovedtråden jobbet, JS-ms per ramme og JS-heap (CDP Performance). Høy andel + lav FPS = spillet er tungt;
  lav andel + lav FPS = maskinen er travel.
- **Kalltelling** (`callCount`): antall kall til en navngitt funksjon i en modul i et tidsvindu, målt med V8 presis dekning
  (CDP Profiler) – endrer ikke spillkoden. Smoke bruker det for `src/audio/index.js` → `update`, sammenlignet med `loop.stats.steps`.

## Språksjekk (spilltekst skal være på engelsk)
Regel fra Breach (23.10.2026): all tekst i spillet skal være på **engelsk**. Det gjelder UI, HUD, menyer, startskjerm og mellomsekvenser. Dokumentasjon og vurderinger skrives på norsk. Logikken ligger i `tests/lang.mjs`.

- **Statisk (a):** Riggen skanner strengliteraler i `game/src/**/*.js` og tekstnoder, attributter og `lang` i `game/index.html`. Malstrenger er med, men `${…}` blir fjernet.
  - Disse ignoreres: kommentarer, `console.*(…)`, `new …Error(…)`, `errs.push(…)` (valideringsmeldinger), import-stier, id-felt (`id:`, `role:`, `rarity:`, `trigger:` …) og sammenligninger (`=== 'x'`).
  - Funn i testsider og verktøy (`test.js`, `tools/`, `_tools/`, `*.cjs`/`*.mjs`) står for seg selv som `devToolFindings` og teller ikke.
  - Hvert funn rapporteres med fil:linje og strengen.
- **Kjøretid (b):** `addInitScript` fanger opp `fillText`/`strokeText` (CanvasRenderingContext2D og OffscreenCanvas) og DOM-tekst (MutationObserver og prøver hvert 0,5 s) gjennom hele scenarioet. Det gjelder også mellomsekvensen: riggen venter 2,5 s før den hopper over, slik at teksten rekker å skrives ut.
  - Tekst som skrives tegn for tegn slås sammen, slik at bare den lengste varianten vises.
- **Kriterier:** Teksten må ha æøå, eller entydig norske ord (f.eks. og, ikke, klikk, starte, bølge, fiende, dekning, liv, ammunisjon, fortsett, nivå, trykk, våpen).
  - Ord som også er engelske (for, to, pause, under, over, hold, start) teller bare sammen med norske ord.
  - Korte ord (og, er, til, på, av, du, med) teller ikke alene.
  - Strenger med tydelig engelsk (the, and, you, wave, press …) og bare ett norsk ord flagges ikke.
- **Alvorlighet:** Funn er **advarsler** (`warnings`, `language` per side, `languageScan` øverst i JSON, og `norsk tekst: N/M` i sammendraget).
  - Med `--strict` gir statiske funn i spillkode `FEIL` totalt.
  - Med `--strict` blir også kjøretidsfunn på `index.html` til `feil`. Testsidene gir bare advarsel.

## Skjermbilder

`shots/test/<side>-<nr>-<navn>.png`, f.eks. `shots/test/index-03-skyting.png`. Overskrives ved hver kjøring.
Ta en kopi (eller bruk `--out shots/test/2026-10-23`) hvis du vil beholde en serie.

## Resultat

`tests/results/resultat-<tidsstempel>.json` og `tests/results/siste.json`. Feltet `summary` har én linje per side,
og siste linje i terminalen er `SAMMENDRAG: ...`.

## Scenarioformat (JSON)

```json
{ "name": "smoke", "steps": [ { "do": "wait", "ms": 2000 }, { "do": "shot", "name": "lastet" } ] }
```

| Steg | Felter | Effekt |
|---|---|---|
| `wait` | `ms` | Vent |
| `shot` | `name` | Skjermbilde |
| `keys` | `keys: ["KeyW","KeyD"]`, `ms` | Hold taster samtidig |
| `press` | `key`, `hold` (ms) | Trykk én tast (`Space`, `KeyE`, `KeyR`, `KeyG`, `F1` …) |
| `keyDown` / `keyUp` | `key` | Hold/slipp (kombiner med andre steg) |
| `move` | `x`, `y` (piksler, eller brøk 0–1) | Flytt musa |
| `aimCircle` | `cx`, `cy`, `r`, `steps`, `ms` | Sikt rundt i sirkel |
| `click` | `button` (`left`/`right`), `x`, `y`, `count`, `interval`, `hold` | Klikk |
| `mouseHold` | `button`, `ms` | Hold museknapp (automatisk skyting) |
| `mouseDown` / `mouseUp` | `button` | |
| `perf` | `ms`, `label`, `during: [steg…]` | Ytelsesmåling |
| `state` | `label` | Les ut spilltilstand |
| `eval` | `expr` | Fritt JS-uttrykk (resultat i JSON) |
| `callCount` | `url`, `fn`, `ms`, `label` | Tell kall til funksjon (V8-dekning) |
| `note` | `text` | Notat i resultatet |

Tastenavn er `KeyboardEvent.code` (som `core/input.js` bruker).

## Kontroller (fra prosjektleder)

WASD = bevegelse, mus = sikte, venstre klikk = skyte, **E = dekning**, **Space = rulling**. F1 = debugoverlegg.

## Standardscenario `scenarios/smoke.json`

(Autostart) → Last → vent 2 s → lyd-update-telling (2 s) + lydtilstand → skjermbilde → W/D/S/A + diagonal → skjermbilde → sikt rundt → skyt (klikk + hold) → skjermbilde →
E (dekning) → skjermbilde → A + Space (rulling) → skjermbilder → ytelse 10 s tomgang → ytelse 5 s under kamp → F1-debug-skjermbilde.

## Verifisere riggen uten spill

```bash
node tests/lag-dummy.mjs            # lager /tmp/breach-dummy (aldri i game/)
node tests/run.mjs --root /tmp/breach-dummy --out shots/test/dummy --results tests/results/dummy
```
`index.html` i dummyen skal gi 0 feil (og startes med klikk); `src/enemies/test.html` har bevisst konsollfeil, unntak og to 404-er;
`src/story/test.html` kaller `window.close()`; `src/levels/test.html` henger i en uendelig løkke (skal gi FEIL med «henger» og resten skal kjøre videre).
Bruk gjerne `--page-timeout 60000 --step-timeout 8000` for dummyen.

## Begrensninger

- Headless Chromium uten GPU (programvarerendering) og rAF låst til ~60 Hz: FPS-tallene viser om spillet holder 60 Hz
  på denne maskinen, ikke ytelse på ekte maskinvare, og kan ikke vise > 60 FPS.
- Lyd (Web Audio) verifiseres ikke hørbart – bare at det ikke kaster feil.
- Riggen ser ikke på bildene selv; testeren må se på skjermbildene.

## Gjennomspilling (nytt 23.10.2026)
- **Spillbot v5** (skråvinkel er standard): `cd /workspace/breach && setsid node tests/spill-brett1.mjs > /tmp/bot5.log 2>&1 &`. Bilder: `shots/test/spillbot-v5/`, data: `tests/results/spillbot-v5/siste-gjennomspilling.json` (waveLog per bølge: tid, dødsfall, ammo ved respawn, passivitet, treff/skaderetning på spilleren).
  Flagg: `--view 34|top` (top = `?view=top` til sammenligning), `--until 1-3` (stopp når bølge-id nås), `--max-min N`, `--passive-sec 6` (jakt når ingen fiende-HP/antall endres så lenge), `--no-extra` (ingen Kiln/Spitter-innslag), `--out`, `--results`.
  Sikte: spillet legger selv +20,25 worldY på musa i 34 (PROJ.aimGround), så boten peker på fiendens bryst på skjermen (`worldToScreen(x, y − 20,25)`), ikke fotpunktet. Start via `BREACH.startGame()` (menyen hoppes over under webdriver), Escape forbi mellomsekvenser. v4 (top-down) ligger i `tests/spill-brett1-v4.mjs`.
- `node tests/probe-passivitet.mjs --sec 80` – står stille i spawn; logger fiendeavstand/skudd/HP.
- `node tests/probe-heavy-grenadier.mjs --sec 32` – injiserer Heavy + Grenadier via `enemies.createEnemy`.
