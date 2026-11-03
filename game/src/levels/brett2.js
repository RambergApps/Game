// Brett 2 v3 (Story 27.10): seksjon-ryddet-trigger + låste overganger med synlige objekter i banen (worldObjects) + mellomsekvens,
// og tankhelse (FUEL INTEGRITY) i holdet. Kjører BARE når nivådataene har `transitions` / `tank` (kun LEVELS[1]).
// Tank: enhver levende fiende innen `reach` ruter fra tankens rektangel trekker `drain`/s (Kiln `drainHeavy`).
// 0 % → Warden dør (vanlig dødsflyt: bølgen starter på nytt, oppgraderinger beholdes).
import { damage } from '../core/combat.js';
import * as FX from '../effects/transitions.js';   // Effekter: drawObject(ctx, t, s) – mangler den, brukes plassholderen under
const T = 32;
const S = (world) => (world._brett2 ||= { cleared: new Set(), used: new Set(), tank: null, walkTrigger: true });   // walkTrigger=false: gangsonen av (tasten kaller tryUseExit)
const rectPx = (g) => ({ x: g.x * T, y: g.y * T, w: g.w * T, h: g.h * T });

// Overganger (ruter). Låses opp når `section` er ryddet (bølge `after`). Spilleren går inn i sonen (r ZONE_R rundt x/y) →
// mellomsekvensen `cutscene` spilles (story/player.js) → Warden står på `exit` i neste seksjon. Utløses av Wardens tast
// (player/interact.js → tryUseExit); gangsonen er reserve (AUTO_ZONE). `opening` = åpningen objektet står i, `wheel` = rødt ventilratt
// ved siden av åpningen (pry/valve) – x/y (interaksjonssonen) ligger ved rattet. Alt i ruter. `block` = åpningen er stengt (høy blokk i world.cover) til overgangen er brukt.
// Kroker: onStart/onEnd per overgang + setTransitionHooks({ onStart, onEnd }) for Arena; hendelse 'transition' {id, kind, phase}.
// Warden-kallene (climbLadder / playAction) er valgfrie og brukes bare om de finnes OG cutscene er null.
export const TRANSITIONS = [
  { id: 'S1-S2', kind: 'pry',    section: 'S1', after: '2-1', x: 20.8, y: 23.4, reach: 1.4, facing: 0, wheel: { x: 20.8, y: 23.4 }, opening: { x: 21, y: 19, w: 2, h: 4 }, exit: { x: 25.5, y: 21 }, block: { x: 21, y: 19, w: 2, h: 4 }, cutscene: 'refinery-door' },
  { id: 'S2-S3', kind: 'ladder', section: 'S2', after: '2-2', x: 67.8, y: 12,   dir: 'up', height: 3, facing: 0, opening: { x: 69, y: 10, w: 2, h: 4 }, exit: { x: 76.5, y: 13.5 }, hatch: { x: 76.5, y: 13.5 }, block: { x: 69, y: 10, w: 2, h: 4 }, cutscene: 'refinery-ladder-up' },   // stigefoten i S2 ved veggen, ender i gulvluke inne i S3
  { id: 'S3-S4', kind: 'crawl',  section: 'S3', after: '2-3', x: 91.8, y: 9.5,  facing: 0, opening: { x: 93, y: 8, w: 2, h: 3 }, exit: { x: 97.5, y: 9 }, block: { x: 93, y: 8, w: 2, h: 3 }, cutscene: 'refinery-pipe' },
  { id: 'S3-S4s', kind: 'crawl', section: 'S3', after: '2-3', x: 91.8, y: 22.5,  facing: 0, opening: { x: 93, y: 21, w: 2, h: 3 }, exit: { x: 97.5, y: 22.5 }, block: { x: 93, y: 21, w: 2, h: 3 }, cutscene: 'refinery-pipe' },   // v3: to rørutganger, hver inn i sin rørgang
  { id: 'S4-S5', kind: 'ladder', section: 'S4', after: '2-4', x: 117.8, y: 15,  dir: 'down', height: 3, facing: 0, opening: { x: 119, y: 13, w: 2, h: 4 }, exit: { x: 123.5, y: 15 }, block: { x: 119, y: 13, w: 2, h: 4 }, cutscene: 'refinery-ladder-down' },
  { id: 'S5-S6', kind: 'valve',  section: 'S5', after: '2-5', x: 156.8, y: 24.4, reach: 1.4, facing: 0, wheel: { x: 156.8, y: 24.4 }, opening: { x: 157, y: 19, w: 2, h: 5 }, exit: { x: 161.5, y: 21.5 }, block: { x: 157, y: 19, w: 2, h: 5 }, cutscene: 'refinery-valve' },
];
const ZONE_R = 1.2;
const HOOKS = { onStart: null, onEnd: null };
/** Arena kan koble seg på (f.eks. kamera). Kalles med (transition, world). */
export function setTransitionHooks(h = {}) { HOOKS.onStart = h.onStart || null; HOOKS.onEnd = h.onEnd || null; }

