// BREACH – våpeneffekter (munningsglimt, tracere, hylser, treff, eksplosjon). Bruker core addEffect + world.rng.
// Spiller = kald palett (hvit kjerne → #39c6ff), fiender = varm (hvit → #ffb347 → #ff5a1a).
import { addEffect, projectileZ, AIM_Z_BLEND } from '../core/index.js';
import { TUNING } from './data.js';
import { sy, hidden, fxHidden, is34, visibleRuns } from './view34.js';
/** Høyden kula hadde etter s px flukt (samme formel som core projectileZ). */
function zAt(p, s) {
  if (!Number.isFinite(p.z0)) return p.z ?? projectileZ(p);
  return p.z0 + ((p.zAim ?? p.z0) - p.z0) * Math.min(1, Math.max(0, s) / AIM_Z_BLEND);
}
// Rev. 6 (skråvinkel): alle funksjoner tar valgfri z (verdens-px høyde). Tegnes i (x, y − z·zScale) i 34 og skjules bak høy
// dekning (view34.hidden). Ovenfra er z uten virkning. Gruppeflagg i TUNING.fx (muzzleSecondary, impacts, meleeImpact, explosion).
const sec = () => TUNING.fx?.muzzleSecondary !== false;

const TAU = Math.PI * 2;
const PAL = {
  player: { core: '255,255,255', mid: '190,240,255', edge: '57,198,255', spark: '#bff3ff', spark2: '#39c6ff', light: '80,190,255' },
  enemy: { core: '255,250,230', mid: '255,200,110', edge: '255,110,30', spark: '#ffd08a', spark2: '#ff7a1a', light: '255,150,60' },
};
const pal = (team) => (team === 'enemy' ? PAL.enemy : PAL.player);
const hasDoc = typeof document !== 'undefined';

