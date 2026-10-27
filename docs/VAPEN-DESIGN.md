# VÅPEN – designspesifikasjon (utseende)

**Designark:** `reviews/img/vapen-designark.png` (2400×2900)
**Kildemateriale:** `reviews/img/vapen-design/` – malte sidebilder (`ar9-side.jpg`, `s12-side.jpg`, `m4-side.jpg`, speilvendt/retusjert til `*-side-r.jpg`), innfelt bilde (`warden-loadout-v2.jpg`), geometrien (`geom.py` → `geometry.json`), projeksjon (`render3d.py`) og `compose.py` som bygger arket på nytt (`python3 compose.py`).
**Eier:** Breach Våpen · **Brukes av:** Breach Warden-design og animasjon (faceted-modell i hendene), Effekter (munningspunkt), Mellomsekvens-maler (våpen i panelene), Test (lesbarhet)
**Stilfasit:** `reviews/img/warden-designark.png` og `docs/WARDEN-DESIGN.md`. AR-9 der er fasit for rifla.

> Problemet som skal løses: i spillet er rifla «bare en stang». Alle tre våpen skal kunne skilles fra hverandre på 1× (spillstørrelse), og de skal se ut som samme familie som Warden: kald, slitt gunmetal, malt og realistisk.

---

## 1. Felles regler for alle tre

- **Samme familie:** kropp i gunmetal #2b3036, kanter #59626c, mørk polymer #1f2327 på grep, magasin og kolbe. Slitasjen er blankt stål #c3c9ce på kanter, hjørner og grepsflater.
- **Ett mykt materiale per våpen:** oliven stoff/tape #5c5a48 (AR-9: én vikling ved munningen, S-12: hele pumpa, M-4: kinnstøtten). Det er bindeleddet til Wardens sekk og skjerf.
- **Cyan #39c6ff bare som ÉN liten LED per våpen** (AR-9: ammoindikator på låskassa, S-12: kammerindikator, M-4: på kikkertens tårn). Den tegnes på glødlaget (additivt, etter cachen), aldri som flate. På 1× er LED-en ikke et krav – Wardens visir og sekkstripe er de cyan merkene. Fra 2× skal den synes som et punkt.
- **Blå stripe #3c86c8 bare på AR-9** (arvet fra Warden-arket). Den lyser ikke.
- **Ingen neon, ingen sci-fi-plastikk.** Formene er militære og rettlinjede. Lyset kommer oppe fra venstre (LIGHT_DIR).
- **Slitasjen sitter der hender, munning og bakke treffer**, aldri som jevn støy over flatene (samme regel som WARDEN-DESIGN §2.7).

## 2. Våpnene

Alle mål er i **verdens-px ved zoom 1** (1 rute = 32 px, Warden-kropp Ø 28–32 px). Våpenlokal ramme: **origo = grepet (høyre hånd), x fram langs løpet, y høyre, z opp.** Tallene kommer fra `geometry.json` og er målt på de malte sidebildene.

| | AR-9 Vanguard (`rifle`) | S-12 Breaker (`shotgun`) | M-4 Sentinel (`marksman`) |
|---|---|---|---|
| Rolle | Allrounder, middels hold, 24 skudd | Nærkamp ≤ 4 r, pumpe, 6 patroner | Langt hold, bolt action, kikkert, 5 skudd |
| **Lengde totalt** | **36 px** (1,13 rute, ≈ 1,2 × kropp) | **30 px** (0,94 rute) | **50 px** (1,56 rute, 1,7 × kropp) |
| Høyde i sideprofil (inkl. sikte/magasin) | 15,7 px (−5,9 … +10,0) | 9,4 px (−4,0 … +5,4) | 10,5 px (−2,5 … +8,0) |
| Største bredde (sideveis, det som leses ovenfra) | 3,5 px (tapen) / 3,1 px håndvern | **6,5 px (pumpa)**, låskasse 4,1 | 3,1 px (kinnstøtte), kikkert 2,4–3,0 |
| Munning (x, z) fra grep | (+24,7, +4,4) | (+23,0, +3,4) | (+38,0, +4,0) |
| Forgrep / venstre hånd (x, z) | (+13,6, +2,3) håndvern | (+13,4, +1,1) på pumpa | (+15,1, +1,5) under forskjeftet |
| Kolbe / skulderkontakt (x, z) | (−11,5, +4,0) | (−7,0, +2,0) | (−12,3, +1,7) |
| Antall deler (prismer) | 13 | 11 | 15 |

