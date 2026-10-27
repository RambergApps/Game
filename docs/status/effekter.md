Står stille – silhuettkant v2 + sprekklekkasje verifisert, klar for Arena
Står stille – venter på Arena (NS-skygge) og nye oppdrag fra Breach.
- Støvtak: maks ca. 40 partikler, skala 1/(n+1) innen 0,3 s og 0,5 s nedkjøling per dekning. 6 samtidige gir 48 partikler (ikke 180).
- NS-barrierer v5 (cover.js paintNSBarrierV5): 2–3 lave jersey-blokker med 68 % bredde. Feilen med svart strek er rettet.
- Raffineri brett 2, v2: refinery.js og refinery-test.html. Ikke koblet inn; brett 2 venter på Alexander.
- Tidligere: lavt cover ved 55°, gulv og lys (ground.js), kai- og vannkanter, liv i scenen.

## Pågår
- Ingenting.

## Neste
- Ekte før/etter-bilde av NS-barrierer i spillet når Arena har lagt inn skyggediffen.
- Hvis de fortsatt ser ut som plater: Arena kutter dem til 1 rute i dataene, etter Breachs beslutning.

## Blokkert av
- Arena: reviews/diffs/arena-ns-skygge.diff mot arena/render.js drawShadows, kommer etter startglimt, livpåfyll og bånd.
- Brett 2: venter på at Alexander har spilt demoen.
- Tunnel: på vent.

## Siste bilder (reviews/img)
- warden-reiser-seg.mp4 og .png (zoom 2,25, sekker og mur, ekte hendelser)
- reise-stov-tak.png
- ns-barrierer-v5-skygge.png (forhåndsvisning)
- raffineri-ark-v2.png og raffineri-test-warden-v2.png
- 27.10 sent 2: paintNSBarrierV5 – stykker < ~1,4 rute (0,75×1) = én blokk (før: to klemte). Før/etter i spill: reviews/img/ns-barrierer-spill-for-etter.png (_tools/ns-spill.mjs).
- Silhuett bak høy dekning: tegnes i shared/depth.js (Arena) – drawCoverToned + drawSilhouettes. Forslag reviews/diffs/arena-silhuett.diff (ikke anvendt), bilde reviews/img/silhuett-for-etter.png.
- Silhuettkant: reviews/diffs/arena-silhuett-kant.diff (depth.js, ikke anvendt) + reviews/img/silhuett-kant-for-etter.png. Lekkasjen (b) var VFX-grus (spawnWarn/spawnRise) i over-laget – fikset i bind.js/index.js (hidden → under-lag).
- 27.10 sent 3: sprekk/oppbrudd bak container verifisert i spill (0 over-lag-partikler i takflaten) – reviews/img/sprekk-bak-container.png. Kant-diff utvidet: helt dekket kropp → ingen utskjæring, kaldt omriss 0,25.
- 27.10 17:xx Fragment over tak = fiendens egen kropp (flanker-pigger) gjennom 30–46 % uttoning i shared/depth.js drawCoverToned (ikke VFX: vfx/dekaler/overlays av → uendret). Forslag reviews/diffs/arena-silhuett-fragment.diff (eier Arena): høy dekning → alltid deep, takleppe beholdt. Før/etter reviews/img/silhuett-fragment-for-etter.png. Verktøy _tools/fragment.mjs.