/** Nullstill (levelstart). */
export function resetSections(world) {
  const s = S(world); s.cleared = new Set(); s.used = new Set(); s.busy = null;
  if (world.arena) { s.spawn0 ||= { ...world.arena.playerSpawn }; world.arena.playerSpawn = { ...s.spawn0 }; }
  syncBlocks(world);
  try { FX.warmTransitionSprites?.(TRANSITIONS, world._brett2?.d?.level?.tank?.rect); } catch (e) { /* Effekter: bak sprites ved levelstart (~bake-tid i EFFEKTER.md) */ }
}
function syncBlocks(world) {
  if (!world.cover) return;
  world.cover = world.cover.filter((c) => c.kind !== 'b2block');
  for (const t of TRANSITIONS) for (const r of [t.block, t.block2]) if (r) world.cover.push({ ...rectPx(r), type: 'high', kind: 'b2block', material: 'metal', id: 'b2-' + t.id });
}

/** Seksjon ryddet → 'sectionClear' + overgangen låses opp ('transitionUnlocked'). */
export function onWaveEnd(world, L, w) {
  if (!L?.transitions || !w) return;
  const s = S(world);
  for (const t of TRANSITIONS) if (t.after === w.id && !s.cleared.has(t.section)) {
    s.cleared.add(t.section); s.unlockT = world.time || 0;
    world.events.emit('sectionClear', { level: L.n, section: t.section, wave: w.id });
    world.events.emit('transitionUnlocked', { id: t.id, kind: t.kind, section: t.section, x: t.x * T, y: t.y * T });
  }
}
/** startAt midt i brettet: alt før bølge `first` regnes som ryddet og passert; Warden starter på siste exit. */
export function skipTo(world, L, first) {
  const s = S(world);
  for (const w of L.waves.slice(0, first)) { onWaveEnd(world, L, w); const t = TRANSITIONS.find((q) => q.after === w.id); if (t) { for (const q of TRANSITIONS) if (q.after === w.id) s.used.add(q.id); if (world.arena) world.arena.playerSpawn = { x: t.exit.x * T, y: t.exit.y * T }; } }
}
export function transitionOpen(world, id) { const t = TRANSITIONS.find((q) => q.id === id); return !!(t && world._brett2?.cleared.has(t.section)); }

/** Pausen før neste bølge venter til Warden har tatt overgangen (ellers spawner neste seksjon mens han står i forrige). */
function holdBreak(world, d, s) {
  if (d.phase !== 'break' || d.wi < 0) return;
  const t = TRANSITIONS.find((q) => q.after === d.level.waves[d.wi]?.id);
  if (t && !s.used.has(t.id)) d.breakLeft = Math.max(d.breakLeft, 0.5);
}

