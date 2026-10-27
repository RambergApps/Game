# EFFEKTER – kartlegging, eierskap, felles API og migreringsplan

Eier: **Breach Effekter (VFX)** · Dato: 2026-10-23 · Status: forslag. Eierskapstabellen er foreløpig avtalt med Breach Våpen og skal godkjennes av Breach.

> Regel for dette arbeidet: Effekter har bare endret filer i `game/src/effects/`, `docs/EFFEKTER.md` og `reviews/` (inkl. `reviews/img/`). Alle endringer i andres mapper under er **forslag**. Arena eier ytelsesbudsjettet.

Leveranser:
- Kode: `game/src/effects/` – `index.js` (API), `pool.js` (partikkelbasseng), `sprites.js` (cachede sprites), `bind.js` (hendelseskobling, ikke koblet inn), `scenes.js` (scener for ark og testside), `designark.html`, `test.html` (live), `_tools/` (skjermbilde- og ytelsesskript).
- Designark: `reviews/img/effekter-designark.png` (2400 × 1804). Tidligere iterasjoner: `effekter-designark-v1.png`, `-v2.png`.

---

## 1. Kartlegging: hvem tegner hva i dag

| # | Fil / funksjon | Utløses av | Hva / teknikk | Ytelsesrisiko |
|---|---|---|---|---|
| 1 | `core/effects.js` `addEffect`, `sparks` | Kall fra moduler | Generisk effektliste; `sparks` lager én closure per partikkel, `fillRect` med `'lighter'`. `updateEffects` filtrerer arrayet hvert bilde | Allokering per partikkel + `filter` hvert bilde → GC-hakk ved mange treff |
| 2 | `weapons/fx.js` `muzzleFlash` | `weapons/index.js` ~l.203 (ved avfyring) | Radial + lineær gradient **per bilde**, stiler star/fan/brake, bakkelys, røyk, glør | Gradienter per bilde |
| 3 | `weapons/fx.js` `smoke` | muzzle/impact/explosion | Cachet tekstur | Lav |
| 4 | `weapons/fx.js` `ejectShell` | `weapons/index.js` l.205/413 | Hylser, tak 90 | Lav |
| 5 | `weapons/fx.js` `drawTracers` | `weapons/index.js` l.432 | 2 lineære gradienter per prosjektil per bilde | Middels ved hagle/automat |
| 6 | `weapons/fx.js` `beam` | `weapons/index.js` l.423 (marksman) | Stråle | Lav |
| 7 | `weapons/fx.js` `impactCover` | `coverHit` (lytter i `weapons/index.js`) | Metall/betong-gnister, blink-gradient, røyk, fliser, dekaler (tak 120) | Gradient per treff |
| 8 | `weapons/fx.js` `impactBody` | `projectileHit` | Fiende: **mørkerøde prikker** + varme gnister + ring; spiller: cyan | Lav – men feil uttrykk (rødt blod) |
| 9 | `weapons/fx.js` `explosion` | `weapons/grenades.js` l.105 | Bakkelys, brennmerke 14 s, ildkule-gradient, sjokkbølge (`stroke`), **9 flamme-gradienter per bilde**, 12 røyk, 22 gnister, fliser | Høy i eksplosjonsøyeblikket |
| 10 | `weapons/melee.js` `swingFx`, `meleeImpactFx` | melee-faser | Buestrøk `'lighter'`, hvit skive + gnistlinjer via `addEffect` | Lav; uttrykket er tegneserieaktig |
| 11 | `weapons/camfx.js` | våpen/granat | shake/kick/hitstop | – (ikke tegning) |
| 12 | `main.js` | `death`, spiller truffet | `camera.shake(5,250)` / `(3,120)` | – |
| 13 | `player/fx.js` `dust`, `scrapeSparks`, `debris` | `player/index.js:109` (rull), `player/state.js:86,173,216` | Støv/gnister ved bevegelse | Lav |
| 14 | `player/fx.js` `muzzleFlash`, `shell` | **Aldri kalt** | Død kode | – |
| 15 | `arena/index.js` `subscribe()` | `shot`, `explosion`, `coverHit` | `addFlash` (muzzle r115 life .075; 2 blink ved eksplosjon; gnistblink ved dekningstreff) | Lav (cachede sprites, MAX_FLASHES 8, dedupe) |
| 16 | `arena/render.js` `createFx`, `drawFloorDynamic`, `drawDynamic`, `drawFlashes` | Arena | Støvkorn, damp, beacons, fakkelflammer (blot per bilde), blinklys | Lav–middels |
| 17 | `enemies/render.js` telegraf | Fiende sikter | Linje + radial gradient per bilde | Lav–middels |
| 18 | `enemies/render.js` `P.muzzleFlash` (~l.228) | Fiende skyter | Egen flammeform | **Dobbel** med våpenglimt (fiender bruker `weapons.tryFire` via `enemies/weapon.js`) |
| 19 | `enemies/render.js` `drawSpawnWarnings` | `spawnWarn` | Plassholder: linjestjerne + krympende ring | Lav – eneste effekt for spawnWarn |
| 20 | `enemies/render.js` l.316 | Visir | **`shadowBlur`** | Brudd på ytelsesregel |
| 21 | `enemies/test.js` | Testside | `core sparks` for treff + `shadowBlur` | Bare testside |
| 22 | `shared/rig/styles/painted.js`, `levels/hud.js`, `levels/cards.js` | Rig/HUD | `shadowBlur` (glow/ao) | Bør sjekkes av eierne |

