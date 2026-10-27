# WARDEN – karakterspesifikasjon (utseende, rigg, rotasjon, gjenbruk for fiender)

Eier: Breach Karakter. Kode: `game/src/player/` og delt rigg i `game/src/shared/rig/`. Grunnlag: Warden- og fiendearkene i konseptkunsten, demoen `/workspace/breach/character-demo.html`, `docs/PROSJEKT.md` og `docs/CORE-API.md`.
**Fordeling:** Dette dokumentet beskriver utseende, rigg, ledd, rotasjonsregler, løsninger på demoens svakheter og gjenbruk for fiender. `docs/ANIMASJON.md` eier alle tall for tilstander, timinger, kontroller, treff, hendelser og tuning. Ved tallkonflikt gjelder `TUNING` i ANIMASJON.md §8.
Konvensjoner: 1 rute = 32 px, vinkel 0 = øst med klokka. Lokalt rom: +x = fremover, +y = figurens høyre side. Mål er i verdens-px. Kameraet står på zoom 1,5, så figuren er ≈ 45 skjerm-px.

---

## 1. Visuell beskrivelse (fra arkene)

Arkene viser «WARDEN – Tactical Operator» i to varianter, med panelene Top-Down Gameplay View, Color & Materials, Gear Details, 8 Directional Views, Silhouette & Readability og Animation Library. Han er en tungt pansret operatør, alltid litt huket, med geværet i low-ready diagonalt over kroppen. Mottoet er «Cover gives you time. Discipline turns it into wins.» Han er bredere enn fiende-Grunten og smalere enn Heavy.

**Deler og hvordan de leses ovenfra:**
| Del (ark) | Topp-ned-tolkning |
|---|---|
| Lukket hjelm med bredt cyan visir | rund hjelm (r ≈ 6,3). **Cyan visirbue foran** på ±55°, pluss en lys lengdestripe på toppen (Top-Down View) |
| Sandfarget skjerf / shemagh | sandfarget krage rundt hjelmen og **to skjerfhaler** som henger bakover over ryggsekken |
| Store skulderplater med blått felt og hvitt «Λ»-emblem | lyse, avrundede plater med en blå stripe på utsiden. Emblemet på venstre plate vises bare ved zoom ≥ 1,5 |
| Plate carrier og magasinlommer | lys brystplate med rygg, mørk kjerne og lommer på beltet |
| Ryggsekk med cyan statuslys og antenne | mørk boks bak med 1 cyan LED og en kort antenne (demo) |
| Modulært automatgevær med sikte og stort magasin | lang mørk rifle med en blå strek og en cyan prikk på siktet. Det tydeligste retningssignalet |
| Knebeskyttere og støvler | synlige bare i steg og på kne |

### 1.1 Palett (følger demoen, som følger PROSJEKT.md)
Rustning mørk / mellom / lys `#1a1e23 / #333a42 / #5b6570`. Lys rustning `#232930 / #444d57 / #727e8a`. Drakt `#141619 / #23272c / #3a4048`. Skjerf `#6e5232 / #a8814f / #d8b67e` (basis tilsvarer PROSJEKT `#8a7a5c`). Våpen `#15181b / #2b3036 / #59626c`. Blå aksent `#3c86c8`, lys `#7cc4ff`, cyan visir `#61e9ff` / `#2fc3e8` (PROSJEKT `#39c6ff`). Kontur `rgba(7,9,11,.92)`.
**Cyan er sparsom:** visir, LED på sekken, siktepunkt på våpenet og bakkering. Ingen fiende bruker cyan.

### 1.2 Hva som må leses i 28–32 px (prioritert)
1. **Sikteretning:** riflen stikker langt ut foran kroppen, og visirbuen lyser i front.
2. **Spillerfarge:** cyan visir og bakkering mot kald grå rustning.
3. **Bred «T»-silhuett:** skulderplater og rifle. Ryggsekken markerer baksiden.
4. **Hode skilt fra kropp:** sandkrage og AO-skygge under hjelmen.
5. **Positur:** høyde kodes som skyggeforskyvning, skala og beinbilde (§2.4, §5.2).
6. **Bevegelse:** støvler, knær og skjerfhaler.

