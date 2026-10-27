// Tegning av fiender, granater og varsler. KUN lesing: alt hentes fra poseOf(world, e) (se pose.js)
// og grenadeState(world). Ingen AI-felt skrives her, så tegningen kan flyttes til Karakters delte rigg
// (src/shared/rig) ved å bytte ut drawBody/drawCorpse med riggens funksjoner som tar samme pose.
// Tegnes i verdenskoordinater (loopen har satt kamera-transform).
import { raycastCover } from '../core/index.js';
import { poseOf } from './pose.js';
import { grenadeState } from './grenades.js';
import { PROJ } from '../shared/projection.js';
import { spawnState, arenaHandlesSpawnWarn } from './spawn.js';
import { drawWithArt } from './art.js';

const TAU = Math.PI * 2;

export function drawEnemies(ctx, world, camera) {
  const list = world.enemies.filter((e) => e.def);
  const poses = list.map((e) => poseOf(world, e));
  const live = poses.filter((P) => !P.dead);
  ctx.save();
  for (const P of poses) if (P.dead && !drawWithArt(ctx, P, artInfo(world, camera, P, 'corpse', list.find((e) => e.id === P.id)))) drawCorpse(ctx, P);
  drawGrenadeMarkers(ctx, world, live);
  if (!arenaHandlesSpawnWarn(world)) drawSpawnWarnings(ctx, world);
  for (const P of live) drawTelegraph(ctx, world, P);
  for (const P of live) drawMeleeWarning(ctx, world, P);
  // Trekvart med dybdesortering (loop setter world.depthSorted): kroppene tegnes av drawSorted via drawActor,
  // her tegnes bare varsler/tillegg. Sjekker world.depthSorted, ikke world.view (CORE-API «Innkobling i loop.js»).
  if (!world.depthSorted) for (const P of live) if (!drawWithArt(ctx, P, artInfo(world, camera, P, 'body', list.find((e) => e.id === P.id)))) drawBody(ctx, world, P);
  drawGrenades(ctx, world);
  const is34 = world.view === '34';
  for (const P of live) {
    const lift = is34 ? actorLift(P) : 0;   // over hodet i trekvart: løft med aktørhøyden
    if (lift) { ctx.save(); ctx.translate(0, -lift); drawOverhead(ctx, world, P); ctx.restore(); } else drawOverhead(ctx, world, P);
  }
  drawFlankWarning(ctx, world, live);
  if (world.debug) for (const P of poses) drawDebug(ctx, world, P);
  ctx.restore();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---------------------------------------------------------------- telegraf (laser/oppspinning)
function drawTelegraph(ctx, world, P) {
  const T = P.telegraph;
  if (!T && !P.firing) return;
  if (P.firing && P.type === 'heavy') return drawHeavyStream(ctx, world, P);
  const k = T ? T.progress : 1;
  let m = P.muzzle;
  const L = 760;
  let ex = m.x + Math.cos(P.aim) * L, ey = m.y + Math.sin(P.aim) * L;
  const hit = raycastCover(world, m.x, m.y, ex, ey);
  if (hit) { ex = hit.x; ey = hit.y; }
  const p = world.player;
  if (p && !p.dead) {
    const dx = ex - m.x, dy = ey - m.y, l2 = dx * dx + dy * dy;
    const t = ((p.x - m.x) * dx + (p.y - m.y) * dy) / l2;
    if (t > 0 && t < 1 && Math.hypot(m.x + dx * t - p.x, m.y + dy * t - p.y) < p.r) { ex = m.x + dx * t; ey = m.y + dy * t; }
  }
  const flank = T?.flank, spin = T?.spinup;
  // Trekvart: samme høyder som skuddene – fra løpshøyden (P.muzzleZ) mot spillerens bryst (PROJ.aimHeight), kun visuelt.
  // Logikken (raycast, endepunkt) er i bakkeplanet; bare tegningen løftes med z · zScale.
  const z34 = world.view === '34';
  if (z34) {
    const mz = P.muzzleZ ?? 0, aimZ = PROJ.aimHeight, zs = PROJ.zScale;
    const dP = p && !p.dead ? Math.hypot(p.x - m.x, p.y - m.y) : 0, len = Math.hypot(ex - m.x, ey - m.y);
    const ze = dP > 1 ? Math.max(2, mz + (aimZ - mz) * (len / dP)) : mz;
    m = { x: m.x, y: m.y - mz * zs }; ey -= ze * zs;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const pulse = 0.5 + 0.5 * Math.sin(world.time * (flank ? 26 : 40));
  const a = T ? 0.12 + 0.55 * k : 0.18;
  ctx.strokeStyle = flank ? `rgba(255,40,40,${a * 0.5})` : spin ? `rgba(255,140,30,${a * 0.35})` : `rgba(255,60,30,${a * 0.35})`;
  ctx.lineWidth = flank ? 10 : spin ? 9 + 6 * k : 7;
  ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = flank ? `rgba(255,${60 + 60 * k | 0},60,${Math.min(1, a + 0.25)})` : `rgba(255,${90 + 80 * k | 0},60,${Math.min(1, a + 0.15)})`;
  ctx.lineWidth = flank ? 2.2 : 1.4;
  if (T && k < 0.6) { ctx.setLineDash(flank ? [6, 5] : [10, 7]); ctx.lineDashOffset = -world.time * 120; }
  ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = `rgba(255,120,80,${0.4 + 0.5 * k})`;
  ctx.beginPath(); ctx.arc(ex, ey, 2.5 + k * (flank ? 4 : 2) * pulse, 0, TAU); ctx.fill();
  if (T) {
    const R = 6 + (spin ? 20 : 14) * k;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, R);
    g.addColorStop(0, `rgba(255,${spin ? 220 : 200},140,${0.5 + 0.5 * k})`);
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = flank ? `rgba(255,50,40,${0.4 + 0.6 * k})` : `rgba(255,90,50,${0.25 + 0.6 * k})`;
    ctx.lineWidth = flank ? 3 : 2;
    ctx.beginPath(); ctx.arc(P.x, P.y, P.r + 5 + (1 - k) * (flank ? 22 : 16), 0, TAU); ctx.stroke();
    if (spin) { // oppspinning: roterende segmenter rundt Heavy (synlig «motorlyd»)
      ctx.strokeStyle = `rgba(255,170,60,${0.35 + 0.5 * k})`; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a0 = P.spinPhase * 0.5 + (i * TAU) / 3;
        ctx.beginPath(); ctx.arc(P.x, P.y, P.r + 12, a0, a0 + 0.6 + 0.6 * k); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Nærkampvarsel (spillmekanikk): rød kile i slagretningen som fylles under oppladningen + krympende ring. */
function drawMeleeWarning(ctx, world, P) {
  const M = P.melee;
  if (P.stagger) { // stagger-markør: gule tagger over hodet
    ctx.save(); ctx.strokeStyle = `rgba(255,220,90,${1 - P.stagger.progress})`; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = world.time * 6 + (i * TAU) / 3; ctx.beginPath(); ctx.arc(P.x + Math.cos(a) * 9, P.y - P.r - 10 + Math.sin(a) * 3, 2.2, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  if (!M || M.phase === 'recover') return;
  const reach = 41.6 + 15, half = (100 * Math.PI) / 360, k = M.phase === 'charge' ? M.progress : M.phase === 'strike' ? 1 : 0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,40,30,${M.phase !== 'rush' ? 0.18 + 0.4 * k : 0.12})`;
  ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.arc(P.x, P.y, reach * (M.phase !== 'rush' ? 0.35 + 0.65 * k : 0.35), P.aim - half, P.aim + half); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(255,70,50,${0.5 + 0.5 * k})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(P.x, P.y, reach, P.aim - half, P.aim + half); ctx.stroke();
  if (M.phase === 'charge') { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P.x, P.y, P.r + 4 + 20 * (1 - k), 0, TAU); ctx.stroke(); }
  ctx.restore();
}

/** Heavy under vedvarende ild: svak kjegle som viser hvor strålen sveiper, rød ved sperreild. */
function drawHeavyStream(ctx, world, P) {
  const m = P.muzzle, L = Math.max(40, Math.min(520, P.streamLen || 520)), half = 0.13;
  ctx.save();
  if (world.view === '34') ctx.translate(0, -(P.muzzleZ ?? 0) * PROJ.zScale);   // kjeglen i løpshøyde (som skuddene)
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, L);
  const col = P.fireMode === 'suppress' ? '255,70,40' : '255,150,50';
  g.addColorStop(0, `rgba(${col},0.22)`); g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.arc(m.x, m.y, L, P.aim - half, P.aim + half); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- kropp
/** info til registrerte tegnere (art.js / RENDER.md). */
function artInfo(world, camera, P, layer, enemy) {
  const view = world.view === '34' ? '34' : 'top';
  return { world, camera, view, layer, proj: PROJ, lift: view === '34' ? actorLift(P) : 0, enemy: enemy || null };
}

function drawBody(ctx, world, P, o) {
  const r = P.r, C = P.colors;
  const s = 1 - 0.13 * P.crouch + (P.popUp ? 0.04 : 0);
  ctx.save();
  if (!o?.noShadow) {
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(P.x + 3, P.y + 5, r * 1.15 * s, r * 0.95 * s, 0, 0, TAU); ctx.fill();
  }
  if (!P.duckedLow) {   // 27.10: ingen fot-/målring når helt dukket bak lavt cover (telegrafringen tegnes fortsatt)
  ctx.strokeStyle = P.type === 'heavy' ? 'rgba(255,140,40,0.45)' : P.type === 'grenadier' ? 'rgba(180,120,255,0.45)' : 'rgba(255,80,50,0.38)';
  ctx.lineWidth = P.type === 'heavy' ? 2 : 1.5;
  ctx.beginPath(); ctx.ellipse(P.x, P.y + 2, r * 1.28 * s, r * 1.18 * s, 0, 0, TAU); ctx.stroke();
  }
  ctx.translate(P.x, P.y);
  if (P.stagger) { // kort rykk bakover + vugg (kun tegning, avledet av tilstanden)
    const j = (1 - P.stagger.progress);
    ctx.translate(-Math.cos(P.facing) * 5 * j, -Math.sin(P.facing) * 5 * j);
    ctx.rotate(Math.sin(P.stagger.progress * 28) * 0.22 * j);
  }
  ctx.rotate(P.facing);
  ctx.scale(s, s);

  if (P.moving) {
    const ph = Math.sin(P.walkPhase) * r * 0.42;
    ctx.fillStyle = '#121314';
    ctx.beginPath(); ctx.ellipse(ph, -r * 0.42, r * 0.32, r * 0.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-ph, r * 0.42, r * 0.32, r * 0.2, 0, 0, TAU); ctx.fill();
  }

  if (P.type === 'flanker') drawCape(ctx, P, r);
  else if (P.type === 'heavy') drawAmmoPack(ctx, P, r);
  else {
    ctx.fillStyle = '#1c1e20';
    roundRect(ctx, -r * 0.95, -r * 0.5, r * 0.55, r * 1.0, 3); ctx.fill();
    ctx.fillStyle = C.dark;
    ctx.fillRect(-r * 0.88, -r * 0.12, r * 0.4, r * 0.24);
    if (P.type === 'grenadier') { // granatbelte på ryggen
      for (let i = -1; i <= 1; i++) { ctx.fillStyle = '#2b2236'; ctx.beginPath(); ctx.arc(-r * 0.7, i * r * 0.32, r * 0.16, 0, TAU); ctx.fill(); ctx.fillStyle = C.accent; ctx.fillRect(-r * 0.72, i * r * 0.32 - 1, 3, 2); }
    }
  }

  // torso
  const g = ctx.createRadialGradient(r * 0.15, -r * 0.2, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, shade(C.main, 0.25)); g.addColorStop(0.6, C.main); g.addColorStop(1, shade(C.main, -0.45));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, r * (P.type === 'heavy' ? 0.72 : 0.62), r * 0.98, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = shade(C.main, -0.55); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.6); ctx.quadraticCurveTo(r * 0.62, 0, r * 0.35, r * 0.6); ctx.stroke();
  if (P.type === 'heavy') { // panserplater
    ctx.fillStyle = shade(C.dark, -0.2);
    for (const sy of [-0.45, 0.45]) { roundRect(ctx, -r * 0.35, sy * r - r * 0.14, r * 0.55, r * 0.28, 2); ctx.fill(); }
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-r * 0.3, -1, r * 0.45, 2);
  }

  // skulderputer: grå plassholder-plater med typefarge som stripe (utseendet er fryst)
  for (const side of [-1, 1]) {
    const big = P.type === 'heavy' ? 1.35 : 1, W = P.plating;
    ctx.fillStyle = P.type === 'flanker' ? shade(W.plate, -0.25) : W.plate;
    ctx.beginPath(); ctx.ellipse(-r * 0.05, side * r * 0.8, r * 0.38 * big, r * 0.3 * big, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = W.trim; ctx.fillRect(-r * 0.25 * big, side * r * 0.8 - 1.2, r * 0.42 * big, 2.4);
  }

  // våpen + hender
  let wl = r * 1.55;
  if (P.type === 'flanker') wl = r * 1.25;
  if (P.type === 'heavy') wl = drawMinigun(ctx, P, r);
  else if (P.type === 'grenadier' && P.throw) drawThrowArm(ctx, P, r);
  if (P.type !== 'heavy') {
    ctx.fillStyle = '#16181a';
    roundRect(ctx, r * 0.05, 1.5, wl, 5.5, 1.5); ctx.fill();
    ctx.fillStyle = '#3d4246';
    ctx.fillRect(r * 0.25, 2.5, wl * 0.55, 1.5);
    if (P.type === 'grunt') { ctx.fillStyle = '#16181a'; ctx.fillRect(r * 0.55, 6.5, 4, 5); }
    if (P.type === 'grenadier') { ctx.fillStyle = '#2b2236'; ctx.beginPath(); ctx.arc(r * 0.75, 4.2, 4.2, 0, TAU); ctx.fill(); } // tromme
    ctx.fillStyle = shade(C.main, -0.5);
    ctx.beginPath(); ctx.arc(r * 0.35, 4.5, 3.4, 0, TAU); ctx.fill();
    if (!(P.throw && P.throw.phase === 'windup')) { ctx.beginPath(); ctx.arc(r * 0.95, 3.5, 3.1, 0, TAU); ctx.fill(); }
  }

  if (P.type === 'flanker') drawHood(ctx, P, r);
  else drawHelmet(ctx, P, r);

  if (P.hurt > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${P.hurt * 0.5})`;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r * 1.0, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // munningsglimt: tegnes av Våpen (flamme) og Effekter (lys/røyk) ved weaponFire
  ctx.restore();
}

function drawAmmoPack(ctx, P, r) {
  ctx.fillStyle = '#1c1e20';
  roundRect(ctx, -r * 1.05, -r * 0.62, r * 0.62, r * 1.24, 4); ctx.fill();
  ctx.fillStyle = P.colors.dark; ctx.fillRect(-r * 0.98, -r * 0.5, r * 0.48, r * 0.3);
  // patronbelte fra sekken til våpenet
  ctx.strokeStyle = '#b38a2e'; ctx.lineWidth = 3; ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.5); ctx.quadraticCurveTo(-r * 0.1, r * 1.0, r * 0.45, r * 0.42); ctx.stroke();
  ctx.setLineDash([]);
}

/** Minigun med seks løp som roterer med P.spinPhase. Returnerer lengde (for munningsflamme). */
function drawMinigun(ctx, P, r) {
  const len = r * 1.6, y0 = 2;
  ctx.fillStyle = '#16181a';
  roundRect(ctx, r * 0.1, y0 - 5, r * 0.6, 10, 2); ctx.fill();         // hus
  ctx.fillStyle = '#2a2d30';
  roundRect(ctx, r * 0.6, y0 - 4.5, len - r * 0.5, 9, 2); ctx.fill();   // løpsbunt
  for (let i = 0; i < 6; i++) {                                         // løp (projisert rotasjon)
    const a = P.spinPhase + (i * TAU) / 6, oy = Math.sin(a) * 3.3, lit = Math.cos(a);
    ctx.strokeStyle = lit > 0 ? '#5d646a' : '#24272a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(r * 0.7, y0 + oy); ctx.lineTo(r * 0.1 + len, y0 + oy); ctx.stroke();
  }
  ctx.fillStyle = '#3d4246'; ctx.fillRect(r * 0.1 + len - 3, y0 - 5, 3, 10);  // munningsring
  if (P.spin > 0.02) { // glødende løpstupper (varsel under oppspinning)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(r * 0.1 + len, y0, 0, r * 0.1 + len, y0, 7 + 9 * P.spin);
    gg.addColorStop(0, `rgba(255,190,90,${0.35 + 0.6 * P.spin})`); gg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(r * 0.1 + len, y0, 7 + 9 * P.spin, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = shade(P.colors.main, -0.5);
  ctx.beginPath(); ctx.arc(r * 0.3, y0 + 5, 3.8, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.75, y0 - 5, 3.6, 0, TAU); ctx.fill();
  return len + r * 0.1 - r * 0.05;
}

/** Grenadier: armen trekkes bakover med glødende granat (windup), slenges frem ved slipp. */
function drawThrowArm(ctx, P, r) {
  const T = P.throw;
  const k = T.phase === 'windup' ? T.progress : 1 - T.progress;
  const back = T.phase === 'windup' ? k : 0;
  const hx = r * (0.6 - 1.5 * back), hy = -r * (0.9 + 0.2 * back);
  ctx.strokeStyle = shade(P.colors.main, -0.35); ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(hx, hy); ctx.stroke();
  if (T.phase === 'windup') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + 0.4 * Math.sin(T.progress * 30);
    const gg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10);
    gg.addColorStop(0, `rgba(215,184,255,${0.8 * pulse})`); gg.addColorStop(1, 'rgba(155,89,255,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(hx, hy, 10, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2b2236'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd08a'; ctx.fillRect(hx - 1, hy - 1, 2, 2);
  }
}

/** Plassholder-hode (gunmetal) med rødoransje «øye»; glitch = kort cyan blaff. Fryst plassholder. */
function drawHelmet(ctx, P, r) {
  const W = P.plating;
  const hr = P.type === 'heavy' ? 0.5 : 0.46;
  ctx.fillStyle = '#16191b';
  ctx.beginPath(); ctx.arc(r * 0.08, 0, r * hr, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(r * 0.05, -r * 0.15, 1, r * 0.08, 0, r * hr);
  hg.addColorStop(0, shade(W.plate, 0.15)); hg.addColorStop(1, shade(W.plate, -0.6));
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(r * 0.04, 0, r * (hr - 0.04), 0, TAU); ctx.fill();
  ctx.fillStyle = W.trim; ctx.fillRect(-r * 0.32, -1, r * 0.3, 2);           // typestripe over hjelmen
  drawVisor(ctx, P, r, P.type === 'heavy' ? 'slit' : 'arc');
}

function drawVisor(ctx, P, r, shape) {
  const W = P.plating, hot = !!P.telegraph || P.firing || !!P.throw || P.flanking;
  const col = W.glitch > 0 ? '#39c6ff' : hot ? '#ffd27a' : W.visor;   // cyan = kort glitch-blaff
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = P.type === 'heavy' ? 3 : 2.4; ctx.lineCap = 'round';
  ctx.beginPath();
  if (shape === 'slit') { ctx.moveTo(r * 0.3, -r * 0.2); ctx.lineTo(r * 0.3, r * 0.2); }
  else if (shape === 'eyes') { ctx.moveTo(r * 0.34, -r * 0.16); ctx.lineTo(r * 0.38, -r * 0.05); ctx.moveTo(r * 0.34, r * 0.16); ctx.lineTo(r * 0.38, r * 0.05); }
  else ctx.arc(r * 0.04, 0, r * 0.3, -0.75, 0.75);
  ctx.stroke();
  // glød uten shadowBlur: samme sti, bredere og svakt, additivt (lighter er satt over)
  const lw = ctx.lineWidth; ctx.strokeStyle = W.glitch > 0 ? '#39c6ff' : W.visor;
  ctx.globalAlpha *= hot ? 0.3 : 0.2; ctx.lineWidth = lw * (hot ? 3.2 : 2.4); ctx.stroke();
  ctx.globalAlpha *= 0.6; ctx.lineWidth = lw * (hot ? 5.4 : 4); ctx.stroke();
  ctx.restore();
}

function drawHood(ctx, P, r) {
  const C = P.colors;
  const hg = ctx.createLinearGradient(r * 0.5, 0, -r * 0.9, 0);
  hg.addColorStop(0, shade(C.main, 0.12)); hg.addColorStop(1, shade(C.main, -0.55));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(r * 0.5, 0);
  ctx.bezierCurveTo(r * 0.5, -r * 0.55, -r * 0.3, -r * 0.6, -r * 0.95, 0);
  ctx.bezierCurveTo(-r * 0.3, r * 0.6, r * 0.5, r * 0.55, r * 0.5, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#0d0607';
  ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * 0.2, r * 0.3, 0, 0, TAU); ctx.fill();
  drawVisor(ctx, P, r, 'eyes');
}

function drawCape(ctx, P, r) {
  const sway = Math.sin(P.walkPhase) * (P.moving ? r * 0.18 : 0.04 * r);
  const trail = P.moving ? r * 1.55 : r * 1.15;
  ctx.fillStyle = shade(P.colors.main, -0.4);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.92);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.95, -trail, -r * 0.45 + sway);
  ctx.lineTo(-trail * 0.92, sway);
  ctx.lineTo(-trail, r * 0.45 + sway);
  ctx.quadraticCurveTo(-r * 0.9, r * 0.95, -r * 0.1, r * 0.92);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
}

function drawCorpse(ctx, P) {
  const r = P.r, C = P.colors;
  const a = Math.max(0, Math.min(1, (10 - P.corpseT) / 2.5));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(60,8,6,0.55)';
  ctx.beginPath(); ctx.ellipse(P.x - 2, P.y + 2, r * (0.9 + Math.min(1, P.corpseT) * 0.6), r * (0.7 + Math.min(1, P.corpseT) * 0.4), P.deathAngle, 0, TAU); ctx.fill();
  ctx.translate(P.x, P.y); ctx.rotate(P.deathAngle);
  ctx.fillStyle = shade(C.main, -0.45);
  ctx.beginPath(); ctx.ellipse(-2, 0, r * 0.95, r * 0.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(C.main, -0.7);
  ctx.beginPath(); ctx.arc(-r * 0.9, 0, r * 0.38, 0, TAU); ctx.fill();
  ctx.fillStyle = '#16181a'; ctx.fillRect(r * 0.4, r * 0.5, r * 1.1, 4);
  ctx.restore();
}

// ---------------------------------------------------------------- granater
/** Landingsmarkør: vises fra kastebevegelsen starter (pose.throw) og frem til smellet (granaten). */
function drawGrenadeMarkers(ctx, world, live) {
  const t = world.time;
  const ring = (x, y, R, k, col, solid) => {
    ctx.save();
    ctx.fillStyle = `rgba(${col},${0.06 + 0.16 * k})`;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.45 + 0.45 * k})`; ctx.lineWidth = 2;
    if (!solid) { ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40; }
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // nedtelling som fylt bue
    ctx.lineWidth = 4; ctx.strokeStyle = `rgba(${col},0.9)`;
    ctx.beginPath(); ctx.arc(x, y, R - 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    // midtkryss
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
    ctx.restore();
  };
  for (const P of live) if (P.throw && P.throw.phase === 'windup') {
    const T = P.throw.target;
    ring(T.x, T.y, P.throw.radius, P.throw.progress * 0.35, '200,140,255', false);
    // stiplet kastebue fra kasteren til markøren: viser HVEM som kaster
    const mx = (P.x + T.x) / 2, my = (P.y + T.y) / 2 - Math.min(90, Math.hypot(T.x - P.x, T.y - P.y) * 0.3);
    ctx.save();
    ctx.strokeStyle = `rgba(200,140,255,${0.35 + 0.5 * P.throw.progress})`; ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.quadraticCurveTo(mx, my, T.x, T.y); ctx.stroke();
    ctx.restore();
  }
  for (const g of grenadeState(world).grenades) {
    const total = g.flight + g.fuse;
    const k = Math.min(1, g.t / total);
    const blink = g.landed && Math.sin(t * (10 + 30 * k)) > 0;
    ring(g.tx, g.ty, g.radius, 0.35 + 0.65 * k, blink ? '255,90,60' : '200,140,255', g.landed);
  }
  for (const m of grenadeState(world).markers) { // Våpen-granater: markør fra baneberegningen
    // Én ring: Våpen tegner egen farering de siste 0,8 s av lunta (weapons/grenades.js drawGrenades) → vår markør skjules da.
    const g = m.grenade, left = g?.def ? g.def.fuse - (g.t ?? 0) : m.life - m.t;
    if (left < 0.8) continue;
    const k = Math.min(1, m.t / m.life);
    ring(m.x, m.y, m.radius, 0.35 + 0.65 * k, k > 0.4 && Math.sin(t * (10 + 30 * k)) > 0 ? '255,90,60' : '200,140,255', k > 0.4);
  }
}

function drawGrenades(ctx, world) {
  const S = grenadeState(world);
  for (const g of S.grenades) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(g.x + 2, g.y + 3, 5, 3.5, 0, 0, TAU); ctx.fill();
    const y = g.y - g.z;
    ctx.fillStyle = '#2b2236'; ctx.beginPath(); ctx.arc(g.x, y, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9b59ff'; ctx.lineWidth = 1.5; ctx.stroke();
    if (!g.landed || Math.sin(world.time * 30) > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g.landed ? '#ff6040' : '#d7b8ff';
      ctx.beginPath(); ctx.arc(g.x, y - 1, 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  for (const b of S.blasts) {
    const k = b.t / b.life;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = b.radius * (0.4 + 0.8 * k);
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R);
    g.addColorStop(0, `rgba(255,240,200,${0.9 * (1 - k)})`); g.addColorStop(0.35, `rgba(255,150,60,${0.7 * (1 - k)})`); g.addColorStop(1, 'rgba(155,89,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,200,140,${0.8 * (1 - k)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * (0.6 + 0.5 * k), 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- varsel ved spilleren (flanke bakfra)
/** Rød retningsbue rundt spilleren mot en flanker som telegraferer/presser fra siden eller bakfra. */
function drawFlankWarning(ctx, world, live) {
  const p = world.player;
  if (!p || p.dead) return;
  for (const P of live) {
    const mc = P.melee && (P.melee.phase === 'charge' || P.melee.phase === 'strike');
    const tele = (P.telegraph && P.telegraph.flank) || mc;
    if (!tele && !(P.flanking && P.state === 'engage')) continue;
    const k = mc ? (P.melee.phase === 'strike' ? 1 : P.melee.progress) : tele ? P.telegraph.progress : 0.25;
    const a = Math.atan2(P.y - p.y, P.x - p.x);
    const R = (p.r || 15) + 20 + (tele ? (1 - k) * 10 : 0);
    const pulse = 0.55 + 0.45 * Math.sin(world.time * (tele ? 22 : 8));
    ctx.save();
    // Demo 23.10: lesbarhet over ny grafikk – i trekvart løftes buen til livhøyde (ikke skjult bak Warden-kroppen),
    // og en mørk kant under gjør den synlig på opplyst bakke.
    if (world.view === '34') ctx.translate(0, -Math.round(PROJ.aimHeight * PROJ.zScale * 0.6));
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(10,6,6,${0.45 * (0.5 + 0.5 * k)})`; ctx.lineWidth = (tele ? 6 : 4) + 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, a - 0.5, a + 0.5); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,50,40,${Math.min(1, (0.45 + 0.6 * k) * pulse)})`;
    ctx.lineWidth = tele ? 6 : 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, a - 0.5, a + 0.5); ctx.stroke();
    // pilspiss mot skytteren
    const tx = p.x + Math.cos(a) * (R + 12), ty = p.y + Math.sin(a) * (R + 12);
    ctx.fillStyle = `rgba(255,70,50,${Math.min(1, (0.5 + 0.6 * k) * pulse)})`;
    ctx.beginPath();
    ctx.moveTo(tx + Math.cos(a) * 10, ty + Math.sin(a) * 10);
    ctx.lineTo(tx + Math.cos(a + 2.4) * 10, ty + Math.sin(a + 2.4) * 10);
    ctx.lineTo(tx + Math.cos(a - 2.4) * 10, ty + Math.sin(a - 2.4) * 10);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- over hodet
function drawOverhead(ctx, world, P) {
  const top = P.y - P.r - 12;
  if (P.alert) {
    const bob = Math.sin(world.time * 14) * 1.5;
    ctx.save();
    ctx.fillStyle = '#c9a227'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3;
    ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.strokeText('!', P.x, top + bob); ctx.fillText('!', P.x, top + bob);
    ctx.restore();
  }
  if (P.suppressed) {
    ctx.save(); ctx.strokeStyle = 'rgba(200,205,210,0.8)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const x = P.x - 8 + i * 8, y = top + 2 + Math.sin(world.time * 10 + i) * 1.5;
      ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x, y + 1); ctx.lineTo(x + 3, y - 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (P.reload) drawReloadWindow(ctx, world, P);
  if (P.state === 'flank') {
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(world.time * 10);
    ctx.fillStyle = '#ff5a3c'; ctx.beginPath();
    ctx.moveTo(P.x, top - 4); ctx.lineTo(P.x - 5, top + 3); ctx.lineTo(P.x + 5, top + 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (P.hp < P.maxHp) {
    const w = P.type === 'heavy' ? 34 : 26, x = P.x - w / 2, y = P.y + P.r + 7;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = P.colors.main; ctx.fillRect(x, y, w * (P.hp / P.maxHp), 2);
  }
}

// ---------------------------------------------------------------- debug (F1)
function drawDebug(ctx, world, P) {
  const D = P.debug;
  ctx.save();
  if (D.path && D.pathIdx < D.path.length && !P.dead) {
    ctx.strokeStyle = P.state === 'flank' ? 'rgba(255,90,60,0.8)' : 'rgba(120,200,255,0.6)';
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(P.x, P.y);
    for (let i = D.pathIdx; i < D.path.length; i++) ctx.lineTo(D.path[i].x, D.path[i].y);
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (D.spot && !P.dead) {
    ctx.strokeStyle = D.spot.type === 'high' ? '#ff6b6b' : '#6bff8f'; ctx.lineWidth = 1.5;
    ctx.strokeRect(D.spot.x - 5, D.spot.y - 5, 10, 10);
    for (const pk of D.spot.peeks) { ctx.beginPath(); ctx.arc(pk.x, pk.y, 3, 0, TAU); ctx.stroke(); }
  }
  if (D.flankPlan) { ctx.strokeStyle = '#ff5a3c'; ctx.beginPath(); ctx.arc(D.flankPlan.x, D.flankPlan.y, 8, 0, TAU); ctx.stroke(); }
  ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center';
  const label = `${P.type[0].toUpperCase()}${P.id} ${P.state}${D.suppression > 0.3 ? ` s${D.suppression.toFixed(1)}` : ''}${P.coverType ? ` [${P.coverType}]` : ''}`;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  const w = ctx.measureText(label).width + 6;
  ctx.fillRect(P.x - w / 2, P.y - P.r - 34, w, 13);
  ctx.fillStyle = P.dead ? '#888' : '#e8e8e8';
  ctx.fillText(label, P.x, P.y - P.r - 24);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * Heavy lader (rev. 4: 3,0 s): spillerens åpning. Lesbart varsel uansett perspektiv: blinkende grønn-hvit ring rundt
 * fienden som fylles opp med ladingen + «RELOADING» over hodet. Grønn = trygt å presse (motsatt av rødt/oransje varsel).
 */
function drawReloadWindow(ctx, world, P) {
  const R = P.reload, rr = P.r + 9, pulse = 0.55 + 0.45 * Math.sin(world.time * 9);
  ctx.save();
  ctx.lineWidth = 3; ctx.strokeStyle = `rgba(120,255,170,${0.35 + 0.35 * pulse})`;
  ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(P.x, P.y, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(235,255,240,0.95)'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(P.x, P.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - R.progress)); ctx.stroke(); // gjenstående vindu
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#102016'; ctx.fillStyle = '#8dffb4';
  const y = P.y - P.r - 26;
  ctx.strokeText('RELOADING', P.x, y); ctx.fillText('RELOADING', P.x, y);
  ctx.restore();
}

/** Synlig aktørhøyde i skjerm-px (PROJ.heights · zScale), huk interpolert. */
function actorLift(P) {
  if (Number.isFinite(P.height)) return P.height * PROJ.zScale;   // per type (stats.js BODY), samme som muzzleZ/aimHeight
  const H = PROJ.heights, k = Math.max(0, Math.min(1, P.crouch || 0));
  return (H.actor + (H.actorCrouch - H.actor) * k) * PROJ.zScale;
}

/**
 * Tegn ÉN fiende ankret i fotpunktet (e.x, e.y) – kalles av shared/depth.js drawSorted (ctx er lagret rundt kallet).
 * Ovenfra: samme figur som før. Trekvart (world.view === '34'): plassholder uten ny grafikk – bakkeskygge i fotpunktet,
 * en enkel søyle i typefarge opp til PROJ-høyden (stående 48 / huket 30 verdens-px) og den eksisterende ovenfra-figuren
 * lagt flatt (y · zScale) på toppen. Utseendet er fryst; dette er bare forankringen. Lik tegnes på bakken av draw().
 */
export function drawActor(ctx, e, world, camera) {
  if (!e || !e.def || e.dead) return;
  const P = poseOf(world, e);
  if (drawWithArt(ctx, P, artInfo(world, camera, P, 'body', e))) return;   // Fiende-design (art.js), ellers plassholder
  if (world.view !== '34') { drawBody(ctx, world, P); return; }
  const r = P.r, C = P.colors, Hs = actorLift(P), Z = PROJ.zScale;
  // bakkeskygge + typering i fotpunktet
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(P.x + 2, P.y + 2, r * 1.1, r * 1.1 * Z * 0.6, 0, 0, TAU); ctx.fill();
  // søyle (kropp) fra foten til toppen
  const w = r * (P.type === 'heavy' ? 1.7 : 1.45), top = P.y - Hs;
  ctx.fillStyle = C.dark || '#333';
  ctx.beginPath();
  ctx.moveTo(P.x - w / 2, top); ctx.lineTo(P.x - w / 2, P.y);
  ctx.ellipse(P.x, P.y, w / 2, (w / 2) * Z * 0.6, 0, Math.PI, 0, true);
  ctx.lineTo(P.x + w / 2, top); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = C.main || P.plating?.trim || '#c0392b';
  ctx.fillRect(P.x - w / 2 + 2, top + Hs * 0.35, w - 4, 3);   // typestripe midt på søylen
  // eksisterende ovenfra-figur lagt flatt på toppen
  ctx.save();
  ctx.translate(P.x, top); ctx.scale(1, Z); ctx.translate(-P.x, -P.y);
  drawBody(ctx, world, P, { noShadow: true });
  ctx.restore();
}

/**
 * Enkelt varsel ved sprekken (kun når Arena ikke tegner det selv): glødende sprekkestjerne i bakken som vokser,
 * og en krympende ring som viser tiden til fienden kommer opp. Bakkeplanet – leses likt ovenfra og i trekvart.
 */
function drawSpawnWarnings(ctx, world) {
  const L = spawnState(world); if (!L.length) return;
  ctx.save();
  for (const h of L) {
    if (h.cancelled) continue;
    const k = Math.max(0, Math.min(1, ((world.time || 0) - h.t0) / (h.t || 1))), pulse = 0.6 + 0.4 * Math.sin(world.time * 18 + h.id);
    ctx.strokeStyle = `rgba(255,${Math.round(120 + 60 * k)},40,${0.45 + 0.45 * pulse})`; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = h.id * 1.7 + (i * TAU) / 6, L1 = 6 + 16 * k + (i % 2) * 5;
      ctx.beginPath(); ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + Math.cos(a + 0.25) * L1 * 0.55, h.y + Math.sin(a + 0.25) * L1 * 0.55);
      ctx.lineTo(h.x + Math.cos(a) * L1, h.y + Math.sin(a) * L1); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,90,40,${0.35 + 0.5 * k})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, 34 - 20 * k, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
