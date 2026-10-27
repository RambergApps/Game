# faceted: bakte, malte lavpoly-figurer (Warden v4)

Eier: Breach Warden-design og animasjon (2026-10-23). Vanilla JS + Canvas 2D, ingen byggesteg, baking i nettleseren.

Stilen erstatter «sirkel-figuren» i `styles/oblique.js` med en kantet 3D-delmodell som projiseres med `PROJ` (zScale 0,75),
skyggelegges per fasett fra `LIGHT_DIR`, males (penselstrøk, verdivariasjon, myke overganger, slitasje) og bakes til
sprites per vinkelbøtte og positur. Overkropp og bein er egne lag, så fri 360° sikting beholdes.
Bare kontaktskyggen er rund; ingen bildegenererte sprites.

| Fil | Innhold |
|---|---|
| `styles/faceted.js` | Stilen: `{ name, drawFigure(ctx, rig, F, opts), sortKey(F) }` + `renderFigure`, `muzzleOf`, `muzzleDraw`, `attachWeaponEvents`, `CFG`, `STATS`, `cacheReport`, `setRing` |
| `faceted/mesh.js` | Byggeklosser: `box`, `beam`, `loft`, `decal`, `frame`/`sub_frame` (3D-rammer, pitch + = nese ned) |
| `faceted/paint.js` | Fasettskygge (L3, V, AO mot bakken), malte strøk, slitasjeflekker, glødflater, kastet skygge |
| `faceted/bake.js` | **Felles** bake + LRU-cache (Warden + Monsterdesign): `bakeSprite`, `drawSprite`, `drawShadow`, `createSpriteCache`, `sharedCache`, `cacheReport`, `bucketOf`, `yawOf`, `q01` |
| `faceted/warden.js` | Warden-modellen: `buildLegs`, `buildUpper`, `buildMoving`, `torsoFrame`, `weaponFrame`, `layDown` (død), `tumble` (rulle), palett `WARDEN_MATS` |
| `faceted/weapons/index.js` | Våpengrensesnittet (se «Våpen») |
| `faceted/weapons/rifle.js` | Midlertidig AR-9 (`id: 'rifle'`), erstattes av `game/src/weapons/look/rifle.js` |
| `player/test-faceted.html` | Testside: T bytter oblique/faceted, C ring, `?bench=1`, `?style=oblique`, `?ring=1` |

Skjermbilde: `/workspace/breach/shots/v3-faceted-for-etter.png` (før/etter i Container Yard 1×/2×/4× i farge og gråtoner,
8 retninger 1× og 4×, positurer).

## Koble inn (én linje)

I `game/src/player/index.js`, `syncStyle`:

```js
import { faceted } from '../shared/rig/styles/faceted.js';
const want = world.view === '34' ? faceted : P.baseStyle;   // var: oblique
```

Munning og våpenhendelser (forslag til linje 119–120 og `init`, eies av sikte-jobben):

```js
p.muzzle = faceted.muzzleOf(P.rig, p.weaponId);   // {x,y,z} i verden, utledet KUN fra våpen-defen
p.muzzleZ = p.muzzle.z;
p.muzzleDraw = p.muzzle;                          // samme format som oblique.muzzleDraw (bakkepunkt + z)
// én gang per rigg: bevegelige deler følger 'chamber' / 'reload'
P.offWeapon = faceted.attachWeaponEvents(world, P.rig, p);   // returnerer avmelding
```

Gir du `opts.entity` til `rig.draw`, skriver stilen også `entity.muzzle` selv hver frame.

## Teknisk notat

**Lag og rekkefølge per figur:** skygge (bein, overkropp) → valgfri ring → `opts.under` (dekningsmerke) → bein-sprite →
skjerf (bak) → bevegelige våpendeler (hvis våpenet peker bort) → overkropp-sprite → bevegelige deler (hvis mot kamera)
→ skjerf (foran) → treffblink. Død og rulling bakes som én hel sprite (`D|…`, `R|…`).

**Nøkler** (alle inneholder implisitt stil + def + skin + oppløsning gjennom cache-id `faceted|<def>|<skin>|D<D>`):

- overkropp `U|<våpen-id.versjon.skin.slitasje>|<torso-bøtte>|<bx>|<by>|<a>|<f>|<kne>|<slide>`
- bein `L|<hofte-bøtte>|<fase 0..7>|<retning rel. hofta 0..7>|<løp>|<steg>|<amp>|<kne>|<slide>` eller `L|<bøtte>|idle|…`
- bevegelig del `M|<pump|bolt|mag>|<våpennøkkel>|<samme positurnøkkel som U>`
- **Aldri** animasjonsfase for våpen, rekyl-forskyvning, gangbob, høydefjær eller lean: de er kjøretidsforskyvninger.

