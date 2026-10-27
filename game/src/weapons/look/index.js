// BREACH – alle våpen-utseender (faceted). Eies av Breach Våpen. Én import registrerer alle tre:
//   import '../../weapons/look/index.js';   (fra shared/rig/faceted/… – Warden-design kobler inn)
// Defene erstatter Warden-designs midlertidige 'rifle' (samme id, høyere version → ny cache-nøkkel).
import { RIFLE_LOOK } from './rifle.js';
import { SHOTGUN_LOOK } from './shotgun.js';
import { MARKSMAN_LOOK } from './marksman.js';
export const LOOKS = { rifle: RIFLE_LOOK, shotgun: SHOTGUN_LOOK, marksman: MARKSMAN_LOOK };
export { RIFLE_LOOK, SHOTGUN_LOOK, MARKSMAN_LOOK };
