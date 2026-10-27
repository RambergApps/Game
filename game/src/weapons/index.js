// BREACH – våpensystem (eies av Breach Våpen). Se docs/VAPEN.md for tall, begrunnelse og integrasjon.
//
// Modulkontrakt: init(world), update(dt, world), draw(ctx, world, camera)  (+ drawHud-hjelpere i hud.js)
// Hoved-API (godkjent av Breach):
//   createLoadout(entity, ids?, opts?)            → loadout (lagres på entity.loadout)
//   tryFire(world, entity, {aimAngle, aiming, inCover, blind, posture, moving, muzzle}) → {fired, reason}
//   startReload(world, entity) / reload(world, entity)  (reload = R-trykk: start, eller aktiv reload-forsøk)
//   switchWeapon(world, entity, slot|'next'|'prev'|id)
//   getMuzzle(entity, angle?) → {x, y, z?, angle}   (entity.muzzle → data.js)   getMuzzleDraw(entity) → entity.muzzleDraw → getMuzzle
//   current(entity) → ammo/reload/bytte-status for tegning og HUD
//   throwGrenade(world, entity, tx, ty | {angle, power})   (oppladning TUNING.grenade.windup; granatlogikk i grenades.js)
//   tryMelee(world, entity, angle) → bool        (kolbeslag, melee.js; TUNING.melee)
//   refill(world, entity, opts?) → bool / needsRefill(...)  (ammokasser i crates.js; TUNING.ammoCrate)
//   createEnemyLoadout(enemy, world) · previewDamage(entity, dist) · isReloading(entity)
//   tryMelee(world, entity, angle, {dmg, stagger}?)
// Tynne aliaser (navn bestilt av Breach): getWeapon(id), fire(world, shooter, aimAngle, opts?)
//
// Hendelser (world.events):
//   'shot'          sendes av core spawnProjectile ÉN gang per avtrekk: {projectile, owner, team, entity, weapon, pellets, x, y, angle}.
//                   Hagla lager hagl nr. 2..n som kloner av første kule (CORE-API.md), så kjernen sender bare én 'shot'. Lyd bruker DENNE.
//   'weaponFire'    {x, y, z, draw:{x,y,z} (tegnet løpstupp, til glimt), angle, team, weapon, entity, pellets, shotId, posture, steady, charge}  (samme øyeblikk; for animasjon/
//                   statistikk – IKKE for lyd)
//   'chamber'       {weapon, x, y, team, entity}               – pumpe (hagle) / bolt (presisjon) etter skuddet
//   'reload'        {weapon, phase:'start'|'active'|'end', entity, x, y, team, time?, result?}
//                   start: time = ladetid · active: result 'perfect'|'good'|'fail' · end: result 'perfect'|'good'|'fail'|'normal'|'cancel'
//                   ('cancel' = avbrutt av kolbeslag eller ammokasse; magasinet ble ikke fylt av ladingen)
//   'melee'         {entity, x, y, angle, phase:'start'|'hit'|'end', targets, team}  – 'hit' alltid (targets [] = bom)
//   'refill'        {entity, x, y, crateId, team}               – ammokasse brukt
//   'activeReload'  {entity, weapon, result, x, y, team}       – tillegg (samme øyeblikk som reload/active)
//   'weaponSwitch'  {entity, from, to, weapon, x, y, team}
//   'dryFire'       {entity, weapon, x, y, team}
//   'grenade'       {phase:'windup'|'throw', x, y, angle, power, team, owner, entity, weapon:'grenade', windup? | grenade?}
//                   windup = kastet starter (windup = sekunder til slipp) · throw = granaten slippes (lyd: kast-sus her)
//   'explosion'     {x, y, radius, team, owner, entity, weapon:'grenade', surface, hits}
//   'grenadeBounce' {x, y, grenade, team}
import { spawnProjectile, segmentRect, projectileZ } from '../core/index.js';
import { WEAPONS, ENEMY_WEAPONS, GRENADE, PLAYER_LOADOUT, TUNING, falloffMult } from './data.js';
import * as fx from './fx.js';
import * as camfx from './camfx.js';
import { spawnGrenade, updateGrenades, drawGrenades, predictGrenade, explode } from './grenades.js';
import { drawHud, drawReticle, drawWorldReloadBar, drawGrenadeArc } from './hud.js';
import { updateCrates, drawCrates } from './crates.js';
import { startMelee, updateMelee, meleeState, canMelee, meleeStats } from './melee.js';
import { assistAim } from './aimassist.js';
import { muzzleZ, bodyHitZ, coverHeight } from './view34.js';
import { PROJ } from '../shared/projection.js';

export { meleeState, canMelee, meleeStats };
export { WEAPONS, ENEMY_WEAPONS, GRENADE, PLAYER_LOADOUT, TUNING, falloffMult, spawnGrenade, predictGrenade, explode, drawHud, drawReticle, drawGrenadeArc };
const DEG = Math.PI / 180;
// Grunnlaget for oppgraderinger = levels/upgrades.js BASE_STATS, som selv leser AR-9 (WEAPONS.rifle). Uten oppgradering er
// multiplikatoren nøyaktig 1,0; med oppgradering skaleres alle tre våpen relativt (round(w.mag × magSize/BASE_MAG)).
const BASE_MAG = WEAPONS.rifle.mag, BASE_RELOAD = WEAPONS.rifle.reloadTime;
import { initCoverDecals } from './decals.js';
let SHOT_ID = 0;

