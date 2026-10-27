# FIENDE-DESIGN – Cinderborn, utseende v2 (Fiende-design, 23.10.2026)

Bygger på **docs/CINDERBORN-DESIGN.md** (utkastet fra Nivåer og story). Rolle, størrelse og lore står der, og tabellen der gjelder fortsatt med mindre noe er overstyrt her. Dette dokumentet legger til det utkastet manglet: proporsjoner fra én 3D-modell per fiende, lysmønster med tider, animasjonsliste og filgrensen mot Fiende-AI.

**Ark:** `reviews/img/cinderborn-designark.png` (2220×2334). Utkastet er tatt vare på i `reviews/img/cinderborn-designark-utkast.png`.
**Enkeltbilder** i `reviews/img/cinderborn/`:
- `<navn>-trekvart.jpg`: ny malt nærbilde i spillkameraets vinkel (~37°)
- `<navn>-ark.png`: ark per fiende
- `<navn>-vol-side.png`, `-vol-top.png`, `-vol-34-4x.png`: silhuetter fra volummodellen
- `<navn>-game-1x.png`, `-game-2x.png`: spillskala, med Warden ved siden av
- `<navn>-walk-2x.png`
- `lineup-1x.png` og `lineup-1x-gray.png`

Utkastets `-main.jpg`, `-ref.jpg` og `-silhouette.png` er beholdt urørt.
`<navn>` er en av: husk, lurcher, kiln, spitter, kilnalpha, ashmaw.

**Verktøy (prototype, ikke spillkode):** `tools-fiende-design/`
- `cinder-volumes.js`: volummodellene
- `sheet.html` + `render.cjs`: headless-rendering
- `compose.py`: setter sammen arket

Modellene bruker samme metode som Wardens `oblique.js`: konvekse volumer, projisert skrog, malt fyll, kontur og rim. De bruker også samme `PROJ` (zScale 0.75) og `LIGHT_DIR`. Side-, topp- og trekvartvisningen er dermed alltid konsistente, noe som var utkastets største svakhet.

## Felles regler
- **Kropp:** nesten svart kitin (`#14–#22` i alle kanaler) med varme kantlys fra `LIGHT_DIR`. Typefargen brukes **kun som glød**, aldri som maling på kroppen. Cyan er forbeholdt Warden (regelen fra utkastet).
- **Lys som informasjon:** hver fiende har én glødsignatur som forteller hva den er. Retning vises av ett frontlys. Varsel før angrep vises ved at glødet blir hvit-varmt.
- **Treff (hit):** alt glød blinker til `hot`-fargen i 120–150 ms (`P.hurt`), og kroppen rykker 1–2 px bort fra skuddet. **Stagger** (`P.stagger`): bakoverknekk i hofte/torso og glødet slukkes til 40 % mens den varer.
- **Død:** glødet dør ut over 0,8 s (sprekkene sist), kroppen faller sammen langs `deathAngle`, og liket står igjen som mørk skorpe med 2–3 glør som slukker i løpet av `corpseT`.
- **Oppstigning (`P.rise`):** kroppen stiger opp av sprekken nedenfra og opp, og glødet tennes først når progress > 0.7.
- **Ytelse:** volummodellen uten cache koster ~0,55–0,6 ms per fiende (12 stk ≈ 6,6–7,3 ms). Warden oblique koster ~0,56 ms. **I spillet må den bakes til sprites**: 8 retninger × gangsyklus, og glødet tegnes som eget lag med `'lighter'`, slik at puls og varsler ikke krever ny baking. Ingen `shadowBlur`.

## Husk – Grunt (`#c0392b`)
- **Silhuett:** krumbøyd, eggformet ryggpukkel med lavt hode foran. Venstre side har et bredt flatt skjold, høyre side en lang spydarm med pigger som henger fram. Asymmetrien er det som skiller Husk fra Lurcher ovenfra.
- **Proporsjoner:**
  - Kropp ~30 px bred, pukkeltopp ~37 verdens-px (Warden 48). Den skal se lav og tung ut, ikke høy.
  - Pukkelen utgjør ~45 % av volumet.
  - Spydarmen rekker ~10 px foran hodet.
- **Materialer:** matt kitin `#1c1714`, plateskorpe `#4a3f38` med varme kanter, spydspissen er bein.
- **Lys:**
  - Røde sprekker over pukkelen pulserer med 1,6 s periode (`#c0392b` → kjerne `#ff5a3c`).
  - Én rød halsspalte foran viser retningen.
  - Spydspissen gløder 0,3 s før salve (`P.telegraph`).
- **Svake punkter:** halsspalte og hode når skjoldet senkes for å skyte; ryggen når skjoldet vender bort.
- **Animasjoner:**
  - Idle: pukkelen puster ±0,6 px, sprekkene pulserer.
  - Walk: tung tobent gange, bob 1,2 px, 0,9 s syklus.
  - Dekning: huker seg bak skjoldet (`crouch`), og skjoldet vender mot `coverSide`.
  - Attack: skjoldet glir til side, spydarmen løftes, salve med munningsglød i spissen.
  - Hit/stagger/death: se felles regler.
  - Spesial: i `suppressed` trekkes hodet inn under pukkelen og halsspalten slukker.

