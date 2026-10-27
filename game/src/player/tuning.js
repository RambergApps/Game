// Warden – tuning (ANIMASJON.md §8). Våpentall (magasin, rekyl, spredning, lading, granatantall) eies av src/weapons.
// Tider i sekunder, avstander i px, fart i px/s, vinkler i radianer der ikke annet står.
const D = Math.PI / 180;
export const TUNING = {
  // kropp
  bodyRadius: 13, collisionRadius: 12, coverStandoff: 15, coverEndInset: 9, coverLookahead: 24,
  r: { stand: 13, run: 12, roll: 10, move: 12, slide: 12, hidden: 11, popUp: 12, lean: 11, blind: 11, stagger: 13, melee: 13, vault: 12, death: 13 },
  // bevegelse
  walkSpeed: 180, aimWalkSpeed: 115, backpedalMul: 0.8, runSpeed: 290, coverGlideSpeed: 95, reloadMoveMul: 0.85, grenadeAimMoveMul: 0.7,
  walkAccel: 0.09, walkDecel: 0.07, runAccel: 0.18, runDecel: 0.14, runTurnRate: 5,
  // input
  inputBuffer: 0.15, coverCoyote: 0.10, coverExitHold: 0.15, cornerExitHold: 0.20,
  // dekningssøk
  coverRadiusE: 112, coverConeE: 45 * D, coverTouchDist: 20, dashRadius: 320, dashMin: 40, dashCone: 18 * D, dashRays: 15,
  cornerZone: 32, coverMergeGap: 6, coverMaxLateral: 24, coverMagnetFrac: 0.3, coverPathPad: 11,
  // slide / dash / støt
  slideAnticip: 0.033, slideRamp: 0.05, slideSpeed: 400, dashSpeed: 360, dashSlideDist: 85,
  hitstop: 0.033, impactTime: 0.08, settleTime: 0.12, impactSquash: 0.88, impactStretch: 1.08,
  impactShake: 3.5, impactShakeMs: 110, impactDust: 14, impactDebris: 7,
  // rull (kollbøtte)
  rollTime: 0.5, rollPeakSpeed: 420, rollEndSpeed: 160, rollExitSpeed: 170, rollDist: 130, rollIFrame: [0.06, 0.30],
  rollBufferOpen: 0.25, rollCancelAt: 0.40, rollCooldown: 0.25,
  // hopp / exit
  swatTime: 0.30, swatMaxGap: 96, vaultTime: 0.40, vaultCancelAt: 0.33, vaultMaxDepth: 48, exitCoverTime: 0.16, exitCoverSpeed: 70,
  // peek
  popUpTime: 0.14, riseExposePeek: 0.6, duckHidePeek: 0.5, popDownTime: 0.07, leanOutTime: 0.16, leanInTime: 0.14, leanOffset: 20, leanHipTwist: 17 * D,
  blindRaise: 0.10, blindHold: 0.30, coverAimArc: 80 * D, aimBackExit: 100 * D, hiddenHeight: 0.86, hiddenHeightHigh: 0.88,
  // granat (bare kroppstiming – selve kastet eies av weapons)
  grenadeWindup: 0.22, grenadeRelease: 0.26, grenadeRecovery: 0.24,
  // nærkamp (kolbeslag, F) – treff/skade eies av weapons (TUNING.melee: windup 0.12, recover 0.2)
  meleeWindup: 0.12, meleeStrike: 0.10, meleeRecover: 0.30, meleeCancelAt: 0.32, meleeMoveMul: 0.35, meleeStep: 9,
  meleeCoverPush: 7, meleeHitstop: 0.033, meleeShake: 2.2, meleeShakeMs: 90,
  // skade
  coverHitChance: { hidden: 0.1, popUp: 0.6, lean: 0.6, blind: 0.25 },
  blindArmor: 0.5, staggerDmg: 25, staggerTime: 0.38, staggerCancelAt: 0.26, staggerKnock: 140, explosionStaggerR: 64,
  flinchTime: 0.12, hitFlash: 0.06,
  // helse
  maxHp: 100, regenDelay: 3.5, regenPerSec: 18, regenRamp: 0.25, healthEventInterval: 0.25, deathTime: 1.1,
  omenVignetteStart: 0.75, omenSymbolBelow: 0.35,
};

// URL-flagg for regen-sammenligning (Test): ?regenDelay=N&regenRate=N overstyrer regenDelay / regenPerSec.
try { const q = new URLSearchParams(location.search), d = parseFloat(q.get('regenDelay')), r = parseFloat(q.get('regenRate'));
  if (d >= 0) TUNING.regenDelay = d; if (r > 0) TUNING.regenPerSec = r; } catch (e) { /* ikke nettleser */ }
