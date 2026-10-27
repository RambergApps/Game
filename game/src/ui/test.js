// Testside for src/ui: ekte arena/spiller/fiender/våpen uten levels/story, så menyene kan prøves over et levende kampbilde.
// window.BREACH = { world, loop, camera, input, ui, UI, tests } – brukes av tests/run.mjs og tools/ui-shots.cjs.
import { createWorld, createInput, createCamera, createLoop, damage } from '../core/index.js';
import * as player from '../player/index.js';
import * as arena from '../arena/index.js';
import * as enemies from '../enemies/index.js';
import * as weapons from '../weapons/index.js';
import * as audio from '../audio/index.js';
import { separateActors } from '../shared/separateActors.js';
import * as ui from './index.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const world = createWorld();
const camera = createCamera(canvas), input = createInput(canvas);
world.camera = camera; world.input = input;
world.modules = { player, arena, enemies, weapons, audio };
audio.init(world); arena.init(world); weapons.init(world); player.init(world); enemies.init(world);
const p = world.player;
if (p) { camera.follow(p); camera.x = p.x; camera.y = p.y; }

// Fiender i nærheten (bakgrunn for skjermbilder). De står i ro: testsiden kaller ikke enemies.update.
const foes = [];
for (const [dx, dy, t] of [[230, -150, 'grunt'], [330, 30, 'heavy'], [170, 140, 'flanker']]) {
  try { const e = enemies.createEnemy(world, t, p.x + dx, p.y + dy); if (e) foes.push(e); } catch (err) { console.info('[ui-test] fiende', t, err?.message); }
}

const log = [];
world.events.on('ui:restartWave', (e) => { e.handled = true; log.push('restartWave'); p.hp = p.maxHp; });
world.events.on('ui:quitToMenu', (e) => { e.handled = true; log.push('quitToMenu'); world.paused = false; });
const shots = { player: 0 }; world.events.on('shot', (s) => { if (s.team === 'player') shots.player++; });

const hud = { draw: (...a) => UI?.hud.draw(...a) };
const loop = createLoop({ world, ctx, camera, input, mods: { player, arena, weapons, audio, hud, enemies: { update() {}, draw: enemies.draw, drawActor: enemies.drawActor }, physics: { update: separateActors } } });
const UI = ui.initUI(world, { loop });
loop.start();

function hurtFrom(dx, dy, amount = 18) {
  const src = { x: p.x + dx, y: p.y + dy, team: 'enemy' };
  const hp = p.hp; damage(p, amount, src, world); p.hp = Math.max(hp - amount, 30);   // testsiden: aldri død
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyK' && !UI.pause.isOpen() && !document.querySelector('[data-ui="settings"]')) {
    world.paused = true;
    ui.openSettings(document.body, { world, kicker: 'Main menu', onBack: () => { world.paused = false; } });
  }
  if (e.code === 'KeyJ') hurtFrom(-900, -300);
});

const tests = {
  /** Tiden står i pause: world.time endres ikke over n steg. */
  timeFrozen(n = 120) {
    const t0 = world.time; UI.pause.open(); loop.advance(n); const t1 = world.time; UI.pause.close(); loop.advance(60);
    return { frozen: t1 === t0, resumedDelta: +(world.time - t1).toFixed(4) };
  },
  hurtFrom, log, shots, foes,
};
window.BREACH = { world, loop, camera, input, ui, UI, tests };
