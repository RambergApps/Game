# VÅPEN – Breach (v1 + revisjon 2 + revisjon 3 + revisjon 4)

Eier: Breach Våpen. Kode: `game/src/weapons/`. Tall: `weapons/data.js` (våpen, fiendeprofiler, granat og `TUNING` for ammokasser og nærkamp – eneste sted å tune). All tekst i spillet er engelsk; denne fila er bokmål.

Skala: 1 rute (r) = 32 px. Spiller 100 HP. Fiender fra `enemies/stats.js`: Grunt 100, Flanker 70, Heavy 320 (20 % rustning), Grenadier 90.

## Våpnene (låste id-er)

| id | Navn i spillet | Rolle | Skade | rpm | Magasin / reserve | Lading | Skadefall |
|---|---|---|---|---|---|---|---|
| `rifle` | AR-9 Vanguard | Allround, middels hold | 14 | 600, auto | **24** / **240** (rev. 5, var 168) | 1,8 s | 100 % til **12 r** → **70 %** ved **24 r** |
| `shotgun` | S-12 Breaker | Dødelig ≤ 4 r, Flanker-svar | 16 × 8 hagl | 75, semi | 6 / 36 (rev. 5, var 30) | 2,2 s | 100 % til 3 r → 15 % ved 8 r; rekkevidde 11 r |
| `marksman` | M-4 Sentinel | Langt hold, straffer de som kikker ut | 80 | 63, semi | 5 / 25 | 2,5 s | Omvendt rampe: **70 % ≤ 4 r → 100 % ≥ 13 r** |

Uthevet = endret i revisjon 2 (før: AR 30/180, skadefall 10→20 r / 65 %; M-4-rampe 75 % ≤ 4 r → 100 % ≥ 12 r, stødig = av/på etter 0,55 s).

Begrunnelse:
- **AR-9** dreper Grunt på 8 treff (0,8–1,1 s innen 12 r). Mykere skadefall (12→24 r, gulv 70 %) gir en jevn kurve ut til 24 r uten at den slår M-4 på langt hold. **Magasin 24** gjør at Heavy (320 HP, 20 % rustning ≈ 29 treff) ALLTID krever én lading uansett avstand. Før lå grensen midt i tabellen (30 skudd holdt innen 12 r, ikke på 16 r) og ga hoppet 3,7 → 6,1 s. Nå er Heavy-kurven 5,1 → 5,7 s (16 r) → 6,9 s (24 r), og aktiv reload (perfekt = ferdig straks + 15 %) er der ferdigheten ligger. Hagla er fortsatt svaret på Heavy på nært hold (2,4 s).
- **S-12**: 128 skade per avtrekk på 2 r, altså én-skudd på alt unntatt Heavy. På 8 r er det bare ~20 igjen. Pumpen (0,8 s) straffer bom.
- **M-4**: 80 grunnskade. **Stødig sikte lades nå gradvis**: stå stille og sikt; fra 0,2 s til 1,0 s stiger bonusen lineært fra ×1,0 til ×1,3 (og spredningen strammes inn mot 0,1°). Én-skudd på Grunt krever ≥ 100 skade, dvs. full lading og treffavstand ≥ ~11,9 r (≈ 13,5 r mellom sentrene, fordi munningen er 38 px foran og målets radius trekkes fra). Trådkorset viser **forventet skade ved musepekeren** og «LETHAL» ved ≥ 100, så grensen er lesbar i stedet for usynlig. Rampen gjør den svak på nært hold (56 uladet på 2 r), ellers ville den overta haglas rolle.
- **M-4 og jevnhet (oppgave 1)**: Med reaksjonsskudd (målet dukker opp, lading starter nå, skytteren venter på lading når det dreper raskere enn et oppfølgingsskudd) er Grunt-kurven nå jevn: 1,03–1,12 s fra 8 til 20 r (før 1,08 → 0,18 s på 12 → 16 r). På lang avstand krever én-skudd ~0,9 s lading, omtrent like lang tid som to raske skudd – det er ikke lenger en «gratis» drapsknapp. Forhåndssiktet (står stille og venter på en kikker) er grensen fortsatt et trinn (1,10 s på 13 r → 0,17 s på 14 r), men det er nettopp rollen: plukke ut de som kikker ut på langt hold, og grensen vises i trådkorset.
- **Grenadier** (90 HP) én-skudd fullt ladet fra ~11 r (før ~10 r). Grenadierens ideelle avstand er ~8,4 r, så den kan fortsatt presse M-4 ved å gå nærmere. Reaksjonskurven mot Grenadier er jevn (1,07 → 0,95 → 0,77 → 0,70 s fra 11 til 16 r). Jeg vurderte å svekke dette mer, men lot det stå: Grenadieren er en prioritert trussel som skal kunne straffes på avstand.
- Felles: spredning øker med fart (moveSpread, halvert når man sikter) og med blindfire. Oppgraderinger fra `world.playerStats` skaleres relativt mot AR-9: `mag = round(w.mag × magSize / WEAPONS.rifle.mag)` og `reload = w.reloadTime × reloadTime / WEAPONS.rifle.reloadTime` (grunnlaget importeres fra data.js, ikke hardkodet – levels/upgrades.js BASE_STATS leser de samme tallene). Uten oppgradering er faktoren nøyaktig 1,0: AR-9 24, S-12 6, M-4 5, lading 1,8/2,2/2,5 s (verifisert i index.html). coverSpreadMult brukes direkte; grenades er absolutt (maks antall).

## Skadefall i core (dmgAt) og gjennomslag (AP Rounds)

- Hver kule får `p.dmgAt = (d) => base * falloffMult(w, d)`, der `d` er core sin eksakte avstand fra munning til treffpunkt. `p.dmg = base` står igjen som reserve. Den gamle getteren med `+speed/120`-kompensasjon er fjernet.
- Gjennomslag: core gir spillerkuler `pierce`/`pierceMult` fra `world.playerStats.pierce` / `pierceDamageMult` (0,6). Oppgraderingen **'ap-rounds'** i `levels/upgrades.js` (`pierce +1`) virker dermed automatisk for alle tre våpen, også hver hagl (klonene arver feltet; gjennomslagslisten nullstilles per hagl). Ingen egen kode i weapons trengs. Vil man ha det per våpen, kan `tryFire(..., { projectile: { pierce, pierceMult } })` overstyre.

