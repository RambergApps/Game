# Status: Breach Fiende-AI (fiendeoppførsel, boss, lagring)
Oppdatert: 2026-10-27 ca. 14:40. Eier: src/enemies (unntatt look/, som eies av Monsterdesign).

## Ferdig
- Husk/Lurcher/Kiln/Spitter: dekning, peek, telegraf ≥ 0,4 s, squad-tokens (maks 2 skyttere), stagger, spawnWithWarning. source på 100 % av treff, e.muzzle {x,y,z}.
- A1 softlock (1-3): fikset 26.10 (token-pruning, walkable-API, softlock-vakt 5/8/20 s).
- **27.10 hastefiks, vinkel 55:** fiender telegraferer, skyter og kaster bare innenfor kamerabildet (ny onscreen.js: world.camera.worldToScreen, fot + munning, margin 28 px). Utenfor bildet: ser ikke, jakter inn. Ut av bildet under varsel/salve: avbrutt og token sluppet. Sperrer finnes i perceive, setState, fireWeapon og throwGrenade.
- Skisse for Hunker (cover-fiende): docs/FIENDE-COVER-SKISSE.md (grensesnitt avtalt med Monsterdesign).

## A2 (står stille 6–10 s): fiks inne 27.10
- Årsak (instrumentert hvert 0,5 s): blinde fiender i hunt/seekCover «går» med full ønsket fart (123–210) mot en vegg eller dekning, men står på samme sted i 7–19 s. Stuck-sjekken brukte vx/vy (ønsket fart), så den slo aldri til.
- Fiks v1 (hunt.js): faktisk fart fra forflytning, blockedCheck etter 1 s (ny dekning eller sidesteg), stillstander ≥ 4 s per gjennomspilling 25 → 1 (seed 1) og 22 → 2 (seed 2).
- Før/etter i ny vinkel (55°, zoom 2,25), seed 1, 1-1 til 1-3: tider 38/96/104 → 42/82/68 s, passivitetsperioder 6 → 1, dødsfall 2 → 2, 0 konsollfeil. Treff fra utenfor bildet: 0 av 63 (før) og 0 av 40 (etter). Begge kjøringene hadde onscreen-fiksen.

## Neste
- VENTER (Breach 14:37): står stille til Alexander har spilt demoen. Koden beholdes som den er, og jeg står klar for feil fra Tests samlede gjennomspilling. Mildere 1–3-variant kommer først etter klarsignal. Deretter skala-hook for Kiln Alpha, og Hunker inn i bølger (Story og brett).

## Blokkert av
- Alexanders demotest. player/cover.js vann-diff venter hos Warden-design.

## Core: lowCoverProtecting (27.10 ~17:00, combat.js tillatt kun her)
- Vinkelrett+alle kroppspunkter (16:43). Hunker-munning: HUNKER_MUZZLE.fwd/side, side til høyre for coverFacing (weapon.js muzzleXY).

## Hunker bygget 27.10 ~13:55
- behaviors/hunker.js + stats.js (hunker, r 18, BODY 39/18,6, munning fra HUNKER_MUZZLE). Kun lavt cover, ryggskjold ×0,5, peek-telegraf, bytte ved flanking/2–3 salver, jakt uten cover.
- Test (tools/hunker-test.mjs): cover ✓, skjold 5/10 ✓, telegraf 0,50/0,55 s ✓, bytte ✓, 0 konsollfeil. Ikke i levels-bølger ennå.
## Hunker-runde 2 (27.10 ~14:20)
- Peek/fire kun fra dekningsplass (dukket/peek → telegraph → fire, gate i setState); krøket sprint cover/crouch 0,5; egen kantavstand 20 px (def.spotOffset, kun Hunker).
## Utredninger 27.10 (ingen kode): forsvarsmodus (rettet mot refinery-v3 S5) + sjefer
- reviews/fiende-ai-forsvarsmodus-2026-10-27.md · reviews/fiende-ai-sjefer-2026-10-27.md (Alpha 1050 HP/60–90 s, Ashmaw 3200/armor 0/3,5–4,5 min, kasser+fase-refill). GODKJENT SOM PLAN 27.10 21:53, se toppen av notatet – ikke bygg før Alexander sier fra.)
