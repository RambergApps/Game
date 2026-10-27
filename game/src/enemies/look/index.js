// BREACH – Cinderborn-utseende (Fiende-design eier src/enemies/look/). Registreres i Fiende-AIs register (art.js);
// importeres fra enemies/index.js (linje 20, eies av Fiende-AI).
// Leser KUN poseOf-feltene (P) og info fra drawWithArt. Endrer aldri fienden eller world.
// Trekvart (info.view === '34'): ferdigbakte sprites, ankret i fotpunktet. Ovenfra: return false → Fiende-AIs plassholder.
// Varsler (telegraf, landingsmarkører, spawnWarn) tegnes av Fiende-AI; blod/glør-partikler av VFX – ikke her.
//
// v2: baking og cache går gjennom Karakters felles shared/rig/faceted/bake.js (bakeSprite + sharedCache LRU).
// Modellene og malingen (husk.js, lurcher.js, facet.js, paint3d.js) er våre. Denne fila er den tynne adapteren:
//   • nøkkel `${sett}|${bøtte}|${bilde}`, bøtte = bucketOf(facing, 16), reserve-sprites (samme sett bilde 0 → idle 0)
//   • prioritert forvarming i ledige ruter (requestIdleCallback, én sprite per rute) – starter ved import (under intro)
//   • treff = kort varm-hvit tint (70 ms) + rykk bort fra treffretningen, under kjøring (ingen egne bilder)
import { registerEnemyArt } from '../art.js';
import { KINDS, WARM_ORDER } from './kinds.js';
const TYPES = Object.keys(KINDS);
import { MEM_TOTAL_MB } from './zoom.js';
const SHARE_SUM = () => Object.values(KINDS).reduce((a, k) => a + (k.memShare || 0), 0);   // memShare ≈ MiB per type ved zoom 2,25 (verste tilfelle / målt spill), sum 32
import { D, SS, bakeOne, bakeKey, clearModels, VIEWKEY } from './bakeone.js';
import { PROJ } from '../../shared/projection.js';
import { drawSprite, drawShadow, sharedCache, bucketOf } from '../../shared/rig/faceted/bake.js';

const TAU = Math.PI * 2;
const TINT_T = 0.07, JOLT_T = 0.14, DIE_T = 0.8;
const TINT = '255,238,214';            // varm hvit
export const lookStats = { draws: 0, drawMs: 0, fallbacks: 0, syncBakes: 0, syncMaxMs: 0, warmMs: 0, warmBakes: 0, warmDone: false, warmMaxMs: 0, worker: 'none', workerBakes: 0, workerMs: 0, workerMaxMs: 0, recvMaxMs: 0, firstReadyMs: 0 };

const caches = {};
function cacheFor(type) {
  let c = caches[type];
  if (!c) { const k = KINDS[type]; if (!k) return null; c = caches[type] = sharedCache(`cinder|${k.name}|base|D${D}|${VIEWKEY}`, { maxBytes: Math.round(MEM_TOTAL_MB * (k.memShare || 0) / SHARE_SUM() * 1048576), budgetMs: 3 }); c.kind = k; c.type = type; c.res = sharedCache(`cinder|${k.name}|reserve|D${D}|${VIEWKEY}`, { maxBytes: 3 << 20, budgetMs: 3 }); }
  return c;
}
export { bakeOne };
const keyOf = (set, dir, i) => `${set}|${dir}|${i}`;
// reserve (idle 0, alle retninger) ligger i en egen, liten cache som aldri presses ut av LRU-taket på hovedcachen
const RES = /^idle\|\d+\|0$/, at = (c, k) => (RES.test(k) ? c.res : c);
function sprite(c, set, dir, i) {
  const k = c.kind, key = keyOf(set, dir, i);
  { const C = at(c, key); if (C.has(key)) return C.get(key); }
  // ikke i cachen: be om den først i køen og bruk nærmeste ferdige bilde (aldri baking i spillbildet når det finnes reserve)
  want(c.type, set, dir, i);
  const N = k.buckets;
  for (const fk of [...(set.includes('#') ? [keyOf(set.split('#')[0], dir, i)] : []), keyOf(set, dir, 0), keyOf('idle', dir, 0), keyOf('idle', (dir + 1) % N, 0), keyOf('idle', (dir + N - 1) % N, 0), keyOf('idle', (dir + 2) % N, 0), keyOf('idle', (dir + N - 2) % N, 0)]) {
    if (at(c, fk).has(fk)) { lookStats.fallbacks++; return at(c, fk).peek(fk); }
  }
  // helt kald (ingen bilder av typen i nærheten ennå): bak én på hovedtråden
  const t0 = performance.now(); c.res.warm(keyOf('idle', dir, 0), () => bakeKey(c.type, 'idle', dir, 0)); const ms = performance.now() - t0;
  lookStats.syncBakes++; lookStats.syncMaxMs = Math.max(lookStats.syncMaxMs, ms);
  return c.res.peek(keyOf('idle', dir, 0));
}

