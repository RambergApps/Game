# Ytelse – Breach (eies av Arena)

Oppdatert 26.10 14:55 (UTC+1). Gjelder brett 1 (Kessa Yard) i trekvart (view 34).

## Metode
- **Standard målescenario:** Kessa Yard, view 34, 1600×1000, 10 s måling etter 1,5 s oppvarming, ≥ 3 repetisjoner (ny side hver gang). Rapporteres som median av repetisjonenes median og p95 per bilde.
  - Typisk: 6 fiender, mål 8 skudd/s, 1 eksplosjon/6 s, ca. 40 % av syntetiske skudd mot høy dekning, 0,5 dødsfall/s.
  - Tung: 10 fiender, mål 20 skudd/s, 3 samtidige granater hvert 4,5. s (= 1 per 1,5 s), 2 dødsfall/s med gjenoppliving.
  - Fiende-AI skyter i tillegg selv, så faktisk rate ble høyere: typisk 10–15 skudd/s (4–5 dekningstreff/s), tung 24–27 skudd/s (10–12 dekningstreff/s). Eksplosjoner: typisk 0,13–0,26/s, tung 0,37–0,5/s (litt under målet fordi siste salve ofte ikke rekker å gå av i vinduet).
- **Verktøy:** `cd game && node src/arena/_tools/brett1-bench.cjs --scenario=typical|heavy [--reps=3] [--secs=10]`. Spillet kjører i sin egen rAF-loop. Verktøyet setter inn en egen `world.perf` som samler loop.js sine `world.perf.mark`-merker (system = neste merke − dette). Med `--flush=1` (standard) kalles `getImageData(1×1)` før hvert render-merke, så rasteriseringen havner på systemet som bestilte den. Det gir litt overhead (inkludert i tallene), men en ærlig fordeling. Den eldre `perf-scenario.cjs --bench` (synkron segmentmåling) virker fortsatt, men er ikke brukt her.
- **VFX alene:** `game/src/effects/test.html?scenario=typical|heavy&q=high|medium|low` (NB: parameteren er `q`, `quality` blir ignorert), 3 repetisjoner.
- **Maskin:** boksen, headless Chromium (chrome-headless-shell 1243), programvarerasterisering uten GPU, 8 kjerner, delt med andre agenter. **Load average under målingene: 8–12 (typisk) og 8–9 (tung, første serie).** En ny tung serie klokken 14:52 gikk med load 13–24 og er forkastet. **Alle tall er usikre** og trolig 2–4 ganger høyere enn på en vanlig maskin med GPU. Bruk dem relativt (hvem bruker mest), ikke som absolutte FPS-tall.
- Tidsoppløsningen i Chromium er 0,1 ms. Verdien 0,0 betyr under 0,1 ms.

## Målt ms per system (median / p95 per bilde, median av 3 repetisjoner)
| System (merke) | Typisk | Tung |
|---|---|---|
| update totalt | 0,6–0,7 / 3,4–4,7 | 1,7 / 5,4 |
| · update: enemies (AI) | 0,2–0,3 / 2,0–3,1 | 0,7 / 3,3 |
| · update: projectiles (inkl. coverHit → dekal-baking) | 0,0 / 1,1 | 0,2 / 2,0 |
| · player / weapons / effects / level / physics / arena | ≤ 0,1 / ≤ 0,4 | ≤ 0,2 / ≤ 0,5 |
| render:arena (gulv, `arena.draw`) | 2,1–2,5 / 2,6–3,7 | 2,3 / 3,4 |
| render:sorted (`drawSorted`: dekningssprites + aktører + toning) | 2,9–3,5 / 3,9–5,2 | 4,0 / 9,3 |
| render:enemies (tillegg: siktelinjer, lik) | 0,6–0,7 / 1,1–1,3 | 1,2 / 2,0 |
| render:player (tillegg) | 0,0 / 0,1 | 0,0 / 0,1 |
| render:weapons (spor, granater) | 0,5–0,6 / 0,8–1,0 | 0,6 / 1,3 |
| render:projectiles | 0,0 / 0,1 | 0,1 / 0,2 |
| render:fxUnder (VFX under + core-effekter under) | 1,9–2,1 / 7,0–7,1 | 7,1 / 14,9 |
| render:fxOver (VFX over + core-effekter over) | 1,5–1,9 / 8,2–8,8 | 4,2 / 25,2 |
| render:top (`arena.drawTop`: over-lag, glød, lys, blink) | 4,7 / 6,1–6,2 | 5,0 / 7,0 |
| HUD (hud + levelHud + playerHud) | 0,9–1,0 / 8,6–10,2 | 1,0 / 9,0 |
| · render:levelHud | 0,6–0,7 / 8,0–9,6 | 0,6 / 8,4 |
| **render totalt** | **15,7–17,1 / 36,4–36,7** | **28,7 / 58,6** |
| rAF-bildetid på boksen | 33 / 50 (≈ 30 FPS) | 50 / 67–83 (≈ 20 FPS) |

