// Breach Arena – arenamodul. Kontrakt: se docs/CORE-API.md og reviews/arena-2026-10-23.md
//   loadArena(world, id) -> setter world.cover, world.bounds, world.arena (+ world.level.arena)
//   init(world), update(dt, world), draw(ctx, world, camera), drawTop(ctx, world, camera)
// draw()    : gulv + lav dekning (under aktører)
// drawTop() : høy dekning, tak, lys/bloom (over aktører – gir dybde i 3/4-perspektivet)

import { YARD } from './yard.js';
import { YARD_V2 } from './yard-v2.js'; // standard for yard (27.10); ?yard=v1 gir gammel layout
import { YARD_LAVT } from './yard-lavt.js'; // testvariant, bare med ?yard=lavt
import { REFINERY } from './refinery.js';
import { FOUNDRY } from './foundry.js'; // PLASSHOLDER – gjenbruker yard-layout
import { occupancy, buildArenaLayers, createFx, updateFx, drawDynamic, drawFloorDynamic, drawFlashes, addFlash, ELEV, RES, OWN } from './render.js';
import { makeCanvas } from './paint.js';
import { installPerf } from './perf.js';
import { drawAmmoCrates, AMMO_BODY } from './ammo.js';
import { PROJ } from '../shared/projection.js';
import { walkableRect, clampWalkable, isWalkable, rescueStuck, southBlocker } from './walkable.js';
export { walkableRect, clampWalkable, isWalkable, rescueStuck, southBlocker };
import { coverHitPoint, addCoverDecal, clearCoverDecals, decalStats, drawPendingDecals, decalTick, prepareCoverDecals } from './decals.js';
export { coverHitPoint, addCoverDecal, clearCoverDecals, decalStats, drawPendingDecals };

export const TILE = 32;
// Id-ene matcher levels/data.js. 'refinery' er alias for 'refinery-crossroads'.
export const ARENAS = { yard: YARD, 'refinery-crossroads': REFINERY, 'underground-foundry': FOUNDRY, refinery: REFINERY };
export const ARENA_IDS = ['yard', 'refinery-crossroads', 'underground-foundry'];
// overhead (overpipe, catwalk) har ingen type – de er dekor over hodet og havner ikke i world.cover
const TYPE = { wall: 'high', building: 'high', container: 'high', stack: 'high', cratestack: 'high', tank: 'high', unit: 'high', pipeline: 'high',
  barrier: 'low', sandbag: 'low', crates: 'low', barrels: 'low', pipes: 'low', valve: 'low', ledge: 'low',
  // vann: stopper gange (geom.resolveCircleVsCover + nav), men ikke kuler/sikt (de sjekker bare 'high'/'low')
  water: 'water' };
const MATERIAL = { wall: 'concrete', building: 'metal', container: 'metal', stack: 'metal', cratestack: 'metal', tank: 'metal', unit: 'metal', pipeline: 'metal',
  barrier: 'concrete', sandbag: 'concrete', crates: 'metal', barrels: 'metal', pipes: 'metal', valve: 'metal', ledge: 'concrete', water: 'water' };
const OVERHEAD = { overpipe: true, catwalk: true };

// Effekter: valgfri lightStyle(light) → { color, radius, intensity } (src/effects/ground.js); brukes på hver lampe ved bygging.
let fxGround = null;
try { fxGround = await import('../effects/ground.js'); } catch (e) { fxGround = null; }
function styleLight(l) {
  if (!fxGround?.lightStyle) return l;
  try { const st = fxGround.lightStyle(l); if (!st) return l; return { ...l, ...(st.color ? { color: st.color } : null), r: st.radius ?? l.r, i: st.intensity ?? l.i }; } catch (e) { return l; }
}
const cache = new Map(); // `${id}|${view}` -> { L, layers }

// Visningsmodus: '34' (standard, trekvart med felles PROJ fra shared/projection.js) eller 'top' (ren ovenfra, for sammenligning).
// Kollisjon og world.cover er identiske i begge modusene – bare tegningen endres.
export const VIEWS = ['top', '34'];
// Høydekategori per type (verdens-px høyde = PROJ.heights[kat] × faktor). Skjermløft = høyde × PROJ.zScale.
const HCAT = { wall: ['wall', 1], building: ['wall', 1], container: ['high', 1], stack: ['high', 1], cratestack: ['high', 1],
  barrier: ['low', 1], sandbag: ['low', 1], ledge: ['low', 1], water: ['low', 0], crates: ['low', 1], barrels: ['low', 1],
  tank: ['high', 1.25], unit: ['high', 1], pipeline: ['low', 1.4], pipes: ['low', 0.6], valve: ['low', 0.7],
  overpipe: ['wall', 1.15], catwalk: ['wall', 1.05] };
// noOcclude (forslag fra Våpen 14:24): rekkverk og andre tynne, lave objekter skjuler aldri en aktør nok til at depth.js
// skal tone dekningen eller tegne omriss. Gjelder kindene under + alt 'low' som er lavere enn 0,75 × PROJ.heights.low (18 px).
// Barrier/sandbag/crates/barrels er ekte lav dekning og følger HIDE_THRESHOLD i depth.js (stående bak: ingenting; hukende: toning).
const NO_OCCLUDE = { railing: true, rail: true, fence: true, pipes: true, valve: true };
const thinLow = (kind) => !!NO_OCCLUDE[kind] || (TYPE[kind] === 'low' && heightOf(kind) <= PROJ.heights.low * 0.75);
const hash = (n) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h ^ (h >>> 13)) >>> 0; };
function heightOf(kind) { const [k, f] = HCAT[kind] || ['low', 1]; return PROJ.heights[k] * f; }
export const AMMO_HEIGHT = () => PROJ.heights.low * 0.7;