// ------------------------------------------------------------------ oppsett
function sys(world) {
  if (world._weapons) return world._weapons;
  const W = (world._weapons = { loadouts: [], live: [], tick: -1, worldBar: true, offs: [], stats: { updates: 0, skipped: 0, draws: 0 } });   // stats: for å oppdage dobbeltkall
  const on = (t, f) => W.offs.push(world.events.on(t, f));
  // Rev. 6: core sender nå z i 'shot'. Denne reserven gjør bare noe med en eldre core uten z (ingen dobbel verdi).
  on('shot', (ev) => { if (ev && ev.z === undefined) ev.z = ev.projectile?.z ?? 0; });
  // Treffeffekter for ALLE prosjektiler (spillerens og fiendenes).
  // Hitstop når spilleren dreper med et våpen som har TUNING.killHitstop (M-4).
  on('death', ({ target, source }) => {
    const p = source?.projectile; if (!p || p.team !== 'player' || target?.team === 'player') return;
    camfx.hitstop(world, TUNING.killHitstop?.[p.weapon] || 0);
  });
  // Respawn (Breach-beslutning 23.10, P1 fra Test): fullt magasin + full reserve i alle våpen, minst 1 granat, all våpentilstand nullstilt.
  // player.respawn() har ingen egen hendelse i dag; den sender playerState {from:null, to:'move', entity}, og det gjør bare respawn.
  // 'playerRespawn'/'respawn' {entity} støttes også, hvis Karakter/levels innfører et eget navn. Samme spawn dedupliseres per world.time.
  const onRespawn = (p) => { const ent = p?.entity ?? p?.player ?? world.player; if (ent && ent.team !== 'enemy') resupplyOnRespawn(world, ent); };
  on('playerState', (p) => { if (p && p.from === null && p.to === 'move') onRespawn(p); });
  on('playerRespawn', onRespawn); on('respawn', onRespawn);
  // Rev. 6: treffet regnes ut her (x, y, z, normal, surface) og sendes som 'bulletImpact', så VFX kan tegne uten å regne selv.
  // Core sin coverHit/projectileHit har ikke z/surface (core-forslag i review); p.z og p.weapon står på prosjektilet.
  initCoverDecals(world, on);   // før bulletImpact-lytteren under, så decalHandled er satt når VFX får hendelsen
  on('coverHit', ({ projectile: p, cover, x, y, z: cz, partial }) => {
    if (!p || p.kind === 'grenade') return;
    let hx = x, hy = y;
    if (partial && cover) { const t = segmentRect(p.ox, p.oy, x, y, cover); if (t !== null) { hx = p.ox + (x - p.ox) * t; hy = p.oy + (y - p.oy) * t; } }
    const n = coverNormal(cover, hx, hy, p.angle);
    hx += n.nx * 1.5; hy += n.ny * 1.5;   // like utenfor flaten (ellers regnes punktet som inne i boksen og skjules i 34)
    // z fra core (impactZ: kulas høyde klippet til dekningshøyden); reserve for eldre core: samme regel her
    const H = coverHeight(cover), z = Number.isFinite(cz) ? cz : Math.max(2, Math.min(projectileZ(p), H - 2));
    const surface = cover?.material || cover?.surface || world.arena?.surfaceAt?.(world, hx, hy) || (cover?.type === 'high' ? 'metal' : 'concrete');
    const power = (p.wfx?.impact ?? 0.8) * (partial ? 0.8 : 1);
    world.events.emit('bulletImpact', { kind: 'cover', x: hx, y: hy, z, angle: p.angle, normal: n, surface, weapon: p.weapon ?? null, team: p.team,
      damage: 0, power, partial: !!partial, cover, projectile: p, targetId: null, decalHandled: !!p.decalHandled });
    if (TUNING.fx?.impacts !== false) fx.impactCover(world, hx, hy, p.angle, surface, power, p.team, partial, z);
  });
  on('projectileHit', ({ projectile: p, target, x, y, z: hz }) => {
    if (!p) return;
    const tTeam = target?.team || (p.team === 'player' ? 'enemy' : 'player'), z = bodyHitZ(target, Number.isFinite(hz) ? hz : projectileZ(p));
    const surface = target?.material || (tTeam === 'enemy' ? 'chitin' : 'metal');   // monstrene er kitin etter kursendringen; Warden = rustning
    const power = p.wfx?.impact ?? 0.8, d = Math.hypot(x - p.ox, y - p.oy);
    world.events.emit('bulletImpact', { kind: 'body', x, y, z, angle: p.angle, normal: { nx: -Math.cos(p.angle), ny: -Math.sin(p.angle) }, surface,
      weapon: p.weapon ?? null, team: p.team, damage: p.dmgAt ? p.dmgAt(d) : p.dmg, power, partial: false, target, targetId: target?.id ?? null, projectile: p });
    if (TUNING.fx?.impacts !== false) fx.impactBody(world, x, y, p.angle, power, tTeam, z);
  });
  return W;
}

export function init(world) { sys(world); }

/** Utovervendt normal for et treff på et cover-rektangel (nærmeste kant; ved hjørne: kanten kula kom mot). */
function coverNormal(c, x, y, angle) {
  if (!c || !Number.isFinite(c.w)) return { nx: -Math.cos(angle), ny: -Math.sin(angle) };
  const d = [Math.abs(x - c.x), Math.abs(x - (c.x + c.w)), Math.abs(y - c.y), Math.abs(y - (c.y + c.h))];
  const N = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let best = -1, bd = Infinity;
  for (let i = 0; i < 4; i++) { const facing = N[i][0] * Math.cos(angle) + N[i][1] * Math.sin(angle) < 0; if (facing && d[i] < bd) { bd = d[i]; best = i; } }
  if (best < 0) best = d.indexOf(Math.min(...d));
  return { nx: N[best][0], ny: N[best][1] };
}

/** Våpendata for id (alias bestilt av Breach). team !== 'player' slår opp fiendeprofilen først. */
export function getWeapon(id, team = 'player') { return (team !== 'player' && ENEMY_WEAPONS[id]) || WEAPONS[id] || ENEMY_WEAPONS[id] || null; }
function resolveDef(id, enemy, overrides) {
  const d = (enemy && ENEMY_WEAPONS[id]) || WEAPONS[id] || ENEMY_WEAPONS[id];
  if (!d) throw new Error(`[weapons] ukjent våpen '${id}'`);
  return overrides ? { ...d, ...overrides } : d;
}

/**
 * Lag våpensett. ids: liste av våpen-id-er (standard PLAYER_LOADOUT). opts: { grenades, full:true }
 * Lagrer på entity.loadout og registrerer for update().
 */
export function createLoadout(entity, ids = PLAYER_LOADOUT, opts = {}, world = null) {
  const enemy = opts.enemy ?? (entity.team != null && entity.team !== 'player');
  const L = {
    slots: ids.map((id) => { const d = resolveDef(id, enemy, opts.overrides); return { id, def: d, mag: d.mag, reserve: d.reserve }; }),
    enemy, infinite: opts.infiniteAmmo ?? (enemy && !ids.some((id) => resolveDef(id, enemy, opts.overrides).limitedMag)),   // rev. 4: limitedMag-profiler lader
    index: 0, cooldown: 0, switchT: 0, switchTotal: 0, reload: null, lastResult: null, lastResultT: 0,
    bloom: 0, kick: 0, aimT: 0, aiming: false, trigger: false, wasHeld: false, queued: null,
    bonus: { mult: 1, rounds: 0 }, grenades: opts.grenades ?? GRENADE.count, grenadeMax: opts.grenades ?? GRENADE.count, grenadeCd: 0, grenadeAim: null,
    lx: entity.x, ly: entity.y, speed: 0, recoil: 0, inCover: false, posture: 'hip', lastShot: -1, world: null,
  };
  entity.loadout = L;
  if (world) register(world, entity);
  return L;
}
function register(world, e) { const W = sys(world); if (!W.loadouts.includes(e)) W.loadouts.push(e); e.loadout.world = world; }
/** Fiende-snarvei: våpen fra enemy.def.weapon (stats.js), valgfrie overstyringer (f.eks. { dmg }). */
export function createEnemyLoadout(enemy, world, overrides = null, opts = {}) {
  return createLoadout(enemy, [opts.weapon || enemy.def?.weapon || 'rifle'], { enemy: true, overrides, ...opts }, world);
}
function ensure(world, e) { if (!e.loadout) { if (e.team && e.team !== 'player') createEnemyLoadout(e, world); else createLoadout(e); } if (e.loadout.world !== world) register(world, e); return e.loadout; }