## Granat (`weapons/grenades.js`)

- `spawnGrenade(world, {x, y, angle, power, owner, team})`. power 0–1 gir kastlengde 64–288 px (2–9 r).
- Bue med høyde z og tyngdekraft 900; spretter mot høy dekning, og mot lav dekning når z < 16; ruller med friksjon.
- Lunte 1,6 s. Skade 120 innenfor 24 px, lineært ned til 20 % ved 112 px, 0 utenfor. Høy dekning blokkerer helt. Egen kaster tar 50 %. Lagkamerater tar ingen skade.
- 2 granater (`playerStats.grenades` overstyrer). Cooldown 0,6 s mellom kast (regnes fra slipp).
- **Oppladning (rev. 3)**: `weapons.throwGrenade` starter et kast med `TUNING.grenade.windup` = 0,22 s før granaten finnes. Vinkel og kraft låses ved start, og granaten trekkes fra straks. Under oppladningen kan man ikke skyte (`tryFire` → reason `'grenade'`), slå eller starte et nytt kast. Dør kasteren, avbrytes kastet.
  - `'grenade'` {phase:`'windup'`, windup: 0,22, x, y, angle, power, entity, team} – kastet starter (animasjonen synkes på `windup`).
  - `'grenade'` {phase:`'throw'`, x, y, angle, power, grenade, …} – granaten slippes (sendes av `spawnGrenade`, så også fiendegranater får `phase:'throw'`).
- **Kastpunkt** (`weapons.throwPoint`): `entity.throwHand` {x,y} → `entity.rig.socket('throwHand')` → `entity.socket('throwHand')` → reserve: r + 4 px foran i kastretningen. Leses ved slipp. I dag eksponerer spilleren bare `p.muzzle` (rigen er privat i player/index.js), så reserven brukes til Karakter setter `p.throwHand`.
- Hendelser: `'grenade'` (windup/throw), `'grenadeBounce'`, `'explosion'`.

## Aktiv reload (Gears-stil)

R starter ladingen, R igjen mens baren går:

| Sone | Vindu | Resultat |
|---|---|---|
| Perfekt (hvit) | 39–46 % | Ferdig straks, og +15 % skade på hele neste magasin |
| God (lys cyan) | 46–56 % | Ferdig straks |
| Bom | 17–94 % utenfor sonene | Fastkjørt: +0,7 s (S-12 og M-4: +0,8 s) |

## Ammokasser (`weapons/crates.js`, tall i `TUNING.ammoCrate`)

Bestemt av Alexander 23.10: ammo kommer fra kasser i arenaen, ikke påfyll mellom bølgene. Vi lytter **ikke** på `waveEnd`.

| Tuning | Verdi | Betydning |
|---|---|---|
| `radius` | 0,8 r = 25,6 px | Avstand fra kassesenter til **spillerens senter** (spillerens r regnes ikke med – du må gå «inn i» kassen) |
| `cooldown` | 18 s | Per kasse, world.time-basert (rev. 5, var 25 s) |
| `grenades` | +1 | Per bruk, opp til maks |
| `grenadeMax` | null | null = `world.playerStats.grenades` ?? loadoutens maks (2) |
| `allWeapons` | true | Magasin + reserve for alle våpen (false = bare våpenet i hånda) |
| `pulse` | 0,6 s | «Klar igjen»-puls |

Regler: bare `team === 'player'` kan bruke kasser. Kassen brukes bare hvis noe mangler (magasin, reserve eller granat) – er alt fullt, brennes ikke nedkjølingen. En pågående lading/jam avbrytes ryddig (`reload` phase `end`, result `cancel`), magasinet er fullt etterpå.

**Kontrakt mot Arena:**

| Felt | Hvem skriver | Hvem leser |
|---|---|---|
| `world.arena.ammoCrates = [{id, x, y}]` | Arena (ved lasting) | Weapons (tåler at lista mangler/er tom) |
| `crate.ready` (bool) | Weapons, hvert steg | Arena (f.eks. lokk åpent/lukket) |
| `crate.readyAt` (world.time) | Weapons (0/udefinert = klar) | Arena |
| `crate.lastUsedBy` | Weapons | – |

Tegning: **Arena tegner kassekroppen.** Weapons tegner bare tilstandsvisningen oppå posisjonen i `weapons.draw` (som loopen kaller etter aktørene): klar = pulserende cyan glød, tre patroner og stiplet bruksradius; nedkjøling = rødlig lys, nedtellingsring som fylles og sekunder igjen; kort cyan puls når den blir klar. Testsiden tegner en enkel stub-kropp merket «STUB».

Hendelse: `'refill'` {entity, x, y, crateId, team}.

`refill(world, entity, opts?)` er eksportert (tester og evt. senere drops): fyller magasin (effektiv størrelse med oppgraderinger) og reserve, granater (`opts.grenades` antall, standard fyll til maks), avbryter lading. `needsRefill(world, entity, opts?)` svarer om noe mangler. Gammel signatur `refill(entity)` virker fortsatt.

## Nærkamp / kolbeslag (`weapons/melee.js`, tall i `TUNING.melee`)

Tast **F** (i `handleInput`). Virker med alle tre våpen og uten ammo. Samme API for fiender.