### Overlapp / dobbel tegning
- **Munningsglimt tre steder:** `weapons/fx.js` (glimt + bakkelys + røyk), `arena` `addFlash` på `shot` (enda en lysflekk), `enemies/render.js` `P.muzzleFlash` (fiender får glimt to ganger).
- **Dekningstreff:** `weapons/fx.js impactCover` + `arena` gnistblink på `coverHit`.
- **Eksplosjon:** `weapons/fx.js explosion` + `arena` 2 blink. Kamerarist både i `grenades.js` (camfx) og i `main.js` (ved død).
- **Spawn-varsel:** bare plassholderen i `enemies/render.js`; ingen sprekk/glød.
- **Nærkamp:** `weapons/melee.js` tegner både bue og treff.
- **Gnister:** `core/effects.js sparks` (enemies/test) og `weapons/fx.js` har hver sin implementasjon.

### Det som mangler
- Monsterblod med riktig uttrykk: Cinderborn skal ha **varm, glødende oransje ichor** som kjøles til tjære – i dag mørkerøde prikker.
- Kitin-treff (svarte splinter med glødende kant) – i dag behandles fiendetreff likt uansett overflate.
- Sprekk-glød og oppbrudd for `spawnWarn`/`spawnRise`.
- Felles partikkelbasseng med hardt tak; i dag har hver modul egne lister og egne tak (90, 120, 64 …).
- Felles kosmetisk RNG: `weapons/fx.js` bruker `world.rng` til kosmetikk → visuelle effekter påvirker determinisme (replay/test). Effekter har egen RNG.
- `docs/YTELSE.md` finnes ikke (Arena eier). Budsjett nedenfor er hentet fra `reviews/test-2026-10-23.md` og `arena/perf.js`.

---

## 2. Eierskap (foreløpig avtalt med Breach Våpen – skal godkjennes av Breach)

