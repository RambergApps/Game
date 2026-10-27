// VARIANT A-testside (kopi av test-faceted.js, laster facetedA). // Testside (Breach Warden-design, 2026-10-23): Warden «faceted» (v4, bakte malte lavpoly-sprites) mot «oblique» (v3)
// på Arenas trekvart-Kessa Yard. Samme flyt som test-v3.js. Spillerens syncStyle velger fortsatt «oblique»;
// KUN på denne siden byttes oblique.drawFigure ut med faceted.drawFigure ved kjøretid (T veksler). Ekte kobling: se
// shared/rig/faceted/README.md (én linje i player/index.js).
// Kjør: cd /workspace/breach/game && python3 -m http.server 8000 → http://localhost:8000/src/player/test-faceted.html
import { createWorld, createInput, createCamera, createLoop } from '../core/index.js';
import * as player from './index.js';
import * as arena from '../arena/index.js';
import * as enemies from '../enemies/index.js';
import * as levels from '../levels/index.js';
import * as weapons from '../weapons/index.js';
import { separateActors } from '../shared/separateActors.js';
import { oblique } from '../shared/rig/styles/oblique.js';
import { faceted } from '../shared/rig/styles/facetedA.js';
import { createRig, WARDEN } from '../shared/rig/index.js';
import { cacheReport, clearAllCaches } from '../shared/rig/faceted/bake.js';
import { attachWeaponEvents } from '../shared/rig/faceted/weapons/index.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

// ---- stilbytte (kun testsiden)
const obliqueDraw = oblique.drawFigure.bind(oblique);
let styleName = Q.get('style') === 'oblique' ? 'oblique' : 'faceted';
function setStyle(n) { styleName = n; oblique.drawFigure = n === 'faceted' ? faceted.drawFigure : obliqueDraw; }
setStyle(styleName);
if (Q.get('ring') === '1') faceted.setRing(true);

const world = createWorld();
const camera = createCamera(canvas), input = createInput(canvas);
world.camera = camera; world.input = input;
world.arenaView = '34';
world.modules = { player, arena, enemies, levels, weapons };
world.events.on('death', ({ target }) => { if (target.team === 'enemy') camera.shake(5, 250); });
world.events.on('hit', ({ target, blocked, amount }) => { if (target === world.player && !blocked && amount > 0) camera.shake(3, 120); });

arena.init(world); weapons.init(world); player.init(world); enemies.init(world); levels.init(world);
const PR = player._debug();
// våpenhendelser → bevegelige deler (bolt/mag) på spillerriggen (kun testsiden; ekte kobling i README)
if (PR && PR.rig && world.player) attachWeaponEvents(world, PR.rig, world.player);
camera.zoom = +(Q.get('zoom') || 2);
if (world.player) { camera.follow(world.player); camera.x = world.player.x; camera.y = world.player.y; }
if (Q.get('enemies') !== '0') levels.startLevel(world, 1);
if (Q.get('story') !== '1') setInterval(() => {
  if (document.querySelector('canvas.breach-cutscene')) { const ev = { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }; window.dispatchEvent(new KeyboardEvent('keydown', ev)); }
}, 100);

const SHOW = { hud: Q.get('hud') !== '0' };
const playerMod = { update: player.update, draw: player.draw, drawHud: (c, w, cam) => SHOW.hud && player.drawHud(c, w, cam), respawn: player.respawn };
const levelMod = { update: levels.update, draw: levels.draw, drawHud: (c, w, cam) => SHOW.hud && levels.drawHud(c, w, cam) };

