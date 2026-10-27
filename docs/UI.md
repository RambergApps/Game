# UI: pausemeny, innstillinger, FPS og skaderetning (`game/src/ui/`)

Eier: UI (Breach Våpen-agenten). Tekst i spillet er engelsk, doc og kommentarer er bokmål. Ingen avhengigheter. DOM-overlegg for menyer (tilgjengelig tastatur/mus, skarp tekst, enkel scrolling) og Canvas 2D for skaderetning (tegnes i HUD-passet).

## Filer
| Fil | Innhold |
|---|---|
| `index.js` | `initUI(world, opts)` + re-eksport av alt |
| `settings.js` | Lagring (`localStorage['breach.settings']`), schema, sanering, `applySettings` |
| `settingsScreen.js` | `openSettings(container?, opts)`: gjenbrukbar innstillingsskjerm |
| `pauseMenu.js` | `createPauseMenu(world, opts)` |
| `fps.js` | `createFpsCounter({ loop, parent })` |
| `damage.js` | `createDamageIndicator(world)` |
| `style.js` | Palett, CSS (injiseres én gang som `#breach-ui-style`, prefiks `bx-`), tastestakk, hjelpere |
| `test.html` / `test.js` | Testside med ekte arena/spiller/våpen/lyd. K = innstillinger alene, J = skade utenfor skjermen |
| `tools/ui-shots.cjs` | Playwright: skjermbilder i `shots/` + funksjonstester |

## API
```js
import * as ui from './ui/index.js';
const UI = ui.initUI(world, { loop, onRestartWave, onQuit, confirm, canOpen, pauseOnBlur });
// → { pause, fps, damage, hud: { draw }, settings }   og world.ui = { pause, fps, damage, getSettings }
```
- `initUI` må kjøres etter `audio.init` og etter at kameraet finnes. Den lager FPS-teller, kjører `applySettings`, lager pausemeny og skaderetning.
- `UI.hud.draw(ctx, world, camera)` tegner skaderetningen. Legg den i `mods.hud` (skjermkoordinater).

### Pausemeny
`createPauseMenu(world, opts)` → `{ open, close, toggle, isOpen, settingsOpen, destroy }`
- **Esc** åpner/lukker. Global capture-lytter på `window`. Åpner bare når `canOpen()` er sann, ellers slipper tasten forbi (cutscene-hopp i Story virker).
- Standard `canOpen`: ikke når `world.paused` allerede er satt av andre (cutscene, kortvalg), ikke med `.breach-cutscene` eller `#start-screen` i DOM, ikke når spilleren er død.
- Punkter: **RESUME / SETTINGS / RESTART WAVE / QUIT TO MENU**. Restart og quit har bekreftelse.
- Kontekstlinje fra `levels._debug(world)` (nivå og bølge), ellers «Warden W-09 · Garrison 9».
- Resume nuller `world.paused` bare hvis menyen satte den.
- Pause: `world.paused = true`. Core-loopen oppdaterer da ingen moduler og `world.time` står stille. Lyd demper seg selv.
- Hendelser: `ui:pause`, `ui:resume`, `ui:restartWave { world, handled }`, `ui:quitToMenu { world, handled }`.
- Restart: `opts.onRestartWave(world)` → `levels.restartWave(world)` → emit `ui:restartWave`. Ingen håndterte: toast «Wave restart is not available yet».
- Quit: `opts.onQuit(world)` → `arena.openMainMenu(world)` → emit `ui:quitToMenu`. Ingen håndterte: `location.reload()`.

### Inndata-sikkerhet
- Tastestakk (`pushKeys`): capture-fase på `window` med `stopImmediatePropagation`, så spillets keydown-lyttere ikke ser menytaster (WASD/space/R osv.). `preventDefault` unntatt F5/F11/F12.
- Overlegget dekker canvas, så klikk når ikke spillet.
- Ved åpning og lukking: `releaseInput()` nuller mus venstre/høyre/pressed/hjul og kaller `input.endFrame()`. Testet: klikk på RESUME gir 0 spillerskudd.

### Innstillinger
`localStorage['breach.settings']`:
```json
{ "version": 1, "master": 0.8, "music": 0.42, "sfx": 1, "mouseSensitivity": 1, "aimAssist": 0, "screenShake": 1, "showFps": false }
```
| Felt | Område / steg | Brukes av |
|---|---|---|
| `master`, `music`, `sfx` | 0–1 / 0,05 | Lyd: `setMasterVolume`, `setMusicVolume`, `setSfxVolume` |
| `mouseSensitivity` | 0,25–2 / 0,05 | Karakter (`world.settings.mouseSensitivity`). Ingen effekt ennå: siktet er absolutt markør |
| `aimAssist` | 0–1 / 0,1 | Våpen (`weapons/aimassist.js`, kulemagnetisme). 0 = av |
| `screenShake` | 0–1 / 0,1 | `camera.shakeScale` |
| `showFps` | bool | FPS-teller (rød under 45) |

- Ødelagt JSON, feil type eller verdier utenfor området saneres til standard eller klemmes. `version` brukes til fremtidig migrering.
- API: `loadSettings`, `saveSettings`, `getSettings` (levende objekt), `setSetting(key, value, { save })` (emitter `settingsChanged` på world), `resetSettings`, `onSettingsChange(fn)`, `setAudioAdapter(api)`, `applySettings(world, { fps })`.