// v2: ENTRY-feltet følger spawnen (sentrert på playerSpawn, størrelse fra def.entry, ellers 5×2,5 ruter) – ett felt, aldri hardkodet.
export function entryOf(def) {
  if (def.variant !== 'v2' || !def.playerSpawn) return def.entry;
  const w = def.entry?.w || 5, h = def.entry?.h || 2.5;
  return { x: def.playerSpawn.x - w / 2, y: def.playerSpawn.y - h / 2, w, h };
}
// v2 (Breach 27.10 14:10): åpning i plattformens sørkant ved trappen (render.js drawPlatform tegner trappen 64–16 px fra øst).
// Ledge-biter som krysser trappespennet deles; åpningen er 2 ruter (Kiln r 22 = 44 px + klaring). Biter < 0,75 rute droppes.
// Story: sør-ledge (32, 14.375, 7×0.625) → (32, 14.375, 4.75×0.625); åpning x 36.75–38.75 (rest 0,25 droppes).
export function stairGapOf(def) { const p = def.zones?.platform; if (def.variant !== 'v2' || !p) return null; const c = p.x + p.w - 1.25; return { x0: c - 1, x1: c + 1, y: p.y + p.h }; }
function stairGap(def) {
  const g = stairGapOf(def); if (!g) return def.objects;
  const out = [];
  for (const o of def.objects) {
    const [kind, x, y, w, h, opts] = o;
    if (kind !== 'ledge' || w <= h || Math.abs(y + h / 2 - g.y) > 1 || x >= g.x1 || x + w <= g.x0) { out.push(o); continue; }
    if (g.x0 - x >= 0.75) out.push([kind, x, y, g.x0 - x, h, opts]);
    if (x + w - g.x1 >= 0.75) out.push([kind, g.x1, y, x + w - g.x1, h, opts]);
  }
  return out;
}
function buildLevel(def, view = '34') {
  const ent = entryOf(def);
  const T = TILE, v34 = view === '34';
  const objects = stairGap(def).map(([kind, x, y, w, h, opts = {}], id) => {
    const height = v34 ? heightOf(kind) : 0;
    const elev = v34 ? Math.round(height * PROJ.zScale) : (opts.elev || ELEV[kind] || (kind === 'ledge' ? ELEV.barrier : 0));
    const seed = hash(id + 1);
    return { id, kind, opts, type: TYPE[kind], seed, variant: seed % 3, material: MATERIAL[kind], elev, height, overhead: !!OVERHEAD[kind],
      stackBase: v34 && kind === 'stack' ? Math.round(elev / 2) : 0, noOcclude: thinLow(kind) || !!opts.noOcclude, x: x * T, y: y * T, w: w * T, h: h * T };
  });
  const rect = (r) => ({ x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T });
  const L = {
    id: def.id, name: def.name, board: def.board, seed: def.seed, tile: T, view,
    cols: def.cols, rows: def.rows, width: def.cols * T, height: def.rows * T,
    entry: rect(ent), exit: def.exit ? rect(def.exit) : null, // v2: ingen ekstraksjon
    playerSpawn: { x: def.playerSpawn.x * T, y: def.playerSpawn.y * T },
    // Navngitte punkter (px) – nøkler som level.spawnPoints. enemySpawns (liste) beholdes og får de navngitte
    // fiendepunktene først, slik at resolveSpawn() sitt «nærmeste punkt» treffer dem også uten kodeendring.
    spawnPoints: Object.fromEntries(Object.entries(def.spawnPoints || {}).map(([k, p]) => [k, { x: p.x * T, y: p.y * T, dir: p.dir }])),
    enemySpawns: (def.enemySpawns || []).map((p) => ({ x: p.x * T, y: p.y * T })),
    zones: Object.fromEntries(Object.entries(def.zones || {}).map(([k, z]) => [k, { ...z, x: z.x * T, y: z.y * T, r: (z.r || 0) * T, w: (z.w || 0) * T, h: (z.h || 0) * T }])),
    ammo: (def.ammoCrates || []).map(([x, y]) => ({ x: x * T, y: y * T })),
    placeholder: !!def.placeholder,
    routes: Object.fromEntries(Object.entries(def.routes || {}).map(([k, r]) => [k, { name: r.name, pts: r.pts.map(([x, y]) => ({ x: x * T, y: y * T })) }])),
    killZones: (def.killZones || []).map((z) => ({ ...rect(z), name: z.name })),
    lights: (def.lights || []).map(styleLight), props: def.props || [], objects,
    theme: def.theme, paint: def.paint, grates: def.grates, steam: def.steam,
  };
  // spillerstart og punkter nær den (< 9 ruter) holdes utenfor fiendelista
  const ps = def.playerSpawn;
  const named = Object.values(def.spawnPoints || {}).filter((p) => Math.hypot(p.x - ps.x, p.y - ps.y) >= 9).map((p) => ({ x: p.x * T, y: p.y * T }));
  L.enemySpawns = [...named, ...L.enemySpawns.filter((q) => !named.some((n) => Math.hypot(n.x - q.x, n.y - q.y) < T * 1.5))];
  L._zoneLights = [
    def.exit && { x: def.exit.x + def.exit.w / 2, y: def.exit.y + def.exit.h / 2, r: 5, i: 0.55, color: [57, 198, 255], noOcc: true },
    { x: ent.x + ent.w / 2, y: ent.y + ent.h / 2, r: 5.5, i: 0.3, color: [150, 185, 205], noOcc: true } /* kaldt lys over spillerens inngang */,
  ].filter(Boolean);
  return L;
}

