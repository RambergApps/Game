// BREACH – våpen-HUD: ammo/bytte/aktiv reload/granater (skjerm), trådkors, reload-bar over spilleren og granatbane (verden).
import { PROJ } from '../shared/projection.js';
import { WEAPONS, GRENADE } from './data.js';
import { predictGrenade } from './grenades.js';
import { is34, lift, hidden } from './view34.js';
import { current as currentOf, previewDamage, getMuzzle } from './index.js';   // sirkulær import er trygg: brukes bare ved kall

const TAU = Math.PI * 2;
const C = { cyan: '#39c6ff', cyanHi: '#bff3ff', panel: 'rgba(10,13,16,0.78)', line: 'rgba(120,150,170,0.25)', txt: '#d9e2e8', dim: '#7d8a94', warn: '#ffb347', bad: '#ff5a3c', good: '#9fe8ff' };
const RESULT = { perfect: ['PERFECT', '#ffffff'], good: ['GOOD', C.good], fail: ['JAMMED', C.bad] };

function cur(e) { return e?.loadout ? e.loadout : null; }

/** Tegn aktiv reload-bar i (x,y,w,h). c = current(). */
function reloadBar(ctx, c, x, y, w, h, big) {
  const ar = c.activeReload, base = c.reloadBase || c.reloadTotal, total = c.reloadTotal || base;
  const span = Math.max(base, total);              // jam forlenger baren
  const X = (t) => x + (w * t) / span;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(70,82,92,.55)'; ctx.fillRect(x, y, w, h);
  if (ar && !c.jammed) {
    ctx.fillStyle = 'rgba(57,198,255,.18)'; ctx.fillRect(X(ar.from * base), y, X(ar.to * base) - X(ar.from * base), h);    // vindu
    ctx.fillStyle = 'rgba(159,232,255,.55)'; ctx.fillRect(X(ar.good[0] * base), y, X(ar.good[1] * base) - X(ar.good[0] * base), h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(X(ar.perfect[0] * base), y - (big ? 2 : 1), X(ar.perfect[1] * base) - X(ar.perfect[0] * base), h + (big ? 4 : 2));
  }
  ctx.fillStyle = c.jammed ? 'rgba(255,90,60,.55)' : 'rgba(57,198,255,.35)'; ctx.fillRect(x, y, X(c.reloadT) - x, h);
  const mx = X(c.reloadT);
  ctx.fillStyle = c.jammed ? C.bad : C.cyanHi; ctx.fillRect(mx - 1, y - (big ? 4 : 2.5), 2, h + (big ? 8 : 5));
  if (c.activeTried || c.jammed) { ctx.globalAlpha = 0.9; }
}

/**
 * Skjerm-HUD for våpen (kall i skjermkoordinater, f.eks. fra player.drawHud). opts: { x, y (senter-bunn), scale }
 * Standard: nede i midten.
 */
export const HUD_FADE = { alpha: 0.25, pad: 10, speed: 10 };   // speed: 1/s mot målet
/** Skjermrektangel-sjekk: Warden (kropp + høyde i trekvart) eller trådkorset innenfor panelet → HUD_FADE.alpha. */
function hudAlpha(world, e, L, rect, opts) {
  let want = 1;
  const cam = world?.camera, P = HUD_FADE.pad;
  const inR = (x, y, r = 0) => x + r > rect.x - P && x - r < rect.x + rect.w + P && y + r > rect.y - P && y - r < rect.y + rect.h + P;
  if (cam?.worldToScreen && Number.isFinite(e.x)) {
    const z = cam.zoom || 1, sp = cam.worldToScreen(e.x, e.y), r = (e.r || 14) * z;
    if (inR(sp.x, sp.y, r) || inR(sp.x, sp.y - PROJ.heights.actor * PROJ.screenZ * z, r)) want = HUD_FADE.alpha;   // fotpunkt og hode (PROJ actor 48 × zScale 0,75)
  }
  const m = world?.input?.mouse; if (m && inR(m.x, m.y)) want = HUD_FADE.alpha;
  if (opts.alpha !== undefined) want = opts.alpha;
  const t = performance.now() / 1000, dt = Math.min(0.1, L._hudT ? t - L._hudT : 1); L._hudT = t;
  const a = L._hudA ?? 1, k = Math.min(1, dt * HUD_FADE.speed);
  L._hudA = a + (want - a) * k;
  return L._hudA;
}

export function drawHud(ctx, world, e, opts = {}) {
  const L = cur(e); if (!L) return; const c = currentOf(e); if (!c) return;
  const W = ctx.canvas.width, H = ctx.canvas.height, s = opts.scale || 1;
  const cx = opts.x ?? W / 2, by = opts.y ?? H - 18;
  const pw = 360, ph = 74, x0 = -pw / 2, y0 = -ph;
  // Gjennomsiktig når Warden eller trådkorset er bak panelet på skjermen (rev. 5). Myk overgang i ekte tid.
  const top = by - (ph + (c.reloading ? 50 : 22)) * s, rect = { x: cx - (pw / 2) * s, y: top, w: pw * s, h: by - top + 18 };
  const A = hudAlpha(world, e, L, rect, opts);
  ctx.save(); ctx.globalAlpha = A; ctx.translate(cx, by); ctx.scale(s, s);
  // panel med skrå hjørner
  ctx.fillStyle = C.panel; ctx.beginPath(); ctx.moveTo(x0 + 14, y0); ctx.lineTo(x0 + pw - 14, y0); ctx.lineTo(x0 + pw, y0 + 14); ctx.lineTo(x0 + pw, 0); ctx.lineTo(x0, 0); ctx.lineTo(x0, y0 + 14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = C.cyan; ctx.fillRect(x0 + 14, y0, 46, 2);
  // våpenfaner 1/2/3
  const tabW = 62; c.slots.forEach((sl, i) => {
    const tx = x0 + 12 + i * (tabW + 6), ty = y0 + 10, act = i === c.index;
    ctx.fillStyle = act ? 'rgba(57,198,255,.16)' : 'rgba(255,255,255,.03)'; ctx.fillRect(tx, ty, tabW, 18);
    ctx.strokeStyle = act ? C.cyan : 'rgba(255,255,255,.08)'; ctx.strokeRect(tx + 0.5, ty + 0.5, tabW - 1, 17);
    ctx.font = '600 10px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillStyle = act ? C.cyan : C.dim; ctx.fillText(String(i + 1), tx + 5, ty + 9.5);
    ctx.fillStyle = act ? C.txt : C.dim; ctx.fillText(sl.short, tx + 16, ty + 9.5);
    ctx.fillStyle = sl.mag === 0 ? C.bad : act ? C.cyanHi : '#5c6870'; ctx.textAlign = 'right'; ctx.fillText(String(sl.mag), tx + tabW - 5, ty + 9.5); ctx.textAlign = 'left';
  });
  // navn + rolle
  ctx.font = '700 13px system-ui, sans-serif'; ctx.fillStyle = C.txt; ctx.textBaseline = 'alphabetic';
  ctx.fillText(c.name.toUpperCase(), x0 + 12, y0 + 46);
  if (c.bonus.rounds > 0) { ctx.font = '700 10px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(`+${Math.round((c.bonus.mult - 1) * 100)}% DMG · ${c.bonus.rounds} RDS`, x0 + 12, y0 + 60); }
  else if (c.def.steady && c.aiming) { ctx.font = '600 10px system-ui, sans-serif'; ctx.fillStyle = c.steady >= 1 ? C.cyanHi : C.dim; ctx.fillText(c.steady >= 1 ? 'STEADY · +30% DMG' : c.steady > 0 ? `STEADYING · +${Math.round((c.steadyMult - 1) * 100)}% DMG` : 'HOLD STILL TO STEADY…', x0 + 12, y0 + 60); }
  // ammo
  const ax = x0 + pw - 14; ctx.textAlign = 'right';
  ctx.font = '700 30px system-ui, sans-serif'; ctx.fillStyle = c.mag === 0 ? C.bad : c.mag <= Math.ceil(c.magSize * 0.25) ? C.warn : C.txt;
  ctx.fillText(String(c.mag), ax - 52, y0 + 50);
  ctx.font = '600 13px system-ui, sans-serif'; ctx.fillStyle = C.dim; ctx.fillText(c.reserve === Infinity ? '/ ∞' : `/ ${c.reserve}`, ax, y0 + 50);
  ctx.textAlign = 'left';
  // magasinpips
  const n = c.magSize, pipsW = 150, px0 = ax - pipsW, py = y0 + 58, gap = n > 12 ? 1 : 3, pw2 = (pipsW - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) { ctx.fillStyle = i < c.mag ? (c.bonus.rounds > 0 ? '#ffffff' : C.cyan) : 'rgba(255,255,255,.08)'; ctx.fillRect(px0 + i * (pw2 + gap), py, pw2, n > 12 ? 5 : 6); }
  // granater
  const gx = x0 + pw - 14 - 150, gy = y0 + 19;
  ctx.font = '600 10px system-ui, sans-serif'; ctx.fillStyle = C.dim; ctx.textBaseline = 'middle'; ctx.fillText('G', gx + 78, gy);
  for (let i = 0; i < c.grenadesMax; i++) { const x = gx + 94 + i * 14; ctx.beginPath(); ctx.arc(x, gy, 4.5, 0, TAU); ctx.fillStyle = i < c.grenades ? '#c9a227' : 'rgba(255,255,255,.08)'; ctx.fill(); if (i < c.grenades) { ctx.fillStyle = '#2b2e31'; ctx.fillRect(x - 4.5, gy - 0.8, 9, 1.6); } }
  // bytte-fremdrift
  if (c.switching > 0) { ctx.fillStyle = C.cyan; ctx.fillRect(x0, -2, pw * c.switching, 2); }
  // aktiv reload-bar
  if (c.reloading) {
    const bw = Math.max(pw + 60, 380), bx = -bw / 2, byy = y0 - 30;   // bred og tydelig – ligger over panelet
    ctx.fillStyle = C.panel; ctx.fillRect(bx - 8, byy - 17, bw + 16, 36);
    reloadBar(ctx, c, bx, byy, bw, 12, true);
    ctx.font = '700 11px system-ui, sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = c.jammed ? C.bad : C.dim;
    ctx.fillText(c.jammed ? 'JAMMED' : c.activeTried ? '' : 'RELOADING  ·  PRESS R IN THE WHITE ZONE', bx, byy - 5);
  } else if (c.lastResultT > 0 && c.lastResult) {
    const [t, col] = RESULT[c.lastResult]; ctx.globalAlpha = A * Math.min(1, c.lastResultT * 2);
    ctx.font = '800 13px system-ui, sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, 0, y0 - 10);
  }
  ctx.restore();
}

/** Liten aktiv reload-bar over entity (verdenskoordinater). */
export function drawWorldReloadBar(ctx, world, e) {
  const c = currentOf(e); if (!c) return; const w = 44, h = 4, x = e.x - w / 2, y = e.y - (e.r || 14) - 20;
  ctx.save();
  if (c.reloading) reloadBar(ctx, c, x, y, w, h, false);
  else if (c.lastResult && c.lastResultT > 0) {
    const [t, col] = RESULT[c.lastResult]; ctx.globalAlpha = Math.min(1, c.lastResultT * 2);
    ctx.font = '800 8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(t, e.x + 0.6, y + 4.6); ctx.fillStyle = col; ctx.fillText(t, e.x, y + 4);
  }
  ctx.restore();
}

/** Trådkors som viser faktisk spredning ved musa (verdenskoordinater). */
export function drawReticle(ctx, world, e, mx, my) {
  const c = currentOf(e); if (!c) return;
  const d = Math.hypot(mx - e.x, my - e.y), sp = c.def.pellets > 1 ? (c.def.pelletSpread[c.aiming ? 'aim' : 'hip'] + c.spread) : c.spread;
  const r = Math.max(3, d * Math.tan(sp * Math.PI / 180));
  const steady = c.def.steady && c.steady >= 1 && c.aiming;
  ctx.save(); ctx.lineCap = 'round';
  const col = c.reloading ? 'rgba(160,175,185,.7)' : steady ? '#ffffff' : 'rgba(57,198,255,.95)';
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
  const ticks = () => { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); ctx.lineTo(mx + Math.cos(a) * (r + 5), my + Math.sin(a) * (r + 5)); ctx.stroke(); } };
  ticks(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ticks();
  if (c.def.pellets > 1) { ctx.strokeStyle = 'rgba(57,198,255,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.stroke(); }
  if (c.def.steady && c.aiming) { ctx.strokeStyle = steady ? 'rgba(255,255,255,.9)' : 'rgba(57,198,255,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(mx, my, r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * c.steady); ctx.stroke(); }
  if (c.reloading) { ctx.strokeStyle = c.jammed ? C.bad : C.cyanHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * c.reloadProgress); ctx.stroke(); }
  ctx.fillStyle = col; ctx.fillRect(mx - 0.8, my - 0.8, 1.6, 1.6);
  // presisjon: forventet skade ved denne avstanden (skadefall-rampe × lading) – gjør én-skudd-grensen lesbar
  if (c.def.steady && c.aiming && !c.reloading) {
    const m = getMuzzle(e, Math.atan2(my - e.y, mx - e.x)), dmg = Math.floor(previewDamage(e, Math.hypot(mx - m.x, my - m.y))), lethal = dmg >= 100;   // ≥ 100 = Grunt/spiller-HP
    ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const tx = mx, ty = my + r + 14, label = lethal ? `${dmg} · LETHAL` : String(dmg);
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillText(label, tx + 0.8, ty + 0.8);
    ctx.fillStyle = lethal ? '#ffffff' : 'rgba(159,232,255,.85)'; ctx.fillText(label, tx, ty);
  }
  ctx.restore();
}

/** Forhåndsvisning av kastbane + eksplosjonsradius. */
export function drawGrenadeArc(ctx, world, e, tx, ty) {
  const ang = Math.atan2(ty - e.y, tx - e.x), pw = Math.min(1, Math.hypot(tx - e.x, ty - e.y) / GRENADE.maxThrow);
  const sx = e.x + Math.cos(ang) * ((e.r || 14) + 4), sy = e.y + Math.sin(ang) * ((e.r || 14) + 4);
  const pr = predictGrenade(world, sx, sy, ang, pw);
  ctx.save();
  const v34 = is34(world), L = v34 ? lift(world) : 0.55;   // rev. 6: samme løft som granaten selv
  for (let i = 0; i < pr.pts.length; i++) { const p = pr.pts[i], k = i / pr.pts.length;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, TAU); ctx.fill();
    const hid = v34 && hidden(world, p.x, p.y, p.z);
    ctx.fillStyle = `rgba(201,162,39,${(0.9 - k * 0.4) * (hid ? 0.25 : 1)})`; ctx.beginPath(); ctx.arc(p.x, p.y - p.z * L, 1.8, 0, TAU); ctx.fill(); }
  const ex = pr.end.x, ey = pr.end.y;
  ctx.setLineDash([5, 5]); ctx.lineDashOffset = -world.time * 20; ctx.strokeStyle = 'rgba(255,179,71,.75)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(ex, ey, pr.radius, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,140,40,.07)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,120,.9)'; ctx.beginPath(); ctx.arc(ex, ey, GRENADE.innerRadius, 0, TAU); ctx.stroke();
  ctx.restore();
}
