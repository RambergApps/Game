// BREACH – Effektsystem (eies av Breach Effekter). Se README.md og docs/EFFEKTER.md.
//   init(world) · spawn(world, type, params) · update(dt, world) · draw(ctx, world, camera, 'under'|'over') · bindEvents(world) → off()
// Regler: ingen shadowBlur, gradienter kun i sprites.js (bygges én gang), partikkelbasseng med hardt tak, egen kosmetisk rng
// (rører ikke world.rng, så spillogikken forblir deterministisk). Høyde z i verdens-px → skjerm via PROJ (y − z·zScale).
import { PROJ } from '../shared/projection.js';
import * as S from './sprites.js';
import { createPool, take, takeDecal, takeEmitter, M_SPRITE, M_STREAK, M_SHARD, M_FIRE, M_RING, M_DROP, M_GLOW, L_UNDER, L_OVER, MAX_PARTICLES } from './pool.js';

const TAU = Math.PI * 2, Z = PROJ.zScale;
export const MUZZLE_Z = 26;          // munningshøyde (verdens-px) for stående figur; huket ≈ 17
export const HIT_Z = 22;             // typisk treffhøyde på kropp/front

// ---------------------------------------------------------------- tilstand
export function state(world) {
  if (world._vfx) return world._vfx;
  const st = { pool: createPool(), rng: S.mulberry(0xC1D3), quality: 1, Q: QUALITY.high, level: 'high', stats: { spawns: 0, drawn: 0, ms: 0 }, offs: null };
  world._vfx = st; return st;
}
/**
 * Kvalitetsnivåer. q = tetthet (antall partikler per hendelse), glow/smoke = skala på tegnestørrelse for glød- og røyksprites
 * (fyllrate er hovedkostnaden), fill = tak på samlet glød+røykflate per lag og bilde i skjerm-px² (over taket tegnes de
 * minst synlige (lav alfa) ikke), dropGlow = glød rundt ichordråper, decalHot = varme årer i dekaler.
 */
export const QUALITY = Object.freeze({
  high:   Object.freeze({ q: 1,    glow: 1,    smoke: 1,    fill: Infinity, minA: 0.004, dropGlow: true,  decalHot: true }),
  medium: Object.freeze({ q: 0.7,  glow: 0.82, smoke: 0.92, fill: 2.4e6,    minA: 0.02,  dropGlow: true,  decalHot: true }),
  low:    Object.freeze({ q: 0.45, glow: 0.66, smoke: 0.85, fill: 1.2e6,    minA: 0.035, dropGlow: true,  decalHot: true  }),
});
function initImpl(world, opts = {}) { const st = state(world); if (opts.quality != null) setQuality(world, opts.quality); if (opts.warmup !== false && typeof document !== 'undefined') S.warmup(); return st; }
/** Antall som skaleres med kvalitet (0.5 = halv tetthet). Minst 1 når n > 0. */
function N(st, n) { return n <= 0 ? 0 : Math.max(1, Math.round(n * st.quality * (st.dens ?? 1))); }
/** Adaptiv last (deterministisk, ut fra levende partikler, ikke tid): 0 under LOAD0, 1 ved LOAD1. Typisk kamp topper ca. 310 → 0.
 *  Ved last: færre nye partikler (dens), mindre røyk-/glødsprites og et fyllbudsjett også på high (se drawImpl). */
export const LOAD0 = 240, LOAD1 = 460;   // 26.10: stram for spillet (Arena: topp ≤ 400 i tung kamp)
// Automatisk medium i tung kamp (bare når nivået er high). Hysterese: på etter 0,4 s over 330 levende, av etter 2 s under 220 → ingen flimring.
function autoMed(st, live, dt) { if (st.noAdapt || st.level !== 'high') { st.autoMed = false; st.amT = 0; return; } const d = +dt || 0;
  if (!st.autoMed) { st.amT = live > 330 ? (st.amT || 0) + d : 0; if (st.amT > 0.4) { st.autoMed = true; st.amT = 0; } }
  else { st.amT = live < 220 ? (st.amT || 0) + d : 0; if (st.amT > 2) { st.autoMed = false; st.amT = 0; } } }
function setLoad(st, live) { if (st.noAdapt) { st.load = 0; st.dens = 1; return; } const l = Math.max(0, Math.min(1, (live - LOAD0) / (LOAD1 - LOAD0))); st.load = l; st.dens = live > 420 ? 0.2 : 1 - 0.65 * l; }   // over 420: nødbrems (topp ≤ ~400 i tung kamp)
const pick = (R, a) => a[Math.floor(R() * a.length)];

// ---------------------------------------------------------------- byggeklosser
function puffP(st, x, y, z, o) {
  const R = st.rng, p = take(st.pool); p.mode = M_SPRITE; p.img = S.puff(o.tone || 'smoke', Math.floor(R() * 4));
  p.x = x; p.y = y; p.z = z; const a = o.a ?? R() * TAU, v = (o.v ?? 20) * (0.5 + R() * 0.7);
  p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.vz = o.vz ?? 8; p.drag = o.drag ?? 2.2; p.grav = o.grav ?? 0;
  p.size = (o.r ?? 8) * (0.75 + R() * 0.5); p.grow = o.grow ?? 1.4; p.life = (o.life ?? 1) * (0.8 + R() * 0.4) * (st.dens < 1 ? 0.55 + 0.45 * st.dens : 1); p.delay = o.delay ?? 0;   // ved last: kortere røyk
  p.rot = R() * TAU; p.vrot = (R() - 0.5) * 0.6; p.alpha = o.alpha ?? 0.4; p.fadeIn = o.fadeIn ?? 0.08; p.fadeOut = 1.4; p.layer = o.layer ?? L_OVER; return p;
}
function sparkP(st, x, y, z, a, o) {
  const R = st.rng, p = take(st.pool); p.mode = M_STREAK; p.add = true; const c = o.col || [255, 170, 80]; p.img = S.streak(c[0], c[1], c[2]);
  const v = (o.v ?? 300) * (0.45 + R() * 0.8), el = o.el ?? (R() * 0.8 - 0.1);  // elevasjon: noen går opp, noen ned
  p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * v * Math.cos(el); p.vy = Math.sin(a) * v * Math.cos(el); p.vz = v * Math.sin(el);
  p.grav = o.grav ?? 520; p.drag = o.drag ?? 1.5; p.bounce = o.bounce ?? 0.35; p.life = (o.life ?? 0.35) * (0.6 + R() * 0.8);
  p.size = o.len ?? 3; p.size2 = o.w ?? 1.1; p.stretch = o.stretch ?? 0.028; p.alpha = 1; p.fadeOut = 1.6; p.layer = L_OVER; return p;
}
function shardP(st, x, y, z, a, kind, o) {
  const R = st.rng, p = take(st.pool); p.mode = M_SHARD; p.img = S.shard(kind, Math.floor(R() * 6));
  const v = (o.v ?? 120) * (0.4 + R() * 0.9), el = o.el ?? (0.2 + R() * 0.9);
  p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * v * Math.cos(el); p.vy = Math.sin(a) * v * Math.cos(el); p.vz = v * Math.sin(el);
  p.grav = 620; p.drag = 0.6; p.bounce = 0.3; p.life = o.life ?? 2.2; p.size = (o.s ?? 2.4) * (0.6 + R() * 0.8); p.rot = R() * TAU; p.vrot = (R() - 0.5) * 22;
  p.alpha = 1; p.fadeOut = 6; p.heat = o.hot ? 1 : 0; p.layer = L_OVER; return p;
}
function glowP(st, x, y, z, r, col, life, alpha, layer = L_OVER, delay = 0) {
  const p = take(st.pool); p.mode = M_GLOW; p.add = true; p.img = S.glow(col[0], col[1], col[2]); p.x = x; p.y = y; p.z = z;
  p.size = r; p.life = life; p.alpha = alpha; p.fadeOut = 2; p.layer = layer; p.delay = delay; return p;
}
function fireP(st, x, y, z, o) {
  const R = st.rng, p = take(st.pool); p.mode = M_FIRE; p.add = true; p.seed = Math.floor(R() * 3);
  const a = o.a ?? R() * TAU, v = (o.v ?? 40) * (0.4 + R() * 0.8);
  p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.vz = o.vz ?? 30; p.drag = o.drag ?? 3;
  p.size = (o.r ?? 10) * (0.7 + R() * 0.6); p.grow = o.grow ?? 0.8; p.life = (o.life ?? 0.5) * (0.7 + R() * 0.6); p.rot = R() * TAU; p.vrot = (R() - 0.5) * 2;
  p.alpha = o.alpha ?? 0.9; p.fadeIn = 0.04; p.fadeOut = 1.2; p.delay = o.delay ?? 0; p.heat = o.heat ?? 0; p.layer = L_OVER; return p;
}
function dropP(st, x, y, z, a, o) {
  const R = st.rng, p = take(st.pool); p.mode = M_DROP; p.img = S.droplet();
  const v = (o.v ?? 160) * (0.4 + R() * 0.9), el = o.el ?? (0.1 + R() * 0.7);
  p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * v * Math.cos(el); p.vy = Math.sin(a) * v * Math.cos(el); p.vz = v * Math.sin(el);
  p.grav = 560; p.drag = 0.8; p.life = 1.5; p.size = (o.s ?? 1.6) * (0.6 + R() * 0.8); p.alpha = 1; p.fadeOut = 8; p.land = o.splat === false ? 0 : 1; p.layer = L_OVER; return p;
}
function decal(st, img, hot, x, y, rot, size, life, cool, z = 0, sy = 1) {
  const d = takeDecal(st.pool); d.img = img; d.hot = hot; d.x = x; d.y = y; d.z = z; d.rot = rot; d.size = size; d.sy = sy; d.life = life; d.cool = cool; return d;
}

