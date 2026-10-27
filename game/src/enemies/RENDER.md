# RENDER – tegnekontrakt for fiender (Fiende-AI → Monsterdesign)

Fiende-AI, 23.10.2026. Ligger her (ikke i `docs/`) fordi `docs/` er Breachs område; Breach kan flytte/lenke den.
Avtalt med Breach Monsterdesign 13:53. Utseende-spesifikasjonen står i `docs/FIENDE-DESIGN.md`; denne fila er bare grensesnittet.

## 1. Filgrense

| Hva | Eier | Hvor |
|---|---|---|
| Tegning, sprite-cache/baking, animasjon per type | **Monsterdesign** | `game/src/enemies/look/` (Fiende-AI rører aldri denne mappa) |
| Oppførsel, kamp, `poseOf`, krok (`art.js`), plassholder, **alle varsler og markører** | **Fiende-AI** | resten av `game/src/enemies/` |

Varsler som **alltid** tegnes av Fiende-AI, oppå kroppen, uansett hvem som tegner kroppen: telegraf-laser/kjegle, Heavy-strålen (`streamLen`), nærkampvarsel, flankevarsel, granat-landingsmarkør, innhoppsvarsel (hvis Arena ikke gjør det), HP-stripe/overhead. Kroppen skal derfor **ikke** tegne disse.

## 2. Kroken (én mekanisme: `art.js`)

```js
import { registerEnemyArt } from '../index.js';      // eller '../art.js'
const off = registerEnemyArt('grunt', null, drawHusk);          // standard for typen
registerEnemyArt('heavy', 'alpha', drawKilnAlpha);              // variant
registerEnemyArt('ashmaw', null, drawAshmaw);                   // boss (typen finnes i stats.js)
off();                                                          // avregistrer
```

- `registerEnemyArt(type, variant, drawFn)` → avregistreringsfunksjon. `variant` `null`/`'*'` = standard for typen.
- Oppslag per tegning: **type+variant → type+standard → plassholder** (Fiende-AIs `drawBody`/`drawCorpse`).
- `drawFn(ctx, P, info)`:
  - returner `false` = «bruk plassholder denne framen» (f.eks. sprite ikke bakt ennå);
  - kaster den, logges **én** `console.warn` per type|variant og plassholderen brukes; `ctx` er alltid `save/restore`-pakket.
- Også tilgjengelig: `unregisterEnemyArt(type, variant)`, `getEnemyArt(type, variant)`, `listEnemyArt()`.
- **Innkobling:** `look/index.js` registrerer alt. Fiende-AI legger inn én linje `import './look/index.js';` i `enemies/index.js` **når fila finnes** (en statisk import av en fil som ikke finnes gir 404 og stopper hele modulen). Si fra når den er klar.

### Kallrekkefølge

```
Trekvart (world.depthSorted, loop → shared/depth.js drawSorted):
  drawEnemies (bakkelag):  lik → drawWithArt(layer:'corpse') || drawCorpse
                           granatmarkører, innhoppsvarsel, telegraf, nærkampvarsel
  drawSorted → enemies.drawActor(ctx, e, world, camera)
                 P = poseOf(world, e)
                 drawWithArt(ctx, P, info{layer:'body', view:'34'}) || plassholder (søyle + topp)
  drawEnemies (resten):    granater, overhead (løftet med info.lift), flankevarsel, debug
Ovenfra (ikke depthSorted):
  drawEnemies:  lik → … → for hver levende: drawWithArt(layer:'body', view:'top') || drawBody → overhead …
```

### `info`

| Felt | Type | Betydning |
|---|---|---|
| `world`, `camera` | objekt | kun lesing (`world.time` til puls, `camera.zoom` til LOD) |
| `view` | `'top'` \| `'34'` | ovenfra eller trekvart |
| `layer` | `'body'` \| `'corpse'` | kropp (dybdesortert i trekvart) eller lik på bakken |
| `proj` | `PROJ` fra `shared/` | `zScale` 0.75, `heights` osv. – samme som Warden |
| `lift` | px | aktørhøyde × zScale i trekvart (0 ovenfra); toppen av figuren = `P.y − lift` |
| `enemy` | entitet | **kun** som identitet/nøkkel (f.eks. `WeakMap`-cache per fiende). Les aldri felter fra den – alt du trenger skal stå i `P` (si fra hvis noe mangler). |

Anker: fotpunktet `(P.x, P.y)` i verdens-px; ctx er i verdenskoordinater (kameraet er satt). Ingen `shadowBlur`; glød med `'lighter'`.

## 3. `P = poseOf(world, e)` – fullstendig kontrakt

Kun lesing. Nye felt legges til bakoverkompatibelt; ingen felt fjernes uten varsel. Enheter: px = verdens-px (1 rute = 32 px), rad med 0 = øst, s = sekunder, t = `world.time`.