// ---------- teksturer (lages én gang) ----------
let SMOKE = null, SCORCH = null;
function smokeTex() {
  if (SMOKE || !hasDoc) return SMOKE;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(170,176,182,1)'); r.addColorStop(0.5, 'rgba(130,136,142,.45)'); r.addColorStop(1, 'rgba(110,114,120,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (SMOKE = c);
}
function scorchTex() {
  if (SCORCH || !hasDoc) return SCORCH;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(8,8,8,.85)'); r.addColorStop(0.45, 'rgba(14,13,12,.55)'); r.addColorStop(0.8, 'rgba(20,18,16,.18)'); r.addColorStop(1, 'rgba(20,18,16,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  // radielle sotstriper (deterministisk mønster)
  g.strokeStyle = 'rgba(6,6,6,.35)'; g.lineCap = 'round';
  for (let i = 0; i < 26; i++) { const a = i * 2.39996, l = 30 + ((i * 37) % 28); g.lineWidth = 1 + (i % 3); g.beginPath(); g.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14); g.lineTo(64 + Math.cos(a) * l, 64 + Math.sin(a) * l); g.stroke(); }
  return (SCORCH = c);
}
function fxState(world) { return world._wfx || (world._wfx = { shells: [], decals: [] }); }
function cap(list, n) { while (list.length > n) { const e = list.shift(); e.dead = true; } }

// ---------- munningsglimt ----------
/** style: 'star' (rifle), 'fan' (hagle), 'brake' (presisjon m/ munningsbrems) */
export function muzzleFlash(world, x, y, a, fx = {}, team = 'player', z = 0) {
  const R = world.rng, P = pal(team), sc = (fx.flashSize || 1) * (0.85 + R() * 0.3), len = (fx.flashLen || 18) * (0.85 + R() * 0.3);
  const style = fx.flash || 'star', rot = (R() - 0.5) * 0.5;
  // lys på gulvet
  const lr = fx.light || 90;
  if (sec()) addEffect(world, { x, y, life: style === 'star' ? 0.06 : 0.09, layer: 'under', draw(ctx, w, c, f) {
    const k = 1 - f.t / f.life, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, lr);
    g.addColorStop(0, `rgba(${P.light},${0.32 * k})`); g.addColorStop(0.4, `rgba(${P.light},${0.12 * k})`); g.addColorStop(1, `rgba(${P.light},0)`);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(f.x - lr, f.y - lr, lr * 2, lr * 2); } });
  // selve glimtet
  addEffect(world, { x, y, z, life: style === 'star' ? 0.05 : 0.075, layer: 'over', draw(ctx, w, c, f) {
    if (fxHidden(w, f)) return;
    const k = f.t / f.life, s = sc * (1 - k * 0.35);
    ctx.globalCompositeOperation = 'lighter'; ctx.translate(f.x, sy(w, f.y, f.z)); ctx.rotate(a); ctx.scale(s, s);
    const halo = ctx.createRadialGradient(3, 0, 0, 3, 0, 14);
    halo.addColorStop(0, `rgba(${P.core},${1 - k})`); halo.addColorStop(0.35, `rgba(${P.mid},${0.75 * (1 - k)})`); halo.addColorStop(1, `rgba(${P.edge},0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(3, 0, 14, 0, TAU); ctx.fill();
    const spike = (l, wdt, ang) => {
      ctx.save(); ctx.rotate(ang); const g = ctx.createLinearGradient(0, 0, l, 0);
      g.addColorStop(0, `rgba(${P.core},${1 - k * 0.6})`); g.addColorStop(0.5, `rgba(${P.mid},${0.8 * (1 - k)})`); g.addColorStop(1, `rgba(${P.edge},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -wdt); ctx.quadraticCurveTo(l * 0.45, -wdt * 0.9, l, 0); ctx.quadraticCurveTo(l * 0.45, wdt * 0.9, 0, wdt); ctx.closePath(); ctx.fill(); ctx.restore();
    };
    if (style === 'star') { spike(len, 2.6, rot * 0.2); spike(len * 0.42, 1.8, -0.75 + rot); spike(len * 0.42, 1.8, 0.75 + rot); }
    else if (style === 'fan') { spike(len, 4.5, 0); spike(len * 0.8, 3.2, -0.32 + rot * 0.3); spike(len * 0.8, 3.2, 0.32 + rot * 0.3); spike(len * 0.45, 2.4, -0.9); spike(len * 0.45, 2.4, 0.9); }
    else { spike(len, 2.2, 0); spike(len * 0.55, 2.6, -1.45); spike(len * 0.55, 2.6, 1.45); // munningsbrems: sidestråler
      ctx.fillStyle = `rgba(${P.core},${0.9 * (1 - k)})`; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill(); }
  } });
  // røyk og glør
  if (!sec()) return;
  const nSmoke = fx.smoke ?? (style === 'brake' ? 4 : 1);
  for (let i = 0; i < nSmoke; i++) smoke(world, x + Math.cos(a) * 6, y + Math.sin(a) * 6, a + (R() - 0.5) * (style === 'brake' ? 3.2 : 0.8), 30 + R() * 60, 5 + R() * 4, 0.5 + R() * 0.5, 0.14, 'over', z);
  if (style !== 'star') embers(world, x, y, a, style === 'fan' ? 5 : 3, P, z);
}

function embers(world, x, y, a, n, P, z = 0) {
  const R = world.rng;
  for (let i = 0; i < n; i++) {
    const aa = a + (R() - 0.5) * 0.7, v = 280 + R() * 320;
    addEffect(world, { x, y, z, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.1 + R() * 0.15, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.88; f.vy *= 0.88; },
      draw(ctx, w, c, f) { if (fxHidden(w, f)) return; const k = f.t / f.life, yy = sy(w, f.y, f.z); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${P.mid},${1 - k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, yy); ctx.lineTo(f.x - f.vx * 0.02, yy - f.vy * 0.02); ctx.stroke(); } });
  }
}

