# BREACH – Lagring og opplæring (opplegg)

Skrevet av Breach Test 23.10.2026 på oppdrag fra Alexander via Breach. **Fiende-AI bygger** etter dette opplegget, og andre roller leverer de krokene som står i §3.4.
Grunnlaget er lest i koden, uten at spillet ble kjørt: `levels/data.js`, `levels/index.js`, `levels/upgrades.js`, `arena/yard.js`, `player/controller.js`, `player/state.js`, `player/tuning.js`, `weapons/index.js`, `weapons/data.js`, `weapons/crates.js`, `enemies/stats.js`, `enemies/behaviors/*` og `main.js`.
All spilltekst skal være på engelsk (PROSJEKT regel 5).

---

## 0. Utgangspunkt i koden i dag (kort)

| Område | Slik er det nå | Konsekvens for opplegget |
|---|---|---|
| Kessa Yard | Finnes som **nivå 1** (`levels/data.js`: `id 'container-yard'`, `arena 'yard'`, `name 'Kessa Yard'`). Arenaen heter fortsatt «Container Yard» i `arena/yard.js` (40×30 ruter). Nivået har 5 bølger: 1-1 *First Contact* (3 Husk), 1-2 *Glow in the Cracks* (3+2 Husk), 1-3 *Lurchers* (3 Husk + 2 Lurcher fra øst), 1-4 og 1-5. | Bølge 1–3 er 1-1, 1-2 og 1-3. |
| Fiendetyper i bølge 1–3 | Bare **Husk (grunt)** og **Lurcher (flanker)**. Kiln (heavy) dukker først opp i 2-2, og Spitter (grenadier) i 3-1. | Granat læres mot Husk i dekning. Nærkamp læres mot Lurcher, fordi bare flankeren slår i nærkamp, og da bare fra siden eller bakfra med flank-token. |
| Husk-AI | `grunt.think` = `chooseCover` og flanker aldri. Den foretrekker lav dekning (`coverBias low 1.3, high 0`). | Bølge 1 er trygg uten endringer. |
| Spillerstart | Sørvest, rute (4, 26.5). Første dekning er sandsekk (3,22) og barriere (9,24). Fiendene starter i nord (23, 3.5) og nordøst (36.5, 6.5), og flankene kommer fra øst (36, 18). | Det er langt til første kontakt, så Husk må rykke frem (§3.1). |
| Ammokasser | Rutene (7, 13.9), (20.5, 18), (32.9, 20.6) og (26.3, 12.2). Den nærmeste ligger **ca. 13 ruter** fra start. | Kassen ligger langt unna inngangen (se åpne spørsmål). |
| Ammo | AR-9 har 24 skudd + 168 i reserve, hagla 6+30 og presisjonsgeværet 5+25. Spilleren starter med 2 granater. Kassen gir fullt magasin og full reserve til alle våpen, +1 granat og 25 s nedkjøling. `needsRefill` er sann så snart et magasin ikke er fullt. | Spilleren går knapt tom på brett 1. Derfor utløses kasse-hintet av **granatpåfyll** eller lav reserve (§2). |
| Oppgraderinger | Spilleren får tre kort og velger ett etter bølger med `upgradeAfter` (1-2, 1-4, 1-5, …). Tilstanden ligger i `levels` (`d.upgrades.stacks`), og `world.playerStats` regnes ut på nytt. | Første kortvalg kommer etter bølge 2. `stacks` må kunne lagres og gjenopprettes. |
| Død i dag | `levels`: 1,6 s → mellomsekvensen `fallen` (**hver gang**) → `placePlayer` (`player.respawn`: full HP) → 3 s `REGROUP` → samme bølge på nytt. Oppgraderingene beholdes. **Ammo og granater gjenopprettes ikke**, så spilleren respawner med magasinet slik det var ved døden. | Ammo må gjenopprettes fra sjekkpunktet, og restarten må bli raskere (§1.5). |
| Meny/lagring | Det finnes bare en «CLICK TO START»-skjerm i `main.js`. Det finnes ingen hovedmeny, ingen CONTINUE og **ingen bruk av localStorage** i koden. `src/ui/` (pause og innstillinger, `breach.settings`, eid av Våpen) finnes ikke ennå. Esc gir ingen pause i spillet, bare hopp over mellomsekvens. | Alt i §1 er nytt. |
| `startLevel(world, n)` | Starter alltid på bølge 1, og nivåets mellomsekvens spilles hver gang. | Nivåer og story trenger `startAt` (§3.4). |