| Tuning | Verdi | Valg |
|---|---|---|
| `arcDeg` | 100° | ±50° rundt vinkelen. Store mål får litt toleranse (målets kant teller) |
| `range` | 1,3 r = 41,6 px | Fra angriperens **senter** til målets **kant** (`avstand − target.r ≤ range`) |
| `dmg` | 50 | Via core `damage(target, 50, source, world)`, `source.weapon = 'melee'`; rustning gjelder (Heavy tar 40) |
| `cooldown` | 0,7 s | Fra start av slaget |
| `contactAt` | 0,165 s | (rev. 3, var `windup` 0,12) Treffet avgjøres her, **med vinkelen låst ved start** (forutsigbart og i takt med animasjonen; man kan ikke «sveipe» etter et mål). Faller sammen med Karakters hitstop (165 ms) |
| `recover` | 0,155 s | (rev. 3, var 0,2) Fra kontakt → phase `end`. Skyteblokk = 0,165 + 0,155 = **0,32 s, uendret** (= `meleeCancelAt`) |
| `knockback` | 18 px / 0,09 s | (rev. 5, var 10 px momentant) Glir med ease-out over `knockbackTime`; stoppes av høy dekning steg for steg |
| `hitstop` / `killHitstop` | 0,075 / 0,095 s | (rev. 5, var 0,05) Bare ved treff; drap gir den lengre |
| `flash` | 0,1 s | (rev. 5) Hvitt treffblink på målet; `target.meleeFlashUntil` |
| `stagger` | 0,4 s | `target.staggerUntil = max(eksisterende, world.time + 0,4)` (Fiende-AI og Karakter leser) |
| `enemy` | 30 / 0,25 s | (rev. 4) Skade og stagger for slag fra fiender (team ≠ `'player'`), se «Overstyring» under |
| `shake` | 3 px / 90 ms | Bare når en fiende treffer den kameraet følger (Karakter eier risten for spillerens slag, rev. 3c) |

Regler:
- Avbryter pågående lading/aktiv reload: tilbake til før ladingen, magasinet er IKKE fylt (`reload` end `cancel`).
- Kan ikke skyte, lade eller bytte våpen under slaget (`tryFire` → reason `'melee'`).
- Høy dekning blokkerer (core `lineOfSight` fra angriper til mål). **Lav dekning blokkerer ikke** – `lineOfSight` ser bare high cover, og det er bekreftet på testbanen (mål bak lav dekning tar 50, mål bak høy tar 0).
- Treffer alle mål i buen, bare motsatt lag (spiller → `world.enemies`, fiende → `world.player`).
- **Overstyring av skade/stagger (rev. 4)**: `tryMelee(world, e, angle, { dmg, stagger }?)`. Verdiene velges ved **start** og lagres i meleetilstanden (`loadout.melee.dmg/stagger`), så de gjelder for akkurat det slaget. Rekkefølge:
  1. `opts.dmg` / `opts.stagger`
  2. `ENEMY_WEAPONS[profil].melee` = `{ dmg, stagger }` (bare fiender; valgfritt felt i profilen)
  3. `TUNING.melee.enemy` (30 / 0,25 s) for alle med team ≠ `'player'`
  4. `TUNING.melee` (50 / 0,4 s), spillerens kolbeslag

  `e.def.melee` (Fiende-AI sine tall for rush og oppladning) leses bevisst ikke. Da blander vi ikke AI-timing og våpenskade i samme objekt. `weapons.meleeStats(e, opts)` gir verdiene som ville blitt brukt.
- **Stagger-regel (rev. 4, alle entities, også spilleren)**: mens `world.time < e.staggerUntil`:
  - `tryMelee`/`canMelee` gir `false`.
  - Et slag i oppladning (før `contactAt`) avbrytes uten treff. Det sendes `'melee'` {phase:'end', targets:[], interrupted:true}, uten `hit`.
  - Et slag som allerede har truffet (recover), fullføres.
  - Skyting stoppes ikke av Våpen. Det er AI-en eller Karakter som avgjør det.
  - Fiende-AI trenger ikke lenger nulle `loadout.melee` selv.
- Effekt: kort lysende buestrek (ikke figurgrafikk), hvit treffblink og gnister per mål, liten kamerarist.

Hendelse `'melee'` {entity, x, y, angle, phase, targets, team, dmg?, stagger?, interrupted?}: `start` (0 s, med `dmg`/`stagger` for slaget), `hit` (0,165 s, sendes ALLTID ved kontakt; `targets: []` = bom → Lyd spiller sus, ellers treff), `end` (0,32 s; `interrupted: true` = avbrutt av stagger før kontakt, ingen `hit` før).

Status: `weapons.meleeState(entity)` → {phase: null|'windup'|'recover', t, progress, cooldown, cooldownFrac, angle}, `weapons.canMelee(world, entity)`.

### Integrasjon – Karakter (animasjon)

- F går gjennom `handleInput` (returnerer `out.melee = true` når slaget starter). Uten handleInput: `weapons.tryMelee(world, player, player.aim)`.
- Animasjon fra fasene: `start` → oppladning (0,165 s), `hit` → kontakt, `end` (0,32 s) → skyteblokken slippes. Karakters tuning har i dag `meleeWindup` 0,12 + `meleeStrike` 0,10 (steg 120–220 ms) med hitstop ved 165 ms; vår kontakt ligger nå på hitstop-tidspunktet. Karakter bør vurdere `meleeWindup` ≈ 0,165 så steget og treffet starter samtidig (forslag i review). I dekning slipper Warden dekningen først (Karakter): kall tryMelee når dekningen er sluppet, ellers står vinkelen låst fra der han sto.
- `meleeState(player).cooldownFrac` kan brukes til en liten nedkjølingsindikator (HUD-en vår tegner den ikke ennå).

### Integrasjon – Fiende-AI (Flanker)

```js
// states.js, i nærkontakt (Flanker):
if (dist - target.r <= TUNING.melee.range && weapons.canMelee(world, e)) weapons.tryMelee(world, e, e.aim);   // → true hvis startet
// stagger-reaksjon på egne fiender:
if (e.staggerUntil > world.time) { /* ikke skyt / avbryt salve, evt. stagger-animasjon */ }
```

Fiendens loadout lages automatisk ved første kall (`createEnemyLoadout` fra `e.def.weapon`). Spilleren tar 30 skade og får `staggerUntil` = +0,25 s når en Flanker treffer. Våpen blokkerer og avbryter da spillerens eget slag. Bevegelse og animasjon er Karakters ansvar.

`TUNING.melee.windup` er et alias (getter) for `contactAt` (0,165), så eldre kode som leser `windup` får riktig tall.

## Fiendeprofiler (`ENEMY_WEAPONS` i data.js)

Grunnlag: dmg og bulletSpeed fra `enemies/stats.js`, pluss skadefall. Uendelig reserve, ingen rekyl/kamerarist, ingen aktiv reload, varme farger. **Rev. 4:** profiler med `limitedMag: true` bruker magasin og lading. Andre har uendelig magasin (`L.infinite`).

