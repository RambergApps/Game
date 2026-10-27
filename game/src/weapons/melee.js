// Nærkamp (kolbeslag, tast F). Virker med alle våpen og uten ammo, for spiller og fiender (Fiende-AI: Flanker).
// Valg (dokumentert i docs/VAPEN.md):
//  - Vinkelen låses ved start (forutsigbart, matcher Karakters animasjon). Treffet avgjøres ved contactAt (slutten av oppladningen).
//  - Rekkevidde måles fra angriperens senter til målets kant (avstand − target.r ≤ range).
//  - Høy dekning blokkerer (core lineOfSight fra angriper til mål). Lav dekning blokkerer IKKE (lineOfSight ser bare high).
//  - Kan treffe flere mål i buen, bare motsatt lag. Avbryter pågående lading (magasinet fylles ikke). Kan ikke skyte under slaget.
// Hendelse 'melee' {entity, x, y, angle, phase:'start'|'hit'|'end', targets, team, dmg?, stagger?, interrupted?}; 'hit' sendes
// ALLTID ved contactAt (targets = [] ved bom), så Lyd kan velge sus eller treff.
// Rev. 4: skade/stagger per slag (opts → profil.melee → TUNING.melee.enemy for fiender → TUNING.melee), lagret ved start.
// Stagger-regel (alle entities, også spilleren): mens world.time < e.staggerUntil kan man ikke starte et slag, og et slag i
// oppladning (før contactAt) avbrytes uten treff → 'melee' phase 'end' {interrupted:true}. Etter kontakt fullføres det.
import { damage, lineOfSight, addEffect, segmentRect } from '../core/index.js';
import { TUNING } from './data.js';
import * as camfx from './camfx.js';
import { sy as projY, hidden as hiddenAt, bodyHitZ } from './view34.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/** Kan entity starte et slag nå? */
const staggered = (world, e) => Number.isFinite(e.staggerUntil) && world.time < e.staggerUntil;
export function canMelee(world, e) { const L = e?.loadout; return !!L && !e.dead && !L.melee && !L.grenadeThrow && (L.meleeCd || 0) <= 0 && !staggered(world, e); }

/** Skade og stagger for et slag fra e: opts → profilens melee (ENEMY_WEAPONS[id].melee) → TUNING.melee.enemy (fiender) → TUNING.melee. */
export function meleeStats(e, opts = {}) {
  const T = TUNING.melee, L = e.loadout, prof = L?.enemy ? L.slots[L.index]?.def?.melee : null;
  const base = e.team && e.team !== 'player' ? { dmg: T.enemy.dmg, stagger: T.enemy.stagger } : { dmg: T.dmg, stagger: T.stagger };
  return { dmg: opts.dmg ?? prof?.dmg ?? base.dmg, stagger: opts.stagger ?? prof?.stagger ?? base.stagger };
}

/** Start et kolbeslag. Krever e.loadout (weapons.tryMelee sørger for det). → true hvis slaget startet. */
export function startMelee(world, e, angle, opts = {}) {
  const T = TUNING.melee, L = e.loadout;
  if (!canMelee(world, e)) return false;
  const a = Number.isFinite(angle) ? angle : e.aim ?? 0;
  if (L.reload) {   // avbryt lading: tilbake til før lading (magasinet er ikke fylt, ingen bonus/jam)
    const id = L.slots[L.index].def.id; L.reload = null; L.lastResult = null; L.lastResultT = 0;
    world.events.emit('reload', { weapon: id, phase: 'end', result: 'cancel', entity: e, x: e.x, y: e.y, team: e.team });
  }
  L.grenadeAim = null; L.queued = null; L.aimT = 0;
  const st = meleeStats(e, opts);
  L.melee = { t: 0, angle: a, phase: 'windup', targets: [], dmg: st.dmg, stagger: st.stagger };
  L.meleeCd = T.cooldown;
  world.events.emit('melee', { entity: e, x: e.x, y: e.y, angle: a, phase: 'start', targets: [], team: e.team, dmg: st.dmg, stagger: st.stagger });
  return true;
}

function candidates(world, e) {
  const out = [], push = (t) => { if (t && t !== e && !t.dead && t.team && t.team !== e.team && !out.includes(t)) out.push(t); };
  for (const t of world.enemies || []) push(t);
  push(world.player);
  return out;
}

