# Vapen – status (2026-10-27 16:51)
Oppdatert: 2026-10-27 13:20. Mål: demo av brett 1. Rot: /workspace/breach/game.

## Ferdig
- Demoen bruker faceted (`src/weapons/look/{rifle,shotgun,marksman}.js`, faceted.muzzleOf); player.muzzle = muzzleDraw, avvik 0. fx-flaggene (5) false, VFX eier dem.
- Lesbarhet runde 2 (S-12 v3, AR-9 v3, LED fra 1×). Munningsavvik = klar- mot siktepositur (VAPEN-DESIGN §3). M-4 én-skudd ≥14 r.
- Skaderetning/damage direction rev. 2 (src/ui/damage.js): bue rundt spilleren + kantpil, hendelse 'damageDirection', innstilling; Test retester i full runde.
- Fiender utenfor skjermen (27.10, src/ui/offscreen.js): trekant ved kanten i typefarge (ENEMY_TYPES.color), fade 260→1500 px (alfa 1→0,38),
  bunnen klemt over våpenpanel (reload-størrelse) og helsepanel. Koblet i ui/index.js hud.draw. Innstilling Display → «Off-screen enemies» (på). Verktøy ui/tools/offscreen.cjs.
- Kulehull (src/weapons/decals.js): TUNING.coverDecals løsnet 27.10 → 15/s, rifle ≥0,08 s, minDist 3, én per shotId. decals.cjs: 29/108 treff ble hull (før 7/71).
- pauseMenu releaseInput kaller input.reset?.() (hold W → pause → fortsett = 0 px).
- Anmeldelse: reviews/vapen-demo-2026-10-26.md.

## Parkert (C)
- Variant C: free.js, free-test.*, reviews/diffs/paintedC-weapons.diff. Utkast; venter til Alexander har sett demoen.

## Pågår
- Ingenting.

## Neste
- Glimt/munning i 8 retninger og i bevegelse; hendene på grip/fore. Ytelse i nettleser med GPU.
- Off-screen: ev. unngå objektivpanelet øverst til venstre (ikke klemt nå).

## Blokkert av
- Story: restartWave (fiender ved restart ikke testet). src/effects/floor.js gir 404 i ui/test.html og smoke (ikke min fil).
- Bossangrep og videre pausemeny venter til etter demoen.

## Siste skjermbilde
- S-12 kloss hold: pickBody+bodySweep (weapons/index.js), TUNING.pointBlank; Lurcher hip 0.48→0.99, aim 0.04→0.97 pellets. Se weapons/tools/pointblank.md. Rifle/M-4-sjekk gjenstår.