Dette kan droppes i spillskala: kabler, slitasje og magasindetaljer. Lys fra miljøet (`#ffb347`) skal aldri farge Warden.

---

## 2. Riggen: lag, ledd og mål

### 2.1 Hierarki og pivoter (demoens mål, justert)
```
root (x,y)                           verden. Bakkering r 23 tegnes her (demo)
├─ shadow                            verden, 3 lag, forskyvning (5h+2, 7h+3), h = høyde 0,86–1,12
├─ hips   rot hipAngle               pelvis 11×20 ved (−6..5, ±10), belte med lommer
│   ├─ legL/R  kapsel 6,4 → 5,6      hofteledd (0, ±5,5) → kne → fot (2-ledd, kne mellom)
│   └─ footL/R støvel 11×6,4         verdensplantet (ANIMASJON §2.2)
└─ spine  rot torsoAngle             + høyde-skala, squash og lean-forskyvning
    ├─ pack      11×18 ved (−16,5..−5,5)   LED og antenne
    ├─ chest     kjerne ≈ 18×28, brystplate fram
    ├─ armL/armR skulderledd (+1, ±10) → albue → hånd. IK overarm 9,5 / underarm 10,5 (R), 10,5 / 12,5 (L)
    ├─ weapon    pivot = posens (bx, by, a, f). Grep R (5; 1,8), L (21,5; −0,9). Munning (39, 0) i våpenramme
    ├─ pauldronL/R ved (−2,5; ±11), 9,5×7 (endret, se §5.3)
    ├─ scarf     krage + 2 haler (verlet, §5.4)
    └─ head      rot headAngle, senter (1,8; 0), r 6,3 → visor
```
Total bredde over skulderplatene er ≈ 30 px (demo ≈ 34, smalnes inn §5.3). Dybden fra sekk til bryst er ≈ 25 px. Med rifle blir figuren ≈ 56 px lang. Riflen er bevisst lang, fordi den er retningssignalet. Den kortes ned til munning (36, 4) i torso-rom (ANIMASJON §6).

**Våpenposer** (demo `POSES`: `bx, by` = våpenets pivot i torso-rom, `a` = vinkel, `f` = forkortning langs x som gir perspektiv):
| Pose | bx | by | a (rad) | f | Bruk |
|---|---|---|---|---|---|
| aim | −1,5 | 5,6 | −0,05 | 1,0 | sikte, skudd, popUp, leanOut |
| ready | 1 | 6,2 | −0,5 | 0,86 | gange og idle (low-ready) |
| sprint | 5 | 3,5 | −0,95 | 0,7 | roadie run |
| cover | 4 | 4,5 | −0,32 | 0,56 | skjult i dekning |
| blind | 11 | 1,5 | mot sikte ±1,1 | 0,95 | blindfire |
| roll | 1 | 3 | −1,25 | 0,6 | rull, tett inntil kroppen |

### 2.2 Tegnerekkefølge (bunn → topp)
1. bakkering → 2. skygge (3 lag) → 3. bein og støvler (svingbeinet sist) → 4. pelvis og belte → 5. ryggsekk og antenne → 6. torsokjerne og brystplate → 7. støttearm, overarm → 8. våpen → 9. **skulderplater** → 10. **underarmer, albuer og hender** (over platene, se §5.3) → 11. skjerfhaler → 12. skjerfkrage → 13. AO under hjelmen → 14. hjelm og visir (glød med `shadowBlur`) → 15. effekter (munningsglimt, treffblink).
Unntak: I rullens mellomfase tegnes beina **over** torsoen (§5.1). Ved leanOut eller blindfire rundt venstre hjørne tegnes våpenet over hendene.