/** Effektive tall for skytteren (spilleroppgraderinger fra world.playerStats skaleres relativt). */
function eff(world, e, d) {
  const s = e.team === 'player' ? world.playerStats : null;   // fiender: rene profiltall
  if (!s) return { mag: d.mag, reloadTime: d.reloadTime, coverSpread: 1 };
  return { mag: Math.max(1, Math.round(d.mag * (s.magSize ?? BASE_MAG) / BASE_MAG)), reloadTime: d.reloadTime * (s.reloadTime ?? BASE_RELOAD) / BASE_RELOAD, coverSpread: s.coverSpreadMult ?? 1 };
}
const slotOf = (L) => L.slots[L.index];
const defOf = (L) => slotOf(L).def;

// ------------------------------------------------------------------ spredning
function moveFrac(L, opts) {
  if (opts && opts.moving !== undefined) return typeof opts.moving === 'number' ? opts.moving : opts.moving ? 1 : 0;
  return Math.min(1, Math.max(0, (L.speed - 15) / 135));
}
function postureOf(opts = {}) { return opts.posture === 'blind' || opts.blind ? 'blind' : opts.posture === 'aim' || opts.aiming ? 'aim' : opts.posture === 'hip' ? 'hip' : 'hip'; }
/** Stødig-lading 0..1 (presisjon): lineær fra steady.start til steady.full sekunder stille sikte. */
function chargeOf(L, d) { const st = d.steady; if (!st || !L.aiming) return 0; return Math.max(0, Math.min(1, (L.aimT - st.start) / (st.full - st.start))); }
function isSteady(L, d) { return !!d.steady && L.posture === 'aim' && chargeOf(L, d) >= 1; }

/** Gjeldende spredning i grader (halv kjegle) for entity – også til trådkors. */
export function getSpread(world, e, opts = {}) {
  const L = e.loadout; if (!L) return 0; const d = defOf(L), P = postureOf({ aiming: L.aiming, ...opts });
  let s = d.spread[P] + d.moveSpread * moveFrac(L, opts) * (P === 'aim' ? d.aimMoveMult : 1) + L.bloom;
  if (d.steady && P === 'aim' && moveFrac(L, opts) < 0.05) { const k = chargeOf(L, d); s = s + (d.steady.spread + L.bloom - s) * k; }
  if (opts.inCover ?? L.inCover) s *= eff(world, e, d).coverSpread;
  return s;
}

// ------------------------------------------------------------------ munning
/**
 * Munningspunkt. Riggen setter entity.muzzle = {x, y, z} hver frame, utledet fra våpenmodellen (look/<id>.js,
 * points.muzzle – Warden-design: styles/faceted.js muzzleOf). Finnes den (og er rimelig nær aktøren), brukes den;
 * ellers data.js-verdiene (fallback: testsider, fiender uten rigg, første frame). z er med når riggen gir den.
 */
export const MUZZLE_MAX_DIST = 90;   // px – eldre/feil entity.muzzle (f.eks. etter teleport/respawn) ignoreres
export function getMuzzle(e, angle = e.aim ?? 0) {
  const em = e.muzzle;
  if (em && Number.isFinite(em.x) && Number.isFinite(em.y) && Math.hypot(em.x - e.x, em.y - e.y) <= MUZZLE_MAX_DIST)
    return Number.isFinite(em.z) ? { x: em.x, y: em.y, z: em.z, angle } : { x: em.x, y: em.y, angle };
  const L = e.loadout, d = L ? defOf(L) : WEAPONS.rifle, mu = d.muzzle || {}, f = (e.r || 14) + (mu.forward ?? 20), side = mu.side ?? 3.5;   // per våpen i data.js
  return { x: e.x + Math.cos(angle) * f - Math.sin(angle) * side, y: e.y + Math.sin(angle) * f + Math.cos(angle) * side, angle };
}

/**
 * Tegnet løpstupp (til munningsglimt): entity.muzzleDraw {x,y,z} (spilleren i ?view=34, PROJ.toScreen(x,y,z)),
 * ellers samme punkt som getMuzzle. Kulene starter alltid i getMuzzle (logisk munning).
 */
export function getMuzzleDraw(e, angle = e.aim ?? 0) {
  const md = e.muzzleDraw;
  if (md && Number.isFinite(md.x) && Number.isFinite(md.y) && Math.hypot(md.x - e.x, md.y - e.y) <= MUZZLE_MAX_DIST)
    return { x: md.x, y: md.y, z: Number.isFinite(md.z) ? md.z : undefined, angle };
  return getMuzzle(e, angle);
}

// ------------------------------------------------------------------ kloss hold (27.10)
/**
 * Kroppen under trådkorset (spilleren, view '34'). input.mouse.worldX/Y er bakkepunktet (z = 0) under markøren; den samme
 * skjermpikselen ligger over bakkepunktet (mx, my + z·zScale) i høyde z. En fiende er «under markøren» når den loddrette
 * strålen treffer kroppssylinderen (radius r, høyde e.height): z* = clamp((ey − my)/zScale, 0, h), avstand ≤ r.
 * Fremste (største y) vinner. → { x, y, z, target } | null. Uten treff: vanlig sikte i brysthøyde (PROJ.aimHeight).
 * Årsak (pointblank.md): Lurcher (h 16, bryst 9) og Husk (h 37, bryst 21) er lavere enn 27, så markøren på kroppen ga et
 * bakkepunkt (27 − zBryst)·tan(55°) ≈ 9–26 px foran fienden. Mot øst/vest bommet hagla sidelengs, og haglene ble tegnet
 * i z ≈ 27 – over ryggen på fienden.
 */
