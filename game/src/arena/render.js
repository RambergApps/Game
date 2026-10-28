// Forhåndsrendering av arenaene (Kessa Yard m.fl.) til offscreen-lag + dynamiske effekter.
// Lag:
//   floor : gulv, maling, skygger, LAV dekning, dekor  -> tegnes i draw() (under aktører)
//   top   : HØY dekning (containere, murer, bygg)       -> tegnes i drawTop() (over aktører)
//   glow  : additiv bloom/emissive (lamper, vinduer)    -> tegnes i drawTop()
// Begge lag er ferdig belyst (albedo × lyskart) for å spare arbeid per bilde.

import { mulberry32, fbm, hash2 } from './rng.js';
import { makeCanvas, shade, rgba, roundRect, hazard, blot, chevron } from './paint.js';
import { shadowOffset } from '../shared/light.js';
import { PROJ } from '../shared/projection.js';
// Breach Effekter: gulv og lys (src/effects/ground.js). Valgfri – mangler filen eller svarer den false, brukes tegningen her.
let fxFloor = null;
try { fxFloor = await import('../effects/ground.js'); } catch (e) { fxFloor = null; }
import { drawTank, drawUnit, drawPipeline, drawPipes, drawValve, drawOverpipe, drawCatwalk } from './kinds.js';

export const RES = 2;            // oppløsning på offscreen-lag (px per verdens-px)
export const ELEV = { wall: 18, building: 34, container: 19, stack: 34, cratestack: 22, barrier: 6, sandbag: 6, crates: 9, barrels: 9,
  tank: 46, unit: 30, pipeline: 26, pipes: 8, valve: 10, overpipe: 44, catwalk: 40 };

const CONTAINER_COLORS = ['#7a3a2a', '#2f5559', '#30405a', '#5a5634', '#545b62'];
const AMBIENT = 'rgb(74,84,108)';
const WARM = [255, 165, 72];
const warmOf = (L) => (L.theme && L.theme.warm) || WARM;
// Effekter-kroker (ground.js, valgfrie): ambient(L) → 'rgb(...)', vignette(L) → 0..1, lightmapPool(ctx, L, l, alphaMul) → bool
const fxAmbient = (L) => { try { const v = fxFloor?.ambient?.(L); return typeof v === 'string' && /^rgba?\(/.test(v) ? v : null; } catch (e) { return null; } };
const fxVignette = (L) => { try { const v = fxFloor?.vignette?.(L); return typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.35; } catch (e) { return 0.35; } };
const ambientOf = (L) => fxAmbient(L) || (L.theme && L.theme.ambient) || AMBIENT;

// ---------------------------------------------------------------- hovedinngang
// Hakk 27.10: bakingen er en generator som gir fra seg kontrollen mellom tunge steg (yield = etikett).
// buildArenaLayers kjører alt synkront (uendret for alle kallere); bakeArenaLayersAsync gir nettleseren pust mellom stegene.
export function buildArenaLayers(L) { const g = bakeSteps(L); let r; while (!(r = g.next()).done); return r.value; }
export const BAKE_STEPS = 32; // omtrentlig antall yield før spritene (for fremdrift)
export function bakeArenaLayersAsync(L, onStep) {
  const g = bakeSteps(L); let n = 0;
  const pause = () => new Promise((res) => { if (typeof MessageChannel !== 'undefined') { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); } else setTimeout(res, 0); });
  return (async () => { for (;;) { const r = g.next(); if (r.done) return r.value; n++; try { onStep?.(r.value, n); } catch (e) { /* valgfritt */ } await pause(); } })();
}
let FL = null;
function flush(c) { try { if (!FL) FL = makeCanvas(1, 1); FL.getContext('2d').drawImage(c, 0, 0, 1, 1, 0, 0, 1, 1); } catch (e) { /* valgfritt */ } }
// applyLight i vannrette bånd (samme utsnittsoppskrift som spritene; piksel-identisk), én oppgave per bånd
function* lightBands(c, light, only, keepAlpha, OVER, k, n = 4) {
  const bh = Math.ceil(c.height / n);
  for (let y = 0; y < c.height; y += bh) { applyLight(c, light, only, keepAlpha, OVER, { x: 0, y, w: c.width, h: Math.min(bh, c.height - y) }); flush(c); yield { k }; }
}
function* rowsYield(g) { for (let r = g.next(); !r.done; r = g.next()) yield { k: 'floor' }; }
function* bakeSteps(L) {
  const W = L.width, H = L.height;
  const rng = mulberry32(L.seed);
  const mk = () => { const c = makeCanvas(W * RES, H * RES); const x = c.getContext('2d'); x.scale(RES, RES); return [c, x]; };

  const tm = {}; let tp = performance.now();
  const lap = (k) => { const n = performance.now(); tm[k] = Math.round(n - tp); tp = n; };
  const [floorC, fx] = mk();
  // Hakk 27.10: asfaltkornet (Effekter) lages i rader på forhånd, og hvert lag rastreres ved stegslutt (flush), så
  // den utsatte tegningen ikke samles i én lang oppgave senere. Ingen pikselendring.
  if (fxFloor?.bakeYardGrain && !L._grain) { try { yield* rowsYield(fxFloor.bakeYardGrain(L, Math.ceil(W * RES), Math.ceil(H * RES), 240)); } catch (e) { L._grain = null; } }
  let fxBaked = false; try { fxBaked = !!fxFloor?.bakeYardFloor?.(fx, L, mulberry32(L.seed + 1)); } catch (e) { fxBaked = false; }
  if (!fxBaked) drawFloor(fx, L, mulberry32(L.seed + 1)); lap('floor'); flush(floorC); yield { k: 'floor' };
  drawPlatform(fx, L);
  if (!fxBaked) drawPaint(fx, L, mulberry32(L.seed + 2)); lap('paint');
  drawProps(fx, L, mulberry32(L.seed + 3)); flush(floorC); yield { k: 'floor' };
  drawClutter(fx, L, mulberry32(L.seed + 6)); lap('clutter'); flush(floorC); yield { k: 'floor' };
  yield* drawShadows(fx, L); lap('shadows'); flush(floorC); yield { k: 'shadows' };
  const objs = [...L.objects].sort((a, b) => (a.y + a.h) - (b.y + b.h) || a.x - b.x);
  const v34 = L.view === '34';
  // trekvart: lav dekning sorteres sammen med høy (frontflaten kan dekke beina på en aktør bak), så den går i topplaget
  if (!v34) for (const o of objs) if (o.type === 'low') drawObject(fx, o, mulberry32(L.seed + 100 + o.id));
  for (const o of objs) if (o.overhead) drawFeet(fx, o);
  drawLampBases(fx, L); flush(floorC); yield { k: 'shadows' };

  const [topC, tx] = mk();
  for (const o of objs) if (o.type === 'high' || (v34 && o.type === 'low')) drawObject(tx, o, mulberry32(L.seed + 100 + o.id));
  for (const o of objs) if (o.overhead && o.kind === 'overpipe') drawObject(tx, o, mulberry32(L.seed + 100 + o.id));
  for (const o of objs) if (o.overhead && o.kind !== 'overpipe') drawObject(tx, o, mulberry32(L.seed + 100 + o.id));
  drawWallFixtures(tx, L);
  lap('objects'); flush(topC); yield { k: 'objects' };

  // lyskart: med okklusjon for gulvet, uten for objekter
  const lightOcc = buildLightmap(L, true, true), occOnly = buildLightmap(L, true, false);
  const lightFree = buildLightmap(L, false, true), freeOnly = buildLightmap(L, false, false); lap('lightmaps'); yield { k: 'lightmaps' };
  yield* lightBands(floorC, lightOcc, occOnly, false, 0.8, 'light');
  // 27.10 13:52: vann og kaikanter tegnes ETTER lyskartet (ikke ganget med okkludert lys/ambient/vignett/skygger – ble ~rgb 8,6,6).
  // Rekkefølge: vannflate (Effekter drawWater) → Effekters kant (drawEdge) → vår kant/kaiflate der kroken ikke tegnet.
  drawWaterBody(fx, L, mulberry32(L.seed + 7));
  drawEdgesFx(fx, L, mulberry32(L.seed + 8));
  drawWater(fx, L);
  flush(floorC); yield { k: 'light' };
  yield* lightBands(topC, lightFree, freeOnly, true, 0.4, 'apply'); lap('apply');
  // Trekvart + dybdesortering (shared/depth.js): hvert dekningsobjekt som eget, ferdig belyst sprite, og et eget
  // «over»-lag med bare det som alltid ligger over aktører (rørbruer, gangbruer, veggarmatur, kringkasting).
  let over = null, sprites = null;
  if (v34) {
    const [oc, ox] = mk();
    for (const o of objs) if (o.overhead && o.kind === 'overpipe') drawObject(ox, o, mulberry32(L.seed + 100 + o.id));
    for (const o of objs) if (o.overhead && o.kind !== 'overpipe') drawObject(ox, o, mulberry32(L.seed + 100 + o.id));
    drawWallFixtures(ox, L);
    yield* lightBands(oc, lightFree, freeOnly, true, 0.4, 'over');
    over = oc;
    sprites = yield* buildSprites(L, objs, mk, lightFree, freeOnly); lap('sprites');
  }
  drawWaterSheen(fx, L); // etter lyskartet: svak egenrefleks på fallback-vannet, så det ikke blir helt sort
  drawPuddleGlow(fx, L, mulberry32(L.seed + 5));
  drawZoneGlow(fx, L); // gulvdekaler (chevroner/soner) hører til bunnlaget – aldri over aktører

  const [glowC, gx] = mk();
  { const r = mulberry32(L.seed + 4); let ok = false; try { ok = !!fxFloor?.drawLightPools?.(gx, L, r); } catch (e) { ok = false; } if (!ok) drawGlow(gx, L, r, !v34); } // trekvart: vindus-/takvindusglød bakes inn i spritene

  lap('glow'); yield { k: 'glow' };
  // Ytelse: topp- og glødelagene er glisne. Finn celler med innhold så de kan blittes bit for bit.
  const cells = { top: occupancy(topC, W, H), glow: occupancy(glowC, W, H) };
  if (over) cells.over = occupancy(over, W, H);
  lap('cells');
  const owner = v34 ? ownerMap(L, objs) : null;
  return { floor: floorC, top: topC, glow: glowC, over, sprites, cells, owner, W, H, timing: tm };
}

// Sprites per dekningsobjekt. Objekter med overlappende synlig flate tegnes i ulike runder på samme lerret,
// så ingen naboer blør inn i hverandres sprite. Hver runde belyses med samme lyskart som topplaget.
function* buildSprites(L, objs, mk, light, lightsOnly) {
  const PAD = 8, list = [], groups = [];
  for (const o of objs) {
    if (o.overhead || (o.type !== 'high' && o.type !== 'low')) continue;
    const b = { x0: Math.max(0, Math.floor(o.x - PAD)), y0: Math.max(0, Math.floor(o.y - o.elev - PAD)),
      x1: Math.min(L.width, Math.ceil(o.x + o.w + PAD)), y1: Math.min(L.height, Math.ceil(o.y + o.h + PAD)) };
    let g = groups.find((gr) => gr.every((q) => q.b.x0 >= b.x1 || q.b.x1 <= b.x0 || q.b.y0 >= b.y1 || q.b.y1 <= b.y0));
    if (!g) groups.push(g = []);
    g.push({ o, b });
  }
  const [c, x] = mk();
  for (const g of groups) {
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.restore();
    for (const { o } of g) drawObject(x, o, mulberry32(L.seed + 100 + o.id));
    // Hakk 27.10: lys bare på spritenes egne utsnitt (samme piksler – lyskartet samples i samme rutenett), ikke hele brettet per runde
    for (const { b } of g) applyLight(c, light, lightsOnly, true, 0.4, { x: b.x0 * RES, y: b.y0 * RES, w: (b.x1 - b.x0) * RES, h: (b.y1 - b.y0) * RES });
    x.save(); x.globalCompositeOperation = 'lighter'; drawObjGlow(x, g.map((q) => q.o)); x.restore();
    for (const { o, b } of g) {
      const w = b.x1 - b.x0, h = b.y1 - b.y0, img = makeCanvas(w * RES, h * RES);
      img.getContext('2d').drawImage(c, b.x0 * RES, b.y0 * RES, w * RES, h * RES, 0, 0, w * RES, h * RES);
      list.push({ id: o.id, kind: o.kind, type: o.type, height: o.height, seed: o.seed, variant: o.variant, x: o.x, y: o.y, w: o.w, h: o.h, elev: o.elev, round: o.kind === 'tank', noOcclude: !!o.noOcclude,
        img, sx: b.x0, sy: b.y0, sw: w, sh: h });
    }
    yield { k: 'sprites', i: groups.indexOf(g) + 1, n: groups.length };
  }
  return list;
}