**Oppløsning:** `D` (piksler per verdens-px) velges fra skjermskalaen: 1,25 / 1,75 / 2,25 / 3,25 / 4,25 for zoom ≤1 / ≤1,6 / ≤2,2 / ≤3,2 / over.
Maling skjer med 2× overskalering og halveringsnedskalering. Kontur og kantlys gjøres i spriteoppløsning.

**Bøtter:** `def.faceted.buckets` (Warden 32, monstre 16). Også `def.faceted.maxBytes`, `def.faceted.ring`, `def.faceted.weapon`.

**Proporsjoner:** kroppen er 28–32 px, aktørhøyden er 48, hjelmen sitter på z ≈ 42, og AR-9 er ≈ 36 px (bryter omrisset).

### Ytelse (målt 2026-10-23, headless Chrome, 9 figurer, zoom 2, `BENCH.perf`)

| | oblique (v3) | faceted (v4) |
|---|---|---|
| kald første frame (alt bakes) | 194 ms (21,5 ms/fig) | 543–572 ms (60–64 ms/fig) |
| varm, statisk, median | 1,13 ms/fig | **0,02 ms/fig** |
| varm, statisk, p95 | 46,7 ms/fig (støy) | 0,23–0,64 ms/fig |
| animert 240 frames, median | 0,76 ms/fig | 0,02 ms/fig |
| animert, p95 | 4,2 ms/fig | 8,8–9,3 ms/fig (nye bein-/overkroppsbøtter bakes) |
| verste frame under animasjon | 569 ms | 270–327 ms |

- Målet på ≤ 1,8 ms/fig varm er nådd med god margin: én varm figur er 2–4 `drawImage` (+ glød med `lighter`).
- Timerens oppløsning er grov (~0,1 ms), så 0,02 er et snitt over hele frames.
- **Svakhet:** bakingen kostet i snitt ≈ 15 ms, maks 89 ms per sprite (189 sprites på 2,8 s).
  - Budsjettet (3 ms per bilde) kan bare utsette en baking når det finnes en reserve-sprite.
  - Første gang en ny bøtte trengs uten reserve, gir det hakk. Se forslagene under.

### Cache og minne

**Målt:** 9 animerte figurer ga 189 sprites og **5,2 MB** (≈ 27,6 kB per sprite ved D 2,25), med 0 utkastinger.

Størrelsen skalerer med D²: ≈ 8,5 kB ved D 1,25 og ≈ 98 kB ved D 4,25.

**Teoretisk tak per skin**, for 32 vinkler × positurer (aktører med samme skin deler cache, så antall aktører ganger ikke opp):

| Type | Antall sprites |
|---|---|
| bein, gange | 32 hofte × 8 faser × 8 relative retninger × 2 (gå/løp) × 2 amp ≈ 2 048 |
| bein, i ro og kne | ≈ 160 |
| overkropp | 32 × ≈ 16 posituroppsett (stå/sikte/dekning/kikk/blindfire/kne × rekyl) ≈ 512 |
| bevegelige deler (små) | ≈ 1 024 |
| død | 32 × 9 = 288 |
| rulling | 32 × 13 = 416 |

Totalt ≈ 3 400 sprites, som tilsvarer ≈ 90 MB ved zoom 2 og ≈ 330 MB ved zoom 4. Det fylles aldri i praksis, men det viser at LRU trengs.

**Forslag til grenser** (det meste er allerede i koden):

1. **LRU per skin og oppløsning** (`sharedCache('faceted|warden|warden|D2.25')`): 32 MB som standard ved D ≤ 2,25 og 48 MB ved høyere D. Felles bildebudsjett på 3 ms for alle cacher.
2. **Bake ved behov** med reserve: forrige sprite for samme lag brukes mens en ny venter. Dette er implementert via `fallbackKeys`.
3. **Forvarming i ledig tid** (`cache.warm(key, fn)` finnes): stå + sikte for alle 32 torsobøtter og idle-bein ≈ 96 sprites ≈ 2,6 MB. Spres med `requestIdleCallback` ved banestart, maks én sprite per frame. **Ikke koblet inn ennå**, men det fjerner de fleste hakkene.
4. **Felles cache for aktører med samme skin**: Warden og eventuelle Warden-NPC-er deler cache. Cache-id-en inneholder skin, ikke aktør.
5. **Færre bøtter for monstre** (16) og eventuelt 4 relative gangretninger: gir en fjerdedel av beinsprites.
6. Senere: OffscreenCanvas-baking i en Worker for helt hakkfri baking.

## Det roll, død, kikk og blindfire trenger