## Lurcher – Flanker (`#8e1e1e`)
- **Silhuett:** lav og lang (øgle/insekt). Fire spredte bein, lang tynn hale og en hinnekrage bak hodet. **Ingen vinger** (utkastet ble for drageaktig).
- **Proporsjoner:** kropp ~28 px, ~44 px med halen. Høyden er bare ~16 px, så den er lavest i lineupen og høyde alene skiller den fra Husk.
- **Materialer:** kitin `#1a1512`, skjellkant `#5a4a3a`, kragehinne `#8e1e1e` som er gjennomskinnelig med årer.
- **Lys:**
  - To små røde øyne `#ff3b2f` helt foran viser retningen.
  - Kragen folder seg ut med lysende årer under sprint, flanking og `melee.charge`.
  - Ellers mørk: den skal være vanskelig å se på gulvet til den angriper.
- **Svake punkter:** nakke og utfoldet krage (stor treffflate); lav HP i det åpne.
- **Animasjoner:**
  - Idle: halen svinger sakte, kragen er lagt flatt.
  - Walk: firbent diagonalgange med sideveis S-sving i kroppen (sway 2,5 px).
  - Rush/flank: lav profil, kragen halvt ute.
  - `melee.charge`: kragen helt ute, hvitglødende årer og kroppen trykket ned. Dette er spillmekanikk og må synes.
  - Strike: utfall på ~8 px.
  - Recover: kragen faller sammen.
  - Hit/death: se felles regler. Ved død krøller halen seg inn.

## Kiln – Heavy (`#ff7a1a`)
- **Silhuett:** bred, kantet firkant med fire korte søylebein i hjørnene og flate ryggplater. Fra toppen et kvadrat delt av glødende sømmer.
- **Proporsjoner:**
  - 36 px kvadrat (Heavy-unntaket), front ~26 px høy.
  - Bredest av småtypene, men lavere enn Husk.
- **Materialer:** platekitin `#1e1a17`, platekant `#4d4540`, sømmer og glør `#ff7a1a`, hvitglødende kjerne `#ffd27a`.
- **Lys:**
  - Oransje sømmer mellom ryggplatene pulserer med 1,2 s periode (sett ovenfra eller fra siden).
  - Brystkjernen er synlig kun forfra.
  - Kjeften blir hvitglødende 0,6 s før spray (`telegraph` / `spin`).
- **Svake punkter:** ryggsømmene (flankbonus); brystkjernen mens den sprayer.
- **Animasjoner:**
  - Idle: platene løfter seg og glør puster ut av sømmene.
  - Walk: tung, langsom, 1,3 s syklus, synlig vektforskyvning.
  - Spinup: kjeften glør stadig sterkere i takt med `spin`.
  - Sustain: kjeften åpen, strålen (Fiende-AI tegner `streamLen`), kroppen rister ±0,5 px.
  - `reload`: platene åpnes og sømmene blir svake. Dette er spillerens åpning og skal synes tydelig.
  - Hit/death: se felles regler. Ved død sprekker platene og sømmene renner ut.

## Spitter – Grenadier (`#9b59ff`)
- **Silhuett:** liten oval kropp høyt på seks tynne edderkoppbein, lang hals foran og en klase på tre sekker på ryggen. Høyest av småtypene.
- **Proporsjoner:** kropp ~30 px, beina rekker ~40 px.
- **Materialer:** nesten svart kitin `#211c1a`, beinkitin `#4a423c`, sekker `#9b59ff` med høylys `#d6b8ff`.
- **Lys:**
  - Tre kalde fiolette sekker er ammunisjonen (eneste kalde lys hos Cinderborn).
  - Én sekk dimmes per kast og fylles igjen over tid.
  - Halsen blinker fiolett 0,5 s før kast (`throw.windup`).
- **Svake punkter:** sekkene. Skyter du én, sprekker den på Spitteren selv.
- **Animasjoner:**
  - Idle: beina trommer, sekkene pulserer ute av fase.
  - Walk: edderkoppgange, tre og tre bein.
  - Windup: halsen bøyes bakover, én sekk tømmes inn i halsen.
  - Release: halsen slår fram.
  - Hit/death: se felles regler. Ved død knekker beina sammen og sekkene sprekker i en fiolett sky.

## Kiln Alpha – mini-boss (slutten av brett 2)
- **Silhuett:** Kiln forstørret ×1,33 med sagtakket kam langs ryggen (stegosaur-aktig) og tyngre kjeve. Kammen legger ~14 px til høyden og gjør den lett å skille fra Kiln.
- **Proporsjoner:** 48 px (1,5 ruter), front ~40 px.
- **Farger:** slaggkitin `#1b1714`, smeltet slagg `#5a4a3e`, sømmer `#ff7a1a` og aksent `#fff0b0` (tvillingkjerner).
- **Fargevalg og begrunnelse:**
  - Alpha **beholder Heavy-oransje** fordi spillerne allerede leser oransje som «Heavy, spray, flank den». Den er en Kiln, bare verre, og skal oppleves slik.
  - Det nye er en **gul-hvit aksent** i to kjerner (foran og bak). Gul-hvit er varmere og lysere enn alle andre glør, så den leses som «sjef» uten å bryte fargespråket.
  - Utkastets `#ffb347` lå for nær oransje til å skille seg ut i 1×.
