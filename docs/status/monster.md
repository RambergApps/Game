# Status – Monsterdesign
Oppdatert 2026-10-27

## Ferdig
- Sjefsutkast v2.2: ny bygg av begge (Alpha firbent stegosaur-preg, snute m/underbitt, store piggplater, kjerne i ryggen, ingen skorsteiner; Ashmaw stigende ujevn masse, tunge klørlemmer, åpen kjeft m/tannrekker, slagg). Silhuett-test sjefer-v2.2-silhuett.png. v2.1 bevart som *-v2.1-*. Ikke i spillet.
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
- Sjefsutkast v2.3 STOPPET 22:27 (Breach/Alexander: v2.2 gjelder som plan). Kode lagt til side i tools-fiende-design/sjef-utkast/sjefer-v2.3-wip.js; ingen v2.3-bilder laget. Gjeldende: reviews/img/cinderborn/*-v2-* = *-v2.2-*.

## Neste
- Venter på vurdering av v2.2 (skala Alpha 1,6 / r≈42, Ashmaw 2,4 / r≈75).

## Blokkert av
- Ingenting. FYI: Fiende-AI bruker HUNKER_MUZZLE.side 12,1 (verifisert, reviews/img/fiende-ai/2026-10-27-hunker-muzzle-side.png).

## Siste skjermbilde
- 28.10 00:16: Samleark alle fiender levert til Breach: reviews/img/fiender-oversikt.png (bosser = utklipp v2.2).
- reviews/img/cinderborn/sjefer-v2.2-silhuett.png, *-v2-ark.png (internt)