| Område | Eier | Kommentar |
|---|---|---|
| Munningsglimt: **form og farge per våpen** | **Våpen** | Designarket viser rifle/shotgun/marksman som *referanse for Våpen*, med VFX-lys og -røyk lagt på |
| Lysflekk, røyk og gnister **rundt** munningsglimtet | **VFX** | Ut fra `shot`. Våpen slutter å tegne egen lysring og røyk |
| Tracere og kuler | Våpen | |
| Skallhylser | Våpen | |
| Granatbane med skygge | Våpen | |
| Ammokasser | Våpen | |
| Gnister og støv mot dekning, per overflate | **VFX** | `metal`, `concrete`, `chitin`, `flesh`, `dirt` |
| Blod (ichor) og kitin | **VFX** | |
| Eksplosjoner og sjokkbølge | **VFX** | Inkl. brennmerke, ettergløding |
| Røyk, varme og lys (effektlys) | **VFX** | Arena beholder *miljølys* (`addFlash`/fakler) – se migrering |
| Impact ved nærkamptreff | **VFX** | Våpen beholder svingen/animasjonen |
| Sprekk-glød (`spawnWarn`) og oppbrudd (`spawnRise`) | **VFX** | Erstatter plassholder i `enemies/render.js` (Fiende eier hendelsene) |
| Kamerarist / hitstop | Våpen (`camfx`) / core | Uendret |

### Hendelsesdata Våpen legger på (avtalt)
| Hendelse | Felter |
|---|---|
| `shot` | `x, y, z` (via PROJ), `weapon`, `angle` |
| `projectileHit` | `x, y, z`, `weapon`, `angle`, `surface` |
| `coverHit` | `x, y, z`, `weapon`, `angle`, `surface` |
| `melee` (phase `hit`) | `targets`, `angle`, `killed` (+ `x, y, z`, `weapon`) |
| `explosion` | `x, y, z, radius` |

**Bedt om i tillegg:** `surface` (`'metal' \| 'concrete' \| 'chitin' \| 'flesh' \| 'dirt'`), `normal` eller treffvinkel, `damage` eller `power`, `targetId`, og `kind` på `explosion`.
Inntil feltene finnes, faller `bind.js` tilbake: `surface` fra `cover.material`/`surface`/høy dekning → metall ellers betong; fiende → `chitin`; vinkel fra prosjektilets `angle`; `power = 1`.

### Dybde / lag
`shared/depth.js` sorterer bare dekning og aktører. Effekter tegnes derfor i to lag utenfor sorteringen:
- **Bakkelag – før `drawSorted`:** sprekk-glød, brennmerker, blod/ichor på bakken, kulehull på bakken, bakkelys, sjokkring, støvring.
- **Luftlag – etter (etter prosjektiler):** glimt-lys, røyk, gnister, splinter, dråper, ild, glør. Tracere tegnes av Våpen.
- Kulehull/dekaler på dekningens **front** (z > 0) tegnes i dag i luftlaget (kan havne over en aktør som står foran veggen). Forslag: Arena gir en krok «etter dekning, før aktører på samme rad», eller vi godtar dette.

---

## 3. Felles API (implementert i `game/src/effects/index.js`)

```js
import * as fx from './effects/index.js';
fx.init(world, { quality: 1 });        // lager world._vfx (basseng, egen RNG, statistikk); bygger sprites på forhånd
fx.spawn(world, 'impact', { x, y, z, angle, surface: 'metal' });
fx.update(dt, world);                  // én gang per simuleringssteg
fx.draw(ctx, world, camera, 'under');  // bakkelag (ctx har kameratransform)
fx.draw(ctx, world, camera, 'over');   // luftlag
fx.setQuality(world, 0.5); fx.stats(world); fx.clear(world);
const off = fx.bindEvents(world, { muzzle: true, impacts: true, blood: true, death: true, explosion: true, melee: true, spawn: true });
```

