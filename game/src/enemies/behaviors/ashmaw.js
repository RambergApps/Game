// Ashmaw – PLASSHOLDER (fase 1 av bossarbeidet, 23.10). Oppførselen er planlagt i docs/BOSS.md og er IKKE implementert:
// hun står, følger spilleren med kjeften og angriper ikke. Typen finnes slik at Monsterdesign kan registrere tegning
// (registerEnemyArt('ashmaw', null, …)) og teste mot poseOf (P.vents) før kampen bygges.
import { setState } from '../states.js';
import { stop } from '../ai.js';

const VENTS = 8;
export function initVents(e) {
  if (e.vents) return;
  e.vents = [];
  for (let i = 0; i < VENTS; i++) e.vents.push({ id: i, angle: (i / VENTS) * Math.PI * 2, open: true, broken: false, heat: 0.6, hp: e.def.boss?.ventHp ?? 150 });
}

export const ashmaw = {
  think(world, e) { initVents(e); setState(world, e, 'bossIdle'); },
  tick(world, e) {
    initVents(e);
    const p = world.player;
    // Visuell plassholder for ventil-logikken i BOSS.md: ventiler som vender mot spilleren er lukket.
    for (const v of e.vents) {
      if (v.broken) { v.open = false; v.heat = 0; continue; }
      const a = e.facing + v.angle, toP = p ? Math.atan2(p.y - e.y, p.x - e.x) : a;
      const facingP = Math.cos(a - toP) > Math.cos((e.def.boss?.closeArcDeg ?? 70) * Math.PI / 180);
      v.open = !facingP; v.heat = v.open ? 0.6 + 0.4 * Math.sin(world.time * Math.PI + v.id * 0.785) * 0.5 + 0.2 : 0.1;
    }
  },
  states: {
    bossIdle: {
      enter(w, e) { stop(e); },
      update(w, e, dt) {
        const p = w.player; if (!p || p.dead) return;
        const want = Math.atan2(p.y - e.y, p.x - e.x);
        let d = want - e.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        const turn = (e.def.turnRate ?? 0.6) * dt;
        e.facing += Math.max(-turn, Math.min(turn, d)); e.aim = e.facing;
      },
    },
  },
};
