# BREACH – felles prosjektdokument (eies av Breach, prosjektleder)

Visjon: Gears of War-inspirert, dekningsbasert arena-skytespill sett ovenfra. Spilleren er WARDEN (taktisk operatør).
Stemning: mørk industriell sci-fi, krig mot inntrenger på jorden, varme/organiske fiender mot kald grå/cyan spiller. Tyngde, dekning, disiplin.
Konseptkunst (referanse, ikke fasit for in-game-grafikk):
/cursor/stores/store-f5b37ac5-212f-49fb-a14b-90e223ecfcf0/grok-bot/agents/bcf3dd36-e1f8-4ac1-aa01-61b093acc810/attachments/

## Teknikk (låst – endres kun av Breach)
- Nettleserspill, vanilla JavaScript (ES-moduler) + Canvas 2D. Ingen byggesteg, ingen eksterne avhengigheter ved kjøring.
- Kodebase: /workspace/breach/game  (index.html + src/). Kjør med `python3 -m http.server` i game/.
- Koordinatsystem: verdensenheter i piksler, 1 rute = 32 px. Vinkel 0 = øst, radianer, med klokka (canvas-standard).
- Fast oppdatering 60 Hz: hvert system eksporterer `update(dt, world)` og `draw(ctx, world, camera)`.
- Felles `world`-objekt (src/core/world.js): player, enemies[], cover[], projectiles[], effects[], level, events.
- Hendelser via world.events.emit/on (f.eks. 'shot', 'hit', 'death', 'grenade', 'waveStart', 'coverEnter').
- Dekning: hvert cover-objekt = { x, y, w, h, type: 'low' | 'high' }. Low = kan skytes over/hoppes over, blokkerer ikke sikt. High = blokkerer sikt og kuler, må kikke rundt hjørner.
- Karakterstørrelse: kropp ca. 28–32 px i diameter i spillskala (zoom kan gi detaljer).

## Fargepalett
Spiller: rustning #3a3f45/#5a6068, stoff #8a7a5c, visir/aksent #39c6ff.
Fiender: Grunt rød #c0392b, Flanker mørkerød hette #8e1e1e, Heavy oransje glød #ff7a1a, Grenadier lilla #9b59ff.
Miljø: betong #2b2e31, metall #3d4246, varselstriper #c9a227, lys #ffb347.

## Roller
- Breach (prosjektleder): visjon, arkitektur, integrasjon, gjennomgang, all kontakt med Alexander.
- Breach Karakter: Warden-rigg, animasjoner, kontroller, dekningsmekanikk for spilleren (src/player).
- Breach Arena: arenaer, cover-plassering, miljøgrafikk, lys/effekter i miljøet (src/arena).
- Breach Fiende-AI: fire fiendetyper (oppførsel, ikke utseende), oppførsel, dekningssøk, flanking, granater, bølger (src/enemies).
- Breach Fiende-design (ny 23.10): alt fiendene ser ut som – designark, malt stil, tegning og animasjon for Cinderborn og bossene, på Karakters rigg. Fiende-AI eier oppførsel/kamp og kaller utseendet via drawActor/render.
- Breach Nivåer og story: nivårekkefølge, bølgedesign per nivå, oppgraderinger, manus og panelliste for mellomsekvensene, sluttsekvens og rulletekst (src/levels, src/story).
- Breach Lyd: lydeffekter og musikk via Web Audio, koblet på world.events (src/audio).
- Breach Våpen: våpendesign og utseende for alle tre våpen (designark, geometri til faceted-stilen, fra 23.10), våpensystem og våpendata (skade, rekkevidde, skuddtakt, spredning, magasin), våpenbytte og våpeneffekter (src/weapons). Karakter tegner våpenet i hendene og bruker weapon-API-et; Lyd lager lyd per våpen.
- Breach Effekter (ny 23.10): alle visuelle effekter (munningsglimt, treff, monsterblod, ild, eksplosjoner, aske, sprekk-glød, bosseffekter) i src/effects/, koblet på world.events.
- Breach Mellomsekvens (ny 23.10): maler panelene til mellomsekvensene (game/img/story/<panel-id>.webp) etter manuset til Nivåer og story og designarkene til Karakter og Fiende-design.
- Breach Test: spiller gjennom bygget etter hver integrasjon, skriver prioriterte funn i reviews/. Retter ikke kode selv.