| Type | Parametre | Innhold |
|---|---|---|
| `muzzle` | `x, y, z=26, angle, weapon, team, power` | Glimt (referanse/fallback), bakkelys, røyk, kruttgnister, bakkestøv (marksman) |
| `tracer` | `x0, y0, x1, y1, z, team, weapon` | Kosmetisk strek (kun testside/fallback – Våpen eier tracere) |
| `impact` | `x, y, z=22, angle, surface, power, partial, sy` | metal: gnister + varmt kulehull som kjøles · concrete: støv, fliser, pockmerke · chitin/armor: splinter + ichor-sprut |
| `ichor` | `x, y, z, angle, amount, ground` | Glødende dråper → sprut på bakken som kjøles fra oransje til tjære, damp |
| `death` | `x, y, angle, size` | Stor ichor-pøl, kitinsplinter, glør, sot |
| `explosion` | `x, y, radius=90` | Lysblink, ildkule, trykkfront, støvring, tung røyk, splinter, gnister, glør, brennmerke, ettergløding |
| `smoke` | `x, y, z, r, n, tone, life` | Røyk |
| `embers` | `x, y, w, h, n, ash` | Glør/aske i lufta |
| `fire` | `x, y, r, duration, id` | Emitter (vedvarende ild) |
| `crack` | `x, y, t, id, type, size` | Emitter: sprekk vokser i 4 stadier, pulserende glød, glør, hoppende grus |
| `rise` | `x, y, id, size` | Avslutter `crack`, synkehull, biter, støvring |
| `melee` | `x, y, ox, oy, angle, hit, surface, team` | Myk sveip + treff (støv, kitin, ichor) |
| `bossVent` | `x, y, angle` | Stub til boss-hendelser finnes |

`bind.js` (ikke koblet inn): `weaponFire`/`shot` → `muzzle` (z 17 ved huk), `coverHit` → `impact`, `projectileHit` → `impact` (chitin for fiende, metal partial for spiller), `death` → `death`, `explosion` → `explosion`, `melee` phase `hit` → `melee` per mål, `spawnWarn` → `crack`, `spawnRise` → `rise`. Hver kobling kan skrus av enkeltvis – det er slik migreringen gjøres effekt for effekt.

### Teknikk
- Alt med gradient/støy bygges **én gang** til offscreen-lerret (`sprites.js`), tegnes med `drawImage`. Ingen `shadowBlur`, ingen `ctx.filter`.
- Røyk/støv er «malte» volumdotter lyssatt fra `LIGHT_DIR`; ild med fargerampe; additiv blanding bare for ild, glød, gnister og varm ichor.
- Én tegnegjennomgang i fødselsrekkefølge, så røyk som kommer etter ildkula dekker den (blandemodus byttes kun ved endring).
- Egen kosmetisk RNG (`world.rng` røres ikke).

### Basseng og tak
| | Tak | Fullt → |
|---|---|---|
| Partikler | **900** | eldste gjenbrukes (telles i `stats().dropped`) |
| Dekaler | **140** | ringbuffer |
| Emittere | **32** | ny ignoreres |
Ingen allokering per bilde. `quality` (0.25–1) skalerer antall partikler per effekt.

---

## 4. Ytelse (Arena eier budsjettet – dette er VFX sitt forslag)

Rammer: 60 FPS, p95 ≤ 17 ms; `arena/perf.js` flagger bilde > 17,5 ms og delsystem > 4 ms.
**Forslag til VFX-budsjett:** ≤ 2 ms per bilde (update + begge lag) i vanlig kamp, ≤ 4 ms i topper (granat), ellers `setQuality(0.5)` automatisk.

Målinger i headless Chromium (SwiftShader, ingen GPU – dvs. pessimistisk):
| Scenario | Resultat |
|---|---|
| `test.html` live, alle 11 scener samtidig (≈ 234 partikler, 51 dekaler), rAF | **≈ 1,6 ms/bilde** CPU-side for update + draw (inkl. bakkebilder) |
| `_tools/perf.html` tung kamp (k=1: 30 skudd/s, 25 treff/s, granat hvert sekund …), topp 836 partikler, med tvungen tilbakelesing hvert bilde | p50 30 ms, p95 49 ms – **for dyrt**, men programvarerasterisering med synk |
| Samme, typisk kamp (k=0,3), topp 311 partikler, med tilbakelesing | p50 10–12 ms, p95 18–25 ms (bakkelag ≈ 4 ms, luftlag ≈ 7 ms) |
| `update` alene | 0,02–0,04 ms (ikke flaskehals) |

