// Hunker (27.10, docs/FIENDE-COVER-SKISSE.md): bruker KUN lavt cover. Grunt-tilstandsmaskinen (seekCover → inCover →
// telegraph → fire → returnCover) med Hunker-lag oppå:
//  • dekningsvalg: coverBias low 2 / high −99 (stats.js). Finnes intet lavt cover → jaktsteg (hunt.js) i stedet for å stå.
//  • ryggskjold: e.damageMult – ×0,5 når fienden står i lav dekning (inCover/suppressed, dukket) og treffet kommer innenfor
//    ±60° av coverets front (−normal). Ellers full skade. Skjoldtreff → e.shieldHitAt (poseOf.shieldHit).
//  • flanking: spilleren ser forbi normalen (> 70° fra fronten) → slipp dekningen og velg ny (aldri en av de 2 siste).
//  • coverbytte etter 2–3 salver i samme dekning.
//  • telegraf = peek 0→1 over telegraphDur (≥ 0,45 s); attackPhase (munningsblink) først i 'fire'.
// Felles regler gjelder uendret: squad-tokens (maks 2 skyttere), onscreen-sperre, softlock-/stuck-vakt, A2-fiksen.
import { chooseCover, goTo } from '../ai.js';
import { BODY } from '../stats.js';
import { HUNKER_MUZZLE } from '../look/hunker.js';
import { unreserve } from '../squad.js';

// Munning fra Monsterdesigns eksport (ikke hardkodet): høyde i BODY, framlengde via def.muzzleFwd (states.muzzle/weapon).
BODY.hunker.muzzleZ = BODY.hunker.crouchMuzzleZ = HUNKER_MUZZLE.z;
// hunt.js lastes sent (statisk import gir sirkel states → behaviors → hunt → states ved oppstart)
let huntMod = null; import('../hunt.js').then((m) => { huntMod = m; });
const huntStep = (w, e, why) => huntMod?.huntStep(w, e, why);
const DEG = Math.PI / 180;
const DUCK = new Set(['inCover', 'suppressed']);
const SPOTTED = new Set(['inCover', 'suppressed', 'telegraph', 'fire']);

/** Front-retning for dekningen (mot fienden coveret beskytter mot) = −normal. */
export function coverFront(e) { const s = e.spot; return s && Number.isFinite(s.nx) ? Math.atan2(-s.ny, -s.nx) : null; }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

function shieldMult(e) {
  return (amount, I) => {
    const S = e.def.shield; if (!S || !DUCK.has(e.state) || !e.spot || e.spot.type !== 'low') return amount;
    const src = I?.source, sx = src?.x ?? src?.owner?.x, sy = src?.y ?? src?.owner?.y;
    if (!Number.isFinite(sx)) return amount;
    const f = coverFront(e); if (f == null) return amount;
    if (angDiff(Math.atan2(sy - e.y, sx - e.x), f) > S.arcDeg * DEG) return amount;
    e.shieldHitAt = e._world?.time ?? 0; e.shieldHits = (e.shieldHits || 0) + 1;
    return amount * S.mult;
  };
}

function shift(world, e, why) {
  const sp = e.spot;
  if (sp) { e.recentSpots = [sp.id, ...(e.recentSpots || [])].slice(0, 2); unreserve(world, e); }
  e.spot = null; e.coverHeld = null; e.salvos = 0; e.shifts = (e.shifts || 0) + 1;
  world.events.emit('hunkerShift', { entity: e, x: e.x, y: e.y, reason: why, team: 'enemy' });
  hunker.think(world, e, { reposition: true });
}

function ownSpot(world, e) {
  // egen kantavstand (def.spotOffset ≈ 20 px bak kanten; felles OFF gjelder de andre typene): personlig kopi av plassen
  const sp = e.spot, OFF = sp && sp.cover ? (sp.nx ? (sp.nx > 0 ? sp.x - (sp.cover.x + sp.cover.w) : sp.cover.x - sp.x) : (sp.ny > 0 ? sp.y - (sp.cover.y + sp.cover.h) : sp.cover.y - sp.y)) : 0;
  if (sp && !sp._hk && OFF > e.def.spotOffset) {
    const d = OFF - e.def.spotOffset, nx = sp.x - sp.nx * d, ny = sp.y - sp.ny * d;
    e.spot = { ...sp, x: nx, y: ny, _hk: true };
    if (e.state === 'seekCover') goTo(world, e, nx, ny, 'seekCover');
  }
}

export const hunker = {
  think(world, e, opts = {}) {
    chooseCover(world, e, opts);
    ownSpot(world, e);
    // samme punkt som nylig forlatt, eller ingen lav dekning → jakt i stedet (aldri stå)
    const s = e.spot;
    if (e.state === 'seekCover' && s && (s.type !== 'low' || (e.recentSpots || []).includes(s.id))) { unreserve(world, e); e.spot = null; huntStep(world, e, 'hunker-nocover'); }
    else if (e.state === 'idle' || e.state === 'hold') { if (world.player && !world.player.dead && e.aware) huntStep(world, e, 'hunker-nocover'); }
  },
  tick(world, e, dt) {
    e._world = world;
    ownSpot(world, e);
    if (!e.damageMult) e.damageMult = shieldMult(e);
    // huk for kroppshøyde (BODY 39 → 18,6): dukket i dekning, delvis i sprint, reist i telegraph/fire
    const tgt = DUCK.has(e.state) ? 1 : (e.state === 'seekCover' || e.state === 'returnCover') ? 0.5 : 0;
    e.crouch = (e.crouch || 0) + (tgt - (e.crouch || 0)) * Math.min(1, dt * 10);
    if (e.prevStateSeen !== e.state) { if (e.state === 'fire') e.salvos = (e.salvos || 0) + 1; e.prevStateSeen = e.state; }
    const p = world.player;
    if (!p || p.dead || !e.spot || !SPOTTED.has(e.state)) return;
    const f = coverFront(e);
    if (f != null && angDiff(Math.atan2(p.y - e.y, p.x - e.x), f) > e.def.flankDeg * DEG && e.state !== 'fire') return shift(world, e, 'flanked');
    if (e.state === 'inCover') {
      if (e.shiftAfter == null) e.shiftAfter = e.def.shiftEvery[0] + Math.floor(world.rng() * (e.def.shiftEvery[1] - e.def.shiftEvery[0] + 1));
      if ((e.salvos || 0) >= e.shiftAfter) { e.shiftAfter = null; shift(world, e, 'salvos'); }
    }
  },
};
