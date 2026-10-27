// Breach Karakter – Warden (spillerens modul). Kontrakt: init / update / draw / drawHud / respawn.
// Logikk (state.js) gir tilstand, retninger, positur og bakkepunkt; utseendet er riggen i shared/rig (byttbar stil).
// Våpen: bare weapons.createLoadout (init), handleInput, drawReticle og drawHud. Loopen kaller weapons.update/draw selv.
import * as weaponsMod from '../weapons/index.js';
import { createRig, WARDEN } from '../shared/rig/index.js';
import { oblique } from '../shared/rig/styles/oblique.js';
import { faceted } from '../shared/rig/styles/faceted.js';
import { paintedC } from '../shared/rig/styles/paintedC.js';   // 2026-10-27: variant C i spillet (?faceted = forrige stil)
import { warmFaceted } from './warm.js';
import { PROJ } from '../shared/projection.js';
import { TUNING as T } from './tuning.js';
import { createController, readIntent } from './controller.js';
import { stepState, setState, driveRig, startMelee, startStagger, startDeath, leaveCover } from './state.js';
import { drawHpBar, drawVignette } from './hud.js';
import * as fx from './fx.js';

// Trekvart-stil for Warden – ÉN linje å bytte når den endelige figuren (A/B) er valgt. ?oblique = gammel reserve.
const STYLE_34 = (typeof location !== 'undefined' && new URLSearchParams(location.search).has('oblique')) ? oblique : (typeof location !== 'undefined' && new URLSearchParams(location.search).has('faceted')) ? faceted : paintedC;
let P = null;              // intern tilstand (én spiller)
const offs = [];
const W = (world) => world.modules?.weapons || weaponsMod;

export function init(world) {
  for (const off of offs.splice(0)) off();
  if (P?.offWeapon) { P.offWeapon(); P.offWeapon = null; }
  const maxHp = world.playerStats?.maxHp ?? T.maxHp;
  const p = world.player = {
    x: world.bounds.x + world.bounds.w / 2, y: world.bounds.y + world.bounds.h / 2, vx: 0, vy: 0,
    r: T.r.stand, collisionR: T.collisionRadius, hp: maxHp, maxHp, team: 'player', dead: false, aim: 0, armor: 0, invuln: false,
    state: 'move', posture: 'move', muzzle: null, kind: 'warden',
  };
  const rig = createRig(WARDEN, { skin: 'warden', x: p.x, y: p.y, angle: 0 });
  rig.weaponLook = 'rifle';
  P = { world, p, rig, ctl: createController(), st: { name: 'move', t: 0 }, cov: { line: null }, aim: 0, rollCd: 0, freeze: 0,
    baseStyle: rig.style, sprinting: false, intent: null, lastHp: p.hp, lastHitT: -99, regenT: 0, healthT: 0, health: 'full', hpShown: 1, flash: 0 };
  // skade: core damage() kaller damageMult(amount, info) før armor. Dekning (inCover) × coverDamageMult, blindfire × blindArmor.
  p.damageMult = (amt, info) => {
    let k = 1;
    if (info?.inCover || p.inCover) k *= world.playerStats?.coverDamageMult ?? 1;
    if (p.blindfire) k *= 1 - T.blindArmor;
    return amt * k;
  };
  W(world).createLoadout(p, undefined, {}, world);
  applyStats(world);
  world.camera?.follow(p);
  const ev = world.events;
  attachWeapon(world);
  offs.push(
    ev.on('upgrade', () => applyStats(world)),
    ev.on('hit', ({ target, amount, source, blocked }) => {
      if (!P || target !== P.p || blocked || !(amount > 0)) return;   // i-frames (rull) / 0 skade: ingen blink, regen nullstilles ikke
      P.lastHitT = world.time; P.flash = T.hitFlash;
      if (P.p.dead) return;
      const big = amount >= T.staggerDmg && !(P.st.name === 'cover' && P.cov.sub === 'hidden');
      if (big && source && Number.isFinite(source.x)) startStagger(P, source.x, source.y);
      else P.rig.play('hurt', { angle: source && Number.isFinite(source.x) ? Math.atan2(P.p.y - source.y, P.p.x - source.x) : 0 });
    }),
    ev.on('death', ({ target }) => { if (P && target === P.p && P.st.name !== 'death') startDeath(P); }),
    ev.on('explosion', ({ x, y, radius }) => {
      if (!P || P.p.dead || P.p.invuln) return; const d = Math.hypot(P.p.x - x, P.p.y - y);
      if (d <= T.explosionStaggerR + P.p.r) startStagger(P, x, y, 1.2);
    }),
    ev.on('grenade', ({ entity, phase }) => { if (P && entity === P.p && phase === 'throw') P.throwT = world.time; }),
    ev.on('weaponFire', ({ entity, angle }) => { if (P && entity === P.p) P.rig.play('fire', { angle }); }),
    ev.on('melee', ({ entity, phase, angle, targets }) => {
      if (!P || entity !== P.p) return;
      if (phase === 'start' && P.st.name !== 'melee') startMelee(P, angle);
      else if (phase === 'hit' && P.st.name === 'melee') { if (targets?.length) P.st.hitPending = true; }
    }),
    ev.on('arenaLoaded', () => { if (P) { leaveCover(P, false); setState(P, 'move'); } }),
  );
  if (STYLE_34 !== paintedC) warmFaceted(world, rig, { reason: 'start' });   // C trenger ikke faceted-sprites
}

