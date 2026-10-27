// Flanker: rask, bruker sideruter for å komme på siden/bak spillerens dekning og presser isolerte mål.
// Kun én flanker aktivt om gangen (flank-token i squad.js). Uten token oppfører den seg som en
// mobil, nærgående grunt og venter på sjansen.
// Nærkamp (runde 2): KUN flank-token-holderen, KUN fra siden/bakfra, KUN når den er helt inne (≈1,5 ruter):
//   meleeRush (storm inn fra ≤ trigger px, maks rushMax s, ingen skudd; krever minst én telegrafert flankesalve først) → meleeCharge (0,3 s oppladning + 'telegraph' {melee:true, duration 0,465})
//   → meleeStrike (weapons.tryMelee: Våpens contactAt 0,165 s med låst vinkel, treff/skade/stagger eies av Våpen)
//   → meleeRecover (0,45 s sårbar). Synlig varsel totalt = charge 0,3 + contactAt 0,165 = 0,465 s.
// Aldri skudd og slag i samme vindu: ingen nærkamp < fireBlock s etter et skudd, ingen skudd < fireBlock s etter slaget.
// Stagger (spillerens nærkamp) avbryter oppladningen (stagger.js) → «nærkamp tilbake» er et gyldig svar.
import { chooseCover, flankWorthIt, tryFlank, moveDirect, stop } from '../ai.js';
import { setState, aimAt } from '../states.js';
import { getSquad, releaseFlank } from '../squad.js';
import { melee, meleeBusy, weapons } from '../weapon.js';

const DEG = Math.PI / 180;
const hooked = new WeakSet();
/** Våpens 'melee' phase 'hit' → e.meleeHit (til pose/statistikk). */
function hookMelee(world) {
  if (hooked.has(world)) return; hooked.add(world);
  world.events.on('melee', ({ entity, phase, targets }) => { if (phase === 'hit' && entity?.team === 'enemy') entity.meleeHit = !!targets?.includes(world.player); });
}

/** Kan flankeren starte nærkamp nå? (token, avstand, side/bak, cooldown, skuddvindu) */
export function meleeReady(world, e, maxDist, ignoreFireBlock = false) {
  const M = e.def.melee, p = world.player;
  if (!M || !p || p.dead || !e.sees) return false;
  if (!getSquad(world).flankers.has(e)) return false;                  // kun token-holderen
  if (world.time < (e.meleeReadyAt || 0)) return false;
  if ((e.flankVolleys || 0) < (M.minVolleys ?? 0)) return false;               // har allerede røpet seg med et telegrafert flankeskudd
  if (!ignoreFireBlock && world.time - (e.lastFireAt ?? -99) < M.fireBlock) return false;  // ikke skudd + slag i samme vindu
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d > maxDist) return false;
  const face = p.facing ?? p.aim ?? 0, toE = Math.atan2(e.y - p.y, e.x - p.x);
  const off = Math.abs(Math.atan2(Math.sin(toE - face), Math.cos(toE - face)));
  return off >= M.sideAngle * DEG;                                      // side eller bak
}

export const flanker = {
  think(world, e, opts) {
    if (e.aware && flankWorthIt(world, e) && tryFlank(world, e)) return;
    chooseCover(world, e, opts);
  },
  inCover(world, e, dt) {
    e.flankCheckT = (e.flankCheckT || 0) + dt;
    if (e.flankCheckT < 0.8) return false;
    e.flankCheckT = 0;
    return flankWorthIt(world, e) && tryFlank(world, e);
  },
  /** Hook fra engage-tilstanden: storm inn hvis spilleren er nær og vender bort. */
  engage(world, e) {
    // Vil slå, men skuddvinduet er ikke over: hold ilden (ingen ny salve) til fireBlock har gått.
    if (!meleeReady(world, e, e.def.melee.trigger)) return meleeReady(world, e, e.def.melee.trigger, true);
    setState(world, e, 'meleeRush');
    return true;
  },
  states: {
    meleeRush: {
      update(w, e, dt) {
        const M = e.def.melee, p = w.player;
        if (!p || p.dead) return setState(w, e, 'engage');
        aimAt(e, dt, p.x, p.y, 2);
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d <= M.start) { stop(e); return setState(w, e, 'meleeCharge'); }
        if (e.stateT > M.rushMax || !e.sees) { e.meleeReadyAt = w.time + 1.5; return setState(w, e, 'engage'); }
        moveDirect(w, e, dt, p.x, p.y, e.def.runSpeed);
      },
      exit(w, e) { stop(e); },
    },
    meleeCharge: {
      enter(w, e) {
        const M = e.def.melee, p = w.player;
        stop(e);
        const dur = M.charge + (weapons.TUNING?.melee?.contactAt ?? 0.165);
        e.meleeChargeDur = dur;
        w.events.emit('telegraph', { entity: e, x: e.x, y: e.y, team: 'enemy', duration: dur, weapon: 'melee', melee: true, flank: true,
          target: p || null, dir: p ? Math.atan2(e.y - p.y, e.x - p.x) : null });
        w.events.emit('meleeCharge', { entity: e, x: e.x, y: e.y, team: 'enemy', duration: dur });
      },
      update(w, e, dt) {
        const M = e.def.melee, p = w.player;
        if (!p || p.dead) return setState(w, e, 'engage');
        aimAt(e, dt, p.x, p.y, 1.2);    // følger etter, men kan ikke snu uendelig fort
        if (e.stateT < M.charge) return;
        if (!melee(w, e, e.aim)) { e.meleeReadyAt = w.time + 1; return setState(w, e, 'engage'); }
        setState(w, e, 'meleeStrike');
      },
    },
    meleeStrike: {   // Våpens slag pågår (start → contactAt → hit → end); vinkelen er låst av Våpen
      enter(w, e) { e.meleeHit = false; hookMelee(w); },
      update(w, e) { if (!meleeBusy(e) || e.stateT > 0.6) setState(w, e, 'meleeRecover'); },
    },
    meleeRecover: {
      enter(w, e) { const M = e.def.melee; e.flankVolleys = 0; e.meleeReadyAt = w.time + M.cooldown; e.noFireUntil = w.time + M.fireBlock; },
      update(w, e) {
        if (e.stateT < e.def.melee.recover) return;
        releaseFlank(w, e, e.def.flank.cooldown);   // nærkamp avslutter flanken – trekk ut og finn dekning
        e.after = 'cover';
        chooseCover(w, e, { urgent: true });
      },
    },
  },
};