export function pickBody(world, e) {
  if (!e || world.view !== '34' || e !== world.player) return null;
  const mo = world.input?.mouse; if (!mo || !Number.isFinite(mo.worldX)) return null;
  const Z = PROJ.zScale, mx = mo.worldX, my = mo.worldY, pad = TUNING.pointBlank?.pickPad ?? 2;
  let best = null;
  for (const t of world.enemies) {
    if (!t || t.dead || t.hidden) continue;
    const r = (t.r || 14) + pad, dx = mx - t.x; if (Math.abs(dx) > r) continue;
    const h = Number.isFinite(t.height) ? t.height : PROJ.heights.actor, z = Math.max(0, Math.min(h, (t.y - my) / Z)), dy = my + z * Z - t.y;
    if (dx * dx + dy * dy > r * r) continue;
    if (Math.hypot(t.x - e.x, t.y - e.y) > (TUNING.pointBlank?.range ?? 100)) continue;   // bare kloss hold; middels/lang avstand uendret
    // markøren på kroppen → sikt på kroppens midtpunkt (bakke) i kroppshøyde; tåler kamera-/markørdrift på kloss hold og offset-munning
    if (!best || t.y > best.target.y) best = { x: t.x, y: t.y, z: Math.max(4, Math.min(z, h * 0.85)), target: t };
  }
  return best;
}
/**
 * Fiende som står mellom kroppen (skytterens senter) og munningen: kula skal starte i kroppen, ellers starter den forbi
 * fienden. Ikke gjennom høy dekning/vegg mellom kropp og munning (da starter den i munningen som før, og veggen tar den
 * ikke – samme som i dag). → { x, y } (punkt litt ut fra senteret) | null.
 */
export function bodySweep(world, e, m) {
  if (TUNING.pointBlank?.sweep === false) return null;
  const list = (e.team || 'player') === 'player' ? world.enemies : (world.player ? [world.player] : []);
  for (const c of world.cover) if (c.type === 'high' && segmentRect(e.x, e.y, m.x, m.y, c, 0) !== null) return null;
  const ax = e.x, ay = e.y, bx = m.x, by = m.y, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; if (L2 < 1) return null;
  for (const t of list) {
    if (!t || t.dead || t === e) continue;
    const k = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.y - ay) * dy) / L2)), qx = ax + dx * k - t.x, qy = ay + dy * k - t.y, r = (t.r || 14) + 1;
    if (qx * qx + qy * qy <= r * r) { const f = Math.min(1, ((e.r || 12) * 0.5) / Math.sqrt(L2)); return { x: ax + dx * f, y: ay + dy * f }; }
  }
  return null;
}

// ------------------------------------------------------------------ skyting
/** Skyt hvis mulig. Kall hvert steg mens avtrekkeren holdes. → { fired:boolean, reason? } */
export function tryFire(world, e, opts = {}) {
  const L = ensure(world, e), edge = !L.wasHeld; L.trigger = true;
  if (opts.aiming !== undefined || opts.posture) L.aiming = postureOf(opts) === 'aim';
  L.posture = postureOf({ aiming: L.aiming, ...opts }); if (opts.inCover !== undefined) L.inCover = !!opts.inCover;
  if (e.dead) return { fired: false, reason: 'dead' };
  const d = defOf(L), slot = slotOf(L);
  if (L.switchT > 0) { if (!d.auto && edge) L.queued = { opts, t: 0.15 }; return { fired: false, reason: 'switching' }; }
  if (L.reload) return { fired: false, reason: 'reloading' };
  if (L.melee) return { fired: false, reason: 'melee' };
  if (L.grenadeThrow) return { fired: false, reason: 'grenade' };
  if (L.cooldown > 0) { if (!d.auto && edge && L.cooldown < 0.15) L.queued = { opts, t: 0.15 }; return { fired: false, reason: 'cooldown' }; }
  if (!d.auto && !edge) return { fired: false, reason: 'semi' };
  if (slot.mag <= 0) {
    if (edge) { const m = getMuzzle(e); world.events.emit('dryFire', { entity: e, weapon: d.id, x: m.x, y: m.y, team: e.team }); }
    startReload(world, e); return { fired: false, reason: 'empty' };
  }
  return fireNow(world, e, L, d, slot, opts);
}