/** Les world.playerStats på nytt (kalles ved init og hver 'upgrade'). */
function applyStats(world) {
  const p = P?.p, st = world.playerStats; if (!p || !st) return;
  if (Number.isFinite(st.maxHp) && st.maxHp !== p.maxHp) { const d = st.maxHp - p.maxHp; p.maxHp = st.maxHp; if (d > 0) p.hp += d; p.hp = Math.min(p.hp, p.maxHp); }
  if (Number.isFinite(st.grenades)) W(world).setGrenadeMax?.(p, st.grenades);
  // coverDamageMult og rollDistMult leses direkte fra world.playerStats der de brukes (state.js). pierce/magSize/reloadTime/coverSpreadMult: weapons.
}

/** Plasser Warden (nytt nivå / etter død): full helse, ut av dekning, nullstilt animasjon. */
export function respawn(world, x, y) {
  if (!P || P.world !== world) init(world);
  const p = P.p; leaveCover(P, false);
  p.x = x; p.y = y; p.vx = p.vy = 0; p.dead = false; p.invuln = false; p.armor = 0; p.inCover = false; p.blindfire = false; delete p.coverHitChance;
  p.maxHp = world.playerStats?.maxHp ?? p.maxHp; p.hp = p.maxHp;
  P.st = { name: 'move', t: 0 }; P.freeze = 0; P.rollCd = 0; P.lastHp = p.hp; P.lastHitT = -99; P.health = 'full'; P.hpShown = 1;
  P.rig.reset(x, y, P.aim); world.camera?.follow(p);
  attachWeapon(world); if (STYLE_34 !== paintedC) warmFaceted(world, P.rig, { reason: 'respawn' });
  world.events.emit('playerHealth', { hp: p.hp, maxHp: p.maxHp, health: 'full', delta: 0 });
  world.events.emit('playerState', { from: null, to: 'move', state: 'move', entity: p, x, y });
}

const NO_FIRE = new Set(['roll', 'slide', 'vault', 'stagger', 'death', 'melee', 'exitCover']);
const NO_MELEE = new Set(['roll', 'slide', 'vault', 'stagger', 'death', 'melee']);

