# Status: Test og spillfølelse
Oppdatert: 2026-10-27 15:21 (Europe/Oslo)

## Siste oppgave: Yard v2 QA og samlet demo-gjennomspilling
- **Dom: JA til demo.** Ingen blokkerende feil, 0 konsollfeil, nådde yard-clear og brett 2.
- **Kode testet:** kjøring startet 14:49:51. Nyeste src var 14:48:26. Munningsfiks (weapon.js/states.js) 14:47:46, Hunker v3b 14:42.
- **Rapporter:** reviews/qa-2026-10-27-yard-v2.md og reviews/ytelse-2026-10-27-yard-v2.md.
- **Klipp:** shots/test/qa/yard-v2/klipp-demo-1-5.mp4, klipp-pir-vann.mp4, klipp-vann-dekning.mp4, pluss tilhørende ark-*.png.

## Åpne funn
- N–S-barrierer v4 ser for høye ut (Effekter).
- Svart bånd under piren (Arena).
- Hunker er ikke med i brett 1, så munning og cover er ikke testet i demoen (Breach/Fiende-AI).
- Silhuettregelen er ikke bevist (Test).
- JS-heap +9 MB fra 1-3 mot referansen.

## Testfiler endret i denne runden
- tests/spill-brett1.mjs: 96-flokk, skudd per fiende, --video, minne-sampler.
- Nye: tests/yard-v2-vann.mjs, tests/yard-v2-probe.mjs, tests/yard-v2-vann-bev.mjs, tests/hunker-munning.mjs.

## 16:41 Cover-lekk (Breach-oppdrag)
- Rapport: reviews/test-2026-10-27-cover-lekk.md. Bilder: shots/test/qa/cover-lekk/kart-*.png
- 0.1-rullen virker. (b)-lekk: skrå vinkler (60–80°) gir 100 % treff fordi 59 px måles langs linjen.
- Andre kilder: popUp/lean 0.6 (1.8 s eksponert i snitt), granater ignorerer lavt cover (~16 % av skaden). Fiks er foreslått (Core/Warden), ikke implementert.

## 17:33 Samlet kontroll snapshot 16:50
- Rapport: reviews/qa-2026-10-27-samlet-1650.md. Totalt NEI (betinget). Grunn: bot klarer ikke 1-5 (33 dødsfall), og kasser/mur er ikke visuelt verifisert.
- JA: Hunker ikke i brett 1, dukket 0.107, CONTROLS, stemme/hopp, CHAPTER 02 nådd, 0 feil, DPR1 60 fps.