Tolkning: kostnaden er fyllrate (store glød-/røyksprites), ikke logikk. Tallene med tilbakelesing er en øvre grense; GPU-akselerert canvas i ekte nettleser er mye raskere. Målingen uten tilbakelesing ble avbrutt og er ikke kjørt ferdig. **Arena bør måle i ekte nettleser med effektene på før noe skrus på i spillet.** Tiltak klare til bruk: senke `quality`, lavere tak (f.eks. 500), mindre bakkeglød på eksplosjon, og bake avkjølte dekaler inn i et bakke-lerret (krever krok fra Arena).

---

## 5. Migreringsplan (forslag – endringer i andres filer gjøres av eierne)

Prinsipp: **Våpen skrur av sine versjoner effekt for effekt, men først når VFX-versjonen er godkjent.** Ingenting tegnes dobbelt lenger enn én leveranse.

| Steg | Hvem | Endring (forslag) | Fil |
|---|---|---|---|
| 0 | Breach | Godkjenne eierskapstabellen og designarket | – |
| 1 | Core/Arena | Koble inn effekter: `fx.init(world)` + `fx.update` i løkka, `fx.draw(...,'under')` etter `arena.draw` og før `drawSorted`, `fx.draw(...,'over')` etter prosjektiler. Alternativ: VFX registrerer to faste oppføringer i `world.effects` (krever bare ett `init`-kall i `main.js`) | `core/loop.js` (`mods.effects`) eller `main.js` |
| 2 | Våpen | Legge `x, y, z, weapon, angle, surface` i `shot`, `projectileHit`, `coverHit`, `melee` (hit: `targets, angle, killed`) og `explosion {x, y, z, radius}`; på sikt `normal`/treffvinkel, `power`/`damage`, `targetId`, `kind` | `weapons/index.js` (~l.195), `weapons/grenades.js`, `weapons/melee.js` |
| 3 | VFX | Slå på `bindEvents` med bare `spawn` (sprekk/oppbrudd) – ingen overlapp med Våpen | `effects/bind.js` |
| 3b | Fiende | Skru av `drawSpawnWarnings`-plassholderen når effekter er aktive | `enemies/render.js` |
| 4 | VFX → Våpen | Godkjent: **ichor/kitin**. Våpen fjerner rødt blod i `impactBody` (fiende); VFX slår på `blood` | `weapons/fx.js` `impactBody`, lytter i `weapons/index.js` |
| 5 | VFX → Våpen | Godkjent: **dekningstreff**. Våpen fjerner `impactCover`-lytteren; VFX slår på `impacts` | `weapons/index.js` (coverHit-lytter), `weapons/fx.js` |
| 5b | Arena | Fjern gnistblink på `coverHit` (VFX eier effektlyset) | `arena/index.js` `subscribe()` |
| 6 | VFX → Våpen | Godkjent: **eksplosjon**. Våpen fjerner `fx.explosion` (beholder granatbane, skygge, camfx); VFX slår på `explosion` | `weapons/grenades.js` l.105, `weapons/fx.js` |
| 6b | Arena | Fjern de 2 eksplosjonsblinkene (eller behold ett som *miljølys* etter avtale) | `arena/index.js` |
| 7 | VFX → Våpen | Godkjent: **munningslys/røyk**. Våpen beholder glimtformen og fargen, men slutter å tegne lysring, bakkelys og røyk i `muzzleFlash`; VFX legger på lys, røyk og gnister fra `shot` (VFX kaller `muzzle` med `flash:false`) | `weapons/fx.js` `muzzleFlash` |
| 7b | Arena | Fjern `addFlash` på `shot` (ellers tre lyskilder) | `arena/index.js` |
| 7c | Fiende | Fjern `P.muzzleFlash` – fiender får glimt fra Våpen + lys fra VFX | `enemies/render.js` ~l.228 |
| 8 | VFX → Våpen | Godkjent: **nærkamptreff**. Våpen fjerner `meleeImpactFx` (beholder sving); VFX slår på `melee` | `weapons/melee.js` |
| 9 | Spiller | Slett død kode `muzzleFlash`/`shell`; vurdere å flytte `dust`/`scrapeSparks` til `fx.spawn(world,'smoke'/'impact')` | `player/fx.js` |
| 10 | Eiere | Fjern `shadowBlur` (visir, rig-glow, HUD) – bruk cachede glød-sprites | `enemies/render.js` l.316, `shared/rig/styles/painted.js`, `levels/hud.js`, `levels/cards.js` |
| 11 | Våpen | Kosmetikk bruker egen RNG, ikke `world.rng` | `weapons/fx.js` |
| 12 | Core | Behold `addEffect` for bakoverkompatibilitet; `sparks` kan på sikt kalle `fx.spawn(world,'impact',…)` | `core/effects.js` |