export function update(dt, world) {
  if (!P || world.player !== P.p) return;
  const p = P.p, I = P.intent = readIntent(P.ctl, world, dt);
  { const a = Math.atan2(I.aimY - p.y, I.aimX - p.x); if (Number.isFinite(a)) P.aim = a; else { P.aim = Number.isFinite(P.aim) ? P.aim : 0; if (!Number.isFinite(I.aimX) || !Number.isFinite(I.aimY)) { I.aimX = p.x + Math.cos(P.aim) * 100; I.aimY = p.y + Math.sin(P.aim) * 100; } } }   // 27.10: NaN-mus (f.eks. før første museflytt) skal ikke forgifte riggen
  if (p.dead && P.st.name !== 'death') startDeath(P);
  stepState(P, I, dt);
  p.state = P.st.name; p.aim = P.aim;
  // våpen: spilleren gir bare positur/tilstand
  const wpn = W(world), inCover = P.st.name === 'cover', C = P.cov;
  const blind = inCover && C.sub === 'blind', aiming = inCover ? (C.sub === 'popUp' || C.sub === 'lean') : !!I.aim;
  const canFire = !p.dead && !NO_FIRE.has(P.st.name) && !P.sprinting && !(inCover && C.sub === 'hidden' && I.aim);
  if (!p.dead) {
    const inp = world.input, masked = { mouse: inp.mouse, down: (c) => c !== 'KeyF' && inp.down(c), pressed: (c) => c !== 'KeyF' && inp.pressed(c) };
    // Trekvart: skuddretning fra munningen mot siktepunktet (konvergens), så kula går gjennom punktet under trådkorset selv om
    // munningen sitter til siden for fotpunktet. Nært (siktepunkt innenfor munningsavstand + 12 px) og ovenfra: P.aim (uendret).
    let fireAim = P.aim;
    if (world.view === '34' && p.muzzle) { const mx = p.muzzle.x, my = p.muzzle.y, dm = Math.hypot(mx - p.x, my - p.y), da = Math.hypot(I.aimX - p.x, I.aimY - p.y);
      if (da > dm + 12) fireAim = Math.atan2(I.aimY - my, I.aimX - mx); }
    wpn.handleInput(world, p, masked, { aiming, inCover, blind, canFire, aimAngle: fireAim });
    // F: kolbeslag via weapons (treff/skade eies der); bufret så det ikke tapes under rull/slide
    if (I.f && !NO_MELEE.has(P.st.name) && wpn.tryMelee) { if (wpn.tryMelee(world, p, P.aim)) P.ctl.buf.f = 0; }
  }
  // rigg
  driveRig(P);
  const evs = P.rig.update(dt);
  for (const e of evs) {
    if (e.type === 'footstep') world.events.emit('footstep', { entity: p, x: e.x, y: e.y, foot: e.foot, kind: e.kind, speed: e.speed, surface: 'metal' });
    else if (e.type === 'land' && e.clip === 'roll') { fx.dust(world, p.x, p.y, 7, 80, 5, 0.5, P.aim + Math.PI, 2.4); world.events.emit('roll', { entity: p, x: p.x, y: p.y, phase: 'land' }); }
  }
  // Munning med høyde: x/y = logisk munning (uendret, kuler starter her); z = høyden til det tegnede løpet (verdens-px).
  // muzzleDraw = nøyaktig tegnet løpstupp i trekvart (for glimt): PROJ.toScreen(md.x, md.y, md.z). Ovenfra = muzzle med z.
  // Trekvart (faceted): munningen er tuppen av det tegnede våpenet, utledet fra våpen-defen (faceted.muzzleOf) – {x, y, z}.
  // Ovenfra: riggens logiske munning + z. muzzleDraw = punktet glimt tegnes i (PROJ.toScreen(x, y, z)).
  p.weaponId = weaponIdOf(p); P.rig.weaponLook = p.weaponId; P.rig.__wpnId = p.weaponId;
  // Trekvart: munning ALLTID fra våpen-defen (faceted.muzzleOf: rifle ≈ 26,7 / shotgun 25,0 / marksman 39,9 px fram), ikke rig.socket (37,6 for alle).
  // Ovenfra (painted-stilen tegner riggens våpen) beholdes rig.socket – top-view er uendret.
  if (world.view === '34' && (STYLE_34 === faceted || STYLE_34 === paintedC)) { const m = STYLE_34.muzzleOf(P.rig, p.weaponId); p.muzzle = { x: m.x, y: m.y, z: m.z }; p.muzzleDraw = p.muzzle; }
  else { const mz = P.rig.socket('muzzle'); p.muzzle = { x: mz.x, y: mz.y, z: mz.z };
    p.muzzleDraw = world.view === '34' ? oblique.muzzleDraw(P.rig.frame()) : p.muzzle; }
  p.muzzleZ = p.muzzle.z;
  p.aimPoint = { x: I.aimX, y: I.aimY, z: world.view === '34' ? PROJ.aimHeight : 0 };   // det spilleren sikter mot (bakkepunkt + høyde)
  health(dt, world);
}

