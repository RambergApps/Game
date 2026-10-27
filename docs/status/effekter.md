**Står stille – brett 2 på vent til Alexander har spilt demoen**
- 14:4x Brett 2 (Deepwell Refinery) førsteutkast levert, IKKE koblet inn: src/effects/refinery.js + refinery-test.html. Bilder: reviews/img/raffineri-ark.png, raffineri-test-warden.png. Cover 0,45 ms/bilde (7 stk), fakkelliv 0,015 ms. Svakheter: arket overlapper, fundamenter for lyse, ikke iterert (stoppet).
# Effekter – status 27.10 (v4)
- Barrierer: én seksjon per ca. 2 felt, smal topp, skrå fot, kald betong og ingen lyse kanter foran.
- Kasser: mørkt tre og paller.
- Målt geometri ved zoom 2: front 39 px (forventet 39,3) og topp 37 px (forventet 36,7).
Gulv og lys (src/effects/ground.js, med floor.js som alias). Arena kaller den allerede med fallback.
- Bake ved innlasting: gulvet tar 0,3 ms og lysene 4,4 ms. Per frame: 0 ms ekstra, bare drawImage på 0,08 ms.
Bilder (reviews/img):
- lavt-cover-55-spill.png: zoom 2.3 i spillet
- lavt-cover-55-oversikt.png: zoom 1
- lavt-cover-55-sammenlign.png: målbildet, zoom 2.3 og oversikten, 4782×940
Dokumenter:
- reviews/diffs/arena-floor-hook.diff (allerede innført hos Arena)
- arena-gulv-lys-forslag.md
- arena-render-lowcover.diff
Gjenstår og avvik:
- Målbildet har varmere og rikere lys samt containervegger.
- Vårt gulv er mørkere og mer nøytralt. Sekkene er litt mindre.
- I testkopien ble mørk-varianten overflødig, fordi vårt gulv nå er mørkt.
v4 (13:2x):
- Lyset er gyllent natriumgult, radius r·0,78 (ca. +40 %), med lys kjerne og myk avtoning. Pyttene nær lampene har varm refleks.
- Gulvet er skifergrå asfalt (#2a2e33) med mer tekstur. De gule linjene har alpha 0,85.
- Barrierene har lysere øvre kant og lysere skrå fot. Sekkene er 10 % større.
- Kostnad: gulv- og lysbakingen tar under 0,5 ms ved innlasting. Per frame koster det bare drawImage, 0,09 ms.
- Gjenstår: lyset er fortsatt svakere og mindre gyllent enn i målbildet, fordi Arenas lightmap demper. Pytterefleksen er svak. Containervegger mangler.
Lyskart + tunnel (13:3x):
Lys 13:4x: kjerne 255,135,50, i·1,35 (maks 1,5), kaldere ytre stopp. Mål/vår: asfalt 25,22,21/25,22,22 · kant 72,55,43/96,74,54 · kjerne 162,110,66/140,111,83. Videre iterering stoppet.
Kanter 13:5x: drawEdge i ground.js (quay/water/platform). Kantstein, varselstripe, flate pullerter, kaivegg under gulvnivå. Arena har kroken; ingen dybdesortering. Bilder: kant-kai-warden.png, kant-ark.png.