/** Myk røykdott. */
export function smoke(world, x, y, a, v, r, life, alpha = 0.18, layer = 'over', z = 0) {
  const R = world.rng;
  addEffect(world, { x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r, gr: r * 2.2, life, al: alpha, rot: R() * TAU, layer,
    update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.exp(-3.5 * dt); f.vx *= k; f.vy *= k; f.r += f.gr * dt; },
    draw(ctx, w, c, f) { const t = smokeTex(); if (!t || (f.z && fxHidden(w, f))) return; const k = f.t / f.life; ctx.globalAlpha = f.al * (1 - k) * Math.min(1, k * 8); ctx.drawImage(t, f.x - f.r, sy(w, f.y, f.z) - f.r, f.r * 2, f.r * 2); } });
}

// ---------- hylser ----------
/** kind: 'brass' | 'hull' (rød haglpatron). Kastes ut til høyre for sikteretningen og spretter. */
export function ejectShell(world, x, y, a, fx = {}, vx0 = 0, vy0 = 0, z0 = 12) {
  const R = world.rng, kind = fx.shell || 'brass', s = fx.shellSize || 1;
  const ea = a + Math.PI / 2 + (R() - 0.5) * 0.7 - 0.3, ev = (kind === 'hull' ? 70 : 100) + R() * 60;
  const e = addEffect(world, {
    x, y, z: z0, vx: Math.cos(ea) * ev + vx0 * 0.6, vy: Math.sin(ea) * ev + vy0 * 0.6, vz: 80 + R() * 70, a: a + R(), va: (R() - 0.5) * 36, rest: false, life: 3.5, layer: 'under', glint: R(),
    update(dt, w, f) { if (f.rest) return; f.vz -= 760 * dt; f.z += f.vz * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt;
      if (f.z < 0) { f.z = 0; f.vz = -f.vz * 0.36; f.vx *= 0.5; f.vy *= 0.5; f.va *= 0.55; if (Math.abs(f.vz) < 16) f.rest = true; } },
    draw(ctx, w, c, f) {
      if (f.z > 4 && fxHidden(w, f)) return;
      ctx.globalAlpha = Math.min(1, (f.life - f.t) * 1.5);
      const L = (kind === 'hull' ? 3.4 : 2.6) * s, W = (kind === 'hull' ? 1.5 : 0.95) * s;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(f.x + f.z * 0.3 + 0.8, f.y + f.z * 0.45 + 0.8, L, W, f.a, 0, TAU); ctx.fill();
      ctx.translate(f.x, is34(w) ? sy(w, f.y, f.z) : f.y - f.z * 0.5); ctx.rotate(f.a);
      if (kind === 'hull') { ctx.fillStyle = '#8e2a22'; ctx.fillRect(-L, -W, L * 1.4, W * 2); ctx.fillStyle = '#c9a24a'; ctx.fillRect(L * 0.4, -W, L * 0.6, W * 2); ctx.fillStyle = 'rgba(255,190,170,.35)'; ctx.fillRect(-L, -W, L * 1.4, W * 0.6); }
      else { ctx.fillStyle = '#9c7a33'; ctx.fillRect(-L, -W, L * 2, W * 2); ctx.fillStyle = '#f0d27a'; ctx.fillRect(-L, -W, L * 2, W * 0.75); ctx.fillStyle = '#5e4718'; ctx.fillRect(L * 0.75, -W, L * 0.25, W * 2); }
      if (!f.rest && f.z > 2) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,160,.5)'; ctx.fillRect(-0.6, -0.6, 1.2, 1.2); }
    },
  });
  const st = fxState(world); st.shells.push(e); cap(st.shells, 90);
}

// ---------- tracere og kuler ----------
const RUNS = [];
/**
 * Våre prosjektiler (p.wfx satt): kule + glødende hale i løpshøyde p.z, skjult bak høy dekning (view34.visibleRuns).
 * Med TUNING.fx.ownBullets tegner vi også selve kula (core drawProjectiles har ingen z, så vi setter p.color gjennomsiktig
 * ved spawn og legger fargen i p.tint). Kalles fra weapons.draw.
 */