// Trekvart: «eierkart» for topplaget. Hver 2×2 px-celle får sorteringsnøkkelen (bunnkant y + h) til det
// objektet som er tegnet øverst der. Brukes per bilde til å avgjøre om en aktør står foran eller bak.
export const OWN = 2;
function ownerMap(L, objs) {
  const nx = Math.ceil(L.width / OWN), ny = Math.ceil(L.height / OWN), a = new Float32Array(nx * ny).fill(-1e9);
  for (const o of objs) {
    if (o.overhead || !o.type) continue;
    const key = o.y + o.h;
    const x0 = Math.max(0, Math.floor(o.x / OWN)), x1 = Math.min(nx, Math.ceil((o.x + o.w) / OWN));
    const y0 = Math.max(0, Math.floor((o.y - o.elev) / OWN)), y1 = Math.min(ny, Math.ceil((o.y + o.h) / OWN));
    const tank = o.kind === 'tank';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (tank) { // sylinder: avrundet topp og bunn
        const cx = o.x + o.w / 2, R = o.w / 2, px = x * OWN + 1, py = y * OWN + 1, dx = (px - cx) / R;
        const half = Math.sqrt(Math.max(0, 1 - dx * dx)) * (o.h / 2);
        if (py < o.y + o.h / 2 - o.elev - half || py > o.y + o.h / 2 + half) continue;
      }
      a[y * nx + x] = key;
    }
  }
  return { a, nx, ny };
}

// Celler (verdens-px) der laget har synlig innhold, slått sammen til vannrette løp.
const CELL = 64;
export function occupancy(c, W, H) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, cw = c.width;
  const nx = Math.ceil(W / CELL), ny = Math.ceil(H / CELL), out = [], step = 2 * RES;
  for (let cy = 0; cy < ny; cy++) {
    let run = -1;
    for (let cx = 0; cx <= nx; cx++) {
      let hit = false;
      if (cx < nx) {
        const x0 = cx * CELL * RES, y0 = cy * CELL * RES, x1 = Math.min(c.width, x0 + CELL * RES), y1 = Math.min(c.height, y0 + CELL * RES);
        for (let y = y0; y < y1 && !hit; y += step) for (let x = x0; x < x1; x += step) if (d[(y * cw + x) * 4 + 3] > 3) { hit = true; break; }
      }
      if (hit && run < 0) run = cx;
      if (!hit && run >= 0) { out.push({ x: run * CELL, y: cy * CELL, w: Math.min(W, cx * CELL) - run * CELL, h: Math.min(H, (cy + 1) * CELL) - cy * CELL }); run = -1; }
    }
  }
  return out;
}

// resultat = albedo × (ambient + lys) + albedo × lys × OVER  (overbelysning gir «hot spots»)
const HDR = 2;
function applyLight(canvas, light, lightsOnly, keepAlpha, OVER = 0.8, rect = null) {
  if (rect) { // utsnitt: kjør samme oppskrift på et lite lerret og skriv tilbake (heltallsforskyvning, lyskartet tegnes forskjøvet)
    const sub = makeCanvas(rect.w, rect.h), sx = sub.getContext('2d');
    sx.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    applyLight(sub, light, lightsOnly, keepAlpha, OVER, null, { dx: -rect.x, dy: -rect.y, w: canvas.width, h: canvas.height });
    const cx = canvas.getContext('2d'); cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(rect.x, rect.y, rect.w, rect.h); cx.drawImage(sub, rect.x, rect.y); cx.restore();
    return;
  }
  const lp = arguments[6] || { dx: 0, dy: 0, w: canvas.width, h: canvas.height };
  const ctx = canvas.getContext('2d');
  const albedo = makeCanvas(canvas.width, canvas.height), ax = albedo.getContext('2d');
  ax.drawImage(canvas, 0, 0);
  // overbelysningsledd
  const over = makeCanvas(canvas.width, canvas.height), ox = over.getContext('2d');
  ox.drawImage(canvas, 0, 0);
  ox.globalCompositeOperation = 'multiply'; ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  ox.drawImage(lightsOnly, lp.dx, lp.dy, lp.w, lp.h);
  ox.globalCompositeOperation = 'destination-in'; ox.drawImage(albedo, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(light, lp.dx, lp.dy, lp.w, lp.h);
  // lyskartet er lagret med halv styrke (HDR) så sterke lys ikke klipper rødkanalen og blir gul-oliven
  const dbl = makeCanvas(canvas.width, canvas.height); dbl.getContext('2d').drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'lighter'; for (let k = 1; k < HDR; k++) ctx.drawImage(dbl, 0, 0);
  if (keepAlpha) { ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(albedo, 0, 0); }
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, OVER * HDR); ctx.drawImage(over, 0, 0);
  if (OVER * HDR > 1) { ctx.globalAlpha = OVER * HDR - 1; ctx.drawImage(over, 0, 0); }
  ctx.restore();
}

// ---------------------------------------------------------------- gulv
function drawFloor(ctx, L, rng) {
  const W = L.width, H = L.height, T = L.tile;
  ctx.fillStyle = (L.theme && L.theme.floor) || '#504f4e'; ctx.fillRect(0, 0, W, H);

  // betongplater 4x4 ruter med svak tonevariasjon
  const S = T * 4;
  for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) {
    const v = rng.range(-0.06, 0.06);
    ctx.fillStyle = v < 0 ? `rgba(0,0,0,${-v})` : `rgba(255,255,255,${v * 0.6})`;
    ctx.fillRect(x, y, S, S);
  }

  // storskala flekkete støy (lavoppløst, glattet opp)
  const nw = Math.ceil(W / 8), nh = Math.ceil(H / 8);
  const nc = makeCanvas(nw, nh), nx = nc.getContext('2d');
  const id = nx.createImageData(nw, nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const v = fbm(x / 9, y / 9, L.seed, 5), w = fbm(x / 3, y / 3, L.seed + 9, 3);
    const k = (y * nw + x) * 4;
    const d = Math.max(0, (0.55 - v)) * 2.2 + Math.max(0, 0.5 - w) * 0.5;
    id.data[k] = 18; id.data[k + 1] = 16; id.data[k + 2] = 14; id.data[k + 3] = Math.min(255, d * 150);
  }
  nx.putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(nc, 0, 0, W, H);

  // fin korning i full oppløsning
  const gw = W * RES, gh = H * RES;
  const gc = makeCanvas(gw, gh), gx = gc.getContext('2d');
  const gd = gx.createImageData(gw, gh), d = gd.data;
  let s = L.seed >>> 0;
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const r = s / 4294967296;
    const c = r < 0.5 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = c;
    d[i + 3] = r < 0.04 || r > 0.97 ? 60 : Math.abs(r - 0.5) * 34;
  }
  gx.putImageData(gd, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(gc, 0, 0); ctx.restore();

  // fuger
  for (let x = S; x < W; x += S) joint(ctx, x, 0, x, H);
  for (let y = S; y < H; y += S) joint(ctx, 0, y, W, y);
  // sagede kuttfuger (tynnere) midt i platene
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.6;
  for (let x = S / 2; x < W; x += S) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = S / 2; y < H; y += S) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // sprekker
  for (let i = 0; i < 70; i++) {
    let x = rng() * W, y = rng() * H, a = rng() * Math.PI * 2;
    const n = rng.int(4, 14);
    ctx.beginPath(); ctx.moveTo(x, y);
    const pts = [[x, y]];
    for (let k = 0; k < n; k++) { a += rng.range(-0.8, 0.8); const l = rng.range(3, 10); x += Math.cos(a) * l; y += Math.sin(a) * l; ctx.lineTo(x, y); pts.push([x, y]); }
    ctx.strokeStyle = 'rgba(8,8,8,0.55)'; ctx.lineWidth = rng.range(0.5, 1.2); ctx.stroke();
    ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + 0.7, py + 0.7) : ctx.moveTo(px + 0.7, py + 0.7)));
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // dekkspor
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x0 = rng() * W, y0 = rng() * H, x1 = rng() * W, y1 = rng() * H;
    const cx = rng() * W, cy = rng() * H;
    for (const off of [-9, 9]) {
      ctx.beginPath(); ctx.moveTo(x0 + off, y0); ctx.quadraticCurveTo(cx + off, cy, x1 + off, y1);
      ctx.strokeStyle = 'rgba(10,10,10,0.10)'; ctx.lineWidth = 6; ctx.stroke();
    }
  }

  // oljeflekker
  for (let i = 0; i < 26; i++) {
    let x = rng() * W, y = rng() * H; const n = rng.int(4, 10), base = rng.range(4, 12), a = rng() * 6.28;
    for (let k = 0; k < n; k++) { x += Math.cos(a) * base * 0.6 + rng.range(-3, 3); y += Math.sin(a) * base * 0.6 + rng.range(-3, 3); blot(ctx, x, y, base * rng.range(0.6, 1.3), '#0a0806', rng.range(0.12, 0.28)); }
  }
  // rust-/vannrenner
  for (let i = 0; i < 14; i++) blot(ctx, rng() * W, rng() * H, rng.range(14, 40), '#4a2c18', rng.range(0.12, 0.22));

  // vanndammer (lagres for refleks i glow-laget)
  L._puddles = [];
  for (let i = 0; i < 11; i++) {
    let x, y, tries = 0;
    do { x = rng.range(2, L.cols - 2) * T; y = rng.range(3, L.rows - 2) * T; tries++; }
    while (tries < 30 && L.objects.some((o) => x > o.x - 50 && x < o.x + o.w + 50 && y > o.y - 50 && y < o.y + o.h + 30));
    const circles = [];
    const n = rng.int(4, 8);
    for (let k = 0; k < n; k++) circles.push([x + rng.range(-26, 26), y + rng.range(-12, 12), rng.range(7, 16)]);
    L._puddles.push(circles);
    ctx.fillStyle = 'rgba(20,28,38,0.22)';
    ctx.beginPath(); for (const [cx, cy, r] of circles) { ctx.moveTo(cx + r + 4, cy); ctx.ellipse(cx, cy, r + 4, (r + 4) * 0.6, 0, 0, Math.PI * 2); } ctx.fill();
    ctx.fillStyle = 'rgba(16,24,34,0.38)';
    ctx.beginPath(); for (const [cx, cy, r] of circles) { ctx.moveTo(cx + r, cy); ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2); } ctx.fill();
  }

  // stålrist-/riflete plater (raffineri)
  for (const [gx0, gy0, gw0, gh0] of L.grates || []) {
    const x0 = gx0 * T, y0 = gy0 * T, w0 = gw0 * T, h0 = gh0 * T;
    ctx.fillStyle = 'rgba(30,32,34,0.55)'; ctx.fillRect(x0, y0, w0, h0);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w0, h0); ctx.clip();
    for (let yy = y0 + 2; yy < y0 + h0; yy += 6) for (let xx = x0 + ((yy / 6) % 2 ? 3 : 0); xx < x0 + w0; xx += 6) {
      ctx.fillStyle = 'rgba(150,155,160,0.13)'; ctx.fillRect(xx, yy, 3, 1.2);
    }
    for (let xx = x0; xx < x0 + w0; xx += T) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(xx, y0, 1.2, h0); }
    for (let yy = y0; yy < y0 + h0; yy += T) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0, yy, w0, 1.2); }
    for (let i = 0; i < (w0 * h0) / 1600; i++) blot(ctx, x0 + rng() * w0, y0 + rng() * h0, rng.range(6, 18), '#0a0806', rng.range(0.15, 0.3));
    ctx.restore();
    ctx.strokeStyle = 'rgba(110,115,120,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w0 - 1, h0 - 1);
  }

  // småskrot
  for (let i = 0; i < 260; i++) {
    const x = rng() * W, y = rng() * H, r = rng.range(0.6, 2);
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.5)' : 'rgba(200,195,180,0.18)';
    ctx.fillRect(x, y, r, r * rng.range(0.5, 1.5));
  }
}

