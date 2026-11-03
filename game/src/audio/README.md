# Breach – lyd (src/audio)

Prosedyrisk Web Audio-lyd for Breach. Vanilla ES-moduler, ingen byggesteg, ingen avhengigheter.
Modulkontrakt: `init(world)`, `update(dt, world)`, `draw(ctx, world, camera)`. Lyden lytter på `world.events`
og trenger ingen kall fra andre moduler utover det. Testside: `src/audio/test.html`.

## Volum-API (for innstillinger)

Stabilt fra v1.4.1. Importeres fra `src/audio/index.js`.

| Funksjon | Beskrivelse |
|---|---|
| `setMasterVolume(v)` | Hovedvolum 0..1. Returnerer verdien som faktisk ble satt. |
| `setMusicVolume(v)` | Musikk 0..1. |
| `setSfxVolume(v)` | Effekter 0..1. Gjelder også radio og UI-lyder (oppgraderingskort, stingere). |
| `getVolumes()` | `{ master, music, sfx }` (tall 0..1). |
| `mute(on)` | `true`/`false` demper/slår på. Uten argument veksler den. Returnerer ny tilstand. |
| `isMuted()` | `true` hvis lyden er dempet. |

Regler:

- **Klemming:** tall utenfor området klemmes inn (`1.7` → `1`, `-1` → `0`). Ikke-tall (`'x'`, `NaN`) ignoreres, og forrige verdi beholdes og returneres.
- **Lagring:** alle endringer lagres i `localStorage['breach.audio.volumes']` som `{"master":0.8,"music":0.42,"sfx":1,"muted":false}`. Verdiene leses når modulen lastes. Ødelagt JSON eller blokkert localStorage gir standardverdier, uten feil.
- **Før opplåsing:** funksjonene virker før `AudioContext` er låst opp (før første klikk/tast). Verdiene huskes og brukes ved `unlock()`. `getVolumes()` svarer riktig hele tiden.
- **Standard:** master 0.8, music 0.42, sfx 1, muted false.

Eksempel (innstillingsmeny):

```js
import * as audio from '../audio/index.js';
slider.value = audio.getVolumes().music;
slider.oninput = () => { slider.value = audio.setMusicVolume(+slider.value); };
muteBox.onchange = () => audio.mute(muteBox.checked);
```

## Synk for Breach Effekter: når treff- og dødslyder høres

Alle tider er i ms **etter at hendelsen sendes** på `world.events` (lyden planlegges synkront i lytteren).
Tallene er målt fra offline-render gjennom hele motorkjeden (planlegging +5 ms, masterbuss og kompressor). **I tillegg kommer enhetens utgangslatens**, typisk 10–40 ms. Den kan leses fra `getState().outputLatency` (sekunder).

- **Anslag:** første lyd over −20 dB under toppen.
- **Topp:** høyeste 5 ms-energi.
- **Hale:** −30 dB.

### Treff

| Hendelse | Betingelse | Lyd | Anslag | Topp | Hale |
|---|---|---|---|---|---|
| `bulletImpact` (v1.5, hovedkilde) | `kind:'body'` / mål → som `projectileHit`-radene; `kind:'cover'` → etter `surface` (metal/grate → `hitMetal`, sand/dirt → `hitSand`, ellers `hitConcrete`) | se under | | | |
| `projectileHit` | mål er Cinderborn (Husk/Lurcher/Spitter) | `hitChitin` | 16 | 18 | 230 |
| `projectileHit` | mål er Kiln | `hitChitin` (Kiln) | 16 | 20 | 200 |
| `projectileHit` | mål er Kiln Alpha (`variant: 'alpha'`) | `hitChitin` (Alpha) | 15 | 31 | 105 |
| `projectileHit` | annet mål (menneske) | `hitBody` | 16 | 20 | 65 |
| `projectileHit` | uten mål, flate metal / betong | `hitMetal` / `hitConcrete` | 15 / 16 | 18 / 20 | 470 / 195 |
| `hit` | mål er spilleren, ikke blokkert | `playerHurt` | 15 | 20 | 130 |
| `hit` | `blocked: true` (usårbar/rull) | `bulletGraze` | 19 | 41 | 105 |
| `hit` | uten prosjektil (nærkamp o.l.), Cinderborn / annet | `hitChitin` / `hitBody` | som over | | |
| `melee` | `phase: 'hit'`, kitin (standard) | `meleeHit` | **10** | 15 | 305 |
| `melee` | `phase: 'hit'`, drap (`killed`) | `meleeHit` (drap) | **10** | 21 | 420 (glør −30 dB høyfrekvent: 640) |
| `melee` | `heldWeapon` (v1.5): `shotgun` tyngre dunk (100→38 Hz, 260 ms), `marksman` lysere + stålklang, `rifle`/ukjent standard | `meleeHit` | **10** | 15 | +60 (hagle) |
| `melee` | `phase: 'hit'`, `surface: 'metal'` / `'flesh'` | `meleeHit` (metall / kjøtt) | 10 / 11 | 15 | 280 / 465 |