// ---------------------------------------------------------------- effekttyper
const T = {};
/** Munningsglimt. { x, y, z=MUZZLE_Z, flash=true, angle, weapon:'rifle'|'shotgun'|'marksman'|<fiendevåpen>, team, power=1 } */
T.muzzle = (st, o) => {
  const R = st.rng, a = o.angle || 0, z = o.z ?? MUZZLE_Z, w = o.weapon || 'rifle', enemy = o.team === 'enemy';
  const style = w === 'shotgun' ? 'shotgun' : w === 'marksman' ? 'marksman' : enemy ? 'enemy' : 'rifle';
  const big = style === 'shotgun' ? 1.25 : style === 'marksman' ? 1.15 : 1.0;
  if (o.flash !== false) { const f = take(st.pool); f.mode = M_SPRITE; f.add = true; f.img = S.flash(style, Math.floor(R() * 3)); f.x = o.x; f.y = o.y; f.z = z;
  f.rot = a + (R() - 0.5) * 0.12; f.size = 22 * big * (0.85 + R() * 0.3); f.size2 = 0.75; f.flip = R() < 0.5 ? -1 : 1; f.life = style === 'rifle' || style === 'enemy' ? 0.05 : 0.07; f.alpha = 1; f.fadeOut = 1.5; f.stretch = -1; }   // stretch −1: anker i munning. flash:false = Våpen tegner glimtet, VFX bare lys/røyk
  glowP(st, o.x + Math.cos(a) * 4, o.y + Math.sin(a) * 4, z, 10 * big, [255, 210, 140], 0.06, 0.9);
  glowP(st, o.x + Math.cos(a) * 10, o.y + Math.sin(a) * 10, 0, 70 * big, enemy ? [255, 130, 50] : [255, 190, 120], 0.07, 0.32, L_UNDER);   // lys på bakken
  const ns = N(st, style === 'shotgun' ? 5 : style === 'marksman' ? 4 : 1);
  for (let i = 0; i < ns; i++) {
    const side = style === 'marksman' && i > 0 ? (i % 2 ? -1.45 : 1.45) : (R() - 0.5) * 0.6;
    puffP(st, o.x + Math.cos(a) * 5, o.y + Math.sin(a) * 5, z, { tone: 'smoke', a: a + side, v: style === 'marksman' ? 70 : 45, vz: 6, r: style === 'shotgun' ? 5 : 3.5, grow: 2.2, life: style === 'rifle' ? 0.5 : 0.9, alpha: style === 'rifle' ? 0.16 : 0.24 });
  }
  if (style === 'shotgun') for (let i = 0; i < N(st, 6); i++) sparkP(st, o.x, o.y, z, a + (R() - 0.5) * 0.5, { v: 520, el: (R() - 0.5) * 0.2, life: 0.12, len: 2, w: 0.8, grav: 80, col: [255, 160, 60] });
  if (style === 'marksman') for (let i = 0; i < N(st, 4); i++) puffP(st, o.x, o.y, 0, { tone: 'dust', a: a + (i % 2 ? 1.6 : -1.6) + (R() - 0.5) * 0.5, v: 50, vz: 4, r: 5, grow: 1.8, life: 0.8, alpha: 0.18, layer: L_UNDER });
};
/** Kulespor (kosmetisk linje munning→treff, for skudd uten prosjektil-tracer). { x0,y0,x1,y1,z,team,weapon } */
T.tracer = (st, o) => {
  const p = take(st.pool); p.mode = M_STREAK; p.add = true; const enemy = o.team === 'enemy';
  p.img = enemy ? S.streak(255, 120, 40) : S.streak(255, 214, 160); p.x = o.x1; p.y = o.y1; p.z = o.z ?? MUZZLE_Z;
  const dx = o.x1 - o.x0, dy = o.y1 - o.y0, L = Math.hypot(dx, dy) || 1; p.vx = dx / L * 0.001; p.vy = dy / L * 0.001;
  p.size = Math.min(L, o.len ?? 90); p.size2 = o.weapon === 'marksman' ? 1.8 : 1.1; p.stretch = 0; p.life = o.weapon === 'marksman' ? 0.12 : 0.05; p.fadeOut = 1.5; p.alpha = o.alpha ?? 0.6;
};
/** Treff. { x, y, z=HIT_Z, angle (kulas retning), surface:'metal'|'concrete'|'wood'|'chitin'|'armor', power=1, partial } */
T.impact = (st, o) => {
  const R = st.rng, s = o.surface || 'concrete', pw = Math.max(0.3, o.power ?? 1), back = (o.angle ?? 0) + Math.PI, z = o.z ?? HIT_Z, x = o.x, y = o.y;
  if (s === 'metal') {
    glowP(st, x, y, z, 15 * pw, [255, 214, 150], 0.06, 1);
    glowP(st, x, y, z, 9 * pw, [255, 120, 36], 0.45, 1, L_OVER, 0.03);   // varmt punkt som avkjøles (synlig i spillskala)
    glowP(st, x, y, 0, 32 * pw, [255, 170, 90], 0.1, 0.3, L_UNDER);
    for (let i = 0; i < N(st, 14 * pw); i++) sparkP(st, x, y, z, back + (R() - 0.5) * 2.6, { v: 460 * pw, life: 0.55, len: 3, w: 0.6, col: [255, 190, 110], bounce: 0.45, stretch: 0.04 });
    for (let i = 0; i < N(st, 2); i++) shardP(st, x, y, z, back + (R() - 0.5) * 1.6, 'metal', { v: 90, s: 1.2, life: 1.2 });
    puffP(st, x, y, z, { tone: 'smoke', a: back, v: 25, vz: 10, r: 3, grow: 2, life: 0.7, alpha: 0.18 });
    if (!o.partial) { const h = S.bulletHole('metal', Math.floor(R() * 3)); decal(st, h.base, h.hot, x, y, R() * TAU, 4.2, 6, 1.2, z, o.sy ?? 1); }
  } else if (s === 'chitin' || s === 'armor') {
    // kitin: hardt, mørkt skall over glødende innmat – lysblaff, svarte flak bakover, ichorsprut gjennom kroppen (kulas retning)
    glowP(st, x, y, z, 13 * pw, [255, 150, 60], 0.07, 1);
    glowP(st, x, y, 0, 22 * pw, [255, 120, 40], 0.12, 0.25, L_UNDER);
    for (let i = 0; i < N(st, 6 * pw); i++) shardP(st, x, y, z, back + (R() - 0.5) * 1.8, 'chitin', { v: 170, s: 3.2, life: 2.5, el: 0.3 + R() * 0.8, hot: R() < 0.4 });
    for (let i = 0; i < N(st, 7 * pw); i++) sparkP(st, x, y, z, back + (R() - 0.5) * 2, { v: 300, life: 0.25, len: 2.6, w: 1.1, col: [255, 150, 60] });
    T.ichor(st, { x, y, z, angle: o.angle, amount: 0.8 * pw, ground: false });
  } else if (s === 'wood') {   // tre (kasser, paller): lyse spon og flis, lite støv, mørkt hull
    glowP(st, x, y, z, 4 * pw, [255, 226, 190], 0.04, 0.5);
    for (let i = 0; i < N(st, 7 * pw); i++) shardP(st, x, y, z, back + (R() - 0.5) * 1.6, 'wood', { v: 150, s: 2.2, life: 2.2, el: 0.2 + R() * 0.8 });
    for (let i = 0; i < N(st, 3 * pw); i++) puffP(st, x, y, z, { tone: 'dust', a: back + (R() - 0.5) * 1.2, v: 45 * pw, vz: 6, r: 3.6, grow: 2, life: 0.9, alpha: 0.32, drag: 3 });
    if (!o.partial) { const h = S.bulletHole('concrete', Math.floor(R() * 3)); decal(st, h.base, null, x, y, R() * TAU, 3.6, 8, 1, z, o.sy ?? 1); }
  } else {   // betong
    glowP(st, x, y, z, 5 * pw, [255, 232, 200], 0.04, 0.7);
    for (let i = 0; i < N(st, 6 * pw); i++) puffP(st, x, y, z, { tone: 'concrete', a: back + (R() - 0.5) * 1.3, v: 70 * pw, vz: 4 + R() * 12, r: 4.6, grow: 2.2, life: 1.3, alpha: 0.6, drag: 3.2 });
    puffP(st, x, y, z * 0.5, { tone: 'dust', a: back, v: 20, vz: -4, r: 6, grow: 1.2, life: 1.8, alpha: 0.3, drag: 2, delay: 0.05 });
    for (let i = 0; i < N(st, 6 * pw); i++) shardP(st, x, y, z, back + (R() - 0.5) * 2, 'concrete', { v: 130, s: 1.6, life: 1.6 });
    for (let i = 0; i < N(st, 2); i++) sparkP(st, x, y, z, back + (R() - 0.5) * 1.8, { v: 240, life: 0.12, len: 1.6, w: 0.8, col: [255, 200, 140] });
    if (!o.partial) { const h = S.bulletHole('concrete', Math.floor(R() * 3)); decal(st, h.base, null, x, y, R() * TAU, 4.5, 8, 1, z, o.sy ?? 1); }
  }
};
/** Cinderborn-ichor (monsterblod): varm, glødende, seig. { x, y, z, angle, amount=1, ground=true } */
T.ichor = (st, o) => {
  const R = st.rng, a = o.angle ?? 0, k = o.amount ?? 1, z = o.z ?? HIT_Z;
  for (let i = 0; i < N(st, 9 * k); i++) dropP(st, o.x, o.y, z, a + (R() - 0.5) * 1.3, { v: 150 + 60 * k, s: 2 + k * 0.8 });
  glowP(st, o.x, o.y, z, 11 * Math.sqrt(k), [255, 120, 40], 0.14, 0.7);
  for (let i = 0; i < N(st, 2 * k); i++) puffP(st, o.x, o.y, z, { tone: 'steam', a: a + (R() - 0.5), v: 14, vz: 22, r: 3, grow: 2, life: 1.1, alpha: 0.14 });
  if (o.ground !== false) { const sp = S.ichorSplat(Math.floor(R() * 4)); decal(st, sp.base, sp.hot, o.x + Math.cos(a) * 4, o.y + Math.sin(a) * 4, a + (R() - 0.5) * 0.4, 20 + 14 * k, 16, 6); }
};
/** Fiende dør: større ichor, kitinsplinter, glør og røyk. { x, y, angle, size=1 } */
T.death = (st, o) => {
  const R = st.rng, a = o.angle ?? 0, k = o.size ?? 1;
  T.ichor(st, { x: o.x, y: o.y, z: 16, angle: a, amount: 1.4 * k });
  for (let i = 0; i < N(st, 6 * k); i++) shardP(st, o.x, o.y, 18, a + (R() - 0.5) * 3, 'chitin', { v: 120, s: 3, life: 3, hot: R() < 0.5 });
  for (let i = 0; i < N(st, 8 * k); i++) T._ember(st, o.x + (R() - 0.5) * 14, o.y + (R() - 0.5) * 10, 10, 1);
  for (let i = 0; i < N(st, 4 * k); i++) puffP(st, o.x, o.y, 10, { tone: 'soot', v: 18, vz: 18, r: 7, grow: 1.5, life: 2, alpha: 0.28, delay: R() * 0.2 });
};
/** Granat/eksplosjon med sjokkbølge. { x, y, radius=90 } */
T.explosion = (st, o) => {
  const R = st.rng, x = o.x, y = o.y, r = o.radius ?? 90, k = r / 90;
  glowP(st, x, y, 0, r * 2.2, [255, 120, 44], 0.55, 0.6, L_UNDER);
  // (kjerneglød fjernet 26.10: ga grå-lilla kjerne på high; varmen kommer fra ild-sprites + oransje kropp)
  glowP(st, x, y, 10, r * 0.8, [255, 96, 24], 0.32, 0.7);   // dyp oransje kropp rundt kjernen
  // bakken: lys ring (trykkbølge) + støvring
  const g = take(st.pool); g.mode = M_RING; g.add = true; g.img = S.ring(); g.x = x; g.y = y; g.size = r * 1.35; g.life = 0.28; g.alpha = 0.4; g.layer = L_UNDER;
  const d = take(st.pool); d.mode = M_RING; d.img = S.dustRing(); d.x = x; d.y = y; d.size = r * 1.55; d.life = 0.7; d.alpha = 0.7; d.delay = 0.04; d.layer = L_UNDER;
  // tung røyk som stiger og blir liggende
  // færre, større røykdotter (billigere: færre tegnekall, ca. 10 % mindre flate), tatt før ildkula i bassenget → tegnes UNDER ilden (varm kjerne, ikke grå)
  for (let i = 0; i < N(st, 12 * k); i++) puffP(st, x + (R() - 0.5) * r * 0.5, y + (R() - 0.5) * r * 0.5, 8 + R() * 18, { tone: 'soot', v: 70 * k, vz: 12 + R() * 16, r: 28 * k, grow: 1.0, life: 3.4, alpha: 0.85, delay: 0.16 + R() * 0.2, fadeIn: 0.3, drag: 1.4 });
  // ildkule
  for (let i = 0; i < N(st, 2 * k); i++) fireP(st, x + (R() - 0.5) * 10 * k, y + (R() - 0.5) * 8 * k, 10 + R() * 8, { v: 40 * k, vz: 30, r: 9 * k, grow: 0.8, life: 0.22, heat: 0, alpha: 0.7 });   // liten hvitgul kjerne
  for (let i = 0; i < N(st, 12 * k); i++) fireP(st, x + (R() - 0.5) * 26 * k, y + (R() - 0.5) * 20 * k, 6 + R() * 16, { v: 150 * k, vz: 20 + R() * 50, r: 13 * k, grow: 1.1, life: 0.45, heat: 1, alpha: 0.78 });
  for (let i = 0; i < N(st, 8 * k); i++) fireP(st, x + (R() - 0.5) * 20, y + (R() - 0.5) * 20, 12 + R() * 14, { v: 50, vz: 40, r: 16 * k, grow: 0.9, life: 0.8, heat: 1, delay: 0.05 + R() * 0.08, alpha: 0.75 });
  for (let i = 0; i < N(st, 18 * k); i++) { const a = (i / 18) * TAU + R() * 0.3; puffP(st, x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25, 2, { tone: 'dust', a, v: 260 * k, vz: 2, r: 8 * k, grow: 1.6, life: 1.4, alpha: 0.38, drag: 4.2, layer: L_UNDER }); }
  // splinter, glødende biter og gnister
  for (let i = 0; i < N(st, 14 * k); i++) shardP(st, x, y, 4, R() * TAU, R() < 0.3 ? 'rock' : 'concrete', { v: 260, s: 2.4, life: 2.6, el: 0.4 + R() * 0.7 });
  for (let i = 0; i < N(st, 22 * k); i++) sparkP(st, x, y, 8, R() * TAU, { v: 560, life: 0.7, len: 3, w: 1.1, col: [255, 160, 70], el: R() * 1.1, grav: 380 });
  for (let i = 0; i < N(st, 10 * k); i++) T._ember(st, x + (R() - 0.5) * r * 0.6, y + (R() - 0.5) * r * 0.6, 10, 1.5);
  decal(st, S.scorch(Math.floor(R() * 3)), null, x, y, R() * TAU, r * 0.95, 20, 1);
  glowP(st, x, y, 0, r * 0.7, [255, 110, 40], 2.2, 0.35, L_UNDER, 0.2);   // ettergløding i krateret
};
/** Røyk. { x, y, z=4, r=12, n=6, tone='smoke', life=2.5 } */
T.smoke = (st, o) => { const R = st.rng; for (let i = 0; i < N(st, o.n ?? 6); i++) puffP(st, o.x + (R() - 0.5) * (o.r ?? 12), o.y + (R() - 0.5) * (o.r ?? 12), o.z ?? 4, { tone: o.tone || 'smoke', v: 12, vz: 16, r: (o.r ?? 12) * 0.8, grow: 1, life: o.life ?? 2.5, alpha: o.alpha ?? 0.35, delay: R() * 0.3 }); };
T._ember = (st, x, y, z, k = 1) => {
  const R = st.rng, p = take(st.pool); p.mode = M_STREAK; p.add = true; p.img = S.streak(255, 120, 40);
  p.x = x; p.y = y; p.z = z; p.vx = (R() - 0.5) * 30 * k; p.vy = (R() - 0.5) * 30 * k; p.vz = 25 + R() * 50 * k; p.grav = -10; p.drag = 0.9;
  p.size = 1.4; p.size2 = 1.3; p.stretch = 0.03; p.life = 0.9 + R() * 1.4; p.alpha = 0.9; p.fadeOut = 1.3; p.vrot = 4 + R() * 4; p.seed = R() * TAU; return p;
};
/** Glør / aske i lufta i et område (engangssky). { x, y, w=200, h=150, n=20, ash=true } */
T.embers = (st, o) => {
  const R = st.rng, w = o.w ?? 200, h = o.h ?? 150;
  for (let i = 0; i < N(st, o.n ?? 20); i++) {
    if (o.ash !== false && R() < 0.55) { const p = take(st.pool); p.mode = M_SHARD; p.img = S.shard('chitin', 1 + 2 * Math.floor(R() * 3)); p.x = o.x + (R() - 0.5) * w; p.y = o.y + (R() - 0.5) * h; p.z = 20 + R() * 60; p.vx = 8 + R() * 10; p.vy = 3; p.vz = -6 - R() * 6; p.grav = 0; p.drag = 0; p.life = 4 + R() * 3; p.size = 0.9 + R() * 0.8; p.vrot = (R() - 0.5) * 3; p.rot = R() * TAU; p.alpha = 0.7; p.fadeIn = 0.2; p.fadeOut = 1.5; }
    else T._ember(st, o.x + (R() - 0.5) * w, o.y + (R() - 0.5) * h, R() * 30, 0.6);
  }
};
/** Vedvarende ild (f.eks. Kiln-flekk, brennende vrak). { x, y, r=10, duration=4 } – emitter. */
T.fire = (st, o) => { const e = takeEmitter(st.pool); if (!e) return; e.kind = 'fire'; e.x = o.x; e.y = o.y; e.size = o.r ?? 10; e.life = o.duration ?? 4; e.id = o.id ?? null; return e; };
/** Sprekk-glød før innhopp. { x, y, t (varseltid s), id, type, size=1 } – emitter; avsluttes av 'rise' eller tid. */
T.crack = (st, o) => {
  const e = takeEmitter(st.pool); if (!e) return; e.kind = 'crack'; e.x = o.x; e.y = o.y; e.life = Math.max(0.2, o.t ?? 0.9); e.id = o.id ?? null;
  e.size = o.size ?? (o.type === 'heavy' ? 1.25 : 1); e.v = Math.floor(st.rng() * 4); e.hid = !!o.hidden; return e;
};
/** Oppbrudd fra bakken (spawnRise). { x, y, id, size=1 } */
T.rise = (st, o) => {
  const R = st.rng, x = o.x, y = o.y, k = o.size ?? 1;
  for (const e of st.pool.E) if (e.on && e.kind === 'crack' && ((o.id != null && e.id === o.id) || (Math.abs(e.x - x) < 4 && Math.abs(e.y - y) < 4))) e.done = true;
  glowP(st, x, y, 0, 70 * k, [255, 110, 40], 0.5, 0.6, L_UNDER);
  const sh = S.sinkhole(Math.floor(R() * 3)); decal(st, sh.base, sh.hot, x, y, R() * TAU, 34 * k, 18, 5);
  for (let i = 0; i < N(st, 14 * k); i++) shardP(st, x + (R() - 0.5) * 12, y + (R() - 0.5) * 12, 2, R() * TAU, R() < 0.5 ? 'concrete' : 'rock', { v: 170, s: 3, life: 2.4, el: 0.7 + R() * 0.7 });
  for (let i = 0; i < N(st, 12 * k); i++) { const a = (i / 12) * TAU + R() * 0.4; puffP(st, x + Math.cos(a) * 10, y + Math.sin(a) * 10, 2, { tone: 'dust', a, v: 120, vz: 10, r: 9 * k, grow: 1.3, life: 1.6, alpha: 0.45, drag: 3.4 }); }
  for (let i = 0; i < N(st, 10 * k); i++) T._ember(st, x + (R() - 0.5) * 16, y + (R() - 0.5) * 16, 4, 1.6);
  for (let i = 0; i < N(st, 3); i++) puffP(st, x, y, 6, { tone: 'soot', v: 10, vz: 24, r: 10, grow: 1.2, life: 2.2, alpha: 0.3, delay: 0.1 + R() * 0.2 });
};
/**
 * Nærkampslag (kolbeslag). Tungt, ikke tegneserie: kort varmhvitt lysblaff i kontaktøyeblikket, støvsky fra føttene som presses
 * ut i slagretningen, kitinsplinter (noen glødende), grus fra gulvet og ichor. Ingen slagbue på treff (bare svak luftsmear på bom).
 * { x, y, z=24 (slagpunkt), ox, oy (slåer), angle, hit=true, power=0.7 (0..1, 1 = drap), killed, surface='chitin'|'armor'|'metal'|'player', team }
 */
