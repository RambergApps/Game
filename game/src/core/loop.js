import { updateProjectiles, drawProjectiles } from './combat.js';
import { updateEffects, drawEffects } from './effects.js';
import { drawDebugWorld, drawDebugHud } from './debug.js';
import { drawSorted, canSort } from '../shared/depth.js';
import * as vfx from '../effects/index.js';                 // Breach Effekter (docs/EFFEKTER.md)
export const STEP = 1 / 60;
const MAX_STEPS = 5;
const call = (m, fn, ...a) => m && typeof m[fn] === 'function' && m[fn](...a);

/** mods: { level, player, enemies, arena, weapons?, physics?, audio?, story?, hud? } – moduler med update/draw. */
export function createLoop({ world, ctx, camera, input, mods }) {
  let acc = 0, last = 0, raf = 0, running = false; const stats = { fps: 60, steps: 0 };
  vfx.init(world, { quality: world.settings?.vfxQuality ?? 'high' }); vfx.bindEvents(world);   // lytter på world.events (hva som er påslått: effects/bind.js MIGRATION)
  // Ytelsesmerker (Arena eier world.perf og ?perf=1-overlegget, src/arena/perf.js). Konvensjon: mark(navn) kalles RETT FØR
  // hvert system; tiden for et system = neste merke − dette merket. 'update:end' / 'render:end' avslutter fasen.
  // Navn: update:{level,player,enemies,arena,physics,weapons,projectiles,effects} og render:{arena,fxUnder,cover,sorted,
  // enemies,player,weapons,projectiles,fxOver,top,hud,levelHud,playerHud}. Uten world.perf koster det ett ?.-oppslag.
  const mark = (n) => world.perf?.mark?.(n);
  function step(dt) {
    input.sync(camera);
    if (input.pressed('F1')) world.debug = !world.debug;
    const frozen = !world.paused && world.hitstopT > 0;
    if (frozen) { world.hitstopT -= dt; if (world.hitstopT < 1e-6) world.hitstopT = 0; }   // hitstop: simuleringen står, lyd/kamera/UI går
    else if (!world.paused) {
      const sdt = dt * (world.timeScale ?? 1);                       // alle moduler får skalert dt
      if (sdt > 0) {
        // input → level → player → enemies → arena → physics → weapons → projectiles → effects
        mark('update:level'); call(mods.level, 'update', sdt, world); mark('update:player'); call(mods.player, 'update', sdt, world);
        mark('update:enemies'); call(mods.enemies, 'update', sdt, world); mark('update:arena'); call(mods.arena, 'update', sdt, world);
        mark('update:physics'); call(mods.physics, 'update', sdt, world); // f.eks. separateActors (shared/)
        mark('update:weapons'); call(mods.weapons, 'update', sdt, world); // våpen/granater: etter aktører, før kuler (tåler dobbeltkall per steg)
        mark('update:projectiles'); updateProjectiles(sdt, world); mark('update:effects'); updateEffects(sdt, world); vfx.update(sdt, world);
        mark('update:end');
        world.time += sdt;
      }
    }
    call(mods.audio, 'update', dt, world); // ekte dt; kjøres også i pause/hitstop (lyd demper selv ved world.paused)
    camera.update(dt, world);
    if (!frozen) input.endFrame();         // under hitstop beholdes tastetrykk til simuleringen går igjen
    stats.steps++;
  }
  function render() {
    mark('render:begin');
    const c = ctx.canvas; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#121416'; ctx.fillRect(0, 0, c.width, c.height);
    camera.apply(ctx);
    mark('render:arena');      call(mods.arena, 'draw', ctx, world, camera);              // arena (bunn)
    mark('render:fxUnder');    drawEffects(ctx, world, camera, 'under');                  // f.eks. blodflekker, krater
    vfx.draw(ctx, world, camera, 'under');                     // bakke: ichorflekker, sprekker, brennmerker, bakkelys
    mark('render:cover');      call(mods.arena, 'drawCover', ctx, world, camera);         // valgfritt eget cover-lag
    // Trekvart: aktører og dekning tegnes sortert (shared/depth.js) når både player og enemies har drawActor.
    // world.depthSorted = true betyr at draw() IKKE skal tegne selve aktøren (bare siktelinjer, varsler o.l.).
    mark('render:sorted');
    world.depthSorted = world.view === '34' && canSort(world);
    if (world.depthSorted) drawSorted(ctx, world, camera, { cover: mods.arena?.coverObjects?.(world), drawCover: mods.arena?.drawCoverObject });
    mark('render:enemies');    call(mods.enemies, 'draw', ctx, world, camera);            // aktører (eller bare tillegg når depthSorted)
    mark('render:player');     call(mods.player, 'draw', ctx, world, camera);
    mark('render:weapons');    call(mods.weapons, 'draw', ctx, world, camera);            // sporstreker, granater, kastbane (ÉN gang per ramme)
    mark('render:projectiles'); drawProjectiles(ctx, world);                              // z-bevisst + skjult bak dekning i 34 (combat.js)
    mark('render:fxOver');     drawEffects(ctx, world, camera, 'over');                   // effekter
    vfx.draw(ctx, world, camera, 'over');                      // luft: splinter, gnister, røyk, ild, glød
    mark('render:top');        call(mods.arena, 'drawTop', ctx, world, camera);           // valgfritt: lys/tak over aktører
    if (world.debug) drawDebugWorld(ctx, world);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    mark('render:hud');        call(mods.hud, 'draw', ctx, world, camera);                // HUD i skjermkoordinater (UI: skaderetning)
    mark('render:levelHud');   call(mods.level, 'drawHud', ctx, world, camera);
    mark('render:playerHud');  call(mods.player, 'drawHud', ctx, world, camera);
    if (world.debug) drawDebugHud(ctx, world, stats);
    mark('render:end');
  }
  function frame(ts) {
    if (!running) return;
    const t = ts / 1000, dt = Math.min(last ? t - last : STEP, STEP * MAX_STEPS); last = t;
    stats.fps += ((dt > 0 ? 1 / dt : 60) - stats.fps) * 0.05;
    acc += dt; while (acc >= STEP) { step(STEP); acc -= STEP; }
    render(); raf = requestAnimationFrame(frame);
  }
  return {
    stats, step, render,
    start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    /** Kjør n faste steg synkront (for tester). */
    advance(n = 1) { for (let i = 0; i < n; i++) step(STEP); render(); },
  };
}