/** Gangsone som reserve til interaksjonstasten finnes (Warden-design). Sett false når tasten kaller tryUseExit. */
export let AUTO_ZONE = false;   // 23:25: av som standard – Wardens tast (player/interact.js) kaller tryUseExit
export function setAutoZone(on) { AUTO_ZONE = !!on; }
/** Åpen, ubrukt overgang innen r ruter fra Warden (for tast/ledetekst), ellers null. */
export function exitInReach(world, r = ZONE_R) {
  const s = world._brett2, p = world.player; if (!s || !p || p.dead || s.busy) return null;
  return TRANSITIONS.find((t) => s.cleared.has(t.section) && !s.used.has(t.id) && Math.hypot(p.x - t.x * T, p.y - t.y * T) <= Math.max(r, t.reach || 0) * T) || null;
}
/** Grensesnitt for interaksjonstasten: bruk utgang `id` (eller nærmeste innen rekkevidde). true = sekvensen startet. */
/** Alias (Breach 23:15). */
export const nearExit = (world) => exitInReach(world);
export function tryUseExit(world, id) {
  const s = world._brett2, d = s?.d; if (!s || !d || !(d.phase === 'break' || d.phase === 'between' || d.phase === 'wave')) return false;
  const t = id ? TRANSITIONS.find((q) => q.id === id) : exitInReach(world); const p = world.player;
  if (!t || !p || p.dead || s.busy || !s.cleared.has(t.section) || s.used.has(t.id)) return false;
  if (Math.hypot(p.x - t.x * T, p.y - t.y * T) > Math.max(ZONE_R, t.reach || 0) * T * 1.5) return false;
  useExit(world, s, t, s.play); return true;
}
function transitions(world, d, s, play) {
  s.d = d; s.play = play;
  if (AUTO_ZONE && s.walkTrigger !== false) { const t = exitInReach(world); if (t) tryUseExit(world, t.id); }
}
function useExit(world, s, t, play) {
  const p = world.player;
  {
    s.busy = t.id; for (const q of TRANSITIONS) if (q.after === t.after) s.used.add(q.id);   // to S3-utganger: én brukt = begge brukt
    const ev = (phase) => world.events.emit('transition', { id: t.id, kind: t.kind, phase });
    const next = 'S' + (+t.section.slice(1) + 1);
    const mid = () => { ev('mid'); p.x = t.exit.x * T; p.y = t.exit.y * T; p.vx = p.vy = 0;
      if (world.arena) world.arena.playerSpawn = { x: p.x, y: p.y };                   // død i neste seksjon → start her
      if (world.camera) { world.camera.x = p.x; world.camera.y = p.y; }
      world.events.emit('sectionEnter', { section: next, via: t.id }); };
    const end = () => { if (s.busy !== t.id) return; s.busy = null; ev('end'); try { t.onEnd?.(t, world); HOOKS.onEnd?.(t, world); } catch (e) { console.info('[brett2] onEnd', e); } };
    try { t.onStart?.(t, world); HOOKS.onStart?.(t, world); } catch (e) { console.info('[brett2] onStart', e); }
    ev('start');
    const P = world.modules?.player;
    if (t.cutscene && play) { play(t.cutscene).then(() => { mid(); end(); }); }              // sekvensen dekker skjermen: flytt etter den
    else if (t.kind === 'ladder' && typeof P?.climbLadder === 'function') P.climbLadder({ x: t.x * T, y: t.y * T, dir: t.dir, height: t.height, facing: t.facing, onDone: () => { mid(); end(); } });
    else if (typeof P?.playAction === 'function') P.playAction({ kind: t.kind, x: t.x * T, y: t.y * T, facing: t.facing, duration: 1.4, onDone: () => { mid(); end(); } });
    else { mid(); end(); }
  }
}

