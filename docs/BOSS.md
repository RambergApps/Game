# BOSS – Kiln Alpha og Ashmaw (plan, Fiende-AI)

Fiende-AI, 23.10.2026 – **fase 1: plan, ikke implementert.** Bygger på `docs/STORY-KONSEPTER.md` (faser, seier), `docs/FIENDE-DESIGN.md` + `reviews/img/cinderborn-designark.png` (svake punkter: Alphas **brytbare kjerne**, Ashmaws **8 ventiler**), `reviews/img/cinderborn/ashmaw-*` / `kilnalpha-*`, og **Levels' kontrakt** (toppen av `levels/index.js` + `data.js` bølge `3-7`), som denne planen følger. Avvik er merket **Avvik**. Tegnekontrakten (P-felt `coreBroken`, `vents`) står i `game/src/enemies/RENDER.md`.

Enheter: 1 rute = 32 px, vinkel 0 = øst, s = sekunder, HP = skadepoeng. Alle tall er **forslag** til tuning.

## 0. Felles prinsipper («smart og rettferdig»)

1. **Hvert skadelig bossangrep har et varsel ≥ 0,8 s** (bakkeangrep 1,2 s), både visuelt (Fiende-AI tegner) og som hendelse (Lyd). Ingen skade uten forutgående `bossAttack {phase:'warn'}`.
2. **Ett stort angrep om gangen.** Adds bruker vanlige squad-tokens (maks skyttere, maks én granatkaster).
3. **Svake punkter belønner flanking** – fronten er aldri null-skade (spilleren skal ikke låses), men tydelig dårligere.
4. **Dekning respekteres:** high cover stopper alt unntatt eruption (som kommer *under* deg, med 1,2 s varsel). Bare **low** cover kan brytes (`coverBreak`), og alltid med varsel.
5. **Gjenbruk:** skudd via Våpens `tryFire` (profiler under), slag via `tryMelee(world, e, angle, {dmg, stagger})`, lob/granat via `enemies/grenades.js throwGrenade` (Våpens `spawnGrenade` + landingsmarkør), stagger via `staggerUntil`-mekanismen (bossen er `staggerImmune` mot spillerens slag; egne `bossStagger`-vinduer i stedet), adds spawnes av **Levels** (`phases[].adds`); bossen spawner ingen selv, men kan sende `bossSummon {id, phase}` som Levels kan reagere på.
6. **Skademodell for svake punkter:** core `damage()` endres ikke. Den støtter allerede `entity.damageMult = (amount, info) => …` (kjøres *før* armor, `info.source` er med) og `entity.onDamage(dmg, source, info)` (kjøres før `hit`). Bossen bruker `damageMult` til å finne treffpunktet ut fra skuddretningen (prosjektilets fart/`source.projectile`, ellers `source.owner`/`source.x/y`) mot `facing` og returnere multiplikatoren, og `onDamage` til å trekke skaden fra riktig ventil/kjerne og sende `weakPointHit`. `armor` holder grunnreduksjonen.

## 1. Kiln Alpha (mini-boss, bølge 2-6)

**Hva er nytt mot Kiln:** samme `heavy`-oppførsel (marsj, spinup, stråle, omlading = åpning), men:

| | Kiln | Kiln Alpha |
|---|---|---|
| HP | 320 (armor 0.2) | **704** (×2,2 fra Levels `VARIANTS.alpha`) – verifisert i spillet |
| Størrelse | r 18 (36 px) | design 48 px → foreslått **r 24** (åpent spørsmål, nav/dekning) |
| Spinup (varsel) | 0,6 s | **0,6 s (uendret – rettferdig)**; men kortere pause mellom strålene (peekCooldown ×0,7) |
| Magasin | 60 / 3,0 s omlading | **80 / 3,4 s** (`alphaSlag`) – lengre stråle, lengre åpning |
| Svake punkter | ryggsømmer (flankbonus) | **bakre kjerne** (brytbar) + fremre kjerne kun under stråle |
| Faser | – | 2 (spray → rasering) |
| Leder | – | gir Husks i nærheten skyte-prioritet (dekkild når den marsjerer) |

**Kjerner** (`P.coreBroken` 0–1):
- *Bakre kjerne* – 140 HP. Treff fra bakre bue (±60° rundt `facing + π`) gir **×1,5** og går til kjernen. Brytes → **fase 2**.
- *Fremre kjerne* – kun eksponert i `sustain` (kjeften åpen): treff fra fremre bue (±25°) gir **×1,3**. Brytes ikke (bare skade).
- Andre treff: vanlig skade (armor 0.2).
- Kjernebrudd gir i tillegg 15 % av maxHp i skade (føles som et gjennombrudd).