---

## 1. LAGRING

### 1.1 Prinsipper
- **Én lagring, auto-lagring ved sjekkpunkt.** Det er ingen manuelle lagringsplasser. Et sjekkpunkt er alltid **starten på en bølge**, for det er samme punkt som spilleren går tilbake til ved død. Én mental modell: «Jeg fortsetter alltid fra starten av bølgen jeg var i.»
- **Aldri lagre midt i kamp.** Lagring av spillforløpet skjer bare når fasen er `between`, `upgrade` eller `break`, eller når nivået er slutt. Lagrer man midt i kamp, kan spilleren havne i en situasjon som ikke går an å vinne (lite HP og omringet), og det er urettferdig.
- **Ingen straff som sletter noe.** Død eller å avslutte spillet sletter aldri framgang, oppgraderinger eller innstillinger.
- **Rask restart:** fra død til spilleren har kontroll igjen skal det gå **≤ 4 s**. Dekningsskytespill lever av «én gang til».

### 1.2 Hva lagres
Nøkkel **`breach.save`** (JSON). Innstillingene ligger i en egen nøkkel, **`breach.settings`** (eies av Våpen/`src/ui`, se PROSJEKT). Lagringsmodulen leser den aldri og skriver aldri til den.

```jsonc
{
  "v": 1,                       // skjemaversjon (heltall) – påkrevd
  "game": "breach",
  "savedAt": "2026-10-23T12:00:00Z",
  "run": {                      // null = ingen pågående kampanje (CONTINUE skjules)
    "level": 1,                 // 1-basert nivå
    "waveId": "1-3",            // bølgen som skal SPILLES ved fortsettelse (id, ikke indeks – tåler datareordning)
    "pendingUpgrade": false,    // true = lagret ved waveEnd før kortvalg; kortene vises igjen før bølgen
    "upgrades": { "plating": 1 },             // levels d.upgrades.stacks
    "loadout": {                // Våpens snapshot ved sjekkpunktet (ingen gratis påfyll – Alexander: ikke påfyll mellom bølgene)
      "index": 0, "grenades": 1,
      "slots": [{ "id": "rifle", "mag": 24, "reserve": 120 }, { "id": "shotgun", "mag": 6, "reserve": 30 }, { "id": "marksman", "mag": 5, "reserve": 25 }]
    },
    "crates": { "c0": 0 },      // valgfritt: gjenstående nedkjøling per kasse (s); kan droppes = alle klare
    "stats": { "deaths": 3, "playTime": 812 }  // kun visning/test
  },
  "profile": {                  // overlever NEW GAME
    "tutorial": { "done": ["move", "cover", "reload"], "shown": { "cover": 2 } },
    "seenCutscenes": ["intro"],
    "completed": false
  }
}
```

HP lagres ikke. Spilleren starter alltid en bølge med full HP, slik det er ved respawn i dag.

### 1.3 Når det lagres
| Øyeblikk (hendelse) | Hva skrives | Merknad |
|---|---|---|
| `waveEnd` (ikke siste bølge) | `run.waveId` = neste bølge, `pendingUpgrade` = `wave.upgradeAfter`, `loadout`-snapshot | Skjer **etter** at bølgen er ryddet, så det er ingen fiender igjen. |
| `upgrade` (kort valgt) | `run.upgrades`, `pendingUpgrade:false` | Spilleren mister aldri et valg. |
| `levelEnd` | `run.level = n+1`, `waveId` = første bølge, snapshot | Neste nivås mellomsekvens markeres ikke som sett før den er spilt. |
| `gameComplete` | `run = null`, `profile.completed = true` | CONTINUE forsvinner, og NEW GAME vises uten bekreftelse. |
| Innstilling endret | `breach.settings` (Våpen) med en gang | Eies av SETTINGS-skjermen. Dette er ikke en del av `run`. |
| Opplæringssteg fullført / mellomsekvens sett | Bare `profile` | Er lov midt i kamp fordi det ikke påvirker spillforløpet. Skrivingen kan vente til neste `waveEnd`. |
| NEW GAME bekreftet | `run` = nivå 1, bølge 1-1, ingen oppgraderinger, standard loadout | `profile` beholdes. |

Det lagres aldri under `phase === 'wave'`, `dead` eller `cutscene`. Testen sjekker at `run` ikke endres i disse fasene (§4).

