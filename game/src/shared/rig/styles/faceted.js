// Tegnestil «faceted» (Warden v4, trekvart) – eies av Breach Warden-design og animasjon. 2026-10-23.
//
// Hybrid: kantet 3D-delmodell (faceted/warden.js) → malt per fasett (faceted/paint.js) → bakt til sprites per
// vinkelbøtte og positur-nøkkel (faceted/bake.js, LRU-cache delt mellom aktører med samme def+skin+oppløsning).
// Kjøretid per figur: 2 skygger + 2 kropper + 2 glødlag (drawImage) + skjerfhaler (2 strek). Ingen gradient/blur.
//
// Lag: BEIN (hoftevinkel, gangfase, bevegelsesretning relativt til hofta, kne/slide) og OVERKROPP (torsovinkel,
// våpenpositur bx/by/a/f, kne/slide-pitch). Overkroppen ankres i bakkepunktet under bekkenet (K.ox, K.oy), så
// lean/lunge/rekyl er forskyvninger, ikke nye sprites. Rull og død bruker HELKROPP-sprites (alt i én modell).
// Kontrakt: style = { name, drawFigure(ctx, rig, F, opts), sortKey(F) }. Ingen endring i rig.js / sockets / player.
import { PROJ } from '../../projection.js';
import { legPoses } from '../gait.js';
import { model, buildLegs, buildUpper, buildMoving, layDown, tumble, torsoFrame, weaponFrame, WARDEN_MATS, PAINT_OPTS, DIM } from '../faceted/warden.js';
import { weaponLook, weaponMats, lookKey, weaponAnim, MOVING, attachWeaponEvents } from '../faceted/weapons/index.js';
import { paintModel, paintShadow, bounds, L2 } from '../faceted/paint.js';
import { bakeSprite, drawSprite, drawShadow, sharedCache, cacheReport, bucketOf, yawOf, q01, deferBake } from '../faceted/bake.js';

const Z = PROJ.zScale, TAU = Math.PI * 2;
const hasDOM = typeof document !== 'undefined';
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const qn = (v, step) => Math.round(v / step) * step;
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

// ---------------------------------------------------------------- innstillinger (kan overstyres per def: def.faceted = {...})
export const CFG = {
  buckets: 32,               // vinkelbøtter (Warden 32 = 11,25°; monstre 16)
  phases: 8,                 // gangfaser per syklus (2 steg) – v4.3 (A3): 12 → 8 for å holde cachen < 20 MB
  legBuckets: 16,            // v4.3: vinkelbøtter for beina (overkroppen beholder 32 for fritt sikte)
  moveDirs: 8,               // bevegelsesretning relativt til hofta
  maxBytes: 18 * 1024 * 1024,// LRU-tak per cache (def+skin+oppløsning) – v4.3: 32 → 18 MB (A3)
  budgetMs: 3,               // bake-budsjett per bilde (alle faceted-cacher til sammen)
  SS: 2,                     // overskalering ved maling
  downQ: 'medium',
  worker: true,              // v4.3 (A3): bak i egen tråd (bakeworker.js) når en reserve kan vises; faller tilbake til vanlig bake
  workerMax: 3,              // maks samtidige bestillinger           // v4.3: nedskalering etter maling ('high' kostet ~45 % av bakingen)
  contour: { px: 1.15, a: .95, color: '10,12,15' },
  rim: { px: 1.0, a: .7, color: '150,196,240' },   // Wardens kalde kantlys (WARDEN-DESIGN §4.2); v4.2: kald blå i stedet for nesten hvit, så platene leses kobolt i 1×
  shadowA: .3,
  ring: false,               // subtil cyan bakkering (av/på)
  ringColor: '57,198,255',
};
export const STATS = { figures: 0, ms: 0 };
const legBucketsOf = (N) => Math.min(N, CFG.legBuckets || N);
const cacheId = (def, skin, D) => `faceted|${def.id || 'warden'}|${skin || 'warden'}|D${D}`;

