# Status – Story og brett (oppdatert 2026-10-27 14:41)
Eier: game/src/levels/ og game/src/story/. Historie: CINDER (låst). All spilltekst på engelsk.

## Ferdig
- Henge-tast-feil (26.10) FIKSET: keyup/mouseup slippes gjennom i cards/player/credits, input.reset() ved pause/kort; 11/11 grønt (tests/results/overgang-1-2-ekte*.json). upgradeOffer {offer} sendes før openCards().
- 26.10 15:34: BUILD satt manuelt (oppdater ved hver levering), startLevel kaller input.reset(). Ammokasse i yard er Arenas fil (arena/yard.js l.104) – forslag [8.6,20.6] sendt via Breach.
- intro-01 linje 1–2 endret av Breach (Alexanders valg) – ikke endre tilbake.
- levels/data.js: 3 nivåer (Kessa Yard 5, Deepwell Refinery 6, The Deepwell 6+boss 3-7). Balanse Kessa Yard 26.10: 1-4 maxAlive 6→5, 1-5 topp med 17 fiender, maks 7.
- levels/index.js: restartWave(world,{cause}) VERIFISERT fra ekte pausemeny midt i 1-3 (samme bølge, felt ryddet, oppgraderinger beholdt, full HP/ammo, startpunkt, restart-hendelse, ikke pauset). false under mellomsekvens/kortvalg.
- Død→kontroll målt: 1. død 3,2 s (kald/varm), Esc 1,6 s, 2. død 1,0 s (mål < 4 s nådd).
- Alle 24 malte paneler aktive og HTTP 200 (sjekket på nytt 15:00, panel-sheet.cjs), 1920×1080, < 400 kB. fallen-01 forhåndslastes.
- Effekters shadowBlur-differ inne (hud.js, cards.js); rg shadowBlur i levels = 0.
- story/: cutscenes.js, player.js, credits.js, fonts/ (Barlow Condensed, OFL). test.html har restart-knapp.
- Rapport: reviews/brett1-demo-2026-10-26.md. Docs: NIVAER-OG-STORY.md oppdatert.

- Regresjon 15:00: smoke, pause-chain, probe-overgang-1-2 grønne. Test bekreftet tastefiks i headed Chrome 19/19 (reviews/test-2026-10-26-overgang-1-2.md). Testskript-kopier: reviews/story-tools/.

## Pågår
- Ingenting. Refinery v2-plan levert 14:42. ALEXANDER: vent med å bygge brett 2 til han har spilt demoen – ikke rør refinery-v2 før Breach sier fra.

## Neste
- Når docs/BOSS.md/spawnBoss kommer fra Fiende-AI: tilpass 3-7.
- Vurder at startLevel avbryter en aktiv mellomsekvens (CONTINUE/LEVEL SELECT).
- Balanse brett 2–3 med samme metode (auto-drap, rask/middels).

## Blokkert av
- Fiende-AI: spawnBoss + docs/BOSS.md.
- tools/core-test.cjs er utdatert (forventer fiende ved start). Eier: Core/Test.

## Siste skjermbilder
- /tmp/shots/all-painted-sheet.jpg, /tmp/shots/shadowblur-before-after.jpg, /tmp/shots/foundry-core-painted-sheet.jpg, /tmp/shots/yard-clear-fallen-painted-sheet.jpg, /tmp/shots/restart-menu-after.png