/** Last arena `id` inn i world. Returnerer world.arena. */
/** View-modus: opts.view → world.view → world.arenaView → URL ?view=34|top → '34'. Tillater også '3/4'/'oblique'. */
export function resolveView(world, want) {
  const norm = (v) => (v === '34' || v === '3/4' || v === 'oblique' || v === 34) ? '34' : (v === 'top' ? 'top' : null);
  let url = null;
  try { url = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('view') : null; } catch (e) { /* ingen location */ }
  return norm(want) || norm(world.view) || norm(world.arenaView) || norm(url) || '34';
}
function yardVariant() {
  try { return typeof location !== 'undefined' ? new URLSearchParams(location.search).get('yard') : null; } catch (e) { return null; }
}
export function loadArena(world, id = 'yard', opts = {}) {
  let def = ARENAS[id] || ARENAS.yard;
  if (def === YARD) { const yv = yardVariant(); def = yv === 'v1' ? YARD : yv === 'lavt' ? YARD_LAVT : YARD_V2; } // ?yard=lavt: lav dekning i midten (testvariant)
  const view = resolveView(world, opts.view);
  world.arenaView = view; world.view = view; // world.view: felles lesbar view-modus for andre moduler (Karakter, Fiende-AI)
  const ck = def.id + (def.variant ? '~' + def.variant : '') + '|' + view + '|' + (def.playerSpawn ? def.playerSpawn.x + ',' + def.playerSpawn.y : ''); // spawn i nøkkelen: bakt gulv/ENTRY følger flyttet spawn
  let entry = cache.get(ck);
  if (!entry) { const L = buildLevel(def, view); entry = { L, layers: buildArenaLayers(L) }; cache.set(ck, entry); }
  const { L } = entry;
  // Yard v2: pirtuppen (y 29,5) skal kunne komme over HUD-panelet (topp ~y 490 av 720 skjerm-px) med følgekameraet.
  // Krav: kamera-y ≥ 944 − 110/(zoom·g) → padBottom ≈ 230 ved zoom 2,25; 240 gir ~10 px margin. Andre brett/legacy: standard (110).
  if (world.camera) { if (def.variant === 'v2') world.camera.padBottom = 240; else delete world.camera.padBottom; }
  world.cover = L.objects.filter((o) => o.type).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, type: o.type, kind: o.kind, material: o.material, id: o.id, ...(o.noOcclude ? { noOcclude: true } : null) }));
  world.bounds = { x: 0, y: 0, w: L.width, h: L.height };
  const arena = {
    walkable: () => walkableRect(world), clampWalkable: (e, r) => clampWalkable(world, e, r), isWalkable: (x, y, r) => isWalkable(world, x, y, r), rescueStuck: (e, r) => rescueStuck(world, e, r), southBlocker: () => southBlocker(world),
    id: L.id, name: L.name, board: L.board, tile: TILE, cols: L.cols, rows: L.rows, width: L.width, height: L.height,
    entry: L.entry, exit: L.exit, playerSpawn: L.playerSpawn, enemySpawns: L.enemySpawns,
    spawnPoints: L.spawnPoints, namedSpawns: L.spawnPoints, zones: L.zones, placeholder: L.placeholder, view,
    // Ammokasser: nye objekter ved hver lasting. Våpen skriver ready/readyAt på dem. Ikke cover.
    ammoCrates: L.ammo.map((p, i) => ({ id: `${L.id}-ammo-${i + 1}`, x: p.x, y: p.y })),
    routes: L.routes, killZones: L.killZones,
    lights: L.lights.map((l) => ({ x: l.x * TILE, y: l.y * TILE, r: l.r * TILE, kind: l.kind })),
    surfaceAt: (x, y) => surfaceAt(world, x, y),
    drawPendingDecals: (ctx, o) => drawPendingDecals(ctx, o, world), // drawSorted: ventende dekaler før bake
    inExit: (x, y) => !!L.exit && inRect(L.exit, x, y), inEntry: (x, y) => inRect(L.entry, x, y),
  };
  world.arena = arena;
  if (world.level) world.level.arena = arena; else world.level = { arena };
  if (world._arenaState) clearCoverDecals(world); // dekaler: cachen deles mellom lastinger
  const prev = world._arenaState;
  world._arenaState = { entry, fx: createFx(L), buf: prev?.buf || null };
  if (L.view === '34') glowBake(world._arenaState); // ved lasting, ikke midt i spillet
  subscribe(world);
  installPerf(world); // world.perf bare med ?perf=1 (src/arena/perf.js)
  if (world.player && !world.player._arenaPlaced) { world.player.x = L.playerSpawn.x; world.player.y = L.playerSpawn.y; world.player._arenaPlaced = true; }
  world.events?.emit('arenaLoaded', { id: L.id });
  if (L.view === '34') { const warm = () => { try { LOWCOVER?.warmCoverSprites?.(world); } catch (e) { /* valgfritt */ } }; if (LOWCOVER) warm(); else import('../effects/cover.js').then(warm).catch(() => {}); }
  return arena;
}

/** Bytt visningsmodus ('top' | '34') og last gjeldende arena på nytt (cover/spawns uendret). */
export function setView(world, view) {
  const id = world.arena?.id || 'yard';
  const keep = world.arena?.ammoCrates;
  const p = world.player, px = p?.x, py = p?.y;
  const a = loadArena(world, id, { view });
  if (keep) a.ammoCrates = keep; // behold Våpens tilstand
  if (p && isFinite(px)) { p.x = px; p.y = py; }
  return a;
}

// A4: dynamisk lys. Arena eier miljølyset; kjernens effects tegner bare gnister/partikler.
const MUZZLE = { player: [205, 232, 255], enemy: [255, 150, 64] };
function subscribe(world) {
  const ev = world.events; if (!ev) return;
  if (world._arenaOff) for (const off of world._arenaOff) off();
  const fx = () => world._arenaState?.fx;
  world._arenaOff = [
    // Dekaler på dekning: tøm ved ny arena og ny runde/brett (levels sender levelStart)
    ev.on('arenaLoaded', () => clearCoverDecals(world)),
    ev.on('levelStart', () => clearCoverDecals(world)),
    ev.on('shot', (p) => {
      const pr = p?.projectile, f = fx(); if (!pr || !f || !isFinite(pr.x) || world._vfx?.owns?.muzzle) return; // VFX eier munningslyset (diff arena-muzzle-light)
      const x = pr.x + Math.cos(pr.angle || 0) * 6, y = pr.y + Math.sin(pr.angle || 0) * 6;
      // hagle/salve: slå sammen blink på samme sted i samme bilde
      if (f.flashes.some((q) => q.kind === 'muzzle' && q.t < 0.02 && Math.abs(q.x - x) < 12 && Math.abs(q.y - y) < 12)) return;
      const team = p.team || pr.team;
      addFlash(f, { kind: 'muzzle', x, y, r: 115, life: 0.075, col: MUZZLE[team] || MUZZLE.enemy, i: 1 });
    }),
    ev.on('explosion', (p) => {
      const f = fx(); if (!p || !f || !isFinite(p.x) || world._vfx?.owns?.explosion) return; // diff arena-explosion-light
      const r = Math.max(150, (p.radius || 80) * 2.4);
      addFlash(f, { kind: 'explosion', x: p.x, y: p.y, r, life: 0.75, col: [255, 150, 60], i: 1.25 });
      addFlash(f, { kind: 'explosion', x: p.x, y: p.y, r: r * 0.55, life: 1.8, col: [255, 110, 40], i: 0.45 });
    }),
    ev.on('coverHit', (p) => {
      const f = fx(); if (!p || !f || !isFinite(p.x) || world._vfx?.owns?.impacts) return; // diff arena-coverhit-light
      addFlash(f, { kind: 'spark', x: p.x, y: p.y, r: 30, life: 0.09, col: [255, 196, 120], i: 0.7 });
    }),
  ];
}

