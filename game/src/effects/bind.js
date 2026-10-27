// BREACH – Effekter: kobling world.events → spawn(). Kobles inn fra core/loop.js (se reviews/diffs/core-loop-effects.diff).
// Nyttelaster sjekket mot koden 23.10.2026: weapons/index.js (weaponFire), core/combat.js (shot, coverHit, projectileHit, death),
// weapons/melee.js (melee rev. 5/6 med hits[]), weapons/grenades.js (explosion), enemies/spawn.js (spawnWarn, spawnRise), levels (levelStart, restart).
// opts slår av typer som i dag tegnes av andre (unngå dobbeltegning under migreringen):
//   { muzzle, impacts, blood, death, explosion, melee, spawn, flash }  (standard: MIGRATION nedenfor; flash=true = VFX tegner også glimtformen)
import { spawn, state, clear, guard, MUZZLE_Z, HIT_Z } from './index.js';   // MUZZLE_Z/HIT_Z: bare reserve når payloaden mangler z
import { pointHidden } from '../core/combat.js';   // samme okklusjonsregel som core og weapons/view34 (Revisjon 6)
import { PROJ } from '../shared/projection.js';
import { drawDecalHot, HOT_TIME } from './decals.js';
import { bindCoverPose } from './coverpose.js';

/** Visuell størrelse per fiendetype (enemies/stats.js). */
export const TYPE_SIZE = { grunt: 1, flanker: 0.9, heavy: 1.35, grenadier: 1, kilnAlpha: 1.5, ashmaw: 1.4 };
const sizeOf = (type) => TYPE_SIZE[type] ?? 1;
/**
 * Migreringsstatus (docs/EFFEKTER.md, migreringsplan). Det som fortsatt tegnes av eieren står false, så ingenting tegnes to ganger.
 * VFX slår på en type her når eierens diff er inne – core/loop.js trenger ikke endres igjen.
 *  blood/death/spawn: steg 3/3b/4 (diffene weapons-fx-red-blood.diff og enemies-render-spawnwarnings.diff)
 *  impacts (dekningstreff) steg 5 · explosion steg 6 · muzzle (lys/røyk, flash:false) steg 7 · melee steg 8
 */
