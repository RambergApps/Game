// Bro mellom fiende-AI og Breach Våpen (src/weapons, fiende-API rev. 2). ALLE fienders skudd går gjennom
// weapons.tryFire med fiendeprofilen fra ENEMY_WEAPONS (stats.weapon: rifle/smg/minigun/carbine – skade, kulefart og
// skadefall eies av Våpen). AI-en eier fortsatt rettferdigheten RUNDT tryFire: telegraf før salven, siktlinjesjekk før
// hvert skudd og squad-token (states.js / behaviors/heavy.js kaller fireWeapon først når alt dette er oppfylt).
//
// Spredning: AI-ens egen spreadRad (stats.js spreadDeg, flank.spreadMul, Heavy-rampe …) sendes som opts.spreadRad og
// overstyrer profilen → treffprosentene styres fra stats.js. Munning: samme punkt som AI-ens LOS-sjekk (states.muzzle).
// Telemetri (telegraphed, losAtFire, flank, suppressive) sendes som opts.projectile og flettes inn på kula før 'shot'.
// Ammo: fiender har uendelig ammo i Våpen (L.infinite) → ingen lading.
// Nærkamp: weapons.tryMelee (Våpen eier skade/stagger – fiender 30 / 0,25 s via TUNING.melee.enemy –, bue 100°, rekkevidde). Ingen lokale stubber igjen.
// update/draw: KUN når loopen ikke har mods.weapons (testsiden) – ellers kaller main-loopen dem én gang per steg.
import { onScreen } from './onscreen.js';
import { PROJ } from '../shared/projection.js';
import { HUNKER_MUZZLE } from './look/hunker.js';

/** Munningspunkt (x/y) for kuler og munningslys. Hunker: fwd/side fra HUNKER_MUZZLE (side = verdens-px til HØYRE for
 *  coverFacing, ellers facing; y ned → høyre = (−sin, cos)). Andre typer: som før (r + 10 fram, 4 til siden langs aim). */
export function muzzleXY(e) {
  const c = Math.cos(e.aim), s = Math.sin(e.aim);
  if (e.type === 'hunker') {
    const fw = HUNKER_MUZZLE.fwd ?? (e.r + 10), sd = HUNKER_MUZZLE.side ?? 0;
    const inSpot = e.spot && Number.isFinite(e.spot.nx) && ['inCover', 'suppressed', 'telegraph', 'fire'].includes(e.state);
    const f = inSpot ? Math.atan2(-e.spot.ny, -e.spot.nx) : (Number.isFinite(e.facing) ? e.facing : e.aim);
    return { x: e.x + c * fw - Math.sin(f) * sd, y: e.y + s * fw + Math.cos(f) * sd };
  }
  const fw = e.r + 10;
  return { x: e.x + c * fw - s * 4, y: e.y + s * fw + c * 4 };
}
import * as weapons from '../weapons/index.js';

/** Gi fienden et våpensett fra stats.weapon (kalles fra createEnemy). dmg-override kun hvis stats avviker fra profilen. */
export function equip(world, e) {
  const prof = weapons.ENEMY_WEAPONS[e.def.weapon];
  const over = prof && Number.isFinite(e.def.dmg) && e.def.dmg !== prof.dmg ? { dmg: e.def.dmg } : null;
  weapons.createEnemyLoadout(e, world, over, { grenades: e.def.grenade ? 99 : 0 });
  return e.loadout;
}

/**
 * Skyt ett skudd mot e.aim. Forutsetter at kalleren allerede har sjekket telegraf/LOS/token.
 * opts: { spread (rad, total halv kjegle), posture:'aim'|'hip', tags:{...} (telemetri på kula) } → { fired, reason, projectiles }
 */
