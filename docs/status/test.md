# Status – Breach Test og spillfølelse
Oppdatert: 2026-10-27 14:05

## Nå
- Fiende-AI 55°: reviews/qa-2026-10-27-fiende-ai-55.md
  - JA for onscreen.js: 0 av 15 treff fra utenfor bildet.
  - A2 delvis: stillstand over 4 s finnes fortsatt i 1-2.
  - Cover mot åpen: 9 % mot 27 % fiendetreff, ingen flokking.
- Ytelsesreferanse: reviews/ytelse-2026-10-27-referanse.md
  - DPR 1: 60 FPS låst i 1-1 til 1-5 (55° og view=34).
  - DPR 2: 29–35 FPS, p99 opptil 67 ms.
  - Heap 21–30 MB.
- Vinkel 55°: reviews/qa-2026-10-27-vinkel-55.md – NEI (betinget).
  - Kamera og ytelse er gode.
  - Skudd fra fiender utenfor bildet: 3 av 3 treff på Warden i 1-1.
  - Bryst-treff ikke avgjort.
- Brysthøyden i testfilene er rettet til 27·PROJ.zScale.
- Warden C runde 2: JA for gange og strafe. Dødstid 2,0 s.
Filer: shots/test/qa/vinkel-55/, shots/test/qa/warden-c/runde2/.

## Neste
- Fiende-AI 55° i 1-3 til 1-5 (Lurcher, Spitter, Kiln), cover mot åpen
- Ny ytelsesmåling når yard-v2 er inne (tests/ytelse-ref.mjs)
- Ren bryst-test ved 55° (fiende i åpent terreng)
- Ny Kessa Yard
- Fiende-AIs passivitetsfiks
- Ny fiende Hunker