function joint(ctx, x0, y0, x1, y1) {
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x0 + 1.2, y0 + 1.2); ctx.lineTo(x1 + 1.2, y1 + 1.2); ctx.stroke();
}

// ---------------------------------------------------------------- maling, soner, merking
function drawPaint(ctx, L, rng) {
  const W = L.width, H = L.height, T = L.tile;
  const pc = makeCanvas(W * RES, H * RES), p = pc.getContext('2d'); p.scale(RES, RES);
  const Y = '#c9a227';

  // gule plassmerker rundt containere
  const P = L.paint || {};
  p.strokeStyle = Y; p.lineWidth = 2.2;
  for (const o of L.objects) {
    if (o.kind === 'container' || o.kind === 'stack') { p.setLineDash([]); p.strokeRect(o.x - 7, o.y - 7, o.w + 14, o.h + 14); }
    if (o.kind === 'tank') {
      // sikkerhetssirkel med varselstriper rundt tanker
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = Math.min(o.w, o.h) / 2 + 12;
      p.save(); p.beginPath(); p.arc(cx, cy, r, 0, Math.PI * 2); p.arc(cx, cy, r - 7, 0, Math.PI * 2, true); p.clip();
      hazard(p, cx - r, cy - r, r * 2, r * 2, 7, Y); p.restore();
    }
    if (o.kind === 'unit') { p.setLineDash([10, 6]); p.strokeRect(o.x - 8, o.y - 8, o.w + 16, o.h + 16); p.setLineDash([]); }
  }
  // kjørefelt-/gangbanelinjer
  p.lineWidth = 3; p.setLineDash([22, 12]);
  const line = (pts) => { p.beginPath(); pts.forEach(([x, y], i) => (i ? p.lineTo(x * T, y * T) : p.moveTo(x * T, y * T))); p.stroke(); };
  for (const ln of P.lanes || []) line(ln);
  p.setLineDash([]);
  // heltrukne gangfelt (raffineri): to parallelle linjer
  p.lineWidth = 1.6;
  for (const ln of P.walkways || []) {
    for (const off of [-0.45, 0.45]) {
      p.beginPath(); ln.forEach(([x, y], i) => { const v = ln.length > 1 && Math.abs(ln[1][0] - ln[0][0]) < 0.01; const X = (x + (v ? off : 0)) * T, Yy = (y + (v ? 0 : off)) * T; i ? p.lineTo(X, Yy) : p.moveTo(X, Yy); }); p.stroke();
    }
  }

  // inngangssone (spillerens spawn): kald grå/cyan – rødt/oransje er forbeholdt fiendespawns (Test P1-3, 13:54).
  // Mørk stålgrå plate (#3a3f45) med lysere kant (#5a6068), tynn cyan aksent (#39c6ff) og dempede chevroner.
  const e = L.entry;
  p.fillStyle = 'rgba(58,63,69,0.55)'; p.fillRect(e.x, e.y, e.w, e.h);
  p.strokeStyle = 'rgba(90,96,104,0.9)'; p.lineWidth = 2; p.strokeRect(e.x + 10, e.y + 10, e.w - 20, e.h - 20);
  p.strokeStyle = 'rgba(57,198,255,0.45)'; p.lineWidth = 1; p.strokeRect(e.x + 14, e.y + 14, e.w - 28, e.h - 28);
  hazard(p, e.x, e.y, e.w, 7, 7, Y); hazard(p, e.x + e.w - 7, e.y, 7, e.h, 7, Y);
  p.fillStyle = 'rgba(120,150,170,0.45)';
  for (let k = 0; k < 3; k++) chevron(p, e.x + e.w * 0.5, e.y + e.h * 0.62 - k * 18, 16);
  p.font = 'bold 13px "Arial Narrow", Arial, sans-serif'; p.textAlign = 'center';
  p.fillStyle = 'rgba(150,200,225,0.75)'; p.fillText('ENTRY', e.x + e.w / 2, e.y + e.h - 10);

  // (ekstraksjonssonen er fjernet i Yard v2 27.10; andre arenaer med exit beholder platen)
  const x = L.exit;
  if (x) {
  p.fillStyle = 'rgba(57,198,255,0.20)'; p.fillRect(x.x, x.y, x.w, x.h);
  p.strokeStyle = 'rgba(57,198,255,0.85)'; p.lineWidth = 2.5; p.strokeRect(x.x + 4, x.y + 4, x.w - 8, x.h - 8);
  hazard(p, x.x, x.y + x.h, x.w, 6, 6, Y);
  p.fillStyle = 'rgba(57,198,255,0.85)';
  for (let k = 0; k < 2; k++) chevron(p, x.x + x.w / 2, x.y + x.h * 0.62 - k * 16, 14);
  p.font = 'bold 11px "Arial Narrow", Arial, sans-serif';
  p.fillText('EXTRACTION', x.x + x.w / 2, x.y + x.h - 8);
  }

  // varselstriper foran bygningsporter
  for (const o of L.objects) if (o.kind === 'building' && o.opts.sign && o.y + o.h < H - T) {
    const dx = o.x + o.w / 2 - 22;
    hazard(p, dx, o.y + o.h + 2, 44, 6, 6, Y);
  }

  // store sonebokstaver på gulvet
  for (const [txt, lx, ly, size, a, rot] of P.labels || []) {
    p.save(); p.translate(lx * T, ly * T); if (rot) p.rotate(rot);
    p.font = `bold ${size}px "Arial Black", Arial, sans-serif`; p.fillStyle = `rgba(225,225,215,${a})`; p.fillText(txt, 0, 0);
    p.restore();
  }

  // slitasje: viske bort maling med støy
  p.save(); p.setTransform(1, 0, 0, 1, 0, 0); p.globalCompositeOperation = 'destination-out';
  const ww = pc.width, hh = pc.height;
  for (let i = 0; i < 9000; i++) {
    const sx = rng() * ww, sy = rng() * hh, r = rng.range(1, 5) * RES;
    p.fillStyle = `rgba(0,0,0,${rng.range(0.3, 0.9)})`;
    p.beginPath(); p.arc(sx, sy, r, 0, Math.PI * 2); p.fill();
  }
  // stor-skala falming
  for (let i = 0; i < 160; i++) {
    const sx = rng() * ww, sy = rng() * hh, r = rng.range(20, 70) * RES;
    const g = p.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    p.fillStyle = g; p.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  p.restore();

  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.85; ctx.drawImage(pc, 0, 0); ctx.restore();
}

// ---------------------------------------------------------------- dekor
function drawProps(ctx, L, rng) {
  const T = L.tile;
  for (const pr of L.props) {
    const x = pr.x * T, y = pr.y * T;
    if (pr.kind === 'drain') {
      ctx.fillStyle = '#151618'; ctx.fillRect(x - 11, y - 7, 22, 14);
      ctx.strokeStyle = '#5b5f62'; ctx.lineWidth = 1.2; ctx.strokeRect(x - 11, y - 7, 22, 14);
      ctx.strokeStyle = '#3b3e41'; ctx.lineWidth = 1.5;
      for (let k = -8; k <= 8; k += 3) { ctx.beginPath(); ctx.moveTo(x + k, y - 6); ctx.lineTo(x + k, y + 6); ctx.stroke(); }
      blot(ctx, x, y + 6, 16, '#0a0806', 0.35);
    } else if (pr.kind === 'pallet') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(pr.a || 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-13, -10, 28, 23);
      for (let k = 0; k < 5; k++) { ctx.fillStyle = shade('#6d5f48', rng.range(-0.15, 0.08)); ctx.fillRect(-14, -11 + k * 4.6, 28, 3.4); }
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-14, -11, 3, 22); ctx.fillRect(-1.5, -11, 3, 22); ctx.fillRect(11, -11, 3, 22);
      ctx.restore();
    } else if (pr.kind === 'cone') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = '#d0632a'; ctx.beginPath(); ctx.arc(x, y - 1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y - 1, 2.6, 0, Math.PI * 2); ctx.stroke();
    } else if (pr.kind === 'cable') {
      ctx.strokeStyle = '#121314'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); pr.pts.forEach(([a, b], i) => (i ? ctx.lineTo(a * T, b * T) : ctx.moveTo(a * T, b * T))); ctx.stroke();
    } else if (pr.kind === 'trench') {
      // rørgrøft i gulvet med rist
      const [[ax, ay], [bx, by]] = pr.pts, horiz = Math.abs(by - ay) < Math.abs(bx - ax);
      const x0 = Math.min(ax, bx) * T, y0 = Math.min(ay, by) * T, len = (horiz ? Math.abs(bx - ax) : Math.abs(by - ay)) * T, wd = 14;
      const rx = horiz ? x0 : x0 - wd / 2, ry = horiz ? y0 - wd / 2 : y0, rw = horiz ? len : wd, rh = horiz ? wd : len;
      ctx.fillStyle = '#121314'; ctx.fillRect(rx, ry, rw, rh);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#4a4f53', '#5a3d28', '#454a4e'][k]; if (horiz) ctx.fillRect(rx, ry + 2.5 + k * 3.5, rw, 2.2); else ctx.fillRect(rx + 2.5 + k * 3.5, ry, 2.2, rh); }
      ctx.strokeStyle = 'rgba(120,125,130,0.55)'; ctx.lineWidth = 0.8;
      for (let k = 0; k < len; k += 3) { ctx.beginPath(); if (horiz) { ctx.moveTo(rx + k, ry); ctx.lineTo(rx + k, ry + rh); } else { ctx.moveTo(rx, ry + k); ctx.lineTo(rx + rw, ry + k); } ctx.stroke(); }
      ctx.strokeStyle = '#6a6f74'; ctx.lineWidth = 1.2; ctx.strokeRect(rx, ry, rw, rh);
    } else if (pr.kind === 'vent') {
      ctx.fillStyle = '#1b1d1f'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4c5054'; ctx.lineWidth = 1.5; ctx.stroke();
      for (let k = 0; k < 5; k++) { const a = k * 1.2566; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.stroke(); }
    }
  }
}

// ---------------------------------------------------------------- skygger
// 28.10: jersey-blokkene (effects/cover.js paintJersey) fyller hele fotavtrykket, så bakkeskyggen bruker hele rektangelet (som sandsekkene).
function nsShadowRect(o) { return o; }
function* drawShadows(ctx, L) {
  const W = L.width, H = L.height;
  const sc = makeCanvas(W * RES, H * RES), s = sc.getContext('2d'); s.scale(RES, RES);
  // kastet skygge mot sørøst (lys fra nordvest, høyt)
  s.fillStyle = '#000';
  for (const o of L.objects) {
    const e = o.elev;
    let dx = e * 1.05, dy = e * 0.7;
    if (L.view === '34') { const so = shadowOffset(o.height || e / PROJ.zScale); dx = so.x; dy = so.y; } // felles lysretning (shared/light.js)
    if (o.overhead) {
      // løftet objekt: skyggen er fotavtrykket forskjøvet, ikke koblet til bakken
      s.globalAlpha = o.kind === 'catwalk' ? 0.5 : 0.75;
      s.fillRect(o.x + dx * 0.7, o.y + dy * 0.7 - e * 0.2, o.w, o.h);
      continue;
    }
    if (o.kind === 'tank') {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, R = Math.min(o.w, o.h) / 2 - 2;
      s.globalAlpha = 1; s.beginPath(); s.arc(cx, cy, R, 0, Math.PI * 2); s.fill();
      s.beginPath(); s.arc(cx + dx, cy + dy, R, 0, Math.PI * 2); s.fill();
      s.lineWidth = R * 2; s.strokeStyle = '#000'; s.beginPath(); s.moveTo(cx, cy); s.lineTo(cx + dx, cy + dy); s.stroke();
      continue;
    }
    s.globalAlpha = o.type === 'high' ? 1 : 0.8;
    const r = nsShadowRect(o); if (r !== o) { dx *= 0.28; dy *= 0.28; }   // NS-barriere v5: smal, lav jersey (Effekter 27.10)
    s.beginPath();
    s.moveTo(r.x, r.y); s.lineTo(r.x + r.w, r.y); s.lineTo(r.x + r.w + dx, r.y + dy);
    s.lineTo(r.x + r.w + dx, r.y + r.h + dy); s.lineTo(r.x + dx, r.y + r.h + dy); s.lineTo(r.x, r.y + r.h);
    s.closePath(); s.fill();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${4 * RES}px)`; ctx.globalAlpha = 0.72; ctx.drawImage(sc, 0, 0);
  ctx.restore();
  flush(ctx.canvas); yield { k: 'shadows' }; // Hakk 27.10: de to helbrett-uskarphetene i hver sin oppgave
  // kontaktskygge (ambient occlusion) tett rundt foten
  const ac = makeCanvas(W * RES, H * RES), a = ac.getContext('2d'); a.scale(RES, RES);
  a.fillStyle = '#000';
  for (const o of L.objects) {
    if (o.overhead) continue;
    if (o.kind === 'tank') { const R = Math.min(o.w, o.h) / 2 + 1; a.beginPath(); a.arc(o.x + o.w / 2, o.y + o.h / 2 + 1, R, 0, Math.PI * 2); a.fill(); continue; }
    const r = nsShadowRect(o), p = r === o ? 3 : 1;
    a.fillRect(r.x - p, r.y - 2, r.w + p * 2, r.h + (r === o ? 5 : 3));
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${3 * RES}px)`; ctx.globalAlpha = 0.7; ctx.drawImage(ac, 0, 0);
  ctx.filter = 'none'; ctx.restore();
}