const frac = (x) => x - Math.floor(x);
/** Velg sett/bilde fra P (faller trygt tilbake når felt mangler). */
export function pick(P, kind, time) {
  const r = pick0(P, kind, time);
  if (kind.sackVar && (r[0] === 'idle' || r[0] === 'walk') && Number.isFinite(P.sacksLeft) && P.sacksLeft < 3) r[0] = `${r[0]}#${Math.max(0, P.sacksLeft | 0)}`;
  return r;
}
function pick0(P, kind, time) {
  const S = kind.sets;
  if (P.dead) { const t = Math.min(1, (P.corpseT || 0) / DIE_T); return ['die', Math.min(S.die.n - 1, Math.floor(t * S.die.n))]; }
  if (kind.cover) return pickCover(P, kind, time);
  const anim = P.anim || (P.firing || P.telegraph || P.throw || P.melee ? 'attack' : P.moving ? 'walk' : 'idle');
  if (anim === 'attack') {
    const ph = Number.isFinite(P.attackPhase) && P.attackPhase > 0 ? P.attackPhase
      : P.telegraph ? 0.5 * (P.telegraph.progress || 0) : P.firing ? 0.65 : P.melee ? 0.6 : 0.3;
    return ['attack', Math.min(S.attack.n - 1, Math.floor(ph * S.attack.n))];
  }
  if (anim === 'walk' || anim === 'run' || (anim !== 'idle' && P.moving)) {
    // gangsyklus låst til tilbakelagt vei: walkPhase øker 0,08 rad per px → én syklus per ~39 px
    const ph = Number.isFinite(P.walkPhase) && P.walkPhase > 0 ? P.walkPhase / Math.PI : time * (P.speed || 100) / 39.3;
    return ['walk', Math.floor(frac(ph) * S.walk.n) % S.walk.n];
  }
  return ['idle', Math.floor(frac(time / 2.4 + (P.id || 0) * 0.37) * S.idle.n) % S.idle.n];
}

