# effects/ – Breach VFX

See `docs/EFFEKTER.md` (Norwegian) for ownership, API, budget and migration plan.

- `index.js` – API: `init`, `spawn(world, type, params)`, `update(dt, world)`, `draw(ctx, world, camera, 'under'|'over')`, `setQuality`, `stats`, `clear`, `bindEvents`.
- `pool.js` – fixed pool (900 particles, 140 decals, 32 emitters), no per-frame allocation.
- `sprites.js` – cached offscreen sprites (no shadowBlur, no ctx.filter).
- `bind.js` – world.events → effects (not wired into the game yet).
- `scenes.js`, `designark.html` (still sheet), `test.html` (live, `?q=0.5`).
- `_tools/shot.cjs` (screenshot → `reviews/img/effekter-designark.png`), `_tools/perf.html` + `perf.cjs [k] [sync]` (load test), `_tools/sprites.html` (sprite atlas).

Serve `game/` over HTTP (ES modules): `cd game && python3 -m http.server 8765`.

## Lav dekning – `cover.js` (27.10, for Arena)
Lav dekning (barrier, sandbag/sandbags, crates/pallet, barrels, tunnel) malt for 55° (alt fra PROJ). Ferdige sprites caches per type, størrelse, høyde, seed og zoomtrinn (halve oktaver av ctx-skalaen). Per bilde gjøres bare drawImage, og det brukes ingen shadowBlur.

```js
import { drawLowCover, canDrawCover, warmCoverSprites, coverFaces, coverFacesScreen } from '../effects/cover.js';
drawLowCover(ctx, cover, env)                 // env = { PROJ, time, lit, view, part? }  (env gjenkjennes på env.PROJ)
drawLowCover(ctx, o, world, camera, opts?)    // opts = { part? }; PROJ fra shared/projection.js
// → true hvis typen ble tegnet, ellers false (da tegner Arena selv)
canDrawCover(kind)          // true for barrier, sandbag, sandbags, crates, pallet, crate, barrels, barrel, tunnel
warmCoverSprites(world)     // forhåndstegner for world.level.objects | world.objects | world.covers, zoom 1/2/4
coverFaces(o, PROJ?)        // { lift, top:{x,y,w,h}, front:{x,y,w,h}, topPoly, frontPoly } i cover-/verdensrom
coverFacesScreen(o, m)      // samme polygoner i skjermrom for transformen m (f.eks. ctx.getTransform())
```
- Felt som brukes fra o: `kind ?? type` (typen), `x, y, w, h` (bakkerektangel, verdens-px), `height ?? (elev / PROJ.zScale) ?? PROJ.heights.low`, `seed ?? id` (variasjon).
- part: `'top'`, `'front'` eller utelatt (begge).
- Geometri: løft L = height · PROJ.zScale. Toppflaten er rektangelet forskjøvet −L, og fronten er sørflaten fra y+h−L til y+h (som i shared/depth.js). Spriten har 2 px marg.
- Bruker alltid ctx sin nåværende transform og fungerer på offscreen-ctx. Arena tegner skyggen (shared/light.js), mens spriten har egen kontaktskygge.
- Innkobling: `reviews/diffs/arena-render-lowcover.diff` (én import og én linje i `drawObject`). Testside: `cover-test.html`.

## Gulv og lys (ground.js, aliaset floor.js)
- `bakeYardFloor(ctx, L, rng) → bool` tegner gulvet og malingen i verdenskoordinater. Når den returnerer true, hopper Arena over drawFloor og drawPaint.
- `drawLightPools(ctx, L, rng) → bool` tegner på det additive glødlaget og erstatter drawGlow.
- `lightStyle(light) → {color, radius, intensity}` brukes på hver lampe.
- Aliasene er `drawFloor` og `drawGlow`.
- Alt bakes ved innlasting, så ingenting kjører per frame.
- Lav dekning: sprite-pad er asymmetrisk (PL=PT=3, PR/PB = skyggeforskyvning + 5), og bakkeskyggen er maks 6 px.

## Raffineri – `refinery.js` (FORSLAG brett 2, ikke koblet inn)
```js
drawRefineryCover(ctx, o, env|world, camera?, opts?)  // typer: pipes|pipebundle, valve|valvebox, plinth|foundation; samme kallformer som drawLowCover
canDrawRefinery(kind), warmRefinerySprites(world, zooms?), _refineryCacheStats()
bakeRefineryFloor(ctx, L, rng) → bool                 // L.grates, L.trenches, L.paint.lanes; bakes ved lasting
drawGrate(ctx, rng|null, {x,y,w,h}), drawTrench(ctx, rng|null, {x,y,w,h})
drawTrenchEdge(ctx, L, {kind:'trench'|'rail', x0,y0,x1,y1, side}, rng) // flatt i gulvlaget, dekker aldri figurer
drawEdgeTank(ctx, L, {x,y,r,height?,label?}), drawPipeRack(ctx, L, {x0,x1,y,height?}), drawFlareStack(ctx, L, light) // false hvis i L.play (edgeSafe)
refineryLightStyle(l), refineryLightmapPool(ctx, L, l, alphaMul), refineryAmbient(L), drawRefineryGlow(ctx, L), drawFlareLife(ctx, L, t, view)
// lys-kind: 'flare' (oransje), 'mercury' (grønnlig), ellers natrium
```