function fireNow(world, e, L, d, slot, opts) {
  const R = world.rng, aim0 = opts.aimAngle ?? e.aim ?? 0;
  // Sikteassistanse (innstilling fra src/ui): bare spilleren, ikke blindskudd. opts.aimAssist overstyrer (tall 0..1 eller false).
  const assist = opts.aimAssist ?? world.settings?.aimAssist ?? 0;
  // 27.10 kloss hold: spilleren i trekvart sikter på KROPPEN under trådkorset (pickBody), ikke et punkt i brysthøyde 27.
  const pick = !opts.muzzle && opts.cursorPick !== false && TUNING.pointBlank?.pick !== false ? pickBody(world, e) : null;
  let aim = pick ? aim0 : (e.team || 'player') === 'player' && assist && !opts.blind ? assistAim(world, e, aim0, assist, d.range) : aim0;
  let m = opts.muzzle || getMuzzle(e, aim);
  if (pick) { const dm = Math.hypot(m.x - e.x, m.y - e.y), dp = Math.hypot(pick.x - e.x, pick.y - e.y);
    aim = dp > dm + 4 ? Math.atan2(pick.y - m.y, pick.x - m.x) : Math.atan2(pick.y - e.y, pick.x - e.x); }
  const sw = opts.muzzle ? null : bodySweep(world, e, m);   // fiende mellom kropp og munning → kula starter i kroppen
  if (sw) { m = { ...m, x: sw.x, y: sw.y }; if (pick) aim = Math.atan2(pick.y - m.y, pick.x - m.x); }   // ny start → sikt på nytt mot kroppen
  const mz = Number.isFinite(opts.muzzleZ) ? opts.muzzleZ : Number.isFinite(m.z) ? m.z : muzzleZ(world, e, d);
  const team = e.team || 'player', steady = isSteady(L, d) && moveFrac(L, opts) < 0.05;
  const charge = d.steady && P0(L, opts) === 'aim' && moveFrac(L, opts) < 0.05 ? chargeOf(L, d) : 0;
  const spread = (opts.spreadRad ?? getSpread(world, e, opts) * DEG), tri = () => R() + R() - 1;   // AI kan gi egen spredning (rad)
  const base = aim + L.kick * DEG + spread * tri();
  const dmgMult = (L.bonus.rounds > 0 ? L.bonus.mult : 1) * (d.steady ? 1 + (d.steady.dmgMult - 1) * charge : 1);
  const shotId = ++SHOT_ID, wfx = d.fx;
  const base0 = d.dmg * dmgMult, w = d;
  // Skadefall via core-kroken dmgAt(eksakt avstand munning → treffpunkt). p.dmg = grunnskade (reserve for kode som leser dmg).
  const dmgAt = (dist) => base0 * falloffMult(w, dist);
  const aimP = (p, ang) => { p.angle = ang; p.vx = Math.cos(ang) * p.speed; p.vy = Math.sin(ang) * p.speed; return p; };
  const col = opts.color || (team === 'player' || d.enemy ? d.color : '#ffb347'), own = TUNING.fx?.ownBullets !== false;
  // Rev. 6: z = løpshøyde (konstant under flukten). own: core drawProjectiles har ingen z → kula tegnes av fx.drawTracers (p.tint).
  const common = { speed: d.projectileSpeed, team, owner: e, radius: d.radius, range: d.range, color: own ? 'rgba(0,0,0,0)' : col, tint: col, z: mz, kind: 'bullet', ...(pick ? { zAim: pick.z } : {}),
    weapon: d.id, pellets: d.pellets, shotId, wfx, baseDmg: base0, dmgAt, steady, charge, falloff: d.falloff, ...(opts.projectile || {}) };
  const P = postureOf({ aiming: L.aiming, ...opts });
  let angles = [base];
  if (d.pellets > 1) {
    const cone = (d.pelletSpread[P] ?? d.pelletSpread.hip) * DEG * (opts.inCover ?? L.inCover ? eff(world, e, d).coverSpread : 1);
    angles = [];
    for (let i = 0; i < d.pellets; i++) { const u = d.pellets === 1 ? 0 : (i / (d.pellets - 1)) * 2 - 1; angles.push(base + cone * (u * 0.85 + (R() - 0.5) * 0.35)); }
  }
  // Hagl: core spawnProjectile for hagl 0 (→ ÉN 'shot' med weapon/pellets/x/y på toppnivå), hagl 1..n som kloner {...p0}
  // rett i world.projectiles – slik CORE-API.md beskriver. Klonene arver dmgAt/pierce/pierceMult; gjennomslagstilstand nullstilles.
  const p0 = spawnProjectile(world, { ...common, x: m.x, y: m.y, angle: angles[0], dmg: base0, pellet: 0 });
  for (let i = 1; i < angles.length; i++) world.projectiles.push(aimP({ ...p0, pellet: i, travelled: 0, dead: false, _pierced: undefined, pierceScale: undefined, hitDist: undefined }, angles[i]));
  if (wfx.beam) sys(world).live.push(p0);
  const md = getMuzzleDraw(e, aim), draw = { x: md.x, y: md.y, z: Number.isFinite(md.z) ? md.z : mz };   // glimt: tegnet løpstupp
  world.events.emit('weaponFire', { x: m.x, y: m.y, z: mz, draw, angle: base, team, weapon: d.id, entity: e, pellets: d.pellets, shotId, posture: P, steady, charge });
  if (!L.infinite) slot.mag--; L.cooldown = d.fireInterval; L.lastShot = world.time; L.recoil = 1;
  const autoReload = L.enemy && !L.infinite && slot.mag <= 0;   // fiende med magasin: lad straks når det er tomt
  if (L.bonus.rounds > 0 && --L.bonus.rounds <= 0) L.bonus.mult = 1;
  L.bloom = Math.min(d.bloom.max, L.bloom + d.bloom.perShot);
  if (d.recoil.climb) { const s = Math.abs(L.kick) < 0.01 ? (R() < 0.5 ? -1 : 1) : Math.sign(L.kick); L.kick = Math.max(-d.recoil.climb * 5, Math.min(d.recoil.climb * 5, L.kick + d.recoil.climb * (0.6 * s + (R() - 0.5) * 1.6))); }
  if (d.id === 'marksman') L.aimT = 0;   // steady må bygges opp igjen
  // effekter
  fx.muzzleFlash(world, m.x, m.y, base, wfx, team, mz);
  const ex = e.x + Math.cos(aim) * ((e.r || 14) * 0.6), ey = e.y + Math.sin(aim) * ((e.r || 14) * 0.6);
  if (d.chamber) L.chamberT = d.chamber; else fx.ejectShell(world, ex, ey, aim, wfx, (e.x - L.lx) * 60, (e.y - L.ly) * 60, mz * 0.8);
  if (camfx.follows(world, e) || opts.cameraKick) { camfx.shake(world, d.recoil.shake[0], d.recoil.shake[1]); camfx.kick(world, aim, d.recoil.kick); }
  if (autoReload) startReload(world, e);   // etter skuddhendelsene: 'reload' start kommer etter 'shot'
  return { fired: true, shotId, pellets: d.pellets, steady, charge };
}

function P0(L, opts) { return postureOf({ aiming: L.aiming, ...opts }); }

/** Forventet skade per treff mot et punkt i avstand dist (px) med nåværende lading/bonus – brukes av trådkorset. */
export function previewDamage(e, dist) {
  const L = e?.loadout; if (!L) return 0; const d = defOf(L);
  return d.dmg * falloffMult(d, dist) * (L.bonus.rounds > 0 ? L.bonus.mult : 1) * (d.steady ? 1 + (d.steady.dmgMult - 1) * chargeOf(L, d) : 1);
}

/**
 * Nærkamp/kolbeslag (melee.js): tryMelee(world, entity, angle) → true hvis slaget startet. Spiller og fiender (Flanker).
 * Virker uten ammo og med alle våpen; avbryter lading; blokkerer skudd til slaget er ferdig. Se TUNING.melee.
 */
/**
 * Kolbeslag. opts: { dmg, stagger } overstyrer for DETTE slaget (lagres i meleetilstanden ved start).
 * Rekkefølge: opts → ENEMY_WEAPONS[profil].melee (fiender) → TUNING.melee.enemy (team !== 'player') → TUNING.melee (spiller).
 * → false hvis entity er staggered (world.time < staggerUntil), i nedkjøling, kaster granat eller allerede slår.
 */
export function tryMelee(world, e, angle, opts = {}) { ensure(world, e); return startMelee(world, e, angle ?? e.aim, opts); }

/** Lader entity nå? (Fiende-AI: Heavy-ladepause.) */
export function isReloading(e) { return !!e?.loadout?.reload; }

/** Alias bestilt av Breach: fire(world, shooter, aimAngle, opts?) → som tryFire. */
export function fire(world, shooter, aimAngle, opts = {}) { return tryFire(world, shooter, { ...opts, aimAngle }); }