- **Rulling:** fungerer som hel sprite (`tumble`, 13 trinn av `rollU`).
  - Trenger fra riggen: `F.clip.roll { phase: dive|over|land|rise, k }`, som finnes.
  - Mangler: ekte bevegelsesuskarphet. Hvis det ønskes, kan det løses med en ekstra sprite med lav alfa forskjøvet bakover.
- **Død:** hel sprite (`layDown`, 9 trinn av `clip.death.fall`). Cyan dempes til 40 % (aldri 0).
  - Trenger: at `F.clip.death.visor` og `fall` fortsetter som nå.
  - Våpenet blir liggende ved hånda. Et eget våpen-sprite på bakken vil trenge en `drop`-hendelse fra Våpen.
- **Kikk (peek):** overkroppen følger `K.ta`, `K.ox`, `K.oy` (lean) og posituren. Det fungerer, men lean er bare en forskyvning.
  - Ønsket: en `posture.peek`-avhengig rull (sideveis tilt) i riggen. Den må bli en nøkkel med 3 nivåer i `upperQ`, for å holde cachen liten.
- **Blindfire:** posituren `pose.a`/`pose.f` fra riggen gir et våpen over kanten.
  - Trenger: at riggen eksponerer et eget `pose.z`-løft (våpen over hodet). I dag brukes fast `gunZ`, så blindfire ser ut som en lav sikteposisjon.
  - Når `pose.z` finnes, skal det inn i positurnøkkelen (3 nivåer).

## Oppskrift for Monsterdesign (bytte fra `enemies/look/bake.js`)

```js
import { bakeSprite, drawSprite, drawShadow, sharedCache, bucketOf, yawOf } from '../../shared/rig/faceted/bake.js';
const N = kind.buckets || 16;
const cache = sharedCache(`husk|${skin}|D${D}`, { maxBytes: 16 << 20, budgetMs: 3 });
function sprite(kind, set, facing, i, D) {
  const dir = bucketOf(facing, N), key = `${set}|${dir}|${i}`;
  return cache.get(key, () => {
    const prep = prepare(kind.build(kind.sets[set].pose(i, kind.sets[set].n)), yawOf(dir, N), kind.scale); // deres paint3d
    return bakeSprite({ bbox: prep.bodyBox, shadowBox: prep.bbox, D, SS: 3, pad: 4,
      paint: (bc, gc) => paint(bc, gc, prep, kind.paint), shadow: (sc) => paintShadow(sc, prep), glow: true,
      contour: { px: kind.contour?.px ?? .9, a: .9, color: '6,4,4' }, rim: { px: 1, a: kind.rim?.a ?? .8, color: '255,228,178' }, grain: .22 });
  }, [`${set}|${dir}|0`]);            // reserve: første bilde i samme retning
}
// tegning: drawShadow(ctx, s, x, y, .34); drawSprite(ctx, s, x, y, { glowAlpha })
```

- `bakeFrame` blir til `bakeSprite`, og `createCache` blir til `sharedCache` med `bucketOf(facing, 16)`.
- Atlas-sider er ikke nødvendig: LRU-en holder byte-tallet.
- `cacheReport()` viser alle cacher samlet, så Arena kan ha ett budsjett.

## Våpen

Breach Våpen eier utseendet til AR-9 (`rifle`), S-12 (`shotgun`) og M-4 (`marksman`) i **`game/src/weapons/look/<id>.js`**.

Hver fil kaller `registerWeaponLook(def)` fra `game/src/shared/rig/faceted/weapons/index.js` og importeres én gang, for eksempel fra `weapons/index.js`.

Den midlertidige `faceted/weapons/rifle.js` brukes til den er erstattet. Bruk samme `id`, så vinner den sist registrerte.

### Format (ren data, samme byggeklosser som figurdelene)

