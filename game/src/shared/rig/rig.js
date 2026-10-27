// createRig(def, {style}) – datadrevet rigg for Warden og Protocol-fiender (KARAKTER-SPEC §7).
//
//   const rig = createRig(WARDEN, { skin: 'protocol' });
//   rig.drive({ x, y, vx, vy, aimAngle, mode, moveAngle?, faceAngle?, height?, cover:{nx,ny,type,atCorner,edgeDir}|null,
//               aimBlend, peek, blind, exposed });
//   rig.play('roll'|'impact'|'vault'|'hurt'|'stagger'|'death'|'fire'|'melee'|'exitCover', opts);
//   const events = rig.update(dt);       // [{type:'footstep', foot, x, y, kind}, {type:'land'}, {type:'meleeContact'}, ...]
//   rig.draw(ctx, camera, { alpha, flash, rim, under });   // ctx i verdensrom
//   rig.socket('muzzle'|'head'|'handR'|'handL'|'throwHand'|'back'|'butt') → { x, y, angle }
//   rig.pose  → { hipAngle, torsoAngle, headAngle, phase }       rig.frame() → full ramme (se APPEARANCE under)
//   rig.freeze(sec) (hitstop), rig.reset(x, y, angle), rig.setStyle(style), rig.setSkin(id)
//
// APPEARANCE-KONTRAKT (byttbart utseende):
//   Riggen eier ALL bevegelseslogikk (fjærer, gange, klipp, verlet) og bygger en ramme F per tegning.
//   F har et stil-uavhengig hode: { x, y (bakkepunkt/fot-anker), skin, mode, moveAngle, moveSpeed, aimAngle, hipAngle,
//   torsoAngle, headAngle, phase, amp, height, posture:{aim,sprint,kneel,slide,roll,cover,peek,blind,melee},
//   cover, clip:{id, t, sample}, flash, alpha, ghosts[] } – nok for en sprite-stil (8/16 retninger, fot-anker, y-sortering
//   via shared/projection.js sortKey). Resten av F (skel: R2L/L2W/feet/scarf …) brukes av 'painted'.
//   style = { name, drawFigure(ctx, rig, F, opts), sortKey?(F) }.
import { painted } from './styles/painted.js';
import { CLIPS } from './clips.js';
import { legPoses, footsteps } from './gait.js';
import { createChain, stepChain } from './cloth.js';
import { TAU, PI, clamp, lerp, damp, dampAng, wrap, spring } from './math.js';

const angDiff = (a, b) => wrap(b - a);
const mixPose = (a, b, t) => ({ bx: lerp(a.bx, b.bx, t), by: lerp(a.by, b.by, t), a: lerp(a.a, b.a, t), f: lerp(a.f, b.f, t) });

const DEFAULTS = {
  id: 'warden', scale: 1, skin: 'warden',
  limits: { torsoK: 16, torsoKRun: 9, torsoKCover: 10, torsoKPeek: 16, hipK: 11, hipKRun: 16, twistMove: 1.2, twistHard: 1.45, pivotThreshold: 1.05, backEnter: 2.05, backExit: 1.75 },
  gait: { strideWalk: 26, strideAim: 20, strideBack: 18, strideRun: 40, strideGlide: 12, footSpread: 6 },
  weapon: { muzzle: 39, butt: -10, poses: {
    aim: { bx: -1.5, by: 5.6, a: -.05, f: 1 }, ready: { bx: 1, by: 6.2, a: -.5, f: .86 }, sprint: { bx: 5, by: 3.5, a: -.95, f: .7 },
    cover: { bx: 4, by: 4.5, a: -.32, f: .56 }, blind: { bx: 11, by: 1.5, a: 0, f: .95 }, roll: { bx: 1, by: 3, a: -1.25, f: .6 },
    meleeWind: { bx: -4, by: 3, a: -1.35, f: .7 }, meleeStrike: { bx: 16, by: 2, a: 2.3, f: .78 }, down: { bx: 3, by: 7, a: -1.0, f: .8 },
  } },
  cloth: [{ anchor: [-5.5, -2.5], segments: 4, length: 3.5 }, { anchor: [-5.5, 1.5], segments: 3, length: 3.0 }],
  clips: {},
  readability: { rim: 1, contact: 1 },
};
function withDefaults(d) {
  const o = { ...DEFAULTS, ...d };
  for (const k of ['limits', 'gait', 'readability']) o[k] = { ...DEFAULTS[k], ...(d[k] || {}) };
  o.weapon = { ...DEFAULTS.weapon, ...(d.weapon || {}), poses: { ...DEFAULTS.weapon.poses, ...((d.weapon || {}).poses || {}) } };
  o.proportions = { ...(d.proportions || {}) };
  o.clipSet = {}; for (const id in CLIPS) o.clipSet[id] = { ...CLIPS[id], ...(o.clips[id] || {}) };
  return o;
}

