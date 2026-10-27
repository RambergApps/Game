// Granater for fiender. Granatene og 'explosion' eies av Breach Våpen (src/weapons/grenades.js) – ingen stubb lenger
// (Breach runde 2: Grenadier bruker Våpens spawnGrenade). Våpen oppdaterer og tegner granaten (weapon.js sørger for
// at weapons.update kjøres hvert steg selv om hovedløkka mangler våpenplass). Her ligger bare fiende-AI-ens tillegg:
// landingsmarkøren (varselet) som render.js tegner.
// Våpen-signatur: spawnGrenade(world, { x, y, angle, power | distance, owner, team, dmg?, radius?, fuse?, … }) –
//   fuse regnes fra kastet; ekte sprett/rulle-fysikk; kastelengde maks GRENADE.maxThrow (288 px).
// Hendelser (fra Våpen): 'grenade' {x, y, angle, power, team, owner, entity, weapon:'grenade', grenade},
//   'explosion' {x, y, radius, team, owner, entity, weapon:'grenade', surface, hits} (sendes ETTER skaden).
import { onScreen } from './onscreen.js';
import { dist } from '../core/index.js';
import { weapons } from './weapon.js';

const lists = new WeakMap(); // world → { grenades:[], blasts:[], markers:[] } (kun data; tegnes av render.js)

/** grenades/blasts er tomme (beholdt for bakoverkompatibel tegning); markers = landingsvarsler. */
export function grenadeState(world) {
  let s = lists.get(world);
  if (!s) { s = { grenades: [], blasts: [], markers: [] }; lists.set(world, s); }
  return s;
}

/**
 * Kast via Våpen. opts: { x, y, tx, ty, team, owner, flight, fuse, radius, dmg } (fuse = tid fra landing,
 * flight = flytid → Våpen-lunte = flight + fuse). Lengre kast enn maxThrow kortes ned (AI-en sikter innenfor).
 */
/**
 * Breach 13:52 pkt. 3: 'grenade' {phase:'land'} når en FIENDEgranat (Spitter-sekk) lander. Ingen sender den i dag
 * (Våpen har bare grenadeBounce {landing:true}); Lyd lytter allerede etter den. Midlertidig her for fiendens granater,
 * samme form som Våpens 'grenade'-hendelser. g._landSent hindrer dobbel sending – når Våpen sender 'land' selv for alle
 * granater (utkast i rapporten), fjernes denne lytteren.
 */
const landHooked = new WeakSet();
function hookLanding(world) {
  if (landHooked.has(world)) return;
  landHooked.add(world);
  world.events.on('grenade', (pl) => { if (pl?.phase === 'land' && pl.grenade) pl.grenade._landSent = true; });
  world.events.on('grenadeBounce', (pl) => {
    const g = pl?.grenade;
    if (!pl.landing || !g || g.team !== 'enemy' || g._landSent) return;
    g._landSent = true;
    world.events.emit('grenade', { phase: 'land', x: pl.x, y: pl.y, team: g.team, owner: g.owner, entity: g.owner, weapon: 'grenade',
      grenade: g, fuse: Math.max(0, (g.def?.fuse ?? 0) - (g.t ?? 0)), surface: pl.surface, material: pl.material });
  });
}

export function throwGrenade(world, opts) {
  if (opts.owner && !onScreen(world, opts.owner)) return null;   // 27.10: aldri kast fra utenfor bildet
  hookLanding(world);
  const max = weapons.GRENADE.maxThrow;
  const d = Math.min(max, dist(opts.x, opts.y, opts.tx, opts.ty));
  const angle = Math.atan2(opts.ty - opts.y, opts.tx - opts.x);
  const fuse = (opts.flight ?? 0.7) + (opts.fuse ?? 1.1);
  const o = { x: opts.x, y: opts.y, angle, distance: d, owner: opts.owner, team: opts.team || 'enemy', dmg: opts.dmg, radius: opts.radius, fuse };
  // Landingsmarkør fra Våpens egen baneberegning (deterministisk), så varselet viser hvor granaten faktisk havner.
  const pred = weapons.predictGrenade(world, o.x, o.y, angle, 1, { distance: d, radius: o.radius, fuse });
  const g = weapons.spawnGrenade(world, o);
  const end = pred?.end || { x: opts.x + Math.cos(angle) * d, y: opts.y + Math.sin(angle) * d };
  grenadeState(world).markers.push({ x: end.x, y: end.y, radius: opts.radius ?? 90, t: 0, life: fuse, grenade: g });
  return g;
}

export function updateGrenades(dt, world) {
  const s = lists.get(world);
  if (!s) return;
  for (const m of s.markers) m.t += dt;
  s.markers = s.markers.filter((m) => m.t < m.life && !m.grenade?.dead);
}