function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

/** 'metal' | 'concrete' – nærmeste cover-materiale innen 6 px, ellers betonggulv. */
export function surfaceAt(world, x, y) {
  for (const c of world.cover) if (x >= c.x - 6 && x <= c.x + c.w + 6 && y >= c.y - 6 && y <= c.y + c.h + 6) return c.material || 'concrete';
  return 'concrete';
}

export function init(world) { loadArena(world, 'yard'); }
/** Hovedmenyen (src/menu/). Pausemenyens QUIT (ui/pauseMenu.js) kaller arena.openMainMenu(world). Returnerer true (håndtert). */
export function openMainMenu(world) {
  if (typeof document === 'undefined') return false;
  import('../menu/index.js').then((m) => m.openMainMenu(world)).catch((e) => { console.error('[arena] meny', e); location.reload(); });
  return true;
}

export function update(dt, world) {
  const s = world._arenaState; if (!s) return;
  updateFx(s.fx, dt);
}

function viewRect(ctx, camera, L) {
  if (camera?.screenToWorld) {
    const a = camera.screenToWorld(0, 0), b = camera.screenToWorld(ctx.canvas.width, ctx.canvas.height);
    return { x0: Math.max(0, a.x - 2), y0: Math.max(0, a.y - 2), x1: Math.min(L.width, b.x + 2), y1: Math.min(L.height, b.y + 2) };
  }
  return { x0: 0, y0: 0, x1: L.width, y1: L.height };
}

function blit(ctx, img, v) {
  const w = v.x1 - v.x0, h = v.y1 - v.y0; if (w <= 0 || h <= 0) return;
  ctx.drawImage(img, v.x0 * RES, v.y0 * RES, w * RES, h * RES, v.x0, v.y0, w, h);
}

// Ytelse: lagene (RES=2) skaleres ikke lenger i hver ramme. Vi holder en kopi av floor/top/glow i
// visningsskala (zoom × evt. DPR, lest fra ctx-transformen) og blitter bare det synlige utsnittet 1:1,
// med heltallige koordinater og smoothing av. Ved zoomendring brukes den skalerte veien til skalaen
// har vært stabil i 200 ms, så bygges kopien på nytt (ca. 3 drawImage-kall, én gang).
const VC_MAX_SIDE = 8192, VC_MAX_PX = 24e6, VC_SETTLE = 200;
function viewScale(m) {
  if (!m || Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6 || Math.abs(m.a - m.d) > 1e-6 || m.a <= 0) return 0;
  return m.a;
}
function viewCache(s, scale) {
  const { L, layers } = s.entry;
  const vc = s.vc;
  if (vc && vc.L === L && Math.abs(vc.scale - scale) < 1e-4) return vc;
  const now = performance.now();
  if (!s.vcPend || Math.abs(s.vcPend.scale - scale) > 1e-4 || s.vcPend.L !== L) { s.vcPend = { scale, L, t: now }; return null; }
  if (now - s.vcPend.t < VC_SETTLE && vc) return null; // første bygg skjer straks (vc mangler), senere etter ro
  const W = Math.ceil(L.width * scale), H = Math.ceil(L.height * scale);
  if (W > VC_MAX_SIDE || H > VC_MAX_SIDE || W * H > VC_MAX_PX) return null;
  const mk = (src) => {
    const c = (vc && vc.L === L && vc[src]?.getContext && vc[src].width === W && vc[src].height === H) ? vc[src] : makeCanvas(W, H);
    const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(layers[src], 0, 0, layers[src].width, layers[src].height, 0, 0, L.width * scale, L.height * scale);
    return c;
  };
  const vcNew = { L, scale, floor: mk('floor'), top: mk('top'), glow: mk('glow') };
  if (layers.over) vcNew.over = mk('over');
  if (layers.overGlow) { vcNew.overGlow = mk('overGlow'); vcNew.glowRest = mk('glowRest'); }
  s.vc = vcNew;
  // (ImageBitmap-variant testet 2026-10-23: tregere i riggen, så vi blir på canvas.)
  return s.vc;
}
// 1:1-blit av forhåndsskalert lag i skjermkoordinater. rects (verdens-px) begrenser til celler med innhold.
function blitScreen(ctx, img, m, rects, sc) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const ox = Math.round(m.e), oy = Math.round(m.f);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  const one = (ax, ay, bx, by) => {
    const sx0 = Math.max(ax, -ox), sy0 = Math.max(ay, -oy);
    const sx1 = Math.min(bx, img.width, cw - ox), sy1 = Math.min(by, img.height, ch - oy);
    const w = sx1 - sx0, h = sy1 - sy0; if (w <= 0 || h <= 0) return;
    ctx.drawImage(img, sx0, sy0, w, h, ox + sx0, oy + sy0, w, h);
  };
  if (!rects) one(0, 0, img.width, img.height);
  else for (const r of rects) one(Math.floor(r.x * sc), Math.floor(r.y * sc), Math.ceil((r.x + r.w) * sc), Math.ceil((r.y + r.h) * sc));
  ctx.restore();
}
// Velg rask vei (cache) eller skalert reservevei.
function drawLayer(ctx, s, key, v) {
  const m = ctx.getTransform ? ctx.getTransform() : null, sc = viewScale(m);
  const vc = sc ? viewCache(s, sc) : null;
  const rects = s.entry.layers.cells?.[key] || null;
  if (vc) blitScreen(ctx, vc[key], m, rects, sc);
  else if (!rects) blit(ctx, s.entry.layers[key], v);
  else for (const r of rects) {
    const q = { x0: Math.max(v.x0, r.x), y0: Math.max(v.y0, r.y), x1: Math.min(v.x1, r.x + r.w), y1: Math.min(v.y1, r.y + r.h) };
    blit(ctx, s.entry.layers[key], q);
  }
}