### 1.4 Versjon, migrering og korrupte data
- `load()`: `try JSON.parse` → valider formen (at `v` er et heltall og at `run` er null eller har `level` og `waveId`). Ukjente felt ignoreres.
- **Migrering:** `MIGRATIONS = { 0: s => …, 1: s => … }`, som kjøres trinnvis til `CURRENT_V`. Hvis `waveId` ikke finnes i `LEVELS` lenger, faller spillet tilbake til første bølge i samme nivå. Er nivået borte, faller det tilbake til nivå 1. Ukjente oppgraderings-id-er droppes stille.
- **Korrupte data:** JSON-feil, feil form eller `v` > `CURRENT_V` (nyere bygg). Rådataene kopieres til `breach.save.corrupt`, og spillet oppfører seg som om det ikke finnes noen lagring. CONTINUE skjules. Det skal aldri krasje, og den korrupte filen skal ikke overskrives før neste vellykkede lagring.
- **Sikkerhetskopi:** før hver skriving kopieres forrige gyldige fil til `breach.save.bak`. Hvis `breach.save` er korrupt og `.bak` er gyldig, brukes `.bak`.
- **localStorage utilgjengelig** (privat modus, `file://`, kvote): lagringen faller tilbake til minnet. CONTINUE skjules, og spillet varsler én gang i konsollen med `console.info`. Det skal ikke komme noen feil, og testen krever 0 konsollfeil.

### 1.5 Hovedmeny: CONTINUE / NEW GAME
Hovedmenyen bygges av Arena (PROSJEKT) og erstatter «CLICK TO START». Klikket i menyen låser fortsatt opp lyden.
- **CONTINUE** vises bare når `load().run` er gyldig. Den står øverst og er valgt som standard. Undertekst: `Kessa Yard · Wave 3 of 5`. Valget kaller `levels.startAt(world, run.level, waveIndex, { upgrades, loadout, pendingUpgrade })`:
  - Nivåets `cutsceneBefore` hoppes over hvis den finnes i `seenCutscenes`. Spilleren får banneret `CHAPTER 01 / KESSA YARD`, og så `GET READY`-pausen (3 s).
  - Hvis `pendingUpgrade` er satt, vises kortene før bølgen.
- **NEW GAME:** finnes det en lagring, vises bekreftelsen `Overwrite saved progress?` med `[CONFIRM] [CANCEL]`. CANCEL er valgt som standard, og Esc betyr avbryt. Uten lagring starter nytt spill direkte. Opplæringen kjøres bare for steg som ikke er fullført i `profile.tutorial.done`.
- **SETTINGS:** gjenbruker SETTINGS-skjermen til Våpen. Foreslått valg der: `Tutorial hints: On / Off` og `Reset tutorial` (nullstiller `profile.tutorial`).

### 1.6 Død
1. `death` (spiller) → 1,0 s kort fall og nedtoning. Mellomsekvensen `fallen` vises **bare første gang** (`profile.seenCutscenes`). Senere vises bare et kort banner, `SIGNAL LOST` ~0,8 s.
2. Feltet ryddes, og spilleren respawner ved bølgestart med full HP. **Loadout gjenopprettes fra sjekkpunkt-snapshotet**, og ammokassene nullstilles til klare.
3. `REGROUP` i 2 s → samme bølge på nytt. Det totale målet er ≤ 4 s etter første gang. I dag går det 1,6 s + mellomsekvens + 3 s.
4. Oppgraderinger valgt før sjekkpunktet beholdes, fordi de er lagret ved `upgrade`. Ingenting slettes. `stats.deaths++` lagres neste gang det lagres.
5. Dør spilleren i pausen etter en ryddet bølge (`waveDone`), starter neste bølge, slik koden gjør i dag. Sjekkpunktet er allerede skrevet.

**Begrunnelse:**
- Restart fra bølgestart gir korte, forutsigbare forsøk (30–90 s). Bølgene er designet som én helhet med `maxAlive`, så en restart midt i bølgen ville gi en skjev situasjon.
- At oppgraderingene beholdes, gjør at det alltid føles som framgang.
- Når ammoen gjenopprettes fra snapshotet, kan døden verken brukes som gratis påfyll eller gjøre bølgen umulig å vinne.

---

## 2. OPPLÆRING

