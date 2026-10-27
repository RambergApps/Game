// Pose = alt en rigg/tegning trenger for å vise en fiende, avledet fra AI-tilstanden.
// Kontrakt mot Karakters delte rigg (src/shared/rig): riggen kaller poseOf(world, e) og leser KUN feltene under.
// Rene lesefunksjoner – poseOf endrer aldri fienden eller world.
//
// Felt                     Type          Betydning
// id, type                 tall, streng  'grunt' | 'flanker' | 'heavy' | 'grenadier'
// variant, displayName     streng|null   f.eks. 'alpha' / 'Kiln Alpha'
// rise                     null | { progress 0..1, duration }  oppstigning fra sprekken rett etter innhopp
// inCover                  bool          står i dekningsposisjonen sin (coverType sier low/high)
// suppression              0..1          undertrykkingsnivå (1 = terskel for 'suppressed')
// x, y, r                  px            sentrum og kroppsradius (Heavy 18 → 36 px)
// facing, aim              rad           kroppsretning og våpenretning (0 = øst, med klokka)
// colors                   {main,dark,accent}
// state                    streng        AI-tilstand (idle, alert, seekCover, inCover, peek, telegraph, fire, …)
// moving, speed, walkPhase bool, px/s, rad   gangsyklus
// crouch                   0..1          dukket i dekning
// coverSide                {nx,ny}|null  normal ut fra dekningen (ryggen mot veggen = motsatt)
// coverType                'low'|'high'|null
// popUp                    bool          reist seg over lav dekning for å skyte
// hurt                     0..1          treffblink
// muzzleFlash              bool          munningsflamme denne framen
// muzzle                   {x,y}         munningspunkt i verden
// alert, suppressed, flanking  bool      markører over hodet
// telegraph                null | { progress 0..1, duration, flank, spinup }  varsel før ild
// firing                   bool          i salve/vedvarende ild
// fireMode                 null|'direct'|'suppress'  Heavy: sperreild mot dekning
// streamLen                px            Heavy: lengden på ildstrålen (stopper i første høye dekning)
// spin, spinPhase          0..1, rad     Heavy: tromlefart og -vinkel (oppspinning = varsel)
// throw                    null | { phase:'windup'|'release', progress 0..1, target:{x,y}, radius }  Grenadier
// hp, maxHp                tall
// plating                  { plate, trim, visor, glitch 0..1 }  plassholder-farger (grå plater, typefarge som stripe,
//                          rødoransje «øye»; glitch > 0 = kort blaff). Utseendet er fryst – ny kunst eies av Fiende-design (art.js, RENDER.md).
// reloading                bool          lader våpenet (weapons.isReloading)
// reload                   null | { progress 0..1, duration }  Heavy (rev. 4: 60 skudd / 3,0 s): ladepausen = spillerens
//                          åpning – tegnes som tydelig varsel (dette er spillmekanikk)
// stagger                  null | { progress 0..1, duration }  rammet av nærkamp: ingen handling; tegn et kort rykk
// melee                    null | { phase:'rush'|'charge'|'strike'|'recover', progress 0..1, contactAt?, contact?, hit? }  Flanker-nærkamp
//                          (charge = varselet; tegnes tydelig – dette er spillmekanikk)
// dead, corpseT, deathAngle  bool, s, rad
// debug                    { path, pathIdx, spot, flankPlan, suppression }  kun for F1-overlegg
import { muzzle } from './states.js';
import { ammo } from './weapon.js';
import * as weapons from '../weapons/index.js';

const PLATE = '#4a5157', VISOR = { grunt: '#ff4a2a', flanker: '#ff3320', heavy: '#ff7a1a', grenadier: '#ff5a3c' };
/** Deterministisk øye-glitch (ren funksjon av tid og id): ~4 % av tiden, korte blaff. */
function glitch(world, e) { const v = Math.sin(world.time * 2.3 + e.id * 12.9) * Math.sin(world.time * 7.1 + e.id * 3.7); return v > 0.93 ? (v - 0.93) / 0.07 : 0; }

const CONTACT = () => weapons.TUNING?.melee?.contactAt ?? 0.165;

const ATTACK = new Set(['telegraph', 'fire', 'spinup', 'sustain', 'throw', 'meleeRush', 'meleeCharge', 'meleeStrike', 'meleeRecover']);
/** 'idle' | 'walk' | 'attack' | 'hit' | 'die' – utledet av AI-tilstanden (prioritet i den rekkefølgen nedenfra). */
/** Hunker (27.10): cover 0–1 (1 = dukket), peek 0–1 (1 = rifla på muren), coverFacing (rad, −normal; facing som reserve),
 *  anim idle/walk/hit/die/cover/fire (attack = alias for fire), attackPhase = munningsblink (kun i fire, etter peek 1),
 *  shieldHit (siste treff tok skjoldet; hitAt settes som før). */