T.melee = (st, o) => {
  const R = st.rng, a = o.angle ?? 0, z = o.z || 24, pw = Math.max(0.3, Math.min(1, o.power ?? 0.7)), kill = !!o.killed;
  if (o.hit === false) {   // bom: bare luftdrag og litt støv
    const sm = take(st.pool); sm.mode = M_SPRITE; sm.img = S.smear(); sm.x = o.ox ?? o.x - Math.cos(a) * 18; sm.y = o.oy ?? o.y - Math.sin(a) * 18; sm.z = z; sm.rot = a; sm.size = 24; sm.size2 = 1; sm.life = 0.12; sm.alpha = 0.3; sm.fadeOut = 1.5; sm.add = false;
    puffP(st, o.x, o.y, 2, { tone: 'dust', a, v: 30, vz: 2, r: 4, grow: 2, life: 0.6, alpha: 0.18, layer: L_UNDER }); return;
  }
  // lysblaff: liten hard kjerne + svakt bakkelys, 50–70 ms
  glowP(st, o.x, o.y, z, 11 + 8 * pw, [255, 228, 190], 0.05, 0.75);
  glowP(st, o.x, o.y, 0, 34 + 16 * pw, [255, 190, 130], 0.07, 0.2, L_UNDER);
  // støv: tett sky ved føttene som skyves ut i slagretningen + en vifte bakover/til sidene
  const fx = o.x + Math.cos(a) * 4, fy = o.y + Math.sin(a) * 4;
  // synk med Lyd: anslag 0–10 ms, lysblaff 0–50 ms, støv/splinter topper < 100 ms og legger seg rundt 0,4 s (hale ~0,45 s)
  for (let i = 0; i < N(st, 4 + 4 * pw); i++) puffP(st, fx + (R() - 0.5) * 8, fy + (R() - 0.5) * 6, 2, { tone: 'concrete', a: a + (R() - 0.5) * 1.6, v: 90 + 70 * pw, vz: 3 + R() * 6, r: 5 + 2 * pw, grow: 2.4, life: 0.55, alpha: 0.45, drag: 6, fadeIn: 0.03 });
  for (let i = 0; i < N(st, 2 + 2 * pw); i++) puffP(st, o.x, o.y, z, { tone: 'dust', a: a + (R() - 0.5) * 2.4, v: 50, vz: 8, r: 4, grow: 2.4, life: 0.5, alpha: 0.28, drag: 5, fadeIn: 0.03 });
  // grus fra gulvet
  for (let i = 0; i < N(st, 3 + 3 * pw); i++) shardP(st, fx, fy, 1, a + (R() - 0.5) * 1.8, R() < 0.5 ? 'concrete' : 'rock', { v: 110 + 60 * pw, s: 1.2, life: 1.4, el: 0.35 + R() * 0.5 });
  if (o.surface === 'player' || o.surface === 'metal' || o.team === 'enemy') {   // fiende slår spilleren: rustning – gnister, ingen ichor
    for (let i = 0; i < N(st, 5 + 4 * pw); i++) sparkP(st, o.x, o.y, z, a + (R() - 0.5) * 1.6, { v: 240, life: 0.2, len: 2, w: 0.8, col: [255, 200, 150] });
    return;
  }
  // kitin: splinter i slagretningen, noen glødende fra innsiden
  for (let i = 0; i < N(st, 4 + 5 * pw + (kill ? 4 : 0)); i++) shardP(st, o.x, o.y, z, a + (R() - 0.5) * 1.3, 'chitin', { v: 150 + 90 * pw, s: 2.2 + R() * 1.2, life: 2.6, el: 0.25 + R() * 0.7, hot: R() < 0.35 });
  for (let i = 0; i < N(st, 3); i++) sparkP(st, o.x, o.y, z, a + (R() - 0.5) * 1.4, { v: 220, life: 0.16, len: 1.8, w: 0.8, col: [255, 160, 70] });
  T.ichor(st, { x: o.x, y: o.y, z, angle: a, amount: 0.5 + 0.6 * pw + (kill ? 0.4 : 0) });
  if (kill) {   // drap: skallet sprekker – store flak, glør og et lengre glødende etterslep (~0,6 s)
    for (let i = 0; i < N(st, 4); i++) shardP(st, o.x, o.y, z, a + (R() - 0.5) * 2.2, 'chitin', { v: 120, s: 4.2, life: 3, el: 0.4 + R() * 0.6, hot: true });
    for (let i = 0; i < N(st, 6); i++) T._ember(st, o.x + (R() - 0.5) * 10, o.y + (R() - 0.5) * 8, z * 0.6, 1.2);
    glowP(st, o.x, o.y, z * 0.7, 16, [255, 110, 40], 0.6, 0.35, L_OVER, 0.04);
  }
};
/** Boss (stub): ventilutblåsning – gjenbruker ild og glør til Fiende-design/Fiende-AI leverer boss-hendelser. { x, y, angle } */
T.bossVent = (st, o) => { for (let i = 0; i < N(st, 6); i++) fireP(st, o.x, o.y, 20, { a: o.angle ?? -Math.PI / 2, v: 60, vz: 60, r: 9, life: 0.6, heat: 1 }); T.embers(st, { x: o.x, y: o.y, w: 30, h: 30, n: 8, ash: false }); };