export function createRig(defIn, opts = {}) {
  const def = withDefaults(defIn);
  let style = opts.style || def.style || painted;
  let skin = opts.skin || def.skin;
  const S = {
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, spd: 0, mvx: 1, mvy: 0, aim: 0,
    hip: 0, torso: 0, head: 0, back: false, turning: false, shuffle: 0,
    phase: 0, amp: 0, stride: 26, sprint: 0, aimB: 0, kneel: 0, slideB: 0, rollB: 0, coverIdleB: 0, peek: 0, blindB: 0, meleeB: 0,
    h: { x: 1, v: 0 }, recoil: 0, recoilAng: 0, leanX: 0, leanY: 0, lastTorso: 0, packSwing: 0, packSwingV: 0, t: 0, freeze: 0,
  };
  const D = { x: 0, y: 0, vx: 0, vy: 0, aimAngle: 0, mode: 'idle', cover: null, aimBlend: 0, peek: 0, blind: 0, exposed: true };
  const active = new Map(); // id → { t (ms), opts, fired:Set }
  let chains = def.cloth.map(c => createChain(c, 0, 0));
  const hist = [];
  let skel = null;

  function reset(x, y, angle = -PI / 2) {
    Object.assign(S, { x, y, px: x, py: y, vx: 0, vy: 0, spd: 0, hip: angle, torso: angle, head: angle, aim: angle, lastTorso: angle,
      kneel: 0, slideB: 0, rollB: 0, coverIdleB: 0, peek: 0, blindB: 0, meleeB: 0, aimB: 0, sprint: 0, amp: 0, recoil: 0, recoilAng: 0, freeze: 0 });
    S.h.x = 1; S.h.v = 0; active.clear(); hist.length = 0;
    Object.assign(D, { x, y, vx: 0, vy: 0, aimAngle: angle, mode: 'idle', cover: null, aimBlend: 0, peek: 0, blind: 0 });
    chains = def.cloth.map(c => createChain(c, x, y)); skel = null;
  }

  function sample(id) { const a = active.get(id); if (!a) return null; const c = def.clipSet[id]; return c.sample(a.t, a.opts); }

  function bodyUpdate(dt, torsoTarget, tk, o = {}) {
    S.torso = dampAng(S.torso, torsoTarget, tk, dt);
    const L = def.limits, moving = S.spd > 18;
    if (o.hip !== undefined) { S.hip = dampAng(S.hip, o.hip, o.hk || 12, dt); S.turning = false; return; }
    if (moving) {
      const mA = Math.atan2(S.mvy, S.mvx); const rel = Math.abs(angDiff(S.torso, mA));
      if (S.back) { if (rel < L.backExit) S.back = false; } else if (rel > L.backEnter) S.back = true;
      let hT = S.back ? mA + PI : mA; const d = angDiff(S.torso, hT); if (Math.abs(d) > L.twistMove) hT = S.torso + Math.sign(d) * L.twistMove;
      S.hip = dampAng(S.hip, hT, o.run ? L.hipKRun : L.hipK, dt); S.turning = false;
    } else {
      const d = angDiff(S.torso, S.hip);
      if (Math.abs(d) > L.pivotThreshold) S.turning = true;
      if (S.turning) { S.hip = dampAng(S.hip, S.torso, 7, dt); S.phase = (S.phase + dt * 2.6) % 1; if (Math.abs(d) < .12) S.turning = false; }
    }
    const d = angDiff(S.torso, S.hip); if (Math.abs(d) > L.twistHard) S.hip = wrap(S.torso + Math.sign(d) * L.twistHard);
  }

  function update(dt) {
    const ev = [];
    if (dt <= 0) return ev;
    // verlet går også under hitstop (follow-through, §5.4)
    const frozen = S.freeze > 0; if (frozen) S.freeze -= dt;
    S.t += dt;
    if (!frozen) for (const [id, a] of active) {
      const c = def.clipSet[id]; const t0 = a.t; a.t += dt * 1000;
      if (c.events) for (const e of c.events) if (!a.fired.has(e.t) && a.t >= e.t && (t0 < e.t || e.t === 0)) { a.fired.add(e.t); if (e.type !== 'end') ev.push({ type: e.type, clip: id }); }
      if (a.t >= c.duration * 1000) { active.delete(id); ev.push({ type: 'clipEnd', clip: id }); }
    }
    S.aim = D.aimAngle;
    const mode = D.mode, cov = D.cover;
    if (!frozen) {
      S.x = D.x; S.y = D.y;
      let aimT = D.aimBlend || 0, sprT = 0, kneelT = 0, slideT = 0, rollT = 0, coverT = 0, hT = 1;
      const L = def.limits; const roll = sample('roll'), mel = sample('melee'), vault = sample('vault'), death = sample('death');
      const fo = cov ? Math.atan2(-cov.ny, -cov.nx) : S.torso;
      const mA = D.moveAngle ?? Math.atan2(S.mvy, S.mvx);
      if (mode === 'death') { /* frys vinkler */ hT = death ? death.height : .6; }
      else if (mode === 'roll') { const ra = D.moveAngle ?? S.hip; bodyUpdate(dt, ra, 22, { hip: ra, hk: 22 }); rollT = 1; hT = roll ? roll.height : .8; }
      else if (mode === 'slide') { bodyUpdate(dt, fo, 14, { hip: fo, hk: 12 }); slideT = 1; hT = .84; }
      else if (mode === 'dash') { bodyUpdate(dt, mA, 12, { run: true }); sprT = .7; hT = .9; }
      else if (mode === 'vault') { bodyUpdate(dt, mA, 14, { hip: mA, hk: 14 }); hT = vault ? vault.height : 1.06; }
      else if (mode === 'cover') {
        const high = cov && cov.type === 'high', pk = S.peek;
        const tt = D.faceAngle ?? (pk > .4 ? fo + clamp(angDiff(fo, S.aim), -1.5, 1.5) : fo + clamp(angDiff(fo, S.aim), -.5, .5) * .35);
        const twist = high && cov.edgeDir ? pk * cov.edgeDir * .3 * (cov.nx !== 0 ? cov.nx : -cov.ny) : 0;
        bodyUpdate(dt, tt, pk > .4 ? L.torsoKPeek : L.torsoKCover, { hip: fo + twist, hk: 9 });
        kneelT = high ? (1 - pk) * .0 : 1 - pk; coverT = 1;
        hT = high ? lerp(.88, .97, pk) : lerp(.86, 1.0, pk);
      } else {
        const run = mode === 'run';
        const tt = D.faceAngle ?? (run && S.spd > 60 ? mA : S.aim);
        bodyUpdate(dt, tt, run ? L.torsoKRun : L.torsoK, { run });
        sprT = run ? 1 : 0; hT = 1 - .03 * S.sprint; if (mode === 'stagger') hT = .94;
      }
      if (mel) { hT = Math.min(hT, 1 - .04 * mel.wind); }
      if (D.height != null) hT = D.height;
      const meleeT = mel ? 1 : 0;
      S.sprint = damp(S.sprint, sprT, 6, dt); S.aimB = damp(S.aimB, mel ? 0 : aimT, 13, dt); S.kneel = damp(S.kneel, kneelT, 10, dt);
      S.slideB = damp(S.slideB, slideT, 16, dt); S.rollB = damp(S.rollB, rollT, 22, dt); S.coverIdleB = damp(S.coverIdleB, coverT, 10, dt);
      S.peek = damp(S.peek, D.peek || 0, 11, dt); S.blindB = damp(S.blindB, D.blind || 0, 12, dt); S.meleeB = damp(S.meleeB, meleeT, 30, dt);
      spring(S.h, hT, 2.4, .42, dt);
      S.recoil = damp(S.recoil, 0, 16, dt); S.recoilAng = damp(S.recoilAng, 0, 10, dt);
      // gange
      const mdx = S.x - S.px, mdy = S.y - S.py, md = Math.hypot(mdx, mdy); S.px = S.x; S.py = S.y;
      const inst = md / dt; S.spd = damp(S.spd, inst, 18, dt); S.vx = D.vx ?? mdx / dt; S.vy = D.vy ?? mdy / dt;
      if (md > .02) { S.mvx = damp(S.mvx, mdx / md, 20, dt); S.mvy = damp(S.mvy, mdy / md, 20, dt); const l = Math.hypot(S.mvx, S.mvy) || 1; S.mvx /= l; S.mvy /= l; }
      const G = def.gait;
      const strideMove = S.back ? G.strideBack : lerp(G.strideWalk, G.strideAim, S.aimB);
      S.stride = mode === 'cover' ? G.strideGlide : lerp(strideMove, G.strideRun, S.sprint);
      const p0 = S.phase;
      const walking = !(mode === 'roll' || mode === 'slide' || mode === 'vault' || mode === 'death');
      if (walking) S.phase = (S.phase + md / (2 * S.stride)) % 1;
      if (mel && mel.phase === 'strike') S.phase = (S.phase + dt * 4.5) % 1; // lite skritt fram i slaget
      S.amp = damp(S.amp, walking ? clamp(S.spd / 45, 0, 1) : 0, 10, dt);
      if (mel) S.amp = Math.max(S.amp, .55 * mel.step);
      S.shuffle = damp(S.shuffle, S.turning ? 1 : 0, 10, dt);
      if (walking) for (const foot of footsteps(p0, S.phase, S.amp)) {
        const s = foot === 'R' ? 1 : -1; const fx = S.x - Math.sin(S.hip) * s * 6, fy = S.y + Math.cos(S.hip) * s * 6;
        ev.push({ type: 'footstep', foot, x: fx, y: fy, kind: S.sprint > .5 ? 'run' : 'walk', speed: S.spd });
      }
      const lean = 3.5 * S.sprint + .8 * S.amp - 4 * S.slideB; // slide: overkroppen ligger ETTER beina
      const lx = S.mvx * lean - Math.cos(S.torso) * S.recoil * 1.2, ly = S.mvy * lean - Math.sin(S.torso) * S.recoil * 1.2;
      S.leanX = damp(S.leanX, lx, 10, dt); S.leanY = damp(S.leanY, ly, 10, dt);
      // sekk: sekundærbevegelse fra torsoens vinkelhastighet (fjær, svinger forbi)
      const dA = angDiff(S.lastTorso, S.torso); S.lastTorso = S.torso; const w = dA / dt;
      S.packSwingV += (clamp(-w * .045, -.5, .5) - S.packSwing) * 160 * dt; S.packSwingV *= Math.exp(-9 * dt); S.packSwing += S.packSwingV * dt;
      hist.push({ x: S.x, y: S.y }); if (hist.length > 6) hist.shift();
    }
    skel = computeSkeleton();
    const drag = (D.mode === 'roll' || D.mode === 'slide' || active.has('melee')) ? 2 : 1;
    const back = { x: -Math.cos(skel.ta), y: -Math.sin(skel.ta) };
    for (const ch of chains) stepChain(ch, dt, skel.L2W, back, { x: S.vx, y: S.vy }, drag);
    return ev;
  }

  function computeSkeleton() {
    const T = S.t; const P = def.weapon.poses;
    const breathe = Math.sin(T * 2.1) * .012 * (1 - S.amp * .7);
    const bob = .02 * S.amp * (.5 - .5 * Math.cos(S.phase * 2 * TAU)) * (1 + S.sprint);
    const s = S.h.x * (1 + breathe + bob) * def.scale;
    const wob = Math.sin(S.phase * TAU) * .16 * S.amp;
    const mel = sample('melee'), hurt = sample('hurt') || sample('stagger'), roll = sample('roll'), imp = sample('impact'), death = sample('death');
    let ta = S.torso - wob * .35 * (1 - S.aimB * .8) + S.recoilAng + Math.sin(T * 1.05) * .02 * (1 - S.amp);
    if (mel) ta += mel.twist; if (hurt) ta += hurt.twist;
    let ox = S.x + S.leanX, oy = S.y + S.leanY;
    if (mel) { ox += Math.cos(S.aim) * mel.lunge; oy += Math.sin(S.aim) * mel.lunge; }
    if (hurt) { ox -= Math.cos(ta) * hurt.push; oy -= Math.sin(ta) * hurt.push; }
    let pose = mixPose(P.ready, P.aim, S.aimB);
    pose = mixPose(pose, P.sprint, S.sprint);
    const cp = mixPose(mixPose(P.cover, P.aim, S.peek), { ...P.blind, a: clamp(angDiff(ta, S.aim), -1.1, 1.1) }, S.blindB);
    pose = mixPose(pose, cp, S.coverIdleB);
    pose = mixPose(pose, P.roll, S.rollB);
    if (hurt && hurt.weaponDown) pose = mixPose(pose, P.down, hurt.weaponDown);
    if (mel) { pose = mixPose(pose, P.meleeWind, mel.wind * S.meleeB); pose = mixPose(pose, P.meleeStrike, mel.strike * S.meleeB); }
    pose.bx -= S.recoil * 3.2; pose.a += Math.sin(T * 1.7) * .02 * (1 - S.aimB);
    const rc = Math.cos(ta), rs = Math.sin(ta);
    const L2W = (lx, ly) => [ox + s * (rc * lx - rs * ly), oy + s * (rs * lx + rc * ly)];
    const ra = ta + pose.a, ca = Math.cos(pose.a), sa = Math.sin(pose.a);
    const R2L = (x, y) => [pose.bx + ca * x * pose.f - sa * y, pose.by + sa * x * pose.f + ca * y];
    const muz = L2W(...R2L(def.weapon.muzzle, 0)), butt = L2W(...R2L(def.weapon.butt, 0));
    return { s, ta, ox, oy, pose, L2W, R2L, ra, muz, butt, wob, roll, mel, hurt, imp, death };
  }

  function frame() {
    const K = skel || (skel = computeSkeleton());
    const roll = K.roll;
    const feet = legPoses(S, def, roll);
    const hc = Math.cos(S.hip), hs = Math.sin(S.hip);
    for (const f of feet) { f.wx = S.x + hc * f.fx - hs * f.fy; f.wy = S.y + hs * f.fx + hc * f.fy; }
    // skjerf: verdens-punkter → torso-rom
    const inv = (x, y) => { const dx = (x - K.ox) / K.s, dy = (y - K.oy) / K.s, c = Math.cos(-K.ta), sn = Math.sin(-K.ta); return [c * dx - sn * dy, sn * dx + c * dy]; };
    const scarf = chains.map(ch => ch.pts.map(p => inv(p.x, p.y)));
    const ghosts = [];
    const rollGhost = roll && roll.ghosts, slideGhost = D.mode === 'slide' && S.spd > 120;
    if ((rollGhost || slideGhost) && hist.length >= 5) {
      const a = rollGhost ? [.2, .1] : [.18, .08];
      ghosts.push({ x: hist[hist.length - 5].x, y: hist[hist.length - 5].y, a: a[1] }, { x: hist[hist.length - 3].x, y: hist[hist.length - 3].y, a: a[0] });
    }
    const headLocal = [1.8 + (roll ? roll.helmetX : 0) + S.kneel * 2, 0]; const hw = K.L2W(...headLocal);
    const F = {
      // ---- stil-uavhengig hode
      x: S.x, y: S.y, skin, mode: D.mode, moveAngle: Math.atan2(S.mvy, S.mvx), moveSpeed: S.spd, aimAngle: S.aim,
      hipAngle: S.hip, torsoAngle: K.ta, headAngle: K.ta, phase: S.phase, amp: S.amp, height: S.h.x,
      posture: { aim: S.aimB, sprint: S.sprint, kneel: S.kneel, slide: S.slideB, roll: S.rollB, cover: S.coverIdleB, peek: S.peek, blind: S.blindB, melee: S.meleeB },
      cover: D.cover, exposed: D.exposed, clip: { roll: K.roll, melee: K.mel, impact: K.imp, hurt: K.hurt, death: K.death, vault: sample('vault') },
      flash: K.hurt ? K.hurt.flash : 0, alpha: 1, ghosts, aim: S.aim,
      contact: def.readability.contact, rim: def.readability.rim, shadowLift: (roll ? roll.shadowLift : 1) * (sample('vault')?.shadowLift || 1),
      // ---- skjelett for 'painted'
      skel: K, feet, scarf, S, def, time: S.t, headX: hw[0], headY: hw[1],
      shadowShape(c, dx, dy, grow) {
        const g = grow; c.save(); c.translate(K.ox + dx, K.oy + dy); c.rotate(K.ta); c.scale(K.s * g, K.s * g);
        c.moveTo(10.5, 0); c.ellipse(-2, 0, 12.5, 15.5, 0, 0, TAU); c.moveTo(-4, -9); c.roundRect(-16.5, -9, 12.5, 18, 3);
        const [m1x, m1y] = K.R2L(-6, 0), [m2x, m2y] = K.R2L(def.weapon.muzzle, 0); const a = Math.atan2(m2y - m1y, m2x - m1x), n = [-Math.sin(a) * 2, Math.cos(a) * 2];
        c.moveTo(m1x + n[0], m1y + n[1]); c.lineTo(m2x + n[0], m2y + n[1]); c.lineTo(m2x - n[0], m2y - n[1]); c.lineTo(m1x - n[0], m1y - n[1]); c.closePath();
        c.restore();
        for (const f of feet) { const fx = f.wx + dx, fy = f.wy + dy; c.moveTo(fx + 6 * g, fy); c.ellipse(fx, fy, 6 * g, 4 * g, S.hip, 0, TAU); }
      },
    };
    return F;
  }

  function socket(name) {
    const K = skel || (skel = computeSkeleton());
    switch (name) {
      case 'muzzle': return { x: K.muz[0], y: K.muz[1], angle: K.ra };
      case 'butt': return { x: K.butt[0], y: K.butt[1], angle: K.ra + PI };
      case 'head': { const p = K.L2W(1.8, 0); return { x: p[0], y: p[1], angle: K.ta }; }
      case 'handR': case 'throwHand': { const p = K.L2W(...K.R2L(5, 1.8)); return { x: p[0], y: p[1], angle: K.ta }; }
      case 'handL': { const p = K.L2W(...K.R2L(21.5, -.9)); return { x: p[0], y: p[1], angle: K.ta }; }
      case 'back': { const p = K.L2W(-11, 0); return { x: p[0], y: p[1], angle: K.ta + PI }; }
      default: return { x: S.x, y: S.y, angle: K.ta };
    }
  }

  const rig = {
    def, S,
    get style() { return style; },
    get pose() { return { hipAngle: S.hip, torsoAngle: skel ? skel.ta : S.torso, headAngle: skel ? skel.ta : S.torso, phase: S.phase }; },
    drive(d) { Object.assign(D, d); if (!('moveAngle' in d)) D.moveAngle = undefined; if (!('faceAngle' in d)) D.faceAngle = undefined; if (!('height' in d)) D.height = undefined; return rig; },
    play(id, o = {}) { if (!def.clipSet[id]) return rig; active.set(id, { t: 0, opts: o, fired: new Set() });
      if (id === 'fire') { S.recoil = 1; S.recoilAng += (Math.random() - .5) * .06 - (o.blind ? 0 : .02); }
      if (id === 'exitCover') S.h.v += .8;
      return rig; },
    stop(id) { active.delete(id); return rig; },
    playing(id) { return active.has(id); },
    clipTime(id) { const a = active.get(id); return a ? a.t : -1; },
    impulse(v) { S.h.v += v; return rig; },
    freeze(sec) { S.freeze = Math.max(S.freeze, sec); return rig; },
    update, socket, frame, reset,
    setStyle(st) { style = st; return rig; }, setSkin(id) { skin = id; return rig; }, get skin() { return skin; },
    draw(ctx, camera, o = {}) { const F = frame(); if (o.alpha != null) F.alpha = o.alpha; if (o.flash) F.flash = Math.max(F.flash, o.flash); if (o.under) F.under = o.under; style.drawFigure(ctx, rig, F, o); return F; },
    sortKey() { return style.sortKey ? style.sortKey(frame()) : S.y + 13; },
  };
  reset(opts.x || 0, opts.y || 0, opts.angle ?? -PI / 2);
  return rig;
}
