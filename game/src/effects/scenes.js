// BREACH – Effekter: scener for designark (stillbilde) og testside (levende). Kun test/presentasjon, ikke spillkode.
import { PROJ } from '../shared/projection.js';
import { shadowOffset, LIGHT_DIR } from '../shared/light.js';
import * as FX from './index.js';
import { fbm, mulberry, makeCanvas } from './sprites.js';

const TAU = Math.PI * 2, Z = PROJ.zScale;
const sp = (w, t, p) => FX.spawn(w, t, p);

// ---------------------------------------------------------------- bakke (malt betong/asfalt) i skjermrom
const groundCache = new Map();
export function ground(w, h, seed = 1, kind = 'concrete', zoom = 3) {
  w = Math.round(w); h = Math.round(h); const key = `${w}x${h}:${seed}:${kind}:${zoom}`; let c = groundCache.get(key); if (c) return c;
  c = makeCanvas(w, h); const x = c.getContext('2d'), id = x.createImageData(w, h), d = id.data, R = mulberry(seed * 99);
  const base = kind === 'metal' ? [52, 56, 60] : kind === 'dirt' ? [50, 45, 40] : [58, 57, 54], s = 1 / zoom;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const wx = xx * s, wy = y * s, n = fbm(wx / 38, wy / 38, seed, 4), m = fbm(wx / 6, wy / 6, seed + 7, 3), st = fbm(wx / 90, wy / 70, seed + 3, 3);
    let k = 0.62 + 0.42 * n + 0.16 * (m - 0.5) - 0.32 * Math.max(0, st - 0.55);
    // lampelys: varm pøl fra oppe til venstre + vignett
    const lx = (xx / w - 0.28), ly = (y / h - 0.22), lamp = Math.exp(-(lx * lx + ly * ly) * 3.2), vg = 1 - 0.55 * Math.pow(Math.hypot(xx / w - 0.5, y / h - 0.5) * 1.3, 2);
    k *= (0.5 + 0.75 * lamp) * vg; const i = (y * w + xx) * 4;
    d[i] = base[0] * k * (1 + 0.18 * lamp); d[i + 1] = base[1] * k * (1 + 0.08 * lamp); d[i + 2] = base[2] * k * (1 - 0.05 * lamp); d[i + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  // skjøter (plater à 2 ruter), riper, oljeflekker og malt varselstripe
  const T = 64 * zoom; x.strokeStyle = kind === 'metal' ? 'rgba(10,10,12,.55)' : 'rgba(14,13,12,.45)'; x.lineWidth = Math.max(1, zoom * 0.7);
  for (let gx = (seed * 37) % T; gx < w; gx += T) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke(); }
  for (let gy = (seed * 53) % T; gy < h; gy += T) { x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy); x.stroke(); }
  for (let i = 0; i < 5; i++) { const ox = R() * w, oy = R() * h, r = (8 + R() * 20) * zoom, g = x.createRadialGradient(ox, oy, 0, ox, oy, r); g.addColorStop(0, 'rgba(12,11,10,.28)'); g.addColorStop(1, 'rgba(12,11,10,0)'); x.fillStyle = g; x.fillRect(ox - r, oy - r, r * 2, r * 2); }
  x.strokeStyle = 'rgba(170,165,155,.06)'; x.lineWidth = 1; for (let i = 0; i < 40; i++) { const ox = R() * w, oy = R() * h, a = R() * TAU, l = (4 + R() * 18) * zoom; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + Math.cos(a) * l, oy + Math.sin(a) * l); x.stroke(); }
  if (seed % 3 === 0) { x.save(); x.globalAlpha = 0.22; x.fillStyle = '#c9a227'; x.translate(w * 0.86, 0); x.rotate(0.0); x.fillRect(0, 0, 10 * zoom, h); x.restore(); }
  groundCache.set(key, c); return c;
}

