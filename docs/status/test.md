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

## 27.10 18:08 samlet-1735: NEI (mangler mur, credits-bilde, ytelse). 1-5 vinnes ikke uten assist, også gammel versjon. Se reviews/qa-2026-10-27-samlet-1735.md
## 27.10 18:20 samlet-1735 oppfølging: JA (mur, hagle, credits/Kokoro, 0 feil). Ytelse under last ikke målt (0 fiender, testfeil). Skade ×0,75: 7/8/8 dødsfall, 0/3 seire, Spitter-granater 127–143 skade (tidligere ulogget). Se reviews/test-2026-10-27-skade-075.md
## 27.10 18:23 samlet-1735 ytelse DPR1 på nytt: JA. 60 FPS, p99 16,8 ms, maks 16,8, heap 23,0/24,1/25,1 MB med 3/5/7 fiender, 0 feil. Oppfølging samlet: JA.
## 27.10 18:30 granat=0 (/tmp/snap-1735-nogren): 8/8/9 dødsfall, 0/3 seire, granatskade bekreftet 0. Tellekontroll: ingen dobbelttelling; skade-075 rettet (granat ikke større enn Kiln). Ytelse DPR1 JA (18:22). Se reviews/test-2026-10-27-granat-0.md
## 27.10 18:44 skjult-gul (snapshot 1735, før fiks): forfra delvis FEIL (#1–2 linje gjennom 24 px barrier, 17–20°), skrått 1 av 3 FEIL (hjørnelekk kasser), side og bakfra = feil side (skytter på Wardens side). Se reviews/test-2026-10-27-skjult-gul.md

- 19:02 fiks-1853: A(3.5s) 0/3 seire, 7–8 døde; B(4.5s) 1/3 seire (B-2: 3 døde). Skjult 143–339, omtrent som 1735. #1/#2/#4 blokkert (#2: 1 treff i live-test), kontrollene #5/#7 treffes. combat.js md5 uendret. reviews/test-2026-10-27-fiks-1853.md