// ---- Warden over dekning (coverpose.js). Støv/grus løsner fra toppkanten + kort kaldt blink i kanten; treff oppreist = harde gnister på brystplata.
/** { x, y (kantpunkt i bakkeplanet), z (dekningshøyde), nx, ny (normal mot fienden), tx, ty (langs kanten), material } */
T.coverRise = (st, o) => {
  const R = st.rng, z = o.z ?? 24, nx = o.nx ?? 0, ny = o.ny ?? -1, a = Math.atan2(ny, nx), tx = o.tx ?? -ny, ty = o.ty ?? nx, dd = (o.depth ?? 12) * 0.5, met = o.material === 'metal', k = o.scale ?? 1;   // scale: støvtak (coverpose.js)
  // varm kantlist: korte glødpunkter langs toppkanten der han reiser seg (additivt, 0,35 s)
  for (let i = -3; i <= 3; i++) glowP(st, o.x + tx * i * 7 + nx * dd, o.y + ty * i * 7 + ny * dd, z, 9, [255, 196, 120], 0.35, 0.55 - Math.abs(i) * 0.06);
  glowP(st, o.x + nx * dd, o.y + ny * dd, z + 3, 22, [255, 226, 180], 0.08, 0.75);
  // tett, lys støvvifte langs normalen (mot fienden), 0,4–0,6 s
  const n = N(st, 16 * k);
  for (let i = 0; i < n; i++) { const s = (R() - 0.5) * 50, x = o.x + tx * s + nx * dd, y = o.y + ty * s + ny * dd;
    puffP(st, x, y, z + R() * 3, { tone: met ? 'smoke' : 'concrete', a: a + (R() - 0.5) * 0.9, v: 70, vz: 14, r: 4.4, grow: 2.2, life: 0.5, alpha: 0.62, drag: 4, fadeIn: 0.02 }); }
  for (let i = 0; i < N(st, 14 * k); i++) { const s = (R() - 0.5) * 46; const p = shardP(st, o.x + tx * s + nx * dd, o.y + ty * s + ny * dd, z, a + (R() - 0.5) * 1.1, 'concrete', { v: 110, s: 1.4, life: 0.7, el: 0.4 + R() * 0.7 }); p.fadeOut = 3; }
};
/** Vedvarende, svak markør mens eksponert: kald glans på skuldre/hjelm + tynn bakkehalo mot fienden. Kalles ~7 ganger/s; fader selv ved dukk. */
T.exposedCue = (st, o) => {
  const nx = o.nx ?? 0, ny = o.ny ?? -1;
  glowP(st, o.x, o.y, 40, 18, [170, 205, 255], 0.3, 0.45);
  glowP(st, o.x + nx * 14, o.y + ny * 14, 0, 26, [150, 190, 255], 0.3, 0.22, L_UNDER);
};
/** Treff mens oppreist/eksponert. { x, y, z, angle (kulas retning), power } */
T.exposedHit = (st, o) => {
  const R = st.rng, pw = Math.max(0.5, o.power ?? 1), back = (o.angle ?? 0) + Math.PI, z = o.z ?? 34, x = o.x, y = o.y;
  glowP(st, x, y, z, 20 * pw, [255, 236, 200], 0.05, 1);
  glowP(st, x, y, z, 11 * pw, [255, 140, 50], 0.22, 0.9, L_OVER, 0.02);
  for (let i = 0; i < N(st, 16 * pw); i++) sparkP(st, x, y, z, back + (R() - 0.5) * 2.2, { v: 420, el: R() * 0.9 - 0.2, life: 0.4, len: 3.2, w: 0.8, col: [255, 200, 120], bounce: 0.4, stretch: 0.035 });
  for (let i = 0; i < N(st, 3); i++) shardP(st, x, y, z, back + (R() - 0.5) * 1.4, 'metal', { v: 110, s: 1.4, life: 1.1, hot: true });
  puffP(st, x, y, z, { tone: 'smoke', a: back, v: 22, vz: 8, r: 3.5, grow: 2, life: 0.6, alpha: 0.2 });
};
export const TYPES = Object.keys(T).filter((k) => k[0] !== '_');
/** Hovedinngang. Returnerer true hvis typen fantes. */
function spawnImpl(world, type, params = {}) {
  const st = state(world), fn = T[type]; if (!fn || type[0] === '_') return false;
  if (!Number.isFinite(params.x) && type !== 'tracer') return false;
  st.stats.spawns++; const bt = st.stats.byType || (st.stats.byType = {}); bt[type] = (bt[type] || 0) + 1;   // per type (diagnose: dobbel tegning)
  if (!params.hidden) { fn(st, params); return true; }
  // Skjult bak høy dekning (bind.js: core pointHidden): luftpartiklene flyttes til 'under', som tegnes FØR dekningen,
  // så containeren dekker dem naturlig. Ingen ekstra test per bilde; koster bare én liste per skjult spawn.
  const log = st.pool.log = []; try { fn(st, params); } finally { st.pool.log = null; }
  for (let i = 0; i < log.length; i++) if (log[i].layer === L_OVER) log[i].layer = L_UNDER;
  st.stats.hidden = (st.stats.hidden || 0) + 1; return true;
}