// ---------------------------------------------------------------- objekter
function drawObject(ctx, o, rng) {
  switch (o.kind) {
    case 'container': return drawContainer(ctx, o.x, o.y, o.w, o.h, o.elev, CONTAINER_COLORS[o.opts.color ?? 0], rng, 0);
    case 'stack': {
      const lo = o.stackBase || 18; // nederste container (trekvart: halve høyden)
      drawContainer(ctx, o.x, o.y, o.w, o.h, lo, CONTAINER_COLORS[o.opts.color2 ?? 4], rng, 0, true);
      return drawContainer(ctx, o.x + (o.w > o.h ? 2 : 0), o.y, o.w - (o.w > o.h ? 4 : 0), o.h, o.elev, CONTAINER_COLORS[o.opts.color ?? 0], rng, lo);
    }
    case 'wall': return drawWall(ctx, o, rng);
    case 'building': return drawBuilding(ctx, o, rng);
    case 'barrier': case 'ledge': return drawBarrier(ctx, o, rng);
    case 'sandbag': return drawSandbags(ctx, o, rng);
    case 'crates': return drawCrates(ctx, o, rng);
    case 'cratestack': return drawCrateStack(ctx, o, rng);
    case 'barrels': return drawBarrels(ctx, o, rng);
    case 'tank': return drawTank(ctx, o, rng);
    case 'unit': return drawUnit(ctx, o, rng);
    case 'pipeline': return drawPipeline(ctx, o, rng);
    case 'pipes': return drawPipes(ctx, o, rng);
    case 'valve': return drawValve(ctx, o, rng);
    case 'overpipe': return drawOverpipe(ctx, o, rng);
    case 'catwalk': return drawCatwalk(ctx, o, rng);
  }
}

// fotplater for ben til løftede objekter (gulvlaget)
function drawFeet(ctx, o) {
  const horiz = o.w >= o.h, pts = [];
  if (o.kind === 'overpipe') {
    if (horiz) { for (let i = 8; i < o.w; i += 128) pts.push([o.x + i, o.y + 3], [o.x + i, o.y + o.h - 3]); pts.push([o.x + o.w - 12, o.y + 3], [o.x + o.w - 12, o.y + o.h - 3]); }
    else { for (let i = 8; i < o.h; i += 128) pts.push([o.x + 2, o.y + i], [o.x + o.w - 7, o.y + i]); }
  }
  for (const [x, y] of pts) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 3, y - 3, 11, 8); ctx.fillStyle = '#3a3d40'; ctx.fillRect(x - 2, y - 2, 9, 6); }
}

// ---------------------------------------------------------------- rot på gulvet (lav kontrast)
function drawClutter(ctx, L, rng) {
  const W = L.width, H = L.height, T = L.tile;
  const solid = (x, y, m = 0) => L.objects.some((o) => !o.overhead && x > o.x - m && x < o.x + o.w + m && y > o.y - m && y < o.y + o.h + m);
  const free = (m = 4) => { let x, y, k = 0; do { x = rng.range(1.2, L.cols - 1.2) * T; y = rng.range(1.2, L.rows - 1.2) * T; k++; } while (k < 20 && solid(x, y, m)); return [x, y]; };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // flere dekkspor (gaffeltruck) langs hovedfeltene
  for (let i = 0; i < 6; i++) {
    const [x0, y0] = free(), horiz = rng.chance(0.5), len = rng.range(160, 420);
    const x1 = horiz ? x0 + len : x0 + rng.range(-30, 30), y1 = horiz ? y0 + rng.range(-30, 30) : y0 + len;
    for (const off of [-7, 7]) {
      ctx.beginPath(); ctx.moveTo(x0 + (horiz ? 0 : off), y0 + (horiz ? off : 0));
      ctx.bezierCurveTo(x0 + (x1 - x0) * 0.3 + (horiz ? 0 : off), y0 + (y1 - y0) * 0.3 + (horiz ? off : 0) + rng.range(-20, 20), x0 + (x1 - x0) * 0.7 + (horiz ? 0 : off), y0 + (y1 - y0) * 0.7 + (horiz ? off : 0), x1 + (horiz ? 0 : off), y1 + (horiz ? off : 0));
      ctx.strokeStyle = 'rgba(12,11,10,0.09)'; ctx.lineWidth = 4; ctx.setLineDash([2.2, 1.6]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // oljesøl ved foten av objekter
  for (const o of L.objects) {
    if (o.overhead || !rng.chance(0.45) || o.kind === 'water') continue;
    const sx = o.x + rng() * o.w, sy = o.y + o.h + rng.range(2, 10);
    for (let k = 0; k < 4; k++) blot(ctx, sx + rng.range(-10, 10), sy + rng.range(-3, 5), rng.range(5, 13), '#080706', rng.range(0.14, 0.26));
  }
  // vindblåst søppel samlet langs nordvegger og hjørner
  for (const o of L.objects) {
    if (o.overhead || o.type !== 'high') continue;
    const n = Math.round((o.w + o.h) / 26);
    for (let k = 0; k < n; k++) {
      const side = rng.int(0, 3);
      const x = side === 0 ? o.x + rng() * o.w : side === 1 ? o.x + o.w + rng.range(1, 6) : side === 2 ? o.x + rng() * o.w : o.x - rng.range(1, 6);
      const y = side === 0 ? o.y + o.h + rng.range(1, 5) : side === 2 ? o.y - rng.range(1, 5) : o.y + rng() * o.h;
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(170,165,150,0.16)' : 'rgba(10,10,10,0.3)';
      ctx.save(); ctx.translate(x, y); ctx.rotate(rng() * 6.28); ctx.fillRect(-rng.range(1, 3), -1, rng.range(2, 6), rng.range(1, 2.5)); ctx.restore();
    }
  }
  // papirark (lyse, men svært dempet)
  for (let i = 0; i < 46; i++) {
    const [x, y] = free(6);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rng() * 6.28);
    const w = rng.range(5, 8), h = w * 1.35;
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-w / 2 + 0.8, -h / 2 + 0.8, w, h);
    ctx.fillStyle = `rgba(${rng.int(185, 205)},${rng.int(180, 195)},${rng.int(165, 180)},${rng.range(0.16, 0.26)})`; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, rng.range(-1, 1)); ctx.stroke();
    if (rng.chance(0.5)) { ctx.fillStyle = 'rgba(40,40,40,0.12)'; for (let k = -h / 2 + 1.5; k < h / 2 - 1; k += 1.4) ctx.fillRect(-w / 2 + 1, k, w * rng.range(0.4, 0.8), 0.4); }
    ctx.restore();
  }
  // småskrot: bokser, bolter, metallbiter, sigarettstumper
  for (let i = 0; i < 140; i++) {
    const [x, y] = free(2);
    const t = rng();
    ctx.save(); ctx.translate(x, y); ctx.rotate(rng() * 6.28);
    if (t < 0.3) { ctx.fillStyle = 'rgba(95,98,100,0.35)'; ctx.fillRect(-2, -1, 4, 2); ctx.fillStyle = 'rgba(200,200,200,0.12)'; ctx.fillRect(-2, -1, 4, 0.5); }
    else if (t < 0.5) { ctx.fillStyle = 'rgba(110,60,30,0.3)'; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, 6.28); ctx.fill(); }
    else if (t < 0.75) { ctx.fillStyle = 'rgba(60,62,64,0.4)'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(rng.range(0, 3), -2); ctx.lineTo(3, 1); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(190,180,160,0.2)'; ctx.fillRect(-1.5, -0.4, 3, 0.8); }
    ctx.restore();
  }
  // løse kabler
  for (let i = 0; i < 9; i++) {
    const [x0, y0] = free(8);
    let x = x0, y = y0, a = rng() * 6.28;
    ctx.beginPath(); ctx.moveTo(x, y);
    const n = rng.int(3, 6);
    for (let k = 0; k < n; k++) { const na = a + rng.range(-1, 1), l = rng.range(14, 34); const cx = x + Math.cos(a) * l * 0.5, cy = y + Math.sin(a) * l * 0.5; x += Math.cos(na) * l; y += Math.sin(na) * l; a = na; ctx.quadraticCurveTo(cx, cy, x, y); }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = rng.chance(0.3) ? 'rgba(120,70,30,0.45)' : 'rgba(22,23,25,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // knust glass / fliser
  for (let i = 0; i < 12; i++) {
    const [x, y] = free(4);
    for (let k = 0; k < 10; k++) { ctx.fillStyle = `rgba(170,190,200,${rng.range(0.05, 0.14)})`; ctx.fillRect(x + rng.range(-8, 8), y + rng.range(-6, 6), rng.range(0.6, 1.8), rng.range(0.6, 1.4)); }
  }
  ctx.restore();
}

// Container: topp løftet 'e' px nordover, synlig sørvegg mellom.
// base = høyde for bunnen av denne containeren (for stabler).
function drawContainer(ctx, x, y, w, h, e, col, rng, base = 0, faceOnly = false) {
  const horiz = w >= h;
  const fy = y + h - e, fh = e - base;            // sørvegg
  // sørvegg
  ctx.fillStyle = shade(col, -0.42); ctx.fillRect(x, fy, w, fh);
  if (horiz) {
    for (let i = x + 3; i < x + w - 3; i += 3.2) { ctx.fillStyle = (Math.round((i - x) / 3.2) % 2) ? shade(col, -0.28) : shade(col, -0.55); ctx.fillRect(i, fy + 1.5, 1.6, fh - 3); }
    ctx.fillStyle = shade(col, -0.65); ctx.fillRect(x, fy, 3, fh); ctx.fillRect(x + w - 3, fy, 3, fh);
    ctx.fillStyle = shade(col, -0.15); ctx.fillRect(x, fy, w, 1.2);
    ctx.fillStyle = shade(col, -0.7); ctx.fillRect(x, fy + fh - 1.5, w, 1.5);
    if (fh > 10 && rng.chance(0.8)) {
      ctx.fillStyle = 'rgba(230,225,210,0.45)'; ctx.font = 'bold 5px Arial, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`BRX ${rng.int(1000, 9999)} ${rng.int(10, 99)}G1`, x + 8, fy + fh / 2 + 2);
    }
  } else {
    // dørende med låsestenger
    ctx.fillStyle = shade(col, -0.6); ctx.fillRect(x, fy, 2.5, fh); ctx.fillRect(x + w - 2.5, fy, 2.5, fh); ctx.fillRect(x + w / 2 - 0.6, fy, 1.2, fh);
    ctx.fillStyle = '#8b9095';
    for (const f of [0.2, 0.36, 0.64, 0.8]) ctx.fillRect(x + w * f - 0.5, fy + 1, 1, fh - 2);
    ctx.fillStyle = '#b0b4b8';
    for (const f of [0.36, 0.64]) ctx.fillRect(x + w * f - 1.5, fy + fh * 0.5 - 0.6, 3, 1.2);
    ctx.fillStyle = shade(col, -0.1); ctx.fillRect(x, fy, w, 1.2);
    ctx.fillStyle = shade(col, -0.75); ctx.fillRect(x, fy + fh - 1.5, w, 1.5);
  }
  if (base) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, fy + fh - 1, w, 2); }
  if (faceOnly) return;

  // tak
  const ty = y - e;
  ctx.fillStyle = col; ctx.fillRect(x, ty, w, h);
  // korrugering på tvers av lengdeaksen
  const L = horiz ? w : h;
  for (let i = 4; i < L - 4; i += 4) {
    ctx.fillStyle = (i / 4) % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)';
    if (horiz) ctx.fillRect(x + i, ty + 2, 2, h - 4); else ctx.fillRect(x + 2, ty + i, w - 4, 2);
  }
  // lys/skygge-gradient over taket
  const g = ctx.createLinearGradient(x, ty, x + w, ty + h);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g; ctx.fillRect(x, ty, w, h);
  // rust og skitt
  ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, h); ctx.clip();
  for (let i = 0; i < 5; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(4, 12), '#6a3a1c', rng.range(0.25, 0.5));
  for (let i = 0; i < 4; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(5, 14), '#000000', rng.range(0.15, 0.3));
  // bulker
  for (let i = 0; i < 2; i++) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + rng() * w, ty + rng() * h, rng.range(2, 5), rng.range(1.5, 3), rng() * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // ramme
  ctx.strokeStyle = shade(col, -0.55); ctx.lineWidth = 1.6; ctx.strokeRect(x + 0.8, ty + 0.8, w - 1.6, h - 1.6);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + 1.5, ty + 1, w - 3, 0.8);
  // hjørnebeslag
  ctx.fillStyle = '#17191b';
  for (const [cx, cy] of [[x, ty], [x + w - 4, ty], [x, ty + h - 4], [x + w - 4, ty + h - 4]]) ctx.fillRect(cx, cy, 4, 4);
  ctx.fillStyle = '#4a4e52';
  for (const [cx, cy] of [[x + 1.5, ty + 1.5], [x + w - 2.5, ty + 1.5], [x + 1.5, ty + h - 2.5], [x + w - 2.5, ty + h - 2.5]]) ctx.fillRect(cx, cy, 1, 1);
}