### Identitet og plassering
| Felt | Type / område | Merknad |
|---|---|---|
| `id` | heltall | stabil per fiende |
| `type` | `'grunt'`\|`'flanker'`\|`'heavy'`\|`'grenadier'`\|`'ashmaw'` | intern type (Husk / Lurcher / Kiln / Spitter / Ashmaw) |
| `variant` | `null` \| `'alpha'` | Kiln Alpha = `heavy` + `'alpha'` |
| `displayName` | streng \| null | «Husk», «Kiln Alpha» … (engelsk spilltekst) |
| `x`, `y` | px | fotpunkt |
| `r` | px | kollisjonsradius (Husk 15, Lurcher 13, Kiln 18, Spitter 15, Ashmaw 60; Alpha arver Kiln 18 i dag – designet sier 48 px kropp) |
| `colors` | `{main, dark, accent}` | typefarger fra stats (glød) |
| `plating` | `{plate, trim, visor, glitch 0–1}` | gammel plassholder-stil; kan ignoreres |

### Retning og bevegelse
| Felt | Type / område | Merknad |
|---|---|---|
| `facing` | rad | kroppsretning |
| `aim` | rad | våpen-/hoderetning (kan avvike fra facing) |
| `moving` | bool | |
| `speed` | px/s, 0–~200 | |
| `walkPhase` | 0–∞ | øker med tilbakelagt vei (×0.08 per px); bruk `walkPhase % 1` e.l. |
| `anim` | `'idle'`\|`'walk'`\|`'attack'`\|`'hit'`\|`'die'` | **grovklasse** fra AI-tilstanden. Prioritet: die > hit (stagger eller treff siste 0,12 s) > attack > walk > idle |
| `attackPhase` | 0–1 | gjennom hele angrepet: varsel 0–0.5, aktiv 0.5–0.8, etterslep 0.8–1; 0 utenfor angrep |
| `state` | streng | rå AI-tilstand (til debug; ikke bygg utseende på den – bruk feltene) |

### Dekning og positur
| Felt | Type / område | Merknad |
|---|---|---|
| `crouch` | 0–1 | glidende |
| `inCover` | bool | står i et dekningspunkt |
| `coverSide` | `{nx, ny}` \| null | normal fra dekningen mot fienden |
| `coverType` | `'low'`\|`'high'`\|null | |
| `popUp` | bool | reist seg over lav dekning for å skyte |
| `suppression` | 0–1 | 1 = undertrykt-terskel nådd |
| `suppressed` | bool | i undertrykt-tilstand (Husk: hodet inn) |
| `alert` | bool | reaksjonsøyeblikket |
| `flanking` | bool | flank/engage/nærkamp |
| `rise` | `{progress 0–1, duration s}` \| null | stiger opp av sprekken (innhopp) |

### Angrep
| Felt | Type / område | Merknad |
|---|---|---|
| `telegraph` | `{progress 0–1, duration s, flank bool, spinup bool}` \| null | varsel før salve / oppspinning |
| `firing` | bool | salve eller stråle pågår |
| `fireMode` | `'direct'`\|`'suppress'`\|null | |
| `muzzleFlash` | bool | ~0,06 s etter skudd |
| `muzzle` | `{x, y, z}` px | munning (skuddene kommer herfra); `z` = munningshøyde i verdens-px (= `muzzleZ`) |
| `streamLen` | px | Heavy-strålens lengde (tegnes av Fiende-AI) |
| `spin` | 0–1 | Heavy oppspinning |
| `spinPhase` | rad | Heavy roterende del |
| `throw` | `{phase:'windup'\|'release', progress 0–1, target{x,y}, radius px}` \| null | Spitter kast |
| `sacksLeft` | 0–3 \| null | Spitter: sekker igjen (−1 per kast, +1 hvert 5. s). null for andre typer |
| `melee` | `{phase:'rush'\|'charge'\|'strike'\|'recover', progress 0–1, contactAt?, contact?, hit?}` \| null | Lurcher |
| `reloading` | bool | |
| `reload` | `{progress 0–1, duration s}` \| null | Kiln: platene åpnes (spillerens åpning) |