```js
registerWeaponLook({
  id: 'rifle', name: 'AR-9', version: 1,            // id = våpen-id i weapons/data.js, version inngår i cache-nøkkelen
  palette: { metal: '#59626c', metalDark: '#2b3036', polymer: '#23272b', wrap: '#5c5a48', wear: '#c3c9ce', led: '#39c6ff' },
  skins: { blackout: { metal: '#3a3f45', polymer: '#16181b' } },   // delvise paletter: skin uten ny geometri
  wear: .5,                                          // 0..1, kan overstyres per aktør (rig.weaponWear)
  // våpenrom i tegnede verdens-px: x langs løpet (fram), y mot høyre, z opp. Origo bør være grepet.
  points: {
    grip:   { x: 0,     y: 0,    z: 0 },             // høyre hånd (handR)
    fore:   { x: 11.9,  y: -1.3, z: .2 },            // venstre hånd (handL), valgfri. S-12: punkt på pumpen ({ …, on: 'pump' } er reservert, hånda følger ikke pumpen ennå)
    stock:  { x: -11.5, y: 0,    z: .6 },            // skulder
    muzzle: { x: 24.5,  y: 0,    z: 1.4 },           // ENESTE kilde til munningspunktet
  },
  parts: [
    { id: 'receiver', box: [-5, 4.3, -1.3, 1.3, -.3, 3.1], mat: 'metal', c: .45 },          // box: x0,x1,y0,y1,z0,z1, c = fas
    { id: 'barrel', beam: [{ x: 15.1, y: 0, z: 1.4 }, { x: 24.5, y: 0, z: 1.4 }], w: 1, h: 1, mat: 'metalDark' },
    { plate: [{x:-1.4,y:1.32,z:1.3},{x:2.9,y:1.32,z:1.3},{x:2.9,y:1.32,z:2},{x:-1.4,y:1.32,z:2}], on: 'receiver', mat: 'led', minScale: 2 },
    { id: 'mag', box: [0, 3.6, -.8, .8, -3.8, -.2], mat: 'metalDark', move: 'mag' },
    { id: 'brake', box: [22.6, 24.5, -.75, .75, .65, 2.15], mat: 'metal', minScale: 3 },
  ],
  moving: {                                          // navngitte bevegelige deler: pump | bolt | mag
    bolt: { axis: { x: -1, y: 0, z: 0 }, travel: 2.4 },
    mag:  { axis: { x: .25, y: 0, z: -1 }, travel: 7, fade: true },
    // S-12: pump: { axis: { x: -1, y: 0, z: 0 }, travel: 3.5 }
  },
});
```

Fullt eksempel: `faceted/weapons/rifle.js`.

- **Palettnøkler:** `metal`, `metalDark`, `polymer`, `wrap`, `wear` og `led`.
  - `wear` er fargen på avskallede kanter. `led` er en cyan glødplate (#39c6ff), som bør være liten.
  - `mat` på en del er en av `metal | metalDark | polymer | wrap | led`.
  - Ramper (mørk/base/lys/topp) og malestrøk avledes automatisk, og `wear` (0..1) styrer flekktettheten.
  - Skin velges med `rig.weaponSkin` (eller `opts.weaponSkin`). Geometrien er den samme.
- **Detaljnivå** `minScale`: laveste D (≈ skjermskala) der delen tegnes.
  - Ved 1× (D 1,25) skal bare silhuetten vises: lengde, magasin, kikkert og pumpe skiller våpnene.
  - Detaljer (LED, grep, wrap, munningsbrems) får `minScale: 2` eller `3`.
- **Festepunkter:** `grip` plasseres i høyre hånd ved riggens våpenpositur (`K.pose`), og `fore` gir venstre hånd.
  - `stock` er skulderpunktet. Det brukes til tegning og er tilgjengelig for senere IK.
  - Mangler `fore`, brukes en standardposisjon langs løpet.
- **Munning:** `faceted.muzzleOf(rig, id)` → `{x, y, z}` i verden. Den regnes ut med de samme rammene som bakingen (`torsoFrame` og `weaponFrame` i `warden.js`), men med kontinuerlig torsovinkel. Det finnes ingen egne tall som kan drive fra hverandre.
  - Eksponeres som `entity.muzzle` (og `muzzleZ = muzzle.z`).
  - Verifisert på 8 retninger: munningspunktet havner på tuppen av den tegnede brems-/løpsenden (±1 px ved 4×).
- **Bevegelige deler og hendelser:** `faceted.attachWeaponEvents(world, rig, entity)` abonnerer på `world.events`, filtrert på `entity`:
  - `'chamber'`: bolt/pump fram og tilbake over 0,34 s.
  - `'reload'` `start`: magasinet ut og ned med fade.
  - `'reload'` `active`: magasinet inn igjen.
  - `'reload'` `end`: boltpuls.
  - Hendelsens `weapon`-felt velger også utseendet (`rig.__wpn.look`).
  - Animasjonen ligger i `weaponAnim(rig, def)` og er bevisst enkel.
  - Begrensning: hendene følger ikke pumpen/magasinet ennå.
- **Cache:** våpenet bakes inn i overkropp-spriten. Bevegelige deler (`move: 'pump'|'bolt'|'mag'`) bakes som **egne små sprites** (`M|<del>|…`) og legges oppå med forskyvning `WT.dir(axis) · travel · anim` ved kjøring (og alfa for `fade`).
  - Nøkkelen er **(stil, def/skin, våpen-id.versjon.skin.slitasje, vinkelbøtte, positur)**, **aldri** animasjonsfase. En lading koster derfor null nye bakinger.
  - Bytte av våpen/skin/slitasje gir nye nøkler, og de gamle forsvinner via LRU.
- **Valg av våpen per aktør:** `opts.weapon` → `rig.__wpn.look` (fra hendelser) → `rig.weaponLook` → `def.faceted.weapon` → `'rifle'`.
