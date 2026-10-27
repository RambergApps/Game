// Warden – tilstandsmaskin (ANIMASJON.md §3). Ren spillogikk: posisjon, fart, dekning, positur, r/inCover/blindfire/invuln (skadereduksjon via p.damageMult).
// Utseendet får bare det riggen trenger via driveRig() (tilstand, retninger, positur, bakkepunkt).
import { resolveCircleVsCover } from '../core/index.js';
import { TUNING as T } from './tuning.js';
import { findCover, coverPos, coverAt, cornerInfo, freeAt, alongOf } from './cover.js';
import { consume } from './controller.js';
import { clamp, lerp, easeOut3, easeIO } from './math.js';
import * as fx from './fx.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const emit = (P, type, o) => P.world.events.emit(type, { entity: P.p, x: P.p.x, y: P.p.y, ...o });

// ---------------------------------------------------------------- rull-profil (skaleres til rollDist × rollDistMult)
function rollSpeedRaw(t) { // t i s
  const ms = t * 1000, pk = T.rollPeakSpeed;
  if (ms < 90) return pk * (0.7 + 0.3 * ms / 90);
  if (ms < 420) return pk - (pk - T.rollEndSpeed) * easeOut3((ms - 90) / 330);
  return lerp(T.rollEndSpeed, T.rollExitSpeed, clamp((ms - 420) / 80, 0, 1));
}
let ROLL_NOMINAL = 0; for (let t = 0; t < T.rollTime; t += 1 / 600) ROLL_NOMINAL += rollSpeedRaw(t) / 600;

// ---------------------------------------------------------------- hjelpere
/** Hitstop for hele verden via core (world.hitstop, maks 0,25 s). Fallback: lokal frys + riggfrys for eldre core/testsider. */
function hitstop(P, sec) {
  if (typeof P.world.hitstop === 'function') P.world.hitstop(sec);
  else { P.freeze = sec; P.rig.freeze(sec); }
}
export function setState(P, name, data = {}) {
  const from = P.st.name; P.st = { name, t: 0, ...data };
  if (from !== name) emit(P, 'playerState', { from, to: name, state: name });
}
function moveDir(I) { return I.ml ? { x: I.mx, y: I.my } : null; }
function aimDir(P) { return { x: Math.cos(P.aim), y: Math.sin(P.aim) }; }
function collide(P) { resolveCircleVsCover(P.world, P.p, T.collisionRadius); }
function coverInfo(P) { const L = P.cov.line; if (!L) return null; const ci = P.cov.corner; return { nx: L.nx, ny: L.ny, type: L.type, atCorner: !!ci?.at, edgeDir: ci?.at ? ci.side : 0 }; }
export function isReloading(P) { const L = P.p.loadout; return !!L?.reload; }

/** Felles gange/løp. mul skalerer maksfart. */
function locomote(P, I, dt, mul = 1) {
  const p = P.p, aiming = I.aim, sprint = I.sprint && I.ml && !aiming && !I.fire && !I.grenade;
  let sp = sprint ? T.runSpeed : aiming ? T.aimWalkSpeed : T.walkSpeed;
  if (!sprint && I.ml && I.mx * Math.cos(P.aim) + I.my * Math.sin(P.aim) < -0.3) sp *= T.backpedalMul;
  if (isReloading(P)) sp *= T.reloadMoveMul;
  if (I.grenade) sp *= T.grenadeAimMoveMul;
  sp *= mul;
  const tx = I.mx * sp, ty = I.my * sp;
  const tau = I.ml ? (sprint ? T.runAccel : T.walkAccel) : (P.sprinting ? T.runDecel : T.walkDecel);
  const k = 1 - Math.exp(-dt * 3 / tau);
  p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
  if (sprint && I.ml) { // begrenset svingrate ved sprint
    const sp0 = Math.hypot(p.vx, p.vy); if (sp0 > 60) { const a0 = Math.atan2(p.vy, p.vx), a1 = Math.atan2(I.my, I.mx); const na = a0 + clamp(angDiff(a0, a1), -T.runTurnRate * dt * 3, T.runTurnRate * dt * 3); p.vx = Math.cos(na) * sp0; p.vy = Math.sin(na) * sp0; }
  }
  P.sprinting = sprint && Math.hypot(p.vx, p.vy) > T.walkSpeed * 0.9;
  p.x += p.vx * dt; p.y += p.vy * dt; collide(P);
}

