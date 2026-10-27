# Status – Monsterdesign
Oppdatert 2026-10-27

## Ferdig
- Hunker v3b for demoen (tester 10/10 OK med kuppel-senking).
- Hunker v3b: rifle ~25° til høyre i peek/skudd, HUNKER_MUZZLE {fwd 23,3, z 27, side 12,1}. Dukket 0 px over. Tester 10/10.
- Hunker v3 = A + pigger fra B (standard). Dukket 0 px over cover. Bølge 1–5: 24,64 MiB, 0 utkastinger. Tester 10/10 OK.
- Oversiktsark alle fiender × 8 retninger (idle, tilt 55, zoom 2,25, 2×): 5 typer. Kiln Alpha og Ashmaw har ikke egne sprites.
- Hunker i ekte spill på yard-v2: skjult bak lavt cover (0 px over, margin 5,1 px ved 21 px fra kanten). Bilder + mp4.
- Tak 32 MiB (MEM_TOTAL_MB, fordelt per type). zoom.js leser PROJ.zoom. Spill 24,69 MiB, 0 utkastinger, D2.25|T55.0.
- Zoom 2,25: D2.25|T55.0 verifisert i ekte spill. Worst case 31,37 MiB (fra 37,36), spill 24,43. 404 ground.js borte.
- Arena-standard lest i ekte spill: zoom 2, tilt 55, bakezoom 2. LRU-tak × 1,78. Spill 22,62 MiB, worst case 29,47.
- Hunker v2: skala 1,2, kull/svart kropp, store plater med gule sømmer.
- Dukket Hunker skjult bak lavt cover ved 55: 0 px lekkasje, margin ≥ 1,3 px.
- Bakezoom = kamerazoom (zoom.js), testet 1,5 og 2. Angrep 8 retninger ved zoom ≥ 1,75.

## Pågår
- Ingenting.

## Neste
- Stå stille til Breach sier fra.

## Blokkert av
- Venter: Fiende-AI tar i bruk HUNKER_MUZZLE.side etter demoen.

## Siste skjermbilde
- shots/fiende-design/hunker-v3b-yard-v2-spill.png, hunker-v3b-kikk-skudd-S-SE-SW.png (internt)