### Nærkamp (v1.4.1, for Effekter)

`meleeHit` spilles **uten** den vanlige +5 ms planleggingsmarginen (`immediate`), så anslaget ligger ca. 10 ms etter hendelsen. Det meste er kompressorens faste forsinkelse (~6 ms). Ingen lag i lyden er forsinket. Valg av variant (index.js `meleeInfo`):

- **Drap:** `p.killed` → `hits[i].killed` / `targets[i].killed` → reserve `target.hp <= 0`.
- **Tekstur:** første `hits[i].surface` (eller `targets[i].surface`). `'chitin'` er standard; `'metal'`, `'concrete'`/`'stone'` og `'flesh'`/`'body'` støttes.
- **Uten treff** (`hits` og `targets` tomme): `meleeMiss`.

| Fase (ms etter hendelsen) | Kitin | Drap |
|---|---|---|
| Lysglimt-synk: klikk + dunk | 10–25 (topp 15) | 10–30 (topp 21) |
| Splinter og støv | tett 15–100, legger seg ved ~400 (−30 dB høyfrekvent: 290–410) | som kitin |
| Skallsprekk | – | 10–100 (6 knekk innen 90 ms + lav knas) |
| Glørhale (sprak + hvesing) | – | 30–750 (−30 dB ved ~640) |

Effekters tall (glimt 0–50 ms, splinter topp innen 100 ms og legger seg rundt 0,4 s, glørhale ca. 0,6–0,8 s) passer med dette. Ved drap sender spillet også `death`, og `cinderDeath` legger knekk og kollaps oppå (topp ca. 145 ms).

`hit` og `projectileHit` for samme kule gir bare én lyd. Kuletreff lydlegges på `projectileHit`.

### Død

| Hendelse | Betingelse | Lyd | Anslag | Topp | Hale |
|---|---|---|---|---|---|
| `death` | Cinderborn (Husk/Lurcher/Spitter) | `cinderDeath` | 18 | 143 | 1080 |
| `death` | Kiln | `cinderDeath` (Kiln) | 18 | 143 | 2560 |
| `death` | Kiln Alpha | `cinderDeath` (Alpha) | 18 | 162 | 3030 |
| `death` | menneske (fallback) | `death` | 16 | 181 | 420 |
| `death` | spilleren | `death` (spiller) | 16 | 46 | 985 |
| `explosion` | Spitter-sekk | `acidBurst` | 18 | 22 | 1330 |
| `explosion` | vanlig granat | `explosion` | 15 | 29 | 1200 |

`cinderDeath` er bygd som et kort kitinknekk (anslaget, ca. 18 ms) etterfulgt av et knurr/kollaps. Den kraftigste delen kommer rundt 145 ms (Alpha ca. 160 ms). Et godt synkpunkt er derfor en liten «knekk»-effekt ved hendelsen og selve kollaps-/glødeutbruddet ca. 120–160 ms etter.

Høyst 2 knurr spilles samtidig (`growlVoices`). Ved massedød får de øvrige bare knekk og pust, så kollaps-toppen er da svakere.

## Innstillinger: kobling til Våpens `ui/settings.js`

Ingen endring i API-et trengs. `ui/settings.js` importerer `../audio/index.js` og kaller i `applyAudio()`:
`setMasterVolume(master)`, `setMusicVolume(music)` og `setSfxVolume(sfx)`. Det er nøyaktig vårt API.