**Fase 1 – Spray (704 → bakre kjerne brutt eller HP ≤ 50 %):** Kiln-oppførsel. Ved marsj sender den `coverFire`-forespørsel til opptil 2 Husks (eksisterende `requestCoverFire`).

**Overgang:** `bossStagger {duration 1.6, reason:'core'}` – brøl (kammen reiser seg, kjernene hvite 0,8 s), står åpent; `bossPhase {id:'kilnAlpha', phase:2}`. Varselfri skade skjer ikke i overgangen.

**Fase 2 – Rasering:** 
- **Slagglob** (`slagLob`, via `throwGrenade`): mot spillerens **lave** dekning, varsel = windup 0,9 s + landingsmarkør, deretter `coverBreak` på den lave dekningen (hvis Arena støtter det). Maks hver 7. s.
- Strålen veksler mellom direkte og undertrykkende (som i dag), marsjfart +15 %.
- **Ett rop** (én gang, ved fase 2): `bossSummon {id:'kilnAlpha', phase:2}` – brølet er signalet. Ingen egne adds (Levels avgjør; 2-6 er ikke en boss-bølge, så i dag skjer ingenting).

**Seier:** HP 0 (vanlig `death`). Alpha er ikke en boss-bølge for Levels; `bossPhase` med `id:'kilnAlpha'` ignoreres av Levels (de lytter bare når `d.boss` er satt) men brukes av Lyd/Effekter/HUD.

## 2. Ashmaw (sluttboss, bølge 3-7, `zone: 'core'`)

**Kropp:** kuppel r 60 (~120 px), 8 ventiler i ring (`P.vents[i].angle = i·45°` relativt til `facing`, 0 = kjeften), kjeft foran. Står i brønnen (`zones.core`); flytter seg bare ved graving.

**HP = ventilene.** `maxHp = 8 × 150 = 1200`, `hp = Σ ventil-HP`. Seier = alle 8 ventiler knust (= HP 0) → `bossDefeated`. **Faser følger hp-andel** som i Levels' kontrakt (`at` 1,0 / 0,7 / 0,35): fase 2 kommer etter 360 skade (≈ 2,4 ventiler), fase 3 etter 780 (≈ 5,2 ventiler).

| Treff | Effekt |
|---|---|
| **Åpen ventil** (skuddretning innenfor ±22,5° av ventilens normal) | **×1,5** til den ventilen (flankebelønning). `weakPointHit` |
| Lukket ventil / kuppel | **×0,2** til nærmeste ventil (aldri null, men 7,5× dårligere enn flanke) |
| **Kjeften** (fase 3, forfra ±20°) | **×2,0**, fordeles på ventilen med minst HP igjen (høy risiko: du står i kjeglen) |
| Granat (Våpen-eksplosjon) | full skade til alle åpne ventiler innen radius (godt mot klynge bak henne) |

**Ventil-lukking:** ventiler med normal innenfor `closeArc` av retningen mot spilleren lukkes (platene glir 250 ms – `weakPointExposed {open:false}`). Ved åpning: `weakPointExposed {open:true}`.

### Faser (Ashmaw sender `e.phase` og `bossPhase`; Levels leser `e.phase` først)

| Fase | Utløser | Ventiler | `closeArc` | Angrep | Adds (Levels `phases[].adds`) |
|---|---|---|---|---|---|
| **1 Burrow** | start | 8 → 6 igjen | ±70° (≈3 lukket) | Graving/eruption, slam | 2+2 Husks (5 s, 16 s) |
| **2 Furnace** | **hp ≤ 70 %** (≈ 3. ventil på vei ned) | ≈ 5 → 3 igjen | ±100° **når hun ser deg** (≈5 lukket), ellers ±70° | Smeltekjegle, «spytt» = `bossSummon` | 2 Husks + 1 Spitter |
| **3 Collapse** | **hp ≤ 35 %** (≈ 6. ventil på vei ned) | ≈ 3 + kjeften | ingen (alle åpne) | Geysirer, slagglob, kjeften åpen | 3×2 Lurchers fra sprekkene |

> Fasene bestemmes av hp-andelen mot Levels' `phases[].at` (1,0 / 0,7 / 0,35), slik kontrakten sier. Bossen setter i tillegg `e.phase` og sender `bossPhase`, så Levels og HP-fallbacken alltid er enige. Ventilene er bare *hvor* skaden tas, ikke fasegrensene.

