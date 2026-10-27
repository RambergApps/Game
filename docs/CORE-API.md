# BREACH – Kjerne-API (src/core) – faktisk implementasjon

Alt kan importeres fra `src/core/index.js`. Kjør: `cd game && python3 -m http.server`. Test: `node tools/core-test.cjs` (skjermbilde → shots/core.png).

## world.js
- `createWorld({seed=1337, width=1600, height=1200}) → world`
  `{ time, player, enemies[], cover[], projectiles[], effects[], level, bounds:{x,y,w,h}, events, rng, debug, paused?, input, camera, modules }`
- **`world.timeScale`** (default 1): loopen ganger simulerings-dt med denne. ALLE moduler får skalert dt automatisk (ikke gang selv). Lyd, kamera og UI får ekte dt.
- **`world.hitstop(seconds)`**: fryser simuleringen (level/player/enemies/weapons/kuler/effekter, `world.time` står) i ekte tid. Lyd, kamera (inkl. rist) og tegning går. Overlapp: lengste vinner (forlenger ikke), kappet til 0.25 s. Tastetrykk tas vare på til frysen slutter. Gjenstående: `world.hitstopT`.
- `createRng(seed) → rng()` (0..1), `rng.range(a,b)`, `rng.int(a,b)`. Bruk alltid `world.rng`, ikke Math.random.

## events.js
- `world.events.on(type, fn) → off()`, `once(type, fn)`, `off(type, fn)`, `emit(type, payload)`. `'*'` lytter på alt.
- `hit` har nå `{target, amount, source, blocked, distance, inCover}`. Når `invuln` blokkerer, sendes `hit` med `amount: 0, blocked: true` (og `raw` = skaden som ble blokkert). **Lyttere som gir hurt-reaksjon må sjekke `blocked`/`amount > 0`.**
- Kjernen sender: `shot {projectile, owner, team, entity, weapon, pellets, x, y, angle}` (ÉN per avtrekk; `weapon` = null og `pellets` = 1 hvis prosjektilet ikke har dem), `hit {target, amount, source}`, `death {target, source}`, `coverHit {projectile, cover, x, y, partial}`, `projectileHit {projectile, target, x, y, pierced}` (pierced = antall mål kula allerede har gått gjennom), `arenaLoaded {id}`, `waveStart {level, wave}`.
  Roller bør sende: `coverEnter/coverExit {entity, cover}`, `grenade {...}`.

## input.js
- `input.down(code)`, `input.pressed(code)`, `input.released(code)` (KeyboardEvent.code; pressed/released gjelder ett 60 Hz-steg).
- `input.mouse = { x, y (skjerm-px), worldX, worldY, left, right, leftPressed, rightPressed, wheel }`.
- `input.sync(camera)`, `input.endFrame()` – kalles av loop.

## camera.js
- `camera {x, y (verdenspunkt i senter), zoom=PROJ.zoom (2.25; legacy ?view=34: 1.5; ?zoom=N), lerp=6 (eksponentiell: k = 1 − e^(−6·dt)), lead=0.30 mot siktepunktet (PROJ.aimGround), radielt tak leadMax=160 verdens-px, g (bakkens y-forkorting = PROJ.groundScaleY i trekvart, 1 ovenfra), fixed, shakeMax=10, shakeScale=1}`
- 27.10 (Arena): følgekamera er standard og stopper mot brettkantene. URL: `?camfollow=0` gir fast kamera med hele brettet, `?zoom=N` overstyrer zoom. `worldToScreen`/`screenToWorld` tar med `g`, så tur-retur er eksakt.
- **`camera.shake(amount_px, duration_ms)` er ÉN eier for kamerarist.** Aktive rister summeres (hver faller lineært), summen kappes til `shakeMax` px og ganges med `shakeScale` (0 = av, for innstillinger). `shakeAmount()` gir nåværende amplitude. Rist bruker egen kosmetisk rng (ikke `world.rng`) og ekte dt (rister også under hitstop). Ingen skal flytte `camera.x/y` selv for rist/kick.
- `worldToScreen(wx, wy) → {x,y}`, `screenToWorld(sx, sy) → {x,y}`, `follow(entity)`, `apply(ctx)`, `update(dt, world)`.