// ---------------------------------------------------------------- overganger
export function startRoll(P, dir) {
  if (P.rollCd > 0) return false;
  const d = dir || aimDir(P);
  leaveCover(P, false);
  setState(P, 'roll', { dir: d, a: Math.atan2(d.y, d.x) });
  P.rig.play('roll'); emit(P, 'roll', { phase: 'start', angle: Math.atan2(d.y, d.x) });
  return true;
}
function startSlide(P, cand, dash) {
  const p = P.p; const L = cand.line;
  leaveCover(P, false);
  setState(P, 'slide', { line: L, along: cand.along, tx: cand.x, ty: cand.y, dash, v: dash ? T.dashSpeed * 0.8 : Math.max(Math.hypot(p.vx, p.vy), T.walkSpeed * 0.6), d0: cand.dist });
}
function enterCover(P, L, along, vin) {
  const p = P.p, S = coverPos(L, along);
  p.x = S.x; p.y = S.y; p.vx = p.vy = 0;
  P.cov = { line: L, along, sub: 'hidden', peek: 0, blind: 0, blindT: 0, exitHold: 0, lean: 0, corner: cornerInfo(P.world, L, along) };
  setState(P, 'cover');
  const c = coverAt(L, along);
  emit(P, 'coverEnter', { cover: c, type: L.type, nx: L.nx, ny: L.ny });
  if (vin > 0) hardStop(P, L, vin);
}
function hardStop(P, L, vin) {
  const p = P.p, k = clamp(vin / T.slideSpeed, 0.25, 1.2);
  hitstop(P, T.hitstop); P.rig.play('impact', { nx: L.nx, ny: L.ny, k });
  P.world.camera?.shake(T.impactShake * k, T.impactShakeMs);
  const fxp = { x: p.x - L.nx * 9, y: p.y - L.ny * 9 }, out = Math.atan2(L.ny, L.nx);
  fx.dust(P.world, fxp.x, fxp.y, Math.round(T.impactDust * k), 110 * k, 6, 0.55, out, 2.6);
  fx.debris?.(P.world, fxp.x, fxp.y, out, Math.round(T.impactDebris * k));
  emit(P, 'coverImpact', { speed: vin, nx: L.nx, ny: L.ny, type: L.type, cover: coverAt(L, P.cov.along) });
}
export function leaveCover(P, withExit = true) {
  if (!P.cov.line) return;
  const L = P.cov.line; P.cov.line = null;
  emit(P, 'coverExit', { type: L.type, nx: L.nx, ny: L.ny });
  if (withExit) { setState(P, 'exitCover', { nx: L.nx, ny: L.ny }); P.rig.play('exitCover', { nx: L.nx, ny: L.ny }); }
}
function tryCoverE(P, I) {
  const d = moveDir(I);
  const cand = findCover(P.world, P.p.x, P.p.y, { radius: T.coverRadiusE, cone: d ? T.coverConeE : Math.PI, dir: d });
  if (!cand) return false;
  if (cand.dist < 4) { enterCover(P, cand.line, cand.along, 0); return true; }
  startSlide(P, cand, false); return true;
}
function tryDash(P, I) {
  const d = moveDir(I) || aimDir(P);
  const cand = findCover(P.world, P.p.x, P.p.y, { radius: T.dashRadius, cone: T.dashCone, dir: d, exclude: P.cov.line, lookahead: 60 });
  if (!cand || cand.dist < T.dashMin) return false;
  startSlide(P, cand, true); return true;
}
function tryVault(P) {
  const L = P.cov.line; if (!L || L.type !== 'low') return false;
  const c = coverAt(L, P.cov.along), depth = L.nx !== 0 ? c.w : c.h; if (depth > T.vaultMaxDepth) return false;
  const p = P.p, land = coverPos(L, P.cov.along, 0); land.x -= L.nx * (depth + T.coverStandoff); land.y -= L.ny * (depth + T.coverStandoff);
  if (!freeAt(P.world, land.x, land.y)) return false;
  leaveCover(P, false);
  setState(P, 'vault', { x0: p.x, y0: p.y, x1: land.x, y1: land.y, nx: L.nx, ny: L.ny, landed: false });
  P.rig.play('vault'); emit(P, 'vault', { phase: 'start', nx: L.nx, ny: L.ny }); return true;
}
export function startMelee(P, angle) {
  const p = P.p, L = P.cov.line;
  if (L) { leaveCover(P, false); const nx = p.x + L.nx * T.meleeCoverPush, ny = p.y + L.ny * T.meleeCoverPush; if (freeAt(P.world, nx, ny)) { p.x = nx; p.y = ny; } }
  setState(P, 'melee', { angle, stepDone: 0, hitPending: false });
  P.rig.play('melee');
}
export function startStagger(P, fromX, fromY, k = 1) {
  if (P.st.name === 'death' || P.st.name === 'roll' && P.p.invuln) return;
  const p = P.p, a = Math.atan2(p.y - fromY, p.x - fromX);
  if (P.cov.line) leaveCover(P, false);
  setState(P, 'stagger', { kx: Math.cos(a) * T.staggerKnock * k, ky: Math.sin(a) * T.staggerKnock * k });
  P.rig.play('stagger', { angle: a });
}
export function startDeath(P) {
  if (P.cov.line) leaveCover(P, false);
  setState(P, 'death'); P.rig.play('death'); P.p.vx = P.p.vy = 0;
}