**Skala 36 (Breach 23.10):** AR-9 36 px, S-12 30 px, M-4 50 px – alle mål over er skalert likt (×1,2; M-4 ×1,19) og `geometry.json` er generert på nytt (`geom.py`, L = 36/30/50). Proporsjonene er uendret: AR : S-12 : M-4 = 1,0 : 0,83 : 1,39. Modellene i `game/src/weapons/look/*.js` er skrevet i arkets enheter og skaleres ved registrering (`look/util.js`, `GAME_LENGTH`).

### 2.1 AR-9 Vanguard – «medium lengde + rett magasin»
- **Visuell begrunnelse:** Arbeidshesten. Den skal se kompakt, balansert og pålitelig ut – verken lang eller tykk. Formen er hentet direkte fra Warden-arket: kort løp med munningsbrems, firkantet håndvern med ventilasjonsspor, rødpunktsikte, **rett** kassemagasin (ikke buet), uttrekkbar kantet kolbe.
- **Kjennetegn i spillstørrelse:** Middels lengde, og **magasinet henger under linja som et hakk** (ca. 6 px under løpet, i 37° blir det ca. 4–5 skjerm-px). Rødpunktblokka gir en liten kul oppå. Fra 2× synes den blå stripa.
- **Slitasje:** Avflist til blankt stål på skinna, magasinleppene og kolbehjørnene. Sot på munningsbremsen og ved utkasteråpningen. Støv i ventilasjonssporene. Én oliven tapevikling nær munningen. Stripa er skrapet, men lyser aldri.
- **Palett:** kropp #2b3036 · kant/håndvern #59626c · polymer #1f2327 · stål #c3c9ce · tape #5c5a48 · stripe #3c86c8 · LED #39c6ff.

