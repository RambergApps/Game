// BREACH – granater: kastbane (2,5D med høyde z), sprett mot dekning/gulv, lunte, eksplosjon med områdeskade.
// Høy dekning blokkerer både granaten og eksplosjonen (raycastCover fra sentrum til mål). Lav dekning: granaten
// går over hvis den er høyere enn GRENADE.lowCoverHeight, og eksplosjonen går over den (gir ikke beskyttelse).
import { raycastCover, damage, dist } from '../core/index.js';
import * as camfx from './camfx.js';
import { GRENADE, grenadeDamage } from './data.js';
import * as fx from './fx.js';
import { TUNING } from './data.js';
import { is34, hidden, lift } from './view34.js';

const TAU = Math.PI * 2;
const SUB = 3; // delsteg per 60 Hz-steg for stabil kollisjon

function gstate(world) { return world._grenades || (world._grenades = []); }

/** Startfart for et kast med gitt avstand (px). Returnerer {vx, vy, vz}. */
function launch(angle, d, G) {
  const T = 0.42 + d / 900, vh = (0.8 * d) / T;
  return { vx: Math.cos(angle) * vh, vy: Math.sin(angle) * vh, vz: (G.gravity * T) / 2 };
}

/**
 * spawnGrenade(world, { x, y, angle, power (0..1 av maxThrow) | distance (px), owner, team,
 *                       dmg?, radius?, fuse?, innerRadius?, edgeMult? }) → granat
 * Sender 'grenade' { phase:'throw', x, y, angle, power, team, owner, entity, weapon:'grenade', grenade }.
 */
export function spawnGrenade(world, o) {
  const G = { ...GRENADE, ...pick(o, ['dmg', 'radius', 'fuse', 'innerRadius', 'edgeMult', 'selfMult']) };
  const d = clamp(o.distance ?? (o.power ?? 1) * G.maxThrow, G.minThrow * 0.5, G.maxThrow);
  const v = launch(o.angle, d, G);
  const g = { kind: 'grenade', weapon: 'grenade', x: o.x, y: o.y, z: o.z ?? 14, ...v, t: 0, def: G, owner: o.owner || null, team: o.team || 'player', dead: false, rest: false, spin: 0, bounces: 0 };
  gstate(world).push(g);
  world.events.emit('grenade', { phase: 'throw', x: g.x, y: g.y, angle: o.angle, power: d / G.maxThrow, team: g.team, owner: g.owner, entity: g.owner, weapon: 'grenade', grenade: g });
  return g;
}

/** Ett fysikk-steg for en granat (brukes både av simulering og forhåndsvisning).
 *  Returnerer flatetype for sprettet i steget: 'floor' (bakkesprett) | 'cover' (dekningsobjekt) | 'wall' (arenakant eller høy mur) | null.
 *  Ved sprett lagres detaljer i g.lastHit = { surface, cover|null, impact (px/s inn mot flaten) }. */