### 2.3 Lys
Lyset kommer fra nordvest (demo `LW = (−0,55, −0,85)`). Hver del får en gradient og en rim-forskyvning i lokal lysretning (`localLight()`), så lyset ligger fast i verden når figuren roterer. Det beholdes, fordi det gir volum i alle 360°.

### 2.4 Høyde ovenfra
Det finnes ingen ekte høyde. Høyde `h` er en fjær (demo: frekvens 2,4 Hz, demping 0,42, underdempet, så den spretter litt). `h` styrer torsoskala, skyggeforskyvning (5h+2, 7h+3) og beinskala (0,95–1,0).
Verdier: stående 1,0, roadie 0,97, rull 0,8, slide 0,84, kne i low cover 0,86, high cover 0,88, popUp 1,0, vault-topp 1,12. Impulser: impact −1,6, rullslutt −1,2, exitCover +0,8.

---

## 3. Styring av underkropp, overkropp og hode

- `aimAngle` er rå vinkel til musa. **Hodet** følger raskest (ω 40), maks ±30° fra torso, og leder.
- **Torsoen** følger sikte (ω 26, maks 14 rad/s) og begrenses aldri av hofta. Det er hofta som gir etter.
- **Hofta** følger bevegelsesretningen (ω 12, løp 16).
- **Roadie:** torso og hofte følger bevegelsesretningen (maks 5 rad/s). Hodet ser mot musa innenfor ±30°.
- **Rull, slide og dash:** torso og hofte låses til forflytningsretningen. Etter rull svinger torsoen tilbake til sikte med vanlig fjær, og det er follow-through.
- **I dekning:** hofte og torso vender mot dekningen (`fo = atan2(−ny, −nx)`, som i demoen). Skjult: torso = fo + 35 % av siktavviket, klemt til ±0,5 rad. Hodet ser mot musa (±30°). PopUp og leanOut: torso følger musa innenfor ±80° fra fo. LeanOut vrir i tillegg hofta 17° mot hjørnet.
- **Overlag** (rekyl, flinch, granatvri, gangvugg ±0,16 rad × 0,35) legges på *etter* fjæren, så de ikke forstyrrer utjevningen.

## 4. Rotasjonsbegrensning: grenser, utjevning, fotplanting

Tallene står i ANIMASJON §2. Reglene:
1. **Korteste vinkel:** `wrap()` til (−π, π] på alle feil. Målverdier lagres aldri uten wrap, så det blir ingen spinn når musa krysser vest.
2. **Fjærer:** kritisk dempede fjærer for hode, torso og hofte. Demoen bruker eksponentiell lerp (`dampAng`). Fjæren gir samme innsvingning, og i tillegg en vinkelhastighet som skjerfet og pivot-logikken kan lese.
3. **Vridningsgrenser:** I bevegelse klemmes hoftemålet til ±70° fra torso. Det gir krabbegang ved strafe og backpedal over 115°. Hard grense ±85°: hofta klemmes etter fjærsteget, og hoftens fart settes lik torsoens, så den «dras».
4. **Pivot-trinn:** Står han stille med |twist| > 60°, snur hofta til torso på 180–260 ms. Føttene løftes én om gangen (bakre fot først), og hver landing gir `footstep`. Ved kontinuerlig rotasjon kjedes trinnene, og føttene glir aldri.
5. **Fotplanting:** Støttefoten er låst i verden, og svingfoten går til neste plantingspunkt. Steglengden følger farten (26/20/18/40/12 px), så det blir ingen skøyting. Foten tvangsløftes ved > 1,4·L (knockback).
6. **Kne:** Beinet er tegnet som to kapsler med et kne som skyves 1,5 px utover. Under steg (løft) vokser støvelen ×1,16 og får et lite høylys, som i demoen.

---

## 5. Kjente svakheter i demoen og løsningen