### 2.2 S-12 Breaker – «kort og tykk med teipet pumpe»
- **Visuell begrunnelse:** Et brutalt verktøy for å slå inn dører. Kort, tungt og bredt, så spilleren skjønner «nærkamp» før første skudd. Tykk låskasse med skallholder på siden (fire messingpatroner), kort løp over et magasinrør, **stor pumpe teipet i oliven stoff**, firkantet bruddmunning med tre spalter, enkle ringsikter (ingen optikk), kort kraftig kolbe med rekylpute.
- **Kjennetegn i spillstørrelse:** Kortest av de tre og **bredest (6,5 px pumpe)**. Den **lyse** oliven pumpa (#8f8a66, lysere enn Wardens sekk) er den lyseste flekken på våpenet og ligger langt fram, så S-12 leses som «tykk front». Den firkantede munningen gir en tydelig klosseslutt i stedet for en spiss.
- **Slitasje:** Tapen er frynset og mørknet av hånd og olje. Mye sot inne i munningsspaltene og oppå løpet. Lyse avflisinger på låskassehjørnene, riper på skallholderen. Rekylputa er matt og skrapet.
- **Palett:** kropp #2b3036 · bruddmunning/kant #59626c · polymer #1f2327 · pumpe #8f8a66 (lys oliven, 23.10) · messing #a8823e · hylse (dempet rød) #6e2a22 · LED #39c6ff.

### 2.3 M-4 Sentinel – «lang med kikkert og bolt»
- **Visuell begrunnelse:** Tålmodighet og presisjon. Lang og slank, med et tungt riflet løp og en lang lyddemperliknende munningsbrems. Stor kikkert med objektivklokker og tårn høyt oppå, **boltgrep med rund knott som stikker ut til høyre**, kort innfelt 5-skuddsmagasin, skjelettkolbe med justerbar kinnstøtte i oliven stoff, sammenfelt tobent under forskjeftet.
- **Kjennetegn i spillstørrelse:** **Lengst på kartet (1,3 ruter)**, og løpet stikker langt foran Warden. Kikkerten gir en tydelig blokk over den bakre halvdelen, og boltknotten bryter silhuetten til høyre. Ingen andre våpen har en så lang, tynn front.
- **Slitasje:** Støv i løpsriflene og sot på tuppen av munningsbremsen. Kikkertklokkene er avflist på kantene, men glasset er uskadd (mørkt, med kald refleks). Boltknotten er blankslitt av bruk. Kinnstoffet er falmet og gjennomslitt på kantene.
- **Palett:** kropp #2b3036 · kikkertkropp #24282d · polymer #1f2327 · stål (bolt, slitasje) #c3c9ce · stoff #5c5a48 · glass #0d1c24 · LED #39c6ff.

## 3. Munningshøyde (muzzleZ) og munningspunkt

Stående Warden, siktepositur: høyre hånd ligger på z ≈ 31,6–32 (oblique `socket('handR')`; faceted: hofte 22 + gunZ 11,2 − 1,2). Skulderlinja er ≈ 37 (faceted/warden.js).

| Våpen | muzzleZ stående (hånd + munning z) | Relativt til skulderlinja (≈ 37) | Merknad |
|---|---|---|---|
| AR-9 | **≈ 35,3** | −1,7 | I dag gir oblique `socketZ('muzzle')` ≈ 34. Avviket er under 1,5 px. |
| S-12 | **≈ 34,4** | −2,6 | Lavere løp. Hvis Warden-design velger «low ready», blir det ≈ 32–33. |
| M-4 | **≈ 35,0** | −2,0 | Lagt an mot kinnet. Kikkerten ligger 2,7 px over løpet. |

Huket (kneel) trekker alt ned med gunZKneel-forskjellen (≈ 0,8 px) + hoftefallet. Positurene (`f < 1` = nesen ned) gjør munningen lavere. **Regelen er derfor at muzzleZ alltid leses fra modellen (munningssocket), aldri fra en konstant.** Tabellen viser bare målet for siktepositur.

**Munningspunkt i planet (skala 36, målt 26.10 med samme weaponFrame som faceted.muzzleOf):** to positurer gir to tallsett, og begge er riktige.
- *Siktepositur* (pose.aim, f = 1, ingen pitch): AR-9 26,8 fram / z 36,4, S-12 27,3 / 36,3, M-4 40,0 / 36,0. Dette er tallene som gjelder ved skudd med sikte.
- *Klarpositur* (pose.ready, f = 0,86 → ca. 31° nese ned, a = −0,5): AR-9 23,8 / z 21,5, S-12 24,1 / 21,2, M-4 33,6 / 14,4. Warden-designs måling (24,6 / 24,9 / 35,6 fram) er i denne posituren (avstanden i planet).
- «AR-9 2 px kortere» er altså positur, ikke en feil: 26,7 var siktepositur. M-4 sin lave z i klarpositur kommer av pitchen ganger det lengre løpet (38 px mot 24,7 px fra grepet ≈ 7 px ekstra fall). grip/stock/muzzle i look/marksman.js er konsistente med det tegnede løpet, så defen er ikke endret. Skal M-4 holdes på z ≈ 21 i klar, må riggen ha en egen klarpitch for M-4 (f ≈ 0,93), og det er Warden-designs fil.
`getMuzzle` bruker `entity.muzzle` (logisk munning, kulene starter her) og `getMuzzleDraw` bruker `entity.muzzleDraw`; begge faller tilbake på `data.js` `muzzle.forward`.

## 4. Neste steg: kantede 3D-deler for faceted-stilen

> **Status 23.10:** grensesnittet under er erstattet av Warden-designs faceted-våpenformat (`shared/rig/faceted/README.md`, «Våpen»). De ekte modellene ligger i `game/src/weapons/look/rifle.js`, `shotgun.js` og `marksman.js` (festepunkter grip/fore/stock/muzzle/led, bevegelige deler pump/bolt/mag, palettnøkler metal/metalDark/polymer/wrap/wear/led, `minScale` per del). Teksten under er beholdt som historikk.

Warden-design har bygget `shared/rig/styles/faceted.js` + `shared/rig/faceted/` (mesh.js, paint.js, bake.js, warden.js). Rifla er i dag seks bokser i `buildUpper` (stock, receiver, guard, barrel, gmag, sight) i rammen `GT = sub_frame(TT, [bx, by, gunZ], a, pitch)`. Det er derfor den leses som en stang: den er nesten like bred og høy hele veien, og den mangler magasinhakk, sikteblokk og tydelig munning.

**Forslag til grensesnitt (skal avtales med Warden-design via Breach):**

```js
// game/src/weapons/models.js  (eies av Våpen – ren geometri, ingen tegning, ingen avhengighet til player/)
import { box, beam, loft, decal, rect8, ngon } from '../shared/rig/faceted/mesh.js';
export const WEAPON_MATS = {            // flettes inn i WARDEN_MATS (samme format: ramp/top/stroke/wear/edge)
  gun, gunL,                            // finnes allerede – gjenbrukes
  gunPoly:  { ramp: ['#0f1113', '#1f2327', '#383e45'], stroke: .4, wear: .5, edge: .6 },
  gunTape:  { ramp: ['#2c2b22', '#5c5a48', '#837f66'], stroke: 1, wear: .2, edge: .5, mud: .3 },
  gunScope: { ramp: ['#121417', '#24282d', '#3e444b'], top: '#4a525b', stroke: .4, wear: .5, edge: .7 },
  shellBrass: { ramp: ['#5a4320', '#a8823e', '#d8b46a'], stroke: .2, wear: 0, edge: .4 },
  shellHull:  { ramp: ['#3a1612', '#6e2a22', '#8e4436'], stroke: .2, wear: 0, edge: .4 },
  lens:     { ramp: ['#050b0f', '#0d1c24', '#2a4552'], stroke: 0, wear: 0, edge: .8, flat: true },
  gunStripe,                            // finnes allerede (bare AR-9)
  // LED bruker Wardens 'cyan' (glød, additiv) som decal – ingen ny glødfarge
};
export const WEAPON_MODELS = {
  rifle: {
    length: 30,
    sockets: {                          // våpenlokale verdens-px, origo = grep (høyre hånd)
      grip:   [0, 0, 0],
      fore:   [11.3, 0, 2.3],           // venstre hånd
      butt:   [-9.6, 0, 3.3],           // mot skulderen
      muzzle: [20.4, 0, 3.7],           // glimt, tracer, kulestart (Effekter og Våpen leser denne)
      led:    [3.6, -1.2, 2.2],
    },
    build(M, GT, o) { /* box/beam/loft-deler som i geometry.json; GT = våpenramme med origo i grepet */ },
  },
  shotgun:  { length: 25, sockets: { … }, build },
  marksman: { length: 42, sockets: { … }, build },
};
```

**Avtale om ansvar:**
1. **Våpen leverer:** `build(M, GT, o)` per våpen (geometri + materialnavn), `WEAPON_MATS` og `sockets` (grip, fore, butt, muzzle, led). Fasiten er `reviews/img/vapen-design/geometry.json`: sideprofil-polygoner (x, z) + bredde og y-senter per del, i den samme rammen. Hver del blir et prisme (`loft` med to ringer = profil ved y−w/2 og y+w/2), og løp og kikkert blir 6–8-kantede `loft` i stedet for bokser. Det er 11–15 deler per våpen, omtrent som én arm på Warden.
2. **Warden-design fester:** setter `GT` slik at våpenets `grip` havner i høyre hånd og `fore` i venstre hånd (eksisterende IK: skulder → albue → hånd). Positurene (`def.weapon.poses`) beholdes. `bx/by/a/f` flytter grepet, ikke kolba. `o.kneel` og `o.pose` sendes med i tilfelle et våpen vil folde tobenet eller lignende (ikke nødvendig nå).
3. **Sockets fra modellen:** `rig.socket('muzzle')` / `socketZ('muzzle')` i faceted beregnes som `GT(...sockets.muzzle)`, så `player.muzzle`/`muzzleZ`/`muzzleDraw` følger det tegnede løpet for hvert våpen. `handL` = `GT(...sockets.fore)`. Nærkampslaget bruker `butt`.
4. **Sprite-cache:** Våpen-id-en må inn i positur-nøkkelen (f.eks. `…|w:rifle`). Da bakes tre varianter lat, bare for våpen spilleren faktisk bruker, og våpenbytte gir en kort ny baking (fallback = forrige våpen i ett bilde). Minnet øker opptil ×3 for overkroppslaget. Arena (ytelsesbudsjett) bør få vite det.
5. **LED og stripe** legges som `decal` på delen de sitter på, med `'cyan'` / `'gunStripe'`. LED-en havner på glødlaget automatisk, siden `cyan` har `glow`.
6. **Egen kontur:** Alle våpendeler får `own = 1` og `gun = 1` som i dag, så våpenet får egen kontur mot kroppen (WARDEN-DESIGN §4.3).

Rekkefølge: (a) Breach godkjenner arket → (b) avtale om grensesnittet med Warden-design → (c) jeg skriver `weapons/models.js` og en testside som baker alle tre i 8 retninger på 1×, 2× og 4× ved siden av silhuettene på arket → (d) Warden-design kobler inn → (e) data.js `muzzle` leses fra sockets.

## 5. Kjente svakheter

- **Maleriene er generert.** Detaljer som antall spor, sikteform og kolbe varierer litt fra Warden-arkets AR-9 (min AR-9 har langt håndvern og en annen kolbe). **Geometrien i `geometry.json` er fasit** når maleri og modell er uenige.
- **Det innfelte bildet er svakest:** S-12 i midtpanelet er fortsatt for lang og slank i forhold til sidebildet. Rustningen er også mørkere enn arkets #7d858e, og skulderplatene mangler noe av kontrasten. Bildet er en stemningsreferanse, ikke en målefasit.
- **På 1× er forskjellen mellom AR-9 og S-12 nå tydelig, men grov** (36 mot 30 px). S-12 leses som en lys, bred kloss foran hånda (pumpe 6,5 px, #8f8a66). Ulempen er at den kan leses som «klump» mer enn «hagle»; munningen er kort. `metalDark` er løftet til #3a4148 i modellene, ellers forsvant løp og demper mot asfalten.
- **Forhåndsvisningene på asfalt er flat Lambert-skygge**, ikke faceted-malingen. Den endelige tonen (kantlys, slitasje, AO) kommer først når modellene er bakt i `faceted/paint.js`.
- **Warden-renderen i «ON ASPHALT»-panelet** er den gamle (round 3 target-palett med stang-geværet bakt inn). Den viser bare størrelsesforholdet.
- AR-9-maleriet hadde cyan refleks i rødpunktglasset. Den er retusjert bort (`ar9-side-r.jpg`) for å holde regelen om én LED.

## Integrasjon for Warden-design: fritt roterende våpen (variant C) – 26.10

> **PARKERT 26.10 (Alexander vil se demoen først).** Alt i denne seksjonen er et UTKAST og bygges ikke videre: `src/weapons/look/free.js`, `free-test.html/js`, `reviews/diffs/paintedC-weapons.diff` og API-et for fritt roterende våpen. Demoen bruker faceted med `weapons/look/*`-defene og `faceted.muzzleOf`. Ikke bruk diffen.
Modul: `game/src/weapons/look/free.js` (eies av Våpen). Tegner alle tre våpen direkte som polygoner fra look-defene.
Testside: `src/weapons/look/free-test.html` (16 retninger, 1× og 2×, prikker for muzzle/muzzleDraw). Skjermbilder: `src/weapons/shots/C/`.

**Signaturer**
```js
import { drawWeapon, weaponAnchors, applyMuzzle, weaponBehind, gripWorld, bindWeaponMotion, GRIP_OFFSET } from '../../../weapons/look/free.js';
gripWorld(x, y, aim, off = GRIP_OFFSET, out?) → {x,y,z}          // høyre hånd; GRIP_OFFSET = {forward 5, side 3.2, z 25} (= paintedC i dag)
weaponAnchors(id, origin, aim, out?) → { grip, fore, stock, muzzle, muzzleDraw, led, angle }   // alle {x,y,z} i verden, out gjenbrukes
applyMuzzle(entity, anchors)                                        // entity.muzzle = anchors.muzzle, entity.muzzleDraw = anchors.muzzleDraw
drawWeapon(ctx, id, origin, aim, { zoom = 1, move?: {pump, bolt, mag}, alpha = 1, outline = true })
weaponBehind(aim) → bool                                            // tegn før overkroppen (sin(aim) < −0,35, samme regel som før)
bindWeaponMotion(world, entity) → m; m.update(dt) → {pump, bolt, mag}   // fra 'chamber' og 'reload' (start/active/end); m.dispose()
```
**Koordinater.** Verden: x/y i px (y ned), z = px over bakken; skjerm = `PROJ.toScreen(x, y, z)`. `ctx` skal stå i verdenskoordinater
(kameraets zoom satt), og `zoom` = skjerm-px per verdens-px (styrer detaljnivå: < 1,5 = 1×-detaljer, ellers 2×). Våpenrommet er x fram,
y høyre, z opp med origo i grepet. Rotasjonen er ekte 3D om z: venstresikte viser venstre side med toppen opp, aldri opp-ned.
**Samme kilde.** `muzzle` og `muzzleDraw` regnes fra samme transform som tegningen (muzzleDraw = 0,5 px foran langs løpet), så kule og
glimt kan ikke gli fra den tegnede løpstuppen. Kall `weaponAnchors` og `drawWeapon` med samme `origin`/`aim` i samme frame.
**Cache.** Per våpen-id × 64 vinkelbøtter × detaljnivå: synlige flater, farge og rekkefølge som Path2D. Ingen fase i nøkkelen; bevegelige
deler forskyves med `ctx.translate` langs aksen i defen (mag tones ut). Resten av vinkelen innen bøtta tas med `ctx.rotate` (≤ 2,8°, feil ≤ 0,3 px).
**Okklusjon.** Våpenet tegnes inne i `drawActor`, så `shared/depth.js drawSorted` legger dekning foran riktig. For prikker/effekter: `weapons/view34.hidden`.

**Slik kaller paintedC oss** (ferdig diff: `reviews/diffs/paintedC-weapons.diff`, sjekket med `patch -p1 --dry-run`; repoet er ikke git):
- Ny import av `drawWeapon, weaponAnchors, weaponBehind, gripWorld` fra `../../../weapons/look/free.js`.
- I `drawWardenC`: linjene `const front = Math.sin(aim) > -0.35;`, `const grip = { … }`, de to `drawRifle(ctx, look, grip, aim, zoom)` og
  `return { muzzle: … }` byttes mot `gripWorld` + `weaponAnchors` + `weaponBehind` + `drawWeapon(ctx, wid, grip, aim, { zoom, move: o.move })`.
  Nye valg: `o.weapon` ('rifle' | 'shotgun' | 'marksman', standard `look?.id ?? 'rifle'`), `o.move`, `o.anchorsOut`.
- Returnerer `{ muzzle, muzzleDraw, anchors }`. Riggen setter `entity.muzzle`/`entity.muzzleDraw` fra disse (eller `applyMuzzle`) og legger hendene på `anchors.grip`/`anchors.fore`.
- `drawRifle` beholdes merket @deprecated (testC2.html bruker den).