// ---- målinger
const STATS = { fps: 0, frameMs: 0, figMs: 0, figs: 0 };
const src = () => styleName === 'faceted' ? faceted.STATS : oblique.STATS;
let last = performance.now(), acc = 0, nf = 0, figMs0 = 0, figs0 = 0, lastSrc = null;
const hud = { draw(c) { if (!SHOW.hud) return;
  const s = src(); if (s !== lastSrc) { figMs0 = s.ms; figs0 = s.figures; lastSrc = s; }
  const now = performance.now(); acc += now - last; last = now; nf++;
  if (acc > 500) { STATS.fps = nf * 1000 / acc; STATS.frameMs = acc / nf; STATS.figMs = (s.ms - figMs0) / Math.max(1, s.figures - figs0); STATS.figs = (s.figures - figs0) / nf; figMs0 = s.ms; figs0 = s.figures; acc = 0; nf = 0; }
  const cr = cacheReport();
  c.save(); c.fillStyle = 'rgba(8,10,12,.7)'; c.fillRect(c.canvas.width - 330, 10, 320, 38); c.fillStyle = '#9aa4ad'; c.font = '12px monospace';
  c.fillText(`${styleName} · ${STATS.fps.toFixed(0)} fps · ${STATS.figs.toFixed(1)} fig · ${STATS.figMs.toFixed(2)} ms/fig`, c.canvas.width - 322, 25);
  c.fillText(`sprite cache ${(cr.bytes / 1048576).toFixed(1)} MB · ${cr.count} sprites`, c.canvas.width - 322, 41); c.restore();
} };
addEventListener('keydown', (ev) => {
  if (ev.code === 'Digit1') camera.zoom = 1; if (ev.code === 'Digit2') camera.zoom = 2; if (ev.code === 'Digit3') camera.zoom = 3; if (ev.code === 'Digit4') camera.zoom = 4;
  if (ev.code === 'KeyT') setStyle(styleName === 'faceted' ? 'oblique' : 'faceted');
  if (ev.code === 'KeyC') faceted.setRing(!faceted.CFG.ring);
  if (ev.code === 'KeyM') canvas.style.filter = canvas.style.filter ? '' : 'grayscale(1)';
  if (ev.code === 'KeyH') { const h = document.getElementById('help'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
});

const loop = createLoop({ world, ctx, camera, input, mods: { level: levelMod, player: playerMod, enemies, arena, weapons, hud, physics: { update: separateActors } } });
if (Q.get('bench') !== '1') loop.start();

// ---------------------------------------------------------------- arbeidsbenk (skjermbilder/ytelse, styres fra konsoll eller Playwright)
// Frittstående rigger (samme WARDEN-def) poseres og tegnes oppå gården (spilleren skjult). Ingen spill-logikk påvirkes.
const POSES = {
  stand: (a) => ({ mode: 'idle', aimBlend: 0, aimAngle: a }),
  aim: (a) => ({ mode: 'idle', aimBlend: 1, aimAngle: a }),
  walk: (a) => ({ mode: 'walk', aimBlend: 0, aimAngle: a, move: 62 }),
  run: (a) => ({ mode: 'run', aimBlend: 0, aimAngle: a, move: 150 }),
  cover: (a) => ({ mode: 'cover', aimAngle: a + 2.6, cover: { nx: -Math.cos(a), ny: -Math.sin(a), type: 'low' }, exposed: false }),
  peek: (a) => ({ mode: 'cover', aimAngle: a, cover: { nx: -Math.cos(a), ny: -Math.sin(a), type: 'low' }, peek: 1, aimBlend: 1 }),
  blind: (a) => ({ mode: 'cover', aimAngle: a, cover: { nx: -Math.cos(a), ny: -Math.sin(a), type: 'low' }, blind: 1 }),
};
function poseRig(x, y, pose, a, t = 1.3, extra) {
  const rig = createRig(WARDEN, { skin: 'warden', x, y, angle: a, style: oblique });
  const d = POSES[pose](a); const v = d.move || 0; const dt = 1 / 60, n = Math.round(t / dt);
  for (let i = 0; i <= n; i++) {
    const k = (i - n) * dt; const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k;
    const dd = { x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, aimAngle: d.aimAngle, mode: d.mode, cover: d.cover || null, aimBlend: d.aimBlend || 0, peek: d.peek || 0, blind: d.blind || 0, exposed: d.exposed ?? true };
    if (v) dd.moveAngle = a;
    rig.drive(dd); rig.update(dt);
  }
  if (extra) extra(rig);
  return rig;
}
function hidePlayerRender() { const keep = oblique.drawFigure; oblique.drawFigure = () => {}; loop.render(); oblique.drawFigure = keep; }
/** Tegn en scene: kamera (cx, cy, zoom), figurer [{x,y,pose,a,t}] i valgt stil. Returnerer tegnetid. */
function scene({ cx, cy, zoom = 2, style = 'faceted', figs = [], ring = false, gray = false, settle }) {
  loop.stop(); camera.follow(null); camera.x = cx; camera.y = cy; camera.zoom = zoom; camera.shakeX = camera.shakeY = 0;
  SHOW.hud = false; document.getElementById('help').style.display = 'none';
  hidePlayerRender();
  const rigs = figs.map(f => f.rig || poseRig(f.x, f.y, f.pose, f.a, f.t, f.extra));
  const prev = faceted.CFG.ring; faceted.setRing(ring);
  camera.apply(ctx);
  const sty = style === 'faceted' ? faceted : { drawFigure: obliqueDraw };
  const order = rigs.map((r, i) => [r, i]).sort((A, B) => A[0].frame().y - B[0].frame().y);
  const t0 = performance.now();
  for (const [r] of order) { const F = r.frame(); sty.drawFigure(ctx, r, F, {}); }
  const ms = performance.now() - t0;
  faceted.setRing(prev); ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.style.filter = gray ? 'grayscale(1)' : '';
  return { ms, n: rigs.length };
}
/** Ytelse: 9 figurer i zoom 2, kald (tom cache) og varm. */
function perf({ zoom = 2, reps = 60, style = 'faceted' } = {}) {
  loop.stop(); const p = world.player; const cx = p.x, cy = p.y;
  camera.follow(null); camera.x = cx; camera.y = cy; camera.zoom = zoom;
  const kinds = ['stand', 'aim', 'walk', 'run', 'cover', 'peek', 'aim', 'walk', 'stand'];
  const rigs = kinds.map((k, i) => poseRig(cx - 60 + (i % 3) * 60, cy - 50 + Math.floor(i / 3) * 50, k, i * .7 + .3, 1.3));
  const sty = style === 'faceted' ? faceted : { drawFigure: obliqueDraw };
  if (style === 'faceted') clearAllCaches();
  const draw = () => { camera.apply(ctx); const t0 = performance.now(); for (const r of rigs) sty.drawFigure(ctx, r, r.frame(), {}); ctx.setTransform(1, 0, 0, 1, 0, 0); return performance.now() - t0; };
  // kald: første bilde med tom cache (budsjettet slås av for å måle full bake)
  const keepB = faceted.CFG.budgetMs; faceted.CFG.budgetMs = 1e9;
  const cold = draw(); faceted.CFG.budgetMs = keepB;
  // varm: samme positurer + animerte (gang går videre, så nye nøkler bakes etter hvert – mål både statisk og animert)
  const ws = []; for (let i = 0; i < reps; i++) ws.push(draw()); ws.sort((a, b) => a - b);
  const anim = []; let bakesBefore = cacheReport().bakes;
  for (let i = 0; i < 240; i++) { for (const [j, r] of rigs.entries()) { const k = kinds[j], a = j * .7 + .3, d = POSES[k](a), v = d.move || 0;
      const F0 = r.frame(); r.drive({ x: F0.x + Math.cos(a) * v / 60, y: F0.y + Math.sin(a) * v / 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v, aimAngle: d.aimAngle + Math.sin(i / 30 + j) * .9, mode: d.mode, cover: d.cover || null, aimBlend: d.aimBlend || 0, peek: d.peek || 0, blind: 0, ...(v ? { moveAngle: a } : {}) }); r.update(1 / 60); }
    anim.push(draw()); }
  anim.sort((a, b) => a - b);
  const cr = cacheReport();
  const med = (A) => A[A.length >> 1], p95 = (A) => A[Math.floor(A.length * .95)];
  return { style, zoom, dpr: devicePixelRatio, figures: rigs.length, coldFrameMs: cold, coldPerFig: cold / rigs.length,
    warmMedPerFig: med(ws) / rigs.length, warmP95PerFig: p95(ws) / rigs.length,
    animMedPerFig: med(anim) / rigs.length, animP95PerFig: p95(anim) / rigs.length, animMaxFrame: anim[anim.length - 1], animBakes: cr.bakes - bakesBefore, cache: cr };
}
window.BREACH = { show: SHOW, world, loop, camera, input, player: PR, STATS, oblique, faceted, setStyle, get style() { return styleName; } };
window.BENCH = { scene, perf, poseRig, POSES, cacheReport, clearAllCaches, hidePlayerRender };