| Profil (stats.js weapon) | Brukes av | Skade | Kulefart | fireInterval | Skadefall | Spredning hip/aim/blind | Magasin / lading |
|---|---|---|---|---|---|---|---|
| `rifle` | Grunt | 9 | 820 | 0,10 s | 12→22 r, gulv 60 % | 7,5 / 4,1 / 11,5° | uendelig |
| `smg` | Flanker | 7 | 860 | 0,072 s | 7→15 r, gulv 50 % | se data.js | uendelig |
| `minigun` | Heavy | 4 | 760 | 0,066 s | 14→24 r, gulv 70 % | se data.js | **60 / 3,0 s** (`limitedMag`) |
| `carbine` | Grenadier | 8 | 800 | 0,126 s | 9→18 r, gulv 60 % | se data.js | uendelig |

**Heavy (rev. 4)**:
- 60 skudd ≈ 3,93 s sammenhengende sperreild, så 3,0 s ladepause.
- tryFire gir `{fired:false, reason:'reloading'}` mens Heavy lader, og ladingen starter automatisk etter skuddet som tømmer magasinet. Hendelser: `'reload'` {phase:'start', weapon:'minigun', entity, time:3} og {phase:'end', result:'normal'}.
- Målt på testsiden (9 s kontinuerlig avtrekk): 60 skudd → lading ved 3,93 s → slutt ved 6,93 s (3,00 s, 3,02 s uten skudd) → 91 skudd totalt.
- Skade per sekund før skadefall og bom: 60/s i en salve (4 × 15,2), **34,5/s over en hel syklus** (240 skade / 6,96 s), mot 60/s før.

fireInterval er litt kortere enn AI-ens salveintervall, så det er AI-ens egen takt som styrer (tryFire avviser ikke pga. cooldown). Skadefallet betyr at fiender gjør mindre skade utover ~12 r enn i dag – Fiende-AI bør vite det når de balanserer.

### Integrasjon – Fiende-AI (skyting)

```js
import * as weapons from '../weapons/index.js';
// ved spawn (valgfritt – skjer automatisk ved første tryFire):
weapons.createEnemyLoadout(e, world);              // = createLoadout(e, [e.def.weapon], { enemy: true }, world)
// states.js, i fire-tilstanden (salvetakt/telegraf styres av AI-en som før):
weapons.tryFire(world, e, {
  aimAngle: e.aim,
  spreadRad: ai.spreadRad(w, e) * mul,                // AI-ens egen spredning i radianer (overstyrer profilen)
  muzzle: muzzle(e),                                  // valgfritt
  projectile: { telegraphed, losAtFire, flank, suppressive }, // ekstra felt flettes inn på kula
});
```

Status for AI-en: `weapons.isReloading(e)` → bool, og `weapons.current(e)` → {mag, magSize, reloading, reloadT, reloadTotal, reloadProgress, …} (virker for fiender). Ingen input, ingen kamerarist (bare når kameraet følger skytteren), uendelig ammo (`L.infinite`) unntatt profiler med `limitedMag`. Granat for Grenadier: `spawnGrenade(world, {..., dmg, radius, fuse})`. Fiende-AI skal IKKE kalle `weapons.update`/`weapons.draw` når loopen har `mods.weapons` (se under).

## Kamerarist og hitstop (`weapons/camfx.js`, rev. 3b)

- All rist fra våpnene går gjennom `camfx.shake(world, px, ms)`, som kaller core `camera.shake(amount_px, duration_ms)` direkte. Enhetene er de samme (px, ms), så ingenting konverteres. Core summerer, kapper til `shakeMax` (10 px) og ganger med `shakeScale`.
- **Ingen kode i src/weapons skriver til `camera.x/y`.** Det retningsbestemte rekylkicket (`recoil.kick` i data.js) er slått av fordi core ikke har noen kick-API. `camfx.kick()` kaller `camera.kick(angle, px)` hvis core lager den, ellers gjør den ingenting. Bare `recoil.shake` virker nå. (Testsiden plasserer kameraet i `fit()`, men det er bare oppsett av siden, ikke kick.)
- **Hitstop** via `camfx.hitstop(world, s)` → core `world.hitstop(s)`. Lengste vinner, maks 0,25 s.
  - Nærkamptreff: `TUNING.melee.hitstop` = 0,075 s (rev. 5, var 0,05), 0,095 s når slaget dreper (`killHitstop`), bare når `targets` ikke er tom (bom gir ingen frys). Karakters egen nærkamp-hitstop på 0,033 s faller i samme steg, og siden lengste vinner blir den totale frysen 0,075/0,095 s.
  - M-4-drap: `TUNING.killHitstop.marksman` = 0,03 s (~2 steg), bare når spillerens prosjektil dreper. AR-9 og S-12 er av: de dreper for ofte til at det føles bra.
  - Timerne tåler frysen. Core kaller ikke `weapons.update` mens det fryser, og `world.time` står stille. Nærkampens `M.t`/`meleeCd`, kassenes `readyAt − world.time`, granatlunter og oppladning står derfor likt. Målt: treff og bom slutter på samme simuleringstid (0,333 s) med samme gjenstående cooldown. Treffet tar bare 3 ekte steg mer. Kassens gjenstående tid var 1,00 s både før og etter 12 frosne steg.

## Skade: dekning og rustning (rev. 3-sjekk)

Våpenkoden legger aldri på dekning eller rustning selv. `dmgAt` gir grunnskade × skadefall, nærkamp sender rå 50, granaten sender `grenadeDamage` (bare avstand). Alt går gjennom core `damage()`, som tar `damageMult` → `armor` → HP én gang. `coverDamageMult` går via spillerens `armor` (player/state.js). Det eneste unntaket er TTK-verktøyet (ttk.js), som regner `1 − armor` selv i sin egen simulering, men det påvirker ikke spillet.

## API (`weapons/index.js`)