// ------------------------------------------------------------------ lading
/** Start lading. → true hvis startet. */
export function startReload(world, e) {
  const L = ensure(world, e); if (L.reload || L.switchT > 0 || e.dead) return false;
  const d = defOf(L), slot = slotOf(L), E = eff(world, e, d);
  if (slot.mag >= E.mag || slot.reserve <= 0) return false;
  L.reload = { t: 0, base: E.reloadTime, total: E.reloadTime, tried: false, result: null, jam: false };
  L.queued = null;
  world.events.emit('reload', { weapon: d.id, phase: 'start', entity: e, x: e.x, y: e.y, team: e.team, time: E.reloadTime });
  return true;
}

/** R-trykk: starter lading, eller gjør aktiv reload-forsøk hvis lading pågår. → 'start'|'perfect'|'good'|'fail'|null */
export function reload(world, e) {
  const L = ensure(world, e);
  if (L.melee) return null;   // ikke midt i et kolbeslag
  if (!L.reload) return startReload(world, e) ? 'start' : null;
  const r = L.reload, d = defOf(L), ar = d.activeReload; if (!ar || r.tried || r.jam) return null;
  const f = r.t / r.base; if (f < ar.from) return null;
  r.tried = true;
  let result = 'fail';
  if (f >= ar.perfect[0] && f < ar.perfect[1]) result = 'perfect'; else if (f >= ar.good[0] && f < ar.good[1]) result = 'good';
  r.result = result;
  world.events.emit('reload', { weapon: d.id, phase: 'active', result, entity: e, x: e.x, y: e.y, team: e.team });
  world.events.emit('activeReload', { entity: e, weapon: d.id, result, x: e.x, y: e.y, team: e.team });
  if (result === 'fail') { r.jam = true; r.total = r.base + ar.jam * (r.base / d.reloadTime); }
  else finishReload(world, e, L, result);
  return result;
}

function finishReload(world, e, L, result = null) {
  const d = defOf(L), slot = slotOf(L), E = eff(world, e, d);
  const take = Math.min(E.mag - slot.mag, slot.reserve); slot.mag += take; if (slot.reserve !== Infinity) slot.reserve -= take;
  if (result === 'perfect') L.bonus = { mult: d.activeReload.bonus, rounds: slot.mag }; else if (L.bonus.rounds > 0) L.bonus = { mult: 1, rounds: 0 };
  L.reload = null; L.lastResult = result || (L.lastResult === 'fail' ? 'fail' : null); L.lastResultT = 1.2;
  world.events.emit('reload', { weapon: d.id, phase: 'end', result: result || 'normal', entity: e, x: e.x, y: e.y, team: e.team });
}

// ------------------------------------------------------------------ bytte
/** slot: 1-basert nummer, 'next'/'prev' (musehjul), eller våpen-id. → true hvis byttet. */
export function switchWeapon(world, e, slot) {
  const L = ensure(world, e), n = L.slots.length; let i = L.index;
  if (L.melee) return false;
  if (slot === 'next') i = (i + 1) % n; else if (slot === 'prev') i = (i - 1 + n) % n;
  else if (typeof slot === 'number') i = slot - 1; else if (typeof slot === 'string') i = L.slots.findIndex((s) => s.id === slot);
  if (i < 0 || i >= n || i === L.index || e.dead) return false;
  const from = slotOf(L).id; L.index = i; L.reload = null; L.queued = null; L.chamberT = 0;
  const d = defOf(L); L.switchT = L.switchTotal = d.equipTime; L.bloom = 0; L.aimT = 0;
  world.events.emit('weaponSwitch', { entity: e, from, to: d.id, weapon: d.id, x: e.x, y: e.y, team: e.team });
  return true;
}

// ------------------------------------------------------------------ granater
/** Kast granat mot (tx, ty) eller med {angle, power}. → granat eller null. */
/**
 * Granatkast med kort oppladning (TUNING.grenade.windup). Vinkel/kraft låses ved start, granaten telles ned straks.
 * Sender 'grenade' {phase:'windup', windup, x, y, angle, power, …} nå, og 'grenade' {phase:'throw', …} (fra spawnGrenade)
 * når den slippes. Kastpunkt = throwHand-socket (se throwPoint) ved slipp. → {windup, angle, power} eller null.
 */
export function throwGrenade(world, e, tx, ty) {
  const L = ensure(world, e); if (e.dead || L.grenades <= 0 || L.grenadeCd > 0 || L.grenadeThrow || L.melee) return null;
  let angle, power;
  if (typeof tx === 'object') ({ angle, power } = tx);
  else { angle = Math.atan2(ty - e.y, tx - e.x); power = Math.hypot(tx - e.x, ty - e.y) / GRENADE.maxThrow; }
  power = Math.max(0, Math.min(1, power));
  const windup = TUNING.grenade.windup;
  L.grenades--; L.grenadeCd = GRENADE.cooldown + windup; L.grenadeAim = null;
  L.grenadeThrow = { t: 0, windup, angle, power };
  world.events.emit('grenade', { phase: 'windup', windup, x: e.x, y: e.y, angle, power, team: e.team || 'player', owner: e, entity: e, weapon: 'grenade' });
  if (windup <= 0) return releaseGrenade(world, e, L), { windup, angle, power };
  return L.grenadeThrow;
}
/** Kastpunkt: entity.throwHand {x,y} → entity.rig.socket('throwHand') → entity.socket('throwHand') → r + 4 px foran. */
export function throwPoint(e, angle) {
  const s = (e.throwHand && Number.isFinite(e.throwHand.x) && e.throwHand) || e.rig?.socket?.('throwHand') || (typeof e.socket === 'function' && e.socket('throwHand')) || null;
  if (s && Number.isFinite(s.x)) return { x: s.x, y: s.y };
  return { x: e.x + Math.cos(angle) * ((e.r || 14) + 4), y: e.y + Math.sin(angle) * ((e.r || 14) + 4) };
}
function releaseGrenade(world, e, L) {
  const G = L.grenadeThrow; L.grenadeThrow = null; if (!G || e.dead) return null;
  const p = throwPoint(e, G.angle);
  return spawnGrenade(world, { x: p.x, y: p.y, angle: G.angle, power: G.power, owner: e, team: e.team || 'player' });
}