### 2.1 Taster (bekreftet i koden)
| Mekanikk | Tast i koden | Kilde | Avvik fra oppdraget |
|---|---|---|---|
| Bevegelse / sikte / skyte | WASD (+ piltaster), mus, venstre knapp | `player/controller.js` | Piltastene er et tillegg. |
| Sikte over dekning | Høyre knapp (popUp / lean ved hjørne) | `player/state.js` | Venstre knapp i dekning uten høyre knapp = blindskyting. |
| Dekning | **E** (søker i 112 px, kjegle 45° i bevegelsesretningen). E i dekning = forlat dekningen. | `tryCoverE` | OK |
| Cover-til-cover | **Q** (`tryDash`: dekning innen 320 px, kjegle 18° i bevegelsesretningen eller sikteretningen, minst 40 px) | `tryDash` | OK. Virker både fra dekning og fra fri bevegelse. |
| Rulle | **Space** (0,5 s, i-frames 0,06–0,30 s, nedkjøling 0,25 s) | `startRoll` | **I lav dekning gir Space et hopp over (vault)** når spilleren står stille eller beveger seg mot dekningen. Rulling i dekning krever bevegelse sidelengs eller bort fra dekningen. |
| Aktiv omlading | **R** starter, og **R igjen** i sonen gir PERFECT (hvit) eller GOOD. Bom gir JAMMED. Tomt magasin lader automatisk. | `weapons.reload`, `weapons/hud.js` | OK. Sonen er hvit på ladestolpen. |
| Nærkamp | **F** (kolbeslag, 0,7 s nedkjøling, 50 skade + stagger) | `player/index.js` → `weapons.tryMelee` | OK |
| Granat | **G holdes** (viser bane) og **slippes** for å kaste mot musa | `weapons.handleInput` | Kastet skjer når tasten slippes, ikke når den trykkes. |
| Ammokasse | Ingen tast. Spilleren går inn i kassen (radius `TUNING.ammoCrate.radius`). | `weapons/crates.js` | OK |
| Spurt / våpenbytte / pause | Shift, 1/2/3 + hjul, **Esc** | – | **Esc-pause er ikke implementert** (venter på `src/ui`). |

### 2.2 Hint-regler
- **Kontekstuelt:** et hint vises første gang mekanikken er relevant, aldri som en liste. **Ett hint om gangen.** Kø med prioritet: fare > bevegelse > ressurs.
- **Format:** ≤ 6 ord, tasten i klammer, engelsk. Hintet vises nederst i midten over HUD-en med cyan tastekapsel. Lyd: `uiHint` (Lyd, valgfri).
- **Forsvinner** når handlingen er utført (`done`). Da kommer en kort hake (✓) i 0,4 s. Hintet forsvinner også når situasjonen ikke lenger er relevant (`hide`, teller ikke som fullført), og tidligst etter 1,5 s, så det ikke blinker.
- **Repetisjon:** hvis utløseren slår til igjen og steget ikke er fullført, vises hintet på nytt etter en sperretid på **8 s**. Etter 3 visninger uten utførelse eskalerer det: en radiolinje fra HALE med samme innhold (tekst i HUD), og i **pausen** etter bølgen vises et øvingshint uten fiender (`Drill:` + hinttekst) til spilleren har gjort handlingen eller pausen er slutt.
- Pausen mellom bølger i Kessa Yard er 6 s. Ventes det på et øvingshint, forlenges den med inntil 10 s (bare hvis steget mangler).
- Steg som er utført før hintet vises (f.eks. at spilleren ruller på eget initiativ), markeres `done` stille. **Hint vises aldri for noe spilleren allerede kan.**
- Hint vises aldri under kort, mellomsekvenser eller pause.

### 2.3 Rekkefølge koblet til bølge 1–3

**Før bølge 1 (`GET READY`, ~4 s, ingen fiender, trygt):** bevegelse og sikting. Spilleren står i inngangen med sandsekken (3,22) foran seg.

**Bølge 1-1 «First Contact» (3 Husk fra nord, ingen flanking, få skyttere):** dekning, sikte over dekning og aktiv omlading.
- Husk rykker frem til lav dekning i rute B og holder linja. Spilleren blir beskutt forfra og har sandsekk eller barriere innen rekkevidde av E.
- Spilleren må lade om minst én gang, fordi 3 × 100 HP er mer enn ett magasin på 24 skudd med normal treffprosent.

