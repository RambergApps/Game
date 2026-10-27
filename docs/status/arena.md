# Status – Breach Arena (arena, meny, ytelse)
Oppdatert: 2026-10-27 13:45 (UTC+1) – trinn B (Kessa Yard v2) levert, pluss zoom 2,25, lead-tak og DPR.
## Ferdig
- Tidligere: meny, tre arenaer, view 34, depth.js, dekaler (decals.js), perf, klemfelle-/spawnpassasjer, ?yard=lavt.
- 27.10 13:10 Trinn A: 55° (projection.js), følgekamera, window.BREACH.PROJ.
- 27.10 13:40 Zoom 2,25 (legacy 1,5); lead 0,30 med radielt tak 160 verdens-px; DPR = min(devicePixelRatio, 2) i main.js (all JS ser CSS-px, ?dpr=1 slår av).
- 27.10 13:45 Kessa Yard v2 = standard (src/arena/yard-v2.js), ?yard=v1 = gammel. Ingen ekstraksjon; nordporten er vanlig fiendeinngang.
  - vann: type 'water' i world.cover (stopper gange og nav, ikke kuler/sikt), tegnet med kaikant etter lyskartet. Plattform/rampe/trapp bare visuelt. Ledge = lav, 0,625 rute dyp (Hunker).
  - Lav dekning plassert på nytt (30 stk, 47 % liggende, L-former), ≥ 1 rute fra vann/vegg/bygg/container: _tools/cover-check.cjs (v2 0 brudd).
  - Kroker: effects/cover.js drawLowCover/warmCoverSprites; effects/ground.js bakeYardFloor, drawLightPools, lightStyle, lightmapPool, ambient, vignette – alle med fallback.
  - levels/data.js nivå 1: spawnPoints etter Storys forslag (+ south, pier). Kamera: padBottom 110 skjerm-px.
## Pågår
- Ingenting halvferdig. Venter på Storys nye dekningsdata (bruker egne til da).
## Neste
- Ta inn Storys oppdaterte yard-v2-data når de kommer; kjøre cover-check på nytt.
- Skarpere offscreen-lag ved dpr 2 (spritene er i CSS-oppløsning).
## Merknader
- player/cover.js og enemies/cover.js lager dekningslinjer/-punkter av all world.cover, også 'water' (bør filtreres av Spiller/Fiende-AI).
- v1 har 4 brudd i cover-check (ikke rettet, legacy).
- 14:06 (UTC+1): Storys data 14:00 inne uendret (36 cover, N–S maks 2 ruter, ledge 0,625, østbarriere flyttet, entry dir N). Alle sjekker grønne: cover/ENTRY 0 brudd, r18+Kiln r22 når alt, dytt 0/8684, high-walk 0, DPR 1/2 OK, run.mjs OK 10/10.
- 14:20 (UTC+1): trappeåpning i plattformens sørkant (index.js stairGap, x 36,75–38,75; tegning brutt), r18/Kiln/cover-check grønne. depth.js: dukket fiende = ingen silhuett bak lav dekning. Banner ligger i levels/hud.js:71 (ikke endret). Bilder: trapp-aapning, startsted, pir-follow, dukket-fiende.
- 14:21 (UTC+1): v2 padBottom 240 (andre brett 110) – pirspiss skjerm-y 459 < HUD 490. Banner hud.js:71 H*0.12, index.js:121 dur 2.0 (godkjent). run.mjs OK 10/10 (13-15-08). dukket-fiende.jpg: fienden skyter i bildet, ikke dukket – åpent.
- 15:58 (UTC+1) demo-runde: startflash rettet (index.html #boot-black til menyen, menu #bm-black til cutscene opacity 1) – 0 arena-frames fra første lasting til cutscene. Regen 4.5 s/18 hp/s (5→100 fylles på 5,4 s), all skade nullstiller, ?regenDelay/?regenRate, pulserende HP-bar. Story 14:35 sør-ledge inn, stairGap fjernet. Åpent hav sør for brettet (pir-båndet). NS-skyggediff inn + NS-barrierer kuttet til 0,75×1. cover-check/high-walk 0. Klipp: shots/arena/{startflash,regen,pir-baand}.mp4.
- 16:25 (UTC+1): CONTROLS-skjerm (ui/controlsScreen.js) fra hovedmeny + pausemeny, 1280×720/1024×640 uten klipping. Story P1–P3 sandsekker inn (yard-v2.js), cover-check/high-walk 0, r18/Kiln når alt inkl. rampe. Effekters silhuett-diff inn (depth.js) + kald omrissfarge i arena/index.js; lavt cover gir fortsatt 0 silhuetter. run.mjs OK 10/10 (15-13-42). Åpent: fienden kan fortsatt se ut som den står på taket – foreslår kontaktskygge/gap ved takkanten (ikke bygget).
- 17:05 (UTC+1): CONTROLS rettet (Cover først, to kolonner, ingen scrolling ved 1280/1024, chip-overlapp målt 0/23, «Enter Esc Back»). Effekters kantdiff (depth.js) inn. Ny _tools/spawn-check.cjs: 14 spawnpunkter mot høy dekning + 18 px – 0 brudd. run.mjs OK 10/10 (15-49-19).
- 17:30 (UTC+1): Effekters fragmentdiff inn (depth.js, høyt cover = alltid deep/opakt tak). Grunt+flanker ved (37,19), y 16,8/17,7/18,0/18,55: kropp over takkanten synes, ingen lyse fragmenter gjennom taket, lavt cover 0 silhuetter. Tidligere silhuettbilder var tatt med fiende midt i oppstigning (rise) – «fragmentet» var spriten under oppstigning. run.mjs OK 10/10 (16-19-29).