const WALL_KINDS = new Set(['wall', 'building']); // Arena: HCAT-kategori 'wall' = murer og bygninger
function stepPhys(world, g, dt) {
  const G = g.def; let ev = null;
  if (!g.rest) {
    g.vz -= G.gravity * dt; g.z += g.vz * dt;
    if (g.z <= 0) {
      g.z = 0;
      if (g.vz < -40) { const imp = -g.vz; g.vz = imp * G.bounce; g.vx *= G.friction; g.vy *= G.friction; g.bounces++; ev = 'floor'; g.lastHit = { surface: 'floor', cover: null, impact: imp }; }
      else g.vz = 0;
    }
    if (g.z === 0 && g.vz === 0) { const k = Math.exp(-G.rollDrag * dt); g.vx *= k; g.vy *= k; if (Math.hypot(g.vx, g.vy) < 6) { g.vx = g.vy = 0; g.rest = true; } }
  }
  if (g.rest) return ev;
  const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
  const types = g.z < G.lowCoverHeight ? ['high', 'low'] : ['high'];
  const hit = raycastCover(world, g.x, g.y, nx, ny, { types, pad: G.radiusBody });
  if (hit) {
    const dot = g.vx * hit.nx + g.vy * hit.ny;
    if (dot < 0) { g.vx -= 2 * dot * hit.nx; g.vy -= 2 * dot * hit.ny; g.vx *= 0.5; g.vy *= 0.5; }
    g.x = hit.x + hit.nx * 0.6; g.y = hit.y + hit.ny * 0.6;
    ev = WALL_KINDS.has(hit.cover?.kind) ? 'wall' : 'cover';
    g.lastHit = { surface: ev, cover: hit.cover ?? null, impact: Math.max(0, -dot) };
  } else { g.x = nx; g.y = ny; }
  const b = world.bounds, r = G.radiusBody;
  if (g.x < b.x + r || g.x > b.x + b.w - r) { g.lastHit = { surface: 'wall', cover: null, impact: Math.abs(g.vx) }; g.vx = -g.vx * 0.5; g.x = clamp(g.x, b.x + r, b.x + b.w - r); ev = 'wall'; }
  if (g.y < b.y + r || g.y > b.y + b.h - r) { g.lastHit = { surface: 'wall', cover: null, impact: Math.abs(g.vy) }; g.vy = -g.vy * 0.5; g.y = clamp(g.y, b.y + r, b.y + b.h - r); ev = 'wall'; }
  return ev;
}

/** grenadeBounce-payload. surface = flatetype ('wall'|'cover'|'floor'); material = 'metal'|'concrete'|… for lyd. */
function bouncePayload(world, g, surface) {
  const c = g.lastHit?.cover;
  const material = c?.material ?? world.modules?.arena?.surfaceAt?.(world, g.x, g.y) ?? 'concrete';
  return { x: g.x, y: g.y, grenade: g, team: g.team, surface, material, cover: c ?? null,
    impact: g.lastHit?.impact ?? 0, landing: surface === 'floor' && g.bounces === 1 };
}

export function updateGrenades(dt, world) {
  const list = gstate(world);
  for (const g of list) {
    if (g.dead) continue;
    for (let i = 0; i < SUB; i++) {
      const ev = stepPhys(world, g, dt / SUB);
      if (!ev) continue;
      // Vegg/dekning: som før (fart > 60 etter sprettet). Gulv: bare merkbare sprett (nedslag > 90 px/s), første = landing.
      const loud = ev === 'floor' ? g.lastHit.impact > 90 : Math.hypot(g.vx, g.vy) > 60;
      if (loud) world.events.emit('grenadeBounce', bouncePayload(world, g, ev));
    }
    g.spin += Math.hypot(g.vx, g.vy) * dt * 0.08;
    g.t += dt;
    if (g.t >= g.def.fuse) explode(world, g);
  }
  if (list.some((g) => g.dead)) world._grenades = list.filter((g) => !g.dead);
}

/** Detoner. Skade: full innenfor innerRadius, lineært ned til edgeMult ved radius. Kasteren tar selfMult, lagkamerater 0. */
export function explode(world, g) {
  if (g.dead) return; g.dead = true;
  const G = g.def, targets = [...world.enemies, ...(world.player ? [world.player] : [])], hits = [];
  for (const e of targets) {
    if (!e || e.dead) continue;
    const d = dist(g.x, g.y, e.x, e.y); let amt = grenadeDamage(G, d, e.r || 14); if (amt <= 0) continue;
    if (raycastCover(world, g.x, g.y, e.x, e.y, { types: ['high'] })) continue;       // høy dekning skjermer
    if (e.team === g.team) { if (e !== g.owner) continue; amt *= G.selfMult; }
    const dealt = damage(e, amt, { grenade: g, owner: g.owner, team: g.team, world, weapon: 'grenade', x: g.x, y: g.y }, world);
    hits.push({ target: e, amount: dealt, dist: d });
  }
  if (TUNING.fx?.explosion !== false) fx.explosion(world, g.x, g.y, G.radius);
  const cam = world.camera;
  if (cam) { const d = cam.target ? dist(cam.target.x, cam.target.y, g.x, g.y) : 0; const k = clamp(1.4 - d / 500, 0.25, 1); camfx.shake(world, G.shake[0] * k, G.shake[1]); }
  world.events.emit('explosion', { x: g.x, y: g.y, z: g.z || 0, kind: 'frag', radius: G.radius, team: g.team, owner: g.owner, entity: g.owner, weapon: 'grenade', surface: 'concrete', hits });
  return hits;
}