- **Lys:**
  - Kjernene pulserer med 0,9 s periode.
  - **Fase 2** (når en kjerne er knust): kammens røtter tennes bakfra og fram over 600 ms og blir værende glødende.
- **Svake punkter:** bakre kjerne (flank); fremre kjerne kun under spray.
- **Animasjoner:** som Kiln, pluss:
  - Brøl: kammen reiser seg og kjernene blir hvite (0,8 s, fasebytte).
  - Slagg drypper fra kjeften i idle.
  - Ved død bryter kammen sammen.

## Ashmaw – sluttboss (The Deepwell)
- **Silhuett:** stor lav kuppel (~120 px, ~3,75 ruter) med **8 ventiler i ring** (utkastets valg er beholdt), en ovnskjeft foran og korte krabbebein ut til alle kanter.
- **Proporsjoner:** kuppeltopp ~52 verdens-px, ventilene ligger på 1/3 av kuppelhøyden.
- **Farger:** kuppelkitin `#14110f`, platekant `#3e3530`, ventiler `#ff7a1a` / `#ffb347` og kjeft `#ff5a1a` som aksent. Glørlinjene mellom platene er `#c0392b`.
- **Fargevalg og begrunnelse:**
  - Ventilene bruker Heavy-oransje fordi de er det spilleren skal skyte, og oransje betyr «sterk, men sårbar fra siden».
  - Kjeften er rødere `#ff5a1a`, slik at retning og fase 3 skiller seg fra ventilene.
  - Mørkerøde glørlinjer (Husk-rødt) binder henne til hele Cinderborn-familien: hun er moren.
  - Ingen ny farge er innført, for sluttbossen skal føles som summen av fiendene.
- **Lys:**
  - De 8 ventilene er 8 HP-segmenter. En ødelagt ventil blir stående svart.
  - Ventilene som vender mot Warden lukkes og blir mørke, mens de på motsatt side står åpne. Det tvinger fram flanking.
  - Kjeften er eneste frontlys og gløder før smeltekjeglen.
- **Svake punkter:** åpne ventiler (ødelegges permanent); kjeften forfra i fase 3.
- **Animasjoner:**
  - Idle: kuppelen puster og ventilene pulserer i en bølge rundt ringen (2 s).
  - Walk: tung krabbegange sidelengs.
  - Vent-lukking: platene glir over ventilen på 250 ms.
  - Smeltekjegle: kjeften åpnes over 0,8 s (varsel) og står hvitglødende under angrepet.
  - Dykk og oppstigning: synker ned i sprekken med ringen sist.
  - Hit: ventilen som ble truffet blusser opp.
  - Faseskift: alle ventiler blusser opp samtidig i 0,5 s.
  - Death: ventilene slukker én og én rundt ringen, så kollapser kuppelen.