// ---------------------------------------------------------------- rekvisitter (verdenskoordinater, PROJ)
function shadowPoly(ctx, x, y, w, h, H, a = 0.45) {
  const o = shadowOffset(H); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + o.x, y + o.y); ctx.lineTo(x + w + o.x, y + h + o.y); ctx.lineTo(x + o.x, y + h + o.y); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
}
/** Våpen i hendene (forenklet referanse – bare for å forankre munningsglimtet). */
export function gun(ctx, kind, mx, my, ang, z = FX.MUZZLE_Z) {
  const L = kind === 'shotgun' ? 34 : kind === 'marksman' ? 46 : 36, so = shadowOffset(z);
  const c = Math.cos(ang), s = Math.sin(ang), bx = mx - c * L, by = my - s * L;
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(bx + so.x, by + so.y); ctx.lineTo(mx + so.x, my + so.y); ctx.stroke();
  ctx.translate(mx, my - z * Z); ctx.rotate(Math.atan2(s - 0, c)); ctx.scale(1, 1);
  const body = '#24272b', edge = '#4a5058', hi = 'rgba(190,200,210,.35)';
  // kolbe, kasse, løp
  ctx.fillStyle = body; ctx.fillRect(-L, -2.6, L * 0.32, 5.2); ctx.fillRect(-L * 0.7, -3.2, L * 0.42, 6.4);
  ctx.fillStyle = '#1b1d20'; ctx.fillRect(-L * 0.52, 2.2, 3.2, 5); // magasin
  ctx.fillStyle = edge; ctx.fillRect(-L * 0.28, kind === 'shotgun' ? -2.1 : -1.3, L * 0.28, kind === 'shotgun' ? 4.2 : 2.6);
  if (kind === 'shotgun') { ctx.fillStyle = '#3a3026'; ctx.fillRect(-L * 0.24, 1.2, L * 0.16, 2.6); }
  if (kind === 'marksman') { ctx.fillStyle = '#1a1c1f'; ctx.fillRect(-4.5, -2.2, 5, 4.4); ctx.fillStyle = '#30353b'; ctx.fillRect(-L * 0.62, -5.4, L * 0.28, 2.6); }
  ctx.fillStyle = hi; ctx.fillRect(-L * 0.7, -3.2, L * 0.7, 0.9);
  ctx.restore();
}
/** Containervegg (høy dekning, metall) – front og topp. */
export function container(ctx, x, y, w, h) {
  const H = PROJ.heights.high, ty = y - H * Z; shadowPoly(ctx, x, y, w, h, H, 0.5);
  ctx.fillStyle = '#3c4247'; ctx.fillRect(x, ty, w, h);                                    // tak
  ctx.fillStyle = 'rgba(255,240,220,.06)'; ctx.fillRect(x, ty, w, 3);
  const fy = ty + h, fh = H * Z, g = ctx.createLinearGradient(0, fy, 0, fy + fh); g.addColorStop(0, '#4b5257'); g.addColorStop(1, '#2c3135'); ctx.fillStyle = g; ctx.fillRect(x, fy, w, fh);
  for (let i = 0; i < w; i += 7) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + i + 4, fy, 2.2, fh); ctx.fillStyle = 'rgba(220,230,235,.07)'; ctx.fillRect(x + i + 3, fy, 1, fh); }
  const R = mulberry(5); for (let i = 0; i < 9; i++) { const rx = x + R() * w, rl = 6 + R() * 26; const rg = ctx.createLinearGradient(0, fy, 0, fy + rl); rg.addColorStop(0, 'rgba(120,60,30,.35)'); rg.addColorStop(1, 'rgba(120,60,30,0)'); ctx.fillStyle = rg; ctx.fillRect(rx, fy + R() * 10, 1.5 + R() * 2, rl); }
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, fy + fh - 2, w, 2);
}
/** Betongsperre (lav dekning). */
export function barrier(ctx, x, y, w, h) {
  const H = PROJ.heights.low, ty = y - H * Z; shadowPoly(ctx, x, y, w, h, H, 0.45);
  ctx.fillStyle = '#7b7973'; ctx.fillRect(x + 1.5, ty, w - 3, h);
  const fy = ty + h, fh = H * Z, g = ctx.createLinearGradient(0, fy, 0, fy + fh); g.addColorStop(0, '#6c6a65'); g.addColorStop(1, '#45433f'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x + 1.5, fy); ctx.lineTo(x + w - 1.5, fy); ctx.lineTo(x + w, fy + fh); ctx.lineTo(x, fy + fh); ctx.closePath(); ctx.fill();
  const R = mulberry(9); for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(${R() < 0.5 ? '20,20,18' : '200,196,186'},${0.06 + R() * 0.08})`; ctx.fillRect(x + R() * w, ty + R() * (h + fh), 0.6 + R() * 1.6, 0.6 + R() * 1.6); }
  ctx.fillStyle = 'rgba(201,162,39,.55)'; for (let i = 0; i < w; i += 14) { ctx.beginPath(); ctx.moveTo(x + i, fy + fh * 0.55); ctx.lineTo(x + i + 7, fy + fh * 0.55); ctx.lineTo(x + i + 11, fy + fh * 0.8); ctx.lineTo(x + i + 4, fy + fh * 0.8); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,240,220,.1)'; ctx.fillRect(x + 1.5, ty, w - 3, 1.2);
}
/** Kitinpukkel (Husk-lignende, referanse for treff på kitin). Fotpunkt (x, y), radius r. */
export function carapace(ctx, x, y, r = 16) {
  const H = 24, top = y - H * Z, so = shadowOffset(H * 0.6);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(x + so.x * 0.6, y + so.y * 0.6, r * 1.15, r * 0.8, 0, 0, TAU); ctx.fill();
  // kropp: dome fra fot til topp
  const g = ctx.createRadialGradient(x + LIGHT_DIR.x * r * 0.5, top + LIGHT_DIR.y * r * 0.3, 1, x, y - H * Z * 0.4, r * 1.5);
  g.addColorStop(0, '#4a4440'); g.addColorStop(0.35, '#211e1d'); g.addColorStop(1, '#0c0b0c'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y - H * Z * 0.45, r * 1.25, H * Z * 0.6 + r * 0.5, 0, 0, TAU); ctx.fill();
  // plateskjøter og glødende sprekker (#c0392b)
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(x, y - H * Z * 0.45 + i * 3, r * (0.95 - Math.abs(i) * 0.25), r * 0.55, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(192,57,43,.5)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
  const R = mulberry(3); for (let k = 0; k < 4; k++) { let px = x - r * 0.5 + R() * r, py = top + 6 + R() * 6; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (R() - 0.5) * 6; py += 2 + R() * 2.5; ctx.lineTo(px, py); } ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,236,206,.22)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, top + 5, r * 0.4, r * 0.14, -0.4, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- scener
// cx, cy = verdenspunkt i senter. script: [t, fn(world)] i sekunder. snap = tidspunkt for stillbildet. period = loop i testsiden.
const ANG = 0.32;
const shot = (weapon) => (w) => {
  const mx = 0, my = 0;
  sp(w, 'muzzle', { x: mx, y: my, angle: ANG, weapon, team: 'player' });
  const n = weapon === 'shotgun' ? 7 : 1;
  for (let i = 0; i < n; i++) { const a = ANG + (n > 1 ? (i / (n - 1) - 0.5) * 0.22 : 0), d = weapon === 'marksman' ? 150 : 46 + (i % 3) * 8; sp(w, 'tracer', { x0: mx, y0: my, x1: mx + Math.cos(a) * d, y1: my + Math.sin(a) * d, team: 'player', weapon, len: weapon === 'marksman' ? 150 : 34 }); }
};
export const SCENES = [
  { id: 'rifle', title: 'MUZZLE FLASH — RIFLE (REFERENCE)', sub: 'Weapons-owned flash (ref.) + VFX light & smoke, burst', cx: 22, cy: 14, zoom: 3, seed: 2,
    props: (c) => gun(c, 'rifle', 0, 0, ANG), script: [[0, shot('rifle')], [0.09, shot('rifle')], [0.18, shot('rifle')]], snap: 0.184, period: 1.2 },
  { id: 'shotgun', title: 'MUZZLE FLASH — SHOTGUN (REFERENCE)', sub: 'Weapons-owned flash (ref.) + VFX light, smoke, sparks', cx: 24, cy: 14, zoom: 3, seed: 4,
    props: (c) => gun(c, 'shotgun', 0, 0, ANG), script: [[-0.9, shot('shotgun')], [0, shot('shotgun')]], snap: 0.006, period: 1.4 },
  { id: 'marksman', title: 'MUZZLE FLASH — MARKSMAN (REFERENCE)', sub: 'Weapons-owned flash (ref.) + VFX light, brake smoke, dust', cx: 24, cy: 14, zoom: 3, seed: 5,
    props: (c) => gun(c, 'marksman', 0, 0, ANG), script: [[0, shot('marksman')]], snap: 0.012, period: 1.6 },
  { id: 'melee', title: 'MELEE — RIFLE BUTT ON HUSK', sub: 'blunt hit: dust, chitin flakes, ichor', cx: 0, cy: -6, zoom: 3, seed: 6,
    props: (c) => carapace(c, 6, 4, 16), script: [[0, (w) => sp(w, 'melee', { x: -8, y: -4, ox: -34, oy: -10, angle: 0.15, hit: true, surface: 'chitin' })]], snap: 0.07, period: 1.4 },
  { id: 'metal', title: 'HIT — METAL (CONTAINER)', sub: 'sparks, hot bullet holes cooling', cx: 0, cy: -12, zoom: 3, seed: 7,
    props: (c) => container(c, -90, -48, 180, 26), script: [[0, (w) => sp(w, 'impact', { x: -34, y: -22, z: 34, angle: -1.3, surface: 'metal', power: 1 })], [0.5, (w) => sp(w, 'impact', { x: 30, y: -22, z: 22, angle: -1.6, surface: 'metal' })], [0.9, (w) => sp(w, 'impact', { x: -4, y: -22, z: 30, angle: -1.75, surface: 'metal', power: 1.2 })]], snap: 0.93, period: 1.6 },
  { id: 'concrete', title: 'HIT — CONCRETE (BARRIER)', sub: 'dust burst, chips, pock marks', cx: 0, cy: -2, zoom: 3, seed: 8,
    props: (c) => barrier(c, -80, -26, 160, 18), script: [[0, (w) => sp(w, 'impact', { x: 28, y: -8, z: 12, angle: -1.4, surface: 'concrete' })], [0.6, (w) => sp(w, 'impact', { x: -18, y: -8, z: 14, angle: -1.7, surface: 'concrete', power: 1.2 })]], snap: 0.72, period: 1.6 },
  { id: 'chitin', title: 'HIT — CHITIN (HUSK)', sub: 'black shards, hot sparks, ichor spurt', cx: 0, cy: -6, zoom: 3, seed: 10,
    props: (c) => carapace(c, 0, 4, 16), script: [[0, (w) => sp(w, 'impact', { x: -10, y: 6, z: 20, angle: 0.5, surface: 'chitin', power: 1.2 })]], snap: 0.06, period: 1.2 },
  { id: 'ichor', title: 'CINDERBORN ICHOR', sub: 'glowing spray, pools cool to tar, steam', cx: 6, cy: 6, zoom: 3, seed: 11,
    props: null, script: [[0, (w) => sp(w, 'ichor', { x: -50, y: -14, z: 18, angle: 0.4, amount: 1.4 })], [1.0, (w) => sp(w, 'ichor', { x: 20, y: 30, z: 18, angle: -0.5, amount: 1 })], [2.0, (w) => sp(w, 'death', { x: -6, y: 6, angle: 0.2, size: 1 })]], snap: 2.12, period: 4 },
  { id: 'explosion', title: 'GRENADE EXPLOSION — r 90 px, GAME SCALE 1.5×', sub: '0.05 s · 0.30 s · 1.20 s — fireball, ground shockwave, dust ring, debris, scorch', cx: 0, cy: -12, zoom: 1.5, seed: 12, wide: 3,
    props: null, script: [[0, (w) => sp(w, 'explosion', { x: 0, y: 0, radius: 90 })]], snaps: [0.05, 0.3, 1.2], snap: 0.3, period: 3 },
  { id: 'crack', title: 'SPAWN WARNING — GROUND CRACK', sub: 'spawnWarn at 75 %: glow, embers, hopping grit', cx: 0, cy: -4, zoom: 3, seed: 13,
    props: null, script: [[0, (w) => sp(w, 'crack', { x: 0, y: 0, t: 1.0, id: 1 })]], snap: 0.75, period: 1.6 },
  { id: 'rise', title: 'SPAWN RISE — BREACH', sub: 'spawnRise: chunks, dust ring, sinkhole', cx: 0, cy: -10, zoom: 3, seed: 14,
    props: null, script: [[0, (w) => sp(w, 'crack', { x: 0, y: 0, t: 0.8, id: 2 })], [0.8, (w) => sp(w, 'rise', { x: 0, y: 0, id: 2 })]], snap: 0.95, period: 2.4 },
];

/** Kjør en scene fram til tid t i en egen verden (deterministisk). Returnerer verdenen. */
export function simulate(scene, t, world = null) {
  const w = world || { time: Math.min(0, scene.script[0][0]) }; if (!world) FX.init(w, { warmup: false });
  const dt = 1 / 120; let i = 0; const S = scene.script;
  while (w.time < t - 1e-6) {
    while (i < S.length && S[i][0] <= w.time + 1e-6) { S[i][1](w); i++; }
    const step = Math.min(dt, t - w.time); FX.update(step, w); w.time += step;
  }
  while (i < S.length && S[i][0] <= w.time + 1e-6) { S[i][1](w); i++; }
  return w;
}

/** Tegn scenen i rektangelet (rx, ry, rw, rh) på skjermen. */
export function drawScene(ctx, scene, world, rx, ry, rw, rh, zoom = scene.zoom, groundImg = null) {
  ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
  const gimg = groundImg || ground(rw, rh, scene.seed, 'concrete', zoom); ctx.drawImage(gimg, rx, ry, rw, rh);
  ctx.translate(rx + rw / 2, ry + rh / 2); ctx.scale(zoom, zoom); ctx.translate(-scene.cx, -scene.cy);
  FX.draw(ctx, world, null, 'under');
  if (scene.props) { ctx.save(); scene.props(ctx); ctx.restore(); }
  FX.draw(ctx, world, null, 'over');
  ctx.restore();
}