### Gjenbrukbar innstillingsskjerm
`openSettings(container?, { onBack, world, scrim, kicker, sensitivityNote })` → `{ el, close, refresh, focus, closed }`
- Uten container: eget fullskjerm-overlegg. Med container: tegnes inne i den (hovedmeny).
- Seksjoner: Audio / Controls / Display. Egne glidere (dra med peker, piltaster), av/på-bryter, RESET DEFAULTS og BACK.

### Skaderetning (rev. 2, 2026-10-26)
`createDamageIndicator(world)` → `{ draw, list, destroy, clear }`
- Lytter på core `hit` der `target === world.player`, ikke blokkert, `amount > 0`. Core endres ikke.
- Kildepunkt (`sourcePoint(source, target)`): granat/eksplosjon → `source.x/y` (eksplosjonspunktet, også ved selvskade fra egen granat) → levende `owner/entity` (ikke hvis det er spilleren selv) → `ox/oy` (munning) → `source.x/y`. Ingen kilde (miljøskade) eller kilde < 2 px unna → ingen retning og ingen hendelse.
- Vinkel = `atan2(sy − p.y, sx − p.x)` i verdensplanet. Bakkeplanet tegnes 1:1 i view 34, så samme vinkel brukes på skjermen.
- **Hendelse fra UI:** `damageDirection { entity, angle, amount, sourceX, sourceY, source }` (angle i rad, 0 = øst, med klokka). Sendes ved hvert slikt treff, også når indikatoren er slått av.
- Tegning: kort rød-oransje bue (34–58°, radius 46 px × zoom) med spiss rundt spilleren i brysthøyde (`PROJ.toScreen(x, y, 20)` i view 34), mørk kant for lesbarhet. Falmer på 0,7–0,9 s, tykkere/sterkere ved større skade (full ved 25). Treff fra samme retning (±22°) slås sammen. Følger levende skytter.
- Kilde utenfor skjermen: i tillegg en pil ved skjermkanten langs samme vinkel fra spilleren.
- Innstilling `damageIndicator` (bool, standard på, «Damage direction» under Display). Tegnes i sanntid (fader også i pause), under HUD-panelene.
- Test: `node game/src/ui/tools/dmgdir.cjs [port]` (statisk server med rot `game/`) → `src/ui/shots/20-dmgdir-{N,E,S,W,selfgrenade,melee}.png`.

## main.js-krokene (forslag, ikke gjort: main.js er core)
```js
import * as ui from './ui/index.js';
// main.js linje 45 i dag:
//   const loop = createLoop({ world, ctx, camera, input, mods: { level: levels, player, enemies, arena, weapons, audio, physics: { update: separateActors } } });
// Ny versjon (hud via wrapper fordi UI trenger loop for FPS):
let UI = null;
const loop = createLoop({ world, ctx, camera, input, mods: { level: levels, player, enemies, arena, weapons, audio, physics: { update: separateActors },
  hud: { draw: (c, w, cam) => UI?.hud.draw(c, w, cam) } } });
UI = ui.initUI(world, { loop });   // etter audio.init og kamera. Restart/quit finner selv levels.restartWave / arena.openMainMenu / events
// Egne callbacks er valgfrie: onRestartWave(w) / onQuit(w). Returner false for «ikke håndtert» → neste ledd i kjeden.
window.BREACH.ui = UI;
```
Hvis `mods.hud` allerede er brukt: kall `UI.hud.draw(ctx, world, camera)` fra den eksisterende HUD-funksjonen.

Verifisert i index.html via dynamisk import (`initUI(BREACH.world, { loop: BREACH.loop })`): Esc pauser (world.time +0,000 på 1 s), kontekst «KESSA YARD», Esc gjenopptar, 0 feil. Bilde: `src/ui/shots/09-pause-index.png`.

## Kontrakter for andre
- **Levels:** eksporter `restartWave(world)` (rydd feltet, `placePlayer` med full helse, `beginWave(d.wi, { retry: true })`, ingen cutscene), eller lytt på `ui:restartWave` og sett `handled = true`.
- **Arena (hovedmeny):** `openMainMenu(world)`, eller lytt på `ui:quitToMenu`. Gjenbruk `openSettings(container, { onBack, world: null, kicker: 'Main menu' })`.
- **Lyd:** dagens settere holder. Lagring gjøres av UI. Kan reagere på `ui:pause`/`ui:resume` og `uiClick`/`uiHover` (sendes som hendelser med `{ ui: true }`). Les `material` på `grenadeBounce` (se VAPEN.md).
- **Karakter:** les `world.settings.mouseSensitivity` når pointer lock eller virtuelt sikte kommer. Emit `playerRespawn`.

## Kjent
- Testriggens språkskanner flagger CSS-strengen i `style.js` («deg», «to», «i» i `linear-gradient(… deg)`). Falsk positiv.

## Verifisert med main.js-kroken (23.10, 14:20)
`game/src/ui/tools/pause-chain.cjs` (index.html): Esc → RESUME (Enter og klikk) gir 0 skudd; RESTART WAVE → bekreft → `restartWaveFallback` i main.js (levels.startAt) – spiller-HP tilbake til 100, menyen lukket; QUIT TO MENU → bekreft → `arena.openMainMenu` (ingen reload). 0 konsollfeil.