export function drawTracers(ctx, world) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const own = TUNING.fx?.ownBullets !== false;
  for (const p of world.projectiles) {
    if (!p.wfx || p.dead) continue;
    const P = pal(p.team), L = Math.min(p.wfx.tracer || 60, Math.hypot(p.x - p.ox, p.y - p.oy));
    if (L < 2) continue;
    // Høyde fra core (projectileZ): munning z0 → siktehøyde PROJ.aimZ over de første AIM_Z_BLEND px. Halen får høyden der den var.
    const z = projectileZ(p), zT = zAt(p, (p.travelled || 0) - L), ux = Math.cos(p.angle), uy = Math.sin(p.angle), tx = p.x - ux * L, ty = p.y - uy * L, wdt = p.wfx.tracerW || 1.5;
    const runs = visibleRuns(world, tx, ty, p.x, p.y, z, 6, RUNS);
    if (!runs.length) continue;
    const headVis = runs[runs.length - 1] === 1;
    const syT = sy(world, ty, zT), syH = sy(world, p.y, z), dy = syH - syT;
    const seg = (t0, t1) => { ctx.beginPath(); ctx.moveTo(tx + (p.x - tx) * t0, syT + dy * t0); ctx.lineTo(tx + (p.x - tx) * t1, syT + dy * t1); ctx.stroke(); };
    let g = ctx.createLinearGradient(tx, syT, p.x, syH);
    g.addColorStop(0, `rgba(${P.edge},0)`); g.addColorStop(0.7, `rgba(${P.edge},0.22)`); g.addColorStop(1, `rgba(${P.mid},0.55)`);
    ctx.strokeStyle = g; ctx.lineWidth = wdt * 3.2; for (let i = 0; i < runs.length; i += 2) seg(runs[i], runs[i + 1]);
    g = ctx.createLinearGradient(tx, syT, p.x, syH); g.addColorStop(0, `rgba(${P.mid},0)`); g.addColorStop(1, `rgba(${P.core},0.95)`);
    ctx.strokeStyle = g; ctx.lineWidth = wdt; for (let i = 0; i < runs.length; i += 2) seg(Math.max(0.4, runs[i]), Math.max(0.4, runs[i + 1]));
    if (own && p.tint) {   // selve kula (samme form som core: kort gradientstrek 0,018 s bak)
      const bx = p.x - p.vx * 0.018, by = sy(world, p.y - p.vy * 0.018, zAt(p, (p.travelled || 0) - (p.speed || 0) * 0.018));
      if (headVis) { const gb = ctx.createLinearGradient(bx, by, p.x, syH); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, p.tint);
        ctx.strokeStyle = gb; ctx.lineWidth = (p.radius || 2) * 1.6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(p.x, syH); ctx.stroke(); }
    }
    if (headVis) { ctx.fillStyle = `rgba(${P.core},0.9)`; ctx.beginPath(); ctx.arc(p.x, syH, wdt * 0.9, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

/** Svinnende stråle fra munning til treffpunkt (presisjonsrifla). */
export function beam(world, x0, y0, x1, y1, life = 0.45, team = 'player', width = 2.4, z = 0, z1 = z) {
  // z = høyde ved munningen, z1 = høyde ved treffet (core: siktehøyde etter de første 60 px). Okklusjon regnes med z1.
  const P = pal(team), runs = visibleRuns(world, x0, y0, x1, y1, z1, 16, []).slice();   // dekning står stille: regn én gang
  const Y0 = sy(world, y0, z), Y1 = sy(world, y1, z1);
  addEffect(world, { x: x0, y: y0, life, layer: 'over', draw(ctx, w, c, f) {
    const k = f.t / f.life, a = (1 - k) * (1 - k);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    if (runs.length !== 2 || runs[0] !== 0 || runs[1] !== 1) {   // delvis skjult: klipp til de synlige stykkene
      ctx.beginPath(); const pad = width * 8;
      for (let i = 0; i < runs.length; i += 2) { const ax = x0 + (x1 - x0) * runs[i], ay = Y0 + (Y1 - Y0) * runs[i], bx = x0 + (x1 - x0) * runs[i + 1], by = Y0 + (Y1 - Y0) * runs[i + 1];
        ctx.rect(Math.min(ax, bx) - pad, Math.min(ay, by) - pad, Math.abs(bx - ax) + pad * 2, Math.abs(by - ay) + pad * 2); }
      if (!runs.length) return; ctx.clip();
    }
    const g = ctx.createLinearGradient(x0, Y0, x1, Y1); g.addColorStop(0, `rgba(${P.edge},${0.05 * a})`); g.addColorStop(0.6, `rgba(${P.edge},${0.35 * a})`); g.addColorStop(1, `rgba(${P.mid},${0.6 * a})`);
    ctx.strokeStyle = g; ctx.lineWidth = width * (2.5 + k * 4); ctx.beginPath(); ctx.moveTo(x0, Y0); ctx.lineTo(x1, Y1); ctx.stroke();
    ctx.strokeStyle = `rgba(${P.core},${0.8 * a})`; ctx.lineWidth = Math.max(0.5, width * 0.5 * (1 - k)); ctx.beginPath(); ctx.moveTo(x0, Y0); ctx.lineTo(x1, Y1); ctx.stroke();
  } });
  // spiralrøyk langs strålen
  const R = world.rng, L = Math.hypot(x1 - x0, y1 - y0), n = Math.min(10, Math.floor(L / 70));
  for (let i = 1; i <= n; i++) { const t = i / (n + 1); smoke(world, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, R() * TAU, 8, 3 + R() * 2, 0.7 + R() * 0.4, 0.07, 'over', z); }
}

// ---------- treff ----------
/** Treff mot dekning. material: 'metal' | 'concrete'. power ~ 0.5–1.6. team = skytterens lag. */
export function impactCover(world, x, y, angle, material = 'concrete', power = 1, team = 'player', partial = false, z = 0) {
  const R = world.rng, back = angle + Math.PI, metal = material === 'metal';
  const nSp = Math.round((metal ? 7 : 3) * power);
  for (let i = 0; i < nSp; i++) {
    const a = back + (R() - 0.5) * 2.2, v = (metal ? 180 : 120) + R() * 260 * power;
    addEffect(world, { x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.12 + R() * 0.22, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.exp(-7 * dt); f.vx *= k; f.vy *= k; },
      draw(ctx, w, c, f) { if (fxHidden(w, f)) return; const k = f.t / f.life; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.translate(0, sy(w, 0, f.z));
        ctx.strokeStyle = metal ? `rgba(255,${(235 - k * 110) | 0},${(170 - k * 120) | 0},${1 - k})` : `rgba(255,214,160,${0.8 * (1 - k)})`;
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.022, f.y - f.vy * 0.022); ctx.stroke(); } });
  }
  // blink i treffpunktet
  addEffect(world, { x, y, z, life: 0.07, layer: 'over', draw(ctx, w, c, f) {
    if (fxHidden(w, f)) return; ctx.translate(0, sy(w, 0, f.z));
    const k = f.t / f.life, r = (metal ? 9 : 6) * power * (1 - k * 0.5), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,250,235,${1 - k})`); g.addColorStop(0.4, metal ? `rgba(255,190,110,${0.6 * (1 - k)})` : `rgba(230,220,200,${0.5 * (1 - k)})`); g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill(); } });
  // støv/fliser for betong, litt røyk for metall
  const nPuff = Math.round((metal ? 1 : 3) * Math.min(1.5, power));
  for (let i = 0; i < nPuff; i++) smoke(world, x, y, back + (R() - 0.5) * 1.4, 40 + R() * 70, 3 + R() * 3, 0.45 + R() * 0.4, metal ? 0.1 : 0.22, 'over', z);
  if (!metal) chips(world, x, y, back, Math.round(3 * power), z);
  // merke på bakken bare ovenfra: i 34 sitter treffet på dekningens front/side i høyde z, ikke på gulvet
  if (!partial && !is34(world)) decal(world, x, y, metal ? 1.6 : 2.2, metal ? 'rgba(18,16,14,.75)' : 'rgba(20,20,20,.6)');
}

function chips(world, x, y, dir, n, z0 = 6) {
  const R = world.rng;
  for (let i = 0; i < n; i++) {
    const a = dir + (R() - 0.5) * 2, v = 60 + R() * 120;
    addEffect(world, { x, y, z: Math.max(6, z0), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 50 + R() * 80, s: 0.8 + R() * 1.1, life: 1.6, layer: 'under',
      update(dt, w, f) { if (f.z <= 0 && Math.abs(f.vz) < 10) return; f.vz -= 600 * dt; f.z += f.vz * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.z < 0) { f.z = 0; f.vz = -f.vz * 0.3; f.vx *= 0.4; f.vy *= 0.4; } },
      draw(ctx, w, c, f) { if (f.z > 4 && fxHidden(w, f)) return; ctx.globalAlpha = Math.min(1, (f.life - f.t) * 2); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(f.x + f.z * 0.3, f.y + f.z * 0.45, f.s, f.s); ctx.fillStyle = '#7a7d80'; ctx.fillRect(f.x, is34(w) ? sy(w, f.y, f.z) : f.y - f.z * 0.3, f.s, f.s); } });
  }
}

function decal(world, x, y, r, color) {
  const e = addEffect(world, { x, y, life: 8, layer: 'under', draw(ctx, w, c, f) { ctx.globalAlpha = Math.min(1, (f.life - f.t) / 2); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill(); } });
  const st = fxState(world); st.decals.push(e); cap(st.decals, 120);
}

/** Treff på kropp. targetTeam bestemmer palett: fiende = blod (bodyBlood) + varme gnister, spiller = cyan skjoldgnister. */
export function impactBody(world, x, y, angle, power = 1, targetTeam = 'enemy', z = 0) {
  const R = world.rng, enemy = targetTeam === 'enemy';
  if (enemy) { if (TUNING.fx?.blood !== false) bodyBlood(world, x, y, angle, power, z); }
  else for (let i = 0, n = Math.round(6 * power); i < n; i++) {
    const a = angle + (R() - 0.5) * 1.3, v = 90 + R() * 200 * power;
    addEffect(world, { x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.22 + R() * 0.25, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.exp(-8 * dt); f.vx *= k; f.vy *= k; },
      draw(ctx, w, c, f) { if (fxHidden(w, f)) return; ctx.translate(0, sy(w, 0, f.z)); const k = f.t / f.life;
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(150,230,255,${1 - k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.02, f.y - f.vy * 0.02); ctx.stroke(); } });
  }
  // varme gnister fra rustning (fiende) – få, raske
  if (enemy) for (let i = 0; i < Math.round(2 * power); i++) { const a = angle + Math.PI + (R() - 0.5) * 2.4, v = 200 + R() * 200;
    addEffect(world, { x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.1 + R() * 0.1, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; },
      draw(ctx, w, c, f) { if (fxHidden(w, f)) return; ctx.translate(0, sy(w, 0, f.z)); const k = f.t / f.life; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,200,120,${1 - k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.025, f.y - f.vy * 0.025); ctx.stroke(); } }); }
  addEffect(world, { x, y, z, life: 0.08, layer: 'over', draw(ctx, w, c, f) {
    if (fxHidden(w, f)) return; ctx.translate(0, sy(w, 0, f.z));
    const k = f.t / f.life, r = 10 * power; ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = enemy ? `rgba(255,230,200,${0.9 * (1 - k)})` : `rgba(160,235,255,${0.9 * (1 - k)})`; ctx.lineWidth = 1.5 * (1 - k);
    ctx.beginPath(); ctx.arc(f.x, f.y, 3 + r * k, 0, TAU); ctx.stroke(); } });
}

// ---------- BLOD (isolert, rev. 6) ----------
// VFX eier blod/kitin og sender en diff som fjerner denne funksjonen. Alt rødt blod fra Våpen ligger HER og bare her:
// slett funksjonen + kallet i impactBody (eller sett TUNING.fx.blood = false).
export function bodyBlood(world, x, y, angle, power = 1, z = 0) {
  const R = world.rng;
  for (let i = 0, n = Math.round(6 * power); i < n; i++) {
    const a = angle + (R() - 0.5) * 1.3, v = 90 + R() * 200 * power;
    addEffect(world, { x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 0.9 + R() * 1.4, life: 0.22 + R() * 0.25, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.exp(-8 * dt); f.vx *= k; f.vy *= k; },
      draw(ctx, w, c, f) { if (fxHidden(w, f)) return; ctx.translate(0, sy(w, 0, f.z)); const k = f.t / f.life;
        ctx.fillStyle = `rgba(${(120 + 60 * (1 - k)) | 0},18,14,${0.9 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.s * (1 - k * 0.4), 0, TAU); ctx.fill(); } });
  }
  if (R() < 0.6 * power) decal(world, x + Math.cos(angle) * (6 + R() * 10), y + Math.sin(angle) * (6 + R() * 10), 1.2 + R() * 1.6, 'rgba(70,10,8,.55)');
}
// ---------- /BLOD ----------

