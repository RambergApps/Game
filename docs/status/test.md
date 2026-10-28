# Status: Test og spillfølelse
Oppdatert: 2026-10-27 23:10 (Europe/Oslo)

## Åpne funn
- Pages 2e60923: JA. md5 = snap-2236, lasteskjerm→meny, intro m/klikk→spill, bølge 1-1 klarert, 0 feil/≥400/failed. reviews/test-2026-10-27-pages-2e60923.md
- Samlet-2229 (snap-2236): JA. Tap 1/trykk S-12/M-4, lasteskjerm→meny OK, intro/slutt uten blink, 0 feil. Intro/slutt venter på klikk – bekreft tilsiktet. reviews/qa-2026-10-27-samlet-2229.md
- N–S-barrierer v4 ser for høye ut (Effekter).
- Svart bånd under piren (Arena).
- Hunker er ikke med i brett 1, så munning og cover er ikke testet i demoen (Breach/Fiende-AI).
- Silhuettregelen er ikke bevist (Test).
- JS-heap +9 MB fra 1-3 mot referansen.

## 17:33 Samlet kontroll snapshot 16:50
- Rapport: reviews/qa-2026-10-27-samlet-1650.md. Totalt NEI (betinget). Grunn: bot klarer ikke 1-5 (33 dødsfall), og kasser/mur er ikke visuelt verifisert.
- JA: Hunker ikke i brett 1, dukket 0.107, CONTROLS, stemme/hopp, CHAPTER 02 nådd, 0 feil, DPR1 60 fps.
## 27.10 18:08 samlet-1735: NEI (mangler mur, credits-bilde, ytelse). 1-5 vinnes ikke uten assist, også gammel versjon. Se reviews/qa-2026-10-27-samlet-1735.md
## 27.10 18:20 samlet-1735 oppfølging: JA (mur, hagle, credits/Kokoro, 0 feil). Ytelse under last ikke målt (0 fiender, testfeil). Skade ×0,75: 7/8/8 dødsfall, 0/3 seire, Spitter-granater 127–143 skade (tidligere ulogget). Se reviews/test-2026-10-27-skade-075.md
## 27.10 18:23 samlet-1735 ytelse DPR1 på nytt: JA. 60 FPS, p99 16,8 ms, maks 16,8, heap 23,0/24,1/25,1 MB med 3/5/7 fiender, 0 feil. Oppfølging samlet: JA.
## 27.10 18:30 granat=0 (/tmp/snap-1735-nogren): 8/8/9 dødsfall, 0/3 seire, granatskade bekreftet 0. Tellekontroll: ingen dobbelttelling; skade-075 rettet (granat ikke større enn Kiln). Ytelse DPR1 JA (18:22). Se reviews/test-2026-10-27-granat-0.md
## 27.10 18:44 skjult-gul (snapshot 1735, før fiks): forfra delvis FEIL (#1–2 linje gjennom 24 px barrier, 17–20°), skrått 1 av 3 FEIL (hjørnelekk kasser), side og bakfra = feil side (skytter på Wardens side). Se reviews/test-2026-10-27-skjult-gul.md
- 19:02 fiks-1853: A(3.5s) 0/3 seire, 7–8 døde; B(4.5s) 1/3 seire (B-2: 3 døde). Skjult 143–339, omtrent som 1735. #1/#2/#4 blokkert (#2: 1 treff i live-test), kontrollene #5/#7 treffes. combat.js md5 uendret. reviews/test-2026-10-27-fiks-1853.md
- 19:06: Opplastingssjekk 1902 stoppet (Alexander: regenDelay 3,5, Breach laster opp). Neste: røyktest på Pages når URL kommer. Ingen balanserunder før Alexander velger spak (Husk/Lurcher).
- 19:18 Pages-røyktest e2ddb33: **JA**. Intro, bølge 1→2 og slutt med ending-03b (200). 0 konsollfeil, 0 svar ≥400, 37/37 .ogg gir 200, 60 FPS. reviews/test-2026-10-27-pages-1907.md
- 21:58 hakk-2103: hakking gjenskapt. Lasting 2,4 s frys (8,3 s ved CPU 4×, arena/render.js:applyLight). Sekvenser 59 FPS uten struping, 16–19 FPS ved 4× (spill 42). Årsak: story/player.js:frame (korn overlay + fullskjerm) og core/loop.js render() under sekvens. Ikke regresjon mot b804a6b. reviews/test-2026-10-27-hakk-2103.md
- 23:32: Referanseark brett 2 utgår (Story leverer). Ledig til Breach melder brett 2 klart for test.
- 23:34: Røyktest c7adc18 AVLYST (Alexander via Breach), stoppet. Kjører ingenting før ny beskjed fra Breach.
