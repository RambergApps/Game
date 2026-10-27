# Breach – samlet status (PAUSE)
Sist oppdatert: 23.10 kl. 14:42 (pause etter ordre fra Alexander). Mål: demo av brett 1 (Kessa Yard, 5 bølger, view 34).

## Ferdig og i spillet
- Kjerne: pausemeny/settings/skaderetning, effekter (under/over), kulehøyde (z), treffkilde (source.x/y), perf-merker. tests/run.mjs 10/10, 0 feil.
- View 34 er standard (?view=top for sammenligning). Sikte i brysthøyde og munningshøyde (Warden), uttoning bak høy dekning, kald spawnpute.
- Fiender: jakt-atferd (maks 5,5 s passivitet), Spitter-kast, organiske skudd. Husk og Lurcher kantet/malt i spillet (import aktiv).
- Våpen: respawn med full ammo, rev. 6 skråvinkel, våpenmodeller AR-9/S-12/M-4 (skala 36), pausemeny-kjeden (RESUME/RESTART/QUIT) testet.
- Hovedmeny (PLAY = brett 1, SETTINGS, CREDITS, LEVEL SELECT låst), openMainMenu, world.perf (?perf=1).
- Effekter: VFX har overtatt glimt, treff, eksplosjon, nærkamp og blod. Innenfor budsjett i median; p95 tung på high strammes inn.
- Lyd v1.4.1: radio, oppgraderingskort, organiske skudd, volum-API, midlertidig bosslyd.
- Mellomsekvenser: alle malt og godkjent (intro, yard-clear, refinery-clear, foundry-core, ashmaw-rise, ending, fallen).

## Pågår ved pause
- Warden-design: faceted koblet inn med fargeløft (demo), accent-materiale og muzzleOf; prøve på variant C (malt overkropp + malte bein) -> shots/warden-C-prove.png.
- Monsterdesign: Husk mindre (ca. 1,1x Warden), roligere fasetter, treffblink, billigere oppvarming (maks 3 s / 15 MB).
- Story og brett: restartWave(world); legge inn VFX-differ (HUD/kort).
- Arena: YTELSE.md-måling (parkert), kulehullskrok (parkert), 3 VFX-lysdiffer lagt inn.
- Effekter: stramme p95, verifisere i ekte spill.
- Fiende-AI: sluttest av P1 og boss-stubb (avbrutt av pausen; statusfil fra 14:25). Gjenstår: fjerne sourceForHit, munningshøyde for fiender.

## Gjenstår for demo
1. Warden faceted med fargeløft ferdig koblet inn (alle demoposer).
2. Husk-runde 2.
3. restartWave.
4. Fiendenes munningshøyde.
5. Lyd for meny, intro og yard-clear.
6. Testspillbot oppdatert til view 34 -> full gjennomspilling av 5 bølger + YTELSE.md.
7. Fikser fra testrunden.

## Etter demoen
Warden endelig design (C hvis prøven godkjennes), Kiln/Spitter/Kiln Alpha/Ashmaw-utseende, bosser, lagring, opplæring, brett 2–3.

## Beslutning 15:04 (Alexander, under pause)
- Warden variant C: bena fra rad 4 i reviews/img/warden-sprites-C/grid4x.png er valgt. Gjelder alle retninger og poser. Overkroppen trenger fargeløft (for mørk og brunlilla). Gis til Warden-design ved FORTSETT.