## Arbeidsregler
1. Skriv kun i egen mappe. Endringer i src/core eller andres mapper: foreslå til Breach.
2. Vær kritisk: ta skjermbilder i headless Chromium, se på dem selv, og forbedre før du leverer. Ikke kall noe ferdig som ser ut som programmerer-grafikk.
3. Ved levering: skriv en kort gjennomgang i /workspace/breach/reviews/<rolle>-<dato>.md (hva er gjort, hva er svakt, åpne spørsmål).
4. Spørsmål til Alexander går via Breach, aldri direkte.
5. ALL tekst i spillet (UI, HUD, hjelp, mellomsekvenser, menyer) skal være på ENGELSK (Alexanders beslutning 23.10). Dokumentasjon, kodekommentarer og meldinger i teamet kan være norsk.

## Kjerne-API (FERDIG – se docs/CORE-API.md, som gjelder foran denne oversikten)
- core/loop.js: fast 60 Hz-løkke, kaller systemene i rekkefølge: input → level → player → enemies → projectiles → effects → arena(draw bunn) → aktører → effekter → HUD.
- core/world.js: createWorld() → { time, player, enemies, cover, projectiles, effects, level, events, rng }.
- core/input.js: input.down('KeyW'), input.pressed('KeyE'), input.mouse {x,y,worldX,worldY,left,right}.
- core/camera.js: camera {x,y,zoom}, worldToScreen/screenToWorld, shake(intensity, ms).
- core/geom.js: lineOfSight(world, ax, ay, bx, by) (high cover blokkerer), raycastCover, nearestCover(world, x, y, maxDist), circleRectCollide.
- core/combat.js: spawnProjectile(world, {x,y,angle,speed,dmg,team}), damage(entity, amount, source). team: 'player' | 'enemy'.
- Modulkontrakt for hver rolle: export function init(world), update(dt, world), draw(ctx, world, camera).
  player/index.js, enemies/index.js (createEnemy(world, type, x, y)), arena/index.js (loadArena(world, id)), levels/index.js (startLevel(world, n)), story/index.js (showCutscene(id) → Promise).
- Hver rolle lager i tillegg en egen testside i sin mappe (f.eks. src/enemies/test.html) med enkle stubber, slik at dere kan jobbe parallelt før integrasjon.

## Hendelser (world.events) – alle roller emitter disse
Navn: shot, hit, death, grenade, explosion, coverEnter, coverExit, roll, footstep, reload, waveStart, waveEnd, uiClick.
Payload der det gir mening: { x, y, team: 'player'|'enemy', weapon, surface: 'metal'|'concrete', entity }.

