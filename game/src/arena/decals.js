// Breach Arena – dekaler på dekning (kulehull, sot, ichor, klo). Avtalt med Effekter (VFX) 23.10, utsatt bake 26.10.
// addCoverDecal legger dekalen i kø og returnerer straks. Ventende dekaler tegnes billig rett etter objektet
// (drawSorted → world.arena.drawPendingDecals; ovenfra: på slutten av drawTop). decalTick (kalt fra drawTop hvert bilde)
// baker høyst ett objekt per bilde innenfor et tidsbudsjett, og alle ventende dekaler på objektet i samme bake.
// Trekvart: bakes inn i objektets sprite (RES) og den ferdig skalerte kopien – ikke i topplaget (brukes bare uten sortering).
// Ovenfra: bakes inn i topplaget og visningskopien. Uberørte sikkerhetskopier lages én gang per sprite (deles mellom lastinger)
// og forhåndslages spredt over de første bildene etter arenaLoaded/levelStart.
import { PROJ } from '../shared/projection.js';
import { RES } from './render.js';
import { makeCanvas } from './paint.js';

export const DECAL_BUDGET = 24;           // vektenheter per objekt
export const FRAME_BUDGET_MS = 1.2;       // tidsbudsjett per bilde for forhåndslaging + bake
const REBAKE_EVERY = 12;                  // utskjøvne vektenheter før full ny bake (ellers blir gamle liggende under nye)
const WEIGHT = { scorch: 3 };
const R_RANGE = { bullet_metal: [2, 3], bullet_concrete: [3, 5], scorch: [10, 40], ichor: [4, 12], slash: [6, 14] };
const Z = PROJ.zScale;
const now = () => performance.now();

let vfxDraw = null;
try { import('../effects/decals.js').then((m) => { vfxDraw = m.drawDecalSprite || null; }).catch(() => {}); } catch (e) { /* ingen dynamisk import */ }
// VFX lager dekalspritene lat ved første bruk – varm dem opp i ledig tid så første treff ikke betaler
let warmed = false, warmI = 0, warmC = null;
function warmSprites() {
  const K = Object.keys(R_RANGE); if (!warmC) warmC = makeCanvas(8, 8).getContext('2d');
  const t0 = now();
  while (warmI < K.length * 8 && now() - t0 < 0.5) { const k = K[warmI >> 3]; warmC.setTransform(1, 0, 0, 1, 4, 4); try { vfxDraw(warmC, k, 2, 0, warmI & 7); } catch (e) { /* */ } warmI++; }
  if (warmI >= K.length * 8) warmed = true;
}
export function usingVfxSprites() { return !!vfxDraw; }

function fallbackDraw(x, kind, r, angle) {
  x.save(); x.rotate(angle || 0);
  if (kind === 'scorch') { const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(8,6,5,0.85)'); g.addColorStop(1, 'rgba(8,6,5,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); }
  else if (kind === 'ichor') { x.fillStyle = 'rgba(20,10,6,0.9)'; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,122,26,0.35)'; x.lineWidth = 0.8; x.stroke(); }
  else if (kind === 'slash') { x.strokeStyle = 'rgba(10,10,10,0.8)'; x.lineWidth = 1; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(-r, i * r * 0.3); x.lineTo(r, i * r * 0.3 + r * 0.15); x.stroke(); } }
  else { x.fillStyle = kind === 'bullet_metal' ? 'rgba(15,15,16,0.95)' : 'rgba(30,28,26,0.9)'; x.beginPath(); x.arc(0, 0, r * 0.6, 0, 7); x.fill(); }
  x.restore();
}
function paintDecal(x, kind, r, angle, seed) {
  if (vfxDraw) { try { if (vfxDraw(x, kind, r, angle, seed)) return; } catch (e) { vfxDraw = null; } }
  fallbackDraw(x, kind, r, angle);
}