- **Rekkefølge:** `initUI(world, {loop})` i `ui/index.js` kaller `applySettings(world)`. Den må kjøres etter `audio.init(world)`. Den kan kjøres før første klikk, fordi verdiene huskes til `unlock()`. **main.js kaller ikke `initUI` i dag** (sak for Breach/main.js-eier). Før det skjer, brukes våre egne lagrede verdier.
- **Sannhetskilde:** når UI-et er aktivt, er det `localStorage['breach.settings']` (Våpen). Våre setter-kall lagrer i tillegg `'breach.audio.volumes'`, som er reserve for sider uten UI (testsiden). De to holdes like fordi hver endring går gjennom setterne.
- **Demping:** valgfritt. `audio.mute(true/false)` kan kobles til en avkrysningsboks. settings.js har ingen i dag.
- **Standardverdier:** samme hos begge (master 0.8, music 0.42, sfx 1).

## Hovedmeny og demoflyt (v1.4.1)

**Meny-API** (for Arenas hovedmeny, `game/menu.html` / `src/menu/`, finnes ikke ennå). Det virker også uten `world`.

| Kall / hendelse på `world.events` | Lyd |
|---|---|
| `menuOpen()` / `'menuOpen'` | Menystemning (loop, 16 s fraser): dyp D-drone, vind, glør, fjerne slag under bakken og et lavt horn hvert 2. frase. Spillmusikken tones ned. Før første klikk/tast startes den ved opplåsing. |
| `menuStart()` / `'menuStart'` | PLAY: metallisk lås og krigstromme (~1,3 s). Stemningen tones ut på 1,2 s. Intro-kringkastingen venter til stingeren har landet. |
| `menuClose()` / `'menuClose'` | Stemningen tones ut (1,5 s). |
| `'uiHover'` / `'uiClick'` | Metallisk tikk / stålbryter (MENY-STIL: «metallisk klikk»). `ui/style.js` `uiSound(world, type)` virker. Er `world` null, må menyen kalle `audio.play('uiHover')` direkte. |

Menystemningen går på samme direkte buss som rulleteksten, som følger musikkvolumet og ikke dukkes av pause. Startskjermen i main.js («CLICK TO START») sender ingen menyhendelse. Der tolkes første `levelStart` rett etter opplåsing som PLAY (start-stingeren spilles én gang). Det faller bort av seg selv når menyen sender `menuStart`.

**Stemning i mellomsekvenser** (`scene.js`, styres av `cutsceneStart` / `cutsceneLine.panel` / `cutsceneEnd`). Den ligger utenfor radiobåndet, med lave nivåer:

- `intro`: havn, vind og fjern sirene → kaiene med skipshorn → dempet i hjelmvisiret → asfalten gløder (rumling, sprak, to støt).
- `yard-clear`: hav og to lange skipshorn (siste skip forbi moloen) → dempet i visiret → Deepwell brenner (fjern brann og smell).
- `cutsceneEnd` tar alt bort på 1,2 s (skip: 0,15 s), så ingenting blir hengende.

**Live demoflyt:** `tools/demo.cjs` (startskjerm → intro → brett 1 → yard-clear) logger hendelser, lyder og masternivå (`_meter()`).

## Hendelser lyden lytter på (utdrag)

| Område | Hendelser |
|---|---|
| Kamp | `shot`, `hit`, `projectileHit`, `death`, `reload`, `heavyReload`, `melee`, `grenade`, `grenadeWindup`, `grenadeBounce`, `explosion` |
| Organiske skudd | `shot.weapon` = `'spine'` (Husk), `'slag'` (Kiln), `'acid'` (Spitter), `'barb'` (Lurcher, lettere pigg). Ukjente id-er bruker menneskevåpen-lyden. |
| Fiender | `spawnWarn`, `spawnRise`, `telegraph`, `meleeCharge`, `spinup`, `spindown`, `footstep`. `variant: 'alpha'` gir tyngre Kiln-lyder. |
| Nivå | `levelStart`, `waveStart`, `waveEnd`, `levelEnd`, `gameComplete` |
| Oppgradering | `upgrade` (valgt kort). Åpning: foreløpig `'upgradeOffer'` (`UPGRADE_OPEN`, sendes ikke ennå). |
| Story og brett | `restart` (kort «tilbake i kamp», intensitet nullstilles), `bossStart` / `bossPhase` / `bossEnd` (midlertidig: stinger + maks intensitet → lang utpust), `creditsStart` / `creditsEnd` (rolig gameComplete-tema i løkke, tones ut). |
| Mellomsekvenser | `cutsceneStart`, `cutsceneLine` (speaker announcer/command/warden/caption), `cutsceneEnd`. Radiolyd per speaker. |