### Skade og død
| Felt | Type / område | Merknad |
|---|---|---|
| `hp`, `maxHp` | tall | |
| `hurt` | 0–1 | blink etter treff (faller over 0,12 s) |
| `hitAt` | t \| null | `world.time` for siste treff med skade > 0 |
| `cover` | 0–1 | **Kun Hunker.** 1 = dukket i lav dekning (plater opp, også under peek/fire), 0,5 = krumbøyd sprint (seekCover/returnCover), 0 ellers |
| `peek` | 0–1 | **Kun Hunker.** Oppreisning = telegraf: 0→1 over `telegraphDur` (≥ 0,45 s); 1 i fire |
| `coverFacing` | rad | **Kun Hunker.** Coverets front (−kantnormal); `facing` når ikke i dekning |
| `anim` (Hunker) | idle/walk/hit/die/cover/fire | Hunker sender `cover` og `fire` (attack = alias for fire) |
| `attackPhase` (Hunker) | 0–1 | **Kun Hunker:** munningsblink, bare i fire (peek = 1): 0,2 = blink, 0,7 = mellom skudd, 0 ellers |
| `shieldHit` | bool | **Kun Hunker.** Siste treff (hitAt) tok ryggskjoldet (×0,5, ±60° av fronten, kun dukket) |
| `duckedLow` | bool | Alle typer: helt dukket bak lavt cover (Hunker: cover 1 og peek 0; andre: inCover/suppressed/reloadDuck med crouch ≥ 0,95). render.js dropper fot-/målringen da; telegrafringen beholdes |
| `stagger` | `{progress 0–1, duration s}` \| null | |
| `dead` | bool | |
| `corpseT` | s | tid siden død (lik fjernes etter CORPSE_TIME) |
| `deathAngle` | rad | fallretning |

### Boss / mini-boss
| Felt | Type / område | Merknad |
|---|---|---|
| `coreBroken` | 0–1 \| null | Kiln Alpha: 0 hel, 1 knust (bakre kjerne; fase 2). null for ikke-alpha. Gradert verdi tillatt (sprekker) |
| `height` | px (verden z) | aktørhøyde per type (stats.js `BODY`, interpolert med `crouch`, ×1,5 for Kiln Alpha) |
| `muzzleZ` | px (verden z) | munningshøyde ≈ 0,7 × `height`. Kulene starter her (core leser `e.muzzle.z`/`e.muzzleZ`) |
| `aimHeight` | px (verden z) | hvor spilleren bør sikte på denne fienden (brysthøyde) |
| `aimPoint` | `{x, y, z}` \| null | hvor fienden sikter: spillerens fotpunkt (logikk) med `z = PROJ.aimHeight` (27, kun visuelt) |
| `vents` | `[{id 0–7, angle rad, open bool, broken bool, heat 0–1}]` \| null | Ashmaw: 8 ventiler i ring. `angle` er relativ til `facing` (0 = rett fram ved kjeften). Lukket = mot spilleren |

`debug` (stier, plan) er kun for feilsøking.

**Plassholder i dag:** `ashmaw` står og snur kjeften mot spilleren; ventilene åpner/lukker visuelt etter retning (`behaviors/ashmaw.js`). Kampen er ikke bygd (se `docs/BOSS.md`). Alpha-kjernen er ikke brytbar ennå (`coreBroken` = 0).

## 4. Hendelser (world.events) som tegning/animasjon kan lytte på

Alle har `team:'enemy'` og `entity` (fienden) der ikke annet står. Tegning bør helst bruke `P`; hendelser er for engangseffekter.

| Hendelse | Payload (utover entity/team) | Når |
|---|---|---|
| `spawnWarn` | `{id, type, variant, displayName, x, y, t}` (t = s til innhopp) | varsel før innhopp |
| `spawnRise` | `{id, type, variant, x, y, duration}` | fienden stiger opp (P.rise starter) |
| `telegraph` | `{x, y, duration, weapon, flank, target, dir}` | varsel før salve |
| `spinup` / `spindown` | `{x, y, duration, weapon}` | Heavy |
| `heavyReload` | `{x, y, phase:'start'\|'end', duration}` | Kiln lader (platene åpnes) |
| `meleeCharge` | `{x, y, duration}` | Lurcher lader slag |
| `grenadeWindup` | `{x, y, duration, total, radius, weapon:'grenade', reason}` | Spitter starter kast |
| `grenade` | Våpen: `{phase:'windup'\|'throw', …}`; fiende-sekk: `{phase:'land', x, y, owner, grenade, fuse, surface, material}` | |
| `shot` (core) | `{projectile, owner, entity, weapon, x, y, angle}` – `weapon` er organisk: Husk `'spine'`, Kiln `'slag'`, Spitter `'acid'`, Lurcher `'barb'` | hvert skudd |
| `hit` (core) | `{target, amount, source, blocked}` – les `target.variant`; fra fiendekuler har `source` `{x, y, entity, weapon, type, variant}` | treff |
| `death` (core) / `enemyDeath` | core: `{target, source}`; vår: `{type, variant, displayName, x, y, source}` | død |
| `enemyStagger` | `{x, y, duration, interrupted}` | stagger |
| `coverEnter` / `coverExit` | `{cover, x, y}` | |
| `flank`, `enemyHunt` | `{x, y}` / `{x, y, tx, ty, stage, reason}` | |
| `footstep` | `{x, y, surface}` | hvert ~0,36 s i gange |
| Boss (planlagt, se `docs/BOSS.md`) | `bossPhase`, `weakPointExposed`, `weakPointHit`, `bossStagger`, `coverBreak`, `bossDefeated` | |