export function draw(ctx, world, camera) {
  const s = world._arenaState; if (!s || world._arenaSkip?.floor) return; // _arenaSkip: kun for ytelsesmåling
  const { L, layers } = s.entry, v = viewRect(ctx, camera, L);
  ctx.save();
  // bakgrunn utenfor kartet: bare hvis kartet ikke dekker skjermen (kameraet er klampet til bounds)
  if (v.x0 > 0.5 || v.y0 > 0.5 || v.x1 < L.width - 0.5 || v.y1 < L.height - 0.5 || !camera?.screenToWorld) {
    ctx.fillStyle = '#0b0c0d'; ctx.fillRect(-2000, -2000, L.width + 4000, L.height + 4000);
  }
  drawLayer(ctx, s, 'floor', v);
  drawFloorDynamic(ctx, L, s.fx); // animerte gulvdekaler: alltid i bunnlaget
  { const lf = s.life || (s.life = { ms: 0, n: 0, acc: 0 }); lf.n++; lf.ms = lf.acc / lf.n; }
  if (FXG?.drawFloorLife && !world._arenaSkip?.life) { const t0 = performance.now(); try { FXG.drawFloorLife(ctx, L, world.time || 0, v); } catch (e) { /* valgfri krok */ } lifeStat(s, performance.now() - t0); }
  // dybdesortering: loopen setter world.depthSorted (core/loop.js) ETTER arena.draw, så verdien er fra forrige
  // bilde; drawSorted setter i tillegg world._depthDrawn. Er en av dem satt, tegnes ammokassene sortert, ikke her.
  s.depthLast = isSorted(world); world._depthDrawn = false; s.view = v;
  if (!(L.view === '34' && s.depthLast)) drawAmmoCrates(ctx, world.arena?.ammoCrates, L.view === '34' ? Math.round(AMMO_HEIGHT() * PROJ.zScale) : 5, s.fx.t);
  ctx.restore();
}

// ---------------------------------------------------------------- dybdesortering (shared/depth.js)
/** Loopen (core/loop.js) dybdesorterer: world.depthSorted (Breach) eller world._depthDrawn (satt av drawSorted). */
function isSorted(world) { return !!(world.depthSorted || world._depthDrawn); }
const NO_COVER = Object.freeze([]);
const NO_SKIP = Object.freeze({});
/** Dekningsobjekter som skal sorteres mot aktører (bare trekvart; ovenfra returneres en tom liste).
 *  Hvert element: { x, y, w, h, elev, type, round?, ammo?, crate? } – stabil liste, bygges bare på nytt ved endring. */
export function coverObjects(world) {
  const s = world._arenaState; if (!s || s.entry.L.view !== '34' || !s.entry.layers.sprites || world._arenaSkip?.cover) return NO_COVER;
  const crates = world.arena?.ammoCrates || NO_COVER;
  if (s.coverList && s.coverEntry === s.entry && s.coverCrates === crates && s.coverN === crates.length) return s.coverList;
  const e = Math.round(AMMO_HEIGHT() * PROJ.zScale);
  const list = s.entry.layers.sprites.slice();
  for (const c of crates) list.push({ ammo: true, crate: c, x: c.x - AMMO_BODY.w / 2, y: c.y - AMMO_BODY.d / 2, w: AMMO_BODY.w, h: AMMO_BODY.d, elev: e, type: 'low', noOcclude: true, _c: [c] });
  s.coverList = list; s.coverEntry = s.entry; s.coverCrates = crates; s.coverN = crates.length;
  return list;
}
// Effekter «liv i scenen» (ground.js: drawFloorLife/drawAirLife). Tid per bilde samles i world._arenaState.life (ms, glidende snitt).
let FXG = null;
import('../effects/ground.js').then((m) => { FXG = m; }).catch(() => { FXG = null; });
// s.life = { acc: total ms, n: antall bilder, ms: snitt ms per bilde } – n telles én gang per bilde i draw()
function lifeStat(s, ms) { const L = s.life || (s.life = { ms: 0, n: 0, acc: 0 }); L.acc += ms; L.ms = L.n ? L.acc / L.n : L.acc; }
export function lifeMs(world) { const l = world._arenaState?.life; return l ? l : null; }
// Breach Effekter (src/effects/cover.js): lav dekning malt for høy vinkel. Valgfri – mangler den, brukes de bakte spritene.
let LOWCOVER = null;
import('../effects/cover.js').then((m) => { if (typeof m.drawLowCover === 'function') LOWCOVER = m; }).catch(() => { LOWCOVER = null; });
const _lcEnv = { PROJ, time: 0, lit: true, view: '34' };
/** Tegn ett dekningsobjekt fra coverObjects() (verdenskoordinater, kameratransform satt). */
export function drawCoverObject(ctx, o, world) {
  const s = world._arenaState, v = s?.view;
  if (v && (o.x + o.w < v.x0 - 8 || o.x > v.x1 + 8 || o.y + o.h < v.y0 - 8 || o.y - o.elev > v.y1 + 8)) return;
  if (o.ammo) { drawAmmoCrates(ctx, o._c, o.elev, s ? s.fx.t : 0); return; }
  if (LOWCOVER && o.type === 'low' && o.lc !== false && (!LOWCOVER.canDrawCover || LOWCOVER.canDrawCover(o.kind))) {
    _lcEnv.time = s ? s.fx.t : 0;
    try { if (LOWCOVER.drawLowCover(ctx, o.lc || (o.lc = { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, kind: o.kind, type: 'low', height: o.height, elev: o.elev, seed: o.seed, variant: o.variant }), _lcEnv)) return; }
    catch (e) { o.lc = false; console.warn('[arena] drawLowCover', e); }
  }
  // Ytelse (regresjon 13:24): spritene ligger i RES=2 og ble skalert med utjevning hver frame (~50 objekter →
  // ~10 ms rasterisering i kamp). Nå: ferdig skalert kopi per zoom (bygges når viewCache er klar), blittet 1:1.
  const m = ctx.getTransform ? ctx.getTransform() : null, sc = viewScale(m);
  const vc = s && sc ? s.vc : null;
  if (vc && Math.abs(vc.scale - sc) < 1e-4) {
    if (o._scale !== sc) scaleSprite(o, sc);
    if (o._simg) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(o._simg, Math.round(m.e) + o._px, Math.round(m.f) + o._py);
      ctx.restore(); return;
    }
  }
  ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh);
}
// Skalert sprite på samme pikselrutenett som viewCache (verdens-px * sc), så den flukter med gulvet.
function scaleSprite(o, sc) {
  o._scale = sc;
  const fx = o.sx * sc, fy = o.sy * sc, px = Math.floor(fx), py = Math.floor(fy);
  const w = Math.ceil(fx + o.sw * sc) - px, h = Math.ceil(fy + o.sh * sc) - py;
  if (w <= 0 || h <= 0 || w * h > 4e6) { o._simg = null; return; }
  const c = (o._simg && o._simg.width === w && o._simg.height === h) ? o._simg : makeCanvas(w, h);
  const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(o.img, fx - px, fy - py, o.sw * sc, o.sh * sc);
  o._simg = c; o._px = px; o._py = py;
}