## shared/projection.js – kameravinkel (Arena 27.10)
- Ortografisk: skjerm-y = (y − z·zScale) · groundScaleY · zoom = y·cos(v)·zoom − z·sin(v)·zoom, med v = vinkel fra loddrett. Standard v = 55° (`TILT_DEG`).
- `PROJ.tilt` (rad), `PROJ.tiltDeg`, `PROJ.legacy` (true ved `?view=34`/`?proj=37`), `PROJ.groundScaleY` = cos v (0,574; legacy 1), `PROJ.zScale` = tan v (1,428 verdens-y per z-px; legacy 0,75), `PROJ.screenZ` = sin v (0,819 skjerm-px per z-px ved zoom 1; legacy 0,75).
- URL: `?tilt=N` (grader fra loddrett), `?view=34` (gammel 37°), `?view=top`.
- Regel: aldri hardkod 0,75. Løft høyde med `PROJ.toScreen(x, y, z)` / `y − z·PROJ.zScale` i verdenskoordinater; kameraet tar bakkeforkortingen. En figur med høyde h blir `h·screenZ·zoom` skjerm-px.
- `window.BREACH.PROJ` er eksponert (main.js) for tester.
- Zoom (27.10 Arena): `PROJ.zoom` = faktisk startzoom (2,25; legacy 1,5; `?zoom=N` overstyrer), `PROJ.baseZoom` = verdien uten overstyring. `core/camera.js` eksporterer `DEFAULT_ZOOM` (= PROJ.zoom). Ved `?camfollow=0` regner kameraet egen zoom (hele brettet) – les da `camera.zoom`.
- DPR (27.10): main.js bruker bakbuffer innerWidth·dpr (dpr = min(devicePixelRatio, 2), `?dpr=1` slår av), men `canvas.width/height`, `ctx.setTransform/getTransform`, `camera.width/height`, mus og `screenToWorld` er i CSS-px. `window.BREACH.DPR`.
- Regen (27.10): `?regenDelay=N&regenRate=N` overstyrer `TUNING.regenDelay` / `regenPerSec` (player/tuning.js; standard 4.5 s og 18 hp/s). All skade (også splash/DoT uten `hit`-hendelse) nullstiller forsinkelsen. Mens livet fylles viser HP-baren (player/hud.js) REGENERATING, pulserende blå glød og lysende fyllkant.
- Oppstart (27.10): `#boot-black` i index.html dekker til menyen er oppe; PLAY legger `#bm-black` under menyen til intro-cutscenen er helt inntonet.

## geom.js
- `lineOfSight(world, ax, ay, bx, by) → bool` – kun **high** cover blokkerer.
- `raycastCover(world, ax, ay, bx, by, {types=['high'], pad=0}) → {cover, t, x, y, nx, ny} | null`
- `nearestCover(world, x, y, maxDist=Infinity, {type?, filter?}) → {cover, dist, point, normal} | null` (avstand til kant; normal peker fra cover mot punktet = "ryggen mot veggen"-retning motsatt).
- `circleRectCollide(cx, cy, r, rect) → {x,y} push | null`; `resolveCircleVsCover(world, e, r=e.r)` (skyver ut av alt cover + bounds).
- Hjelpere: `segmentRect(ax,ay,bx,by,rect,pad) → t|null`, `closestPointOnRect`, `dist`, `angleTo`, `angleDiff`, `clamp`.

## combat.js
- `spawnProjectile(world, {x, y, angle, speed=900, dmg=10, team:'player'|'enemy', owner?, radius=2, range=1200, color?, kind='bullet', dmgAt?, pierce?, pierceMult?=0.6, weapon?, pellets?}) → p`
  - **`dmgAt(distance) → skade`** (skadefall): brukes i stedet for `dmg` når den finnes. `distance` = eksakt px fra munning til treffpunktet (også lagret som `p.hitDist`). Uten `dmgAt` leses `p.dmg` (getter-varianten i weapons virker fortsatt, men bør byttes til `dmgAt`).
  - **`pierce`** = antall EKSTRA mål kula kan gå gjennom (samme steg fortsetter etter treffet). Hvert gjennomslag ganger skaden med `pierceMult` (default `PIERCE_MULT` = 0.6), lagret i `p.pierceScale`. Et mål treffes aldri to ganger av samme kule. High cover og low-cover-absorbering stopper kula som før.
  - Spillerkuler uten eksplisitt `pierce`/`pierceMult` arver `world.playerStats.pierce` / `pierceDamageMult` (oppgraderingen 'ap-rounds' virker dermed automatisk). Fiendekuler: 0.
  - Kloner (hagl 2..n) som pushes rett i `world.projectiles` som `{...p0}` arver feltene over og fungerer likt.
