# WARDEN – designspesifikasjon (spillerfigur)

**Designark:** `reviews/img/warden-designark.png` (2400×2660)
**Kildemateriale:** `reviews/img/warden-kilde/` (malerier, utsnitt, render-sider, `compose.py` bygger arket på nytt)
**Eier:** Breach Karakter · **Brukes av:** Nivåer og story (cutscenes), Breach Fiende-design (samme rigg og stil), Test (lesbarhet)

> Dette dokumentet erstatter det gamle «tan/beige»-uttrykket fra runde 2. Linjen «Warden: lys sandfarge med cyan» i `FIENDE-DESIGN.md` beskriver det gamle utseendet. Det nye er **kald stålgrå rustning + cyan visir og sekkstripe + sandfarget skjerf + blå skulderplater**. Den røde visirvarianten (The Protocol) er droppet og skal ikke lages.

---

## 1. Referanser som er fulgt

| Referanse | Hva er hentet derfra |
|---|---|
| Konseptbrettene (Warden-ark og heltebilde i oppdragsvedleggene) | Silhuett, kuppelhjelm med omsluttende visir, rygg-sekk, skjerf, kort automatgevær, militær slitasje |
| `reviews/img/cinderborn-designark.png`, `reviews/img/cinderborn/*-trekvart.jpg`, `docs/FIENDE-DESIGN.md` | Penselstrøk, nøkkellys oppe fra venstre, verdinivå, malt slitasje. Cyan er reservert for Warden. Glød på eget additivt lag, ikke shadowBlur |
| `KARAKTER-SPEC.md` | Grunnpalett (rustning #3a3f45/#5a6068, tøy #8a7a5c, visir #39c6ff), mål (kropp Ø 28–32 px, 1 rute = 32 px) |
| `game/src/shared/projection.js` | PROJ: zScale 0.75 (≈ 37°), actor-høyde 48, huket 30 |
| `game/src/shared/light.js` | LIGHT_DIR ≈ (−0.54, −0.84), READABILITY.oblique (kontur og kantlys) |
| `game/src/shared/rig/styles/oblique.js` (kun lest) | `PAL`-nøklene som fargetabellen under er skrevet for |

**Bildegenerering:** Ja, med GenerateImage. Valgt hovedbilde: `warden-kilde/paintC.jpg` (knelende i dekning). Spillvinkel: `trekvartA.jpg` og `trekvartB.jpg`. Utstyr: `gear.jpg`, profil: `side.jpg`, rulling og død: `roll-death.jpg`. Vraket: `paintA.jpg` (mosaikkaktig, for flatt) og `paintB.jpg` (smal visirspalte som ikke matcher konseptet).

---

## 2. Design

### 2.1 Form og proporsjoner
- En tung dekningssoldat, men **ikke** en kloss. Han er bred over skuldrene, smalere i livet og har kraftige legger og støvler. Hodet er ca. 1/6,5 av høyden, og hjelmen gjør det litt større enn naturlig.
- Leserekkefølge ovenfra: **hjelmkuppel → sekk → geværlinje → skjerfhaler**. Hver av de fire må være en egen form i silhuetten.
- Spillmål: kroppen er Ø 28–32 px (1 rute = 32 px), actor-høyde 48, huket 30.

### 2.2 Hjelm og visir
- Hjelmen er en rund kuppel med en svak midtrygg og en øreplate på hver side. **Antennen sitter på venstre side.** Kuppelen er det lyseste partiet på figuren (#98a0a8 med topplys).
- Visiret er **et omsluttende bånd på ca. 120°**, ikke en spalte. Glasset er mørkt (#0b2a36). Kjernen er #39c6ff og det varmeste punktet er #b8f3ff, med bloom #39c6ff @ 35 %.
- Visiret er figurens sterkeste lyspunkt og det første øyet finner.

### 2.3 Rustning
- Plater i kald stålgrå over en nesten svart drakt (#1c2024). Det er kontrasten mellom plate og drakt som gir formen. Platene er brystplate, skulderplater, underarmer, lår og knær.
- **Begge skulderplatene er malt blå (#2f5f93) med dobbel nedoverpekende chevron (#e4e0d4).** Det er figurens eneste malte farge. Dermed synes blått fra alle retninger, også når visiret vender bort.
- Kanter og hjørner er slitt ned til blankt stål (#c3c9ce).

### 2.4 Sekk
- En firkantet sekk i grønngrå canvas (#5c5a48), med lokk, sidelommer og stropper. Den sitter høyt på ryggen og stikker litt over skulderlinjen sett bakfra.
- **En cyan lysstripe og LED på sekken (#39c6ff)** gjør at Warden har en lysende cyan markør også bakfra og ovenfra. Se regel 4.6.

### 2.5 Skjerf
- Sandfarget skjerf/kappe (#a8814f, skygge #6e5232, høylys #d8b67e). Det ligger som en krage rundt nakken med to haler som henger over skulder og rygg.
- Skjerfet er figurens **eneste varme tøy** og bindeleddet til ørkenstøvet i miljøet. Det må aldri bli større enn en aksent.

### 2.6 Gevær (AR-9 Vanguard, kort)
- Et kompakt automatgevær i mørk gunmetal (#2b3036, kanter #59626c) med en kort blå stripe (#3c86c8). Det har rødpunktsikte, kort pipe og magasin.
- I spillet er geværet ca. 30 px langt (en knapp rute), og det skal stikke tydelig ut av silhuetten i siktretningen.

### 2.7 Slitasje og malestil
- Samme malestil som Cinderborn: grove, synlige penselstrøk, mykt fall fra lys til skygge og lite rene linjer.
- Slitasjen består av avflisede kanter (blankt stål), gjørme og rust på knær og støvler (#4a3b2c / #6b4a32) og sot (#23201d) nederst. **Slitasjen sitter på kanter og nederst, aldri som jevn støy over flatene.**
- Warden skal se ut som samme spill som monstrene, men stå i motsetning til dem: Cinderborn er nesten svart kitin med varm kant og glød i typefarge. Warden er mellomgrå plate med **kald** kant og glød bare i cyan.

---

## 3. Fargetabell

Kontrasten er målt mot asfalt #2b2e31 (WCAG-luminansforhold). Platen i lys må være ≥ 3:1, og drakt og sekk kan ligge lavt fordi de bæres av kontur og kantlys.

| Del | Hex | Kontrast mot #2b2e31 | PAL-nøkkel (oblique.js) / kilde |
|---|---|---|---|
| Rustning, skyggeplate | #3a3f45 | 1.29 | `armor` (skyggeside) |
| Rustning, mellom | #5a6068 | 2.15 | `armor` |
| Rustning, lys plate (spillets grunnverdi) | #7d858e | 3.65 | `armorL` |
| Hjelmkuppel / topplys | #98a0a8 | 5.16 | `helm`, `topFace` |
| Blankt stål / slitte kanter | #c3c9ce | – | `spec` (kald) |
| Drakt / ledd | #1c2024 | 1.20 | `suit` |
| Skjerf, base | #a8814f | 3.85 | `scarf.base` |
| Skjerf, skygge / høylys | #6e5232 / #d8b67e | – | `scarf.dark` / `scarf.hi` |
| Seletøy, lommer | #8a7a5c | 3.26 | `pouch`, `fabric` |
| Sekk, canvas | #5c5a48 | 1.96 | `pouch` (sekk) – trenger egen form |
| Skulderplate (begge) | #2f5f93 | 2.07 | **ny:** `pauldron` |
| Chevron | #e4e0d4 | – | **ny:** `pauldron` (detalj) |
| Gevær, kropp / kant | #2b3036 / #59626c | 1.03 / – | `gun` / `gunL` |
| Geværstripe | #3c86c8 | – | skins.js (stripe) |
| Visirkjerne | #39c6ff | 6.95 | skins.js (glød) |
| Visir, varmeste punkt / bloom | #b8f3ff / #39c6ff @ 35 % | – | skins.js (glød) |
| Visirglass | #0b2a36 | – | `visor` |
| Sekkstripe / LED | #39c6ff | 6.95 | **ny:** `packLed` |
| Slitasje: gjørme / rust / sot | #4a3b2c / #6b4a32 / #23201d | – | malt overflate (PAINT_SURFACE) |
| Kantlys (lyssiden) | #dfe6ea | – | `READABILITY.oblique.rim.color` → '223,230,234' for Warden |

**Om varmere eller lysere verdier:** Den lyse platen er løftet fra spesifikasjonens #5a6068 til #7d858e. Ellers forsvinner Warden i asfalten (2.15:1). Skjerfet er varmet fra #8a7a5c til #a8814f, slik at det skiller seg fra seletøyet og leser som en aksent. Spesifikasjonens #3a3f45 og #5a6068 er beholdt som skygge- og mellomtone.

### 3.1 PAL klar til innliming (oblique.js)

`armor`, `armorL`, `helm`, `suit`, `pouch`, `boot`, `glove`, `key`, `shade`, `ao` og `topFace` er testet i minnet mot rendereren (`warden-kilde/render.html`, kolonnen «TARGET» på arket). `gun`, `gunL`, `spec`, `partEdge`, `visor` og `contour` er forslag som ikke er rendret ennå. Nøkler som ikke er nevnt beholdes som de er. `tint` og `lift` følger samme modell som i dag (multiply-tint + screen-løft).

```js
export const PAL = {
  armor:  { tint: [200, 208, 216], lift: [62, 68, 76] },    // kald gunmetal (torso, knær)
  armorL: { tint: [214, 222, 230], lift: [84, 90, 98] },    // lys plate ≈ #7d858e i lys
  helm:   { tint: [222, 228, 234], lift: [96, 102, 110] },  // hjelmkuppel ≈ #98a0a8, lyseste del
  suit:   { lift: [8, 10, 12] },                            // nesten svart drakt #1c2024
  fabric: { lift: [46, 38, 24] },
  pouch:  { lift: [40, 40, 28] },                           // sekk/belte, grønngrå canvas
  boot:   { lift: [14, 13, 12] },
  glove:  { lift: [26, 27, 28] },
  gun:    { tint: [120, 130, 140], lift: [18, 21, 24] },    // #2b3036
  gunL:   { tint: [140, 150, 160], lift: [26, 29, 32] },    // #59626c-kanter
  key:    '214,222,230',                                    // kald nøkkellys-vask
  shade:  ['214,218,224', '96,102,112'],
  ao:     '24,26,30',
  spec:   '236,244,250',                                    // kaldt høylys / blankt stål
  topFace: ['236,242,246', '205,214,222'],
  partEdge: '12,14,16',
  visor: '11,42,54', helmDetail: ['20,22,24', '16,18,20'],   // visirglass #0b2a36
  contour: '10,12,15',                                      // kjølig mørk kontur
  scarf:  { dark: '26,17,9', base: '#a8814f', hi: '216,182,126' },   // uendret
  // NYE nøkler (trenger kode i oblique.js):
  pauldron: { base: '#2f5f93', chevron: '#e4e0d4' },        // begge skulderplater
  packLed:  '57,198,255',                                   // cyan stripe + LED på sekken (additiv)
  rim:      '223,230,234',                                  // Wardens kalde kantlys (overstyrer light.js per figur)
};
```

Merk: `rim` er i dag global i `READABILITY.oblique.rim.color` ('255,228,178', varm). Monstrene skal beholde varm kant (FIENDE-DESIGN), så Warden trenger en overstyring per figur, ikke en global endring.

---

## 4. Lesbarhetsregler

1. **Verdi:** Den lyse platen i lys skal være ≥ 3:1 mot gulvet (#7d858e ≈ 3.65:1 mot asfalt). Warden er den lyseste figuren på kartet, og monstrene er de mørkeste. Ikke legg Warden-flater i 1,0–1,5:1-sonen uten kontur.
2. **Kantlys** kommer fra LIGHT_DIR (oppe til venstre, ≈ (−0.54, −0.84)) og bruker bredde og alpha fra `READABILITY.oblique` (1.5 px, .95), men i **kald** farge '223,230,234'. Kantlyset ligger bare på lyssiden og er forskjøvet mot lyset. Den mørke konturen dekker resten.
3. **Kontur:** 1.35 px mørk kjølig kontur rundt hele figuren. Geværet og sekken må ha egen kontur så de ikke smelter inn i kroppen.
4. **Metning:** Bare cyan (visir og sekkstripe) og den blå skulderplaten er mettet. Alt annet er dempet. Ingen andre blå- eller cyantoner på figuren, og ingen cyan på monstre.
5. **Silhuett:** Hjelmkuppelen, sekkblokken og geværet skal kunne leses som svart silhuett på 1×. Se silhuettpanelet på arket.
6. **Cyan og blått i ALLE poser (regel fra Test):**
   - Minst **to lysende cyan-merker** skal alltid synes på 1×: visirbåndet (forfra og fra siden) og sekkstripen/LED (bakfra og ovenfra). Fra alle åtte retninger skal minst ett av dem være fullt synlig.
   - Hvert merke skal være **≥ 2×1 skjerm-px ved 100 % emissiv**, pluss 1 px glød.
   - Glød tegnes **additivt (`lighter`) etter den bakte kroppen** (blob-cachen) og blir aldri mørklagt av kontur, AO eller skygge.
   - **Rulling:** Figuren er sammenkrøpet, og sekken (med stripe) vender mot kamera. En visirflik skal synes i minst halve rullen. Kroppen er ca. 28–30 px på tvers.
   - **Død:** Figuren ligger flat (ca. 46–50 px lang inkl. geværet som er mistet). Visir og sekkstripe dempes til **40 %, aldri 0**. Liket beholder kontur og kaldt kantlys så lenge det ligger.
   - **Blå skulderplate** synes på siden nærmest kamera i alle poser, så blått leser selv når visiret vender bort.

---

## 5. Overføring til oblique (konkrete regler)

**A. Palett:** Lim inn PAL fra §3.1. Det gir kald gunmetal i stedet for varm tan, mørk drakt og kaldt kantlys (per figur).

**B. Former som mangler i oblique i dag:**
- **Sekk:** en blokk på ca. 14×8 px i grunnplan, z 20–38 (fra korsrygg til litt over skulderlinjen). Den har lys toppflate (`topFace`), lokk-linje og cyan stripe + LED (`packLed`) på toppen og bakside. Top-down-stilen har den allerede, men oblique mangler den.
- **Skjerf:** en krage som en ring rundt nakken (z ≈ 38–42) og to korte haler bakover/nedover. De følger bevegelsen med litt etterslep.
- **Skulderplater:** begge malt `pauldron.base` med chevron som en 2–3 px lys V-form når platen vender mot kamera.
- **Hjelm:** Ø ca. 11,5 px (litt større enn i dag), med midtrygg som høylys og antenne (1 px, ca. 5 px lang) på venstre side.
- **Gevær:** ca. 30 px langt, stikker tydelig ut av silhuetten i siktretningen, og har egen kontur.

**C. Visir:** et omsluttende bånd på ca. 120° rundt hjelmens front. Det følger aimAngle og tegnes som glass (`visor`) + kjerne #39c6ff + varmeste punkt #b8f3ff i midten. Gløden går på et eget additivt lag etter cachen, uten shadowBlur.

**D. Poser:**
- **Rulling** skal vise sekken/stripen og en visirflik. I dag er visiret skjult i rullen, og figuren blir en grå klump.
- **Død** må få en ekte liggende pose i oblique. I dag ser liket ut som om det står. Se regel 4.6.

**E. Malt overflate:** Slå på `PAINT_SURFACE` når paletten er på plass. Avflisede kanter, gjørme og sot nederst skal bakes inn i cachen én gang, ikke males per frame. Det samme gjelder for monstrene.

---

## 6. Bruk i andre team

- **Nivåer og story:** Bruk designarket og maleriene i `reviews/img/warden-kilde/` (`paintC.jpg`, `trekvartA/B.jpg`, `roll-death.jpg`) som grunnlag for cutscenes og portretter. Visiret er alltid cyan, og det finnes ingen rød variant.
- **Breach Fiende-design:** Monstrene bygges på samme rigg (`createRig`), samme lys (LIGHT_DIR), samme konturbredde og samme malte overflate. Kontrasten ligger i verdi og temperatur: mørk og varm mot lys og kald. Cyan brukes aldri på fiender.

---

## 7. Kjente svakheter

- Maleriene er generert og ikke tegnet for hånd. Detaljer som antall stropper, lommeplassering og chevron-form varierer litt mellom bildene. **Hovedbildet `paintC.jpg` er fasit** når de er uenige.
- PAL-forslaget er bare testet i minnet. Det er ikke lagt inn i `oblique.js` fordi en annen jobb redigerer filen. Sekk, skjerfkrage, skulderfarge, visirbånd og liggende død krever ny kode, ikke bare palett.
- Rulle- og dødssilhuettene på arket er nedskalert fra malerier, med forsterkede cyanpiksler. De viser målet, ikke hva motoren tegner i dag.