// ---------------------------------------------------------------- per-tilstand
const UPD = {
  move(P, I, dt) {
    locomote(P, I, dt);
    // Space utenfor dekning ruller alltid: trykket beholdes i bufferen til cooldown er ute (ble før spist og tapt)
    if (I.space && P.rollCd > 0) { consume(P.ctl, 'space'); P.rollQ = P.world.time; }
    if ((I.space || (P.rollQ != null && P.world.time - P.rollQ < 0.45)) && P.rollCd <= 0) { consume(P.ctl, 'space'); P.rollQ = null; if (startRoll(P, moveDir(I))) return; }
    if (I.e) { consume(P.ctl, 'e'); if (tryCoverE(P, I)) return; }
    if (I.q) { consume(P.ctl, 'q'); if (tryDash(P, I)) return; }
  },
  roll(P, I, dt) {
    const s = P.st, p = P.p, mult = (P.world.playerStats?.rollDistMult ?? 1) * T.rollDist / ROLL_NOMINAL;
    const v = rollSpeedRaw(s.t) * mult;
    // liten styring mot input under første del
    if (I.ml && s.t < 0.12) { const a1 = Math.atan2(I.my, I.mx); s.a += clamp(angDiff(s.a, a1), -2.5 * dt, 2.5 * dt); }
    p.vx = Math.cos(s.a) * v; p.vy = Math.sin(s.a) * v;
    const ox = p.x, oy = p.y; p.x += p.vx * dt; p.y += p.vy * dt; collide(P);
    if (Math.hypot(p.x - ox, p.y - oy) < v * dt * 0.25 && s.t > 0.05) s.blocked = (s.blocked || 0) + dt;
    p.invuln = s.t >= T.rollIFrame[0] && s.t <= T.rollIFrame[1];
    if (s.t >= T.rollCancelAt) {
      if (I.space && s.t >= T.rollBufferOpen) { consume(P.ctl, 'space'); P.rollQ = P.world.time; }   // bufret: nytt rull straks cooldown er ute
      if (I.e) { consume(P.ctl, 'e'); if (tryCoverE(P, I)) return endRoll(P); }
      if (I.q) { consume(P.ctl, 'q'); if (tryDash(P, I)) return endRoll(P); }
      if (I.fire || I.aim) { endRoll(P); return setState(P, 'move'); }
    }
    if (s.t >= T.rollTime) { endRoll(P); const k = T.rollExitSpeed / Math.max(1, v); p.vx *= k; p.vy *= k; setState(P, 'move'); }
  },
  slide(P, I, dt) {
    const s = P.st, p = P.p;
    if (s.t < T.slideAnticip && !s.dash) { p.vx *= 0.8; p.vy *= 0.8; return; }
    const vmax = s.dash ? T.dashSpeed : T.slideSpeed;
    s.v = Math.min(vmax, s.v + (vmax / T.slideRamp) * dt);
    const dx = s.tx - p.x, dy = s.ty - p.y, d = Math.hypot(dx, dy);
    s.remain = d;
    if (d <= s.v * dt + 0.5) { p.x = s.tx; p.y = s.ty; return enterCover(P, s.line, s.along, s.v); }
    const ox = p.x, oy = p.y; p.vx = dx / d * s.v; p.vy = dy / d * s.v; p.x += p.vx * dt; p.y += p.vy * dt; collide(P);
    if (Math.hypot(p.x - ox, p.y - oy) < s.v * dt * 0.3) { s.stuck = (s.stuck || 0) + dt; if (s.stuck > 0.08) return setState(P, 'move'); }
    if (s.t > 1.2) setState(P, 'move');
    // støvstripe bak støvlene i baseball-sliden
    if (!s.dash || d < T.dashSlideDist) { P.dustAcc = (P.dustAcc || 0) + dt; if (P.dustAcc > 0.025) { P.dustAcc = 0; fx.dust(P.world, p.x - p.vx / s.v * 8, p.y - p.vy / s.v * 8, 1, 30, 4, 0.45, Math.atan2(-p.vy, -p.vx), 0.8); } }
  },
  cover(P, I, dt) {
    const p = P.p, C = P.cov, L = C.line; if (!L) return setState(P, 'move');
    const high = L.type === 'high';
    C.corner = cornerInfo(P.world, L, C.along);
    const fo = Math.atan2(-L.ny, -L.nx), back = Math.abs(angDiff(fo, P.aim));
    // ut av dekning
    if (I.e) { consume(P.ctl, 'e'); return leaveCover(P); }
    if (I.q) { consume(P.ctl, 'q'); if (tryDash(P, I)) return; }
    if (I.space) { consume(P.ctl, 'space');
      const vn = I.mx * L.nx + I.my * L.ny, vt = I.mx * L.tx + I.my * L.ty;
      if (!high && (!I.ml || vn < -0.4) && tryVault(P)) return;
      if (I.ml && vn > -0.4) { if (startRoll(P, moveDir(I))) return; }
      else if (high || !I.ml) { if (startRoll(P, { x: Math.abs(vt) > 0.1 ? L.tx * Math.sign(vt) : L.nx, y: Math.abs(vt) > 0.1 ? L.ty * Math.sign(vt) : L.ny })) return; }
    }
    if (I.aim && back > T.aimBackExit) return leaveCover(P);
    // positur
    let want = 'hidden';
    if (I.aim) want = high ? (C.corner.at ? 'lean' : 'hidden') : (C.corner.at && back > 0.9 ? 'lean' : 'popUp');
    else if (I.fire) want = 'blind';
    if (want === 'blind') C.blindT = T.blindHold; else C.blindT = Math.max(0, C.blindT - dt);
    if (want === 'hidden' && C.blindT > 0) want = 'blind';
    C.sub = want;
    const pk = want === 'popUp' || want === 'lean' ? 1 : 0;
    C.peek += clamp(pk - C.peek, -dt / (pk ? T.popDownTime : T.popDownTime), dt / (want === 'lean' ? T.leanOutTime : T.popUpTime));
    C.blind += clamp((want === 'blind' ? 1 : 0) - C.blind, -dt / T.blindRaise, dt / T.blindRaise);
    const leanT = want === 'lean' ? C.corner.side : 0; C.lean += clamp(leanT - C.lean, -dt / T.leanInTime, dt / T.leanOutTime);
    // gli langs flaten (ikke mens man sikter)
    const vt = I.mx * L.tx + I.my * L.ty, vn = I.mx * L.nx + I.my * L.ny;
    if (!pk) { const sp = T.coverGlideSpeed * (C.blind > 0.5 ? 0.6 : 1); C.along = clamp(C.along + vt * sp * dt, L.tmin + T.coverEndInset, L.tmax - T.coverEndInset); C.gliding = Math.abs(vt) > 0.2; } else C.gliding = false;
    if (I.ml && vn > 0.7) { C.exitHold += dt; if (C.exitHold >= T.coverExitHold) return leaveCover(P); } else C.exitHold = 0;
    const S = coverPos(L, C.along + C.lean * T.leanOffset), ox = p.x, oy = p.y;
    p.x = S.x; p.y = S.y; p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
  },
  exitCover(P, I, dt) {
    const s = P.st, p = P.p; p.vx = s.nx * T.exitCoverSpeed; p.vy = s.ny * T.exitCoverSpeed;
    p.x += p.vx * dt; p.y += p.vy * dt; collide(P);
    if (s.t >= T.exitCoverTime || I.space || I.fire || I.aim) setState(P, 'move');
  },
  vault(P, I, dt) {
    const s = P.st, p = P.p, k = easeIO(clamp(s.t / T.vaultTime, 0, 1));
    p.x = lerp(s.x0, s.x1, k); p.y = lerp(s.y0, s.y1, k); p.vx = (s.x1 - s.x0) / T.vaultTime; p.vy = (s.y1 - s.y0) / T.vaultTime;
    if (!s.landed && s.t >= 0.3) { s.landed = true; emit(P, 'vault', { phase: 'land' }); fx.dust(P.world, p.x, p.y, 6, 70, 5, 0.5); }
    if (s.t >= T.vaultTime || (s.t >= T.vaultCancelAt && (I.fire || I.aim || I.space))) { p.x = s.x1; p.y = s.y1; p.vx = -s.nx * 120; p.vy = -s.ny * 120; setState(P, 'move'); }
  },
  stagger(P, I, dt) {
    const s = P.st, p = P.p, k = Math.max(0, 1 - s.t / T.staggerTime);
    p.vx = s.kx * k * k; p.vy = s.ky * k * k; p.x += p.vx * dt; p.y += p.vy * dt; collide(P);
    if (s.t >= T.staggerTime || (s.t >= T.staggerCancelAt && (I.ml || I.space))) setState(P, 'move');
  },
  melee(P, I, dt) {
    const s = P.st, p = P.p, ms = s.t * 1000;
    locomote(P, { ...I, sprint: false }, dt, T.meleeMoveMul);
    // liten utfall-steg mot målet i slaget (120–200 ms), fot plantes
    if (ms >= 120 && ms <= 200) { const want = T.meleeStep * clamp((ms - 120) / 80, 0, 1), d = want - s.stepDone; const nx = p.x + Math.cos(s.angle) * d, ny = p.y + Math.sin(s.angle) * d; if (freeAt(P.world, nx, ny)) { p.x = nx; p.y = ny; } s.stepDone = want; }
    if (s.hitPending && ms >= 165) { s.hitPending = false; hitstop(P, T.meleeHitstop); }
    const tot = T.meleeWindup + T.meleeStrike + T.meleeRecover;
    if (s.t >= T.meleeCancelAt) {
      if (I.space && P.rollCd <= 0) { consume(P.ctl, 'space'); P.rig.stop?.('melee'); if (startRoll(P, moveDir(I))) return; }
      if (I.e) { consume(P.ctl, 'e'); if (tryCoverE(P, I)) return; }
      if (I.sprint && I.ml) return setState(P, 'move');
    }
    if (s.t >= tot) setState(P, 'move');
  },
  death(P, I, dt) { const p = P.p; p.vx *= 0.85; p.vy *= 0.85; p.x += p.vx * dt; p.y += p.vy * dt; collide(P); },
};
function endRoll(P) { P.p.invuln = false; P.rollCd = T.rollCooldown; }