```js
import * as weapons from './weapons/index.js';
weapons.init(world);                                   // main.js gjør dette (idempotent)
weapons.createLoadout(entity, ['rifle','shotgun','marksman'], {grenades}, world);
weapons.tryFire(world, entity, {aimAngle, aiming, inCover, blind, posture, moving, muzzle, spreadRad, projectile, color}) // → {fired, reason}
weapons.reload(world, entity)                          // R: start ELLER aktiv reload-forsøk
weapons.switchWeapon(world, entity, 1|2|3|'next'|'prev'|'rifle'…)
weapons.tryMelee(world, entity, angle, {dmg, stagger}?) // F: kolbeslag → bool (false hvis staggered/nedkjøling/opptatt)
weapons.meleeStats(entity, opts?)                      // {dmg, stagger} som et slag ville fått
weapons.isReloading(entity)                            // bool (Fiende-AI: Heavy-ladepause)
weapons.throwGrenade(world, entity, tx, ty | {angle, power})  // oppladning 0,22 s → slipp; → {windup, angle, power} | null
weapons.throwPoint(entity, angle)                      // kastpunkt (throwHand-socket eller reserve)
weapons.handleInput(world, entity, input, {aiming, inCover, blind, canFire, aimAngle})  // 1/2/3, hjul, R, F, G, venstre mus
weapons.current(entity)                                // HUD/animasjon: id, mag, magSize, reserve, reloading, steady (0–1), steadyMult, …
weapons.previewDamage(entity, dist)                    // forventet skade per treff (rampe × lading × perfekt-bonus)
weapons.refill(world, entity, opts?) / needsRefill(...)
weapons.update(dt, world) / weapons.draw(ctx, world, camera)   // KUN loopen (mods.weapons) eller testsider uten den
```

Aliaser: `getWeapon(id, team?)`, `fire(world, shooter, aimAngle, opts)`. HUD i `weapons/hud.js`: `drawHud(ctx, world, entity)`, `drawReticle(ctx, world, entity, mx, my)`.

Taster (låst, PROSJEKT.md): 1/2/3 + hjul bytter, R lader, G holdes og slippes for granat, F nærkamp.

### Hvem kaller update/draw

- **Loopen i main.js eier våpnene**: `weapons.init` i main.js, og `mods.weapons` kaller `update` (etter physics, før prosjektiler) og `draw` (etter aktørene) én gang per steg/ramme.
- **Karakter kaller IKKE update/draw.** Bare `createLoadout`, `handleInput`/`tryFire`/`tryMelee`, og `drawReticle`/`drawHud`.
- Testsider uten `mods.weapons` (som `weapons/test.html`) kaller update/draw selv.
- `update` er vernet mot dobbeltkall per steg (`world._weapons.stats` teller updates/skipped/draws). `draw` er ikke vernet og må bare kalles ett sted.
- Dobbeltkall-saken er **lukket** (23.10): `enemies/weapon.js` kaller bare `weapons.update` når `world.modules.weapons` mangler. Målt i index.html: 600 steg → 600 updates, 0 hoppet over.

## Hendelser (for Lyd)