### 5.1 Rullingen ser ut som tumling, ikke kollbøtte
Demoen klemmer torso-x med `cos(θ)`, flytter hodet med `sin(θ)·8` og skjuler det i en fase. Det leses som vugging fram og tilbake. En kollbøtte ovenfra må vise at **hodet går ned foran, ryggen ruller over og beina kommer over toppen**. Én rotasjon i fire faser (tider fra ANIMASJON §4.1, 500 ms):

| Fase (ms) | Hva vises ovenfra |
|---|---|
| **Dykk** 0–90 | Torsoen strekkes langs rulleretningen (x ×1,15, y ×0,95). Hjelmen glir fram 6 px og krymper til ×0,8, og visiret dimmes 50 %. Armene trekker riflen inn (`roll`-pose). Høyde 1,0 → 0,8 |
| **Over ryggen** 90–330 | Hjelmen er **skjult** (under kroppen). Ryggsekken flyttes til senter og tegnes **øverst**, siden ryggen nå vender mot kamera. Torsoen blir en kompakt «ball» (x 0,7, y 0,9). Et **høylysbånd** (2 px, 25 % hvitt, klippet til ballen) sveiper én gang fra framkant til bakkant og viser rotasjonen. Fra 200 ms tegnes **begge støvlene over torsoen**, og de vandrer fra baksiden (−10 px) over senter til framsiden (+12 px). Det er beina som kommer over toppen |
| **Landing** 330–420 | Føttene plantes foran (fwd +10, ±6) med `footstep kind:'land'` og støv. Ryggsekken går tilbake bak, og hjelmen dukker opp igjen *bak senter* (−4 px), med visiret tent på nytt. Han sitter på huk (høyde 0,8, skala 0,9). `camera.shake(1.5, 60)` |
| **Reise seg** 420–500 | Hjelmen glir fram til normal posisjon, høyden spretter 0,8 → 1,0 (impuls −1,2, demo), og riflen går til `ready`/`aim`. Torsoen svinger tilbake til sikte (follow-through) |

I tillegg: Skyggen holder full størrelse hele veien, men løftes litt i dykket (h 0,8). Det skal være 1–2 *etterbilder* (siste 2 tick, alfa 0,2/0,1) bare i 90–330 og støvspor (demo) bak. Bakkeringen roterer ikke. Hele figuren roterer aldri 360° i planet, fordi det ser ut som snurring ovenfra.

### 5.2 Huking og sliding leses dårlig ovenfra
Ovenfra blir huking bare en litt mindre figur. Løsningen er flere samtidige signaler:
- **Beinbilde (sterkest):** Kne i low cover: framfoten 9 px framme og til venstre, det **bakre kneet i bakken** og **leggen og støvelen stikker 18 px ut bak** sekken (demo `kn`). Støvelen er nesten flat (rotasjon 0,1), og kneet får en lys kneskål. Det gir en tydelig asymmetrisk, lang silhuett som stående aldri har.
- **Skuldre og hode:** Skulderplatene trekkes 2 px inn og 1 px fram (krummet rygg). Hjelmen går 2 px fram og ned (skala 0,94), og AO-skyggen under hjelmen øker til 0,55.
- **Skygge:** h = 0,86 gir skyggen (6,3; 9) → (4,3; 6). I tillegg skal en **kontakt-AO** ligge mellom Warden og dekningsflaten: en mørk gradient på 10 px langs flaten, 40 % alfa. Den viser at han «sitter tett».
- **Dekningsmarkering:** Langs flatesegmentet han sitter ved (±16 px), tegnes en tynn **cyan kant** (1,5 px, 35 %) på dekningens kant. Den blir 70 % ved `exposed`. Det er det topp-ned-spill trenger og Gears ikke gjør, og det er den raskeste lesningen av «jeg er i dekning».
- **Sliding:** Fart er ikke nok. Det trengs **baseball-slide** (demo `sl`-pose, forsterket): framfoten strekkes 14 px mot dekningen, bakbeinet er bøyd under, og torsoen lener 4 px *bakover* (motsatt fartsretning, så overkroppen ligger etter beina). Hjelmen er 2 px bak. Med det følger **støvstripe** bak (demo-partikler hver 22 ms), **2 etterbilder** (alfa 0,18/0,08) og **fartsstreker** (3 linjer à 10 px, 20 % hvitt) parallelt med bevegelsen. Stoppet er hardt: farten går til 0 på ett tick, hitstop i 2 tick, squash 0,88/1,08 og debris. Demoens myke innbremsing (`v = min(470, 70 + d·6,5)`) erstattes, fordi den tar bort Gears-smellet.