**Fase 1 – Burrow (graving):**
- **Dykk** (hver 14–18 s): `bossAttack {attack:'dive', phase:'warn', duration 0.8}` → synker (uskadelig i 1,6 s, ventilene lukket); en **glødende sprekk** går mot spillerens dekning (synlig sti, 1,5 s).
- **Eruption**: glødende sirkel r 56 px på spillerens dekning **1,2 s** før (`bossAttack {attack:'eruption', phase:'warn', x, y, radius, duration:1.2}` + `coverBreak {phase:'warn'}`), deretter 35 skade + dytt 120 px/s i sirkelen og `coverBreak {phase:'break'}` på **lav** dekning der. High cover brytes ikke. Hun står så oppe med **ryggen** (ventilene bak) mot der spilleren mest sannsynlig flykter (bort fra sprekken).
- **Slam** (spiller < 3 ruter): windup 0,8 s (kjeften senkes, ring på bakken), `tryMelee(world, e, angle, {dmg: 40, stagger: 0.3})` med bue 180°, rekkevidde 96 px (krever Våpen-opsjon, se §4).

**Overgang 1→2:** `bossStagger {duration 2.0, reason:'phase'}` – alle ventiler blusser 0,5 s og **står åpne** i 2,0 s (belønning). Hun graver seg til midten (`zones.core`) og blir der resten av fase 2.

**Fase 2 – Furnace (ovnen):**
- **Smeltekjegle** (hver 9–12 s): kjeften åpnes **0,8 s** (`bossAttack {attack:'moltenCone', phase:'warn', angle, arc:70°, range:260}`, kjegla tegnes på bakken), så sveip 70° over 1,6 s; 6 skade per 0,1 s i strålen (60 DPS), stoppes av high cover, low cover tar halvparten. Sveipretning er lesbar (starter på siden lengst fra spilleren).
- **Spytter Husks** (mellom kjeglene): kjeften åpnes 0,6 s og hun sender `bossSummon {id, phase:2, x, y, kind:'spit'}` – **Levels** bestemmer om det kommer adds (forslag: 2 Husks via `spawnWithWarning` foran kjeften, innenfor `maxAlive` 6). Bossen spawner ingen selv. **Avvik fra story** («kaster Husks ut av kjeften»): løses via `bossSummon`, ikke egen spawn.
- Ventiler lukker seg mot deg **mens hun ser deg** (±100°) → flank eller blind deg bak high cover og gå rundt.

**Overgang 2→3:** `bossStagger {duration 2.0, reason:'phase'}`, halvt ned i hullet (`P.vents` alle åpne), kjeften glør.

**Fase 3 – Collapse (kollaps):**
- Alle gjenværende ventiler åpne; **kjeften** er svakt punkt forfra (×2).
- **Geysirer** (hver 6–8 s): 3 sirkler r 48 nær spilleren, 1,2 s varsel, 30 skade, bryter lav dekning (`coverBreak`).
- **Slagglob** fra kjeften (`slagLob`) mot spilleren hvis han står i kjeglen (straffer «stå forfra og skyt kjeften») – windup 0,9 s.
- Lurchers kommer fra sprekkene (Levels).

**Seier:** siste ventil knust → `bossDefeated {id:'ashmaw'}` → Levels avslutter bølgen. Hun synker i brønnen (ventilene slukker én og én, 2,4 s, `P.dead`). Gjenværende adds «sovner» (story-slutten): Fiende-AI dreper dem forskjøvet over 0,5–1,5 s med `death {source: boss}` – åpent spørsmål om Levels heller vil rydde.

## 3. Hendelser (Lyd og Effekter planlegger etter denne tabellen)

Alle har `team:'enemy'` og `entity` (bossen). `id` = `'ashmaw'` eller `'kilnAlpha'`. Koordinater i verdens-px.