## v1.5: én lydkilde per kuletreff
`bulletImpact` (Våpen rev. 6) er hovedkilden for kuletreff. `coverHit` og `projectileHit` er bare reserve: de legges i en
mikrooppgave og spilles bare hvis samme prosjektil ikke fikk en `bulletImpact`. Hver projektil gir maks én treff-lyd.
`bulletImpact` uten `projectile` spilles alltid (én gang). `explosion.kind`: `'frag'` → `explosion`, `acid`/`sac` → `acidBurst`,
`'small'` eller `radius < 50` → `explosion` på 0,6 gain.
Innstillinger: Våpens `ui/settings.js` importerer lydmodulen direkte og kaller `setMasterVolume/setMusicVolume/setSfxVolume`
ved hver slider-endring (verifisert live 26.10). Ingen endring trengs hos Våpen.

## Måling for test: `_meter()` og `played` (v1.6)
- `_meter()` → RMS i dBFS (tall) over siste 2048 samples av **faktisk utgang** (AnalyserNode på klipperens utgang: master → kompressor → klipper → [analysator]). Opprettes ved opplåsing; `null` før AudioContext finnes. −120 betyr ekte stillhet.
- `_meter(true)` → `{ rms, peak, state }` (topp i dBFS, `state` = AudioContext-tilstand).
- `getState().played` teller hver avspilt stemme per lydnavn – alle veier (direkte `play()`, hendelser, stingere) går gjennom samme `play()`. `played._total` = sum. Musikkløkker: `_menuMusic` (hver menystart), `_credits`.
- `getState().menuMusic` (aktiv), `menuGain` (0..1 på menybussen), `menuEvents` (true når Arenas menyhendelser er mottatt; da er DOM-reserven av).
- Merk: i automatiserte nettlesere (navigator.webdriver) åpner menyen bare med `?menu=1`.

## Menymusikk (v1.6)
`createMenuMusic` i `stingers.js`, styrt i `index.js`: `menuOpen` → fade inn 1,5 s (ved låst lyd: starter ved første klikk/tast hvis menyen fortsatt er åpen; spillmusikken tones ut). `menuStart` → fade ut 0,72 s + startstinger. `menuClose` → fade ut 0,7 s, kampmusikken tas opp igjen. QUIT (`menuOpen {boot:false}`) starter den på nytt.

## v1.7 – stemmer i mellomsekvensene og Kessa Yard-musikk
- **voice.js**: forhåndsgenererte stemmer (Kokoro-82M, se `tools/voice/README.md`) i `game/assets/voice/<scene>/<panel>-<linje>.ogg` + `manifest.json`.
  - `cutsceneStart` laster scenens filer (fetch + decodeAudioData, relative stier).
  - `cutsceneLine` spiller `<panel>-<linje i panelet>` 160 ms etter radio-klikket, og forrige replikk tones ut på 80 ms.
  - Ved `cutsceneEnd` med skipped tones stemmen ut på 120 ms. Uten skip får siste replikk klinge ferdig (gjelder også fallen).
  - Mangler en fil, blir det stille, uten feil.
- Buss: `engine.voice` (sfx × voice-volum) direkte til master, utenom pause-dempingen. Radiostøy og scene-ambiens (`engine.radioDuck`) dukkes −9 dB mens det snakkes.
- Nytt API (bakoverkompatibelt): `setVoiceVolume(v)`. `getVolumes()` gir nå også `voice`, og det lagres i `breach.audio.volumes`. `getState().voiceState` = { scene, loaded, speaking, played, missing }.
- **yard-music.js**: spillmusikk for brett 1 (`arenaLoaded` med id `'yard'`). Andre brett bruker music.js, og byttet skjer med fadeOut på 1,2 s.
  - Intensitet: gulv 0,25 + 0,1 per levende fiende. Etter waveEnd synker den mot 0,1 på cirka 3 s.
  - Sidechain: `shot` −4 dB (maks én gang per 150 ms), `explosion` −8 dB, `waveStart` og `spawnWarn` −6 dB.
  - Følger musikkvolum, mute, pause og menyovergangen fra v1.6 (samme musikkbuss).