**Bølge 1-2 «Glow in the Cracks» (3 Husk nord, så 2 Husk nordøst etter 7 s):** cover-til-cover (Q), granat og ammokasse.
- Gruppe 1 graver seg ned i lav dekning, og en «anker-Husk» blir liggende. Granaten gir mening fordi Husk bak lav dekning bare treffes 35 % av gangene.
- Gruppe 2 kommer fra nordøst og får skuddlinje forbi siden av dekningen spilleren ligger i, så dekningen slutter å virke. Det tvinger frem Q til ny dekning.
- Etter første granatkast mangler spilleren en granat, og det utløser hintet om ammokassen.
- Kortvalget etter bølgen er første oppgradering. Kortene har egen UI med 1/2/3 og klikk.

**Bølge 1-3 «Lurchers» (3 Husk + 2 Lurcher fra øst etter 6 s, maks én flanker aktiv):** rulling og nærkamp.
- Første Lurcher flanker langs rute C (østsiden), skyter en salve først (`minVolleys 1`) og stormer så inn. Spilleren lærer å rulle unna og slå ham ned med kolbeslag.
- Husk holder fronten slik at spilleren blir liggende i dekning, og det gjør flankingen merkbar.

### 2.4 Tabell: mekanikk | bølge | utløser | hinttekst | fullført når
| # | Mekanikk | Bølge | Utløser (første gang relevant) | Hinttekst (engelsk) | Fullført når |
|---|---|---|---|---|---|
| 0a | Bevegelse og sikte | Før 1-1 | `levelStart` nivå 1 + 1 s, spilleren har ikke flyttet seg | `[WASD] Move · [Mouse] Aim` | Spilleren har flyttet seg ≥ 64 px |
| 0b | Skyte | 1-1 | Første fiende synlig (`lineOfSight`) innen 15 ruter | `[LMB] Fire` | Første `shot` med team `player` |
| 1 | Dekning | 1-1 | Første `hit` eller kule nær spilleren (≤ 48 px), **eller** fiende synlig, mens spilleren er ute av dekning og det finnes dekning innen 112 px | `[E] Take cover` | `coverEnter` (spiller) |
| 1b | Sikte over dekning | 1-1 | I dekning ≥ 2 s med fiende synlig og uten `popUp`/`lean` | `Hold [RMB] to aim over` | `p.posture` = `popUp` eller `lean` + `shot` |
| 2 | Aktiv omlading | 1-1 | `reload` phase `start` (team player) | `[R] again in white zone` | `reload` phase `active` med result `perfect` eller `good` (en `fail` gir nytt hint neste lading) |
| 3 | Cover-til-cover | 1-2 | Spilleren i dekning, og en fiende har skuddlinje til spilleren fra mer enn 70° ut fra dekningens front (dekningen er «flanket»), **eller** gruppe 2 kommer + 2 s, og `player.dashTarget(world)` finner et mål | `[Q] Dash to next cover` | `playerDash` (eller `playerState` → `slide` med `dash:true`) som ender i `coverEnter` |
| 4 | Granat | 1-2 | Spilleren har ≥ 1 granat, og en fiende har ligget ≥ 4 s i samme dekning innen 6–14 ruter med fri bane | `Hold [G], release to throw` | `grenade` phase `throw` (team player) |
| 4b | Granat traff | 1-2 | Etter første kast som ikke traff (`explosion.hits` er tom) | `Land it behind their cover` | `explosion` med treff på fiende i dekning |
| 5 | Ammokasse | 1-2 | (`grenades < max` **eller** reserve < 50 % **eller** magasin + reserve < 2 magasiner) og en klar kasse innen 12 ruter. Kassen pulserer. | `Walk over crate to resupply` | `refill` (team player) |
| 6 | Oppgradering | Etter 1-2 | Kortene åpnes | `Pick one: [1] [2] [3]` | `upgrade` |
| 7 | Rulling | 1-3 | Lurcher-telegraf (`telegraph` fra flanker) mot spilleren, **eller** fiendegranatmarkør innen 90 px, **eller** spilleren i det åpne med HP < 50 % under ild | `[SPACE] Roll out of fire` | `roll` phase `start` (spiller). Hopp over lav dekning teller ikke. |
| 7b | Hopp over lav dekning (valgfritt) | 1-1 til 1-3 | Spilleren i lav dekning, og målet ligger rett bak | `[SPACE] Vault over low cover` | `vault` phase `start` |
| 8 | Nærkamp | 1-3 | En fiende innen 96 px (3 ruter) **eller** Lurcher i `meleeRush` mot spilleren | `[F] Melee – close range` | `melee` phase `hit` med `targets.length > 0` (bom gir nytt hint neste gang) |