Klar: `muzzle` har flagget `flash:false` (bare lys/røyk/gnister). Gjenstår hos VFX før steg 3: støtte `surface: 'flesh' | 'dirt'` (faller i dag tilbake til betong), og en ekte ytelsesmåling sammen med Arena.

---

## 6. Designark
`reviews/img/effekter-designark.png` – 4 × 3 celler, engelske etiketter, malt stil, skrå 3/4 via PROJ, mørk betongbakke med lampelys. Cellene er i 3× zoom med innfelt bilde i spillskala (1,5×); eksplosjonen er vist i spillskala i tre øyeblikk (0,05 / 0,30 / 1,20 s).
- **Muzzle flash rifle / shotgun / marksman** er merket **REFERENCE** – glimtformen og fargen eies av Våpen; VFX-lys og -røyk er lagt på.
- Hit metal / concrete / chitin, Cinderborn ichor, Melee, Grenade explosion, Spawn warning (crack ved 75 %), Spawn rise.

Iterasjoner (selvkritikk):
1. v1: grønnstikk i bakken (feil bredde i ImageData), ichor så ut som baller, sprekk som tegneserie-«X», eksplosjon som hvit skive med tegneserieringer, kulehull på vegg skjult under dekningen, betongstøv usynlig.
2. v2: flat tjære-/glødesprut med årer, organisk forgrenet sprekk med dyp rødglød, oppbrutt trykkfront, veggdekaler i luftlaget, mer støv og gnister.
3. v3/v4: én tegnegjennomgang så røyk dekker ildkula, større og tettere røyk, tynnere og skarpere metallgnister, synkehull med glød fra randen i stedet for «lavapøl».

Gjenværende svakheter: rekvisittene (kitinpukkel, våpen) er bare forenklede plassholdere, ichor kan virke litt prikkete på avstand, trykkfronten er fortsatt en tydelig sirkel ved 0,30 s.
Reproduser: `cd game && python3 -m http.server 8765`, deretter `node src/effects/_tools/shot.cjs` (fra `/workspace/breach`).

## Warden over dekning (27.10, `effects/coverpose.js`)
- Kilde: kontrakten med Warden-design (`coverRise {entity,x,y,type,nx,ny,cover}`, `coverDuck`, `p.exposed`). Til hendelsene sendes: reserve på stigende kant av `p.posture === 'popUp'|'lean'` i lav dekning. `SOURCE.mode = 'auto'|'events'|'posture'`.
- `coverRise`: varm kantlist (7 glødpunkter, 0,35 s) på toppkanten, tett lyst betongstøv (16) og grus (14) kastet langs normalen mot fienden, 0,4–0,6 s. Ingenting på høy dekning.
- Mens eksponert: svak kald glans på hjelm/skuldre + tynn bakkehalo mot fienden (`exposedCue`, 2 glødpartikler hvert 0,14 s, fader av seg selv ved dukk).
- Treff oppreist (`hit` + `isExposed`): `exposedHit`, hvit-oransje blaff og harde gnister på brystplata. Dukket: bare vanlig dempet dekningstreff.
- Kost (målt i klippet, zoom 2,25, boksen): VFX tegning 0,41 ms mot 0,16 ms når ingenting skjer, update 0,08 mot 0,03 ms (inkl. treffgnistene). Eksponert-markøren alene ≈ 6 partikler.
- Klipp: `node game/src/effects/_tools/rise-clip.mjs`.