export function fireWeapon(world, e, opts = {}) {
  if (!e.loadout) equip(world, e);
  if (!onScreen(world, e)) return { fired: false, reason: 'offscreen', projectiles: [] };   // 27.10: aldri skudd fra utenfor bildet
  if (Number.isFinite(e.staggerUntil) && world.time < e.staggerUntil) return { fired: false, reason: 'stagger', projectiles: [] }; // dobbel sikring
  const posture = opts.posture || 'aim';
  const muzzle = muzzleXY(e);
  const r = weapons.tryFire(world, e, { aimAngle: e.aim, spreadRad: opts.spread, posture, moving: e.moving ? 1 : 0, inCover: false, muzzle, muzzleZ: e.muzzleZ,
    // CINDER (Breach 23.10): organisk våpen-id i core-'shot' (p.weapon). Våpen fletter opts.projectile inn ETTER weapon: d.id,
    // så dette overstyrer bare id-en på kula/hendelsen; profil, skade og fx (wfx) er uendret. profile = Våpens profil-id.
    projectile: { ...(e.def.shotEventId ? { weapon: e.def.shotEventId, profile: e.def.weapon } : {}), srcX: e.x, srcY: e.y, zTo: PROJ.aimHeight, ...(opts.tags || {}) } });   // zTo: tegnemål (spillerens bryst) – til Våpen
  // P1 (23.10): srcX/srcY = skytterens posisjon i avfyringsøyeblikket → hit.source.x/y (core/combat.js hitSource).
  if (!r.fired) return { fired: false, reason: r.reason, projectiles: [] };
  const ps = [];
  for (let i = world.projectiles.length - 1; i >= 0 && ps.length < (r.pellets || 1); i--) if (world.projectiles[i].shotId === r.shotId) ps.push(world.projectiles[i]);
  e.muzzleT = 0.06; e.lastFireAt = world.time;
  return { fired: true, projectiles: ps };
}

/**
 * Fiender har uendelig ammo i Våpen; beholdt som krok. Rev. 4: profiler med limitedMag (Heavy/minigun, 60 skudd,
 * 3,0 s) lader AUTOMATISK når magasinet er tomt – topUp skal ALDRI starte lading for dem (ellers lader Heavy ved
 * halvt magasin og ladepausen kommer uforutsigbart). Ladepausen brukes av AI-en (behaviors/heavy.js).
 */
export function topUp(world, e) {
  const L = e.loadout, s = L?.slots[0]; if (!s || L.infinite || s.def.limitedMag) return;
  if (s.mag < s.def.mag * 0.5 && !L.reload) weapons.startReload(world, e);
}

export const isReloading = (e) => (weapons.isReloading ? weapons.isReloading(e) : !!e.loadout?.reload);
/** {mag, magSize, reloading, reloadProgress} fra weapons.current (rev. 4). */
export const ammo = (e) => {
  const c = weapons.current?.(e);
  if (c) return { mag: c.mag, magSize: c.magSize, reloading: !!c.reloading, reloadProgress: c.reloadProgress ?? 0, reloadTotal: c.reloadTotal ?? 0 };
  const s = e.loadout?.slots[0]; return s ? { mag: s.mag, magSize: s.def.mag, reloading: !!e.loadout.reload, reloadProgress: 0, reloadTotal: 0 } : null;
};

/** Våpen-oppdatering/tegning bare når ingen loop-modul eier våpnene (testsiden). Hovedspillet: mods.weapons. */
export function updateWeapons(dt, world) { if (!world.modules?.weapons) weapons.update(dt, world); }
export function drawWeapons(ctx, world, camera) { if (!world.modules?.weapons) weapons.draw(ctx, world, camera); }
export { weapons };

/** Fiendens kolbeslag via Våpen. → true hvis slaget startet (treffet avgjøres etter Våpens windup, se 'melee' phase 'hit'). */
export function melee(world, e, angle = e.aim) {
  if (Number.isFinite(e.staggerUntil) && world.time < e.staggerUntil) return false;
  if (!e.loadout) equip(world, e);
  return weapons.tryMelee(world, e, angle);
}
export const meleeBusy = (e) => !!e.loadout?.melee;