function resolveHit(world, e, M) {
  const T = TUNING.melee, half = (T.arcDeg * Math.PI / 180) / 2, hits = [];
  for (const t of candidates(world, e)) {
    const dx = t.x - e.x, dy = t.y - e.y, dist = Math.hypot(dx, dy);
    if (dist - (t.r || 14) > T.range) continue;
    // innenfor buen (målets kant teller: liten vinkeltoleranse for store mål på nært hold)
    const tol = dist > 1 ? Math.asin(Math.min(1, (t.r || 14) / dist)) : Math.PI;
    if (Math.abs(angDiff(Math.atan2(dy, dx), M.angle)) > half + tol) continue;
    if (!lineOfSight(world, e.x, e.y, t.x, t.y)) continue;   // høy dekning blokkerer; lav gjør ikke
    hits.push(t);
  }
  M.hitInfo = [];
  for (const t of hits) {
    const src = { weapon: 'melee', kind: 'melee', entity: e, owner: e, team: e.team, x: e.x, y: e.y, angle: M.angle };
    const dealt = damage(t, M.dmg, src, world) || 0;
    if (M.stagger > 0) t.staggerUntil = Math.max(t.staggerUntil || 0, world.time + M.stagger);   // forlenger aldri kortere
    // Tilbakeslag (rev. 5): 18 px fordelt over knockbackTime med ease-out, stoppes av høy dekning steg for steg.
    const a = Math.atan2(t.y - e.y, t.x - e.x);
    knockback(world, t, a, T.knockback, T.knockbackTime ?? 0);
    t.meleeFlashUntil = world.time + (T.flash ?? 0.1);   // Fiende-design/Karakter kan lese: blink mens world.time < meleeFlashUntil
    const killed = !!t.dead || (t.hp ?? 1) <= 0;
    const impact = killed ? 1 : Math.min(1, Math.max(0.25, dealt / (TUNING.melee.dmg || 50)));
    const hx = t.x - Math.cos(a) * (t.r || 14), hy = t.y - Math.sin(a) * (t.r || 14);
    // Rev. 6: z = treffpunktets høyde (overkropp), surface for VFX (kitin for monstrene, flesh ellers).
    const hz = bodyHitZ(t, (t.height ?? 48) * 0.55), surface = t.material || (t.team === 'enemy' ? 'chitin' : 'flesh');
    M.hitInfo.push({ target: t, targetId: t.id ?? null, x: hx, y: hy, z: hz, angle: a, impact, power: impact, killed, dmg: dealt, surface });
    if (TUNING.fx?.meleeImpact !== false) meleeImpactFx(world, hx, hy, a, e.team, impact, t, hz);
  }
  const cam = world.camera;
  // Rist: Karakter eier risten når spilleren slår (player/state.js). Vi rister bare når en fiende treffer den kameraet følger.
  if (e.team !== 'player' && cam && cam.target && hits.includes(cam.target)) camfx.shake(world, T.shake[0], T.shake[1]);
  if (hits.length) camfx.hitstop(world, M.hitInfo.some((h) => h.killed) ? (T.killHitstop ?? T.hitstop) : T.hitstop);   // fryser simuleringen – timere står likt
  return hits;
}

/** Kalles fra weapons.update for hver loadout (også spillerens). */
export function updateMelee(dt, world, e, L) {
  if (L.meleeCd > 0) L.meleeCd = Math.max(0, L.meleeCd - dt);
  const M = L.melee; if (!M) return;
  const T = TUNING.melee;
  if (e.dead) { L.melee = null; return; }
  if (M.phase === 'windup' && staggered(world, e)) {   // stagger avbryter oppladningen: ingen treff
    L.melee = null;
    world.events.emit('melee', { entity: e, x: e.x, y: e.y, angle: M.angle, phase: 'end', targets: [], team: e.team, interrupted: true });
    return;
  }
  M.t += dt;
  if (M.phase === 'windup' && M.t >= T.contactAt) {
    M.targets = resolveHit(world, e, M); M.phase = 'recover';
    swingFx(world, e, M.angle, M.targets.length > 0);
    // Rev. 5/6: hit-payload for VFX/Lyd. impact/power 0..1 (1 = drap), killed = minst ett drap,
    // hits = per mål {target, targetId, x, y, z, angle, impact, power, killed, dmg, surface}. weapon = 'stock' (kolbeslag, VFX-avtale);
    // heldWeapon = våpenet i hånda (rifle/shotgun/marksman) for Lyd. z = treffhøyde for første mål (0 uten treff).
    const H = M.hitInfo || [], imp = H.reduce((m, h) => Math.max(m, h.impact), 0);
    world.events.emit('melee', { entity: e, x: e.x, y: e.y, z: H[0]?.z ?? 0, angle: M.angle, phase: 'hit', targets: M.targets, team: e.team,
      hit: H.length > 0, impact: imp, power: imp, killed: H.some((h) => h.killed), hits: H,
      hx: H[0]?.x ?? null, hy: H[0]?.y ?? null, weapon: 'stock', heldWeapon: L.slots?.[L.index]?.id ?? null });
  } else if (M.phase === 'recover' && M.t >= T.contactAt + T.recover) {
    L.melee = null;
    world.events.emit('melee', { entity: e, x: e.x, y: e.y, angle: M.angle, phase: 'end', targets: M.targets, team: e.team });
  }
}