// Målt 26.10 (glow-ab.cjs): eksakt variant sparer ~0 ms (gløden ligger nesten bare på gulvet), den enkle varianten
// sparer ~1 ms men endrer lampekjernene synlig. Derfor AV som standard; ?glowbake=1 for forsøk.
let GLOW_BAKE = false;
try { GLOW_BAKE = new URLSearchParams(location.search).get('glowbake') === '1'; } catch (e) { /* ingen location */ }
// over + glød ('lighter') i ett lerret. Gløden ligger i mørke områder, så forskjellen mot additiv tegning oppå scenen er liten
// (sjekket visuelt og med pikseldiff, se YTELSE.md). Bygges én gang per oppføring (deles mellom lastinger).
function glowBake(s, force) {
  if (!GLOW_BAKE && !force) return false;
  const ly = s.entry.layers; if (!ly.over || !ly.glow) return false;
  if (!ly.overGlow) {
    // Eksakt der over-laget er dekkende: over + glød (additivt) lar seg lagre i ett lerret. Resten av gløden (på gulvet,
    // der scenen under er ukjent) blir igjen i glowRest og tegnes additivt som før, men bare i cellene med innhold.
    const W = ly.over.width, H = ly.over.height;
    const gin = makeCanvas(W, H), gx = gin.getContext('2d'); gx.drawImage(ly.glow, 0, 0); gx.globalCompositeOperation = 'destination-in'; gx.drawImage(ly.over, 0, 0);
    const rest = makeCanvas(W, H), rx = rest.getContext('2d'); rx.drawImage(ly.glow, 0, 0); rx.globalCompositeOperation = 'destination-out'; rx.drawImage(ly.over, 0, 0);
    const c = makeCanvas(W, H), x = c.getContext('2d'); x.drawImage(ly.over, 0, 0); x.globalCompositeOperation = 'lighter'; x.drawImage(gin, 0, 0);
    ly.overGlow = c; ly.glowRest = rest; ly.cells.overGlow = occupancy(c, ly.W, ly.H); ly.cells.glowRest = occupancy(rest, ly.W, ly.H);
    if (s.vc) s.vc = null; // visningskopien bygges på nytt med de nye lagene
  }
  return true;
}

export function drawTop(ctx, world, camera) {
  world.perf?.setContext?.(ctx);
  const s = world._arenaState; if (!s || world._arenaSkip?.top) return;
  const { L, layers } = s.entry, v = viewRect(ctx, camera, L);
  // høy dekning løftes opp til 30 px nordover – utvid utsnittet litt
  const vt = { ...v, y1: Math.min(L.height, v.y1 + 50) };
  ctx.save();
  const v34 = L.view === '34';
  // trekvart med shared/depth.js: dekningen er allerede tegnet sortert mot aktørene, igjen er bare «over»-laget
  const sorted = v34 && isSorted(world) && layers.over;
  // B 26.10: gløden er bakt inn i over-laget (overGlow) – én blit mindre per bilde. ?glowbake=0 for sammenligning.
  const gb = sorted && (world.arenaGlowBake ?? GLOW_BAKE) && glowBake(s, true);
  const key = gb ? 'overGlow' : sorted ? 'over' : 'top';
  const holes = actorHoles(world, L, v34); // A1: tak/rørbru over hodet (trekvart: bare overhead-objekter)
  const occ = v34 && !sorted ? occlusion(world, s) : { cuts: [], hidden: [] }; // reserve: uten depth.js
  const cuts = [...holes.map((h) => ({ ...h, kind: 'radial' })), ...occ.cuts];
  const sk = world._arenaSkip || NO_SKIP; // delmåling (verktøy): { topLayer, glow, dyn, flashes }
  if (sk.topLayer) { /* hopp over */ } else if (!cuts.length || !ctx.getTransform) drawLayer(ctx, s, key, vt);
  else drawTopWithHoles(ctx, s, key, vt, cuts);
  decalTick(ctx, world); // dekaler: ventende (ovenfra) + høyst én bake per bilde
  ctx.globalCompositeOperation = 'lighter';
  if (!sk.glow) drawLayer(ctx, s, gb ? 'glowRest' : 'glow', v);
  ctx.globalCompositeOperation = 'source-over';
  if (!sk.dyn) drawDynamic(ctx, L, s.fx, v);
  if (!sk.flashes) drawFlashes(ctx, s.fx, v);
  if (!sk.life && FXG?.drawAirLife) { const t0 = performance.now(); ctx.save(); try { FXG.drawAirLife(ctx, L, world.time || 0, v); } catch (e) { /* valgfri krok */ } ctx.restore(); lifeStat(s, performance.now() - t0); }
  if (holes.length) drawHoleRings(ctx, holes);
  if (occ.hidden.length) drawSilhouettes(ctx, occ.hidden);
  ctx.restore();
}