// ---------------------------------------------------------------- oppdatering
function updEmitter(st, e, dt) {
  const R = st.rng; e.t += dt;
  if (e.kind === 'crack') {
    const k = Math.min(1, e.t / e.life); e.p = k;
    e.acc += dt * (8 + 30 * k);                                     // glør + småstein øker mot oppbruddet
    const log = e.hid ? (st.pool.log = []) : null;                   // skjult bak høy dekning: partiklene til under-laget (som spawnImpl)
    while (e.acc > 1) { e.acc -= 1; const a = R() * TAU, r = (6 + R() * 26 * k) * e.size;
      if (R() < 0.55) T._ember(st, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 1, 0.8);
      else { const p = shardP(st, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 0, a, R() < 0.5 ? 'concrete' : 'rock', { v: 30 + 40 * k, s: 1.3, life: 0.9, el: 1.2 }); p.fadeOut = 3; }
      if (R() < 0.12) puffP(st, e.x + Math.cos(a) * r * 0.5, e.y + Math.sin(a) * r * 0.5, 1, { tone: 'dust', a, v: 14, vz: 8, r: 5, grow: 1.4, life: 1, alpha: 0.25, layer: L_UNDER });
    }
    if (log) { st.pool.log = null; for (let i = 0; i < log.length; i++) if (log[i].layer === L_OVER) log[i].layer = L_UNDER; }
    if (e.t > e.life + 0.25 || e.done) e.on = false;
  } else if (e.kind === 'fire') {
    e.acc += dt * 26;
    while (e.acc > 1) { e.acc -= 1; fireP(st, e.x + (R() - 0.5) * e.size, e.y + (R() - 0.5) * e.size * 0.7, 2, { v: 8, vz: 40 + R() * 30, r: e.size * 0.55, grow: 0.3, life: 0.55, heat: R() < 0.35 ? 0 : 1, drag: 1.5, alpha: 0.75 });
      if (R() < 0.18) puffP(st, e.x, e.y, 22, { tone: 'soot', v: 6, vz: 26, r: e.size * 0.6, grow: 1.2, life: 2, alpha: 0.28 });
      if (R() < 0.15) T._ember(st, e.x, e.y, 10, 1); }
    if (e.t > e.life || e.done) e.on = false;
  }
}
function updateImpl(dt, world) {
  if (!(dt > 0)) return; if (dt > 0.1) dt = 0.1;   // vern mot negative/enorme steg (fane i bakgrunnen)
  const st = state(world), pool = st.pool, P = pool.P; let live = 0; const u0 = typeof performance !== 'undefined' ? performance.now() : 0;
  if (st.flushMz) { try { st.flushMz(); } catch (e) { guard('flushMz', e); } }
  if (st.flushHits && st.pendHits?.length) { try { st.flushHits(); } catch (e) { guard('flushHits', e); st.pendHits.length = 0; } }   // reserve-treff (bind.js)
  for (let i = 0; i < pool.E.length; i++) if (pool.E[i].on) updEmitter(st, pool.E[i], dt);
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if (!p.on) continue;
    p.t += dt; if (p.t < p.delay) { live++; continue; }
    if (p.t - p.delay >= p.life) { p.on = false; continue; }
    live++;
    if (p.rest) continue;
    const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz = p.vz * (p.grav < 0 ? k : 1) - p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vrot * dt;
    if (p.mode === M_SPRITE || p.mode === M_FIRE) p.size *= 1 + p.grow * dt / Math.max(0.3, 1 + (p.t - p.delay) * 1.5);
    if (p.z < 0 && p.grav > 0) {
      if (p.mode === M_DROP) { p.on = false; if (p.land && st.quality > 0.3) { const sp = S.ichorSplat((i & 3)); decal(st, sp.base, sp.hot, p.x, p.y, Math.atan2(p.vy, p.vx), 3 + p.size * 1.6, 10, 2.5); } continue; }
      p.z = 0; p.vz = -p.vz * p.bounce; p.vx *= 0.55; p.vy *= 0.55; p.vrot *= 0.5;
      if (Math.abs(p.vz) < 25) { p.vz = 0; if (p.mode === M_SHARD) p.rest = true; else if (p.mode === M_STREAK) p.drag = 6; }
    }
  }
  for (const d of pool.D) if (d.on) { d.t += dt; if (d.t >= d.life) d.on = false; }
  pool.live = live; pool.taken = 0; autoMed(st, live, dt); if (live > pool.peak) pool.peak = live; setLoad(st, live); if (st.tickHot) st.tickHot(); if (st.tickPose) st.tickPose(); if (st.tickCue) st.tickCue(dt); if (u0) st.stats.updMs = performance.now() - u0;
}