| Hendelse | Payload | Sendes når | Lyttere |
|---|---|---|---|
| `bossStart` | `{id, wave}` | **Levels** (finnes) – bølgen starter | HUD, Lyd |
| `bossPhase` | `{id, phase 1..3, prev, name, hpFrac 0–1, ventsBroken, ventsOpen, x, y}` | faseskift (også fase 1 ved start) | **Levels** (adds), Lyd, Effekter, Story |
| `bossAttack` | `{id, attack:'dive'\|'eruption'\|'slam'\|'moltenCone'\|'geyser'\|'slagLob'\|'spit', phase:'warn'\|'start'\|'end', duration, x, y, angle?, arc?, range?, radius?}` | hvert bossangrep, varsel først | Lyd, Effekter, HUD (kantmarkør) |
| `weakPointExposed` | `{id, point, kind:'vent'\|'core'\|'mouth', open bool, x, y}` | ventil/kjerne åpnes/lukkes | Lyd (plate-skrap), Effekter |
| `weakPointHit` | `{id, point, kind, amount, mult, flank bool, hpLeft, broken bool, x, y, source}` | treff på svakt punkt (også ×0,2-treff, `mult` viser hvilket) | Lyd (eget treff-«ping»), Effekter, HUD (treffmarkør) |
| `weakPointBroken` | `{id, point, kind, left, x, y, source}` | ventil/kjerne knust | Lyd, Effekter (eksplosjon), Story (callout) |
| `bossStagger` | `{id, duration, reason:'phase'\|'core'\|'overheat', x, y}` | åpent vindu (alle ventiler åpne / Alpha står) | Lyd, Effekter, HUD |
| `bossSummon` | `{id, phase, x, y, kind?:'phase'\|'spit'}` | ved hvert faseskift (også fase 1) og når Ashmaw «spytter» i fase 2 | **Levels** (kan legge inn adds) – bossen spawner aldri selv |
| `coverBreak` | `{phase:'warn'\|'break', cover, x, y, radius, warn, by:'eruption'\|'geyser'\|'slagLob'}` | varsel (≥ 1,2 s) og selve bruddet – kun **low** cover | **Arena** (fjerner/endrer dekning), Lyd, Effekter |
| `bossDefeated` | `{id, x, y}` | alle ventiler knust / Alpha død | **Levels** (bølgen vunnet), Story, Lyd |
| `bossEnd` | `{id, skipped}` | **Levels** (finnes) | HUD |

`shot`/`hit`/`death`/`spawnWarn`/`spawnRise` som for vanlige fiender (organiske våpen-id-er, `variant` i payload, `source.x/y`).

## 4. Nye angrepsprofiler til Våpen (forslag, `ENEMY_WEAPONS`)

| id (event-id) | Type | Tall |
|---|---|---|
| `alphaSlag` (`'slag'`) | minigun-variant | dmg 5, fireInterval 0,06, speed 720, spread som minigun, limitedMag **80**, reload **3,4 s** |
| `slagLob` (`'slag'`) | lob (som granat, `spawnGrenade`) | kast 96–320 px, flytid 0,8 s, lunte etter landing 0,9 s, radius 64, dmg 35 → 20 % ved kant, etterlater **slaggpøl** r 48 i 3 s, 10 DPS (ny «hazard» i Våpen eller hos oss – åpent) |
| `moltenCone` (`'molten'`) | kontinuerlig kjegle (ikke prosjektil) | rekkevidde 260 px, strålebredde ±12°, sveip 70° på 1,6 s, tick 0,1 s × 6 dmg, high cover blokkerer, low cover ×0,5. Våpen: fx/lyd-id; skaden gjør Fiende-AI med `damage()` + full `source` |
| `eruption` / `geyser` (`'eruption'`) | bakke-AoE | varsel 1,2 s, radius 56 / 48, dmg 35 / 30, dytt 120 px/s, bryter low cover |
| `bossSlam` (`'slam'`) | nærkamp | `tryMelee(world, e, angle, {dmg: 40, stagger: 0.3, range: 96, arcDeg: 180, windup: 0.8})` – **krever** at `tryMelee` tar `range/arcDeg/windup` i opts |

## 5. Bølgetype for Levels (API)

Levels har allerede kode for dette; Fiende-AI leverer:

```js
// data.js (finnes som 3-7):
{ id: '3-7', type: 'boss', boss: 'ashmaw', zone: 'core', objective: { type: 'kill', target: 'boss' }, maxAlive: 6,
  phases: [{ phase: 1, at: 1.0, name: 'Burrow', adds: [...] }, { phase: 2, at: 0.7, name: 'Furnace', adds: [...] },
           { phase: 3, at: 0.35, name: 'Collapse', adds: [...] }] }

// Fiende-AI (enemies/index.js) – STUBB LEVERT i fase 1 (enemies/boss.js):
spawnBoss(world, id, x, y, opts) → entitet i world.enemies (ukjent id → null, da hopper Levels over bølgen)
  id 'ashmaw'; x, y = midten av zones.core; opts = { wave, phases: [{phase, at, name}] } (mangler → Burrow/Furnace/Collapse 1,0/0,7/0,35)
  entitet: { type:'ashmaw', hp 1200, maxHp 1200, armor 0.5 (stubb), dead, defeated, phase 1..3, displayName:'Ashmaw', vents }
  stubben: tanky plassholder som snur seg mot spilleren (ingen angrep), faser fra hp-andel,
           bossPhase + bossSummon ved hver fase, bossStagger {reason:'phase', duration 2} ved skifte, bossDefeated ved død.
  Fase 2 (full oppførsel): angrep, ventil-skade (damageMult/onDamage), weakPointHit/Exposed/Broken, coverBreak, bossAttack.
```