## Godkjente regler fra kjernen
- Lav dekning: mål inntil 48 px bak lav dekning treffes bare 35 % av gangene; skytterens egen lave dekning (innen 40 px) teller ikke.
- damage(entity, amount, source, world) – send med world så hendelser går ut.
- Plassholdere (merket PLACEHOLDER) i hver rollemappe erstattes av eieren. Behold modulkontrakten.
- Alle testsider (src/*/test.html) skal eksponere window.BREACH = { world, ... } slik at testriggen (node tests/run.mjs) kan lese tilstanden.
- Unntak: lydmodulen bruker Math.random til lydvariasjon (påvirker ikke spillogikk). Spillogikk skal bruke world.rng.
- main.js viser «Klikk for å starte» og kjører startLevel først etter klikk/tast (låser opp lyd). Tester må klikke eller kalle window.BREACH.startGame().

## Låste kontroller (fra Alexanders egen oversikt)
WASD beveg, mus sikt, venstre skyt (blindt uten høyre), høyre presis sikting over dekning, E fest/løs dekning, Q rask forflytning til ny dekning, Space rull/hopp over dekning, Shift hold for å spurte, R lad om, G granat, F nærkamp (kolbeslag, ingen ammo), 1/2/3 + hjul bytt våpen, Esc pause.
## Andre avgjørelser
- Delt rigg: src/shared/rig (eies av Karakter). Heavy kan være 36 px.
- Granater og 'explosion' eies av Våpen. Treffsjanse bak lav dekning: entity.coverHitChance per positur.
- Spillerhelse regenereres Gears-aktig etter ca. 3 s uten skade.

## Historie (LÅST 23.10): Konsept A – CINDER (detaljer i docs/STORY-KONSEPTER.md, eies av Nivåer og story)
En geotermisk boring (Deepwell) vekket varmeetende kitin-skapninger, the Cinderborn, som bryter opp gjennom bakken. Warden (W-09, Garrison 9) og troppen Hale, Okafor og Brandt holder Kessa Yard, så Deepwell Refinery og til slutt The Deepwell, der brønnen forsegles. Fiendetypene heter Husk (Grunt), Lurcher (Flanker), Kiln (Heavy) og Spitter (Grenadier). Mini-boss er Kiln Alpha og sluttboss Ashmaw. Spawn kommer fra sprekker eller synkehull med 0,6–1,2 s varsel (glød og rumling). «The Protocol» er utgått.
- KVALITETSKRAV (Alexander): monstre og mellomsekvenser skal være gjennomarbeidede, malte og realistiske, ikke tegneseriefigurer. Gjelder både spillgrafikk og stillbilder. Stemningsbildene i konseptdokumentet viser bare retning.
- Fiender: tydelige og monsteraktige, med lett lesbare silhuetter. De fire typene (Grunt, Flanker, Heavy, Grenadier), oppførsel og all mekanikk beholdes.
- Boss (Alexander 23.10): sluttboss på siste brett, 2–3 faser med svake punkter som belønner flanking og dekningsbytte, og mulig mini-boss midtveis. Den gjenbruker tryFire/tryMelee, granater og stagger og får egne animasjoner. Eierskap fordeles når konseptet er valgt: Fiende-AI tar oppførselen, Karakter animasjonen, Våpen angrepene, Arena bossarenaen, Lyd lyden og Nivåer og story plasseringen.
- Død: bølgen starter på nytt, oppgraderinger beholdes. Oppgraderinger: 3 kort, velg 1.
- Våpen-id-er (låst): 'rifle', 'shotgun', 'marksman'. shot-hendelsen har weapon satt (én shot per avtrekk, også for hagle; pellets: n i payload). Våpen sender 'chamber' {weapon, x, y, team} for pumpe/bolt, og 'reload' {weapon, phase: 'start'|'active'|'end', result} (lytt på phase; Våpen sender i tillegg 'activeReload' som ekstra). I tillegg dryFire, weaponSwitch, grenadeBounce.
- Mellomsekvenser kan ha flere bilder per sekvens (tegneseriestil) og skal ligne spillets karakterdesign. Lydstemningen avgjøres når konseptet er valgt.

- Ammo (Alexander 23.10): ammokasser plassert i arenaen, ikke påfyll mellom bølgene. world.arena.ammoCrates = [{id,x,y}] (Arena plasserer og tegner), Våpen eier logikken: gå inn i kassen = fullt magasin + reserve + 1 granat, 25 s nedkjøling per kasse, hendelse refill {entity,x,y,crateId}.

- Nærkamp (Alexander 23.10): F = kolbeslag med våpenet, virker uten ammo og med alle våpen. Våpen eier logikken (bue ~100°, rekkevidde ~1,3 ruter, 50 skade, 0,7 s nedkjøling, lite tilbakeslag + 0,4 s stagger, emit 'melee' {entity,x,y,angle,hit}). Karakter eier animasjonen (oppladning ~0,12 s, slag ~0,10 s, tilbake ~0,3 s; i dekning slipper Warden dekningen først). Fiende-AI: stagger-reaksjon. Lyd: sving + treff.

## Perspektiv (LÅST av Alexander 23.10 kl. 14): lett skrå trekvart (37°)
- view=34 blir standard når Tests punkt 1–3 er fikset (reviews/test-v3-skravinkel.md): sikte i brysthøyde (aimHeight), skudd og kuler i løpshøyde (muzzleZ), og toning av dekningstoppen til ca. 35 %.
- Felles projeksjon i src/shared/projection.js (PROJ, zScale 0,75, sortKey) og src/shared/light.js. Logikk, kollisjon og kamera er fortsatt rent ovenfra; bare tegningen løftes i z.
- Alle som tegner noe med høyde (figurer, vegger, dekning, munningsglimt, kuler, granatbuer, effekter) bruker PROJ og y-sortering på bunnkant.
- Frysen er opphevet: all ny grafikk lages for skrå vinkel.

## Ansvarsfordeling (Alexander 23.10, produksjonsgjennomgang)
- Boss: Fiende-AI eier oppførselen til Kiln Alpha og Ashmaw (docs/BOSS.md), Våpen angrepsprofilene, Fiende-design utseendet og animasjonen, Nivåer og story bølgen og manuset. Plassholdergrafikk til designet er godkjent.
- Pausemeny og innstillinger: Våpen (src/ui/, localStorage-nøkkel breach.settings). Hovedmenyen (Arena) gjenbruker SETTINGS-skjermen.
- Lagring og opplæring: Test skriver opplegget (docs/LAGRING-OG-OPPLAERING.md), Fiende-AI bygger.
- Ytelsesbudsjett: Arena (docs/YTELSE.md, mål 60 FPS i den skrå vinkelen med full bølge).
- Hovedmeny: Arena bygger, og Nivåer og story leverer bakgrunn og stil.
- Versjonskontroll (git) venter etter Alexanders beslutning.

## Botnavn (endret 23.10, etter hva de faktisk gjør)
Karakter → Breach Warden-design og animasjon · Fiende-design → Breach Monsterdesign · Fiende-AI → Breach Fiende-AI, boss og lagring · Arena → Breach Arena, meny og ytelse · Nivåer og story → Breach Story og brett · Mellomsekvens → Breach Mellomsekvens-maler · Effekter → Breach Effekter (VFX) · Våpen → Breach Våpen og pausemeny · Lyd → Breach Lyd og musikk · Test → Breach Test og spillfølelse. Rollebeskrivelsene over gjelder fortsatt.

## Lagring/død (Breach 23.10)
Ved død starter samme bølge på nytt med full helse og full ammo (magasin og reserve, minst 1 granat), og oppgraderingene beholdes. «fallen» vises bare første gang. Lagringen er beskrevet i docs/LAGRING-OG-OPPLAERING.md.

## Pause og status (Alexander 23.10)
- Hver bot holder sin egen statusfil oppdatert i docs/status/<rolle>.md, med filnavnene warden, monster, fiende-ai, arena, story, mellomsekvens, effekter, vapen, lyd og test. Filen oppdateres ved hver levering og før hver turslutt.
- Innholdet skal være: ferdig, pågår (med filer og hvor langt), neste steg, blokkert av, og siste skjermbilde eller klipp. Maks ca. 30 linjer, og den skrives slik at en ny økt kan fortsette uten annen kontekst.
- PAUSE: Breach sender «PAUSE» til alle. Hver bot oppdaterer statusfilen sin, stopper, svarer «pauset» og starter ikke nytt arbeid før FORTSETT. Breach samler alt i docs/STATUS.md.
- FORTSETT: Breach sender «FORTSETT». Hver bot leser docs/status/<rolle>.md og docs/STATUS.md og fortsetter derfra.

## Mål: demo av brett 1 (Alexander 23.10 kl. 14:15)
Felles mål for hele teamet: Kessa Yard (brett 1, 5 bølger) skal kunne spilles som en ekte demo fra start til slutt.
**Med i demoen:**
- Kjerneintegrasjon (Breach): pausemeny, innstillinger og skaderetning, effekter i loopen, kulehøyde (z) med okklusjon i 34, treffkilde med x/y, og ytelsesmerker. Levert 23.10 kl. 14:25, se CORE-API.md.
- Kantete Warden og sikte i brysthøyde i spillet (Warden-design).
- Malte Husk og Lurcher i spillet (Monsterdesign).
- Våpenmodeller (Våpen).
- Malt intro (allerede aktiv).
- Hovedmeny (Arena).
- Mellomsekvensen yard-clear (Mellomsekvens og Story).
- Full testrunde gjennom alle 5 bølgene, med ytelsesmåling (Test).

**Utenfor til etter demoen:** lagring, opplæring, bosser, brett 2–3 og de andre mellomsekvensene.

## 2026-10-27 22:49–23:13 Brett 2 godkjent for bygging (Alexander)
- 22:49: «Uavhengig av testen så kan banedesign begynne med brett 2. Først når brett 2 er klart så kan vi se på defensiv fiende ai». Stoppen «vent til jeg har spilt demoen» er opphevet.
- Bygges i /workspace/breach-brett2 etter docs/refinery-v3.md. Ingen høyder.
- 23:05: Fem overganger (trykkdør, stige opp, rør, stige ned, ventil/sluse), låses opp når seksjonen er ryddet, spilles som korte malte mellomsekvenser (1–2 paneler, <4 s, én linje, ingen stemme) ved trykk på utgangen.
- S6 får tankhelse (fuel integrity).
- Forsvarsmodus (defensiv AI) og sjefene (v2.2-utkast) venter til brett 2 er ferdig.
- Eiere: Story (layout, bølger, overgangsmekanikk, tank), Warden-design (interaksjonstast), Effekter (sprites), Mellomsekvens-maler (paneler), Test (referanseark).