- `_tap()`: MediaStream av ferdig miks, til testopptak (tools/voice/clip.cjs).

## v1.12 – lagdelt tekno-musikk v3 (techno-music.js)
- **Filer:** `game/assets/music/{yard,refinery}-int{1,2,3}.ogg`.
  - Opus mono: int1 48 kbps, int2/3 64 kbps, totalt 6,6 MB.
  - Kilde: `/workspace/breach-lyd-forslag/src/techno-loop-v3.js`.
- **Spor per brett:** `yard` → Yard (128 BPM, 80 takter, 150 s), `refinery-crossroads` → Deepwell (132 BPM, 88 takter, 160 s), `underground-foundry` → Deepwell inntil videre.
- **Lasting:** filene lastes og dekodes først ved `arenaLoaded` (ikke ved oppstart). Gammel musikk (yard-music.js og music.js) spiller til de er klare, og fortsetter hvis lastingen feiler.
  - Dekodingen bruker `OfflineAudioContext` i lav rate: int1 22,05 kHz, int2/3 32 kHz, mono.
  - Minne: Yard 51,6 MB og Deepwell 55,1 MB, mot ca. 173 MB i 48 kHz stereo. Bare gjeldende spor holdes i minnet.
- **Avspilling:** 3 `AudioBufferSourceNode` med `loop=true` startes på samme `ac`-tid, så de er sample-synkrone og sømløse.
- **Nivåbytte:** kryssfade over 2 slag, som starter på neste taktgrense.
- **Kamp-score:**
  - Bidrag: bølge aktiv 0,3, `spawnWarn` 0,45 (faller over 10 s), skudd siste 8 s 0,012 per skudd (maks 0,35), eksplosjoner siste 8 s 0,12 per stk (maks 0,3), levende fiender 0,05 per stk (maks 0,25).
  - Alternativt brukes 0,6 × den gamle intensiteten, hvis den er høyere.
  - Opp: over 0,32 → nivå 2, over 0,62 → nivå 3.
  - Ned: under 0,2 (fra 2) eller 0,45 (fra 3), etter minst 4 takter på nivået, ett trinn om gangen.
- **Ducking:**
  - Skudd, eksplosjon og spawnWarn: halv dybde av yard-music.
  - Stemme: −7 dB via `onSpeech`.
  - Pause og mellomsekvens: eksisterende `engine.setPaused` (ca. −18 dB pluss lavpass).
- **Volum:** følger musikkbussen, altså `setMusicVolume` og musikkslideren i ui/settings.js.
- **Test:**
  - `getState().techno` → `{ track, level, score, lanes, pos, mb, … }`.
  - `_technoLevel(1..3|null)` tvinger et nivå.
  - `?music=old` slår v3 av.

## v1.13 – stille oppstart og nivå per spor
- **Oppstart:**
  - Når et brett med v3-spor lastes, er musikken stille til sporet er dekodet. Deretter tones v3 inn på 0,8 s.
  - Forrige brett sitt v3-spor tones ut på 0,4 s. `techno.expect(spor)` hindrer at det gamle sporet startes på nytt mens det nye lastes.
- **Reserve:**
  - `yard-music.js` / `music.js` brukes bare når lastingen eller dekodingen feiler, eller etter `LOAD_TIMEOUT_S = 9` s.
  - Kommer v3 etter tidsavbruddet, tones reserven ut (0,6 s) før v3 starter, så de overlapper ikke.
  - `?music=old` virker som før.
- **Nivå per spor:** `TRACKS[spor].gainDb` legges på LEVEL. Begge står på 0 dB, fordi Deepwell v3 og Yard v3 er like i spillet (≤ 2 dB per nivå, 0,0–0,1 LU i filene). `?techgain=<dB>` overstyrer Deepwell, for test.
- **Test:**
  - `getState()` → `musicSrc` ('v3' | 'yard-old' | 'cinder-old'), `oldStarts`, `techFallback`.
  - `_technoLog()` gir tidslinjen for lasting og fallback.
  - `_dyn()` gir kompressor-reduksjon og peak før/etter klipperen.
  - Probe: `reviews/musikk-v3-innkobling-2026-11-03/probe-v113.cjs` (MODE=levels|timeline|fail|slow).
