# Status – Story og brett (oppdatert 2026-10-27 17:19)
Eier: game/src/levels/ og game/src/story/. Historie: CINDER (låst). All spilltekst på engelsk.

## Ferdig
- Brett 1 (Kessa Yard, 5 bølger), restartWave, død→kontroll < 4 s, kort 3-velg-1, 24 malte paneler, tastefiks (keyup/mouseup + input.reset()). Hunker ikke i brett 1.
- Stemmer: player.js leser manifest-dur ved kjøring (ingen hardkodede varigheter). cutsceneLine + cutsceneText én gang per linje. Kokoro-kreditt.
- «All of us. Coming home.» i ending. fallen: maxDuration 2,3, uttoning 0,25 (urørt).
- 2026-10-27 17:19 timing v2 (Breach): hale 0,3→0,1 s, pust ≥0,2 s ved talerbytte, stemmestart speiler voice.js (max(0,16, delay)) – samtidig med typing, panelFade 0,45→0,35, swipe 0,55→0,45. Ingen kutt.
- check-voice-timing v2 (kjenner maxDuration): 0 brudd. Med/uten stemme: intro 36,6/16,3 (2,24×), yard-clear 25,9/12,8 (2,02×), refinery-clear 32,6/15,5 (2,10×), foundry-core 30,1/13,6 (2,21×), ashmaw-rise 37,1/16,8 (2,21×), ending 39,5/16,8 (2,35×).
- 1,6× IKKE nådd: summen av stemme-dur alene er > 1,6× tekstlengden (f.eks. intro 31 s stemme mot 16,3 s). Krever kortere opptak, overlapp eller kortere textDelay (må speiles i manifest.delay hos Lyd).
- fallen 2,53 s (time-fallen.cjs) → død→kontroll ≈ 3,5 s. Klipp: /workspace/intro-voice-clip-v2.mp4 (25 s, lyd mikset fra manifest). run.mjs OK, reg-smoke OK.

## Pågår
- Ingenting. Venter på Breach.

## Neste
- Refinery v2 (Hunker 2-3..2-6) – VENT til Alexander sier ja. Åpent: min. cover-hopp 2,2 ruter i yard v2.
- Ny Warden-stemme: kjør check-voice-timing på nytt.

## Blokkert av
- Alexander (brett 2), Fiende-AI (spawnBoss/BOSS.md).

## Siste skjermbilde
- /workspace/intro-voice-clip-v2.mp4
