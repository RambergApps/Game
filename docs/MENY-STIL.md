# MENY-STIL – hovedmeny i Cinder-stil

Eier: Nivåer og story (stil). Arena bygger menysiden og kopierer selv filene til `game/assets/menu/`. All tekst i spillet er på engelsk.

## Filer (alle i reviews/img/)
| Fil | Innhold | Størrelse |
|---|---|---|
| `meny-bakgrunn.png` | Malt bakgrunn: Deepwell-tårnet, glødende sprekker, aske og Warden med cyan visir nede til høyre. Rolig, mørkt negativt rom i venstre 45 %. | 1920×1080, ca. 1,8 MB |
| `meny-bakgrunn.webp` | Samme bilde, optimalisert (q82). | 1920×1080, ca. 120 kB |
| `meny-bakgrunn-base.png` | Bakgrunn med dempet glød, brukes **sammen med** glo-laget. | 1920×1080 |
| `meny-glow.png` | Glo-lag med gjennomsiktig bakgrunn, myk kant. Bare sprekkene, oransje røyk og tårnlysene. | 1920×1080 RGBA |
| `meny-mockup.png` | Mockup med logo, undertittel, fire knapper og hint nederst. | 1920×1080 |

**Bruk av glo-laget:** tegn `meny-bakgrunn-base.png` og legg `meny-glow.png` over med **additiv blanding** (canvas `globalCompositeOperation = 'lighter'`, CSS `mix-blend-mode: plus-lighter`, WebGL `ONE, ONE`).
- Matematikken: base = original × (1 − 0,7·m), glo = original med alfa 0,7·m. Base + glo × 1,0 gir originalbildet igjen.
- **Puls:** la glo-lagets opasitet gå mellom ca. 0,55 og 1,0 med en sinus på 2,4–3 s (eventuelt litt støy). Over 1,0 blir det overeksponert, og det kan brukes et øyeblikk når man trykker PLAY.
- **Ikke** legg glo-laget over `meny-bakgrunn.png`, for da dobbelteksponeres gløden.
- Gløden starter først ved ca. y = 640 px, så den ligger under logoen og knappene. Tårnlysene øverst til høyre er også med.

**Mykt lesefelt:** en lineær gradient fra venstre, `rgba(8,8,10,.45)` ved 0 % til transparent ved 55 %, gjør knappene lesbare (mockupen gjør dette). En mørk stripe nederst (0 → `rgba(8,8,10,.8)`, 140 px) gir plass til hint-teksten over de lyse sprekkene.

**Sikker sone:** logo og knapper ligger fra x = 150 til ca. 700 px, y = 250–960 px (1920-skala). Warden står ved x ≈ 1500, y ≈ 740–940. Ikke dekk ham.

## Fargepalett
| Rolle | Hex | Bruk |
|---|---|---|
| Bakgrunn dyp | `#0b0b0d` | sidebakgrunn, letterbox, overlays |
| Bakgrunn panel | `#16171a` | paneler og dialoger (settings) |
| Aske mørk | `#29292a` | himmelen i bildet, flater og skillelinjer på `#16171a` |
| Aske lys | `#5b5753` | rammer, tynne linjer, ikon-strek |
| Røyk/glo dempet | `#563b2f` | bakgrunn på aktive flater, varm skygge |
| Glo dyp | `#8a2c0a` | knappekant ved trykk, mørk rand på glo |
| **Glo oransje (primær aksent)** | `#ff7a1a` | valgt knapp, markør, undertittel-strek |
| Glo middels | `#ed8645` | hover-tekstglød, fremdriftslinjer |
| Glo kjerne | `#ffea9c` | bare de varmeste punktene: sprekk i logo, klikk-blink |
| **Cyan aksent (Warden)** | `#39c6ff` | sparsomt: bare spiller/Warden-relatert, f.eks. tastetrykk-ikon og «CONTINUE»-prikken. Aldri som hovedfarge for knapper. |
| Tekst primær | `#e6e1d6` | knappetekst, brødtekst |
| Tekst sekundær | `#9a958d` | undertekst, versjon, hint |
| Tekst hover/valgt | `#fff0e1` | tekst på valgt knapp |
| Hover-flate | `rgba(255,122,26,0.15)` | skrå flate bak valgt knapp |
| Deaktivert tekst | `#5c5954` | utilgjengelige knapper (f.eks. LEVEL SELECT før første nivå), ingen glød og ingen hover |
| Fare/feil | `#c0392b` | samme rødfarge som Husk, sjelden |

Regel: **varm = verden og meny, kald cyan = Warden.** Cyan skal bare finnes i ett eller to små punkter på skjermen.

## Typografi (bare gratis OFL-fonter)
- **Logo «BREACH»:** Barlow Condensed **ExtraBold (800)**, eventuelt Black (900), versaler.
  - Sperring +0,05 em (14 px ved 250 px). Størrelse ca. 250 px ved 1920 bredde (13 % av høyden).
  - OFL, Google Fonts. Samme familie som `src/story/fonts`, så det blir få filer.
  - Alternativer med samme kantete, industrielle preg: **Big Shoulders Display** Black (smalere, mer stencil-/havnepreg), **Teko** Bold, **Oswald** Bold, **Saira Extra Condensed** Black. Alle er OFL.