- `projectileDamage(p, distance)` → skaden kjernen bruker (dmgAt/dmg × pierceScale). `PIERCE_MULT` eksporteres.
- `damage(entity, amount, source=null, world=null, info=null) → faktisk skade`. Rekkefølge:
  1. **`entity.damageMult`**: tall (ganges) eller `fn(amount, info) → amount`. `info = {source, distance, inCover, projectile?, kind?}`. `distance` = px (fra kulas munning for prosjektiler, ellers fra `source.x/y` eller `source.owner`; `null` hvis ukjent). `inCover` = kula passerte low cover foran målet ELLER `entity.inCover`.
  2. `invuln` → `hit {amount:0, blocked:true}`, returnerer 0.
  3. `armor (0..1)` → HP-trekk, `onDamage(dmg, src, info)`, `hit`, ev. `onDeath(src)` + `death`.
  Kalles damage fra egne systemer (granater, melee), send gjerne `info` med `distance`/`inCover`.
- Regler: high cover stopper kuler (`coverHit partial:false`). Low cover: kula går over, men treffer et mål som står ≤ `LOW_COVER_RANGE` (48 px) bak low cover kun med `LOW_COVER_HIT_CHANCE` (0.35); ellers `coverHit partial:true`. Skytterens eget low cover (≤40 px fra munning) ignoreres.
- Mål: team 'player' treffer `world.enemies`, team 'enemy' treffer `world.player`. Entities trenger `x, y, r, hp, dead`.
- `updateProjectiles(dt, world)`, `drawProjectiles(ctx, world)` – kalles av loop.

## effects.js
- Treffeffekter: main.js har IKKE lenger generiske gnister på `coverHit`/`projectileHit`. Weapons (fx.js) tegner treff for alle prosjektiler, begge lag.
- `addEffect(world, {x, y, life=0.3, layer:'under'|'over', update?(dt,world,fx), draw?(ctx,world,camera,fx)})`, `sparks(world, x, y, color, n, angle?)`.

## loop.js
- `createLoop({world, ctx, camera, input, mods:{level, player, enemies, arena, weapons?, physics?, audio?, hud?}}) → {start, stop, advance(n), step, render, stats}`; `STEP = 1/60`.
- Hvert steg: hvis `world.hitstopT > 0` står simuleringen (se world.js), ellers får modulene `dt × world.timeScale`.
- Oppdatering: input → level → player → enemies → arena.update → physics → **weapons.update** → projectiles → effects → (audio, også i pause) → camera. `world.paused` stopper simulering.
- Tegning (verden): arena.draw → effekter 'under' → arena.drawCover? → enemies.draw → player.draw → **weapons.draw** → kuler → effekter 'over' → arena.drawTop? → debug.
- **Våpen eies av loopen i main.js**: `weapons.init` kalles i main.js og `mods.weapons` oppdaterer/tegner. Karakter og Fiende-AI skal IKKE kalle `weapons.update`/`weapons.draw` selv (update tåler det, men draw ville tegne sporstreker/granater dobbelt). De kaller bare `createLoadout`, `handleInput`/`tryFire`, og `drawReticle`/`drawHud`. Testsider uten `mods.weapons` må fortsatt kalle update/draw selv.
  Skjerm (HUD): hud.draw? → level.drawHud? → player.drawHud?. Alle valgfrie hooks kalles bare hvis de finnes.
- F1 slår av/på debug: cover-rekt (rød = high, grønn stiplet = low), LOS-linjer spiller↔fiender (grønn = fri, rød stiplet = blokkert), kollisjonssirkler, fps/tellere.

## Modulkontrakt
Hver rolle: `init(world)`, `update(dt, world)`, `draw(ctx, world, camera)` (+ valgfrie hooks over).
- `arena/index.js`: `loadArena(world, id)` – setter `world.cover`, `world.bounds`.
- `player/index.js`: setter `world.player = {x, y, r, hp, maxHp, team:'player', dead, ...}`.
- `enemies/index.js`: `createEnemy(world, type, x, y) → enemy` (pushes til world.enemies).
- `levels/index.js`: `startLevel(world, n)`. `story/index.js`: `showCutscene(id) → Promise`.
- main.js init-rekkefølge: audio → arena → weapons → player → enemies → levels → story, så `levels.startLevel(world, 1)`. `window.BREACH = {world, loop, camera, input}` for testing.

