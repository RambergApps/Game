# Warden C – status (Breach Warden-design/animasjon)
Oppdatert 2026-10-27 14:22.

## Ferdig
- Standard nå: TILT 55, følgekamera med zoom 2,25 (Breach). 0 sidefeil, 11/11 brysttreff.
- img/c5 = c4 + bakt kjølig kantlys (ca. 3 px, sterkest opp/venstre på overkropp, jevnt på bein) og lysere hjelm (+22 %) og skuldre (+16 %). Ingen ctx.filter/shadowBlur, null ekstra kostnad i kjøring.
- styles/paintedC.js laster c5. c4/c3 ligger igjen som tilbakefall.
- DPR-diff: player/forslag/core-main-dpr.diff (mot main.js før 13:28). Testet i kopi (/tmp/gdpr): DPR 1 og 2 gir 11/11. Bakbuffer 2560 ved CSS 1280, mus = CSS-px, resize 1000×600 → 2000. 0 feil.
- c4: rygg/sekk N/NW/NE i gunmetal, 55°-hjelmtopp (godkjent).
- main.js 13:40 (Breach-godkjent): DPR leses på nytt i resize(), og det lyttes på matchMedia(resolution). Maks 2 og ?dpr=1 er beholdt. Test: 1→1,5 + resize gir bakbuffer 1500, 3 gir 2560 (kappet), ?dpr=1 holder 1x. 11/11 ved DPR 1 og 2, 0 feil. Backup: /workspace/wt/main.js.bk-1337.
- 14:16: Fiende-AIs player-cover-vann.diff er gjennomgått og lagt inn (1 linje i player/cover.js; bare high/low gir dekningslinjer). tests/run.mjs: OK, 10/10. Headless yard v2: dekning mot vann 6 → 0 (av 16 punkter). Lav dekning uendret: 141/156 før og etter. Backup: /workspace/wt/cover.js.bk-1416.

## Pågår (filer)
- game/src/shared/rig/paintedC/img/c5/*, /workspace/wt/paint/contrast.py

## Neste
- 8×-kunst senere.

## Blokkert av
- Ingenting.

## Siste skjermbilde
- shots/warden-C-kontrast-for-etter.png (zoom 2,25, standardoppsett)
- Ytelse: 739 figurer på 230 ms ≈ 0,31 ms/figur. p50 9,4 ms per bilde (headless).
- Backup: /workspace/wt/bk-kontrast-1327