- **Undertittel «OPERATION CINDER»:** Barlow Condensed SemiBold (600), 38 px, sperring +0,24 em (9 px), farge `#c8c4bc`. Foran står en oransje strek på 56×3 px i `#ff7a1a`.
  - Alternativ undertittel: «CHAPTER 01 · KESSA YARD» hvis menyen skal vise fremdrift.
- **Menyknapper:** Barlow Condensed SemiBold (600), 46 px, versaler, sperring +0,1 em (5 px), linjeavstand 78 px.
- **Hint/versjon:** Barlow Condensed Medium (500), 24 px, sperring +0,12 em, farge `#9a958d`.
- **Filer:** `src/story/fonts` har i dag Regular og SemiBold. ExtraBold og Medium må legges til fra Google Fonts (Barlow Condensed, OFL, samme `OFL.txt`).

## Logo-behandling (skrapet metall med glo-kant)
1. **Fyll:** vertikal gradient i stål, fra `#c4c0b8` øverst til `#4a4846` nederst, med horisontal børstet støy (lav opasitet, 6–10 %) og noen få tynne, mørke riper. Ikke fyll med hvitt, og ikke bruk kornete granittstøy.
2. **Skygge:** mørk skygge (6, 8) px, uskarphet 6 px, `rgba(0,0,0,.8)`.
3. **Glo-kant:** ytre glød i `#ff7a1a`, uskarphet 18 px, opasitet 0,55. Den kan pulsere i takt med glo-laget (samme sinus, men lavere amplitude, 0,4–0,6).
4. **Sprekk:** én hårfin, takkete sprekk gjennom «E» (brukes i mockupen). Midten er i `#ffea9c`, kanten i `#ffaa46`. Den kan blusse kort opp når PLAY trykkes. Hold det til én sprekk, ikke flere.
5. **Valgfritt:** litt riss eller avskalling på høyre kant av «H».
6. **Laget som:** en egen PNG eller SVG fra Arena. Mockupen viser retningen, men logoen er ikke ferdig grafisk arbeid.

Fargen skal være dempet stål, ikke krom. Ingen blått i logoen.

## Knappestil
Knapper: **PLAY**, **LEVEL SELECT**, **SETTINGS**, **CREDITS** (vertikal liste, venstrejustert under undertittelen).
- **Normal:** bare tekst `#e6e1d6`, ingen boks. Under hver knapp står en tynn skillelinje, 1 px, `#3c3c3e`, 280 px bred.
- **Hover / valgt med tastatur eller gamepad:**
  - skrå flate bak (parallellogram, høyre kant skrått inn 20 px) i `rgba(255,122,26,.15)`
  - en loddrett stolpe på 5 px i `#ff7a1a` til venstre
  - teksten blir `#fff0e1` og flyttes 8 px mot høyre (120 ms ease-out)
  - en liten `›` i `#ff7a1a` helt til høyre
  - valgfritt: et kort glødblink i stolpen
- **Trykk (active):** flaten blir `rgba(255,122,26,.28)`, stolpen blir `#ffea9c` i 80 ms, teksten flyttes 2 px ned. Lyd: metallisk klikk.
- **Deaktivert:** teksten blir `#5c5954`, uten hover og uten stolpe, og står i en hint-linje til høyre i `#5c5954`: «LOCKED».
- **Fokusring (tilgjengelighet):** stolpen og flaten er fokusindikatoren. Ikke bruk standard nettleser-outline.
- **Rekkefølge og tastatur:** opp/ned og W/S flytter, Enter/Space velger, Esc går tilbake. Musepekeren skal også flytte valget. PLAY er forvalgt.

Hint-linje nederst til høyre: «ENTER SELECT · ESC BACK» i 24 px Medium. Den eneste cyan-detaljen er en liten firkant på 12 px foran. Nederst til venstre står versjonen («v0.9 · CINDER»).

## Bevegelse (forslag)
- Glo-laget pulserer som beskrevet over.
- Aske: et partikkellag med 80–150 små grå flak (1–3 px, `#9a958d`, opasitet 0,3–0,7) som faller sakte og driver litt mot høyre. Noen få oransje gnister (`#ff7a1a`) stiger fra sprekkene i nedre høyre kvadrant.
- Inngang: svart → bakgrunn over 1,2 s, så logoen (opasitet og 4 px glidning), så knappene forskjøvet med 60 ms.
- Langsom «parallax»: bakgrunnen flytter seg maks 8 px med musen. Glo-laget må følge nøyaktig med.

## Kjente svakheter i bakgrunnen
- Generatoren lager 1280×720, så bildet er oppskalert til 1920×1080 med Lanczos og mild uskarp maske. Det er greit på full skjerm, men litt mykt i detaljene ved tårnet.
- Warden er liten. Visiret er cyan, men bare noen få piksler. Rustningen er nesten svart, ikke grå `#3a3f45`.
- Tårnet ligner et vanlig oljeboretårn. Deepwell er en geotermisk brønn, men det leses greit.
- Varianter som ble vurdert:
  - **A:** stor Warden. Forkastet fordi venstre halvdel ble helt flat svart og så uferdig ut.
  - **B:** valgt, fordi den har det beste negative rommet og sprekkene egner seg til glo-lag.
  - **C:** nesten identisk med B.