// ---------- eksplosjon ----------
export function explosion(world, x, y, radius) {
  const R = world.rng;
  // lysblink på gulvet
  addEffect(world, { x, y, life: 0.35, layer: 'under', draw(ctx, w, c, f) {
    const k = f.t / f.life, r = radius * 2.4, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,190,110,${0.55 * (1 - k) * (1 - k)})`); g.addColorStop(0.35, `rgba(255,120,40,${0.25 * (1 - k)})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2); } });
  // svidd flekk
  const e = addEffect(world, { x, y, life: 14, layer: 'under', rot: R() * TAU, draw(ctx, w, c, f) { const t = scorchTex(); if (!t) return; ctx.globalAlpha = Math.min(1, (f.life - f.t) / 3) * Math.min(1, f.t * 10); ctx.translate(f.x, f.y); ctx.rotate(f.rot); const r = radius * 0.75; ctx.drawImage(t, -r, -r, r * 2, r * 2); } });
  fxState(world).decals.push(e);
  // ildkule
  addEffect(world, { x, y, life: 0.32, layer: 'over', draw(ctx, w, c, f) {
    const k = f.t / f.life, r = radius * (0.35 + 0.45 * Math.sqrt(k)), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, `rgba(255,255,240,${1 - k})`); g.addColorStop(0.3, `rgba(255,210,120,${0.95 * (1 - k)})`); g.addColorStop(0.7, `rgba(255,110,30,${0.6 * (1 - k)})`); g.addColorStop(1, 'rgba(160,40,10,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill(); } });
  // sjokkbølge
  addEffect(world, { x, y, life: 0.28, layer: 'over', draw(ctx, w, c, f) {
    const k = f.t / f.life, r = radius * (0.2 + 1.0 * (1 - (1 - k) * (1 - k)));
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,225,180,${0.5 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke(); } });
  // flammetunger + røyk
  for (let i = 0; i < 9; i++) { const a = R() * TAU, v = 60 + R() * 140;
    addEffect(world, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 8 + R() * 8, life: 0.25 + R() * 0.2, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy *= 0.9; },
      draw(ctx, w, c, f) { const k = f.t / f.life, r = f.r * (1 + k), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); g.addColorStop(0, `rgba(255,190,90,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(200,60,10,0)'); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill(); } }); }
  for (let i = 0; i < 12; i++) smoke(world, x + (R() - 0.5) * radius * 0.5, y + (R() - 0.5) * radius * 0.5, R() * TAU, 30 + R() * 90, 12 + R() * 10, 1.4 + R() * 1.2, 0.32);
  for (let i = 0; i < 22; i++) { const a = R() * TAU, v = 250 + R() * 450;
    addEffect(world, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + R() * 0.45, layer: 'over',
      update(dt, w, f) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.exp(-4 * dt); f.vx *= k; f.vy *= k; },
      draw(ctx, w, c, f) { const k = f.t / f.life; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,${(220 - 120 * k) | 0},${(140 - 110 * k) | 0},${1 - k})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.03, f.y - f.vy * 0.03); ctx.stroke(); } }); }
  chips(world, x, y, 0, 0);
}