const st = (world) => world._arenaState;
function objMap(s) {
  if (s.dObj && s.dObjEntry === s.entry) return s.dObj;
  s.dObj = new Map(); s.dSpr = new Map(); s.dObjEntry = s.entry;
  for (const o of s.entry.L.objects) s.dObj.set(o.id, o);
  for (const o of s.entry.layers.sprites || []) s.dSpr.set(o.id, o);
  return s.dObj;
}
const objById = (s, id) => objMap(s).get(id) || null;
const spriteById = (s, id) => (objMap(s), s.dSpr.get(id) || null);
const heightOf = (o) => o.height || (o.elev ? o.elev / Z : PROJ.heights.low);
const v34 = (s) => s.entry.L.view === '34';

/** Treffpunkt på dekningens flate. hitX/hitY = treffpunkt i bakkeplanet (som coverHit). z valgfri (coverHit.z). */
export function coverHitPoint(world, cover, hitX, hitY, z) {
  const s = st(world); if (!cover || !isFinite(hitX) || !isFinite(hitY)) return null;
  const o = (s && cover.id != null && objById(s, cover.id)) || cover;
  const H = heightOf(o), E = 1.5;
  const zz = Math.max(2, Math.min(H - 2, isFinite(z) ? z : PROJ.aimHeight));
  const dS = Math.abs(hitY - (o.y + o.h)), dN = Math.abs(hitY - o.y), dW = Math.abs(hitX - o.x), dE = Math.abs(hitX - (o.x + o.w));
  const m = Math.min(dS, dN, dW, dE);
  let face, nx = 0, ny = 0;
  if (m === dS && dS <= E + 3) { face = 'front'; ny = 1; }
  else if (m === dW || m === dE) { face = 'side'; nx = m === dW ? -1 : 1; }
  else face = 'top'; // nordflaten er skjult i trekvart → topp
  const x = Math.max(o.x, Math.min(o.x + o.w, hitX));
  return { coverId: o.id ?? cover.id, face, x, y: Math.max(o.y, Math.min(o.y + o.h, hitY)), z: face === 'top' ? H : zz,
    material: o.material || cover.material || 'concrete', nx, ny, angle: Math.atan2(ny, nx) };
}

// ---- geometri: synlig flate og plassering (verdens-px)
function place(o, d, is34) {
  const e = is34 ? o.elev : 0, H = heightOf(o);
  if (is34 && e > 0 && !(d.z >= H - 0.5 && d.y != null)) return { px: d.x, py: o.y + o.h - d.z * Z, cx: o.x, cy: o.y + o.h - e, cw: o.w, ch: e, front: true };
  const gy = d.y != null ? d.y : o.y + o.h - Math.min(d.r, o.h / 2);
  return { px: d.x, py: gy - e, cx: o.x, cy: o.y - e, cw: o.w, ch: o.h, front: false };
}
// Tegn dekaler i ctx sin nåværende transform pluss (sc, -ox·sc, -oy·sc) når abs er satt.
function paintList(x, o, list, is34, abs) {
  for (const d of list) {
    const p = place(o, d, is34); if (p.cw <= 0 || p.ch <= 0) continue;
    x.save(); if (abs) x.setTransform(abs[0], 0, 0, abs[0], abs[1], abs[2]);
    x.beginPath(); x.rect(p.cx, p.cy, p.cw, p.ch); x.clip();
    x.translate(p.px, p.py); if (p.front) x.scale(1, 0.85);
    paintDecal(x, d.kind, d.r, d.angle, d.seed);
    x.restore();
  }
}

function rec(s, id) { s.decals = s.decals || new Map(); let r = s.decals.get(id); if (!r) s.decals.set(id, r = { list: [], pend: [], wsum: 0, evicted: 0, rebake: false, baked: false }); return r; }
function snap(src, sx, sy, w, h) { const c = makeCanvas(Math.max(1, w), Math.max(1, h)); c.getContext('2d').drawImage(src, sx, sy, w, h, 0, 0, w, h); return c; }
function restore(dst, img, x, y) { const c = dst.getContext('2d'); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(x, y, img.width, img.height); c.drawImage(img, x, y); c.restore(); }
function region(o) { return { x0: Math.floor(o.x - 2), y0: Math.floor(o.y - 2), x1: Math.ceil(o.x + o.w + 2), y1: Math.ceil(o.y + o.h + 2) }; } // ovenfra (elev 0)

