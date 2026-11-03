# Status – Lyd og musikk (Breach Lyd)
Oppdatert: 2026-11-03 14:40 – v1.13: stille oppstart, v3 tones inn; reserve bare ved feil eller tidsavbrudd

## Ferdig
- Lydsystem i game/src/audio (index, engine, sfx, synth, mech, stingers, cinder, music, radio, scene). Koblet via mods.audio.
- v1–v1.6: våpen, reload, granat, CINDER-fiender og -radio, menymusikk, volum-API, _meter. Detaljer: reviews/lyd-2026-10-23.md.
- v1.7: voice.js med stemmer i alle 7 cutscener (46 replikker, Kokoro-82M «Stemme A», forteller inkludert).
  - setVoiceVolume og voice i getVolumes; radiostøyen dukkes under tale.
- v1.7: yard-music.js er spillmusikk i brett 1 (arenaLoaded 'yard'), music.js i andre brett. Sidechain på shot, explosion, waveStart og spawnWarn.
- Verifisert v1.7: smoke.cjs, lang.mjs og run.mjs grønne, 0 konsollfeil, topp −2,5 dBFS. Musikk 13,5 dB under skuddtopper.
- v1.8/v1.9: regi per replikk i tools/voice/direction.json, myket opp i v1.9. Sluttreplikken er «Coming home», og fallen er ≤ 2,2 s. Alt grønt, 0 timing-brudd. Se reviews/stemme-regi-2026-10-27/.
- v1.10: Warden «Grus» (onyx/fenrir/michael, ×0,88, drive +6) på alle 13 linjene, dur ≈ v1.9. Se reviews/stemme-regi-2026-10-27/warden-grus.md.
- v1.11: Storys nye manus. 30 nye opptak og 5 gjenbrukt, sekvensene −11 %, 0 brudd. Se reviews/stemme-manus-2026-10-27/liste.md.
- v1.12: techno-music.js med v3-musikk (Yard 128 BPM, 150 s, og Deepwell 132 BPM, 160 s; brett 3 bruker Deepwell). Den spiller 3 synkrone lag og bytter nivå på taktgrensen ut fra en kamp-score. Gammel musikk er reserve, og ?music=old slår v3 av. Tester grønne, 0 konsollfeil. Se reviews/musikk-v3-innkobling-2026-11-03.md.
- v1.13: Ingen gammel musikk ved oppstart. v3 tones inn på 0,8 s når den er dekodet (0,5–1,3 s i test). Reserve-musikk bare ved feil eller etter 9 s. Nivå målt i spill: Deepwell v3 = Yard v3, så gainDb står på 0.

## Pågår (ingenting – venter på lyttetest)

## Neste
- Lyttetest av v3 i spill: nivåterskler, og om brett 2 skal ligge på gammel music.js-nivå (+4,5 dB i gainDb). Eget spor for brett 3.
- Spilt kamp-test av bulletImpact. Dykk ved levelStart brett 2 (−66 dB ~0,3 s).
- Ashmaw-lyder mot docs/BOSS.md (bossPhase, weakPointHit, bossStagger, coverBreak).
- grenadeBounce `surface` når Våpen sender det.

## Blokkert av
- Forslag til Breach: fallen-varighet og autoAdvance mot stemmelengde, stemmeslider i settings, kreditering av Kokoro.
- Ashmaw/BOSS.md: etter demoen. upgradeOffer fra Story (lytter finnes).

## Siste skjermbilde
- reviews/musikk-v3-innkobling-2026-11-03/brett2-musikk.png (brett 2 med v3-musikk)