export const MIGRATION = { blood: true, death: true, spawn: true, muzzle: true, impacts: true, explosion: true, melee: true };   // muzzle = bare lys/røyk/gnister (flash:false)
export function bindEvents(world, opts = {}) {
  try { return bindImpl(world, opts || {}); } catch (e) { guard('bindEvents', e); return () => {}; }
}
function bindImpl(world, opts) {
  const st = state(world), ev = world.events, on = (t, f) => offs.push(ev.on(t, (p) => { try { f(p); } catch (e) { guard('on:' + t, e); } })), O = { ...MIGRATION, ...opts };
  const offs = []; if (st.offs) st.offs(); const lastFire = new WeakMap();
  // Hva VFX eier nå: eiernes differ sjekker world._vfx?.owns?.<gruppe> og hopper over sin gamle versjon (av når VFX er av).
  st.owns = { muzzle: !!O.muzzle, impacts: !!O.impacts, explosion: !!O.explosion, melee: !!O.melee, blood: !!O.blood, spawn: !!O.spawn, death: !!O.death };
  const zOf = (p) => Number.isFinite(p?.z) && p.z > 0 ? p.z : (p?.entity && (p.entity.crouch || p.entity.inCover || p.entity.posture === 'crouch') ? 17 : MUZZLE_Z);
  // Okklusjon (34): punkt bak høy dekning → luftlaget flyttes under dekningen (index.js spawnImpl). Billig: én løkke over dekning per spawn.
  const hid = (x, y, z) => { try { return world.view === '34' && pointHidden(world, x, y + 0.01, z); } catch (_) { return false; } };
  if (O.muzzle) {
    // weaponFire: én per avtrekk med munningsposisjon og z fra Våpen (dekker både spiller og fiender via tryFire)
    // Plassering: draw:{x,y,z} = den tegnede løpstuppen (weaponFire, Våpen 23.10) → glimt-lys, røyk og gnister sitter på løpet. Reserve: x, y, z.
    const fin = Number.isFinite;
    const mz = (p) => { const d = p.draw, ok = d && fin(d.x) && fin(d.y), x = ok ? d.x : p.x, y = ok ? d.y : p.y, z = ok && fin(d.z) && d.z > 0 ? d.z : zOf(p);
      spawn(world, 'muzzle', { x, y, z, angle: p.angle, weapon: p.weapon, team: p.team, flash: O.flash === true, hidden: hid(x, y, z) }); };
    on('weaponFire', (p) => { if (!p) return; if (p.entity) lastFire.set(p.entity, world.time); mz(p); });
    // shot uten weaponFire samme steg (testsider eller andre kilder)
    // core sender 'shot' FØR Våpen sender weaponFire samme avtrekk → shot legges i kø og tegnes bare hvis ingen weaponFire kom samme steg (ellers dobbelt glimt)
    const pendMz = [];
    on('shot', (p) => { const e = p?.entity; if (!p || (e && lastFire.get(e) === world.time)) return; pendMz.push([p, world.time]); });
    st.flushMz = () => { for (const [p, t] of pendMz) { const e = p.entity; if (!(e && (lastFire.get(e) ?? -1) >= t)) mz(p); } pendMz.length = 0; };
  }
  // ---- Treff. Våpen sender 'bulletImpact' {kind:'cover'|'body', x, y, z, angle, normal, surface, power, cover, target, projectile}
  // fra sine coverHit/projectileHit-lyttere (punktet er flyttet 1,5 px ut av flaten, z klippet til dekningshøyden).
  // Den er hovedkilden. coverHit/projectileHit brukes bare som reserve når ingen bulletImpact kommer (testsider, Våpen av):
  // de legges i kø og spilles i update() bare hvis samme prosjektil ikke fikk en bulletImpact i mellomtiden. Ingen dobbel spawn.
  const seen = new WeakSet(), pend = []; st.pendHits = pend; st.sawBI = false;
  const wantBody = (enemy) => enemy ? O.blood : O.impacts;
  const coverImpact = (x, y, z, angle, c, surface, power, partial, handled) => {
    // Arenas krok: hullet bakes inn i dekningens sprite (riktig flate, klippet). Uten krok: egen vegg-dekal (fallback, 'over'-laget).
    // handled: Våpen har lagt kulehullet selv (bulletImpact.decalHandled, egen grense via Arenas krok) → bare gnister/støv her.
    const hp = c && !partial ? coverDecal(world, st, c, x, y, (k) => k === 'metal' ? 'bullet_metal' : 'bullet_concrete', 2.2 + st.rng() * 1.4, z, !!handled) : null;   // handled: ingen addCoverDecal, men varm glød (hotDecals) er fortsatt vår
    if (hp) { surface = hp.material || surface; if (!(z > 0) && Number.isFinite(hp.z)) z = hp.z; }
    if (!(z > 0)) z = HIT_Z;
    spawn(world, 'impact', { x, y, z, angle, surface, power, partial: !!partial || !!hp || !!handled, hidden: hid(x, y, z) });
  };
  const bodyImpact = (x, y, z, angle, tg, enemy, power, surface) => {
    if (!(z > 0)) z = tg?.height ? tg.height * 0.55 : HIT_Z;
    spawn(world, 'impact', { x, y, z, angle, surface: enemy ? (surface === 'flesh' ? 'chitin' : surface || 'chitin') : 'metal', power: (power ?? 1) * (enemy ? 1 : 0.6), partial: true, hidden: hid(x, y, z) });
  };
  if (O.impacts || O.blood) {
    on('bulletImpact', (p) => {
      if (!p) return; st.sawBI = true; const pr = p.projectile; if (pr) { if (seen.has(pr) && p.kind === 'cover') return; seen.add(pr); }
      if (p.kind === 'cover') { if (O.impacts) coverImpact(p.x, p.y, p.z, p.angle, p.cover, p.surface, p.power ?? 1, p.partial, p.decalHandled === true); return; }
      const enemy = (p.target?.team ?? (p.team === 'player' ? 'enemy' : 'player')) === 'enemy'; if (!wantBody(enemy)) return;
      bodyImpact(p.x, p.y, p.z, p.angle, p.target, enemy, p.power, p.surface);
    });
    // reserve (bare uten bulletImpact): kø → update
    const q = (kind, p) => { if (!p?.projectile || p.projectile.kind === 'grenade' || st.sawBI) return; pend.push({ kind, p }); };
    on('coverHit', (p) => O.impacts && q('cover', p));
    on('projectileHit', (p) => q('body', p));
    st.flushHits = () => {
      for (let i = 0; i < pend.length; i++) {
        const { kind, p } = pend[i], pr = p.projectile; if (seen.has(pr) || st.sawBI) continue; seen.add(pr);
        if (kind === 'cover') { const c = p.cover; coverImpact(p.x, p.y, p.z, pr.angle, c, c?.material || c?.surface || (c?.type === 'high' ? 'metal' : 'concrete'), pr.wfx?.impact ?? 1, p.partial, p.decalHandled === true || pr.decalHandled === true); }
        else { const tg = p.target, enemy = tg?.team === 'enemy'; if (wantBody(enemy)) bodyImpact(p.x, p.y, p.z, pr.angle, tg, enemy, pr.wfx?.impact ?? 1, tg?.material); }
      }
      pend.length = 0;
    };
  }
  if (O.death) on('death', (p) => { const t = p?.target; if (!t || t.team !== 'enemy') return; const pr = p.source?.projectile; spawn(world, 'death', { x: t.x, y: t.y, angle: pr ? pr.angle : (t.deathAngle ?? 0), size: sizeOf(t.type) }); });
  if (O.explosion) on('explosion', (p) => p && spawn(world, 'explosion', { x: p.x, y: p.y, z: p.z || 0, kind: p.kind || 'frag', radius: p.radius ?? 90 }));
  if (O.melee) on('melee', (p) => {
    // fase 'hit' kommer i kontaktøyeblikket (T.contactAt) – samme steg som Lyd bør spille slaget
    if (!p || p.phase !== 'hit') return;
    const H = p.hits || [];
    if (!H.length) { spawn(world, 'melee', { x: p.x + Math.cos(p.angle) * 30, y: p.y + Math.sin(p.angle) * 30, ox: p.x, oy: p.y, angle: p.angle, hit: false, team: p.team }); return; }
    for (const h of H) {
      const t = h.target, a = Number.isFinite(h.angle) ? h.angle : Math.atan2((h.y ?? t?.y) - p.y, (h.x ?? t?.x) - p.x), rr = (t?.radius || 14) * 0.6;
      const x = Number.isFinite(h.x) ? h.x : t.x - Math.cos(a) * rr, y = Number.isFinite(h.y) ? h.y : t.y - Math.sin(a) * rr;
      const z = Number.isFinite(h.z) && h.z > 0 ? h.z : (p.z || 24);
      spawn(world, 'melee', { x, y, z, hidden: hid(x, y, z), ox: p.x, oy: p.y, angle: a, hit: true, team: p.team, power: h.power ?? h.impact ?? p.power, killed: !!(h.killed || (t && t.hp <= 0)), surface: h.surface || (t?.team === 'player' ? 'player' : 'chitin') });
    }
  });
  if (O.spawn) {
    on('spawnWarn', (p) => p && spawn(world, 'crack', { x: p.x, y: p.y, t: p.t, id: p.id, size: sizeOf(p.type), hidden: hid(p.x, p.y, 2) }));
    on('spawnRise', (p) => p && spawn(world, 'rise', { x: p.x, y: p.y, id: p.id, size: sizeOf(p.type), hidden: hid(p.x, p.y, 2) }));   // 27.10: bak høy dekning → under-laget (ellers lekker grus over containertaket)
  }
  bindCoverPose(world, st, on);   // Warden over dekning: støv i kanten + eksponerte treffgnister (coverpose.js)
  installHotHook(world, st);
  // ny bane / omstart: tøm partikler og dekaler (Levels nullstiller verden)
  on('levelStart', () => clear(world)); on('restart', () => clear(world));
  on('arenaLoaded', () => { st.hot.length = 0; });
  st.offs = () => { for (const f of offs) f(); offs.length = 0; st.offs = null; st.owns = null; st.flushHits = null; st.flushMz = null; st.tickPose = null; st.tickCue = null; };
  return st.offs;
}

