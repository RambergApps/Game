// Stagger (nærkamp fra spilleren, PROSJEKT.md 23.10): Våpen/Karakter setter entity.staggerUntil = world.time + 0.4.
// Tid sammenlignes med world.time (sekunder, samme klokke som all simulering – IKKE performance.now()).
// Mens world.time < staggerUntil: ingen skudd, ingen bevegelse, telegraf/spinn-opp/kast/nærkamp-oppladning AVBRYTES
// (ikke pause – en avbrutt telegraf må startes på nytt, med nytt fullt varsel, så spilleren aldri får et «halvt» varsel).
// Heavy: halv stagger. Valg: varigheten halveres NÅR den oppdages (første fiende-steg etter at feltet er satt) ved å
// skrive staggerUntil = t0 + (staggerUntil − t0) · def.staggerMul. Da leser alle (tegning, lyd, Karakter) samme feltet
// og ser den reelle varigheten; ingen andre trenger å vite om Heavy-regelen.
import { setState } from './states.js';
import { releaseFire, releaseFlank } from './squad.js';
import * as ai from './ai.js';

/** Kalles hvert steg før tilstanden oppdateres. → true hvis fienden er staggered (tilstanden 'staggered' tar over). */
export function checkStagger(world, e) {
  const u = e.staggerUntil;
  if (u !== e._staggerSeen) {
    e._staggerSeen = u;
    if (Number.isFinite(u) && u > world.time && e.def.staggerImmune) { e.staggerUntil = world.time; e._staggerSeen = e.staggerUntil; return false; } // boss: kun egne bossStagger-regler (BOSS.md)
    if (Number.isFinite(u) && u > world.time) {
      const mul = e.def.staggerMul ?? 1;
      if (mul !== 1) { e.staggerUntil = world.time + (u - world.time) * mul; e._staggerSeen = e.staggerUntil; }
      e.staggerT0 = world.time; e.staggerDur = e.staggerUntil - world.time;
      // Pågående kolbeslag før contactAt avbrytes nå av Våpen selv (rev. 4: updateMelee sjekker staggerUntil og sender
      // 'melee' {phase:'end', interrupted:true}). Vi teller bare for statistikk.
      if (e.loadout?.melee) e.meleeCancelled = (e.meleeCancelled || 0) + 1;
      world.events.emit('enemyStagger', { entity: e, x: e.x, y: e.y, team: 'enemy', duration: e.staggerDur, interrupted: e.state });
      if (e.state !== 'staggered') setState(world, e, 'staggered');
    }
  }
  return isStaggered(world, e);
}

export const isStaggered = (world, e) => Number.isFinite(e.staggerUntil) && world.time < e.staggerUntil;

export const staggeredState = {
  enter(w, e) {
    if (e.prevState === 'meleeRush' || e.prevState === 'meleeCharge' || e.prevState === 'meleeStrike') { // slaget avbrutt: full cooldown, flanken er over
      e.meleeReadyAt = w.time + (e.def.melee?.cooldown ?? 5); releaseFlank(w, e, e.def.flank?.cooldown ?? 4);
    }
    releaseFire(w, e);           // token tilbake (en annen kan ta over – men får selv fullt varsel)
    ai.stop(e); e.vx = 0; e.vy = 0; e.burstLeft = 0; e.toThrow = false;
  },
  update(w, e) {
    ai.stop(e); e.vx = 0; e.vy = 0;
    if (w.time < e.staggerUntil) return;
    e.peekCd = Math.max(e.peekCd || 0, 0.35);       // kort pust før neste kikk
    if (e.spot) setState(w, e, 'returnCover'); else ai.think(w, e, { urgent: true });
  },
};