| Hendelse | Payload | Når |
|---|---|---|
| `shot` | {projectile, owner, team, entity, weapon, pellets, x, y, angle} | ÉN gang per avtrekk (core spawnProjectile). **Lyd bruker denne.** |
| `weaponFire` | {x, y, angle, team, weapon, entity, pellets, shotId, posture, steady, charge} | Samme øyeblikk. Beholdt for animasjon/statistikk (posture, lading) – ikke for lyd |
| `chamber` | {weapon, x, y, team, entity} | S-12 pumper 0,32 s og M-4 bolter 0,42 s etter skuddet |
| `reload` | {weapon, phase:'start'\|'active'\|'end', entity, x, y, team, time?, result?} | end-result: perfect/good/fail/normal/**cancel** |
| `activeReload` | {entity, weapon, result, x, y, team} | Tillegg til reload/active |
| `weaponSwitch`, `dryFire` | se kode | |
| `melee` | {entity, x, y, angle, phase:'start'\|'hit'\|'end', targets, team} | Kolbeslag; `hit` alltid (tom liste = bom) |
| `refill` | {entity, x, y, crateId, team} | Ammokasse brukt |
| `grenade` | {phase:'windup'\|'throw', x, y, angle, power, entity, team, windup? \| grenade?} | `windup` når kastet starter, `throw` når granaten slippes. **Lyd: kast-sus på `throw`, ikke `windup`** |
| `grenadeBounce` | `{x, y, grenade, team, surface: 'wall'\|'cover'\|'floor', material, cover, impact, landing}` | se «grenadeBounce: surface» under |
| `explosion` | se kode | |

Hagla: hagl 0 lages med `spawnProjectile` (→ én `shot` med `weapon:'shotgun', pellets:8`), hagl 1–7 er kloner `{...p0}` rett i `world.projectiles`, slik CORE-API.md beskriver. Målt: 398 `shot` for 398 avtrekk.

## TTK (beregnet i kode)

`node game/src/weapons/tools/ttk.mjs 200` kjører det ekte våpensystemet hodeløst (spredning, kulefart, magasin, lading, world.rng) og skriver `tools/ttk.md` / `ttk.json`. Optimal klikking for semi-våpen. Ingen aktiv reload-bonus. «Forhåndssiktet» = stått stille og siktet i 5 s før målet dukker opp.

### Før/etter revisjon 2 (berørte rader, åpent lende, sikter)

| Rad | 2 r | 4 r | 8 r | 12 r | 16 r | 24 r |
|---|---|---|---|---|---|---|
| AR-9 vs Heavy, før | 3.28 | 3.33 | 3.45 | 3.68 | **6.07** | 7.47 |
| AR-9 vs Heavy, etter | 5.10 | 5.15 | 5.27 | 5.38 | **5.72** | 6.88 |
| AR-9 vs Grunt, før | 0.83 | 0.90 | 1.00 | 1.12 | 1.35 | 1.82 |
| AR-9 vs Grunt, etter | 0.83 | 0.90 | 1.00 | 1.12 | 1.23 | 1.70 |
| M-4 vs Grunt, reaksjon, før | 0.97 | 0.98 | 1.03 | 1.08 | 1.13 | 1.25 |
| M-4 vs Grunt, reaksjon, etter | 0.97 | 0.98 | 1.03 | 1.08 | 1.03 | 1.13 |
| M-4 vs Grunt, forhåndssiktet, før/etter | 0.97 | 0.98 | 1.03 | 1.08 | 0.18 | 0.28 |

Trinnet forhåndssiktet flyttet fra ~12,4 r til ~13,5 r (sentrum–sentrum) og er nå signalisert i trådkorset. Se fin oppløsning under.

### Skade per avtrekk (formel, alle hagl treffer)

| Våpen | rpm | 2 r | 4 r | 8 r | 12 r | 16 r | 24 r |
|---|---|---|---|---|---|---|---|
| AR-9 | 600 | 14 | 14 | 14 | 14 | 13 | 10 |
| S-12 | 75 | 128 | 106 | 19 | 19 | 19 | 19 |
| M-4 | 63 | 56 | 56 | 67 | 77 | 80 | 80 |
| Granat | – | 0 r: 120 · 1 r: 120 · 2 r: 93 · 3 r: 58 · 4 r: 0 |  |

### TTK (s), sikter, mål i åpent lende

| Våpen | Mål | 2 r (64 px) | 4 r (128 px) | 8 r (256 px) | 12 r (384 px) | 16 r (512 px) | 24 r (768 px) |
|---|---|---|---|---|---|---|---|
| AR-9 | grunt | 0.83 | 0.90 | 1.00 | 1.12 | 1.23 | 1.70 |
| AR-9 | flanker | 0.48 | 0.55 | 0.65 | 0.77 | 1.00 | 1.37 |
| AR-9 | heavy | 5.10 | 5.15 | 5.27 | 5.38 | 5.72 | 6.88 |
| AR-9 | grenadier | 0.72 | 0.78 | 0.88 | 1.00 | 1.12 | 1.58 |
| S-12 | grunt | 0.02 | 0.08 | 1.80 | – | – | – |
| S-12 | flanker | 0.03 | 0.08 | 1.06 | 7.32* | – | – |
| S-12 | heavy | 2.42 | 2.48 | – | – | – | – |
| S-12 | grenadier | 0.02 | 0.08 | 1.60 | – | – | – |
| M-4 | grunt | 0.97 | 0.98 | 1.03 | 1.08 | 0.18 | 0.28 |
| M-4 | flanker | 0.02 | 0.03 | 0.08 | 0.13 | 0.18 | 0.28 |
| M-4 | heavy | 7.28 | 7.30 | 7.35 | 3.93 | 3.03 | 3.13 |
| M-4 | grenadier | 0.97 | 0.98 | 1.03 | 0.13 | 0.18 | 0.28 |

### TTK (s), hoftefyr (uten sikte), Grunt

| Våpen | Mål | 2 r (64 px) | 4 r (128 px) | 8 r (256 px) | 12 r (384 px) | 16 r (512 px) | 24 r (768 px) |
|---|---|---|---|---|---|---|---|
| AR-9 | grunt | 0.83 | 0.90 | 1.00 | 1.16 | 1.37 | 2.27 |
| S-12 | grunt | 0.02 | 0.08 | 2.39 | – | – | – |
| M-4 | grunt | 0.97 | 0.98 | 1.38 | 2.38* | 2.89* | 3.25* |

### TTK (s), blindfire fra dekning, Grunt

| Våpen | Mål | 2 r (64 px) | 4 r (128 px) | 8 r (256 px) | 12 r (384 px) | 16 r (512 px) | 24 r (768 px) |
|---|---|---|---|---|---|---|---|
| AR-9 | grunt | 0.83 | 0.92 | 1.47 | 2.35 | 3.42 | 6.49* |
| S-12 | grunt | 0.03 | 0.31 | 3.76 | – | – | – |
| M-4 | grunt | 0.97 | 1.14 | 2.35* | 3.28* | – | – |

### TTK (s), Grunt skjult bak LAV dekning (35 % treff)

| Våpen | Mål | 4 r (128 px) | 8 r (256 px) | 16 r (512 px) |
|---|---|---|---|---|
| AR-9 | grunt | 3.28 | 3.31 | 3.42 |
| S-12 | grunt | 1.60 | 6.05* | – |
| M-4 | grunt | 3.48* | 3.42* | 1.28* |

### TTK (s), Grunt kikker ut over lav dekning (popUp, 60 % treff)

| Våpen | Mål | 4 r (128 px) | 8 r (256 px) | 16 r (512 px) |
|---|---|---|---|---|
| AR-9 | grunt | 1.44 | 1.60 | 1.81 |
| S-12 | grunt | 0.84 | 3.00 | – |
| M-4 | grunt | 1.97* | 2.25* | 0.75 |

### TTK (s), reaksjon – målet dukker opp, sikting/lading starter nå (målt fra målet dukker opp)

| Våpen | Mål | 2 r (64 px) | 4 r (128 px) | 8 r (256 px) | 12 r (384 px) | 16 r (512 px) | 24 r (768 px) |
|---|---|---|---|---|---|---|---|
| AR-9 | grunt | 0.83 | 0.90 | 1.00 | 1.12 | 1.23 | 1.70 |
| AR-9 | grenadier | 0.72 | 0.78 | 0.88 | 1.00 | 1.12 | 1.58 |
| S-12 | grunt | 0.02 | 0.08 | 1.80 | – | – | – |
| S-12 | grenadier | 0.02 | 0.08 | 1.60 | – | – | – |
| M-4 | grunt | 0.97 | 0.98 | 1.03 | 1.08 | 1.03 | 1.13 |
| M-4 | grenadier | 0.97 | 0.98 | 1.03 | 0.95 | 0.70 | 0.80 |

### TTK (s), M-4 rundt én-skudd-grensen

| Våpen | Mål | 8 r (256 px) | 10 r (320 px) | 11 r (352 px) | 12 r (384 px) | 13 r (416 px) | 14 r (448 px) | 16 r (512 px) | 20 r (640 px) |
|---|---|---|---|---|---|---|---|---|---|
| M-4 | grunt (forhåndssiktet) | 1.03 | 1.07 | 1.07 | 1.08 | 1.10 | 0.17 | 0.18 | 0.23 |
| M-4 | grunt (reaksjon) | 1.03 | 1.07 | 1.07 | 1.08 | 1.10 | 1.12 | 1.03 | 1.08 |
| M-4 | grenadier (forhåndssiktet) | 1.03 | 1.07 | 0.12 | 0.13 | 0.15 | 0.17 | 0.18 | 0.23 |
| M-4 | grenadier (reaksjon) | 1.03 | 1.07 | 1.07 | 0.95 | 0.85 | 0.77 | 0.70 | 0.75 |
| M-4 | flanker (forhåndssiktet) | 0.08 | 0.12 | 0.12 | 0.13 | 0.15 | 0.17 | 0.18 | 0.23 |
| M-4 | flanker (reaksjon) | 0.60 | 0.40 | 0.12 | 0.13 | 0.15 | 0.17 | 0.18 | 0.23 |

### Fiendeprofiler: skade per treff (før rustning/dekning)

| Profil | rpm | 2 r | 4 r | 8 r | 12 r | 16 r | 24 r |
|---|---|---|---|---|---|---|---|
| rifle | 600 | 9.0 | 9.0 | 9.0 | 9.0 | 7.6 | 5.4 |
| smg | 833 | 7.0 | 7.0 | 6.6 | 4.8 | 3.5 | 3.5 |
| minigun | 909 | 4.0 | 4.0 | 4.0 | 4.0 | 3.8 | 2.8 |
| carbine | 476 | 8.0 | 8.0 | 8.0 | 6.9 | 5.5 | 4.8 |

\* = drepte i under 98 % av forsøkene innen 8 s. – = under 50 %. TTK måles fra første avtrekk til målet dør (inkl. kulefart og lading). 200 forsøk per celle.

Lesning:
- Under 4 r er S-12 suveren (også mot Heavy: 2,4 s mot AR-9 sine 5,1 s).
- AR-9 er jevn overalt og aldri best på langt hold.
- M-4 reaksjonskurve er jevn; forhåndssiktet én-skudd fra ~13,5 r (Grunt) / ~11 r (Grenadier).
- M-4 mot Heavy har fortsatt et ladetrinn (7,35 s på 8 r → 3,93 s på 12 r: 6 skudd + lading mot 4–5 skudd). Ikke M-4 sin rolle; nevnt som kjent svakhet.
- Lav dekning (35 % treff) gjør TTK omtrent 3× lenger. Granat, flankering eller nærkamp (lav dekning stopper ikke kolbeslag) er svaret.


## grenadeBounce: surface (rev. 5, 23.10)
`grenadeBounce` sendes ved hvert merkbart sprett:
- `surface` = flatetypen granaten traff:
  - `'wall'`: arenakanten (`world.bounds`) eller en høy mur, det vil si et cover-objekt med `kind` `'wall'` eller `'building'` (Arenas høydekategori `wall`).
  - `'cover'`: alle andre dekningsobjekter, både høye (container, stabel, tank) og lave (sandsekk, barriere). Lav dekning treffes bare når granaten er under `lowCoverHeight`.
  - `'floor'`: sprett i bakken. Sendes bare når nedslaget er over 90 px/s. Første bakkesprett har `landing: true`.
- `material` = `'metal'|'concrete'|…`. For dekning og murer er det objektets `cover.material`, ellers `arena.surfaceAt(world, x, y)` og til slutt `'concrete'`. **Lyd bør lese `material` (ikke `surface`) for klangen.**
- `cover` = objektet som ble truffet (`null` for kant og gulv). `impact` = farten inn mot flaten i px/s, som kan brukes til styrke.
- Vegg og dekning sendes som før bare når farten etter sprettet er over 60 px/s. Gulvsprett er nye; før rev. 5 ga de ingen hendelse.
- `stepPhys` returnerer nå `'floor'|'cover'|'wall'|null` og lagrer detaljene i `g.lastHit`. Forhåndsvisningen er uendret.


## Revisjon 5 (23.10): respawn, siktehjelp, HUD-fading, ammo, nærkampvekt

### Respawn fyller opp (P1 fra Test)
- `weapons.init` lytter (én gang per world, i samme `sys()`-blokk som resten, så ingen dobbel registrering) på:
  - `playerState` med `from === null && to === 'move'`. Det er signaturen til `player.respawn()` i dag (bare respawn sender `from: null`).
  - `playerRespawn` og `respawn` med `{ entity }`. Disse finnes ikke ennå. **Forslag til Karakter/Levels: emit `playerRespawn { entity, x, y }` eksplisitt i `player.respawn()`**, så vi slipper å lese signaturen til `playerState`.
- `resupplyOnRespawn(world, e)` (eksportert):
  - lager loadout hvis entiteten er ny eller mangler den
  - dedupliseres per `world.time`, så flere hendelser i samme steg fyller bare én gang
  - avbryter lading stille (ingen `reload`-hendelse), og fyller magasin og reserve for alle våpen via `refill()`
  - nullstiller jam, aktiv reload, nærkamp, granatkast og -sikte, granat-cooldown, avtrekker, kø, bytte, bloom, rekyl og sikting
  - sender `weaponRespawn { entity, team, weapon, grenades }`
- **Granater: `max(nåværende, 1)`** (maks `grenadeMax`), ikke full. Begrunnelse: full påfylling ved død gjør død til en gratis granatkasse (LAGRING-dokumentet advarer mot det), mens minst 1 sikrer at spilleren aldri står uten svar mot dekning.
- Verifisert i index.html: alt satt til 0/0, 0 granater og jammet lading, så død og hopp over mellomsekvensen. Resultat: rifle 24/240, shotgun 6/36, marksman 5/25, granater 1 (av 2), lading null, nærkamp null, hp 100. Rekkefølge: `weaponRespawn`, så `playerState`.

### Siktehjelp (`weapons/aimassist.js`)
- `world.settings.aimAssist` (0–1, fra UI-innstillingene; standard 0 = av) eller `opts.aimAssist` i `fireNow`. Bare for team `'player'`, ikke blindfire.
- «Kulemagnetisme»: velger fienden med minst vinkelavvik innenfor en kjegle på 1,5°–5° (pluss halve vinkelstørrelsen til målet) med siktlinje, innen 900 px og våpenets rekkevidde. Retningen trekkes 35–80 % mot den. Ingen rng.
- Påvirker bare skuddretningen, ikke markøren.

### HUD-fading (`weapons/hud.js`)
- `HUD_FADE = { alpha: 0.25, pad: 10, speed: 10 }`. Panelet går mot 25 % når Wardens føtter/hode eller musepekeren er innenfor panelets skjermrektangel (+10 px). Glattes i sanntid. `opts.alpha` overstyrer.
- Bilder: `game/src/weapons/shots/hud-fade-before.png` og `hud-fade-after.png`.

### Ammo (analyse i review rev. 5)
- AR-9 reserve 168 → 240, S-12 30 → 36, `TUNING.ammoCrate.cooldown` 25 → 18 s. M-4 uendret.
- Begrunnelse: ved 40 % treff trenger bølge 1-5 ~198 og bølge 2-6 ~330 AR-9-skudd; før var totalen 192. Nå er det 264 per opplasting.
- `docs/LAGRING-OG-OPPLAERING.md` sier fortsatt 168 (ikke vårt dokument).

### Nærkampvekt
- `hitstop` 0,05 → 0,075 s, `killHitstop` 0,095 s, `knockback` 10 → 18 px fordelt over 0,09 s (effekt med `update`, så den står stille under hitstop og pause), `flash` 0,1 s hvitt blink på målet (`target.meleeFlashUntil`).
- Kraftigere bue: fylt kile bak strøket, strøk 11 px ved treff (før 7), høyere alfa. Flere gnister ved høy `impact`.
- **Risten er urørt**: Karakter eier risten ved spillerens slag (rev. 3c).
- `melee` phase `'hit'` har nå i tillegg:

| Felt | Betydning |
|---|---|
| `hit` | minst ett mål truffet |
| `impact` | 0–1, største per mål (skade / 50, minst 0,25; 1 ved drap) |
| `killed` | minst ett mål drept |
| `hits` | `[{ target, x, y, angle, impact, killed, dmg }]`, der x/y er kontaktpunktet på målets kant |
| `hx`, `hy` | kontaktpunkt for første mål (eller null) |
| `angle` | slagvinkelen (som før) |

## Skråvinkel (rev. 6, 23.10)
Låst 37° skrå trekvartvinkel (`world.view === '34'`). Logikken er fortsatt ren ovenfra; z gjelder bare tegning og hendelser.

**Høyde (z).** `p.z` settes ved spawn = munningshøyde (`view34.muzzleZ(world, e, d)`): `e.muzzle.z` → `e.muzzleZ` (tall/funksjon) → `e.gunZ` → `WEAPONS.x.muzzle.z` → aktørhøyde (48 / huket 30) × `muzzle.zFrac` (0,6; M-4 0,62). Core (combat.js) går visuelt fra `z0` til `PROJ.aimZ` (27) over de første 60 px (`projectileZ(p)`), og Våpen tegner med samme formel (ingen egen z-projeksjon i tillegg).
**Munningspunkt (23.10, skala 36):** `getMuzzle(e)` bruker `entity.muzzle {x,y,z}` (logisk munning fra riggen/modellen, kulene starter her) når den finnes og ligger ≤ 90 px fra aktøren; `getMuzzleDraw(e)` bruker `entity.muzzleDraw` (tegnet løpstupp, til glimt). Reserve: `WEAPONS.x.muzzle = { forward, side, z, zFrac }` (rifle 13, shotgun 11, marksman 24 px foran kroppskanten; side 4,5) = de tegnede modellene i `weapons/look/*.js`. `weaponFire` har `z` og `draw:{x,y,z}`. S-12-skadefallet er 3 r + 6 → 8 r + 6 px (munningen flyttet 6 px bakover). Modellene: docs/VAPEN-DESIGN.md.

**Okklusjon (kuler bak containertak).** `weapons/view34.js`: `hidden(world, x, y, z)` er sann når synslinjen mot kameraet (sørover og oppover, 1/zScale) går gjennom en dekningsboks: x innenfor, `y < o.y + o.h`, `z + max(0, o.y − y)/zScale ≤ høyde`. Dette tilsvarer at boksen ville blitt tegnet etter punktet i drawSorted og dekker det. Lav dekning skjuler bare det som er lavere. `visibleRuns` deler tracere/stråler i synlige biter. Core har samme regel (`pointHidden`) i drawProjectiles.
Et rent «luftlag» etter drawSorted løser IKKE dette (alt i laget havner over takene); derfor regnes okklusjon analytisk per punkt.

**Hvem tegner hva.** Våpen: glimtflamme (i munningshøyde), tracere og selve kula (`TUNING.fx.ownBullets`: `p.tint` = farge, `p.color` gjennomsiktig, core hopper over slike), hylser, granatbane (z-bue med PROJ-løft og skygge på bakken), kasser. VFX overtar treff, eksplosjon, nærkampimpact og alt sekundært rundt glimtet.
**TUNING.fx-flagg** (alle `true` nå, VFX slår av ett og ett): `muzzleSecondary`, `impacts`, `explosion`, `meleeImpact`, `blood` (isolert i `fx.bodyBlood`, fjernes av VFX), `ownBullets`, `occlusion`.

**Hendelser (rev. 6).**
| Hendelse | Felt |
|---|---|
| `weaponFire` | + `z` (munningshøyde) |
| `shot` (core) | `{x, y, z, angle, weapon, pellets, team, projectile}` |
| `coverHit` / `projectileHit` (core) | + `z` (dekning: klippet til høyde − 2) |
| `bulletImpact` (NY, Våpen) | `{kind:'cover'\|'body', x, y, z, angle, normal:{nx,ny}, surface:'metal'\|'concrete'\|'chitin'\|'flesh'\|…, weapon, team, damage, power, partial, targetId, target?, cover?, projectile}`. Treffpunkt på dekning er flyttet 1,5 px ut langs normalen. |
| `melee` phase `hit` | `weapon: 'stock'`, `heldWeapon`, `z`, `power`, `hits: [{target, targetId, x, y, z, angle, impact, power, killed, dmg, surface}]` |
| `explosion` | + `z`, `kind: 'frag'` |

Surface: `cover.material` → `cover.surface` → `arena.surfaceAt(world, x, y)` → `high` = metal, ellers concrete. Kropp: `target.material` → fiende = chitin, spiller = metal (Warden-rustning); nærkamp: fiende chitin, ellers flesh.
Testbilder: `game/src/weapons/tools/shots34.cjs <tag>` → `game/src/weapons/shots/34/`. Sammenligning: `compare-before-after.png`.