// Hunker: cover (0–1), peek (0–1, trinnvis 4 bilder), coverFacing; 'fire'/'attack' kun reist (peek 1) med attackPhase > 0;
// coverbytte = walk med cover > 0 → krumbøyd sprint; treff uten shieldHit = kjøttreaksjon (hit), med shieldHit = gnister.
function pickCover(P, kind, time) {
  const S = kind.sets, cov = +P.cover || 0, peek = Math.max(0, Math.min(1, +P.peek || 0)), anim = P.anim;
  const since = Number.isFinite(P.hitAt) ? (time - P.hitAt) : 1e9;
  const firing = (anim === 'fire' || anim === 'attack') && Number.isFinite(P.attackPhase) && P.attackPhase > 0;
  if (since >= 0 && since < 0.16 && !P.shieldHit && !(cov > 0.5 && peek < 1)) return ['hit', 0];
  if (anim === 'cover' || ((anim === 'fire' || anim === 'attack') && cov > 0.5) || (cov > 0.7 && !P.moving && anim !== 'walk')) {
    if (firing && peek >= 1) return ['attack', Math.min(S.attack.n - 1, Math.floor(P.attackPhase * S.attack.n))];
    return ['cover', peek >= 1 ? 3 : Math.floor(peek * 3)];
  }
  if (anim === 'fire' || anim === 'attack') return firing ? ['attack', Math.min(S.attack.n - 1, Math.floor(P.attackPhase * S.attack.n))] : ['cover', 3];
  if (anim === 'walk' || anim === 'run' || P.moving) {
    const ph = Number.isFinite(P.walkPhase) && P.walkPhase > 0 ? P.walkPhase / Math.PI : time * (P.speed || 100) / 39.3, set = cov >= 0.3 ? 'walkc' : 'walk';
    return [set, Math.floor(frac(ph) * S[set].n) % S[set].n];
  }
  return ['idle', 0];
}
// gnister på ryggskjoldet (shieldHit): 3 forhåndstegnede sprites, 120 ms, ingen blur
const SPARKS = []; const SPARK_T = 0.12;
function sparkSprite(k) {
  if (SPARKS[k]) return SPARKS[k];
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(28, 28) : Object.assign(document.createElement('canvas'), { width: 28, height: 28 }), g = c.getContext('2d');
  let s = 97 + k * 31; const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  g.lineCap = 'round';
  for (let j = 0; j < 7; j++) { const a = r() * TAU, l = 5 + r() * 8, x0 = 14 + Math.cos(a) * 1.5, y0 = 14 + Math.sin(a) * 1.5;
    g.strokeStyle = j % 3 ? 'rgba(224,194,52,0.95)' : 'rgba(255,250,220,1)'; g.lineWidth = j % 3 ? 1 : 1.4;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l * 0.8); g.stroke(); }
  g.fillStyle = 'rgba(255,252,230,0.95)'; g.fillRect(12.5, 12.5, 3, 3);
  return (SPARKS[k] = c);
}