// Overgangsobjekter i arena-stil (rust/stål, mørk kontur, ovenfra-skrått), tegnet over åpningen de stenger.
function drawObject(ctx, kind, x, y, w, h, z, used, lamp) {
  ctx.save(); ctx.lineJoin = 'round';
  const slab = (c1, c2) => { const g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#0d0f10'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); };
  const light = (lx, ly) => { ctx.fillStyle = lamp; ctx.shadowColor = lamp; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(lx, ly, Math.max(3, z * 4), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; };
  if (kind === 'pry') {                    // rusten trykkdør: to plater, nagler, gul/svart kant, skjøt i midten
    slab('#6b4a32', '#3e2c20'); ctx.fillStyle = 'rgba(201,162,39,0.9)';
    for (let q = 0; q < h; q += z * 14) { ctx.fillRect(x, y + q, w * 0.14, z * 7); ctx.fillRect(x + w * 0.86, y + q + z * 7, w * 0.14, z * 7); }
    ctx.strokeStyle = used ? '#ffb070' : '#151515'; ctx.lineWidth = used ? 3 : 2; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 3); ctx.stroke();
    ctx.fillStyle = '#9a8a78'; for (let q = z * 8; q < h; q += z * 12) for (const fx of [0.3, 0.7]) { ctx.beginPath(); ctx.arc(x + w * fx, y + q, z * 1.6, 0, 7); ctx.fill(); }
    light(x + w / 2, y + z * 8);
  } else if (kind === 'ladder') {          // stålramme + stige med trinn og luke
    slab('#3a4046', '#262b30'); ctx.strokeStyle = '#b8b0a0'; ctx.lineWidth = Math.max(2, z * 3);
    ctx.beginPath(); ctx.moveTo(x + w * 0.28, y + 4); ctx.lineTo(x + w * 0.28, y + h - 4); ctx.moveTo(x + w * 0.72, y + 4); ctx.lineTo(x + w * 0.72, y + h - 4); ctx.stroke();
    ctx.lineWidth = Math.max(1.5, z * 2); for (let q = y + z * 10; q < y + h - 4; q += z * 10) { ctx.beginPath(); ctx.moveTo(x + w * 0.28, q); ctx.lineTo(x + w * 0.72, q); ctx.stroke(); }
    ctx.fillStyle = 'rgba(201,162,39,0.9)'; ctx.fillRect(x, y, w, z * 4); ctx.fillRect(x, y + h - z * 4, w, z * 4); light(x + w / 2, y + h / 2);
  } else if (kind === 'crawl') {           // tykt sprukket rør med mørk åpning mot vest
    slab('#4a5058', '#2c3036'); const cx = x + w * 0.45, cy = y + h / 2, R = Math.min(w, h) * 0.42;
    ctx.fillStyle = '#7a6a58'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); ctx.fillStyle = '#050607'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + R * 0.5, cy - R); ctx.lineTo(cx + R * 0.1, cy - R * 0.3); ctx.lineTo(cx + R * 0.6, cy + R * 0.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(170,150,120,0.6)'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx - R * 0.9, cy - R * 0.3 + k * z * 4); ctx.lineTo(cx - R * 0.2, cy - R * 0.1 + k * z * 4); ctx.stroke(); }
    light(x + w * 0.85, y + z * 8);
  } else if (kind === 'gate') {            // sluseport (rattet står ved siden av)
    slab('#4b5258', '#30353a'); ctx.fillStyle = 'rgba(201,162,39,0.85)'; for (let q = 0; q < h; q += z * 16) ctx.fillRect(x, y + q, w, z * 5); light(x + w / 2, y + z * 8);
  } else if (kind === 'valve') {           // sluseport med stort rødt ventilhjul
    slab('#4b5258', '#30353a'); ctx.fillStyle = 'rgba(201,162,39,0.85)'; for (let q = 0; q < h; q += z * 16) ctx.fillRect(x, y + q, w, z * 5);
    const cx = x + w / 2, cy = y + h * 0.55, R = w * 0.42; ctx.strokeStyle = '#c0281c'; ctx.lineWidth = Math.max(3, z * 4);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.lineWidth = Math.max(2, z * 2.5);
    for (let k = 0; k < 3; k++) { const an = k * Math.PI / 3 + (used ? 0.6 : 0); ctx.beginPath(); ctx.moveTo(cx - Math.cos(an) * R, cy - Math.sin(an) * R); ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R); ctx.stroke(); }
    ctx.fillStyle = '#7a1810'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.25, 0, 7); ctx.fill(); light(cx, y + z * 8);
  } else slab('#3d4246', '#2a2e31');       // permanent stengt (S3 sør): stålplate
  ctx.restore();
}
// Gulvluke (stigetopp) inne i rommet: stålramme med gule kanter; åpen (lyst innhold) når overgangen er brukt.
function drawHatch(ctx, h, used) {
  const cx = h.x * T, cy = h.y * T, w = 1.6 * T; ctx.save(); ctx.fillStyle = '#2b2f33'; ctx.fillRect(cx - w / 2, cy - w / 2, w, w);
  ctx.strokeStyle = 'rgba(201,162,39,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(cx - w / 2, cy - w / 2, w, w);
  ctx.fillStyle = used ? '#0a0b0c' : '#4a5056'; ctx.fillRect(cx - w * 0.38, cy - w * 0.38, w * 0.76, w * 0.76);
  ctx.strokeStyle = '#b8b0a0'; ctx.lineWidth = 1.5; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx - w * 0.3, cy + k * w * 0.2); ctx.lineTo(cx + w * 0.3, cy + k * w * 0.2); ctx.stroke(); }
  ctx.restore();
}
// --- Verdenslaget (Effekter 23:38): worldObjects(world) → [{ y, draw(ctx) }], y = bunnen av objektet i ruter.
// core/loop.js gir dem til shared/depth.js drawSorted som ekstraaktører (worldActors): y-sortert MED dekning og figurene.
// drawWorld er bare reserven når dybdesorteringen er av.
// Ingen ring, ingen tekst: ulåst-gløden tegner Effekter fra s.unlocked; ledeteksten «[E] …» (Warden) er eneste tekst.
const fxDraw = typeof FX.drawObject === 'function' ? FX.drawObject : null;
export function worldObjects(world) {
  const s = world._brett2, d = s?.d; if (!s || !d?.level?.transitions) return [];
  const tm = world.time || 0, near = exitInReach(world)?.id || null, out = [];
  for (const t of TRANSITIONS) {
    const st = { unlocked: s.cleared.has(t.section) && !s.used.has(t.id), used: s.used.has(t.id), inReach: near === t.id, busy: s.busy === t.id, t: tm, hp: null, hpMax: null };
    const o = t.opening || t.block, parts = FX.transitionParts?.(t, st);
    if (parts) { for (const p of parts) out.push({ y: p.y, cx: p.cx ?? o.x + o.w / 2, hw: 0, draw: p.draw }); continue; }   // v10: delene y-sorteres hver for seg med Warden
    out.push({ y: o.y + o.h, cx: o.x + o.w / 2, hw: o.w / 2, draw: (ctx) => (fxDraw ? fxDraw(ctx, t, st) : placeholder(ctx, t, st)) });
  }
  const tk = d.level.tank; if (tk) { const r = tk.rect, st = { unlocked: false, used: false, inReach: false, busy: false, t: tm, hp: s.tank?.hp ?? 1, hpMax: 1, hitAt: s.tank?.hitAt ?? null };
    out.push({ y: r.y + r.h, cx: r.x + r.w / 2, hw: r.w / 2, draw: (ctx) => (fxDraw ? fxDraw(ctx, { kind: 'tank', rect: r }, st) : null) }); }   // tanken tegnes av arenaen; plassholder trenger ingenting
  return out;
}
/** v10: gulvlys og -striper for overgangene, i gulvlaget (core/loop.js, før figurene). */
export function drawWorldFloor(ctx, world) { const s = world._brett2; if (!s?.d?.level?.transitions || !FX.transitionFloor) return; const tm = world.time || 0;
  for (const t of TRANSITIONS) { try { FX.transitionFloor(ctx, t, { unlocked: s.cleared.has(t.section) && !s.used.has(t.id), used: s.used.has(t.id), t: tm }); } catch (e) { console.info('[brett2] drawWorldFloor', e); } } }