function health(dt, world) {
  const p = P.p, prev = P.lastHp;
  if (!p.dead && p.hp < prev - 1e-6) P.lastHitT = world.time;   // all skade (også splash/DoT uten 'hit') nullstiller regen-forsinkelsen
  if (!p.dead && p.hp < p.maxHp && world.time - P.lastHitT >= T.regenDelay) {
    P.regenT += dt; const rate = T.regenPerSec * Math.min(1, P.regenT / T.regenRamp);
    p.hp = Math.min(p.maxHp, p.hp + rate * dt);
  } else P.regenT = 0;
  const regen = P.regenT > 0 && p.hp < p.maxHp;
  const health = p.dead ? 'dead' : p.hp >= p.maxHp ? 'full' : regen ? 'regen' : 'wounded';
  P.healthT -= dt;
  const changed = Math.abs(p.hp - prev) > 1e-6;
  if ((changed && !regen) || health !== P.health || (regen && P.healthT <= 0)) {
    world.events.emit('playerHealth', { hp: p.hp, maxHp: p.maxHp, health, delta: p.hp - (P.reportedHp ?? prev) });
    P.reportedHp = p.hp; P.healthT = T.healthEventInterval;
  }
  P.health = health; P.lastHp = p.hp;
  const frac = p.hp / p.maxHp; P.hpShown = P.hpShown > frac ? Math.max(frac, P.hpShown - dt * 0.6) : frac;
  P.flash = Math.max(0, P.flash - dt);
}

// ---------------------------------------------------------------- tegning (verdenskoordinater)
export function draw(ctx, world, camera) {
  if (!P || world.player !== P.p) return;
  syncStyle(world);
  const p = P.p;
  if (P.st.name === 'slide') { const sp = Math.hypot(p.vx, p.vy); if (sp > 200) drawSpeedLines(ctx, p, sp, world); }
  // world.depthSorted (satt av loop.js): drawSorted har allerede tegnet Warden via drawActor – her bare tillegg som ikke sorteres
  if (!world.depthSorted) drawWarden(ctx, camera);
}

/** Tegner ÉN aktør (Warden) i verdenskoordinater, ankret i fotpunktet (x, y). Kalles av shared/depth.js drawSorted. */
export function drawActor(ctx, actor, world, camera) {
  if (!P || actor !== P.p) return;
  syncStyle(world);
  drawWarden(ctx, camera);
}

function drawWarden(ctx, camera) {
  const C = P.cov, under = P.st.name === 'cover' && C.line ? (c) => drawCoverCue(c, C.line, C.along + C.lean * T.leanOffset, C.sub !== 'hidden') : null;
  const w = P.world, p = P.p, gt = p.loadout?.grenadeThrow, after = w.time - (P.throwT ?? -9);
  const throwing = !p.dead && (gt || after < 0.22);
  P.rig.draw(ctx, camera, { flash: P.flash > 0 ? 0.8 : 0, under, pose: throwing && P.rig.style === faceted ? faceted.THROW_POSE : undefined });   // cover-AO og cyan kant under figuren, over skygge/halo
  if (gt && P.rig.style === faceted) drawHeldGrenade(ctx, w);
  const fD = P.rig.__fac?.D; if (P.rig.style === faceted && fD && P.warmD !== fD) { if (P.warmD) warmFaceted(w, P.rig, { reason: 'zoom' }); P.warmD = fD; }   // v4.3: ny oppløsning → forvarm den
  if (w.view !== '34' && P.st.name === 'roll') drawRollVisor(ctx, p, P.st);
}

/** Granat i kastehånda under oppladningen (trekvart): mørk oliven kule med cyan tennerlys. */
function drawHeldGrenade(ctx, w) {
  const h = P.rig.socket('throwHand'); const k = Math.min(1, (P.p.loadout.grenadeThrow.t || 0) / (P.p.loadout.grenadeThrow.windup || .3));
  const z = 18 + 10 * k, a = P.rig.frame().skel.ta, x = h.x - Math.cos(a) * 6 * k, y = h.y - Math.sin(a) * 6 * k - z * PROJ.zScale;
  ctx.save(); ctx.fillStyle = '#3f4a3a'; ctx.strokeStyle = 'rgba(8,10,12,.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7ee0ff'; ctx.fillRect(x - .6, y - 1.6, 1.2, 1.2); ctx.restore();
}