/** Status for HUD/Karakter: { phase, t, progress, cooldown, cooldownFrac, angle } | null */
export function meleeState(e) {
  const L = e?.loadout; if (!L) return null; const T = TUNING.melee, M = L.melee;
  return { phase: M ? M.phase : null, t: M ? M.t : 0, progress: M ? Math.min(1, M.t / (T.contactAt + T.recover)) : 0, cooldown: L.meleeCd || 0, cooldownFrac: (L.meleeCd || 0) / T.cooldown, angle: M ? M.angle : null };
}

/** Glidende dytt (effekt med update – kjører i simuleringen, står stille under hitstop/pause). */
function knockback(world, t, a, dist, time) {
  const step = (d) => { for (const k of [1, 0.5]) { const nx = t.x + Math.cos(a) * d * k, ny = t.y + Math.sin(a) * d * k; if (lineOfSight(world, t.x, t.y, nx, ny)) { t.x = nx; t.y = ny; return true; } } return false; };
  if (!(time > 0)) { step(dist); return; }
  let done = 0;
  addEffect(world, { x: t.x, y: t.y, life: time, update(dt, w, f) {
    const k = Math.min(1, f.t / time), want = dist * (1 - (1 - k) * (1 - k));   // ease-out
    if (want > done && !step(want - done)) f.t = time; done = want;
  }, draw() {} });
}

// ---------- effekter ----------
function swingFx(world, e, angle, hit) {
  const T = TUNING.melee, half = (T.arcDeg * Math.PI / 180) / 2, rr = (e.r || 14) + T.range * 0.85;
  const col = e.team === 'enemy' ? '255,190,120' : '200,240,255';
  addEffect(world, { x: e.x, y: e.y, life: 0.16, layer: 'over', draw(ctx, w, c, f) {
    const k = f.t / f.life, a0 = angle - half, a1 = angle - half + (2 * half) * Math.min(1, 0.35 + k * 1.6);
    ctx.save(); ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
    // rev. 5: kraftigere bue – fylt kile bak strøket og tykkere strøk ved treff
    ctx.fillStyle = `rgba(${col},${(hit ? 0.16 : 0.08) * (1 - k)})`;
    ctx.beginPath(); ctx.arc(e.x, e.y, rr + 3, a0, a1); ctx.arc(e.x, e.y, rr * 0.55, a1, a0, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${(hit ? 0.85 : 0.45) * (1 - k)})`; ctx.lineWidth = (hit ? 11 : 8) * (1 - k) + 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, rr, a0, a1); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(e.x, e.y, rr + 2, Math.max(a0, a1 - 0.6), a1); ctx.stroke();
    ctx.restore();
  } });
}
function meleeImpactFx(world, x, y, a, team, impact = 0.6, target = null, z = 0) {
  const R = world.rng, sparks = [];
  // treffblink: hvit skive over målet (kort), følger målet mens det glir
  if (target) addEffect(world, { x, y, life: TUNING.melee.flash ?? 0.1, layer: 'over', draw(ctx, w, c, f) {
    const k = f.t / f.life, r = (target.r || 14) * (1.05 + 0.25 * k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
    if (hiddenAt(w, target.x, target.y, z)) { ctx.restore(); return; }
    ctx.beginPath(); ctx.arc(target.x, projY(w, target.y, z), r, 0, TAU); ctx.fill(); ctx.restore();
  } });
  for (let i = 0; i < 9 + Math.round(6 * impact); i++) { const sa = a + (R() - 0.5) * 1.6, sp = 90 + R() * 160; sparks.push({ vx: Math.cos(sa) * sp, vy: Math.sin(sa) * sp }); }
  const col = team === 'enemy' ? '#ffd08a' : '#bff3ff';
  addEffect(world, { x, y, life: 0.22, layer: 'over', draw(ctx, w, c, f) {
    if (hiddenAt(w, x, y, z)) return;
    const k = f.t / f.life; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(0, projY(w, 0, z));
    ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.arc(x, y, 9 * (1 - k) + 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 1 - k;
    for (const s of sparks) { const px = x + s.vx * f.t, py = y + s.vy * f.t; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - s.vx * 0.03, py - s.vy * 0.03); ctx.stroke(); }
    ctx.restore();
  } });
}