## NS-barrierer v5 (27.10, `cover.js` paintNSBarrierV5)
Rekke av 2–3 korte, lave jersey-blokker med gulv imellom, smal (68 % av ruta), front bare 28 % av løftet, tverrprofil fot–flanke–rygg, egen jersey-trapes i sørenden, gul/svart stripe på én ende (seed). v4 kan vises med `globalThis.__BREACH_NSV = 4` (bare for før/etter-bilder). Bilde: `node game/src/effects/_tools/ns-shot.mjs` → reviews/img/ns-barrierer-v5.png.

## Støvtak for reisestøv (27.10)
`coverpose.js` `DUST`: maks ~40 levende reisestøv-partikler (16 puffer + 14 korn = 30 per full reising), skala 1/(n+1) når n reisinger skjedde siste 0,3 s, 0,5 s nedkjøling per dekning (cover.id), gulv 0,13 (≈4 korn + kantlist) så hver reising synes. Én reising = uendret (skala 1). `T.coverRise` tar `o.scale`. Test: `_tools/rise-cap.mjs`.

## Ekte hendelser fra player/state.js (27.10, sent)
Kilden er nå `coverRise`/`coverDuck` fra state.js (peek 0,6 / 0,3, alltid i par; `p.exposed` mellom). I `auto` tier positur-reserven så snart `p.exposed` er boolsk (ellers ga første reising dobbel effekt før første hendelse var sett). Kontroll i `_tools/rise-clip.mjs` (sandsekker id 27 + mur/ledge id 21): 3 coverRise = 3 håndtert = 3 effekt-spawns, 3 coverDuck. Støv/kantblink sitter på kanten også med hode 71 px og 4,5 px lean – ingen forskyvning langs (nx,ny) nødvendig. Gnister/markør følger `target.exposed` (6 treff oppreist → exposedHit, 0 dukket).

## NS-barrierer 0,75×1 og silhuett (27.10 sent)
`paintNSBarrierV5`: `n = dw < 44 ? 1 : max(2, round(dw/30))` – Arenas 1-rutes stykker males som én lav jersey-blokk (skrå fot, grå betong, stripe etter frø). Silhuettforslag til Arena (shared/depth.js): bak høy dekning skjæres bare ~30 % ut (svakere jo dypere), stiplet omriss kaldt/avmettet med alfa 0,25/0,4. Ingen shadowBlur.

## Sprekk/oppbrudd bak høy dekning (27.10)
`spawnWarn`/`spawnRise` sender nå `hidden: pointHidden(...)`; skjult `rise` flyttes til under-laget i spawnImpl, og `crack`-emitteren (e.hid) flytter sine løpende glør/grus likt. Før lå lys grus i over-laget oppå containertaket.

### Fragment over containertak (27.10)
Ikke en effekt: lys pigg-flekk er fiendens kropp sett gjennom uttoningen i depth.js drawCoverToned. VFX, dekal-krok og enemies.draw-overlays av ga identisk bilde; bare å flytte fienden fjernet den. Forslag: høy dekning gir alltid deep (ingen uttoning), takleppen tegnes fortsatt. Diff: reviews/diffs/arena-silhuett-fragment.diff.

## Oppvarming av sprites over flere frames (warmupChunked)
`sprites.warmupChunked({budgetMs=8, onProgress})` → Promise. Baker de samme 89 jobbene (130 lerreter) i samme rekkefølge som `warmup()`; begge bruker `warmJobs()`. Hver sprite har egen mulberry-seed, så rekkefølgen påvirker ikke pikslene. memo hindrer dobbel baking ved lazy get/draw underveis. Bevis: `_tools/warmup-chunked.mjs` (maks avvik 0). Lengste frame ≈12,6 ms; tyngste sprite er `dustRing` ≈12 ms. Integrasjon: reviews/diffs/vfx-sprites-warmup-chunked.md.