/** Ovenfra (painted): rullingen var en grå klatt – cyan visir-bue i fartsretningen + tynn ring, synlig hele rullet. */
function drawRollVisor(ctx, p, st) {
  const a = st.a ?? Math.atan2(p.vy, p.vx), k = Math.min(1, st.t / 0.08) * (st.t > 0.42 ? Math.max(0, 1 - (st.t - 0.42) / 0.08) : 1);
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(57,198,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(57,198,255,.95)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(p.x, p.y, 8.5, a - .7, a + .7); ctx.stroke();
  ctx.strokeStyle = 'rgba(210,248,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 8.5, a - .3, a + .3); ctx.stroke();
  ctx.restore();
}

// Trekvart (world.view === '34') tegnes med STYLE_34 (faceted; ?oblique = reserve); ovenfra beholdes riggens vanlige stil.
function syncStyle(world) {
  const want = world.view === '34' ? STYLE_34 : P.baseStyle;
  if (want && P.rig.style !== want) { P.rig.setStyle(want); if (want === faceted) warmFaceted(world, P.rig, { reason: 'style' }); }
}

// Dekningsmarkør (runde 2): tynn, diskret strek langs dekningskanten, uten fyll/AO og uten gradienter per bilde.
// Tegnes UNDER figuren (rig.draw opts.under → etter skygge, før kroppen). ±13 px, 1 px, 30 % / 55 % eksponert.
function drawCoverCue(ctx, L, along, exposed) {
  const a0 = along - 13, a1 = along + 13, f = L.f, o = 0.6;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(57,198,255,${exposed ? 0.55 : 0.3})`; ctx.beginPath();
  if (L.nx !== 0) { ctx.moveTo(f + L.nx * o, a0); ctx.lineTo(f + L.nx * o, a1); } else { ctx.moveTo(a0, f + L.ny * o); ctx.lineTo(a1, f + L.ny * o); }
  ctx.stroke(); ctx.restore();
}
function drawSpeedLines(ctx, p, sp, world) {
  const a = Math.atan2(p.vy, p.vx), c = Math.cos(a), s = Math.sin(a), k = Math.min(1, (sp - 200) / 200);
  ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.2 * k})`; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = -1; i <= 1; i++) { const off = i * 7, back = 16 + Math.abs(i) * 5 + ((world.time * 60 + i * 3) % 4); const x0 = p.x - c * back - s * off, y0 = p.y - s * back + c * off; ctx.moveTo(x0, y0); ctx.lineTo(x0 - c * 10, y0 - s * 10); }
  ctx.stroke(); ctx.restore();
}

// ---------------------------------------------------------------- HUD (skjermkoordinater)
export function drawHud(ctx, world, camera) {
  if (!P || world.player !== P.p) return;
  const p = P.p, wpn = W(world);
  drawVignette(ctx, world, p);
  if (camera && world.input?.mouse && !p.dead) { ctx.save(); camera.apply(ctx); drawAimReticle(ctx, world, p, wpn); ctx.restore(); }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHpBar(ctx, world, p, P);
  wpn.drawHud?.(ctx, world, p, {});
  ctx.restore();
}

/** Test/feilsøking: intern tilstand og rigg. */
export function _debug() { return P; }

// Trådkors: weapons tegner det ved et verdenspunkt og regner spredning fra avstanden til det punktet. I trekvart gir vi det
// bakkepunktet vi faktisk sikter mot (brysthøyde-tolkning), men forskyver tegningen −aimHeight·zScale så korset står under
// musepekeren. En svak loddlinje + prikk viser bakkepunktet (der kula går). Ovenfra: uendret (rå mus).
function drawAimReticle(ctx, world, p, wpn) {
  const m = world.input.mouse;
  if (world.view !== '34') { wpn.drawReticle?.(ctx, world, p, m.worldX, m.worldY); return; }
  const g = PROJ.aimGround(m.worldX, m.worldY), dy = g.y - m.worldY;
  ctx.save(); ctx.strokeStyle = 'rgba(57,198,255,.28)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.moveTo(g.x, m.worldY + 4); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(57,198,255,.45)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, 2.2, 1.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(0, -dy); wpn.drawReticle?.(ctx, world, p, g.x, g.y); ctx.restore();
}

/** Våpen-id for utseendet (weapons: L.slots[L.index].def.id). */
function weaponIdOf(p) { const L = p.loadout; return L?.slots?.[L.index]?.def?.id || 'rifle'; }
/** faceted: bevegelige våpendeler følger 'chamber'/'reload' – én abonnent per rigg, avmeldes ved respawn/ny init. */
function attachWeapon(world) {
  if (P.offWeapon) { P.offWeapon(); P.offWeapon = null; }
  P.offWeapon = faceted.attachWeaponEvents(world, P.rig, P.p);
}
