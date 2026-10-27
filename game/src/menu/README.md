# src/menu – hovedmeny (eies av Arena)

Overlegg inne i `index.html` (ingen egen side, ingen sidelasting ved quit). Stil: `docs/MENY-STIL.md`.

- **Oppstart:** `main.js` har én linje nederst: `import('./menu/index.js').then((m) => m.attach(window.BREACH));`
  - `attach` skjuler «Click to start» (`#start-screen`), stopper loopen (`world.paused = true`) og åpner menyen.
  - **Hopp over:** `?skipmenu=1`, og automatiserte nettlesere (`navigator.webdriver`) uten `?menu=1`. Derfor går `tests/run.mjs` og `tools/smoke.cjs` uendret. Skjermbilder av menyen tas med `index.html?menu=1`.
  - `BREACH.startGame()` (brukt av testene) lukker menyen først og starter loopen. `BREACH.menu = { open, close, isOpen }`.
- **PLAY:** starter brett 1. Første gang brukes `main.js` sin `startGame`, som fjerner `#start-screen`. Etter quit brukes `levels.startLevel(world, 1)`, som nullstiller bølger og spiller.
- **QUIT fra pausemenyen:** `ui/pauseMenu.js` kaller `arena.openMainMenu(world)`, som `src/arena/index.js` eksporterer (dynamisk import). Det gir pause, stoppet loop og menyen.
- **SETTINGS:** Våpens `openSettings(document.body, { world, kicker: 'Main menu', scrim: true })` fra `ui/settingsScreen.js`. Tastene går via Våpens `pushKeys`-stabel (`ui/style.js`), så Esc lukker øverste skjerm.
- **LEVEL SELECT:** låst («LOCKED») til lagring finnes. Tastaturet hopper over knappen, og musen gir ingen hover. Klikk på den gir hinttekst.
- **CREDITS:** et enkelt panel. Esc, Enter eller klikk lukker det.
- **Taster:** opp/ned og W/S flytter, Enter/Space velger, Esc går tilbake. Musepekeren flytter valget. Lyd: `uiHover` og `uiClick` på world.events.
- **Filer:**
  - `index.js`: API og DOM
  - `bg.js`: base og glow med `'lighter'`, puls 0,55–1,0 over 2,7 s, parallakse 8 px, aske og gnister. Ultrabred skjerm skaleres etter høyden, så tårnet aldri kuttes.
  - `logo.js`: skrapet stål, glødkant og sprekk gjennom E. Tegnes én gang.
  - `fonts.js`: Barlow Condensed 800/600/500/400 fra `src/story/fonts`.
  - `style.js`: CSS i 1920-skala via `--s`.
- **Assets:** `game/assets/menu/`. `meny-bakgrunn-base` og `meny-glow` brukes som webp (ca. 130 kB hver), med png som reserve. Er base eller glow borte, brukes `meny-bakgrunn.webp` alene, uten glow.

## Hendelser (for Lyd m.fl.)
`world.events.emit`: `menuOpen` `{boot}` når menyen vises, `menuStart` `{level:1}` når PLAY trykkes (ca. 720 ms før lukking), `menuClose` `{reason:"play"|"close"}` når den fjernes.