/** Kalles fra levels/index.js drawWorld (verdenskoordinater, kamera påført). */
/** Nivåobjektene som ekstraaktører til shared/depth.js drawSorted: fotpunkt = objektets bunn (y i ruter). */
export function worldActors(world) {
  return worldObjects(world).map((o) => ({ x: (o.cx ?? 0) * T, y: o.y * T + 0.5,   // +0,5 px: tegnes rett ETTER arenaobjektet med samme bunn (tankens skadelag ligger oppå tanken)
    r: (o.hw ?? 1) * T, team: 'prop', noSil: true, drawActor: (ctx) => o.draw(ctx) }));
}
export function drawWorld(ctx, world) { const L = worldObjects(world); L.sort((a, b) => a.y - b.y); for (const o of L) { try { o.draw(ctx); } catch (e) { console.info('[brett2] drawWorld', e); } } }
// Plassholder (samme kallform som Effekters drawObject): objekt i åpningen, rødt ratt ved siden av, gulvluke for stige opp.
function placeholder(ctx, t, st) {
  const o = t.opening || t.block, lamp = st.used ? '#5a6068' : st.unlocked && !st.inReach ? `rgba(255,190,90,${0.45 + 0.35 * Math.sin(st.t * 4)})` : '#ff4a2a';
  drawObject(ctx, t.wheel ? (t.kind === 'pry' ? 'pry' : 'gate') : t.kind, o.x * T, o.y * T, o.w * T, o.h * T, 1, st.used, lamp);
  if (t.wheel) drawWheel(ctx, t.wheel.x * T, t.wheel.y * T, st);
  if (t.hatch) drawHatch(ctx, t.hatch, st.used);
}
function drawWheel(ctx, cx, cy, st) {
  const R = 11; ctx.save(); ctx.fillStyle = '#2a2e31'; ctx.fillRect(cx - 14, cy - 14, 28, 28);
  if (st.unlocked && !st.inReach) { ctx.shadowColor = 'rgba(255,120,60,0.9)'; ctx.shadowBlur = 6 + 6 * (0.5 + 0.5 * Math.sin(st.t * 4)); }
  ctx.strokeStyle = '#c0281c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 2.5;
  for (let k = 0; k < 3; k++) { const an = k * Math.PI / 3 + (st.used ? 0.8 : 0); ctx.beginPath(); ctx.moveTo(cx - Math.cos(an) * R, cy - Math.sin(an) * R); ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R); ctx.stroke(); }
  ctx.fillStyle = '#7a1810'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill(); ctx.restore();
}

