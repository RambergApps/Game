# Status: Breach Fiende-AI (fiendeoppførsel, boss, lagring)
Oppdatert: 2026-10-28 ca. 14:15. Eier: src/enemies (unntatt look/, som eies av Monsterdesign).

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

## Hunker bygget 27.10: behaviors/hunker.js + stats.js; test tools/hunker-test.mjs ✓, 0 konsollfeil.
## 28.10 ~10:40 S5 Ringborgen (ekte layout): breach-brett2/reviews/fiende-ai-s5-ringborgen-2026-10-28.md – punkter låst uten avvik, 28.10-fiks portet til brett2/enemies; 0–2 «fastlåste» hunkers i hunt bak dekke (trolig OK), skade 239–406.
## 28.10 ~09:15 spredning/fastlåst Kessa Yard (unntak fra stand-still): reviews/fiende-ai-spredning-fastlast-2026-10-28.md
- Årsak: blockedCheck kjørte bare uten sikt. Fiks hunt/cover/ai (blokkert spot 10 s, sikt-gren, allierte-spot-straff). 1-5 fastlåste 5 (gml)/1 (ny layout) → 0 (6 seeds), skade tatt uendret.
## Utredninger 27.10 (ingen kode): forsvarsmodus (rettet mot refinery-v3 S5) + sjefer
- reviews/fiende-ai-forsvarsmodus-2026-10-27.md · reviews/fiende-ai-sjefer-2026-10-27.md (Alpha 1050 HP/60–90 s, Ashmaw 3200/armor 0/3,5–4,5 min, kasser+fase-refill). GODKJENT SOM PLAN 27.10 21:53, se toppen av notatet – ikke bygg før Alexander sier fra.)
## 28.10 10:15– forsvarsmodus S5 (klarsignal Alexander 10:13): breach-brett2/src/enemies/defense.js (ny) + 6 hooks i index.js; config som diff til Story (reviews/diffs/fiende-ai-defense-S5.diff). Av uten bølge-config. Bygget og testet (se resultater), se breach-brett2/reviews/fiende-ai-forsvarsmodus-opplegg-2026-10-28.md.
- 28.10 12:21 forsvarsmodus runde 2: ammo-målinger (ingen halv-skade-effekt, intet forslag), brett 1 identisk m/u hooks, N/S-fiks + sonevakt i defense.js, flanketest OK. Se reviews/fiende-ai-forsvarsmodus-opplegg-2026-10-28.md.
- 28.10 12:45 bekreftende S5: stuck 0/0 i alle kjøringer med modus etter N/S-fiks; defense.js gjort generell (akse x/y, ingen S5-koordinater i kode). S5-ankrene er midlertidige og venter på at Alexander godkjenner «Muren».
- 28.10 13:00 determinisme: ikke Storys 11:24-endringer (kopi fra før 11:24 varierer også). Kilder: weapons/decals.js:26 (kulehull trekker world.rng avhengig av arena-bake/tid) og shared/rig/rig.js:257 (rekyl-jitter med Math.random → munning → falloff-skade). Med begge stubbet: 6/6 like hasher i S5-probe, brett 1 (1-4/1-5, seed 1–3) likt 2× og med/uten hooks. Forslag: reviews/diffs/fiende-ai-determinisme-{decals,rig}.diff. Ikke i enemies/ eller riggen.
## 28.10 ~14:15 S5 Muren v2B ferdig – brett 2 avsluttet for Fiende-AI
- Notat: breach-brett2/reviews/fiende-ai-s5-muren-2026-10-28.md. Diff: reviews/diffs/fiende-ai-defense-S5-muren.diff (Story la den inn 13:26). axis 'y', dir −1; ankre W/M/E ved porten; retrett nordover til y 16,5–20.
- defense.js: pila følger dir. Ny fiks: «forbi linjen» krever nå at spilleren er innenfor ringens bredde på tvers av aksen. Gammel S5 axis-x er uendret innenfor ringen (samme hash).
- 20 riggkjøringer (storm/forsiktig × på/av × seed 1–5): 0 fastlåste med gammel og ny telling, 0 feil, andel ved anker 0,86–0,87 med modus mot 0,26–0,28 uten, 87–96 % i HOLD-sonen etter retrett. 1 timeout (storm s4).
- Restpunkter, skal ikke bygges: tårnskyttere, Kiln Alpha. RNG-fiks fortsatt bare som diff.