/** Forhåndsvis kastbanen uten å endre world (deterministisk). → { pts:[{x,y,z}], end:{x,y}, t } */
export function predictGrenade(world, x, y, angle, power, o = {}) {
  const G = { ...GRENADE, ...o };
  const d = clamp(o.distance ?? power * G.maxThrow, G.minThrow * 0.5, G.maxThrow);
  const g = { x, y, z: 14, ...launch(angle, d, G), def: G, rest: false, bounces: 0 };
  const pts = [{ x, y, z: g.z }], dt = 1 / 60 / SUB;
  let t = 0;
  while (t < G.fuse && !g.rest) { stepPhys(world, g, dt); t += dt; if (((t / dt) | 0) % 4 === 0) pts.push({ x: g.x, y: g.y, z: g.z }); }
  pts.push({ x: g.x, y: g.y, z: g.z });
  return { pts, end: { x: g.x, y: g.y }, t, radius: G.radius };
}

export function drawGrenades(ctx, world) {
  for (const g of gstate(world)) {
    if (g.dead) continue;
    const left = g.def.fuse - g.t, enemy = g.team === 'enemy';
    // fareområde de siste 0,8 s
    if (left < 0.8) {
      const k = 1 - left / 0.8; ctx.save();
      ctx.strokeStyle = `rgba(255,${enemy ? 90 : 140},60,${0.15 + 0.35 * k})`; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -world.time * 30; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.def.radius, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,80,30,${0.05 + 0.08 * k})`; ctx.fill(); ctx.restore();
    }
    // Rev. 6: i 34 løftes granaten med PROJ.zScale (samme som aktører/dekning), skyggen ligger rett under på bakken og krymper med høyden.
    const v34 = is34(world), L = v34 ? lift(world) : 0.55, sx = g.x, sy = g.y - g.z * L;
    ctx.save();
    const sk = v34 ? Math.max(0.45, 1 - g.z / 90) : 1;
    ctx.fillStyle = `rgba(0,0,0,${v34 ? 0.45 * sk : 0.45})`; ctx.beginPath();
    if (v34) ctx.ellipse(g.x, g.y + 1.5, 4.6 * sk, 2.4 * sk, 0, 0, TAU); else ctx.ellipse(g.x + g.z * 0.25 + 1, g.y + g.z * 0.35 + 1.5, 4.2, 2.6, 0, 0, TAU);
    ctx.fill();
    if (v34 && hidden(world, g.x, g.y, g.z)) { ctx.restore(); continue; }   // bak et containertak: bare skyggen (hvis den synes)
    ctx.translate(sx, sy); ctx.rotate(g.spin);
    const body = ctx.createRadialGradient(-1.2, -1.2, 0.5, 0, 0, 4.5); body.addColorStop(0, '#7d868f'); body.addColorStop(0.6, '#3f464d'); body.addColorStop(1, '#1b1f23');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(8,10,12,.9)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-4, -0.7, 8, 1.4);              // varselstripe
    ctx.restore();
    // blinkende lys – raskere mot slutten
    const rate = left < 0.6 ? 16 : left < 1.2 ? 8 : 4, on = Math.sin(g.t * rate * Math.PI) > 0;
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const c = enemy ? '255,80,40' : '57,198,255', r = 9;
      const gr = ctx.createRadialGradient(sx, sy - 1, 0, sx, sy - 1, r); gr.addColorStop(0, `rgba(${c},.95)`); gr.addColorStop(0.3, `rgba(${c},.4)`); gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy - 1, r, 0, TAU); ctx.fill(); ctx.restore(); }
  }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function pick(o, keys) { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; }