Krav til sluttilstanden: **etter `waveEnd` 1-3 er stegene 1, 2, 3, 4, 5, 7 og 8 `done`**. Steg 0a og 0b kommer i tillegg, mens 1b, 4b, 6 og 7b er støtte.
Hvis et steg mangler ved `waveEnd` 1-3, kjøres øvingshintet i pausen før 1-4. Øvinger finnes for 2 (spillet tømmer magasinet: `Drill: [R] again in white zone`), 3, 4 (en øvingskasse/attrapp kan brukes som mål), 5 og 7. Nærkamp (8) eskaleres i 1-4: Fiende-AI sender første Lurcher inn i nærkamp igjen (§3.1).

---

## 3. Krav til Fiende-AI og de andre rollene

### 3.1 Fiendeatferd i bølge 1–3 (bare mens opplæringen pågår)
Atferden styres av `world.tutorial.active` og av stegene som ikke er fullført. Når et steg er `done`, går tilpasningen for det steget tilbake til normal atferd. Bølgedataene i `levels/data.js` passer allerede med denne rekkefølgen, så det trengs ingen nye fiender. Det foreslås bare et valgfritt felt per bølge, `tutorial: { … }`, som Nivåer og story legger inn og Fiende-AI leser.

| Bølge | Krav |
|---|---|
| **1-1** (3 Husk, nord) | `noFlank` (Husk flanker uansett ikke). `maxShooters: 1` til dekning (1) er done, deretter 2. `telegraph` 0,55 → **0,8 s** og fiendeskade × 0,6 til (1) er done. Husk skal **rykke frem** til lav dekning i rute B/C-sør (ca. 8–12 ruter fra inngangen, f.eks. barriere (12,24), sandsekk (17,19) og kassestabel (13,20)), slik at første kontakt skjer innen ~15 s etter `waveStart`. Ingen granater. Ingen nærkamp. |
| **1-2** (3+2 Husk) | Gruppe 1: én **anker-Husk** (`e.tutorialRole = 'anchor'`) holder samme lave dekning i ≥ 8 s (`repositionAfter` ≥ 20 s) innen 6–14 ruter fra spilleren, til granatsteget (4) er done eller ankeret er drept. Gruppe 2 (nordøst, 7 s): minst én Husk velger dekning med **skuddlinje inn på siden** av spillerens nåværende dekning (vinkel > 70° fra dekningens normal). Det gjør Q nødvendig. Husk kjører ikke frem til nærkamp. `maxShooters: 2`. |
| **1-3** (3 Husk + 2 Lurcher, øst) | Husk holder fronten (ingen nærgåing). **Første Lurcher** tar flank-token, skyter én telegrafert salve fra siden (utløser rulling) og gjør deretter `meleeRush` hvis nærkamp (8) ikke er done. Opplæringsjusteringer: oppladning 0,3 → **0,5 s**, angrep **fra siden og innenfor skjermen** (aldri bakfra første gang), og fiendens nærkampslag tar **aldri siste HP** (skaden kappes slik at spilleren har minst 1 HP) så lenge (8) ikke er done. Spillerens F under oppladningen staggerer, slik `stagger.js` allerede gjør. Andre Lurcher venter til første er død eller flank-token er frigitt (`maxFlankers 1` finnes). |
| **1-4** (bare hvis noe mangler) | Mangler (8): første Lurcher prøver nærkamp igjen med samme hjelp. Mangler (3): første gruppe flanker spillerens dekning som i 1-2. Ellers normal atferd. |
| Generelt | Ingen fiende skyter i de første 2 s etter at et nytt hint er vist (tid til å lese). Aldri to nye fiendetyper i samme bølge, slik dataene allerede er satt opp. Atferden skal være deterministisk med `world.rng`, så testen kan gjentas. |