// ---------------------------------------------------------------- Arenas dekningskrok (feature-deteksjon, fallback når den mangler)
// coverHitPoint(world, cover, hitX, hitY, z?) → { coverId, face: 'front'|'top'|'side', x, z, material, nx, ny, angle }
// addCoverDecal(world, coverId, { x, y?, z, kind, r, angle, seed }) – Arena kaller drawDecalSprite (decals.js) når den baker.
// world.arena.onCoverDraw(ctx, o, world) kalles i drawSorted rett etter objektet når o.hotDecals er sann (vi setter/nullstiller).
export function arenaHook(world) {
  const A = world.modules?.arena;
  return A && typeof A.coverHitPoint === 'function' && typeof A.addCoverDecal === 'function' ? A : null;
}
/** Legg en dekal på dekningen via kroken. → treffpunktet (hp) hvis kroken tok den, ellers null (kalleren bruker fallback). */
export function coverDecal(world, st, cover, x, y, kindOf, r, z, noAdd = false) {   // noAdd: Våpen la hullet; vi tar bare varm glød
  const A = arenaHook(world); if (!A) return null;
  // z fra bulletImpact (5. argument, Arena 26.10). Toppflate: Arena legger dekalen der når y og z ≥ objekthøyden (nordflaten regnes som 'top').
  const hp = A.coverHitPoint(world, cover, x, y, Number.isFinite(z) ? z : undefined); if (!hp || hp.coverId == null) return null;
  const kind = typeof kindOf === 'function' ? kindOf(hp.material) : kindOf, seed = Math.floor(st.rng() * 1e6), angle = hp.angle ?? 0;
  if (!noAdd) A.addCoverDecal(world, hp.coverId, { x: hp.x, y: hp.y ?? y, z: hp.z, kind, r, angle, seed });
  const life = HOT_TIME[kind]; if (life && hp.face === 'front') addHot(world, st, hp.coverId, { kind, r, angle, seed, x: hp.x, z: hp.z, t0: world.time || 0, life });
  return hp;
}
function coverObj(world, id) {
  const L = world.modules?.arena?.coverObjects?.(world) || world.arena?.objects || world.cover || [];
  for (const o of L) if (o && o.id === id) return o; return null;
}
function addHot(world, st, coverId, e) {
  if (!world.arena || !st.hotHook) return;   // uten onCoverDraw-krok: bare kald dekal
  if (st.hot.length > 24) st.hot.shift(); e.coverId = coverId; e.o = coverObj(world, coverId); st.hot.push(e); if (e.o) e.o.hotDecals = true;
}
/** Kalles fra update via st.tickHot: slukker o.hotDecals når varmen er borte. */
function tickHot(world, st) {
  const now = world.time || 0;
  for (let i = st.hot.length - 1; i >= 0; i--) { const e = st.hot[i]; if (now - e.t0 < e.life) continue; st.hot.splice(i, 1); if (e.o && !st.hot.some((h) => h.o === e.o)) e.o.hotDecals = false; }
}
function installHotHook(world, st) {
  st.hot = st.hot || []; st.hotHook = false; st.tickHot = () => tickHot(world, st);
  if (!world.arena || typeof world.arena !== 'object') return;
  st.hotHook = true;
  world.arena.onCoverDraw = (ctx, o) => {
    try {
      const now = world.time || 0, base = (o.y ?? 0) + (o.h ?? 0);   // forsiden: nederkant av fotavtrykket, høyde z opp (PROJ)
      for (const e of st.hot) { if (e.o !== o && e.coverId !== o.id) continue; const heat = Math.pow(1 - (now - e.t0) / e.life, 1.5); if (heat <= 0) continue;
        const tr = ctx.getTransform(); ctx.translate(e.x, base - e.z * PROJ.zScale); drawDecalHot(ctx, e.kind, e.r, e.angle, e.seed, heat); ctx.setTransform(tr); }
    } catch (err) { guard('onCoverDraw', err); }
  };
}
