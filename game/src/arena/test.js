// Testside for arena: fly kamera rundt i arenaene (Kessa Yard, Deepwell Refinery, The Deepwell).
// WASD/piltaster = flytt, musehjul / +/- = zoom, C = cover-overlay, R = ruter, Z = soner/kill-zones,
// G = rutenett, F = hele kartet, 1/2/3 = forhåndsvalgte visninger, Tab = bytt arena,
// venstreklikk = testskudd (lys), X = testeksplosjon ved musa, P = plasser testaktør ved musa.
// V = bytt visning (top-down / trekvart-prøve). URL-parametre: ?view=top|34 (standard 34)&arena=yard|refinery-crossroads&x=&y=&zoom=&overlay=crzg&actors=x,y,team;x,y,team (px)
import { createWorld, createInput, createCamera, createLoop } from '../core/index.js';
import * as arena from './index.js';
import { PROJ } from '../shared/projection.js';
import { drawSorted } from '../shared/depth.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const world = createWorld();
const camera = createCamera(canvas), input = createInput(canvas);
world.camera = camera; world.input = input;
const t0 = performance.now();
const q0 = new URLSearchParams(location.search);
world.arenaView = q0.get('view') === 'top' ? 'top' : '34'; // standard 3/4 (14:36); ?view=top gir ovenfra
if (q0.has('arena')) arena.loadArena(world, q0.get('arena')); else arena.init(world);
const buildMs = performance.now() - t0;

const q = q0;
const ov = { cover: false, routes: false, zones: false, grid: false };
for (const ch of q.get('overlay') || '') ({ c: 'cover', r: 'routes', z: 'zones', g: 'grid' })[ch] && (ov[({ c: 'cover', r: 'routes', z: 'zones', g: 'grid' })[ch]] = true);
let A = world.arena;
function fit() { camera.zoom = Math.min(canvas.width / (A.width + 40), canvas.height / (A.height + 40)); camera.x = A.width / 2; camera.y = A.height / 2; }
fit();
if (q.has('x')) camera.x = +q.get('x'); if (q.has('y')) camera.y = +q.get('y'); if (q.has('zoom')) camera.zoom = +q.get('zoom');