## Dybdesortering (src/shared/depth.js) – trekvart, lagt til 23.10 av Arena (godkjent av Breach)
Gjelder `?view=34`. Ovenfra fungerer som før (arenaen gir da ingen dekningsliste, og drawSorted sorterer bare aktører på y).

**View-modus.** `arena.loadArena` leser modus i denne rekkefølgen: `opts.view` → `world.view` → `world.arenaView` → URL `?view=34|top` → `'top'`, og skriver svaret til både `world.view` og `world.arenaView` ('top' | '34'). Andre moduler leser `world.view`. Bytt under spill med `arena.setView(world, '34' | 'top')`.

**Signatur.**
```js
import { drawSorted, canSort } from '../shared/depth.js';
drawSorted(ctx, world, camera, {
  cover: arena.coverObjects(world),   // [{x,y,w,h, elev, type, round?, noOcclude?}] – stabil liste, tom ovenfra
  drawCover: arena.drawCoverObject,   // (ctx, obj, world, camera)
  actors?,      // erstatter standardlisten (world.player + world.enemies som ikke er dead)
  extra?,       // ekstra aktører, f.eks. lik eller bosslemmer; tegnes med a.drawActor(ctx, world, camera)
  drawActor?,   // felles tegner for alle aktører (testsider)
  silhouettes?, // true – okklusjonsbehandling (toning + omriss) for skjulte aktører
  hideFrac?,    // 0.12 – andel av aktørens synlige flate som må dekkes
  tone?,        // true – dybdetoning: dekningen foran en skjult aktør tones til FADE_ALPHA (0,35) lokalt
  fallback?,    // true – enkel kapsel i lagfarge når modulen mangler drawActor (aldri krasj)
}) // → gjenbrukt stats-objekt { items, cover, actors, hidden, missing, frame }
```
Sortering: `PROJ.sortKey` (rektangel: y + h, aktør: y + r). Ved lik nøkkel tegnes dekning før aktør, deretter i innsettingsrekkefølge (dekning, player, enemies, extra), så sorteringen er deterministisk. Funksjonen allokerer ikke per bilde.

**Hva hver modul må eksponere.**
- `player.drawActor(ctx, actor, world, camera)` og `enemies.drawActor(ctx, actor, world, camera)` tegner ÉN aktør i verdenskoordinater, ankret i fotpunktet (x, y), med høyde fra `PROJ.heights` (actor 48, actorCrouch 30). ctx er lagret og gjenopprettet rundt hvert kall.
- Når drawSorted brukes, skal modulenes vanlige `draw()` ikke tegne aktørene en gang til. HUD, siktelinje og liknende kan fortsatt ligge i `draw()` eller `drawHud()`.
- `canSort(world)` er true når både player og enemies har drawActor.
- `arena.coverObjects(world)` og `arena.drawCoverObject(ctx, o, world)` hører til arenaen. Ammokassene ligger i listen i trekvart.

**Rekkefølge i loopen (trekvart).** Gulv (`arena.draw`) → effekter 'under' → `drawSorted` (dekning og aktører om hverandre) → `weapons.draw` → prosjektiler → effekter 'over' → `arena.drawTop`. I loop.js betyr det at `drawSorted` erstatter linjene `enemies.draw` og `player.draw` når `world.view === '34' && canSort(world)`. Ellers beholdes dagens rekkefølge.

**Silhuetter og takutsnitt.**
- Okklusjon (14:04): en aktør regnes som skjult når > hideFrac av kroppen (fotpunkt − 2 px og opp) dekkes av dekning tegnet ETTER den, og dekningen er HØY (elev > 33 skjerm-px) eller skjuler > HIDE_THRESHOLD (0,5) av aktørhøyden (PROJ.heights.actor 48 / actorCrouch 30). Stående bak lav dekning (24/48) gir derfor ingenting. Skjult aktør → dekningen tegnes via et kladdelerret der en myk ellipse rundt aktøren trekkes ut til 35 % opasitet, så positur og sikte synes i beltet 48–54 px nord for høy dekning. I tillegg et tynt stiplet omriss uten fyll i lagfarge (1 px; alfa 0,3 når tonet, 0,7 når toning ikke er mulig). Død Warden sorteres med (dødsanimasjonen); døde fiender tegnes som lik av enemies.draw. Konstantene HIDE_THRESHOLD og FADE_ALPHA eksporteres.
- `noOcclude` (14:30, forslag fra Våpen): dekning med `noOcclude: true` tones aldri og gir aldri omriss. Arena setter det i buildLevel for rekkverk/tynne lave objekter: kind `railing`/`rail`/`fence`/`pipes`/`valve`, alt lavt objekt lavere enn 0,75 × PROJ.heights.low (18 px), og `opts.noOcclude` per objekt. Flagget følger med til `world.cover`, `coverObjects()` og spritelista. Barrier/sandbag/crates/barrels er ekte lav dekning og bruker HIDE_THRESHOLD. Merk: reserveveien uten depth.js (ownerMap i arena/render.js) ser ikke på flagget.
- drawSorted setter `world._depthDrawn = true`. `arena.drawTop` tegner da bare «over»-laget: rørbruer, gangbruer, veggarmatur, lys og glød. Over-objekter får fortsatt det myke A1-hullet med ring rundt aktører under seg.
- Uten drawSorted (når loopen ikke sorterer, f.eks. canSort usann) faller arena.drawTop tilbake på piksel-okklusjon (samme terskel: bare kroppen over fotpunktet teller; tynt omriss uten fyll). Det hele topplaget tegnes over aktørene, med utsnitt der aktøren står foran og silhuett der den står bak. Det virker, men gir grovere kanter enn ekte sortering.
- Treff på frontflater (skjerm-y med z = halv høyde) er Våpens oppgave senere.