function hunkerPose(world, e) {
  const c = (x) => Math.max(0, Math.min(1, x)), st = e.state, inSpot = !!e.spot && ['inCover', 'suppressed', 'telegraph', 'fire'].includes(st);
  const peek = st === 'telegraph' ? c(e.stateT / (e.telegraphDur || 0.5)) : st === 'fire' ? 1 : 0;
  const cover = (st === 'inCover' || st === 'suppressed' || st === 'telegraph' || st === 'fire') && inSpot ? 1 : (st === 'seekCover' || st === 'returnCover') ? 0.5 : 0;
  let anim = e.dead ? 'die' : (e.hurtT || 0) > 0 ? 'hit' : st === 'fire' ? 'fire' : cover >= 1 ? 'cover' : e.moving ? 'walk' : 'idle';
  const attackPhase = st === 'fire' ? ((e.muzzleT || 0) > 0 ? 0.2 : 0.7) : 0;
  return { cover, peek, coverFacing: inSpot && Number.isFinite(e.spot.nx) ? Math.atan2(-e.spot.ny, -e.spot.nx) : e.facing,
    anim, attackPhase, shieldHit: Number.isFinite(e.shieldHitAt) && Number.isFinite(e.hitAt) && Math.abs(e.shieldHitAt - e.hitAt) < 1e-6 };
}
function animOf(world, e) {
  if (e.dead) return 'die';
  if (e.state === 'staggered' || (e.hurtT || 0) > 0) return 'hit';
  if (ATTACK.has(e.state)) return 'attack';
  return e.moving ? 'walk' : 'idle';
}
/** 0–1 gjennom hele angrepet: varsel 0–0.5, aktiv 0.5–0.8, etterslep 0.8–1. 0 utenfor angrep. */
function attackPhaseOf(e, d) {
  const c = (x) => Math.max(0, Math.min(1, x));
  switch (e.state) {
    case 'telegraph': case 'spinup': return 0.5 * c(e.stateT / (e.telegraphDur || 0.5));
    case 'meleeRush': return 0.15 * c(e.stateT / (d.melee?.rushMax || 1));
    case 'meleeCharge': return 0.15 + 0.35 * c(e.stateT / (d.melee?.charge || 0.3));
    case 'fire': return 0.5 + 0.3 * c(1 - (e.burstLeft || 0) / Math.max(1, e.burstSize || 3));
    case 'sustain': return 0.65;
    case 'meleeStrike': return 0.5 + 0.3 * c(e.stateT / 0.32);
    case 'meleeRecover': return 0.8 + 0.2 * c(e.stateT / (d.melee?.recover || 0.3));
    case 'throw': {
      const G = d.grenade; if (!G) return 0;
      return e.thrown ? 0.8 + 0.2 * c((e.stateT - G.windup) / G.recover) : 0.5 * c(e.stateT / G.windup) + (e.stateT >= G.windup ? 0.3 : 0);
    }
    default: return 0;
  }
}