// ------------------------------------------------------------------ ammo
export function addAmmo(e, id, n) { const s = e.loadout?.slots.find((x) => x.id === id); if (s && s.reserve !== Infinity) s.reserve += n; return s?.reserve; }
/**
 * Fyll ammo: refill(world, entity, opts?) (gammel signatur refill(entity) virker fortsatt).
 * opts: { allWeapons=true, grenades=Infinity (antall å legge til; Infinity = fyll til maks), grenadeMax?, emit=false, crateId? }
 * Fyller magasin (effektiv størrelse inkl. oppgraderinger) og reserve, avbryter pågående lading/jam ryddig
 * ('reload' phase 'end' result 'cancel'). → true hvis noe ble fylt. Sender 'refill' {entity, x, y, crateId} når opts.emit.
 */
export function refill(world, e, opts = {}) {
  if (e === undefined || (world && world.loadout && !world.events)) { e = world; world = e?.loadout?.world || null; }
  const L = e?.loadout; if (!L) return false;
  const changed = needsRefill(world, e, opts);
  const slots = opts.allWeapons === false ? [slotOf(L)] : L.slots;
  for (const s of slots) { const d = s.def, E = world ? eff(world, e, d) : { mag: d.mag }; s.reserve = d.reserve; s.mag = E.mag; }
  const max = grenadeMaxOf(world, e, opts); L.grenadeMax = Math.max(L.grenadeMax, max);
  L.grenades = Math.min(max, L.grenades + (opts.grenades ?? Infinity));
  if (L.reload) {   // ryddig avbrudd: ingen bonus, ingen jam-straff igjen
    const d = defOf(L); L.reload = null; L.lastResult = null; L.lastResultT = 0;
    world?.events.emit('reload', { weapon: d.id, phase: 'end', result: 'cancel', entity: e, x: e.x, y: e.y, team: e.team });
  }
  if (opts.emit && changed) world?.events.emit('refill', { entity: e, x: e.x, y: e.y, crateId: opts.crateId ?? null, team: e.team });
  return changed;
}
/**
 * Respawn-påfyll: fullt magasin (inkl. oppgraderinger) og full reserve i ALLE våpen, granater = max(nåværende, 1),
 * og nullstilt lading/jam/aktiv reload, nærkamp, granatkast/-sikte, avtrekker, rekyl, spredning og bytte.
 * Hvis entity mangler loadout (nytt player-objekt), opprettes standardoppsettet. Idempotent innen samme world.time.
 */
export function resupplyOnRespawn(world, e) {
  if (!e) return false;
  if (!e.loadout) createLoadout(e, PLAYER_LOADOUT, {}, world);
  const L = ensure(world, e);
  if (L._respawnT === world.time) return false;
  L._respawnT = world.time;
  L.reload = null;                                     // stille: ingen 'reload end' midt i en respawn
  refill(world, e, { grenades: 0 });
  L.grenades = Math.min(Math.max(L.grenadeMax, 1), Math.max(L.grenades, 1));
  L.lastResult = null; L.lastResultT = 0; L.melee = null; L.grenadeThrow = null; L.grenadeAim = null; L.grenadeCd = 0;
  L.trigger = L.wasHeld = false; L.queued = null; L.cooldown = 0; L.switchT = 0; L.chamberT = 0;
  L.bloom = 0; L.kick = 0; L.recoil = 0; L.aimT = 0; L.aiming = false;
  L.lx = e.x; L.ly = e.y; L.speed = 0;
  world.events.emit('weaponRespawn', { entity: e, team: e.team ?? 'player', weapon: defOf(L).id, grenades: L.grenades });
  return true;
}
function grenadeMaxOf(world, e, opts = {}) {
  const L = e.loadout; return opts.grenadeMax ?? (e.team === 'player' ? world?.playerStats?.grenades : null) ?? L.grenadeMax;
}
/** Er noe å fylle? (samme opts som refill) – kassene bruker dette så de ikke brennes når alt er fullt. */
export function needsRefill(world, e, opts = {}) {
  const L = e?.loadout; if (!L) return false;
  const slots = opts.allWeapons === false ? [slotOf(L)] : L.slots;
  for (const s of slots) { const d = s.def, E = world ? eff(world, e, d) : { mag: d.mag }; if (s.mag < E.mag || s.reserve < d.reserve) return true; }
  return (opts.grenades ?? 1) > 0 && L.grenades < grenadeMaxOf(world, e, opts);
}
export function setGrenadeMax(e, n) { const L = e.loadout; if (!L) return; L.grenades += Math.max(0, n - L.grenadeMax); L.grenadeMax = n; }
/** Fortell systemet at entity sikter (for steady-bonus/spredning) uten å skyte. Kall hvert steg. */
export function setAiming(e, aiming, inCover) { const L = e.loadout; if (!L) return; L.aiming = !!aiming; if (inCover !== undefined) L.inCover = !!inCover; }

// ------------------------------------------------------------------ status til HUD/Karakter
/** → { id, name, short, slot, index, mag, magSize, reserve, reloading, reloadProgress, reloadT, reloadTotal, activeReload,
 *      activeTried, jammed, lastResult, switching, cooldown, spread, recoil, steady, bonus, grenades, grenadesMax, def, slots } */
export function current(e) {
  const L = e?.loadout; if (!L) return null; const d = defOf(L), s = slotOf(L), w = L.world;
  const E = w ? eff(w, e, d) : { mag: d.mag };
  const r = L.reload;
  return {
    id: d.id, name: d.name, short: d.short, slot: L.index + 1, index: L.index, mag: s.mag, magSize: E.mag, reserve: s.reserve,
    reloading: !!r, reloadT: r ? r.t : 0, reloadTotal: r ? r.total : 0, reloadBase: r ? r.base : 0,
    reloadProgress: r ? Math.min(1, r.t / r.total) : 0,
    activeReload: d.activeReload, activeTried: !!r?.tried, jammed: !!r?.jam, lastResult: L.lastResult, lastResultT: L.lastResultT,
    switching: L.switchT > 0 ? 1 - L.switchT / L.switchTotal : 0, cooldown: L.cooldown > 0 ? L.cooldown / d.fireInterval : 0,
    spread: w ? getSpread(w, e) : d.spread.hip, recoil: L.recoil, aiming: L.aiming,
    steady: chargeOf(L, d), steadyMult: d.steady ? 1 + (d.steady.dmgMult - 1) * chargeOf(L, d) : 1, bonus: { ...L.bonus },
    grenades: L.grenades, grenadesMax: L.grenadeMax, grenadeAim: L.grenadeAim, def: d,
    slots: L.slots.map((x) => ({ id: x.id, short: x.def.short, mag: x.mag, reserve: x.reserve })),
  };
}