### Dekaler på dekning (Arena + Effekter, 26.10)
Eksporteres fra `src/arena/index.js` (implementert i `src/arena/decals.js`). VFX-modulen `effects/bind.js` finner dem via `world.modules.arena`.
- `coverHitPoint(world, cover, hitX, hitY, z?) → { coverId, face: 'front'|'top'|'side', x, y, z, material: 'metal'|'concrete'|'wood', nx, ny, angle } | null`. Her er hitX/hitY treffpunktet i bakkeplanet (som `coverHit`). Front er sørflaten med normal (0, 1), og sidene har (±1, 0). Topp har (0, 0), og nordflaten (skjult i trekvart) gis også som 'top'. `z` er verdens-px over bakken (`coverHit.z` hvis den sendes med, ellers `PROJ.aimHeight`), klippet til [2, høyde − 2]. `angle = atan2(ny, nx)`.
- `addCoverDecal(world, coverId, { x, z, y?, kind, r, angle, seed }) → bool`. Kinds og r (verdens-px, klippes): `bullet_metal` 2–3, `bullet_concrete` 3–5, `scorch` 10–40, `ichor` 4–12, `slash` 6–14 (angle = retning). Med `y` og `z ≥ høyde` havner dekalen på toppflaten, ellers på fronten i høyde z (`y = o.y + o.h − z·0,75`). Dekalen klippes til flaten.
  - Bakes inn i objektets sprite (trekvart: per-dekning-sprite i RES og den ferdig skalerte kopien) og i topplaget (ovenfra, eller i trekvart uten dybdesortering). Den tegnes derfor i riktig dybde uten kostnad per bilde. Selve tegningen gjøres av `drawDecalSprite` fra `effects/decals.js` (dynamisk import, egen enkel reserve).
  - Ringbuffer på 24 vektenheter per objekt, der scorch teller 3. Når budsjettet er fullt, skyves de eldste ut og objektet bakes på nytt fra sikkerhetskopien (sprite og topplag i begge visninger). `usingVfxSprites()` sier om VFX-spritene er lastet.
- **Utsatt bake (26.10):** `addCoverDecal` legger i kø og returnerer straks (< 0,1 ms). Ventende dekaler tegnes direkte rett etter objektet (`drawSorted` kaller `world.arena.drawPendingDecals(ctx, o, world)` når `o.pendDecals` er satt), og `drawTop` baker høyst ett objekt per bilde innen 1,2 ms. Trekvart: bakes bare i spriten (ikke i topplaget), så reserveveien uten sortering viser ikke dekaler.
- `clearCoverDecals(world)` gjenoppretter originalene (cachen deles mellom lastinger). Arena kaller den selv på `arenaLoaded` og `levelStart`. `decalStats(world) → { objects, decals, weight }`.
- **Varme dekaler:** `drawSorted` kaller `world.arena.onCoverDraw(ctx, o, world)` rett etter objektet når `o.hotDecals` er sann (VFX setter og nullstiller flagget). ctx har verdenstransform og er lagret og gjenopprettet rundt kallet. Feil i kroken fanges.
- Verktøy: `game/src/arena/_tools/decals-shot.cjs [34|top]` gir skjermbildet `shots/arena-decals-v1(-top).png/.jpg`.

