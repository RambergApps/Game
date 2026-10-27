// Register over oppførsler. Ny type = ny fil her + oppføring i stats.js (behavior: '<navn>').
// En oppførsel er { think(world, e, opts), inCover?(world, e, dt) → true hvis den tok over,
//                   tick?(world, e, dt) hver frame, states?: { navn: {enter, update, exit} } }.
// states registreres i den felles tilstandsmaskinen av index.js.
import { grunt } from './grunt.js';
import { flanker } from './flanker.js';
import { heavy } from './heavy.js';
import { grenadier } from './grenadier.js';
import { ashmaw } from './ashmaw.js';
import { hunker } from './hunker.js';

export const BEHAVIORS = { grunt, flanker, heavy, grenadier, ashmaw, hunker };