**VFX alene (test.html, median / p95 ms, load 6–9):**
| | high | medium | low |
|---|---|---|---|
| typisk | 0,8 / 1,3 | 0,6 / 1,6 | 0,5 / 1,2 |
| tung | 1,5 / 2,2 | 1,3 / 2,1 | 1,1 / 1,8 |

Alene er VFX innenfor budsjettet på alle nivåer. **I spillet er fxUnder + fxOver mye høyere:** typisk ca. 4 / 15 ms og tung ca. 11 / 40 ms. Partikkeltoppen i spillet var 340–450 (typisk) og 700–820 (tung). Merkene inkluderer også core-effekter (`effects.js`, Våpens treff via `fx.js`), så fordelingen må bekreftes av Effekter og Våpen.

**Arena, delmåling av drawTop** (tomgang, 60 bilder, load ca. 8): totalt 3,8 → 3,1 ms etter tiltak. Over-laget ≈ 0,3, glød ≈ 1,2, dynamisk ≈ 1,5 (flimrende lamper 2,2 → 1,4), blink ≈ 0,1. I spillet er drawTop fortsatt ca. 4,7 ms median, fordi skuddblink og hull rundt aktører kommer i tillegg.

**Dekaler på dekning – utsatt bake (26.10 15:45):** `addCoverDecal` legger dekalen i kø og returnerer straks. Ventende dekaler tegnes direkte rett etter objektet i `drawSorted` (`world.arena.drawPendingDecals`; ovenfra i `drawTop`). `decalTick`, kalt fra `drawTop`, baker høyst ett objekt per bilde med alle ventende dekaler samlet, og bare når budsjettet (1,2 ms) ikke er brukt opp. I trekvart bakes dekalen i spriten og rett inn i den ferdig skalerte kopien, ikke i topplaget (det var hoveddelen av kostnaden). Uberørte sikkerhetskopier lages én gang per sprite og forhåndslages spredt over bildene etter `arenaLoaded`/`levelStart`, sammen med VFX-spritene. Full gjenbaking skjer bare hver 12. utskjøvne vektenhet.
Måling (`node src/arena/_tools/decals-bench.cjs`, 20 dekaler/s mot 49 objekter, alle med første treff, 10 s, view 34, 1600×1000; ms per ramme for add + direkte tegning + bake):
| | median | p95 | maks | rammer > 2 ms | load |
|---|---|---|---|---|---|
| Før (synkron bake) | 13–18 | 41–97 | 139–154 | 108–141 av 148–196 | 17–19 |
| Etter, 6 kjøringer | 0,0–0,1 | 0,2–0,4 | 1,2–12,9 (typisk 1,3–4) | 0–3 av 337–496 | 14–19 |
| Etter, ovenfra | 0,0 | 0,2 | 0,8 | 0 | 13 |
Enkelttopper (en inkrementell bake på 2–4 ms, én gang 12,9 ms) skjer under load 15+ og skyldes trolig planlegging/GC; en bake av én dekal tar normalt < 1 ms. Tallene er usikre i absolutt forstand, men forskjellen før og etter er stor og entydig.

**Bakt glød i over-laget (B, 26.10):** målt vekslende i samme side (`node src/arena/_tools/glow-ab.cjs`, 300 × drawTop, load 13–18). Enkel variant (glød lagt inn i over-laget): drawTop 4,5–5,6 → 3,5–4,4 ms median (−1 ms), men lampekjernene på gulvet blir synlig mørkere (pikseldiff maks 103, 4,8 % av pikslene > 8). Eksakt variant (glød bare der over-laget dekker, resten additivt): pikseldiff ≈ 0, men gevinst ≈ 0 (4,1 mot 4,1 ms), fordi nesten all glød ligger på gulvet. Derfor er den AV som standard (`?glowbake=1` for forsøk). Neste kandidat for drawTop er glød i halv oppløsning eller lysene i `drawDynamic`.

## Budsjett (ramme 16,7 ms; mål ≤ 12 ms arbeid, resten er margin for nettleser og GC)
| Rolle | Budsjett (median / p95) | Status |
|---|---|---|
| Arena: draw + drawTop + dekningssprites i drawSorted | ≤ 4,5 / 6 ms | Over budsjett (draw 2,3 + top 4,7 + sprites ca. 1–1,5). Eget tiltak 2. |
| Figurer (Warden-design, Monsterdesign): drawActor + tillegg i draw() | ≤ 0,35 ms per malt figur (11 figurer ≈ 3,9 ms) | Målt ≈ 0,27 ms/figur (helning typisk→tung) + 0,6–1,2 ms tillegg i enemies.draw. Innenfor, men knapt. |
| VFX (Effekter), målt I SPILLET (fxUnder + fxOver) | typisk ≤ 2 / ≤ 3 ms, tung p95 ≤ 3,5 ms | I spillet ca. 4/15 (typisk) og 11/40 (tung): **over**. Alene: innenfor. |
| Våpen: weapons.draw + prosjektiler + treff i fx.js | ≤ 1 / 1,5 ms | 0,6–0,9 / 1,0–1,5: innenfor. |
| HUD (UI + levels + player) | ≤ 1 / 1,5 ms | Median innenfor, men **levelHud p95 8–10 ms**. |
| Logikk (update totalt) | ≤ 2 / 4 ms | Typisk innenfor. Tung p95 5,4 (AI og prosjektiler). |

