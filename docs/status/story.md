# Status – Story og brett (oppdatert 2026-10-27 18:58)
Eier: game/src/levels/ og game/src/story/. Historie: CINDER (låst). All spilltekst på engelsk.

## Ferdig
- Brett 1 (Kessa Yard, 5 bølger), restartWave, død→kontroll < 4 s, kort 3-velg-1, tastefiks (keyup/mouseup + input.reset()). Hunker ikke i brett 1.
- 2026-10-27 18:49 Manus for stemme (godkjent av Alexander) bygget inn i cutscenes.js: 35 replikker / 26 talerbytter (før 44/36). Siste replikk «All of us. Coming home.». fallen urørt (maxDuration 2,3, fadeOut 0,25).
- Nytt panel ending-03b (img/story/ending-03b.webp, ekte bilde) i PAINTED_PANELS, cam [1.0,.5,.58]→[1.15,.5,.42] 7 s. Fallback: placeholder ending-03.webp hvis eget bilde mangler. 25 malte paneler.
- Tekstvakt i player.js: manifestoppføring brukes bare når text matcher linjen; sekvens med utdatert manifest spilles uten stemme (cutsceneLine id «<sekvens>~stale-voice») i stedet for feil stemme. Ingen endring i audio/*.
- src/story/img/intro.json synket med nye linjer.
- Nøkkelliste til Lyd: reviews/story-manus-lyd-noekler-2026-10-27.md (35 nøkler, 24 nye, 11 gjenbruk).
- check-voice-timing v3 (tekstavvik): 0 brudd, 24 tekstavvik, 2 uten manifest (forventet til Lyd leverer). reg-smoke OK, run.mjs OK.

- 2026-10-27 18:58 nytt manus (Lyd): klipp med lyd /workspace/intro-voice-clip-v3.mp4 (33,5 s) og /workspace/ending-voice-clip.mp4 (38,2 s), ending-03b med ekte bilde. Alle linjer spilt (voice.js missing 0), 0 stale, 0 kutt, 0 konsollfeil. Verktøy: reviews/story-tools/clip-voice.cjs <id> <ut> [port].

## Pågår
- Ingenting.

## Neste
- Når Lyd leverer nye stemmer: kjør check-voice-timing og mål varigheter mot estimatet (~199 s totalt).
- Refinery v2 (Hunker 2-3..2-6) – VENT til Alexander sier ja. Åpent: min. cover-hopp 2,2 ruter i yard v2.

## Blokkert av
- Lyd (nye stemmefiler; til da er de 6 sekvensene uten stemme). Alexander (brett 2).

## Siste skjermbilde
- reviews/shots/ending-03b.png (ekte bilde, «Yeah. I’m coming up.»)