// ---------------------------------------------------------------- tegning
let B = null;   // grunnmatrise (settes per draw-kall)
/** Sett transform = B · T(x,y) · R(rot) · S(sx,sy) uten save/restore. */
function xf(ctx, x, y, rot, sx, sy) {
  const c = Math.cos(rot), s = Math.sin(rot), a = sx * c, b = sx * s, cc = -sy * s, d = sy * c;
  ctx.setTransform(B.a * a + B.c * b, B.b * a + B.d * b, B.a * cc + B.c * d, B.b * cc + B.d * d, B.a * x + B.c * y + B.e, B.b * x + B.d * y + B.f);
}
function alphaOf(p) {
  const t = p.t - p.delay, k = t / p.life; let a = p.alpha;
  if (p.fadeIn > 0 && t < p.fadeIn) a *= t / p.fadeIn;
  a *= p.fadeOut >= 6 ? (k > 0.8 ? (1 - k) / 0.2 : 1) : Math.pow(1 - k, p.fadeOut);
  return a;
}
let QD = null, fillLeft = Infinity, PX = 1, LS = 1, LG = 1, VX0 = -1e9, VY0 = -1e9, VX1 = 1e9, VY1 = 1e9, FA = 0;   // FA: fylt flate (skjerm-px², målestørrelse uavhengig av maskinlast); V*: synlig verdensrektangel (utsnitt)
const vis = (x, y, r) => x + r > VX0 && x - r < VX1 && y + r > VY0 && y - r < VY1;   // aktivt nivå, gjenstående fyllbudsjett, skjermskala (settes per draw-kall)
function drawP(ctx, p) {
  const t = p.t - p.delay, k = t / p.life; let a = alphaOf(p); if (a <= QD.minA) return;
  if (!vis(p.x, p.y - p.z * Z, (p.size || 8) * 2.6 + (p.len || 0) + 24)) return;   // utenfor skjermen: hopp over (spillet har stort kart, test.html ikke)
  if (p.mode === M_GLOW || (p.mode === M_SPRITE && p.stretch !== -1)) {          // glød og røyk: skalert størrelse + fyllbudsjett
    const sc = p.mode === M_GLOW ? QD.glow * LG : QD.smoke * LS, r = p.size * sc * PX, area = 4 * r * r;
    if (area > fillLeft && a < 0.5) return; fillLeft -= area; FA += area;
  }
  const sx = p.x, sy = p.y - p.z * Z; ctx.globalAlpha = Math.min(1, a);
  switch (p.mode) {
    case M_SPRITE: {
      if (p.stretch === -1) { const L = p.size * 2.6, H = L * 0.75 * p.size2; xf(ctx, sx, sy, p.rot, 1, p.flip); ctx.drawImage(p.img, -L * 0.11, -H / 2, L, H); }
      else { const r = p.size * QD.smoke * LS; xf(ctx, sx, sy, p.rot, 1, p.size2); ctx.drawImage(p.img, -r, -r, r * 2, r * 2); }
      break;
    }
    case M_FIRE: {
      const img = S.flame(k < 0.35 ? p.heat : Math.min(2, p.heat + (k < 0.7 ? 1 : 2)), p.seed), r = p.size; xf(ctx, sx, sy, p.rot, 1, 1); ctx.drawImage(img, -r, -r, r * 2, r * 2); FA += 4 * r * r * PX * PX; break;
    }
    case M_GLOW: { const r = p.size * QD.glow * LG * (1 + 0.25 * k); xf(ctx, sx, sy, 0, 1, 1); ctx.drawImage(p.img, -r, -r, r * 2, r * 2); break; }
    case M_RING: { const e = 1 - (1 - k) * (1 - k) * (1 - k), r = p.size * (0.15 + 0.85 * e); xf(ctx, sx, sy, 0, 1, 1); ctx.drawImage(p.img, -r, -r, r * 2, r * 2); FA += 4 * r * r * PX * PX; break; }
    case M_STREAK: {
      // skjermfart: høyde gir y-komponent via zScale
      let vx = p.vx, vy = p.vy - p.vz * Z; if (p.vrot && p.grav < 0) { vx += Math.cos(p.seed + t * p.vrot) * 12; }
      const sp = Math.hypot(vx, vy), L = Math.max(p.size, sp * p.stretch) * 1.0, ang = Math.atan2(vy, vx);
      xf(ctx, sx, sy, ang, 1, 1); ctx.drawImage(p.img, -L, -p.size2 * 1.3, L * 1.06, p.size2 * 2.6); break;
    }
    case M_SHARD: {
      const r = p.size;
      if (p.z > 0.5 || p.rest) { ctx.globalAlpha = Math.min(1, a) * 0.35; xf(ctx, p.x + 0.6, p.y + 0.6, p.rot, 1, 0.6); ctx.drawImage(p.img, -r, -r, r * 2, r * 2); ctx.globalAlpha = Math.min(1, a); }
      xf(ctx, sx, sy, p.rot, 1, 0.75 + 0.25 * Math.abs(Math.sin(p.rot * 0.7))); ctx.drawImage(p.img, -r, -r, r * 2, r * 2); break;
    }
    case M_DROP: {
      const vx = p.vx, vy = p.vy - p.vz * Z, ang = Math.atan2(vy, vx), L = p.size * 2.4 + Math.hypot(vx, vy) * 0.012;
      xf(ctx, sx, sy, ang, 1, 1); ctx.drawImage(p.img, -L * 0.6, -p.size * 0.5, L, p.size); break;
    }
  }
}
function drawGlowForDrops(ctx, P) {
  const g = S.glow(255, 120, 40);
  for (let i = 0; i < P.length; i++) { const p = P[i]; if (!p.on || p.mode !== M_DROP || p.t < p.delay) continue; const r = p.size * 2.6; ctx.globalAlpha = 0.5; xf(ctx, p.x, p.y - p.z * Z, 0, 1, 1); ctx.drawImage(g, -r, -r, r * 2, r * 2); }
}
/** Baking av langlivede bakkedekaler (brennmerker o.l.) i ett lerret i verdensrom (1 px = 1 verdens-px). Spillet har world.bounds;
 *  test.html har ikke, og der tegnes som før. Bakte dekaler tegnes med ett drawImage per bilde (bare synlig utsnitt). */