export function stepState(P, I, dt) {
  P.rollCd = Math.max(0, P.rollCd - dt);
  if (P.freeze > 0) { P.freeze -= dt; return; }          // reserve: lokal frys bare når core mangler world.hitstop
  P.st.t += dt;
  UPD[P.st.name](P, I, dt);
  if (P.st.name !== 'roll') P.p.invuln = false;
  applyPosture(P);
}

/** r / coverHitChance / inCover per tilstand (ANIMASJON §6). Skadereduksjon går via p.damageMult (index.js), ikke armor. */
function applyPosture(P) {
  const p = P.p, n = P.st.name, R = T.r, C = P.cov;
  let r = R.stand, chance, posture = n;
  if (n === 'roll') r = R.roll;
  else if (n === 'slide') r = R.slide;
  else if (n === 'stagger') r = R.stagger;
  else if (n === 'vault') r = R.vault;
  else if (n === 'melee') r = R.melee;
  else if (n === 'move' || n === 'exitCover') r = P.sprinting ? R.run : Math.hypot(p.vx, p.vy) > 20 ? R.move : R.stand;
  else if (n === 'cover') { posture = C.sub; r = R[C.sub] ?? R.hidden; chance = T.coverHitChance[C.sub]; }
  p.r = r; p.posture = posture; p.inCover = n === 'cover'; p.blindfire = n === 'cover' && C.sub === 'blind';
  if (chance === undefined) delete p.coverHitChance; else p.coverHitChance = chance;
}