// Uberørte kopier: trekvart på spriten (o._bak), ovenfra på nivåobjektet (o._bakTop). Lages én gang, deles mellom lastinger.
function ensureBackup(s, id) {
  if (v34(s)) { const spr = spriteById(s, id); if (spr && !spr._bak) spr._bak = snap(spr.img, 0, 0, spr.img.width, spr.img.height); return; }
  const o = objById(s, id), top = s.entry.layers.top; if (!o || !top || o._bakTop) return;
  const g = region(o); o._bakTop = { g, img: snap(top, g.x0 * RES, g.y0 * RES, (g.x1 - g.x0) * RES, (g.y1 - g.y0) * RES) };
}
/** Forhåndslag sikkerhetskopier (spredt over bildene i decalTick). */
export function prepareCoverDecals(world) {
  const s = st(world); if (!s) return;
  s.prepQ = v34(s) ? (s.entry.layers.sprites || []).filter((o) => !o._bak).map((o) => o.id)
    : s.entry.L.objects.filter((o) => o.type && !o._bakTop).map((o) => o.id);
}

/** Legg en dekal i kø for objektet. Returnerer true når den ble tatt imot (tegnes straks, bakes senere). */
export function addCoverDecal(world, coverId, d = {}) {
  const t0 = now(), s = st(world); if (!s || !d) return false;
  const o = objById(s, coverId); if (!o || !R_RANGE[d.kind] || !isFinite(d.x)) return false;
  const is34 = v34(s), spr = is34 ? spriteById(s, coverId) : null; if (is34 && !spr) return false;
  const [lo, hi] = R_RANGE[d.kind];
  const dec = { x: +d.x, z: isFinite(d.z) ? +d.z : PROJ.aimHeight, y: isFinite(d.y) ? +d.y : null, kind: d.kind, r: Math.max(lo, Math.min(hi, +d.r || lo)),
    angle: +d.angle || 0, seed: (d.seed | 0) >>> 0, w: WEIGHT[d.kind] || 1 };
  const r = rec(s, coverId);
  r.list.push(dec); r.pend.push(dec); r.wsum += dec.w;
  while (r.wsum > DECAL_BUDGET && r.list.length > 1) { const old = r.list.shift(); r.wsum -= old.w; r.evicted += old.w; const i = r.pend.indexOf(old); if (i >= 0) r.pend.splice(i, 1); }
  if (r.evicted >= REBAKE_EVERY) { r.rebake = true; r.evicted = 0; }
  if (spr) spr.pendDecals = true;
  (s.bakeQ = s.bakeQ || new Set()).add(coverId);
  s.decalMs = (s.decalMs || 0) + (now() - t0);
  return true;
}

/** Trekvart: ventende dekaler rett etter objektet (kalles av drawSorted når o.pendDecals er satt). */
export function drawPendingDecals(ctx, spr, world) {
  const t0 = now(), s = st(world); if (!s) return;
  const r = s.decals?.get(spr.id), o = objById(s, spr.id);
  if (r && o && r.pend.length) { if (r.rebake) { paintList(ctx, o, r.list, true, null); } else paintList(ctx, o, r.pend, true, null); }
  s.decalMs = (s.decalMs || 0) + (now() - t0);
}
// Ovenfra: ventende dekaler oppå topplaget (fra drawTop).
function drawPendingTop(ctx, s) {
  if (!s.bakeQ?.size || v34(s)) return;
  for (const id of s.bakeQ) { const r = s.decals.get(id), o = objById(s, id); if (r && o) paintList(ctx, o, r.pend, false, null); }
}