const BAKE_MIN_LIFE = 15, BAKE_AGE = 0.4;
function bakeLayer(st, world) {
  const b = world?.bounds; if (!b || !(b.w ?? b.width) || typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
  const w = Math.min(4096, Math.ceil(b.w ?? b.width)), h = Math.min(4096, Math.ceil(b.h ?? b.height));
  if (!st.bake || st.bake.w !== w || st.bake.h !== h || st.bake.ox !== (b.x || 0) || st.bake.oy !== (b.y || 0)) { const c = S.makeCanvas(w, h); st.bake = { c, x: c.getContext("2d"), w, h, ox: b.x || 0, oy: b.y || 0, n: 0 }; }
  return st.bake;
}
function drawBaked(ctx, st, world) {
  const K = bakeLayer(st, world); if (!K) return null; const D = st.pool.D, bx = K.x;
  for (let i = 0; i < D.length; i++) { const d = D[i]; if (!d.on || d.baked || d.z > 0 || d.life < BAKE_MIN_LIFE || d.t < BAKE_AGE || (d.hot && Math.exp(-d.t / d.cool) > 0.02)) continue;
    const c = Math.cos(d.rot), s = Math.sin(d.rot), r = d.size; bx.setTransform(c, s, -s * d.sy, c * d.sy, d.x - K.ox, d.y - K.oy); bx.globalAlpha = d.alpha; bx.drawImage(d.img, -r, -r, r * 2, r * 2); d.baked = true; K.n++; }
  if (K.n) { const x0 = Math.max(0, VX0 - K.ox), y0 = Math.max(0, VY0 - K.oy), x1 = Math.min(K.w, VX1 - K.ox), y1 = Math.min(K.h, VY1 - K.oy);
    if (x1 > x0 && y1 > y0) { ctx.globalAlpha = 1; ctx.setTransform(B); ctx.drawImage(K.c, x0, y0, x1 - x0, y1 - y0, x0 + K.ox, y0 + K.oy, x1 - x0, y1 - y0); FA += (x1 - x0) * (y1 - y0) * PX * PX; } }
  return K;
}
function drawDecals(ctx, st, wall) {
  const D = st.pool.D;
  for (let i = 0; i < D.length; i++) { const d = D[i]; if (!d.on || d.baked || (d.z > 0) !== wall || !vis(d.x, d.y - d.z * Z, d.size * 1.5)) continue; const fade = Math.min(1, (d.life - d.t) / Math.min(3, d.life * 0.3)); FA += 4 * d.size * d.size * PX * PX; ctx.globalAlpha = fade * d.alpha; const r = d.size; xf(ctx, d.x, d.y - d.z * Z, d.rot, 1, d.z > 0 ? 1 : d.sy); ctx.drawImage(d.img, -r, -r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'lighter';
  const hf = Math.min(1, (LG - 0.84) / 0.1); if (QD.decalHot && hf > 0.02) for (let i = 0; i < D.length; i++) { const d = D[i]; if (!d.on || !d.hot || (d.z > 0) !== wall || !vis(d.x, d.y - d.z * Z, d.size * 1.5)) continue; const h = Math.exp(-d.t / d.cool); if (h < 0.02) continue; ctx.globalAlpha = h * d.hotA * hf; const r = d.size; xf(ctx, d.x, d.y - d.z * Z, d.rot, 1, d.sy); ctx.drawImage(d.hot, -r, -r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'source-over';
}
function drawCracks(ctx, st, time) {
  const E = st.pool.E;
  for (let i = 0; i < E.length; i++) {
    const e = E[i]; if (!e.on || e.kind !== 'crack') continue;
    const C = S.crack(e.v), k = Math.max(0, Math.min(1, e.p || 0)), stg = Math.min(3, Math.floor(k * 4)), sub = k * 4 - stg, r = 42 * e.size * (0.85 + 0.15 * k);
    const out = e.t > e.life ? Math.max(0, 1 - (e.t - e.life) / 0.25) : 1;
    xf(ctx, e.x, e.y, 0, 1, 1);
    ctx.globalAlpha = out; ctx.drawImage(C.stages[stg].dark, -r, -r, r * 2, r * 2);
    if (stg < 3 && sub > 0.5) { ctx.globalAlpha = out * (sub - 0.5) * 2; ctx.drawImage(C.stages[stg + 1].dark, -r, -r, r * 2, r * 2); }
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.75 + 0.25 * Math.sin(time * (10 + 16 * k) + i), gi = (0.35 + 0.65 * k) * pulse * out;
    ctx.globalAlpha = Math.min(1, gi); ctx.drawImage(C.stages[stg].glow, -r, -r, r * 2, r * 2);
    const gf = Math.min(1, (LG - 0.86) / 0.1); if (gf > 0.02) { const gl = S.glow(255, 100, 35), gr = r * (1.4 + 0.6 * k) * LG; ctx.globalAlpha = 0.35 * gi * gf; ctx.drawImage(gl, -gr, -gr, gr * 2, gr * 2); }   // 26.10: stor sprekk-glød droppes i tung kamp
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Tegn ett lag. 'under' = bakke (dekaler, sprekker, bakkelys, sjokkring); 'over' = alt i lufta. ctx har kameratransform. */
function drawImpl(ctx, world, camera, layer = 'over') {
  const st = state(world), P = st.pool.P, L = layer === 'under' ? L_UNDER : L_OVER; if (st.timeFlush) ctx.getImageData(0, 0, 1, 1);   // timeFlush: tøm GPU/raster-køen før og etter → ærlig tid for VFX alene (kun måling)
  const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  ctx.save(); B = ctx.getTransform(); let n = 0; QD = st.autoMed ? QUALITY.medium : st.Q; FA = 0;
  try { const ld = st.load || 0; LS = 1 - 0.14 * ld; LG = 1 - 0.18 * ld; PX = Math.hypot(B.a, B.b) || 1;
  if (!B.b && !B.c && B.a > 0 && B.d > 0) { const cw = ctx.canvas?.width || 1e5, ch = ctx.canvas?.height || 1e5; VX0 = -B.e / B.a; VY0 = -B.f / B.d; VX1 = VX0 + cw / B.a; VY1 = VY0 + ch / B.d; } else { VX0 = VY0 = -1e9; VX1 = VY1 = 1e9; }
  fillLeft = Math.min(QD.fill, (1 - ld) * 1.6e6 + ld * 0.9e6);   // 26.10: fyllbudsjett også på high (enheter: skjerm-px²; skjermen er 1,6 M). Målt i spillet: tung p95 2,9 M px² i over-laget
  if (L === L_UNDER) { drawBaked(ctx, st, world); drawDecals(ctx, st, false); drawCracks(ctx, st, world.time || 0); } else drawDecals(ctx, st, true);   // vegg-dekaler: se EFFEKTER.md (dekklag-krok)
  // pass 1: normal blending (røyk, støv, splinter), pass 2: additiv (ild, glød, gnister)
  // Én gjennomgang i bassengrekkefølge (≈ fødselsrekkefølge): røyk født etter ildkula kan dekke den. Bytter blandemodus bare ved endring.
  let add = false; ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if (!p.on || p.layer !== L || p.t < p.delay) continue;
    if (p.add !== add) { add = p.add; ctx.globalCompositeOperation = add ? 'lighter' : 'source-over'; }
    drawP(ctx, p); n++;
  }
  ctx.globalCompositeOperation = 'lighter'; if (L === L_OVER && QD.dropGlow) drawGlowForDrops(ctx, P);
  } finally { ctx.setTransform(B); ctx.restore(); }   // canvas-tilstanden er alltid tilbake, også ved feil
  if (st.timeFlush) ctx.getImageData(0, 0, 1, 1);
  if (L === L_UNDER) st.stats.fillUnder = FA; else st.stats.fillOver = FA;
  st.stats.drawn = n; if (t0) { st.stats.ms = performance.now() - t0; if (L === L_UNDER) st.stats.underMs = st.stats.ms; else st.stats.overMs = st.stats.ms; }
}
export function clear(world) { const st = state(world); st.bake = null; for (const p of st.pool.P) p.on = false; for (const d of st.pool.D) d.on = false; for (const e of st.pool.E) e.on = false; }
export function stats(world) { const st = state(world); return { level: st.level, live: st.pool.live, peak: st.pool.peak, dropped: st.pool.dropped, cap: MAX_PARTICLES, decals: st.pool.D.filter((d) => d.on).length, spawns: st.stats.spawns, drawn: st.stats.drawn, ms: st.stats.ms }; }
/** setQuality(world, 'high'|'medium'|'low') eller et tall 0.25–1 (bare tetthet; nærmeste nivå for resten). */
export function setQuality(world, q) {
  const st = state(world);
  if (typeof q === 'string' && QUALITY[q]) { st.level = q; st.Q = QUALITY[q]; st.quality = st.Q.q; return; }
  st.quality = Math.max(0.25, Math.min(1, +q || 1)); st.level = st.quality >= 0.85 ? 'high' : st.quality >= 0.58 ? 'medium' : 'low'; st.Q = QUALITY[st.level];
}
export function getQuality(world) { return state(world).level; }

// ---------------------------------------------------------------- feilsikre innganger (kjøres i spillets loop: må aldri kaste)
// Ved feil: én logglinje per inngang (ikke spam), effekten hoppes over, spillet går videre.
const warned = new Set();
export function guard(where, e) { if (warned.has(where)) return; warned.add(where); try { console.warn(`[vfx] ${where} feilet – effekter hoppes over:`, e && e.message ? e.message : e); } catch (_) { /* ingen konsoll */ } }
export function init(world, opts) { try { return initImpl(world, opts || {}); } catch (e) { guard('init', e); return null; } }
export function spawn(world, type, params) { try { return spawnImpl(world, type, params || {}); } catch (e) { guard('spawn:' + type, e); return false; } }
export function update(dt, world) { try { updateImpl(dt, world); } catch (e) { guard('update', e); } }
export function draw(ctx, world, camera, layer) { try { drawImpl(ctx, world, camera, layer); } catch (e) { guard('draw:' + layer, e); } }

export { bindEvents } from './bind.js';