export function poseOf(world, e) {
  const d = e.def, am = e.dead ? null : ammo(e);
  const tele = e.state === 'telegraph' || e.state === 'spinup';
  const G = d.grenade;
  let thr = null;
  if (e.state === 'throw' && G && e.throwTarget) {
    thr = e.thrown
      ? { phase: 'release', progress: Math.min(1, (e.stateT - G.windup) / G.recover), target: e.throwTarget }
      : { phase: 'windup', progress: Math.min(1, e.stateT / G.windup), target: e.throwTarget };
    thr.radius = G.radius;
  }
  const inSpot = e.spot && (e.state === 'inCover' || e.state === 'suppressed' || e.state === 'telegraph' || e.state === 'fire' || e.state === 'spinup' || e.state === 'sustain' || e.state === 'throw');
  return {
    id: e.id, type: e.type, variant: e.variant ?? null, displayName: e.displayName || null, x: e.x, y: e.y, r: e.r,
    rise: e.riseDur > 0 && (world.time - (e.bornAt ?? 0)) < e.riseDur ? { progress: Math.max(0, Math.min(1, (world.time - e.bornAt) / e.riseDur)), duration: e.riseDur } : null,
    inCover: !!inSpot, suppression: Math.max(0, Math.min(1, (e.suppression || 0) / (d.suppressThreshold || 1))),
    facing: e.facing, aim: e.aim,
    colors: { main: d.color, dark: d.dark, accent: d.accent },
    state: e.state,
    moving: !!e.moving, speed: Math.hypot(e.vx || 0, e.vy || 0), walkPhase: e.walkPhase || 0,
    crouch: e.crouch || 0,
    coverSide: inSpot ? { nx: e.spot.nx, ny: e.spot.ny } : null,
    coverType: inSpot ? e.spot.type : null,
    popUp: !!(inSpot && e.spot.type === 'low' && (e.state === 'telegraph' || e.state === 'fire' || e.state === 'spinup' || e.state === 'sustain')),
    hurt: Math.min(1, (e.hurtT || 0) * 8),
    muzzleFlash: (e.muzzleT || 0) > 0,
    muzzle: muzzle(e),
    alert: e.state === 'alert',
    suppressed: e.state === 'suppressed',
    flanking: e.state === 'flank' || e.state === 'engage' || e.state === 'meleeRush' || e.state === 'meleeCharge' || e.state === 'meleeStrike',
    telegraph: tele ? {
      progress: Math.min(1, e.stateT / (e.telegraphDur || 0.5)), duration: e.telegraphDur || 0.5,
      flank: !!e.flankShot, spinup: e.state === 'spinup',
    } : null,
    firing: e.state === 'fire' || e.state === 'sustain',
    fireMode: e.state === 'sustain' ? e.fireMode || 'direct' : e.state === 'fire' ? 'direct' : null,
    streamLen: e.state === 'sustain' ? e.streamLen ?? 520 : 0,
    spin: e.spin || 0, spinPhase: e.spinPhase || 0,
    throw: thr,
    hp: e.hp, maxHp: e.maxHp,
    plating: { plate: PLATE, trim: d.color, visor: VISOR[e.type] || '#ff4a2a', glitch: e.dead ? 0 : glitch(world, e) },
    reloading: !!am?.reloading,
    reload: am?.reloading && am.reloadTotal > 0 ? { progress: Math.min(1, am.reloadProgress), duration: am.reloadTotal } : null,
    stagger: e.state === 'staggered' ? { progress: Math.min(1, (world.time - (e.staggerT0 ?? world.time)) / (e.staggerDur || 0.4)), duration: e.staggerDur || 0.4 } : null,
    melee: e.state === 'meleeRush' ? { phase: 'rush', progress: Math.min(1, e.stateT / d.melee.rushMax) }
      : e.state === 'meleeCharge' ? { phase: 'charge', progress: Math.min(1, e.stateT / d.melee.charge) }
      : e.state === 'meleeStrike' ? { phase: 'strike', progress: Math.min(1, e.stateT / 0.32), contactAt: CONTACT(), contact: e.stateT >= CONTACT(), hit: !!e.meleeHit }
      : e.state === 'meleeRecover' ? { phase: 'recover', progress: Math.min(1, e.stateT / d.melee.recover), hit: !!e.meleeHit } : null,
    dead: !!e.dead, corpseT: e.corpseT || 0, deathAngle: e.deathAngle || 0,
    // 13:53-avtalen med Monsterdesign: grov animasjonsklasse + fase i angrepet, siste treff, boss-/typefelt.
    anim: animOf(world, e), attackPhase: attackPhaseOf(e, d),
    hitAt: Number.isFinite(e.hitAt) ? e.hitAt : null,
    ...(e.type === 'hunker' ? hunkerPose(world, e) : null),
    // 27.10: helt dukket bak lavt cover (cover 1, peek 0) – alle typer. Render skjuler fot-/målringen da.
    duckedLow: !e.dead && !!e.spot && e.spot.type === 'low' && (e.type === 'hunker' ? (hunkerPose(world, e).cover >= 1 && hunkerPose(world, e).peek <= 0) : ((e.state === 'inCover' || e.state === 'suppressed' || e.state === 'reloadDuck') && (e.crouch || 0) >= 0.95)),
    sacksLeft: e.type === 'grenadier' ? (e.sacks ?? 3) : null,
    height: e.height ?? null,        // verdens-px z, toppen av kroppen nå (huk interpolert) – stats.js BODY
    muzzleZ: e.muzzleZ ?? null,      // verdens-px z, munningspunkt (spydarm/kjeft/hals); Våpen tegner skudd herfra
    aimHeight: e.aimHeight ?? null,  // verdens-px z, brysthøyde (treffpunkt)
    aimPoint: e.aimPoint ? { ...e.aimPoint } : null,   // det fienden sikter mot {x, y, z = målets brysthøyde}
    coreBroken: e.variant === 'alpha' ? (e.coreBroken ?? 0) : null,
    vents: e.vents ? e.vents.map(v => ({ id: v.id, angle: v.angle, open: !!v.open, broken: !!v.broken, heat: Math.max(0, Math.min(1, v.heat ?? 0)) })) : null,
    debug: { path: e.path, pathIdx: e.pathIdx, spot: e.spot, flankPlan: e.state === 'flank' ? e.flankPlan : null, suppression: e.suppression },
  };
}