## Topp 3 tiltak
1. **VFX i spillet (Effekter, sammen med Våpen):** fxUnder + fxOver er 3–7 ganger testsiden. Mål med `brett1-bench.cjs` (ikke bare test.html), og del opp VFX og core-effekter. Kandidater: partikkeltak i tung kamp (peak ≤ 400), additiv glød i halv oppløsning og felles kvalitetsnivå `medium` i tung kamp.
2. **Arena drawTop (meg):** gjort nå: lys utenfor utsnittet hoppes over, flimrende lamper tegnes som sprite og bare med den indre delen av radien, og støv og damp tegnes uten strengbygging (−0,7 ms i tomgang). Bakt glød ble prøvd 26.10 og ga ingen korrekt gevinst (se over). Neste: glød i halv oppløsning og flimmerlys hvert 2. bilde. Dekalhakket er løst med utsatt bake.
3. **Topper (p95) i HUD og AI:** levelHud har topper på 8–10 ms (sannsynligvis tekst eller banner bygd hver gang den vises; bør caches i et offscreen-lerret). update:enemies har p95 2–3 ms (spre LOS/stisøk over flere bilder).

## Konkrete krav per rolle (til videresending)
- **Effekter (VFX):** typisk ≤ 2 / 3 ms og tung p95 ≤ 3,5 ms målt i spillet med `node src/arena/_tools/brett1-bench.cjs --scenario=heavy`, summen av render:fxUnder + render:fxOver. Partikkeltopp ≤ 400 i tung kamp. Bekreft hvor mye av merkene som er core-effekter eller Våpen.
- **Våpen:** hold weapons.draw + treff (fx.js) ≤ 1 ms median. Si fra om fx.js tegner i core-effektlaget, så kan vi skille det fra VFX i målingen.
- **Warden-design / Monsterdesign:** ≤ 0,35 ms per malt figur (drawActor) i 1600×1000 og zoom 1,5. Ingen `createRadialGradient`, `shadowBlur` eller filter per bilde i drawActor. Bruk forhåndsrendrede deler. Enemies.draw-tillegg (siktelinjer, lik) ≤ 0,8 ms totalt med 10 fiender.
- **Nivåer / levels (levelHud):** p95 ≤ 1 ms. Cache banner og tekst i et offscreen-lerret når innholdet endres, i stedet for å tegne tekst med skygge hvert bilde.
- **Fiende-AI:** update:enemies p95 ≤ 2 ms med 10 fiender (spre LOS- og stisøk over flere bilder).
- **Arena (meg):** ≤ 4,5 ms median for draw + drawTop + sprites, i gang (tiltak 2).

## world.perf (src/arena/perf.js)
- Slås på med `?perf=1`. Ellers settes `world.perf` ikke i det hele tatt, og `world.perf?.mark()` i loop.js blir et tomt `?.`-oppslag. `installPerf(world)` kalles fra `arena.loadArena`.
- `mark(navn)` kalles av core/loop.js rett før hvert system. Tiden for et system er neste merke minus dette. `update:end` og `render:end` avslutter fasen, og flere update-steg i samme bilde summeres.
- Ring på 120 bilder per system (Float32Array), glidende snitt (EMA 0,1) og p95. Ingen allokering per bilde. `snapshot()` og `reset()` er laget for verktøy.
- Overlegget er engelsk og ligger øverst til høyre. Oransje betyr over budsjett: 2 ms per system, 4 ms for update og 8 ms for render.

## 27.10 13:47 (UTC+1) – Effekter «liv»-kroker (ground.js)
Krokene: `drawFloorLife(ctx, L, t, view)` kjøres etter drawFloorDynamic (bunnlaget). `drawAirLife(ctx, L, t, view)` kjøres sist i drawTop, med egen save/restore.
`lampFlicker(light, t)` → 0–1 ganges med flimmeret til de dynamiske lampene i synsfeltet (lyspøl og lampehode). Bakte lamper påvirkes ikke.
`world._arenaSkip = { life: true }` slår av begge tegnekrokene. `top` skipper i tillegg drawAirLife.
Måling: headless Chrome, 1280×720, Kessa Yard v2, 240 bilder per runde, to runder hver (/tmp/life.cjs).

| | krok-tid per bilde | bildetid (rAF) |
|---|---|---|
| med kroker | 0,076 / 0,090 ms | 16,64 / 16,65 ms |
| uten (`life:true`) | 0 | 16,65 / 16,66 ms |

Krok-tiden er målt med performance.now rundt kallene. lampFlicker er billig og inngår ikke i tallet.
**Under budsjettet på 0,3 ms.** Bildetiden er låst til vsync, så forskjellen synes ikke der.