const ctl = {
  update(dt) {
    const sp = 600 / camera.zoom;
    const k = (a, b) => input.down(a) || input.down(b);
    camera.x += ((k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0)) * sp * dt;
    camera.y += ((k('KeyS', 'ArrowDown') ? 1 : 0) - (k('KeyW', 'ArrowUp') ? 1 : 0)) * sp * dt;
    let z = -input.mouse.wheel * 0.12 + (input.down('Equal') || input.down('NumpadAdd') ? dt : 0) - (input.down('Minus') || input.down('NumpadSubtract') ? dt : 0);
    if (z) camera.zoom = Math.max(0.3, Math.min(4, camera.zoom * (1 + z)));
    if (input.pressed('KeyC')) ov.cover = !ov.cover;
    if (input.pressed('KeyR')) ov.routes = !ov.routes;
    if (input.pressed('KeyZ')) ov.zones = !ov.zones;
    if (input.pressed('KeyG')) ov.grid = !ov.grid;
    if (input.pressed('KeyF')) fit();
    if (input.pressed('KeyV')) { arena.setView(world, world.arenaView === '34' ? 'top' : '34'); A = world.arena; }
    if (input.pressed('Tab')) {
      const ids = arena.ARENA_IDS, next = ids[(ids.indexOf(A.id) + 1) % ids.length];
      arena.loadArena(world, next); A = world.arena; fit(); document.title = `BREACH – Arena test: ${A.name}`;
    }
    const m = input.mouse;
    if (m.leftPressed) world.events.emit('shot', { projectile: { x: m.worldX, y: m.worldY, angle: 0, team: 'player' }, team: 'player' });
    if (input.pressed('KeyX')) world.events.emit('explosion', { x: m.worldX, y: m.worldY, radius: 80 });
    if (input.pressed('KeyP')) world.enemies.push({ x: m.worldX, y: m.worldY, r: 14, team: world.enemies.length ? 'enemy' : 'player', dummy: true });
    if (input.pressed('Digit1')) { camera.x = A.playerSpawn.x + 200; camera.y = A.playerSpawn.y - 150; camera.zoom = 1.5; }
    if (input.pressed('Digit2')) { camera.x = 560; camera.y = 480; camera.zoom = 1.5; }
    if (input.pressed('Digit3')) { camera.x = A.exit.x + A.exit.w / 2; camera.y = A.exit.y + 180; camera.zoom = 1.5; }
  },
  drawHud(c) {
    c.save(); c.fillStyle = 'rgba(8,10,12,0.75)'; c.fillRect(12, 12, 470, 74);
    c.fillStyle = '#39c6ff'; c.font = 'bold 13px monospace';
    c.fillText(`ARENA TEST · ${A.board} // ${A.name.toUpperCase()}`, 22, 32);
    c.fillStyle = '#c9ced4'; c.font = '12px monospace';
    c.fillText(`WASD/arrows move · wheel zoom (${camera.zoom.toFixed(2)}) · F fit map`, 22, 50);
    c.fillText(`C cover ${ov.cover ? 'ON' : 'off'} · R routes ${ov.routes ? 'ON' : 'off'} · Z zones ${ov.zones ? 'ON' : 'off'} · V view ${world.arenaView === '34' ? '3/4' : 'top'} · Tab arena`, 22, 66);
    c.fillStyle = '#7d858c'; c.fillText(`${A.id} ${A.cols}×${A.rows} · cover ${world.cover.length} · click shot · X explosion · P actor`, 22, 80);
    c.restore();
  },
};
// Testaktører (kun for å sjekke at tak/høy dekning ikke skjuler dem)
for (const a of (q.get('actors') || '').split(';').filter(Boolean)) {
  const [x, y, team = 'player'] = a.split(','); world.enemies.push({ x: +x, y: +y, r: 14, team, dummy: true, angle: -Math.PI / 2 });
}
// Testaktører tegnes via shared/depth.js (samme vei som spillet skal bruke): dekning og aktører sortert på PROJ.sortKey.
function drawDummy(c, a, w) {
  const v34 = w.arenaView === '34';
  const col = a.team === 'player' ? '#39c6ff' : '#ff6a2a';
  c.translate(a.x, a.y);
  if (v34) { // stående figur: fotpunkt (x, y), høyde PROJ.heights.actor × zScale
    const Hs = PROJ.heights.actor * PROJ.zScale, r = a.r;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(4, 2, r * 1.1, r * 0.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = a.team === 'player' ? '#4b5560' : '#5a4038';
    c.beginPath(); c.arc(0, -Hs + r, r * 0.95, Math.PI, 0); c.lineTo(r * 0.95, 0); c.ellipse(0, 0, r * 0.95, r * 0.42, 0, 0, Math.PI); c.closePath(); c.fill();
    c.lineWidth = 2; c.strokeStyle = col; c.stroke();
    c.fillStyle = col; c.fillRect(-r * 0.55, -Hs + r * 0.7, r * 1.1, 4); // visir
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-r * 0.8, -Hs + r * 1.6, 3, Hs - r * 1.8);
    c.fillStyle = '#1b1e21'; c.fillRect(r * 0.2, -Hs * 0.45, r * 1.2, 5); // våpen
    return;
  }
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(3, 4, a.r, a.r * 0.7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = a.team === 'player' ? '#5d6670' : '#5a4038'; c.beginPath(); c.arc(0, 0, a.r, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2.5; c.strokeStyle = col; c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(0, 0, a.r * 0.45, 0, Math.PI * 2); c.fill();
  c.rotate(a.angle ?? -Math.PI / 2); c.fillStyle = '#1b1e21'; c.fillRect(a.r * 0.3, -2.5, a.r * 1.3, 5);
}
const depthOpts = { cover: null, drawCover: arena.drawCoverObject, drawActor: drawDummy };
const dummyMod = {
  draw(c, w, cam) {
    depthOpts.cover = arena.coverObjects(w);
    window.ARENA_TEST && (window.ARENA_TEST.depth = drawSorted(c, w, cam, depthOpts));
  },
};
const arenaMod = {
  update: arena.update, draw: arena.draw,
  drawTop(c, w, cam) { arena.drawTop(c, w, cam); arena.drawDebug(c, w, ov); },
};
const loop = createLoop({ world, ctx, camera, input, mods: { level: ctl, arena: arenaMod, enemies: dummyMod } });
loop.start();
window.ARENA_TEST = { world, camera, loop, ov, buildMs };
window.BREACH = { world, camera, loop };