// ------------------------------------------------------------------ input-hjelper (valgfri for Karakter, brukt av testsiden)
/**
 * Leser 1/2/3, musehjul, R, G (hold = vis bane, slipp = kast mot musa) og venstreklikk.
 * o: { canFire=true, aiming, inCover, blind, aimAngle } → { fired, switched, reload, grenade }
 */
export function handleInput(world, e, input, o = {}) {
  const L = ensure(world, e), m = input.mouse, out = {};
  for (let i = 1; i <= L.slots.length; i++) if (input.pressed('Digit' + i)) out.switched = switchWeapon(world, e, i);
  if (m.wheel) out.switched = switchWeapon(world, e, m.wheel > 0 ? 'next' : 'prev');
  if (input.pressed('KeyR')) out.reload = reload(world, e);
  if (input.pressed('KeyF')) out.melee = tryMelee(world, e, o.aimAngle ?? Math.atan2(m.worldY - e.y, m.worldX - e.x));
  if (input.down('KeyG') && L.grenades > 0 && L.grenadeCd <= 0) L.grenadeAim = { x: m.worldX, y: m.worldY };
  else if (L.grenadeAim) { out.grenade = throwGrenade(world, e, L.grenadeAim.x, L.grenadeAim.y); L.grenadeAim = null; }
  setAiming(e, o.aiming ?? m.right, o.inCover);
  // kort trykk (touchpad): mousedown+mouseup i samme frame gir bare leftPressed. Automat holder avtrekkeren TUNING.input.tapHoldMs etterpå.
  // Semi: tryFire kalles maks én gang per steg og kanten (wasHeld) styrer, så left && leftPressed gir ikke dobbeltskudd.
  const tap = TUNING.input?.tap !== false;
  if (tap && m.leftPressed && !m.left && defOf(L).auto) L.tapUntil = world.time + (TUNING.input?.tapHoldMs ?? 80) / 1000;
  const held = m.left || (tap && (m.leftPressed || L.tapUntil > world.time));
  if (held && o.canFire !== false && !L.grenadeAim) out.fired = tryFire(world, e, { aimAngle: o.aimAngle ?? Math.atan2(m.worldY - e.y, m.worldX - e.x), aiming: o.aiming ?? m.right, inCover: o.inCover, blind: o.blind }).fired;
  return out;
}

// ------------------------------------------------------------------ modulkontrakt
export function update(dt, world) {
  const W = sys(world); if (W.tick === world.time) { W.stats.skipped++; return; } W.tick = world.time; W.stats.updates++;   // tåler å bli kalt flere ganger per steg
  for (const e of W.loadouts) {
    const L = e.loadout; if (!L) continue; const d = defOf(L);
    const sp = Math.hypot(e.x - L.lx, e.y - L.ly) / dt; L.speed += (sp - L.speed) * Math.min(1, dt * 20); L.lx = e.x; L.ly = e.y;
    if (e.dead) { L.reload = null; L.melee = null; L.grenadeThrow = null; L.grenadeAim = null; L.trigger = L.wasHeld = false; continue; }
    updateMelee(dt, world, e, L);
    if (L.grenadeThrow && (L.grenadeThrow.t += dt) >= L.grenadeThrow.windup) releaseGrenade(world, e, L);
    L.cooldown = Math.max(0, L.cooldown - dt); L.grenadeCd = Math.max(0, L.grenadeCd - dt);
    if (L.switchT > 0) L.switchT = Math.max(0, L.switchT - dt);
    L.bloom = Math.max(0, L.bloom - d.bloom.decay * dt * (L.cooldown > 0 ? 0.35 : 1));
    const rec = d.recoil.recover * dt; L.kick = Math.abs(L.kick) <= rec ? 0 : L.kick - Math.sign(L.kick) * rec;
    L.recoil = Math.max(0, L.recoil - dt * 8);
    if (L.lastResultT > 0) L.lastResultT -= dt;
    L.aimT = L.aiming && L.speed < 20 && !L.reload && L.switchT <= 0 ? L.aimT + dt : 0;
    if (L.chamberT > 0 && (L.chamberT -= dt) <= 0) {   // pumpe/bolt
      L.chamberT = 0; const a = e.aim ?? 0, ex = e.x + Math.cos(a) * ((e.r || 14) * 0.6), ey = e.y + Math.sin(a) * ((e.r || 14) * 0.6);
      fx.ejectShell(world, ex, ey, a, d.fx, (e.x - L.lx) / dt, (e.y - L.ly) / dt, muzzleZ(world, e, d) * 0.8);
      world.events.emit('chamber', { weapon: d.id, x: e.x, y: e.y, team: e.team, entity: e });
    }
    if (L.reload) { L.reload.t += dt; if (L.reload.t >= L.reload.total) finishReload(world, e, L, L.reload.jam ? 'fail' : null); }
    L.wasHeld = L.trigger; L.trigger = false;
    if (L.queued) { L.queued.t -= dt; if (L.queued.t < 0) L.queued = null; else if (L.cooldown <= 0 && L.switchT <= 0 && !L.reload) { const q = L.queued; L.queued = null; const s = slotOf(L); if (s.mag > 0) fireNow(world, e, L, d, s, q.opts); } }
    // automatisk lading når magasinet er tomt og avtrekkeren er sluppet
    if (!L.reload && !L.wasHeld && slotOf(L).mag <= 0 && slotOf(L).reserve > 0 && L.cooldown <= 0 && L.switchT <= 0) startReload(world, e);
  }
  // presisjonsstråle når kula er ferdig (treff, dekning eller maks rekkevidde)
  for (const p of W.live) if (p.dead || !world.projectiles.includes(p)) { p._done = true; fx.beam(world, p.ox, p.oy, p.x, p.y, p.wfx.beam, p.team, p.wfx.tracerW, p.z0 ?? p.z ?? 0, projectileZ(p)); }
  W.live = W.live.filter((p) => !p._done);
  updateGrenades(dt, world);
  updateCrates(dt, world);
}

export function draw(ctx, world, camera) {
  const W = sys(world); W.stats.draws++;
  drawCrates(ctx, world);   // tilstandslys oppå Arenas kassegrafikk (under aktør-overlegg)
  fx.drawTracers(ctx, world);
  drawGrenades(ctx, world);
  for (const e of W.loadouts) {
    const L = e.loadout; if (!L || e.dead) continue;
    if (L.grenadeAim) drawGrenadeArc(ctx, world, e, L.grenadeAim.x, L.grenadeAim.y);
    if (W.worldBar && (L.reload || L.lastResultT > 0) && e.team === 'player') drawWorldReloadBar(ctx, world, e);
  }
}