### 5.3 Armene skjules av skulderplatene
I demoen ligger skulderleddet (−0,5; ±10,5) rett under platen (−1,2; ±11,6, 11,2×8), og platene tegnes over armene. Dermed blir bare hendene synlige. Løsning:
- **Skulderledd ut og fram:** (+1, ±10). **Skulderplatene mindre og bakover:** 9,5×7 ved (−2,5; ±11). Det gir en skulderbredde på ≈ 30 px, innenfor kontrakten.
- **Platene følger armen:** Platen roteres med 35 % av overarmens vinkel og forskyves 1 px mot albuen.
- **Ny tegnerekkefølge:** overarm → plate → **underarm, albue og hånd øverst** (§2.2). Albuen er alltid synlig.
- **Albuen bøyes utover**, og IK skal gi albuen ≥ 13 px sideveis i sikteposituren for støttearmen (venstre). Den skal være utenfor platens silhuett.
- **Kontrast:** Underarmen bruker drakttone (`#23272c`) med 1,5 px kontur. Hanskene får et høylys (`#4a525b`) og en lys kant mot platen.
- **Roadie:** Armene pendler i motfase med beina, ±4 px, så de lever i løp.

### 5.4 Stive skjerfender
I demoen er halene en sinus pluss torsoens vinkelhastighet, så de beveger seg som én stiv pinne. Løsning: **verlet-kjede i verdensrom.**
- **Kjeder:** To haler, 5 punkter à 3,5 px og 4 punkter à 3,0 px. Festene ligger i torso-rom (−5,5; −2,5) og (−5,5; 1,5) og transformeres til verden hvert tick.
- **Integrasjon:** `p += (p − prev)·0.90 + a·dt²`. a = −0,6·kroppsfart (luftmotstand) + bakoverdrag 120 px/s² i torso −x + støy (perlin, 6 Hz, amplitude 40·fart/300 px/s²).
- **Begrensninger:** 3 iterasjoner. Avstand per ledd. Vinkel maks ±35° mellom ledd, så kjeden ikke knekker. Hold punktene utenfor hjelmsirkelen (r 7) og ryggsekkens rektangel.
- **Tegning:** Glatt kurve (kvadratisk gjennom midtpunkter) som smalner av fra 3,4 til 1,6 px, med kontur og høylys som i demoen. Enden får frynser (to 1 px streker).
- **Ved rull og slide:** Drag ×2. Ved hitstop: kjeden fryses ikke, slik at den svinger forbi (follow-through).
- **Kostnad:** 9 punkter × 3 iterasjoner per tick, ubetydelig.

---

## 6. Animasjonstilstander – oppsummering

Detaljer, avbrytbarhet, iframes og kurver står i **ANIMASJON.md §3–4**.