let scratch = null;
function tintSprite(s) {   // varm-hvit silhuett av kroppen (gjenbrukt kladdelerret, kun i treffets 70 ms)
  const b = s.body, w = b.width, h = b.height;
  if (!scratch || scratch.width < w || scratch.height < h) { scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(w, 96), Math.max(h, 96)) : Object.assign(document.createElement('canvas'), { width: Math.max(w, 96), height: Math.max(h, 96) }); }
  const g = scratch.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h); g.drawImage(b, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${TINT})`; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  return scratch;
}

export function drawEnemy(ctx, P, info) {
  if (!info || info.view !== '34') return false;
  const c = cacheFor(P.type); if (!c) return false;
  const t0 = performance.now();
  startWarm();
  if (c.kind.lazyWarm && !warmed.has(P.type)) { warmType(P.type, push, false); pump(); }
  const kind = c.kind, world = info.world, time = world?.time ?? 0;
  const f0 = Number.isFinite(P.facing) ? P.facing : 0;
  const f = kind.cover && (+P.cover || 0) > 0.5 && Number.isFinite(P.coverFacing) && P.anim !== 'walk' ? P.coverFacing : f0;
  const dir = bucketOf(f, kind.buckets);
  const [set, i] = pick(P, kind, time);
  const sd = kind.sets[set]?.dirs, N = kind.buckets, st = sd && sd < N ? N / sd : 1;   // død/sekkvarianter: færre retninger (nærmeste)
  const s = sprite(c, set, st > 1 ? (Math.round(dir / st) * st) % N : dir, i); if (!s) return false;
  let x = P.x, y = P.y, alpha = 1, glowA;
  // treff: rykk bort fra treffretningen (fra spilleren, ellers bakover) + kort varm-hvit tint
  const since = Number.isFinite(P.hitAt) ? time - P.hitAt : (P.hurt > 0 ? (1 - P.hurt) * JOLT_T : 1e9);
  const jolt = since >= 0 && since < JOLT_T ? 1 - since / JOLT_T : 0;
  const shield = !!P.shieldHit && since >= 0 && since < SPARK_T;
  const tint = !P.shieldHit && since >= 0 && since < TINT_T ? 1 - 0.5 * since / TINT_T : 0;
  if (jolt > 0 && !P.shieldHit) {
    const pl = world?.player; let dx = -Math.cos(f), dy = -Math.sin(f);
    if (pl && Number.isFinite(pl.x)) { const ex = P.x - pl.x, ey = P.y - pl.y, l = Math.hypot(ex, ey); if (l > 1) { dx = ex / l; dy = ey / l; } }
    const k = 2.4 * jolt * jolt; x += dx * k; y += dy * k;
  }
  if (P.stagger) { const j = 1 - (P.stagger.progress || 0); x += Math.sin(time * 70) * 0.9 * j; }
  if (P.dead) { const ct = P.corpseT || 0; alpha = Math.max(0, Math.min(1, (10 - ct) / 2.5)); glowA = Math.max(0, 1 - ct / 1.4); }
  else { const pu = kind.pulse; glowA = pu.min + (1 - pu.min) * (0.5 + 0.5 * Math.sin(TAU * (time / pu.period + (P.id || 0) * 0.21))); }
  if (P.stagger) glowA *= 0.45;
  if (alpha <= 0) return true;
  if (P.rise && P.rise.progress < 1) {   // stiger opp av sprekken: klipp ved gulvet
    const p = Math.max(0, P.rise.progress); ctx.beginPath(); ctx.rect(x - s.ax - 4, y - s.ay - 8, s.w + 8, s.ay + 9.5); ctx.clip();
    y += (1 - p) * s.ay; glowA *= Math.max(0, (p - 0.6) / 0.4);
  }
  drawShadow(ctx, s, P.x, P.y, (kind.shadowA ?? 0.34) * alpha);
  drawSprite(ctx, s, x, y, { alpha, glowAlpha: Math.min(1, glowA + tint * 0.5) });
  if (tint > 0) { const T = tintSprite(s); ctx.globalAlpha = 0.85 * tint * alpha; ctx.drawImage(T, 0, 0, s.body.width, s.body.height, x - s.ax, y - s.ay, s.w, s.h); ctx.globalAlpha = 1; }
  if (shield) { const k = (((P.id || 0) + Math.floor(P.hitAt * 37)) % 3 + 3) % 3, sp = sparkSprite(k), cov = (+P.cover || 0) > 0.5 && (+P.peek || 0) < 1;
    const q = PROJ.toScreen(x - Math.cos(f) * 3, y - Math.sin(f) * 3, cov ? 18 : 27); ctx.globalAlpha = alpha * (1 - since / SPARK_T * 0.6); ctx.drawImage(sp, q.x - 9, q.y - 9, 18, 18); ctx.globalAlpha = 1; }
  lookStats.draws++; lookStats.drawMs += performance.now() - t0; (lookStats.byType ||= {})[P.type] = (lookStats.byType[P.type] || 0) + 1;
  return true;
}

// ---------------------------------------------------------------- forvarming: baker-worker (ImageBitmap), reserve på hovedtråden
// Rekkefølge: idle 0 i alle 16 retninger for begge typer (reserve) → gange → angrep → idle 1. Død bakes ved behov.
let warmStarted = false, worker = null, workers = [], rr = 0, inflight = 0, seq = 0, t0warm = 0;
const queue = [], pending = new Map(), queued = new Set();
const MAXF = 4, NW = 2;
const push = (type, set, d, i) => { const q = `${type}|${set}|${d}|${i}`; if (!queued.has(q)) { queued.add(q); queue.push([type, set, d, i]); } };
function buildQueue(all) {
  for (const type of TYPES) for (let d = 0; d < KINDS[type].buckets; d++) push(type, 'idle', d, 0);
  for (const type of TYPES) warmType(type, push, !all);
}
const warmed = new Set();
function warmType(type, push, boot) {   // lazyWarm-typer (ikke i bølgene ennå): kun reserve ved oppstart, resten når typen tegnes første gang
  { const k = KINDS[type]; if (warmed.has(type) || (boot && k.lazyWarm)) return; warmed.add(type);
    for (const [set, i] of [...WARM_ORDER, ...(k.warm || [])]) { if (!k.sets[set] || i >= k.sets[set].n) continue; for (let d = 0; d < k.buckets; d++) push(type, set, d, i); } }
}
function want(type, set, dir, i) {   // spillet trenger denne nå: flytt fremst
  const q = `${type}|${set}|${dir}|${i}`; if (pending.has(q)) return;
  const at = queue.findIndex((j) => j[0] === type && j[1] === set && j[2] === dir && j[3] === i);
  if (at > 0) queue.unshift(queue.splice(at, 1)[0]); else if (at < 0) { queued.add(q); queue.unshift([type, set, dir, i]); }
  if (!warmStarted) startWarm(); else pump();
}
function done() { if (!lookStats.warmDone && !queue.length && !inflight) { lookStats.warmDone = true; lookStats.warmWallMs = performance.now() - t0warm; clearModels(); } }
function pump() {
  if (!worker) return;
  while (inflight < MAXF && queue.length) {
    const [type, set, d, i] = queue.shift(), c = cacheFor(type), key = keyOf(set, d, i);
    if (at(c, key).has(key)) continue;
    const id = ++seq, q = `${type}|${set}|${d}|${i}`; pending.set(q, id); pending.set(id, [c, key, q]); inflight++;
    workers[rr++ % workers.length].postMessage({ id, type, set, dir: d, i });
  }
  done();
}
function onMsg(e) {
  const { id, spr, ms, err } = e.data, job = pending.get(id); if (!job) return;
  const [c, key, q] = job; pending.delete(id); pending.delete(q); inflight--;
  if (spr) { const t = performance.now(); at(c, key).warm(key, () => spr); const r = performance.now() - t;
    lookStats.workerBakes++; lookStats.workerMs += ms; lookStats.workerMaxMs = Math.max(lookStats.workerMaxMs, ms); lookStats.recvMaxMs = Math.max(lookStats.recvMaxMs, r);
    if (!lookStats.firstReadyMs && c.res.count() >= KINDS[c.type].buckets) lookStats.firstReadyMs = performance.now() - t0warm; }
  else if (err) { lookStats.workerErr = err; }
  pump();
}
// reserve uten worker: bak i ledige ruter på hovedtråden (som v1)
function warmOne() {
  while (queue.length) {
    const [type, set, d, i] = queue.shift(); const c = cacheFor(type), key = keyOf(set, d, i);
    if (at(c, key).has(key)) continue;
    const t0 = performance.now(); at(c, key).warm(key, () => bakeKey(type, set, d, i)); const ms = performance.now() - t0;
    lookStats.warmMs += ms; lookStats.warmBakes++; lookStats.warmMaxMs = Math.max(lookStats.warmMaxMs, ms);
    return true;
  }
  return false;
}
function schedule(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 1000 });
  else setTimeout(() => fn({ timeRemaining: () => 8, didTimeout: true }), 20);
}
function idleWarm() {
  const step = (dl) => {
    let more = true;
    if (dl && dl.didTimeout) more = warmOne();
    else { let n = 0; while (more && (!dl || dl.timeRemaining() >= 8) && n < 6) { more = warmOne(); n++; } }
    if (more) schedule(step); else { lookStats.warmDone = true; clearModels(); }
  };
  schedule(step);
}
// Reserve ved lasting (før spillet tegner): idle 0 i alle 16 retninger for begge typer bakes synkront på hovedtråden
// (32 sprites ≈ 0,2 s CPU, under lasteskjermen). Da finnes alltid en reserve, og spillbildet baker aldri selv.
function reserveNow() {
  // Hakk 27.10 (Arena): samme sprites i samme rekkefølge, men én per oppgave (MessageChannel), så lastingen ikke fryser.
  // Lasteskjermen (src/menu/loading.js) venter på lookStats.reserveDone. Mangler en reserve når noe tegnes, bakes den som før.
  const jobs = []; for (const type of TYPES) { const c = cacheFor(type); for (let d = 0; d < c.kind.buckets; d++) jobs.push([c, type, d]); }
  let ms = 0; lookStats.reserveDone = false; lookStats.reserveN = jobs.length; lookStats.reserveI = 0;
  const one = () => { const [c, type, d] = jobs[lookStats.reserveI++]; const t1 = performance.now(); c.res.warm(keyOf('idle', d, 0), () => bakeKey(type, 'idle', d, 0)); const t = performance.now() - t1; ms += t; lookStats.reserveMaxMs = Math.max(lookStats.reserveMaxMs || 0, t); };
  const finish = () => { lookStats.reserveMs = ms; lookStats.reserveDone = true; };
  if (typeof MessageChannel === 'undefined') { while (lookStats.reserveI < jobs.length) one(); return finish(); }
  const ch = new MessageChannel(); ch.port1.onmessage = () => { one(); if (lookStats.reserveI < jobs.length) ch.port2.postMessage(0); else { finish(); ch.port1.close(); } };
  ch.port2.postMessage(0);
}
function startWarm() {
  if (warmStarted || typeof setTimeout === 'undefined') return; warmStarted = true; t0warm = performance.now();
  buildQueue();
  if (!/monsterReserve=0/.test(globalThis.location?.search || '')) reserveNow();
  try {
    if (typeof Worker === 'function' && typeof OffscreenCanvas !== 'undefined' && !/monsterWorker=0/.test(globalThis.location?.search || '')) {
      for (let n = 0; n < NW; n++) { const w = new Worker(new URL('./worker.js' + (globalThis.location?.search || ''), import.meta.url), { type: 'module' }); w.onmessage = onMsg; w.onerror = onErr; workers.push(w); }
      worker = workers[0];
      function onErr(e) { for (const w of workers) w.terminate(); workers = []; lookStats.workerErr = String(e.message || 'worker error'); worker = null; lookStats.worker = 'failed'; for (const [k, v] of [...pending]) if (typeof k === 'number') queue.unshift([v[0].type, ...v[2].split('|').slice(1).map((x, j) => (j ? +x : x))]); pending.clear(); inflight = 0; idleWarm(); }
      lookStats.worker = 'on'; pump(); return;
    }
  } catch (e) { worker = null; }
  lookStats.worker = 'off'; idleWarm();
}

/** Diagnostikk/oppvarming (verktøy og tester). */
export function cacheInfo() {
  const out = {};
  let bytes = 0, bakes = 0, ms = 0, max = 0, count = 0;
  for (const [t, c] of Object.entries(caches)) { const s = c.stats, rb = c.res.bytes(); out[t] = { sprites: c.count() + c.res.count(), MB: +((c.bytes() + rb) / 1048576).toFixed(2), mainMB: +(c.bytes() / 1048576).toFixed(2), reserveMB: +(rb / 1048576).toFixed(2), bakes: s.bakes, bakeMs: +s.bakeMs.toFixed(1), maxBakeMs: +s.maxBakeMs.toFixed(2), deferred: s.deferred, evictions: s.evictions };
    bytes += c.bytes() + rb; bakes += s.bakes + c.res.stats.bakes; ms += s.bakeMs + c.res.stats.bakeMs; max = Math.max(max, s.maxBakeMs, c.res.stats.maxBakeMs); count += c.count() + c.res.count(); }
  const wm = lookStats.workerMs; out.total = { sprites: count, MB: +(bytes / 1048576).toFixed(2), bakes, bakeCpuS: +((ms + wm) / 1000).toFixed(2), mainBakeMs: +ms.toFixed(1), workerBakeMs: +wm.toFixed(1), maxMainBakeMs: +max.toFixed(2), maxWorkerBakeMs: +lookStats.workerMaxMs.toFixed(2), D, SS };
  out.warm = { ...lookStats };
  return out;
}
/** Bak hele forvarmingskøen synkront (verktøy). */
export function warmAll() { if (!warmStarted) { warmStarted = true; buildQueue(true); } else for (const t of TYPES) warmType(t, push, false); const t0 = performance.now(); while (warmOne()); lookStats.warmDone = true; return performance.now() - t0; }
export { KINDS, caches };

if (typeof requestIdleCallback === 'function' || typeof setTimeout === 'function') { try { startWarm(); } catch (e) { /* aldri stopp spillet */ } }
const unreg = TYPES.map((t) => registerEnemyArt(t, null, drawEnemy));
export function unregister() { for (const u of unreg) u(); }
if (typeof globalThis !== 'undefined') globalThis.__cinderLook = { lookStats, cacheInfo, warmAll, unregister, bakeOne };