function drawWall(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const ty = y - e;
  // sørvegg (synlig kun der den vender inn mot banen)
  ctx.fillStyle = '#34373a'; ctx.fillRect(x, y + h - e, w, e);
  for (let i = x; i < x + w; i += 48) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(i, y + h - e, 1.2, e); }
  for (let i = 0; i < w / 20; i++) { const sx = x + rng() * w; ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx, y + h - e, rng.range(2, 6), e * rng.range(0.4, 1)); }
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y + h - 1.5, w, 1.5);
  // topp: betongkappe
  ctx.fillStyle = '#4e5153'; ctx.fillRect(x, ty, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, ty, w, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, ty + h - 2, w, 2);
  const horiz = w >= h;
  for (let i = 0; i < (horiz ? w : h); i += 48) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; if (horiz) ctx.fillRect(x + i, ty, 1.2, h); else ctx.fillRect(x, ty + i, w, 1.2); }
  // piggtråd
  ctx.strokeStyle = 'rgba(150,150,150,0.55)'; ctx.lineWidth = 0.7; ctx.beginPath();
  if (horiz) { for (let i = 0; i <= w; i += 4) ctx.lineTo(x + i, ty + h / 2 + ((i / 4) % 2 ? -3 : 3)); }
  else { for (let i = 0; i <= h; i += 4) ctx.lineTo(x + w / 2 + ((i / 4) % 2 ? -3 : 3), ty + i); }
  ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, h); ctx.clip();
  for (let i = 0; i < (w * h) / 900; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(4, 10), '#000', 0.2);
  ctx.restore();
}

function drawBuilding(ctx, o, rng) {
  const { x, y, w, h, elev: e } = o;
  const ty = y - e, fy = y + h - e;
  // fasade
  ctx.fillStyle = '#2c3034'; ctx.fillRect(x, fy, w, e);
  for (let i = x + 4; i < x + w; i += 6) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(i, fy, 1.5, e); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(i + 1.5, fy, 1, e); }
  ctx.fillStyle = '#1b1d20'; ctx.fillRect(x, fy + e - 3, w, 3);
  o._windows = [];
  if (w >= 3 * 32) {
    // port med varselramme
    const dx = x + w / 2 - 18;
    hazard(ctx, dx - 2, fy + 4, 40, e - 4, 5);
    ctx.fillStyle = '#25282b'; ctx.fillRect(dx, fy + 6, 36, e - 6);
    for (let k = fy + 8; k < fy + e; k += 3) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(dx, k, 36, 1); }
    // vindusstriper (emissive tegnes i glow)
    for (const wx of [x + 10, x + w - 34]) { ctx.fillStyle = '#0d1418'; ctx.fillRect(wx, fy + 6, 24, 5); o._windows.push({ x: wx, y: fy + 6, w: 24, h: 5, c: rng.chance(0.5) ? '#39c6ff' : '#ffb347' }); }
    if (o.opts.sign) { ctx.fillStyle = 'rgba(220,220,210,0.7)'; ctx.font = 'bold 11px "Arial Black", Arial'; ctx.textAlign = 'left'; ctx.fillText(o.opts.sign, x + 8, fy + e - 7); }
  }
  // tak
  ctx.fillStyle = '#3a4047'; ctx.fillRect(x, ty, w, h);
  // trapesprofilerte takplater
  const vert = w >= h;
  for (let i = 0; i < (vert ? w : h); i += 8) {
    ctx.fillStyle = (i / 8) % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.14)';
    if (vert) ctx.fillRect(x + i, ty, 4, h); else ctx.fillRect(x, ty + i, w, 4);
  }
  for (let i = 48; i < (vert ? w : h); i += 48) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; if (vert) ctx.fillRect(x + i, ty, 1.2, h); else ctx.fillRect(x, ty + i, w, 1.2); }
  const g = ctx.createLinearGradient(x, ty, x + w, ty + h); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.fillRect(x, ty, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, ty, w, h); ctx.clip();
  for (let i = 0; i < (w * h) / 700; i++) { const bx = x + rng() * w, by = ty + rng() * h; ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(bx, by, rng.range(6, 20), rng.range(2, 6), 0, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < (w * h) / 1500; i++) blot(ctx, x + rng() * w, ty + rng() * h, rng.range(5, 12), '#5a3a20', 0.25);
  ctx.restore();
  // takvinduer (lys innenfra tegnes i glow)
  o._sky = [];
  if (w * h >= 6 * 1024) {
    const n2 = Math.floor((vert ? w : h) / 64);
    for (let k = 0; k < n2; k++) {
      const sx = vert ? x + 20 + k * 64 : x + w * 0.5 - 5, sy = vert ? ty + h * 0.5 - 5 : ty + 20 + k * 64;
      const sw = vert ? 26 : 10, sh = vert ? 10 : 26;
      ctx.fillStyle = '#121619'; ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#596067'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, sw, sh);
      o._sky.push({ x: sx, y: sy, w: sw, h: sh });
    }
  }
  // brystning
  ctx.strokeStyle = '#4f5459'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, ty + 1.5, w - 3, h - 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 3.5, ty + 3.5, w - 7, h - 7);
  // takutstyr
  o._vents = [];
  const n = Math.max(1, Math.floor((w * h) / 4000));
  for (let i = 0; i < n; i++) {
    const uw = rng.range(14, 22), uh = rng.range(12, 18);
    const ux = x + 6 + rng() * Math.max(1, w - uw - 12), uy = ty + 6 + rng() * Math.max(1, h - uh - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(ux + 3, uy + 3, uw, uh);
    ctx.fillStyle = '#4a4f54'; ctx.fillRect(ux, uy, uw, uh);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(ux, uy, uw, 1);
    const r = Math.min(uw, uh) * 0.36, cx = ux + uw / 2, cy = uy + uh / 2;
    ctx.fillStyle = '#1a1c1e'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5d6267'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
    o._vents.push({ x: cx, y: cy });
  }
  // rør langs taket
  if (w > 64) {
    const py = ty + h - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + 6, py + 2, w - 12, 4);
    ctx.fillStyle = '#5a5f63'; ctx.fillRect(x + 6, py, w - 12, 3.2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 6, py, w - 12, 0.8);
  }
}