### Innkobling i loop.js (Breach 23.10)
loop.render setter `world.depthSorted = world.view === '34' && canSort(world)`. Når den er true, kalles `drawSorted(ctx, world, camera, { cover: arena.coverObjects(world), drawCover: arena.drawCoverObject })` før `enemies.draw` og `player.draw`. Disse kalles fortsatt, men skal da IKKE tegne selve aktøren, bare tillegg som siktelinjer og varsler. Sjekk `world.depthSorted`, ikke `world.view`.

## Høyde (z), treffkilde, effekter, UI og ytelsesmerker (Breach 23.10, kjerneintegrasjon for demo av brett 1)
Grunnlag: `src/player/forslag/core-api-sikte-munning.md` (Warden-design). Logikken er fortsatt ren 2D, og z er bare visuell og står i hendelsene.
- **Prosjektilhøyde:** `spawnProjectile({ ..., z? })`. Uten `opts.z` henter core z fra `owner.muzzle.z`, og deretter fra `owner.muzzleZ` når den er et tall. Har kula en z, settes `p.z0 = p.z` (munningen) og `p.zAim = PROJ.aimZ` (27, bryst).
  - `projectileZ(p)` gir den visuelle høyden nå: lineært fra z0 til zAim over de første `AIM_Z_BLEND` (60) px, deretter zAim. Uten z0 brukes `p.z ?? DEFAULT_PROJECTILE_Z` (= aimZ).
  - Eksporterer også `coverHeightZ(o)` (samme regel som depth/view34) og `pointHidden(world, x, y, z)`. Den siste er sann når punktet ligger bak dekning sett fra kameraet i 34, og er samme regel som `weapons/view34.hidden`.
- **z i hendelser:**
  - `shot`: `z = p.z ?? 0`, altså munningshøyden.
  - `projectileHit`: `z = projectileZ(p)`, eller 0 uten høyde.
  - `coverHit`: `z = projectileZ(p)` klippet til `[2, dekningshøyde − 2]`.
- **drawProjectiles:** i 34 løftes kula med `projectileZ(p) · zScale`. Hode og hale som er skjult bak dekning (`pointHidden`) tegnes ikke, så kuler legges ikke oppå containertak. Våpens egne kuler (`p.wfx` + `p.tint` med gjennomsiktig `p.color`) hoppes over, fordi `weapons/fx.drawTracers` tegner dem med samme z-modell.
- **Treffkilde:** `hit.source` for kuler er alltid `{ projectile, owner, entity, team, world, x, y, z, weapon, kind, type, variant }`. Her er x/y = `p.srcX/srcY`, ellers munningen `p.ox/oy`. `damage()` fyller også inn `source.x/y` fra `source.entity/owner` når det mangler, for granater, nærkamp osv. `enemies.sourceForHit` er dermed overflødig (den gjør ingenting når x er satt).
- **Kamera:** i 34 bruker lead `PROJ.aimGround(mouse)`, dvs. musa tolket i brysthøyde.
- **Effekter (Effekter, `src/effects`):** loop.js kaller `vfx.init` og `bindEvents` når loopen lages. `vfx.update` kjører i steget. Tegning: `vfx.draw('under')` etter arena.draw, og `vfx.draw('over')` etter prosjektiler og core-effekter. Hva som er slått på, styres av `effects/bind.js` MIGRATION.
- **UI (Våpen, `src/ui`):** `main.js` kaller `ui.initUI(world, { loop, onRestartWave, onQuit })`, og `mods.hud` tegner skaderetningen. Restart og quit går gjennom kjeden `levels.restartWave` / `arena.openMainMenu` når de finnes. Reserve: `levels.startAt(n, gjeldende bølge, { skipCutscenes, upgrades })` og `location.reload()`. `window.BREACH.ui` er satt.
- **Ytelsesmerker:** loop.js kaller `world.perf?.mark(navn)` RETT FØR hvert system. Tiden for et system er derfor neste merke minus dette merket. Arena eier `world.perf` og overlegget `?perf=1`.
  - Navn i oppdateringen: `update:{level,player,enemies,arena,physics,weapons,projectiles,effects}`, avsluttet med `update:end`. Det kan komme flere steg per bilde.
  - Navn i tegningen: `render:begin`, `render:{arena,fxUnder,cover,sorted,enemies,player,weapons,projectiles,fxOver,top,hud,levelHud,playerHud}`, avsluttet med `render:end`.
  - Uten `world.perf` koster det bare et `?.`-oppslag.