**Når er bølgen ferdig:** når Fiende-AI sender `bossDefeated {id}` (alle ventiler knust). Levels' fallback (`e.dead || e.hp <= 0`) gir samme resultat fordi `hp = Σ ventil-HP`. Adds i kø kanselleres av Levels (finnes); levende adds sovner (Fiende-AI) – **adds teller ikke** mot seieren. Spillerdød → vanlig `restart` av bølgen; bossen spawnes på nytt med full HP.

## 6. Arenakrav (Foundry / The Deepwell)

- Brønn/`zones.core` i midten, r ≥ 2,4 ruter (finnes: `{x:22.5, y:19, r:2.4}`); bossen r 60 px.
- **360° gangbar ring** ≥ 5 ruter bred rundt brønnen – flanking må alltid være mulig, ingen blindveier.
- ≥ 6 **high cover** (ubrytbare) slik at hver 90°-sektor har minst én; ≥ 8 **low cover** (brytbare, `coverBreak`).
- 3 sprekker (sør, øst, nord) til adds, ≥ 8 ruter fra spillerens spawn (vest); spawnWithWarning-flaten ikke rød (Test P1-3).
- 2 ammokasser på motsatte sider av brønnen.
- **API-behov:** `world.modules.arena.breakCover(world, cover)` (eller at Arena lytter på `coverBreak {phase:'break'}`) + at nav/cover-lista oppdateres (Fiende-AI kaller `nav(world).rebuild()`).

## 7. Testkriterier («smart og rettferdig», automatiseres i `tools/headless-test.mjs`)

1. **100 %** av bossangrep med skade har `bossAttack {phase:'warn'}` ≥ 0,8 s før (bakke ≥ 1,2 s) – målt i hendelseslogg.
2. **Flankebelønning:** bot som bare skyter forfra bruker ≥ 4× lengre tid på en ventil enn bot som flanker.
3. Ventiler mot spilleren er lukket ≥ 90 % av tida i fase 2 når hun har sikt.
4. Aldri to store angrep samtidig; `coverBreak` treffer kun low cover og alltid med ≥ 1,2 s varsel.
5. Spiller bak high cover tar 0 skade fra kjegle/slagglob; spiller i det åpne tar aldri > 45 skade på 1 s.
6. Faseskift ved hp ≤ 70 % og ≤ 35 %; Levels får `bossPhase` 1, 2, 3 i rekkefølge, adds ≤ `maxAlive`. Stubben er verifisert i ekte 3-7: bølgen hoppes ikke over, fasene 1→2→3, `bossDefeated` → `bossEnd {skipped:false}` → `waveEnd`, 0 konsollfeil.
7. Tid til seier med flankende bot: 3–6 min; uten flanking > 10 min (men mulig).
8. Alpha: bakre kjerne kan brytes på ≤ 15 s med flank; fase 2 starter; 704 HP.
9. 0 konsollfeil, `node tests/run.mjs` enemies-test OK, deterministisk med seed.

## 8. Åpne spørsmål

1. **Arena:** finnes/kommer `breakCover`? Uten den blir `coverBreak` bare visuelt (lav dekning står).
2. **Alpha-størrelse:** r 18 (i dag) eller r 24 (design 48 px)? Påvirker nav og dekningspunkter.
3. **Faser vs. ventiler:** fasene følger hp-andel (kontrakten). Er det greit at fase 2 kan komme midt i en ventil (≈ 2,4 knust), eller vil Story ha skifte nøyaktig når en ventil knuses?
4. **Adds:** Levels eier dem. Vil Levels reagere på `bossSummon {kind:'spit'}` i Furnace (forslag: 2 Husks foran kjeften), eller holder `phases[].adds`?
5. **Slaggpøl / hazard:** Våpen eller Fiende-AI?
6. **Bossbar:** HUD (Breach/Karakter) leser `e.hp/maxHp`, `e.phase` og `P.vents` – 8 segmenter?
7. Skal levende adds dø når hun faller (story: «sovner»), eller ryddes av Levels?
8. Kjeften i fase 3: ×2 – for risikabelt/for lønnsomt? Tunes etter test 2.