function drawBarrier(ctx, o, rng) {
  const horiz = o.w >= o.h, e = o.elev;
  // jersey-barrierer: smalere enn ruta
  const inset = 6;
  const x = horiz ? o.x + 1 : o.x + inset, y = horiz ? o.y + inset : o.y + 1;
  const w = horiz ? o.w - 2 : o.w - inset * 2, h = horiz ? o.h - inset * 2 : o.h - 2;
  const segL = 32, L = horiz ? w : h;
  for (let s = 0; s < L; s += segL) {
    const sl = Math.min(segL, L - s) - 1.5;
    const sx = horiz ? x + s : x, sy = horiz ? y : y + s, sw = horiz ? sl : w, sh = horiz ? h : sl;
    // sørvegg
    ctx.fillStyle = '#6e6f6a'; ctx.fillRect(sx, sy + sh - e, sw, e);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx, sy + sh - 1.2, sw, 1.2);
    const ty = sy - e;
    // skrånende sider + lys rygg
    ctx.fillStyle = '#9d9e97'; ctx.fillRect(sx, ty, sw, sh);
    if (horiz) {
      ctx.fillStyle = '#c4c4bb'; ctx.fillRect(sx, ty + sh * 0.35, sw, sh * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx, ty + sh * 0.75, sw, sh * 0.25);
    } else {
      ctx.fillStyle = '#c4c4bb'; ctx.fillRect(sx + sw * 0.35, ty, sw * 0.3, sh);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx + sw * 0.75, ty, sw * 0.25, sh);
    }
    // varselmaling på endene
    if (s === 0) { if (horiz) hazard(ctx, sx, ty, 6, sh, 3); else hazard(ctx, sx, ty, sw, 6, 3); }
    ctx.save(); ctx.beginPath(); ctx.rect(sx, ty, sw, sh); ctx.clip();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(30,28,25,${rng.range(0.15, 0.4)})`; ctx.fillRect(sx + rng() * sw, ty + rng() * sh, rng.range(1, 3), rng.range(1, 2)); }
    blot(ctx, sx + rng() * sw, ty + rng() * sh, 8, '#3a2a1a', 0.25);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8; ctx.strokeRect(sx + 0.4, ty + 0.4, sw - 0.8, sh - 0.8);
  }
  if (!horiz || true) {
    const last = (horiz ? x + w - 6 : y + h - 6);
    if (horiz) hazard(ctx, last - 1.5, y - e, 6, h, 3); else hazard(ctx, x, last - 1.5 - e, w, 6, 3);
  }
}

function drawSandbags(ctx, o, rng) {
  const horiz = o.w >= o.h, e = o.elev;
  const x = o.x + (horiz ? 1 : 4), y = o.y + (horiz ? 4 : 1), w = o.w - (horiz ? 2 : 8), h = o.h - (horiz ? 8 : 2);
  const rows = 2, L = horiz ? w : h, D = horiz ? h : w;
  const bagL = 13, bagD = D / rows;
  // front (sør)
  ctx.fillStyle = '#5b5040'; ctx.fillRect(x, y + h - e, w, e);
  for (let i = 0; i < w; i += 7) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + i, y + h - e, 1, e); }
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bagL / 2 : 0;
    for (let s = -off; s < L; s += bagL) {
      const a = Math.max(0, s), b = Math.min(L, s + bagL - 1);
      if (b - a < 4) continue;
      const bx = horiz ? x + a : x + r * bagD, by = (horiz ? y + r * bagD : y + a) - e;
      const bw = horiz ? b - a : bagD - 1, bh = horiz ? bagD - 1 : b - a;
      ctx.fillStyle = shade('#a39272', rng.range(-0.12, 0.06));
      roundRect(ctx, bx, by, bw, bh, 3.5); ctx.fill();
      ctx.strokeStyle = 'rgba(30,24,16,0.65)'; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,240,0.18)'; roundRect(ctx, bx + 1.5, by + 1, bw - 3, bh * 0.35, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,20,0.35)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); if (horiz) { ctx.moveTo(bx + bw * 0.5, by + 1); ctx.lineTo(bx + bw * 0.5, by + bh - 1); } else { ctx.moveTo(bx + 1, by + bh * 0.5); ctx.lineTo(bx + bw - 1, by + bh * 0.5); } ctx.stroke();
    }
  }
}

function crate(ctx, x, y, s, e, col, rng, mark = true) {
  // front
  ctx.fillStyle = shade(col, -0.38); ctx.fillRect(x, y + s - e, s, e);
  ctx.fillStyle = shade(col, -0.6); ctx.fillRect(x, y + s - e, 2, e); ctx.fillRect(x + s - 2, y + s - e, 2, e);
  // topp
  const ty = y - e;
  ctx.fillStyle = col; ctx.fillRect(x, ty, s, s);
  ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 2; ctx.strokeRect(x + 1, ty + 1, s - 2, s - 2);
  ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x + 3, ty + 3); ctx.lineTo(x + s - 3, ty + s - 3); ctx.moveTo(x + s - 3, ty + 3); ctx.lineTo(x + 3, ty + s - 3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 2, ty + 1.5, s - 4, 1);
  ctx.fillStyle = '#c9a227'; if (mark) { ctx.fillRect(x + 1, ty + 1, 4, 4); ctx.fillRect(x + s - 5, ty + s - 5, 4, 4); }
  blot(ctx, x + rng() * s, ty + rng() * s, 6, '#000', 0.2);
}

function drawCrates(ctx, o, rng) {
  const T = 32, e = o.elev;
  const cols = ['#8a8470', '#7d827d', '#8f8875'];
  for (let ty = o.y; ty < o.y + o.h; ty += T) for (let tx = o.x; tx < o.x + o.w; tx += T) {
    const s = rng.range(24, 28), jx = rng.range(0, T - s), jy = rng.range(0, T - s);
    crate(ctx, tx + jx, ty + jy, s, e, rng.pick(cols), rng);
  }
}

function drawCrateStack(ctx, o, rng) {
  const e = o.elev, half = 16;
  const cols = ['#4f5340', '#4a4636', '#55503c'];
  // nederste lag (litt bredere), så topplag
  for (let ty = o.y; ty < o.y + o.h; ty += 32) for (let tx = o.x; tx < o.x + o.w; tx += 32) crate(ctx, tx + 1, ty + 1, 30, 10, rng.pick(cols), rng, false);
  const c = rng.pick(cols);
  ctx.fillStyle = shade(c, -0.4); ctx.fillRect(o.x + 3, o.y + o.h - e, o.w - 6, e - 10);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(o.x + 3, o.y + o.h - 11, o.w - 6, 1.5);
  // presenning over topplaget
  const ty = o.y - e;
  ctx.fillStyle = '#3c4234'; roundRect(ctx, o.x + 3, ty + 2, o.w - 6, o.h - 4, 4); ctx.fill();
  const g = ctx.createLinearGradient(o.x, ty, o.x + o.w, ty + o.h); g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); const a = o.x + 6 + rng() * (o.w - 12); ctx.moveTo(a, ty + 4); ctx.quadraticCurveTo(a + rng.range(-8, 8), ty + o.h / 2, a + rng.range(-6, 6), ty + o.h - 4); ctx.stroke(); }
  // stropper
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(o.x + o.w * 0.3, ty + 2, 2, o.h - 4); ctx.fillRect(o.x + o.w * 0.7, ty + 2, 2, o.h - 4);
  ctx.fillRect(o.x + o.w * 0.3, o.y + o.h - e, 2, e); ctx.fillRect(o.x + o.w * 0.7, o.y + o.h - e, 2, e);
}

function drawBarrels(ctx, o, rng) {
  const e = o.elev, r = 7;
  const cols = ['#2f5170', '#7a3b22', '#8c7424', '#3e5a3a'];
  const pts = [];
  for (let ty = o.y; ty < o.y + o.h; ty += 32) for (let tx = o.x; tx < o.x + o.w; tx += 32) {
    pts.push([tx + 9, ty + 10], [tx + 23, ty + 12], [tx + 14, ty + 24]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  for (const [cx, cy0] of pts) {
    const cy = cy0 + rng.range(-1, 1), col = rng.pick(cols);
    ctx.fillStyle = shade(col, -0.4); ctx.fillRect(cx - r, cy - e, r * 2, e);
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx - r + 2, cy - e, 1.5, e);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx - r, cy - e * 0.5, r * 2, 1);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy - e, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(col, -0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy - e, r - 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = shade(col, 0.25); ctx.beginPath(); ctx.arc(cx - 2.5, cy - e - 2, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(cx - 2, cy - e - 2, r * 0.6, Math.PI, Math.PI * 1.5); ctx.lineTo(cx, cy - e); ctx.fill();
  }
}

// ---------------------------------------------------------------- lys
function lampPos(L, l) { return { x: l.x * L.tile, y: l.y * L.tile, r: l.r * L.tile }; }

function lightPool(ctx, L, l, alphaMul = 1) {
  try { if (fxFloor?.lightmapPool?.(ctx, L, l, alphaMul)) return; } catch (e) { /* fallback */ }
  const { x, y } = lampPos(L, l), r = lampPos(L, l).r * 1.4, i = l.i * alphaMul * 1.25;
  const [cr, cg, cb] = l.color || warmOf(L);
  ctx.save(); ctx.translate(x, y);
  let cx = 0;
  if (l.spread) { ctx.rotate(l.dir); ctx.scale(1, l.spread); cx = r * 0.42; }
  const g = ctx.createRadialGradient(cx, 0, 0, cx, 0, r);
  g.addColorStop(0, `rgba(${cr},${Math.min(255, cg + 40)},${Math.min(255, cb + 90)},${Math.min(1, i)})`);
  g.addColorStop(0.2, `rgba(${cr},${cg},${cb},${i * 0.8})`);
  g.addColorStop(0.5, `rgba(${cr},${cg - 20},${cb - 20},${i * 0.35})`);
  g.addColorStop(0.75, `rgba(${cr},${cg - 30},${cb - 20},${i * 0.1})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = g; ctx.fillRect(cx - r, -r, r * 2, r * 2);
  ctx.restore();
}

// Dynamisk lys (flimmer/beacon/fakkel): samme gradient ferdig i en liten sprite per lys, tegnet med globalAlpha.
const _poolSpr = new WeakMap();
function lightPoolFast(ctx, L, l, alphaMul = 1) {
  let s = _poolSpr.get(l);
  if (!s) {
    const r = lampPos(L, l).r * 1.4, S = 128, c = makeCanvas(S, S), x = c.getContext('2d');
    x.scale(S / (2 * r), S / (2 * r)); x.translate(r, r);
    lightPool(x, L, { ...l, x: 0, y: 0, spread: 0, dir: 0 }, 1);
    _poolSpr.set(l, s = { c, r });
  }
  const { x, y } = lampPos(L, l), r = s.r;
  ctx.save(); ctx.translate(x, y);
  let cx = 0;
  if (l.spread) { ctx.rotate(l.dir); ctx.scale(1, l.spread); cx = r * 0.42; }
  // ytre 25 % av radien har alfa < 0,1·i (×alphaMul ≤ 0,3 → usynlig): tegn bare den indre delen (~44 % mindre fyllflate)
  const S = s.c.width, k = 0.75, q = S * (1 - k) / 2;
  ctx.globalAlpha *= Math.min(1, alphaMul); ctx.drawImage(s.c, q, q, S - 2 * q, S - 2 * q, cx - r * k, -r * k, r * 2 * k, r * 2 * k);
  ctx.restore();
}