### 3.2 Nye hendelser (world.events)
| Hendelse | Payload | Sendes av |
|---|---|---|
| `tutorialHint` | `{ id, text, key, phase: 'show' \| 'hide' \| 'done' \| 'drill', count }` | tutorial |
| `tutorialStep` | `{ id, done: true, t }` (`t` = `world.time`) | tutorial |
| `tutorialComplete` | `{ steps: [...] }` (alle hovedsteg done) | tutorial |
| `checkpoint` | `{ level, waveId, reason: 'waveEnd' \| 'upgrade' \| 'levelEnd' \| 'newGame' }` | save |
| `saveWrite` / `saveLoad` / `saveError` | `{ key, ok, reason? }` | save |
| `playerDash` | `{ entity, from, to, cover }` | Karakter (ny, alternativt `dash:true` på `playerState` → `slide`) |
| `restart` | `{ level, waveId, cause: 'death' }` | levels |

Hendelser som allerede finnes og brukes: `coverEnter`, `roll`, `vault`, `reload` (phase `start`/`active`), `melee` (phase `hit`), `grenade` (phase `throw`), `explosion`, `refill`, `upgrade`, `waveStart`, `waveEnd`, `levelEnd`, `gameComplete`, `death`, `hit`, `telegraph`, `shot` og `spawnWarn`.

### 3.3 API (Fiende-AI bygger `src/save/` og `src/tutorial/`, med modulkontrakt)
```js
// src/save/index.js
load() → save | null            // validert + migrert; aldri kast
write(patch) → bool             // slår sammen inn i run/profile; nekter (returnerer false + saveError) i fase 'wave'/'dead'/'cutscene'
checkpoint(world, reason)       // samler level/waveId/upgrades/loadout og skriver
clearRun()                      // NEW GAME
hasContinue() → bool
KEY = 'breach.save', CURRENT_V = 1

// src/tutorial/index.js  – init(world), update(dt, world), drawHud(ctx, world, camera)
STEPS                           // tabellen i §2.4 som data: { id, wave, trigger(world)→bool, text, done(evt)→bool, drill? }
state() → { active, current, done: {id: t}, shown: {id: n} }
markDone(id), reset(), setEnabled(bool)
```
`window.BREACH.save` og `window.BREACH.tutorial` eksponeres av `main.js` (Breach), og `?fresh=1` (ignorer lagring) og `?tutorial=reset` gjelder for testing.

### 3.4 Hvem eier hva
| Eier | Leveranse |
|---|---|
| **Fiende-AI** | `src/save/` og `src/tutorial/` (logikk, hintkø, hint-widget i HUD med ui-kit-stil fra levels). Opplæringsatferd i §3.1 (`tutorialRole`, `noFlank`, `maxShooters`, skadekapp, nærkampsjusteringer). |
| **Nivåer og story** | `levels.startAt(world, n, waveIndex, { upgrades, loadout, pendingUpgrade })`. `getUpgradeState()` og `setUpgradeState(stacks)`. Hendelsen `restart`. `fallen` bare første gang, og raskere restart (§1.6). Valgfritt `tutorial`-felt per bølge i `data.js`. Skrive den endelige tekstvarianten av HALE-linjene for eskalering. |
| **Karakter** | `playerDash`-hendelse (eller `dash:true`). `player.dashTarget(world)` → kandidat eller null (samme logikk som `tryDash`, uten bivirkninger), og `player.coverCandidate(world)` for E-hintet. |
| **Våpen** | `snapshotLoadout(e)` og `restoreLoadout(e, snap)`. Nullstille kasser (`resetCrates(world)`). `breach.settings` + valgene `Tutorial hints` og `Reset tutorial` i SETTINGS. Hindre at en kasse brukes opp ved et uhell (vurdere å kreve `reserve < max` eller manglende granat, ikke bare et magasin som ikke er fullt). |
| **Arena** | Hovedmeny med CONTINUE / NEW GAME / SETTINGS og bekreftelsesdialogen. Ekstra pulsring på kassen når kasse-hintet er aktivt. Vurdere en kasse nærmere inngangen (åpent spørsmål). |
| **Breach** | Integrasjon i `main.js` (meny i stedet for «CLICK TO START», init-rekkefølge `… → levels → story → save → tutorial`). `window.BREACH`-kroker. Esc-pause. Oppdatere PROSJEKT («Død: …» + lagring). |
| **Lyd** | Valgfritt: `uiHint`- og `checkpoint`-tikk. |
| **Test** | Verifisering i §4 og vurdering etter integrasjon. |

---

## 4. Testbarhet (hvordan Test verifiserer)
Riggen (`tests/run.mjs`, Playwright, kjørt med `setsid`) får et nytt scenario, `tutorial`:

1. **«Lydig nybegynner»-bot (hovedkriteriet).**
   - Starter med `?fresh=1&tutorial=reset` og fast seed.
   - Gjør **ingen** avanserte handlinger på eget initiativ: bare WASD mot nærmeste fiende, sikting og skyting.
   - Når den får `tutorialHint` med `show`, leser den tasten i `[...]` fra **teksten** og utfører handlingen (E, Q, Space, F, R ved lading, G hold/slipp mot fienden med lengst tid i dekning, gå til nærmeste klare kasse).
   - **Bestått:** ved `waveEnd` 1-3 er `tutorial.state().done` ⊇ {cover, reload, dash, grenade, crate, roll, melee}. Hvert steg ble først fullført *etter* sitt eget hint og i bølgen tabellen sier (±1). Spilleren døde ≤ 2 ganger. 0 konsollfeil.
   - Dette viser at spillet alene lærer bort alt, fordi boten ikke kjenner kontrollene utenfra.
2. **Passiv bot:** står stille og skyter. Bestått: hvert hovedsteg vises ≥ 1 gang innen `waveEnd` 1-3 eller i øvingen før 1-4. Repetisjonen respekterer sperretiden på 8 s og maks 3 visninger før eskalering.
3. **Ekspert-bot:** utfører alt før hintene. Bestått: 0 `show` for steg som allerede er done.
4. **Hinttekst:**
   - Alle tekster i `STEPS` er ≤ 6 ord og på engelsk (eksisterende norsk-sjekk).
   - Tasten i klammer finnes i kartet over låste kontroller (PROSJEKT).
   - Hint vises aldri når `world.paused`.
5. **Lagring:**
   - Etter `waveEnd` 1-1 er `localStorage['breach.save'].run.waveId === '1-2'`.
   - Laster man siden på nytt, er CONTINUE synlig. Fortsetter man, er `world.level.waveId === '1-2'` og `upgrades` lik.
   - Ved valg av kort er `upgrades` oppdatert med en gang.
   - En spion på `localStorage.setItem` for `breach.save` gir 0 skrivinger mens `phase === 'wave'`.
   - Korrupt JSON / `v: 999` / `v: 0` gir ingen krasj, CONTINUE skjult (eller migrert for v0), og `.corrupt` skrives.
   - Med localStorage blokkert (`page.addInitScript` som kaster) gir det 0 konsollfeil.
   - NEW GAME med lagring gir bekreftelsesdialog, og CANCEL lar lagringen stå urørt.
6. **Død:**
   - Drep spilleren (`world.player.hp = 0` via damage) midt i 1-2.
   - Bestått: samme `waveId`, `upgrades` urørt, loadout lik snapshotet, kasser klare og tid fra `death` til at input virker ≤ 4 s (andre gang).
7. **Skjermbilder:** av hvert hint første gang (`shots/test/tutorial-<id>.png`), menyen med og uten CONTINUE og bekreftelsesdialogen.

---

## 5. Åpne spørsmål (til Breach eller Alexander)
1. **Ammo ved død:** gjenopprette fra snapshotet ved bølgestart (anbefalt, i tråd med «ikke påfyll mellom bølgene») eller fylle helt opp? I dag skjer ingen av delene.
2. **`fallen`-mellomsekvensen:** bare første gang (anbefalt), eller alltid med «skip» på Esc?
3. **Ammokasse nær inngangen:** nærmeste kasse er ~13 ruter unna. Skal Arena flytte eller legge til en kasse ved rute A-sør (f.eks. rundt (6,19)), slik at kasse-hintet kan komme tidlig i 1-2?
4. **Kassen brukes ved et uhell:** `needsRefill` er sann når ett magasin ikke er fullt. Skal Våpen kreve større mangel?
5. **Hopp over lav dekning og våpenbytte:** skal de være obligatoriske steg i opplæringen eller bare valgfrie hint (dagens forslag: valgfrie)?
6. **NEW GAME for en spiller med fullført opplæring:** skal opplæringen hoppes over (anbefalt, styres av `profile`), eller skal hintene alltid vises i nivå 1?
7. **Én lagring eller flere:** én er anbefalt.
8. **Navnet på arenaen:** «Container Yard» (`arena/yard.js`) eller «Kessa Yard» (nivånavnet) i menyens undertekst?
9. **Esc-pause og SETTINGS** (Våpen, `src/ui/`) finnes ikke ennå. Opplæringsvalget i SETTINGS avhenger av dem.