/** Holdbølgen med tank (kun nivådata med `tank`): nullstill tankhelsen. */
export function onWaveBegin(world, L, w) {
  if (!L?.tank || !w) return; const s = S(world);
  s.tank = w.objective?.type === 'hold' ? { rect: L.tank.rect, reach: L.tank.reach ?? 2, drain: L.tank.drain ?? 0.02, drainHeavy: L.tank.drainHeavy ?? 0.05, hp: 1, lost: false, hitAt: null } : null;
}
export function update(dt, world, d, play) {
  const s0 = world._brett2;
  if (d.level?.transitions && s0) { holdBreak(world, d, s0); transitions(world, d, s0, play); }
  const s = world._brett2; if (!s?.tank || d.phase !== 'wave') return;
  const t = s.tank, p = world.player; if (!p || p.dead) return;
  const r = rectPx(t.rect), reach = t.reach * T;
  let drain = 0;
  for (const e of world.enemies) {
    if (e.dead || e.boss) continue;
    const dx = Math.max(r.x - e.x, 0, e.x - (r.x + r.w)), dy = Math.max(r.y - e.y, 0, e.y - (r.y + r.h));
    if (Math.hypot(dx, dy) <= reach + (e.r || 14)) drain += e.type === 'heavy' ? t.drainHeavy : t.drain;
  }
  if (drain > 0) { t.hp = Math.max(0, t.hp - drain * dt); t.hitAt = world.time; }
  if (t.hp <= 0) {
    if (!t.lost) {
      t.lost = true; s.lostAt = world.time;
      d.banner = { kicker: 'FUEL 01', title: 'THE FUEL IS LOST', t0: performance.now() / 1000, dur: 2.4, col: '#ff5a3a' };
      world.events.emit('tankLost', {});
    }
    damage(p, 1e6, { team: 'enemy', x: p.x, y: p.y, cause: 'tank' }, world);   // 28.10: gjentas hver ramme til Warden er død (i-frames/rulling kan avvise første treff → tank 0 % uten død)
  }
}

export function drawHud(ctx, world, camera, d) {
  const s = world._brett2; if (!s || d.n !== 2) return;
  const t = s.tank; if (!t || d.phase !== 'wave' || !d.level?.tank) return;
  const W = 300, H = 12, cx = ctx.canvas.width / 2, y = 92;
  ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8e2d4'; ctx.fillText('FUEL INTEGRITY', cx, y - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - W / 2 - 2, y - 2, W + 4, H + 4);
  const hot = t.hitAt != null && (world.time - t.hitAt) < 0.25;
  ctx.fillStyle = t.hp > 0.5 ? '#c9a227' : t.hp > 0.25 ? '#ff7a1a' : '#ff3a2a'; if (hot) ctx.fillStyle = '#fff1c4';
  ctx.fillRect(cx - W / 2, y, W * t.hp, H);
  ctx.fillStyle = '#e8e2d4'; ctx.fillText(Math.ceil(t.hp * 100) + '%', cx + W / 2 + 22, y + 10); ctx.restore();
}