const LRES = 0.5; // lyskartet er mykt – lav oppløsning holder
function buildLightmap(L, occlude, ambient = true) {
  const W = L.width, H = L.height;
  const lc = makeCanvas(W * LRES, H * LRES), lx = lc.getContext('2d'); lx.scale(LRES, LRES);
  lx.fillStyle = ambient ? halfRgb(ambientOf(L)) : '#000'; lx.fillRect(0, 0, W, H);
  // kjølig fall-off mot kantene (vignett i lyset)
  const vg = lx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${fxVignette(L)})`);
  lx.fillStyle = vg; lx.fillRect(0, 0, W, H);

  const highs = L.objects.filter((o) => o.type === 'high' && o.kind !== 'wall');
  const sources = [...L.lights, ...L._zoneLights];
  for (const l of sources) {
    const { x, y } = lampPos(L, l), r = lampPos(L, l).r * 1.4;
    const bx = Math.floor(x - r), by = Math.floor(y - r), bs = Math.ceil(r * 2);
    const tmp = makeCanvas(bs * LRES, bs * LRES), t = tmp.getContext('2d'); t.scale(LRES, LRES); t.translate(-bx, -by);
    lightPool(t, L, l, (l.flicker ? 0.75 : l.kind === 'beacon' ? 0.55 : 1) * ((L.theme && L.theme.lightScale) || 1) / HDR);
    if (occlude && !l.noOcc) {
      t.globalCompositeOperation = 'destination-out'; t.fillStyle = '#000';
      t.filter = 'blur(1.5px)';
      for (const o of highs) {
        if (o.x > x + r || o.x + o.w < x - r || o.y > y + r || o.y + o.h < y - r) continue;
        if (x >= o.x - 2 && x <= o.x + o.w + 2 && y >= o.y - 2 && y <= o.y + o.h + 2) continue; // lampe på objektet
        const c = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
        for (let k = 0; k < 4; k++) {
          const a = c[k], b = c[(k + 1) % 4];
          const pa = proj(a, x, y), pb = proj(b, x, y);
          t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(b[0], b[1]); t.lineTo(pb[0], pb[1]); t.lineTo(pa[0], pa[1]); t.closePath(); t.fill();
        }
      }
      t.filter = 'none';
    }
    lx.save(); lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'lighter'; lx.drawImage(tmp, bx * LRES, by * LRES); lx.restore();
  }
  return lc;
}

function halfRgb(c) { const m = c.match(/\d+/g).map(Number); return `rgb(${m.map((v) => Math.round(v / HDR)).join(',')})`; }

function proj(p, lx, ly) {
  const dx = p[0] - lx, dy = p[1] - ly, l = Math.hypot(dx, dy) || 1;
  return [p[0] + (dx / l) * 3000, p[1] + (dy / l) * 3000];
}

function drawLampBases(ctx, L) {
  for (const l of L.lights) if (l.kind === 'post') {
    const { x, y } = lampPos(L, l);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 4, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2d30'; ctx.fillRect(x - 5, y - 5, 10, 10);
    hazard(ctx, x - 4, y - 4, 8, 8, 2.5);
  }
}

function drawWallFixtures(ctx, L) {
  for (const l of L.lights) {
    const { x, y } = lampPos(L, l);
    if (l.kind === 'wall') { ctx.fillStyle = '#1c1e20'; ctx.fillRect(x - 6, y - 4, 12, 5); ctx.fillStyle = '#5a5f63'; ctx.fillRect(x - 6, y - 4, 12, 1); }
    if (l.kind === 'post') {
      // mast sett ovenfra: stang + lampehode løftet
      ctx.strokeStyle = '#1e2124'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 18); ctx.stroke();
      ctx.strokeStyle = '#4a4f54'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x - 1, y - 18); ctx.stroke();
      ctx.fillStyle = '#1a1c1f'; roundRect(ctx, x - 9, y - 24, 18, 9, 2.5); ctx.fill();
      ctx.fillStyle = '#4a4f54'; ctx.fillRect(x - 8, y - 24, 16, 1.2);
    }
  }
}

function drawGlow(ctx, L, rng, withObj = true) {
  ctx.globalCompositeOperation = 'lighter';
  for (const l of L.lights) {
    const { x, y, r } = lampPos(L, l);
    if (l.kind === 'beacon' || l.kind === 'flare' || l.kind === 'none') continue; // tegnes dynamisk
    const hy = l.kind === 'post' ? y - 19 : y - 1.5;
    const c = l.color ? '#' + l.color.map((v) => v.toString(16).padStart(2, '0')).join('') : '#ff9a3c';
    // dis rundt lampa
    blot(ctx, x, hy, r * 0.7, c, (l.flicker ? 0.06 : 0.09) * l.i);
    blot(ctx, x, hy, 30, l.color ? c : '#ffb347', 0.5);
    blot(ctx, x, hy, 7, '#fff1d0', 0.9);
    ctx.fillStyle = '#fff6e0'; ctx.fillRect(x - 4, hy - 1.2, 8, 2.4);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (withObj) { ctx.globalCompositeOperation = 'lighter'; drawObjGlow(ctx, L.objects); ctx.globalCompositeOperation = 'source-over'; }
}

// Refleks i vanndammer – tegnes rett på gulvlaget etter belysning
function drawPuddleGlow(ctx, L, rng) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const circles of L._puddles || []) {
    let best = 0, bl = null;
    for (const l of L.lights) { const p = lampPos(L, l); const d = Math.hypot(p.x - circles[0][0], p.y - circles[0][1]); const v = 1 - d / p.r; if (v > best) { best = v; bl = p; } }
    if (!bl) continue;
    ctx.save(); ctx.beginPath(); for (const [cx, cy, r] of circles) { ctx.moveTo(cx + r, cy); ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2); } ctx.clip();
    const [cx, cy] = circles[0];
    // speilbilde av lampa: lys stripe på motsatt side av dammen sett fra lampa
    const dx = cx - bl.x, dy = cy - bl.y, dl = Math.hypot(dx, dy) || 1;
    blot(ctx, cx + (dx / dl) * 8, cy + (dy / dl) * 5, 22, (L.theme && L.theme.puddle) || '#ffc070', 0.22 * best);
    blot(ctx, cx + (dx / dl) * 8, cy + (dy / dl) * 5, 6, '#fff0d0', 0.35 * best);
    ctx.restore();
  }
  ctx.restore();
}

// Vindus- og takvindusglød for en liste objekter (kaller setter 'lighter').
function drawObjGlow(ctx, objs) {
  for (const o of objs) for (const w of o._sky || []) {
    ctx.fillStyle = 'rgba(255,170,90,0.28)'; ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
  }
  for (const o of objs) for (const w of o._windows || []) {
    ctx.fillStyle = rgba(w.c, 0.85); ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    blot(ctx, w.x + w.w / 2, w.y + w.h / 2, 22, w.c, 0.22);
  }
}

// Sonelys på gulvet (inngang/ekstraksjon) – bakes inn i gulvlaget, under aktører og dekning.
function drawZoneGlow(ctx, L) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const e = L.entry, x = L.exit;
  ctx.fillStyle = 'rgba(57,198,255,0.10)';
  for (let k = 0; k < 3; k++) chevron(ctx, e.x + e.w * 0.5, e.y + e.h * 0.62 - k * 18, 16);
  blot(ctx, e.x + e.w * 0.5, e.y + e.h * 0.5, 60, '#5a8fae', 0.06);
  if (x) { ctx.fillStyle = 'rgba(57,198,255,0.12)'; ctx.fillRect(x.x + 4, x.y + 4, x.w - 8, x.h - 8);
  ctx.strokeStyle = 'rgba(57,198,255,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x.x + 4, x.y + 4, x.w - 8, x.h - 8); }
  ctx.restore();
}

// ---------------------------------------------------------------- dynamikk
export function createFx(L) {
  const rng = mulberry32(L.seed + 77);
  const motes = [];
  for (const l of L.lights) {
    const p = lampPos(L, l);
    for (let i = 0; i < 10; i++) motes.push({ cx: p.x, cy: p.y + (l.kind === 'wall' ? p.r * 0.35 : 0), r: p.r * 0.55, a: rng() * 6.28, d: rng(), s: rng.range(0.05, 0.25), z: rng() });
  }
  const steam = [];
  for (const o of L.objects) for (const v of [...(o._vents || []), ...(o._steam || [])]) steam.push({ x: v.x, y: v.y, t: rng() * 3, big: !!v.big, small: !!v.small });
  for (const v of L.steam || []) steam.push({ x: v[0] * L.tile, y: v[1] * L.tile, t: rng() * 3, big: true });
  const beacons = [];
  for (const o of L.objects) for (const b of o._beacons || []) beacons.push({ x: b.x, y: b.y, ph: rng() * 6.28, small: !!b.small });
  return { motes, steam, beacons, t: 0, flashes: [] };
}

export function updateFx(fx, dt) {
  fx.t += dt;
  for (const f of fx.flashes) f.t += dt;
  fx.flashes = fx.flashes.filter((f) => f.t < f.life);
  for (const m of fx.motes) { m.a += m.s * dt; m.d = (m.d + dt * 0.03) % 1; }
}

function flickerAt(t, k) {
  const n = Math.sin(t * 13.1 + k * 7) * Math.sin(t * 3.7 + k) + Math.sin(t * 29 + k * 3) * 0.3;
  const drop = hash2(Math.floor(t * 8), k, 3) < 0.07 ? 0 : 1;
  return Math.max(0, Math.min(1, 0.7 + n * 0.3)) * drop;
}

/** Animerte gulvdekaler (ekstraksjonsfyr, løpende chevroner, alarmpuls ved inngangen) – kalles fra arena.draw (bunnlaget). */
export function drawFloorDynamic(ctx, L, fx) {
  const t = fx.t;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // ekstraksjon: pulserende fyr + roterende sveip
  const x = L.exit;
  if (x) {
  const ex = x.x + x.w / 2, ey = x.y + x.h / 2;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  blot(ctx, ex, ey, 70 + pulse * 20, '#39c6ff', 0.10 + pulse * 0.08);
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(t * 1.6);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
  g.addColorStop(0, 'rgba(57,198,255,0.25)'); g.addColorStop(1, 'rgba(57,198,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 120, -0.25, 0.25); ctx.closePath(); ctx.fill();
  ctx.restore();
  // chevroner som "løper"
  for (let k = 0; k < 2; k++) {
    const a = Math.max(0, Math.sin(t * 4 - k * 1.2));
    ctx.fillStyle = `rgba(57,198,255,${0.35 * a})`;
    chevron(ctx, ex, x.y + x.h * 0.62 - k * 16, 14);
  }
  }
  // inngang: svak, kald puls (spillerens farge – ikke fiendens røde)
  const e = L.entry, ep = 0.5 + 0.5 * Math.sin(t * 1.4);
  blot(ctx, e.x + e.w / 2, e.y + e.h / 2, 90, '#39c6ff', 0.015 + ep * 0.025);
  ctx.restore();
}

/** Lys, glød, damp og blink over aktørene (drawTop). Ingen gulvdekaler her. */
let _steamDot = null;
function steamDot() {
  if (_steamDot) return _steamDot;
  const c = makeCanvas(32, 32), x = c.getContext('2d'); x.fillStyle = 'rgb(175,182,190)'; x.beginPath(); x.arc(16, 16, 15.5, 0, Math.PI * 2); x.fill();
  return (_steamDot = c);
}
export function drawDynamic(ctx, L, fx, view) {
  const t = fx.t;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // Ytelse (YTELSE.md tiltak 1): lys/beacons utenfor utsnittet tegnes ikke (radialgradient per lys var ~2 ms/bilde)
  const off = (x, y, r) => x + r < view.x0 || x - r > view.x1 || y + r < view.y0 || y - r > view.y1 + 40;
  const lOff = (l) => { const p = lampPos(L, l); return off(p.x, p.y, Math.max(p.r * 1.4, 70)); };
  // flimrende lamper: resten av intensiteten (25 %) varierer
  L.lights.forEach((l, k) => {
    if (lOff(l)) return;
    // lampFlicker (Effekter) kalles for alle lamper i synsfeltet (returnerer 1 straks for de uten flimmer). Bakte lamper kan ikke dimmes – faktoren virker på de dynamiske.
    let m = 1; if (fxFloor?.lampFlicker) { try { const v = fxFloor.lampFlicker(l, t); if (typeof v === 'number' && v >= 0 && v <= 1) m = v; } catch (e) { m = 1; } }
    if (!l.flicker) return;
    const f = flickerAt(t, k) * m;
    lightPoolFast(ctx, L, l, 0.25 * f + 0.0001);
    const p = lampPos(L, l), hy = l.kind === 'post' ? p.y - 19 : p.y - 1.5;
    blot(ctx, p.x, hy, 16, '#ffd59a', 0.5 * f);
  });
  // støvkorn i lyskjeglene
  ctx.fillStyle = 'rgb(255,214,160)';
  for (const m of fx.motes) {
    const rr = m.r * Math.sqrt(m.d);
    const px = m.cx + Math.cos(m.a) * rr, py = m.cy + Math.sin(m.a * 1.3) * rr * 0.8 - m.d * 20;
    if (px < view.x0 || px > view.x1 || py < view.y0 || py > view.y1) continue;
    const a = (1 - m.d) * Math.min(1, m.d * 6) * (0.25 + m.z * 0.35);
    ctx.globalAlpha = a; ctx.fillRect(px, py, 0.8 + m.z, 0.8 + m.z); // fast fillStyle + globalAlpha (ingen strengbygging per korn)
  }
  ctx.restore();
  // damp fra takvifter
  ctx.save();
  for (const s of fx.steam) {
    if (s.x < view.x0 - 80 || s.x > view.x1 + 80 || s.y < view.y0 - 80 || s.y > view.y1 + 120) continue;
    const n = s.big ? 6 : 4, sc = s.big ? 1.7 : s.small ? 0.7 : 1, sp = s.small ? 0.8 : 0.35;
    for (let k = 0; k < n; k++) {
      const ph = ((t * sp + s.t + k / n) % 1);
      const px = s.x + ph * 26 * sc + Math.sin(ph * 6 + k) * 3, py = s.y - ph * 22 * sc;
      const r = (3 + ph * 14) * sc;
      ctx.globalAlpha = (s.big ? 0.13 : 0.10) * (1 - ph) * Math.min(1, ph * 8);
      ctx.drawImage(steamDot(), px - r, py - r, r * 2, r * 2); // ferdig skive (sprite) i stedet for path + strengfarge
    }
  }
  ctx.restore();
  // røde varsellys (blinker) og fakkel
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of fx.beacons) {
    if (off(b.x, b.y, 30)) continue;
    const on = 0.5 + 0.5 * Math.sin(t * 2.6 + b.ph); const a = Math.pow(on, 3);
    blot(ctx, b.x, b.y, b.small ? 14 : 26, '#ff2a14', 0.18 + 0.35 * a);
    blot(ctx, b.x, b.y, 3, '#ffd0c0', 0.5 + 0.5 * a);
  }
  L.lights.forEach((l, k) => {
    if ((l.kind !== 'beacon' && l.kind !== 'flare') || lOff(l)) return;
    const p = lampPos(L, l);
    if (l.kind === 'beacon') {
      const a = Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 + k), 3);
      lightPoolFast(ctx, L, l, 0.08 + 0.3 * a);
      blot(ctx, p.x, p.y, 4, '#ffd0c0', 0.6 + 0.4 * a);
    } else {
      const f = 0.75 + 0.25 * flickerAt(t * 0.7, k);
      lightPoolFast(ctx, L, l, 0.22 * f);
      // flamme
      for (let i = 0; i < 9; i++) {
        const ph = (t * 1.8 + i / 9) % 1;
        const fx2 = p.x + Math.sin(t * 5 + i * 2.1) * 3 * ph + ph * 10, fy = p.y - ph * 34;
        const rr = (1 - ph) * 9 + 3;
        blot(ctx, fx2, fy, rr * 1.8, '#ff6a1a', 0.35 * (1 - ph));
        blot(ctx, fx2, fy, rr * 0.7, '#ffd27a', 0.45 * (1 - ph) * (1 - ph));
      }
      blot(ctx, p.x, p.y - 6, 60, '#ff7a2a', 0.18 * f);
    }
  });
  ctx.restore();
}

// ---------------------------------------------------------------- dynamisk lys fra skudd/eksplosjoner (A4)
// f: { x, y, r, life, t, col:[r,g,b], i, kind:'muzzle'|'explosion'|'spark' }
export function addFlash(fx, f) {
  if (fx.flashes.length > 64) fx.flashes.shift();
  fx.flashes.push({ t: 0, i: 1, ...f });
}

// Ytelse: gradientene ligger ferdig i små sprites per farge (128 px) og skaleres med drawImage + globalAlpha,
// i stedet for å lage og rastrere to radialgradienter per blink per bilde.
const flashSprites = new Map();
function flashSprite(col) {
  const key = col.join(','); let c = flashSprites.get(key); if (c) return c;
  const [r, g, b] = col, S = 128; c = makeCanvas(S, S); const x = c.getContext('2d');
  const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(0.25, `rgba(${r},${Math.round(g * 0.8)},${Math.round(b * 0.6)},0.3)`);
  gr.addColorStop(0.6, `rgba(${r},${Math.round(g * 0.6)},${Math.round(b * 0.4)},0.1)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, S, S);
  flashSprites.set(key, c); return c;
}
let coreSprite = null;
function flashCore() {
  if (coreSprite) return coreSprite;
  const S = 64; coreSprite = makeCanvas(S, S); const x = coreSprite.getContext('2d');
  const gc = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gc.addColorStop(0, 'rgba(255,248,230,0.85)'); gc.addColorStop(1, 'rgba(255,240,210,0)');
  x.fillStyle = gc; x.fillRect(0, 0, S, S); return coreSprite;
}
const MAX_FLASHES = 8;
const DRAWN = new Float32Array(32);
export function drawFlashes(ctx, fx, view) {
  if (!fx.flashes.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true;
  const core = flashCore();
  let n = 0, nd = 0;
  for (let i = fx.flashes.length - 1; i >= 0 && n < MAX_FLASHES; i--) { // nyeste først, maks 10 synlige
    const f = fx.flashes[i];
    if (f.x + f.r < view.x0 || f.x - f.r > view.x1 || f.y + f.r < view.y0 || f.y - f.r > view.y1) continue;
    // samme munning som skyter i serie: bare nyeste blink tegnes (fyllrate – additive sprites er dyre)
    if (f.kind !== 'explosion') {
      let dup = false;
      for (let j = 0; j < nd; j++) { const dx = DRAWN[j * 2] - f.x, dy = DRAWN[j * 2 + 1] - f.y; if (dx * dx + dy * dy < 400) { dup = true; break; } }
      if (dup) continue;
      if (nd < 16) { DRAWN[nd * 2] = f.x; DRAWN[nd * 2 + 1] = f.y; nd++; }
    }
    n++;
    const k = f.t / f.life;
    // muzzle: hard av, eksplosjon: rask opp, langsom hale
    const env = f.kind === 'explosion' ? (k < 0.08 ? k / 0.08 : Math.pow(1 - (k - 0.08) / 0.92, 1.6)) : Math.pow(1 - k, 2);
    const a = Math.min(1, env * f.i);
    if (a <= 0.004) continue;
    const R = f.r * (f.kind === 'explosion' ? 0.8 + 0.35 * Math.min(1, k * 3) : 1);
    ctx.globalAlpha = a; ctx.drawImage(flashSprite(f.col), f.x - R, f.y - R, R * 2, R * 2);
    if (env * f.i > 1 && f.kind === 'explosion') { ctx.globalAlpha = env * f.i - 1; ctx.drawImage(flashSprite(f.col), f.x - R, f.y - R, R * 2, R * 2); }
    const cr = f.kind === 'explosion' ? R * 0.22 : Math.max(5, R * 0.1);
    ctx.globalAlpha = a; ctx.drawImage(core, f.x - cr, f.y - cr, cr * 2, cr * 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Yard v2: vann, kaikant, plattform (gulvlaget, 27.10)
// Vann er 'water' i world.cover (stopper gange, ikke kuler). Tegnes flatt i gulvlaget: mørkt vann, lys kaikant mot land og
// en kort kaifront (betong ned i vannet) på nordsiden – den er under bakkeplanet og skjuler aldri en aktør.
// Vannflaten (før kantene). Krok: fxGround.drawWater(ctx, L, water, rng) → bool per vannrektangel; ved false: vår mørke havneflate.
function drawWaterBody(ctx, L, rng) {
  L._waterFx = new Set();
  for (const w of L.objects) {
    if (w.kind !== 'water') continue;
    let ok = false; try { ok = !!fxFloor?.drawWater?.(ctx, L, w, rng); } catch (e) { ok = false; }
    if (ok) { L._waterFx.add(w.id); continue; }
    const g = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
    g.addColorStop(0, '#27302d'); g.addColorStop(1, '#2c3834');           // fallback: mørk grågrønn havn, ~RGB 45–60 med glansen (tegnes etter lyskartet, ubelyst)
    ctx.fillStyle = g; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(150,175,165,0.16)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < (w.w * w.h) / 700; i++) { const x = w.x + rng() * w.w, y = w.y + 4 + rng() * (w.h - 8), l = 6 + rng() * 14; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y); ctx.stroke(); }
  }
}
function drawWaterSheen(ctx, L) {
  const drop = L.view === '34' ? Math.round(10 * PROJ.zScale) : 6;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(8,11,10,1)';
  for (const w of L.objects) if (w.kind === 'water' && !L._waterFx?.has(w.id)) ctx.fillRect(w.x, w.y + drop, w.w, w.h - drop);
  ctx.restore();
}
// Våre egne kanter (kaifront, kantlist) der Effekters drawEdge ikke tegnet. Ligger oppå de første ~10·zScale px av vannet.
function drawWater(ctx, L) {
  const ws = L.objects.filter((o) => o.kind === 'water'); if (!ws.length) return;
  const isW = (x, y) => ws.some((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h);
  const drop = L.view === '34' ? Math.round(10 * PROJ.zScale) : 6;
  for (const w of ws) {
    const T = L.tile;
    for (let x = w.x; x < w.x + w.w; x += T / 4) {          // nordkant: land over → kaifront + kantlist
      const cx = x + T / 8;
      if (!isW(cx, w.y - 2) && !edgeDone(L, 'quay', 's', cx, w.y)) {
        const g = ctx.createLinearGradient(0, w.y, 0, w.y + drop);
        g.addColorStop(0, '#2c3033'); g.addColorStop(1, '#14191c');
        ctx.fillStyle = g; ctx.fillRect(x, w.y, T / 4 + 0.5, drop);
        ctx.fillStyle = '#a9a796'; ctx.fillRect(x, w.y - 4, T / 4 + 0.5, 4);
      }
      if (!isW(cx, w.y + w.h + 2) && w.y + w.h < L.height && !edgeDone(L, 'water', 'n', cx, w.y + w.h)) { ctx.fillStyle = '#8f8d7f'; ctx.fillRect(x, w.y + w.h, T / 4 + 0.5, 3); }
    }
    for (let y = w.y; y < w.y + w.h; y += T / 4) {
      const cy = y + T / 8;
      if (w.x > 0 && !isW(w.x - 2, cy) && !edgeDone(L, 'water', 'e', w.x, cy)) { ctx.fillStyle = '#8f8d7f'; ctx.fillRect(w.x - 3, y, 3, T / 4 + 0.5); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(w.x, y, 4, T / 4 + 0.5); }
      if (w.x + w.w < L.width && !isW(w.x + w.w + 2, cy) && !edgeDone(L, 'water', 'w', w.x + w.w, cy)) { ctx.fillStyle = '#8f8d7f'; ctx.fillRect(w.x + w.w, y, 3, T / 4 + 0.5); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(w.x + w.w - 4, y, 4, T / 4 + 0.5); }
    }
  }
  // (gule pullerter fjernet 27.10 – lå oppå varselstripen)
}
// Plattform (bare visuell): hevet dekke med kant, rampe med riller og trapp. Ingen kollisjon (Breach 27.10).
function drawPlatform(ctx, L) {
  const p = L.zones?.platform, r = L.zones?.ramp; if (!p || !p.w) return;
  ctx.fillStyle = 'rgba(150,160,165,0.10)'; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let x = p.x + 16; x < p.x + p.w; x += 32) ctx.fillRect(x, p.y, 1, p.h);
  ctx.strokeStyle = 'rgba(210,190,90,0.55)'; ctx.lineWidth = 2;
  { const gx0 = p.x + p.w - 72, gx1 = gx0 + 64, x0 = p.x + 1, y0 = p.y + 1, x1 = p.x + p.w - 1, y1 = p.y + p.h - 1; // sørkanten brutt ved trappen
    ctx.beginPath(); ctx.moveTo(gx0, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(gx1, y1); ctx.stroke(); }
  const gx0 = p.x + p.w - 72, gx1 = gx0 + 64; // åpning ved trappen (Storys sør-ledge slutter ved x 36,75)
  if (!edgeDone(L, 'platform', 's', p.x + p.w / 2, p.y + p.h)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(p.x, p.y + p.h, gx0 - p.x, 5); ctx.fillRect(gx1, p.y + p.h, p.x + p.w - gx1, 5); }           // kantens skyggelinje (lav front)
  if (r && r.w) {
    ctx.fillStyle = 'rgba(120,125,128,0.35)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    for (let x = r.x + 4; x < r.x + r.w; x += 6) ctx.fillRect(x, r.y + 2, 2, r.h - 4);
    ctx.strokeStyle = 'rgba(210,190,90,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
  // trapp i sørøstre hjørne av plattformen
  const sx = p.x + p.w - 64, sy = p.y + p.h - 4;
  for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? 'rgba(90,95,98,0.7)' : 'rgba(130,135,138,0.7)'; ctx.fillRect(sx, sy + k * 3, 48, 3); }
}

// Kanter for Effekter-kroken fxGround.drawEdge(ctx, L, edge, rng) → bool. edge = { kind: 'quay'|'water'|'platform', x0, y0, x1, y1, side }
// i verdens-px; side = retningen fallet går mot ('n'|'s'|'w'|'e'). Kalles i gulvlaget før lyset. Svarer kroken true for en kant,
// hopper vår egen tegning over den kanten (L._edgeDone). Uten ground.js / ved false: alt som før.
function edgesOf(L) {
  const T = L.tile, ws = L.objects.filter((o) => o.kind === 'water'), out = [];
  const isW = (x, y) => ws.some((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h);
  const run = (kind, side, fixed, a0, a1, test) => { let st = null;
    for (let a = a0; a <= a1; a += T / 4) { const ok = a < a1 && test(a + T / 8);
      if (ok && st === null) st = a; if (!ok && st !== null) { out.push(side === 's' || side === 'n' ? { kind, side, x0: st, y0: fixed, x1: a, y1: fixed } : { kind, side, x0: fixed, y0: st, x1: fixed, y1: a }); st = null; } } };
  for (const w of ws) {
    run('quay', 's', w.y, w.x, w.x + w.w, (x) => !isW(x, w.y - 2));
    if (w.y + w.h < L.height) run('water', 'n', w.y + w.h, w.x, w.x + w.w, (x) => !isW(x, w.y + w.h + 2));
    if (w.x > 0) run('water', 'e', w.x, w.y, w.y + w.h, (y) => !isW(w.x - 2, y));
    if (w.x + w.w < L.width) run('water', 'w', w.x + w.w, w.y, w.y + w.h, (y) => !isW(w.x + w.w + 2, y));
  }
  const p = L.zones?.platform;
  if (p && p.w) { out.push({ kind: 'platform', side: 's', x0: p.x, y0: p.y + p.h, x1: p.x + p.w, y1: p.y + p.h }, { kind: 'platform', side: 'w', x0: p.x, y0: p.y, x1: p.x, y1: p.y + p.h }); }
  return out;
}
const edgeKey = (e) => `${e.kind}|${e.side}|${Math.round(e.x0)}|${Math.round(e.y0)}|${Math.round(e.x1)}|${Math.round(e.y1)}`;
function drawEdgesFx(ctx, L, rng) {
  L._edgeDone = new Set();
  if (!fxFloor?.drawEdge) return;
  for (const e of edgesOf(L)) { let ok = false; try { ok = !!fxFloor.drawEdge(ctx, L, e, rng); } catch (err) { ok = false; } if (ok) L._edgeDone.add(edgeKey(e)); }
}
// Ligger punktet på en kant Effekter har tegnet?
function edgeDone(L, kind, side, x, y) {
  if (!L._edgeDone || !L._edgeDone.size) return false;
  for (const e of edgesOf._c && edgesOf._L === L ? edgesOf._c : (edgesOf._L = L, edgesOf._c = edgesOf(L))) {
    if (e.kind !== kind || e.side !== side || !L._edgeDone.has(edgeKey(e))) continue;
    if (side === 's' || side === 'n') { if (Math.abs(y - e.y0) < 1 && x >= e.x0 && x <= e.x1) return true; }
    else if (Math.abs(x - e.x0) < 1 && y >= e.y0 && y <= e.y1) return true;
  }
  return false;
}
