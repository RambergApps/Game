# Status – Lyd og musikk (Breach Lyd)
Oppdatert: 2026-10-27 17:05 – v1.9 ferdig; Warden-variant venter på valg

## Ferdig
- Lydsystem i game/src/audio (index, engine, sfx, synth, mech, stingers, cinder, music, radio, scene). Koblet via mods.audio.
- v1–v1.6: våpen, reload, granat, CINDER-fiender og -radio, menymusikk, volum-API, _meter. Detaljer: reviews/lyd-2026-10-23.md.
- v1.7: voice.js med stemmer i alle 7 cutscener (46 replikker, Kokoro-82M «Stemme A», forteller inkludert).
  - Filer: game/assets/voice/<scene>/<panel>-<linje>.ogg + manifest.json (684 KB).
  - Generator: src/audio/tools/voice/gen.py + README (modellfilene ligger i /workspace/tts, ikke i repoet).
  - setVoiceVolume og voice i getVolumes; radiostøyen dukkes under tale.
- v1.7: yard-music.js er spillmusikk i brett 1 (arenaLoaded 'yard'), music.js i andre brett. Sidechain på shot, explosion, waveStart og spawnWarn.
- Verifisert v1.7: smoke.cjs, lang.mjs og run.mjs grønne, 0 konsollfeil, topp −2,5 dBFS. Musikk 13,5 dB under skuddtopper.
- Klipp: reviews/stemme-musikk-2026-10-27/demo-klipp.mp4 (+ .ogg). Utredning: reviews/stemme-2026-10-27.md.

- v1.8/v1.9: regi per replikk i tools/voice/direction.json, myket opp i v1.9. Sluttreplikken er «Coming home», og fallen er ≤ 2,2 s. Alt grønt, 0 timing-brudd. Se reviews/stemme-regi-2026-10-27/.

## Pågår
- Warden-stemme: 3 varianter i reviews/stemme-regi-2026-10-27/warden-varianter.mp3 venter på Alexanders valg. Musikknivåer er urørt.

## Neste
- Lyttetest (Test/Alexander): stemmer, rop og musikk i rolig vs kamp (nivået er nesten likt; mulig mindre skudd-duck).
- Spilt kamp-test av bulletImpact. Dykk ved levelStart brett 2 (−66 dB ~0,3 s).
- Ashmaw-lyder mot docs/BOSS.md (bossPhase, weakPointHit, bossStagger, coverBreak).
- grenadeBounce `surface` når Våpen sender det.

## Blokkert av
- Forslag til Breach: fallen-varighet og autoAdvance mot stemmelengde, stemmeslider i settings, kreditering av Kokoro.
- Ashmaw/BOSS.md: etter demoen. upgradeOffer fra Story (lytter finnes).

## Siste skjermbilde
- reviews/stemme-musikk-2026-10-27/skjerm-kamp.png (kamp i Kessa Yard med ny musikk, v1.7)
