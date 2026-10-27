# Effekter (VFX) – status 27.10 23:2x
warmupChunked levert; venter på Arena for innkobling.

## Ferdig
- sprites.warmupChunked: piksel-identisk (130 lerreter, avvik 0), lengste frame ≈12,6 ms. Note: reviews/diffs/vfx-sprites-warmup-chunked.md.
- Reisesignal for Warden (coverpose.js): ekte hendelser coverRise/coverDuck, randlinje, støv, kald glans, gnister kun når eksponert.
- Støvtak: maks ca. 40 partikler, skala 1/(n+1) innen 0,3 s og 0,5 s nedkjøling per dekning.
- NS-barrierer v5 (cover.js): lave jersey-blokker, stykker under ca. 1,4 rute blir én blokk. Arena har lagt inn skyggediffen.
- Silhuett bak høy dekning: diffene silhuett, kant og fragment er lagt inn av Arena (shared/depth.js). Breach har valgt stiplet omriss under helt opakt tak.
- Sprekk og oppbrudd bak container: 0 partikler i over-laget.
- Raffineri brett 2, v2 (refinery.js og refinery-test.html), ikke koblet inn.

## Pågår
- Brett 2-sprites (/workspace/breach-brett2). Frysearbeidet er stoppet (Alexander, via Breach 23:26). Arena setter ground.js tilbake til hakk2, og utkastet mitt forkastes. Jeg rører ikke ground.js før Arena sier fra.

## Neste (valgfritt, ikke hastende, fra Arena)
- (a) Omrisset bruker stående høyde og går over takkanten ved y 17,7–18,0 uten kropp. Eier: Arena (depth.js), forslag kun som diff.
- (b) Grunten er bredere enn containeren, så bena synes på vestsiden.

## Blokkert av
- (Brett 2 godkjent av Alexander 27.10 23:13; sprites pågår i /workspace/breach-brett2, egen status der.)
- Tunnel: på vent.

## Siste bilder (reviews/img)
- warmup-yard-foer.png / warmup-yard-etter.png (likt bortsett fra kamera)
- silhuett-fragment-for-etter.png, sprekk-bak-container.png, silhuett-kant-for-etter.png
- ns-barrierer-spill-for-etter.png, warden-reiser-seg.mp4 og .png, reise-stov-tak.png
- raffineri-ark-v2.png og raffineri-test-warden-v2.png