| Tilstand | Tid (ms) | Visuelt nøkkelgrep |
|---|---|---|
| idle | pust: sinus 2,1 rad/s, ±1,2 % | våpenvugg ±0,02 rad |
| walk / strafe / backpedal | 145 per steg (180 px/s, 26 px) | fotplanting, hofte vs. torso |
| run (roadie) | 138 per steg (290 px/s, 40 px) | lener 3,5 px, `sprint`-pose, armpendel |
| pivot-trinn | 180–260 | 2 fotsteg |
| roll | 500 (iframes 60–300) | kollbøtte i 4 faser (§5.1) |
| slideToCover | 33 + d/400 + 33 hitstop + 80 + 120 | baseball-slide, hard stopp, squash (§5.2) |
| inCover hidden / glide | – (glide 95 px/s) | kne, kontakt-AO, cyan kant |
| popUp / leanOut | 140 / 160 | høyde 1,0 / 20 px forbi hjørnet |
| blindfire | løft 100, hold 300 | `blind`-pose, hodet nede |
| coverToCover / swatTurn | løp + slide / 300 | lav, sprint-positur |
| vault | 400 | høyde 1,0 → 1,12 → 1,0 |
| exitCover | 160 | høydeimpuls +0,8 |
| fire / reload | 100 per skudd / 1800 | rekyl 3,2 px, hylser |
| grenade | 500 | arm bak, slipp ved 260 |
| flinch / stagger | 120 / 380 | 4° / 18° bort fra kilden |
| death | 1100 | flat, visiret slukker |

---

## 7. Gjenbruk av riggen for fiendene

Mål: **Én datadrevet rigg** (`createRig(def)`) for Warden og alle fire fiendetyper. Fiendene får samme fotplanting, vinkelutjevning, lys og skjerf- og kappefysikk, uten at Fiende-AI skriver tegnekode. Riggen eier bare utseende og sockets. Skade, hitbox og AI eies av de enkelte rollene.

### 7.1 Felles API (forslag)
```js
const rig = createRig(def);
rig.drive({ x, y, vx, vy, aimAngle,
            mode,                 // 'idle'|'walk'|'run'|'cover'|'aim'|... (fra eierens tilstandsmaskin)
            height,               // 0.8..1.12
            cover: { nx, ny, type, atCorner } | null,
            aimBlend, peek, blind });
rig.play(clipId, { onEvent });    // engangsklipp: 'roll','fire','reload','throw','hurt','death', ...
rig.update(dt);                   // fjærer, gange, verlet, klipp → [{type:'footstep', ...}, {type:'release'}]
rig.draw(ctx, camera, { flash, alpha });
rig.socket('muzzle')              // → {x, y, angle} i verden; også 'head', 'handR', 'throwHand'
rig.pose                          // { hipAngle, torsoAngle, headAngle, phase } (les)
```
Klipp er data: `{ duration, tracks: { height:[[t,v],…], weaponPose:[…], torsoLean:[…], headOffset:[…] }, easing, events:[{t, name}] }`.

### 7.2 `def` – hva som parameteriseres
| Felt | Innhold |
|---|---|
| `scale` | global skala (Warden 1,0) |
| `proportions` | skulderspenn, torso, hjelm-r, pakke/kappe, armlengder, beinlengde |
| `parts` | liste `{id, bone, shape, size, offset, palette, layer}` (hette, kappe, gassmaske, trommel, granatbelte) |
| `palette` | `{armor[3], armorL[3], suit[3], fabric[3], accent, glow, outline}` |
| `weapon` | `{kind, length, grips, muzzle, poses:{aim, ready, sprint, cover, blind}}` |
| `limits` | `{headOmega, torsoOmega, hipOmega, torsoMaxRate, headMax, twistMove, twistHard, pivotThreshold, runTurnRate}` |
| `gait` | `{strideWalk, strideRun, footSpread, stepWeight}` (stepWeight styrer bob, rist og lydnivå) |
| `cloth` | verlet-kjeder `{anchor, segments, length, drag, stiffness}` (skjerf, kappe, hette) |
| `clips` | tilstandssett: hvilke klipp typen har, og overstyrte tider |

