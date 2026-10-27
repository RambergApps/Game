// Testside (Breach Karakter, 2026-10-23): ekte spiller-/fiende-/våpenloop på Arenas trekvart-Kessa Yard,
// Warden i pseudo-3D-stilen «oblique». Samme flyt som index.html?view=34, men starter direkte (ingen startskjerm/mellomsekvens), zoom 2 og kontrolloversikt.
// Kjør: cd /workspace/breach/game && python3 -m http.server 8000 → http://localhost:8000/src/player/test-v3.html
import { createWorld, createInput, createCamera, createLoop } from '../core/index.js';
import * as player from './index.js';
import * as arena from '../arena/index.js';
import * as enemies from '../enemies/index.js';
import * as levels from '../levels/index.js';
import * as weapons from '../weapons/index.js';
import { separateActors } from '../shared/separateActors.js';
import { oblique } from '../shared/rig/styles/oblique.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const world = createWorld();
const camera = createCamera(canvas), input = createInput(canvas);
world.camera = camera; world.input = input;
world.arenaView = '34';
world.modules = { player, arena, enemies, levels, weapons };
world.events.on('death', ({ target }) => { if (target.team === 'enemy') camera.shake(5, 250); });
world.events.on('hit', ({ target, blocked, amount }) => { if (target === world.player && !blocked && amount > 0) camera.shake(3, 120); });

arena.init(world); weapons.init(world); player.init(world); enemies.init(world); levels.init(world);
const PR = player._debug();
camera.zoom = +(Q.get('zoom') || 2);
if (world.player) { camera.follow(world.player); camera.x = world.player.x; camera.y = world.player.y; }
if (Q.get('enemies') !== '0') levels.startLevel(world, 1);
// Mellomsekvenser hoppes over automatisk på testsiden (?story=1 beholder dem): send ESC mens cutscene-canvaset finnes.
if (Q.get('story') !== '1') setInterval(() => {
  if (document.querySelector('canvas.breach-cutscene')) { const ev = { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }; window.dispatchEvent(new KeyboardEvent('keydown', ev)); }
}, 100);

// Fiender, dekning og Warden dybdesorteres nå av core/loop.js (drawSorted + player/enemies.drawActor) – ingen egen tegning her.
const SHOW = { hud: Q.get('hud') !== '0' };               // ?hud=0 (eller BREACH.show.hud = false) skjuler HUD for nærbilder
const playerMod = { update: player.update, draw: player.draw, drawHud: (c, w, cam) => SHOW.hud && player.drawHud(c, w, cam), respawn: player.respawn };
const levelMod = { update: levels.update, draw: levels.draw, drawHud: (c, w, cam) => SHOW.hud && levels.drawHud(c, w, cam) };

// ---- målinger (for Breach Test / review): tegnetid per figur og bilde
const STATS = { fps: 0, frameMs: 0, figMs: 0, figs: 0 };
let last = performance.now(), acc = 0, nf = 0, figMs0 = 0, figs0 = 0;
const hud = { draw(c) { if (!SHOW.hud) return;
  const now = performance.now(); acc += now - last; last = now; nf++;
  if (acc > 500) { STATS.fps = nf * 1000 / acc; STATS.frameMs = acc / nf; STATS.figMs = (oblique.STATS.ms - figMs0) / Math.max(1, oblique.STATS.figures - figs0); STATS.figs = (oblique.STATS.figures - figs0) / nf; figMs0 = oblique.STATS.ms; figs0 = oblique.STATS.figures; acc = 0; nf = 0; }
  c.save(); c.fillStyle = 'rgba(8,10,12,.7)'; c.fillRect(c.canvas.width - 250, 10, 240, 22); c.fillStyle = '#9aa4ad'; c.font = '12px monospace';
  c.fillText(`${STATS.fps.toFixed(0)} fps · ${STATS.figs.toFixed(1)} fig · ${STATS.figMs.toFixed(2)} ms/fig`, c.canvas.width - 242, 25); c.restore();
} };
addEventListener('keydown', (ev) => {
  if (ev.code === 'Digit1') camera.zoom = 1; if (ev.code === 'Digit2') camera.zoom = 2; if (ev.code === 'Digit3') camera.zoom = 3;
  if (ev.code === 'KeyH') { const h = document.getElementById('help'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
});

const loop = createLoop({ world, ctx, camera, input, mods: { level: levelMod, player: playerMod, enemies, arena, weapons, hud, physics: { update: separateActors } } });
loop.start();
window.BREACH = { show: SHOW, world, loop, camera, input, player: PR, STATS, oblique };