/** Bake-oppløsning (piksler per verdens-px) ut fra skjermskalaen – sprites skal aldri forstørres. */
function resFor(px) { return px <= 1.05 ? 1.25 : px <= 1.6 ? 1.75 : px <= 2.2 ? 2.25 : px <= 3.2 ? 3.25 : 4.25; }

const MATS = new Map();
function matsFor(W) { const k = W.key; let m = MATS.get(k); if (!m) { const wm = weaponMats(W.look, W.skin, W.wear); m = { ...WARDEN_MATS, ...wm }; MATS.set(k, m); } return m; }
// v4.3 (A3): bakearbeider. remote() → true (bestilt/underveis), 'full' (kø full, prøv igjen) eller false (ingen arbeider).
const BW = { w: null, ok: true, pend: new Map(), id: 0, byKey: new Set() };
function bw() {
  if (!CFG.worker || !BW.ok || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  if (!BW.w) { try { BW.w = new Worker(new URL('../faceted/bakeworker.js', import.meta.url), { type: 'module' });
      BW.w.onmessage = (e) => { const { id, spr, err, ms } = e.data; const p = BW.pend.get(id); BW.pend.delete(id); if (!p) return; BW.byKey.delete(p.id);
        if (err) { BW.ok = false; BW.err = err; return; } p.cache.set(p.key, spr, ms); };
      BW.w.onerror = (e) => { BW.ok = false; BW.err = String(e.message || e); e.preventDefault?.(); }; } catch (e) { BW.ok = false; return null; } }
  return BW.w;
}
// modellen har hjelpefunksjoner (transformer) som ikke kan sendes; kopier bare data
function plain(v, memo = new Map()) {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (memo.has(v)) return memo.get(v);
  if (ArrayBuffer.isView(v)) return v;
  const o = Array.isArray(v) ? new Array(v.length) : {}; memo.set(v, o);
  if (Array.isArray(v)) for (let i = 0; i < v.length; i++) o[i] = plain(v[i], memo);
  else for (const k in v) { const x = v[k]; if (typeof x !== 'function') o[k] = plain(x, memo); }
  return o;
}
function remote(cache, key, buildFn, D, W) {
  const w = bw(); if (!w) return false; const pid = cache.stats.name + '|' + key;
  if (BW.byKey.has(pid)) return true; if (BW.pend.size >= CFG.workerMax) return 'full';
  const id = ++BW.id; try { w.postMessage({ id, M: plain(modelOf(buildFn)), mats: matsFor(W), D, cfg: { SS: CFG.SS, downQ: CFG.downQ, contour: CFG.contour, rim: CFG.rim }, popts: PAINT_OPTS }); }
  catch (e) { BW.ok = false; BW.err = String(e.message || e); return false; }
  BW.pend.set(id, { cache, key, id: pid }); BW.byKey.add(pid); return true;
}
export const workerState = () => ({ on: !!BW.w && BW.ok, pending: BW.pend.size, err: BW.err || null });
const modelOf = (fn) => { let M = fn(); while (typeof M === 'function') M = M(); return M; };   // byggere kan returnere en thunk
function bake(buildFn, D, W) {
  const M = modelOf(buildFn); const mats = matsFor(W);
  const b = bounds(M, false), sb = bounds(M, true);
  return bakeSprite({ bbox: b, shadowBox: sb, D, SS: CFG.SS, downQ: CFG.downQ, glow: true, contour: CFG.contour, rim: CFG.rim,
    paint: (bc, gc, o) => paintModel(bc, gc, M, mats, { ...PAINT_OPTS, px: o.px }),
    shadow: (sc) => paintShadow(sc, M) });
}

// ---------------------------------------------------------------- nøkler (kvantisering av F)
function keys(F, N, W) {
  const P = F.posture || {}, K = F.skel, S = F.S || {};
  const death = F.mode === 'death', roll = F.clip?.roll;
  if (death || (roll && (P.roll || 0) > .2)) {
    const dir = bucketOf(death ? F.hipAngle : (F.torsoAngle ?? F.hipAngle), N);
    if (death) { const k = F.clip?.death ? F.clip.death.fall : 1; return { whole: `D|${W.key}|${dir}|${q01(k, 9)}`, dir, death: q01(k, 9) }; }
    const u = rollU(roll); return { whole: `R|${W.key}|${dir}|${q01(u, 13)}`, dir, roll: q01(u, 13) };
  }
  const kn = q01(P.kneel, 5), sl = q01(P.slide, 3);
  // overkropp: torso-bøtte + våpenpositur (uten rekyl) + kne/slide
  const tdir = bucketOf(K.ta, N); const p = K.pose; const rec = 0;   // v4.3: rekyl bare som forskyvning ved tegning, ikke i nøkkelen
  const pose = { bx: qn(p.bx + rec, 1.5), by: qn(p.by, 1.5), a: qn(p.a, .12), f: qn(p.f, .1) };
  const pk = `${tdir}|${pose.bx}|${pose.by}|${pose.a.toFixed(2)}|${pose.f.toFixed(1)}|${kn}|${sl}`;
  const up = `U|${W.key}|${pk}`;   // (stil, def/skin = cache-id) + våpen-id/skin/slitasje + vinkelbøtte + positur – aldri animasjonsfase
  // bein: hofte-bøtte + fase + retning relativt til hofta + amplitude/løp
  const LB = legBucketsOf(N); const hdir = bucketOf(F.hipAngle, LB); const amp = (F.amp || 0) > .2 ? 1 : 0;   // v4.3: én amplitude
  let lk, gait = null;
  if (amp > 0 && kn < .5 && sl < .5) {
    const ph = Math.round((F.phase || 0) * CFG.phases) % CFG.phases;
    const rel = bucketOf(wrap(F.moveAngle - yawOf(hdir, LB)), CFG.moveDirs);
    const run = (P.sprint || 0) > .5 ? 1 : 0; const stride = run ? 30 : 26;   // v4.3: fast skrittlengde per gangart
    gait = { ph, rel, run, stride, amp }; lk = `L|${hdir}|${ph}|${rel}|${run}|${stride}|${amp}|${kn}|${sl}`;
  } else lk = `L|${hdir}|idle|${kn}|${sl}`;
  return { up, pk, legs: lk, tdir, hdir, pose, kn, sl, gait };
}
function rollU(r) { if (!r) return 0; const k = r.k || 0; return r.phase === 'dive' ? .18 * k : r.phase === 'over' ? .18 + .48 * k : r.phase === 'land' ? .66 + .18 * k : .84 + .16 * k; }
const hipZOf = (kn, sl) => lerp(lerp(DIM.hipZ, DIM.hipZKneel, kn), 11, sl);

function legsModel(F, k, N) {
  const def = F.def; const g = k.gait;
  const fakeS = { hip: 0, mvx: g ? Math.cos(yawOf(g.rel, CFG.moveDirs)) : 1, mvy: g ? Math.sin(yawOf(g.rel, CFG.moveDirs)) : 0,
    stride: g ? g.stride : 26, amp: g ? g.amp : 0, phase: g ? g.ph / CFG.phases : 0, sprint: g ? g.run : 0, shuffle: 0, kneel: k.kn, slideB: k.sl, rollB: 0 };
  const feet = legPoses(fakeS, def, null);
  return () => buildLegs(model(), yawOf(k.hdir, legBucketsOf(N)), { feet, kneel: k.kn, slide: k.sl, hipZ: hipZOf(k.kn, k.sl) });
}
const upperQ = (k, W, D) => ({ pose: k.pose, kneel: k.kn, slide: k.sl, pitch: .14 * k.kn - .32 * k.sl, hipZ: hipZOf(k.kn, k.sl), helmFwd: k.kn * 2, look: W.look, D });
function upperModel(F, k, N, W, D) { return () => buildUpper(model(), yawOf(k.tdir, N), upperQ(k, W, D)); }
function movingModel(k, N, W, D, g) { return () => buildMoving(model(), yawOf(k.tdir, N), upperQ(k, W, D), g); }
const hasGroup = (look, g, D) => look.moving?.[g] && look.parts.some(p => p.move === g && (p.minScale || 0) <= D + 1e-6);
function wholeModel(F, k, N, W, D) {
  const def = F.def, yaw = yawOf(k.dir, N);
  if (k.death != null) return () => {
    const feet = legPoses({ hip: 0, mvx: 1, mvy: 0, stride: 26, amp: 0, phase: 0, sprint: 0, shuffle: 0, kneel: 0, slideB: 0, rollB: 0 }, def, null);
    const M = buildLegs(model(), yaw, { feet, kneel: 0, hipZ: DIM.hipZ });
    buildUpper(M, yaw, { pose: def.weapon.poses.down, hipZ: DIM.hipZ, pitch: -.1 * k.death, look: W.look, D, allParts: true });
    return layDown(M, yaw, k.death);
  };
  // rull: sammenkrøpet (rullebein + torso bøyd fram), kollbøtte om sideaksen
  const u = k.roll; const tuck = u < .12 ? u / .12 : u < .84 ? 1 : 1 - (u - .84) / .16;
  const theta = u < .18 ? .7 * (u / .18) : u < .66 ? .7 + (TAU - .7) * ((u - .18) / .48) : 0;
  return () => {
    const feet = legPoses({ hip: 0, mvx: 1, mvy: 0, stride: 26, amp: 0, phase: 0, sprint: 0, shuffle: 0, kneel: u > .66 ? 1 - tuck : 0, slideB: 0, rollB: tuck }, def, { feetPlanted: u > .66 ? 1 : 0 });
    const hz = lerp(DIM.hipZ, 10, tuck);
    const M = buildLegs(model(), yaw, { feet, kneel: u > .66 ? .6 * tuck : 0, roll: tuck, hipZ: hz });
    buildUpper(M, yaw, { pose: def.weapon.poses.roll, hipZ: hz, pitch: .95 * tuck, kneel: .5 * tuck, helmPitch: .2 * tuck, look: W.look, D, allParts: true });
    return u > .02 && u < .66 ? tumble(M, yaw, theta, 9) : M;
  };
}

// ---------------------------------------------------------------- tegning
function drawScarf(ctx, F) {
  // skjerfhaler: to korte, avsmalnende stoffbånd fra kragen (levende, fra riggens tøykjeder) – fylt, ikke strek
  if (!F.scarf || !F.skel) return;
  const K = F.skel, c = Math.cos(K.ta), s = Math.sin(K.ta); const pz = hipZOf(q01(F.posture?.kneel, 5), 0);
  for (let ci = 0; ci < F.scarf.length; ci++) {
    const ch = F.scarf[ci].slice(0, 4); const a0 = ch[0]; const n = ch.length;
    const P = ch.map(([x, y], i) => { const lx = -4.4 + (x - a0[0]) * .5, ly = (ci ? 2.2 : -1.6) + (y - a0[1]) * .5;
      return [K.ox + K.s * (c * lx - s * ly), K.oy + K.s * (s * lx + c * ly) - (pz + 16.4 - i * 2.6 - ci * .5) * Z]; });
    const L = [], R = [];
    for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1;
      const w = (ci ? 1.5 : 1.9) * (1 - i / n * .55); L.push([P[i][0] - dy / l * w, P[i][1] + dx / l * w]); R.push([P[i][0] + dy / l * w, P[i][1] - dx / l * w]); }
    const Q = L.concat(R.reverse());
    ctx.beginPath(); ctx.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < Q.length; i++) ctx.lineTo(Q[i][0], Q[i][1]); ctx.closePath();
    ctx.fillStyle = ci ? '#34424f' : '#4a5c6f'; ctx.fill(); ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(8,11,15,.85)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]); ctx.lineWidth = .5; ctx.strokeStyle = 'rgba(140,165,190,.8)'; ctx.stroke();
  }
}
function drawRing(ctx, F) {
  ctx.save(); ctx.strokeStyle = `rgba(${CFG.ringColor},.28)`; ctx.lineWidth = .9; ctx.beginPath();
  const n = 20, rx = 17, ry = 17; for (let i = 0; i <= n; i++) { const a = i / n * TAU; const x = F.x + Math.cos(a) * rx, y = F.y + 1 + Math.sin(a) * ry; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.restore();
}

/** Våpenvalg for en rigg: opts.weapon → rig.__wpn.look (fra våpenhendelser) → rig.weaponLook → def.faceted.weapon → 'rifle'. */
function weaponOf(rig, F, opts) {
  const id = opts.weapon ?? rig?.__wpn?.look ?? rig?.weaponLook ?? F.def?.faceted?.weapon ?? 'rifle';
  const look = weaponLook(id); const skin = opts.weaponSkin ?? rig?.weaponSkin ?? 'default'; const wear = opts.weaponWear ?? rig?.weaponWear;
  return { look, skin, wear, key: lookKey(look, skin, wear) };
}
/** Overkroppens kjøretidsforskyvning (lean/lunge i K.ox/oy, gangbob og høydefjær) – ikke nye sprites. */
function upperOffset(F, kn) {
  const K = F.skel; const bob = .9 * (F.amp || 0) * (.5 - .5 * Math.cos((F.phase || 0) * 2 * TAU));
  return { x: K.ox, y: K.oy, dz: ((F.height ?? 1) - 1) * 6 * (1 - kn) - bob };
}

/** Granatkast (Breach Karakter): våpenet senkes og svinges inn mot kroppen så kastarmen er fri. Kvantiseres som andre poser. */
export const THROW_POSE = { bx: 3, by: 7.5, a: -1.2, f: .7 };

/** v4.3: reserve for bein som ikke er bakt ennå – nærmeste gangfase først (ikke stillestående), så forrige sprite. */
function legFallback(k, prev) {
  const g = k.gait; const out = [];
  if (g) { const P = CFG.phases; for (const d of [1, -1, 2, -2]) out.push(`L|${k.hdir}|${(g.ph + d + P) % P}|${g.rel}|${g.run}|${g.stride}|${g.amp}|${k.kn}|${k.sl}`); }
  if (prev) out.push(prev); return out.length ? out : null;
}
export function renderFigure(ctx, rig, F, opts = {}) {
  const t0 = performance.now();
  if (opts.pose && F.skel && F.mode !== 'death') F = { ...F, skel: { ...F.skel, pose: opts.pose } };   // positur-overstyring (granatkast)
  const m = ctx.getTransform(); const px = Math.hypot(m.a, m.b) || 1; const D = resFor(px);
  const def = F.def || rig?.def || {}; const fc = def.faceted || {}; const N = fc.buckets || CFG.buckets;
  const cache = sharedCache(cacheId(def, F.skin, D), { maxBytes: fc.maxBytes || CFG.maxBytes, budgetMs: CFG.budgetMs, defer: 'always' });
  const st = (rig && (rig.__fac || (rig.__fac = {}))) || {};
  if (st.D && st.D !== D) st.prevD = st.D; st.D = D;
  // v4.3 (A3): ny oppløsning (zoom-bytte) → tegn samme nøkkel fra forrige oppløsning skalert og bak den nye i ledig tid (ingen hikk)
  const prevC = st.prevD && st.prevD !== D ? sharedCache(cacheId(def, F.skin, st.prevD), { maxBytes: fc.maxBytes || CFG.maxBytes, budgetMs: CFG.budgetMs, defer: 'always' }) : null;
  // grab(nøkkel, bygg modell, reserver): treff → sprite; ellers vis reserve (forrige oppløsning / nabofase / forrige) og bak i arbeideren.
  const grab = (key, build, fb) => {
    if (cache.has(key)) return cache.get(key);
    let alt = prevC ? prevC.peek(key) : null, last = false;
    if (!alt && fb) for (let i = 0; i < fb.length; i++) { alt = cache.peek(fb[i]); if (alt) { last = i === fb.length - 1; break; } }
    if (alt) { const r = remote(cache, key, build, D, W);
      if (r) { const s = cache.stats; s.deferred++; if (last) { s.deferredLast++; if (key[0] === 'L') s.frozenLegs = (s.frozenLegs || 0) + 1; } return alt; }
      if (prevC && prevC.peek(key) === alt) { deferBake(cache, key, () => bake(build, D, W)); return alt; } }
    return cache.get(key, () => bake(build, D, W), fb);
  };
  const a = F.alpha ?? opts.alpha ?? 1;
  const dc = F.mode === 'death' ? (F.clip?.death ? Math.max(F.clip.death.fall, 1 - F.clip.death.visor) : 1) : 0; const GK = 1 - .6 * dc;   // død: cyan → 40 %, aldri 0
  const shA = (opts.shadowAlpha ?? CFG.shadowA) * a;
  const W = weaponOf(rig, F, opts);
  const k = keys(F, N, W);
  const ring = opts.ring ?? fc.ring ?? CFG.ring;
  if (opts.entity && rig) opts.entity.muzzle = muzzleOf(rig, W.look.id);
  if (k.whole) {
    const spr = grab(k.whole, () => wholeModel(F, k, N, W, D), st.whole ? [st.whole] : null); st.whole = k.whole;
    if (opts.shadow !== false) drawShadow(ctx, spr, F.x, F.y, shA);
    if (ring) drawRing(ctx, F);
    if (typeof opts.under === 'function') opts.under(ctx); else if (typeof F.under === 'function') F.under(ctx);
    drawSprite(ctx, spr, F.x, F.y, { alpha: a, glowAlpha: GK });
    flash(ctx, spr, F.x, F.y, 0, F.flash);
  } else {
    const K = F.skel;
    const legs = grab(k.legs, () => legsModel(F, k, N), legFallback(k, st.legs)); st.legs = k.legs;
    const up = grab(k.up, () => upperModel(F, k, N, W, D), st.up ? [st.up] : null); st.up = k.up;
    // bevegelige våpendeler: egne små sprites med samme nøkkel som overkroppen (+ delnavn), forskjøvet ved kjøring
    const anim = rig ? weaponAnim(rig, W.look) : null; const movs = [];
    for (const g of MOVING) { if (!hasGroup(W.look, g, D)) continue;
      const mk = `M|${g}|${W.key}|${k.pk}`; const spr = grab(mk, () => movingModel(k, N, W, D, g), st[g] ? [st[g]] : null); st[g] = mk;
      const amt = anim ? anim[g] : 0; let dx = 0, dy = 0;
      if (amt) { const mv = W.look.moving[g], ax = mv.axis; const WT = weaponFrame(torsoFrame(yawOf(k.tdir, N), upperQ(k, W, D)), k.pose, k.kn, W.look);
        const v = WT.dir(ax.x || 0, ax.y || 0, ax.z || 0); const t = (mv.travel || 0) * amt; dx = v[0] * t; dy = (v[1] - v[2] * Z) * t; }
      movs.push({ spr, dx, dy, alpha: g === 'mag' && anim ? anim.magA : 1 }); }
    const rec = (F.S?.recoil || 0) * 3.2 * K.s; const ux = Math.cos(K.ra ?? K.ta), uy = Math.sin(K.ra ?? K.ta);
    const O = upperOffset(F, k.kn); const ux0 = O.x - ux * rec, uy0 = O.y - uy * rec, dyU = -O.dz * Z;
    if (opts.shadow !== false) { drawShadow(ctx, legs, F.x, F.y, shA); drawShadow(ctx, up, ux0, uy0, shA); }
    if (ring) drawRing(ctx, F);
    if (typeof opts.under === 'function') opts.under(ctx); else if (typeof F.under === 'function') F.under(ctx);
    const facingCam = Math.sin(K.ta) > -.2;          // ryggen bort fra kamera → skjerfhalene bak overkroppen
    const gunFront = Math.sin(K.ra ?? K.ta) > -.1;   // våpenet på kamerasiden → bevegelige deler over overkroppen
    const drawMov = () => { for (const q of movs) if (q.alpha > .02) drawSprite(ctx, q.spr, ux0 + q.dx, uy0 + q.dy, { alpha: a * q.alpha, glowAlpha: GK, dy: dyU }); };
    drawSprite(ctx, legs, F.x, F.y, { alpha: a, glowAlpha: GK });
    if (facingCam) drawScarf(ctx, F);
    if (!gunFront) drawMov();
    drawSprite(ctx, up, ux0, uy0, { alpha: a, glowAlpha: GK, dy: dyU, scale: 1 });
    if (gunFront) drawMov();
    if (!facingCam) drawScarf(ctx, F);
    if (F.flash > 0) { flash(ctx, legs, F.x, F.y, 0, F.flash); flash(ctx, up, ux0, uy0, dyU, F.flash); }
  }
  STATS.figures++; STATS.ms += performance.now() - t0;
}

/**
 * Munningen i verdenskoordinater {x, y, z}, utledet KUN fra våpen-defen (points.muzzle) og samme rammer som bakingen
 * (torsoFrame → weaponFrame), med kontinuerlig torsovinkel og positur (ikke kvantisert). Til entity.muzzle hver frame.
 */
export function muzzleOf(rig, weaponId) {
  const F = rig.frame(), K = F.skel; const look = weaponLook(weaponId ?? rig.__wpn?.look ?? rig.weaponLook ?? 'rifle');
  const kn = F.posture?.kneel || 0, sl = F.posture?.slide || 0;
  const TT = torsoFrame(K.ta, { hipZ: hipZOf(kn, sl), pitch: .14 * kn - .32 * sl });
  const p = weaponFrame(TT, K.pose, kn, look)(...['x', 'y', 'z'].map(c => look.points.muzzle[c] || 0));
  const O = upperOffset(F, kn);
  return { x: O.x + p[0], y: O.y + p[1], z: p[2] + O.dz };
}
/**
 * Forvarming (Breach Karakter): liste med { key, run } som baker sprites spilleren trenger først, i prioritert rekkefølge:
 * overkropp stå/sikte i alle N torsobøtter (nærmeste bøtte først) → bein i ro → gange fram (alle faser) → bevegelige deler.
 * Nøklene lages med samme keys() som tegningen (syntetisk F), så de treffer nøyaktig. D = siste tegneoppløsning for riggen.
 */
export function warmJobs(rig, opts = {}) {
  const F0 = rig.frame(); const def = F0.def || rig.def; const fc = def.faceted || {}; const N = fc.buckets || CFG.buckets;
  const D = opts.D ?? rig.__fac?.D ?? resFor(opts.px ?? 1.5);
  const cache = sharedCache(cacheId(def, F0.skin, D), { maxBytes: fc.maxBytes || CFG.maxBytes, budgetMs: CFG.budgetMs, defer: 'always' });
  const W = weaponOf(rig, F0, {}); const PO = def.weapon.poses; const K0 = F0.skel;
  const stride = opts.stride ?? (rig.S?.stride || 26);
  const synth = (ta, pose, hip, g, kn = 0) => ({ def, skin: F0.skin, mode: 'idle', posture: { kneel: kn, slide: 0, sprint: g?.run || 0 }, clip: {},
    skel: { ...K0, ta, pose: { ...pose } }, S: { recoil: 0, stride: g?.stride ?? stride }, hipAngle: hip, amp: g ? g.amp : 0, phase: g ? g.ph : 0, moveAngle: hip + (g?.back ? Math.PI : 0), torsoAngle: ta });
  const start = bucketOf(K0.ta, N), order = []; for (let i = 0; i < N; i++) order.push((start + (i % 2 ? (i + 1) / 2 : -i / 2) + N * 4) % N);
  const jobs = []; const seen = new Set();
  const push = (key, build) => { if (seen.has(key) || cache.has(key)) return; seen.add(key);   // v4.3: bakes i arbeideren når den finnes
    jobs.push({ key, run: () => { if (cache.has(key)) return; const r = remote(cache, key, build, D, W); if (r === 'full') return 'retry'; if (!r) cache.warm(key, () => bake(build, D, W)); } }); };
  const poses = [PO.ready, PO.aim].filter(Boolean);
  for (const b of order) for (const pose of poses) { const F = synth(yawOf(b, N), pose, yawOf(b, N)); const k = keys(F, N, W); push(k.up, () => upperModel(F, k, N, W, D)); }
  for (const b of order) { const F = synth(yawOf(b, N), PO.ready, yawOf(b, N)); const k = keys(F, N, W); push(k.legs, () => legsModel(F, k, N)); }
  if (opts.walk !== false) for (const b of order) for (let i = 0; i < CFG.phases; i++) {
    const F = synth(yawOf(b, N), PO.ready, yawOf(b, N), { amp: 1, ph: i / CFG.phases, run: 0 }); const k = keys(F, N, W); push(k.legs, () => legsModel(F, k, N)); }
  // v4.3 (A3): lav dekning (kne) – overkropp klar/sikte + bein i ro; gange bakover (rygging mens han sikter)
  for (const b of order) for (const pose of poses) { const F = synth(yawOf(b, N), pose, yawOf(b, N), null, 1); const k = keys(F, N, W); push(k.up, () => upperModel(F, k, N, W, D)); push(k.legs, () => legsModel(F, k, N)); }
  if (opts.walk !== false) for (const b of order) for (let i = 0; i < CFG.phases; i++) {
    const F = synth(yawOf(b, N), PO.ready, yawOf(b, N), { amp: 1, ph: i / CFG.phases, run: 0, back: true }); const k = keys(F, N, W); push(k.legs, () => legsModel(F, k, N)); }
  for (const b of order) for (const g of MOVING) { if (!hasGroup(W.look, g, D)) continue; const F = synth(yawOf(b, N), PO.aim || PO.ready, yawOf(b, N)); const k = keys(F, N, W);
    push(`M|${g}|${W.key}|${k.pk}`, () => movingModel(k, N, W, D, g)); }
  return { jobs, cache, D };
}

/** Samme format som oblique.muzzleDraw (bakkepunkt + z; skjerm = PROJ.toScreen(x, y, z)). Tar riggen, ikke F. */
export const muzzleDraw = muzzleOf;

function flash(ctx, s, x, y, dy, f) { if (!(f > 0)) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 * f; ctx.drawImage(s.body, x - s.ax, y - s.ay + dy, s.w, s.h); ctx.restore(); }

export const faceted = {
  name: 'faceted', CFG, STATS, renderFigure, cacheReport, muzzleOf, muzzleDraw, attachWeaponEvents, warmJobs, THROW_POSE,
  drawFigure(ctx, rig, F, opts = {}) { if (!hasDOM) return; renderFigure(ctx, rig, F, opts); },
  sortKey(F) { return PROJ.sortKey({ x: F.x, y: F.y, r: 12 }); },
  setRing(on) { CFG.ring = !!on; },
};
export default faceted;