### 7.3 Per fiendetype (fra fiendearkene)
| | Grunt | Flanker | Heavy | Grenadier |
|---|---|---|---|---|
| Rolle | standard infanteri, holder linjen | rask, angriper fra sidene, unnamanøver | pansret, undertrykkende ild | granater, tvinger deg ut av dekning |
| Farge | rustning mørk, rødt `#c0392b` | mørk, hette `#8e1e1e` | mørk, glød `#ff7a1a` | sand og mørk, `#9b59ff` |
| Signatur ovenfra | hjelm med rød-oransje visirspalte og røde skulderfelt | spiss hette og **kappe** (verlet, 6 ledd, slenger i fart), knivblad | massiv rygg- og ammotank, glødende brystkjerne (puls 1200 ms), minigun-trommel | gassmaske med to lilla linser og granatbelte over brystet |
| `scale` / r | 1,0 / 14 | 0,92 / 13 | 1,25 / 18 (36 px, godkjent av Breach) | 1,0 / 14 |
| Gå / løp px/s | 120 / 200 | 150 / 280 (sprint 320) | 70 / – | 110 / 190 |
| Steg gå / løp px | 22 / 34 | 22 / 42 | 20 (280 ms/steg) / – | 22 / 34 |
| torsoOmega / hipOmega | 18 / 12 | 26 / 18 | 8 / 6 | 18 / 12 |
| twistMove / Hard | 65° / 80° | 85° / 100° | 40° / 50° (hele kroppen snur) | 65° / 80° |
| Våpen | rifle, munning 32 | SMG, munning 22 | minigun, munning 40, bredde 6 | karabin, munning 26 |
| Unike klipp | `takeCover` (ingen kamerarist), `peekCover` | `aggressiveSprint` (lener 12°, armer bak), `dodge` (sidesprang 300 ms, 96 px, bruker rullemotoren), `flankMove` | `heavyWalk` (bob 1,5 px, vugg ±3°, `footstep kind:'heavy'` med `camera.shake(0.8, 80)` innen 200 px fra Warden), `spinUp` 600 ms, `brace` 300 ms, `suppressStance` | `throw` (opptrekk 350, torso −30°, slipp 420, follow-through 250, lilla glød i hånden fra start som varsel), `retreatToCover` |
| Felles klipp | idle, walk, run, aim, fire, reload, hurt, death | samme | samme uten run | samme |

Treff mot fiender bak low cover kan bruke samme `entity.coverHitChance` som spilleren (core leser den; ellers 0,35). Fiendene har bevisst lavere omega enn Warden. De snur saktere, så spilleren ser hvor de sikter før de skyter. Det er rettferdig og lesbart. Heavy sin trege rotasjon er en mekanikk: flank ham. Alle fiender: varm palett, ingen cyan, visir eller øyne i typens glødfarge, og hvitt treffblink i 60 ms.

### 7.4 Modulplassering (avklart)
- **`game/src/shared/rig/`**, eid av Breach Karakter og brukt av Fiende-AI: `rig.js` (createRig, draw), `angles.js` (wrap, springAngle), `gait.js` (fotplanting), `ik.js`, `cloth.js` (verlet), `clips.js` og `defs/warden.js`. Fiendenes `defs/*.js` og unike klipp ligger i `src/enemies/`, som eies av Breach Fiende-AI.
- I samme mappe: `game/src/shared/separateActors.js` (myk separasjon mellom spiller og fiender, ANIMASJON §5.3 punkt 10).
- **Regel:** API-endringer varsles til Fiende-AI. Nye `def`-felt er valgfrie og har standardverdier, så eksisterende fiende-defs aldri brekker.

---

## 8. Bevisste avvik fra konseptkunsten
- Arkene viser 8-retnings-sprites i 3/4-perspektiv. Vi bruker en prosedyrisk topp-ned-rigg med kontinuerlig rotasjon, og høyden kodes med skygge, skala og beinbilde.
- Riflen er lengre i spillet enn på arket (munning 36 px fram), fordi den er det viktigste retningssignalet i liten skala.
- Heavy på 36 px er over 28–32 px-kravet, men godkjent av Breach.