/** Hva riggen (utseendet) trenger: tilstand, retninger, positur, bakkepunkt. */
export function driveRig(P) {
  const p = P.p, n = P.st.name, s = P.st, C = P.cov, spd = Math.hypot(p.vx, p.vy);
  const d = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, aimAngle: P.aim, cover: null, aimBlend: 0, peek: 0, blind: 0, exposed: true };
  const aimPose = P.intent?.aim ? 1 : 0;
  if (n === 'move' || n === 'exitCover') { d.mode = P.sprinting ? 'run' : spd > 25 ? 'walk' : 'idle'; d.aimBlend = aimPose || (P.intent?.fire ? 0.8 : 0); if (spd > 25) d.moveAngle = Math.atan2(p.vy, p.vx); }
  else if (n === 'roll') { d.mode = 'roll'; d.moveAngle = s.a; }
  else if (n === 'slide') { d.mode = s.dash && (s.remain ?? 999) > T.dashSlideDist ? 'dash' : 'slide'; d.moveAngle = Math.atan2(p.vy, p.vx); d.cover = { nx: s.line.nx, ny: s.line.ny, type: s.line.type }; }
  else if (n === 'cover') { d.mode = 'cover'; d.cover = coverInfo(P); d.peek = C.peek; d.blind = C.blind; d.aimBlend = C.peek; d.exposed = C.sub !== 'hidden'; if (C.gliding) d.moveAngle = Math.atan2(p.vy, p.vx); }
  else if (n === 'vault') { d.mode = 'vault'; d.moveAngle = Math.atan2(p.vy, p.vx); }
  else if (n === 'stagger') d.mode = 'stagger';
  else if (n === 'melee') { d.mode = spd > 25 ? 'walk' : 'idle'; d.faceAngle = s.angle; d.aimAngle = s.angle; }
  else if (n === 'death') d.mode = 'death';
  P.rig.drive(d);
}
export { alongOf };