## Lesbarhet ved 30 px (målt på `lineup-1x.png` / `lineup-1x-gray.png`)
- **Husk og Lurcher:** skilles på form, ikke farge. Husk er foroverbøyd og firbeint med pukkel, skjold og spydarm (asymmetrisk); Lurcher er lav, lang og har hale. Det fungerer også i gråtoner.
- **Kiln:** et kvadrat med et oransje sømkors.
- **Spitter:** tynne bein og eneste kalde lys (fiolett).
- **Kiln og Alpha:** skilles i 1× på størrelse og kam, og i 2× også på de gul-hvite kjernene.
- **Ashmaw:** er alene i sin størrelse.
- **Warden:** kald grå rustning (lys plate #7d858e), cyan visir og cyan stripe på sekken, blå skulderplater (#2f5f93) og varmt sandskjerf (#a8814f), se `docs/WARDEN-DESIGN.md`. Warden er den lyseste figuren på kartet og monstrene de mørkeste. Warden har kaldt kantlys (#dfe6ea), monstrene varmt (255,228,178). Cyan er reservert for Warden, så monstrene har ingen cyan eller blått. Ingen forveksling.
- **Svakhet:** Husk er ~20 % lavere enn Warden og kan virke liten. Vurder skala 1,1 for Husk i spillet.

## Filgrense mot Fiende-AI – forslag
Fiende-AI har allerede laget kroken: `game/src/enemies/art.js` med `registerEnemyArt(type, variant, drawFn)`. `drawActor` i `render.js` kaller `drawWithArt(ctx, P, info)` før plassholderen, med `P = poseOf(world, e)` (kun lesing) og `info = { world, camera, view, layer, proj, lift, enemy }`. Forslaget er å bygge videre på den, ikke lage en ny.

| Fil | Eier | Innhold |
|---|---|---|
| `game/src/enemies/pose.js`, `art.js`, `render.js` (varsler, telegrafer, `streamLen`, plassholder) | Fiende-AI | Oppførsel og P-kontrakten. Uendret. |
| `game/src/enemies/look/index.js` | Fiende-design | `registerEnemyArt('grunt', null, drawHusk)`, … `('heavy','alpha', drawKilnAlpha)`. Importeres én gang fra `enemies/index.js` (én linje som Fiende-AI legger inn). |
| `game/src/enemies/look/cinder-*.js` | Fiende-design | Volummodell per fiende: `build<Type>(P)` → volumer + glødtrekk. Mapping P → positur: `walkPhase`, `moving`, `crouch`, `telegraph`, `throw`, `melee`, `spin`, `reload`, `hurt`, `stagger`, `rise`. |
| `game/src/enemies/look/bake.js` | Fiende-design | Sprite-baking per type, 8 retninger × N gangframes, i et `OffscreenCanvas`-atlas. Glød tegnes live som eget lag. |
| `game/src/shared/rig/styles/cinder.js` | Karakter (forslag) | Kun hvis Karakter vil eie det: en rig-stil `{ name:'cinder', drawFigure, sortKey }` som gjenbruker oblique-hjelperne (skrog, rim, kontur) for tobente typer (Husk). Ellers bor alt under `enemies/look/`, og vi importerer bare `PROJ` og `LIGHT` og eventuelt eksporterte skroghjelpere fra `oblique.js`. |

**Kallkjede i trekvart:**

```
depth.js drawSorted → enemies.drawActor(ctx, e, world, camera)
  → P = poseOf(world, e)
  → drawWithArt(ctx, P, info)                     // art.js, save/restore og fallback følger med
     → look.drawEnemy(ctx, P, info):
         ankret i fotpunktet (P.x, P.y)
         1) bakkeskygge
         2) kropp fra bakt sprite (retning = round(P.facing/(π/4)), frame = walkPhase)
         3) glødlag med 'lighter' (puls, telegraph, hurt)
         4) return true
```

`layer: 'corpse'` tegner liket på bakken.

**Eierskapsregler:**
- Fiende-design skriver aldri til `pose.js` eller AI-tilstanden.
- Ashmaw og en boss-type finnes ikke i `stats.js` ennå. Fiende-AI må legge til `type: 'boss'` (eller en variant) før Ashmaw kan registreres.
- Felt som utseendet trenger, men som P ikke har ennå (f.eks. «sekker igjen» for Spitter, «kjerne knust» for Alpha, «ventiler åpne/ødelagt» for Ashmaw), bes lagt til i `poseOf`. Vi leser dem ikke fra `e` direkte.

## Utseendet i spillet: `game/src/enemies/look/` (Husk og Lurcher, demo brett 1)
Gjelder bare Husk (grunt) og Lurcher (flanker). Kiln, Spitter, Kiln Alpha og Ashmaw venter til etter demoen.

**Filer (alle i `game/src/enemies/look/`):**
- `index.js`: registrerer `grunt` og `flanker` med `registerEnemyArt` i `../art.js`. `drawEnemy(ctx, P, info)` velger positur ut fra `P` og tegner bare ferdigbakte bilder med `drawImage`: skygge, kropp, glød (`lighter`) og treffblink. Ingen `shadowBlur`, `filter` eller gradient per ramme.
- `kinds.js`: typedefinisjoner med 16 vinkelbøtter (`DIRS`) og posetsett. Husk: idle 3, walk 6, attack 5, hit 1 og die 3. Lurcher: idle 3, walk 6, run 6, attack 5, hit 1 og die 3. Her ligger også kontur, kantlys og skyggestyrke.
- `husk.js`, `lurcher.js`: modellene, bygd som fasetterte prismer og plater per riggdel. Husk er foroverbøyd og firbeint, med pukkel av kite-plater over en glødende kjerne, stjerneskjold, spydarm og pigger. Lurcher er lav og segmentert, med pigger, rød krage og hale.
- `facet.js`: primitivene `prism`, `plate`, `frame` og `outlines` (kite, scute og star). Datamodellen er bygd for å kunne byttes mot Karakters `shared/rig/faceted/` senere.
- `paint3d.js`: projeksjon (PROJ) og maling per fasett fra `LIGHT_DIR`/`LIGHT_ELEVATION`: lambert-rampe, støy, AO mot bakken, varm underglød, mørke eller glødende sømmer, kantlys på lyssiden og glanspunkt. `kin.js` har enkel IK og skrittsyklus.
- `mats.js`: materialene, alle mørkere enn Wardens #5a6068. Ingen cyan eller blått. Kantlyset er varmt (255,228,178), mens Warden har kaldt kantlys (#dfe6ea).
- `bake.js`: baker i nettleseren, ikke til filer. Bildet males med 3× overskalering og skaleres ned. Kontur (0,9 px) og kantlys (1 px) legges på silhuetten. Gløden beskjæres til synlig område, og skyggen bakes i halv oppløsning. Alt pakkes i ett delt atlas på 1024×1024-sider med hyller, og fulle sider forsegles til `ImageBitmap`.

**Bruk av poseOf (bare lesing, med trygge standardverdier):** `type`, `id`, `x`, `y`, `facing` (0, 16 bøtter) og `anim` (ellers utledet av `firing`/`telegraph`/`throw`/`melee` → attack, `moving` → walk, ellers idle). `attackPhase` (0–1) velger angrepsbildet, ellers brukes `telegraph.progress`/`firing`/`melee`. `walkPhase` låser gangen til tilbakelagt vei, ellers brukes tid × `speed`. Lurcher går over i run ved `speed` over 160 eller `flanking`. `hitAt` gir rykk bakover og blink i 0,14 s (ellers `hurt`), og `stagger` gir skjelving og dempet glød. `rise.progress` klipper figuren ved gulvet mens den stiger opp. `dead` og `corpseT` gir die-bildene, og liket blekner bort på 10 s. Glød-pulsen bruker `world.time` og `id`. Mangler et felt, brukes standardverdien. Finnes ikke bildet ennå, bakes det med en gang (budsjett 4 ms per 12 ms), ellers brukes nærmeste ferdige bilde. Er visningen ikke `'34'`, returneres `false`, og plassholderen brukes. Målt `fallbacks` = 0.

**Cache, ytelse og minne (målt 23.10, headless Chromium med swiftshader, altså CPU-rendring):**
- Tegning: én skygge, én kropp og én glød, altså 3 `drawImage` per fiende. Med 12 fiender er rammen 9,31 ms mot 9,19 ms uten fiender, altså ≈ 0,01 ms per fiende når cachen er varm. Plassholderen kostet til sammenligning ≈ 5 ms per fiende. Første ramme etter oppvarming koster mer fordi atlaset lastes opp, rundt 0,6 ms per fiende én gang.
- Oppvarming: 672 bilder (Husk 288, Lurcher 384) tar 7–15 s CPU på denne maskinen, og den er tregere når maskinen er belastet. Arbeidet går i bakgrunnen i biter med 40 ms pause og starter ved første tegning. Det som vises, bakes ved behov.
- Minne: atlaset tar 40 MB i 10 sider, hvorav 29 MB brukes (Husk 18, Lurcher 11). `docs/YTELSE.md` finnes ikke, så det er ikke bekreftet mot noe budsjett.

**Kiln og Kiln Alpha (etter demoen):** Kiln skal få sømmer som følger platekantene (`seam: 'glow'` på plater i stedet for symbolstreker). Kiln Alpha skal få en hale av 5–6 avsmalnende prismer med gløderygg langs ryggen.

**Må gjøres av andre:**
- **Fiende-AI:** legg til `import './look/index.js';` i `game/src/enemies/index.js`. Ingenting importerer `look/` ennå, så uten denne linjen vises plassholderen i det vanlige spillet. Gi gjerne `hitAt` og `deathAt` i `poseOf` (de brukes hvis de finnes).
- **Karakter:** når `shared/rig/faceted/` er klar, byttes `look/facet.js` og `look/bake.js` ut. Det som må samkjøres: delene beskrives som punkter, radier og materiale, monstrene har 16 bøtter, kantlyset settes per figur, og det trengs et bake-API som returnerer {body, glow, shadow, anker}. Ingen rigg-hooks trengs nå.
- **VFX:** ikke noe nytt. `look/` tegner ingen partikler, blod eller gnister, bare kroppens egen glød.

## Status
- **Klart:** designark, malte referanser, volummodeller med konsistente visninger, farger, lysmønster og animasjonsliste.
- **Gjort 23.10:** Husk og Lurcher i spillet via `look/` (se over), kantet og malt, med 16 vinkelbøtter. Bildene ligger i `shots/fiende-design/`.
- **Venter:** importlinjen fra Fiende-AI, slik at `look/` brukes i det vanlige spillet.

## look/ v2 (2026-10-26) – erstatter tall og bake-beskrivelse over
- Utseende følger variant C-retningen: mørk kitin, store organiske plater, røde glødesprekker (#c0392b-glød, Lurcher #8e1e1e). Husk: lav firbeint, tydelig hode, bladarm med 3 sagtenner, 2 ryggpigger. Gammelt Warden-preg på Husk er borte.
- Husk skala 1.18 → bbox ~61×50 px mot Warden 58×39 (1,05× høyde). Kollisjonsradius 15 (30 px) er smalere enn ~50 px visuelt.
- Treff: varmhvit tint 70 ms + rykk bort fra treff 140 ms, i runtime (ingen re-bake).
- Baking: `bakeone.js` (felles) + `worker.js` (2 modul-workers, OffscreenCanvas → ImageBitmap → `cache.warm`). Reserve: idle 0 × 16 retninger bakes ved lasting (~0,28 s). Bom gir fallback (samme sett f0 → idle0 samme/nabo-retning), aldri sync-bake i spillramme. Glød lagres i halv oppløsning. Brytere: `?monsterWorker=0`, `?monsterReserve=0`.
- Tall: CPU ~1,8–1,9 s (352 sprites), minne 14,1–14,4 MB (cap Husk 10, Lurcher 6), maks bake i spillramme 0 ms, tegnekall 0,015–0,03 ms/fiende.
- Gammel `look/bake.js` fjernet (flyttet til /tmp/fd-trash).

### v2-tillegg 26.10 (etter godkjent v2): Lurcher/Husk-finpuss + Spitter og Kiln inn
- Lurcher: egne materialer (lchitin/lplate/lbone/lfrill): nesten svart kitin med varm rødbrun undertone, smalt varmt kantlys (rim 0,6 px '220,124,78'), hinne/årer #8e1e1e med lys kjerne i øyne og krage.
- Husk: sprekkene er nå forgrenede, uregelmessige revner (seedet tilfeldig vandring langs skallbuen, 7 stammer, opptil 2 nivåer greiner), tykkest og varmest i knutepunktene, avtar mot endene.
- Spitter (`grenadier`, spitter.js): høyreist tobent, nesten svart kitin, TRE fiolette sekker (#9b59ff) på ryggen. Kast: arm bak over skulderen (windup), pisk fram (release), fremste sekk krymper/lyser og en slange gløder. `P.sacksLeft` < 3 → sett `walk#2` osv. (tomme sekker mørke), bakt ved behov, reserve = 3-sekkersbildet. Granaten tegnes av AI/Våpen.
- Kiln (`heavy`, kiln.js): lav, bred, store mørke plater med oransje sømmer (#ff7a1a) langs ytterkantene (ikke kryss), ovnskjerne bak, tromme med seks løp på høyre arm. atk 0–0,5 oppspinning (tromma roterer, kjerne/kammer hetes), 0,5–0,8 skyting med rekyl, 0,8–1 nedspinning. Munningslys = VFX. `KILN_MUZZLE` eksportert (lokalrom).
- Begge: idle 1, gange 4, angrep 4, død 2 bilder × 16 retninger; samme bakeone/worker/reserve. Kinds har `maxMB` per type (Husk 10, Lurcher 6, Spitter 6, Kiln 8).
- Tall (alle fire): ~3,3–3,4 s CPU (Spitter+Kiln ~1,3 s), 23,3–24,3 MB (Spitter+Kiln ~9,3 MB), 0 sync-bakes, 0,015 ms/tegning.
- v4 26.10: Kiln-plater/kitin/tromme kald-nøytral slagg (kplate mid 19,18,18; KMETAL i kiln.js), sømmer/kjerne uendret. Lurcher rim a 0,8 / 0,8 px '232,140,88', lplate/lchitin hi+edge lysere.

## v4.1 – minnerunde (2026-10-26)
- Trim av kropp til alfa>3 (ankre forskjøvet, uendret verdensposisjon); skygge kvart oppløsning; glød halv (uendret).
- Retninger per sett: die 4, Spitter-sekkvarianter 8 og kun idle/gange (angrep bruker basis).
- Husk angrep 4→3 faser.
- Egen reservecache per type (idle 0 × 16 retn.) så hardt LRU-tak aldri tvinger synkron baking.
- Harde tak (MiB, hovedcache): Husk 7.6, Lurcher 4.4, Spitter 4.6, Kiln 4.3.
- Verste tilfelle (alle sett×faser×retninger): Husk 7.49, Lurcher 3.88, Spitter 4.76, Kiln 4.07 = 20.2 MiB, 808 sprites (tools-fiende-design/worst-case.cjs).

## Hunker (#e0c234, svovelgul) – cover-bruker (27.10, kun probe)
- Krumbøyd menneskeudyr: kuppelformet beltedyrrygg (6 bånd × 3 forkullede beinplater, gule sømmer/sprekker), menneskearmer/-hender
  rundt grov slaggrifle, lav hodeskalle med snute og gule øyne, digitigrade bein, kort platehale. Fil: look/hunker.js, type-id 'hunker'.
- Poser/sett: idle 1, walk 4, walkc 4 (krumbøyd sprint ved cover ≥ 0,3, 8 retn.), cover 4 (peek-trinn 0, ⅓, ⅔, 1),
  attack 2 (kun reist; blink bare i bilde 0), hit 1 (8 retn., kun uten shieldHit), die 2 (4 retn.).
- Høyder (scale 1.0, PROJ-felles): dukket topp z ≈ 20,8 (< low 24), reist topp ≈ 34,6, rifla z 27. HUNKER_MUZZLE = { fwd: 20, z: 27 }.
- poseOf: anim ('walk'|'cover'|'fire'/'attack'), cover 0–1, peek 0–1, coverFacing (rad, ellers facing), attackPhase, hitAt, shieldHit.
  shieldHit → 3 forhåndstegnede gnistsprites (120 ms) på skjoldet, ingen tint/rykk.
- Minne: tak 4,5 MiB; verste tilfelle 224 sprites / 3,36 MiB. lazyWarm: bare reserve (16) ved oppstart, resten når typen tegnes første gang.
- Probe: tools-fiende-design/hunker-probe.html (+ .cjs). Skjermbilder: shots/fiende-design/hunker-*.png.

### Hunker v2 (2026-10-27, vises kun i proben)
- Utseende: skala 1,2 (HUNKER_SCALE, radius 18 uendret); kull/svart kropp (HPLATE mid 13,13,13), glød #e0c234; 4 bånd med store overlappende plater og gule sømmer (tverr + langs). Pigger reduseres i cover.
- Vinkel: paint3d.view() leser PROJ.zScale/groundScaleY/tiltDeg ved kjøring; sprites bakes i skjermplan (unsquash 1/G); cache-navn får |T<tilt> (VIEWKEY); workere får ?tilt via location.search. Gjelder alle fem typer. projection.js er ikke endret.
- Dukket (cover 0): topp z 18,6 (verdensenheter, skalert); stående 39,3. Ved tilt 75 og senter 18 bak coverets bakkant: 3,1 enheter under siktlinjen; probe-piksler: 0 lekkasje, margin 1,3 px (zoom 1,5), også ved coverFacing ±0,4 rad. Ved tilt 30 stikker den 35–37 px opp, så skjult-garantien gjelder bare ved 75.
- Peek-trinn 1–2 stikker trinnvis opp (tillatt). Munningsflamme bare ved peek 1 + attackPhase.
- HUNKER_MUZZLE = { fwd: 23, z: 27 } (fwd var 20, z uendret).
- Minne worst case (tilt 75): hunker 3,76 MiB, alle fem 17,58 MiB. Tilt 30: 4,04 / 20,79 MiB.

### Hunker v2 – tilt 55 og kamerazoom (2026-10-27, erstatter 75-tallene over)
- Vinkel: tiltDeg 55 fra loddrett (Z 1,43, G 0,57), testet med ?tilt=55 (projection.js uendret). Alle fem typer bakes i skjermplan via paint3d.view().
- Dukket Hunker: bekken −4, bryst 4,5, presset 10 fram mot muren (kroppen går ~19 inn i murens volum, skjult av muren). Geometri: 4,9 under siktlinjen ved 55. Probe-piksler (kropp, ikke bakkeskygge): 0 lekkasje, margin 1,3–4,3 px ved zoom 1,5 og 2,7–5,7 px ved zoom 2 (coverFacing ±0,4). Sømmene ulmer uten halo når den er dukket.
- Bakeoppløsning D = kamerazoom (enemies/look/zoom.js): PROJ.zoom → ?zoom= → 1,5 (core/camera.js). Avrundet til 0,25, ligger i cache-navnet. 1:1 skjermpiksler, ingen oppskalering.
- Ved D ≥ 1,75 får angrepsposer for grunt/flanker/grenadier/heavy 8 retninger (var 16). Hunker beholder 16.
- Minne worst case ved 55: zoom 1,5 = 19,36 MiB (hunker 4,0); 1,75 = 22,91; 2 = 29,47 (hunker 6,89). Spill (probe-waves) zoom 2: 22,08 MiB.

### Arena-standard tilt 55 / zoom 2 (2026-10-27)
- Lest i ekte spill (uten URL-parametre): camera.zoom 2, PROJ.tiltDeg 55, G 0,574, bakezoom D 2 (workere likt, cache D2|T55.0).
- zoom.js: PROJ.zoom → ?zoom= → samme regel som camera.js DEFAULT_ZOOM (2,0; legacy 1,5). camera.js eksporterer ikke verdien, så regelen er speilet; Arena bør eksportere PROJ.zoom.
- LRU-tak: maxMB × (zoom/1,5)² (MEM_K 1,78). Gange/stående har fulle 16 retninger; angrep 8 for de fire gamle.
- Ekte spill bølge 1–5: 22,62 MiB cinder (0 utkastinger), 0 plassholdere, 0,009 ms/tegning. Worst case alle sett: 29,47 MiB.
- Verktøy: tools-fiende-design/probe-game55.cjs (bilder spill-55-zoom2-*.png).

### Zoom 2,25 (2026-10-27 13:27)
- camera.js eksporterer ikke DEFAULT_ZOOM → zoom.js speiler regelen (2,25; legacy 1,5). Verifisert i ekte spill uten parametre: camera.zoom 2,25, tilt 55, D 2,25, MEM_K 2,25, cacher D2.25|T55.0.
- Usynlige kutt ved zoom ≥ 2: glød i kvart oppløsning (var halv), skygge 1/8 areal (var 1/4); hunker hit 4 retninger (var 8). A/B på skjerm: ingen synlig forskjell utover mykere glødkant.
- Worst case: 37,36 → 31,37 MiB (kropp alene 29,5). Ekte spill bølge 1–5: 24,43 MiB, 0 utkastinger, 0,012 ms/tegning.
- Under 30 krever synlige kutt: f.eks. hunker attack 8 retninger (≈ −0,6) + død 2 retninger, eller lavere bakezoom. Forslag: tak 32 MiB.

### Tak 32 MiB + PROJ.zoom (2026-10-27 13:45)
- zoom.js leser PROJ.zoom direkte (Arena-eksport; ?zoom=N overstyrer, ?view=34 = 1,5). Kopiert regel fjernet. ?camfollow=0: bakes ved PROJ.zoom (kan bli litt uskarpt, akseptert).
- Tak: MEM_TOTAL_MB = 32 (zoom.js), fordelt per type etter memShare i kinds.js: husk 8,75, lurcher 4,6, spitter 6,7, kiln 5,0, hunker 6,95 (sum 32). Reservecacher (≤ 3 MiB hver, målt 2,9 totalt) kommer i tillegg.
- Verste tilfelle 31,37 MiB < 32 totalt, men hunker alene (7,16) er litt over sin andel 6,95. Kiln i spill (4,85) er over worst-case-tallet (4,39): spillet baker kiln-nøkler worst-case.cjs ikke teller.
- Ekte spill bølge 1–5: 24,69 MiB, 0 utkastinger, cacher D2.25|T55.0.

### Hunker i ekte spill, yard-v2 (2026-10-27 14:00)
- game/index.html uten parametre (yard-v2, tilt 55, zoom 2,25), Hunker spawnet via enemies.createEnemy. Verktøy: tools-fiende-design/hunker-yard.cjs (MODE=shoot).
- Dukket bak kasser (spot 26:n:1, 21 px bak bakkanten): pikseldiff med/uten Hunker (simulering frosset) → 0 kroppspiksler over coverets topplinje, 5,1 px margin (zoom 2,25). Posituren er uendret.
- depth.js tegner skjulte aktører som røntgen-silhuett oppå coveret (1153 px). Det er Arenas lesbarhetsgrep, ikke lekkasje. HUD-ringen rundt mål ligger også over.
- Avvik hos Fiende-AI: telegraf/skudd skjer ofte ute i det åpne (før dekningen er nådd), og crouch i seekCover blir 0,23 (ikke 0,4–0,6), så sprinten tegnes som vanlig gange.

## Hunker v3-utkast (A/B, bak flagg)
?hunkerVar=A: lys beinkuppel, rifle port arms. ?hunkerVar=B: bred flat rygg m/ sidepigger, mørke plater, kraftige gule sømmer, rifle langs høyre hofte. Begge: kolbe, lys munning, større snutehode, skulderplater, brystsprekker. Ark: shots/fiende-design/hunker-v3-varianter.png.

## Hunker v3 standard (A + pigger fra B)
Kuppel lerp 0,82→1,45 med peek i dekning (dukket ellers 34 px over). memShare: Hunker 7,5, Spitter 6,15 (sum 32). Verste fall Hunker 8,04, totalt 32,25. Bølge 1–5 24,64 MiB, 0 utkastinger. ?hunkerVar=B / =0 (v2) beholdt.

## Hunker v3b
Peek/skudd: rifla vinklet 0,44·aim rad (~25°) til høyre, stokk 2,5 px ut, tykkere armer. HUNKER_MUZZLE = {fwd 23,3, z 27, side 12,1} (ny side). Skulderplater senkes og kuppel 0,72 når dukket. Verste fall Hunker 8,14, totalt 32,35 MiB. ?hunkerRifle=0 = gammel rifle.

## Sjefsutkast v2.2 (27.10, ikke i spillet)
Fasit: maleriene 23.10 (i hjørnet av arkene). Silhuett-test: reviews/img/cinderborn/sjefer-v2.2-silhuett.png (S/SE/E/N, alfa → svart).
- Kiln Alpha (skala 1,6, r≈42): firbent urtidsbeist. Lang tung snute med underbitt og oppstikkende tenner, glødende kjeft med slaggdrypp, høy buet rygg med store piggplater i to rader, glødende kjerne mellom platene (svakhet, leses bakfra/N), avrundede muskuløse bein med klør, tykk avsmalnende hale. Ingen skorsteiner.
- Ashmaw (skala 2,4, r≈75 for kroppen; armene rekker lenger): ujevn masse som stiger opp (base → bryst → skjev pukkel med horn), overlappende panserplater med glødende sprekker, tungt panserbryn, bred åpen kjeft med tannrekker oppe/nede, glødende svelg og slaggdrypp, to tunge forlemmer med fire klør, korte stumper bak. Svakhet: skrå gjellespalter på skuldre/flanker (ikke foran).

## Sjefsutkast v2.1 (27.10, erstattet av v2.2)
Fasit: maleriene kilnalpha-main.jpg / ashmaw-main.jpg (23.10), vist i hjørnet av arkene.
- Kiln Alpha (skala 1,6, ~190×224 skjermpx i S, foreslått r ≈ 42): firbent urtidsbeist, tykke søylebein med klør (forbein kraftigst, bakbein bøyde), skrå rygg med pukkel foran, stor piggkam, tykk hale, stort lavt hode med glødende kjeft og smelteslagg som drypper. N: bakre kjerne + skorsteiner (svakhet). S: hode, kjeft, støttenner.
- Ashmaw (skala 2,4, ~340×293 skjermpx i S, ~151 verdenspx bred, foreslått r ≈ 75): høy kuppelovn av panserplater, seks korte stolpebein, innfelt ovnskjeft med tannbue foran, skrå gjellespalter rundt ringen (svakhet), ingen runde «øyne».
- Ark viser ekte Warden (drawWardenC, tilt 55 / zoom 2,25) og ekte fiendesprites i samme skala.

## Sjefsutkast v2 (27.10, erstattet av v2.1)
- Kode: tools-fiende-design/sjef-utkast/sjefer.js (samme fasett-rigg), ark.cjs. Vinkel: standard tilt 55 / zoom 2,25; ?view=34 = gammel 36,9° / 1,5 (eget utsnitt).
- Kiln Alpha: lang, lav seksbent ovnsøgle, sagtakket piggkam + sidepigger, hale, stødtenner. Skala 1,55 → ca. 76×84 verdens-px (≈ 2,4×2,6 ruter). Foreslått r 34 (Kiln 18). Svakhet: bakre kjerne med åpen rist og to skorsteiner (glød #ff7a1a, aksent #fff0b0); fremre kjerne mindre under skjoldplate.
- Ashmaw: kuppel med lagdelte plater, åtte gjelleventiler i ring (puls forskjøvet, svakhet), ovnskjeft med tenner og kjevehorn, åtte segmenterte bein. Skala 1,75 → ca. 152 verdens-px bred (≈ 4,7 ruter). Foreslått r 70 (stats har 60). Palett #101012/#2c2826, glød #ff7a1a/#ffd27a, kjeft #ff5a1a.
- Ingen shadowBlur. Minne ikke budsjettert ennå (sjefene er ikke i cachen).