// A1: Høy dekning/tak skal aldri skjule aktører. Finn aktører som står der et løftet tak tegnes
// (nord for et høyt objekt eller under en rørbru/gangbru) og skjær et mykt hull i topplaget.
function actorHoles(world, L, overheadOnly = false) {
  const out = [], actors = [];
  const p = world.player; if (p && !p.dead && isFinite(p.x)) actors.push(p);
  for (const e of world.enemies || []) if (e && !e.dead && isFinite(e.x)) actors.push(e);
  for (const a of actors) {
    const r = a.r || a.radius || 14;
    for (const o of L.objects) {
      if (overheadOnly ? !o.overhead : (o.type !== 'high' && !o.overhead)) continue;
      const e = o.elev, top = o.y - e;
      if (a.x + r < o.x || a.x - r > o.x + o.w) continue;
      if (a.y + r * 0.6 < top || a.y - r * 1.8 > top + o.h) continue;
      if (!o.overhead && a.y - r * 0.5 > o.y + o.h) continue;
      out.push({ x: a.x, y: a.y - r * 0.35, r: r * 2.5, team: a.team || (a === p ? 'player' : 'enemy') });
      break;
    }
  }
  return out;
}

// Ytelse: bare hullområdene går via en liten buffer. Resten av topplaget blittes direkte med klipp
// (hele skjermen minus hullboksene), så det blir ingen fullskjerms ekstrakopi.
function drawTopWithHoles(ctx, s, key, vt, holes) {
  const top = s.entry.layers[key];
  const m = ctx.getTransform(), sc = viewScale(m), vc = sc ? viewCache(s, sc) : null;
  // hullbokser; overlappende slås sammen så boksene er disjunkte (evenodd-klippet blir da riktig)
  let boxes = holes.map((h) => h.kind === 'mask'
    ? { x0: Math.floor(h.x0), y0: Math.floor(h.y0), x1: Math.ceil(h.x1), y1: Math.ceil(h.y1), holes: [h] }
    : { x0: Math.floor(h.x - h.r), y0: Math.floor(h.y - h.r), x1: Math.ceil(h.x + h.r), y1: Math.ceil(h.y + h.r), holes: [h] });
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if (A.x0 < B.x1 && A.x1 > B.x0 && A.y0 < B.y1 && A.y1 > B.y0) {
        boxes[i] = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1), holes: [...A.holes, ...B.holes] };
        boxes.splice(j, 1); merged = true; break outer;
      }
    }
  }
  boxes = boxes.map((b) => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0, holes: b.holes }));
  // 1) topplag utenfor hullboksene
  ctx.save();
  ctx.beginPath(); ctx.rect(vt.x0 - 4, vt.y0 - 64, vt.x1 - vt.x0 + 8, vt.y1 - vt.y0 + 128);
  for (const b of boxes) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w, b.y); ctx.closePath(); }
  ctx.clip('evenodd');
  drawLayer(ctx, s, key, vt);
  ctx.restore();
  // 2) hver hullboks: kopier utsnittet av topplaget, skjær ut myk gradient, tegn tilbake
  const scale = sc || 1;
  for (const b of boxes) {
    const bw = Math.ceil(b.w * scale) + 2, bh = Math.ceil(b.h * scale) + 2;
    if (!s.hbuf || s.hbuf.width < bw || s.hbuf.height < bh) s.hbuf = makeCanvas(Math.max(bw, s.hbuf?.width || 0), Math.max(bh, s.hbuf?.height || 0));
    const bx = s.hbuf.getContext('2d');
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'source-over'; bx.clearRect(0, 0, bw, bh);
    bx.setTransform(scale, 0, 0, scale, -b.x * scale, -b.y * scale);
    if (vc) { bx.imageSmoothingEnabled = false; bx.drawImage(vc[key], Math.floor(b.x * scale), Math.floor(b.y * scale), bw, bh, b.x, b.y, bw / scale, bh / scale); }
    else bx.drawImage(top, b.x * RES, b.y * RES, b.w * RES, b.h * RES, b.x, b.y, b.w, b.h);
    bx.globalCompositeOperation = 'destination-out';
    for (const h of b.holes) {
      if (h.kind === 'mask') { bx.imageSmoothingEnabled = true; bx.drawImage(h.canvas, 0, 0, h.mw, h.mh, h.x0, h.y0, h.x1 - h.x0, h.y1 - h.y0); continue; }
      const g = bx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      g.addColorStop(0, 'rgba(0,0,0,0.86)'); g.addColorStop(0.55, 'rgba(0,0,0,0.78)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      bx.fillStyle = g; bx.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    }
    bx.globalCompositeOperation = 'source-over';
    ctx.drawImage(s.hbuf, 0, 0, bw, bh, b.x, b.y, bw / scale, bh / scale);
  }
}

// Trekvart: avgjør per aktør hva som står foran/bak ved hjelp av eierkartet (sorteringsnøkkel per 2×2 px).
// Aktøren tegnes av kjernen UNDER topplaget. Der et objekt BAK aktøren (nøkkel < aktørens y + r) dekker silhuetten,
// skjæres det ut (aktøren står foran). Objekter FORAN dekker aktøren som de skal, og aktøren får en silhuett.
function occlusion(world, s) {
  const own = s.entry.layers.owner; if (!own) return { cuts: [], hidden: [] };
  const cuts = [], hidden = [], actors = [];
  const p = world.player; if (p && !p.dead && isFinite(p.x)) actors.push(p);
  for (const e of world.enemies || []) if (e && !e.dead && isFinite(e.x)) actors.push(e);
  s.masks = s.masks || [];
  const Z = PROJ.zScale;
  actors.forEach((a, i) => {
    const r = a.r || a.radius || 14;
    const Hs = (a.crouch || a.crouching ? PROJ.heights.actorCrouch : PROJ.heights.actor) * Z;
    const key = PROJ.sortKey({ x: a.x, y: a.y, r });
    const rr = r * 0.95, x0 = a.x - rr, x1 = a.x + rr, y0 = a.y - Hs - 2, y1 = a.y + r * 0.6;
    const cx0 = Math.max(0, Math.floor(x0 / OWN)), cx1 = Math.min(own.nx, Math.ceil(x1 / OWN));
    const cy0 = Math.max(0, Math.floor(y0 / OWN)), cy1 = Math.min(own.ny, Math.ceil(y1 / OWN));
    const mw = cx1 - cx0, mh = cy1 - cy0; if (mw <= 0 || mh <= 0) return;
    let m = s.masks[i]; if (!m || m.width < mw || m.height < mh) { m = s.masks[i] = makeCanvas(Math.max(mw, 24), Math.max(mh, 48)); m._img = null; }
    const mx = m.getContext('2d');
    if (!m._img || m._img.width !== m.width || m._img.height !== m.height) m._img = mx.createImageData(m.width, m.height);
    const d = m._img.data; d.fill(0);
    let nCut = 0, nHid = 0, nIn = 0;
    const hy = a.y - Hs + rr; // hodets senter
    for (let cy = cy0; cy < cy1; cy++) {
      const py = cy * OWN + OWN / 2;
      for (let cx = cx0; cx < cx1; cx++) {
        const px = cx * OWN + OWN / 2, dx = px - a.x;
        if (Math.abs(dx) > rr || py < a.y - Hs || py > y1) continue;
        if (py < hy && dx * dx + (py - hy) ** 2 > rr * rr) continue;
        const body = py <= a.y - 2; // silhuett: bare kroppen over fotpunktet teller (som shared/depth.js)
        if (body) nIn++;
        const b = own.a[cy * own.nx + cx]; if (b < -1e8) continue;
        if (b < key) { const k = ((cy - cy0) * m.width + (cx - cx0)) * 4; d[k + 3] = 255; nCut++; } else if (body) nHid++;
      }
    }
    if (nCut) { mx.putImageData(m._img, 0, 0); cuts.push({ kind: 'mask', canvas: m, mw, mh, x0: cx0 * OWN, y0: cy0 * OWN, x1: cx1 * OWN, y1: cy1 * OWN }); }
    if (nIn && nHid / nIn > 0.12) hidden.push({ x: a.x, y: a.y, r: rr, Hs, team: a.team || (a === p ? 'player' : 'enemy'), frac: nHid / nIn });
  });
  return { cuts, hidden };
}

// Silhuett for aktører som står (delvis) bak dekning i trekvart – lagfarget, svak fyll + stiplet kontur.
function drawSilhouettes(ctx, list) {
  ctx.save();
  for (const h of list) {
    const col = h.team === 'player' ? '57,198,255' : '255,110,60';
    ctx.beginPath();
    const top = h.y - h.Hs + h.r;
    ctx.arc(h.x, top, h.r, Math.PI, 0); ctx.lineTo(h.x + h.r, h.y); ctx.ellipse(h.x, h.y, h.r, h.r * 0.45, 0, 0, Math.PI); ctx.closePath();
    ctx.globalAlpha = 0.7; ctx.setLineDash([3, 2]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${col},0.8)`; ctx.stroke(); // tynt omriss, uten fyll
  }
  ctx.restore();
}

function drawHoleRings(ctx, holes) {
  ctx.save();
  for (const h of holes) {
    ctx.strokeStyle = h.team === 'player' ? 'rgba(57,198,255,0.35)' : 'rgba(255,110,60,0.3)';
    ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.58, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** Debug-overlay i verdenskoordinater. opts: { cover, routes, zones, grid } */
export function drawDebug(ctx, world, opts = {}) {
  const a = world.arena; if (!a) return;
  ctx.save();
  if (opts.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    for (let x = 0; x <= a.width; x += TILE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, a.height); ctx.stroke(); }
    for (let y = 0; y <= a.height; y += TILE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(a.width, y); ctx.stroke(); }
  }
  if (opts.zones) {
    for (const [r, c, t] of [[a.entry, '#9fc4d8', 'ENTRY'], [a.exit, '#39c6ff', 'EXIT']]) {
      if (!r) continue;
      ctx.fillStyle = c + '40'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = c; ctx.font = 'bold 14px monospace'; ctx.fillText(t, r.x + 6, r.y + 18);
    }
    for (const z of a.killZones) {
      ctx.fillStyle = 'rgba(255,40,40,0.15)'; ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 1.5; ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
      ctx.fillStyle = '#ff7070'; ctx.font = '11px monospace'; ctx.fillText('KILL ZONE: ' + z.name, z.x + 4, z.y + 13);
    }
    for (const p of a.enemySpawns) { ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = 'bold 10px monospace';
    for (const [k, p] of Object.entries(a.spawnPoints || {})) { ctx.fillStyle = '#ffd0b0'; ctx.fillText(k.toUpperCase(), p.x + 8, p.y - 6); }
    for (const c of a.ammoCrates || []) {
      ctx.strokeStyle = '#8fd14f'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(c.x, c.y, 26, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#8fd14f'; ctx.fillText('AMMO ' + c.id.split('-').pop(), c.x - 24, c.y + 40);
    }
    for (const [k, z] of Object.entries(a.zones || {})) {
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffb347'; ctx.fillText('ZONE ' + k.toUpperCase(), z.x - 28, z.y);
    }
    ctx.fillStyle = '#39c6ff'; ctx.beginPath(); ctx.arc(a.playerSpawn.x, a.playerSpawn.y, 7, 0, Math.PI * 2); ctx.fill();
  }
  if (opts.cover) {
    for (const c of world.cover) {
      const hi = c.type === 'high';
      ctx.fillStyle = hi ? 'rgba(255,60,60,0.35)' : 'rgba(60,255,140,0.35)';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = hi ? '#ff4040' : '#40ff90'; ctx.lineWidth = 1.5; ctx.strokeRect(c.x + 0.75, c.y + 0.75, c.w - 1.5, c.h - 1.5);
    }
  }
  if (opts.routes) {
    const col = { mid: '#ffd84a', central: '#39c6ff', flank: '#e0e0e0' };
    for (const [k, r] of Object.entries(a.routes)) {
      ctx.strokeStyle = col[k] || '#fff'; ctx.lineWidth = 3; ctx.setLineDash(k === 'flank' ? [4, 6] : [12, 6]);
      ctx.beginPath(); r.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      ctx.setLineDash([]); const p = r.pts[Math.floor(r.pts.length / 2)];
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(p.x - 4, p.y - 14, ctx.measureText(r.name).width + 40, 18);
      ctx.fillStyle = col[k]; ctx.font = 'bold 12px monospace'; ctx.fillText(r.name, p.x, p.y);
    }
  }
  ctx.restore();
}
