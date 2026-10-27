import { createWorld, createInput, createCamera, createLoop } from './core/index.js';
import { PROJ } from './shared/projection.js';
import * as player from './player/index.js';
import * as arena from './arena/index.js';
import * as enemies from './enemies/index.js';
import * as levels from './levels/index.js';
import * as story from './story/index.js';
import * as audio from './audio/index.js';
import * as weapons from './weapons/index.js';
import * as ui from './ui/index.js';
import { separateActors } from './shared/separateActors.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// DPR (Breach 27.10): bakbufferen er innerWidth·dpr, men all JS ser canvas.width/height, transformer og koordinater i CSS-px.
// canvas.width/height overstyres på instansen (CSS-px), og ctx.setTransform/getTransform skaleres med dpr under panseret,
// så HUD, kamera, musekoordinater og screenToWorld er uendret. dpr = min(devicePixelRatio, 2); ?dpr=1 slår av.
const dprOf = () => { try { const q = parseFloat(new URLSearchParams(location.search).get('dpr')); if (q > 0) return Math.min(q, 2); } catch (e) { /* */ } return Math.min(globalThis.devicePixelRatio || 1, 2); };
let DPR = dprOf(); // leses på nytt i resize() (skjermbytte/nettleserzoom), Warden 27.10
let cssW = innerWidth, cssH = innerHeight;
{ // alltid installert, siden DPR kan endres ved resize (ved dpr 1 er skaleringen identitet)
  const P = HTMLCanvasElement.prototype, wd = Object.getOwnPropertyDescriptor(P, 'width'), hd = Object.getOwnPropertyDescriptor(P, 'height');
  Object.defineProperty(canvas, 'width', { configurable: true, get: () => cssW, set: (v) => { cssW = v; wd.set.call(canvas, Math.round(v * DPR)); ctx.setTransform(1, 0, 0, 1, 0, 0); } });
  Object.defineProperty(canvas, 'height', { configurable: true, get: () => cssH, set: (v) => { cssH = v; hd.set.call(canvas, Math.round(v * DPR)); ctx.setTransform(1, 0, 0, 1, 0, 0); } });
  const st = ctx.setTransform.bind(ctx), gt = ctx.getTransform.bind(ctx);
  ctx.setTransform = (a, b, c, d, e, f) => {
    if (a && typeof a === 'object') ({ a, b, c, d, e, f } = a); else if (a === undefined) { a = d = 1; b = c = e = f = 0; }
    st(a * DPR, b * DPR, c * DPR, d * DPR, e * DPR, f * DPR);
  };
  ctx.resetTransform = () => ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.getTransform = () => { const m = gt(); return new DOMMatrix([m.a / DPR, m.b / DPR, m.c / DPR, m.d / DPR, m.e / DPR, m.f / DPR]); };
}
function resize() { DPR = dprOf(); canvas.width = innerWidth; canvas.height = innerHeight; canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; }
resize(); addEventListener('resize', resize);
// DPR-bytte uten størrelsesendring (flytt til annen skjerm) gir ingen resize-hendelse – lytt på oppløsningen også.
(function watchDpr() { const m = matchMedia(`(resolution: ${devicePixelRatio}dppx)`); m.addEventListener('change', () => { resize(); watchDpr(); }, { once: true }); })();

const world = createWorld();
const camera = createCamera(canvas), input = createInput(canvas);
world.camera = camera; world.input = input;
world.modules = { player, arena, enemies, levels, story, weapons };

// Treffeffekter (coverHit/projectileHit) eies av weapons (fx.js) for ALLE prosjektiler – ingen generiske gnister her.
// Felles rist går via camera.shake (kappet sum i core/camera.js).
world.events.on('death', ({ target }) => { if (target.team === 'enemy') camera.shake(5, 250); });
world.events.on('hit', ({ target, blocked, amount }) => { if (target === world.player && !blocked && amount > 0) camera.shake(3, 120); });

// init-rekkefølge: arena (cover) → weapons (idempotent) → player → enemies → levels → story
audio.init(world); // lyd kobles på før arena.init, så 'arenaLoaded' starter stemningsloopen
arena.init(world); weapons.init(world); player.init(world); enemies.init(world); levels.init(world); story.init?.(world);
if (world.player) { camera.follow(world.player); camera.x = world.player.x; camera.y = world.player.y; }
// «Klikk for å starte»: låser opp lyd i nettleseren før første bølge
world.paused = true;
const startScreen = document.createElement('div');
startScreen.id = 'start-screen';
startScreen.innerHTML = '<div style="font:700 64px system-ui;letter-spacing:6px">BREACH<span style="color:#e5533d">//</span></div><div style="margin-top:18px;font:600 16px system-ui;letter-spacing:4px;color:#9aa4ad">CLICK TO START</div>';
Object.assign(startScreen.style, { position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,12,14,0.82)', color: '#e8edf1', cursor: 'pointer', zIndex: 10 });
document.body.appendChild(startScreen);
function startGame() {
  if (!world.paused || !startScreen.isConnected) return;
  startScreen.remove(); world.paused = false;
  levels.startLevel(world, 1);
}
startScreen.addEventListener('pointerdown', startGame);
addEventListener('keydown', startGame, { once: true });

// UI (Våpen, src/ui, docs/UI.md): pausemeny (Esc), innstillinger, FPS, skaderetning. hud via wrapper fordi UI trenger loop.
let UI = null;
const loop = createLoop({ world, ctx, camera, input, mods: { level: levels, player, enemies, arena, weapons, audio, physics: { update: separateActors },
  hud: { draw: (c, w, cam) => UI?.hud.draw(c, w, cam) } } });
// Restart/quit: kjeden i pauseMenu.js er callback → levels.restartWave / arena.openMainMenu → ui:-hendelse.
// Callbackene under returnerer false når eiermodulen har egen funksjon (den tar over), ellers reserve her.
function restartWaveFallback(w) {
  if (typeof levels.restartWave === 'function') return false;              // Nivåer eier det når det finnes
  const d = levels._debug?.(w);
  if (!d?.n || typeof levels.startAt !== 'function') return false;          // ingen reserve → «not available yet»-toast
  levels.startAt(w, d.n, Math.max(0, d.wi), { skipCutscenes: true, upgrades: levels.getUpgradeState?.(w) });
  return true;
}
function quitFallback(w) {
  if (typeof arena.openMainMenu === 'function') return false;              // Arena eier hovedmenyen når den finnes
  location.reload();                                                        // tilbake til «Click to start»
  return true;
}
UI = ui.initUI(world, { loop, onRestartWave: restartWaveFallback, onQuit: quitFallback });   // etter audio.init og kamera
loop.start();
window.BREACH = { world, loop, camera, input, startGame, ui: UI, PROJ, DPR }; // PROJ: for tester (zScale/groundScaleY), godkjent av Breach 27.10
import('./menu/index.js').then((m) => m.attach(window.BREACH)); // hovedmeny (Arena, src/menu/): overlegg over spillet; ?skipmenu=1 hopper over