function bakeOne(s, id) {
  const r = s.decals?.get(id); s.bakeQ.delete(id); if (!r) return;
  const o = objById(s, id), is34 = v34(s); ensureBackup(s, id);
  const full = r.rebake, list = full ? r.list : r.pend;
  if (is34) {
    const spr = spriteById(s, id); if (!spr) return;
    const x = spr.img.getContext('2d');
    if (full && spr._bak) restore(spr.img, spr._bak, 0, 0);
    paintList(x, o, list, true, [RES, -spr.sx * RES, -spr.sy * RES]);
    // skalert kopi: tegn de samme dekalene rett inn (unngår ny reskalering av hele spriten), ved full bake: reskaler
    if (!full && spr._simg && spr._scale > 0) { const sc = spr._scale; paintList(spr._simg.getContext('2d'), o, list, true, [sc, -spr._px, -spr._py]); }
    else spr._scale = 0;
    spr.pendDecals = false;
  } else {
    const top = s.entry.layers.top, b = o._bakTop; if (!top) return;
    if (full && b) restore(top, b.img, b.g.x0 * RES, b.g.y0 * RES);
    paintList(top.getContext('2d'), o, list, false, [RES, 0, 0]);
    const vc = s.vc;
    if (vc && vc.L === s.entry.L && vc.top) {
      if (full) { s.vc = null; } else paintList(vc.top.getContext('2d'), o, list, false, [vc.scale, 0, 0]);
    }
  }
  r.pend.length = 0; r.rebake = false; r.baked = true;
}

/** Kalles hvert bilde (fra drawTop). Ovenfra: tegner også ventende dekaler. Høyst én bake per bilde. */
export function decalTick(ctx, world) {
  const s = st(world); if (!s) return;
  s.decalFrames = s.decalFrames || 0;
  const t0 = now();
  drawPendingTop(ctx, s);
  const q = s.prepQ;
  while (q && q.length && now() - t0 < FRAME_BUDGET_MS * 0.5) ensureBackup(s, q.pop());
  if (vfxDraw && !warmed && (!q || !q.length) && now() - t0 < FRAME_BUDGET_MS * 0.5) warmSprites();
  if (s.bakeQ?.size && now() - t0 < FRAME_BUDGET_MS * 0.5) { const id = s.bakeQ.values().next().value, r = s.decals?.get(id), info = r ? (r.rebake ? 'full' : r.baked ? 'inc' : 'first') + ':' + r.pend.length : '', b0 = now(); bakeOne(s, id); const bd = now() - b0; if (bd > 2) (s.decalSlow = s.decalSlow || []).push(info + '=' + bd.toFixed(1)); }
  const dt = now() - t0; s.decalMs = (s.decalMs || 0) + dt;
  s.decalLast = s.decalMs; if (s.decalFrames++ > 30) s.decalMax = Math.max(s.decalMax || 0, s.decalMs); s.decalMs = 0; // ett bilde lukket
}

/** Fjern alle dekaler (ny runde / nytt brett) og start forhåndslaging. */
export function clearCoverDecals(world) {
  const s = st(world); if (!s) return;
  if (s.decals?.size) {
    const is34 = v34(s), top = s.entry.layers.top;
    for (const [id, r] of s.decals) {
      if (is34) { const spr = spriteById(s, id); if (spr) { spr.pendDecals = false; if (r.baked && spr._bak) { restore(spr.img, spr._bak, 0, 0); spr._scale = 0; } } }
      else { const o = objById(s, id); if (r.baked && o?._bakTop && top) restore(top, o._bakTop.img, o._bakTop.g.x0 * RES, o._bakTop.g.y0 * RES); }
    }
    if (!is34) s.vc = null;
    s.decals.clear();
  }
  s.bakeQ?.clear();
  prepareCoverDecals(world);
}
export function decalStats(world) {
  const s = st(world); let n = 0, w = 0; if (s?.decals) for (const r of s.decals.values()) { n += r.list.length; w += r.wsum; }
  return { objects: s?.decals?.size || 0, decals: n, weight: w, queued: s?.bakeQ?.size || 0, prep: s?.prepQ?.length || 0, maxFrameMs: +(s?.decalMax || 0).toFixed(2) };
}
